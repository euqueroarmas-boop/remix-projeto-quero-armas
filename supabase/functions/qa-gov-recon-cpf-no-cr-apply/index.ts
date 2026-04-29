// qa-gov-recon-cpf-no-cr-apply
// Migra Senhas GOV do Access para qa_cliente_credenciais por CPF normalizado
// para clientes SEM CR ativo (status = 'cliente_sem_cr_ativo' na view).
//
// Modos:
//   { mode: "dry_run" }  -> apenas simula
//   { mode: "apply" }    -> grava, recriptografa, registra auditoria
//
// Regras:
//   - cadastro_cr_id = NULL (cliente não tem CR ativo)
//   - origem = 'access_by_cpf_reconciliation_sem_cr'
//   - dedup: 1 credencial ativa por (cliente, gov_br) — se já houver ativa, marca antiga como 'inativa'
//   - nunca loga senha em texto claro
//
// Apenas staff QA pode invocar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";

const corsHeaders = qaAuthCors;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

async function loadKey(): Promise<CryptoKey> {
  const rawEnv = Deno.env.get("QA_ENCRYPTION_KEY") || "";
  if (!rawEnv) throw new Error("QA_ENCRYPTION_KEY not configured");
  const raw = rawEnv.replace(/\s+/g, "").trim();
  let bytes: Uint8Array | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    bytes = hexToBytes(raw);
  } else {
    let b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    bytes = b64ToBytes(b64);
  }
  if (!bytes || bytes.length !== 32) throw new Error("QA_ENCRYPTION_KEY inválida (precisa 32 bytes)");
  return await crypto.subtle.importKey(
    "raw",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptSenha(plaintext: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer.slice(0) as ArrayBuffer },
    key,
    enc.buffer.slice(0) as ArrayBuffer,
  );
  const cipher = new Uint8Array(cipherBuf);
  const tagLen = 16;
  const ct = cipher.slice(0, cipher.length - tagLen);
  const tag = cipher.slice(cipher.length - tagLen);
  return { ct, iv, tag };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "dry_run");
    if (!["dry_run", "apply"].includes(mode)) return json({ error: "mode inválido" }, 400);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent") || null;

    // 1) Plano: casos cliente_sem_cr_ativo
    const { data: plano, error: planErr } = await admin
      .from("qa_gov_password_reconciliation_by_cpf")
      .select("cpf_norm,nome_access,email_access,cliente_id,nome_supabase,total_crs_ativos")
      .eq("status", "cliente_sem_cr_ativo")
      .order("cliente_id", { ascending: true });
    if (planErr) return json({ error: planErr.message }, 500);

    const candidates = (plano as any[]) ?? [];

    // 2) Resgatar senha plaintext do staging (de forma indexada por cpf_norm)
    const { data: stagedRows, error: stErr } = await admin
      .from("staging_access_senhas_gov")
      .select("id_access,cpf,cliente_id_access,senha_plaintext,import_batch")
      .eq("import_batch", "access_2026_04_29");
    if (stErr) return json({ error: stErr.message }, 500);

    const stagedByCpf = new Map<string, { senha: string }>();
    for (const r of (stagedRows as any[]) ?? []) {
      const norm = String(r.cpf || "").replace(/[^0-9]/g, "");
      if (norm && r.senha_plaintext && !stagedByCpf.has(norm)) {
        stagedByCpf.set(norm, { senha: String(r.senha_plaintext) });
      }
    }

    // 3) Para cada candidato, verifica se já existe credencial ativa (idempotência)
    const planFinal: any[] = [];
    for (const c of candidates) {
      const cpfNorm = String(c.cpf_norm || "");
      const senhaInfo = stagedByCpf.get(cpfNorm);
      if (!senhaInfo) {
        planFinal.push({ ...c, skip: true, reason: "senha_plaintext nao encontrada no staging" });
        continue;
      }
      const { data: existente } = await admin
        .from("qa_cliente_credenciais")
        .select("id,origem,status")
        .eq("cliente_id", c.cliente_id)
        .eq("tipo_credencial", "gov_br")
        .eq("status", "ativa")
        .maybeSingle();
      planFinal.push({
        ...c,
        skip: false,
        ja_tem_credencial_ativa: !!existente,
        credencial_id_existente: existente?.id ?? null,
      });
    }

    if (mode === "dry_run") {
      return json({
        ok: true,
        mode,
        total_candidatos: candidates.length,
        a_aplicar: planFinal.filter((p) => !p.skip).length,
        ja_existem: planFinal.filter((p) => p.ja_tem_credencial_ativa).length,
        skipped: planFinal.filter((p) => p.skip).length,
        plano: planFinal.map((p) => ({
          cpf: p.cpf_norm,
          cliente_id: p.cliente_id,
          nome: p.nome_supabase,
          ja_tem_credencial_ativa: !!p.ja_tem_credencial_ativa,
          skip: !!p.skip,
          reason: p.reason || null,
        })),
      });
    }

    // 4) APPLY
    const key = await loadKey();
    const applied: any[] = [];
    const errors: any[] = [];

    for (const p of planFinal) {
      if (p.skip) continue;
      const cpfNorm = String(p.cpf_norm);
      const senhaInfo = stagedByCpf.get(cpfNorm);
      if (!senhaInfo) continue;

      try {
        const { ct, iv, tag } = await encryptSenha(senhaInfo.senha, key);

        let credencialId: number | null = null;
        let rollbackPayload: any = null;

        if (p.ja_tem_credencial_ativa && p.credencial_id_existente) {
          // Idempotência: se já tem ativa de outra origem, atualiza in-place mantendo histórico
          const { data: prev } = await admin
            .from("qa_cliente_credenciais")
            .select("id,senha_encrypted,senha_iv,senha_tag,origem,cadastro_cr_id")
            .eq("id", p.credencial_id_existente)
            .maybeSingle();

          rollbackPayload = prev
            ? {
                prev_id: prev.id,
                prev_origem: prev.origem,
                prev_cadastro_cr_id: prev.cadastro_cr_id,
                prev_encrypted_b64: prev.senha_encrypted ? bytesToB64(toBytes(prev.senha_encrypted)) : null,
                prev_iv_b64: prev.senha_iv ? bytesToB64(toBytes(prev.senha_iv)) : null,
                prev_tag_b64: prev.senha_tag ? bytesToB64(toBytes(prev.senha_tag)) : null,
              }
            : null;

          const { error: updErr } = await admin
            .from("qa_cliente_credenciais")
            .update({
              senha_encrypted: "\\x" + bytesToHex(ct),
              senha_iv: "\\x" + bytesToHex(iv),
              senha_tag: "\\x" + bytesToHex(tag),
              origem: "access_by_cpf_reconciliation_sem_cr",
              updated_by: guard.userId,
              notas: "Atualizado por reconciliação CPF (cliente sem CR).",
            })
            .eq("id", p.credencial_id_existente);
          if (updErr) throw updErr;
          credencialId = p.credencial_id_existente;
        } else {
          const { data: ins, error: insErr } = await admin
            .from("qa_cliente_credenciais")
            .insert({
              cliente_id: p.cliente_id,
              tipo_credencial: "gov_br",
              cadastro_cr_id: null,
              senha_encrypted: "\\x" + bytesToHex(ct),
              senha_iv: "\\x" + bytesToHex(iv),
              senha_tag: "\\x" + bytesToHex(tag),
              origem: "access_by_cpf_reconciliation_sem_cr",
              status: "ativa",
              updated_by: guard.userId,
              notas: "Migrado de Access (CPF único, cliente sem CR ativo).",
            })
            .select("id")
            .maybeSingle();
          if (insErr) throw insErr;
          credencialId = ins?.id ?? null;
        }

        await admin.from("qa_cliente_credenciais_audit").insert({
          credencial_id: credencialId,
          cliente_id: p.cliente_id,
          tipo_credencial: "gov_br",
          acao: p.ja_tem_credencial_ativa ? "applied_update" : "applied_insert",
          origem: "access_by_cpf_reconciliation_sem_cr",
          status_resultado: "applied",
          rollback_payload: rollbackPayload,
          ip,
          user_agent: ua,
          user_id: guard.userId,
          contexto: `CPF=${cpfNorm} cliente=${p.nome_supabase}`,
        });

        applied.push({
          cliente_id: p.cliente_id,
          nome: p.nome_supabase,
          cpf: cpfNorm,
          credencial_id: credencialId,
          tipo: p.ja_tem_credencial_ativa ? "update" : "insert",
        });
      } catch (e) {
        errors.push({
          cliente_id: p.cliente_id,
          cpf: cpfNorm,
          error: (e as Error).message,
        });
      }
    }

    return json({
      ok: true,
      mode,
      total_candidatos: candidates.length,
      total_aplicados: applied.length,
      total_erros: errors.length,
      applied,
      errors,
    });
  } catch (err) {
    console.error("[qa-gov-recon-cpf-no-cr-apply] erro", err);
    return json({ error: (err as Error).message || "Erro interno" }, 500);
  }
});

function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") {
    if (value.startsWith("\\x")) {
      const hex = value.slice(2);
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
      return out;
    }
    return b64ToBytes(value);
  }
  return new Uint8Array();
}
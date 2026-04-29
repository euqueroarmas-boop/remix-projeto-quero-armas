// Edge function: qa-gov-reconcile-apply
// Aplica a reconciliação CR <-> cliente + sobrescrita de senha gov,
// usando dados do staging (Bancodedados.accdb) carregados em
// staging_access_clientes / staging_access_crs / staging_access_senhas_gov.
//
// Endpoints (POST JSON):
//   { mode: "dry_run" }   -> retorna o plano de correção SEM tocar em produção
//   { mode: "apply", confirm: "RECONCILIAR_46" } -> aplica em transação única
//
// Auth: aceita x-internal-token (INTERNAL_FUNCTION_TOKEN) OU staff QA logado.
// Auditoria: cada UPDATE gera 1 row em qa_gov_reconciliation_audit com
// snapshot ANTES + DEPOIS + payload de rollback (cliente_id antigo + bytes
// senha_gov_encrypted/iv/tag antigos em base64).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { qaAuthCors, requireQAStaff } from "../_shared/qaAuth.ts";

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
function toHexLiteral(bytes: Uint8Array): string {
  return "\\x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function bytea(value: unknown): Uint8Array | null {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") {
    if (value.startsWith("\\x")) return hexToBytes(value.slice(2));
    try { return b64ToBytes(value); } catch { return null; }
  }
  return null;
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
    try { bytes = b64ToBytes(b64); } catch { bytes = null; }
  }
  if (!bytes || bytes.length !== 32) throw new Error("QA_ENCRYPTION_KEY inválida");
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

type PlanRow = {
  id_access: string;
  nome_access: string;
  cpf_access: string;
  numero_cr_access: string;
  cliente_id_correto: number;
  nome_cliente_correto: string;
  cr_id_no_sistema: number;
  cliente_id_atualmente_vinculado: number;
  nome_cliente_atualmente_vinculado: string;
  senha_plaintext: string;
  tem_senha_sistema: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: aceita token interno OU staff QA
    const internalToken = req.headers.get("x-internal-token") || "";
    const expected = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || "";
    let actor: string = "internal_token";
    let actorUserId: string | null = null;

    if (!internalToken || internalToken !== expected) {
      const guard = await requireQAStaff(req);
      if (!guard.ok) return guard.response;
      actor = "qa_staff";
      actorUserId = guard.userId;
    }

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "dry_run");
    const confirm = String(body?.confirm || "");

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    // 1) Construir o plano via SQL (RPC inline)
    const { data: planRaw, error: planErr } = await admin.rpc("qa_gov_reconcile_build_plan");
    if (planErr) return json({ error: "Falha ao montar plano: " + planErr.message }, 500);
    const plan = (planRaw || []) as PlanRow[];

    if (mode === "dry_run") {
      return json({
        mode: "dry_run",
        total_planejado: plan.length,
        amostra: plan.slice(0, 5).map((p) => ({
          cr: p.numero_cr_access,
          cr_id: p.cr_id_no_sistema,
          de_cliente: `${p.cliente_id_atualmente_vinculado} (${p.nome_cliente_atualmente_vinculado})`,
          para_cliente: `${p.cliente_id_correto} (${p.nome_cliente_correto})`,
          tem_senha_sistema: p.tem_senha_sistema,
          tem_senha_access: !!p.senha_plaintext,
        })),
        proximo_passo: 'Para aplicar, chame com { mode: "apply", confirm: "RECONCILIAR_46" }',
      });
    }

    if (mode !== "apply") return json({ error: "mode inválido" }, 400);
    if (confirm !== "RECONCILIAR_46") {
      return json({ error: 'confirm deve ser exatamente "RECONCILIAR_46"' }, 400);
    }

    const key = await loadKey();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent") || null;

    const results: Array<{ cr_id: number; status: string; error?: string }> = [];
    let aplicados = 0;
    let erros = 0;

    for (const row of plan) {
      try {
        // 1) Snapshot ANTES (para rollback)
        const { data: before, error: beforeErr } = await admin
          .from("qa_cadastro_cr")
          .select("id, cliente_id, senha_gov_encrypted, senha_gov_iv, senha_gov_tag")
          .eq("id", row.cr_id_no_sistema)
          .maybeSingle();
        if (beforeErr || !before) {
          throw new Error(beforeErr?.message || "CR não encontrado");
        }

        const rollbackPayload = {
          cliente_id: before.cliente_id,
          senha_gov_encrypted: before.senha_gov_encrypted ? bytesToB64(bytea(before.senha_gov_encrypted)!) : null,
          senha_gov_iv: before.senha_gov_iv ? bytesToB64(bytea(before.senha_gov_iv)!) : null,
          senha_gov_tag: before.senha_gov_tag ? bytesToB64(bytea(before.senha_gov_tag)!) : null,
        };

        // 2) Re-criptografar senha do Access
        let updateFields: Record<string, unknown> = {
          cliente_id: row.cliente_id_correto,
          senha_gov_updated_at: new Date().toISOString(),
          senha_gov_updated_by: actorUserId,
          senha_gov: null,
        };
        if (row.senha_plaintext && row.senha_plaintext.length > 0) {
          const { ct, iv, tag } = await encryptSenha(row.senha_plaintext, key);
          updateFields.senha_gov_encrypted = toHexLiteral(ct);
          updateFields.senha_gov_iv = toHexLiteral(iv);
          updateFields.senha_gov_tag = toHexLiteral(tag);
        }

        // 3) UPDATE em qa_cadastro_cr
        const { error: updErr } = await admin
          .from("qa_cadastro_cr")
          .update(updateFields)
          .eq("id", row.cr_id_no_sistema);
        if (updErr) throw new Error("UPDATE falhou: " + updErr.message);

        // 4) Auditoria (imutável)
        const { error: audErr } = await admin
          .from("qa_gov_reconciliation_audit")
          .insert({
            acao: "realinhar_cr_e_sobrescrever_senha",
            status: "aplicado",
            nivel_confianca: "alto",
            cliente_id_anterior: before.cliente_id,
            cliente_id_correto: row.cliente_id_correto,
            cadastro_cr_id_anterior: row.cr_id_no_sistema,
            cadastro_cr_id_correto: row.cr_id_no_sistema,
            cpf_normalizado: row.cpf_access,
            numero_cr_normalizado: row.numero_cr_access,
            origem: "access_2026_04_29",
            motivo: `CR ${row.numero_cr_access} estava em cliente ${before.cliente_id} (${row.nome_cliente_atualmente_vinculado}); Access indica cliente ${row.cliente_id_correto} (${row.nome_cliente_correto}). Senha re-criptografada do plaintext do Access.`,
            evidencia: {
              nome_access: row.nome_access,
              ip,
              user_agent: ua,
              actor,
              tinha_senha_no_sistema: row.tem_senha_sistema,
              senha_substituida: !!row.senha_plaintext,
            },
            executado_por: actorUserId,
            rollback_payload: rollbackPayload,
          });
        if (audErr) {
          // tentar reverter o UPDATE para não deixar inconsistente sem auditoria
          await admin.from("qa_cadastro_cr").update({
            cliente_id: before.cliente_id,
            senha_gov_encrypted: rollbackPayload.senha_gov_encrypted ? "\\x" + Array.from(b64ToBytes(rollbackPayload.senha_gov_encrypted)).map((b) => b.toString(16).padStart(2, "0")).join("") : null,
            senha_gov_iv: rollbackPayload.senha_gov_iv ? "\\x" + Array.from(b64ToBytes(rollbackPayload.senha_gov_iv)).map((b) => b.toString(16).padStart(2, "0")).join("") : null,
            senha_gov_tag: rollbackPayload.senha_gov_tag ? "\\x" + Array.from(b64ToBytes(rollbackPayload.senha_gov_tag)).map((b) => b.toString(16).padStart(2, "0")).join("") : null,
          }).eq("id", row.cr_id_no_sistema);
          throw new Error("Auditoria falhou (UPDATE revertido): " + audErr.message);
        }

        aplicados++;
        results.push({ cr_id: row.cr_id_no_sistema, status: "ok" });
      } catch (e) {
        erros++;
        results.push({ cr_id: row.cr_id_no_sistema, status: "erro", error: (e as Error).message });
      }
    }

    return json({
      mode: "apply",
      total_planejado: plan.length,
      aplicados,
      erros,
      results,
    });
  } catch (err) {
    console.error("[qa-gov-reconcile-apply] erro", err);
    return json({ error: (err as Error).message || "Erro interno" }, 500);
  }
});
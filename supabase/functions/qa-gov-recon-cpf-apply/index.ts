// Edge function: qa-gov-recon-cpf-apply
//
// Estratégia CPF-first (autorizada pelo usuário em 2026-04-29):
// - Compara staging_access_senhas_gov com qa_clientes/qa_cadastro_cr usando CPF normalizado
//   como chave principal.
// - SOMENTE aplica os casos classificados como `cpf_match_unico_seguro` pela view
//   public.qa_gov_password_reconciliation_by_cpf.
// - Recriptografa a senha (AES-256-GCM, mesma chave QA_ENCRYPTION_KEY do qa-senha-gov).
// - Salva snapshot de rollback em qa_gov_reconciliation_audit.rollback_payload.
// - NUNCA retorna senha plaintext na resposta nem em logs.
//
// Endpoints (POST JSON):
//   { action: "preview" }                    -> resumo agregado por status (sem senha)
//   { action: "apply",  dry_run?: boolean }  -> aplica os seguros; dry_run=true só simula
//   { action: "rollback", audit_id: string } -> reverte 1 caso a partir do snapshot

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { qaAuthCors, requireQAStaff } from "../_shared/qaAuth.ts";

const corsHeaders = qaAuthCors;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToHex(b: Uint8Array): string {
  return "\\x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function bytesToB64(b: Uint8Array): string {
  let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
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
  if (!bytes || bytes.length !== 32) {
    throw new Error("QA_ENCRYPTION_KEY inválida (deve ser 32 bytes)");
  }
  return await crypto.subtle.importKey(
    "raw",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    { name: "AES-GCM" }, false, ["encrypt", "decrypt"],
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
    const guard = await requireQAStaff(req, ["administrador"]);
    if (!guard.ok) return guard.response;

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    // ---------- PREVIEW ----------
    if (action === "preview") {
      const { data, error } = await admin
        .from("qa_gov_password_reconciliation_by_cpf")
        .select("status, acao_sugerida");
      if (error) return json({ error: error.message }, 500);
      const summary: Record<string, number> = {};
      for (const r of data || []) {
        const k = `${(r as any).status}::${(r as any).acao_sugerida}`;
        summary[k] = (summary[k] || 0) + 1;
      }
      return json({ ok: true, total: data?.length || 0, summary });
    }

    // ---------- APPLY ----------
    if (action === "apply") {
      const dryRun = Boolean(body?.dry_run);
      const key = await loadKey();

      // Carrega plano seguro
      const { data: plano, error: planoErr } = await admin
        .from("qa_gov_password_reconciliation_by_cpf")
        .select("cpf_norm, nome_supabase, cliente_id, cr_id_alvo, email_match, status, acao_sugerida")
        .eq("acao_sugerida", "aplicar_automaticamente")
        .eq("status", "cpf_match_unico_seguro");
      if (planoErr) return json({ error: planoErr.message }, 500);

      // Mapa CPF -> senha plaintext (carregado server-side, NUNCA exposto na resposta)
      const cpfs = (plano || []).map((p: any) => p.cpf_norm).filter(Boolean);
      if (!cpfs.length) return json({ ok: true, dry_run: dryRun, applied: 0, errors: [] });

      // Buscamos as senhas via RPC dedicada para minimizar superfície (todos os rows do batch)
      const { data: senhas, error: senhasErr } = await admin
        .from("staging_access_senhas_gov")
        .select("cpf, cliente_id_access, senha_plaintext")
        .eq("import_batch", "access_2026_04_29");
      if (senhasErr) return json({ error: senhasErr.message }, 500);

      // Também precisamos do CPF do cliente do staging quando staging.cpf é null
      const { data: clientesStg, error: cstErr } = await admin
        .from("staging_access_clientes")
        .select("id_access, cpf")
        .eq("import_batch", "access_2026_04_29");
      if (cstErr) return json({ error: cstErr.message }, 500);

      const cpfDoCliente = new Map<string, string>();
      for (const c of clientesStg || []) {
        const norm = String((c as any).cpf || "").replace(/\D/g, "");
        if (norm) cpfDoCliente.set(String((c as any).id_access), norm);
      }
      const senhaPorCpf = new Map<string, string>();
      for (const s of senhas || []) {
        const cpfRaw = (s as any).cpf || cpfDoCliente.get(String((s as any).cliente_id_access)) || "";
        const norm = String(cpfRaw).replace(/\D/g, "");
        const senha = String((s as any).senha_plaintext || "");
        if (norm && senha && !senhaPorCpf.has(norm)) senhaPorCpf.set(norm, senha);
      }

      const results: Array<{
        cpf: string;
        cliente_id: number;
        cr_id: number;
        nome: string;
        status: "applied" | "skipped" | "error";
        reason?: string;
        substituiu_existente?: boolean;
        audit_id?: string;
      }> = [];

      for (const p of plano || []) {
        const cpf = String((p as any).cpf_norm);
        const clienteId = Number((p as any).cliente_id);
        const crId = Number((p as any).cr_id_alvo);
        const nome = String((p as any).nome_supabase || "");
        const senhaPlain = senhaPorCpf.get(cpf);

        if (!senhaPlain) {
          results.push({ cpf, cliente_id: clienteId, cr_id: crId, nome, status: "skipped", reason: "senha_plaintext_ausente" });
          continue;
        }
        if (!Number.isFinite(clienteId) || !Number.isFinite(crId)) {
          results.push({ cpf, cliente_id: clienteId, cr_id: crId, nome, status: "skipped", reason: "ids_invalidos" });
          continue;
        }

        if (dryRun) {
          results.push({ cpf, cliente_id: clienteId, cr_id: crId, nome, status: "applied", reason: "dry_run" });
          continue;
        }

        // Snapshot anterior (para rollback)
        const { data: prev, error: prevErr } = await admin
          .from("qa_cadastro_cr")
          .select("id, cliente_id, senha_gov, senha_gov_encrypted, senha_gov_iv, senha_gov_tag, senha_gov_updated_at, senha_gov_updated_by")
          .eq("id", crId)
          .maybeSingle();
        if (prevErr || !prev) {
          results.push({ cpf, cliente_id: clienteId, cr_id: crId, nome, status: "error", reason: prevErr?.message || "cr_nao_encontrado" });
          continue;
        }
        if (prev.cliente_id !== clienteId) {
          results.push({ cpf, cliente_id: clienteId, cr_id: crId, nome, status: "skipped", reason: "cr_pertence_a_outro_cliente_no_momento" });
          continue;
        }

        const substituiu = Boolean(prev.senha_gov_encrypted);

        try {
          const { ct, iv, tag } = await encryptSenha(senhaPlain, key);
          const update = {
            senha_gov_encrypted: bytesToHex(ct),
            senha_gov_iv: bytesToHex(iv),
            senha_gov_tag: bytesToHex(tag),
            senha_gov: null, // limpa qualquer plaintext residual
            senha_gov_updated_at: new Date().toISOString(),
            senha_gov_updated_by: guard.userId,
          };
          const { error: updErr } = await admin
            .from("qa_cadastro_cr")
            .update(update)
            .eq("id", crId);
          if (updErr) {
            results.push({ cpf, cliente_id: clienteId, cr_id: crId, nome, status: "error", reason: updErr.message });
            continue;
          }

          // Auditoria com rollback_payload (snapshot do estado anterior, em base64)
          const rollback = {
            cr_id: crId,
            cliente_id_anterior: prev.cliente_id,
            senha_gov_encrypted_b64: prev.senha_gov_encrypted ? bytesToB64(bytea(prev.senha_gov_encrypted)!) : null,
            senha_gov_iv_b64: prev.senha_gov_iv ? bytesToB64(bytea(prev.senha_gov_iv)!) : null,
            senha_gov_tag_b64: prev.senha_gov_tag ? bytesToB64(bytea(prev.senha_gov_tag)!) : null,
            senha_gov_updated_at: prev.senha_gov_updated_at,
            senha_gov_updated_by: prev.senha_gov_updated_by,
          };

          const { data: auditRow, error: audErr } = await admin
            .from("qa_gov_reconciliation_audit")
            .insert({
              acao: "copy_password_from_access",
              status: "applied",
              nivel_confianca: "alto_cpf_unico",
              cliente_id_anterior: prev.cliente_id,
              cliente_id_correto: clienteId,
              cadastro_cr_id_anterior: crId,
              cadastro_cr_id_correto: crId,
              cpf_normalizado: cpf,
              email_normalizado: null,
              numero_cr_normalizado: null,
              origem: "access_by_cpf_reconciliation",
              motivo: substituiu ? "senha_substituida_pelo_access" : "senha_inicial_do_access",
              evidencia: {
                substituiu_senha_existente: substituiu,
                email_match: (p as any).email_match,
              },
              executado_por: guard.userId,
              rollback_payload: rollback,
            })
            .select("id")
            .single();
          if (audErr) {
            results.push({ cpf, cliente_id: clienteId, cr_id: crId, nome, status: "error", reason: "update_ok_audit_fail: " + audErr.message });
            continue;
          }

          // Auditoria adicional no log de acessos (write)
          await admin.from("qa_senha_gov_acessos").insert({
            cadastro_cr_id: crId,
            cliente_id: clienteId,
            user_id: guard.userId,
            acao: "write",
            ip: null,
            user_agent: null,
            contexto: "recon CPF-first (access_by_cpf_reconciliation)",
          });

          results.push({
            cpf, cliente_id: clienteId, cr_id: crId, nome,
            status: "applied", substituiu_existente: substituiu,
            audit_id: (auditRow as any)?.id,
          });
        } catch (e) {
          results.push({ cpf, cliente_id: clienteId, cr_id: crId, nome, status: "error", reason: (e as Error).message });
        }
      }

      const applied = results.filter((r) => r.status === "applied").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const errors = results.filter((r) => r.status === "error");
      return json({
        ok: true,
        dry_run: dryRun,
        applied,
        skipped,
        errors_count: errors.length,
        results,
      });
    }

    // ---------- ROLLBACK ----------
    if (action === "rollback") {
      const auditId = String(body?.audit_id || "");
      if (!auditId) return json({ error: "audit_id obrigatório" }, 400);

      const { data: aud, error: audErr } = await admin
        .from("qa_gov_reconciliation_audit")
        .select("*")
        .eq("id", auditId)
        .maybeSingle();
      if (audErr || !aud) return json({ error: audErr?.message || "audit não encontrado" }, 404);
      if ((aud as any).status === "rolled_back") return json({ error: "já estava revertido" }, 409);

      const rb = (aud as any).rollback_payload || {};
      const crId = Number(rb.cr_id);
      if (!Number.isFinite(crId)) return json({ error: "rollback_payload sem cr_id" }, 500);

      const update: Record<string, unknown> = {
        senha_gov_encrypted: rb.senha_gov_encrypted_b64
          ? bytesToHex(b64ToBytes(rb.senha_gov_encrypted_b64))
          : null,
        senha_gov_iv: rb.senha_gov_iv_b64 ? bytesToHex(b64ToBytes(rb.senha_gov_iv_b64)) : null,
        senha_gov_tag: rb.senha_gov_tag_b64 ? bytesToHex(b64ToBytes(rb.senha_gov_tag_b64)) : null,
        senha_gov: null,
        senha_gov_updated_at: rb.senha_gov_updated_at || new Date().toISOString(),
        senha_gov_updated_by: rb.senha_gov_updated_by || guard.userId,
      };
      const { error: updErr } = await admin
        .from("qa_cadastro_cr")
        .update(update)
        .eq("id", crId);
      if (updErr) return json({ error: updErr.message }, 500);

      // Marca audit como revertido (insere novo registro — auditoria é imutável)
      await admin.from("qa_gov_reconciliation_audit").insert({
        acao: "rollback",
        status: "rolled_back",
        nivel_confianca: (aud as any).nivel_confianca,
        cliente_id_anterior: (aud as any).cliente_id_correto,
        cliente_id_correto: (aud as any).cliente_id_anterior,
        cadastro_cr_id_anterior: crId,
        cadastro_cr_id_correto: crId,
        cpf_normalizado: (aud as any).cpf_normalizado,
        origem: "rollback_cpf_reconciliation",
        motivo: "rollback solicitado",
        evidencia: { rolled_back_audit_id: auditId },
        executado_por: guard.userId,
        rollback_payload: null,
      });

      return json({ ok: true, rolled_back: true, cr_id: crId });
    }

    return json({ error: "Ação inválida (use preview|apply|rollback)" }, 400);
  } catch (err) {
    console.error("[qa-gov-recon-cpf-apply] erro", err);
    return json({ error: (err as Error).message || "Erro interno" }, 500);
  }
});
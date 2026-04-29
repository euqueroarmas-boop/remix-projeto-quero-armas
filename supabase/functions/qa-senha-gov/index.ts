// Edge function: qa-senha-gov
// Endpoints (POST JSON):
//   { action: "get",     cliente_id: number, cadastro_cr_id?: number|null, contexto?: string }
//   { action: "set",     cliente_id: number, cadastro_cr_id?: number|null, senha: string, contexto?: string }
//   { action: "migrate" }   -> cifra todas as senha_gov em texto puro pendentes (admin)
//
// Cenários:
//   1) Cliente COM CR: { cliente_id, cadastro_cr_id }
//   2) Cliente SEM CR: { cliente_id, cadastro_cr_id: null }
//
// Fonte da verdade: qa_cliente_credenciais (tipo='gov_br', status='ativa').
// Fallback de leitura: qa_cadastro_cr (legado), apenas se cadastro_cr_id pertence ao cliente.

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
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
function toHexLit(bytes: Uint8Array): string {
  return "\\x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
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

async function decryptSenha(ct: Uint8Array, iv: Uint8Array, tag: Uint8Array, key: CryptoKey): Promise<string> {
  const full = new Uint8Array(ct.length + tag.length);
  full.set(ct, 0);
  full.set(tag, ct.length);
  const ivBuf = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const fullBuf = full.buffer.slice(0) as ArrayBuffer;
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuf }, key, fullBuf);
  return new TextDecoder().decode(plainBuf);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent") || null;
    const contexto = body?.contexto ? String(body.contexto).slice(0, 200) : null;

    const key = await loadKey();

    // ============= GET =============
    if (action === "get") {
      const expectedClienteId = body?.cliente_id == null ? null : Number(body.cliente_id);
      const rawCrId = body?.cadastro_cr_id;
      const id = rawCrId == null ? null : Number(rawCrId);
      if (expectedClienteId == null || !Number.isFinite(expectedClienteId)) {
        return json({ error: "cliente_id é obrigatório para leitura de Senha Gov." }, 400);
      }
      if (id != null && !Number.isFinite(id)) {
        return json({ error: "cadastro_cr_id inválido" }, 400);
      }

      // 1) PRIORIDADE: tabela central
      const { data: cred } = await admin
        .from("qa_cliente_credenciais")
        .select("id, cliente_id, cadastro_cr_id, senha_encrypted, senha_iv, senha_tag, origem")
        .eq("cliente_id", expectedClienteId)
        .eq("tipo_credencial", "gov_br")
        .eq("status", "ativa")
        .maybeSingle();

      if (cred) {
        let senha: string | null = null;
        const ct = bytea((cred as any).senha_encrypted);
        const iv = bytea((cred as any).senha_iv);
        const tag = bytea((cred as any).senha_tag);
        if (ct && iv && tag) {
          try { senha = await decryptSenha(ct, iv, tag, key); }
          catch (e) { return json({ error: "Falha ao descriptografar (central): " + (e as Error).message }, 500); }
        }
        await admin.from("qa_senha_gov_acessos").insert({
          cadastro_cr_id: id ?? (cred as any).cadastro_cr_id ?? null,
          cliente_id: expectedClienteId,
          user_id: guard.userId,
          acao: "read",
          ip, user_agent: ua,
          contexto: (contexto ? contexto + " | " : "") + "fonte=central",
        });
        return json({ senha, source: "central", cadastro_cr_id: (cred as any).cadastro_cr_id ?? null });
      }

      // 2) Fallback CR (legado) — exige cr_id
      if (id == null) {
        return json({ senha: null, source: "none" });
      }

      const { data, error } = await admin
        .from("qa_cadastro_cr")
        .select("id, cliente_id, senha_gov, senha_gov_encrypted, senha_gov_iv, senha_gov_tag")
        .eq("id", id)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Cadastro não encontrado" }, 404);

      if ((data as any).cliente_id !== expectedClienteId) {
        await admin.from("qa_senha_gov_acessos").insert({
          cadastro_cr_id: id, cliente_id: expectedClienteId, user_id: guard.userId,
          acao: "denied_mismatch", ip, user_agent: ua,
          contexto: `tentativa de leitura cruzada (cr.cliente_id=${(data as any).cliente_id})`.slice(0, 200),
        });
        return json({ error: "Vínculo cadastro_cr ↔ cliente divergente. Leitura bloqueada por segurança." }, 409);
      }

      let senha: string | null = null;
      const ct = bytea((data as any).senha_gov_encrypted);
      const iv = bytea((data as any).senha_gov_iv);
      const tag = bytea((data as any).senha_gov_tag);
      if (ct && iv && tag) {
        try { senha = await decryptSenha(ct, iv, tag, key); }
        catch (e) { return json({ error: "Falha ao descriptografar: " + (e as Error).message }, 500); }
      } else if ((data as any).senha_gov) {
        senha = (data as any).senha_gov as string;
      }

      await admin.from("qa_senha_gov_acessos").insert({
        cadastro_cr_id: id,
        cliente_id: (data as any).cliente_id ?? null,
        user_id: guard.userId,
        acao: "read",
        ip, user_agent: ua,
        contexto: (contexto ? contexto + " | " : "") + "fonte=cr",
      });

      return json({ senha, source: "cr", cadastro_cr_id: id });
    }

    // ============= SET =============
    if (action === "set") {
      const expectedClienteId = body?.cliente_id == null ? null : Number(body.cliente_id);
      const rawCrId = body?.cadastro_cr_id;
      const id = rawCrId == null ? null : Number(rawCrId);
      const senha = body?.senha == null ? "" : String(body.senha);
      if (expectedClienteId == null || !Number.isFinite(expectedClienteId)) {
        return json({ error: "cliente_id é obrigatório para gravação de Senha Gov." }, 400);
      }
      if (id != null && !Number.isFinite(id)) {
        return json({ error: "cadastro_cr_id inválido" }, 400);
      }

      const { data: cliente } = await admin
        .from("qa_clientes").select("id").eq("id", expectedClienteId).maybeSingle();
      if (!cliente) return json({ error: "Cliente não encontrado" }, 404);

      if (id != null) {
        const { data: row } = await admin
          .from("qa_cadastro_cr").select("id, cliente_id").eq("id", id).maybeSingle();
        if (!row) return json({ error: "CR não encontrado" }, 404);
        if ((row as any).cliente_id !== expectedClienteId) {
          await admin.from("qa_senha_gov_acessos").insert({
            cadastro_cr_id: id, cliente_id: expectedClienteId, user_id: guard.userId,
            acao: "denied_mismatch", ip, user_agent: ua,
            contexto: `tentativa de gravação cruzada (cr.cliente_id=${(row as any).cliente_id})`.slice(0, 200),
          });
          return json({ error: "cliente_id precisa coincidir com o do CR. Gravação bloqueada." }, 409);
        }
      }

      // Tabela central = fonte da verdade
      let credencialId: number | null = null;
      if (senha) {
        const { ct, iv, tag } = await encryptSenha(senha, key);
        const { data: existing } = await admin
          .from("qa_cliente_credenciais")
          .select("id")
          .eq("cliente_id", expectedClienteId)
          .eq("tipo_credencial", "gov_br")
          .eq("status", "ativa")
          .maybeSingle();

        if (existing) {
          await admin
            .from("qa_cliente_credenciais")
            .update({
              senha_encrypted: toHexLit(ct), senha_iv: toHexLit(iv), senha_tag: toHexLit(tag),
              cadastro_cr_id: id ?? null,
              origem: "admin_ui_set",
              updated_by: guard.userId,
            })
            .eq("id", (existing as any).id);
          credencialId = (existing as any).id;
        } else {
          const { data: ins } = await admin
            .from("qa_cliente_credenciais")
            .insert({
              cliente_id: expectedClienteId,
              tipo_credencial: "gov_br",
              cadastro_cr_id: id ?? null,
              senha_encrypted: toHexLit(ct), senha_iv: toHexLit(iv), senha_tag: toHexLit(tag),
              origem: "admin_ui_set",
              status: "ativa",
              updated_by: guard.userId,
            })
            .select("id").maybeSingle();
          credencialId = (ins as any)?.id ?? null;
        }

        await admin.from("qa_cliente_credenciais_audit").insert({
          credencial_id: credencialId,
          cliente_id: expectedClienteId,
          tipo_credencial: "gov_br",
          acao: existing ? "admin_update" : "admin_insert",
          origem: "admin_ui_set",
          status_resultado: "applied",
          ip, user_agent: ua, user_id: guard.userId,
          contexto: contexto || null,
        });
      } else {
        await admin
          .from("qa_cliente_credenciais")
          .update({ status: "revogada", updated_by: guard.userId })
          .eq("cliente_id", expectedClienteId)
          .eq("tipo_credencial", "gov_br")
          .eq("status", "ativa");

        await admin.from("qa_cliente_credenciais_audit").insert({
          cliente_id: expectedClienteId,
          tipo_credencial: "gov_br",
          acao: "admin_revoke",
          status_resultado: "revoked",
          ip, user_agent: ua, user_id: guard.userId,
          contexto: contexto || null,
        });
      }

      // Compat: espelha em CR se houver vínculo
      if (id != null) {
        const update: Record<string, unknown> = {
          senha_gov_updated_at: new Date().toISOString(),
          senha_gov_updated_by: guard.userId,
        };
        if (senha) {
          const { ct, iv, tag } = await encryptSenha(senha, key);
          update.senha_gov_encrypted = toHexLit(ct);
          update.senha_gov_iv = toHexLit(iv);
          update.senha_gov_tag = toHexLit(tag);
          update.senha_gov = null;
        } else {
          update.senha_gov_encrypted = null;
          update.senha_gov_iv = null;
          update.senha_gov_tag = null;
          update.senha_gov = null;
        }
        await admin.from("qa_cadastro_cr").update(update).eq("id", id);

        await admin.from("qa_senha_gov_acessos").insert({
          cadastro_cr_id: id,
          cliente_id: expectedClienteId,
          user_id: guard.userId,
          acao: "write",
          ip, user_agent: ua,
          contexto: (contexto ? contexto + " | " : "") + "espelhado em CR",
        });
      }

      return json({ ok: true, credencial_id: credencialId });
    }

    // ============= MIGRATE (legado: texto puro -> AES) =============
    if (action === "migrate") {
      const { data: rows, error } = await admin
        .from("qa_cadastro_cr")
        .select("id, cliente_id, senha_gov")
        .not("senha_gov", "is", null)
        .is("senha_gov_encrypted", null);
      if (error) return json({ error: error.message }, 500);

      let migrated = 0;
      const errors: Array<{ id: number; error: string }> = [];
      for (const r of rows || []) {
        const senha = String((r as any).senha_gov || "");
        if (!senha) continue;
        try {
          const { ct, iv, tag } = await encryptSenha(senha, key);
          const upd = await admin
            .from("qa_cadastro_cr")
            .update({
              senha_gov_encrypted: toHexLit(ct),
              senha_gov_iv: toHexLit(iv),
              senha_gov_tag: toHexLit(tag),
              senha_gov: null,
              senha_gov_updated_at: new Date().toISOString(),
              senha_gov_updated_by: guard.userId,
            })
            .eq("id", (r as any).id);
          if (upd.error) { errors.push({ id: (r as any).id, error: upd.error.message }); continue; }
          await admin.from("qa_senha_gov_acessos").insert({
            cadastro_cr_id: (r as any).id,
            cliente_id: (r as any).cliente_id ?? null,
            user_id: guard.userId,
            acao: "migrate",
            ip, user_agent: ua,
            contexto: "bulk migrate texto puro -> AES-256-GCM",
          });
          migrated++;
        } catch (e) {
          errors.push({ id: (r as any).id, error: (e as Error).message });
        }
      }
      return json({ ok: true, migrated, errors });
    }

    return json({ error: "Ação inválida (use get|set|migrate)" }, 400);
  } catch (err) {
    console.error("[qa-senha-gov] erro", err);
    return json({ error: (err as Error).message || "Erro interno" }, 500);
  }
});

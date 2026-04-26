// Edge function: qa-senha-gov
// Endpoints (POST JSON):
//   { action: "get",     cadastro_cr_id: number, contexto?: string }
//   { action: "set",     cadastro_cr_id: number, senha: string, contexto?: string }
//   { action: "migrate" }   -> cifra todas as senha_gov em texto puro pendentes (admin)
//
// Sempre exige staff ativo (requireQAStaff) e registra auditoria em qa_senha_gov_acessos.

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
  const raw = Deno.env.get("QA_ENCRYPTION_KEY") || "";
  if (!raw) throw new Error("QA_ENCRYPTION_KEY not configured");
  let bytes: Uint8Array;
  try {
    // Aceita base64 (44 chars p/ 32 bytes) ou hex (64 chars)
    if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
      bytes = hexToBytes(raw.trim());
    } else {
      bytes = b64ToBytes(raw.trim());
    }
  } catch {
    throw new Error("QA_ENCRYPTION_KEY inválida (use base64 ou hex de 32 bytes)");
  }
  if (bytes.length !== 32) {
    throw new Error(`QA_ENCRYPTION_KEY deve ter 32 bytes (recebido ${bytes.length})`);
  }
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
  // WebCrypto AES-GCM já anexa o tag (16 bytes) ao final do ciphertext
  const tagLen = 16;
  const ct = cipher.slice(0, cipher.length - tagLen);
  const tag = cipher.slice(cipher.length - tagLen);
  return { ct, iv, tag };
}

async function decryptSenha(
  ct: Uint8Array,
  iv: Uint8Array,
  tag: Uint8Array,
  key: CryptoKey,
): Promise<string> {
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
    // Postgres retorna `\x...` em hex
    if (value.startsWith("\\x")) return hexToBytes(value.slice(2));
    try {
      return b64ToBytes(value);
    } catch {
      return null;
    }
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

    if (action === "get") {
      const id = Number(body?.cadastro_cr_id);
      if (!Number.isFinite(id)) return json({ error: "cadastro_cr_id inválido" }, 400);

      const { data, error } = await admin
        .from("qa_cadastro_cr")
        .select("id, cliente_id, senha_gov, senha_gov_encrypted, senha_gov_iv, senha_gov_tag")
        .eq("id", id)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Cadastro não encontrado" }, 404);

      let senha: string | null = null;
      const ct = bytea(data.senha_gov_encrypted);
      const iv = bytea(data.senha_gov_iv);
      const tag = bytea(data.senha_gov_tag);
      if (ct && iv && tag) {
        try {
          senha = await decryptSenha(ct, iv, tag, key);
        } catch (e) {
          return json({ error: "Falha ao descriptografar: " + (e as Error).message }, 500);
        }
      } else if (data.senha_gov) {
        // Fallback enquanto migração não rodou
        senha = data.senha_gov as string;
      }

      await admin.from("qa_senha_gov_acessos").insert({
        cadastro_cr_id: id,
        cliente_id: data.cliente_id ?? null,
        user_id: guard.userId,
        acao: "read",
        ip,
        user_agent: ua,
        contexto,
      });

      return json({ senha });
    }

    if (action === "set") {
      const id = Number(body?.cadastro_cr_id);
      const senha = body?.senha == null ? "" : String(body.senha);
      if (!Number.isFinite(id)) return json({ error: "cadastro_cr_id inválido" }, 400);

      const { data: row, error: fetchErr } = await admin
        .from("qa_cadastro_cr")
        .select("id, cliente_id")
        .eq("id", id)
        .maybeSingle();
      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!row) return json({ error: "Cadastro não encontrado" }, 404);

      const update: Record<string, unknown> = {
        senha_gov_updated_at: new Date().toISOString(),
        senha_gov_updated_by: guard.userId,
      };
      if (senha) {
        const { ct, iv, tag } = await encryptSenha(senha, key);
        update.senha_gov_encrypted = "\\x" + Array.from(ct).map((b) => b.toString(16).padStart(2, "0")).join("");
        update.senha_gov_iv = "\\x" + Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
        update.senha_gov_tag = "\\x" + Array.from(tag).map((b) => b.toString(16).padStart(2, "0")).join("");
        update.senha_gov = null; // limpa o texto puro
      } else {
        update.senha_gov_encrypted = null;
        update.senha_gov_iv = null;
        update.senha_gov_tag = null;
        update.senha_gov = null;
      }

      const { error: updErr } = await admin
        .from("qa_cadastro_cr")
        .update(update)
        .eq("id", id);
      if (updErr) return json({ error: updErr.message }, 500);

      await admin.from("qa_senha_gov_acessos").insert({
        cadastro_cr_id: id,
        cliente_id: row.cliente_id ?? null,
        user_id: guard.userId,
        acao: "write",
        ip,
        user_agent: ua,
        contexto,
      });

      return json({ ok: true });
    }

    if (action === "migrate") {
      // Cifra todos os registros que ainda têm senha_gov em texto puro.
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
              senha_gov_encrypted: "\\x" + Array.from(ct).map((b) => b.toString(16).padStart(2, "0")).join(""),
              senha_gov_iv: "\\x" + Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join(""),
              senha_gov_tag: "\\x" + Array.from(tag).map((b) => b.toString(16).padStart(2, "0")).join(""),
              senha_gov: null,
              senha_gov_updated_at: new Date().toISOString(),
              senha_gov_updated_by: guard.userId,
            })
            .eq("id", (r as any).id);
          if (upd.error) {
            errors.push({ id: (r as any).id, error: upd.error.message });
            continue;
          }
          await admin.from("qa_senha_gov_acessos").insert({
            cadastro_cr_id: (r as any).id,
            cliente_id: (r as any).cliente_id ?? null,
            user_id: guard.userId,
            acao: "migrate",
            ip,
            user_agent: ua,
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

// Edge function: portal do cliente envia/troca a foto do avatar.
// Faz validação de auth, resolve cliente_id via cliente_auth_links,
// faz upload no bucket privado qa-documentos e atualiza qa_clientes.imagem.
// Admin não usa esta função (já atualiza via ClienteFormModal).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BUCKET = "qa-documentos";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "missing_auth" }, 401);
    }

    // Valida JWT chamando getUser com o token recebido
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "invalid_auth" }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => null) as
      | { imageBase64?: string; contentType?: string }
      | null;
    if (!body?.imageBase64 || !body?.contentType) {
      return json({ error: "missing_fields" }, 400);
    }
    const contentType = body.contentType.toLowerCase();
    if (!ALLOWED.has(contentType)) {
      return json({ error: "invalid_content_type", allowed: [...ALLOWED] }, 400);
    }

    // Decode base64 (aceita data URL ou puro)
    const b64 = body.imageBase64.includes(",")
      ? body.imageBase64.split(",", 2)[1]
      : body.imageBase64;
    let bytes: Uint8Array;
    try {
      const raw = atob(b64);
      bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    } catch {
      return json({ error: "invalid_base64" }, 400);
    }
    if (bytes.byteLength > MAX_BYTES) {
      return json({ error: "file_too_large", maxBytes: MAX_BYTES }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve cliente_id pelo auth.uid via cliente_auth_links
    const { data: link, error: linkErr } = await admin
      .from("cliente_auth_links")
      .select("qa_cliente_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (linkErr) {
      console.error("[qa-cliente-foto-upload] link lookup:", linkErr.message);
      return json({ error: "link_lookup_failed" }, 500);
    }
    const clienteId = (link as any)?.qa_cliente_id as number | null;
    if (!clienteId) {
      return json({ error: "cliente_nao_vinculado" }, 403);
    }

    // Upload
    const ext = extFromMime(contentType);
    const path = `clientes/${clienteId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: true, cacheControl: "3600" });
    if (upErr) {
      console.error("[qa-cliente-foto-upload] upload:", upErr.message);
      return json({ error: "upload_failed", detail: upErr.message }, 500);
    }

    // Atualiza qa_clientes.imagem
    const { error: updErr } = await admin
      .from("qa_clientes")
      .update({ imagem: path, updated_at: new Date().toISOString() })
      .eq("id", clienteId);
    if (updErr) {
      console.error("[qa-cliente-foto-upload] update:", updErr.message);
      return json({ error: "update_failed", detail: updErr.message }, 500);
    }

    return json({ ok: true, path });
  } catch (e) {
    console.error("[qa-cliente-foto-upload] fatal:", e);
    return json({ error: "internal", detail: String((e as Error)?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
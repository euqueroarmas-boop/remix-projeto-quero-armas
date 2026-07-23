/**
 * qa-upload-signed-procuracao
 *
 * Cliente envia a procuração assinada em PDF.
 * Atualiza qa_procuracoes para customer_signature_uploaded.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "paid-contracts";
const MAX_BYTES = 25 * 1024 * 1024;

function svc() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(hash)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function authUserId(req: Request): Promise<string | null> {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  try {
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

async function resolveClienteIds(sb: ReturnType<typeof svc>, userId: string): Promise<number[]> {
  const ids = new Set<number>();

  const { data: link } = await sb
    .from("cliente_auth_links")
    .select("qa_cliente_id, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if ((link as any)?.qa_cliente_id) ids.add(Number((link as any).qa_cliente_id));

  const { data: clientes } = await sb
    .from("qa_clientes")
    .select("id, id_legado")
    .eq("user_id", userId);
  for (const cliente of (clientes ?? []) as any[]) {
    if (cliente.id) ids.add(Number(cliente.id));
    if (cliente.id_legado) ids.add(Number(cliente.id_legado));
  }

  return Array.from(ids).filter((id) => Number.isFinite(id));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405);

  const userId = await authUserId(req);
  if (!userId) return jsonResp({ error: "Unauthorized" }, 401);

  const sb = svc();
  const clienteIds = await resolveClienteIds(sb, userId);
  if (!clienteIds.length) return jsonResp({ error: "Cliente não vinculado" }, 403);

  const uploadIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const uploadUserAgent = req.headers.get("user-agent") || null;

  let pdfBytes: Uint8Array | null = null;
  let procuracaoId = "";

  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      procuracaoId = String(fd.get("procuracao_id") || "");
      const file = fd.get("file") as File | null;
      if (!file) return jsonResp({ error: "Arquivo obrigatório" }, 400);
      if (file.size > MAX_BYTES) return jsonResp({ error: "Arquivo > 25MB" }, 413);
      pdfBytes = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = await req.json();
      procuracaoId = String(body.procuracao_id || "");
      if (!body.file_base64) return jsonResp({ error: "file_base64 obrigatório" }, 400);
      const bin = atob(String(body.file_base64).replace(/^data:[^;]+;base64,/, ""));
      pdfBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) pdfBytes[i] = bin.charCodeAt(i);
      if (pdfBytes.byteLength > MAX_BYTES) return jsonResp({ error: "Arquivo > 25MB" }, 413);
    }
  } catch (e) {
    return jsonResp({ error: "Falha ao ler upload", detail: (e as Error).message }, 400);
  }

  if (!procuracaoId) return jsonResp({ error: "procuracao_id obrigatório" }, 400);
  if (!pdfBytes || pdfBytes.byteLength < 256) return jsonResp({ error: "Arquivo inválido" }, 400);

  const head = new TextDecoder().decode(pdfBytes.slice(0, 5));
  if (!head.startsWith("%PDF")) return jsonResp({ error: "Apenas PDF é aceito" }, 415);

  const { data: procuracao } = await sb
    .from("qa_procuracoes")
    .select("id, cliente_id, venda_id, status")
    .eq("id", procuracaoId)
    .maybeSingle();
  if (!procuracao) return jsonResp({ error: "Procuração não encontrada" }, 404);
  if (!clienteIds.includes(Number((procuracao as any).cliente_id))) {
    return jsonResp({ error: "Acesso negado" }, 403);
  }

  const allowed = ["generated_pending_customer_signature", "rejected", "customer_signature_uploaded"];
  if (!allowed.includes(String((procuracao as any).status || ""))) {
    return jsonResp({ error: `Procuração em status ${(procuracao as any).status} não aceita upload` }, 409);
  }

  const path = `qa-procuracoes/${(procuracao as any).cliente_id}/${procuracaoId}/customer-signed.pdf`;
  const sig = await sha256(pdfBytes);
  const { error: uploadErr } = await sb.storage.from(BUCKET).upload(path, pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadErr) return jsonResp({ error: "Falha ao gravar PDF", detail: uploadErr.message }, 500);

  const uploadedAt = new Date().toISOString();
  const { error: updateErr } = await sb
    .from("qa_procuracoes")
    .update({
      status: "customer_signature_uploaded",
      arquivo_assinado_path: path,
      customer_signature_uploaded_at: uploadedAt,
      rejection_reason: null,
    })
    .eq("id", procuracaoId);
  if (updateErr) return jsonResp({ error: "Falha ao atualizar procuração", detail: updateErr.message }, 500);

  await sb.from("qa_status_eventos").insert({
    tipo: "procuracao_assinada_enviada",
    payload: {
      procuracao_id: procuracaoId,
      venda_id: (procuracao as any).venda_id ?? null,
      sha256: sig,
      size: pdfBytes.byteLength,
      ip: uploadIp,
      user_agent: uploadUserAgent,
    },
  }).then(() => null, () => null);

  return jsonResp({ ok: true, procuracao_id: procuracaoId, sha256: sig, status: "customer_signature_uploaded" });
});

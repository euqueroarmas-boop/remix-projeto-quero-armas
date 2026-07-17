/**
 * qa-upload-signed-contract — BLOCO 10 / Pass B
 *
 * Cliente faz upload do PDF assinado com Gov.br/ICP-Brasil. Aceita apenas PDF.
 * Salva em paid-contracts/qa/<venda_id>/customer-signed.pdf e atualiza
 * qa_contracts (status=customer_signature_uploaded, validation_status=pending,
 * customer_signed_pdf_path/sha256, customer_uploaded_at).
 *
 * Encadeia automaticamente qa-validate-customer-signature.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "paid-contracts";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function svc() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
function jsonResp(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
async function sha256(b: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", b as BufferSource);
  return Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function authUserId(req: Request): Promise<string | null> {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  try {
    const u = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${t}` } },
    });
    const { data, error } = await u.auth.getUser(t);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405);

  const userId = await authUserId(req);
  if (!userId) return jsonResp({ error: "Unauthorized" }, 401);

  const sb = svc();

  // Resolve cliente — primeiro tenta cliente_auth_links (legado), depois qa_clientes.user_id
  // (fluxo QA-puro provisionado pela FASE 2C-5).
  let clienteId: number | null = null;
  const { data: link } = await sb
    .from("cliente_auth_links")
    .select("qa_cliente_id, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if ((link as any)?.qa_cliente_id) {
    clienteId = (link as any).qa_cliente_id as number;
  } else {
    const { data: cli } = await sb
      .from("qa_clientes")
      .select("id_legado")
      .eq("user_id", userId)
      .maybeSingle();
    clienteId = (cli as any)?.id_legado ?? null;
  }
  if (!clienteId) return jsonResp({ error: "Cliente não vinculado" }, 403);

  // Body: multipart (file) OU base64 JSON
  // Captura metadados de sessão do lado do servidor (não forjáveis pelo cliente)
  const uploadIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const uploadUserAgent = req.headers.get("user-agent") || null;

  let pdfBytes: Uint8Array | null = null;
  let contractId: string | null = null;
  let uploadDeviceMeta: Record<string, unknown> | null = null;

  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      contractId = String(fd.get("contract_id") || "");
      const file = fd.get("file") as File | null;
      if (!file) return jsonResp({ error: "Arquivo obrigatório" }, 400);
      if (file.size > MAX_BYTES) return jsonResp({ error: "Arquivo > 25MB" }, 413);
      pdfBytes = new Uint8Array(await file.arrayBuffer());
      // Metadados extras opcionais enviados pelo frontend
      const deviceRaw = fd.get("device_meta");
      if (deviceRaw) {
        try { uploadDeviceMeta = JSON.parse(String(deviceRaw)); } catch { /* ignora */ }
      }
    } else {
      const body = await req.json();
      contractId = body.contract_id;
      if (!body.file_base64) return jsonResp({ error: "file_base64 obrigatório" }, 400);
      const bin = atob(String(body.file_base64).replace(/^data:[^;]+;base64,/, ""));
      pdfBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) pdfBytes[i] = bin.charCodeAt(i);
      if (pdfBytes.byteLength > MAX_BYTES) return jsonResp({ error: "Arquivo > 25MB" }, 413);
      if (body.device_meta && typeof body.device_meta === "object") {
        uploadDeviceMeta = body.device_meta;
      }
    }
  } catch (e) {
    return jsonResp({ error: "Falha ao ler upload", detail: (e as Error).message }, 400);
  }

  if (!contractId) return jsonResp({ error: "contract_id obrigatório" }, 400);
  if (!pdfBytes || pdfBytes.byteLength < 256) return jsonResp({ error: "Arquivo inválido" }, 400);

  // Sanity: deve ser PDF
  const head = new TextDecoder().decode(pdfBytes.slice(0, 5));
  if (!head.startsWith("%PDF")) return jsonResp({ error: "Apenas PDF é aceito" }, 415);

  // Verifica contrato e ownership
  const { data: contract } = await sb
    .from("qa_contracts")
    .select("id, venda_id, cliente_id, status")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return jsonResp({ error: "Contrato não encontrado" }, 404);
  if ((contract as any).cliente_id !== clienteId) return jsonResp({ error: "Acesso negado" }, 403);

  const allowed = [
    "generated_pending_company_signature",
    "pending_customer_signature",
    "rejected",
    "pending_manual_review",
    "customer_signature_uploaded",
  ];
  if (!allowed.includes((contract as any).status)) {
    return jsonResp({ error: `Contrato em status ${(contract as any).status} não aceita upload` }, 409);
  }

  const path = `qa/${(contract as any).venda_id}/customer-signed.pdf`;
  const sig = await sha256(pdfBytes);

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) return jsonResp({ error: "Falha ao gravar PDF", detail: upErr.message }, 500);

  const uploadedAt = new Date().toISOString();

  await sb.from("qa_contracts").update({
    status: "customer_signature_uploaded",
    customer_signed_pdf_path: path,
    customer_signed_sha256: sig,
    customer_uploaded_at: uploadedAt,
    validation_status: null,
    customer_upload_ip: uploadIp,
    customer_upload_user_agent: uploadUserAgent,
    customer_upload_device: uploadDeviceMeta ?? undefined,
  }).eq("id", contractId);

  await sb.from("qa_contract_events").insert({
    contract_id: contractId,
    event_type: "contrato_assinado_enviado",
    event_payload: {
      sha256: sig,
      size: pdfBytes.byteLength,
      ip: uploadIp,
      user_agent: uploadUserAgent,
      device: uploadDeviceMeta,
    },
  });

  // Dispara validação automaticamente (best-effort, não bloqueia retorno).
  try {
    const url = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/qa-validate-customer-signature`;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      },
      body: JSON.stringify({ contract_id: contractId }),
    }).catch(() => {});
  } catch { /* ignore */ }

  return jsonResp({ ok: true, contract_id: contractId, sha256: sig, status: "customer_signature_uploaded" });
});
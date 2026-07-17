// qa-piloto-upload-contrato-staff — Piloto Real
//
// Upload assistido do contrato assinado, feito pela EQUIPE Quero Armas
// (WhatsApp / e-mail / presencial). NÃO finge que o cliente enviou pelo
// portal: grava metadados explícitos de assistência de staff e cai na
// MESMA validação oficial (qa-validate-customer-signature). O contrato só
// pode ir para `validated` se a validação oficial aprovar — este endpoint
// nunca marca validated diretamente.
//
// Auth: requireQAStaff. Nunca exposto ao cliente.
// Trilha:
//   - qa_contracts.status = customer_signature_uploaded (mesmo caminho oficial)
//   - qa_contracts.customer_upload_device.staff_assisted = true (+ metadados)
//   - qa_contract_events (event_type = contrato_assinado_enviado_staff_assistido)
//   - qa_venda_eventos (tipo_evento = contrato_assinado_upload_staff_assistido)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";

const corsHeaders = { ...qaAuthCors, "Access-Control-Allow-Methods": "POST, OPTIONS" };
const BUCKET = "paid-contracts";
const MAX_BYTES = 25 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireQAStaff(req);
  if (!guard.ok) return guard.response;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ct = req.headers.get("content-type") || "";
  let contractId = "";
  let pdfBytes: Uint8Array | null = null;
  let observacao = "";
  let origem = "piloto_real_staff_assistido";

  try {
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      contractId = String(fd.get("contract_id") || "");
      observacao = String(fd.get("observacao") || "").trim();
      origem = String(fd.get("origem") || origem);
      const file = fd.get("file") as File | null;
      if (!file) return json({ error: "arquivo_obrigatorio" }, 400);
      if (file.size > MAX_BYTES) return json({ error: "arquivo_maior_25mb" }, 413);
      pdfBytes = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = await req.json();
      contractId = String(body.contract_id || "");
      observacao = String(body.observacao || "").trim();
      if (body.origem) origem = String(body.origem);
      if (!body.file_base64) return json({ error: "file_base64_obrigatorio" }, 400);
      const bin = atob(String(body.file_base64).replace(/^data:[^;]+;base64,/, ""));
      pdfBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) pdfBytes[i] = bin.charCodeAt(i);
      if (pdfBytes.byteLength > MAX_BYTES) return json({ error: "arquivo_maior_25mb" }, 413);
    }
  } catch (e) {
    return json({ error: "read_failed", detail: (e as Error).message }, 400);
  }

  if (!contractId) return json({ error: "contract_id_obrigatorio" }, 400);
  if (observacao.length < 20) return json({ error: "observacao_minima_20_chars" }, 400);
  if (!pdfBytes || pdfBytes.byteLength < 256) return json({ error: "arquivo_invalido" }, 400);

  const head = new TextDecoder().decode(pdfBytes.slice(0, 5));
  if (!head.startsWith("%PDF")) return json({ error: "apenas_pdf_aceito" }, 415);

  // Valida contrato
  const { data: contract } = await admin
    .from("qa_contracts")
    .select("id, venda_id, cliente_id, status")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return json({ error: "contrato_nao_encontrado" }, 404);

  const allowed = [
    "generated_pending_company_signature",
    "pending_customer_signature",
    "rejected",
    "pending_manual_review",
    "customer_signature_uploaded",
  ];
  if (!allowed.includes((contract as any).status)) {
    return json({ error: `status_${(contract as any).status}_nao_aceita_upload` }, 409);
  }

  const path = `qa/${(contract as any).venda_id}/customer-signed.pdf`;
  const sig = await sha256(pdfBytes);
  const uploadedAt = new Date().toISOString();

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) return json({ error: "upload_failed", detail: upErr.message }, 500);

  const staffMeta = {
    staff_assisted: true,
    upload_assistido_por_staff: true,
    staff_user_id: guard.userId,
    staff_email: guard.email,
    uploaded_at: uploadedAt,
    origem,
    observacao,
  };

  const uploadIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const uploadUserAgent = req.headers.get("user-agent") || null;

  await admin.from("qa_contracts").update({
    status: "customer_signature_uploaded",
    customer_signed_pdf_path: path,
    customer_signed_sha256: sig,
    customer_uploaded_at: uploadedAt,
    validation_status: null,
    customer_upload_ip: uploadIp,
    customer_upload_user_agent: uploadUserAgent,
    customer_upload_device: staffMeta,
  }).eq("id", contractId);

  await admin.from("qa_contract_events").insert({
    contract_id: contractId,
    event_type: "contrato_assinado_enviado_staff_assistido",
    event_payload: {
      sha256: sig,
      size: pdfBytes.byteLength,
      ip: uploadIp,
      user_agent: uploadUserAgent,
      ...staffMeta,
    },
  });

  // Trilha na venda (mesma origem, para leitura pela equipe operacional)
  try {
    await admin.from("qa_venda_eventos").insert({
      venda_id: Number((contract as any).venda_id),
      cliente_id: (contract as any).cliente_id ?? null,
      tipo_evento: "contrato_assinado_upload_staff_assistido",
      descricao: `Contrato assinado enviado pela equipe (assistido) — origem ${origem}.`,
      ator: `staff:${guard.email || guard.userId}`,
      user_id: guard.userId,
      dados_json: {
        contract_id: contractId,
        sha256: sig,
        ...staffMeta,
      },
    });
  } catch (_) { /* best effort */ }

  // Dispara validação oficial (mesma cadeia que qa-upload-signed-contract).
  // O contrato só chega em `validated` se a validação oficial autorizar.
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

  return json({
    ok: true,
    contract_id: contractId,
    sha256: sig,
    status: "customer_signature_uploaded",
    staff_assisted: true,
  });
});
/**
 * qa-sign-contract-company
 * BLOCO 10 — assina o contrato Quero Armas pelo lado da CONTRATADA usando
 * o certificado A1 ICP-Brasil já configurado em `certificate_config`.
 *
 * Reaproveita _shared/pdfSign (PAdES/CAdES-detached) para emitir assinatura
 * compatível com validar.iti.gov.br.
 *
 * Salva resultado em `paid-contracts/qa/<venda>/company-signed.pdf`.
 * Atualiza qa_contracts e insere qa_contract_signatures(signer_role='company').
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { addLateralMark, addPlaceholderAndSign } from "../_shared/pdfSign.ts";
import { requireAdminOrInternal } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
};

const BUCKET = "paid-contracts";
const CERT_BUCKET = "certificates";
const CERT_FOLDER = "a1-certificates";

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function jsonResp(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function decryptAesGcm(encryptedBytes: Uint8Array): Promise<Uint8Array> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const km = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key).slice(0, 32),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const iv = encryptedBytes.slice(0, 12);
  const ct = encryptedBytes.slice(12);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, km, ct);
  return new Uint8Array(dec);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireAdminOrInternal(req);
  if (!guard.ok) return guard.response;

  let body: { contract_id?: string; signature_mode?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "JSON inválido" }, 400);
  }
  if (!body.contract_id) return jsonResp({ error: "contract_id obrigatório" }, 400);

  const sb = svc();
  const { data: contract, error: cErr } = await sb
    .from("qa_contracts")
    .select("id, venda_id, status, original_pdf_path, original_sha256")
    .eq("id", body.contract_id)
    .maybeSingle();
  if (cErr || !contract) return jsonResp({ error: "Contrato não encontrado" }, 404);
  if (!contract.original_pdf_path) return jsonResp({ error: "Contrato sem PDF original" }, 422);
  if (contract.status !== "generated_pending_company_signature") {
    return jsonResp({ error: `Status atual não permite assinatura: ${contract.status}` }, 409);
  }

  // Cert ativo
  const { data: cfg } = await sb
    .from("certificate_config")
    .select("*")
    .eq("status", "active")
    .eq("auto_sign_enabled", true)
    .maybeSingle();
  if (!cfg) {
    return jsonResp({
      error: "Nenhum certificado A1 ativo. Use signature_mode='representative_govbr' (em desenvolvimento).",
      skipped: true,
    }, 412);
  }
  if (cfg.valid_to && new Date(cfg.valid_to) < new Date()) {
    return jsonResp({ error: "Certificado expirado" }, 412);
  }

  // Download original
  const { data: orig, error: dErr } = await sb.storage
    .from(BUCKET)
    .download(contract.original_pdf_path);
  if (dErr || !orig) return jsonResp({ error: "PDF original não encontrado", details: dErr?.message }, 404);
  const pdfBytes = new Uint8Array(await orig.arrayBuffer());

  // Cert + senha
  const { data: certData } = await sb.storage.from(CERT_BUCKET).download(cfg.certificate_storage_path);
  if (!certData) return jsonResp({ error: "Certificado indisponível" }, 500);
  const decryptedCert = await decryptAesGcm(new Uint8Array(await certData.arrayBuffer()));

  const { data: passData } = await sb.storage
    .from(CERT_BUCKET)
    .download(`${CERT_FOLDER}/${cfg.certificate_hash}.key`);
  if (!passData) return jsonResp({ error: "Senha do certificado indisponível" }, 500);
  const encPassBytes = base64Decode(await passData.text());
  const certPassword = new TextDecoder().decode(await decryptAesGcm(encPassBytes));

  // Extract signer name
  const forgeMod = await import("https://esm.sh/node-forge@1.3.1");
  const forge = (forgeMod as any).default || forgeMod;
  const u8ToBin = (b: Uint8Array) => {
    let s = "";
    for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, Math.min(i + 8192, b.length)));
    return s;
  };
  const pfxAsn1 = forge.asn1.fromDer(u8ToBin(decryptedCert));
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, certPassword);
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  const signerName = cert?.subject?.attributes?.find((a: any) => a.shortName === "CN")?.value || "Quero Armas";

  const pdfLib = await import("npm:pdf-lib@1.17.1");
  const pdfDoc = await pdfLib.PDFDocument.load(pdfBytes);

  await addLateralMark(pdfDoc, {
    signerName,
    documentHash: contract.original_sha256 || (await sha256(pdfBytes)),
    signingDate: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  });

  const { signedPdf } = await addPlaceholderAndSign(pdfDoc, decryptedCert, certPassword, {
    reason: "Assinatura digital do contrato — CONTRATADA",
    location: "Brasil",
    contactInfo: "contato@queroarmas.com.br",
    signerName,
    usePades: true,
  });

  const signedPath = `qa/${contract.venda_id}/company-signed.pdf`;
  const signedSha = await sha256(signedPdf);

  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(signedPath, signedPdf, { contentType: "application/pdf", upsert: true });
  if (upErr) return jsonResp({ error: "Falha ao gravar PDF assinado", details: upErr.message }, 500);

  const sigMode = body.signature_mode || "company_icp";

  await sb.from("qa_contracts").update({
    status: "pending_customer_signature",
    signature_mode_company: sigMode,
    company_signed_pdf_path: signedPath,
    company_signed_sha256: signedSha,
    company_signed_at: new Date().toISOString(),
  }).eq("id", contract.id);

  await sb.from("qa_contract_signatures").insert({
    contract_id: contract.id,
    signer_role: "company",
    signer_name: signerName,
    signature_type: sigMode === "representative_govbr" ? "representative_govbr" : "company_icp",
    validation_status: "valid",
    validation_details: { method: "PAdES/CAdES-detached", certificate_id: cfg.id },
    signed_pdf_path: signedPath,
    signed_pdf_sha256: signedSha,
    signed_at: new Date().toISOString(),
  });

  await sb.from("qa_contract_events").insert({
    contract_id: contract.id,
    event_type: "company_signed",
    event_payload: { signer: signerName, mode: sigMode, sha256: signedSha },
  });

  return jsonResp({
    ok: true,
    signed_pdf_path: signedPath,
    signed_pdf_sha256: signedSha,
    signer: signerName,
  });
});
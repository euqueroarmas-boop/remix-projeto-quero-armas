/**
 * sign-contract-pdf: Signs a PDF contract with A1 ICP-Brasil certificate.
 * Uses @signpdf for PAdES-compliant signatures recognized by validar.iti.gov.br.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import { addPlaceholderAndSign, addLateralMark } from "../_shared/pdfSign.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CERT_BUCKET = "certificates";
const CONTRACTS_BUCKET = "paid-contracts";
const CERT_FOLDER = "a1-certificates";

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function hashBytes(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function decryptData(encryptedBytes: Uint8Array): Promise<Uint8Array> {
  const encryptionKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(encryptionKey).slice(0, 32),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const iv = encryptedBytes.slice(0, 12);
  const ciphertext = encryptedBytes.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    ciphertext,
  );
  return new Uint8Array(decrypted);
}

async function getActiveCertificate(
  supabase: ReturnType<typeof createServiceClient>,
) {
  const { data: config } = await supabase
    .from("certificate_config")
    .select("*")
    .eq("status", "active")
    .eq("auto_sign_enabled", true)
    .single();

  if (!config) return null;
  if (config.valid_to && new Date(config.valid_to) < new Date()) {
    console.warn("[sign-contract-pdf] Certificate expired");
    return null;
  }
  return config;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createServiceClient();

  try {
    const body = await req.json();
    const { contract_id, pdf_path, ip_address, user_agent } = body;

    if (!contract_id || !pdf_path) {
      return new Response(
        JSON.stringify({ success: false, error: "contract_id e pdf_path obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const certConfig = await getActiveCertificate(supabase);
    if (!certConfig) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum certificado ativo com assinatura automática habilitada", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create signature log
    const { data: signLog, error: logInsertError } = await supabase
      .from("signature_logs")
      .insert({
        contract_id,
        certificate_id: certConfig.id,
        original_pdf_path: pdf_path,
        ip_address: ip_address || null,
        user_agent: user_agent || null,
        status: "processing",
      })
      .select("id")
      .single();

    if (logInsertError) {
      throw new Error(`Falha ao criar log de assinatura: ${logInsertError.message}`);
    }

    try {
      // Download the original PDF
      const { data: pdfData, error: pdfDownloadError } =
        await supabase.storage.from(CONTRACTS_BUCKET).download(pdf_path);

      if (pdfDownloadError || !pdfData) {
        throw new Error(`PDF não encontrado: ${pdfDownloadError?.message || "sem dados"}`);
      }

      const pdfBytes = new Uint8Array(await pdfData.arrayBuffer());
      const originalHash = await hashBytes(pdfBytes);

      // Download and decrypt certificate
      const { data: certData, error: certDownloadError } =
        await supabase.storage.from(CERT_BUCKET).download(certConfig.certificate_storage_path);

      if (certDownloadError || !certData) {
        throw new Error("Certificado não encontrado no storage");
      }

      const encryptedCert = new Uint8Array(await certData.arrayBuffer());
      const decryptedCert = await decryptData(encryptedCert);

      // Download and decrypt password
      const { data: passData } = await supabase.storage
        .from(CERT_BUCKET)
        .download(`${CERT_FOLDER}/${certConfig.certificate_hash}.key`);

      if (!passData) {
        throw new Error("Senha do certificado não encontrada");
      }

      const encPassB64 = await passData.text();
      const encPassBytes = base64Decode(encPassB64);
      const decryptedPassBytes = await decryptData(encPassBytes);
      const certPassword = new TextDecoder().decode(decryptedPassBytes);

      // Extract signer name from certificate for visual stamp
      const forgeMod = await import("https://esm.sh/node-forge@1.3.1");
      const forge = forgeMod.default || forgeMod;

      function uint8ToBinaryString(bytes: Uint8Array): string {
        let str = "";
        for (let i = 0; i < bytes.length; i += 8192) {
          str += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
        }
        return str;
      }

      const pfxAsn1 = forge.asn1.fromDer(uint8ToBinaryString(decryptedCert));
      const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, certPassword);
      const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag];
      const cert = certBag?.[0]?.cert;

      const signerName = cert?.subject?.attributes?.find((a: any) => a.shortName === "CN")?.value || "WMTI TECNOLOGIA DA INFORMAÇÃO LTDA";
      const issuerCN = cert?.issuer?.attributes?.find((a: any) => a.shortName === "CN")?.value || "ICP-Brasil";
      const sigDate = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

      // Load original PDF with pdf-lib to add visual stamp + sign
      const pdfLib = await import("npm:pdf-lib@1.17.1");
      const { PDFDocument, StandardFonts, rgb } = pdfLib;
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width: pageWidth } = lastPage.getSize();

      // Visual signature stamp
      const stampY = 40, stampX = 42, stampWidth = pageWidth - 84, stampHeight = 70;
      lastPage.drawRectangle({ x: stampX, y: stampY, width: stampWidth, height: stampHeight, color: rgb(0.97, 0.97, 0.98), borderColor: rgb(0.7, 0.7, 0.75), borderWidth: 0.5 });
      lastPage.drawText("ASSINADO DIGITALMENTE", { x: stampX + 10, y: stampY + stampHeight - 15, size: 7, font: helveticaBold, color: rgb(0.2, 0.4, 0.2) });
      lastPage.drawText(`Assinante: ${signerName}`, { x: stampX + 10, y: stampY + stampHeight - 28, size: 6.5, font: helveticaFont, color: rgb(0.3, 0.3, 0.3) });
      lastPage.drawText(`Emissor: ${issuerCN}`, { x: stampX + 10, y: stampY + stampHeight - 39, size: 6.5, font: helveticaFont, color: rgb(0.3, 0.3, 0.3) });
      lastPage.drawText(`Data: ${sigDate} | Serial: ${cert?.serialNumber?.substring(0, 20) || "N/A"}…`, { x: stampX + 10, y: stampY + stampHeight - 50, size: 6, font: helveticaFont, color: rgb(0.4, 0.4, 0.4) });
      lastPage.drawText("Certificado A1 ICP-Brasil • PAdES • MP 2.200-2/2001", { x: stampX + 10, y: stampY + stampHeight - 61, size: 5.5, font: helveticaFont, color: rgb(0.5, 0.5, 0.5) });

      // Lateral mark on ALL pages (court-style)
      await addLateralMark(pdfDoc, {
        signerName: signerName,
        documentHash: originalHash,
        signingDate: sigDate,
      });

      // Sign PDF using @signpdf (PAdES)
      const { signedPdf } = await addPlaceholderAndSign(pdfDoc, decryptedCert, certPassword, {
        reason: "Assinatura digital do contrato",
        location: "Brasil",
        contactInfo: "contato@wmti.com.br",
        signerName,
        usePades: true,
      });

      const signedPdfPath = pdf_path.replace(".pdf", "-assinado.pdf");

      const { error: uploadError } = await supabase.storage
        .from(CONTRACTS_BUCKET)
        .upload(signedPdfPath, signedPdf, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Falha ao salvar PDF assinado: ${uploadError.message}`);
      }

      // Update signature log
      await supabase
        .from("signature_logs")
        .update({
          signed_pdf_path: signedPdfPath,
          document_hash: originalHash,
          status: "signed",
          validation_result: "PAdES (ETSI.CAdES.detached) via @signpdf",
        })
        .eq("id", signLog.id);

      // Update contract
      await supabase
        .from("contracts")
        .update({
          contract_pdf_path: signedPdfPath,
          contract_hash: originalHash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contract_id);

      // Update certificate last_used_at
      await supabase
        .from("certificate_config")
        .update({
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", certConfig.id);

      await logSistemaBackend({
        tipo: "contrato",
        status: "success",
        mensagem: "Contrato assinado digitalmente com PAdES (@signpdf)",
        payload: { contract_id, signed_pdf_path: signedPdfPath, certificate_id: certConfig.id },
      });

      return new Response(
        JSON.stringify({
          success: true,
          signed_pdf_path: signedPdfPath,
          document_hash: originalHash,
          certificate_subject: signerName,
          signature_format: "PAdES (ETSI.CAdES.detached)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (signError) {
      const errorMsg = signError instanceof Error ? signError.message : "Falha na assinatura";

      await supabase
        .from("signature_logs")
        .update({ status: "error", error_message: errorMsg })
        .eq("id", signLog.id);

      await logSistemaBackend({
        tipo: "erro",
        status: "error",
        mensagem: "Falha ao assinar contrato digitalmente",
        payload: { contract_id, error: errorMsg, certificate_id: certConfig.id },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
          blocked: true,
          message: "Contrato bloqueado: assinatura digital falhou. O documento não será enviado ao cliente.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

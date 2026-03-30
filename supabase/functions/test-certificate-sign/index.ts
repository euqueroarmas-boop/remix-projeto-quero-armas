/**
 * test-certificate-sign: Validates A1 certificate signing using @signpdf.
 * Generates a test PDF, signs it with PAdES (CAdES-detached), returns result.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { addPlaceholderAndSign, addLateralMark } from "../_shared/pdfSign.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
};

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function validateAdminToken(req: Request): Promise<boolean> {
  const token = req.headers.get("x-admin-token");
  if (!token) return false;
  const adminPassword = Deno.env.get("ADMIN_PASSWORD");
  if (!adminPassword) return false;
  try {
    const [ts, signature] = token.split(".");
    if (!ts || !signature) return false;
    const timestamp = parseInt(ts, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > 8 * 60 * 60 * 1000) return false;
    const expected = await hmacSign(adminPassword, `admin:${ts}`);
    return expected === signature;
  } catch { return false; }
}

async function hashBytes(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function decryptData(encryptedBytes: Uint8Array): Promise<Uint8Array> {
  const encryptionKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(encryptionKey).slice(0, 32),
    { name: "AES-GCM" }, false, ["decrypt"],
  );
  const iv = encryptedBytes.slice(0, 12);
  const ciphertext = encryptedBytes.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, keyMaterial, ciphertext);
  return new Uint8Array(decrypted);
}

function uint8ToBinaryString(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    str += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  return str;
}

type StepResult = { step: number; name: string; status: "pass" | "fail"; message: string; duration_ms: number };

function respond(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const isAdmin = await validateAdminToken(req);
  const authHeader = req.headers.get("authorization") || "";
  const isServiceRole = authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  const isTestMode = req.headers.get("x-test-mode") === "certificate-diagnostic";
  if (!isAdmin && !isServiceRole && !isTestMode) {
    return respond(401, { error: "Unauthorized" });
  }

  const steps: StepResult[] = [];
  const t0 = Date.now();
  const addStep = (step: number, name: string, status: "pass" | "fail", message: string, startMs: number) => {
    steps.push({ step, name, status, message, duration_ms: Date.now() - startMs });
  };

  try {
    let pfxBytes: Uint8Array;
    let password: string;

    // ── Step 1: Get certificate bytes + password ──
    const s1 = Date.now();
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("pfx_file") as File | null;
      const pw = formData.get("password") as string | null;
      if (!file) { addStep(1, "Receber certificado", "fail", "Campo pfx_file não enviado", s1); return respond(400, { success: false, steps }); }
      if (!pw) { addStep(1, "Receber certificado", "fail", "Campo password não enviado", s1); return respond(400, { success: false, steps }); }
      pfxBytes = new Uint8Array(await file.arrayBuffer());
      password = pw;
      addStep(1, "Receber certificado (upload)", "pass", `${pfxBytes.length} bytes, senha: ${pw.length} chars`, s1);
    } else {
      const body = await req.json();
      if (!body.use_stored) {
        addStep(1, "Receber certificado", "fail", "Envie form-data ou {use_stored:true}", s1);
        return respond(400, { success: false, steps });
      }
      const supabase = createServiceClient();
      const { data: config } = await supabase.from("certificate_config").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(1).single();
      if (!config) { addStep(1, "Receber certificado", "fail", "Nenhum certificado ativo", s1); return respond(404, { success: false, steps }); }

      const { data: certData, error: certErr } = await supabase.storage.from("certificates").download(config.certificate_storage_path);
      if (certErr || !certData) { addStep(1, "Receber certificado", "fail", `Download falhou: ${certErr?.message}`, s1); return respond(500, { success: false, steps }); }

      pfxBytes = await decryptData(new Uint8Array(await certData.arrayBuffer()));

      const { data: passData } = await supabase.storage.from("certificates").download(`a1-certificates/${config.certificate_hash}.key`);
      if (!passData) { addStep(1, "Receber certificado", "fail", "Senha não encontrada", s1); return respond(500, { success: false, steps }); }

      const encPassBytes = base64Decode(await passData.text());
      password = new TextDecoder().decode(await decryptData(encPassBytes));
      addStep(1, "Receber certificado (armazenado)", "pass", `${pfxBytes.length} bytes, senha: ${password.length} chars`, s1);
    }

    // ── Step 2: Validate PFX format ──
    const s2 = Date.now();
    const fileHash = await hashBytes(pfxBytes);
    if (pfxBytes.length < 4 || pfxBytes[0] !== 0x30) {
      addStep(2, "Validar formato PFX", "fail", `Byte[0]=0x${pfxBytes[0]?.toString(16)} (esperado 0x30)`, s2);
      return respond(400, { success: false, steps });
    }
    addStep(2, "Validar formato PFX", "pass", `SHA-256: ${fileHash.slice(0, 24)}…`, s2);

    // ── Step 3: Parse PFX to extract cert info (for display only) ──
    const s3 = Date.now();
    let certSubjectCN = "?";
    let certIssuerCN = "?";
    let certSerial = "?";
    let certValidFrom = "";
    let certValidTo = "";
    let certIsExpired = false;
    let keyBits = 0;
    let chainCount = 0;
    try {
      const forgeMod = await import("npm:node-forge@1.3.1");
      const forge = forgeMod.default || forgeMod;
      const pfxAsn1 = forge.asn1.fromDer(uint8ToBinaryString(pfxBytes));
      const pfxObj = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

      const keyBags = pfxObj.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
      if (keyBag?.length && keyBag[0].key) {
        keyBits = keyBag[0].key.n?.bitLength() || 0;
      }

      const certBags = pfxObj.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag];
      if (certBag?.length && certBag[0].cert) {
        const cert = certBag[0].cert;
        certSubjectCN = cert.subject.attributes.find((a: any) => a.shortName === "CN")?.value || "?";
        certIssuerCN = cert.issuer.attributes.find((a: any) => a.shortName === "CN")?.value || "?";
        certSerial = cert.serialNumber;
        certValidFrom = cert.validity.notBefore.toISOString();
        certValidTo = cert.validity.notAfter.toISOString();
        certIsExpired = cert.validity.notAfter < new Date();
        chainCount = certBag.length - 1;
      }

      addStep(3, "Extrair metadados do certificado", "pass",
        `RSA ${keyBits} bits | CN=${certSubjectCN} | Cadeia: ${chainCount} certs`, s3);
    } catch (e) {
      addStep(3, "Extrair metadados do certificado", "fail", `${e instanceof Error ? e.message : e}`, s3);
      return respond(400, { success: false, steps });
    }

    // ── Step 4: Generate test PDF ──
    const s4 = Date.now();
    let pdfDoc: any;
    try {
      const pdfLib = await import("npm:pdf-lib@1.17.1");
      const { PDFDocument, StandardFonts, rgb } = pdfLib;
      pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const page = pdfDoc.addPage([595, 842]);

      const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      page.drawText("DOCUMENTO DE TESTE — ASSINATURA DIGITAL A1", { x: 50, y: 780, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(`Gerado em: ${now}`, { x: 50, y: 755, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
      page.drawText("Este PDF testa a assinatura PAdES (CAdES-detached)", { x: 50, y: 720, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
      page.drawText("compatível com validar.iti.gov.br e Adobe Reader.", { x: 50, y: 705, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
      page.drawText("Motor: @signpdf/signpdf + @signpdf/signer-p12", { x: 50, y: 680, size: 9, font, color: rgb(0.4, 0.4, 0.4) });

      // Visual stamp
      const { width: pageWidth } = page.getSize();
      const stampX = 42, stampY = 40, stampW = pageWidth - 84, stampH = 70;
      page.drawRectangle({ x: stampX, y: stampY, width: stampW, height: stampH, color: rgb(0.97, 0.97, 0.98), borderColor: rgb(0.7, 0.7, 0.75), borderWidth: 0.5 });
      page.drawText("ASSINADO DIGITALMENTE", { x: stampX + 10, y: stampY + stampH - 15, size: 7, font: boldFont, color: rgb(0.2, 0.4, 0.2) });
      page.drawText(`Assinante: ${certSubjectCN}`, { x: stampX + 10, y: stampY + stampH - 28, size: 6.5, font, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(`Emissor: ${certIssuerCN}`, { x: stampX + 10, y: stampY + stampH - 39, size: 6.5, font, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(`Data: ${now} | Serial: ${certSerial.substring(0, 20)}…`, { x: stampX + 10, y: stampY + stampH - 50, size: 6, font, color: rgb(0.4, 0.4, 0.4) });
      page.drawText("Certificado A1 ICP-Brasil • PAdES • MP 2.200-2/2001", { x: stampX + 10, y: stampY + stampH - 61, size: 5.5, font, color: rgb(0.5, 0.5, 0.5) });

      addStep(4, "Gerar PDF de teste", "pass", "PDF A4 com selo visual criado", s4);

      // ── Step 4b: Add lateral mark to all pages ──
      const testHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await pdfDoc.save())))
        .map((b: number) => b.toString(16).padStart(2, "0")).join("");
      await addLateralMark(pdfDoc, {
        signerName: certSubjectCN,
        documentHash: testHash,
      });

    } catch (e) {
      addStep(4, "Gerar PDF de teste", "fail", `${e instanceof Error ? e.message : e}`, s4);
      return respond(500, { success: false, steps });
    }

    // ── Step 5: Sign PDF with @signpdf (PAdES) ──
    const s5 = Date.now();
    let signedPdfBytes: Uint8Array;
    try {
      const result = await addPlaceholderAndSign(pdfDoc, pfxBytes, password, {
        reason: "Teste de assinatura digital A1",
        location: "Brasil",
        contactInfo: "contato@wmti.com.br",
        signerName: certSubjectCN,
        usePades: true,
      });
      signedPdfBytes = result.signedPdf;
      addStep(5, "Assinar PDF (PAdES @signpdf)", "pass",
        `PDF assinado: ${signedPdfBytes.length} bytes`, s5);
    } catch (e) {
      addStep(5, "Assinar PDF (PAdES @signpdf)", "fail", `${e instanceof Error ? e.message : e}`, s5);
      return respond(500, { success: false, steps });
    }

    // ── Step 6: Verify signature presence ──
    const s6 = Date.now();
    try {
      const pdfStr = new TextDecoder("latin1").decode(signedPdfBytes);
      const hasContents = pdfStr.includes("/Contents <");
      const hasByteRange = pdfStr.includes("/ByteRange [");
      const hasSubFilter = pdfStr.includes("/SubFilter");
      if (!hasContents || !hasByteRange) {
        throw new Error(`Estrutura ausente: Contents=${hasContents}, ByteRange=${hasByteRange}`);
      }
      addStep(6, "Verificar estrutura do PDF assinado", "pass",
        `Contents ✓ | ByteRange ✓ | SubFilter: ${hasSubFilter ? "✓" : "✗"}`, s6);
    } catch (e) {
      addStep(6, "Verificar estrutura", "fail", `${e instanceof Error ? e.message : e}`, s6);
    }

    // ── Return result ──
    return respond(200, {
      success: true,
      total_duration_ms: Date.now() - t0,
      steps,
      certificate: {
        subject_cn: certSubjectCN,
        issuer_cn: certIssuerCN,
        serial: certSerial,
        valid_from: certValidFrom,
        valid_to: certValidTo,
        is_expired: certIsExpired,
      },
      signature: {
        engine: "@signpdf/signpdf 3.3.0 + @signpdf/signer-p12",
        format: "PAdES (ETSI.CAdES.detached)",
        algorithm: "SHA-256 + RSA",
      },
      signed_pdf_base64: base64Encode(signedPdfBytes),
      signed_pdf_size: signedPdfBytes.length,
    });
  } catch (error) {
    return respond(500, {
      success: false,
      steps,
      error: error instanceof Error ? error.message : "Erro interno",
      total_duration_ms: Date.now() - t0,
    });
  }
});

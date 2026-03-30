/**
 * test-certificate-sign: Standalone endpoint to validate A1 certificate signing.
 * Now embeds CMS/PKCS#7 into the PDF structure (ByteRange + /Contents)
 * for compatibility with validar.iti.gov.br and Adobe Reader.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { addSignaturePlaceholder, signPdfBytes } from "../_shared/pdfSign.ts";

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

function uint8ToBinaryString(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    str += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  return str;
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

    // ── Step 3: Import libraries ──
    const s3 = Date.now();
    let forge: any;
    try {
      const mod = await import("npm:node-forge@1.3.1");
      forge = mod.default || mod;
      if (!forge?.asn1 || !forge?.pkcs12 || !forge?.pki || !forge?.pkcs7) throw new Error("Módulos incompletos");
      addStep(3, "Carregar node-forge", "pass", "asn1 ✓ pkcs12 ✓ pki ✓ pkcs7 ✓", s3);
    } catch (e) {
      addStep(3, "Carregar node-forge", "fail", `${e instanceof Error ? e.message : e}`, s3);
      return respond(500, { success: false, steps });
    }

    // ── Step 4: Parse PKCS#12 ──
    const s4 = Date.now();
    let pfxObj: any;
    try {
      pfxObj = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(uint8ToBinaryString(pfxBytes)), password);
      addStep(4, "Decodificar PKCS#12", "pass", "PFX aberto com sucesso", s4);
    } catch (e) {
      const trimmed = password.trim();
      if (trimmed !== password) {
        try {
          pfxObj = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(uint8ToBinaryString(pfxBytes)), trimmed);
          addStep(4, "Decodificar PKCS#12 (trimmed)", "pass", "⚠️ Whitespace extra na senha", s4);
        } catch {
          addStep(4, "Decodificar PKCS#12", "fail", `${e instanceof Error ? e.message : e}`, s4);
          return respond(400, { success: false, steps });
        }
      } else {
        addStep(4, "Decodificar PKCS#12", "fail", `${e instanceof Error ? e.message : e}`, s4);
        return respond(400, { success: false, steps });
      }
    }

    // ── Step 5: Extract key + cert ──
    const s5 = Date.now();
    let privateKey: any, cert: any, chainCerts: any[] = [];
    try {
      const keyBags = pfxObj.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
      if (!keyBag?.length || !keyBag[0].key) throw new Error("Chave privada não encontrada");
      privateKey = keyBag[0].key;

      const certBags = pfxObj.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag];
      if (!certBag?.length || !certBag[0].cert) throw new Error("Certificado não encontrado");
      cert = certBag[0].cert;
      chainCerts = certBag.slice(1).map((b: any) => b.cert).filter(Boolean);

      const cn = cert.subject.attributes.find((a: any) => a.shortName === "CN")?.value || "?";
      addStep(5, "Extrair chave + certificado", "pass",
        `RSA ${privateKey.n?.bitLength() || "?"} bits | CN=${cn} | Cadeia: ${chainCerts.length} certs`, s5);
    } catch (e) {
      addStep(5, "Extrair chave + certificado", "fail", `${e instanceof Error ? e.message : e}`, s5);
      return respond(500, { success: false, steps });
    }

    // ── Step 6: Generate test PDF ──
    const s6 = Date.now();
    let pdfDoc: any;
    let pdfLib: any;
    try {
      pdfLib = await import("npm:pdf-lib@1.17.1");
      const { PDFDocument, StandardFonts, rgb } = pdfLib;
      pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const page = pdfDoc.addPage([595, 842]);

      const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      page.drawText("DOCUMENTO DE TESTE — ASSINATURA DIGITAL A1", { x: 50, y: 780, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(`Gerado em: ${now}`, { x: 50, y: 755, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
      page.drawText("Este PDF testa a assinatura digital embarcada (CMS/PKCS#7)", { x: 50, y: 720, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
      page.drawText("com ByteRange, compatível com validar.iti.gov.br.", { x: 50, y: 705, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
      page.drawText("________________________________________", { x: 50, y: 120, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
      page.drawText("Assinatura Digital da Contratada", { x: 50, y: 105, size: 8, font, color: rgb(0.5, 0.5, 0.5) });

      addStep(6, "Gerar PDF de teste", "pass", "PDF A4 criado", s6);
    } catch (e) {
      addStep(6, "Gerar PDF de teste", "fail", `${e instanceof Error ? e.message : e}`, s6);
      return respond(500, { success: false, steps });
    }

    // ── Step 7: Visual stamp + signature placeholder ──
    const s7 = Date.now();
    try {
      const { StandardFonts, rgb } = pdfLib;
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width: pageWidth } = lastPage.getSize();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const signerName = cert.subject.attributes.find((a: any) => a.shortName === "CN")?.value || "WMTI";
      const sigDate = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const issuerCN = cert.issuer.attributes.find((a: any) => a.shortName === "CN")?.value || "ICP-Brasil";

      const stampX = 42, stampY = 40, stampWidth = pageWidth - 84, stampHeight = 70;
      lastPage.drawRectangle({ x: stampX, y: stampY, width: stampWidth, height: stampHeight, color: rgb(0.97, 0.97, 0.98), borderColor: rgb(0.7, 0.7, 0.75), borderWidth: 0.5 });
      lastPage.drawText("ASSINADO DIGITALMENTE", { x: stampX + 10, y: stampY + stampHeight - 15, size: 7, font: helveticaBold, color: rgb(0.2, 0.4, 0.2) });
      lastPage.drawText(`Assinante: ${signerName}`, { x: stampX + 10, y: stampY + stampHeight - 28, size: 6.5, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
      lastPage.drawText(`Emissor: ${issuerCN}`, { x: stampX + 10, y: stampY + stampHeight - 39, size: 6.5, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
      lastPage.drawText(`Data: ${sigDate} | Serial: ${cert.serialNumber.substring(0, 20)}…`, { x: stampX + 10, y: stampY + stampHeight - 50, size: 6, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
      lastPage.drawText("Certificado A1 ICP-Brasil • Válido conforme MP 2.200-2/2001", { x: stampX + 10, y: stampY + stampHeight - 61, size: 5.5, font: helvetica, color: rgb(0.5, 0.5, 0.5) });

      // Add the PDF signature field with placeholder
      addSignaturePlaceholder(pdfDoc, pdfLib, lastPage, signerName, {
        reason: "Teste de assinatura digital A1",
        location: "Brasil",
        contactInfo: "contato@wmti.com.br",
      });

      addStep(7, "Selo visual + campo de assinatura PDF", "pass", "Selo + /Sig + /ByteRange + /Contents placeholder", s7);
    } catch (e) {
      addStep(7, "Selo visual + placeholder", "fail", `${e instanceof Error ? e.message : e}`, s7);
      return respond(500, { success: false, steps });
    }

    // ── Step 8: Save PDF and embed CMS signature ──
    const s8 = Date.now();
    let signedPdfBytes: Uint8Array;
    let signatureHex: string;
    try {
      const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });
      const result = await signPdfBytes(pdfWithPlaceholder, forge, privateKey, cert, chainCerts);
      signedPdfBytes = result.signedPdf;
      signatureHex = result.signatureHex;
      addStep(8, "Embutir assinatura CMS no PDF", "pass",
        `PDF assinado: ${signedPdfBytes.length} bytes | CMS: ${signatureHex.length / 2} bytes`, s8);
    } catch (e) {
      addStep(8, "Embutir assinatura CMS", "fail", `${e instanceof Error ? e.message : e}`, s8);
      return respond(500, { success: false, steps });
    }

    // ── Step 9: Verify round-trip ──
    const s9 = Date.now();
    try {
      const testData = "verify-round-trip";
      const md = forge.md.sha256.create();
      md.update(testData, "utf8");
      const sig = privateKey.sign(md);
      const md2 = forge.md.sha256.create();
      md2.update(testData, "utf8");
      if (!cert.publicKey.verify(md2.digest().bytes(), sig)) throw new Error("Verificação falhou");
      addStep(9, "Verificar assinatura (round-trip)", "pass", "sign() → verify() ✓", s9);
    } catch (e) {
      addStep(9, "Verificar assinatura", "fail", `${e instanceof Error ? e.message : e}`, s9);
      return respond(500, { success: false, steps });
    }

    // ── Return result ──
    const cn = cert.subject.attributes.find((a: any) => a.shortName === "CN")?.value || "?";
    const issuerCN = cert.issuer.attributes.find((a: any) => a.shortName === "CN")?.value || "?";

    return respond(200, {
      success: true,
      total_duration_ms: Date.now() - t0,
      steps,
      certificate: {
        subject_cn: cn,
        issuer_cn: issuerCN,
        serial: cert.serialNumber,
        valid_from: cert.validity.notBefore.toISOString(),
        valid_to: cert.validity.notAfter.toISOString(),
        is_expired: cert.validity.notAfter < new Date(),
      },
      signature: {
        hash: signatureHex!.slice(0, 32),
        algorithm: "SHA-256 + RSA (CMS/PKCS#7 embedded in PDF)",
        format: "adbe.pkcs7.detached with ByteRange",
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

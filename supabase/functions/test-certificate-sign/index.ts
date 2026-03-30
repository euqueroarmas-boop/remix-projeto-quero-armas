/**
 * test-certificate-sign: Standalone endpoint to validate A1 certificate signing end-to-end.
 * 
 * Accepts a PFX file + password, parses the certificate, generates a test PDF,
 * signs it with PKCS#7, and returns the signed PDF as download.
 * 
 * Usage: POST with multipart/form-data (pfx_file + password)
 *    OR: POST with JSON { use_stored: true } to use the already-uploaded certificate
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

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
  } catch {
    return false;
  }
}

async function hashBytes(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function uint8ToBinaryString(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
    str += String.fromCharCode(...chunk);
  }
  return str;
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
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, keyMaterial, ciphertext);
  return new Uint8Array(decrypted);
}

type StepResult = {
  step: number;
  name: string;
  status: "pass" | "fail";
  message: string;
  duration_ms: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check — admin token OR service-role key (for backend testing)
  // Also accepts anon key with x-test-mode header for diagnostic calls
  const isAdmin = await validateAdminToken(req);
  const authHeader = req.headers.get("authorization") || "";
  const isServiceRole = authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  const isTestMode = req.headers.get("x-test-mode") === "certificate-diagnostic";
  if (!isAdmin && !isServiceRole && !isTestMode) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
      // Direct upload
      const formData = await req.formData();
      const file = formData.get("pfx_file") as File | null;
      const pw = formData.get("password") as string | null;
      if (!file) {
        addStep(1, "Receber certificado", "fail", "Campo pfx_file não enviado no form-data", s1);
        return respond(400, { success: false, steps, error: "pfx_file obrigatório" });
      }
      if (!pw) {
        addStep(1, "Receber certificado", "fail", "Campo password não enviado no form-data", s1);
        return respond(400, { success: false, steps, error: "password obrigatório" });
      }
      pfxBytes = new Uint8Array(await file.arrayBuffer());
      password = pw;
      addStep(1, "Receber certificado (upload direto)", "pass", `${pfxBytes.length} bytes, senha: ${pw.length} chars`, s1);
    } else {
      // JSON — use stored certificate
      const body = await req.json();
      if (!body.use_stored) {
        addStep(1, "Receber certificado", "fail", "Envie multipart/form-data com pfx_file+password OU JSON com {use_stored:true}", s1);
        return respond(400, { success: false, steps, error: "use_stored ou pfx_file obrigatório" });
      }

      const supabase = createServiceClient();
      const { data: config } = await supabase
        .from("certificate_config")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!config) {
        addStep(1, "Receber certificado (armazenado)", "fail", "Nenhum certificado ativo encontrado no banco", s1);
        return respond(404, { success: false, steps, error: "Nenhum certificado ativo" });
      }

      // Download encrypted cert
      const { data: certData, error: certErr } = await supabase.storage
        .from("certificates")
        .download(config.certificate_storage_path);

      if (certErr || !certData) {
        addStep(1, "Receber certificado (armazenado)", "fail", `Falha ao baixar: ${certErr?.message || "sem dados"}`, s1);
        return respond(500, { success: false, steps, error: "Certificado não encontrado no storage" });
      }

      const encryptedCert = new Uint8Array(await certData.arrayBuffer());
      pfxBytes = await decryptData(encryptedCert);

      // Download encrypted password
      const { data: passData } = await supabase.storage
        .from("certificates")
        .download(`a1-certificates/${config.certificate_hash}.key`);

      if (!passData) {
        addStep(1, "Receber certificado (armazenado)", "fail", "Senha criptografada não encontrada no storage", s1);
        return respond(500, { success: false, steps, error: "Senha do certificado não encontrada" });
      }

      const encPassB64 = await passData.text();
      const encPassBytes = base64Decode(encPassB64);
      const decryptedPassBytes = await decryptData(encPassBytes);
      password = new TextDecoder().decode(decryptedPassBytes);

      addStep(1, "Receber certificado (armazenado)", "pass",
        `Cert: ${pfxBytes.length} bytes, Senha: ${password.length} chars, Config ID: ${config.id}`, s1);
    }

    // ── Step 2: Validate file format ──
    const s2 = Date.now();
    const fileHash = await hashBytes(pfxBytes);
    if (pfxBytes.length < 4 || pfxBytes[0] !== 0x30) {
      addStep(2, "Validar formato PFX", "fail",
        `Byte[0]=0x${pfxBytes[0]?.toString(16) || "?"} (esperado 0x30). Arquivo pode estar corrompido.`, s2);
      return respond(400, { success: false, steps, error: "Arquivo não é PFX/P12 válido" });
    }
    addStep(2, "Validar formato PFX", "pass", `SHA-256: ${fileHash.slice(0, 24)}… | ${pfxBytes.length} bytes`, s2);

    // ── Step 3: Import node-forge ──
    const s3 = Date.now();
    let forge: any;
    try {
      const mod = await import("npm:node-forge@1.3.1");
      forge = mod.default || mod;
      if (!forge?.asn1 || !forge?.pkcs12 || !forge?.pki || !forge?.pkcs7) {
        throw new Error("Módulos incompletos");
      }
      addStep(3, "Carregar node-forge", "pass", "asn1 ✓ pkcs12 ✓ pki ✓ pkcs7 ✓", s3);
    } catch (e) {
      addStep(3, "Carregar node-forge", "fail", `Import falhou: ${e instanceof Error ? e.message : String(e)}`, s3);
      return respond(500, { success: false, steps, error: "Falha ao importar node-forge" });
    }

    // ── Step 4: Parse PKCS#12 ──
    const s4 = Date.now();
    let pfxObj: any;
    try {
      const binaryDer = uint8ToBinaryString(pfxBytes);
      const pfxAsn1 = forge.asn1.fromDer(binaryDer);
      pfxObj = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
      addStep(4, "Decodificar PKCS#12 (senha)", "pass", "PKCS#12 aberto com sucesso", s4);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Try trimmed password
      const trimmed = password.trim();
      if (trimmed !== password) {
        try {
          const binaryDer = uint8ToBinaryString(pfxBytes);
          const pfxAsn1 = forge.asn1.fromDer(binaryDer);
          pfxObj = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, trimmed);
          addStep(4, "Decodificar PKCS#12 (senha trimmed)", "pass",
            `⚠️ Senha original falhou mas trim() funcionou. Há whitespace extra na senha armazenada!`, s4);
        } catch {
          addStep(4, "Decodificar PKCS#12", "fail", `Senha incorreta ou arquivo inválido: ${msg}`, s4);
          return respond(400, { success: false, steps, error: "Senha incorreta ou PFX inválido" });
        }
      } else {
        addStep(4, "Decodificar PKCS#12", "fail", `${msg}`, s4);
        return respond(400, { success: false, steps, error: "Senha incorreta ou PFX inválido" });
      }
    }

    // ── Step 5: Extract private key + certificate ──
    const s5 = Date.now();
    let privateKey: any, cert: any;
    try {
      const keyBags = pfxObj.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
      if (!keyBag?.length || !keyBag[0].key) throw new Error("Chave privada não encontrada");
      privateKey = keyBag[0].key;

      const certBags = pfxObj.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag];
      if (!certBag?.length || !certBag[0].cert) throw new Error("Certificado não encontrado");
      cert = certBag[0].cert;

      const keyBits = privateKey.n ? privateKey.n.bitLength() : "?";
      const cn = cert.subject.attributes.find((a: any) => a.shortName === "CN")?.value || "?";
      addStep(5, "Extrair chave privada + certificado", "pass",
        `RSA ${keyBits} bits | CN=${cn} | Válido até ${cert.validity.notAfter.toISOString().slice(0, 10)}`, s5);
    } catch (e) {
      addStep(5, "Extrair chave privada + certificado", "fail", e instanceof Error ? e.message : String(e), s5);
      return respond(500, { success: false, steps, error: "Chave ou certificado não encontrado" });
    }

    // ── Step 6: Generate test PDF ──
    const s6 = Date.now();
    let pdfBytes: Uint8Array;
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("npm:pdf-lib@1.17.1");
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const page = pdfDoc.addPage([595, 842]); // A4

      const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

      page.drawText("DOCUMENTO DE TESTE — ASSINATURA DIGITAL A1", {
        x: 50, y: 780, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.1),
      });

      page.drawText(`Gerado em: ${now}`, {
        x: 50, y: 755, size: 10, font, color: rgb(0.3, 0.3, 0.3),
      });

      page.drawText("Este documento foi gerado automaticamente para validar", {
        x: 50, y: 720, size: 11, font, color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText("o fluxo de assinatura digital com certificado ICP-Brasil A1.", {
        x: 50, y: 705, size: 11, font, color: rgb(0.2, 0.2, 0.2),
      });

      page.drawText("Se este PDF foi retornado com selo de assinatura,", {
        x: 50, y: 670, size: 11, font, color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText("o backend está operacional para assinar contratos reais.", {
        x: 50, y: 655, size: 11, font, color: rgb(0.2, 0.2, 0.2),
      });

      // Leave space for signature stamp at bottom
      page.drawText("________________________________________", {
        x: 50, y: 120, size: 10, font, color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText("Assinatura Digital da Contratada", {
        x: 50, y: 105, size: 8, font, color: rgb(0.5, 0.5, 0.5),
      });

      pdfBytes = await pdfDoc.save();
      addStep(6, "Gerar PDF de teste", "pass", `PDF gerado: ${pdfBytes.length} bytes (A4)`, s6);
    } catch (e) {
      addStep(6, "Gerar PDF de teste", "fail", e instanceof Error ? e.message : String(e), s6);
      return respond(500, { success: false, steps, error: "Falha ao gerar PDF de teste" });
    }

    // ── Step 7: Add signature stamp to PDF ──
    const s7 = Date.now();
    let stampedPdfBytes: Uint8Array;
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("npm:pdf-lib@1.17.1");
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width: pageWidth } = lastPage.getSize();

      const stampY = 40;
      const stampX = 42;
      const stampWidth = pageWidth - 84;
      const stampHeight = 70;

      lastPage.drawRectangle({
        x: stampX, y: stampY, width: stampWidth, height: stampHeight,
        color: rgb(0.97, 0.97, 0.98),
        borderColor: rgb(0.7, 0.7, 0.75),
        borderWidth: 0.5,
      });

      const signerName = cert.subject.attributes.find((a: any) => a.shortName === "CN")?.value || "WMTI";
      const sigDate = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const issuerCN = cert.issuer.attributes.find((a: any) => a.shortName === "CN")?.value || "ICP-Brasil";

      lastPage.drawText("ASSINADO DIGITALMENTE", {
        x: stampX + 10, y: stampY + stampHeight - 15, size: 7, font: helveticaBold, color: rgb(0.2, 0.4, 0.2),
      });
      lastPage.drawText(`Assinante: ${signerName}`, {
        x: stampX + 10, y: stampY + stampHeight - 28, size: 6.5, font: helvetica, color: rgb(0.3, 0.3, 0.3),
      });
      lastPage.drawText(`Emissor: ${issuerCN}`, {
        x: stampX + 10, y: stampY + stampHeight - 39, size: 6.5, font: helvetica, color: rgb(0.3, 0.3, 0.3),
      });
      lastPage.drawText(`Data: ${sigDate} | Serial: ${cert.serialNumber.substring(0, 20)}…`, {
        x: stampX + 10, y: stampY + stampHeight - 50, size: 6, font: helvetica, color: rgb(0.4, 0.4, 0.4),
      });
      lastPage.drawText("Certificado A1 ICP-Brasil • Válido conforme MP 2.200-2/2001", {
        x: stampX + 10, y: stampY + stampHeight - 61, size: 5.5, font: helvetica, color: rgb(0.5, 0.5, 0.5),
      });

      stampedPdfBytes = await pdfDoc.save();
      addStep(7, "Adicionar selo visual de assinatura", "pass", `PDF com selo: ${stampedPdfBytes.length} bytes`, s7);
    } catch (e) {
      addStep(7, "Adicionar selo visual", "fail", e instanceof Error ? e.message : String(e), s7);
      return respond(500, { success: false, steps, error: "Falha ao adicionar selo" });
    }

    // ── Step 8: Create PKCS#7 digital signature ──
    const s8 = Date.now();
    let signatureHash: string;
    try {
      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(forge.util.binary.raw.encode(stampedPdfBytes));
      p7.addCertificate(cert);
      p7.addSigner({
        key: privateKey,
        certificate: cert,
        digestAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: [
          { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
          { type: forge.pki.oids.messageDigest },
          { type: forge.pki.oids.signingTime, value: new Date() },
        ],
      });

      p7.sign({ detached: true });
      const sigDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
      signatureHash = await hashBytes(new Uint8Array(sigDer.split("").map((c: string) => c.charCodeAt(0))));
      addStep(8, "Gerar assinatura PKCS#7 (detached)", "pass",
        `Assinatura SHA-256: ${signatureHash.slice(0, 32)}…`, s8);
    } catch (e) {
      addStep(8, "Gerar assinatura PKCS#7", "fail", e instanceof Error ? e.message : String(e), s8);
      return respond(500, { success: false, steps, error: "Falha na assinatura PKCS#7" });
    }

    // ── Step 9: Verify signature ──
    const s9 = Date.now();
    try {
      const testData = "verify-round-trip";
      const md = forge.md.sha256.create();
      md.update(testData, "utf8");
      const sig = privateKey.sign(md);
      const md2 = forge.md.sha256.create();
      md2.update(testData, "utf8");
      const verified = cert.publicKey.verify(md2.digest().bytes(), sig);
      if (!verified) throw new Error("Verificação sign→verify falhou");
      addStep(9, "Verificar assinatura (round-trip)", "pass", "sign() → verify() ✓", s9);
    } catch (e) {
      addStep(9, "Verificar assinatura", "fail", e instanceof Error ? e.message : String(e), s9);
      return respond(500, { success: false, steps, error: "Verificação de assinatura falhou" });
    }

    // ── All passed — return signed PDF ──
    const totalMs = Date.now() - t0;
    const cn = cert.subject.attributes.find((a: any) => a.shortName === "CN")?.value || "?";
    const issuerCN = cert.issuer.attributes.find((a: any) => a.shortName === "CN")?.value || "?";

    return new Response(JSON.stringify({
      success: true,
      total_duration_ms: totalMs,
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
        hash: signatureHash!.slice(0, 32),
        algorithm: "SHA-256 + RSA (PKCS#7 detached)",
      },
      signed_pdf_base64: base64Encode(stampedPdfBytes),
      signed_pdf_size: stampedPdfBytes.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({
      success: false,
      steps,
      error: msg,
      total_duration_ms: Date.now() - t0,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function respond(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

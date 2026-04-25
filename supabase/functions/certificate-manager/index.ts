import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
};

const BUCKET = "certificates";
const CERT_FOLDER = "a1-certificates";

// ─── Diagnostic error codes ───
const DIAG_CODES = {
  CERT_FILE_EMPTY: "Arquivo do certificado está vazio (0 bytes)",
  CERT_FILE_CORRUPTED: "Arquivo PFX/P12 parece corrompido ou não é um formato válido",
  CERT_PASSWORD_EMPTY: "Senha está vazia ou undefined",
  CERT_PASSWORD_TRIMMED_MISMATCH: "Senha contém espaços no início/fim que podem causar falha",
  CERT_PASSWORD_ENV_MISSING: "Variável de ambiente da senha não encontrada",
  CERT_PASSWORD_ENV_MULTILINE: "Senha contém quebra de linha (\\n ou \\r)",
  CERT_PARSE_FAILED: "Falha ao inicializar parser do certificado PFX",
  CERT_PRIVATE_KEY_NOT_FOUND: "Chave privada não encontrada no certificado",
  CERT_SIGN_TEST_FAILED: "Falha na assinatura de teste",
  CERT_VERIFY_FAILED: "Falha na verificação pós-assinatura",
  CERT_FORGE_IMPORT_FAILED: "Falha ao importar biblioteca node-forge",
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
  const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── Safe forge import ───
async function getForge() {
  const mod = await import("https://esm.sh/node-forge@1.3.1");
  // Handle both default export and namespace export
  return mod.default || mod;
}

// ─── Convert Uint8Array to forge binary string ───
function uint8ToBinaryString(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
    str += String.fromCharCode(...chunk);
  }
  return str;
}

// ─── Parse PFX certificate ───
async function parseCertificateInfo(pfxBytes: Uint8Array, password: string): Promise<{
  subject: string;
  issuer: string;
  serial_number: string;
  valid_from: string;
  valid_to: string;
  has_private_key: boolean;
} | null> {
  try {
    const forge = await getForge();
    const binaryDer = uint8ToBinaryString(pfxBytes);
    const pfxAsn1 = forge.asn1.fromDer(binaryDer);
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

    // Extract certificate
    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];
    if (!certBag || certBag.length === 0) return null;

    const cert = certBag[0].cert;
    if (!cert) return null;

    // Check for private key
    const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    const hasPrivateKey = !!(keyBag && keyBag.length > 0 && keyBag[0].key);

    const subjectAttrs = cert.subject.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(", ");
    const issuerAttrs = cert.issuer.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(", ");

    return {
      subject: subjectAttrs,
      issuer: issuerAttrs,
      serial_number: cert.serialNumber,
      valid_from: cert.validity.notBefore.toISOString(),
      valid_to: cert.validity.notAfter.toISOString(),
      has_private_key: hasPrivateKey,
    };
  } catch (e) {
    console.error("[certificate-manager] Failed to parse certificate:", e);
    return null;
  }
}

// ─── Diagnostic Step Runner ───
type DiagStep = {
  step: number;
  name: string;
  status: "pass" | "fail" | "skip";
  message: string;
  code?: string;
  duration_ms?: number;
};

async function runDiagnostic(fileBytes: Uint8Array, password: string): Promise<{
  steps: DiagStep[];
  conclusion: string;
  certificate?: any;
}> {
  const steps: DiagStep[] = [];
  let forge: any = null;

  const runStep = async (step: number, name: string, fn: () => Promise<{ ok: boolean; message: string; code?: string }>) => {
    const start = Date.now();
    try {
      const result = await fn();
      steps.push({ step, name, status: result.ok ? "pass" : "fail", message: result.message, code: result.code, duration_ms: Date.now() - start });
      return result.ok;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push({ step, name, status: "fail", message: msg, duration_ms: Date.now() - start });
      return false;
    }
  };

  // Step 1: File received
  const s1 = await runStep(1, "Arquivo recebido", async () => {
    if (!fileBytes || fileBytes.length === 0) return { ok: false, message: DIAG_CODES.CERT_FILE_EMPTY, code: "CERT_FILE_EMPTY" };
    return { ok: true, message: `Arquivo recebido: ${fileBytes.length} bytes` };
  });
  if (!s1) return { steps, conclusion: "Falha: arquivo vazio ou não recebido." };

  // Step 2: File hash
  const fileHash = await hashBytes(fileBytes);
  await runStep(2, "Hash SHA-256 calculado", async () => {
    return { ok: true, message: `SHA-256: ${fileHash.slice(0, 16)}...` };
  });

  // Step 3: File format validation
  const s3 = await runStep(3, "Formato do arquivo validado", async () => {
    // PFX/P12 files start with specific ASN.1 sequence (0x30 0x82)
    if (fileBytes.length < 4) return { ok: false, message: DIAG_CODES.CERT_FILE_CORRUPTED, code: "CERT_FILE_CORRUPTED" };
    if (fileBytes[0] !== 0x30) return { ok: false, message: `Primeiro byte: 0x${fileBytes[0].toString(16)} (esperado 0x30 para ASN.1 SEQUENCE). ${DIAG_CODES.CERT_FILE_CORRUPTED}`, code: "CERT_FILE_CORRUPTED" };
    return { ok: true, message: `Formato ASN.1 detectado. Tamanho: ${fileBytes.length} bytes.` };
  });
  if (!s3) return { steps, conclusion: "Falha: o arquivo não parece ser um PFX/P12 válido." };

  // Step 4: Password received
  const s4 = await runStep(4, "Senha recebida", async () => {
    if (password === null || password === undefined) return { ok: false, message: DIAG_CODES.CERT_PASSWORD_EMPTY, code: "CERT_PASSWORD_EMPTY" };
    if (typeof password !== "string") return { ok: false, message: `Tipo da senha: ${typeof password} (esperado: string)`, code: "CERT_PASSWORD_EMPTY" };
    if (password.length === 0) return { ok: false, message: DIAG_CODES.CERT_PASSWORD_EMPTY, code: "CERT_PASSWORD_EMPTY" };
    return { ok: true, message: `Senha recebida: ${password.length} caracteres` };
  });
  if (!s4) return { steps, conclusion: "Falha: senha não fornecida." };

  // Step 5: Password normalization analysis
  await runStep(5, "Análise de normalização da senha", async () => {
    const issues: string[] = [];
    const trimmed = password.trim();
    const hasLeadingSpace = password !== password.trimStart();
    const hasTrailingSpace = password !== password.trimEnd();
    const hasNewline = password.includes("\n") || password.includes("\r");
    // Check for invisible unicode chars
    const invisibleRegex = /[\u200B\u200C\u200D\uFEFF\u00A0]/;
    const hasInvisible = invisibleRegex.test(password);

    if (hasLeadingSpace) issues.push(`Espaço(s) no início detectado(s)`);
    if (hasTrailingSpace) issues.push(`Espaço(s) no final detectado(s)`);
    if (hasNewline) issues.push(`Quebra de linha detectada`);
    if (hasInvisible) issues.push(`Caractere Unicode invisível detectado`);

    const details = [
      `Comprimento original: ${password.length}`,
      `Comprimento normalizado (trim): ${trimmed.length}`,
      `Whitespace início: ${hasLeadingSpace ? "SIM" : "não"}`,
      `Whitespace final: ${hasTrailingSpace ? "SIM" : "não"}`,
      `Newline: ${hasNewline ? "SIM" : "não"}`,
      `Char invisível: ${hasInvisible ? "SIM" : "não"}`,
    ].join(" | ");

    if (issues.length > 0) {
      return { ok: true, message: `⚠️ ${issues.join("; ")}. ${details}`, code: "CERT_PASSWORD_TRIMMED_MISMATCH" };
    }
    return { ok: true, message: `Senha limpa. ${details}` };
  });

  // Step 6: Forge import
  const s6 = await runStep(6, "Parser inicializado (node-forge)", async () => {
    try {
      forge = await getForge();
      if (!forge || !forge.asn1 || !forge.pkcs12 || !forge.pki) {
        return { ok: false, message: `Módulos disponíveis: asn1=${!!forge?.asn1}, pkcs12=${!!forge?.pkcs12}, pki=${!!forge?.pki}`, code: "CERT_FORGE_IMPORT_FAILED" };
      }
      return { ok: true, message: `node-forge carregado. Módulos: asn1 ✓, pkcs12 ✓, pki ✓` };
    } catch (e) {
      return { ok: false, message: `${DIAG_CODES.CERT_FORGE_IMPORT_FAILED}: ${e instanceof Error ? e.message : String(e)}`, code: "CERT_FORGE_IMPORT_FAILED" };
    }
  });
  if (!s6) return { steps, conclusion: "Falha: biblioteca de parsing não pôde ser carregada." };

  // Step 7: Certificate loaded
  let pfxObj: any = null;
  const s7 = await runStep(7, "Certificado carregado (PKCS#12)", async () => {
    try {
      const binaryDer = uint8ToBinaryString(fileBytes);
      const pfxAsn1 = forge.asn1.fromDer(binaryDer);
      pfxObj = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
      return { ok: true, message: "PKCS#12 decodificado com sucesso" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Determine specific error code
      if (msg.toLowerCase().includes("invalid password") || msg.toLowerCase().includes("pkcs12")) {
        // Try with trimmed password
        const trimmedPw = password.trim();
        if (trimmedPw !== password) {
          try {
            const binaryDer = uint8ToBinaryString(fileBytes);
            const pfxAsn1 = forge.asn1.fromDer(binaryDer);
            pfxObj = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, trimmedPw);
            return { ok: true, message: `⚠️ PKCS#12 carregado APENAS com senha normalizada (trim). A senha original tem whitespace extra!`, code: "CERT_PASSWORD_TRIMMED_MISMATCH" };
          } catch {
            // trimmed also failed
          }
        }
        return { ok: false, message: `Senha incorreta ou arquivo inválido. Erro original: ${msg}`, code: "CERT_PARSE_FAILED" };
      }
      return { ok: false, message: `${DIAG_CODES.CERT_PARSE_FAILED}: ${msg}`, code: "CERT_PARSE_FAILED" };
    }
  });

  if (!s7 || !pfxObj) {
    // Try to give a more specific conclusion
    const lastStep = steps[steps.length - 1];
    if (lastStep.code === "CERT_PARSE_FAILED" && lastStep.message.includes("Senha incorreta")) {
      return { steps, conclusion: "A senha fornecida está incorreta ou o arquivo PFX está corrompido. Verifique se a senha não possui espaços extras, quebras de linha ou caracteres invisíveis." };
    }
    return { steps, conclusion: "Falha ao decodificar o certificado PKCS#12." };
  }

  // Step 8: Private key extracted
  let privateKey: any = null;
  let certificate: any = null;
  const s8 = await runStep(8, "Chave privada extraída", async () => {
    try {
      const keyBags = pfxObj.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
      if (!keyBag || keyBag.length === 0 || !keyBag[0].key) {
        return { ok: false, message: DIAG_CODES.CERT_PRIVATE_KEY_NOT_FOUND, code: "CERT_PRIVATE_KEY_NOT_FOUND" };
      }
      privateKey = keyBag[0].key;

      const certBags = pfxObj.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag];
      if (certBag && certBag.length > 0 && certBag[0].cert) {
        certificate = certBag[0].cert;
      }

      const keyType = privateKey.n ? `RSA ${privateKey.n.bitLength()} bits` : "Unknown type";
      return { ok: true, message: `Chave privada extraída: ${keyType}` };
    } catch (e) {
      return { ok: false, message: `${DIAG_CODES.CERT_PRIVATE_KEY_NOT_FOUND}: ${e instanceof Error ? e.message : String(e)}`, code: "CERT_PRIVATE_KEY_NOT_FOUND" };
    }
  });
  if (!s8) return { steps, conclusion: "Chave privada não encontrada no certificado." };

  // Step 9: Test signature
  const s9 = await runStep(9, "Assinatura de teste executada", async () => {
    try {
      const testData = "WMTi-Certificate-Diagnostic-Test-Payload";
      const md = forge.md.sha256.create();
      md.update(testData, "utf8");
      const signature = privateKey.sign(md);
      if (!signature || signature.length === 0) {
        return { ok: false, message: DIAG_CODES.CERT_SIGN_TEST_FAILED, code: "CERT_SIGN_TEST_FAILED" };
      }
      return { ok: true, message: `Assinatura de teste gerada: ${signature.length * 2} bytes (hex)` };
    } catch (e) {
      return { ok: false, message: `${DIAG_CODES.CERT_SIGN_TEST_FAILED}: ${e instanceof Error ? e.message : String(e)}`, code: "CERT_SIGN_TEST_FAILED" };
    }
  });

  // Step 10: Verify signature
  const s10 = await runStep(10, "Verificação pós-assinatura", async () => {
    if (!certificate || !privateKey) {
      return { ok: false, message: "Certificado ou chave não disponíveis para verificação", code: "CERT_VERIFY_FAILED" };
    }
    try {
      const testData = "WMTi-Certificate-Verify-Test";
      const md = forge.md.sha256.create();
      md.update(testData, "utf8");
      const signature = privateKey.sign(md);

      const publicKey = certificate.publicKey;
      const md2 = forge.md.sha256.create();
      md2.update(testData, "utf8");
      const verified = publicKey.verify(md2.digest().bytes(), signature);

      if (!verified) {
        return { ok: false, message: DIAG_CODES.CERT_VERIFY_FAILED, code: "CERT_VERIFY_FAILED" };
      }
      return { ok: true, message: "Assinatura verificada com sucesso (sign → verify ✓)" };
    } catch (e) {
      return { ok: false, message: `${DIAG_CODES.CERT_VERIFY_FAILED}: ${e instanceof Error ? e.message : String(e)}`, code: "CERT_VERIFY_FAILED" };
    }
  });

  // Build certificate info for response
  let certInfo: any = null;
  if (certificate) {
    const subjectAttrs = certificate.subject.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(", ");
    const issuerAttrs = certificate.issuer.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(", ");
    certInfo = {
      subject: subjectAttrs,
      issuer: issuerAttrs,
      serial_number: certificate.serialNumber,
      valid_from: certificate.validity.notBefore.toISOString(),
      valid_to: certificate.validity.notAfter.toISOString(),
      is_expired: certificate.validity.notAfter < new Date(),
    };
  }

  // Conclusion
  const failedSteps = steps.filter(s => s.status === "fail");
  let conclusion: string;
  if (failedSteps.length === 0) {
    conclusion = "✅ Todas as etapas passaram com sucesso. O certificado está válido, a chave privada foi extraída e a assinatura/verificação funcionam corretamente.";
  } else {
    const firstFail = failedSteps[0];
    const codeMap: Record<string, string> = {
      CERT_PASSWORD_TRIMMED_MISMATCH: "A divergência ocorre entre senha digitada e senha armazenada. Verifique se há espaços ou quebras de linha extras.",
      CERT_PASSWORD_ENV_MULTILINE: "A senha não parece incorreta; a falha está ocorrendo por newline no secret armazenado.",
      CERT_FILE_CORRUPTED: "O arquivo PFX parece corrompido ou incompleto.",
      CERT_PARSE_FAILED: "O parser atual não conseguiu extrair o conteúdo do certificado. Verifique se a senha está correta e se o arquivo não está truncado.",
      CERT_PRIVATE_KEY_NOT_FOUND: "O certificado foi lido mas a chave privada não foi encontrada. Pode ser um certificado sem chave privada associada.",
      CERT_SIGN_TEST_FAILED: "A chave privada foi extraída mas a assinatura de teste falhou.",
      CERT_VERIFY_FAILED: "A assinatura foi gerada mas a verificação falhou - possível incompatibilidade de chaves.",
    };
    conclusion = codeMap[firstFail.code || ""] || `Falha na etapa ${firstFail.step}: ${firstFail.name}. ${firstFail.message}`;
  }

  return { steps, conclusion, certificate: certInfo };
}

// ─── AES Encryption helpers ───
async function getEncryptionKey() {
  const encryptionKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(encryptionKey).slice(0, 32),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  const result = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);
  return result;
}

async function decryptBytes(encryptedWithIv: Uint8Array): Promise<Uint8Array> {
  const key = await getEncryptionKey();
  const iv = encryptedWithIv.slice(0, 12);
  const ciphertext = encryptedWithIv.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new Uint8Array(decrypted);
}

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const isAdmin = await validateAdminToken(req);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createServiceClient();

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "status";

    // ─── STATUS ───
    if (action === "status") {
      const { data: configs } = await supabase
        .from("certificate_config")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      const config = configs?.[0] || null;

      const { data: recentLogs } = await supabase
        .from("signature_logs")
        .select("id, contract_id, status, signed_at, error_message")
        .order("created_at", { ascending: false })
        .limit(10);

      const { count: totalSigned } = await supabase
        .from("signature_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "signed");

      const { count: totalFailed } = await supabase
        .from("signature_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "error");

      return new Response(JSON.stringify({
        success: true,
        certificate: config ? {
          id: config.id,
          subject: config.subject,
          issuer: config.issuer,
          serial_number: config.serial_number,
          valid_from: config.valid_from,
          valid_to: config.valid_to,
          auto_sign_enabled: config.auto_sign_enabled,
          last_used_at: config.last_used_at,
          status: config.status,
          created_at: config.created_at,
          is_expired: config.valid_to ? new Date(config.valid_to) < new Date() : false,
          days_until_expiry: config.valid_to ? Math.ceil((new Date(config.valid_to).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
        } : null,
        stats: { total_signed: totalSigned || 0, total_failed: totalFailed || 0 },
        recent_logs: recentLogs || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── DIAGNOSE: Full diagnostic without side effects ───
    if (action === "diagnose") {
      const requestId = crypto.randomUUID();
      const startTime = Date.now();

      const formData = await req.formData();
      const file = formData.get("certificate") as File | null;
      const password = formData.get("password") as string | null;

      // Log diagnostic start (without exposing password)
      console.log(`[certificate-diag] request_id=${requestId} file_size=${file?.size || 0} file_name=${file?.name || "none"} password_length=${password?.length || 0}`);

      if (!file) {
        return new Response(JSON.stringify({
          success: false,
          request_id: requestId,
          steps: [{ step: 1, name: "Arquivo recebido", status: "fail", message: "Nenhum arquivo enviado" }],
          conclusion: "Nenhum arquivo foi enviado para diagnóstico.",
          duration_ms: Date.now() - startTime,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const fileBytes = new Uint8Array(await file.arrayBuffer());
      const result = await runDiagnostic(fileBytes, password || "");

      // Log to logs_sistema
      try {
        const allPassed = result.steps.every(s => s.status === "pass");
        await supabase.from("logs_sistema").insert({
          tipo: "admin",
          status: allPassed ? "success" : "error",
          mensagem: `Diagnóstico de certificado: ${allPassed ? "PASS" : "FAIL"} (${result.steps.filter(s => s.status === "pass").length}/${result.steps.length} etapas)`,
          payload: {
            request_id: requestId,
            file_size: fileBytes.length,
            file_hash: await hashBytes(fileBytes),
            steps_summary: result.steps.map(s => ({ step: s.step, name: s.name, status: s.status, code: s.code })),
            conclusion: result.conclusion,
            duration_ms: Date.now() - startTime,
          },
        });
      } catch (e) {
        console.error("[certificate-diag] Failed to log:", e);
      }

      return new Response(JSON.stringify({
        success: true,
        request_id: requestId,
        steps: result.steps,
        conclusion: result.conclusion,
        certificate: result.certificate,
        duration_ms: Date.now() - startTime,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── UPLOAD ───
    if (action === "upload") {
      const formData = await req.formData();
      const file = formData.get("certificate") as File | null;
      const certPassword = formData.get("password") as string | null;

      if (!file || !certPassword) {
        return new Response(JSON.stringify({ error: "Certificado e senha são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fileBytes = new Uint8Array(await file.arrayBuffer());

      const certInfo = await parseCertificateInfo(fileBytes, certPassword);
      if (!certInfo) {
        return new Response(JSON.stringify({ error: "Certificado inválido ou senha incorreta. Verifique o arquivo .pfx/.p12 e a senha." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(certInfo.valid_to) < new Date()) {
        return new Response(JSON.stringify({ error: "Certificado expirado. Envie um certificado válido." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const certHash = await hashBytes(fileBytes);
      const storagePath = `${CERT_FOLDER}/${certHash}.pfx`;

      // Encrypt and upload
      const encryptedCert = await encryptBytes(fileBytes);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, encryptedCert, { contentType: "application/octet-stream", upsert: true });

      if (uploadError) throw new Error(`Falha ao salvar certificado: ${uploadError.message}`);

      // Encrypt and store password
      const encryptedPassword = await encryptBytes(new TextEncoder().encode(certPassword));
      const encryptedPasswordB64 = base64Encode(encryptedPassword);

      await supabase.storage
        .from(BUCKET)
        .upload(`${CERT_FOLDER}/${certHash}.key`, new TextEncoder().encode(encryptedPasswordB64), {
          contentType: "text/plain",
          upsert: true,
        });

      // Deactivate previous certificates
      await supabase
        .from("certificate_config")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("status", "active");

      const { data: newConfig, error: insertError } = await supabase
        .from("certificate_config")
        .insert({
          certificate_storage_path: storagePath,
          certificate_hash: certHash,
          subject: certInfo.subject,
          issuer: certInfo.issuer,
          serial_number: certInfo.serial_number,
          valid_from: certInfo.valid_from,
          valid_to: certInfo.valid_to,
          auto_sign_enabled: false,
          status: "active",
        })
        .select("id")
        .single();

      if (insertError) throw new Error(`Falha ao registrar certificado: ${insertError.message}`);

      return new Response(JSON.stringify({
        success: true,
        certificate: {
          id: newConfig.id,
          subject: certInfo.subject,
          issuer: certInfo.issuer,
          valid_from: certInfo.valid_from,
          valid_to: certInfo.valid_to,
          days_until_expiry: Math.ceil((new Date(certInfo.valid_to).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── TOGGLE ───
    if (action === "toggle") {
      const body = await req.json();
      const enabled = body.auto_sign_enabled === true;

      const { error } = await supabase
        .from("certificate_config")
        .update({ auto_sign_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("status", "active");

      if (error) throw new Error(error.message);

      return new Response(JSON.stringify({ success: true, auto_sign_enabled: enabled }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── TEST ───
    if (action === "test") {
      const { data: config } = await supabase
        .from("certificate_config")
        .select("*")
        .eq("status", "active")
        .single();

      if (!config) {
        return new Response(JSON.stringify({ error: "Nenhum certificado ativo configurado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Download and decrypt cert
      const { data: certData, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(config.certificate_storage_path);

      if (downloadError || !certData) {
        return new Response(JSON.stringify({ error: "Certificado não encontrado no storage" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const encryptedBytes = new Uint8Array(await certData.arrayBuffer());
      let decryptedCert: Uint8Array;
      try {
        decryptedCert = await decryptBytes(encryptedBytes);
      } catch {
        return new Response(JSON.stringify({ error: "Falha ao descriptografar certificado" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Download and decrypt password
      const { data: passData } = await supabase.storage
        .from(BUCKET)
        .download(`${CERT_FOLDER}/${config.certificate_hash}.key`);

      if (!passData) {
        return new Response(JSON.stringify({ error: "Senha do certificado não encontrada" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const encPassB64 = await passData.text();
      const encPassBytes = base64Decode(encPassB64);
      let certPassword: string;
      try {
        const decPass = await decryptBytes(encPassBytes);
        certPassword = new TextDecoder().decode(decPass);
      } catch {
        return new Response(JSON.stringify({ error: "Falha ao recuperar senha do certificado" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const certInfo = await parseCertificateInfo(decryptedCert, certPassword);
      if (!certInfo) {
        return new Response(JSON.stringify({ error: "Certificado inválido ou corrompido" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("certificate_config")
        .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", config.id);

      return new Response(JSON.stringify({
        success: true,
        message: "Certificado validado com sucesso",
        certificate: {
          subject: certInfo.subject,
          issuer: certInfo.issuer,
          valid_from: certInfo.valid_from,
          valid_to: certInfo.valid_to,
          is_expired: new Date(certInfo.valid_to) < new Date(),
          has_private_key: certInfo.has_private_key,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── LOGS ───
    if (action === "logs") {
      const { data: logs } = await supabase
        .from("signature_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ success: true, logs: logs || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("[certificate-manager] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

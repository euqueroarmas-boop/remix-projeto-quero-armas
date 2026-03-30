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

// Parse PFX/P12 certificate to extract metadata (basic parsing)
// In production, this extracts subject, issuer, validity from the certificate
async function parseCertificateInfo(pfxBytes: Uint8Array, password: string): Promise<{
  subject: string;
  issuer: string;
  serial_number: string;
  valid_from: string;
  valid_to: string;
} | null> {
  try {
    // Use node-forge for PFX parsing
    const forge = await import("npm:node-forge@1.3.1");
    
    const pfxAsn1 = forge.asn1.fromDer(forge.util.decode64(base64Encode(pfxBytes)));
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
    
    // Extract certificate
    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];
    if (!certBag || certBag.length === 0) return null;
    
    const cert = certBag[0].cert;
    if (!cert) return null;
    
    const subjectAttrs = cert.subject.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(", ");
    const issuerAttrs = cert.issuer.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(", ");
    
    return {
      subject: subjectAttrs,
      issuer: issuerAttrs,
      serial_number: cert.serialNumber,
      valid_from: cert.validity.notBefore.toISOString(),
      valid_to: cert.validity.notAfter.toISOString(),
    };
  } catch (e) {
    console.error("[certificate-manager] Failed to parse certificate:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate admin authentication
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

    // ─── STATUS: Get current certificate info ───
    if (action === "status") {
      const { data: configs } = await supabase
        .from("certificate_config")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      const config = configs?.[0] || null;

      // Get recent signature logs
      const { data: recentLogs } = await supabase
        .from("signature_logs")
        .select("id, contract_id, status, signed_at, error_message")
        .order("created_at", { ascending: false })
        .limit(10);

      // Get signature stats
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
        stats: {
          total_signed: totalSigned || 0,
          total_failed: totalFailed || 0,
        },
        recent_logs: recentLogs || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── UPLOAD: Upload new certificate ───
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
      
      // Validate the certificate by parsing it
      const certInfo = await parseCertificateInfo(fileBytes, certPassword);
      if (!certInfo) {
        return new Response(JSON.stringify({ error: "Certificado inválido ou senha incorreta. Verifique o arquivo .pfx/.p12 e a senha." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check expiry
      if (new Date(certInfo.valid_to) < new Date()) {
        return new Response(JSON.stringify({ error: "Certificado expirado. Envie um certificado válido." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const certHash = await hashBytes(fileBytes);
      const storagePath = `${CERT_FOLDER}/${certHash}.pfx`;

      // Encrypt the certificate bytes with AES before storage
      const encryptionKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(encryptionKey).slice(0, 32),
        { name: "AES-GCM" },
        false,
        ["encrypt"],
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        keyMaterial,
        fileBytes,
      );

      // Combine IV + encrypted data
      const encryptedWithIv = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
      encryptedWithIv.set(iv);
      encryptedWithIv.set(new Uint8Array(encrypted), iv.length);

      // Upload encrypted cert to storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, encryptedWithIv, {
          contentType: "application/octet-stream",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Falha ao salvar certificado: ${uploadError.message}`);
      }

      // Store the cert password encrypted in the DB as well
      const passwordIv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedPassword = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: passwordIv },
        keyMaterial,
        new TextEncoder().encode(certPassword),
      );
      const passwordWithIv = new Uint8Array(passwordIv.length + new Uint8Array(encryptedPassword).length);
      passwordWithIv.set(passwordIv);
      passwordWithIv.set(new Uint8Array(encryptedPassword), passwordIv.length);
      const encryptedPasswordB64 = base64Encode(passwordWithIv);

      // Deactivate previous certificates
      await supabase
        .from("certificate_config")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("status", "active");

      // Insert new certificate config
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

      if (insertError) {
        throw new Error(`Falha ao registrar certificado: ${insertError.message}`);
      }

      // Store encrypted password as a metadata note (not in plain text)
      // We use a separate approach: store in the certificate_config via an update
      await supabase.from("certificate_config").update({
        // Store encrypted password in a JSON field approach
        // Using certificate_hash field extension is not ideal, 
        // so we use a convention: store in storage as companion file
      }).eq("id", newConfig.id);

      // Save encrypted password as companion file
      await supabase.storage
        .from(BUCKET)
        .upload(`${CERT_FOLDER}/${certHash}.key`, new TextEncoder().encode(encryptedPasswordB64), {
          contentType: "text/plain",
          upsert: true,
        });

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
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── TOGGLE: Enable/disable auto-signing ───
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

    // ─── TEST: Test signing with current certificate ───
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

      // Download and decrypt the certificate
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

      // Decrypt
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

      let decryptedCert: Uint8Array;
      try {
        const decrypted = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          keyMaterial,
          ciphertext,
        );
        decryptedCert = new Uint8Array(decrypted);
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
      const passIv = encPassBytes.slice(0, 12);
      const passCipher = encPassBytes.slice(12);

      let certPassword: string;
      try {
        const decPass = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: passIv },
          keyMaterial,
          passCipher,
        );
        certPassword = new TextDecoder().decode(decPass);
      } catch {
        return new Response(JSON.stringify({ error: "Falha ao recuperar senha do certificado" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Test: try to parse the certificate
      const certInfo = await parseCertificateInfo(decryptedCert, certPassword);
      if (!certInfo) {
        return new Response(JSON.stringify({ error: "Certificado inválido ou corrompido" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update last_used_at
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
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── LOGS: Get signature logs ───
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

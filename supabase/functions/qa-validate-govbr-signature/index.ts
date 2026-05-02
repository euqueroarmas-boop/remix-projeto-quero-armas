// qa-validate-govbr-signature
// Valida assinaturas digitais PAdES/PKCS#7 embutidas em PDFs.
// Detecta certificados emitidos sob a cadeia ICP-Brasil (incluindo gov.br).
// Retorna metadados do signatário: nome, CPF, data, autoridade emissora.

import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";
import forge from "npm:node-forge@1.3.1";

type ValidationResult = {
  valida: boolean;
  status: "valida" | "invalida" | "sem_assinatura" | "erro";
  signatario: string | null;
  cpf_signatario: string | null;
  data_assinatura: string | null;
  autoridade: string | null;
  motivo_falha?: string;
  detalhes?: Record<string, unknown>;
};

// Lista de fragmentos comuns em CN de ACs ICP-Brasil
const ICP_BRASIL_HINTS = [
  "ICP-Brasil",
  "AC Raiz Brasileira",
  "AC SERASA",
  "AC SAFEWEB",
  "AC SOLUTI",
  "AC VALID",
  "AC CERTISIGN",
  "AC SERPRO",
  "AC CAIXA",
  "AC BR RFB",
  "AC RFB",
  "AC IMESP",
  "AC PRODEMGE",
  "AC DIGITAL",
  "AC GOVBR",
  "Gov.br",
];

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Extrai todos os blocos /Contents <...> de Sig dictionaries em um PDF
function extractPkcs7Blobs(pdfBytes: Uint8Array): Uint8Array[] {
  // Decodifica como latin1 para preservar bytes
  const text = new TextDecoder("latin1").decode(pdfBytes);
  const blobs: Uint8Array[] = [];
  // Padrão: /Contents <hex...>
  const re = /\/Contents\s*<([0-9A-Fa-f\s]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const hex = m[1].replace(/\s+/g, "");
    if (hex.length < 16) continue;
    // Remove zeros de padding finais (PDFs preenchem o slot fixo)
    const trimmed = hex.replace(/(00)+$/i, "");
    if (trimmed.length % 2 !== 0) continue;
    const out = new Uint8Array(trimmed.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(trimmed.substr(i * 2, 2), 16);
    }
    blobs.push(out);
  }
  return blobs;
}

function extractCpfFromSubject(attrs: Array<{ shortName?: string; name?: string; value: string }>): { nome: string | null; cpf: string | null } {
  let nome: string | null = null;
  for (const a of attrs) {
    if (a.shortName === "CN" || a.name === "commonName") {
      nome = a.value;
    }
  }
  // CPF normalmente vem no CN como "NOME COMPLETO:12345678900"
  let cpf: string | null = null;
  if (nome) {
    const m = nome.match(/(\d{11})/);
    if (m) cpf = m[1];
    nome = nome.replace(/:\d{11}.*$/, "").trim();
  }
  return { nome, cpf };
}

function isIcpBrasil(issuerCN: string | null): boolean {
  if (!issuerCN) return false;
  const lower = issuerCN.toLowerCase();
  return ICP_BRASIL_HINTS.some((h) => lower.includes(h.toLowerCase()));
}

function validateSignature(pdfBytes: Uint8Array): ValidationResult {
  const blobs = extractPkcs7Blobs(pdfBytes);
  if (blobs.length === 0) {
    return {
      valida: false,
      status: "sem_assinatura",
      signatario: null,
      cpf_signatario: null,
      data_assinatura: null,
      autoridade: null,
      motivo_falha: "PDF não contém assinatura digital embutida (PAdES/PKCS#7).",
    };
  }

  // Pega a primeira assinatura válida encontrada
  for (const blob of blobs) {
    try {
      const der = forge.util.createBuffer(
        Array.from(blob).map((b) => String.fromCharCode(b)).join("")
      );
      const asn1 = forge.asn1.fromDer(der);
      const p7 = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData;

      const certs = p7.certificates || [];
      if (certs.length === 0) continue;

      // O signatário normalmente é o primeiro cert (folha)
      const signerCert = certs[0];
      const subjectAttrs = signerCert.subject.attributes as Array<{ shortName?: string; name?: string; value: string }>;
      const issuerAttrs = signerCert.issuer.attributes as Array<{ shortName?: string; name?: string; value: string }>;

      const { nome, cpf } = extractCpfFromSubject(subjectAttrs);
      const issuerCN = issuerAttrs.find((a) => a.shortName === "CN")?.value || null;

      // Tenta extrair signing time
      let signingTime: string | null = null;
      try {
        const signers = (p7 as any).rawCapture?.signerInfos || [];
        for (const si of signers) {
          const authAttrs = si.value?.[3]?.value || [];
          for (const attr of authAttrs) {
            const oid = forge.asn1.derToOid(attr.value[0].value);
            if (oid === "1.2.840.113549.1.9.5") {
              const t = attr.value[1].value[0].value;
              const d = forge.asn1.utcTimeToDate(t);
              if (d) signingTime = d.toISOString();
              break;
            }
          }
          if (signingTime) break;
        }
      } catch {
        // ignora erro de parsing de signing time
      }

      const icp = isIcpBrasil(issuerCN);

      return {
        valida: true,
        status: "valida",
        signatario: nome,
        cpf_signatario: cpf,
        data_assinatura: signingTime,
        autoridade: issuerCN,
        detalhes: {
          icp_brasil: icp,
          serial_number: signerCert.serialNumber,
          valid_from: signerCert.validity.notBefore.toISOString(),
          valid_to: signerCert.validity.notAfter.toISOString(),
          total_assinaturas: blobs.length,
        },
      };
    } catch (e) {
      console.error("Erro ao parsear PKCS#7:", (e as Error).message);
      continue;
    }
  }

  return {
    valida: false,
    status: "invalida",
    signatario: null,
    cpf_signatario: null,
    data_assinatura: null,
    autoridade: null,
    motivo_falha: "Nenhuma das assinaturas embutidas pôde ser interpretada.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const documentoId: string | undefined = body.documento_id;
    const storagePath: string | undefined = body.storage_path;

    if (!documentoId && !storagePath) {
      return new Response(JSON.stringify({ error: "documento_id ou storage_path obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRole);

    // Resolve storage path
    let path = storagePath;
    let docRow: any = null;
    if (documentoId) {
      const { data, error } = await admin
        .from("qa_processo_documentos")
        .select("id, arquivo_storage_key, cliente_id, processo_id")
        .eq("id", documentoId)
        .maybeSingle();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "documento não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      docRow = data;
      path = data.arquivo_storage_key || undefined;
    }

    if (!path) {
      return new Response(JSON.stringify({ error: "documento sem arquivo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bucket = "qa-documentos";
    const { data: file, error: dlErr } = await admin.storage.from(bucket).download(path);
    if (dlErr || !file) {
      return new Response(JSON.stringify({ error: "falha ao baixar arquivo", detail: dlErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = new Uint8Array(await file.arrayBuffer());

    // Verificar header PDF
    const head = new TextDecoder().decode(buf.slice(0, 5));
    if (!head.startsWith("%PDF")) {
      const result: ValidationResult = {
        valida: false,
        status: "sem_assinatura",
        signatario: null,
        cpf_signatario: null,
        data_assinatura: null,
        autoridade: null,
        motivo_falha: "Arquivo não é um PDF — validação de assinatura GOV.BR só se aplica a PDFs assinados.",
      };
      if (docRow) {
        await admin.from("qa_processo_documentos").update({
          assinatura_status: result.status,
          assinatura_motivo_falha: result.motivo_falha,
          assinatura_validada_em: new Date().toISOString(),
        }).eq("id", docRow.id);
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = validateSignature(buf);

    if (docRow) {
      await admin.from("qa_processo_documentos").update({
        assinatura_status: result.status,
        assinatura_signatario: result.signatario,
        assinatura_cpf: result.cpf_signatario,
        assinatura_data: result.data_assinatura,
        assinatura_autoridade: result.autoridade,
        assinatura_motivo_falha: result.motivo_falha ?? null,
        assinatura_validada_em: new Date().toISOString(),
        assinatura_detalhes_json: result.detalhes ?? null,
      }).eq("id", docRow.id);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-govbr error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
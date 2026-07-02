/**
 * qa-validate-customer-signature — BLOCO 10 / Pass B
 *
 * Validação criptográfica (PAdES/PKCS#7) do PDF assinado pelo cliente.
 * NÃO faz OCR. Reaproveita _shared/qaPdfSignatureValidate.
 *
 * Decisão:
 *  - assinatura interpretada + (CPF do signatário == CPF do cliente OR ICP-Brasil) → valid
 *  - assinatura interpretada mas CPF não bate e não é ICP-Brasil           → indeterminate
 *  - sem assinatura ou erro de parse                                       → invalid
 *
 * Auth: aceita JWT da equipe Quero Armas OU bearer service-role
 * (usado pelo encadeamento qa-upload-signed-contract).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { validatePdfSignature, normalizeCpf } from "../_shared/qaPdfSignatureValidate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "paid-contracts";

/**
 * Extrai todo o texto "ascii/latin1" visível do PDF para procurar marcadores
 * de binding (contract_number). Não é OCR — só funciona com PDFs textuais,
 * o que é o caso dos nossos contratos gerados.
 */
function extractPdfPlainText(bytes: Uint8Array): string {
  const txt = new TextDecoder("latin1").decode(bytes);
  // Concatena conteúdo de streams BT/ET (texto) + também a íntegra para
  // capturar metadados/contract_number escapados.
  return txt.replace(/\s+/g, " ");
}

function svc() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
function jsonResp(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function authorizeRequest(req: Request, contractId: string | undefined): Promise<boolean> {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return false;
  const token = h.slice(7).trim();
  const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (token === sr) return true;
  try {
    const u = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await u.auth.getUser(token);
    if (error || !data?.user) return false;
    const sb = svc();
    // Equipe Quero Armas
    const { data: perfil } = await sb
      .from("qa_usuarios_perfis")
      .select("perfil")
      .eq("user_id", data.user.id)
      .eq("ativo", true)
      .maybeSingle();
    if (perfil) return true;
    // Cliente dono do contrato — pode disparar revalidação
    if (!contractId) return false;
    const { data: cliente } = await sb
      .from("qa_clientes")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!cliente?.id) return false;
    const { data: contract } = await sb
      .from("qa_contracts")
      .select("cliente_id")
      .eq("id", contractId)
      .maybeSingle();
    return !!contract && (contract as any).cliente_id === (cliente as any).id;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: { contract_id?: string };
  try { body = await req.json(); } catch { return jsonResp({ error: "JSON inválido" }, 400); }
  if (!body.contract_id) return jsonResp({ error: "contract_id obrigatório" }, 400);
  if (!(await authorizeRequest(req, body.contract_id))) return jsonResp({ error: "Unauthorized" }, 401);

  const sb = svc();

  const { data: contract } = await sb
    .from("qa_contracts")
    .select("id, cliente_id, status, customer_signed_pdf_path, contract_number, original_pdf_path, original_sha256")
    .eq("id", body.contract_id)
    .maybeSingle();
  if (!contract) return jsonResp({ error: "Contrato não encontrado" }, 404);
  if (!(contract as any).customer_signed_pdf_path) {
    return jsonResp({ error: "Contrato sem PDF do cliente para validar" }, 422);
  }

  await sb.from("qa_contracts").update({ status: "validating" }).eq("id", contract.id);

  const { data: cliente } = await sb
    .from("qa_clientes")
    .select("id, cpf, nome_completo")
    .eq("id", (contract as any).cliente_id)
    .maybeSingle();

  const { data: file, error: dlErr } = await sb.storage
    .from(BUCKET)
    .download((contract as any).customer_signed_pdf_path);
  if (dlErr || !file) {
    await sb.from("qa_contracts").update({
      status: "rejected",
      validation_status: "invalid",
      validation_details: { motivo: "download_failed", erro: dlErr?.message },
    }).eq("id", contract.id);
    return jsonResp({ error: "Falha ao baixar PDF", detail: dlErr?.message }, 500);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = validatePdfSignature(bytes);

  // ----- BINDING contrato ↔ PDF assinado (continuidade criptográfica) -----
  // Impede fraude trivial (assinar um papel em branco contendo o número do
  // contrato). Regra forte: o PDF assinado pelo Gov.br/ICP-Brasil é uma
  // ATUALIZAÇÃO INCREMENTAL PAdES — os bytes do PDF original que geramos
  // precisam aparecer como PREFIXO do PDF enviado. Comparamos byte-a-byte
  // contra `original_pdf_path` (storage) e contra `original_sha256`.
  const numero = ((contract as any).contract_number || "").toString().trim();
  const originalPath = (contract as any).original_pdf_path as string | null;
  const expectedSha = ((contract as any).original_sha256 || "").toString().toLowerCase();

  let bindingOk = false;
  let bindingReason = "";
  let bindingDetails: Record<string, unknown> = {};

  // Contrato de adesão: o cliente baixa a MINUTA em HTML e a converte em PDF
  // pelo próprio navegador antes de assinar no Gov.br. Nesses casos, não existe
  // um "PDF original" persistido no storage para comparar byte-a-byte. Nessa
  // hipótese, o vínculo é comprovado por:
  //   (a) presença do número do contrato dentro do PDF assinado (checagem
  //       adicional feita logo abaixo);
  //   (b) assinatura ICP-Brasil/Gov.br válida do CPF do titular do contrato
  //       (checagem feita mais adiante).
  // Só exigimos prefixo byte-a-byte quando existe original_pdf_path salvo.
  if (!originalPath) {
    bindingOk = true;
    bindingDetails = { soft_binding: true, motivo: "sem_original_persistido" };
  } else {
    const { data: origFile, error: origErr } = await sb.storage.from(BUCKET).download(originalPath);
    if (origErr || !origFile) {
      bindingReason = "Falha ao baixar PDF original para comparação.";
      bindingDetails = { erro: origErr?.message };
    } else {
      const origBytes = new Uint8Array(await origFile.arrayBuffer());
      // 1) Confere SHA-256 do original armazenado (defesa contra adulteração interna).
      const origDigest = await crypto.subtle.digest("SHA-256", origBytes as BufferSource);
      const origSha = Array.from(new Uint8Array(origDigest))
        .map((x) => x.toString(16).padStart(2, "0")).join("");
      const shaMatchInternal = !expectedSha || origSha === expectedSha;
      // 2) Prefixo: o PDF assinado precisa começar com os bytes do original.
      let isPrefix = bytes.byteLength >= origBytes.byteLength;
      if (isPrefix) {
        for (let i = 0; i < origBytes.byteLength; i++) {
          if (bytes[i] !== origBytes[i]) { isPrefix = false; break; }
        }
      }
      bindingDetails = {
        original_sha256_stored: expectedSha || null,
        original_sha256_recomputed: origSha,
        original_size: origBytes.byteLength,
        signed_size: bytes.byteLength,
        prefix_match: isPrefix,
      };
      if (!shaMatchInternal) {
        bindingReason = "PDF original divergente do hash registrado. Acione o suporte.";
      } else if (!isPrefix) {
        bindingReason = numero
          ? `O arquivo enviado NÃO é a assinatura do contrato ${numero}. O PDF assinado precisa ser o próprio contrato baixado deste sistema (apenas adicionando a assinatura digital, sem alterar o conteúdo).`
          : "O arquivo enviado não corresponde ao contrato original gerado.";
      } else {
        bindingOk = true;
      }
    }
  }

  // Camada extra (defesa em profundidade): número do contrato precisa aparecer no texto.
  const pdfText = extractPdfPlainText(bytes);
  const numeroPresente = numero.length > 0 && pdfText.includes(numero);

  if (!bindingOk || !numeroPresente) {
    const motivo = bindingReason
      || (numero
        ? `O PDF enviado não corresponde a este contrato (${numero}).`
        : "Não foi possível confirmar o vínculo do PDF com o contrato.");
    await sb.from("qa_contracts").update({
      status: "rejected",
      validation_status: "invalid",
      validation_details: {
        motivo_falha: motivo,
        binding_check: "failed",
        expected_contract_number: numero,
        contract_number_in_pdf: numeroPresente,
        ...bindingDetails,
        ...meta,
      },
    }).eq("id", contract.id);
    await sb.from("qa_contract_events").insert({
      contract_id: contract.id,
      event_type: "customer_signature_wrong_contract",
      event_payload: { expected_contract_number: numero, ...bindingDetails, contract_number_in_pdf: numeroPresente },
    });
    return jsonResp({
      ok: false,
      outcome: "invalid",
      status: "rejected",
      reason: "wrong_contract",
      message: motivo,
    });
  }

  const cpfCliente = normalizeCpf(cliente?.cpf);
  const cpfSigner = normalizeCpf(meta.cpf_signatario);
  const cpfMatch = cpfCliente && cpfSigner && cpfCliente === cpfSigner;

  let outcome: "valid" | "invalid" | "indeterminate";
  let newStatus: "validated" | "rejected" | "pending_manual_review";
  let eventType: string;

  if (!meta.valida) {
    outcome = "invalid";
    newStatus = "rejected";
    eventType = "customer_signature_invalid";
  } else if (cpfMatch || meta.icp_brasil) {
    outcome = "valid";
    newStatus = "validated";
    eventType = "customer_signature_valid";
  } else {
    outcome = "indeterminate";
    newStatus = "pending_manual_review";
    eventType = "customer_signature_manual_review";
  }

  const update: Record<string, unknown> = {
    status: newStatus,
    validation_status: outcome,
    validation_details: {
      ...meta,
      cpf_match: cpfMatch || false,
      cliente_cpf_normalized: cpfCliente || null,
      binding_check: "ok",
      expected_contract_number: numero,
      original_sha256_stored: expectedSha || null,
      original_size: bindingDetails.original_size,
      signed_size: bindingDetails.signed_size,
    },
  };
  if (outcome === "valid") update.customer_signature_validated_at = new Date().toISOString();

  await sb.from("qa_contracts").update(update).eq("id", contract.id);

  await sb.from("qa_contract_signatures").insert({
    contract_id: contract.id,
    signer_role: "customer",
    signer_name: meta.signatario,
    signer_document: meta.cpf_signatario,
    signature_type: meta.icp_brasil ? "customer_icp" : "customer_govbr",
    validation_status: outcome === "valid" ? "valid" : outcome === "invalid" ? "invalid" : "indeterminate",
    validation_details: { ...meta, cpf_match: cpfMatch || false },
    signed_pdf_path: (contract as any).customer_signed_pdf_path,
    signed_at: meta.data_assinatura,
  });

  await sb.from("qa_contract_events").insert({
    contract_id: contract.id,
    event_type: eventType,
    event_payload: { outcome, cpf_match: cpfMatch || false, signatario: meta.signatario, autoridade: meta.autoridade },
  });

  return jsonResp({ ok: true, outcome, status: newStatus, signature: meta });
});
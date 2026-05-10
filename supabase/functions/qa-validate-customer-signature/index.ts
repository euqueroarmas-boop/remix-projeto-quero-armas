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
import { validatePdfSignature, normalizeCpf } from "../_shared/qaPdfSignatureValidate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "paid-contracts";

function svc() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
function jsonResp(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function isAuthorized(req: Request): Promise<boolean> {
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
    const { data: perfil } = await sb
      .from("qa_usuarios_perfis")
      .select("perfil")
      .eq("user_id", data.user.id)
      .eq("ativo", true)
      .maybeSingle();
    return !!perfil;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!(await isAuthorized(req))) return jsonResp({ error: "Unauthorized" }, 401);

  let body: { contract_id?: string };
  try { body = await req.json(); } catch { return jsonResp({ error: "JSON inválido" }, 400); }
  if (!body.contract_id) return jsonResp({ error: "contract_id obrigatório" }, 400);

  const sb = svc();

  const { data: contract } = await sb
    .from("qa_contracts")
    .select("id, cliente_id, status, customer_signed_pdf_path")
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
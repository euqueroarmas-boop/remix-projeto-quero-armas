// PR3 — Persistência dos documentos enviados no cadastro refinado
// (identidade + comprovante de residência) no painel da equipe.
//
// Estratégia (Zero Regression):
//  • Upsert idempotente por CPF na tabela `qa_cadastro_publico` (mesma área
//    já usada hoje pelo painel `/clientes` para mostrar identidade/endereço).
//  • Atualiza apenas os caminhos de storage e dados mínimos do titular.
//  • Não cria cliente, venda, contrato, Auth, selfie, Arsenal ou Asaas.
//  • Não sobrescreve documento existente se o cliente não enviou um novo
//    naquele campo (apenas grava o que veio do state.documentos).
//  • Vincula `cliente_id_vinculado` ao qa_cliente_id quando disponível.
//  • Best-effort: falha silenciosa não pode bloquear o checkout.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type DocItem = { storagePath?: string | null; fileName?: string | null; status?: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }

  const qaClienteIdRaw = body?.qa_cliente_id;
  const qaClienteId =
    qaClienteIdRaw == null ? null :
    typeof qaClienteIdRaw === "number" ? qaClienteIdRaw :
    /^\d+$/.test(String(qaClienteIdRaw)) ? Number(qaClienteIdRaw) : null;

  const d = body?.dados_pessoais || {};
  const docs: Record<string, DocItem> = body?.documentos || {};
  const servicoSlug: string | null = body?.servico_slug || null;
  const origem: string = body?.origem || "cadastro_refinado";

  const docIdentidade = docs?.doc_identidade?.storagePath || null;
  const docEndereco = docs?.doc_endereco?.storagePath || null;

  // Nada para persistir — não é erro, apenas no-op.
  if (!docIdentidade && !docEndereco) {
    return json({ ok: true, skipped: "no_docs" });
  }

  const cpfDigits = String(d?.cpf || "").replace(/\D/g, "");
  if (cpfDigits.length !== 11) {
    return json({ ok: false, error: "cpf_invalido" }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Procura cadastro existente — primeiro por cliente vinculado, depois por CPF
  let existing: { id: string; documento_identidade_path: string | null; comprovante_endereco_path: string | null } | null = null;

  if (qaClienteId) {
    const { data: byCliente } = await admin
      .from("qa_cadastro_publico")
      .select("id, documento_identidade_path, comprovante_endereco_path, created_at")
      .eq("cliente_id_vinculado", qaClienteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byCliente) existing = byCliente as any;
  }

  if (!existing) {
    const { data: byCpf } = await admin
      .from("qa_cadastro_publico")
      .select("id, documento_identidade_path, comprovante_endereco_path, created_at")
      .eq("cpf", cpfDigits)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byCpf) existing = byCpf as any;
  }

  // Monta patch apenas com os campos enviados (não sobrescreve com null).
  const patch: Record<string, any> = {};
  if (docIdentidade) patch.documento_identidade_path = docIdentidade;
  if (docEndereco) patch.comprovante_endereco_path = docEndereco;
  if (qaClienteId) patch.cliente_id_vinculado = qaClienteId;

  if (existing) {
    const { error } = await admin
      .from("qa_cadastro_publico")
      .update(patch)
      .eq("id", existing.id);
    if (error) {
      console.error("[qa-cadastro-refinado-persistir-docs] update error:", error);
      return json({ ok: false, error: "update_failed", detail: error.message }, 500);
    }
    return json({ ok: true, cadastro_id: existing.id, action: "updated" });
  }

  // 2) Insert mínimo
  const insertRow: Record<string, any> = {
    nome_completo: String(d?.nome_completo || "").trim() || "—",
    cpf: cpfDigits,
    telefone_principal: String(d?.telefone || "").replace(/\D/g, "") || cpfDigits,
    email: String(d?.email || "").trim().toLowerCase() || `${cpfDigits}@quero-armas.local`,
    data_nascimento: d?.data_nascimento || null,
    end1_cep: String(d?.endereco_cep || "").replace(/\D/g, "") || null,
    end1_logradouro: d?.endereco_logradouro || null,
    end1_numero: d?.endereco_numero || null,
    end1_complemento: d?.endereco_complemento || null,
    end1_bairro: d?.endereco_bairro || null,
    end1_cidade: d?.endereco_cidade || null,
    end1_estado: (d?.endereco_estado || "").slice(0, 2).toUpperCase() || null,
    documento_identidade_path: docIdentidade,
    comprovante_endereco_path: docEndereco,
    cliente_id_vinculado: qaClienteId,
    servico_interesse: servicoSlug,
    origem_cadastro: origem,
    status: "pendente",
  };

  const { data: inserted, error: insErr } = await admin
    .from("qa_cadastro_publico")
    .insert(insertRow)
    .select("id")
    .single();

  if (insErr) {
    console.error("[qa-cadastro-refinado-persistir-docs] insert error:", insErr);
    return json({ ok: false, error: "insert_failed", detail: insErr.message }, 500);
  }

  return json({ ok: true, cadastro_id: inserted.id, action: "inserted" });
});
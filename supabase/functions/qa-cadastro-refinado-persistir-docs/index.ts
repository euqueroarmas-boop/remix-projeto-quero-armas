// PR3 — Persistência dos documentos enviados no cadastro refinado
// (identidade + comprovante de residência) no painel da equipe.
//
// Estratégia (Zero Regression):
//  • Upsert idempotente por CPF na tabela `qa_cadastro_publico` (painel
//    /clientes — área de cadastros públicos).
//  • REAPROVEITA os mesmos arquivos no portal do cliente:
//      - INSERT em `qa_documentos_cliente` (origem='cliente',
//        status='pendente_aprovacao') para cada doc enviado, evitando
//        duplicidade pelo arquivo_storage_path.
//      - UPDATE em `qa_clientes` preenchendo SOMENTE campos vazios com os
//        dados extraídos pela IA (nunca sobrescreve digitação existente).
//  • Não cria cliente, venda, contrato, Auth, selfie, Arsenal ou Asaas.
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
    await propagarParaPortal(admin, qaClienteId, d, docs).catch((e) =>
      console.warn("[qa-cadastro-refinado-persistir-docs] propagar portal falhou (best-effort):", e?.message),
    );
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

  // 3) Propaga para o portal do cliente (qa_clientes + qa_documentos_cliente)
  await propagarParaPortal(admin, qaClienteId, d, docs).catch((e) =>
    console.warn("[qa-cadastro-refinado-persistir-docs] propagar portal falhou (best-effort):", e?.message),
  );

  return json({ ok: true, cadastro_id: inserted.id, action: "inserted" });
});

/**
 * Espelha os dados/documentos enviados no checkout para o cadastro
 * operacional do cliente (portal). Best-effort, sem erro fatal.
 *  - qa_clientes: COALESCE — só grava onde está NULL/''.
 *  - qa_documentos_cliente: insere com status=pendente_aprovacao,
 *    origem=cliente, ignora se já existe um registro com mesmo
 *    arquivo_storage_path (idempotência por upload).
 */
async function propagarParaPortal(
  admin: ReturnType<typeof createClient>,
  qaClienteId: number | null,
  dados: any,
  docs: Record<string, DocItem>,
) {
  if (!qaClienteId) return;

  // -------- 1) qa_clientes: preenche somente campos vazios --------
  const { data: cli } = await admin
    .from("qa_clientes")
    .select(
      "id_legado, nome_completo, cpf, data_nascimento, celular, email, endereco, numero, complemento, bairro, cidade, estado, cep",
    )
    .eq("id_legado", qaClienteId)
    .maybeSingle();

  if (cli) {
    const isEmpty = (v: any) => v == null || String(v).trim() === "";
    const onlyDigits = (v: any) => String(v ?? "").replace(/\D/g, "");
    const norm = (v: any) => (v == null ? null : String(v).trim() || null);

    const cliPatch: Record<string, any> = {};
    if (isEmpty((cli as any).nome_completo) && !isEmpty(dados?.nome_completo)) cliPatch.nome_completo = String(dados.nome_completo).trim();
    if (isEmpty((cli as any).cpf) && onlyDigits(dados?.cpf).length === 11) cliPatch.cpf = onlyDigits(dados.cpf);
    if (isEmpty((cli as any).data_nascimento) && !isEmpty(dados?.data_nascimento)) cliPatch.data_nascimento = dados.data_nascimento;
    if (isEmpty((cli as any).celular) && !isEmpty(dados?.telefone)) cliPatch.celular = onlyDigits(dados.telefone);
    if (isEmpty((cli as any).email) && !isEmpty(dados?.email)) cliPatch.email = String(dados.email).trim().toLowerCase();
    if (isEmpty((cli as any).cep) && !isEmpty(dados?.endereco_cep)) cliPatch.cep = onlyDigits(dados.endereco_cep);
    if (isEmpty((cli as any).endereco) && !isEmpty(dados?.endereco_logradouro)) cliPatch.endereco = norm(dados.endereco_logradouro);
    if (isEmpty((cli as any).numero) && !isEmpty(dados?.endereco_numero)) cliPatch.numero = norm(dados.endereco_numero);
    if (isEmpty((cli as any).complemento) && !isEmpty(dados?.endereco_complemento)) cliPatch.complemento = norm(dados.endereco_complemento);
    if (isEmpty((cli as any).bairro) && !isEmpty(dados?.endereco_bairro)) cliPatch.bairro = norm(dados.endereco_bairro);
    if (isEmpty((cli as any).cidade) && !isEmpty(dados?.endereco_cidade)) cliPatch.cidade = norm(dados.endereco_cidade);
    if (isEmpty((cli as any).estado) && !isEmpty(dados?.endereco_estado)) cliPatch.estado = String(dados.endereco_estado).toUpperCase().slice(0, 2);

    if (Object.keys(cliPatch).length > 0) {
      const { error: upCliErr } = await admin
        .from("qa_clientes")
        .update(cliPatch)
        .eq("id_legado", qaClienteId);
      if (upCliErr) console.warn("[propagarParaPortal] qa_clientes update warn:", upCliErr.message);
    }
  }

  // -------- 2) qa_documentos_cliente: insert idempotente --------
  const docsParaInserir: Array<{ tipo: string; item: DocItem }> = [];
  if (docs?.doc_identidade?.storagePath) docsParaInserir.push({ tipo: "RG", item: docs.doc_identidade });
  if (docs?.doc_endereco?.storagePath) docsParaInserir.push({ tipo: "COMPROVANTE_RESIDENCIA", item: docs.doc_endereco });

  for (const d of docsParaInserir) {
    const path = d.item.storagePath!;
    const { data: ja } = await admin
      .from("qa_documentos_cliente")
      .select("id")
      .eq("qa_cliente_id", qaClienteId)
      .eq("arquivo_storage_path", path)
      .maybeSingle();
    if (ja) continue;

    const { error: insDocErr } = await admin.from("qa_documentos_cliente").insert({
      qa_cliente_id: qaClienteId,
      tipo_documento: d.tipo,
      arquivo_storage_path: path,
      arquivo_nome: d.item.fileName || null,
      arquivo_mime: null,
      status: "pendente_aprovacao",
      origem: "cliente",
    });
    if (insDocErr) {
      console.warn(
        "[propagarParaPortal] qa_documentos_cliente insert warn:",
        insDocErr.message,
        { tipo: d.tipo, path },
      );
    }
  }
}
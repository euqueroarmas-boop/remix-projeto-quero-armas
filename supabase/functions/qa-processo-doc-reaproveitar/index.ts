// ============================================================================
// qa-processo-doc-reaproveitar  (Bloco 12)
// ----------------------------------------------------------------------------
// Marca um documento de DESTINO como `dispensado_por_reaproveitamento`
// quando o cliente confirma reuso de um documento de ORIGEM já aprovado/
// validado do mesmo cliente. Validações:
//   1) Usuário autenticado é dono do cliente.
//   2) Origem e destino pertencem ao mesmo cliente.
//   3) Origem está em status `aprovado` ou `validado`.
//   4) `tipo_documento` igual (case-insensitive) e não vazio.
//   5) Escopo igual (espelho de getDocumentoEscopo do front).
//   6) Escopo "processo" NUNCA reaproveita.
//   7) Escopo "arma" exige vínculo inequívoco com a arma.
//   8) Escopo "cac_atividade" só reaproveita quando a matriz do serviço
//      marcar o tipo como automático.
//   8) Origem não vencida (data_validade_efetiva || data_validade).
// Em sucesso: atualiza destino e registra evento auditável.
// Não altera RLS, nem outros documentos, nem qa_clientes.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* --------------------- ESPELHO de documentoEscopo.ts ---------------------- */
const TIPOS_CLIENTE = new Set<string>([
  "rg", "cnh", "cin", "cpf", "foto", "foto_3x4",
  "comprovante_endereco",
  "certidao_antecedentes", "antecedentes_criminais",
  "antecedentes_federal", "antecedentes_estadual",
  "antecedentes_militar", "antecedentes_eleitoral",
  "certidao_antecedentes_policia_civil_sp", "certidao_crimes_eleitorais_tse",
  "certidao_crimes_militares_stm", "certidao_criminal_tjmsp",
  "certidao_federal_trf3_regional", "certidao_federal_trf3_sjsp_jef",
  "certidao_tjsp_distribuicao_criminal", "certidao_tjsp_execucoes_criminais",
  "certidao_casamento", "certidao_nascimento", "certidao_alteracao_nome",
]);
const TIPOS_CAC_ATIVIDADE = new Set<string>([
  "comprovante_habitualidade",
  "comprovante_clube_tiro",
  "comprovante_competicao",
  "declaracao_guarda_acervo_1endereco",
  "declaracao_guarda_acervo_2enderecos",
]);
const ETAPAS_PERMANENTES = new Set<string>([
  "identificacao", "endereco", "antecedentes", "declaracoes_gerais",
]);
function isDocDeArma(tipo: string): boolean {
  const t = String(tipo || "").toLowerCase();
  if (!t) return false;
  if (["craf", "craf_renovacao", "nota_fiscal_arma", "autorizacao_compra_arma",
    "gte", "gte_transporte", "registro_arma"].includes(t)) return true;
  return /^(craf|gte|nota_fiscal_arma|registro_arma|autorizacao_compra_arma)(_|$)/.test(t);
}
type Escopo = "cliente" | "arma" | "cac_atividade" | "processo";
type OrigemTipo = "processo" | "hub_cliente";
function getEscopo(doc: { tipo_documento?: string | null; etapa?: string | null; arma_id?: string | null }): Escopo {
  const tipo = String(doc?.tipo_documento ?? "").trim().toLowerCase();
  const armaId = doc?.arma_id ? String(doc.arma_id).trim() : "";
  if (armaId || isDocDeArma(tipo)) return "arma";
  if (tipo && TIPOS_CLIENTE.has(tipo)) return "cliente";
  if (tipo && TIPOS_CAC_ATIVIDADE.has(tipo)) return "cac_atividade";
  if (doc?.etapa && ETAPAS_PERMANENTES.has(String(doc.etapa))) return "cliente";
  return "processo";
}

function vencido(data?: string | null): boolean {
  if (!data) return false;
  const t = new Date(data).getTime();
  return !isNaN(t) && t < Date.now();
}

function vencidoPorJanela(dataBase?: string | null, validadeDias?: number | null): boolean {
  if (!dataBase || !validadeDias || validadeDias <= 0) return false;
  const dt = new Date(dataBase);
  if (Number.isNaN(dt.getTime())) return false;
  dt.setDate(dt.getDate() + validadeDias);
  return dt.getTime() < Date.now();
}

function documentoForaDaRegra(params: {
  dataValidadeEfetiva?: string | null;
  dataValidade?: string | null;
  dataEmissao?: string | null;
  dataValidacao?: string | null;
  validadeDiasRegra?: number | null;
  validadeDiasDocumento?: number | null;
}): boolean {
  if (vencido(params.dataValidadeEfetiva ?? params.dataValidade ?? null)) return true;
  const janela = params.validadeDiasRegra ?? params.validadeDiasDocumento ?? null;
  if (!janela) return false;
  const base = params.dataValidacao ?? params.dataEmissao ?? null;
  return vencidoPorJanela(base, janela);
}

function norm(v?: string | null): string {
  return String(v ?? "").replace(/\s+/g, "").trim().toUpperCase();
}

function tipoCompatKey(tipo?: string | null): string {
  const t = String(tipo ?? "").trim().toLowerCase();
  if (!t) return "";
  if (t === "rg") return "rg_com_cpf";
  if (t === "foto") return "foto_3x4";
  if (t.startsWith("comprovante_endereco") || t.startsWith("comprovante_residencia")) {
    return "comprovante_residencia";
  }
  if (t === "certidao_antecedentes_policia_civil_sp") return "antecedentes_criminais";
  if (t === "certidao_crimes_eleitorais_tse") return "antecedentes_eleitoral";
  if (t === "certidao_crimes_militares_stm" || t === "certidao_criminal_tjmsp") return "antecedentes_militar";
  if (t === "certidao_federal_trf3_regional" || t === "certidao_federal_trf3_sjsp_jef") return "antecedentes_federal";
  if (t === "certidao_tjsp_distribuicao_criminal" || t === "certidao_tjsp_execucoes_criminais") return "antecedentes_estadual";
  return t;
}

function normTexto(v?: string | null): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function certidaoMilitarCompativel(destinoTipo: string, origemTexto: string): boolean {
  const destino = String(destinoTipo ?? "").trim().toLowerCase();
  if (destino !== "certidao_criminal_tjmsp" && destino !== "certidao_crimes_militares_stm") return true;
  const texto = normTexto(origemTexto);
  if (destino === "certidao_criminal_tjmsp") {
    return texto.includes("TJM") || texto.includes("JUSTICA MILITAR/SP") || texto.includes("JUSTICA MILITAR DO ESTADO DE SAO PAULO");
  }
  return texto.includes("STM") || texto.includes("JUSTICA MILITAR DA UNIAO") || texto.includes("SUPERIOR TRIBUNAL MILITAR");
}

function escopoHubParaEscopoDocumento(escopo?: string | null): Escopo | null {
  switch (String(escopo ?? "").trim().toLowerCase()) {
    case "permanente":
      return "cliente";
    case "arma":
      return "arma";
    case "cac_atividade":
      return "cac_atividade";
    case "processo":
      return "processo";
    default:
      return null;
  }
}

async function carregarRegraReaproveitamentoServico(
  admin: ReturnType<typeof createClient>,
  servicoId: number | null | undefined,
  tipoDestino: string,
  tipoCompat: string,
) {
  if (!servicoId) return { regra: null, error: null };
  const tipos = Array.from(new Set([tipoDestino, tipoCompat].filter(Boolean)));
  const { data, error } = await admin
    .from("qa_tipos_documento_servicos")
    .select("tipo_documento, modo_reaproveitamento, validade_dias")
    .eq("servico_id", servicoId)
    .in("tipo_documento", tipos)
    .limit(5);
  if (error) return { regra: null, error };
  const lista = (data ?? []) as Array<{
    tipo_documento: string;
    modo_reaproveitamento: string | null;
    validade_dias: number | null;
  }>;
  return {
    error: null,
    regra:
      lista.find((item) => String(item.tipo_documento).toLowerCase() === String(tipoDestino).toLowerCase()) ??
      lista.find((item) => String(item.tipo_documento).toLowerCase() === tipoCompat) ??
      null,
  };
}

function docHubCasaComDestinoArma(
  origem: {
    arma_numero_serie?: string | null;
    numero_documento?: string | null;
    numero_cad_sinarm?: string | null;
    numero_registro_sigma?: string | null;
  },
  destino: {
    arma_numero_serie?: string | null;
    numero_craf?: string | null;
    numero_sinarm?: string | null;
    numero_sigma?: string | null;
  } | null,
): boolean {
  if (!destino) return false;
  const serialDoc = norm(origem.arma_numero_serie);
  const numeroDoc = norm(origem.numero_documento);
  const cadSinarmDoc = norm(origem.numero_cad_sinarm);
  const sigmaDoc = norm(origem.numero_registro_sigma);
  const serialDestino = norm(destino.arma_numero_serie);
  const crafDestino = norm(destino.numero_craf);
  const sinarmDestino = norm(destino.numero_sinarm);
  const sigmaDestino = norm(destino.numero_sigma);
  return Boolean(
    (serialDoc && serialDestino && serialDoc === serialDestino) ||
      (numeroDoc && crafDestino && numeroDoc === crafDestino) ||
      (cadSinarmDoc && sinarmDestino && cadSinarmDoc === sinarmDestino) ||
      (sigmaDoc && sigmaDestino && sigmaDoc === sigmaDestino),
  );
}

const STATUS_ORIGEM_OK = new Set(["aprovado", "validado"]);
const STATUS_DESTINO_BLOQUEIA = new Set([
  "aprovado", "validado", "dispensado_por_reaproveitamento",
  "dispensado_grupo", "em_revisao_humana", "revisao_humana",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.slice(7).trim();

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "invalid_token" }, 401);
    const authUserId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const destinoId = String(body?.destino_documento_id ?? "").trim();
    const origemId = String(body?.origem_documento_id ?? "").trim();
    const origemTipo = String(body?.origem_tipo ?? "processo").trim().toLowerCase() as OrigemTipo;
    if (!destinoId || !origemId) return json({ error: "documento_id_required" }, 400);
    if (destinoId === origemId) return json({ error: "mesmo_documento" }, 400);
    if (!["processo", "hub_cliente"].includes(origemTipo)) {
      return json({ error: "origem_tipo_invalido" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [{ data: destino, error: dErr }, { data: origemProcesso, error: oErrProcesso }, { data: origemHub, error: oErrHub }] = await Promise.all([
      admin.from("qa_processo_documentos")
        .select("id, processo_id, cliente_id, tipo_documento, nome_documento, etapa, status, arma_id, metadados_documento_json")
        .eq("id", destinoId).maybeSingle(),
      admin.from("qa_processo_documentos")
        .select("id, processo_id, cliente_id, tipo_documento, etapa, status, arma_id, arquivo_storage_key, data_validade, data_validade_efetiva, data_emissao, data_validacao, validade_dias")
        .eq("id", origemTipo === "processo" ? origemId : "__skip__").maybeSingle(),
      admin.from("qa_documentos_cliente")
        .select("id, qa_cliente_id, tipo_documento, status, arquivo_nome, arquivo_storage_path, data_validade, data_emissao, escopo_documental, reaproveitavel_global, ia_dados_extraidos, arma_numero_serie, numero_documento, numero_cad_sinarm, numero_registro_sigma")
        .eq("id", origemTipo === "hub_cliente" ? origemId : "__skip__").maybeSingle(),
    ]);
    if (dErr) return json({ error: dErr.message }, 500);
    if (oErrProcesso) return json({ error: oErrProcesso.message }, 500);
    if (oErrHub) return json({ error: oErrHub.message }, 500);
    if (!destino) return json({ error: "destino_not_found" }, 404);

    const origem = origemTipo === "hub_cliente" ? origemHub : origemProcesso;
    if (!origem) return json({ error: "origem_not_found" }, 404);

    const origemClienteId =
      origemTipo === "hub_cliente"
        ? origem.qa_cliente_id
        : origem.cliente_id;
    if (destino.cliente_id !== origemClienteId) {
      return json({ error: "cliente_diferente" }, 403);
    }

    // Dono
    const { data: cliente } = await admin
      .from("qa_clientes")
      .select("id, user_id, excluido")
      .eq("id", destino.cliente_id)
      .maybeSingle();
    if (!cliente || cliente.user_id !== authUserId) return json({ error: "forbidden" }, 403);
    if (cliente.excluido) return json({ error: "cliente_excluido" }, 403);

    // Estado do destino — não sobrescreve aprovação/análise humana.
    const stDestino = String(destino.status || "").toLowerCase();
    if (STATUS_DESTINO_BLOQUEIA.has(stDestino)) {
      return json({ error: "destino_nao_acionavel", status: stDestino }, 409);
    }

    // Origem aprovada/validada e não vencida.
    const stOrigem = String(origem.status || "").toLowerCase();
    if (!STATUS_ORIGEM_OK.has(stOrigem)) {
      return json({ error: "origem_invalida", status: stOrigem }, 409);
    }
    // Compatibilidade canônica.
    const tipoO = tipoCompatKey(origem.tipo_documento);
    const tipoD = tipoCompatKey(destino.tipo_documento);
    if (!tipoO || !tipoD || tipoO !== tipoD) {
      return json({ error: "tipo_incompativel", origem: tipoO, destino: tipoD }, 409);
    }
    if (tipoD === "antecedentes_militar") {
      const origemTexto = origemTipo === "hub_cliente"
        ? `${origem.arquivo_nome ?? ""} ${JSON.stringify(origem.ia_dados_extraidos ?? {})}`
        : `${origem.tipo_documento ?? ""}`;
      if (!certidaoMilitarCompativel(String(destino.tipo_documento ?? ""), origemTexto)) {
        return json({ error: "subtipo_certidao_incompativel" }, 409);
      }
    }
    const { data: processoDestino, error: processoDestinoErr } = await admin
      .from("qa_processos")
      .select("servico_id")
      .eq("id", destino.processo_id)
      .maybeSingle();
    if (processoDestinoErr) return json({ error: processoDestinoErr.message }, 500);
    const regraResp = await carregarRegraReaproveitamentoServico(
      admin,
      processoDestino?.servico_id ?? null,
      String(destino.tipo_documento ?? "").trim().toLowerCase(),
      tipoD,
    );
    if (regraResp.error) return json({ error: regraResp.error.message }, 500);
    if (
      regraResp.regra &&
      String(regraResp.regra.modo_reaproveitamento ?? "").toLowerCase() !== "automatico"
    ) {
      return json({ error: "reaproveitamento_assistido" }, 409);
    }
    if (
      documentoForaDaRegra({
        dataValidadeEfetiva:
          origemTipo === "processo" ? origem.data_validade_efetiva ?? null : null,
        dataValidade: origem.data_validade ?? null,
        dataEmissao: origem.data_emissao ?? null,
        dataValidacao:
          origemTipo === "processo" ? origem.data_validacao ?? null : null,
        validadeDiasRegra: regraResp.regra?.validade_dias ?? null,
        validadeDiasDocumento:
          origemTipo === "processo" ? origem.validade_dias ?? null : null,
      })
    ) {
      return json({ error: "origem_vencida" }, 409);
    }
    const escopoO =
      origemTipo === "hub_cliente"
        ? escopoHubParaEscopoDocumento(origem.escopo_documental)
        : getEscopo(origem);
    const escopoD = getEscopo(destino);
    if (!escopoO) return json({ error: "escopo_origem_indefinido" }, 409);
    if (escopoO !== escopoD) return json({ error: "escopo_incompativel" }, 409);
    if (escopoD === "processo") return json({ error: "escopo_processo_nao_reaproveita" }, 409);
    if (origemTipo === "hub_cliente" && origem.reaproveitavel_global === false) {
      return json({ error: "origem_nao_reaproveitavel" }, 409);
    }
    if (escopoD === "arma" && origemTipo === "processo") {
      const aO = origem.arma_id ? String(origem.arma_id).trim() : "";
      const aD = destino.arma_id ? String(destino.arma_id).trim() : "";
      if (!aO || !aD || aO !== aD) return json({ error: "arma_diferente" }, 409);
    }
    if (escopoD === "arma" && origemTipo === "hub_cliente") {
      const { data: armaDestino, error: armaErr } = await admin
        .from("qa_cliente_armas")
        .select("arma_uid, numero_serie, numero_craf, numero_sigma, numero_sinarm")
        .eq("qa_cliente_id", destino.cliente_id)
        .eq("arma_uid", destino.arma_id)
        .maybeSingle();
      if (armaErr) return json({ error: armaErr.message }, 500);
      if (!docHubCasaComDestinoArma(origem, armaDestino)) {
        return json({ error: "arma_diferente" }, 409);
      }
    }

    const nowIso = new Date().toISOString();
    const meta = (destino.metadados_documento_json && typeof destino.metadados_documento_json === "object")
      ? { ...(destino.metadados_documento_json as Record<string, any>) }
      : {};
    meta.reaproveitamento = {
      documento_reaproveitado_id: origem.id,
      processo_origem_id: origemTipo === "processo" ? origem.processo_id : null,
      origem_tipo: origemTipo,
      reaproveitado_em: nowIso,
      escopo: escopoD,
    };

    const update: Record<string, any> = {
      status: "dispensado_por_reaproveitamento",
      motivo_rejeicao: null,
      validacao_ia_status: "dispensado_por_reaproveitamento",
      metadados_documento_json: meta,
      data_validacao: nowIso,
    };

    const { error: upErr } = await admin
      .from("qa_processo_documentos")
      .update(update)
      .eq("id", destino.id);
    if (upErr) return json({ error: upErr.message }, 500);

    await admin.from("qa_processo_eventos").insert({
      processo_id: destino.processo_id,
      documento_id: destino.id,
      tipo_evento: "documento_reaproveitado",
      descricao:
        `Documento "${destino.nome_documento ?? tipoD}" reaproveitado de outro documento aprovado do mesmo cliente.`,
      ator: "cliente",
      dados_json: {
        origem_documento_id: origem.id,
        origem_processo_id: origemTipo === "processo" ? origem.processo_id : null,
        origem_tipo: origemTipo,
        escopo: escopoD,
        tipo_documento: tipoD,
        arma_id: destino.arma_id ?? null,
      },
    } as any);

    return json({ success: true, status: update.status });
  } catch (e: any) {
    console.error("[qa-processo-doc-reaproveitar]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});

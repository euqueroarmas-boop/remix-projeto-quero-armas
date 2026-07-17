/* =============================================================================
 * Bloco 12 — Busca de candidatos a reaproveitamento (camada canônica)
 *
 * Camada PURAMENTE ADITIVA. Lê `qa_processo_documentos` do cliente atual
 * (RLS já garante isolamento por cliente_id via qa_processo_doc_cliente_select)
 * e retorna, para um documento de destino, a lista de documentos de origem
 * compatíveis segundo as regras canônicas de `documentoEscopo.ts`.
 *
 * A camada NÃO muta dados. Aplicar o reaproveitamento (marcar o destino
 * como `dispensado_por_reaproveitamento`) é responsabilidade da edge
 * function `qa-processo-doc-reaproveitar`.
 * ============================================================================= */

import { supabase } from "@/integrations/supabase/client";
import {
  podeReaproveitarDocumento,
  motivoReaproveitamentoBloqueado,
  getDocumentoEscopo,
  type EscopoDocumento,
  type DocEscopavel,
} from "./documentoEscopo";

export interface DestinoReaproveitavel extends DocEscopavel {
  id: string;
  processo_id?: string | null;
}

export type OrigemReaproveitamento = "processo" | "hub_cliente";

export interface CandidatoReaproveitamento {
  id: string;
  tipo_documento: string;
  nome_documento: string | null;
  processo_id: string | null;
  processo_servico_nome?: string | null;
  status: string;
  data_envio: string | null;
  data_validade: string | null;
  data_validade_efetiva: string | null;
  arma_id: string | null;
  etapa: string | null;
  arquivo_storage_key: string | null;
  arquivo_bucket: "qa-processo-docs" | "qa-documentos";
  origem: OrigemReaproveitamento;
  escopo: EscopoDocumento;
}

const STATUS_REAPROVEITAVEIS = new Set([
  "aprovado",
  "validado",
  "dispensado_por_reaproveitamento",
]);

function vencido(dataValidade?: string | null): boolean {
  if (!dataValidade) return false;
  const t = new Date(dataValidade).getTime();
  return !isNaN(t) && t < Date.now();
}

function vencidoPorJanela(
  dataBase?: string | null,
  validadeDias?: number | null,
): boolean {
  if (!dataBase || !validadeDias || validadeDias <= 0) return false;
  const dt = new Date(dataBase);
  if (Number.isNaN(dt.getTime())) return false;
  dt.setDate(dt.getDate() + validadeDias);
  return dt.getTime() < Date.now();
}

function documentoForaDaRegra(
  params: {
    dataValidadeEfetiva?: string | null;
    dataValidade?: string | null;
    dataEmissao?: string | null;
    dataValidacao?: string | null;
    validadeDiasRegra?: number | null;
    validadeDiasDocumento?: number | null;
  },
): boolean {
  if (vencido(params.dataValidadeEfetiva ?? params.dataValidade ?? null)) return true;
  const janela = params.validadeDiasRegra ?? params.validadeDiasDocumento ?? null;
  if (!janela) return false;
  const base = params.dataValidacao ?? params.dataEmissao ?? null;
  return vencidoPorJanela(base, janela);
}

export interface BuscarCandidatosOpts {
  /** cliente dono dos documentos (RLS já filtra, mas validamos no client) */
  clienteId: number;
  /** serviço do processo de destino, para consultar a matriz objetiva */
  servicoId?: number | null;
  /** evita propor o próprio doc como candidato a si mesmo */
  excluirIds?: string[];
  /** arma atualmente selecionada no fluxo, para casar docs do hub com segurança */
  armaSelecionada?: {
    arma_uid: string;
    numero_serie?: string | null;
    numero_craf?: string | null;
    numero_sigma?: string | null;
    numero_sinarm?: string | null;
  } | null;
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

function certidaoMilitarCompatível(row: { nome_documento?: string | null }, destinoTipo: string): boolean {
  const destino = String(destinoTipo ?? "").trim().toLowerCase();
  if (destino !== "certidao_criminal_tjmsp" && destino !== "certidao_crimes_militares_stm") return true;
  const texto = normTexto(row.nome_documento);
  if (destino === "certidao_criminal_tjmsp") {
    return texto.includes("TJM") || texto.includes("JUSTICA MILITAR/SP") || texto.includes("JUSTICA MILITAR DO ESTADO DE SAO PAULO");
  }
  return texto.includes("STM") || texto.includes("JUSTICA MILITAR DA UNIAO") || texto.includes("SUPERIOR TRIBUNAL MILITAR");
}

function escopoHubParaEscopoDocumento(escopo?: string | null): EscopoDocumento | null {
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

interface RegraReaproveitamentoServico {
  tipo_documento: string;
  modo_reaproveitamento: string | null;
  validade_dias: number | null;
}

export interface BuscaReaproveitamentoResultado {
  candidatos: CandidatoReaproveitamento[];
  modoReaproveitamento: "automatico" | "assistido" | "desabilitado" | "desconhecido";
  mensagem: string | null;
  validadeDias: number | null;
}

async function carregarRegraReaproveitamentoServico(
  servicoId: number | null | undefined,
  tipoDestino: string,
  tipoCompat: string,
): Promise<RegraReaproveitamentoServico | null> {
  if (!servicoId) return null;
  const tipos = Array.from(
    new Set(
      [String(tipoDestino || "").trim().toLowerCase(), tipoCompat].filter(Boolean),
    ),
  );
  const { data, error } = await supabase
    .from("qa_tipos_documento_servicos" as any)
    .select("tipo_documento, modo_reaproveitamento, validade_dias")
    .eq("servico_id", servicoId)
    .in("tipo_documento", tipos)
    .limit(5);
  if (error) {
    console.warn("[reaproveitamento] regra por serviço indisponível", error);
    return null;
  }
  const lista = (data ?? []) as unknown as RegraReaproveitamentoServico[];
  return (
    lista.find((item) => String(item.tipo_documento).toLowerCase() === String(tipoDestino).toLowerCase()) ??
    lista.find((item) => String(item.tipo_documento).toLowerCase() === tipoCompat) ??
    null
  );
}

function docHubCasaComArma(
  row: {
    arma_numero_serie?: string | null;
    numero_documento?: string | null;
    numero_cad_sinarm?: string | null;
    numero_registro_sigma?: string | null;
  },
  arma?: BuscarCandidatosOpts["armaSelecionada"],
): boolean {
  if (!arma) return false;
  const serialArma = norm(arma.numero_serie);
  const crafArma = norm(arma.numero_craf);
  const sigmaArma = norm(arma.numero_sigma);
  const sinarmArma = norm(arma.numero_sinarm);

  const serialDoc = norm(row.arma_numero_serie);
  const numeroDoc = norm(row.numero_documento);
  const cadSinarmDoc = norm(row.numero_cad_sinarm);
  const sigmaDoc = norm(row.numero_registro_sigma);

  return Boolean(
    (serialDoc && serialArma && serialDoc === serialArma) ||
      (numeroDoc && crafArma && numeroDoc === crafArma) ||
      (cadSinarmDoc && sinarmArma && cadSinarmDoc === sinarmArma) ||
      (sigmaDoc && sigmaArma && sigmaDoc === sigmaArma),
  );
}

/**
 * Lista candidatos a reaproveitar uma exigência. Aplica:
 *   - mesmo `tipo_documento` (case-insensitive)
 *   - status em `STATUS_REAPROVEITAVEIS`
 *   - não vencido (`data_validade_efetiva` ou `data_validade`)
 *   - `podeReaproveitarDocumento(origem, destino)` retorna true
 *
 * Resultado ordenado por: (1) escopo "cliente" antes de "arma",
 * (2) mais recente primeiro, (3) com `arquivo_storage_key` antes de sem.
 */
export async function buscarCandidatosReaproveitamento(
  destino: DestinoReaproveitavel,
  opts: BuscarCandidatosOpts,
): Promise<BuscaReaproveitamentoResultado> {
  const tipo = String(destino?.tipo_documento ?? "").trim().toLowerCase();
  const tipoCompat = tipoCompatKey(tipo);
  if (!tipoCompat) {
    return {
      candidatos: [],
      modoReaproveitamento: "desconhecido",
      mensagem: null,
      validadeDias: null,
    };
  }
  const escopoDestino = getDocumentoEscopo(destino);
  // "processo" nunca reaproveita automaticamente (regra canônica).
  if (escopoDestino === "processo") {
    return {
      candidatos: [],
      modoReaproveitamento: "desabilitado",
      mensagem: null,
      validadeDias: null,
    };
  }

  const regraServico = await carregarRegraReaproveitamentoServico(opts.servicoId, tipo, tipoCompat);
  const modoRegra = String(regraServico?.modo_reaproveitamento ?? "").trim().toLowerCase();
  const modoReaproveitamento: BuscaReaproveitamentoResultado["modoReaproveitamento"] =
    modoRegra === "automatico"
      ? "automatico"
      : modoRegra === "assistido"
        ? "assistido"
        : modoRegra
          ? "desabilitado"
          : "desconhecido";

  const excluir = new Set<string>([destino.id, ...(opts.excluirIds ?? [])]);

  const [processoResp, hubResp] = await Promise.all([
    supabase
      .from("qa_processo_documentos")
      .select(
        "id, processo_id, cliente_id, tipo_documento, nome_documento, etapa, status, arma_id, arquivo_storage_key, data_envio, data_validade, data_validade_efetiva, data_emissao, data_validacao, validade_dias",
      )
      .eq("cliente_id", opts.clienteId)
      .in("status", Array.from(STATUS_REAPROVEITAVEIS)),
    supabase
      .from("qa_documentos_cliente" as any)
      .select(
        "id, qa_cliente_id, tipo_documento, arquivo_nome, arquivo_storage_path, status, data_validade, data_emissao, created_at, escopo_documental, reaproveitavel_global, arma_numero_serie, numero_documento, numero_cad_sinarm, numero_registro_sigma",
      )
      .eq("qa_cliente_id", opts.clienteId)
      .eq("reaproveitavel_global", true)
      .in("status", Array.from(STATUS_REAPROVEITAVEIS)),
  ]);

  if (processoResp.error || hubResp.error) {
    console.warn("[reaproveitamento] busca falhou (silencioso)", processoResp.error ?? hubResp.error);
    return {
      candidatos: [],
      modoReaproveitamento,
      mensagem: null,
      validadeDias: regraServico?.validade_dias ?? null,
    };
  }

  const out: CandidatoReaproveitamento[] = [];
  for (const row of (processoResp.data ?? []) as any[]) {
    if (excluir.has(row.id)) continue;
    if (tipoCompatKey(row.tipo_documento) !== tipoCompat) continue;
    if (!certidaoMilitarCompatível({ nome_documento: row.nome_documento ?? row.tipo_documento }, tipo)) continue;
    if (
      documentoForaDaRegra({
        dataValidadeEfetiva: row.data_validade_efetiva ?? null,
        dataValidade: row.data_validade ?? null,
        dataEmissao: row.data_emissao ?? null,
        dataValidacao: row.data_validacao ?? null,
        validadeDiasRegra: regraServico?.validade_dias ?? null,
        validadeDiasDocumento: row.validade_dias ?? null,
      })
    ) continue;
    const origem: DocEscopavel = {
      tipo_documento: row.tipo_documento,
      etapa: row.etapa,
      arma_id: row.arma_id,
    };
    if (!podeReaproveitarDocumento(origem, destino)) {
      // log interno — não mostrar ao cliente
      const motivo = motivoReaproveitamentoBloqueado(origem, destino);
      if (motivo) console.debug("[reaproveitamento] bloqueado:", row.id, motivo);
      continue;
    }
    out.push({
      id: row.id,
      tipo_documento: row.tipo_documento,
      nome_documento: row.nome_documento ?? null,
      processo_id: row.processo_id,
      status: row.status,
      data_envio: row.data_envio ?? null,
      data_validade: row.data_validade ?? null,
      data_validade_efetiva: row.data_validade_efetiva ?? null,
      arma_id: row.arma_id ?? null,
      etapa: row.etapa ?? null,
      arquivo_storage_key: row.arquivo_storage_key ?? null,
      arquivo_bucket: "qa-processo-docs",
      origem: "processo",
      escopo: getDocumentoEscopo(origem),
    });
  }

  for (const row of (hubResp.data ?? []) as any[]) {
    if (excluir.has(row.id)) continue;
    if (tipoCompatKey(row.tipo_documento) !== tipoCompat) continue;
    if (!certidaoMilitarCompatível({ nome_documento: row.arquivo_nome ?? row.tipo_documento }, tipo)) continue;
    const escopoOrigem = escopoHubParaEscopoDocumento(row.escopo_documental);
    if (!escopoOrigem || escopoOrigem !== escopoDestino) continue;
    if ((escopoOrigem as string) === "processo") continue;
    if (
      documentoForaDaRegra({
        dataValidade: row.data_validade ?? null,
        dataEmissao: row.data_emissao ?? null,
        validadeDiasRegra: regraServico?.validade_dias ?? null,
      })
    ) continue;
    if (escopoOrigem === "arma" && !docHubCasaComArma(row, opts.armaSelecionada)) continue;
    out.push({
      id: row.id,
      tipo_documento: row.tipo_documento,
      nome_documento: row.arquivo_nome ?? row.tipo_documento,
      processo_id: null,
      status: row.status,
      data_envio: row.created_at ?? null,
      data_validade: row.data_validade ?? null,
      data_validade_efetiva: row.data_validade ?? null,
      arma_id: null,
      etapa: null,
      arquivo_storage_key: row.arquivo_storage_path ?? null,
      arquivo_bucket: "qa-documentos",
      origem: "hub_cliente",
      escopo: escopoOrigem,
    });
  }

  out.sort((a, b) => {
    if (a.escopo !== b.escopo) return a.escopo === "cliente" ? -1 : 1;
    const ka = a.arquivo_storage_key ? 0 : 1;
    const kb = b.arquivo_storage_key ? 0 : 1;
    if (ka !== kb) return ka - kb;
    const da = a.data_envio ? new Date(a.data_envio).getTime() : 0;
    const db = b.data_envio ? new Date(b.data_envio).getTime() : 0;
    return db - da;
  });

  const mensagem =
    out.length > 0 && modoReaproveitamento === "assistido"
      ? "Existe documento compatível no seu histórico, mas este serviço exige reaproveitamento assistido pela equipe."
      : null;

  return {
    candidatos: modoReaproveitamento === "automatico" || modoReaproveitamento === "desconhecido" ? out : [],
    modoReaproveitamento,
    mensagem,
    validadeDias: regraServico?.validade_dias ?? null,
  };
}

/** Chama a edge function para marcar o destino como reaproveitado. */
export async function aplicarReaproveitamento(params: {
  destinoDocumentoId: string;
  origemDocumentoId: string;
  origem: OrigemReaproveitamento;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-processo-doc-reaproveitar`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
      },
      body: JSON.stringify({
        destino_documento_id: params.destinoDocumentoId,
        origem_documento_id: params.origemDocumentoId,
        origem_tipo: params.origem,
      }),
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: (out as any)?.error ?? "Falha ao reaproveitar." };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erro de rede." };
  }
}

/**
 * STATUS UNIFICADO — Camada de leitura única (BLOCO 0 / Regra-Mãe).
 *
 * Combina as 5 dimensões obrigatórias (Financeiro / Documentação / Protocolo /
 * Decisão / Validade) em uma única leitura visual com prioridade fixa.
 *
 * Função PURA: não consulta banco. Recebe os dados crus já lidos pelas queries
 * existentes e devolve { dimensao, codigo, label, cor, prioridade, sub }.
 *
 * NÃO substitui nenhuma fonte de verdade. Não escreve em lugar nenhum.
 * Pode ser plugada em qualquer KPI (Arsenal do cliente, painel da Equipe, etc).
 */

import type { StatusServicoQA } from "./statusServico";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type DimensaoStatus =
  | "decisao"
  | "validade"
  | "protocolo"
  | "documentacao"
  | "financeiro"
  | "ia_ocr"
  | "reaproveitamento"
  | "alerta"
  | "vazio";

export type CorStatus =
  | "verde" // ok / deferido / concluído
  | "azul" // andamento / protocolado / em análise órgão
  | "amarelo" // atenção / vencendo
  | "laranja" // pendência / exigência / incompleto
  | "vermelho" // vencido / indeferido / inválido / falhou
  | "cinza"; // sem dado / aguardando leitura

export interface StatusUnificado {
  /** Qual das 5 dimensões disparou a leitura. */
  dimensao: DimensaoStatus;
  /** Código curto, máquina-amigável. */
  codigo: string;
  /** Label UPPERCASE pronto para o KPI. */
  label: string;
  /** Cor segundo o padrão fixo da Regra-Mãe. */
  cor: CorStatus;
  /** 1 = mais crítico (decisão indeferida) … 10 = sem dado. */
  prioridade: number;
  /** Sub-texto opcional para o card (ex.: "vence em 12d", "há 3d"). */
  sub?: string;
}

/**
 * Tipos de entidade suportados pela camada de leitura unificada.
 * Cobre todos os fluxos do sistema Quero Armas (Regra-Mãe / BLOCO 0).
 */
export type TipoKpi =
  // Documentos federais
  | "CR"
  | "CRAF"
  | "GTE"
  | "AUTORIZACAO_COMPRA"
  | "POSSE"
  | "PORTE"
  // Itens auxiliares
  | "EXAME_LAUDO"
  | "PROCESSO_ADM"
  | "DOCUMENTO_INDIVIDUAL"
  | "MUNICAO"
  | "ARMA"
  // Camadas transversais
  | "FINANCEIRO"
  | "IA_OCR"
  | "ALERTA_VENCIMENTO"
  | "GENERICO";

// ─────────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────────

export interface CadastroValidade {
  /** Data de validade do documento (ISO ou Date). null = sem documento ainda. */
  data_validade: string | Date | null;
  /** Quando aprovado pela Equipe (se houver). */
  aprovado_em?: string | Date | null;
}

export interface SolicitacaoServicoLite {
  status_servico: StatusServicoQA | string | null;
  status_financeiro: string | null;
  status_processo: string | null;
  service_slug?: string | null;
}

export interface ProcessoLite {
  /** Status interno do processo (qa_processos.status). */
  status: string | null;
}

export interface DocumentoUploadLite {
  /** Status de aprovação (qa_documentos_cliente.status). */
  status: string | null;
  /** Status da leitura por IA. */
  ia_status?: string | null;
  /** Origem do upload — Hub Cliente reaproveitado vs novo upload. */
  origem?: "hub_cliente" | "upload_servico" | string | null;
  /** Validade do documento individual (CNH, comprovante, exame, laudo). */
  data_validade?: string | Date | null;
}

export interface StatusUnificadoInput {
  tipo: TipoKpi;
  /** Registro consolidado (CR/CRAF/GTE) — se já houver documento aprovado e válido. */
  cadastro?: CadastroValidade | null;
  /** Solicitações de serviço relacionadas a este KPI (já filtradas por tipo). */
  solicitacoes?: SolicitacaoServicoLite[];
  /** Processos vinculados às solicitações acima. */
  processos?: ProcessoLite[];
  /** Uploads do cliente aguardando aprovação da Equipe (já filtrados por tipo). */
  documentos?: DocumentoUploadLite[];
  /** Hoje injetável para testes. Default = new Date(). */
  hoje?: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function diasAte(data: Date, hoje: Date): number {
  const ms = data.getTime() - hoje.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function any<T>(arr: T[] | undefined, fn: (x: T) => boolean): boolean {
  return !!arr?.some(fn);
}

/**
 * Normaliza qualquer string de status vinda do banco para um formato
 * comparável: minúsculas, sem acentos, sem espaços nas pontas e com
 * separadores unificados em "_". Aceita variações legadas e devolve
 * sempre uma string segura para comparar com os enums internos.
 */
export function normalizeQaStatus(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[\s\-/]+/g, "_")
    .replace(/_+/g, "_");
}

/** Mapa de aliases legados → códigos canônicos usados pela engine. */
const STATUS_ALIASES: Record<string, string> = {
  // documentação
  aguardando_documentos: "aguardando_documentacao",
  documentos_pendentes: "aguardando_documentacao",
  em_validacao: "documentos_em_analise",
  em_validacao_ia: "documentos_em_analise",
  em_revisao_humana: "documentos_em_analise",
  em_analise: "documentos_em_analise",
  documentacao_aprovada: "documentos_aprovados",
  aprovado: "documentos_aprovados",
  // documentos individuais (uploads)
  reprovado: "invalido",
  invalidado: "invalido",
  divergente: "invalido",
  // protocolo
  protocolado: "enviado_ao_orgao",
  em_analise_pf: "em_analise_orgao",
  exigencia_emitida: "notificado",
  cumprindo_exigencia: "notificado",
  // financeiro
  pendente: "aguardando_pagamento",
  pago: "confirmado",
  confirmado_pagamento: "confirmado",
  falhado: "falhou",
  recusado: "falhou",
  // ia
  erro: "falhou",
  pendente_ia: "processando",
  // decisão
  arquivado: "indeferido",
};

function canonStatus(raw: string | null | undefined): string {
  const n = normalizeQaStatus(raw);
  return STATUS_ALIASES[n] ?? n;
}

const LABEL_TIPO: Record<TipoKpi, string> = {
  CR: "CR",
  CRAF: "CRAF",
  GTE: "GTE",
  AUTORIZACAO_COMPRA: "AUTORIZAÇÃO DE COMPRA",
  POSSE: "POSSE",
  PORTE: "PORTE",
  EXAME_LAUDO: "EXAME/LAUDO",
  PROCESSO_ADM: "PROCESSO",
  DOCUMENTO_INDIVIDUAL: "DOCUMENTO",
  MUNICAO: "MUNIÇÃO",
  ARMA: "ARMA",
  FINANCEIRO: "FINANCEIRO",
  IA_OCR: "LEITURA IA",
  ALERTA_VENCIMENTO: "VENCIMENTO",
  GENERICO: "ITEM",
};

// ─────────────────────────────────────────────────────────────────────────────
// Engine principal
// ─────────────────────────────────────────────────────────────────────────────

export function getStatusUnificado(input: StatusUnificadoInput): StatusUnificado {
  const hoje = input.hoje ?? new Date();
  const tipo = LABEL_TIPO[input.tipo];

  // Agregadores normalizados (toda comparação usa canonStatus).
  const solStatus = (input.solicitacoes ?? []).map((s) => canonStatus(s.status_servico));
  const procStatus = (input.processos ?? []).map((p) => canonStatus(p.status));
  const finStatus = (input.solicitacoes ?? []).map((s) => canonStatus(s.status_financeiro));
  const docs = (input.documentos ?? []).map((d) => ({
    ...d,
    _status: canonStatus(d.status),
    _ia: canonStatus(d.ia_status),
    _origem: canonStatus(d.origem),
  }));
  const has = (arr: string[], code: string) => arr.includes(code);

  // ── PRIORIDADE 1 — Decisão crítica (indeferido / arquivado) ────────────────
  if (has(solStatus, "indeferido")) {
    return {
      dimensao: "decisao",
      codigo: "indeferido",
      label: `${tipo} INDEFERIDO`,
      cor: "vermelho",
      prioridade: 1,
      sub: "Recurso ou nova solicitação necessária",
    };
  }

  // ── PRIORIDADE 2 — Validade vencida ────────────────────────────────────────
  const validade = toDate(input.cadastro?.data_validade ?? null);
  if (validade) {
    const dias = diasAte(validade, hoje);
    if (dias < 0) {
      return {
        dimensao: "validade",
        codigo: "vencido",
        label: `${tipo} VENCIDO`,
        cor: "vermelho",
        prioridade: 2,
        sub: `há ${Math.abs(dias)}d`,
      };
    }
  }

  // ── PRIORIDADE 2.5 — Pagamento falhou (vermelho, mais grave) ──────────────
  if (has(finStatus, "falhou") || has(finStatus, "cancelado") || has(finStatus, "reembolsado")) {
    return {
      dimensao: "financeiro",
      codigo: "pagamento_falhou",
      label: "PAGAMENTO FALHOU",
      cor: "vermelho",
      prioridade: 2,
      sub: "Refazer pagamento",
    };
  }

  // ── PRIORIDADE 3 — Exigência / notificação do órgão ────────────────────────
  if (has(solStatus, "notificado") || has(solStatus, "recurso_administrativo")) {
    return {
      dimensao: "protocolo",
      codigo: "exigencia_pf",
      label: "EXIGÊNCIA DA PF",
      cor: "laranja",
      prioridade: 3,
      sub: "Cumprir exigência",
    };
  }

  // ── PRIORIDADE 4 — Vencendo em janelas (7/15/30/60/90/180) ────────────────
  if (validade) {
    const dias = diasAte(validade, hoje);
    if (dias <= 7) {
      return {
        dimensao: "validade",
        codigo: "iminente",
        label: "VENCE IMINENTE",
        cor: "vermelho",
        prioridade: 4,
        sub: `${dias}d restantes`,
      };
    }
    if (dias <= 15) {
      return {
        dimensao: "validade",
        codigo: "vencendo_15",
        label: "VENCE EM 15 DIAS",
        cor: "laranja",
        prioridade: 4,
        sub: `${dias}d restantes`,
      };
    }
    if (dias <= 30) {
      return {
        dimensao: "validade",
        codigo: "vencendo_30",
        label: "VENCE EM 30 DIAS",
        cor: "amarelo",
        prioridade: 4,
        sub: `${dias}d restantes`,
      };
    }
    if (dias <= 60) {
      return {
        dimensao: "validade",
        codigo: "vencendo_60",
        label: "VENCE EM 60 DIAS",
        cor: "amarelo",
        prioridade: 5,
        sub: `${dias}d restantes`,
      };
    }
    if (dias <= 90) {
      return {
        dimensao: "validade",
        codigo: "vencendo_90",
        label: "VENCE EM 90 DIAS",
        cor: "amarelo",
        prioridade: 5,
        sub: `vence em ${dias}d`,
      };
    }
    if (dias <= 180) {
      return {
        dimensao: "validade",
        codigo: "vencendo_180",
        label: `${tipo} EM DIA`,
        cor: "verde",
        prioridade: 5,
        sub: `vence em ${dias}d`,
      };
    }
  }

  // ── PRIORIDADE 5 — Em análise no órgão / protocolado ──────────────────────
  if (
    has(solStatus, "em_analise_orgao") ||
    has(solStatus, "enviado_ao_orgao") ||
    has(solStatus, "restituido")
  ) {
    return {
      dimensao: "protocolo",
      codigo: "em_analise_orgao",
      label: "EM ANÁLISE NA PF",
      cor: "azul",
      prioridade: 5,
      sub: "Aguardando decisão",
    };
  }
  if (has(solStatus, "pronto_para_protocolo")) {
    return {
      dimensao: "protocolo",
      codigo: "pronto_protocolo",
      label: "PRONTO PARA PROTOCOLO",
      cor: "azul",
      prioridade: 5,
    };
  }

  // ── PRIORIDADE 6 — Documento INVÁLIDO antes de incompleto/em análise ──────
  if (any(docs, (d) => d._status === "invalido")) {
    return {
      dimensao: "documentacao",
      codigo: "documentos_invalidos",
      label: "DOCS INVÁLIDOS",
      cor: "vermelho",
      prioridade: 6,
      sub: "Reenviar documento",
    };
  }
  if (has(solStatus, "documentos_incompletos")) {
    return {
      dimensao: "documentacao",
      codigo: "documentos_incompletos",
      label: "DOCS INCOMPLETOS",
      cor: "laranja",
      prioridade: 6,
      sub: "Cliente precisa corrigir",
    };
  }

  // ── PRIORIDADE 7 — Documentos em análise interna ──────────────────────────
  if (
    has(solStatus, "documentos_em_analise") ||
    any(docs, (d) => d._status === "pendente" || d._status === "documentos_em_analise" || d._status === "enviado")
  ) {
    return {
      dimensao: "documentacao",
      codigo: "documentos_em_analise",
      label: "EM ANÁLISE INTERNA",
      cor: "amarelo",
      prioridade: 7,
      sub: "Equipe Quero Armas avaliando",
    };
  }

  // IA/OCR ainda processando (sub-camada de documentação)
  if (any(docs, (d) => d._ia === "processando")) {
    return {
      dimensao: "ia_ocr",
      codigo: "ia_processando",
      label: "LEITURA IA EM ANDAMENTO",
      cor: "azul",
      prioridade: 7,
      sub: "Aguardando OCR concluir",
    };
  }
  if (any(docs, (d) => d._ia === "falhou")) {
    return {
      dimensao: "ia_ocr",
      codigo: "ia_falhou",
      label: "FALHA NA LEITURA IA",
      cor: "laranja",
      prioridade: 7,
      sub: "Reprocessar documento",
    };
  }

  if (
    has(solStatus, "aguardando_documentacao") ||
    has(solStatus, "montando_pasta") ||
    has(procStatus, "aguardando_documentacao")
  ) {
    return {
      dimensao: "documentacao",
      codigo: "aguardando_documentacao",
      label: "AGUARDANDO DOCUMENTOS",
      cor: "laranja",
      prioridade: 7,
      sub: "Cliente precisa enviar",
    };
  }

  // ── PRIORIDADE 8 — Financeiro pendente ────────────────────────────────────
  if (has(finStatus, "aguardando_pagamento")) {
    return {
      dimensao: "financeiro",
      codigo: "aguardando_pagamento",
      label: "AGUARDANDO PAGAMENTO",
      cor: "laranja",
      prioridade: 8,
      sub: "Pagamento não confirmado",
    };
  }

  // ── PRIORIDADE 9 — Documento aprovado e em dia ────────────────────────────
  if (validade) {
    const dias = diasAte(validade, hoje);
    return {
      dimensao: "validade",
      codigo: "ok",
      label: `${tipo} EM DIA`,
      cor: "verde",
      prioridade: 9,
      sub: `vence em ${dias}d`,
    };
  }

  // Decisão deferida sem validade ainda registrada → estado intermediário
  if (has(solStatus, "deferido") || has(solStatus, "finalizado")) {
    return {
      dimensao: "decisao",
      codigo: "deferido",
      label: `${tipo} DEFERIDO`,
      cor: "verde",
      prioridade: 9,
      sub: "Aguardando emissão do documento",
    };
  }

  // Documentos aprovados reaproveitados do Hub Cliente, sem solicitação ativa
  if (any(docs, (d) => d._status === "documentos_aprovados" && d._origem === "hub_cliente")) {
    return {
      dimensao: "reaproveitamento",
      codigo: "hub_reaproveitado",
      label: "DOC REAPROVEITADO",
      cor: "verde",
      prioridade: 9,
      sub: "Reutilizado do Hub Cliente",
    };
  }
  if (any(docs, (d) => d._status === "documentos_aprovados")) {
    return {
      dimensao: "documentacao",
      codigo: "documento_aprovado",
      label: `${tipo} APROVADO`,
      cor: "verde",
      prioridade: 9,
    };
  }

  // ── PRIORIDADE 10 — Sem dado ──────────────────────────────────────────────
  return {
    dimensao: "vazio",
    codigo: "sem_dado",
    label: `SEM ${tipo}`,
    cor: "cinza",
    prioridade: 10,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agregadores — combinam múltiplos StatusUnificado em uma leitura única
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reduz uma lista de status individuais para o status mais crítico (menor
 * prioridade numérica). Usado para leitura agregada por cliente / serviço /
 * arsenal. Mantém função pura: nunca consulta banco.
 */
export function reduzirStatus(lista: StatusUnificado[]): StatusUnificado {
  if (!lista || lista.length === 0) {
    return {
      dimensao: "vazio",
      codigo: "sem_dado",
      label: "SEM DADO",
      cor: "cinza",
      prioridade: 10,
    };
  }
  return [...lista].sort((a, b) => a.prioridade - b.prioridade)[0];
}

export interface StatusAgregadoCliente {
  /** Pior status entre todos os itens do cliente. */
  geral: StatusUnificado;
  /** Leitura por dimensão (sempre o pior dentro de cada uma). */
  porDimensao: Partial<Record<DimensaoStatus, StatusUnificado>>;
  /** Quantos itens em cada cor — útil para contadores no painel da Equipe. */
  contagem: Record<CorStatus, number>;
}

/**
 * Consolida o status do cliente como um todo a partir das leituras já feitas
 * por item (cada arma, documento, serviço, etc).
 */
export function getStatusAgregadoCliente(itens: StatusUnificado[]): StatusAgregadoCliente {
  const contagem: Record<CorStatus, number> = {
    verde: 0, azul: 0, amarelo: 0, laranja: 0, vermelho: 0, cinza: 0,
  };
  const porDimensao: Partial<Record<DimensaoStatus, StatusUnificado>> = {};

  for (const s of itens) {
    contagem[s.cor]++;
    const atual = porDimensao[s.dimensao];
    if (!atual || s.prioridade < atual.prioridade) porDimensao[s.dimensao] = s;
  }

  return { geral: reduzirStatus(itens), porDimensao, contagem };
}

/**
 * Atalho: status agregado de um único serviço (1 solicitação + N documentos +
 * N processos). Reaproveita a engine principal.
 */
export function getStatusServicoAgregado(input: StatusUnificadoInput): StatusUnificado {
  return getStatusUnificado(input);
}

/**
 * Status de uma única arma do Arsenal — combina CR, CRAF, GTE e autorização
 * de compra associados àquela arma.
 */
export function getStatusItemArsenal(itensDaArma: StatusUnificado[]): StatusUnificado {
  return reduzirStatus(itensDaArma);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers especializados (entradas mais simples para tipos não-CR/CRAF/GTE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Avalia apenas a dimensão de validade/renovação. Útil para alertas de
 * vencimento sobre qualquer documento (CR, CRAF, CNH, exame, laudo, etc).
 */
export function getStatusValidade(
  data_validade: string | Date | null | undefined,
  tipo: TipoKpi = "GENERICO",
  hoje: Date = new Date(),
): StatusUnificado {
  return getStatusUnificado({
    tipo,
    cadastro: { data_validade: data_validade ?? null },
    hoje,
  });
}

/**
 * Avalia apenas o estado de um documento individual (upload do cliente).
 * Cobre IA/OCR, aprovação, reprovação e reaproveitamento do Hub.
 */
export function getStatusDocumento(
  doc: DocumentoUploadLite,
  tipo: TipoKpi = "DOCUMENTO_INDIVIDUAL",
  hoje: Date = new Date(),
): StatusUnificado {
  return getStatusUnificado({
    tipo,
    documentos: [doc],
    cadastro: doc.data_validade ? { data_validade: doc.data_validade } : null,
    hoje,
  });
}

/**
 * Avalia apenas a camada financeira (sem documentos/processos).
 */
export function getStatusFinanceiro(
  status_financeiro: string | null | undefined,
): StatusUnificado {
  return getStatusUnificado({
    tipo: "FINANCEIRO",
    solicitacoes: [
      { status_servico: null, status_financeiro: status_financeiro ?? null, status_processo: null },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento de cor → classes Tailwind (Arsenal UI / Premium Light)
// ─────────────────────────────────────────────────────────────────────────────

export const COR_BADGE_CLASS: Record<CorStatus, string> = {
  verde: "bg-emerald-100 text-emerald-800 border-emerald-300",
  azul: "bg-sky-100 text-sky-800 border-sky-300",
  amarelo: "bg-amber-100 text-amber-800 border-amber-300",
  laranja: "bg-orange-100 text-orange-800 border-orange-300",
  vermelho: "bg-red-100 text-red-800 border-red-300",
  cinza: "bg-slate-100 text-slate-600 border-slate-300",
};

export const COR_DOT_CLASS: Record<CorStatus, string> = {
  verde: "bg-emerald-500",
  azul: "bg-sky-500",
  amarelo: "bg-amber-500",
  laranja: "bg-orange-500",
  vermelho: "bg-red-500",
  cinza: "bg-slate-400",
};

/**
 * Mapeia slug de serviço → tipo de KPI. Cobre os casos canônicos.
 * Retorna null quando o serviço não alimenta nenhum dos 3 KPIs do Arsenal.
 */
export function tipoKpiPorSlug(slug?: string | null): TipoKpi | null {
  if (!slug) return null;
  const s = normalizeQaStatus(slug);

  // Canônicos da plataforma — comparados explicitamente.
  if (s === "posse_arma_fogo") return "POSSE";
  if (s === "porte_arma_fogo") return "PORTE";
  if (s === "registro_arma_fogo" || s === "craf") return "CRAF";
  if (s === "concessao_cr" || s === "cr") return "CR";

  // Fallbacks tolerantes (slugs antigos/variantes).
  if (s.includes("craf")) return "CRAF";
  if (s.includes("gte") || s.includes("trafego")) return "GTE";
  if (s.includes("autorizacao") && s.includes("compra")) return "AUTORIZACAO_COMPRA";
  if (s.includes("posse")) return "POSSE";
  if (s.includes("porte")) return "PORTE";
  if (s.includes("exame") || s.includes("laudo")) return "EXAME_LAUDO";
  if (s.includes("municao")) return "MUNICAO";
  if (s.startsWith("cr_") || s.includes("_cr_")) return "CR";
  return null;
}

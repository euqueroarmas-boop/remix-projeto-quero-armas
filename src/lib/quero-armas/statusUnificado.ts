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

const LABEL_TIPO: Record<TipoKpi, string> = {
  CR: "CR",
  CRAF: "CRAF",
  GTE: "GTE",
};

// ─────────────────────────────────────────────────────────────────────────────
// Engine principal
// ─────────────────────────────────────────────────────────────────────────────

export function getStatusUnificado(input: StatusUnificadoInput): StatusUnificado {
  const hoje = input.hoje ?? new Date();
  const tipo = LABEL_TIPO[input.tipo];

  // Agregadores de status das solicitações vinculadas
  const solStatus = (input.solicitacoes ?? []).map((s) => s.status_servico ?? "");
  const procStatus = (input.processos ?? []).map((p) => p.status ?? "");
  const finStatus = (input.solicitacoes ?? []).map((s) => s.status_financeiro ?? "");

  // ── PRIORIDADE 1 — Decisão crítica (indeferido / arquivado) ────────────────
  if (solStatus.includes("indeferido")) {
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

  // ── PRIORIDADE 3 — Exigência / notificação do órgão ────────────────────────
  if (solStatus.includes("notificado") || solStatus.includes("recurso_administrativo")) {
    return {
      dimensao: "protocolo",
      codigo: "exigencia_pf",
      label: "EXIGÊNCIA DA PF",
      cor: "laranja",
      prioridade: 3,
      sub: "Cumprir exigência",
    };
  }

  // ── PRIORIDADE 4 — Vencendo em janelas (180/90/60/30/15/7/iminente) ───────
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
    if (dias <= 30) {
      return {
        dimensao: "validade",
        codigo: "vencendo_30",
        label: "VENCE EM BREVE",
        cor: "amarelo",
        prioridade: 4,
        sub: `${dias}d restantes`,
      };
    }
    if (dias <= 90) {
      return {
        dimensao: "validade",
        codigo: "vencendo_90",
        label: `${tipo} EM DIA`,
        cor: "amarelo",
        prioridade: 5,
        sub: `vence em ${dias}d`,
      };
    }
  }

  // ── PRIORIDADE 5 — Em análise no órgão / protocolado ──────────────────────
  if (
    solStatus.includes("em_analise_orgao") ||
    solStatus.includes("enviado_ao_orgao") ||
    solStatus.includes("restituido")
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
  if (solStatus.includes("pronto_para_protocolo")) {
    return {
      dimensao: "protocolo",
      codigo: "pronto_protocolo",
      label: "PRONTO PARA PROTOCOLO",
      cor: "azul",
      prioridade: 5,
    };
  }

  // ── PRIORIDADE 6 — Documentos com problema (incompleto/inválido) ──────────
  if (solStatus.includes("documentos_incompletos")) {
    return {
      dimensao: "documentacao",
      codigo: "documentos_incompletos",
      label: "DOCS INCOMPLETOS",
      cor: "laranja",
      prioridade: 6,
      sub: "Cliente precisa corrigir",
    };
  }
  if (any(input.documentos, (d) => d.status === "reprovado")) {
    return {
      dimensao: "documentacao",
      codigo: "documentos_invalidos",
      label: "DOCS INVÁLIDOS",
      cor: "vermelho",
      prioridade: 6,
      sub: "Reenviar documento",
    };
  }

  // ── PRIORIDADE 7 — Documentos em análise interna ──────────────────────────
  if (
    solStatus.includes("documentos_em_analise") ||
    any(input.documentos, (d) => d.status === "pendente" || d.status === "em_analise")
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

  if (
    solStatus.includes("aguardando_documentacao") ||
    solStatus.includes("montando_pasta") ||
    procStatus.includes("aguardando_documentos")
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
  if (finStatus.some((s) => s === "aguardando_pagamento" || s === "pendente")) {
    return {
      dimensao: "financeiro",
      codigo: "aguardando_pagamento",
      label: "AGUARDANDO PAGAMENTO",
      cor: "laranja",
      prioridade: 8,
      sub: "Pagamento não confirmado",
    };
  }
  if (finStatus.includes("falhou")) {
    return {
      dimensao: "financeiro",
      codigo: "pagamento_falhou",
      label: "PAGAMENTO FALHOU",
      cor: "vermelho",
      prioridade: 8,
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
  if (solStatus.includes("deferido") || solStatus.includes("finalizado")) {
    return {
      dimensao: "decisao",
      codigo: "deferido",
      label: `${tipo} DEFERIDO`,
      cor: "verde",
      prioridade: 9,
      sub: "Aguardando emissão do documento",
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
  const s = slug.toLowerCase();
  if (s.includes("craf")) return "CRAF";
  if (s.includes("gte") || s.includes("trafego")) return "GTE";
  if (s.includes("cr-") || s === "cr" || s.startsWith("cr_")) return "CR";
  return null;
}

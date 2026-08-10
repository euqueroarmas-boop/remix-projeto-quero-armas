/**
 * Trilha do checklist — rótulos que explicam POR QUE dois processos do mesmo
 * serviço têm denominadores diferentes (ex.: 17/27 vs 6/21).
 *
 * Não há campo novo no banco: a trilha é deduzida dos tipos de documento
 * que o motor de checklist já materializou em `qa_processo_documentos`.
 */

export type MarcadorTrilha = {
  label: string;
  /** prioridade de exibição (menor = mais relevante) */
  ordem: number;
  match: (tipo: string) => boolean;
};

const MARCADORES: MarcadorTrilha[] = [
  { label: "DEFESA PESSOAL", ordem: 1, match: (t) => t === "comprovante_efetiva_necessidade" },
  { label: "CAC", ordem: 1, match: (t) => t === "declaracao_compromisso_treino" },
  { label: "ENDEREÇO 5 ANOS", ordem: 2, match: (t) => /^comprovante_endereco_ano_\d{4}$/.test(t) },
  { label: "IMÓVEL DE TERCEIRO", ordem: 3, match: (t) => t === "declaracao_responsavel_imovel" || t === "documento_identificacao_terceiro" },
  { label: "SERVIDOR/INSTITUIÇÃO", ordem: 4, match: (t) => /_instituicao$/.test(t) || t === "renda_carteira_funcional" },
  { label: "EMPRESÁRIO", ordem: 5, match: (t) => ["renda_contrato_social", "renda_qsa", "renda_cartao_cnpj", "renda_ficha_cadastral_jucesp", "renda_nf_empresa"].includes(t) },
  { label: "ASSALARIADO", ordem: 5, match: (t) => ["renda_contra_cheque_mes_atual", "ctps"].includes(t) },
  { label: "APOSENTADO/BENEFICIÁRIO", ordem: 5, match: (t) => ["renda_extrato_inss", "renda_comprovante_beneficio"].includes(t) },
  { label: "AUTÔNOMO", ordem: 5, match: (t) => ["renda_decore", "renda_extrato_bancario"].includes(t) },
  // NÃO existe marcador "MILITAR" por certidão: `antecedentes_militar` e
  // `antecedentes_militar_estadual` são exigidos de TODO requerente (Justiça
  // Militar da União/Estadual), não são ramificação. Usar isso como trilha
  // rotulava todo mundo como militar. Militar de verdade só se materializa
  // pela trilha institucional (renda_carteira_funcional / *_instituicao).
  { label: "MENOR NO IMÓVEL", ordem: 7, match: (t) => t === "declaracao_guarda_responsavel" },
  { label: "INQUÉRITO", ordem: 8, match: (t) => t === "declaracao_sem_inquerito_processo_criminal" },
];

/**
 * Status que indicam exigência materializada mas com a condição INATIVA
 * (o motor cria o item e dispensa quando a ramificação não se aplica).
 * Esses itens não podem gerar rótulo de trilha — era o que fazia
 * "IMÓVEL DE TERCEIRO" aparecer para todo mundo.
 */
const STATUS_CONDICAO_INATIVA = new Set([
  "dispensado_grupo",
  "dispensado_por_grupo",
  "dispensado_condicao",
  "nao_aplicavel",
]);

export type DocTrilha = { tipo_documento: string | null; status?: string | null };

/** Deduz os rótulos de trilha a partir dos documentos do processo. */
export function trilhaDoProcesso(docs: Array<string | DocTrilha>): string[] {
  const norm = docs
    .map((d) => (typeof d === "string" ? { tipo_documento: d, status: null } : d))
    .filter((d) => !STATUS_CONDICAO_INATIVA.has(String(d.status ?? "").toLowerCase()))
    .map((d) => String(d.tipo_documento || "").toLowerCase());
  const achados = MARCADORES.filter((m) => norm.some((t) => m.match(t)));
  // Se caiu em SERVIDOR/INSTITUIÇÃO, o rótulo de renda comum vira redundante.
  const temInstituicao = achados.some((a) => a.label === "SERVIDOR/INSTITUIÇÃO");
  return achados
    .filter((a) => !(temInstituicao && a.label === "ASSALARIADO"))
    .sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))
    .map((a) => a.label);
}

/** Trilha compacta para telas estreitas: N primeiros + "+X". */
export function trilhaCompacta(labels: string[], max = 2): string[] {
  if (labels.length <= max) return labels;
  return [...labels.slice(0, max), `+${labels.length - max}`];
}
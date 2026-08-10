/**
 * Trilha do checklist — rótulos que explicam POR QUE dois processos do mesmo
 * serviço têm denominadores diferentes (ex.: 17/27 vs 6/21).
 *
 * Não há campo novo no banco: a trilha é deduzida dos tipos de documento
 * que o motor de checklist já materializou em `qa_processo_documentos`.
 *
 * REGRA CANÔNICA: existir linha NÃO é pertencer à trilha. O motor materializa
 * documentos condicionais e depois os dispensa; só linhas VIVAS (não
 * dispensadas / não reaproveitadas / não substituídas) contam. Sem esse filtro
 * todo mundo aparecia como "IMÓVEL DE TERCEIRO" e "MILITAR".
 */

export interface DocTrilha {
  tipo: string;
  status?: string | null;
}

/** Status que indicam que a exigência NÃO vale para este cliente. */
const STATUS_MORTOS = new Set([
  "dispensado",
  "dispensado_grupo",
  "dispensado_por_reaproveitamento",
  "nao_aplicavel",
  "reaproveitado",
  "hub_reaproveitado",
  "substituido",
  "excluido",
  "descartado",
  "descartado_por_troca_servico",
  "cancelado",
  "arquivado",
]);

export function linhaViva(status?: string | null): boolean {
  return !STATUS_MORTOS.has(String(status ?? "").trim().toLowerCase());
}

/** Condição profissional canônica -> rótulo curto de trilha. */
export const CONDICAO_TRILHA: Record<string, string> = {
  clt: "ASSALARIADO",
  funcionario_publico: "SERVIDOR PÚBLICO",
  seguranca_publica: "SERVIDOR/INSTITUIÇÃO",
  autonomo: "AUTÔNOMO/MEI",
  empresario: "EMPRESÁRIO",
  aposentado: "APOSENTADO",
};

export type MarcadorTrilha = {
  label: string;
  /** prioridade de exibição (menor = mais relevante) */
  ordem: number;
  match: (tipo: string) => boolean;
};

/** Rótulos que descrevem ocupação — só entram por inferência quando não há condição canônica. */
const LABELS_OCUPACAO = new Set([
  "SERVIDOR/INSTITUIÇÃO",
  "EMPRESÁRIO",
  "ASSALARIADO",
  "AUTÔNOMO/MEI",
  "APOSENTADO",
  "SERVIDOR PÚBLICO",
]);

const MARCADORES: MarcadorTrilha[] = [
  { label: "DEFESA PESSOAL", ordem: 1, match: (t) => t === "comprovante_efetiva_necessidade" },
  { label: "CAC", ordem: 1, match: (t) => t === "declaracao_compromisso_treino" },
  { label: "ENDEREÇO 5 ANOS", ordem: 2, match: (t) => /^comprovante_endereco_ano_\d{4}$/.test(t) },
  { label: "IMÓVEL DE TERCEIRO", ordem: 3, match: (t) => t === "declaracao_responsavel_imovel" || t === "documento_identificacao_terceiro" },
  { label: "SERVIDOR/INSTITUIÇÃO", ordem: 4, match: (t) => /_instituicao$/.test(t) || t === "renda_carteira_funcional" },
  { label: "EMPRESÁRIO", ordem: 5, match: (t) => ["renda_contrato_social", "renda_qsa", "renda_cartao_cnpj", "renda_ficha_cadastral_jucesp", "renda_nf_empresa", "renda_ccmei"].includes(t) },
  { label: "ASSALARIADO", ordem: 5, match: (t) => ["renda_contra_cheque_mes_atual", "ctps"].includes(t) },
  { label: "APOSENTADO", ordem: 5, match: (t) => ["renda_extrato_inss", "renda_comprovante_beneficio"].includes(t) },
  { label: "MILITAR", ordem: 6, match: (t) => t === "antecedentes_militar_estadual" },
  { label: "MENOR NO IMÓVEL", ordem: 7, match: (t) => t === "declaracao_guarda_responsavel" },
  { label: "INQUÉRITO", ordem: 8, match: (t) => t === "declaracao_sem_inquerito_processo_criminal" },
];

/**
 * Deduz os rótulos de trilha a partir dos documentos VIVOS do processo.
 *
 * @param docs     linhas de `qa_processo_documentos` (tipo + status)
 * @param condicao `qa_processos.condicao_profissional` (fonte canônica da ocupação)
 */
export function trilhaDoProcesso(docs: DocTrilha[], condicao?: string | null): string[] {
  const vivos = docs
    .filter((d) => linhaViva(d.status))
    .map((d) => String(d.tipo || "").toLowerCase())
    // "renda_definir_condicao" é um placeholder: não define ocupação nenhuma.
    .filter((t) => t !== "renda_definir_condicao");

  const canonicas = String(condicao ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
    .map((c) => CONDICAO_TRILHA[c])
    .filter(Boolean) as string[];

  let achados = MARCADORES.filter((m) => vivos.some((t) => m.match(t)));

  // A condição declarada manda: quando existe, ela substitui qualquer inferência
  // de ocupação feita a partir de documentos materializados.
  if (canonicas.length > 0) {
    achados = achados.filter((a) => !LABELS_OCUPACAO.has(a.label));
  }

  const labels = [
    ...achados
      .sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))
      .map((a) => a.label),
  ];

  // Insere as condições canônicas mantendo unicidade.
  for (const c of canonicas) if (!labels.includes(c)) labels.push(c);

  // Se caiu em SERVIDOR/INSTITUIÇÃO, o rótulo de renda comum vira redundante.
  const temInstituicao = labels.includes("SERVIDOR/INSTITUIÇÃO");
  return labels.filter((l) => !(temInstituicao && l === "ASSALARIADO"));
}

/** Trilha compacta para telas estreitas: N primeiros + "+X". */
export function trilhaCompacta(labels: string[], max = 2): string[] {
  if (labels.length <= max) return labels;
  return [...labels.slice(0, max), `+${labels.length - max}`];
}
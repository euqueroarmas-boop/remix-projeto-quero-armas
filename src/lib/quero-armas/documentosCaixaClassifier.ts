/* =============================================================================
 * Bloco 11 — Classificador "3 Caixas" para documentos de processo.
 *
 * Camada PURAMENTE ADITIVA. Não altera consultas, não muta dados, não
 * influencia o checklist guiado nem o ProcessoDetalheDrawer no fluxo de
 * upload/aprovação. Existe apenas para AGRUPAR visualmente os documentos
 * em três caixas, conforme o diagrama:
 *
 *   - permanente: documentos do cofre do cliente (identidade, endereço,
 *     antecedentes, declarações gerais). Reaproveitáveis em qualquer
 *     processo do mesmo cliente.
 *   - arma: documentos vinculados a UMA arma específica do acervo
 *     (`arma_id IS NOT NULL`) — CRAF, GTE, NF da arma, etc.
 *   - processo: tudo que não cai nas duas anteriores — documentos
 *     específicos do serviço/processo atual.
 *
 * Regra final (confirmada com o usuário):
 *   1) Se `arma_id` está preenchido  → "arma"  (vence qualquer outra regra)
 *   2) Senão, se `etapa` ∈ ETAPAS_PERMANENTES → "permanente"
 *   3) Caso contrário → "processo"
 * ============================================================================= */

export type CaixaDocumento = "permanente" | "arma" | "processo";

export interface DocClassificavel {
  etapa?: string | null;
  arma_id?: string | null;
  status?: string | null;
  obrigatorio?: boolean | null;
  regra_validacao?: any;
  metadados_documento_json?: any;
  escopo?: string | null;
  tipo_documento?: string | null;
}

// Mantido para compatibilidade com checklistAudit.ts e documentoEscopo.ts
export const ETAPAS_PERMANENTES: ReadonlySet<string> = new Set([
  "identificacao", "endereco", "antecedentes", "declaracoes_gerais",
]);

// Prefixos que indicam documento permanente (fallback quando escopo não está preenchido)
const PREFIXOS_PERMANENTES: ReadonlyArray<RegExp> = [
  /^renda_/, /^antecedentes_/, /^certidao_/, /^laudo_/,
  /^declaracao_/, /^comprovante_endereco_ano_/, /^comprovante_filiacao_/,
  /^comprovante_habitualidade/, /^comprovante_clube/,
  /^declaracao_habitualidade_/, /^declaracao_compromisso_/,
];

const TIPOS_PERMANENTES: ReadonlySet<string> = new Set([
  "rg_com_cpf", "cin", "cnh", "cpf",
  "comprovante_residencia", "declaracao_responsavel_imovel",
  "laudo_psicologico", "laudo_capacidade_tecnica",
  "comprovante_habitualidade", "comprovante_clube_tiro", "comprovante_competicao",
  "cr",
]);

export function classificarCaixa(doc: DocClassificavel | null | undefined): CaixaDocumento {
  if (!doc) return "processo";
  // arma_id tem prioridade absoluta — vínculo explícito com uma arma do acervo
  if (doc.arma_id != null && String(doc.arma_id).trim() !== "") {
    return "arma";
  }
  // escopo vindo do banco é a fonte primária
  if (doc.escopo === "permanente") return "permanente";
  if (doc.escopo === "arma") return "arma";
  // fallback por tipo_documento (itens de processos antigos sem escopo preenchido)
  if (doc.tipo_documento) {
    const td = doc.tipo_documento;
    if (TIPOS_PERMANENTES.has(td)) return "permanente";
    if (PREFIXOS_PERMANENTES.some((re) => re.test(td))) return "permanente";
  }
  return "processo";
}

export interface ContagensCaixas {
  permanente: number;
  arma: number;
  processo: number;
  total: number;
}

export interface BreakdownStatus {
  total: number;
  resolvidos: number;
  reutilizados_hub: number;
  pendentes: number;
  em_analise: number;
  ocultos: number;
}

export interface ContagensCaixasComStatus extends ContagensCaixas {
  porCaixa: Record<CaixaDocumento, BreakdownStatus>;
}

export function contarPorCaixa(
  docs: ReadonlyArray<DocClassificavel> | null | undefined,
): ContagensCaixas {
  const out: ContagensCaixas = { permanente: 0, arma: 0, processo: 0, total: 0 };
  if (!docs) return out;
  for (const d of docs) {
    out[classificarCaixa(d)]++;
    out.total++;
  }
  return out;
}

// Espelho enxuto de itemVisivelGuia — mantém a UI alinhada com o assistente
// (respeita depende_de e exige_quando) sem importar do engine (evita ciclo).
function itemVisivel(doc: DocClassificavel, respostas: Record<string, any>): boolean {
  const r = doc?.regra_validacao;
  if (!r || typeof r !== "object") return true;
  if (r.depende_de && typeof r.depende_de === "object") {
    if (respostas[r.depende_de.chave] !== r.depende_de.valor) return false;
  }
  if (r.exige_quando && typeof r.exige_quando === "object") {
    return Object.entries(r.exige_quando as Record<string, string>).every(
      ([k, v]) => respostas[k] === v,
    );
  }
  return true;
}

const STATUS_CUMPRIDO = new Set([
  "aprovado", "validado", "concluido", "concluído",
  "dispensado", "dispensado_grupo", "dispensado_por_reaproveitamento", "nao_aplicavel",
]);
const STATUS_EM_ANALISE = new Set([
  "em_analise", "enviado", "fila", "processando",
  "revisao_humana", "em_revisao_humana", "pendente_aprovacao", "aguardando_equipe",
]);

function ehReutilizadoHub(doc: DocClassificavel): boolean {
  const s = String(doc?.status ?? "").toLowerCase();
  if (s === "dispensado_por_reaproveitamento") return true;
  const m = doc?.metadados_documento_json;
  return !!(m && typeof m === "object" && m.reutilizado_do_hub === true);
}

export function contarPorCaixaComStatus(
  docs: ReadonlyArray<DocClassificavel> | null | undefined,
  respostas: Record<string, any> = {},
): ContagensCaixasComStatus {
  const zero = (): BreakdownStatus => ({
    total: 0, resolvidos: 0, reutilizados_hub: 0,
    pendentes: 0, em_analise: 0, ocultos: 0,
  });
  const out: ContagensCaixasComStatus = {
    permanente: 0, arma: 0, processo: 0, total: 0,
    porCaixa: { permanente: zero(), arma: zero(), processo: zero() },
  };
  if (!docs) return out;
  for (const d of docs) {
    const c = classificarCaixa(d);
    out[c]++;
    out.total++;
    const b = out.porCaixa[c];
    b.total++;
    if (!itemVisivel(d, respostas)) { b.ocultos++; continue; }
    const s = String(d?.status ?? "").toLowerCase();
    if (ehReutilizadoHub(d)) { b.resolvidos++; b.reutilizados_hub++; continue; }
    if (STATUS_CUMPRIDO.has(s)) { b.resolvidos++; continue; }
    if (STATUS_EM_ANALISE.has(s)) { b.em_analise++; continue; }
    b.pendentes++;
  }
  return out;
}

export function agruparPorCaixa<T extends DocClassificavel>(
  docs: ReadonlyArray<T> | null | undefined,
): Record<CaixaDocumento, T[]> {
  const out: Record<CaixaDocumento, T[]> = { permanente: [], arma: [], processo: [] };
  if (!docs) return out;
  for (const d of docs) {
    out[classificarCaixa(d)].push(d);
  }
  return out;
}

export const CAIXA_META: Record<
  CaixaDocumento,
  { label: string; descricaoCurta: string; descricaoLonga: string }
> = {
  permanente: {
    label: "Seus dados (permanente)",
    descricaoCurta: "Hub de Documentos",
    descricaoLonga:
      "Documentos disponíveis no Hub de Documentos — identidade, endereço, antecedentes e declarações gerais. Valem para qualquer processo.",
  },
  arma: {
    label: "Documentos da arma",
    descricaoCurta: "Vinculados a uma arma do acervo",
    descricaoLonga:
      "Documentos ligados a uma arma específica do seu acervo (CRAF, GTE, NF). Cada arma tem o seu próprio conjunto.",
  },
  processo: {
    label: "Documentos deste processo",
    descricaoCurta: "Específicos deste serviço",
    descricaoLonga:
      "Documentos próprios deste processo — exigências do serviço contratado que não fazem parte do Hub de Documentos.",
  },
};

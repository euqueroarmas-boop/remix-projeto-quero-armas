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
}

export const ETAPAS_PERMANENTES: ReadonlySet<string> = new Set([
  "identificacao",
  "endereco",
  "antecedentes",
  "declaracoes_gerais",
]);

export function classificarCaixa(doc: DocClassificavel | null | undefined): CaixaDocumento {
  if (!doc) return "processo";
  if (doc.arma_id != null && String(doc.arma_id).trim() !== "") {
    return "arma";
  }
  if (doc.etapa && ETAPAS_PERMANENTES.has(doc.etapa)) {
    return "permanente";
  }
  return "processo";
}

export interface ContagensCaixas {
  permanente: number;
  arma: number;
  processo: number;
  total: number;
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

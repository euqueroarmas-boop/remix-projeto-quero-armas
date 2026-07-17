/* =============================================================================
 * Bloco 11 — Escopo do documento (cliente / arma / processo)
 *
 * Camada PURAMENTE ADITIVA. Não muta dados, não chama supabase, não altera
 * fluxos existentes. Existe para que qualquer lógica de reaproveitamento
 * (engine do assistente, RPC `qa_explodir_checklist_processo`, painel admin)
 * possa consultar um único ponto canônico antes de reaproveitar documento.
 *
 * Espelha o classificador das "3 caixas" (documentosCaixaClassifier.ts), mas
 * com vocabulário voltado ao reaproveitamento:
 *
 *   - "cliente"  → documento permanente do cofre do cliente (RG, CPF,
 *                  endereço, antecedentes, certidão averbada, foto). Pode
 *                  ser reaproveitado entre processos do mesmo cliente.
 *   - "arma"     → documento de UMA arma específica do acervo (CRAF, GTE,
 *                  NF da arma, etc.). Só reaproveita entre exigências da
 *                  MESMA arma.
 *   - "cac_atividade" → documento recorrente de atividade CAC
 *                  (habitualidade, clube, competição, guarda de acervo).
 *                  Pode ser reaproveitado entre serviços compatíveis quando
 *                  a matriz do serviço permitir.
 *   - "processo" → documento específico do serviço/processo (declarações
 *                  geradas, contratos, comprovantes próprios do protocolo).
 *                  Não reaproveita automaticamente entre processos.
 *
 * Ordem de precedência (mesma do classificador de caixas):
 *   1) isDocDeArma(tipo) OU arma_id preenchido → "arma"
 *   2) etapa ∈ ETAPAS_CLIENTE                  → "cliente"
 *   3) caso contrário                           → "processo"
 * ============================================================================= */

import { isDocDeArma } from "./documentosDeArma";
import { ETAPAS_PERMANENTES } from "./documentosCaixaClassifier";

export type EscopoDocumento = "cliente" | "arma" | "cac_atividade" | "processo";

export interface DocEscopavel {
  tipo_documento?: string | null;
  etapa?: string | null;
  arma_id?: string | null;
}

/** Tipos de documento sempre considerados do cofre permanente do cliente,
 *  mesmo se a `etapa` vier ausente ou divergente. Mantém a lista curta e
 *  conservadora — qualquer dúvida, cai em "processo". */
const TIPOS_CLIENTE = new Set<string>([
  "rg",
  "cnh",
  "cin",
  "cpf",
  "foto",
  "foto_3x4",
  "comprovante_endereco",
  "certidao_antecedentes",
  "antecedentes_criminais",
  "antecedentes_federal",
  "antecedentes_estadual",
  "antecedentes_militar",
  "antecedentes_eleitoral",
  "certidao_antecedentes_policia_civil_sp",
  "certidao_crimes_eleitorais_tse",
  "certidao_crimes_militares_stm",
  "certidao_criminal_tjmsp",
  "certidao_federal_trf3_regional",
  "certidao_federal_trf3_sjsp_jef",
  "certidao_tjsp_distribuicao_criminal",
  "certidao_tjsp_execucoes_criminais",
  "certidao_casamento",
  "certidao_nascimento",
  "certidao_alteracao_nome",
]);

const TIPOS_CAC_ATIVIDADE = new Set<string>([
  "comprovante_habitualidade",
  "comprovante_clube_tiro",
  "comprovante_competicao",
  "declaracao_guarda_acervo_1endereco",
  "declaracao_guarda_acervo_2enderecos",
]);

export function getDocumentoEscopo(doc: DocEscopavel | null | undefined): EscopoDocumento {
  if (!doc) return "processo";
  const tipo = String(doc.tipo_documento ?? "").trim().toLowerCase();
  const armaId = doc.arma_id != null && String(doc.arma_id).trim() !== "" ? String(doc.arma_id).trim() : null;

  // 1) vínculo com arma vence qualquer outra regra
  if (armaId || isDocDeArma(tipo)) return "arma";

  // 2) tipos permanentes do cofre do cliente
  if (tipo && TIPOS_CLIENTE.has(tipo)) return "cliente";

  // 2.5) documentos recorrentes de atividade CAC
  if (tipo && TIPOS_CAC_ATIVIDADE.has(tipo)) return "cac_atividade";

  // 3) etapas permanentes (mesmas das "3 caixas")
  if (doc.etapa && ETAPAS_PERMANENTES.has(doc.etapa)) return "cliente";

  // 4) default: específico do processo
  return "processo";
}

/**
 * Decide se um documento de origem pode ser reaproveitado para suprir a
 * exigência de destino. Regras:
 *   - escopos precisam ser iguais;
 *   - escopo "arma" exige `arma_id` igual (e não-vazio) em ambos;
 *   - escopo "cac_atividade" reaproveita entre itens do mesmo grupo
 *     quando o tipo também for o mesmo;
 *   - escopo "processo" NUNCA reaproveita automaticamente — quem pertence
 *     a um processo é específico daquele protocolo;
 *   - tipos diferentes nunca reaproveitam (a equivalência por sinônimo é
 *     responsabilidade da camada que conhece o catálogo).
 */
export function podeReaproveitarDocumento(
  origem: DocEscopavel | null | undefined,
  destino: DocEscopavel | null | undefined,
): boolean {
  if (!origem || !destino) return false;

  const tipoO = String(origem.tipo_documento ?? "").trim().toLowerCase();
  const tipoD = String(destino.tipo_documento ?? "").trim().toLowerCase();
  if (!tipoO || !tipoD || tipoO !== tipoD) return false;

  const escopoO = getDocumentoEscopo(origem);
  const escopoD = getDocumentoEscopo(destino);
  if (escopoO !== escopoD) return false;

  if (escopoD === "processo") return false;

  if (escopoD === "arma") {
    const aO = origem.arma_id ? String(origem.arma_id).trim() : "";
    const aD = destino.arma_id ? String(destino.arma_id).trim() : "";
    if (!aO || !aD) return false;
    if (aO !== aD) return false;
  }

  return true;
}

/**
 * Texto curto, em PT-BR, explicando por que o reaproveitamento foi
 * bloqueado. Útil para logs/eventos e para mensagens internas — não
 * substitui o copy de UI, que deve ser definido na camada de apresentação.
 * Retorna string vazia quando o reaproveitamento É permitido.
 */
export function motivoReaproveitamentoBloqueado(
  origem: DocEscopavel | null | undefined,
  destino: DocEscopavel | null | undefined,
): string {
  if (!origem || !destino) return "Documento de origem ou destino ausente.";

  const tipoO = String(origem.tipo_documento ?? "").trim().toLowerCase();
  const tipoD = String(destino.tipo_documento ?? "").trim().toLowerCase();
  if (!tipoO || !tipoD) return "Tipo de documento ausente.";
  if (tipoO !== tipoD) return `Tipos diferentes: "${tipoO}" não cobre "${tipoD}".`;

  const escopoO = getDocumentoEscopo(origem);
  const escopoD = getDocumentoEscopo(destino);
  if (escopoO !== escopoD) {
    return `Escopos incompatíveis: origem "${escopoO}" não pode suprir destino "${escopoD}".`;
  }

  if (escopoD === "processo") {
    return "Documento específico do processo — não é reaproveitável entre processos.";
  }

  if (escopoD === "arma") {
    const aO = origem.arma_id ? String(origem.arma_id).trim() : "";
    const aD = destino.arma_id ? String(destino.arma_id).trim() : "";
    if (!aO || !aD) return "Documento de arma sem `arma_id` definido em um dos lados.";
    if (aO !== aD) return `Documento pertence a outra arma (origem ${aO} ≠ destino ${aD}).`;
  }

  if (escopoD === "cac_atividade") {
    return "";
  }

  return "";
}

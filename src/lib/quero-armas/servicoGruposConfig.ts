// ============================================================================
// servicoGruposConfig.ts
// ----------------------------------------------------------------------------
// Define quais GRUPOS de exigências NÃO se aplicam a cada serviço.
// Regra: se um documento cai num grupo excluído para aquele serviço,
// ele é filtrado do checklist do popup guiado do cliente.
//
// Por que blacklist (excluídos) e não whitelist (permitidos)?
// Porque é mais seguro: se um documento novo aparecer no banco com um
// grupo ainda não mapeado, ele aparece em "Fechamento" em vez de sumir.
//
// Como manter: sempre que um novo serviço for adicionado ou um grupo de
// exigências mudar, atualize o registro desse serviço neste arquivo.
// ============================================================================

import type { PendenciaGrupoId } from "./pendenciasGrupos";

const VAZIO = new Set<PendenciaGrupoId>();

/**
 * Mapa declarativo: slug do serviço → conjunto de grupos excluídos.
 *
 * Serviços ausentes = sem exclusões (todos os grupos aparecem).
 */
const GRUPOS_EXCLUIDOS: Record<string, ReadonlySet<PendenciaGrupoId>> = {

  // ── Autorização de compra / posse civil ────────────────────────────────
  // Sem habitualidade (exigida só em CAC/porte).
  // Sem "Documentos da arma" — a arma ainda não existe; CRAF e nota fiscal
  // são do processo de REGISTRO, que ocorre após a autorização.
  "posse-arma-fogo":                           new Set(["habitualidade", "arma"]),
  "posse-de-arma-de-fogo":                     new Set(["habitualidade", "arma"]),

  // Pacote completo (compra + registro + posse): arma entra porque o CRAF
  // é gerado dentro deste mesmo processo.
  "aquisicao-registro-posse-de-arma-de-fogo":  new Set(["habitualidade"]),

  // ── Renovação de posse ──────────────────────────────────────────────────
  // Sem habitualidade; arma presente (CRAF sendo renovado).
  "renovacao-posse-de-arma-de-fogo":           new Set(["habitualidade"]),

  // ── Porte de arma ───────────────────────────────────────────────────────
  // Habitualidade obrigatória (atividade de tiro comprovada).
  // Arma pode aparecer (CRAF existente a registrar no porte).
  "porte-arma-fogo":                           VAZIO,
  "renovacao-de-porte-de-arma-de-fogo":        VAZIO,

  // ── CR (Certificado de Registro — Exército) ─────────────────────────────
  // Sem habitualidade (CR não exige vínculo com clube).
  // Sem "Documentos da arma" (CR é habilitação pessoal, não autorização de compra).
  "concessao-cr":                              new Set(["habitualidade", "arma"]),
  "renovacao-cr":                              new Set(["habitualidade", "arma"]),

  // ── Registro / Apostilamento ────────────────────────────────────────────
  // Focado nos documentos da arma (CRAF, nota fiscal).
  // Sem habitualidade, sem efetiva necessidade (já comprovada na posse original).
  "registro-arma-fogo":                        new Set(["habitualidade", "efetiva_necessidade"]),
  "apostilamento-atualizacao":                 new Set(["habitualidade", "efetiva_necessidade"]),

  // Registro/Apostilamento CAC: habitualidade SIM (clube obrigatório para CAC).
  "registro-e-apostilamento-de-arma-de-fogo-cac": new Set(["efetiva_necessidade"]),

  // ── CAC — Atiradores / Caçadores ────────────────────────────────────────
  // Habitualidade SIM (filiação e frequência ao clube são pré-requisito).
  // Arma SIM (autorização de compra refere-se a um item específico).
  // Efetiva necessidade NÃO (CAC não usa esse critério — o vínculo é o clube).
  "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac": new Set(["efetiva_necessidade"]),
  "autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac":       new Set(["efetiva_necessidade"]),

  // GTE (Guia de Tráfego Especial CAC): focado em habitualidade e arma.
  "guia-de-trafego-especial-cac":              new Set(["efetiva_necessidade"]),

  // ── Recursos e vias judiciais ───────────────────────────────────────────
  // Processo jurídico — centrado em declarações e requerimento.
  "recurso-administrativo":                    new Set(["habitualidade", "arma", "efetiva_necessidade", "laudos"]),
  "mandado-de-seguranca":                      new Set(["habitualidade", "arma", "efetiva_necessidade", "laudos"]),

  // ── Cursos / treinamento ────────────────────────────────────────────────
  // Apenas identificação e laudos básicos de aptidão para o curso.
  "operador-de-pistola-nivel-i":               new Set(["habitualidade", "arma", "efetiva_necessidade", "antecedentes", "endereco", "ocupacao"]),
  "vip-operador-de-pistola-nivel-i":           new Set(["habitualidade", "arma", "efetiva_necessidade", "antecedentes", "endereco", "ocupacao"]),
};

/**
 * Retorna o conjunto de grupos excluídos para o slug informado.
 * Serviços não mapeados retornam conjunto vazio (nenhuma exclusão).
 */
export function gruposExcluidosPorServico(slug: string | null | undefined): ReadonlySet<PendenciaGrupoId> {
  if (!slug) return VAZIO;
  return GRUPOS_EXCLUIDOS[slug] ?? VAZIO;
}

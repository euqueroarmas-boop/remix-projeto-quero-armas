// ============================================================================
// servicoGruposConfig.ts
// ----------------------------------------------------------------------------
// Define quais GRUPOS de exigências pertencem a cada serviço (whitelist).
//
// Regra: se um documento cai num grupo não listado para aquele serviço,
// ele é filtrado do popup guiado do cliente.
//
// Se um serviço não estiver mapeado aqui, nenhuma filtragem é aplicada
// (todos os grupos aparecem) — comportamento seguro para serviços novos.
//
// Como manter: sempre que um novo serviço for adicionado ou os grupos de um
// serviço existente mudarem, atualize o registro desse serviço aqui.
// ============================================================================

import type { PendenciaGrupoId } from "./pendenciasGrupos";

/**
 * Mapa declarativo: slug do serviço → conjunto de grupos permitidos.
 *
 * Apenas os grupos listados aparecem no popup guiado para aquele serviço.
 * Serviços ausentes = sem restrição (todos os grupos aparecem).
 */
const GRUPOS_PERMITIDOS: Record<string, ReadonlySet<PendenciaGrupoId>> = {

  // ── Autorização de compra / posse civil ────────────────────────────────
  "posse-arma-fogo": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "efetiva_necessidade",
    "laudos", "requerimento", "outros",
  ]),
  "posse-de-arma-de-fogo": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "efetiva_necessidade",
    "laudos", "requerimento", "outros",
  ]),

  // Pacote completo (compra + registro + posse): inclui documentos da arma.
  "aquisicao-registro-posse-de-arma-de-fogo": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "efetiva_necessidade",
    "laudos", "arma", "requerimento", "outros",
  ]),

  // ── Renovação de posse ──────────────────────────────────────────────────
  "renovacao-posse-de-arma-de-fogo": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "efetiva_necessidade",
    "laudos", "arma", "requerimento", "outros",
  ]),

  // ── Porte de arma ───────────────────────────────────────────────────────
  "porte-arma-fogo": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade", "efetiva_necessidade",
    "laudos", "arma", "requerimento", "outros",
  ]),
  "renovacao-de-porte-de-arma-de-fogo": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade", "efetiva_necessidade",
    "laudos", "arma", "requerimento", "outros",
  ]),

  // ── CR (Certificado de Registro — Exército) ─────────────────────────────
  "concessao-cr": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "efetiva_necessidade",
    "laudos", "requerimento", "outros",
  ]),
  "renovacao-cr": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "efetiva_necessidade",
    "laudos", "requerimento", "outros",
  ]),

  // ── Registro / Apostilamento ────────────────────────────────────────────
  "registro-arma-fogo": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "laudos", "arma", "requerimento", "outros",
  ]),
  "apostilamento-atualizacao": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "laudos", "arma", "requerimento", "outros",
  ]),

  // Registro/Apostilamento CAC: habitualidade é obrigatória.
  "registro-e-apostilamento-de-arma-de-fogo-cac": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade",
    "laudos", "arma", "requerimento", "outros",
  ]),

  // ── CAC — Atiradores / Caçadores ────────────────────────────────────────
  "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade",
    "laudos", "arma", "requerimento", "outros",
  ]),
  "autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade",
    "laudos", "arma", "requerimento", "outros",
  ]),

  // GTE (Guia de Tráfego Especial CAC)
  "guia-de-trafego-especial-cac": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade",
    "laudos", "arma", "requerimento", "outros",
  ]),

  // ── Recursos e vias judiciais ───────────────────────────────────────────
  "recurso-administrativo": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "declaracoes", "requerimento", "outros",
  ]),
  "mandado-de-seguranca": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "declaracoes", "requerimento", "outros",
  ]),

  // ── Cursos / treinamento ────────────────────────────────────────────────
  "operador-de-pistola-nivel-i": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "laudos", "requerimento", "outros",
  ]),
  "vip-operador-de-pistola-nivel-i": new Set<PendenciaGrupoId>([
    "assinaturas", "perguntas", "identificacao", "laudos", "requerimento", "outros",
  ]),
};

/**
 * Retorna o conjunto de grupos permitidos para o slug informado.
 * Retorna null para serviços não mapeados (sem restrição — todos os grupos aparecem).
 */
export function gruposPermitidosPorServico(slug: string | null | undefined): ReadonlySet<PendenciaGrupoId> | null {
  if (!slug) return null;
  return GRUPOS_PERMITIDOS[slug] ?? null;
}

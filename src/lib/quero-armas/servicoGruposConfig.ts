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

import { GRUPOS_NAO_FILTRAVEIS, type PendenciaGrupoId } from "./pendenciasGrupos";

/**
 * Mapa declarativo: slug do serviço → conjunto de grupos permitidos.
 *
 * Apenas os grupos listados aparecem no popup guiado para aquele serviço.
 * Serviços ausentes = sem restrição (todos os grupos aparecem).
 */
const GRUPOS_PERMITIDOS: Record<string, ReadonlySet<PendenciaGrupoId>> = {

  // ── Autorização de compra / posse civil ────────────────────────────────
  "posse-arma-fogo": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "efetiva_necessidade",
    "laudos", "requerimento", "outros",
  ]),
  "posse-de-arma-de-fogo": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "efetiva_necessidade",
    "laudos", "requerimento", "outros",
  ]),

  // Pacote completo (compra + registro + posse): inclui documentos da arma.
  "aquisicao-registro-posse-de-arma-de-fogo": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "efetiva_necessidade",
    "laudos", "arma", "requerimento", "outros",
  ]),

  // ── Renovação de posse ──────────────────────────────────────────────────
  "renovacao-posse-de-arma-de-fogo": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "efetiva_necessidade",
    "laudos", "arma", "requerimento", "outros",
  ]),

  // ── Porte de arma ───────────────────────────────────────────────────────
  "porte-arma-fogo": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade", "efetiva_necessidade",
    "laudos", "arma", "requerimento", "outros",
  ]),
  "renovacao-de-porte-de-arma-de-fogo": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade", "efetiva_necessidade",
    "laudos", "arma", "requerimento", "outros",
  ]),

  // ── CR (Certificado de Registro — Polícia Federal / Sinarm-CAC) ────────
  // IN DG/PF 311/2025, art. 18, § 2º: além do tronco comum (identidade,
  // endereço, ocupação lícita, idoneidade e laudos), o CR exige a filiação à
  // entidade de tiro ou de caça e o compromisso de habitualidade — grupo
  // `habitualidade` — e a segurança do acervo, DSA e DEGA — grupo `arma`.
  // Sem esses dois grupos aqui, as exigências existiam no checklist e eram
  // filtradas do popup do cliente, que é onde ele age.
  //
  // `efetiva_necessidade` NÃO entra: é requisito de posse/porte de defesa
  // pessoal, não do registro de CAC.
  "concessao-cr": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade", "arma", "declaracoes",
    "laudos", "requerimento", "outros",
  ]),
  "renovacao-cr": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade", "arma", "declaracoes",
    "laudos", "requerimento", "outros",
  ]),

  // ── Registro / Apostilamento ────────────────────────────────────────────
  "registro-arma-fogo": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "laudos", "arma", "requerimento", "outros",
  ]),
  "apostilamento-atualizacao": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "laudos", "arma", "requerimento", "outros",
  ]),

  // Registro/Apostilamento CAC: habitualidade é obrigatória.
  "registro-e-apostilamento-de-arma-de-fogo-cac": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade",
    "laudos", "arma", "requerimento", "outros",
  ]),

  // ── CAC — Atiradores / Caçadores ────────────────────────────────────────
  "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade",
    "laudos", "arma", "requerimento", "outros",
  ]),
  "autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade",
    "laudos", "arma", "requerimento", "outros",
  ]),

  // GTE (Guia de Tráfego Especial CAC)
  "guia-de-trafego-especial-cac": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "endereco",
    "ocupacao", "antecedentes", "habitualidade",
    "laudos", "arma", "requerimento", "outros",
  ]),

  // ── Recursos e vias judiciais ───────────────────────────────────────────
  "recurso-administrativo": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "declaracoes", "requerimento", "outros",
  ]),
  "mandado-de-seguranca": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "declaracoes", "requerimento", "outros",
  ]),

  // ── Cursos / treinamento ────────────────────────────────────────────────
  "operador-de-pistola-nivel-i": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "laudos", "requerimento", "outros",
  ]),
  "vip-operador-de-pistola-nivel-i": new Set<PendenciaGrupoId>([
    "exigencias_pf",
    "assinaturas", "perguntas", "identificacao", "laudos", "requerimento", "outros",
  ]),
};

/**
 * Retorna o conjunto de grupos permitidos para o slug informado.
 * Retorna null para serviços não mapeados (sem restrição — todos os grupos aparecem).
 */
export function gruposPermitidosPorServico(slug: string | null | undefined): ReadonlySet<PendenciaGrupoId> | null {
  if (!slug) return null;
  const base = GRUPOS_PERMITIDOS[slug];
  if (!base) return null;
  // Rede de segurança: `exigencias_pf` (e o que mais entrar em
  // GRUPOS_NAO_FILTRAVEIS) volta para dentro mesmo que o mapa acima esqueça.
  // Serviço novo cadastrado sem esse grupo escondia da fila do cliente o que a
  // Polícia Federal exigiu — com prazo de 10 dias correndo.
  if ([...GRUPOS_NAO_FILTRAVEIS].every((g) => base.has(g))) return base;
  return new Set<PendenciaGrupoId>([...base, ...GRUPOS_NAO_FILTRAVEIS]);
}

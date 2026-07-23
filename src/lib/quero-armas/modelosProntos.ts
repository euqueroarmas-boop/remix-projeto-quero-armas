/**
 * Modelos prontos de checklist por tipo de serviço.
 *
 * Cada modelo aponta para códigos da qa_documentos_biblioteca (seeds da
 * migration 20260722240000). Ao aplicar um modelo, o sistema busca as
 * linhas da biblioteca pelos codigos e cria as exigências no
 * qa_servicos_documentos do serviço destino.
 *
 * IMPORTANTE — aviso jurídico obrigatório:
 * Estes modelos são SUGERIDOS com base em instruções normativas vigentes
 * no momento da versão listada. A responsabilidade final de conferir e
 * publicar é do operador. Sempre valide contra a IN vigente na PF.
 */

export interface ModeloPronto {
  slug: string;
  titulo: string;
  descricao: string;
  aviso_juridico: string;
  versao: string; // YYYY-MM
  exigencias: Array<{
    codigo_biblioteca: string;
    obrigatorio: boolean;
    etapa?: "base" | "complementar" | "tecnico" | "final";
    ordem?: number;
  }>;
}

const AVISO_PADRAO_IN201 = "⚠️ Modelo sugerido baseado em IN DG/PF 201. Confira a instrução normativa vigente antes de publicar — a responsabilidade final é do operador.";
const AVISO_PADRAO_LEI = "⚠️ Modelo sugerido baseado na Lei 10.826/2003 e regulamentos vigentes. Confira antes de publicar — a responsabilidade final é do operador.";

function certidoesEstaduais(ordemInicial: number, etapa: "base" | "complementar" | "tecnico" | "final" = "complementar") {
  return [
    { codigo_biblioteca: "certidao_estadual_distribuicao_acoes_criminais", obrigatorio: true, etapa, ordem: ordemInicial },
    { codigo_biblioteca: "certidao_estadual_execucoes_criminais", obrigatorio: true, etapa, ordem: ordemInicial + 10 },
    { codigo_biblioteca: "certidao_estadual_policia_civil", obrigatorio: true, etapa, ordem: ordemInicial + 20 },
    { codigo_biblioteca: "certidao_estadual_justica_militar", obrigatorio: true, etapa, ordem: ordemInicial + 30 },
  ];
}

export const MODELOS_PRONTOS: ModeloPronto[] = [
  {
    slug: "posse_arma_fogo",
    titulo: "Posse de Arma de Fogo",
    descricao: "Checklist padrão para primeira aquisição de posse (IN DG/PF 201).",
    aviso_juridico: AVISO_PADRAO_IN201,
    versao: "2026-07",
    exigencias: [
      { codigo_biblioteca: "cin",                                        obrigatorio: true,  etapa: "base",         ordem: 10 },
      { codigo_biblioteca: "cpf",                                        obrigatorio: true,  etapa: "base",         ordem: 20 },
      { codigo_biblioteca: "comprovante_residencia",                     obrigatorio: true,  etapa: "base",         ordem: 30 },
      { codigo_biblioteca: "comprovante_ocupacao_licita",                obrigatorio: true,  etapa: "base",         ordem: 40 },
      { codigo_biblioteca: "certidao_antecedentes_criminais_federal",    obrigatorio: true,  etapa: "complementar", ordem: 50 },
      ...certidoesEstaduais(60),
      { codigo_biblioteca: "certidao_antecedentes_criminais_militar",    obrigatorio: true,  etapa: "complementar", ordem: 100 },
      { codigo_biblioteca: "certidao_antecedentes_criminais_eleitoral",  obrigatorio: true,  etapa: "complementar", ordem: 110 },
      { codigo_biblioteca: "laudo_psicologico",                          obrigatorio: true,  etapa: "tecnico",      ordem: 120 },
      { codigo_biblioteca: "laudo_capacidade_tecnica",                   obrigatorio: true,  etapa: "tecnico",      ordem: 130 },
    ],
  },
  {
    slug: "renovacao_posse",
    titulo: "Renovação de Posse de Arma de Fogo",
    descricao: "Renovação. Alguns documentos vigentes podem ser reaproveitados do hub.",
    aviso_juridico: AVISO_PADRAO_IN201,
    versao: "2026-07",
    exigencias: [
      { codigo_biblioteca: "cin",                                        obrigatorio: true,  etapa: "base",         ordem: 10 },
      { codigo_biblioteca: "comprovante_residencia",                     obrigatorio: true,  etapa: "base",         ordem: 20 },
      { codigo_biblioteca: "certidao_antecedentes_criminais_federal",    obrigatorio: true,  etapa: "complementar", ordem: 30 },
      ...certidoesEstaduais(40),
      { codigo_biblioteca: "laudo_psicologico",                          obrigatorio: true,  etapa: "tecnico",      ordem: 80 },
      { codigo_biblioteca: "laudo_capacidade_tecnica",                   obrigatorio: true,  etapa: "tecnico",      ordem: 90 },
    ],
  },
  {
    slug: "porte_transito",
    titulo: "Porte de Trânsito",
    descricao: "Porte de trânsito para CAC (IN DG/PF 201).",
    aviso_juridico: AVISO_PADRAO_IN201,
    versao: "2026-07",
    exigencias: [
      { codigo_biblioteca: "cin",                                        obrigatorio: true,  etapa: "base",         ordem: 10 },
      { codigo_biblioteca: "cpf",                                        obrigatorio: true,  etapa: "base",         ordem: 20 },
      { codigo_biblioteca: "comprovante_residencia",                     obrigatorio: true,  etapa: "base",         ordem: 30 },
      { codigo_biblioteca: "certidao_antecedentes_criminais_federal",    obrigatorio: true,  etapa: "complementar", ordem: 40 },
      ...certidoesEstaduais(50),
      { codigo_biblioteca: "craf",                                       obrigatorio: true,  etapa: "final",        ordem: 90 },
    ],
  },
  {
    slug: "cr_concessao",
    titulo: "CR — Certificado de Registro (Concessão)",
    descricao: "Concessão inicial de CR para CAC (colecionador/atirador/caçador).",
    aviso_juridico: AVISO_PADRAO_LEI,
    versao: "2026-07",
    exigencias: [
      { codigo_biblioteca: "cin",                                        obrigatorio: true,  etapa: "base",         ordem: 10 },
      { codigo_biblioteca: "cpf",                                        obrigatorio: true,  etapa: "base",         ordem: 20 },
      { codigo_biblioteca: "comprovante_residencia",                     obrigatorio: true,  etapa: "base",         ordem: 30 },
      { codigo_biblioteca: "comprovante_ocupacao_licita",                obrigatorio: true,  etapa: "base",         ordem: 40 },
      { codigo_biblioteca: "certidao_antecedentes_criminais_federal",    obrigatorio: true,  etapa: "complementar", ordem: 50 },
      ...certidoesEstaduais(60),
      { codigo_biblioteca: "certidao_antecedentes_criminais_militar",    obrigatorio: true,  etapa: "complementar", ordem: 100 },
      { codigo_biblioteca: "laudo_psicologico",                          obrigatorio: true,  etapa: "tecnico",      ordem: 110 },
      { codigo_biblioteca: "laudo_capacidade_tecnica",                   obrigatorio: true,  etapa: "tecnico",      ordem: 120 },
    ],
  },
  {
    slug: "craf_registro",
    titulo: "CRAF — Registro de Arma",
    descricao: "Registro de arma no CR (após aquisição).",
    aviso_juridico: AVISO_PADRAO_LEI,
    versao: "2026-07",
    exigencias: [
      { codigo_biblioteca: "cin",                                        obrigatorio: true,  etapa: "base",         ordem: 10 },
      { codigo_biblioteca: "nota_fiscal_arma",                           obrigatorio: true,  etapa: "base",         ordem: 20 },
      { codigo_biblioteca: "autorizacao_compra",                         obrigatorio: true,  etapa: "base",         ordem: 30 },
    ],
  },
  {
    slug: "gte",
    titulo: "GTE — Guia de Tráfego",
    descricao: "Emissão de Guia de Tráfego para transporte da arma.",
    aviso_juridico: AVISO_PADRAO_LEI,
    versao: "2026-07",
    exigencias: [
      { codigo_biblioteca: "cin",                                        obrigatorio: true,  etapa: "base",         ordem: 10 },
      { codigo_biblioteca: "craf",                                       obrigatorio: true,  etapa: "base",         ordem: 20 },
    ],
  },
  {
    slug: "aquisicao_arma",
    titulo: "Aquisição de Arma de Fogo",
    descricao: "Autorização de compra de arma para CAC habilitado.",
    aviso_juridico: AVISO_PADRAO_LEI,
    versao: "2026-07",
    exigencias: [
      { codigo_biblioteca: "cin",                                        obrigatorio: true,  etapa: "base",         ordem: 10 },
      { codigo_biblioteca: "cr_registro",                                obrigatorio: false, etapa: "base",         ordem: 20 },
      { codigo_biblioteca: "comprovante_residencia",                     obrigatorio: true,  etapa: "base",         ordem: 30 },
    ],
  },
  {
    slug: "aquisicao_municao",
    titulo: "Aquisição de Munição",
    descricao: "Autorização de compra de munição.",
    aviso_juridico: AVISO_PADRAO_LEI,
    versao: "2026-07",
    exigencias: [
      { codigo_biblioteca: "cin",                                        obrigatorio: true,  etapa: "base",         ordem: 10 },
      { codigo_biblioteca: "craf",                                       obrigatorio: true,  etapa: "base",         ordem: 20 },
    ],
  },
];

export function getModeloBySlug(slug: string): ModeloPronto | undefined {
  return MODELOS_PRONTOS.find((m) => m.slug === slug);
}

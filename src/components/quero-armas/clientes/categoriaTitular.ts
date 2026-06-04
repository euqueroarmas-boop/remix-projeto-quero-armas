/**
 * Categorização legal de titulares de armas de fogo
 * Base: Lei 10.826/03 (art. 6º), Decreto 11.615/23, IN 201/2023-DG/PF, IN 311 DG/PC
 *
 * Define as 5 categorias e a matriz de exigências documentais.
 * Categorias dispensadas de exames/laudos têm previsão expressa em lei.
 */

export type CategoriaTitular =
  | "pessoa_fisica"
  | "pessoa_juridica"
  | "seguranca_publica"
  | "magistrado_mp"
  | "militar";

export interface CategoriaInfo {
  value: CategoriaTitular;
  label: string;
  descricao: string;
  baseLegal: string;
  subcategorias: string[];
}

/**
 * Configuração das 5 categorias com subcategorias canônicas.
 */
export const CATEGORIAS: CategoriaInfo[] = [
  {
    value: "pessoa_fisica",
    label: "Pessoa Física (Cidadão Comum)",
    descricao: "Cidadão sem vínculo institucional. Sujeito a todas as exigências da Lei 10.826/03.",
    baseLegal: "Lei 10.826/03, art. 4º",
    subcategorias: [
      "Caçador",
      "Atirador Desportivo",
      "Colecionador",
      "Cidadão Comum (Posse)",
      "Outros",
    ],
  },
  {
    value: "pessoa_juridica",
    label: "Pessoa Jurídica",
    descricao: "Empresa de segurança privada, clube de tiro, escola de tiro, instituição.",
    baseLegal: "Lei 10.826/03, art. 6º, VI e VII",
    subcategorias: [
      "Empresa de Segurança Privada",
      "Empresa de Transporte de Valores",
      "Clube de Tiro",
      "Escola de Tiro",
      "Outros",
    ],
  },
  {
    value: "seguranca_publica",
    label: "Segurança Pública",
    descricao: "Agentes integrantes do art. 6º da Lei 10.826/03 — dispensados de laudo psi e exame de tiro.",
    baseLegal: "Lei 10.826/03, art. 6º, I a VII e §1º-A",
    subcategorias: [
      "Polícia Federal (PF)",
      "Polícia Rodoviária Federal (PRF)",
      "Polícia Ferroviária Federal",
      "Polícia Civil",
      "Polícia Militar",
      "Polícia Penal",
      "Corpo de Bombeiros Militar",
      "Agente Penitenciário Federal",
      "Guarda Municipal (>50.000 hab.)",
      "Agente da ABIN",
      "Agente do Depen",
      "Oficial de Justiça",
      "Auditor-Fiscal Federal",
      "Outros",
    ],
  },
  {
    value: "magistrado_mp",
    label: "Magistrado / Ministério Público",
    descricao: "Magistrados (LOMAN) e membros do MP — porte garantido por lei orgânica.",
    baseLegal: "LC 35/79 (LOMAN) art. 33, V; Lei 8.625/93 art. 42",
    subcategorias: [
      "Juiz Federal",
      "Juiz Estadual",
      "Juiz do Trabalho",
      "Desembargador",
      "Ministro",
      "Procurador da República",
      "Procurador de Justiça",
      "Promotor de Justiça",
      "Outros",
    ],
  },
  {
    value: "militar",
    label: "Militar",
    descricao: "Integrantes das Forças Armadas (ativa, inativa, reserva) — dispensados de laudo psi e exame de tiro.",
    baseLegal: "Lei 10.826/03, art. 6º, II; R-105 (Decreto 10.030/19)",
    subcategorias: [
      "Exército Brasileiro (ativa)",
      "Exército Brasileiro (inativo/reserva)",
      "Marinha do Brasil (ativa)",
      "Marinha do Brasil (inativa/reserva)",
      "Força Aérea Brasileira (ativa)",
      "Força Aérea Brasileira (inativa/reserva)",
      "Outros",
    ],
  },
];

export const CATEGORIA_MAP = Object.fromEntries(CATEGORIAS.map(c => [c.value, c])) as Record<CategoriaTitular, CategoriaInfo>;

/**
 * Matriz de exigências documentais por categoria.
 * `true` = exigido / `false` = dispensado por lei.
 */
export interface ExigenciasDocumentais {
  laudo_psicologico: boolean;
  exame_tiro: boolean;
  antecedentes_criminais: boolean;
  comprovante_efetiva_necessidade: boolean;
  comprovante_residencia: boolean;
  comprovante_ocupacao_licita: boolean;
  contrato_social: boolean;
  identidade_funcional: boolean;
}

export const EXIGENCIAS_POR_CATEGORIA: Record<CategoriaTitular, ExigenciasDocumentais> = {
  // Cidadão comum: TUDO exigido
  pessoa_fisica: {
    laudo_psicologico: true,
    exame_tiro: true,
    antecedentes_criminais: true,
    comprovante_efetiva_necessidade: true,
    comprovante_residencia: true,
    comprovante_ocupacao_licita: true,
    contrato_social: false,
    identidade_funcional: false,
  },
  // PJ: documentos da empresa, sem exames pessoais
  pessoa_juridica: {
    laudo_psicologico: false,
    exame_tiro: false,
    antecedentes_criminais: true,
    comprovante_efetiva_necessidade: true,
    comprovante_residencia: false,
    comprovante_ocupacao_licita: false,
    contrato_social: true,
    identidade_funcional: false,
  },
  // Segurança pública: dispensados de laudo psi e exame tiro (art. 6º §1º-A)
  seguranca_publica: {
    laudo_psicologico: false,
    exame_tiro: false,
    antecedentes_criminais: true,
    comprovante_efetiva_necessidade: false, // necessidade presumida
    comprovante_residencia: true,
    comprovante_ocupacao_licita: false,
    contrato_social: false,
    identidade_funcional: true,
  },
  // Magistrado/MP: porte garantido por lei orgânica
  magistrado_mp: {
    laudo_psicologico: false,
    exame_tiro: false,
    antecedentes_criminais: false, // presunção de idoneidade
    comprovante_efetiva_necessidade: false,
    comprovante_residencia: true,
    comprovante_ocupacao_licita: false,
    contrato_social: false,
    identidade_funcional: true,
  },
  // Militar: dispensados de laudo psi e exame tiro
  militar: {
    laudo_psicologico: false,
    exame_tiro: false,
    antecedentes_criminais: true,
    comprovante_efetiva_necessidade: false,
    comprovante_residencia: true,
    comprovante_ocupacao_licita: false,
    contrato_social: false,
    identidade_funcional: true,
  },
};

/**
 * Helper: retorna exigências do cliente. Se categoria for NULL/desconhecida,
 * assume pessoa_fisica (mais restritivo) — mas a UI deve sinalizar pendência.
 */
export function getExigencias(categoria: string | null | undefined): ExigenciasDocumentais {
  if (categoria && categoria in EXIGENCIAS_POR_CATEGORIA) {
    return EXIGENCIAS_POR_CATEGORIA[categoria as CategoriaTitular];
  }
  return EXIGENCIAS_POR_CATEGORIA.pessoa_fisica;
}

/**
 * Helper: verifica se um item específico é dispensado por lei.
 */
export function isDispensado(categoria: string | null | undefined, item: keyof ExigenciasDocumentais): boolean {
  if (!categoria) return false; // sem categoria = mostra tudo (pendente)
  const exig = getExigencias(categoria);
  return exig[item] === false;
}

/**
 * Helper: retorna a base legal da dispensa para exibir em badges.
 */
export function getBaseLegalDispensa(categoria: string | null | undefined): string {
  if (!categoria) return "";
  return CATEGORIA_MAP[categoria as CategoriaTitular]?.baseLegal || "";
}

export const CATEGORIA_OPTIONS = CATEGORIAS.map(c => ({ value: c.value, label: c.label }));

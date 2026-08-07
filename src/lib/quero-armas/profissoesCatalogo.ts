/**
 * Catálogo de profissões — fonte única.
 *
 * REGRA: a lista abaixo é o cruzamento EXATO das profissões já gravadas em
 * `public.qa_clientes.profissao`. Nada foi inventado e nada foi fundido:
 * variantes semanticamente equivalentes ("EMPRESÁRIO" / "EMPRESARIO" /
 * "EMPRESÁRIA", "GUARDA MUNICIPAL" / "GUARDA CIVIL MUNICIPAL") são
 * preservadas de propósito — a mismatch semântica é mantida para não
 * reescrever cadastro histórico nem quebrar cruzamentos já existentes.
 *
 * O campo de profissão é SELECIONÁVEL: não se digita profissão livre.
 */
export const PROFISSOES_CATALOGO: string[] = [
  "ADMINISTRADOR",
  "AGENTE SOCIOEDUCATIVO",
  "APOSENTAD0",
  "ASSESSOR PARLAMEN",
  "AUXILIAR TÉCNICO EM INFORMÁTICA TI",
  "COORDENADOR DE PRODUÇÃO",
  "DIRETOR INDUSTRIAL",
  "ECONOMISTA",
  "ELETRICISTA",
  "EMPRESARIO",
  "EMPRESÁRIA",
  "EMPRESÁRIO",
  "EMPRESÁRIO/ ADMINISTRADOR",
  "ENGENHEIRO",
  "ENGENHEIRO AGRONÔMO",
  "ENGENHEIRO CIVIL",
  "GERENTE DE LOJA",
  "GESTOR DE SEGURANÇA",
  "GUARDA CIVIL MUNICIPAL",
  "GUARDA MUNICIPAL",
  "INVESTIGADOR DE POLÍCIA",
  "MEI",
  "MICRO EMPREENDEDOR INDIVIDUAL",
  "MILITAR FORÇA AÉREA/ 3º SARGENTO",
  "MOTORISTA DE CAMINHÃO",
  "OURIVES",
  "PERITO FORENSE",
  "PERITO JUDICIAL TI",
  "POLICIAL MILITAR",
  "QUÍMICO",
  "TÉCNICO MECÂNICO",
  "VIGILANTE",
  "VIGLIANTE SEGURANÇA PESSOAL PRIVADO",
];

export const PROFISSAO_OPTIONS = PROFISSOES_CATALOGO.map((p) => ({ value: p, label: p }));

/**
 * Opções para edição: garante que o valor atualmente gravado no cadastro
 * continue selecionável mesmo que não esteja no catálogo (cadastro legado).
 */
export function profissaoOptionsCom(valorAtual?: string | null) {
  const v = String(valorAtual ?? "").trim();
  if (!v || PROFISSOES_CATALOGO.some((p) => p.toUpperCase() === v.toUpperCase())) {
    return PROFISSAO_OPTIONS;
  }
  return [{ value: v, label: v }, ...PROFISSAO_OPTIONS];
}

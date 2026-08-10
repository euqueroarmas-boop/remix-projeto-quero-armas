/**
 * Catálogo de profissão — fonte única.
 *
 * REGRA-MÃE: profissão é rótulo cadastral; ela NÃO gera exigência.
 * Quem ramifica o checklist é a CONDIÇÃO PROFISSIONAL (`condicao_profissional`),
 * com os valores canônicos de `CONDICOES_CHECKLIST`
 * (src/lib/quero-armas/simuladorChecklist.ts).
 *
 * Toda profissão precisa se encaixar em uma condição:
 *  - encaixe único      -> `condicaoSugeridaParaProfissao` devolve a condição
 *    (GUARDA CIVIL MUNICIPAL -> seguranca_publica, APOSENTADO -> aposentado…)
 *  - encaixe ambíguo    -> devolve null e o cliente/atendente escolhe
 *    (VIGILANTE pode ser CLT ou empresário; ENGENHEIRO pode ser CLT,
 *     autônomo ou empresário)
 *
 * O simulador e as dispensas NUNCA leem `profissao` — só `condicao_profissional`.
 */
import { CONDICOES_CHECKLIST } from "./simuladorChecklist";

export type CondicaoCanonica =
  | "clt"
  | "funcionario_publico"
  | "seguranca_publica"
  | "autonomo"
  | "empresario"
  | "aposentado";

type ProfissaoDef = {
  /** rótulo mostrado e gravado em `qa_clientes.profissao` (MAIÚSCULO). */
  label: string;
  /** condições possíveis; 1 = encaixe determinístico, 2+ = o usuário escolhe. */
  condicoes: CondicaoCanonica[];
};

/**
 * Profissões reais já existentes na base, normalizadas. Nenhuma inventada:
 * variantes ortográficas ("APOSENTAD0", "VIGLIANTE") são resolvidas por
 * `normalizarProfissao`, não duplicadas aqui.
 */
export const PROFISSOES_DEF: ProfissaoDef[] = [
  { label: "ADMINISTRADOR", condicoes: ["clt", "autonomo", "empresario"] },
  { label: "AGENTE SOCIOEDUCATIVO", condicoes: ["funcionario_publico"] },
  { label: "APOSENTADO OU PENSIONISTA", condicoes: ["aposentado"] },
  { label: "ASSESSOR PARLAMENTAR", condicoes: ["funcionario_publico"] },
  { label: "AUXILIAR TÉCNICO EM INFORMÁTICA (TI)", condicoes: ["clt", "autonomo"] },
  { label: "COORDENADOR DE PRODUÇÃO", condicoes: ["clt"] },
  { label: "DIRETOR INDUSTRIAL", condicoes: ["clt", "empresario"] },
  { label: "ECONOMISTA", condicoes: ["clt", "autonomo", "empresario"] },
  { label: "ELETRICISTA", condicoes: ["clt", "autonomo"] },
  { label: "EMPRESÁRIO", condicoes: ["empresario"] },
  { label: "ENGENHEIRO", condicoes: ["clt", "autonomo", "empresario"] },
  { label: "ENGENHEIRO AGRÔNOMO", condicoes: ["clt", "autonomo", "empresario"] },
  { label: "ENGENHEIRO CIVIL", condicoes: ["clt", "autonomo", "empresario"] },
  { label: "GERENTE DE LOJA", condicoes: ["clt"] },
  { label: "GESTOR DE SEGURANÇA", condicoes: ["clt", "empresario"] },
  { label: "GUARDA CIVIL MUNICIPAL", condicoes: ["seguranca_publica"] },
  { label: "INVESTIGADOR DE POLÍCIA", condicoes: ["seguranca_publica"] },
  { label: "MICROEMPREENDEDOR INDIVIDUAL (MEI)", condicoes: ["autonomo"] },
  { label: "MILITAR DAS FORÇAS ARMADAS", condicoes: ["seguranca_publica"] },
  { label: "MOTORISTA DE CAMINHÃO", condicoes: ["clt", "autonomo", "empresario"] },
  { label: "OURIVES", condicoes: ["autonomo", "empresario"] },
  { label: "PERITO FORENSE", condicoes: ["funcionario_publico", "autonomo"] },
  { label: "PERITO JUDICIAL", condicoes: ["autonomo", "empresario"] },
  { label: "POLICIAL CIVIL", condicoes: ["seguranca_publica"] },
  { label: "POLICIAL MILITAR", condicoes: ["seguranca_publica"] },
  { label: "QUÍMICO", condicoes: ["clt", "autonomo"] },
  { label: "SALGADEIRO", condicoes: ["autonomo", "empresario"] },
  { label: "TÉCNICO MECÂNICO", condicoes: ["clt", "autonomo"] },
  { label: "VIGILANTE", condicoes: ["clt", "empresario"] },
  { label: "OUTRA PROFISSÃO", condicoes: ["clt", "funcionario_publico", "seguranca_publica", "autonomo", "empresario", "aposentado"] },
];

export const PROFISSOES_CATALOGO: string[] = PROFISSOES_DEF.map((p) => p.label);

export const PROFISSAO_OPTIONS = PROFISSOES_CATALOGO.map((p) => ({ value: p, label: p }));

/** Rótulos das condições canônicas por valor. */
export const CONDICAO_LABEL: Record<string, string> = Object.fromEntries(
  CONDICOES_CHECKLIST.map((c) => [c.valor, c.label]),
);

const ACENTOS = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

/** Variantes legadas/erros de digitação -> rótulo canônico do catálogo. */
const ALIASES: Record<string, string> = {
  "APOSENTAD0": "APOSENTADO OU PENSIONISTA",
  "APOSENTADO": "APOSENTADO OU PENSIONISTA",
  "PENSIONISTA": "APOSENTADO OU PENSIONISTA",
  "EMPRESARIA": "EMPRESÁRIO",
  "EMPRESARIO": "EMPRESÁRIO",
  "EMPRESARIO/ ADMINISTRADOR": "EMPRESÁRIO",
  "EMPRESARIO / ADMINISTRADOR": "EMPRESÁRIO",
  "MEI": "MICROEMPREENDEDOR INDIVIDUAL (MEI)",
  "MICRO EMPREENDEDOR INDIVIDUAL": "MICROEMPREENDEDOR INDIVIDUAL (MEI)",
  "MICROEMPREENDEDOR INDIVIDUAL": "MICROEMPREENDEDOR INDIVIDUAL (MEI)",
  "GUARDA MUNICIPAL": "GUARDA CIVIL MUNICIPAL",
  "VIGLIANTE SEGURANCA PESSOAL PRIVADO": "VIGILANTE",
  "VIGILANTE SEGURANCA PESSOAL PRIVADO": "VIGILANTE",
  "ASSESSOR PARLAMEN": "ASSESSOR PARLAMENTAR",
  "AUXILIAR TECNICO EM INFORMATICA TI": "AUXILIAR TÉCNICO EM INFORMÁTICA (TI)",
  "ENGENHEIRO AGRONOMO": "ENGENHEIRO AGRÔNOMO",
  "PERITO JUDICIAL TI": "PERITO JUDICIAL",
  "MILITAR FORCA AEREA/ 3o SARGENTO": "MILITAR DAS FORÇAS ARMADAS",
  "SERVIDOR DE SEGURANCA PUBLICA (PM, PC, PF, PRF, GUARDA, BOMBEIRO, AGENTE PENITENCIARIO)": "POLICIAL MILITAR",
};

/** Normaliza qualquer texto livre para um rótulo do catálogo (ou null). */
export function normalizarProfissao(valor?: string | null): string | null {
  const bruto = String(valor ?? "").trim();
  if (!bruto) return null;
  const chave = ACENTOS(bruto);
  const alias = ALIASES[chave];
  if (alias) return alias;
  const direto = PROFISSOES_CATALOGO.find((p) => ACENTOS(p) === chave);
  if (direto) return direto;
  const parcial = PROFISSOES_CATALOGO.find(
    (p) => p !== "OUTRA PROFISSÃO" && (ACENTOS(p).startsWith(chave) || chave.startsWith(ACENTOS(p))),
  );
  return parcial ?? null;
}

/** Condições possíveis para a profissão (vazio = todas). */
export function condicoesDaProfissao(profissao?: string | null): CondicaoCanonica[] {
  const label = normalizarProfissao(profissao);
  const def = PROFISSOES_DEF.find((p) => p.label === label);
  return def ? def.condicoes : [];
}

/**
 * Condição sugerida quando o encaixe é único; null quando a profissão admite
 * mais de um caminho — nesse caso o campo de condição é obrigatório e o
 * sistema não chuta.
 */
export function condicaoSugeridaParaProfissao(profissao?: string | null): CondicaoCanonica | null {
  const c = condicoesDaProfissao(profissao);
  return c.length === 1 ? c[0] : null;
}

/**
 * Compatibilidade: mapa rótulo -> condição, apenas para os encaixes únicos.
 * Mantém também os rótulos das condições canônicas (cadastros legados que
 * gravaram a condição no campo profissão).
 */
export const PROFISSAO_PARA_CONDICAO: Record<string, string> = {
  ...Object.fromEntries(CONDICOES_CHECKLIST.map((c) => [c.label, c.valor])),
  ...Object.fromEntries(
    PROFISSOES_DEF.filter((p) => p.condicoes.length === 1).map((p) => [p.label, p.condicoes[0]]),
  ),
};

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

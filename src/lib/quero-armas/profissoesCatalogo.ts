/**
 * Catálogo de profissão — fonte única.
 *
 * REGRA: profissão NÃO é cargo livre ("açougueiro", "policial militar").
 * O que importa para o processo é a CONDIÇÃO DE OCUPAÇÃO LÍCITA, porque é
 * ela que ramifica o checklist e define qual comprovante de renda/ocupação
 * o cliente precisa entregar (CTPS, contracheque, DECORE, contrato social,
 * extrato do INSS...). Por isso o select espelha exatamente as condições
 * canônicas de `CONDICOES_CHECKLIST` (src/lib/quero-armas/simuladorChecklist.ts).
 *
 * A mismatch semântica é preservada onde ela tem efeito jurídico:
 * "SERVIDOR PÚBLICO (ÁREA GERAL)" ≠ "SERVIDOR DE SEGURANÇA PÚBLICA", pois
 * apenas o segundo abre a trilha institucional (Portaria Conjunta 1/2024).
 */
import { CONDICOES_CHECKLIST } from "./simuladorChecklist";

export const PROFISSOES_CATALOGO: string[] = CONDICOES_CHECKLIST.map((c) => c.label);

/** label da condição -> valor canônico usado em `condicao_profissional`. */
export const PROFISSAO_PARA_CONDICAO: Record<string, string> = Object.fromEntries(
  CONDICOES_CHECKLIST.map((c) => [c.label, c.valor]),
);

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

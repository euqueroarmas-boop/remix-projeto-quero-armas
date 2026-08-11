/**
 * Valores-sentinela que a leitura por IA devolve quando o documento NÃO traz o
 * dado. Sem esse tratamento, textos como "(não consta)" eram comparados com o
 * cadastro e viravam divergência — reprovando documento por dado inexistente.
 */
const SENTINELAS = [
  "nao consta",
  "nao informado",
  "nao declarado",
  "nao identificado",
  "nao localizado",
  "nao aplicavel",
  "nao se aplica",
  "sem informacao",
  "ilegivel",
  "indisponivel",
  "n/a",
  "na",
  "nd",
  "null",
  "undefined",
];

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[()[\]{}.:;,"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** true quando o valor lido equivale a "o documento não traz esse dado". */
export function valorAusente(valor: string | null | undefined): boolean {
  if (valor === null || valor === undefined) return true;
  const n = normalizar(String(valor));
  if (!n) return true;
  if (/^[-—–*_?\s]+$/.test(n)) return true;
  return SENTINELAS.includes(n);
}

/** Normaliza o resultado de laudo/atestado para 'apto' | 'inapto' | null. */
export function normalizarAptidao(valor: string | null | undefined): "apto" | "inapto" | null {
  if (valorAusente(valor)) return null;
  const n = normalizar(String(valor));
  if (/\binapt/.test(n) || /\bnao apt/.test(n) || /\bcontra ?indicad/.test(n)) return "inapto";
  if (/\bapt/.test(n) || /\bhabilitad/.test(n) || /\bfavoravel\b/.test(n)) return "apto";
  return null;
}

// ============================================================================
// titularComprovante.ts — titularidade do comprovante de endereço
// ----------------------------------------------------------------------------
// Regra canônica (08/08/2026):
//   CPF ilegível NÃO é titular alheio. Falha de leitura nunca vira presunção
//   de que o comprovante é de outra pessoa — e jamais reprova a conta.
//
// Estados possíveis do CPF impresso na fatura:
//   • "valido"    → 11 dígitos com DV correto. É prova.
//   • "mascarado" → concessionária imprime ***.123.456-** . É prova PARCIAL:
//                   confrontamos os dígitos visíveis com o CPF que o cliente
//                   informa, sem nunca reprovar por causa da máscara.
//   • "ausente"   → nada legível. Só o nome decide, e, se o nome não decidir,
//                   o resultado é "indeterminada" (pergunta-se ao cliente).
// ============================================================================

import { comparePersonNames } from "./nameMatch";

export type EstadoCpfLido = "valido" | "mascarado" | "ausente";

export interface CpfLido {
  estado: EstadoCpfLido;
  /** 11 dígitos quando `estado === "valido"`. */
  digitos: string | null;
  /** Padrão de 11 posições com dígitos e `*` quando mascarado. */
  padrao: string | null;
  bruto: string | null;
}

/** Dígitos verificadores do CPF. Sem isso, "12345678900" passaria por CPF. */
export function cpfDvValido(digitos: string): boolean {
  const d = String(digitos || "").replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (base: number) => {
    let soma = 0;
    for (let i = 0; i < base; i++) soma += Number(d[i]) * (base + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/**
 * Lê o CPF como ele aparece no documento, preservando a máscara.
 *
 * Aceita `***.123.456-**`, `123.456.789-09`, `XXX.456.789-XX`. Qualquer
 * caractere que não seja dígito nem separador vira `*`.
 */
export function lerCpfDocumento(raw: string | null | undefined): CpfLido {
  const bruto = raw ? String(raw).trim() : null;
  if (!bruto) return { estado: "ausente", digitos: null, padrao: null, bruto: null };

  const seq = bruto
    .replace(/[.\-\s/]/g, "")
    .replace(/[^0-9]/g, "*");

  if (seq.length !== 11) {
    const so = bruto.replace(/\D/g, "");
    if (so.length === 11 && cpfDvValido(so)) {
      return { estado: "valido", digitos: so, padrao: so, bruto };
    }
    return { estado: "ausente", digitos: null, padrao: null, bruto };
  }

  if (!seq.includes("*")) {
    return cpfDvValido(seq)
      ? { estado: "valido", digitos: seq, padrao: seq, bruto }
      : { estado: "ausente", digitos: null, padrao: seq, bruto };
  }

  const visiveis = seq.replace(/\*/g, "").length;
  if (visiveis < 3) return { estado: "ausente", digitos: null, padrao: seq, bruto };
  return { estado: "mascarado", digitos: null, padrao: seq, bruto };
}

/** Quantos dígitos ficaram visíveis na máscara. */
export function digitosVisiveis(cpf: CpfLido): number {
  if (cpf.estado === "valido") return 11;
  return (cpf.padrao || "").replace(/\*/g, "").length;
}

/**
 * Confronta o CPF informado pelo cliente com os dígitos visíveis da fatura.
 * Só confirma quando TODAS as posições legíveis batem.
 */
export function confrontarCpfParcial(
  cpf: CpfLido,
  cpfInformado: string | null | undefined,
): { ok: boolean; motivo?: string } {
  const informado = String(cpfInformado || "").replace(/\D/g, "");
  if (informado.length !== 11) return { ok: false, motivo: "Informe os 11 dígitos do CPF." };
  if (!cpfDvValido(informado)) return { ok: false, motivo: "CPF informado é inválido." };
  if (cpf.estado === "valido") {
    return cpf.digitos === informado
      ? { ok: true }
      : { ok: false, motivo: "O CPF informado não é o que consta no comprovante." };
  }
  const padrao = cpf.padrao || "";
  if (padrao.length !== 11) return { ok: false, motivo: "Não foi possível ler o CPF do comprovante." };
  for (let i = 0; i < 11; i++) {
    if (padrao[i] === "*") continue;
    if (padrao[i] !== informado[i]) {
      return { ok: false, motivo: "Os dígitos visíveis do comprovante não batem com o CPF informado." };
    }
  }
  return { ok: true };
}

export type Titularidade = "propria" | "terceiro" | "indeterminada";

export interface AvaliacaoTitularidade {
  resultado: Titularidade;
  /** `true` quando dá para resolver perguntando o CPF ao cliente. */
  pedirConfrontoCpf: boolean;
  cpf: CpfLido;
  motivo: string;
}

/**
 * Decide de quem é o comprovante. Conservador por desenho: só devolve
 * "terceiro" com CPF completo e válido divergente, ou nome inequivocamente
 * de outra pessoa. Tudo mais é "indeterminada".
 */
export function avaliarTitularidadeComprovante(params: {
  nomeDoc?: string | null;
  cpfDoc?: string | null;
  nomeRef?: string | null;
  cpfRef?: string | null;
}): AvaliacaoTitularidade {
  const cpf = lerCpfDocumento(params.cpfDoc);
  const cpfRef = String(params.cpfRef || "").replace(/\D/g, "");
  const nomeVeredicto = comparePersonNames(params.nomeDoc, params.nomeRef);

  if (cpf.estado === "valido" && cpfRef.length === 11) {
    if (cpf.digitos === cpfRef) {
      return { resultado: "propria", pedirConfrontoCpf: false, cpf, motivo: "CPF do comprovante confere com o cadastro." };
    }
    return {
      resultado: "terceiro",
      pedirConfrontoCpf: false,
      cpf,
      motivo: "O CPF impresso no comprovante é de outra pessoa.",
    };
  }

  if (nomeVeredicto === "match") {
    return { resultado: "propria", pedirConfrontoCpf: false, cpf, motivo: "Nome do titular confere com o cadastro." };
  }

  if (cpf.estado === "mascarado") {
    return {
      resultado: "indeterminada",
      pedirConfrontoCpf: true,
      cpf,
      motivo: "O CPF do comprovante está mascarado pela concessionária.",
    };
  }

  if (nomeVeredicto === "mismatch") {
    return {
      resultado: "terceiro",
      pedirConfrontoCpf: false,
      cpf,
      motivo: "O nome do titular do comprovante é de outra pessoa.",
    };
  }

  return {
    resultado: "indeterminada",
    pedirConfrontoCpf: true,
    cpf,
    motivo: "Não foi possível ler o CPF do titular no comprovante.",
  };
}

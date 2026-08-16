// ============================================================================
// requerimentoSinarm — leitura do número e do vencimento do requerimento da PF
// ----------------------------------------------------------------------------
// O requerimento gerado no SINARM traz, impresso nas três páginas da via da
// Polícia Federal, um número de 18 dígitos no formato AAAAMMDDHHMMSSNNNN — o
// mesmo dado codificado no código de barras. Conferido em requerimentos reais:
//
//   202509251233571981   202512241149324512   202510161000094067
//   202601121214505266   202512231337283396
//
// É por esse número que o cliente reabre o requerimento no site da PF para
// emitir e pagar o boleto da GRU. Por isso a validação é ESTRITA: um dígito
// trocado leva a um requerimento que não é o dele. Preferimos não mostrar
// número nenhum a mostrar um número errado.
//
// ESPELHO: a mesma extração roda na edge `qa-processo-doc-validar-ia`, que
// grava `numero_requerimento` em `dados_extraidos_json` quando o documento é
// validado. Front e edge não compartilham módulo (Deno x Vite), então as duas
// cópias precisam mudar juntas — mesma convenção já usada em pendenciasGrupos.
// ============================================================================

/**
 * Número do requerimento: 18 dígitos começando pelo ano (20xx).
 * Ancorado nas duas pontas para não casar com um trecho de número maior.
 */
export const RE_NUMERO_REQUERIMENTO = /^20\d{16}$/;

/** Mesmo formato, para varrer um texto corrido (OCR / texto do PDF). */
const RE_NUMERO_NO_TEXTO = /\b(20\d{16})\b/;

/**
 * Valida um valor já conhecido (ex.: vindo de `dados_extraidos_json`).
 * Devolve só dígitos quando o formato bate; `null` caso contrário.
 */
export function normalizarNumeroRequerimento(valor: unknown): string | null {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  return RE_NUMERO_REQUERIMENTO.test(digitos) ? digitos : null;
}

/** Procura o número do requerimento dentro de um texto. */
export function extrairNumeroRequerimento(texto: unknown): string | null {
  const m = String(texto ?? "").match(RE_NUMERO_NO_TEXTO);
  return m ? m[1] : null;
}

/**
 * Data de vencimento impressa pela própria PF (30 dias da emissão).
 *
 * No PDF gerado pela PF o rótulo sai DEPOIS do valor na ordem de leitura
 * ("202509251233571981 26/10/2025Data de Vencimento:NÚMERO DO REQUERIMENTO:"),
 * por isso a primeira tentativa casa valor-antes-do-rótulo. A segunda cobre o
 * caso normal, rótulo antes do valor.
 *
 * Devolve ISO (aaaa-mm-dd) para entrar direto em coluna `date`.
 */
export function extrairVencimentoRequerimento(texto: unknown): string | null {
  const s = String(texto ?? "");
  const br =
    s.match(/(\d{2}\/\d{2}\/\d{4})\s*Data\s+de\s+Vencimento/i)?.[1] ??
    s.match(/Data\s+de\s+Vencimento[:\s]*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ??
    null;
  if (!br) return null;
  const [dd, mm, aaaa] = br.split("/");
  const iso = `${aaaa}-${mm}-${dd}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/**
 * Extrai o número a partir do `dados_extraidos_json` de um documento.
 * Aceita as chaves que a IA e o extrator usam, na ordem de confiança.
 */
/** Códigos com que a exigência do requerimento aparece no catálogo. */
export const REQUERIMENTO_SINARM_TIPOS = new Set<string>([
  "requerimento_de_posse_de_arma_de_fogo",
  "requerimento_posse_arma_fogo",
  "requerimento_posse",
  "requerimento_sinarm",
]);

export function ehRequerimentoSinarm(tipo: unknown): boolean {
  return REQUERIMENTO_SINARM_TIPOS.has(String(tipo ?? "").trim().toLowerCase());
}

/**
 * Prazo de entrega da documentação: 15 dias corridos a partir do requerimento.
 *
 * NÃO confundir com a "Data de Vencimento" impressa no documento, que fica ~30
 * dias à frente. São dois relógios: o impresso é a validade do requerimento em
 * si; este é o prazo operacional para instruir o processo. Passados os 15 dias
 * sem a documentação completa, a Polícia Federal marca o requerimento como
 * EXPIRADO — e é esse o prazo que a equipe persegue.
 */
export const PRAZO_ENTREGA_DOCUMENTACAO_DIAS = 15;

/**
 * Data de emissão a partir do próprio número do requerimento.
 *
 * Os 18 dígitos são AAAAMMDDHHMMSSNNNN — os 8 primeiros são a data em que o
 * requerimento foi gerado no SINARM. Ler daí é mais confiável que qualquer
 * outra fonte: não depende de OCR de rótulo nem de o cliente informar nada,
 * e o número já é validado pelo formato.
 */
export function dataEmissaoDoNumero(numero: unknown): string | null {
  const n = normalizarNumeroRequerimento(numero);
  if (!n) return null;
  const iso = `${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6, 8)}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Guarda contra dígitos que passam no formato mas não são data real
  // (ex.: mês 13, dia 32 — o Date "corrige" e muda o valor).
  return d.toISOString().slice(0, 10) === iso ? iso : null;
}

export type FaixaPrazoRequerimento = "ok" | "warn" | "bad" | "expirado";

export interface PrazoRequerimento {
  /** Último dia para entregar a documentação completa (ISO). */
  dataLimite: string;
  /** Dias corridos restantes; negativo quando já passou. */
  diasRestantes: number;
  /**
   * Faixa da badge, na régua acordada com a equipe:
   *   15–10 verde · 9–5 amarelo · 4–0 vermelho · negativo expirado.
   * É a mesma régua de ciclo curto de `validadeDocumento` (crítico 4,
   * atenção 9), de propósito: um documento, uma cor, em toda tela.
   */
  faixa: FaixaPrazoRequerimento;
}

function somarDiasISO(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diffDiasISO(de: string, ate: string): number {
  const a = new Date(`${de}T00:00:00Z`).getTime();
  const b = new Date(`${ate}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Prazo de entrega a partir da data de emissão do requerimento.
 * `hojeISO` é injetável para o cálculo ser testável e não depender do relógio.
 */
export function prazoEntregaRequerimento(
  emissaoISO: string | null | undefined,
  hojeISO: string,
): PrazoRequerimento | null {
  if (!emissaoISO || !/^\d{4}-\d{2}-\d{2}$/.test(emissaoISO)) return null;
  const dataLimite = somarDiasISO(emissaoISO, PRAZO_ENTREGA_DOCUMENTACAO_DIAS);
  const diasRestantes = diffDiasISO(hojeISO, dataLimite);
  const faixa: FaixaPrazoRequerimento =
    diasRestantes < 0 ? "expirado" : diasRestantes <= 4 ? "bad" : diasRestantes <= 9 ? "warn" : "ok";
  return { dataLimite, diasRestantes, faixa };
}

export function numeroRequerimentoDeDadosExtraidos(
  dados: unknown,
): string | null {
  const src = (dados ?? {}) as Record<string, unknown>;
  const candidatos = [
    src.numero_requerimento,
    src.numero_processo,
    src.numero_protocolo,
    src.protocolo,
    src.numero,
  ];
  for (const v of candidatos) {
    const n = normalizarNumeroRequerimento(v);
    if (n) return n;
  }
  return null;
}

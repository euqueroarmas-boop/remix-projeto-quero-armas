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

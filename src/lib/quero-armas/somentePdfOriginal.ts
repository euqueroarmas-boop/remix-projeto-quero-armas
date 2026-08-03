// ============================================================================
// somentePdfOriginal.ts
// ----------------------------------------------------------------------------
// Regra canônica (03/08/2026): em NENHUMA fase do processo se aceita print,
// foto de tela ou "scan" de documento. Todo documento entra como PDF ORIGINAL
// emitido pelo órgão/emissor.
//
// ÚNICA exceção: a FOTO 3x4 do titular — que por natureza é uma imagem e pode
// ser reenquadrada pelo cliente e enviada como arquivo de imagem (JPG/PNG).
// ============================================================================

/** Tipos que aceitam arquivo de imagem (a foto do titular e nada mais). */
const TIPOS_IMAGEM_PERMITIDA = new Set<string>([
  "foto_3x4",
  "foto",
  "foto_titular",
  "fotografia",
]);

export function tipoAceitaImagem(tipo: string | null | undefined): boolean {
  const t = String(tipo || "").toLowerCase().trim();
  if (!t) return false;
  if (TIPOS_IMAGEM_PERMITIDA.has(t)) return true;
  // Cobre variações do catálogo: "foto_3x4_titular", "foto 3x4" etc.
  return /^foto([_\s-]|$)/.test(t) || t.includes("3x4");
}

export const MSG_SOMENTE_PDF_ORIGINAL =
  "Só aceitamos o PDF ORIGINAL emitido pelo órgão. Foto, print ou digitalização do documento não são aceitos em nenhuma fase do processo. Baixe o arquivo em PDF no site do emissor e anexe aqui.";

export const MSG_FOTO_SOMENTE_IMAGEM =
  "Para a foto 3x4 envie um arquivo de imagem (JPG ou PNG) já reenquadrado.";

/** `accept` do <input type="file"> conforme o tipo de documento. */
export function acceptPorTipo(tipo: string | null | undefined): string {
  return tipoAceitaImagem(tipo) ? "image/jpeg,image/png,image/webp" : "application/pdf";
}

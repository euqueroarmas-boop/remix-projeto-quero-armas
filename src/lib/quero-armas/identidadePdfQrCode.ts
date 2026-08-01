// ============================================================================
// identidadePdfQrCode.ts
// ----------------------------------------------------------------------------
// Trava de aceite do DOCUMENTO OFICIAL DE IDENTIDADE (CIN / RG / CNH).
//
// Regra de negócio (01/08/2026): só é aceito o PDF original baixado na
// Carteira de Documentos do gov.br — o arquivo que traz o QR Code de
// verificação. Foto de documento, print e "scan" não valem mais.
//
// A conferência é feita por parse do texto do PDF (pdf.js) procurando:
//   1) marcadores de verificação/QR Code do gov.br;
//   2) as características dos documentos que já treinamos (CIN, RG, CNH).
// ============================================================================

export const TIPOS_IDENTIDADE_PDF_QR = new Set<string>([
  "cin",
  "rg_com_cpf",
  "rg",
  "cnh",
  "documento_identidade",
  "identidade",
]);

export function isTipoIdentidadeComQr(tipo: string | null | undefined): boolean {
  if (!tipo) return false;
  return TIPOS_IDENTIDADE_PDF_QR.has(String(tipo).toLowerCase().trim());
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

/** Marcadores de verificação/QR Code presentes no PDF oficial do gov.br. */
const MARCADORES_QR = [
  "QR CODE",
  "QRCODE",
  "VALIDAR.ESTALEIRO",
  "VALIDAR.GOV.BR",
  "VERIFICADOR",
  "VERIFICACAO",
  "AUTENTICIDADE",
  "CODIGO DE VERIFICACAO",
  "CARTEIRA DE DOCUMENTOS",
  "GOV.BR",
  "SERPRO",
  "CHAVE DE ACESSO",
];

/** Características dos documentos já treinados. */
const MARCADORES_DOCUMENTO: Array<{ tipo: string; termos: string[] }> = [
  { tipo: "cin", termos: ["CARTEIRA DE IDENTIDADE NACIONAL", "IDENTIDADE NACIONAL", "CIN"] },
  { tipo: "cnh", termos: ["CARTEIRA NACIONAL DE HABILITACAO", "PERMISSAO PARA DIRIGIR", "CONDUTOR", "DENATRAN", "RENACH"] },
  { tipo: "rg_com_cpf", termos: ["REGISTRO GERAL", "CARTEIRA DE IDENTIDADE", "SECRETARIA DE SEGURANCA PUBLICA", "SSP"] },
];

export interface ResultadoTravaIdentidade {
  ok: boolean;
  motivo?: string;
  tipoDetectado?: string;
  temQr: boolean;
}

/**
 * Avalia o texto extraído do PDF. Não faz download nem chamada de rede:
 * o chamador já leu o arquivo com pdf.js.
 */
export function avaliarPdfIdentidade(texto: string): ResultadoTravaIdentidade {
  const t = normalizar(texto || "");
  const temQr = MARCADORES_QR.some((m) => t.includes(m));
  const doc = MARCADORES_DOCUMENTO.find((d) => d.termos.some((termo) => t.includes(termo)));

  if (!t.trim()) {
    return {
      ok: false,
      temQr: false,
      motivo:
        "Não conseguimos ler nenhum texto neste PDF — ele parece ser só a imagem/foto do documento. Baixe o PDF original na Carteira de Documentos do gov.br.",
    };
  }
  if (!temQr) {
    return {
      ok: false,
      temQr: false,
      tipoDetectado: doc?.tipo,
      motivo:
        "Este PDF não tem o QR Code de verificação do gov.br. Só aceitamos o arquivo original baixado na Carteira de Documentos (gov.br), que sai com o QR Code de autenticidade.",
    };
  }
  if (!doc) {
    return {
      ok: false,
      temQr: true,
      motivo:
        "O PDF tem QR Code, mas não reconhecemos as características de CIN, RG ou CNH. Confira se baixou o documento de identidade certo na Carteira de Documentos do gov.br.",
    };
  }
  return { ok: true, temQr: true, tipoDetectado: doc.tipo };
}

/** Mensagem única usada quando o cliente envia foto/imagem em vez de PDF. */
export const MSG_IDENTIDADE_SOMENTE_PDF =
  "Para o documento de identidade aceitamos SOMENTE o PDF com QR Code baixado na Carteira de Documentos do gov.br. Foto, print ou digitalização não são aceitos.";

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
//
// 15/08/2026 — a CNH-e baixada no app Carteira Digital de Trânsito estava
// sendo recusada. O PDF dela (Producer "CDT") traz TODO o documento como
// imagem; a única camada de texto é o cabeçalho "SECRETARIA NACIONAL DE
// TRÂNSITO - SENATRAN" mais o rodapé do Assinador Serpro. Nenhum dos termos
// que tínhamos treinado para CNH aparecia ali — procurávamos DENATRAN e o
// documento diz SENATRAN. Daí a recusa "não reconhecemos as características".
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

/**
 * Normaliza para comparação por PALAVRA INTEIRA.
 *
 * Toda pontuação vira espaço e o resultado sai cercado de espaços. Assim
 * "QR-CODE" casa com o marcador "QR CODE" (o PDF do SENATRAN escreve com
 * hífen) e "https://www.serpro.gov.br/" casa com "GOV.BR", sem que uma sigla
 * curta como CIN case dentro de outra palavra.
 */
function normalizar(texto: string): string {
  return ` ${(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()} `;
}

function contem(textoNormalizado: string, termo: string): boolean {
  return textoNormalizado.includes(normalizar(termo));
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

/**
 * Prova, na camada de texto, de que o PDF nasceu assinado digitalmente pelo
 * órgão — e não de uma foto/print reimpressa. É o que autoriza aceitar um QR
 * Code de conteúdo binário (ver `avaliarQrVisualIdentidade`).
 */
const MARCADORES_ASSINATURA = [
  "ASSINADOR SERPRO",
  "ASSINADO COM CERTIFICADO DIGITAL",
  "MEDIDA PROVISORIA N 2200 2",
  "MP 2200 2",
  "ICP BRASIL",
  "CERTIFICADO DIGITAL",
];

/**
 * Documentos de VEÍCULO. Saem do mesmo SENATRAN, com o mesmo cabeçalho e o
 * mesmo rodapé do Serpro — sem esta exclusão, um CRLV-e passaria como se
 * fosse CNH.
 */
const MARCADORES_VEICULO = [
  "CRLV",
  "CRV",
  "ATPV",
  "CERTIFICADO DE REGISTRO E LICENCIAMENTO",
  "LICENCIAMENTO DE VEICULO",
  "REGISTRO E LICENCIAMENTO DE VEICULO",
];

/** Características dos documentos já treinados. */
const MARCADORES_DOCUMENTO: Array<{ tipo: string; termos: string[] }> = [
  { tipo: "cin", termos: ["CARTEIRA DE IDENTIDADE NACIONAL", "IDENTIDADE NACIONAL", "CIN"] },
  {
    tipo: "cnh",
    termos: [
      "CARTEIRA NACIONAL DE HABILITACAO",
      "PERMISSAO PARA DIRIGIR",
      "CONDUTOR",
      "DENATRAN",
      "RENACH",
      // Layout do app Carteira Digital de Trânsito (CNH-e):
      "SENATRAN",
      "SECRETARIA NACIONAL DE TRANSITO",
      "CARTEIRA DIGITAL DE TRANSITO",
      "CNH DIGITAL",
      "CNH",
      "CNH E",
    ],
  },
  { tipo: "rg_com_cpf", termos: ["REGISTRO GERAL", "CARTEIRA DE IDENTIDADE", "SECRETARIA DE SEGURANCA PUBLICA", "SSP"] },
];

export interface ResultadoTravaIdentidade {
  ok: boolean;
  motivo?: string;
  tipoDetectado?: string;
  temQr: boolean;
}

/** O PDF traz, em texto, a marca de assinatura digital do órgão emissor. */
export function temAssinaturaDigitalOficial(texto: string): boolean {
  const t = normalizar(texto);
  return MARCADORES_ASSINATURA.some((m) => contem(t, m));
}

/**
 * Avalia o texto extraído do PDF. Não faz download nem chamada de rede:
 * o chamador já leu o arquivo com pdf.js.
 */
export function avaliarPdfIdentidade(texto: string): ResultadoTravaIdentidade {
  const t = normalizar(texto);
  const temQr = MARCADORES_QR.some((m) => contem(t, m));
  const ehVeiculo = MARCADORES_VEICULO.some((m) => contem(t, m));
  const doc = ehVeiculo
    ? undefined
    : MARCADORES_DOCUMENTO.find((d) => d.termos.some((termo) => contem(t, termo)));

  if (!t.trim()) {
    return {
      ok: false,
      temQr: false,
      motivo:
        "Não encontramos o QR Code de autenticidade neste PDF — ele parece ser só a imagem/foto do documento. Baixe o PDF original (CIN ou CNH digital) na Carteira de Documentos do gov.br.",
    };
  }
  if (ehVeiculo) {
    return {
      ok: false,
      temQr,
      motivo:
        "Este PDF é documento de veículo (CRLV/CRV), não documento de identidade. Envie a CIN, o RG com CPF ou a CNH.",
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

/**
 * Veredicto do caminho VISUAL — quando o parse de texto não reconheceu o
 * documento e fomos procurar o QR Code no pixel.
 *
 * O QR da CNH-e não é uma URL: são ~530 bytes binários (assinatura ECDSA do
 * Serpro). Por isso não basta exigir domínio oficial no conteúdo — um QR de
 * conteúdo binário é aceito quando o PDF também traz, em texto, a marca da
 * assinatura digital do órgão. Uma foto/print reimpressa em PDF não tem esse
 * rodapé em texto, então a trava contra print continua valendo.
 */
export function avaliarQrVisualIdentidade(
  qr: { encontrado: boolean; oficial: boolean; binario?: boolean },
  textoPdf: string,
): boolean {
  if (!qr.encontrado) return false;
  if (qr.oficial) return true;
  return Boolean(qr.binario) && temAssinaturaDigitalOficial(textoPdf);
}

/** Mensagem única usada quando o cliente envia foto/imagem em vez de PDF. */
export const MSG_IDENTIDADE_SOMENTE_PDF =
  "Para o documento de identidade aceitamos SOMENTE o PDF com QR Code baixado na Carteira de Documentos do gov.br. Foto, print ou digitalização não são aceitos.";

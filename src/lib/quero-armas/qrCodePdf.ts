// ============================================================================
// qrCodePdf.ts
// ----------------------------------------------------------------------------
// Leitura VISUAL de QR Code dentro de um PDF.
//
// Por que existe: a CNH digital (CNH-e) e parte das CIN baixadas na Carteira de
// Documentos do gov.br saem como PDF de IMAGEM — não têm camada de texto. A
// trava antiga rejeitava esses arquivos legítimos por "não conseguimos ler
// nenhum texto". Aqui renderizamos as páginas e procuramos o QR Code de
// autenticidade de verdade, no pixel.
// ============================================================================

import { carregarPdfjs } from "./extracaoLocalPdf";

export interface ResultadoQrPdf {
  encontrado: boolean;
  conteudo?: string;
  /** QR aponta para um domínio oficial (gov.br / serpro / denatran). */
  oficial: boolean;
}

const DOMINIOS_OFICIAIS = [
  "gov.br",
  "serpro",
  "denatran",
  "senatran",
  "validar",
  "valida.",
  "estaleiro",
];

/** Renderiza as primeiras páginas e tenta decodificar qualquer QR Code. */
export async function lerQrCodeDoPdf(file: File, maxPaginas = 3): Promise<ResultadoQrPdf> {
  try {
    const [{ getDocument }, jsQRmod] = await Promise.all([
      carregarPdfjs(),
      import("jsqr"),
    ]);
    const jsQR = (jsQRmod as unknown as { default: typeof import("jsqr").default }).default;

    const buf = await file.arrayBuffer();
    const pdf = await getDocument({ data: buf }).promise;
    const paginas = Math.min(pdf.numPages, maxPaginas);

    for (let i = 1; i <= paginas; i++) {
      const page = await pdf.getPage(i);
      // Escala alta: QR Code costuma ser pequeno no canto do documento.
      const viewport = page.getViewport({ scale: 3 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;

      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
      if (code?.data) {
        const alvo = code.data.toLowerCase();
        return {
          encontrado: true,
          conteudo: code.data,
          oficial: DOMINIOS_OFICIAIS.some((d) => alvo.includes(d)),
        };
      }
    }
    return { encontrado: false, oficial: false };
  } catch (e) {
    console.warn("[qrCodePdf] falha ao procurar QR Code:", e);
    return { encontrado: false, oficial: false };
  }
}

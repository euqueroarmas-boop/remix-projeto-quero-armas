import { logAndPersistError, type WmtiError } from "@/lib/errorLogger";

export interface PdfDownloadResult {
  success: boolean;
  method?: "direct" | "blob";
  error?: WmtiError;
}

/**
 * Validates a PDF URL before opening it. Returns null if valid, error string otherwise.
 */
async function validatePdfUrl(url: string): Promise<string | null> {
  if (!url || typeof url !== "string") return "URL do PDF está vazia ou inválida";
  try {
    new URL(url);
  } catch {
    return "URL do PDF não é uma URL válida";
  }

  try {
    const resp = await fetch(url, { method: "HEAD" });
    if (!resp.ok) return `Arquivo retornou HTTP ${resp.status}`;
    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("pdf") && !ct.includes("octet-stream")) {
      return `Tipo de arquivo inesperado: ${ct}`;
    }
    const cl = resp.headers.get("content-length");
    if (cl && parseInt(cl) < 100) return "Arquivo PDF parece estar vazio";
  } catch (e) {
    // HEAD may fail due to CORS – try GET fallback
    return null; // allow blob fallback
  }
  return null;
}

/**
 * Robust PDF download: validates URL, tries direct open, falls back to blob download.
 */
export async function downloadPdf(
  pdfUrl: string,
  fileName: string,
  context?: { quoteId?: string; contractId?: string },
): Promise<PdfDownloadResult> {
  // Validate
  const validationError = await validatePdfUrl(pdfUrl);

  if (!validationError) {
    // Try direct open first
    const win = window.open(pdfUrl, "_blank", "noopener,noreferrer");
    if (win) return { success: true, method: "direct" };
  }

  // Fallback: fetch as blob and force download
  try {
    const resp = await fetch(pdfUrl);
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      const err = await logAndPersistError({
        action: "download_pdf_blob",
        message: `Falha ao baixar PDF: HTTP ${resp.status}`,
        technicalMessage: errBody,
        httpStatus: resp.status,
        responseBody: errBody,
        quoteId: context?.quoteId,
        contractId: context?.contractId,
        functionName: "downloadPdf",
      });
      return { success: false, error: err };
    }

    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("pdf") && !ct.includes("octet-stream")) {
      const body = await resp.text().catch(() => "");
      const err = await logAndPersistError({
        action: "download_pdf_content_type",
        message: `Arquivo não é um PDF válido (${ct})`,
        technicalMessage: body.substring(0, 500),
        quoteId: context?.quoteId,
        contractId: context?.contractId,
        functionName: "downloadPdf",
      });
      return { success: false, error: err };
    }

    const blob = await resp.blob();
    if (blob.size < 100) {
      const err = await logAndPersistError({
        action: "download_pdf_empty",
        message: "Arquivo PDF está vazio ou corrompido",
        quoteId: context?.quoteId,
        contractId: context?.contractId,
        functionName: "downloadPdf",
      });
      return { success: false, error: err };
    }

    // Force programmatic download
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    return { success: true, method: "blob" };
  } catch (e) {
    const err = await logAndPersistError({
      action: "download_pdf_exception",
      message: "Erro ao processar o download do contrato",
      error: e,
      quoteId: context?.quoteId,
      contractId: context?.contractId,
      functionName: "downloadPdf",
    });
    return { success: false, error: err };
  }
}

import { supabase } from "@/integrations/supabase/client";
import { logAndPersistError, type WmtiError } from "@/lib/errorLogger";

export interface PdfDownloadResult {
  success: boolean;
  method?: "proxy";
  error?: WmtiError;
}

/**
 * Fetches PDF bytes from the serve-contract-pdf proxy (never exposes storage URLs).
 */
async function fetchPdfFromProxy(quoteId?: string, contractId?: string): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke("serve-contract-pdf", {
    body: { quote_id: quoteId, contract_id: contractId },
  });

  if (error) throw new Error(error.message || "Falha ao buscar PDF");

  // supabase.functions.invoke returns data as parsed JSON when content-type is JSON,
  // but returns raw data for binary — we need to handle both cases
  if (data instanceof Blob) return data;

  // If we got JSON back, it's an error response
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(data.error as string);
  }

  throw new Error("Resposta inesperada do servidor");
}

/**
 * Downloads a contract PDF via the WMTi proxy. Never exposes Supabase URLs.
 */
export async function downloadPdf(
  fileName: string,
  context: { quoteId?: string; contractId?: string },
): Promise<PdfDownloadResult> {
  try {
    const blob = await fetchPdfFromProxy(context.quoteId, context.contractId);

    if (blob.size < 100) {
      const err = await logAndPersistError({
        action: "download_pdf_empty",
        message: "Arquivo PDF está vazio ou corrompido",
        quoteId: context.quoteId,
        contractId: context.contractId,
        functionName: "serve-contract-pdf",
      });
      return { success: false, error: err };
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    return { success: true, method: "proxy" };
  } catch (e) {
    const err = await logAndPersistError({
      action: "download_pdf_exception",
      message: "Erro ao processar o download do contrato",
      error: e,
      quoteId: context.quoteId,
      contractId: context.contractId,
      functionName: "serve-contract-pdf",
    });
    return { success: false, error: err };
  }
}

/**
 * Opens a contract PDF in a new tab via blob URL (never exposes storage domain).
 */
export async function viewPdf(
  context: { quoteId?: string; contractId?: string },
): Promise<PdfDownloadResult> {
  try {
    const blob = await fetchPdfFromProxy(context.quoteId, context.contractId);

    if (blob.size < 100) {
      const err = await logAndPersistError({
        action: "view_pdf_empty",
        message: "Arquivo PDF está vazio ou corrompido",
        quoteId: context.quoteId,
        contractId: context.contractId,
        functionName: "serve-contract-pdf",
      });
      return { success: false, error: err };
    }

    const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
    window.open(blobUrl, "_blank", "noopener,noreferrer");

    return { success: true, method: "proxy" };
  } catch (e) {
    const err = await logAndPersistError({
      action: "view_pdf_exception",
      message: "Erro ao visualizar o contrato",
      error: e,
      quoteId: context.quoteId,
      contractId: context.contractId,
      functionName: "serve-contract-pdf",
    });
    return { success: false, error: err };
  }
}

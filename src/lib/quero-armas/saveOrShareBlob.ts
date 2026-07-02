// ============================================================================
// saveOrShareBlob — download robusto que funciona em iOS Safari / in-app.
// ----------------------------------------------------------------------------
// Estratégia:
//   1) navigator.share({ files }) quando canShare aceitar o arquivo (iOS/Android)
//   2) window.open(blobUrl, "_blank") como fallback (abre no visualizador nativo)
//   3) <a download> como último recurso (funciona no desktop)
//
// Todos os caminhos devolvem { ok, method } para telemetria/UX. O caller deve
// segurar o blobUrl vivo até a interação terminar; o helper devolve `revoke()`.
// ============================================================================

export type SaveOrShareMethod = "share" | "open" | "download" | "cancelled" | "failed";

export interface SaveOrShareResult {
  ok: boolean;
  method: SaveOrShareMethod;
  error?: unknown;
}

export function isMobileUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent);
}

function inferMime(filename: string, fallback: string): string {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "doc") return "application/msword";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return fallback || "application/octet-stream";
}

/**
 * Tenta compartilhar via Web Share (iOS/Android) e cai para open/download.
 * Preferência: `preferShare` (mobile) x download (desktop).
 */
export async function saveOrShareBlob(
  blob: Blob,
  filename: string,
  opts?: { preferShare?: boolean }
): Promise<SaveOrShareResult> {
  const preferShare = opts?.preferShare ?? isMobileUA();
  const mime = blob.type || inferMime(filename, "application/octet-stream");
  const typed = blob.type ? blob : new Blob([blob], { type: mime });

  // 1) Web Share com arquivo (iOS 15+/Android)
  if (preferShare && typeof navigator !== "undefined" && "share" in navigator) {
    try {
      const file = new File([typed], filename, { type: mime });
      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return { ok: true, method: "share" };
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (aborted) return { ok: false, method: "cancelled" };
      // segue para os fallbacks
    }
  }

  // 2) Abrir em nova aba (iOS Safari costuma renderizar PDF/DOCX via visualizador nativo)
  const url = URL.createObjectURL(typed);
  try {
    if (preferShare) {
      const win = window.open(url, "_blank");
      if (win) {
        // Revoga depois — o navegador ainda precisa ler a URL.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return { ok: true, method: "open" };
      }
    }

    // 3) Download clássico (desktop e fallback final)
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { ok: true, method: "download" };
  } catch (err) {
    URL.revokeObjectURL(url);
    return { ok: false, method: "failed", error: err };
  }
}

/** Cria um URL persistente para o blob e devolve `revoke()`. */
export function createBlobUrl(blob: Blob): { url: string; revoke: () => void } {
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}
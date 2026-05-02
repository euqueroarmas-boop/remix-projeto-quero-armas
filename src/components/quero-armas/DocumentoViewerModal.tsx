import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, AlertTriangle, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * DocumentoViewerModal — Visualizador interno de arquivos.
 *
 * Objetivo: NUNCA expor URLs do Supabase Storage / signed URLs na barra
 * do navegador. Toda visualização acontece dentro de um modal, usando
 * `URL.createObjectURL(blob)` para PDFs e imagens.
 *
 * Modos suportados:
 *  - { bucket, path }  → baixa via supabase.storage.download
 *  - { url }           → faz fetch direto na URL (já assinada por outra função)
 *
 * Sempre revoga o object URL ao fechar.
 */

export type DocumentoViewerSource =
  | { kind: "storage"; bucket: string; path: string; fileName?: string }
  | { kind: "url"; url: string; fileName?: string };

interface Props {
  open: boolean;
  onClose: () => void;
  source: DocumentoViewerSource | null;
  title?: string;
  /** Permite baixar o arquivo. Default: true. */
  allowDownload?: boolean;
}

function inferMimeFromName(name: string | undefined): string {
  const ext = (name || "").toLowerCase().split(".").pop() || "";
  if (ext === "pdf") return "application/pdf";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "heic") return "image/heic";
  return "application/octet-stream";
}

export default function DocumentoViewerModal({
  open,
  onClose,
  source,
  title,
  allowDownload = true,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string>("application/octet-stream");
  const [error, setError] = useState<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  const fileName = useMemo(() => {
    if (!source) return "documento";
    if (source.fileName) return source.fileName;
    if (source.kind === "storage") return source.path.split("/").pop() || "documento";
    try {
      const u = new URL(source.url);
      return u.pathname.split("/").pop() || "documento";
    } catch {
      return "documento";
    }
  }, [source]);

  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlobUrl(null);

    (async () => {
      try {
        let blob: Blob;
        if (source.kind === "storage") {
          const { data, error } = await supabase.storage
            .from(source.bucket)
            .download(source.path);
          if (error) throw error;
          blob = data;
        } else {
          const resp = await fetch(source.url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          blob = await resp.blob();
        }
        if (cancelled) return;
        const detected = blob.type && blob.type !== "application/octet-stream"
          ? blob.type
          : inferMimeFromName(fileName);
        const url = URL.createObjectURL(blob);
        lastUrlRef.current = url;
        setMime(detected);
        setBlobUrl(url);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Falha ao carregar arquivo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, source, fileName]);

  // Revoga blob ao fechar / desmontar
  useEffect(() => {
    if (!open && lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
      setBlobUrl(null);
    }
    return () => {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
    };
  }, [open]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isPdf = mime.includes("pdf");
  const isImage = mime.startsWith("image/");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="qa-scope max-w-5xl w-[95vw] h-[90vh] p-0 bg-white border border-slate-300 flex flex-col overflow-hidden"
      >
        <DialogHeader className="px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-[12px] font-bold uppercase tracking-wider text-slate-900 truncate">
              {title || fileName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {allowDownload && blobUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-[10px] uppercase tracking-wider"
                  onClick={handleDownload}
                >
                  <Download className="h-3 w-3 mr-1" /> Baixar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-slate-100 relative overflow-auto">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-[10px] uppercase tracking-wider">Carregando arquivo…</span>
            </div>
          )}

          {!loading && error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-700 px-6 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              <div className="text-[12px] font-bold uppercase tracking-wider">Não foi possível abrir o arquivo</div>
              <div className="text-[11px] text-slate-500">{error}</div>
            </div>
          )}

          {!loading && !error && blobUrl && isPdf && (
            <object
              data={blobUrl}
              type="application/pdf"
              className="w-full h-full"
              aria-label={fileName}
            >
              <iframe src={blobUrl} className="w-full h-full border-0" title={fileName} />
            </object>
          )}

          {!loading && !error && blobUrl && isImage && (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={blobUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain shadow-lg bg-white"
              />
            </div>
          )}

          {!loading && !error && blobUrl && !isPdf && !isImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-700 px-6 text-center">
              <FileText className="h-10 w-10 text-slate-400" />
              <div className="text-[12px] font-bold uppercase tracking-wider">
                Pré-visualização não suportada
              </div>
              <div className="text-[11px] text-slate-500 max-w-md">
                Este formato ({mime}) não pode ser exibido no navegador.
                Use o botão abaixo para baixar.
              </div>
              {allowDownload && (
                <Button
                  size="sm"
                  className="h-8 px-3 text-[10px] uppercase tracking-wider"
                  onClick={handleDownload}
                >
                  <Download className="h-3 w-3 mr-1" /> Baixar arquivo
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook utilitário simples para controlar o modal a partir de qualquer tela.
 */
export function useDocumentoViewer() {
  const [source, setSource] = useState<DocumentoViewerSource | null>(null);
  const [title, setTitle] = useState<string | undefined>();
  const open = source !== null;
  return {
    open,
    source,
    title,
    abrirStorage: (bucket: string, path: string, opts?: { fileName?: string; title?: string }) => {
      setTitle(opts?.title);
      setSource({ kind: "storage", bucket, path, fileName: opts?.fileName });
    },
    abrirUrl: (url: string, opts?: { fileName?: string; title?: string }) => {
      setTitle(opts?.title);
      setSource({ kind: "url", url, fileName: opts?.fileName });
    },
    fechar: () => setSource(null),
  };
}

// Helper opcional: aviso padronizado para uso futuro
export function warnAvoidWindowOpen() {
  // eslint-disable-next-line no-console
  console.warn(
    "[DocumentoViewer] Não use window.open com signed URLs do Supabase. Use DocumentoViewerModal.",
  );
}

// Re-export ícone para conveniência (evita imports adicionais nos consumidores)
export { ExternalLink };
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, AlertTriangle, FileText, ExternalLink, RefreshCw, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
// PDF.js — renderiza PDF em <canvas>, evitando o viewer nativo do Edge
// (que frequentemente é bloqueado por políticas corporativas / “Esta página
// foi bloqueada pelo Microsoft Edge”).
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite resolve com ?url
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as string;

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
  /**
   * Quando informado, exibe o botão "APROVAR COMO MODELO IA" no header.
   * O handler deve aprovar o documento do cliente E promovê-lo a modelo
   * de aprendizado da IA em uma única operação atômica.
   */
  onAprovarComoModelo?: () => Promise<void> | void;
  aprovandoModelo?: boolean;
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
  onAprovarComoModelo,
  aprovandoModelo = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mime, setMime] = useState<string>("application/octet-stream");
  const [error, setError] = useState<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // PDF state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotal, setPdfTotal] = useState(0);
  const [pdfScale, setPdfScale] = useState(1.2);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    setBlob(null);
    setPdfDoc(null);
    setPdfPage(1);
    setPdfTotal(0);

    (async () => {
      try {
        let downloaded: Blob;
        if (source.kind === "storage") {
          const { data, error } = await supabase.storage
            .from(source.bucket)
            .download(source.path);
          if (error) throw error;
          downloaded = data;
        } else {
          const resp = await fetch(source.url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          downloaded = await resp.blob();
        }
        if (cancelled) return;
        const detected = downloaded.type && downloaded.type !== "application/octet-stream"
          ? downloaded.type
          : inferMimeFromName(fileName);
        const url = URL.createObjectURL(downloaded);
        lastUrlRef.current = url;
        setMime(detected);
        setBlobUrl(url);
        setBlob(downloaded);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Falha ao carregar arquivo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, source, fileName, reloadKey]);

  // Carrega o documento no PDF.js a partir do blob (sem usar URL externa).
  useEffect(() => {
    if (!blob || !mime.includes("pdf")) {
      setPdfDoc(null);
      return;
    }
    let cancelled = false;
    let task: any;
    (async () => {
      try {
        const buf = await blob.arrayBuffer();
        if (cancelled) return;
        task = pdfjsLib.getDocument({ data: buf, isEvalSupported: false });
        const doc = await task.promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setPdfTotal(doc.numPages);
        setPdfPage(1);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Falha ao processar PDF.");
      }
    })();
    return () => {
      cancelled = true;
      try { task?.destroy?.(); } catch {}
    };
  }, [blob, mime]);

  // Renderiza a página atual no canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: any;
    (async () => {
      try {
        const page = await pdfDoc.getPage(pdfPage);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: pdfScale });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (e) {
        // ignora erros de cancelamento
      }
    })();
    return () => {
      try { renderTask?.cancel?.(); } catch {}
      cancelled = true;
    };
  }, [pdfDoc, pdfPage, pdfScale]);

  // Revoga blob ao fechar / desmontar
  useEffect(() => {
    if (!open && lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
      setBlobUrl(null);
      setBlob(null);
      setPdfDoc(null);
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
        <DialogHeader className="px-4 py-3 pr-12 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-[12px] font-bold uppercase tracking-wider text-slate-900 truncate">
              {title || fileName}
            </DialogTitle>
            <div className="flex items-center gap-2 mr-2">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-700 px-6 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              <div className="text-[12px] font-bold uppercase tracking-wider">Não foi possível carregar a prévia do documento</div>
              <div className="text-[11px] text-slate-500 max-w-md break-words">{error}</div>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-[10px] uppercase tracking-wider"
                  onClick={() => setReloadKey((k) => k + 1)}
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
                </Button>
                {allowDownload && blobUrl && (
                  <Button
                    size="sm"
                    className="h-8 px-3 text-[10px] uppercase tracking-wider"
                    onClick={handleDownload}
                  >
                    <Download className="h-3 w-3 mr-1" /> Baixar arquivo
                  </Button>
                )}
              </div>
            </div>
          )}

          {!loading && !error && blobUrl && isPdf && (
            <div className="w-full h-full flex flex-col">
              <div className="flex items-center justify-center gap-2 px-3 py-2 border-b border-slate-200 bg-white shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  disabled={pdfPage <= 1}
                  onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-[10px] uppercase tracking-wider text-slate-700 min-w-[80px] text-center">
                  {pdfTotal ? `${pdfPage} / ${pdfTotal}` : "—"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  disabled={pdfPage >= pdfTotal}
                  onClick={() => setPdfPage((p) => Math.min(pdfTotal, p + 1))}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
                <div className="w-px h-4 bg-slate-300 mx-1" />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => setPdfScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))}
                  aria-label="Diminuir zoom"
                >
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="text-[10px] uppercase tracking-wider text-slate-700 min-w-[40px] text-center">
                  {Math.round(pdfScale * 100)}%
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => setPdfScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))}
                  aria-label="Aumentar zoom"
                >
                  <ZoomIn className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center p-4 bg-slate-200">
                {!pdfDoc ? (
                  <div className="flex flex-col items-center gap-2 text-slate-600 mt-10">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-[10px] uppercase tracking-wider">Renderizando PDF…</span>
                  </div>
                ) : (
                  <canvas ref={canvasRef} className="shadow-lg bg-white" />
                )}
              </div>
            </div>
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
                Pré-visualização indisponível
              </div>
              <div className="text-[11px] text-slate-500 max-w-md">
                Baixe o arquivo para visualizar ({mime}).
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
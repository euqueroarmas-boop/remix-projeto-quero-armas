import React, { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  X, Download, ExternalLink, Copy, ChevronLeft, ChevronRight,
  Image, Video, AlertTriangle, Loader2, Maximize2, ZoomIn, ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───
export interface MediaItem {
  url: string;
  type: "screenshot" | "video";
  label?: string;       // e.g. test name
  spec?: string;
  testTitle?: string;
  status?: string;
  timestamp?: string;
}

interface MediaViewerProps {
  items: MediaItem[];
  triggerLabel?: string;
  triggerIcon?: "screenshot" | "video" | "mixed";
  triggerVariant?: "outline" | "ghost" | "default";
  triggerSize?: "sm" | "default" | "icon";
}

// ─── Helpers ───
function fileName(url: string) {
  try {
    return decodeURIComponent(url.split("/").pop() || "arquivo");
  } catch {
    return url.split("/").pop() || "arquivo";
  }
}

async function forceDownload(url: string, name: string) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    toast.success("Download iniciado");
  } catch (e) {
    console.error("Download failed, opening in new tab", e);
    window.open(url, "_blank");
    toast.info("Abrindo em nova aba (download direto falhou)");
  }
}

function copyUrl(url: string) {
  navigator.clipboard.writeText(url).then(
    () => toast.success("URL copiada"),
    () => toast.error("Falha ao copiar"),
  );
}

// ─── Trigger Icon ───
function TriggerIcon({ type }: { type: "screenshot" | "video" | "mixed" }) {
  if (type === "video") return <Video className="h-3.5 w-3.5" />;
  if (type === "mixed") return <><Image className="h-3.5 w-3.5" /><Video className="h-3.5 w-3.5" /></>;
  return <Image className="h-3.5 w-3.5" />;
}

// ─── Main Component ───
export default function MediaViewer({
  items,
  triggerLabel,
  triggerIcon = "mixed",
  triggerVariant = "outline",
  triggerSize = "sm",
}: MediaViewerProps) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [loadErrors, setLoadErrors] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [zoomed, setZoomed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const prev = useCallback(() => setIdx((p) => (p > 0 ? p - 1 : (items?.length || 1) - 1)), [items?.length]);
  const next = useCallback(() => setIdx((p) => (p < (items?.length || 1) - 1 ? p + 1 : 0)), [items?.length]);

  const handleError = useCallback((i: number) => {
    setLoadErrors((p) => ({ ...p, [i]: true }));
    setLoading((p) => ({ ...p, [i]: false }));
  }, []);

  const handleLoaded = useCallback((i: number) => {
    setLoading((p) => ({ ...p, [i]: false }));
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setIdx(0);
    setLoadErrors({});
    setLoading({});
    setZoomed(false);
  }, []);

  if (!items || items.length === 0) return null;

  const current = items[idx];
  const isImage = current.type === "screenshot";
  const totalScreenshots = items.filter((i) => i.type === "screenshot").length;
  const totalVideos = items.filter((i) => i.type === "video").length;

  const label =
    triggerLabel ||
    [totalScreenshots > 0 ? `${totalScreenshots} screenshot${totalScreenshots > 1 ? "s" : ""}` : "", totalVideos > 0 ? `${totalVideos} vídeo${totalVideos > 1 ? "s" : ""}` : ""]
      .filter(Boolean)
      .join(" · ");


  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} className="text-xs gap-1.5" onClick={handleOpen}>
        <TriggerIcon type={triggerIcon} />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Full-screen on mobile, large on desktop */}
        <DialogContent className="p-0 gap-0 border-0 bg-background max-w-[100vw] max-h-[100dvh] w-screen h-[100dvh] sm:max-w-[92vw] sm:max-h-[92vh] sm:h-auto sm:w-auto sm:rounded-xl overflow-hidden">
          <DialogTitle className="sr-only">Visualizador de Mídia</DialogTitle>

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2.5 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {isImage ? <Image className="h-4 w-4 text-primary shrink-0" /> : <Video className="h-4 w-4 text-primary shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {current.testTitle || current.label || fileName(current.url)}
                </p>
                {current.spec && (
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{current.spec}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {items.length > 1 && (
                <span className="text-[10px] text-muted-foreground mr-1">
                  {idx + 1}/{items.length}
                </span>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => forceDownload(current.url, fileName(current.url))}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(current.url, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyUrl(current.url)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ── Main content ── */}
          <div className="flex-1 relative flex items-center justify-center bg-black/90 min-h-0 overflow-hidden"
            style={{ height: "calc(100dvh - 100px)", maxHeight: "calc(92vh - 100px)" }}>
            {/* Nav arrows */}
            {items.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
                  aria-label="Próximo"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            {/* Error state */}
            {loadErrors[idx] ? (
              <div className="p-8 text-center space-y-4 max-w-md">
                <AlertTriangle className="h-10 w-10 text-yellow-500 mx-auto" />
                <p className="text-sm font-medium text-white">
                  {isImage ? "Falha ao carregar screenshot" : "Falha ao carregar vídeo"}
                </p>
                <p className="text-[11px] text-white/60 break-all font-mono">{current.url}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button variant="secondary" size="sm" className="text-xs gap-1.5" onClick={() => window.open(current.url, "_blank")}>
                    <ExternalLink className="h-3 w-3" /> Abrir em nova aba
                  </Button>
                  <Button variant="secondary" size="sm" className="text-xs gap-1.5" onClick={() => copyUrl(current.url)}>
                    <Copy className="h-3 w-3" /> Copiar URL
                  </Button>
                  <Button variant="secondary" size="sm" className="text-xs gap-1.5" onClick={() => forceDownload(current.url, fileName(current.url))}>
                    <Download className="h-3 w-3" /> Tentar download
                  </Button>
                </div>
              </div>
            ) : isImage ? (
              /* ── Image viewer ── */
              <div className={`w-full h-full flex items-center justify-center ${zoomed ? "overflow-auto cursor-zoom-out" : "overflow-hidden cursor-zoom-in"}`}
                onClick={() => setZoomed((z) => !z)}>
                {loading[idx] !== false && !loadErrors[idx] && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Loader2 className="h-8 w-8 animate-spin text-white/50" />
                  </div>
                )}
                <img
                  ref={imgRef}
                  src={current.url}
                  alt={current.testTitle || `Screenshot ${idx + 1}`}
                  className={`transition-transform duration-200 ${zoomed ? "max-w-none w-auto h-auto" : "max-w-full max-h-full object-contain"}`}
                  onError={() => handleError(idx)}
                  onLoad={() => handleLoaded(idx)}
                  draggable={false}
                />
              </div>
            ) : (
              /* ── Video player ── */
              <video
                key={current.url}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full max-h-full object-contain"
                onError={() => handleError(idx)}
                onLoadedData={() => handleLoaded(idx)}
              >
                <source src={current.url} type="video/mp4" />
                Seu navegador não suporta vídeo HTML5.
              </video>
            )}

            {/* Zoom indicator for images */}
            {isImage && !loadErrors[idx] && (
              <button
                onClick={() => setZoomed((z) => !z)}
                className="absolute bottom-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
                aria-label={zoomed ? "Reduzir" : "Ampliar"}
              >
                {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              </button>
            )}
          </div>

          {/* ── Thumbnails bar ── */}
          {items.length > 1 && (
            <div className="flex gap-1.5 px-3 py-2 bg-card border-t border-border overflow-x-auto shrink-0">
              {items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => { setIdx(i); setZoomed(false); }}
                  className={`flex-shrink-0 w-16 h-11 sm:w-20 sm:h-14 rounded border overflow-hidden relative transition-all ${
                    i === idx
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border opacity-50 hover:opacity-100"
                  }`}
                >
                  {item.type === "video" ? (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Video className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : loadErrors[i] ? (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={`Miniatura ${i + 1}`}
                      className="w-full h-full object-cover"
                      onError={() => handleError(i)}
                      loading="lazy"
                    />
                  )}
                  {/* Type badge */}
                  <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[8px] px-1 rounded">
                    {item.type === "video" ? "VID" : "IMG"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── Context footer ── */}
          {(current.spec || current.status || current.timestamp) && (
            <div className="px-3 py-1.5 bg-card border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground shrink-0 overflow-x-auto">
              {current.status && (
                <span className={`font-medium ${current.status === "failed" ? "text-destructive" : "text-green-500"}`}>
                  {current.status}
                </span>
              )}
              {current.spec && <span className="font-mono truncate">{current.spec}</span>}
              {current.timestamp && <span>{new Date(current.timestamp).toLocaleString("pt-BR")}</span>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Convenience wrappers for backward compat ───
export function ScreenshotViewer({ urls, spec, testTitle }: { urls: string[]; spec?: string; testTitle?: string }) {
  const items: MediaItem[] = urls.map((url) => ({
    url,
    type: "screenshot" as const,
    spec,
    testTitle,
    status: "failed",
  }));
  return <MediaViewer items={items} triggerIcon="screenshot" triggerLabel={`Screenshots (${urls.length})`} />;
}

export function VideoViewer({ urls, spec }: { urls: string[]; spec?: string }) {
  const items: MediaItem[] = urls.map((url) => ({
    url,
    type: "video" as const,
    spec,
  }));
  return <MediaViewer items={items} triggerIcon="video" triggerLabel={`Vídeos (${urls.length})`} />;
}

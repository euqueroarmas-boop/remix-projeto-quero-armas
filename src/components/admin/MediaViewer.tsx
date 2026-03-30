import React, { useState, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  X, Download, ExternalLink, Copy, ChevronLeft, ChevronRight,
  Image, Video, AlertTriangle, Loader2, ZoomIn, ZoomOut, Info,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───
export interface MediaItem {
  url: string;
  type: "screenshot" | "video";
  label?: string;
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
function friendlyName(item: MediaItem): string {
  if (item.testTitle) return item.testTitle;
  if (item.label) return item.label;
  try {
    const raw = decodeURIComponent(item.url.split("/").pop() || "arquivo");
    // Strip long hash prefixes and extensions
    return raw
      .replace(/^[a-f0-9]{8,}-/, "")
      .replace(/\.(png|jpg|jpeg|mp4|webm)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim() || "Artifact";
  } catch {
    return "Artifact";
  }
}

function rawFileName(url: string) {
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
    toast.info("Abrindo em nova aba");
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
  const [showDetails, setShowDetails] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    setShowDetails(false);
  }, []);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, prev, next]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (!scrollRef.current) return;
    const active = scrollRef.current.children[idx] as HTMLElement;
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [idx]);

  if (!items || items.length === 0) return null;

  const current = items[idx];
  const isImage = current.type === "screenshot";
  const totalScreenshots = items.filter((i) => i.type === "screenshot").length;
  const totalVideos = items.filter((i) => i.type === "video").length;
  const name = friendlyName(current);
  const statusColor = current.status === "failed" ? "text-destructive" : current.status === "passed" ? "text-green-500" : "text-muted-foreground";

  const label =
    triggerLabel ||
    [totalScreenshots > 0 ? `${totalScreenshots} img` : "", totalVideos > 0 ? `${totalVideos} vid` : ""]
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} className="text-xs gap-1.5" onClick={handleOpen}>
        <TriggerIcon type={triggerIcon} />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 border-0 bg-[hsl(var(--background))] max-w-[100vw] max-h-[100dvh] w-screen h-[100dvh] sm:max-w-[94vw] sm:max-h-[94vh] sm:h-[94vh] sm:w-[94vw] sm:rounded-xl overflow-hidden flex flex-col">
          <DialogTitle className="sr-only">Visualizador de Mídia</DialogTitle>

          {/* ── Compact Header ── */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0 min-h-[40px]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${isImage ? "bg-primary/10" : "bg-accent/20"}`}>
                {isImage ? <Image className="h-3 w-3 text-primary" /> : <Video className="h-3 w-3 text-primary" />}
              </div>
              <p className="text-xs font-medium text-foreground truncate max-w-[50vw] sm:max-w-none" title={rawFileName(current.url)}>
                {name}
              </p>
              {current.status && (
                <span className={`text-[10px] font-semibold uppercase ${statusColor} shrink-0`}>
                  {current.status}
                </span>
              )}
              {items.length > 1 && (
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {idx + 1}/{items.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowDetails(d => !d)} title="Detalhes">
                <Info className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => forceDownload(current.url, rawFileName(current.url))} title="Download">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(current.url, "_blank")} title="Abrir">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* ── Collapsible Details ── */}
          {showDetails && (
            <div className="px-3 py-2 bg-muted/30 border-b border-border text-[11px] space-y-1 shrink-0 animate-in slide-in-from-top-2 duration-150">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                {current.spec && <span className="font-mono">Spec: {current.spec}</span>}
                {current.testTitle && <span>Teste: {current.testTitle}</span>}
                {current.timestamp && <span>{new Date(current.timestamp).toLocaleString("pt-BR")}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => copyUrl(current.url)} className="text-primary hover:underline text-[10px] flex items-center gap-1">
                  <Copy className="h-2.5 w-2.5" /> Copiar URL
                </button>
                <span className="text-muted-foreground/50 font-mono text-[9px] truncate">{rawFileName(current.url)}</span>
              </div>
            </div>
          )}

          {/* ── Main Media Area ── */}
          <div className="flex-1 relative flex items-center justify-center bg-black min-h-0 overflow-hidden">
            {/* Nav arrows */}
            {items.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prev(); setZoomed(false); }}
                  className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 active:bg-black/90 text-white/80 rounded-full p-1.5 sm:p-2 transition-all"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); next(); setZoomed(false); }}
                  className="absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 active:bg-black/90 text-white/80 rounded-full p-1.5 sm:p-2 transition-all"
                  aria-label="Próximo"
                >
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </>
            )}

            {/* Error state */}
            {loadErrors[idx] ? (
              <div className="p-6 text-center space-y-3 max-w-sm">
                <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto" />
                <p className="text-sm font-medium text-white">Falha ao carregar {isImage ? "screenshot" : "vídeo"}</p>
                <p className="text-[10px] text-white/40 break-all font-mono leading-relaxed">{current.url}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button variant="secondary" size="sm" className="text-xs gap-1" onClick={() => window.open(current.url, "_blank")}>
                    <ExternalLink className="h-3 w-3" /> Nova aba
                  </Button>
                  <Button variant="secondary" size="sm" className="text-xs gap-1" onClick={() => copyUrl(current.url)}>
                    <Copy className="h-3 w-3" /> Copiar URL
                  </Button>
                  <Button variant="secondary" size="sm" className="text-xs gap-1" onClick={() => forceDownload(current.url, rawFileName(current.url))}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </div>
              </div>
            ) : isImage ? (
              /* ── Image viewer ── */
              <div
                className={`w-full h-full flex items-center justify-center ${zoomed ? "overflow-auto cursor-grab active:cursor-grabbing" : "overflow-hidden cursor-zoom-in"}`}
                onClick={() => setZoomed((z) => !z)}
              >
                {loading[idx] !== false && !loadErrors[idx] && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                  </div>
                )}
                <img
                  src={current.url}
                  alt={name}
                  className={`transition-transform duration-200 select-none ${
                    zoomed
                      ? "max-w-none w-auto h-auto scale-150 sm:scale-[2]"
                      : "max-w-full max-h-full object-contain p-1"
                  }`}
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
                autoPlay
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
                onError={() => handleError(idx)}
                onLoadedData={() => handleLoaded(idx)}
              >
                <source src={current.url} type="video/mp4" />
                Seu navegador não suporta vídeo HTML5.
              </video>
            )}

            {/* Zoom button for images */}
            {isImage && !loadErrors[idx] && (
              <button
                onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
                className="absolute bottom-2 right-2 z-20 bg-black/50 hover:bg-black/70 text-white/80 rounded-full p-1.5 transition-all"
                aria-label={zoomed ? "Reduzir" : "Ampliar"}
              >
                {zoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          {/* ── Thumbnail Strip ── */}
          {items.length > 1 && (
            <div
              ref={scrollRef}
              className="flex gap-1 px-2 py-1.5 bg-card/80 backdrop-blur-sm border-t border-border overflow-x-auto shrink-0 scrollbar-none snap-x snap-mandatory"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {items.map((item, i) => {
                const isActive = i === idx;
                return (
                  <button
                    key={i}
                    onClick={() => { setIdx(i); setZoomed(false); }}
                    className={`flex-shrink-0 snap-center rounded-md overflow-hidden relative transition-all duration-150 ${
                      isActive
                        ? "ring-2 ring-primary ring-offset-1 ring-offset-background w-14 h-10 sm:w-[72px] sm:h-12"
                        : "opacity-40 hover:opacity-80 w-12 h-9 sm:w-16 sm:h-11"
                    }`}
                  >
                    {item.type === "video" ? (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Video className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    ) : loadErrors[i] ? (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      </div>
                    ) : (
                      <img
                        src={item.url}
                        alt={`#${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={() => handleError(i)}
                        loading="lazy"
                      />
                    )}
                    {/* Tiny type indicator */}
                    <span className={`absolute bottom-0 right-0 text-[7px] px-0.5 leading-tight rounded-tl ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-black/60 text-white/70"
                    }`}>
                      {item.type === "video" ? "▶" : "◻"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Convenience wrappers ───
export function ScreenshotViewer({ urls, spec, testTitle }: { urls: string[]; spec?: string; testTitle?: string }) {
  const items: MediaItem[] = urls.map((url) => ({
    url, type: "screenshot" as const, spec, testTitle, status: "failed",
  }));
  return <MediaViewer items={items} triggerIcon="screenshot" triggerLabel={`Screenshots (${urls.length})`} />;
}

export function VideoViewer({ urls, spec }: { urls: string[]; spec?: string }) {
  const items: MediaItem[] = urls.map((url) => ({
    url, type: "video" as const, spec,
  }));
  return <MediaViewer items={items} triggerIcon="video" triggerLabel={`Vídeos (${urls.length})`} />;
}

/* DocumentScanner.tsx
 * Scanner real de documentos (padrão CamScanner / iPhone Files / OneDrive Scan).
 * - Detecção automática de bordas e correção de perspectiva (jscanify + OpenCV.js)
 * - Múltiplas páginas, preview, refazer, reordenar, concluir
 * - Filtros: Cinza, P&B (scanner) e Cor melhorada
 * - Validação de qualidade mínima (resolução, foco, contraste)
 * - Saída: PDF multipágina A4 verdadeiro (jsPDF)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Camera, RotateCcw, Trash2, Check, Loader2, Image as ImageIcon,
  ArrowLeft, ArrowRight, Sparkles, Upload, X,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

type Filter = "magic" | "bw" | "gray" | "color";

interface ScannedPage {
  id: string;
  /** PNG dataURL — imagem corrigida e filtrada (final) */
  dataUrl: string;
  /** PNG dataURL — imagem corrigida sem filtro (para reaplicar filtro) */
  rawCorrectedDataUrl: string;
  width: number;
  height: number;
  filter: Filter;
}

export interface DocumentScannerProps {
  open: boolean;
  onClose: () => void;
  /** Devolve PDF gerado das páginas digitalizadas */
  onComplete: (pdf: { blob: Blob; pageCount: number; previewDataUrl: string }) => void | Promise<void>;
  title?: string;
  /** Quantidade mínima de páginas para concluir (default 1) */
  minPages?: number;
  /** Se fornecido, abre o scanner já processando este arquivo (JPG/PNG/PDF) — sem precisar da câmera */
  initialFile?: File | null;
}

declare global {
  interface Window {
    cv?: any;
    jscanify?: any;
  }
}

const OPENCV_URL = "https://docs.opencv.org/4.10.0/opencv.js";
const JSCANIFY_URL = "https://cdn.jsdelivr.net/npm/jscanify@1.4.2/src/jscanify.min.js";
const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs";

let pdfjsLoading: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).__pdfjsLib) return Promise.resolve((window as any).__pdfjsLib);
  if (pdfjsLoading) return pdfjsLoading;
  pdfjsLoading = (async () => {
    const lib: any = await import(/* @vite-ignore */ PDFJS_URL);
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    (window as any).__pdfjsLib = lib;
    return lib;
  })();
  return pdfjsLoading;
}

async function pdfFileToImages(file: File): Promise<HTMLCanvasElement[]> {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const out: HTMLCanvasElement[] = [];
  const maxPages = Math.min(pdf.numPages, 10);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const c = document.createElement("canvas");
    c.width = viewport.width; c.height = viewport.height;
    await page.render({ canvasContext: c.getContext("2d")!, viewport }).promise;
    out.push(c);
  }
  return out;
}

let opencvLoading: Promise<void> | null = null;
function loadOpenCv(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.cv && window.cv.Mat) return Promise.resolve();
  if (opencvLoading) return opencvLoading;
  opencvLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-scanner-opencv]`) as HTMLScriptElement | null;
    const onReady = () => {
      if (window.cv && window.cv.Mat) return resolve();
      // OpenCV.js executa async e dispara 'onRuntimeInitialized'
      if (window.cv) {
        window.cv["onRuntimeInitialized"] = () => resolve();
      } else {
        reject(new Error("OpenCV não carregou"));
      }
    };
    if (existing) {
      existing.addEventListener("load", onReady);
      if ((existing as any).dataset.loaded === "1") onReady();
      return;
    }
    const s = document.createElement("script");
    s.src = OPENCV_URL;
    s.async = true;
    s.dataset.scannerOpencv = "1";
    s.onload = () => { (s as any).dataset.loaded = "1"; onReady(); };
    s.onerror = () => reject(new Error("Falha ao baixar OpenCV"));
    document.head.appendChild(s);
  });
  return opencvLoading;
}

let jscanifyLoading: Promise<void> | null = null;
function loadJscanify(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.jscanify) return Promise.resolve();
  if (jscanifyLoading) return jscanifyLoading;
  jscanifyLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = JSCANIFY_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao baixar jscanify"));
    document.head.appendChild(s);
  });
  return jscanifyLoading;
}

async function ensureScannerLibs(): Promise<any> {
  await loadOpenCv();
  await loadJscanify();
  // jscanify expõe um construtor global
  const Ctor = (window as any).jscanify;
  const scanner = typeof Ctor === "function" ? new Ctor() : Ctor;
  return scanner;
}

/* ── Filtros pós-correção ── */
function applyFilter(srcCanvas: HTMLCanvasElement, filter: Filter): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = srcCanvas.width;
  out.height = srcCanvas.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(srcCanvas, 0, 0);
  if (filter === "color") return out;

  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;

  if (filter === "gray") {
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = Math.min(255, y * 1.08 + 4);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  } else if (filter === "magic") {
    // Branqueia papel, escurece tinta, mantém cor
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = d[i + c] * 1.18 - 18;
        if (v > 200) v = Math.min(255, v + 25);
        if (v < 70) v = Math.max(0, v - 12);
        d[i + c] = Math.max(0, Math.min(255, v));
      }
    }
  } else if (filter === "bw") {
    // P&B com limiar adaptativo simples (média local 16x16)
    const w = out.width, h = out.height;
    const block = 24;
    const lum = new Float32Array(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      lum[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - block), x1 = Math.min(w - 1, x + block);
        const y0 = Math.max(0, y - block), y1 = Math.min(h - 1, y + block);
        // amostragem esparsa por performance
        let sum = 0, cnt = 0;
        for (let yy = y0; yy <= y1; yy += 6) {
          for (let xx = x0; xx <= x1; xx += 6) {
            sum += lum[yy * w + xx]; cnt++;
          }
        }
        const mean = cnt > 0 ? sum / cnt : 200;
        const v = lum[y * w + x] < mean - 8 ? 0 : 255;
        const i = (y * w + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/* ── Validação de qualidade ── */
function validateQuality(canvas: HTMLCanvasElement): { ok: boolean; reason?: string } {
  if (canvas.width < 600 || canvas.height < 600) {
    return { ok: false, reason: "Imagem muito pequena. Aproxime e tente novamente." };
  }
  const ctx = canvas.getContext("2d")!;
  // Amostra 200x200 do centro para avaliar contraste e nitidez
  const sw = Math.min(300, canvas.width), sh = Math.min(300, canvas.height);
  const sx = Math.floor((canvas.width - sw) / 2), sy = Math.floor((canvas.height - sh) / 2);
  const img = ctx.getImageData(sx, sy, sw, sh);
  const d = img.data;
  let min = 255, max = 0, sum = 0;
  const lum = new Float32Array(sw * sh);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    lum[p] = y; sum += y;
    if (y < min) min = y; if (y > max) max = y;
  }
  if (max - min < 40) return { ok: false, reason: "Contraste insuficiente (foto muito escura ou estourada)." };
  // Variância de Laplaciano simplificada (4-vizinhança) — mede foco
  let lap = 0, n = 0;
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x;
      const v = Math.abs(4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - sw] - lum[i + sw]);
      lap += v * v; n++;
    }
  }
  const focus = lap / Math.max(1, n);
  if (focus < 60) return { ok: false, reason: "Imagem desfocada. Mantenha o documento parado e tente novamente." };
  return { ok: true };
}

/* ── PDF multipágina A4 ── */
async function buildPdf(pages: ScannedPage[]): Promise<{ blob: Blob; previewDataUrl: string }> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  pages.forEach((p, idx) => {
    if (idx > 0) pdf.addPage();
    const ratio = p.width / p.height;
    let w = maxW, h = maxW / ratio;
    if (h > maxH) { h = maxH; w = maxH * ratio; }
    const x = (pageW - w) / 2, y = (pageH - h) / 2;
    pdf.addImage(p.dataUrl, "JPEG", x, y, w, h, undefined, "FAST");
  });
  const blob = pdf.output("blob");
  const previewDataUrl = pages[0]?.dataUrl || "";
  return { blob, previewDataUrl };
}

export default function DocumentScanner({
  open, onClose, onComplete, title = "ESCANEAR DOCUMENTO", minPages = 1, initialFile = null,
}: DocumentScannerProps) {
  const [libsReady, setLibsReady] = useState(false);
  const [libsError, setLibsError] = useState<string | null>(null);
  const [mode, setMode] = useState<"capture" | "review">("capture");
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [activeFilter, setActiveFilter] = useState<Filter>("magic");
  const [reviewIdx, setReviewIdx] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const captureRef = useRef<HTMLCanvasElement | null>(null);
  const scannerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Carrega libs
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLibsError(null);
    ensureScannerLibs()
      .then((s) => { if (!cancelled) { scannerRef.current = s; setLibsReady(true); } })
      .catch((e) => { if (!cancelled) setLibsError(e?.message || "Falha ao iniciar scanner"); });
    return () => { cancelled = true; };
  }, [open]);

  // Inicia câmera quando estiver pronto e em modo captura
  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e: any) {
      console.error("[scanner-camera]", e);
      toast.error("Não foi possível abrir a câmera. Use o botão 'Escolher arquivo'.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (mode !== "capture") return;
    if (!libsReady) return;
    // Quando o scanner foi aberto a partir de um arquivo importado,
    // NUNCA abrir a câmera. O fluxo de importação processa o arquivo direto.
    if (initialFile) return;
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, libsReady]);

  // Loop de detecção de bordas (overlay)
  useEffect(() => {
    if (!open || mode !== "capture" || !libsReady || !stream) return;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    const tick = () => {
      try {
        if (video.readyState >= 2 && scannerRef.current) {
          const vw = video.videoWidth, vh = video.videoHeight;
          if (vw && vh) {
            if (overlay.width !== vw || overlay.height !== vh) {
              overlay.width = vw; overlay.height = vh;
            }
            const ctx = overlay.getContext("2d")!;
            ctx.clearRect(0, 0, vw, vh);
            try {
              // jscanify: highlightPaper retorna canvas com contorno desenhado
              const highlighted: HTMLCanvasElement = scannerRef.current.highlightPaper(video, {
                color: "#10b981",
                thickness: 8,
              });
              ctx.drawImage(highlighted, 0, 0);
            } catch { /* frame inválido — ignora */ }
          }
        }
      } catch (e) { /* ignore */ }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [open, mode, libsReady, stream]);

  // Limpa ao fechar
  useEffect(() => {
    if (!open) {
      stopCamera();
      setPages([]);
      setMode("capture");
      setReviewIdx(0);
      setActiveFilter("magic");
    }
  }, [open, stopCamera]);

  /* ── Captura de uma página ── */
  const processSourceToPage = useCallback(async (source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
    const scanner = scannerRef.current;
    if (!scanner) throw new Error("Scanner não está pronto");
    let corrected: HTMLCanvasElement;
    try {
      // jscanify: extractPaper(source, targetWidth, targetHeight?) — corrige perspectiva
      // Mantém proporção A4 (sqrt(2)) por padrão, com ~1700px de largura (~200dpi A4)
      const targetW = 1700;
      const targetH = Math.round(targetW * 1.4142);
      corrected = scanner.extractPaper(source, targetW, targetH);
    } catch (e) {
      console.error("[scanner-extract]", e);
      throw new Error("Não foi possível detectar as bordas. Posicione o documento sobre fundo escuro e tente novamente.");
    }
    const q = validateQuality(corrected);
    if (!q.ok) throw new Error(q.reason || "Qualidade insuficiente");
    const filtered = applyFilter(corrected, activeFilter);
    const page: ScannedPage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dataUrl: filtered.toDataURL("image/jpeg", 0.9),
      rawCorrectedDataUrl: corrected.toDataURL("image/jpeg", 0.92),
      width: filtered.width,
      height: filtered.height,
      filter: activeFilter,
    };
    return page;
  }, [activeFilter]);

  const handleCapture = async () => {
    if (busy) return;
    const video = videoRef.current;
    if (!video || !libsReady) {
      toast.error("Scanner ainda carregando…");
      return;
    }
    setBusy(true);
    try {
      const page = await processSourceToPage(video);
      setPages((p) => [...p, page]);
      toast.success(`Página ${pages.length + 1} adicionada`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao capturar");
    } finally {
      setBusy(false);
    }
  };

  const handlePickFile = async (file: File) => {
    setBusy(true);
    try {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const sources: Array<HTMLImageElement | HTMLCanvasElement> = [];
      if (isPdf) {
        const canvases = await pdfFileToImages(file);
        sources.push(...canvases);
      } else {
        const url = URL.createObjectURL(file);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = url;
        });
        sources.push(img);
        URL.revokeObjectURL(url);
      }
      const newPages: ScannedPage[] = [];
      for (const src of sources) {
        try {
          const page = await processSourceToPage(src);
          newPages.push(page);
        } catch (perPageErr) {
          console.warn("[scanner-pdf-page]", perPageErr);
        }
      }
      if (newPages.length === 0) throw new Error("Não foi possível processar o arquivo. Tente outro.");
      setPages((p) => [...p, ...newPages]);
      setMode("review");
      toast.success(`${newPages.length} página(s) digitalizada(s)`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao processar arquivo");
    } finally {
      setBusy(false);
    }
  };

  // Quando recebe um arquivo inicial (importado), processa direto sem precisar de câmera
  useEffect(() => {
    if (!open || !initialFile || !libsReady) return;
    handlePickFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, libsReady, initialFile]);

  const reapplyFilter = (idx: number, filter: Filter) => {
    setPages((prev) => prev.map((p, i) => {
      if (i !== idx) return p;
      const img = new Image();
      img.src = p.rawCorrectedDataUrl;
      // síncrono não funciona — fallback assíncrono
      return p;
    }));
    // execução assíncrona real
    (async () => {
      const target = pages[idx];
      if (!target) return;
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = target.rawCorrectedDataUrl;
      });
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      const filtered = applyFilter(c, filter);
      setPages((prev) => prev.map((p, i) => i === idx ? {
        ...p, filter, dataUrl: filtered.toDataURL("image/jpeg", 0.9),
        width: filtered.width, height: filtered.height,
      } : p));
    })();
  };

  const removePage = (idx: number) => {
    setPages((prev) => prev.filter((_, i) => i !== idx));
    setReviewIdx((i) => Math.max(0, Math.min(i, pages.length - 2)));
  };

  const movePage = (idx: number, dir: -1 | 1) => {
    setPages((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
    setReviewIdx((i) => Math.max(0, Math.min(i + dir, pages.length - 1)));
  };

  const handleFinish = async () => {
    if (pages.length < minPages) {
      toast.error(`Adicione pelo menos ${minPages} página(s).`);
      return;
    }
    setBusy(true);
    try {
      const { blob, previewDataUrl } = await buildPdf(pages);
      await onComplete({ blob, pageCount: pages.length, previewDataUrl });
      onClose();
    } catch (e: any) {
      console.error("[scanner-finish]", e);
      toast.error(e?.message || "Falha ao gerar PDF");
    } finally {
      setBusy(false);
    }
  };

  const filterButtons: Array<{ k: Filter; label: string }> = [
    { k: "magic", label: "MÁGICO" },
    { k: "bw", label: "P&B" },
    { k: "gray", label: "CINZA" },
    { k: "color", label: "COR" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-4xl p-0 overflow-hidden bg-slate-950 border-slate-800 text-slate-100 sm:rounded-xl
                   w-screen h-[100dvh] sm:w-auto sm:h-auto sm:max-h-[92vh] flex flex-col"
      >
        <DialogHeader
          className="px-4 py-3 border-b border-slate-800 bg-slate-900 shrink-0"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <DialogTitle className="text-sm font-semibold tracking-wider text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            {title}
            {pages.length > 0 && (
              <span className="ml-auto text-[11px] font-normal text-slate-400">
                {pages.length} página{pages.length > 1 ? "s" : ""}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {libsError && (
          <div className="p-6 text-sm text-red-300 bg-red-950/30 border border-red-900/50 rounded m-4">
            Erro ao carregar o scanner: {libsError}
          </div>
        )}

        {!libsError && !libsReady && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-xs text-slate-400">Carregando módulo de digitalização…</p>
          </div>
        )}

        {!libsError && libsReady && mode === "capture" && (
          <div className="relative bg-black flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="relative w-full flex-1 min-h-0 overflow-hidden flex items-center justify-center bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              <canvas
                ref={overlayRef}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
              {!stream && (
                <div className="relative z-10 text-center text-slate-300 text-xs px-6">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-60" />
                  Permita acesso à câmera ou escolha um arquivo abaixo.
                </div>
              )}
            </div>

            {/* Barra de filtros */}
            <div className="flex items-center justify-center gap-1 py-2 bg-slate-900 border-t border-slate-800">
              {filterButtons.map((f) => (
                <button
                  key={f.k}
                  type="button"
                  onClick={() => setActiveFilter(f.k)}
                  className={`text-[10px] tracking-wider px-3 py-1.5 rounded font-semibold transition-colors ${
                    activeFilter === f.k
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Controles */}
            <div
              className="flex items-center justify-between gap-2 p-3 bg-slate-900 border-t border-slate-800 shrink-0"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
              >
                <Upload className="w-4 h-4 mr-1.5" /> ARQUIVO
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePickFile(f);
                  e.target.value = "";
                }}
              />

              <button
                type="button"
                onClick={handleCapture}
                disabled={busy || !stream}
                className="relative w-16 h-16 rounded-full bg-white border-4 border-slate-900 ring-2 ring-emerald-400 disabled:opacity-50 flex items-center justify-center transition-transform active:scale-95"
                aria-label="Capturar"
              >
                {busy ? <Loader2 className="w-6 h-6 animate-spin text-slate-900" /> : <Camera className="w-6 h-6 text-slate-900" />}
              </button>

              <Button
                type="button"
                size="sm"
                onClick={() => setMode("review")}
                disabled={pages.length === 0}
                className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
              >
                REVISAR ({pages.length})
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {!libsError && libsReady && mode === "review" && (
          <div className="bg-slate-950">
            <div className="flex items-center justify-center bg-black p-4 min-h-[40vh] max-h-[60vh] overflow-hidden">
              {pages[reviewIdx] ? (
                <img
                  src={pages[reviewIdx].dataUrl}
                  alt={`Página ${reviewIdx + 1}`}
                  className="max-h-[58vh] max-w-full object-contain shadow-2xl"
                />
              ) : (
                <p className="text-slate-400 text-xs">Sem páginas</p>
              )}
            </div>

            {/* Filtros por página */}
            {pages[reviewIdx] && (
              <div className="flex items-center justify-center gap-1 py-2 bg-slate-900 border-y border-slate-800">
                {filterButtons.map((f) => (
                  <button
                    key={f.k}
                    type="button"
                    onClick={() => reapplyFilter(reviewIdx, f.k)}
                    className={`text-[10px] tracking-wider px-3 py-1.5 rounded font-semibold transition-colors ${
                      pages[reviewIdx].filter === f.k
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {/* Tira de miniaturas */}
            <div className="flex gap-2 overflow-x-auto p-3 bg-slate-900 border-b border-slate-800">
              {pages.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setReviewIdx(i)}
                  className={`relative shrink-0 w-16 h-20 rounded overflow-hidden border-2 ${
                    i === reviewIdx ? "border-emerald-400" : "border-slate-700"
                  }`}
                >
                  <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 right-0 bg-black/70 text-[9px] text-white px-1">{i + 1}</span>
                </button>
              ))}
            </div>

            <DialogFooter className="flex flex-row flex-wrap gap-2 p-3 bg-slate-900 border-t border-slate-800 sm:justify-between">
              <div className="flex gap-1">
                <Button
                  type="button" size="sm" variant="outline"
                  className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                  onClick={() => movePage(reviewIdx, -1)} disabled={reviewIdx === 0 || pages.length < 2}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button" size="sm" variant="outline"
                  className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                  onClick={() => movePage(reviewIdx, 1)} disabled={reviewIdx >= pages.length - 1 || pages.length < 2}
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  type="button" size="sm" variant="outline"
                  className="bg-red-950 border-red-900 text-red-200 hover:bg-red-900 hover:text-white"
                  onClick={() => removePage(reviewIdx)}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> EXCLUIR
                </Button>
              </div>

              <div className="flex gap-1 ml-auto">
                <Button
                  type="button" size="sm" variant="outline"
                  className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                  onClick={() => setMode("capture")}
                >
                  <RotateCcw className="w-4 h-4 mr-1" /> ADD PÁGINA
                </Button>
                <Button
                  type="button" size="sm"
                  onClick={handleFinish}
                  disabled={busy || pages.length < minPages}
                  className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold"
                >
                  {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  CONCLUIR
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}

        {/* canvas auxiliar para futuros usos */}
        <canvas ref={captureRef} className="hidden" />

        <button
          type="button" aria-label="Fechar"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 z-50 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 p-1.5"
        >
          <X className="w-4 h-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}

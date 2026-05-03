import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, User, Phone, Mail, MapPin, FileText, Shield, ChevronLeft,
  Loader2, Eye, Plus, Crosshair, Edit, Trash2, Download, FileDown,
  ChevronDown, ChevronUp, Save, X, XCircle, CheckCircle, TrendingUp, KeyRound, PenTool,
  HeartPulse, GripVertical, Camera, Upload, ShieldCheck, Clock, Pause, Play,
  ShoppingCart, RefreshCw, Landmark,
} from "lucide-react";
import { calcularSla } from "@/lib/qaSlaCadastro";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  arrayMove, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { toast } from "sonner";
import { LoadingState, ErrorRetryState, EmptyState, SkeletonList } from "@/components/quero-armas/LoadStates";
import ClienteFormModal from "@/components/quero-armas/clientes/ClienteFormModal";
import ClienteOverview from "@/components/quero-armas/clientes/ClienteOverview";
import DadosFormularioPublicoSection from "@/components/quero-armas/clientes/DadosFormularioPublicoSection";
import { VendaModal, DeleteConfirm } from "@/components/quero-armas/clientes/SubEntityModals";
// SolicitacaoStatusPopover removido — substituído pelo Select Light inline com lista canônica
import { SolicitacaoTimeline } from "@/components/quero-armas/timeline/SolicitacaoTimeline";
import SenhaGovField from "@/components/quero-armas/clientes/SenhaGovField";
import { HistoricoAtualizacoes } from "@/components/quero-armas/clientes/HistoricoAtualizacoes";
import { exportClientes, exportVendas } from "@/components/quero-armas/clientes/ClienteExport";
import ClienteAcessoPortal from "@/components/quero-armas/clientes/ClienteAcessoPortal";
import ClientePecas from "@/components/quero-armas/clientes/ClientePecas";
import { GerarProcessoButton } from "@/components/quero-armas/processos/GerarProcessoButton";
import { AprovarValorButton } from "@/components/quero-armas/processos/AprovarValorButton";
import ClienteExames from "@/components/quero-armas/clientes/ClienteExames";
import ClienteDocsEnviados from "@/components/quero-armas/clientes/ClienteDocsEnviados";
import ClienteDocsCadastroPublico from "@/components/quero-armas/clientes/ClienteDocsCadastroPublico";
import ClienteSelfieAvatar from "@/components/quero-armas/clientes/ClienteSelfieAvatar";
import { getClienteFK, getVendaFK, getClienteCadastroFK } from "@/components/quero-armas/clientes/clientFK";
import { ArsenalView } from "@/components/quero-armas/arsenal/ArsenalView";
import { useSolicitacoesPublicasDoCliente } from "@/components/quero-armas/clientes/useSolicitacoesPublicas";
import { usePrivateStorageUrl } from "@/hooks/usePrivateStorageUrl";
import { useQAStatusServico } from "@/hooks/useQAStatusServico";
import { STATUS_SERVICO_QA, STATUS_LABELS, statusBadgeClass } from "@/lib/quero-armas/statusServico";
import { registrarStatusEvento } from "@/lib/quero-armas/registrarStatusEvento";
import { isDispensado, getBaseLegalDispensa, CATEGORIA_MAP, type CategoriaTitular } from "@/components/quero-armas/clientes/categoriaTitular";
import { invalidateQADashboardSnapshot } from "@/components/quero-armas/dashboard/dashboardSnapshot";
import { objetivoLabel, categoriaLabel } from "./qaServiceCatalog";
import jsPDF from "jspdf";
import DocumentScanner from "@/components/quero-armas/scanner/DocumentScanner";

/* ── Pipeline "scanner" real ──
 * 1) Auto-crop: detecta as bordas do papel (regiões claras) e descarta o fundo escuro da foto.
 * 2) Background flattening: estima o fundo do papel via downsample/blur e divide para neutralizar
 *    sombras e iluminação irregular (whiteboard / shadow removal).
 * 3) White balance: normaliza para o papel ficar branco real (255).
 * 4) Contraste/curva S leve para realçar texto sem queimar tinta.
 * 5) Unsharp mask para nitidez tipo scanner.
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = url;
  });
}

function autoCropToPaper(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext("2d")!;
  const { width: w, height: h } = src;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // Luminância e limiar fixo: papel ≈ claro (>110). Fundo escuro de print/foto vai pra fora.
  const isPaper = (i: number) => {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return y > 110;
  };
  // Projeções por linha/coluna (proporção de pixels claros)
  const rowScore = new Float32Array(h);
  const colScore = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    let cnt = 0;
    for (let x = 0; x < w; x++) {
      if (isPaper((y * w + x) * 4)) cnt++;
    }
    rowScore[y] = cnt / w;
  }
  for (let x = 0; x < w; x++) {
    let cnt = 0;
    for (let y = 0; y < h; y++) {
      if (isPaper((y * w + x) * 4)) cnt++;
    }
    colScore[x] = cnt / h;
  }
  const TH = 0.35; // pelo menos 35% claro = dentro do papel
  let top = 0, bottom = h - 1, left = 0, right = w - 1;
  while (top < h && rowScore[top] < TH) top++;
  while (bottom > top && rowScore[bottom] < TH) bottom--;
  while (left < w && colScore[left] < TH) left++;
  while (right > left && colScore[right] < TH) right--;
  // Margem de segurança
  const pad = Math.round(Math.min(w, h) * 0.005);
  top = Math.max(0, top - pad);
  left = Math.max(0, left - pad);
  bottom = Math.min(h - 1, bottom + pad);
  right = Math.min(w - 1, right + pad);
  const cw = Math.max(1, right - left + 1);
  const ch = Math.max(1, bottom - top + 1);
  // Sanidade: se cropped < 40% da área, descarta
  if (cw * ch < w * h * 0.4) return src;
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d")!.drawImage(src, left, top, cw, ch, 0, 0, cw, ch);
  return out;
}

function estimateBackground(src: HTMLCanvasElement, scale = 0.05): ImageData {
  // Downsample agressivo + upsample = blur barato (estimativa do papel/iluminação)
  const sw = Math.max(8, Math.round(src.width * scale));
  const sh = Math.max(8, Math.round(src.height * scale));
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext("2d")!;
  // Para "background", usamos o máximo local: pintamos várias passagens com blur
  sctx.filter = "blur(2px)";
  sctx.drawImage(src, 0, 0, sw, sh);
  sctx.filter = "none";
  // Estima como o "papel" seria: percentil alto. Como aproximação, dilatamos via 2 passagens de blur leve.
  const big = document.createElement("canvas");
  big.width = src.width;
  big.height = src.height;
  const bctx = big.getContext("2d")!;
  bctx.imageSmoothingEnabled = true;
  bctx.filter = "blur(8px)";
  bctx.drawImage(small, 0, 0, src.width, src.height);
  bctx.filter = "none";
  return bctx.getImageData(0, 0, src.width, src.height);
}

function applyScannerFilter(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const ctx = src.getContext("2d")!;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  // 1) Estimativa de fundo (iluminação/papel)
  const bgImg = estimateBackground(src);
  const bg = bgImg.data;

  // 2) Encontra o branco-alvo: percentil 95 da luminância do fundo estimado
  const sample: number[] = [];
  const step = Math.max(1, Math.floor((w * h) / 5000));
  for (let i = 0; i < bg.length; i += 4 * step) {
    sample.push(0.299 * bg[i] + 0.587 * bg[i + 1] + 0.114 * bg[i + 2]);
  }
  sample.sort((a, b) => a - b);
  const paperLum = Math.max(80, sample[Math.floor(sample.length * 0.92)] || 200);

  // 3) Divisão por fundo (background flattening) por canal + curva
  const gain = 255 / paperLum;
  const contrast = 1.35;
  const intercept = 128 * (1 - contrast);

  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const bgV = Math.max(40, bg[i + c]); // evita divisão por zero
      // Normaliza pela iluminação local (papel vira ~255)
      let v = (d[i + c] / bgV) * 255 * (gain / (255 / paperLum));
      // Curva de contraste
      v = v * contrast + intercept;
      // Branqueia tudo que já é claro (limpa fundo)
      if (v > 205) v = Math.min(255, v + 35);
      // Escurece tinta levemente
      if (v < 90) v = Math.max(0, v - 10);
      if (v < 0) v = 0;
      else if (v > 255) v = 255;
      d[i + c] = v;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 4) Unsharp mask: nitidez tipo scanner
  const sharp = document.createElement("canvas");
  sharp.width = w;
  sharp.height = h;
  const sctx = sharp.getContext("2d")!;
  sctx.filter = "blur(1.2px)";
  sctx.drawImage(src, 0, 0);
  const blurred = sctx.getImageData(0, 0, w, h).data;
  const final = ctx.getImageData(0, 0, w, h);
  const fd = final.data;
  const amount = 0.7;
  for (let i = 0; i < fd.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const orig = fd[i + c];
      const sharpened = orig + (orig - blurred[i + c]) * amount;
      fd[i + c] = sharpened < 0 ? 0 : sharpened > 255 ? 255 : sharpened;
    }
  }
  ctx.putImageData(final, 0, 0);
  return src;
}

async function loadImageEnhanced(url: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(url);
  // Limita largura máxima (qualidade scanner @ ~200dpi A4)
  const MAX_W = 1700;
  const scale = Math.min(1, MAX_W / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const raw = document.createElement("canvas");
  raw.width = w;
  raw.height = h;
  raw.getContext("2d")!.drawImage(img, 0, 0, w, h);
  // Pipeline: crop → scanner filter
  const cropped = autoCropToPaper(raw);
  return applyScannerFilter(cropped);
}

async function generateScannedPdf(images: Array<{ url: string; title: string }>, filename: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;

  let first = true;
  for (const item of images) {
    if (!item.url) continue;
    const canvas = await loadImageEnhanced(item.url);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const ratio = canvas.width / canvas.height;
    let drawW = maxW;
    let drawH = drawW / ratio;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * ratio;
    }
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;
    if (!first) pdf.addPage();
    pdf.addImage(dataUrl, "JPEG", x, y, drawW, drawH, undefined, "FAST");
    first = false;
  }
  pdf.save(filename);
}

/* ── Lightbox 5:4 espelhado (compartilhado por todas as miniaturas) ── */
function PhotoLightbox({ url, alt, onClose, mirror = true, fit = "cover" }: { url: string; alt: string; onClose: () => void; mirror?: boolean; fit?: "cover" | "contain" }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl"
        style={{ aspectRatio: fit === "contain" ? "4 / 3" : "5 / 4" }}
        onClick={e => e.stopPropagation()}
      >
        <img
          src={url}
          alt={alt}
          className={`w-full h-full ${fit === "contain" ? "object-contain bg-slate-900" : "object-cover"} rounded-2xl shadow-2xl`}
          style={mirror ? { transform: "scaleX(-1)" } : undefined}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-slate-700 shadow-lg flex items-center justify-center hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Selfie Thumbnail (loads private storage signed URL) ── */
function SelfieThumb({ path, name, size = "lg" }: { path: string | null | undefined; name?: string | null; size?: "lg" | "sm" }) {
  const url = usePrivateStorageUrl("qa-cadastro-selfies", path);
  const [open, setOpen] = useState(false);

  const dim = size === "lg" ? "w-20 h-20 md:w-24 md:h-24" : "w-12 h-12";
  const initial = (name || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <button
        type="button"
        onClick={() => url && setOpen(true)}
        disabled={!url}
        className={`${dim} rounded-xl overflow-hidden shrink-0 flex items-center justify-center border bg-slate-50 transition-all ${url ? "hover:ring-2 hover:ring-[#7A1F2B] cursor-zoom-in" : "cursor-default"}`}
        style={{ borderColor: "hsl(220 13% 88%)" }}
        title={url ? "Clique para ampliar" : "Sem selfie"}
      >
        {url ? (
          <img src={url} alt={name || "Selfie"} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl font-bold" style={{ color: "hsl(220 10% 60%)" }}>{initial}</span>
        )}
      </button>
      {open && url && <PhotoLightbox url={url} alt={name || "Selfie"} onClose={() => setOpen(false)} />}
    </>
  );
}

function DocumentThumb({
  path,
  label,
  name,
  kind = "doc",
}: {
  path: string | null | undefined;
  label: string;
  name?: string | null;
  kind?: "selfie" | "doc";
}) {
  const url = usePrivateStorageUrl("qa-cadastro-selfies", path);
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isSelfie = kind === "selfie";

  const handleDownload = async () => {
    if (!url || !path) return;
    setDownloading(true);
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const ext = (path.split(".").pop() || "jpg").toLowerCase();
      const safeName = (name || "documento").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const filename = `${safeName}-${safeLabel}.${ext}`;
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      console.error("[download]", err);
      toast.error("Falha ao baixar o arquivo");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "hsl(220 10% 45%)" }}>{label}</span>
      <button
        type="button"
        onClick={() => url && setOpen(true)}
        disabled={!url}
        className={`relative w-full aspect-[4/3] rounded-lg overflow-hidden border bg-slate-100 flex items-center justify-center transition-all ${url ? "hover:ring-2 hover:ring-[#7A1F2B] cursor-zoom-in" : "cursor-default"}`}
        style={{ borderColor: "hsl(220 13% 88%)" }}
        title={url ? "Clique para ampliar" : "Não enviado"}
      >
        {url ? (
          <img
            src={url}
            alt={label}
            loading="lazy"
            decoding="async"
            className={`w-full h-full ${isSelfie ? "object-cover" : "object-contain"}`}
          />
        ) : (
          <span className="text-xs font-medium" style={{ color: "hsl(220 10% 60%)" }}>NÃO ENVIADO</span>
        )}
      </button>
      {url && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
          className="h-8 text-[11px] gap-1.5 bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          Baixar
        </Button>
      )}
      {open && url && (
        <PhotoLightbox
          url={url}
          alt={`${label} — ${name || ""}`}
          onClose={() => setOpen(false)}
          mirror={isSelfie}
          fit={isSelfie ? "cover" : "contain"}
        />
      )}
    </div>
  );
}
function ClientPhoto({ path, name, className }: { path: string | null | undefined; name: string; className: string }) {
  const url = usePrivateStorageUrl("qa-documentos", path);
  const [open, setOpen] = useState(false);

  if (!url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-0 border-0 bg-transparent cursor-zoom-in"
        title="Clique para ampliar"
      >
        <img src={url} alt={name} loading="lazy" decoding="async" className={className} />
      </button>
      {open && <PhotoLightbox url={url} alt={name} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ── OCR de documentos do cadastro público (admin) ── */
function CadastroDocumentosCard({
  cadastro,
  onUpdated,
}: {
  cadastro: any;
  onUpdated: (next: any) => void;
}) {
  const [extracting, setExtracting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"identidade" | "endereco" | "avulso">("avulso");
  const [scannerInitialFile, setScannerInitialFile] = useState<File | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImportTargetRef = useRef<"identidade" | "endereco" | "avulso" | null>(null);
  const [pendingImportTarget, setPendingImportTarget] = useState<"identidade" | "endereco" | "avulso" | null>(null);
  const idUrl = usePrivateStorageUrl("qa-cadastro-selfies", cadastro.documento_identidade_path);
  const addrUrl = usePrivateStorageUrl("qa-cadastro-selfies", cadastro.comprovante_endereco_path);

  const fetchAsDataUrl = async (url: string | null): Promise<string | null> => {
    if (!url) return null;
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error("[ocr-fetch]", err);
      return null;
    }
  };

  const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

  const handleExtract = async () => {
    if (!idUrl && !addrUrl) {
      toast.error("Nenhum documento disponível para extração");
      return;
    }
    setExtracting(true);
    const tId = toast.loading("Lendo documentos com IA…");
    try {
      const [identityDataUrl, addressDataUrl] = await Promise.all([
        fetchAsDataUrl(idUrl),
        fetchAsDataUrl(addrUrl),
      ]);

      const { data, error } = await supabase.functions.invoke("qa-extract-documents", {
        body: {
          identity_image: identityDataUrl || undefined,
          address_image: addressDataUrl || undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha na extração");

      const id = data.identity || {};
      const addr = data.address || {};

      const patch: Record<string, any> = {};
      const setIfEmpty = (field: string, value: any) => {
        if (value == null || value === "") return;
        if (!cadastro[field]) patch[field] = value;
      };

      setIfEmpty("nome_completo", id.nome_completo);
      if (id.cpf && onlyDigits(cadastro.cpf).length !== 11) patch.cpf = onlyDigits(id.cpf);
      setIfEmpty("rg", id.rg);
      setIfEmpty("emissor_rg", id.emissor_rg);
      if (id.data_nascimento) {
        const iso = id.data_nascimento.includes("/")
          ? id.data_nascimento.split("/").reverse().join("-")
          : id.data_nascimento;
        setIfEmpty("data_nascimento", iso);
      }
      setIfEmpty("nome_mae", id.nome_mae);
      setIfEmpty("nome_pai", id.nome_pai);

      if (addr.cep) setIfEmpty("end1_cep", onlyDigits(addr.cep));
      setIfEmpty("end1_logradouro", addr.logradouro);
      setIfEmpty("end1_numero", addr.numero);
      setIfEmpty("end1_complemento", addr.complemento);
      setIfEmpty("end1_bairro", addr.bairro);
      setIfEmpty("end1_cidade", addr.cidade);
      setIfEmpty("end1_estado", addr.estado);

      if (Object.keys(patch).length === 0) {
        toast.dismiss(tId);
        toast.info("Nenhum campo novo a preencher — o cadastro já está completo.");
        return;
      }

      const { data: updated, error: upErr } = await supabase
        .from("qa_cadastro_publico" as any)
        .update(patch)
        .eq("id", cadastro.id)
        .select("*")
        .maybeSingle();
      if (upErr) throw upErr;

      onUpdated(updated);
      toast.dismiss(tId);
      toast.success(`Cadastro atualizado: ${Object.keys(patch).length} campo(s) preenchido(s) via OCR`);
    } catch (err: any) {
      console.error("[ocr-extract]", err);
      toast.dismiss(tId);
      toast.error(err?.message || "Falha ao extrair dados do documento");
    } finally {
      setExtracting(false);
    }
  };

  const hasAnyDoc = !!(cadastro.documento_identidade_path || cadastro.comprovante_endereco_path);

  const safeBaseName = (cadastro.nome_completo || "documento")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const openScanner = (target: "identidade" | "endereco" | "avulso") => {
    setScannerTarget(target);
    setScannerInitialFile(null);
    setScannerOpen(true);
  };

  const openImportPicker = (target: "identidade" | "endereco" | "avulso") => {
    pendingImportTargetRef.current = target;
    setPendingImportTarget(target);
    const input = importInputRef.current;
    if (!input) return;
    input.value = "";
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.click();
  };

  const handleImportSelected = (file: File | null) => {
    const target = pendingImportTargetRef.current ?? pendingImportTarget;
    if (!file || !target) return;
    setScannerTarget(target);
    setScannerInitialFile(file);
    pendingImportTargetRef.current = null;
    setPendingImportTarget(null);
    setScannerOpen(true);
  };

  const handleScannerComplete = async ({ blob, pageCount }: { blob: Blob; pageCount: number; previewDataUrl: string }) => {
    const fileNameBase =
      scannerTarget === "identidade" ? "identidade-digitalizada" :
      scannerTarget === "endereco" ? "comprovante-endereco-digitalizado" :
      "documento-digitalizado";
    const fileName = `${safeBaseName}-${fileNameBase}.pdf`;

    // 1) Sempre permite o download imediato
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    } catch (e) { console.error("[scanner-download]", e); }

    // 2) Substitui o anexo do cadastro (somente quando o usuário escolheu um destino)
    if (scannerTarget === "identidade" || scannerTarget === "endereco") {
      const tId = toast.loading("Salvando documento digitalizado…");
      try {
        const path = `cadastro/${cadastro.id}/${scannerTarget}-${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("qa-cadastro-selfies")
          .upload(path, blob, { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;

        const field = scannerTarget === "identidade" ? "documento_identidade_path" : "comprovante_endereco_path";
        const { data: updated, error: dbErr } = await supabase
          .from("qa_cadastro_publico" as any)
          .update({ [field]: path })
          .eq("id", cadastro.id)
          .select("*")
          .maybeSingle();
        if (dbErr) throw dbErr;
        onUpdated(updated);
        toast.dismiss(tId);
        toast.success(`Documento substituído (${pageCount} pág.)`);
      } catch (err: any) {
        console.error("[scanner-upload]", err);
        toast.dismiss(tId);
        toast.error(err?.message || "Falha ao salvar documento digitalizado");
      }
    } else {
      toast.success(`PDF gerado (${pageCount} pág.)`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DocumentThumb path={cadastro.selfie_path} label="Selfie" name={cadastro.nome_completo} kind="selfie" />
        <DocumentThumb path={cadastro.documento_identidade_path} label="Documento de identidade" name={cadastro.nome_completo} kind="doc" />
        <DocumentThumb path={cadastro.comprovante_endereco_path} label="Comprovante de endereço" name={cadastro.nome_completo} kind="doc" />
      </div>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        <p className="text-[11px] leading-relaxed text-slate-500 mb-3">
          <span className="text-slate-800 font-semibold">Scanner de documentos.</span> Capture pela câmera <em>ou</em> importe
          um arquivo (JPG, PNG, PDF) já existente. O sistema detecta bordas, corrige perspectiva e gera um
          PDF com aparência de documento escaneado. Depois, o OCR preenche os campos vazios.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* Linha 1 — escanear via câmera */}
          <button
            type="button"
            onClick={() => openScanner("identidade")}
            className="group h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold tracking-wider text-slate-700 hover:bg-emerald-50 hover:border-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            IDENTIDADE
          </button>
          <button
            type="button"
            onClick={() => openScanner("endereco")}
            className="group h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold tracking-wider text-slate-700 hover:bg-emerald-50 hover:border-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            COMPROVANTE
          </button>
          <button
            type="button"
            onClick={() => openScanner("avulso")}
            className="group h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold tracking-wider text-slate-700 hover:bg-emerald-50 hover:border-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-600" />
            ESCANEAR & PDF
          </button>

          {/* Linha 2 — importar arquivo existente para o pipeline */}
          <button
            type="button"
            onClick={() => openImportPicker("identidade")}
            className="h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-semibold tracking-wider text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <Upload className="w-3.5 h-3.5" />
            IMPORTAR IDENT.
          </button>
          <button
            type="button"
            onClick={() => openImportPicker("endereco")}
            className="h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-semibold tracking-wider text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <Upload className="w-3.5 h-3.5" />
            IMPORTAR COMP.
          </button>
          <button
            type="button"
            onClick={() => openImportPicker("avulso")}
            className="h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-semibold tracking-wider text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <Upload className="w-3.5 h-3.5" />
            IMPORTAR ARQUIVO
          </button>
        </div>

        {hasAnyDoc && (
          <div className="mt-3 pt-3 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting}
              className="h-9 inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 text-[11px] font-bold tracking-wider text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300 shadow-sm"
            >
              {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
              EXTRAIR DADOS VIA OCR
            </button>
          </div>
        )}

        <input
          ref={importInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            handleImportSelected(f);
            e.target.value = "";
          }}
        />
      </div>

      <DocumentScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onComplete={handleScannerComplete}
        initialFile={scannerInitialFile}
        title={
          scannerTarget === "identidade" ? "ESCANEAR DOCUMENTO DE IDENTIDADE" :
          scannerTarget === "endereco" ? "ESCANEAR COMPROVANTE DE ENDEREÇO" :
          "ESCANEAR DOCUMENTO"
        }
      />
    </div>
  );
}

const formatCpf = (v: string | null | undefined): string => {
  if (!v) return "—";
  const d = v.replace(/\D/g, "");
  if (d.length !== 11) return v;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const daysUntilDate = (d: string | null | undefined): number | null => {
  if (!d) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : Math.ceil((parsed.getTime() - Date.now()) / 86400000);
};

const normalizeRgInput = (v: string | null | undefined): string => {
  const raw = (v ?? "").toUpperCase().replace(/[^0-9X]/g, "");
  const hasVerifierX = raw.endsWith("X");
  const digits = raw.replace(/X/g, "");
  return hasVerifierX ? `${digits.slice(0, 8)}X` : digits.slice(0, 9);
};

const maskRg = (v: string | null | undefined): string => {
  const d = normalizeRgInput(v);
  if (!d) return "";
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}-${d.slice(8)}`;
};

const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

interface Cliente {
  id: number; id_legado: number; nome_completo: string; cpf: string; rg: string; emissor_rg: string;
  uf_emissor_rg?: string;
  data_nascimento: string; naturalidade: string; nacionalidade: string; nome_mae: string; nome_pai: string;
  estado_civil: string; profissao: string; email: string; celular: string; endereco: string; numero: string;
  bairro: string; cep: string; cidade: string; estado: string; observacao: string; complemento: string;
  status: string; created_at: string; escolaridade?: string; titulo_eleitor?: string;
  endereco2?: string; numero2?: string; bairro2?: string; cep2?: string; cidade2?: string; estado2?: string;
  complemento2?: string; pais?: string; pais2?: string; expedicao_rg?: string;
}

interface CadastroPublico {
  id: string;
  nome_completo: string;
  cpf: string;
  rg?: string | null;
  emissor_rg?: string | null;
  data_nascimento?: string | null;
  telefone_principal?: string | null;
  telefone_secundario?: string | null;
  email?: string | null;
  nome_mae?: string | null;
  nome_pai?: string | null;
  estado_civil?: string | null;
  nacionalidade?: string | null;
  profissao?: string | null;
  observacoes?: string | null;
  end1_cep?: string | null;
  end1_logradouro?: string | null;
  end1_numero?: string | null;
  end1_complemento?: string | null;
  end1_bairro?: string | null;
  end1_cidade?: string | null;
  end1_estado?: string | null;
  tem_segundo_endereco?: boolean | null;
  end2_tipo?: string | null;
  end2_cep?: string | null;
  end2_logradouro?: string | null;
  end2_numero?: string | null;
  end2_complemento?: string | null;
  end2_bairro?: string | null;
  end2_cidade?: string | null;
  end2_estado?: string | null;
  vinculo_tipo?: string | null;
  emp_cnpj?: string | null;
  emp_razao_social?: string | null;
  emp_nome_fantasia?: string | null;
  emp_situacao_cadastral?: string | null;
  emp_cargo_funcao?: string | null;
  emp_participacao_societaria?: string | null;
  emp_endereco?: string | null;
  emp_telefone?: string | null;
  emp_email?: string | null;
  trab_nome_empresa?: string | null;
  trab_cnpj_empresa?: string | null;
  trab_cargo_funcao?: string | null;
  trab_data_admissao?: string | null;
  trab_faixa_salarial?: string | null;
  trab_endereco_empresa?: string | null;
  trab_telefone_empresa?: string | null;
  aut_atividade?: string | null;
  aut_nome_profissional?: string | null;
  aut_cnpj?: string | null;
  aut_telefone?: string | null;
  aut_endereco?: string | null;
  comprovante_endereco_proprio?: string | null;
  servico_interesse?: string | null;
  // Qualificação comercial (cadastro público v2)
  objetivo_principal?: string | null;
  categoria_servico?: string | null;
  servico_principal?: string | null;
  subtipo_servico?: string | null;
  descricao_servico_livre?: string | null;
  servico_fechado_final?: string | null;
  origem_cadastro?: string | null;
  consentimento_dados_verdadeiros?: boolean | null;
  consentimento_tratamento_dados?: boolean | null;
  consentimento_timestamp?: string | null;
  status: string;
  pago?: boolean | null;
  selfie_path?: string | null;
  documento_identidade_path?: string | null;
  comprovante_endereco_path?: string | null;
  created_at: string;
}

const normalizeDigits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

const emptyToNull = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
};

const pickNew = (incoming: string | null | undefined, current: string | null | undefined) => {
  const next = emptyToNull(incoming);
  return next ?? current ?? null;
};

/** Convert "DD/MM/YYYY" or "YYYY-MM-DD" to ISO "YYYY-MM-DD". Returns null if invalid. */
const toIsoDate = (value: string | null | undefined): string | null => {
  const v = (value ?? "").trim();
  if (!v) return null;
  // Already ISO
  const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // BR
  const brMatch = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    const day = Number(dd), month = Number(mm), year = Number(yyyy);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
};

/** Build update payload from cadastro público → qa_clientes. NEVER touches observacao when current has content. */
const buildClientePayload = (cadastro: CadastroPublico, cur?: Partial<Cliente> | null) => {
  const estado1 = emptyToNull(cadastro.end1_estado)?.toUpperCase() ?? null;
  const estado2 = emptyToNull(cadastro.end2_estado)?.toUpperCase() ?? null;
  // Protect observacao: if current already has process numbers, keep it
  const currentObs = emptyToNull(cur?.observacao);
  const incomingObs = emptyToNull(cadastro.observacoes);
  const observacao = currentObs
    ? (incomingObs && incomingObs !== currentObs ? `${currentObs}\n\n--- Cadastro público ---\n${incomingObs}` : currentObs)
    : incomingObs;
  // data_nascimento na qa_clientes é DATE — precisa ISO ou null
  const dnIncomingIso = toIsoDate(cadastro.data_nascimento);
  const dnCurrentIso = toIsoDate(cur?.data_nascimento as any);
  return {
    nome_completo: pickNew(cadastro.nome_completo, cur?.nome_completo) ?? "",
    cpf: normalizeDigits(cadastro.cpf) || cur?.cpf || null,
    rg: pickNew(cadastro.rg, cur?.rg),
    emissor_rg: pickNew(cadastro.emissor_rg, cur?.emissor_rg),
    uf_emissor_rg: emptyToNull((cadastro as any).uf_emissor_rg)?.toUpperCase() ?? cur?.uf_emissor_rg ?? null,
    data_nascimento: dnIncomingIso ?? dnCurrentIso ?? null,
    nacionalidade: pickNew(cadastro.nacionalidade, cur?.nacionalidade),
    estado_civil: pickNew(cadastro.estado_civil, cur?.estado_civil),
    profissao: pickNew(cadastro.profissao, cur?.profissao),
    nome_mae: pickNew(cadastro.nome_mae, cur?.nome_mae),
    nome_pai: pickNew(cadastro.nome_pai, cur?.nome_pai),
    email: pickNew(cadastro.email, cur?.email),
    celular: pickNew(cadastro.telefone_principal, cur?.celular),
    endereco: pickNew(cadastro.end1_logradouro, cur?.endereco),
    numero: pickNew(cadastro.end1_numero, cur?.numero),
    complemento: pickNew(cadastro.end1_complemento, cur?.complemento),
    bairro: pickNew(cadastro.end1_bairro, cur?.bairro),
    cep: pickNew(normalizeDigits(cadastro.end1_cep) || emptyToNull(cadastro.end1_cep), cur?.cep),
    cidade: pickNew(cadastro.end1_cidade, cur?.cidade),
    estado: pickNew(estado1, cur?.estado),
    endereco2: pickNew(cadastro.end2_logradouro, cur?.endereco2),
    numero2: pickNew(cadastro.end2_numero, cur?.numero2),
    complemento2: pickNew(cadastro.end2_complemento, cur?.complemento2),
    bairro2: pickNew(cadastro.end2_bairro, cur?.bairro2),
    cep2: pickNew(normalizeDigits(cadastro.end2_cep) || emptyToNull(cadastro.end2_cep), cur?.cep2),
    cidade2: pickNew(cadastro.end2_cidade, cur?.cidade2),
    estado2: pickNew(estado2, cur?.estado2),
    observacao,
    status: cur?.status ?? "ATIVO",
  };
};

/** Computes diff between previous client state and new payload, returning only changed fields. */
const FIELD_LABELS: Record<string, string> = {
  nome_completo: "Nome completo", cpf: "CPF", rg: "RG", emissor_rg: "Emissor RG", uf_emissor_rg: "UF Emissor",
  data_nascimento: "Data de nascimento", nacionalidade: "Nacionalidade", estado_civil: "Estado civil",
  profissao: "Profissão", nome_mae: "Nome da mãe", nome_pai: "Nome do pai", email: "E-mail", celular: "Celular",
  endereco: "Endereço", numero: "Número", complemento: "Complemento", bairro: "Bairro", cep: "CEP",
  cidade: "Cidade", estado: "Estado",
  endereco2: "Endereço (2º)", numero2: "Número (2º)", complemento2: "Complemento (2º)", bairro2: "Bairro (2º)",
  cep2: "CEP (2º)", cidade2: "Cidade (2º)", estado2: "Estado (2º)", observacao: "Observações",
};
const computeDiff = (
  oldData: Record<string, any>,
  newData: Record<string, any>,
): Array<{ field: string; label: string; old: any; new: any }> => {
  const changes: Array<{ field: string; label: string; old: any; new: any }> = [];
  for (const key of Object.keys(newData)) {
    const oldV = oldData?.[key] ?? null;
    const newV = newData?.[key] ?? null;
    const oldNorm = oldV === undefined || oldV === "" ? null : oldV;
    const newNorm = newV === undefined || newV === "" ? null : newV;
    if (String(oldNorm ?? "") !== String(newNorm ?? "")) {
      changes.push({ field: key, label: FIELD_LABELS[key] || key, old: oldNorm, new: newNorm });
    }
  }
  return changes;
};

function SortableServicoRow({ id, children }: { id: string; children: (handleProps: { listeners: any; attributes: any; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : "auto",
    position: "relative",
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, attributes, isDragging })}
    </div>
  );
}

/**
 * KPI inline da Circunscrição PF do cliente.
 * Resolve a unidade da Polícia Federal a partir de cidade/UF do cliente
 * usando a mesma RPC `qa_resolver_circunscricao_pf` já utilizada na geração
 * de peças (ver ClientePecas.tsx). Não cria arquitetura paralela.
 */
function CircunscricaoKpi({ cidade, uf }: { cidade: string | null | undefined; uf: string | null | undefined }) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "empty" | "error">("idle");
  const [data, setData] = useState<{ unidade_pf?: string; sigla_unidade?: string } | null>(null);

  useEffect(() => {
    const c = (cidade || "").replace(/\s+/g, " ").trim();
    const u = (uf || "").trim().toUpperCase();
    if (!c || !u) { setStatus("idle"); setData(null); return; }
    let aborted = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    setStatus("loading");
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/qa_resolver_circunscricao_pf`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_municipio: c, p_uf: u }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (aborted) return;
        if (!res.ok) { setStatus("error"); setData(null); return; }
        const arr = await res.json();
        if (!arr || arr.length === 0) { setStatus("empty"); setData(null); return; }
        setData(arr[0]);
        setStatus("ok");
      } catch {
        if (!aborted) { setStatus("error"); setData(null); }
      }
    })();
    return () => { aborted = true; clearTimeout(timer); controller.abort(); };
  }, [cidade, uf]);

  const color = "hsl(220 70% 50%)";
  const value =
    status === "loading" ? "RESOLVENDO..." :
    status === "ok" && data ? `${data.sigla_unidade || ""}${data.sigla_unidade && data.unidade_pf ? " — " : ""}${data.unidade_pf || ""}`.trim() :
    status === "empty" ? "NÃO LOCALIZADA" :
    status === "error" ? "FALHA AO RESOLVER" :
    "—";
  const tooltip = status === "ok" && data ? `${data.sigla_unidade || ""} — ${data.unidade_pf || ""}` : value;

  return (
    <div className="flex items-center gap-2.5 px-4 py-3 first:border-l-0">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
        style={{ background: `${color}14`, color, boxShadow: `inset 0 0 0 1px ${color}1f` }}
      >
        <Landmark className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">CIRCUNSCRIÇÃO PF</div>
        <div className="text-[12px] font-bold text-slate-800 uppercase leading-tight break-words" title={tooltip}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function QAClientesPage() {
  const { statuses: statusList } = useQAStatusServico();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [tab, setTab] = useState("resumo");

  const [vendas, setVendas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  // Solicitações vindas do formulário público para o cliente selecionado.
  // Apenas leitura; jamais cria pagamento. Usado para evitar "Serviços (0)"
  // quando o cliente veio da internet com serviço informado.
  const { solicitacoes: solicitacoesPublicas, reload: reloadSolicitacoes } =
    useSolicitacoesPublicasDoCliente(selected?.id ?? null, itens);
  // FASE 16-C — processos vinculados às vendas do cliente (para mostrar
  // badge "Processo gerado" / botão "Abrir" e bloquear duplicidade na UI).
  const [processosVenda, setProcessosVenda] = useState<any[]>([]);
  const [crafs, setCrafs] = useState<any[]>([]);
  const [gtes, setGtes] = useState<any[]>([]);
  // FASE 4 — armas vindas de qa_cliente_armas_manual (cadastro manual / IA / OCR).
  const [armasManual, setArmasManual] = useState<any[]>([]);
  const [filiacoes, setFiliacoes] = useState<any[]>([]);
  const [cadastro, setCadastro] = useState<any>(null);
  const [examesAtuais, setExamesAtuais] = useState<any[]>([]);
  // Documentos enviados pelo cliente via portal/app/arsenal (qa_documentos_cliente).
  const [docsCliente, setDocsCliente] = useState<any[]>([]);
  const [loadingSub, setLoadingSub] = useState(false);

  // Modal states
  const [clienteModal, setClienteModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [vendaModal, setVendaModal] = useState<{ open: boolean; item?: any; solicitacaoId?: string | null }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; table: string; id: number; title: string; desc: string }>({ open: false, table: "", id: 0, title: "", desc: "" });
  const [deleting, setDeleting] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [itemEditForm, setItemEditForm] = useState<Record<string, string>>({});
  const [savingItem, setSavingItem] = useState(false);

  // Sensores DnD para reordenar serviços dentro de uma venda
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleReorderItens = async (vendaFk: number | string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const vendaItens = itens.filter((i: any) => i.venda_id === vendaFk);
    const oldIndex = vendaItens.findIndex((i: any) => String(i.id) === String(active.id));
    const newIndex = vendaItens.findIndex((i: any) => String(i.id) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(vendaItens, oldIndex, newIndex);
    const reorderedById = new Map(reordered.map((it: any, idx: number) => [it.id, idx + 1]));
    setItens(prev => prev.map((i: any) =>
      reorderedById.has(i.id) ? { ...i, sort_order: reorderedById.get(i.id) } : i
    ));
    try {
      await Promise.all(reordered.map((it: any, idx: number) =>
        supabase.from("qa_itens_venda" as any).update({ sort_order: idx + 1 }).eq("id", it.id)
      ));
    } catch (e: any) {
      toast.error("Falha ao salvar ordem: " + (e?.message || "erro"));
    }
  };


  // Serviços de Concessão de CR (Exército Brasileiro) — possuem apenas campos do CR
  // REGRA: TODA variante de "Concessão de CR" usa o MESMO formulário de detalhes.
  //   13 → Mudança de Serviço Contratado - Posse (PF) para Concessão de CR (EB)
  //   20 → Concessão de CR no Exército Brasileiro sem clube / Militar
  //   31 → Concessão de CR no Exército Brasileiro
  // Mantemos 27/29 por compatibilidade defensiva caso voltem ao catálogo.
  const SERVICOS_CR = [13, 20, 27, 29, 31];
  // Serviços CAC (Colecionador, Atirador, Caçador) e correlatos onde campos SIGMA/CRAF/Porte/GTE são aplicáveis
  // OBS: Porte na Polícia Federal (id=3) NÃO é CAC — possui apenas Nº Porte, sem CRAF/GTE/CR/SIGMA/SINARM
    // OBS: Concessão de CR (13, 20, 27, 31) foi REMOVIDA daqui — possui apenas campos exclusivos do CR
  // OBS: Autorização de compra de arma de fogo no EB (5, 15) foi REMOVIDA daqui — possui apenas campos específicos da autorização
  // OBS: COMBO - Registro de arma de fogo CRAF no EB (id=6) foi REMOVIDA daqui — possui formulário próprio com dados da arma
  const SERVICOS_CAC = [4, 7, 8, 9, 10, 14, 16, 17, 18];
  // Serviços de Autorização de compra de arma de fogo no Exército Brasileiro
  const SERVICOS_AUTORIZACAO_EB = [5, 15];
  // Serviço de Posse na Polícia Federal
  const SERVICOS_POSSE = [2];
  // Serviço COMBO - Registro de arma de fogo (CRAF) no Exército Brasileiro
  const SERVICOS_CRAF_EB = [6];

  const ITEM_EDIT_FIELDS: { key: string; label: string; type: "date" | "text"; servicos?: number[]; condition?: (form: Record<string, string>, item?: any) => boolean; required?: boolean }[] = [
    /* ================================================================
     * POSSE NA POLÍCIA FEDERAL (servico_id = 2) — formulário dedicado
     * Ordem fixa solicitada: Nº Requerimento → Protocolo → Notificação →
     * Indeferimento → Recurso Adm. → Indeferimento do Recurso → Deferimento →
     * Nº Autorização → Validade Autorização.
     * Regra: Nº Processo NÃO aparece em Posse PF.
     * ================================================================ */
    { key: "numero_posse",                  label: "Nº do Requerimento de Posse",       type: "text", servicos: SERVICOS_POSSE },
    { key: "data_protocolo",                label: "Data Protocolo",                    type: "date", servicos: SERVICOS_POSSE },
    { key: "data_notificacao",              label: "Data da Notificação",               type: "date", servicos: SERVICOS_POSSE },
    { key: "data_indeferimento",            label: "Data de Indeferimento",             type: "date", servicos: SERVICOS_POSSE },
    { key: "data_recurso_administrativo",   label: "Data do Recurso Administrativo",    type: "date", servicos: SERVICOS_POSSE },
    { key: "data_indeferimento_recurso",    label: "Data de Indeferimento do Recurso",  type: "date", servicos: SERVICOS_POSSE },
    { key: "data_deferimento",              label: "Data Deferimento",                  type: "date", servicos: SERVICOS_POSSE, condition: (_f, it) => (it?.status || "").toUpperCase() !== "INDEFERIDO" },
    { key: "numero_autorizacao",            label: "Código da Autorização",             type: "text", servicos: SERVICOS_POSSE },
    { key: "validade_autorizacao",          label: "Validade da Autorização",           type: "date", servicos: SERVICOS_POSSE },

    /* ================================================================
     * DEMAIS SERVIÇOS (mantém estrutura anterior)
     * Posse PF (id=2) FOI REMOVIDA das listas abaixo — possui form próprio.
     * ================================================================ */
    { key: "data_protocolo", label: "Data Protocolo do CR", type: "date", servicos: SERVICOS_CR },
    { key: "data_protocolo", label: "Data Protocolo", type: "date", servicos: [3, 4, 5, 6, 7, 8, 9, 10, 14, 15, 16, 17, 18, 26] },
    // Nº do Requerimento — exclusivo de Porte na Polícia Federal
    { key: "numero_requerimento", label: "Nº do Requerimento", type: "text", servicos: [3] },
    // Data Notificação — Porte PF (3) e CRAF PF (26) também precisam exibir para
    // controle do prazo recursal de 10 dias (Lei 9.784/99 art. 59).
    { key: "data_notificacao", label: "Data da Notificação", type: "date", servicos: [3, 26] },
    { key: "data_deferimento", label: "Data Deferimento do CR", type: "date", servicos: SERVICOS_CR, condition: (_f, it) => (it?.status || "").toUpperCase() !== "INDEFERIDO" },
    { key: "data_deferimento", label: "Data Deferimento", type: "date", servicos: [3, 4, 5, 6, 7, 8, 9, 10, 14, 15, 16, 17, 18, 26], condition: (_f, it) => (it?.status || "").toUpperCase() !== "INDEFERIDO" },
    // Data de Indeferimento — REGRA GLOBAL: aparece APENAS quando o status do item é INDEFERIDO (exceto Posse, que tem regra própria acima)
    { key: "data_indeferimento", label: "Data de Indeferimento", type: "date", condition: (_f, it) => (it?.status || "").toUpperCase() === "INDEFERIDO", servicos: [3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18, 20, 26, 27, 31] },
    { key: "data_vencimento", label: "Data Vencimento do CR", type: "date", servicos: SERVICOS_CR },
    // Data Vencimento — removida para Autorização de compra EB (5, 15); substituída por "Validade Autorização"
    { key: "data_vencimento", label: "Data Vencimento", type: "date", servicos: [3, 4, 6, 7, 8, 9, 10, 14, 16, 17, 18, 26] },
    // Nº Processo — para CR é "Nº de Protocolo do CR"; demais usam "Nº Processo" (REMOVIDO de Posse PF)
    { key: "numero_processo", label: "Nº de Protocolo do CR", type: "text", servicos: SERVICOS_CR },
    { key: "numero_processo", label: "Nº do Requerimento", type: "text", servicos: [26] },
    { key: "numero_processo", label: "Nº Processo", type: "text", servicos: [4, 5, 6, 7, 8, 9, 10, 14, 15, 16, 17, 18] },
    // Campos exclusivos de CAC — NÃO aparecem em Posse na PF, Concessão de CR, nem CRAF EB (id=6)
    { key: "numero_craf", label: "Nº CRAF", type: "text", servicos: SERVICOS_CAC },
    { key: "numero_gte", label: "Nº GTE", type: "text", servicos: SERVICOS_CAC },
    // Nº CR — aparece em CAC e em Concessão de CR (com rótulo "Nº de Certificado de Registro (CR)")
    { key: "numero_cr", label: "Nº de Certificado de Registro (CR)", type: "text", servicos: SERVICOS_CR },
    { key: "numero_cr", label: "Nº CR", type: "text", servicos: SERVICOS_CAC },
    { key: "numero_porte", label: "Nº Porte", type: "text", servicos: [3, ...SERVICOS_CAC] },
    { key: "numero_sigma", label: "Nº SIGMA", type: "text", servicos: SERVICOS_CAC },
    { key: "numero_sinarm", label: "Nº SINARM", type: "text", servicos: SERVICOS_CAC },
    { key: "registro_cad", label: "Registro CAD", type: "text", servicos: SERVICOS_CAC },
    // Nº CAD SINARM — obrigatório em CRAF na Polícia Federal
    { key: "registro_cad", label: "Nº CAD SINARM", type: "text", servicos: [26], required: true },
    // Autorização de compra EB (Posse PF tem campos próprios na seção dedicada acima)
    { key: "numero_autorizacao", label: "Nº Autorização", type: "text", servicos: [5, 15] },
    { key: "validade_autorizacao", label: "Validade Autorização", type: "date", servicos: [5, 15] },
    // CRAF na Polícia Federal — dados da arma
    { key: "numero_registro", label: "Nº Registro", type: "text", servicos: [26] },
    { key: "numero_serie", label: "Nº Série", type: "text", servicos: [26] },
    { key: "fabricante", label: "Fabricante", type: "text", servicos: [26] },
    { key: "modelo", label: "Modelo", type: "text", servicos: [26] },
    { key: "calibre", label: "Calibre", type: "text", servicos: [26] },
    // COMBO - Registro de arma de fogo (CRAF) no Exército Brasileiro — dados da arma
    { key: "numero_serie", label: "Nº de Série da Arma", type: "text", servicos: SERVICOS_CRAF_EB },
    { key: "fabricante", label: "Fabricante da Arma", type: "text", servicos: SERVICOS_CRAF_EB },
    { key: "modelo", label: "Modelo da Arma", type: "text", servicos: SERVICOS_CRAF_EB },
    { key: "calibre", label: "Calibre da Arma", type: "text", servicos: SERVICOS_CRAF_EB },
    { key: "quantidade_tiros", label: "Quantidade de Tiros da Arma", type: "text", servicos: SERVICOS_CRAF_EB },
  ];

  /** REGRA GLOBAL: o formulário de detalhes só é liberado após o status do item ser definido. */
  const isStatusDefinido = (s: any) => String(s || "").trim().length > 0;

  /** Retorna apenas os campos aplicáveis ao serviço (filtra por servico_id quando definido). */
  const getFieldsForServico = (servicoId: number | null | undefined, form?: Record<string, string>, item?: any) =>
    ITEM_EDIT_FIELDS.filter(f =>
      (!f.servicos || (servicoId != null && f.servicos.includes(servicoId))) &&
      (!f.condition || f.condition(form || {}, item))
    );

  const parseCalendarDate = (value: string): Date | null => {
    if (!value) return null;

    const dmy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (dmy) {
      let [, d, m, y] = dmy;
      let year = Number(y);
      if (year < 100) year += 2000;

      const day = Number(d);
      const month = Number(m);
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;

      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
      return parsed;
    }

    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const [, y, m, d] = iso;
      const year = Number(y);
      const month = Number(m);
      const day = Number(d);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
      return parsed;
    }

    return null;
  };

  const dateToBr = (value: string | null | undefined): string => {
    if (!value) return "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;

    const parsed = parseCalendarDate(value);
    if (!parsed) return value;

    const day = String(parsed.getUTCDate()).padStart(2, "0");
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const year = parsed.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleExpandItem = (item: any) => {
    if (expandedItemId === item.id) {
      setExpandedItemId(null);
      setItemEditForm({});
      return;
    }
    if (!isStatusDefinido(item?.status)) {
      toast.error("Selecione o status do serviço antes de preencher o formulário.");
      return;
    }
    setExpandedItemId(item.id);
    const form: Record<string, string> = {};
    ITEM_EDIT_FIELDS.forEach(f => {
      const val = item[f.key];
      form[f.key] = f.type === "date" ? dateToBr(val) : (val || "");
    });
    setItemEditForm(form);
  };

  /** Máscara automática DD/MM/AAAA */
  const applyDateMask = (raw: string): string => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  /** Converte DD/MM/AAAA → YYYY-MM-DD para gravar no banco (tipo date) */
  const dateBrToIso = (v: string): string | null => {
    if (!v) return null;
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSaveItem = async () => {
    if (!expandedItemId) return;
    const currentItem = (itens as any[]).find(i => i.id === expandedItemId);
    if (!isStatusDefinido(currentItem?.status)) {
      toast.error("Selecione o status do serviço antes de salvar.");
      return;
    }
    const servicoId = currentItem?.servico_id;
    const applicableFields = getFieldsForServico(servicoId, itemEditForm, currentItem);
    setSavingItem(true);
    try {
      const payload: Record<string, any> = {};
      // Status que dispensam campos de "outorga" (deferimento) — ex.: INDEFERIDO, EM ANÁLISE, etc.
      const statusAtual = String(currentItem?.status || "").toLowerCase();
      const dispensaDeferimento = ["indeferido", "cancelado", "em_analise", "pronto_para_analise", "a_iniciar", "montando_pasta", "aguardando_documentos"].includes(statusAtual);
      for (const f of applicableFields) {
        const v = itemEditForm[f.key]?.trim() || null;
        // Campos só obrigatórios quando o processo foi efetivamente DEFERIDO/CONCLUÍDO
        const isFieldRequired = f.required && !dispensaDeferimento;
        if (isFieldRequired && !v) {
          toast.error(`Campo obrigatório: "${f.label}".`);
          setSavingItem(false);
          return;
        }
        if (f.type === "date") {
          if (v) {
            const iso = dateBrToIso(v);
            if (!iso) {
              toast.error(`Data inválida em "${f.label}". Use DD/MM/AAAA.`);
              setSavingItem(false);
              return;
            }
            payload[f.key] = iso;
          } else {
            payload[f.key] = null;
          }
        } else {
          payload[f.key] = v;
        }
      }
      const today = new Date();
      payload.data_ultima_atualizacao = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      // Regra automática: ao preencher data_indeferimento em serviços PF (Posse/Porte/CRAF),
      // o status passa automaticamente para "RECURSO ADMINISTRATIVO" — assim o card de
      // prazos do dashboard reflete a fase processual correta (Lei 9.784/99 art. 59).
      const SERVICOS_PF_RECURSO_IDS = [2, 3, 26];
      if (
        servicoId && SERVICOS_PF_RECURSO_IDS.includes(servicoId) &&
        Object.prototype.hasOwnProperty.call(payload, "data_indeferimento") &&
        payload.data_indeferimento &&
        payload.data_indeferimento !== currentItem?.data_indeferimento &&
        String(currentItem?.status || "").toUpperCase() !== "RECURSO ADMINISTRATIVO"
      ) {
        payload.status = "RECURSO ADMINISTRATIVO";
      }
      const { error } = await supabase.from("qa_itens_venda" as any).update(payload).eq("id", expandedItemId);
      if (error) throw error;
      setItens(prev => prev.map((i: any) => i.id === expandedItemId ? { ...i, ...payload } : i));
      toast.success("Dados do serviço atualizados");
      setExpandedItemId(null);
      setItemEditForm({});
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (!item?.id) return;
    const nome = (() => {
      const svc = (servicos as any[]).find(s => s.id === item.servico_id);
      return svc?.nome_servico || `Serviço #${item.servico_id}`;
    })();
    if (!window.confirm(`Excluir o item "${nome}" (R$ ${Number(item.valor || 0).toFixed(2)}) desta venda?\n\nEsta ação não pode ser desfeita.`)) return;
    try {
      const { error } = await supabase.from("qa_itens_venda" as any).delete().eq("id", item.id);
      if (error) throw error;
      // Recalcula total da venda (soma dos itens restantes - desconto)
      const venda = (vendas as any[]).find(v => (v.id_legado ?? v.id) === item.venda_id);
      if (venda) {
        const restantes = (itens as any[]).filter(i => i.venda_id === item.venda_id && i.id !== item.id);
        const subtotal = restantes.reduce((s, i) => s + Number(i.valor || 0), 0);
        const desconto = Number(venda.desconto || 0);
        const novoTotal = Math.max(0, subtotal - desconto);
        await supabase.from("qa_vendas" as any).update({ valor_a_pagar: novoTotal, valor_total: subtotal }).eq("id", venda.id);
        setVendas(prev => (prev as any[]).map(v => v.id === venda.id ? { ...v, valor_a_pagar: novoTotal, valor_total: subtotal } : v));
      }
      setItens(prev => (prev as any[]).filter(i => i.id !== item.id));
      if (expandedItemId === item.id) { setExpandedItemId(null); setItemEditForm({}); }
      toast.success("Item excluído e total recalculado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir item");
    }
  };

  const [cadastrosPublicos, setCadastrosPublicos] = useState<CadastroPublico[]>([]);
  const [tabView, setTabView] = useState<"clientes" | "manuais" | "cadastros" | "rejeitados">("clientes");
  const [cadastroFilter, setCadastroFilter] = useState<"pendente" | "aprovado">("pendente");
  const [selectedCadastroPublico, setSelectedCadastroPublico] = useState<CadastroPublico | null>(null);
  const [loadingCadastroPublico, setLoadingCadastroPublico] = useState(false);
  const [savingCadastroPublicoStatus, setSavingCadastroPublicoStatus] = useState<string | null>(null);
  const [editingCadastroPublico, setEditingCadastroPublico] = useState(false);
  const [cadastroEditForm, setCadastroEditForm] = useState<Record<string, any>>({});
  const [savingCadastroEdit, setSavingCadastroEdit] = useState(false);
  const [servicos, setServicos] = useState<{ id: number; nome_servico: string }[]>([]);

  const dataLoadedRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;
    loadClientes(); loadCadastrosPublicos(); loadServicos();
  }, []);

  // Auto-abrir cliente via ?cliente=ID (vindo do Dashboard de Exames, etc.)
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    const targetId = searchParams.get("cliente");
    const cadastroPubId = searchParams.get("cadastro_publico");
    if (cadastroPubId && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      openCadastroPublico(cadastroPubId);
      const next = new URLSearchParams(searchParams);
      next.delete("cadastro_publico");
      setSearchParams(next, { replace: true });
      return;
    }
    if (!targetId || autoOpenedRef.current || clientes.length === 0) return;
    // O Monitor envia o FK canônico (id_legado). Buscamos por id_legado primeiro,
    // com fallback para id quando o cliente não tiver id_legado.
    const targetNum = Number(targetId);
    const cli = clientes.find((c) => c.id_legado === targetNum) ?? clientes.find((c) => c.id === targetNum);
    if (cli) {
      autoOpenedRef.current = true;
      openClient(cli);
      const tabParam = searchParams.get("tab");
      if (tabParam) setTab(tabParam);
      // Limpa a URL para não reabrir ao navegar
      const next = new URLSearchParams(searchParams);
      next.delete("cliente");
      next.delete("tab");
      setSearchParams(next, { replace: true });
    }
  }, [clientes, searchParams]);

  const loadServicos = async () => {
    const { data } = await supabase.from("qa_servicos" as any).select("id, nome_servico").order("id");
    if (data) setServicos(data as any[]);
  };

  const loadClientes = async () => {
    setLoading(true);
    setLoadError(null);
    // Safety: nunca deixar o spinner principal eterno (12s).
    const safety = setTimeout(() => {
      console.warn("[QAClientes] safety timeout 12s — liberando UI com erro");
      setLoadError(new Error("Tempo limite excedido ao carregar clientes."));
      setLoading(false);
    }, 12000);
    try {
      const { data, error } = await supabase
        .from("qa_clientes" as any)
        .select("*")
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      const rows = (data as any[]) ?? [];

      // Enriquece cada cliente com `selfie_path` do cadastro público em UMA única
      // query (evita N consultas no avatar de cada linha da listagem).
      try {
        const cadIds = Array.from(new Set(rows.map((r: any) => r.cadastro_publico_id).filter(Boolean)));
        const cliIds = Array.from(new Set(rows.map((r: any) => r.id).filter(Boolean)));
        const selfieByCadId = new Map<string, string>();
        const selfieByCliId = new Map<number, string>();
        if (cadIds.length > 0) {
          const { data: cads } = await supabase
            .from("qa_cadastro_publico" as any)
            .select("id, selfie_path")
            .in("id", cadIds);
          for (const c of (cads as any[]) || []) {
            if (c?.selfie_path) selfieByCadId.set(c.id, c.selfie_path);
          }
        }
        if (cliIds.length > 0) {
          const { data: cads2 } = await supabase
            .from("qa_cadastro_publico" as any)
            .select("cliente_id_vinculado, selfie_path, created_at")
            .in("cliente_id_vinculado", cliIds)
            .not("selfie_path", "is", null)
            .order("created_at", { ascending: false });
          for (const c of (cads2 as any[]) || []) {
            const cid = c?.cliente_id_vinculado;
            if (cid && c?.selfie_path && !selfieByCliId.has(cid)) {
              selfieByCliId.set(cid, c.selfie_path);
            }
          }
        }
        for (const r of rows) {
          if (r.imagem) continue; // upload manual tem prioridade
          const fromCad = r.cadastro_publico_id ? selfieByCadId.get(r.cadastro_publico_id) : null;
          const fromCli = selfieByCliId.get(r.id);
          const sp = fromCad || fromCli || null;
          if (sp) (r as any).selfie_path = sp;
        }
      } catch (enrichErr) {
        console.warn("[QAClientes] selfie enrich falhou (não crítico):", enrichErr);
      }

      setClientes(rows);
      setLoadError(null);
    } catch (err: any) {
      console.error("[QAClientes] loadClientes error:", err);
      setLoadError(err instanceof Error ? err : new Error(String(err?.message || err)));
    } finally {
      clearTimeout(safety);
      setLoading(false);
    }
  };

  const loadCadastrosPublicos = async () => {
    const { data } = await supabase.from("qa_cadastro_publico" as any)
      .select("id, nome_completo, cpf, telefone_principal, email, end1_cidade, end1_estado, servico_interesse, vinculo_tipo, status, pago, created_at, objetivo_principal, categoria_servico, servico_principal, subtipo_servico, servico_fechado_final, origem_cadastro")
      .order("created_at", { ascending: false });
    setCadastrosPublicos((data as unknown as CadastroPublico[]) ?? []);
  };

  const openCadastroPublico = async (cadastroId: string) => {
    setLoadingCadastroPublico(true);
    // Limpa estado anterior — o ID da URL manda; nunca reabrir cliente em memória.
    setSelected(null);
    setSelectedCadastroPublico(null);
    try {
      const { data, error } = await supabase.from("qa_cadastro_publico" as any)
        .select("*")
        .eq("id", cadastroId)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Cadastro público não encontrado");
        return;
      }

      const cad = data as any;
      const cpfCadNorm = String(cad.cpf || "").replace(/\D/g, "");

      // Se houver vínculo, RESOLVE pela PK real (qa_clientes.id) e VALIDA CPF
      // antes de abrir o cliente. Nunca usa id_legado para esta resolução —
      // id_legado pode colidir com id de outro cliente.
      if (cad.cliente_id_vinculado) {
        const { data: cliRow } = await supabase
          .from("qa_clientes" as any)
          .select("*")
          .eq("id", cad.cliente_id_vinculado)
          .limit(1)
          .maybeSingle();
        const cli = cliRow as any | null;
        const cpfCliNorm = String(cli?.cpf || "").replace(/\D/g, "");
        const cpfBate = cpfCadNorm && cpfCliNorm && cpfCadNorm === cpfCliNorm;

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log("[AbrirClienteCadastroPublico:resolveVinculo]", {
            cadastro_publico_id: cad.id,
            nome_formulario: cad.nome_completo,
            cpf_formulario_normalizado: cpfCadNorm,
            cliente_id_vinculado: cad.cliente_id_vinculado,
            cliente_nome_vinculado: cli?.nome_completo ?? null,
            cliente_cpf_normalizado: cpfCliNorm,
            resultado_validacao: cli ? (cpfBate ? "ok" : "cpf_divergente") : "cliente_nao_encontrado",
          });
        }

        if (cli && cpfBate) {
          // Vínculo válido — abre a ficha do cliente real.
          setSelectedCadastroPublico(null);
          openClient(cli);
          return;
        }

        // Vínculo inconsistente — não abre cliente errado; mostra o cadastro
        // público para correção manual.
        toast.error("Vínculo inconsistente entre cadastro público e cliente. Reveja o vínculo.");
      }

      setSelected(null);
      setSelectedCadastroPublico(cad as unknown as CadastroPublico);
    } catch (e: any) {
      toast.error(e.message || "Erro ao abrir cadastro público");
    } finally {
      setLoadingCadastroPublico(false);
    }
  };

  const togglePagoCadastroPublico = async (target?: CadastroPublico | null) => {
    const alvo = target ?? selectedCadastroPublico;
    if (!alvo) return;
    const cadastroId = alvo.id;
    const pagoAnterior = Boolean(alvo.pago);
    const novoPago = !pagoAnterior;
    setSavingCadastroPublicoStatus(`pago:${cadastroId}`);
    setCadastrosPublicos(prev => prev.map(item => item.id === cadastroId ? { ...item, pago: novoPago } : item));
    setSelectedCadastroPublico(prev => prev && prev.id === cadastroId ? { ...prev, pago: novoPago } : prev);
    try {
      const updateBody: Record<string, any> = { pago: novoPago };
      // Inicia o relógio de SLA na primeira marcação como pago
      if (novoPago && !(alvo as any).pago_em) {
        updateBody.pago_em = new Date().toISOString();
      }
      const { data, error } = await supabase.from("qa_cadastro_publico" as any)
        .update(updateBody)
        .eq("id", cadastroId)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const updated = data as unknown as CadastroPublico;
        setCadastrosPublicos(prev => prev.map(item => item.id === updated.id ? { ...item, ...updated } : item));
        setSelectedCadastroPublico(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
      }
      toast.success(novoPago ? "Marcado como pago" : "Marcado como não pagou");

      // ── Propagação do status financeiro para a(s) solicitação(ões)
      // vinculadas ao cadastro público (best-effort, NÃO bloqueia o fluxo).
      // pago=true  → status_financeiro = 'pago' (libera fluxo operacional;
      //               status_servico já é 'aguardando_documentacao' por
      //               default, o que mantém o checklist liberado).
      // pago=false → reverte para 'sem_cobranca_vinculada'.
      // Não altera Asaas/webhook/qa_vendas/processos: somente reflete no
      // painel operacional o que a Equipe acabou de marcar.
      void (async () => {
        try {
          const novoFinanceiro = novoPago ? "pago" : "sem_cobranca_vinculada";
          const { data: solsPrev } = await supabase
            .from("qa_solicitacoes_servico" as any)
            .select("id, cliente_id, service_slug, service_name, status_financeiro")
            .eq("cadastro_publico_id", cadastroId);
          const sols = (solsPrev as any[]) ?? [];
          if (sols.length === 0) return;
          const { error: updErr } = await supabase
            .from("qa_solicitacoes_servico" as any)
            .update({ status_financeiro: novoFinanceiro, updated_at: new Date().toISOString() })
            .eq("cadastro_publico_id", cadastroId);
          if (updErr) {
            console.warn("[togglePagoCadastroPublico] propagar status_financeiro falhou:", updErr.message);
            return;
          }
          const { data: userRes } = await supabase.auth.getUser();
          const usuarioId = userRes?.user?.id ?? null;
          // Auditoria do flag pago no próprio cadastro público
          void registrarStatusEvento({
            origem: "equipe",
            entidade: "cadastro_publico",
            entidade_id: cadastroId,
            cliente_id: (alvo as any)?.cliente_id_vinculado ?? null,
            campo_status: "pago",
            status_anterior: pagoAnterior ? "true" : "false",
            status_novo: novoPago ? "true" : "false",
            usuario_id: usuarioId,
            detalhes: { contexto: "QAClientesPage.togglePagoCadastroPublico" },
          });
          // Auditoria por solicitação afetada
          for (const s of sols) {
            if ((s.status_financeiro ?? null) === novoFinanceiro) continue;
            void registrarStatusEvento({
              origem: "equipe",
              entidade: "solicitacao_servico",
              entidade_id: s.id,
              solicitacao_id: s.id,
              cliente_id: s.cliente_id ?? null,
              campo_status: "status_financeiro",
              status_anterior: s.status_financeiro ?? null,
              status_novo: novoFinanceiro,
              usuario_id: usuarioId,
              detalhes: {
                contexto: "QAClientesPage.togglePagoCadastroPublico",
                cadastro_publico_id: cadastroId,
                service_slug: s.service_slug ?? null,
                service_name: s.service_name ?? null,
              },
            });
          }
        } catch (err) {
          console.warn("[togglePagoCadastroPublico] propagação best-effort falhou:", err);
        }
      })();
    } catch (e: any) {
      setCadastrosPublicos(prev => prev.map(item => item.id === cadastroId ? { ...item, pago: pagoAnterior } : item));
      setSelectedCadastroPublico(prev => prev && prev.id === cadastroId ? { ...prev, pago: pagoAnterior } : prev);
      toast.error(e.message || "Erro ao atualizar pagamento");
    } finally {
      setSavingCadastroPublicoStatus(null);
    }
  };

  // ==== SLA: aguardar/retomar/concluir ====
  const updateCadastroSla = async (patch: Record<string, any>, successMsg: string) => {
    if (!selectedCadastroPublico) return;
    const cadastroId = selectedCadastroPublico.id;
    setSavingCadastroPublicoStatus("sla");
    try {
      const { data, error } = await supabase.from("qa_cadastro_publico" as any)
        .update(patch).eq("id", cadastroId).select("*").limit(1).maybeSingle();
      if (error) throw error;
      if (data) {
        const updated = data as unknown as CadastroPublico;
        setCadastrosPublicos(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
        setSelectedCadastroPublico(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
      }
      toast.success(successMsg);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar SLA");
    } finally {
      setSavingCadastroPublicoStatus(null);
    }
  };

  const handleAguardandoCliente = () => {
    const desc = window.prompt("O que foi solicitado ao cliente? (Ex: comprovante de residência atualizado)");
    if (desc === null) return;
    const today = new Date().toISOString().split("T")[0];
    void updateCadastroSla(
      { aguardando_cliente_desde: today, ultima_solicitacao_cliente: desc?.toUpperCase() || null },
      "Aguardando documentos do cliente. Relógio pausa após 1 dia."
    );
  };

  const handleRetomarSla = () => {
    if (!selectedCadastroPublico) return;
    const c: any = selectedCadastroPublico;
    if (!c.aguardando_cliente_desde) {
      void updateCadastroSla({ ultima_solicitacao_cliente: null }, "Sem pendência registrada.");
      return;
    }
    const desde = new Date(c.aguardando_cliente_desde);
    const hoje = new Date();
    const diasAguardando = Math.max(0, Math.floor((hoje.getTime() - desde.getTime()) / 86400000));
    const pausaConsumida = Math.max(0, diasAguardando - 1); // 1 dia de tolerância
    const novosPausados = (c.dias_pausados ?? 0) + pausaConsumida;
    void updateCadastroSla(
      { aguardando_cliente_desde: null, dias_pausados: novosPausados },
      pausaConsumida > 0 ? `Relógio retomado. ${pausaConsumida}d de pausa contabilizados.` : "Relógio retomado."
    );
  };

  const handleConcluirSla = () => {
    if (!window.confirm("Concluir o serviço deste cliente? O contador de prazo será encerrado.")) return;
    void updateCadastroSla(
      { sla_concluido_em: new Date().toISOString() },
      "Serviço concluído. Cliente removido do contador de prazo."
    );
  };

  const excluirDefinitivamenteCadastroPublico = async () => {
    if (!selectedCadastroPublico) return;
    const c: any = selectedCadastroPublico;
    if (c.cliente_id_vinculado) {
      toast.error("Este cadastro já está vinculado a um cliente. Exclua o cliente primeiro.");
      return;
    }
    const nome = c.nome_completo || "este cadastro";
    const confirm1 = window.confirm(
      `EXCLUSÃO DEFINITIVA\n\nDeseja remover permanentemente o cadastro público de "${nome}"?\n\nEsta ação NÃO pode ser desfeita. O CPF poderá ser usado em um novo cadastro.`,
    );
    if (!confirm1) return;
    const confirm2 = window.prompt(
      `Confirme digitando EXCLUIR para apagar definitivamente o cadastro de ${nome}.`,
    );
    if ((confirm2 || "").trim().toUpperCase() !== "EXCLUIR") {
      toast.info("Exclusão cancelada.");
      return;
    }
    setSavingCadastroPublicoStatus("excluindo");
    try {
      const { error } = await supabase
        .from("qa_cadastro_publico" as any)
        .delete()
        .eq("id", c.id);
      if (error) throw error;
      setCadastrosPublicos(prev => prev.filter(item => item.id !== c.id));
      setSelectedCadastroPublico(null);
      toast.success("Cadastro excluído definitivamente.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir cadastro definitivamente.");
    } finally {
      setSavingCadastroPublicoStatus(null);
    }
  };

  const updateCadastroPublicoStatus = async (status: string) => {
    if (!selectedCadastroPublico) return;

    setSavingCadastroPublicoStatus(status);
    try {
      const cpfDigits = normalizeDigits(selectedCadastroPublico.cpf);
      let clienteVinculadoId: number | null = null;
      let historicoMsg = "";

      if (status === "aprovado") {
        if (!cpfDigits || cpfDigits.length !== 11) {
          throw new Error("CPF inválido para vincular o cadastro ao cliente");
        }
        const cpfVariants = Array.from(new Set([cpfDigits, formatCpf(cpfDigits)]));
        const { data: clientesCpf, error: lookErr } = await supabase
          .from("qa_clientes" as any).select("*").in("cpf", cpfVariants)
          .order("updated_at", { ascending: false }).limit(10);
        if (lookErr) throw lookErr;
        const existing = (((clientesCpf as unknown) as Cliente[] | null) ?? [])[0] ?? null;
        const payload = buildClientePayload(selectedCadastroPublico, existing);

        if (existing) {
          // Calcular diff e snapshot ANTES de atualizar
          const diff = computeDiff(existing as any, payload);
          const { error: ue } = await supabase.from("qa_clientes" as any).update(payload).eq("id", existing.id);
          if (ue) throw ue;
          clienteVinculadoId = existing.id;

          // Persistir histórico (só se houve mudança real)
          if (diff.length > 0) {
            const { error: hErr } = await supabase
              .from("qa_cliente_historico_atualizacoes" as any)
              .insert({
                cliente_id: existing.id,
                cadastro_publico_id: selectedCadastroPublico.id,
                changed_fields: diff,
                snapshot_anterior: existing as any,
                snapshot_novo: payload,
                origem: "cadastro_publico",
                autor: "admin",
              });
            if (hErr) console.error("[historico] erro ao salvar:", hErr.message);
            historicoMsg = ` ${diff.length} ${diff.length === 1 ? "campo atualizado" : "campos atualizados"}.`;
          } else {
            historicoMsg = " Nenhum campo modificado.";
          }
        } else {
          const { data: ins, error: ie } = await supabase.from("qa_clientes" as any).insert(payload).select("id").single();
          if (ie) throw ie;
          clienteVinculadoId = ((ins as unknown) as { id?: number } | null)?.id ?? null;
          historicoMsg = " Novo cliente criado.";
        }
      }

      const updatePayload: Record<string, any> = { status };
      if (status === "aprovado") {
        updatePayload.cliente_id_vinculado = clienteVinculadoId;
        updatePayload.processado_em = new Date().toISOString();
        updatePayload.notas_processamento = clienteVinculadoId
          ? `Vinculado ao cliente #${clienteVinculadoId} por CPF.${historicoMsg}`
          : "Aprovado sem vínculo automático.";
      }

      // Vínculo reverso obrigatório: qa_clientes.cadastro_publico_id deve apontar
      // para o cadastro público de origem. Sem isso, a varredura de pendências
      // dispara "Cliente vindo do formulário sem vínculo reverso" para sempre.
      if (status === "aprovado" && clienteVinculadoId) {
        const { error: revErr } = await supabase
          .from("qa_clientes" as any)
          .update({
            cadastro_publico_id: selectedCadastroPublico.id,
            cadastro_publico_aplicado_em: new Date().toISOString(),
          })
          .eq("id", clienteVinculadoId);
        if (revErr) {
          console.error("[vinculo-reverso] erro ao gravar cadastro_publico_id:", revErr.message);
          throw new Error(
            "Falha ao gravar vínculo reverso no cliente: " + revErr.message,
          );
        }
      }

      // Update sem .select() para evitar "TypeError: Load failed" no Safari/iOS
      // quando o segundo roundtrip embutido fica pendurado em rede instável.
      const { error } = await supabase.from("qa_cadastro_publico" as any)
        .update(updatePayload)
        .eq("id", selectedCadastroPublico.id);

      if (error) throw error;

      const updated = { ...selectedCadastroPublico, ...updatePayload } as CadastroPublico;
      setSelectedCadastroPublico(updated);
      setCadastrosPublicos(prev => prev.map(item => item.id === updated.id ? { ...item, ...updatePayload } : item));
      // Auditoria de mudança de status do cadastro público
      try {
        const { data: userRes } = await supabase.auth.getUser();
        void registrarStatusEvento({
          origem: "equipe",
          entidade: "cadastro_publico",
          entidade_id: selectedCadastroPublico.id,
          cliente_id: (selectedCadastroPublico as any)?.cliente_id_vinculado ?? null,
          campo_status: "status",
          status_anterior: selectedCadastroPublico.status ?? null,
          status_novo: status,
          usuario_id: userRes?.user?.id ?? null,
          detalhes: { contexto: "QAClientesPage.updateCadastroPublicoStatus" },
        });
      } catch (auditErr) {
        console.warn("[updateCadastroPublicoStatus] auditoria falhou:", auditErr);
      }
      if (status === "aprovado") {
        await loadClientes();
        toast.success(clienteVinculadoId
          ? `Cadastro aprovado e sincronizado com o cliente #${clienteVinculadoId}.${historicoMsg}`
          : "Cadastro aprovado com sucesso");
      } else if (status === "pendente" && ["aprovado", "conferido", "validado", "formulario_conferido"].includes(String(selectedCadastroPublico.status || "").toLowerCase())) {
        toast.success("Conferência removida. Cadastro voltou para pendentes.");
      } else {
        toast.success(`Cadastro marcado como ${status}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar cadastro público");
    } finally {
      setSavingCadastroPublicoStatus(null);
    }
  };

  const startEditCadastro = () => {
    if (!selectedCadastroPublico) return;
    const c = selectedCadastroPublico;
    setCadastroEditForm({
      nome_completo: c.nome_completo || "",
      cpf: c.cpf || "",
      rg: c.rg || "",
      emissor_rg: c.emissor_rg || "",
      uf_emissor_rg: (c as any).uf_emissor_rg || "",
      data_nascimento: c.data_nascimento || "",
      estado_civil: c.estado_civil || "",
      nacionalidade: c.nacionalidade || "",
      profissao: c.profissao || "",
      nome_mae: c.nome_mae || "",
      nome_pai: c.nome_pai || "",
      telefone_principal: c.telefone_principal || "",
      telefone_secundario: c.telefone_secundario || "",
      email: c.email || "",
      end1_logradouro: c.end1_logradouro || "",
      end1_numero: c.end1_numero || "",
      end1_complemento: c.end1_complemento || "",
      end1_bairro: c.end1_bairro || "",
      end1_cep: c.end1_cep || "",
      end1_cidade: c.end1_cidade || "",
      end1_estado: c.end1_estado || "",
      end2_tipo: c.end2_tipo || "",
      end2_logradouro: c.end2_logradouro || "",
      end2_numero: c.end2_numero || "",
      end2_complemento: c.end2_complemento || "",
      end2_bairro: c.end2_bairro || "",
      end2_cep: c.end2_cep || "",
      end2_cidade: c.end2_cidade || "",
      end2_estado: c.end2_estado || "",
      observacoes: c.observacoes || "",
      vinculo_tipo: c.vinculo_tipo || "",
      servico_interesse: c.servico_interesse || "",
      objetivo_principal: c.objetivo_principal || "",
      categoria_servico: c.categoria_servico || "",
      servico_principal: c.servico_principal || "",
      subtipo_servico: c.subtipo_servico || "",
      descricao_servico_livre: c.descricao_servico_livre || "",
      servico_fechado_final: c.servico_fechado_final || "",
    });
    setEditingCadastroPublico(true);
  };

  const saveCadastroEdit = async () => {
    if (!selectedCadastroPublico) return;
    setSavingCadastroEdit(true);
    try {
      const { data, error } = await supabase.from("qa_cadastro_publico" as any)
        .update(cadastroEditForm)
        .eq("id", selectedCadastroPublico.id)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const updated = data as unknown as CadastroPublico;
      setSelectedCadastroPublico(updated);
      setCadastrosPublicos(prev => prev.map(item => item.id === updated.id ? { ...item, ...updated } : item));
      setEditingCadastroPublico(false);
      toast.success("Cadastro atualizado com sucesso");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSavingCadastroEdit(false);
    }
  };

  const loadingClientRef = useRef<number | null>(null);

  const openClient = async (c: Cliente) => {
    if (loadingClientRef.current === c.id) return; // prevent double-click
    loadingClientRef.current = c.id;
    setSelectedCadastroPublico(null);
    setSelected(c);
    // Abas legadas (CRAFs/CR/Docs) removidas — abre no Arsenal Inteligente.
    setTab("arsenal");
    await loadSubData(c);
    loadingClientRef.current = null;
  };

  const loadSubData = useCallback(async (c: Cliente, opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoadingSub(true);
    try {
      // CHAVE CANÔNICA: vendas/crafs/gtes/filiações historicamente usam id_legado,
      // mas o portal/app/arsenal grava com o id real (qa_clientes.id). Para garantir
      // visibilidade total no admin (zero perda de dados criados pelo cliente),
      // buscamos por AMBAS as chaves usando .in('cliente_id', [id, id_legado]).
      // ⚠️ INCIDENTE P0: usar cidsCliente para qa_cadastro_cr causa CRUZAMENTO entre
      // clientes quando id_legado de um == id real de outro (ex.: Weverton id_legado=46
      // == Willian id=46). qa_cadastro_cr deve usar EXCLUSIVAMENTE o id real.
      const cid = getClienteFK(c);
      const cidsCliente = Array.from(new Set([c.id, c.id_legado, cid].filter((n) => typeof n === "number" && Number.isFinite(n)))) as number[];
      const clienteIdReal = c.id; // id real, único — usado para qa_cadastro_cr
      const examesQuery = supabase
        .from("qa_exames_cliente_status" as any)
        .select("*")
        .eq("cliente_id", c.id)
        .order("data_realizacao", { ascending: false });

      const [vRes, cRes, gRes, fRes, cadRes, exRes, dRes] = await Promise.all([
        supabase.from("qa_vendas" as any).select("*").in("cliente_id", cidsCliente).order("data_cadastro", { ascending: false }),
        // P0 FIX: Tabelas de ARSENAL (crafs/gtes/filiacoes) usam SEMPRE id real
        // (qa_clientes.id) — ver getClienteCadastroFK. Usar cidsCliente aqui causa
        // cruzamento entre clientes quando id_legado de um == id real de outro.
        supabase.from("qa_crafs" as any).select("*").eq("cliente_id", clienteIdReal),
        supabase.from("qa_gtes" as any).select("*").eq("cliente_id", clienteIdReal),
        supabase.from("qa_filiacoes" as any).select("*").eq("cliente_id", clienteIdReal),
        // P0 FIX: CR usa SOMENTE id real e ignora consolidados (CRs antigos de
        // reconciliação). Sem isso, id_legado de um cliente colide com id de outro.
        supabase
          .from("qa_cadastro_cr" as any)
          .select("*")
          .eq("cliente_id", clienteIdReal)
          .is("consolidado_em", null)
          .order("id", { ascending: false })
          .limit(1),
        examesQuery,
        // Documentos enviados pelo cliente no portal/app (qa_cliente_id = id real do cliente).
        supabase.from("qa_documentos_cliente" as any).select("*").eq("qa_cliente_id", c.id).order("created_at", { ascending: false }),
      ]);
      const vendasData = (vRes.data as any[]) ?? [];
      setVendas(vendasData);
      setCrafs((cRes.data as any[]) ?? []);
      setGtes((gRes.data as any[]) ?? []);
      setFiliacoes((fRes.data as any[]) ?? []);
      setCadastro((cadRes.data as any[])?.[0] ?? null);
      setExamesAtuais((exRes.data as any[]) ?? []);
      setDocsCliente((dRes.data as any[]) ?? []);
      // FASE 4 — carrega armas manuais/IA em paralelo (não-bloqueante; falha silenciosa).
      try {
        const { data: amRes } = await supabase
          .from("qa_cliente_armas_manual" as any)
          .select("*")
          .eq("qa_cliente_id", clienteIdReal)
          .order("created_at", { ascending: false });
        setArmasManual((amRes as any[]) ?? []);
      } catch (e) {
        console.warn("[loadSubData] armasManual falhou", e);
        setArmasManual([]);
      }
      if (vendasData.length > 0) {
        // qa_itens_venda.venda_id referencia qa_vendas.id_legado (chave canônica).
        const vendaIds = vendasData.map((v: any) => getVendaFK(v));
        const { data: itensData } = await supabase.from("qa_itens_venda" as any).select("*").in("venda_id", vendaIds).order("sort_order", { ascending: true, nullsFirst: false }).order("id", { ascending: true });
        setItens((itensData as any[]) ?? []);
        // FASE 16-C — processos por venda (qa_processos.venda_id = qa_vendas.id real).
        try {
          const realVendaIds = vendasData.map((v: any) => Number(v.id)).filter((n: number) => Number.isFinite(n));
          if (realVendaIds.length > 0) {
            const { data: procData } = await supabase
              .from("qa_processos" as any)
              .select("id, venda_id, servico_id, servico_nome")
              .in("venda_id", realVendaIds);
            setProcessosVenda((procData as any[]) ?? []);
          } else {
            setProcessosVenda([]);
          }
        } catch (e) {
          console.warn("[loadSubData] processosVenda falhou", e);
          setProcessosVenda([]);
        }
      } else {
        setItens([]);
        setProcessosVenda([]);
      }
    } catch (e: any) {
      console.error("[loadSubData] erro:", e.message);
      toast.error("Erro ao carregar dados do cliente");
    } finally {
      if (!silent) setLoadingSub(false);
    }
  }, []);

  // ─── Auto-refresh global do cliente selecionado (1s) ───
  // Atualiza KPIs e todos os dados atrelados (CRAFs, GTEs, CR, documentos,
  // vendas, processos, exames, armas) sem qualquer interação do administrador.
  // Pausa quando a aba do navegador está oculta para não desperdiçar requisições.
  useEffect(() => {
    if (!selected) return;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      if (typeof document !== "undefined" && document.hidden) return;
      inFlight = true;
      try {
        await loadSubData(selected, { silent: true });
      } finally {
        inFlight = false;
      }
    };
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [selected, loadSubData]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (deleteModal.table === "qa_clientes") {
        // Cascade: delete sub-entities first
        const clienteObj = clientes.find(c => c.id === deleteModal.id);
        const clienteId = clienteObj ? getClienteFK(clienteObj) : deleteModal.id;
        const { data: vendasCliente } = await supabase.from("qa_vendas" as any).select("id, id_legado").eq("cliente_id", clienteId);
        if (vendasCliente && vendasCliente.length > 0) {
          const vendaIds = (vendasCliente as any[]).map(v => getVendaFK(v));
          await supabase.from("qa_itens_venda" as any).delete().in("venda_id", vendaIds);
          await supabase.from("qa_vendas" as any).delete().eq("cliente_id", clienteId);
        }
        await Promise.all([
          supabase.from("qa_crafs" as any).delete().eq("cliente_id", clienteId),
          supabase.from("qa_gtes" as any).delete().eq("cliente_id", clienteId),
          supabase.from("qa_filiacoes" as any).delete().eq("cliente_id", clienteId),
        ]);
      }
      if (deleteModal.table === "qa_vendas") {
        const vendaObj = (vendas as any[]).find(v => v.id === deleteModal.id);
        const vendaFk = vendaObj ? getVendaFK(vendaObj) : deleteModal.id;
        await supabase.from("qa_itens_venda" as any).delete().eq("venda_id", vendaFk);
      }
      const { error } = await supabase.from(deleteModal.table as any).delete().eq("id", deleteModal.id);
      if (error) throw error;
      toast.success("Excluído com sucesso");
      if (deleteModal.table === "qa_clientes") {
        setClientes(prev => prev.filter(c => c.id !== deleteModal.id));
        setSelected(null);
      } else if (selected) {
        await loadSubData(selected);
      }
      setDeleteModal({ open: false, table: "", id: 0, title: "", desc: "" });
    } catch (e: any) { toast.error(e.message); } finally { setDeleting(false); }
  };

  const filtered = clientes.filter(c => {
    const s = search.toLowerCase();
    const sDigits = s.replace(/\D/g, "");
    if (!s) return true;
    if (c.nome_completo?.toLowerCase().includes(s)) return true;
    if (c.email?.toLowerCase().includes(s)) return true;
    if (sDigits && c.cpf?.replace(/\D/g, "").includes(sDigits)) return true;
    if (sDigits && c.celular?.replace(/\D/g, "").includes(sDigits)) return true;
    return false;
  });

  // Origem do cliente: "manual" = cadastrado pela equipe via formulário interno.
  // Demais (formulario_publico, equipe legada, null) → "outros".
  const isManual = (c: any) => String((c as any).origem || "") === "manual";
  const filteredManuais = filtered.filter(isManual);

  const matchSearch = (c: CadastroPublico) => {
    const s = search.toLowerCase();
    const sDigits = s.replace(/\D/g, "");
    if (!s) return true;
    if (c.nome_completo?.toLowerCase().includes(s)) return true;
    if (c.email?.toLowerCase().includes(s)) return true;
    if (sDigits && c.cpf?.replace(/\D/g, "").includes(sDigits)) return true;
    if (sDigits && c.telefone_principal?.replace(/\D/g, "").includes(sDigits)) return true;
    return false;
  };
  const isRejeitado = (s: string | null | undefined) => String(s || "").toLowerCase() === "rejeitado";
  const cadastrosNaoRejeitados = cadastrosPublicos.filter(c => !isRejeitado(c.status));
  const cadastrosRejeitados = cadastrosPublicos.filter(c => isRejeitado(c.status));
  const APROVADO_STATUSES = new Set(["aprovado", "conferido", "validado", "formulario_conferido"]);
  const isAprovadoStatus = (s: string | null | undefined) =>
    APROVADO_STATUSES.has(String(s || "").toLowerCase());
  const filteredCadastros = cadastrosNaoRejeitados.filter(c => {
    if (!matchSearch(c)) return false;
    if (cadastroFilter === "aprovado") return isAprovadoStatus(c.status);
    return !isAprovadoStatus(c.status); // pendente / em análise / etc.
  });
  const filteredRejeitados = cadastrosRejeitados.filter(matchSearch);

  const statusColor = (s: string) => s === "ATIVO" ? "text-emerald-600" : s === "DESISTENTE" ? "text-red-600" : "text-[#641722]";
  const svcStatusColor = (s: string) => {
    if (s === "DEFERIDO" || s === "CONCLUÍDO") return "text-emerald-700 bg-emerald-50";
    if (s === "INDEFERIDO") return "text-red-700 bg-red-50";
    if (s === "EM ANÁLISE" || s === "PRONTO PARA ANÁLISE") return "text-[#4F121C] bg-[#FBF3F4]";
    return "text-slate-600 bg-slate-100";
  };
  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return dateToBr(d) || "—";
  };
  const formatDateTime = (d: string | null | undefined) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return dateToBr(d) || "—";
    const day = String(dt.getDate()).padStart(2, "0");
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const year = dt.getFullYear();
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} às ${hh}:${mm}`;
  };
  const parseUserAgent = (ua: string | null | undefined) => {
    if (!ua) return { navegador: "—", sistema: "—", dispositivo: "—" };
    let navegador = "Desconhecido";
    if (/Edg\//i.test(ua)) navegador = "Microsoft Edge";
    else if (/OPR\/|Opera/i.test(ua)) navegador = "Opera";
    else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) navegador = "Google Chrome";
    else if (/Firefox\//i.test(ua)) navegador = "Mozilla Firefox";
    else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) navegador = "Safari";
    let sistema = "Desconhecido";
    if (/Windows NT 10/i.test(ua)) sistema = "Windows 10/11";
    else if (/Windows/i.test(ua)) sistema = "Windows";
    else if (/Android/i.test(ua)) {
      const m = ua.match(/Android\s([0-9.]+)/i);
      sistema = m ? `Android ${m[1]}` : "Android";
    }
    else if (/iPhone|iPad|iOS/i.test(ua)) {
      const m = ua.match(/OS\s([0-9_]+)/i);
      sistema = m ? `iOS ${m[1].replace(/_/g, ".")}` : "iOS";
    }
    else if (/Mac OS X/i.test(ua)) sistema = "macOS";
    else if (/Linux/i.test(ua)) sistema = "Linux";
    let dispositivo = "Desktop";
    if (/iPad/i.test(ua)) dispositivo = "Tablet (iPad)";
    else if (/Tablet/i.test(ua)) dispositivo = "Tablet";
    else if (/iPhone/i.test(ua)) dispositivo = "Celular (iPhone)";
    else if (/Android/i.test(ua) && /Mobile/i.test(ua)) dispositivo = "Celular (Android)";
    else if (/Mobile/i.test(ua)) dispositivo = "Celular";
    return { navegador, sistema, dispositivo };
  };
  const getServicoNome = (id: number) => {
    // Fonte de verdade: tabela qa_servicos (carregada via loadServicos).
    // Mapas hardcoded foram removidos pois divergiam dos IDs reais e exibiam nomes errados (ex: "Posse PF", "Serviço #23").
    const svc = (servicos as any[]).find(s => s.id === id);
    return svc?.nome_servico || `Serviço #${id}`;
  };

  const clienteIdForSub = selected ? getClienteFK(selected) : 0;
  // FK para CR/CRAF/GTE/Filiações/exames — sempre id REAL (ver clientFK.ts).
  const clienteCadastroIdForSub = selected ? getClienteCadastroFK(selected) : 0;

  // ── Detail View ──
  if (selected) {
    const c = selected;
    return (
      <div className="space-y-3 md:space-y-4 px-0.5">
        {/* Header — padrão ARSENAL (Premium KPI cluster) */}
        {(() => {
          const statusTone =
            c.status === "ATIVO"
              ? "hsl(152 60% 42%)"
              : c.status === "DESISTENTE"
              ? "hsl(0 72% 55%)"
              : "hsl(38 92% 50%)";
          return (
            <div
              className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
              style={{ boxShadow: "inset 0 0 0 1px hsl(190 80% 45% / 0.06), 0 1px 2px rgba(15,23,42,0.04)" }}
            >
              {/* Glow ambiente (mesmo tratamento do KpiCard do Arsenal) */}
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-40 blur-3xl"
                style={{ background: statusTone }}
              />
              <div className="relative flex items-center gap-3 px-4 py-4 md:px-5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(null)}
                  className="h-8 w-8 p-0 shrink-0 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  title="Voltar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <ClienteSelfieAvatar cliente={c} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em]"
                      style={{ background: `${statusTone}14`, color: statusTone, boxShadow: `inset 0 0 0 1px ${statusTone}33` }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusTone }} />
                      {c.status}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                      ID #{String(c.id).padStart(4, "0")}
                    </span>
                  </div>
                  <h1 className="text-[18px] md:text-[22px] font-black uppercase tracking-tight truncate leading-tight" style={{ color: "hsl(220 20% 12%)" }}>
                    {c.nome_completo}
                  </h1>
                  <div className="mt-0.5 text-[11px] font-mono tracking-wider text-slate-400">
                    CPF {formatCpf(c.cpf)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditingCliente(c); setClienteModal(true); }}
                    className="h-9 w-9 p-0 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-[#7A1F2B] hover:border-[#E5C2C6] hover:bg-[#FBF3F4]"
                    title="Editar cliente"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteModal({ open: true, table: "qa_clientes", id: c.id, title: "Excluir Cliente", desc: `Excluir "${c.nome_completo}" e todos os dados vinculados?` })}
                    className="h-9 w-9 p-0 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                    title="Excluir cliente"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {/* Vitals row — mesma linguagem dos KpiCards do Arsenal */}
              <div className="relative grid grid-cols-2 md:grid-cols-5 border-t border-slate-200/80 divide-x divide-slate-200/80">
                {[
                  { icon: Phone, color: "hsl(190 80% 45%)", label: "Telefone", value: c.celular || "—", mono: true },
                  { icon: MapPin, color: "hsl(220 20% 28%)", label: "Localização", value: c.cidade ? `${c.cidade}/${c.estado}` : "—" },
                  { icon: FileText, color: "hsl(152 60% 42%)", label: "Vendas", value: vendas.length, mono: true },
                  { icon: Crosshair, color: "hsl(38 92% 50%)", label: "Armas", value: crafs.length + gtes.length, mono: true },
                ].map((v, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-4 py-3 first:border-l-0">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                      style={{ background: `${v.color}14`, color: v.color, boxShadow: `inset 0 0 0 1px ${v.color}1f` }}
                    >
                      <v.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{v.label}</div>
                      <div className={`text-[13px] font-bold text-slate-800 truncate ${v.mono ? "font-mono" : "uppercase"}`}>
                        {v.value}
                      </div>
                    </div>
                  </div>
                ))}
                <CircunscricaoKpi cidade={c.cidade} uf={c.estado} />
              </div>
            </div>
          );
        })()}

        <Tabs value={tab} onValueChange={setTab}>
          {/* Scrollable tabs for mobile */}
          <div className="overflow-x-auto -mx-0.5 px-0.5 scrollbar-none">
            <TabsList className="bg-white border border-slate-200 h-9 inline-flex w-auto min-w-full rounded-xl shadow-sm p-0.5 gap-0.5">
              {[
                { value: "arsenal", icon: Crosshair, label: "Arsenal" },
                { value: "resumo", icon: TrendingUp, label: "Resumo" },
                { value: "dados", icon: User, label: "Dados" },
                { value: "historico", icon: FileText, label: "Histórico" },
                { value: "servicos", icon: FileText, label: `Serviços (${itens.length + solicitacoesPublicas.filter(s => !s.ja_convertido).length})` },
                { value: "exames", icon: HeartPulse, label: "Exames" },
                { value: "pecas", icon: PenTool, label: "Peças" },
                { value: "hub", icon: ShieldCheck, label: "Hub Cliente" },
                { value: "portal", icon: KeyRound, label: "Portal" },
              ].map(t => (
                <TabsTrigger key={t.value} value={t.value} className="text-[12px] whitespace-nowrap px-3 data-[state=active]:bg-[#7A1F2B] data-[state=active]:text-white rounded-lg font-bold">
                  <t.icon className="h-3.5 w-3.5 mr-1.5" /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {loadingSub ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "hsl(220 10% 62%)" }}>Carregando...</span>
            </div>
          ) : (
            <>
              {/* ARSENAL INTELIGENTE */}
              <TabsContent value="arsenal" className="mt-3">
                <ArsenalView
                  clienteId={c.id}
                  clienteNome={c.nome_completo}
                  clienteCidade={c.cidade}
                  clienteUf={c.estado}
                  crafs={crafs}
                  gtes={gtes}
                  cadastroCr={cadastro}
                  meusDocs={docsCliente}
                  isAdmin
                  expDocs={[
                    ...(cadastro?.validade_cr ? [{ label: "Certificado de Registro (CR)", date: cadastro.validade_cr, days: daysUntilDate(cadastro.validade_cr), category: "CR" }] : []),
                    ...crafs.filter((cr: any) => cr.data_validade).map((cr: any) => ({ label: `CRAF — ${cr.nome_arma || cr.nome_craf || "Arma"}`, date: cr.data_validade, days: daysUntilDate(cr.data_validade), category: "CRAF" })),
                    ...gtes.filter((g: any) => g.data_validade).map((g: any) => ({ label: `GTE — ${g.nome_arma || g.nome_gte || "Arma"}`, date: g.data_validade, days: daysUntilDate(g.data_validade), category: "GTE" })),
                  ]}
                  alerts={[
                    ...(cadastro?.validade_cr ? [{ label: "Certificado de Registro (CR)", date: cadastro.validade_cr, days: daysUntilDate(cadastro.validade_cr), category: "CR" }] : []),
                    ...crafs.filter((cr: any) => cr.data_validade).map((cr: any) => ({ label: `CRAF — ${cr.nome_arma || cr.nome_craf || "Arma"}`, date: cr.data_validade, days: daysUntilDate(cr.data_validade), category: "CRAF" })),
                    ...gtes.filter((g: any) => g.data_validade).map((g: any) => ({ label: `GTE — ${g.nome_arma || g.nome_gte || "Arma"}`, date: g.data_validade, days: daysUntilDate(g.data_validade), category: "GTE" })),
                  ].filter((d) => d.days !== null && d.days <= 90)}
                  onOpenAddDoc={() => setTab("hub")}
                  onArsenalChanged={async () => {
                    await loadSubData(c);
                  }}
                />
              </TabsContent>

              {/* RESUMO */}
              <TabsContent value="resumo" className="mt-3">
                <ClienteOverview
                  cliente={c}
                  vendas={vendas}
                  itens={itens}
                  crafs={crafs}
                  gtes={gtes}
                  filiacoes={filiacoes}
                  cadastro={cadastro}
                  examesAtuais={examesAtuais}
                  armasManual={armasManual}
                  onNavigate={setTab}
                />
              </TabsContent>

              {/* DADOS */}
              <TabsContent value="dados" className="mt-3 space-y-4">
                <DadosFormularioPublicoSection
                  cliente={c as any}
                  onApplied={async () => {
                    await loadSubData(c);
                    await loadCadastrosPublicos();
                  }}
                />
                <Section title="Identificação">
                  <Field label="Nome" value={c.nome_completo} />
                  <Field label="CPF" value={formatCpf(c.cpf)} copyable />
                  <SenhaGovField
                    cadastroCrId={cadastro?.id}
                    clienteId={c.id}
                    variant="exposed"
                    contexto="aba Dados"
                  />
                  <Field label="RG / CIN" value={c.rg ? `${maskRg(c.rg)}${c.emissor_rg ? ` — ${c.emissor_rg}` : ""}${(c as any).uf_emissor_rg ? `/${(c as any).uf_emissor_rg}` : ""}` : "—"} />
                  <Field label="Nascimento" value={formatDate(c.data_nascimento)} />
                  <Field label="Naturalidade" value={c.naturalidade} />
                  <Field label="Nacionalidade" value={c.nacionalidade} />
                  <Field label="Estado Civil" value={c.estado_civil} />
                  <Field label="Profissão" value={c.profissao} />
                  <Field label="Escolaridade" value={c.escolaridade} />
                  <Field
                    label="Título Eleitor"
                    value={c.titulo_eleitor}
                    copyable
                    copyValue={(c.titulo_eleitor || "").replace(/\D/g, "")}
                  />
                </Section>
                <Section title="Filiação">
                  <Field label="Mãe" value={c.nome_mae} />
                  <Field label="Pai" value={c.nome_pai} />
                </Section>
                <Section title="Contato">
                  <Field label="Celular" value={c.celular} icon={Phone} />
                  <Field label="Email" value={c.email} icon={Mail} />
                </Section>
                <Section title="Endereço Principal">
                  <Field label="Logradouro" value={`${c.endereco || ""}, ${c.numero || ""}`} icon={MapPin} />
                  <Field label="Bairro" value={c.bairro} />
                  <Field label="CEP" value={c.cep} />
                  <Field label="Cidade/UF" value={`${c.cidade || ""} / ${c.estado || ""}`} />
                  {c.complemento && <Field label="Complemento" value={c.complemento} />}
                </Section>
                {(c.endereco2 || c.cidade2) && (
                  <Section title="Endereço Secundário">
                    <Field label="Logradouro" value={`${c.endereco2 || ""}, ${c.numero2 || ""}`} icon={MapPin} />
                    <Field label="Bairro" value={c.bairro2} />
                    <Field label="Cidade/UF" value={`${c.cidade2 || ""} / ${c.estado2 || ""}`} />
                  </Section>
                )}
                {c.observacao && (
                  <div className="qa-card p-4 md:p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(38 92% 50% / 0.12)" }}>
                        <FileText className="h-3.5 w-3.5" style={{ color: "hsl(38 92% 50%)" }} />
                      </div>
                      <h3 className="text-[11px] uppercase tracking-[0.14em] font-bold" style={{ color: "hsl(38 92% 50%)" }}>Observações</h3>
                    </div>
                    <div className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">{c.observacao}</div>
                  </div>
                )}
              </TabsContent>

              {/* SERVIÇOS / VENDAS */}
              <TabsContent value="servicos" className="mt-3">
                {/* Header padrão Arsenal Review */}
                <div className="qa-card p-4 md:p-5 mb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(352 60% 30% / 0.12)" }}>
                        <ShoppingCart className="h-3.5 w-3.5" style={{ color: "hsl(352 60% 30%)" }} />
                      </div>
                      <h3 className="text-[11px] uppercase tracking-[0.14em] font-bold" style={{ color: "hsl(352 60% 30%)" }}>
                        Serviços — Vendas e Processos
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end">
                      <button
                        onClick={() => exportVendas(clienteIdForSub, c.nome_completo)}
                        className="text-[10px] flex items-center gap-1 hover:underline"
                        style={{ color: "hsl(220 10% 50%)" }}
                      >
                        <Download className="h-3 w-3" /> EXPORTAR CSV
                      </button>
                      <button
                        onClick={() => setVendaModal({ open: true })}
                        className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold uppercase tracking-wider"
                      >
                        <Plus className="h-3 w-3" /> NOVA VENDA
                      </button>
                    </div>
                  </div>
                  {/* KPIs no topo — padrão Arsenal */}
                  {(() => {
                    const totalVendas = vendas.length;
                    // Status é a fonte da verdade. forma_pagamento só indica o método escolhido,
                    // mas a venda pode estar como NÃO PAGOU mesmo com método selecionado.
                    const totalPagas = vendas.filter((v: any) => String(v.status || "").trim().toUpperCase() === "PAGO").length;
                    const totalPendentes = totalVendas - totalPagas;
                    const totalCortesia = vendas.filter((v: any) => {
                      const its = itens.filter((i: any) => i.venda_id === (v.id_legado ?? v.id));
                      return its.length > 0 && its.every((i: any) => i.cortesia);
                    }).length;
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                        <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                          <div className="text-[9px] uppercase tracking-wider text-slate-500">Total</div>
                          <div className="text-[14px] font-bold text-slate-800">{totalVendas}</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                          <div className="text-[9px] uppercase tracking-wider text-slate-500">Pagas</div>
                          <div className="text-[14px] font-bold" style={{ color: "hsl(352 60% 40%)" }}>{totalPagas}</div>
                        </div>
                        <div
                          className="rounded-md border px-2 py-1.5"
                          style={{
                            background: totalPendentes > 0 ? "hsl(38 92% 50% / 0.10)" : "white",
                            borderColor: totalPendentes > 0 ? "hsl(38 92% 50% / 0.40)" : "hsl(220 13% 90%)",
                          }}
                        >
                          <div className="text-[9px] uppercase tracking-wider text-slate-500">Pendentes</div>
                          <div className="text-[14px] font-bold" style={{ color: totalPendentes > 0 ? "hsl(28 92% 32%)" : "hsl(220 10% 50%)" }}>
                            {totalPendentes}
                          </div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                          <div className="text-[9px] uppercase tracking-wider text-slate-500">Cortesia</div>
                          <div className="text-[14px] font-bold" style={{ color: "hsl(152 60% 28%)" }}>{totalCortesia}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {/* Solicitações de serviço vindas do formulário público
                    — exibidas como leads operacionais; não criam pagamento. */}
                {solicitacoesPublicas.filter(s => !s.ja_convertido).length > 0 && (
                  <div className="mb-4 rounded-lg border border-[#E5C2C6] bg-[#7A1F2B]/60 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4F121C]">
                        Solicitações — Formulário público
                      </span>
                      <span className="text-[10px] text-[#4F121C]">
                        {solicitacoesPublicas.filter(s => !s.ja_convertido).length} aguardando contratação
                      </span>
                    </div>
                    <div className="space-y-2">
                      {solicitacoesPublicas.filter(s => !s.ja_convertido).map(s => (
                        <div key={s.cadastro_publico_id} className="rounded-md border border-[#E5C2C6] bg-white p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[12px] font-semibold text-slate-800 truncate">
                                {s.servico.nome}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Origem: <span className="font-semibold">Formulário público</span>
                                {s.servico_interesse && (
                                  <> · Texto do formulário: <span className="font-mono">{s.servico_interesse}</span></>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F1D9DC] text-[#3D0E16] border border-[#E5C2C6]">
                                  Aguardando contratação
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  Sem cobrança vinculada
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  Processo ainda não aberto
                                </span>
                                {s.servico.pendente_classificacao && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                                    Classificação pendente
                                  </span>
                                )}
                              </div>
                            </div>
                            {!s.ja_convertido && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-[10px] shrink-0"
                                onClick={() => {
                                  setVendaModal({ open: true, solicitacaoId: s.solicitacao_id });
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Gerar venda
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {vendas.length === 0 ? <Empty text="Nenhuma venda registrada." /> : (
                  <div className="space-y-3">
                    {vendas.map((v: any) => {
                      const vItens = itens
                        .filter((i: any) => i.venda_id === (v.id_legado ?? v.id))
                        .sort((a: any, b: any) => {
                          const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
                          const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
                          if (sa !== sb) return sa - sb;
                          return Number(a.id) - Number(b.id);
                        });
                      return (
                        <div key={v.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50/40">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span
                                className="px-2 py-[2px] rounded text-[11px] font-bold uppercase tracking-wider"
                                style={{ background: "hsl(352 60% 30% / 0.10)", color: "hsl(352 60% 40%)" }}
                              >
                                VENDA #{v.id_legado ?? v.id}
                              </span>
                              <span className="text-[12px] font-semibold text-slate-600">{formatDate(v.data_cadastro)}</span>
                              <span className="flex justify-start sm:hidden">
                                {(() => {
                                  const allCortesia = vItens.length > 0 && vItens.every((i: any) => i.cortesia);
                                  const isPago = String(v.status || "").trim().toUpperCase() === "PAGO";
                                  if (allCortesia) return (
                                    <span className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider"
                                      style={{ background: "hsl(152 60% 38% / 0.12)", color: "hsl(152 60% 28%)" }}>
                                      CORTESIA
                                    </span>
                                  );
                                  if (isPago) return (
                                    <span className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider"
                                      style={{ background: "hsl(352 60% 30% / 0.10)", color: "hsl(352 60% 40%)" }}>
                                      PAGO
                                    </span>
                                  );
                                  return (
                                    <span className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider"
                                      style={{ background: "hsl(38 92% 50% / 0.18)", color: "hsl(28 92% 32%)" }}>
                                      PENDENTE
                                    </span>
                                  );
                                })()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 sm:shrink-0 flex-wrap sm:flex-nowrap justify-end">
                              <span className="hidden sm:flex w-[88px] justify-start">
                                {(() => {
                                  const allCortesia = vItens.length > 0 && vItens.every((i: any) => i.cortesia);
                                  const isPago = String(v.status || "").trim().toUpperCase() === "PAGO";
                                  if (allCortesia) return (
                                    <span className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider"
                                      style={{ background: "hsl(152 60% 38% / 0.12)", color: "hsl(152 60% 28%)" }}>
                                      CORTESIA
                                    </span>
                                  );
                                  if (isPago) return (
                                    <span className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider"
                                      style={{ background: "hsl(352 60% 30% / 0.10)", color: "hsl(352 60% 40%)" }}>
                                      PAGO
                                    </span>
                                  );
                                  return (
                                    <span className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider"
                                      style={{ background: "hsl(38 92% 50% / 0.18)", color: "hsl(28 92% 32%)" }}>
                                      PENDENTE
                                    </span>
                                  );
                                })()}
                              </span>
                              <div className="flex items-center gap-0.5 flex-wrap justify-end">
                                {/* FASE 16-C — Gerar processo a partir de venda aprovada */}
                                {/* Aprovar valor em 1 clique (libera o checklist) */}
                                <AprovarValorButton
                                  venda={v}
                                  onApproved={() => loadSubData(selected!)}
                                />
                                <GerarProcessoButton
                                  venda={v}
                                  itens={itens}
                                  clienteNome={c.nome_completo}
                                  processoExistente={processosVenda.find((p: any) => p.venda_id === v.id) || null}
                                  onCreated={() => loadSubData(selected!)}
                                />
                                <Button variant="ghost" size="sm" onClick={() => setVendaModal({ open: true, item: v })} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, table: "qa_vendas", id: v.id, title: "Excluir Venda", desc: `Excluir venda #${v.id_legado ?? v.id}?` })} className="h-7 w-7 p-0 text-slate-400 hover:text-red-400">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <div className="px-3 py-2 space-y-1.5">
                            <DndContext
                              sensors={dndSensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(e) => handleReorderItens(v.id_legado ?? v.id, e)}
                            >
                              <SortableContext
                                items={vItens.map((i: any) => String(i.id))}
                                strategy={verticalListSortingStrategy}
                              >
                            {vItens.map((it: any) => (
                              <SortableServicoRow key={it.id} id={String(it.id)}>
                                {({ listeners, attributes, isDragging }) => (
                                <div>
                                <div className={`flex items-center justify-between text-[10px] gap-1 rounded px-1 -mx-1 py-0.5 ${isStatusDefinido(it.status) ? "hover:bg-white" : "opacity-90"} ${isDragging ? "bg-slate-100 shadow-sm" : ""}`}>
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <button
                                      type="button"
                                      {...listeners}
                                      {...attributes}
                                      title="Arraste para reordenar"
                                      aria-label="Reordenar serviço"
                                      className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 cursor-grab active:cursor-grabbing touch-none"
                                    >
                                      <GripVertical className="h-3 w-3 shrink-0" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleExpandItem(it)}
                                      disabled={!isStatusDefinido(it.status)}
                                      title={isStatusDefinido(it.status) ? "Abrir formulário" : "Selecione o status para liberar o formulário"}
                                      className={`inline-flex h-5 w-5 items-center justify-center rounded transition-colors ${isStatusDefinido(it.status) ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700" : "cursor-not-allowed text-slate-300"}`}
                                    >
                                      {expandedItemId === it.id ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                                    </button>
                                    <Select
                                      value={it.status || ""}
                                      onValueChange={(newStatus) => {
                                        // Optimistic update — UI responde instantaneamente
                                        const prevStatus = it.status;
                                        setItens(prev => prev.map((i: any) => i.id === it.id ? { ...i, status: newStatus } : i));
                                        if (expandedItemId === it.id) {
                                          setExpandedItemId(null);
                                          setItemEditForm({});
                                        }
                                        toast.success(`Status → ${newStatus}`);
                                        invalidateQADashboardSnapshot();
                                        // Persistência em background; reverte se falhar
                                        supabase.from("qa_itens_venda" as any).update({ status: newStatus }).eq("id", it.id)
                                          .then(({ error }) => {
                                            if (error) {
                                              toast.error(`Falha ao salvar: ${error.message}`);
                                              setItens(prev => prev.map((i: any) => i.id === it.id ? { ...i, status: prevStatus } : i));
                                            }
                                          });
                                      }}
                                    >
                                      <SelectTrigger
                                        className={`h-6 w-auto min-w-0 px-2 text-[9px] font-mono rounded border bg-white text-gray-700 border-gray-200 hover:border-gray-300 gap-1 shadow-none ${statusBadgeClass(it.status)}`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <SelectValue placeholder="SELECIONAR STATUS" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white border border-gray-200 shadow-md">
                                        {STATUS_SERVICO_QA.map(s => (
                                          <SelectItem key={s} value={s} className="text-[10px] text-gray-700">
                                            {STATUS_LABELS[s]}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <span className="text-[12px] font-bold text-slate-800 truncate uppercase tracking-tight">{getServicoNome(it.servico_id)}</span>
                                    {(() => {
                                      // Número identificador exibido em coluna central de largura fixa para manter o alinhamento entre todos os serviços.
                                      const inlineNumero =
                                        it.servico_id === 2 ? it.numero_posse :
                                        it.servico_id === 3 ? it.numero_requerimento :
                                        it.numero_processo;
                                      return (
                                        <span className="hidden sm:flex w-[140px] shrink-0 justify-center text-slate-500 font-mono text-[11px] font-semibold tabular-nums">
                                          {inlineNumero || ""}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="w-[88px] flex justify-start">
                                      {it.cortesia ? (
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200" title={it.cortesia_motivo || "Cortesia"}>
                                          CORTESIA
                                        </span>
                                      ) : (
                                        <span className="text-slate-900 font-mono font-bold tabular-nums text-[14px]">R$ {Number(it.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      )}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteItem(it); }}
                                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                      title="Excluir item"
                                      aria-label="Excluir item"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <span className="h-7 w-7 shrink-0" aria-hidden="true" />
                                  </div>
                                </div>
                                {expandedItemId === it.id && (
                                  <div className="bg-slate-50 border border-slate-200 rounded-lg mt-1 mb-2 p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-medium text-slate-700">Detalhes — {getServicoNome(it.servico_id)}</span>
                                      <div className="flex gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => { setExpandedItemId(null); setItemEditForm({}); }} className="h-6 px-2 text-[9px] text-slate-500 hover:text-slate-700">
                                          <X className="h-3 w-3 mr-1" /> Cancelar
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={handleSaveItem} disabled={savingItem} className="h-6 px-2 text-[9px] text-emerald-400 bg-emerald-900/20 border border-emerald-800/30 hover:bg-emerald-900/40">
                                          <Save className="h-3 w-3 mr-1" /> {savingItem ? "Salvando..." : "Salvar"}
                                        </Button>
                                      </div>
                                    </div>
                                    {!isStatusDefinido(it.status) ? (
                                      <div className="rounded-md border border-[#E5C2C6] bg-[#FBF3F4] px-3 py-2 text-[10px] text-[#4F121C]">
                                        ⚠️ Selecione o <strong>status</strong> deste serviço para liberar o preenchimento do formulário.
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {getFieldsForServico(it.servico_id, itemEditForm, it).map(field => (
                                          <div key={field.key}>
                                            <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">
                                              {field.label}
                                              {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                            </label>
                                            <input
                                              type="text"
                                              value={itemEditForm[field.key] || ""}
                                              onChange={e => {
                                                const raw = e.target.value;
                                                const val = field.type === "date" ? applyDateMask(raw) : raw.toUpperCase();
                                                setItemEditForm(prev => ({ ...prev, [field.key]: val }));
                                              }}
                                              placeholder={field.type === "date" ? "DD/MM/AAAA" : "—"}
                                              className={`w-full h-7 px-2 text-[10px] rounded bg-white border text-slate-700 placeholder:text-slate-300 focus:outline-none transition-colors ${field.required && !itemEditForm[field.key] ? "border-red-300 focus:border-red-500" : "border-slate-200 focus:border-[#7A1F2B]"}`}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {/* Declarações movidas para a aba "Docs" — não exibir aqui */}
                                  </div>
                                )}
                                </div>
                                )}
                              </SortableServicoRow>
                            ))}
                              </SortableContext>
                            </DndContext>
                            <div className="flex justify-between items-center pt-2 mt-1 border-t border-slate-200">
                              <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-500">Total</span>
                              <div className="flex gap-3 items-center">
                                {Number(v.desconto) > 0 && <span className="text-[14px] font-bold text-[#641722] font-mono tabular-nums">Desc: R$ {Number(v.desconto).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                                <span className="text-[17px] font-bold text-slate-900 font-mono tabular-nums">R$ {Number(v.valor_a_pagar).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </div>
                          {/* Timeline operacional — só quando há solicitação canônica vinculada */}
                          {v.solicitacao_id && (
                            <details className="border-t border-slate-100 px-3 py-2 bg-slate-50/40">
                              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 hover:text-[#7A1F2B] select-none">
                                Linha do tempo do serviço
                              </summary>
                              <div className="mt-3 pl-1">
                                <SolicitacaoTimeline solicitacaoId={v.solicitacao_id} />
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* EXAMES */}
              <TabsContent value="exames" className="mt-3">
                <ClienteExames cliente={c} />
              </TabsContent>
              {/* PEÇAS JURÍDICAS */}
              <TabsContent value="pecas" className="mt-3">
                <ClientePecas cliente={c} />
              </TabsContent>
              {/* HUB DO CLIENTE — documentos enviados pelo próprio cliente */}
              <TabsContent value="hub" className="mt-3">
                <ClienteDocsCadastroPublico cliente={c} />
                <ClienteDocsEnviados cliente={c} />
              </TabsContent>
              {/* ACESSO AO PORTAL */}
              <TabsContent value="historico" className="mt-3">
                <HistoricoAtualizacoes clienteId={c.id} showSnapshot />
              </TabsContent>
              <TabsContent value="portal" className="mt-3">
                <ClienteAcessoPortal cliente={c} />
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Modals */}
        <ClienteFormModal open={clienteModal} onClose={() => { setClienteModal(false); setEditingCliente(null); }} onSaved={async () => {
          await loadClientes();
          if (selected) {
            const { data } = await supabase.from("qa_clientes" as any).select("*").eq("id", selected.id).maybeSingle();
            if (data) setSelected(data as any);
          }
        }} cliente={editingCliente} />
        <VendaModal
          open={vendaModal.open}
          onClose={() => setVendaModal({ open: false })}
          onSaved={() => {
            void loadSubData(selected!);
            void reloadSolicitacoes();
          }}
          clienteId={clienteIdForSub}
          venda={vendaModal.item}
          solicitacaoId={vendaModal.solicitacaoId ?? null}
        />
        <DeleteConfirm open={deleteModal.open} onClose={() => setDeleteModal({ ...deleteModal, open: false })} onConfirm={handleDelete} title={deleteModal.title} description={deleteModal.desc} loading={deleting} />
      </div>
    );
  }

  const cadastroStatusColor = (s: string) => {
    if (s === "aprovado") return "text-emerald-600 bg-emerald-50";
    if (s === "pendente") return "text-[#641722] bg-[#FBF3F4]";
    if (s === "rejeitado") return "text-red-600 bg-red-50";
    return "text-slate-500 bg-slate-100";
  };

  if (selectedCadastroPublico) {
    const c = selectedCadastroPublico;
    const comprovanteEndereco = c.comprovante_endereco_proprio === "sim"
      ? "Sim"
      : c.comprovante_endereco_proprio === "nao"
        ? "Não"
        : c.comprovante_endereco_proprio || "—";

    const ef = cadastroEditForm;
    const setEf = (key: string, val: string) => setCadastroEditForm(prev => ({ ...prev, [key]: val }));
    const isEditing = editingCadastroPublico;

    const editInput = (fieldKey: string) => (
      <input
        key={`edit-${fieldKey}`}
        value={ef[fieldKey] || ""}
        onChange={e => setEf(fieldKey, e.target.value.toUpperCase())}
        className="flex-1 text-sm font-medium border-b border-slate-300 bg-transparent outline-none focus:border-[#7A1F2B] py-0.5"
        style={{ color: "hsl(220 20% 18%)" }}
      />
    );

    const renderField = (label: string, fieldKey: string | undefined, value: string | null | undefined, opts?: { copyable?: boolean }) => {
      if (isEditing && fieldKey) {
        return (
          <div className="flex items-baseline gap-2">
            <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>{label}:</span>
            {editInput(fieldKey)}
          </div>
        );
      }
      return <DetailField label={label} value={value} copyable={opts?.copyable} />;
    };

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <button
              onClick={() => { setSelectedCadastroPublico(null); setEditingCadastroPublico(false); }}
              className="mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-slate-100 shrink-0"
              style={{ border: "1px solid hsl(220 13% 90%)" }}
            >
              <ChevronLeft className="h-4 w-4" style={{ color: "hsl(220 10% 46%)" }} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-bold tracking-tight break-words" style={{ color: "hsl(220 20% 14%)" }}>
                {c.nome_completo}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${cadastroStatusColor(c.status)}`}>
                  {String(c.status || "").toUpperCase()}
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${
                    c.pago
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-slate-50 text-slate-400 border-slate-200 opacity-60"
                  }`}
                >
                  {c.pago ? "PAGO" : "NÃO PAGO"}
                </span>
                <span className="text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>CPF: {formatCpf(c.cpf)}</span>
              </div>
            </div>
            <SelfieThumb path={(c as any).selfie_path} name={c.nome_completo} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:items-center md:flex-nowrap md:justify-end gap-1.5 md:gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setEditingCadastroPublico(false)}
                  className="h-8 md:h-9 px-2 md:px-4 rounded-lg text-[11px] md:text-xs font-medium border transition-all hover:bg-slate-50 flex items-center justify-center gap-1"
                  style={{ borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 30%)" }}
                >
                  <X className="h-3.5 w-3.5" /> Cancelar
                </button>
                <button
                  onClick={saveCadastroEdit}
                  disabled={savingCadastroEdit}
                  className="h-8 md:h-9 px-2 md:px-4 rounded-lg text-[11px] md:text-xs font-semibold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                  style={{ background: "hsl(152 60% 40%)" }}
                >
                  {savingCadastroEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={startEditCadastro}
                  className="h-8 md:h-9 px-2 md:px-3 rounded-lg text-[11px] md:text-xs font-medium border transition-all hover:bg-slate-50 flex items-center justify-center gap-1"
                  style={{ borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 30%)" }}
                >
                  <Edit className="h-3.5 w-3.5" /> Editar
                </button>
                {c.status === "rejeitado" && !(c as any).cliente_id_vinculado && (
                  <button
                    disabled={!!savingCadastroPublicoStatus}
                    onClick={() => excluirDefinitivamenteCadastroPublico()}
                    className="h-8 md:h-9 px-2 md:px-3 rounded-lg text-[11px] md:text-xs font-semibold border transition-all disabled:opacity-40 flex items-center justify-center gap-1 bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                    title="Excluir cadastro definitivamente (libera o CPF)"
                  >
                    {savingCadastroPublicoStatus === "excluindo" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Excluir
                  </button>
                )}
                <button
                  disabled={!!savingCadastroPublicoStatus || c.status === "rejeitado"}
                  onClick={() => updateCadastroPublicoStatus("rejeitado")}
                  className="h-8 md:h-9 px-2 md:px-3 rounded-lg text-[11px] md:text-xs font-medium border transition-all disabled:opacity-40 hover:bg-slate-50 flex items-center justify-center gap-1"
                  style={{ borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 30%)" }}
                >
                  {savingCadastroPublicoStatus === "rejeitado" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Rejeitar
                </button>
                {(() => {
                  const isConferido = ["aprovado", "conferido", "validado", "formulario_conferido"]
                    .includes(String(c.status || "").toLowerCase());
                  return (
                    <button
                      disabled={!!savingCadastroPublicoStatus || c.status === "pendente"}
                      onClick={() => updateCadastroPublicoStatus("pendente")}
                      className={`h-8 md:h-9 px-2 md:px-3 rounded-lg text-[11px] md:text-xs font-semibold border transition-all disabled:opacity-40 flex items-center justify-center gap-1 ${
                        isConferido
                          ? "col-span-2 sm:col-span-1 bg-[#F1D9DC] text-[#3D0E16] border-[#B43543] hover:bg-[#E5C2C6]"
                          : "font-medium hover:bg-slate-50"
                      }`}
                      style={isConferido ? undefined : { borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 30%)" }}
                      title={isConferido ? "Voltar para pendente (remove a conferência)" : "Marcar como pendente"}
                    >
                      {savingCadastroPublicoStatus === "pendente" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isConferido ? (
                        <RefreshCw className="h-3.5 w-3.5" />
                      ) : null}
                      {isConferido ? "Remover conferência" : "Pendente"}
                    </button>
                  );
                })()}
                <button
                  disabled={!!savingCadastroPublicoStatus}
                  onClick={() => togglePagoCadastroPublico()}
                  className={`h-8 md:h-9 px-2 md:px-3 rounded-lg text-[11px] md:text-xs font-semibold border transition-all disabled:opacity-40 flex items-center justify-center gap-1 ${
                    c.pago
                      ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600"
                      : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                  }`}
                  title={c.pago ? "Marcar como NÃO pago" : "Marcar como pago"}
                >
                  {savingCadastroPublicoStatus?.startsWith("pago") ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    c.pago ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />
                  )}
                  {c.pago ? "Não pagou" : "Pago"}
                </button>
                <button
                  disabled={!!savingCadastroPublicoStatus || c.status === "aprovado"}
                  onClick={() => updateCadastroPublicoStatus("aprovado")}
                  className="col-span-2 sm:col-span-1 h-8 md:h-9 px-2 md:px-4 rounded-lg text-[11px] md:text-xs font-semibold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                  style={{ background: "hsl(352 60% 30%)" }}
                >
                  {savingCadastroPublicoStatus === "aprovado" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5" />
                  )}
                  Validar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Painel SLA — só aparece quando pago */}
        {c.pago && (() => {
          const sla = calcularSla({
            pago_em: (c as any).pago_em,
            aguardando_cliente_desde: (c as any).aguardando_cliente_desde,
            dias_pausados: (c as any).dias_pausados,
            sla_concluido_em: (c as any).sla_concluido_em,
          });
          if (!sla) return null;
          const aguardando = (c as any).aguardando_cliente_desde;
          const concluido = !!(c as any).sla_concluido_em;
          return (
            <div className="rounded-xl border p-3 md:p-4" style={{ background: sla.bg, borderColor: `${sla.cor}55` }}>
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="h-4 w-4 flex-shrink-0" style={{ color: sla.cor }} />
                  <span className="text-xs font-bold" style={{ color: sla.cor }}>SLA: {sla.label}</span>
                </div>
                <span className="text-[10px] text-slate-600">
                  {sla.diasCorridos}d corridos · {sla.diasPausados}d em pausa
                </span>
              </div>
              {(c as any).ultima_solicitacao_cliente && aguardando && (
                <p className="text-[11px] mb-2 text-slate-700" style={{ overflowWrap: "anywhere" }}>
                  ⏸ Pendência: <strong>{(c as any).ultima_solicitacao_cliente}</strong>
                </p>
              )}
              {!concluido && (
                <div className="flex flex-wrap gap-2">
                  {!aguardando ? (
                    <button
                      disabled={savingCadastroPublicoStatus === "sla"}
                      onClick={handleAguardandoCliente}
                      className="h-8 px-3 rounded-lg text-[11px] font-semibold border bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"
                      style={{ borderColor: "#cbd5e1", color: "#475569" }}
                    >
                      <Pause className="h-3.5 w-3.5" /> Aguardando cliente
                    </button>
                  ) : (
                    <button
                      disabled={savingCadastroPublicoStatus === "sla"}
                      onClick={handleRetomarSla}
                      className="h-8 px-3 rounded-lg text-[11px] font-semibold border bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"
                      style={{ borderColor: "#6366f1", color: "#6366f1" }}
                    >
                      <Play className="h-3.5 w-3.5" /> Documentos recebidos
                    </button>
                  )}
                  <button
                    disabled={savingCadastroPublicoStatus === "sla"}
                    onClick={handleConcluirSla}
                    className="h-8 px-3 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-1"
                    style={{ background: "#16a34a" }}
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Concluir serviço
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Content cards */}
        <div className="space-y-4">
          <DetailCard title="Resumo do Cadastro">
            <DetailGrid>
              <DetailField label="Recebido em" value={formatDateTime(c.created_at)} />
              {isEditing ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>Serviço:</span>
                  <select
                    value={ef.servico_interesse || ""}
                    onChange={e => setEf("servico_interesse", e.target.value)}
                    className="flex-1 text-sm font-medium border-b border-slate-300 bg-transparent outline-none focus:border-[#7A1F2B] py-0.5 uppercase"
                    style={{ color: "hsl(220 20% 18%)" }}
                  >
                    <option value="">Selecione...</option>
                    {servicos.map(s => (
                      <option key={s.id} value={s.nome_servico}>{s.nome_servico}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <DetailField label="Serviço" value={c.servico_interesse} />
              )}
              {renderField("Tipo de vínculo", "vinculo_tipo", c.vinculo_tipo)}
              <DetailField label="Comprovante em nome próprio" value={comprovanteEndereco} />
              <DetailField label="Consentimento de veracidade" value={c.consentimento_dados_verdadeiros ? "Sim" : "Não"} />
              <DetailField label="Consentimento LGPD" value={c.consentimento_tratamento_dados ? "Sim" : "Não"} />
              <DetailField label="Aceite em" value={formatDateTime(c.consentimento_timestamp ?? c.created_at)} />
            </DetailGrid>
          </DetailCard>

          <DetailCard title="Qualificação comercial (cadastro público)">
            <DetailGrid>
              <DetailField label="Objetivo principal" value={objetivoLabel(c.objetivo_principal) || "—"} />
              <DetailField label="Categoria" value={categoriaLabel(c.categoria_servico) || "—"} />
              <DetailField label="Serviço escolhido" value={c.servico_principal || "—"} />
              <DetailField label="Subtipo" value={c.subtipo_servico || "—"} />
              <DetailField label="Origem" value={c.origem_cadastro || "—"} />
              {isEditing ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>Serviço fechado:</span>
                  <input
                    value={ef.servico_fechado_final || ""}
                    onChange={e => setEf("servico_fechado_final", e.target.value)}
                    placeholder="Defina após negociação"
                    className="flex-1 text-sm font-medium border-b border-slate-300 bg-transparent outline-none focus:border-[#7A1F2B] py-0.5 uppercase"
                    style={{ color: "hsl(220 20% 18%)" }}
                  />
                </div>
              ) : (
                <DetailField label="Serviço fechado (interno)" value={c.servico_fechado_final || "—"} />
              )}
            </DetailGrid>
            {c.descricao_servico_livre && (
              <div className="mt-3 text-xs leading-relaxed rounded-lg p-3"
                style={{ background: "hsl(220 20% 97%)", color: "hsl(220 20% 25%)" }}>
                <strong>Descrição livre do cliente:</strong> {c.descricao_servico_livre}
              </div>
            )}
          </DetailCard>

          {(c.selfie_path || c.documento_identidade_path || c.comprovante_endereco_path) && (
            <DetailCard title="Documentos enviados pelo cliente">
              <CadastroDocumentosCard
                cadastro={c}
                onUpdated={(updated) => {
                  setSelectedCadastroPublico(updated);
                  setCadastrosPublicos(prev => prev.map(it => it.id === updated.id ? { ...it, ...updated } : it));
                }}
              />
            </DetailCard>
          )}
          {(() => {
            const ua = (c as any).consentimento_user_agent as string | null | undefined;
            const ip = (c as any).consentimento_ip as string | null | undefined;
            const parsed = parseUserAgent(ua);
            return (
              <DetailCard title="Captura técnica (LGPD)">
                <DetailGrid>
                  <DetailField label="Endereço IP" value={ip || "—"} copyable={!!ip} />
                  <DetailField label="Dispositivo" value={parsed.dispositivo} />
                  <DetailField label="Sistema operacional" value={parsed.sistema} />
                  <DetailField label="Navegador" value={parsed.navegador} />
                  <DetailField label="User-Agent completo" value={ua || "—"} />
                  <DetailField label="Data/hora do aceite" value={formatDateTime(c.consentimento_timestamp)} />
                </DetailGrid>
              </DetailCard>
            );
          })()}

          <DetailCard title="Identificação">
            <DetailGrid>
              {renderField("Nome", "nome_completo", c.nome_completo)}
              {renderField("CPF", "cpf", formatCpf(c.cpf), { copyable: true })}
              {isEditing ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>RG:</span>
                    <input
                      value={ef.rg || ""}
                      onChange={e => setEf("rg", maskRg(e.target.value))}
                      placeholder="00.000.000-X"
                      className="flex-1 text-sm font-medium border-b border-slate-300 bg-transparent outline-none focus:border-[#7A1F2B] py-0.5"
                      style={{ color: "hsl(220 20% 18%)" }}
                    />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>Órgão Emissor:</span>
                    {editInput("emissor_rg")}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>UF Emissor:</span>
                    <select
                      value={ef.uf_emissor_rg || ""}
                      onChange={e => setEf("uf_emissor_rg", e.target.value)}
                      className="flex-1 text-sm font-medium border-b border-slate-300 bg-transparent outline-none focus:border-[#7A1F2B] py-0.5 uppercase"
                      style={{ color: "hsl(220 20% 18%)" }}
                    >
                      <option value="">Selecione</option>
                      {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <DetailField label="RG / CIN" value={c.rg ? `${maskRg(c.rg)}${c.emissor_rg ? ` — ${c.emissor_rg}` : ""}${(c as any).uf_emissor_rg ? `/${(c as any).uf_emissor_rg}` : ""}` : null} />
              )}
              {renderField("Nascimento", "data_nascimento", c.data_nascimento)}
              {renderField("Estado Civil", "estado_civil", c.estado_civil)}
              {renderField("Nacionalidade", "nacionalidade", c.nacionalidade)}
              {renderField("Profissão", "profissao", c.profissao)}
              {renderField("Mãe", "nome_mae", c.nome_mae)}
              {renderField("Pai", "nome_pai", c.nome_pai)}
            </DetailGrid>
          </DetailCard>

          <DetailCard title="Contato">
            <DetailGrid>
              {renderField("Telefone principal", "telefone_principal", c.telefone_principal, { copyable: true })}
              {renderField("Telefone secundário", "telefone_secundario", c.telefone_secundario, { copyable: true })}
              {renderField("Email", "email", c.email, { copyable: true })}
            </DetailGrid>
          </DetailCard>

          <DetailCard title="Endereço Principal">
            <DetailGrid>
              {isEditing ? (
                <>
                  {renderField("Logradouro", "end1_logradouro", c.end1_logradouro)}
                  {renderField("Número", "end1_numero", c.end1_numero)}
                </>
              ) : (
                <DetailField label="Logradouro" value={[c.end1_logradouro, c.end1_numero].filter(Boolean).join(", ")} />
              )}
              {renderField("Complemento", "end1_complemento", c.end1_complemento)}
              {renderField("Bairro", "end1_bairro", c.end1_bairro)}
              {renderField("CEP", "end1_cep", c.end1_cep)}
              {isEditing ? (
                <>
                  {renderField("Cidade", "end1_cidade", c.end1_cidade)}
                  {renderField("UF", "end1_estado", c.end1_estado)}
                </>
              ) : (
                <DetailField label="Cidade/UF" value={[c.end1_cidade, c.end1_estado].filter(Boolean).join(" / ")} />
              )}
            </DetailGrid>
          </DetailCard>

          {(c.tem_segundo_endereco || isEditing) && (
            <DetailCard title="Endereço Secundário">
              <DetailGrid>
                {renderField("Tipo", "end2_tipo", c.end2_tipo)}
                {isEditing ? (
                  <>
                    {renderField("Logradouro", "end2_logradouro", c.end2_logradouro)}
                    {renderField("Número", "end2_numero", c.end2_numero)}
                  </>
                ) : (
                  <DetailField label="Logradouro" value={[c.end2_logradouro, c.end2_numero].filter(Boolean).join(", ")} />
                )}
                {renderField("Complemento", "end2_complemento", c.end2_complemento)}
                {renderField("Bairro", "end2_bairro", c.end2_bairro)}
                {renderField("CEP", "end2_cep", c.end2_cep)}
                {isEditing ? (
                  <>
                    {renderField("Cidade", "end2_cidade", c.end2_cidade)}
                    {renderField("UF", "end2_estado", c.end2_estado)}
                  </>
                ) : (
                  <DetailField label="Cidade/UF" value={[c.end2_cidade, c.end2_estado].filter(Boolean).join(" / ")} />
                )}
              </DetailGrid>
            </DetailCard>
          )}

          {(c.emp_cnpj || c.emp_razao_social || c.emp_nome_fantasia) && (() => {
            const cepMatch = c.emp_endereco?.match(/(\d{5}-?\d{3})/);
            const empCep = cepMatch ? cepMatch[1] : null;
            const empEnderecoSemCep = c.emp_endereco?.replace(/^CEP\s*\d{5}-?\d{3}\s*-\s*/i, "").replace(/\s*-?\s*CEP\s*\d{5}-?\d{3}\s*/i, "").trim() || c.emp_endereco;
            return (
            <DetailCard title="Empresa / Sociedade">
              <DetailGrid>
                <DetailField label="CNPJ" value={c.emp_cnpj} copyable />
                <DetailField label="Razão social" value={c.emp_razao_social} />
                <DetailField label="Nome fantasia" value={c.emp_nome_fantasia} />
                <DetailField label="Situação Cadastral" value={c.emp_situacao_cadastral} />
                <DetailField label="Cargo/Função" value={c.emp_cargo_funcao} />
                <DetailField label="Participação" value={c.emp_participacao_societaria} />
                <DetailField label="CEP" value={empCep} copyable />
                <DetailField label="Endereço" value={empEnderecoSemCep} />
                <DetailField label="Telefone" value={c.emp_telefone} copyable />
                <DetailField label="Email" value={c.emp_email} copyable />
              </DetailGrid>
            </DetailCard>
            );
          })()}

          {(c.trab_cnpj_empresa || c.trab_nome_empresa) && (
            <DetailCard title="Trabalho Registrado">
              <DetailGrid>
                <DetailField label="Empresa" value={c.trab_nome_empresa} />
                <DetailField label="CNPJ" value={c.trab_cnpj_empresa} copyable />
                <DetailField label="Cargo/Função" value={c.trab_cargo_funcao} />
                <DetailField label="Admissão" value={c.trab_data_admissao} />
                <DetailField label="Faixa Salarial" value={c.trab_faixa_salarial} />
                <DetailField label="Endereço" value={c.trab_endereco_empresa} />
                <DetailField label="Telefone" value={c.trab_telefone_empresa} copyable />
              </DetailGrid>
            </DetailCard>
          )}

          {(c.aut_atividade || c.aut_nome_profissional) && (
            <DetailCard title="Autônomo">
              <DetailGrid>
                <DetailField label="Atividade" value={c.aut_atividade} />
                <DetailField label="Nome Profissional" value={c.aut_nome_profissional} />
                <DetailField label="CNPJ" value={c.aut_cnpj} copyable />
                <DetailField label="Telefone" value={c.aut_telefone} copyable />
                <DetailField label="Endereço" value={c.aut_endereco} />
              </DetailGrid>
            </DetailCard>
          )}

          {(c.observacoes || isEditing) && (
            <DetailCard title="Observações">
              {isEditing ? (
                <textarea
                  value={ef.observacoes || ""}
                  onChange={e => setEf("observacoes", e.target.value.toUpperCase())}
                  rows={3}
                  className="w-full text-sm border rounded-lg p-3 outline-none focus:border-[#7A1F2B]"
                  style={{ color: "hsl(220 20% 25%)", borderColor: "hsl(220 13% 88%)" }}
                />
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap rounded-xl p-4"
                  style={{ color: "hsl(220 20% 25%)", background: "hsl(220 20% 97%)" }}>
                  {c.observacoes}
                </div>
              )}
            </DetailCard>
          )}
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-4 md:space-y-5 max-w-7xl mx-auto px-1">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
              CLIENTES
            </h1>
            <p className="text-xs md:text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
              {clientes.length} cadastrados • {cadastrosPublicos.length} formulários
            </p>
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            <Button variant="ghost" size="sm" onClick={exportClientes} className="h-8 px-2 text-[11px]" style={{ color: "hsl(220 10% 46%)" }}>
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
          </div>
        </div>
        {/* Mobile: full-width primary CTA */}
        <button onClick={() => { setEditingCliente(null); setClienteModal(true); }}
          className="flex sm:hidden items-center justify-center gap-1.5 w-full h-10 rounded-xl text-xs font-bold tracking-wide"
          style={{ background: "hsl(352 60% 30%)", color: "#fff" }}>
          <Plus className="h-4 w-4" /> NOVO CLIENTE
        </button>
        {/* Desktop: inline actions */}
        <div className="hidden sm:flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportClientes} className="h-8 px-2.5 text-[11px]" style={{ color: "hsl(220 10% 46%)" }}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
          <button onClick={() => { setEditingCliente(null); setClienteModal(true); }}
            className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-semibold rounded-md transition-all hover:opacity-90 shadow-sm"
            style={{ background: "hsl(352 60% 30%)", color: "#ffffff" }}>
            <Plus className="h-3.5 w-3.5" /> NOVO CLIENTE
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "hsl(220 10% 62%)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CPF, telefone ou e-mail..."
          className="w-full h-10 pl-9 pr-4 rounded-xl border text-[13px] outline-none transition-all focus:ring-2 focus:ring-[#7A1F2B] focus:border-[#7A1F2B]"
          style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 18%)" }}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "hsl(220 20% 96%)" }}>
        <button
          onClick={() => setTabView("clientes")}
          className="flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold transition-all"
          style={{
            background: tabView === "clientes" ? "hsl(0 0% 100%)" : "transparent",
            color: tabView === "clientes" ? "hsl(220 20% 18%)" : "hsl(220 10% 55%)",
            boxShadow: tabView === "clientes" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>
          <User className="h-3.5 w-3.5 inline mr-1" /> CLIENTES <br />({filtered.length})
        </button>
        <button
          onClick={() => setTabView("manuais")}
          className="flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold transition-all"
          style={{
            background: tabView === "manuais" ? "hsl(0 0% 100%)" : "transparent",
            color: tabView === "manuais" ? "hsl(220 20% 18%)" : "hsl(220 10% 55%)",
            boxShadow: tabView === "manuais" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>
          <Plus className="h-3.5 w-3.5 inline mr-1" /> MANUAIS <br />({filteredManuais.length})
        </button>
        <button
          onClick={() => setTabView("cadastros")}
          className="flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold transition-all"
          style={{
            background: tabView === "cadastros" ? "hsl(0 0% 100%)" : "transparent",
            color: tabView === "cadastros" ? "hsl(220 20% 18%)" : "hsl(220 10% 55%)",
            boxShadow: tabView === "cadastros" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>
          <FileText className="h-3.5 w-3.5 inline mr-1" /> FORMULÁRIOS ({filteredCadastros.length})
        </button>
        <button
          onClick={() => setTabView("rejeitados")}
          className="flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold transition-all"
          style={{
            background: tabView === "rejeitados" ? "hsl(0 0% 100%)" : "transparent",
            color: tabView === "rejeitados" ? "hsl(0 65% 45%)" : "hsl(220 10% 55%)",
            boxShadow: tabView === "rejeitados" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>
          <XCircle className="h-3.5 w-3.5 inline mr-1" /> REJEITADOS ({filteredRejeitados.length})
        </button>
      </div>

      {/* Sub-filter for FORMULÁRIOS (pendente / aprovado) */}
      {tabView === "cadastros" && (
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: "hsl(220 20% 96%)" }}>
          <button
            onClick={() => setCadastroFilter("pendente")}
            className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all"
            style={{
              background: cadastroFilter === "pendente" ? "hsl(38 92% 50%)" : "transparent",
              color: cadastroFilter === "pendente" ? "white" : "hsl(220 10% 55%)",
            }}>
            Pendentes
          </button>
          <button
            onClick={() => setCadastroFilter("aprovado")}
            className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all"
            style={{
              background: cadastroFilter === "aprovado" ? "hsl(152 60% 42%)" : "transparent",
              color: cadastroFilter === "aprovado" ? "white" : "hsl(220 10% 55%)",
            }}>
            Aprovados
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonList rows={6} />
      ) : loadError ? (
        <ErrorRetryState
          error={loadError}
          onRetry={loadClientes}
          title="Não foi possível carregar os clientes"
        />
      ) : tabView === "clientes" ? (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <EmptyState
              icon={<User className="h-5 w-5" />}
              title="Nenhum cliente encontrado"
              description="Ajuste os filtros ou cadastre um novo cliente para começar."
            />
          )}
          {filtered.map(c => {
            const statusTone =
              c.status === "ATIVO"
                ? "hsl(152 60% 42%)"
                : c.status === "DESISTENTE"
                ? "hsl(0 72% 55%)"
                : "hsl(38 92% 50%)";
            return (
              <button
                key={c.id}
                onClick={() => openClient(c)}
                className="w-full text-left group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.997]"
                style={{ boxShadow: `inset 0 0 0 1px ${statusTone}10, 0 1px 2px rgba(15,23,42,0.04)` }}
              >
                {/* Glow ambiente — assinatura do KpiCard do Arsenal */}
                <div
                  className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30 blur-2xl"
                  style={{ background: statusTone }}
                />
                <div className="relative flex items-center gap-3 px-4 py-3.5">
                  {/* Avatar: foto manual OU selfie do cadastro público (resolvida em batch em loadClientes). */}
                  <ClienteSelfieAvatar cliente={c} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[14px] font-bold uppercase tracking-tight truncate" style={{ color: "hsl(220 20% 12%)" }}>
                        {c.nome_completo}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500">
                      <span className="font-mono tracking-wider text-slate-400">CPF {formatCpf(c.cpf)}</span>
                      {c.celular && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Phone className="h-2.5 w-2.5 text-slate-400" /> {c.celular}
                          </span>
                        </>
                      )}
                      {c.cidade && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="inline-flex items-center gap-1 uppercase tracking-wide">
                            <MapPin className="h-2.5 w-2.5 text-slate-400" /> {c.cidade}/{c.estado}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden sm:flex flex-col items-end gap-0.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em]"
                        style={{ background: `${statusTone}14`, color: statusTone, boxShadow: `inset 0 0 0 1px ${statusTone}33` }}
                      >
                        <span className="h-1 w-1 rounded-full" style={{ background: statusTone }} />
                        {c.status}
                      </span>
                      <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-slate-400">
                        #{String(c.id).padStart(4, "0")}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModal({ open: true, table: "qa_clientes", id: c.id, title: "Excluir Cliente", desc: `Excluir "${c.nome_completo}" e todos os dados vinculados (vendas, armas, filiações)?` });
                      }}
                      className="h-8 w-8 rounded-xl flex items-center justify-center bg-white border border-slate-200 text-slate-300 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all md:opacity-0 md:group-hover:opacity-100"
                      title="Excluir cliente"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : tabView === "cadastros" ? (
        <div className="space-y-1.5">
          {filteredCadastros.length === 0 && (
            <EmptyState
              title="Nenhum cadastro público encontrado"
              description="Cadastros enviados pela página pública aparecerão aqui para triagem."
            />
          )}
          {filteredCadastros.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => openCadastroPublico(c.id)}
              disabled={loadingCadastroPublico}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:shadow-sm text-left group qa-card disabled:opacity-70"
              style={{ borderColor: "hsl(220 13% 93%)" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "hsl(152 60% 95%)" }}>
                <FileText className="h-4 w-4" style={{ color: "hsl(152 60% 42%)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: "hsl(220 20% 18%)" }}>{c.nome_completo}</div>
                <div className="flex items-center gap-2 text-[11px] flex-wrap" style={{ color: "hsl(220 10% 55%)" }}>
                  <span>{formatCpf(c.cpf)}</span>
                  <span>•</span>
                  <span>{c.telefone_principal || "—"}</span>
                  <span>•</span>
                  <span>{c.email || "—"}</span>
                </div>
                {c.servico_interesse && (
                  <div className="text-[10px] mt-0.5" style={{ color: "hsl(352 60% 30%)" }}>🎯 {c.servico_interesse}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${cadastroStatusColor(c.status)}`}
                    title={`Status de validação: ${c.status}`}
                  >
                    {String(c.status || "").toUpperCase()}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={c.pago ? "Marcar como não pago" : "Marcar como pago"}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (savingCadastroPublicoStatus) return;
                      void togglePagoCadastroPublico(c);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        e.preventDefault();
                        if (savingCadastroPublicoStatus) return;
                        void togglePagoCadastroPublico(c);
                      }
                    }}
                    className={`cursor-pointer select-none text-[9px] px-1.5 py-0.5 rounded-full font-semibold border transition-all ${
                      c.pago
                        ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600"
                        : "bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100"
                    } ${savingCadastroPublicoStatus === `pago:${c.id}` ? "opacity-60" : ""}`}
                    title={c.pago ? "Clique para marcar como NÃO pago" : "Clique para marcar como pago"}
                  >
                    {savingCadastroPublicoStatus === `pago:${c.id}` ? "..." : (c.pago ? "PAGO" : "NÃO PAGO")}
                  </span>
                  <span className="text-[10px]" style={{ color: "hsl(220 10% 62%)" }}>
                    {new Date(c.created_at).toLocaleDateString("pt-BR")} {new Date(c.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {loadingCadastroPublico ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "hsl(220 10% 62%)" }} />
                ) : (
                  <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "hsl(220 10% 62%)" }} />
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        // tabView === "rejeitados"
        <div className="space-y-1.5">
          {filteredRejeitados.length === 0 && (
            <div className="text-center py-12 text-sm" style={{ color: "hsl(220 10% 62%)" }}>
              Nenhum cadastro rejeitado.
            </div>
          )}
          {filteredRejeitados.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => openCadastroPublico(c.id)}
              disabled={loadingCadastroPublico}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:shadow-sm text-left group disabled:opacity-70"
              style={{ borderColor: "hsl(0 60% 92%)", background: "hsl(0 60% 99%)" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "hsl(0 60% 95%)" }}>
                <XCircle className="h-4 w-4" style={{ color: "hsl(0 65% 50%)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: "hsl(220 20% 18%)" }}>{c.nome_completo}</div>
                <div className="flex items-center gap-2 text-[11px] flex-wrap" style={{ color: "hsl(220 10% 55%)" }}>
                  <span>{formatCpf(c.cpf)}</span>
                  <span>•</span>
                  <span>{c.telefone_principal || "—"}</span>
                  <span>•</span>
                  <span>{c.email || "—"}</span>
                </div>
                {c.servico_interesse && (
                  <div className="text-[10px] mt-0.5" style={{ color: "hsl(0 65% 50%)" }}>🎯 {c.servico_interesse}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border bg-red-50 text-red-600 border-red-200">
                    REJEITADO
                  </span>
                  <span className="text-[10px]" style={{ color: "hsl(220 10% 62%)" }}>
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                {loadingCadastroPublico ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "hsl(220 10% 62%)" }} />
                ) : (
                  <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "hsl(220 10% 62%)" }} />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <ClienteFormModal open={clienteModal} onClose={() => { setClienteModal(false); setEditingCliente(null); }} onSaved={loadClientes} cliente={editingCliente} />
      <DeleteConfirm
        open={deleteModal.open}
        onClose={() => setDeleteModal({ ...deleteModal, open: false })}
        onConfirm={handleDelete}
        title={deleteModal.title}
        description={deleteModal.desc}
        loading={deleting}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="qa-card p-4 md:p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "hsl(220 65% 48% / 0.12)" }}
        >
          <FileText className="h-3.5 w-3.5" style={{ color: "hsl(220 65% 48%)" }} />
        </div>
        <h3
          className="text-[11px] uppercase tracking-[0.14em] font-bold"
          style={{ color: "hsl(220 65% 48%)" }}
        >
          {title}
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">{children}</div>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="qa-card p-5 md:p-6">
      <h3 className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-4"
        style={{ color: "hsl(0 65% 42%)" }}>{title}</h3>
      {children}
    </div>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2.5">{children}</div>;
}

function DetailField({ label, value, icon: Icon, copyable, highlight }: {
  label: string; value?: string | null; icon?: any; copyable?: boolean; highlight?: boolean;
}) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      navigator.clipboard.writeText(value);
      toast.success(`${label} copiado!`);
    }
  };
  const displayValue = value || "—";
  const isInvalid = displayValue === "Invalid Date";

  return (
    <div className="flex items-start gap-3 group">
      {Icon && <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(220 10% 62%)" }} />}
      <div className="flex items-baseline gap-2 flex-1 min-w-0">
        <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>
          {label}:
        </span>
        <span className={`text-sm font-medium uppercase min-w-0 flex-1 break-words ${isInvalid ? "text-red-500" : ""} ${highlight ? "text-emerald-600" : ""}`}
          style={{
            ...(isInvalid || highlight ? {} : { color: "hsl(220 20% 18%)" }),
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}>
          {displayValue}
        </span>
      </div>
      {copyable && value && value !== "—" && (
        <button onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100"
          title="Copiar">
          <span className="text-xs">📋</span>
        </button>
      )}
    </div>
  );
}

function Field({ label, value, icon: Icon, copyable, copyValue }: { label: string; value?: string | null; icon?: any; copyable?: boolean; copyValue?: string | null }) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const toCopy = copyValue ?? value;
    if (toCopy) {
      navigator.clipboard.writeText(toCopy);
      toast.success(`${label} copiado!`);
    }
  };
  return (
    <div className={`flex flex-col gap-0.5 py-1 ${copyable && value ? "cursor-pointer active:opacity-60 group" : ""}`} onClick={copyable ? handleCopy : undefined}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(220 10% 55%)" }} />}
        <span className="text-[10px] text-slate-500 uppercase tracking-[0.14em] font-bold">{label}</span>
        {copyable && value && <span className="text-slate-300 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ml-auto">📋</span>}
      </div>
        <span
          className="text-[14px] text-slate-900 font-bold uppercase pl-0.5 break-words leading-snug"
          style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
        >
          {value || "—"}
        </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-8 text-slate-400 text-xs">{text}</div>;
}

const TEMPLATES = [
  { key: "dsa_1endereco", label: "DSA – 1 Endereço", desc: "Declaração de Segurança do Acervo (endereço único)", grupo: "cac_cr" },
  { key: "dsa_2enderecos", label: "DSA – 2 Endereços", desc: "Declaração de Segurança do Acervo (principal + secundário)", needs2addr: true, grupo: "cac_cr" },
  { key: "declaracao_guarda_acervo_1endereco", label: "Guarda de Acervo – 1 End.", desc: "Declaração de endereço de guarda de acervo", grupo: "cac_cr" },
  { key: "declaracao_guarda_acervo_2enderecos", label: "Guarda de Acervo – 2 End.", desc: "Declaração com endereço principal e secundário", needs2addr: true, grupo: "cac_cr" },
  { key: "declaracao_nao_segundo_endereco", label: "Não Possui 2º Endereço", desc: "Declaração de não possuir segundo endereço", grupo: "cac_cr" },
  { key: "declaracao_nao_inquerito_criminal", label: "Não Resp. Inquérito/Proc. Criminal", desc: "Declaração de não responder inquérito policial ou processo criminal", grupo: "cac_cr" },
  { key: "declaracao_responsavel_imovel_reside", label: "Resp. Imóvel – Reside", desc: "Declaração do responsável pelo imóvel (reside atualmente)", needsThirdParty: true, grupo: "universal" },
  { key: "declaracao_responsavel_imovel_residiu", label: "Resp. Imóvel – Residiu", desc: "Declaração do responsável pelo imóvel (residiu de/até)", needsThirdParty: true, needsDates: true, grupo: "universal" },
];

/** Determina o grupo de declarações baseado no nome do serviço */
function getServicoGrupo(nomeServico: string): "posse_porte" | "cac_cr" {
  const upper = (nomeServico || "").toUpperCase();
  if (upper.includes("POSSE") || upper.includes("PORTE")) return "posse_porte";
  return "cac_cr";
}

/** Filtra templates aplicáveis ao grupo do serviço */
function getTemplatesParaServico(nomeServico: string) {
  const grupo = getServicoGrupo(nomeServico);
  if (grupo === "posse_porte") {
    return TEMPLATES.filter(t => t.grupo === "universal");
  }
  // CAC/CR/Autorização/Registro → todas as declarações
  return TEMPLATES;
}

function DocumentGenerator({ cliente, nomeServico }: { cliente: any; nomeServico?: string }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [showExtra, setShowExtra] = useState<string | null>(null);
  // Third party fields
  const [tp, setTp] = useState({ nome: "", naturalidade: "", nascimento: "", profissao: "", estadoCivil: "", cpf: "" });
  const [dataEntrada, setDataEntrada] = useState("");
  const [dataSaida, setDataSaida] = useState("");

  const handleGenerate = async (templateKey: string) => {
    const tpl = TEMPLATES.find(t => t.key === templateKey);
    if (tpl?.needsThirdParty && !tp.nome.trim()) {
      toast.error("Preencha os dados do responsável pelo imóvel");
      return;
    }
    if (tpl?.needs2addr && !cliente.endereco2) {
      toast.error("Cliente não possui endereço secundário cadastrado");
      return;
    }

    setGenerating(templateKey);
    try {
      const extra: Record<string, string> = {};
      if (tpl?.needsThirdParty) {
        extra["[NOME COMPLETO 3]"] = tp.nome;
        extra["[NATURALIDADE 3]"] = tp.naturalidade;
        extra["[DATA NASCIMENTO 3]"] = tp.nascimento;
        extra["[PROFISSÃO 3]"] = tp.profissao;
        extra["[ESTADO CIVIL 3]"] = tp.estadoCivil;
        extra["[CPF 3]"] = tp.cpf;
      }
      if (tpl?.needsDates) {
        extra["[DATA ENTRADA]"] = dataEntrada;
        extra["[DATA SAÍDA]"] = dataSaida;
      }

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-fill-template`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ template_key: templateKey, cliente_id: cliente.id, extra_fields: extra }),
        }
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errBody.error || "Erro ao gerar documento");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateKey}_${(cliente.nome_completo || "cliente").replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Documento gerado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar documento");
    } finally {
      setGenerating(null);
    }
  };

  const filteredTemplates = nomeServico ? getTemplatesParaServico(nomeServico) : TEMPLATES;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "hsl(220 10% 45%)" }}>
          {nomeServico ? `Declarações — ${nomeServico}` : "Gerar Declarações"}
        </span>
      </div>

      {/* Third party fields - show when needed */}
      {showExtra && TEMPLATES.find(t => t.key === showExtra)?.needsThirdParty && (
        <div className="qa-card p-4 space-y-3" style={{ borderColor: "hsl(40 70% 80%)" }}>
          <div className="text-[11px] font-semibold uppercase" style={{ color: "hsl(220 20% 18%)" }}>Dados do Responsável pelo Imóvel</div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={tp.nome} onChange={e => setTp(p => ({ ...p, nome: e.target.value.toUpperCase() }))} placeholder="Nome Completo" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800 uppercase" />
            <Input value={tp.cpf} onChange={e => setTp(p => ({ ...p, cpf: e.target.value.toUpperCase() }))} placeholder="CPF" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800 uppercase" />
            <Input value={tp.naturalidade} onChange={e => setTp(p => ({ ...p, naturalidade: e.target.value.toUpperCase() }))} placeholder="Naturalidade" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800 uppercase" />
            <Input value={tp.nascimento} onChange={e => setTp(p => ({ ...p, nascimento: e.target.value.toUpperCase() }))} placeholder="Data Nascimento" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800 uppercase" />
            <Input value={tp.profissao} onChange={e => setTp(p => ({ ...p, profissao: e.target.value.toUpperCase() }))} placeholder="Profissão" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800 uppercase" />
            <Input value={tp.estadoCivil} onChange={e => setTp(p => ({ ...p, estadoCivil: e.target.value.toUpperCase() }))} placeholder="Estado Civil" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800 uppercase" />
          </div>
          {TEMPLATES.find(t => t.key === showExtra)?.needsDates && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <Input value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} placeholder="Data Entrada (ex: 01/01/2020)" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800" />
              <Input value={dataSaida} onChange={e => setDataSaida(e.target.value)} placeholder="Data Saída (ex: 31/12/2023)" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800" />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => handleGenerate(showExtra)} disabled={generating === showExtra} className="qa-btn-primary h-8 px-4 text-xs flex items-center gap-1.5 no-glow">
              {generating === showExtra ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} Gerar DOCX
            </button>
            <button onClick={() => setShowExtra(null)} className="qa-btn-outline h-8 px-4 text-xs">Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {filteredTemplates.map(tpl => (
          <div key={tpl.key} className="qa-card qa-hover-lift p-3 flex items-center justify-between group">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold uppercase" style={{ color: "hsl(220 20% 18%)" }}>{tpl.label}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>{tpl.desc}</div>
            </div>
            <button
              disabled={!!generating}
              onClick={() => {
                if (tpl.needsThirdParty) {
                  setShowExtra(tpl.key);
                } else {
                  handleGenerate(tpl.key);
                }
              }}
              className="h-8 w-8 p-0 flex items-center justify-center shrink-0 ml-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-40"
              style={{ color: "hsl(220 10% 45%)" }}
            >
              {generating === tpl.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

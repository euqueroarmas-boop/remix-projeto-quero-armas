import { useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2, Upload, X } from "lucide-react";

// Modal de upload/troca de foto do cliente (portal).
// Valida: 5MB máx · JPG/PNG/WEBP. Recorta para quadrado 512×512 e envia em JPEG
// via edge function qa-cliente-foto-upload (service_role + auth check).

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const OUTPUT_SIZE = 512;

async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function cropToSquareJpeg(src: string, area: Area): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    area.x, area.y, area.width, area.height,
    0, 0, OUTPUT_SIZE, OUTPUT_SIZE,
  );
  return canvas.toDataURL("image/jpeg", 0.9);
}

export default function ClienteFotoUploadModal({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUploaded?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPx, setAreaPx] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAreaPx(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onOpenChange(false);
  };

  const handlePick = async (file: File | null) => {
    if (!file) return;
    if (!ALLOWED.includes(file.type.toLowerCase())) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo acima de 5MB.");
      return;
    }
    try {
      const url = await readFileAsDataURL(file);
      setImageSrc(url);
    } catch {
      toast.error("Não foi possível ler a imagem.");
    }
  };

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setAreaPx(pixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !areaPx) return;
    setBusy(true);
    try {
      const dataUrl = await cropToSquareJpeg(imageSrc, areaPx);
      const base64 = dataUrl.split(",", 2)[1];
      const { data, error } = await supabase.functions.invoke("qa-cliente-foto-upload", {
        body: { imageBase64: base64, contentType: "image/jpeg" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Foto atualizada");
      onUploaded?.();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      console.error("[ClienteFotoUploadModal] save:", e);
      toast.error("Falha ao enviar foto", { description: e?.message || "Tente novamente" });
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="relative w-full sm:max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#0A0A0A] max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={busy}
          aria-label="Fechar"
          className="absolute top-3 right-3 z-20 rounded-full bg-[#8A1224] p-2 text-white hover:bg-[#6f0f1e] transition-colors disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-6 pb-4 pr-14 shrink-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-[#8A1224]/20 bg-[#FFF7F8] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8A1224]">
              Meu perfil
            </span>
            <span className="inline-flex items-center rounded-full border border-[#E4E4E4] bg-[#FAFAFA] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
              JPG · PNG · WEBP até 5MB
            </span>
          </div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] leading-tight tracking-tight">Minha foto</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {!imageSrc ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-[#E4E4E4] hover:border-[#8A1224] rounded-xl p-8 flex flex-col items-center justify-center gap-2 text-[#6A6A6A] hover:text-[#8A1224] transition"
            >
              <Upload className="h-6 w-6" />
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em]">
                Escolher imagem
              </span>
              <span className="text-[10px] text-[#7A7A7A]">JPG, PNG ou WEBP · até 5MB</span>
            </button>
          ) : (
            <>
              <div className="relative w-full aspect-square bg-[#111] rounded-xl overflow-hidden">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <div className="mt-3">
                <label className="text-[10px] uppercase tracking-[0.18em] text-[#7A7A7A]">Zoom</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-[#8A1224]"
                  disabled={busy}
                />
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="mt-2 text-[10.5px] uppercase tracking-[0.18em] text-[#6A6A6A] hover:text-[#0A0A0A]"
              >
                Trocar imagem
              </button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              e.target.value = "";
              void handlePick(f);
            }}
          />
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-[#EEE] bg-white">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="px-3 h-9 rounded-lg text-[11px] uppercase tracking-[0.16em] font-semibold text-[#6A6A6A] hover:text-[#0A0A0A] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!imageSrc || !areaPx || busy}
            className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-[#7A1F2B] hover:bg-[#8E2532] text-white text-[11px] uppercase tracking-[0.16em] font-bold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            Salvar foto
          </button>
        </div>
      </div>
    </div>
  );
}
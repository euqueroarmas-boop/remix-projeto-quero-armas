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
      className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-[#0F0F0F] border border-[#2a2a2a] rounded-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden text-[#E8E8E8]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-[#D6A64B]" />
            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ fontFamily: "Oswald, sans-serif" }}>
              Minha Foto
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="h-7 w-7 inline-flex items-center justify-center rounded text-[#9a9a9a] hover:text-white hover:bg-[#1a1a1a] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {!imageSrc ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-[#2a2a2a] hover:border-[#D6A64B] rounded-lg p-8 flex flex-col items-center justify-center gap-2 text-[#9a9a9a] hover:text-white transition"
            >
              <Upload className="h-6 w-6" />
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em]">
                Escolher imagem
              </span>
              <span className="text-[10px] text-[#7A7A7A]">JPG, PNG ou WEBP · até 5MB</span>
            </button>
          ) : (
            <>
              <div className="relative w-full aspect-square bg-[#050505] rounded-lg overflow-hidden">
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
                  className="w-full accent-[#D6A64B]"
                  disabled={busy}
                />
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="mt-2 text-[10.5px] uppercase tracking-[0.18em] text-[#9a9a9a] hover:text-white"
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

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#1a1a1a]">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="px-3 h-9 rounded text-[11px] uppercase tracking-[0.16em] font-semibold text-[#9a9a9a] hover:text-white disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!imageSrc || !areaPx || busy}
            className="inline-flex items-center gap-2 px-4 h-9 rounded bg-[#7A1F2B] hover:bg-[#8E2532] text-white text-[11px] uppercase tracking-[0.16em] font-bold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            Salvar foto
          </button>
        </div>
      </div>
    </div>
  );
}
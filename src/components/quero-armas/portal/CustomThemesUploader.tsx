import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Check } from "lucide-react";
import {
  QA_CUSTOM_SLOTS,
  getCustomThemes,
  setCustomThemeSlot,
  customToTheme,
  type QACustomTheme,
  type QASidebarTheme,
} from "./sidebarThemes";



function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function CustomThemesUploader({
  currentKey,
  onApply,
}: {
  currentKey: string;
  onApply: (t: QASidebarTheme) => void;
}) {
  const [slots, setSlots] = useState<(QACustomTheme | null)[]>(() => getCustomThemes());
  const [err, setErr] = useState<string | null>(null);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const sync = () => setSlots(getCustomThemes());
    window.addEventListener("qa:sidebar-custom-change", sync);
    return () => window.removeEventListener("qa:sidebar-custom-change", sync);
  }, []);

  async function handleFile(slot: number, file: File | undefined) {
    setErr(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("ARQUIVO PRECISA SER UMA IMAGEM (PNG/JPG/WEBP)."); return; }
    if (file.size > MAX_BYTES) { setErr("IMAGEM MUITO GRANDE — LIMITE 2MB."); return; }
    try {
      const dataUrl = await fileToDataUrl(file);
      setCustomThemeSlot(slot, dataUrl);
    } catch {
      setErr("FALHA AO LER A IMAGEM.");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 p-4 bg-slate-50/60">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-wider text-slate-900">
            Suas Criações
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Envie suas próprias imagens (PNG/JPG/WEBP até 2MB) — elas viram fundo do menu lateral.
            Os retângulos em branco aguardam o seu upload.
          </p>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {slots.filter(Boolean).length}/{QA_CUSTOM_SLOTS} usados
        </div>
      </div>

      {err && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700">
          {err}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: QA_CUSTOM_SLOTS }).map((_, i) => {
          const c = slots[i];
          const active = currentKey === `custom-${i}`;
          return (
            <div key={i} className="relative">
              <input
                ref={(el) => (inputs.current[i] = el)}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  handleFile(i, e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (c) onApply(customToTheme(c));
                  else inputs.current[i]?.click();
                }}
                className={`relative aspect-[3/4] w-full overflow-hidden rounded-lg border-2 transition ${
                  active
                    ? "border-[#7A1F2B] ring-2 ring-[#7A1F2B]/30"
                    : c
                    ? "border-slate-300 hover:border-slate-500"
                    : "border-dashed border-slate-300 bg-white hover:border-slate-500 hover:bg-slate-50"
                }`}
                style={c ? { background: `url("${c.image}") center/cover no-repeat, #0A0A0A` } : undefined}
                aria-label={c ? `Aplicar ${c.label}` : `Enviar imagem para slot ${i + 1}`}
              >
                {!c && (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
                    <Upload className="h-5 w-5" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">
                      Enviar
                    </span>
                    <span className="text-[9px] uppercase tracking-wider">
                      Slot {i + 1}
                    </span>
                  </div>
                )}
                {c && active && (
                  <div className="absolute right-1 top-1 rounded-full bg-[#7A1F2B] p-0.5 text-white shadow">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
              {c && (
                <div className="mt-1 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => inputs.current[i]?.click()}
                    className="flex-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                  >
                    Trocar
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomThemeSlot(i, null)}
                    className="rounded border border-red-200 bg-white px-1.5 py-0.5 text-red-600 hover:bg-red-50"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
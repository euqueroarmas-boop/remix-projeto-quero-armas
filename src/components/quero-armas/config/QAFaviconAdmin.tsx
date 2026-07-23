import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  applyFaviconUrl,
  DEFAULT_QA_FAVICON,
  QA_FAVICON_BRANDING_KEY,
} from "@/lib/quero-armas/favicon";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function QAFaviconAdmin() {
  const [faviconUrl, setFaviconUrl] = useState(DEFAULT_QA_FAVICON);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("qa_branding" as any)
      .select("data_url")
      .eq("chave", QA_FAVICON_BRANDING_KEY)
      .maybeSingle();
    const url = ((data as any)?.data_url as string) || DEFAULT_QA_FAVICON;
    setFaviconUrl(url);
    applyFaviconUrl(url);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveFavicon = async (url: string, mimeType = "image/png") => {
    setSaving(true);
    try {
      const finalUrl = url.trim() || DEFAULT_QA_FAVICON;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("qa_branding" as any).upsert({
        chave: QA_FAVICON_BRANDING_KEY,
        data_url: finalUrl,
        mime_type: mimeType,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      }, { onConflict: "chave" });
      if (error) throw error;
      setFaviconUrl(finalUrl);
      applyFaviconUrl(finalUrl);
      toast.success("Favicon atualizado.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar favicon.");
    } finally {
      setSaving(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    const url = await fileToDataUrl(file);
    await saveFavicon(url, file.type);
  };

  const handleRemove = async () => {
    if (!confirm("Voltar para o favicon padrão do Arsenal Inteligente?")) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("qa_branding" as any)
        .delete()
        .eq("chave", QA_FAVICON_BRANDING_KEY);
      if (error) throw error;
      setFaviconUrl(DEFAULT_QA_FAVICON);
      applyFaviconUrl(DEFAULT_QA_FAVICON);
      toast.success("Favicon padrão restaurado.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao restaurar favicon.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="qa-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <ImageIcon className="h-4 w-4" style={{ color: "hsl(352 60% 30%)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>
          Favicon da página
        </span>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "hsl(220 10% 62%)" }}>
        Este ícone aparece na aba do navegador, inclusive nas páginas públicas de contrato e procuração. Use PNG, JPG, WEBP ou SVG quadrado.
      </p>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div
          className="h-24 w-24 rounded-xl border border-dashed flex items-center justify-center overflow-hidden shrink-0 bg-white"
          style={{ borderColor: "hsl(220 13% 85%)" }}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : (
            <img src={faviconUrl} alt="Prévia do favicon" className="h-14 w-14 object-contain" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <strong className="font-semibold text-slate-700">Tamanho recomendado:</strong>{" "}
            512 x 512 px. Também aceitamos 256 x 256, 128 x 128, 64 x 64 ou 32 x 32 px.
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
              className="h-9 px-3 rounded-lg bg-[#7A1F2B] hover:bg-[#641722] text-white text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Enviar favicon
            </button>
            <button
              type="button"
              onClick={() => saveFavicon(DEFAULT_QA_FAVICON)}
              disabled={saving}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Usar padrão
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar
            </button>
          </div>

          <p className="text-[10px] text-slate-400">
            A alteração é salva em Configurações e aplicada automaticamente quando a página abre.
          </p>
        </div>
      </div>
    </div>
  );
}

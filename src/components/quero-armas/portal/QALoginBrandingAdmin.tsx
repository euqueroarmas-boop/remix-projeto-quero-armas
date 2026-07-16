import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";

const CHAVE = "cliente_login_hero";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function QALoginBrandingAdmin() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("qa_branding" as any)
      .select("data_url")
      .eq("chave", CHAVE)
      .maybeSingle();
    setDataUrl(((data as any)?.data_url as string) || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem."); return; }
    setSaving(true);
    try {
      const url = await fileToDataUrl(file);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("qa_branding" as any).upsert({
        chave: CHAVE,
        data_url: url,
        mime_type: file.type,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      }, { onConflict: "chave" });
      if (error) throw error;
      setDataUrl(url);
      toast.success("Imagem publicada na tela de login do cliente.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao publicar imagem.");
    } finally {
      setSaving(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!confirm("Remover a imagem personalizada da tela de login?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("qa_branding" as any).delete().eq("chave", CHAVE);
      if (error) throw error;
      setDataUrl(null);
      toast.success("Imagem removida.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao remover.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="qa-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <ImageIcon className="h-4 w-4" style={{ color: "hsl(352 60% 30%)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>
          Tela de Login do Cliente · Imagem de destaque
        </span>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "hsl(220 10% 62%)" }}>
        Aparece na coluna esquerda da página <span className="font-semibold">/area-do-cliente</span>. Recomendado:
        formato horizontal (16:9 ou 4:3), até 800KB, PNG/JPG.
      </p>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div
          className="w-full md:w-72 aspect-video rounded-xl border border-dashed flex items-center justify-center overflow-hidden shrink-0"
          style={{ borderColor: "hsl(220 13% 85%)", background: "hsl(220 20% 97%)" }}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : dataUrl ? (
            <img src={dataUrl} alt="Prévia da imagem de login" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center text-[11px] text-slate-400 px-4">
              Nenhuma imagem publicada.<br />
              O layout padrão será exibido.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            type="button"
            onClick={handlePick}
            disabled={saving}
            className="h-9 px-3 rounded-lg bg-[#7A1F2B] hover:bg-[#641722] text-white text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-60 w-fit"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {dataUrl ? "Trocar imagem" : "Enviar imagem"}
          </button>
          {dataUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-red-600 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-60 w-fit"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover
            </button>
          )}
          <p className="text-[10px] text-slate-400 mt-1">
            A imagem substitui apenas o painel visual esquerdo — os elementos de acesso permanecem inalterados.
          </p>
        </div>
      </div>
    </div>
  );
}
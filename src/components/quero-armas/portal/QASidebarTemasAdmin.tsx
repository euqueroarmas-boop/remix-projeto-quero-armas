import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Star,
  StarOff,
  Upload,
  Image as ImageIcon,
  Save,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  dbRowToTheme,
  signHeroImagePath,
  type QASidebarTheme,
  type QASidebarThemeRow,
} from "./sidebarThemes";

type FormState = {
  id?: string;
  key: string;
  label: string;
  descricao: string;
  bg: string;
  accent: string;
  stripe: string;
  top_mode: "compact" | "hero";
  emblem: string;
  hero_image_path: string | null;
  ordem: number;
  ativo: boolean;
};

const EMPTY: FormState = {
  key: "",
  label: "",
  descricao: "",
  bg: "#0A0A0A",
  accent: "#D6A64B",
  stripe: "linear-gradient(90deg, #D6A64B 0%, #7A1F2B 100%)",
  top_mode: "hero",
  emblem: "",
  hero_image_path: null,
  ordem: 0,
  ativo: true,
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 80);

export default function QASidebarTemasAdmin() {
  const [rows, setRows] = useState<QASidebarThemeRow[]>([]);
  const [previews, setPreviews] = useState<Record<string, QASidebarTheme>>({});
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function reload() {
    setLoading(true);
    const { data, error } = await supabase
      .from("qa_sidebar_temas")
      .select("id,key,label,descricao,bg,accent,stripe,top_mode,hero_image_path,hero_image_url,emblem,ativo,is_global_default,ordem")
      .order("ordem", { ascending: true })
      .order("label", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Falha ao carregar temas: " + error.message);
      return;
    }
    const list = (data ?? []) as unknown as QASidebarThemeRow[];
    setRows(list);
    const prev: Record<string, QASidebarTheme> = {};
    const imgs: Record<string, string> = {};
    for (const r of list) {
      prev[r.id] = await dbRowToTheme(r);
      if (r.hero_image_path) {
        const signed = await signHeroImagePath(r.hero_image_path);
        if (signed) imgs[r.id] = signed;
      }
    }
    setPreviews(prev);
    setImageUrls(imgs);
  }

  useEffect(() => { void reload(); }, []);

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Arquivo precisa ser imagem (PNG/JPG/WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem acima de 5MB. Reduza antes de enviar.");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `temas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase
        .storage.from("qa-temas")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      setForm((f) => ({ ...f, hero_image_path: path, top_mode: "hero" }));
      toast.success("Imagem enviada.");
    } catch (e: any) {
      toast.error("Upload falhou: " + (e?.message ?? "erro"));
    } finally {
      setUploading(false);
    }
  }

  function openNew() {
    setForm({ ...EMPTY, ordem: rows.length });
    setShowForm(true);
  }

  function openEdit(r: QASidebarThemeRow) {
    setForm({
      id: r.id,
      key: r.key,
      label: r.label,
      descricao: r.descricao ?? "",
      bg: r.bg,
      accent: r.accent,
      stripe: r.stripe ?? "",
      top_mode: r.top_mode,
      emblem: r.emblem ?? "",
      hero_image_path: r.hero_image_path,
      ordem: r.ordem,
      ativo: r.ativo,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.label.trim()) { toast.error("Informe o label."); return; }
    const key = form.key.trim() || slugify(form.label);
    const payload = {
      key,
      label: form.label.trim(),
      descricao: form.descricao.trim() || null,
      bg: form.bg.trim() || "#0A0A0A",
      accent: form.accent.trim() || "#D6A64B",
      stripe: form.stripe.trim() || null,
      top_mode: form.top_mode,
      emblem: form.emblem.trim() || null,
      hero_image_path: form.hero_image_path,
      ordem: form.ordem,
      ativo: form.ativo,
    };
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase.from("qa_sidebar_temas").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Tema atualizado.");
      } else {
        const { error } = await supabase.from("qa_sidebar_temas").insert(payload);
        if (error) throw error;
        toast.success("Tema criado.");
      }
      setShowForm(false);
      setForm(EMPTY);
      await reload();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? "erro"));
    } finally {
      setSaving(false);
    }
  }

  async function setAsGlobal(r: QASidebarThemeRow) {
    const { error } = await supabase
      .from("qa_sidebar_temas")
      .update({ is_global_default: true })
      .eq("id", r.id);
    if (error) { toast.error("Falhou: " + error.message); return; }
    toast.success(`"${r.label}" agora é o tema padrão de todos os clientes.`);
    await reload();
  }

  async function toggleAtivo(r: QASidebarThemeRow) {
    const { error } = await supabase
      .from("qa_sidebar_temas")
      .update({ ativo: !r.ativo })
      .eq("id", r.id);
    if (error) { toast.error("Falhou: " + error.message); return; }
    await reload();
  }

  async function remove(r: QASidebarThemeRow) {
    if (!confirm(`Remover o tema "${r.label}"?`)) return;
    const { error } = await supabase.from("qa_sidebar_temas").delete().eq("id", r.id);
    if (error) { toast.error("Falhou: " + error.message); return; }
    if (r.hero_image_path) {
      await supabase.storage.from("qa-temas").remove([r.hero_image_path]).catch(() => {});
    }
    toast.success("Tema removido.");
    await reload();
  }

  const previewBg = (() => {
    // bg do form: se há imagem, monta overlay; caso contrário usa bg cru
    if (form.hero_image_path) {
      const url = imageUrls[form.id ?? ""] ?? null;
      const placeholder = url ?? "";
      if (placeholder) {
        return `linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 80px, rgba(0,0,0,0.55) 130px, rgba(0,0,0,0.55) 100%), url("${placeholder}") top center / cover no-repeat, ${form.bg}`;
      }
    }
    return form.bg;
  })();

  return (
    <div className="qa-card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" style={{ color: "hsl(352 60% 30%)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>
              Temas da Sidebar (Portal do Cliente)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Imagens vão para o bucket <code className="font-mono">qa-temas</code>. O tema marcado como global aparece para TODOS os clientes.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1 rounded-md bg-[#7A1F2B] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#5e1822]"
        >
          <Plus className="h-3.5 w-3.5" /> Novo tema
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 italic py-6 text-center">Nenhum tema cadastrado ainda. Crie o primeiro acima.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const p = previews[r.id];
            return (
              <div key={r.id} className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                <div
                  className="h-24 w-full"
                  style={{ background: p?.bg ?? r.bg }}
                  aria-label={`Preview ${r.label}`}
                />
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-slate-900 truncate">{r.label}</div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">{r.key}</div>
                    </div>
                    {r.is_global_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">
                        <Star className="h-2.5 w-2.5" /> Global
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                    >Editar</button>
                    {!r.is_global_default && (
                      <button
                        type="button"
                        onClick={() => setAsGlobal(r)}
                        className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 hover:bg-amber-100"
                      >Definir global</button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleAtivo(r)}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                    >
                      {r.ativo ? <><EyeOff className="h-3 w-3" /> Inativar</> : <><Eye className="h-3 w-3" /> Ativar</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" /> Excluir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-bold uppercase tracking-wider text-slate-900">
                {form.id ? "Editar tema" : "Novo tema"}
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div
                className="h-32 w-full rounded-lg border border-slate-200"
                style={{ background: previewBg }}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Label *</label>
                  <input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Key (slug)</label>
                  <input
                    value={form.key}
                    onChange={(e) => setForm({ ...form, key: e.target.value })}
                    placeholder="gera automático do label"
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Accent (#hex)</label>
                  <input
                    value={form.accent}
                    onChange={(e) => setForm({ ...form, accent: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Top mode</label>
                  <select
                    value={form.top_mode}
                    onChange={(e) => setForm({ ...form, top_mode: e.target.value as "compact" | "hero" })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="hero">hero (bloco grande no topo)</option>
                    <option value="compact">compact (menu colado)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Fundo (cor ou gradiente CSS)
                  </label>
                  <textarea
                    value={form.bg}
                    onChange={(e) => setForm({ ...form, bg: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Faixa decorativa (stripe gradient)
                  </label>
                  <input
                    value={form.stripe}
                    onChange={(e) => setForm({ ...form, stripe: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Emblema (emoji)</label>
                  <input
                    value={form.emblem}
                    onChange={(e) => setForm({ ...form, emblem: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Ordem</label>
                  <input
                    type="number"
                    value={form.ordem}
                    onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Imagem do topo (sobe para o bucket qa-temas)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {form.hero_image_path ? "Substituir imagem" : "Enviar imagem"}
                    </button>
                    {form.hero_image_path && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, hero_image_path: null })}
                        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-600 hover:bg-red-50"
                      >Remover</button>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {form.hero_image_path && (
                    <div className="mt-1 text-[10px] font-mono text-slate-500 truncate">{form.hero_image_path}</div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="inline-flex items-center gap-2 text-[12px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                    />
                    Ativo (aparece para os clientes)
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
              >Cancelar</button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md bg-[#7A1F2B] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#5e1822] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
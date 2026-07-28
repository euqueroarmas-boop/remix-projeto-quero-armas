import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Star,
  Upload,
  Image as ImageIcon,
  Save,
  X,
  Eye,
  EyeOff,
  LayoutDashboard,
  FileText,
  Shield,
  ClipboardList,
  Package,
  MessageCircle,
  LogOut,
} from "lucide-react";
import {
  dbRowToTheme,
  signHeroImagePath,
  setPersonalThemeKey,
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
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
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
      // Gera URL assinada para preview imediato
      const { data: signed } = await supabase.storage.from("qa-temas").createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signed?.signedUrl) setFormImageUrl(signed.signedUrl);
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
    setFormImageUrl(null);
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
    // Carrega URL da imagem existente para preview
    const existing = r.id ? imageUrls[r.id] ?? null : null;
    setFormImageUrl(existing);
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
    // 1) Desmarca qualquer outro global — evita ambiguidade em resolveEffectiveTheme.
    const { error: clearErr } = await supabase
      .from("qa_sidebar_temas")
      .update({ is_global_default: false })
      .eq("is_global_default", true)
      .neq("id", r.id);
    if (clearErr) { toast.error("Falhou: " + clearErr.message); return; }
    // 2) Marca o novo global.
    const { error } = await supabase
      .from("qa_sidebar_temas")
      .update({ is_global_default: true })
      .eq("id", r.id);
    if (error) { toast.error("Falhou: " + error.message); return; }
    // 3) Limpa a preferência pessoal do próprio admin — sem isso, o localStorage
    //    sobrescreveria o novo global e o admin não veria a mudança aplicada.
    setPersonalThemeKey(null);
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

      {showForm && (() => {
        // Preview da sidebar em tempo real
        const previewImageUrl = formImageUrl;
        const sidebarBg = previewImageUrl
          ? `linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 80px, rgba(0,0,0,0.6) 140px, rgba(0,0,0,0.6) 100%), url("${previewImageUrl}") top center / cover no-repeat, ${form.bg}`
          : form.bg;
        const accentColor = form.accent || "#D6A64B";
        const navItems = [
          { Icon: LayoutDashboard, label: "Resumo", active: true },
          { Icon: Package, label: "Arsenal", active: false },
          { Icon: ClipboardList, label: "Processos", active: false },
          { Icon: FileText, label: "Documentos", active: false },
          { Icon: Shield, label: "Exames", active: false },
        ];
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-auto">
            <div className="w-full max-w-5xl rounded-xl bg-white shadow-2xl my-8 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                <div className="text-sm font-black uppercase tracking-wider text-slate-900">
                  {form.id ? "Editar tema" : "Novo tema"}
                </div>
                <button type="button" onClick={() => setShowForm(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body — 2 colunas */}
              <div className="flex flex-1 min-h-0">
                {/* Coluna esquerda: formulário */}
                <div className="flex-1 p-5 overflow-y-auto border-r border-slate-100">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Label *</label>
                      <input
                        value={form.label}
                        onChange={(e) => setForm({ ...form, label: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        placeholder="Nome do tema"
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
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={form.accent}
                          onChange={(e) => setForm({ ...form, accent: e.target.value })}
                          className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          value={form.accent}
                          onChange={(e) => setForm({ ...form, accent: e.target.value })}
                          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono"
                        />
                      </div>
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
                      <div className="flex items-start gap-1.5">
                        <input
                          type="color"
                          value={form.bg.startsWith("#") ? form.bg : "#0A0A0A"}
                          onChange={(e) => setForm({ ...form, bg: e.target.value })}
                          className="w-8 h-8 rounded border border-slate-300 cursor-pointer mt-0.5 shrink-0"
                        />
                        <textarea
                          value={form.bg}
                          onChange={(e) => setForm({ ...form, bg: e.target.value })}
                          rows={2}
                          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-mono"
                        />
                      </div>
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
                        placeholder="🎯"
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
                        Imagem do topo <span className="text-slate-400 font-normal normal-case">(sobe para o bucket qa-temas — 190×1080 px recomendado)</span>
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
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
                            onClick={() => { setForm({ ...form, hero_image_path: null }); setFormImageUrl(null); }}
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
                      <label className="inline-flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
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

                {/* Coluna direita: preview fiel da sidebar */}
                <div className="w-[220px] shrink-0 flex flex-col bg-slate-100">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Preview — sidebar esquerda (190 px)</span>
                  </div>
                  <div className="flex-1 flex items-stretch justify-center p-3">
                    {/* Mini-sidebar fiel: 190px wide, escala para caber */}
                    <div
                      className="relative rounded-lg overflow-hidden shadow-xl"
                      style={{
                        width: 190,
                        minHeight: 420,
                        background: sidebarBg,
                        backgroundSize: "cover",
                        backgroundPosition: "top center",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {/* Hero block */}
                      {form.top_mode === "hero" && (
                        <div
                          className="w-full shrink-0"
                          style={{
                            height: 100,
                            background: previewImageUrl
                              ? `linear-gradient(transparent 40%, rgba(0,0,0,0.85)), url("${previewImageUrl}") top center / cover no-repeat`
                              : "transparent",
                          }}
                        >
                          {!previewImageUrl && form.emblem && (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                              <span style={{ fontSize: 36 }}>{form.emblem}</span>
                            </div>
                          )}
                          {!previewImageUrl && !form.emblem && (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-30">
                              <ImageIcon className="h-6 w-6 text-white" />
                              <span className="text-[9px] text-white font-bold tracking-wider">SEM IMAGEM</span>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Nav items */}
                      <div className="flex-1 flex flex-col py-2 gap-0.5">
                        {navItems.map(({ Icon, label, active }) => (
                          <div
                            key={label}
                            className="flex items-center gap-2 px-3 py-1.5 mx-2 rounded"
                            style={active
                              ? { background: `${accentColor}33`, borderLeft: `2px solid ${accentColor}` }
                              : { borderLeft: "2px solid transparent" }
                            }
                          >
                            <Icon
                              style={{ width: 13, height: 13, color: active ? accentColor : "#9a9a9a", flexShrink: 0 }}
                            />
                            <span
                              className="text-[10px] font-semibold truncate"
                              style={{ color: active ? "#ffffff" : "#c9c2b3" }}
                            >
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* Footer */}
                      <div className="mx-3 mb-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                        <div className="text-[9px] text-white font-bold mb-1 opacity-80">Precisa de ajuda?</div>
                        <div
                          className="flex items-center gap-1 rounded px-2 py-1 mb-1"
                          style={{ background: "#1CC355" }}
                        >
                          <MessageCircle style={{ width: 10, height: 10, color: "#fff" }} />
                          <span className="text-[9px] text-white font-bold">+55 11 97848-1919</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-60">
                          <LogOut style={{ width: 10, height: 10, color: "#C8C8C8" }} />
                          <span className="text-[9px] text-[#C8C8C8] font-bold">Sair</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Legenda */}
                  <div className="px-3 pb-3 text-center">
                    <span className="text-[9px] text-slate-400">Atualiza em tempo real conforme você edita os campos</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                >Cancelar</button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-md bg-[#7A1F2B] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#5e1822] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar tema
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
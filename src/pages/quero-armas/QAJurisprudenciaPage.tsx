import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Gavel, CheckCircle, Loader2, Upload, FileText, Link as LinkIcon } from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";

type TabMode = "manual" | "arquivo" | "link";

export default function QAJurisprudenciaPage() {
  const { profile } = useQAAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tabMode, setTabMode] = useState<TabMode>("manual");
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [progressMsg, setProgressMsg] = useState("");
  const [form, setForm] = useState({
    tribunal: "", numero_processo: "", relator: "", orgao_julgador: "",
    data_julgamento: "", tema: "", ementa_resumida: "", tese_aplicavel: "",
    texto_controlado: "", palavras_chave: "",
  });

  const canEdit = profile?.perfil && ["administrador", "advogado", "assistente_juridico"].includes(profile.perfil);

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase.from("qa_jurisprudencias" as any).select("*").order("created_at", { ascending: false });
      if (busca) q = q.or(`tribunal.ilike.%${busca}%,numero_processo.ilike.%${busca}%,tema.ilike.%${busca}%,tese_aplicavel.ilike.%${busca}%`);
      const { data } = await q;
      setItems((data as any[]) ?? []);
    } catch (err) {
      console.error("[QAJurisprudencia] load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [busca]);

  const resetForm = () => {
    setForm({ tribunal: "", numero_processo: "", relator: "", orgao_julgador: "", data_julgamento: "", tema: "", ementa_resumida: "", tese_aplicavel: "", texto_controlado: "", palavras_chave: "" });
    setFile(null);
    setLinkUrl("");
    setTabMode("manual");
    setProgressMsg("");
  };

  const handleSaveManual = async () => {
    if (!form.tribunal || !form.ementa_resumida) { toast.error("Tribunal e ementa são obrigatórios"); return; }
    setSaving(true);
    const { error } = await supabase.from("qa_jurisprudencias" as any).insert({
      ...form,
      data_julgamento: form.data_julgamento || null,
      palavras_chave: form.palavras_chave ? form.palavras_chave.split(",").map(s => s.trim()) : [],
      origem: "cadastro_manual",
      validada_humanamente: false,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Jurisprudência cadastrada");
    setOpen(false);
    resetForm();
    load();
  };

  const handleSaveFile = async () => {
    if (!file) { toast.error("Selecione um arquivo"); return; }
    setSaving(true);
    try {
      const ts = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `jurisprudencias/${ts}_${safeName}`;

      setProgressMsg("Enviando arquivo...");
      const { error: upErr } = await supabase.storage.from("qa-documentos").upload(path, file);
      if (upErr) throw upErr;

      const isDocx = file.name.toLowerCase().endsWith(".docx") || file.name.toLowerCase().endsWith(".doc");

      if (isDocx) {
        // Process DOCX with AI extraction
        setProgressMsg("Extraindo jurisprudências com IA... (pode levar até 60s)");

        const palavrasArr = form.palavras_chave ? form.palavras_chave.split(",").map(s => s.trim()) : [];

        const { data: fnData, error: fnErr } = await supabase.functions.invoke(
          "qa-processar-jurisprudencias-docx",
          {
            body: {
              storage_path: path,
              tribunal: form.tribunal || null,
              tema: form.tema || null,
              categoria_tematica: null,
              palavras_chave: palavrasArr,
            },
          }
        );

        if (fnErr) throw new Error(fnErr.message || "Erro ao processar documento");

        if (fnData?.error) throw new Error(fnData.error);

        toast.success(`${fnData.salvas} jurisprudência(s) extraída(s) e salva(s)!`);
      } else {
        // Non-DOCX: save as single entry
        const { error } = await supabase.from("qa_jurisprudencias" as any).insert({
          tribunal: form.tribunal || "A classificar",
          ementa_resumida: `Documento enviado: ${file.name}`,
          origem: "upload_arquivo",
          arquivo_url: path,
          validada_humanamente: false,
          tema: form.tema || null,
          palavras_chave: form.palavras_chave ? form.palavras_chave.split(",").map(s => s.trim()) : [],
        });
        if (error) throw error;
        toast.success("Arquivo enviado com sucesso");
      }

      setOpen(false);
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar arquivo");
    }
    setSaving(false);
    setProgressMsg("");
  };

  const handleSaveLink = async () => {
    if (!linkUrl.trim()) { toast.error("Informe a URL"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("qa_jurisprudencias" as any).insert({
        tribunal: form.tribunal || "A classificar",
        ementa_resumida: `Link importado: ${linkUrl}`,
        origem: "importacao_link",
        link_fonte: linkUrl.trim(),
        validada_humanamente: false,
        tema: form.tema || null,
        palavras_chave: form.palavras_chave ? form.palavras_chave.split(",").map(s => s.trim()) : [],
      });
      if (error) throw error;
      toast.success("Link registrado com sucesso");
      setOpen(false);
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar link");
    }
    setSaving(false);
  };

  const handleSave = () => {
    if (tabMode === "manual") handleSaveManual();
    else if (tabMode === "arquivo") handleSaveFile();
    else handleSaveLink();
  };

  const f = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const tabClass = (t: TabMode) =>
    `flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${tabMode === t
      ? "bg-[#2563eb] text-white shadow"
      : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
    }`;

  return (
    <div className="space-y-5 md:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#1e293b]">
            Jurisprudência
          </h1>
          <p className="text-sm mt-0.5 text-[#94a3b8]">Precedentes e decisões validadas</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={(v) => { if (!saving) { setOpen(v); if (!v) resetForm(); } }}>
            <DialogTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.97]"
                style={{ background: "#2563eb", color: "#ffffff" }}
              >
                <Plus className="h-3.5 w-3.5" /> Nova Jurisprudência
              </button>
            </DialogTrigger>
            <DialogContent className="bg-white border-slate-200 text-slate-800 max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold text-[#1e293b]">Cadastrar Jurisprudência</DialogTitle>
              </DialogHeader>

              {/* Tabs */}
              <div className="flex gap-1.5 mt-3 p-1 bg-[#f8fafc] rounded-xl">
                <button className={tabClass("manual")} onClick={() => setTabMode("manual")} disabled={saving}>
                  <FileText className="h-3 w-3 inline mr-1" />Digitação
                </button>
                <button className={tabClass("arquivo")} onClick={() => setTabMode("arquivo")} disabled={saving}>
                  <Upload className="h-3 w-3 inline mr-1" />Arquivo
                </button>
                <button className={tabClass("link")} onClick={() => setTabMode("link")} disabled={saving}>
                  <LinkIcon className="h-3 w-3 inline mr-1" />Link
                </button>
              </div>

              <div className="space-y-4 mt-4">
                {/* Common: Tribunal + Tema */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-[#64748b]">Tribunal</Label>
                    <Input value={form.tribunal} onChange={e => f("tribunal", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800 uppercase" placeholder="STF, STJ, TRF1..." disabled={saving} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-[#64748b]">Tema</Label>
                    <Input value={form.tema} onChange={e => f("tema", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800 uppercase" placeholder="Posse de arma..." disabled={saving} />
                  </div>
                </div>

                {/* Tab: Manual */}
                {tabMode === "manual" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-[#64748b]">Nº Processo</Label>
                        <Input value={form.numero_processo} onChange={e => f("numero_processo", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800 uppercase" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-[#64748b]">Data Julgamento</Label>
                        <Input placeholder="DD/MM/AAAA" value={form.data_julgamento} onChange={e => f("data_julgamento", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-[#64748b]">Relator</Label>
                        <Input value={form.relator} onChange={e => f("relator", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800 uppercase" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-[#64748b]">Órgão Julgador</Label>
                        <Input value={form.orgao_julgador} onChange={e => f("orgao_julgador", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800 uppercase" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-[#64748b]">Ementa Resumida *</Label>
                      <Textarea value={form.ementa_resumida} onChange={e => f("ementa_resumida", e.target.value)} className="bg-white border-slate-200 text-slate-800 min-h-[80px] uppercase" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-[#64748b]">Tese Aplicável</Label>
                      <Textarea value={form.tese_aplicavel} onChange={e => f("tese_aplicavel", e.target.value)} className="bg-white border-slate-200 text-slate-800 min-h-[60px] uppercase" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-[#64748b]">Texto Controlado</Label>
                      <Textarea value={form.texto_controlado} onChange={e => f("texto_controlado", e.target.value)} className="bg-white border-slate-200 text-slate-800 min-h-[80px] uppercase" />
                    </div>
                  </>
                )}

                {/* Tab: Arquivo */}
                {tabMode === "arquivo" && (
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-[#cbd5e1] rounded-xl p-6 text-center hover:border-[#2563eb] transition-colors">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-[#94a3b8]" />
                      <p className="text-xs text-[#64748b] mb-1">PDF, DOCX ou imagem (até 20MB)</p>
                      <p className="text-[10px] text-[#2563eb] font-medium mb-3">
                        📄 Arquivos DOCX com múltiplas decisões serão extraídos automaticamente pela IA
                      </p>
                      <label className="inline-block cursor-pointer px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors">
                        Selecionar Arquivo
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                          onChange={e => setFile(e.target.files?.[0] || null)}
                          disabled={saving}
                        />
                      </label>
                      {file && (
                        <p className="mt-3 text-xs text-[#1e293b] font-medium bg-[#f1f5f9] rounded-lg p-2">
                          📎 {file.name}
                        </p>
                      )}
                    </div>
                    {progressMsg && (
                      <div className="flex items-center gap-2 p-3 bg-[#eff6ff] rounded-lg">
                        <Loader2 className="h-4 w-4 animate-spin text-[#2563eb]" />
                        <span className="text-xs text-[#1e293b] font-medium">{progressMsg}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Link */}
                {tabMode === "link" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-[#64748b]">URL da Jurisprudência</Label>
                      <Input
                        value={linkUrl}
                        onChange={e => setLinkUrl(e.target.value)}
                        className="h-10 bg-white border-slate-200 text-slate-800"
                        placeholder="https://www.stf.jus.br/..."
                        disabled={saving}
                      />
                    </div>
                    <p className="text-[10px] text-[#94a3b8]">Cole o link direto do tribunal ou repositório de jurisprudência.</p>
                  </div>
                )}

                {/* Palavras-chave (all tabs) */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-[#64748b]">Palavras-chave (vírgula)</Label>
                  <Input value={form.palavras_chave} onChange={e => f("palavras_chave", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800 uppercase" placeholder="arma, posse, defesa..." disabled={saving} />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => { if (!saving) setOpen(false); }} className="h-9 px-4 text-xs font-medium rounded-lg border border-[#e2e8f0] text-[#64748b] bg-white hover:bg-[#f8fafc] transition-colors" disabled={saving}>
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-9 px-5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow hover:shadow-md active:scale-[0.97] disabled:opacity-60"
                    style={{ background: "#2563eb", color: "#ffffff" }}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {tabMode === "manual" ? "Salvar" : tabMode === "arquivo" ? "Enviar Arquivo" : "Registrar Link"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
        <input
          placeholder="Buscar por tribunal, processo, tema..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-xl border bg-white text-sm uppercase outline-none transition-all focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
          style={{ borderColor: "#e2e8f0", color: "#1e293b" }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-[#2563eb] rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Gavel className="h-12 w-12 mx-auto mb-3 text-[#cbd5e1]" />
          <p className="text-sm text-[#94a3b8]">Nenhuma jurisprudência cadastrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((j: any) => (
            <div key={j.id} className="qa-card qa-hover-lift p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[13px] flex-wrap">
                    <span className="font-semibold uppercase text-[#2563eb]">{j.tribunal}</span>
                    {j.numero_processo && <span className="uppercase text-[#64748b]">• {j.numero_processo}</span>}
                    {j.origem === "upload_docx_ia" && <span className="text-[10px] px-1.5 py-0.5 bg-[#f0fdf4] text-[#15803d] rounded font-medium">🤖 IA</span>}
                    {j.origem === "upload_arquivo" && <span className="text-[10px] px-1.5 py-0.5 bg-[#eff6ff] text-[#2563eb] rounded font-medium">📎 Arquivo</span>}
                    {j.origem === "importacao_link" && <span className="text-[10px] px-1.5 py-0.5 bg-[#fef3c7] text-[#92400e] rounded font-medium">🔗 Link</span>}
                  </div>
                  {j.tema && <div className="text-xs mt-0.5 uppercase text-[#94a3b8]">{j.tema}</div>}
                  {j.ementa_resumida && <p className="text-xs mt-2 line-clamp-3 uppercase text-[#64748b]">{j.ementa_resumida}</p>}
                  {j.tese_aplicavel && <p className="text-xs text-emerald-600 mt-1 line-clamp-2 italic uppercase">Tese: {j.tese_aplicavel}</p>}
                </div>
                {j.validada_humanamente && <span title="Validada"><CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" /></span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

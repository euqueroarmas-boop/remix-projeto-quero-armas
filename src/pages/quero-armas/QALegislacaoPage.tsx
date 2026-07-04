import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Scale, CheckCircle, Loader2, Paperclip, FileText, Upload } from "lucide-react";
import { useQAAuthContext } from "@/components/quero-armas/QAAuthContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const TIPOS_NORMA = ["lei", "decreto", "instrucao_normativa", "portaria", "resolucao", "nota_tecnica", "outro"];

const TIPO_NORMA_TO_TIPO_DOC: Record<string, string> = {
  lei: "lei",
  decreto: "decreto",
  instrucao_normativa: "instrucao_normativa",
  portaria: "portaria",
  resolucao: "outro",
  nota_tecnica: "outro",
  outro: "outro",
};

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export default function QALegislacaoPage() {
  const { profile } = useQAAuthContext();
  const [normas, setNormas] = useState<any[]>([]);
  const [pdfCounts, setPdfCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNorma, setSavedNorma] = useState<{ id: string; titulo: string } | null>(null);
  const [uploadingPdfs, setUploadingPdfs] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  const [form, setForm] = useState({
    titulo_norma: "", tipo_norma: "lei", numero_norma: "", ano_norma: "",
    orgao_emissor: "", ementa: "", texto_integral: "", palavras_chave: "",
  });

  const canEdit = profile?.perfil && ["administrador", "advogado", "assistente_juridico"].includes(profile.perfil);

  const debouncedBusca = useDebouncedValue(busca, 400);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const loadNormas = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from("qa_fontes_normativas" as any).select("*").eq("ativa", true).order("created_at", { ascending: false });
      if (debouncedBusca) q = q.or(`titulo_norma.ilike.%${debouncedBusca}%,numero_norma.ilike.%${debouncedBusca}%,ementa.ilike.%${debouncedBusca}%`);
      const { data } = await q;
      const rows = (data as any[]) ?? [];
      if (mountedRef.current) setNormas(rows);
      const ids = rows.map((n: any) => n.id).filter(Boolean);
      if (ids.length > 0) {
        const { data: docs } = await supabase
          .from("qa_documentos_conhecimento" as any)
          .select("fonte_normativa_id")
          .in("fonte_normativa_id", ids)
          .eq("ativo", true);
        const counts: Record<string, number> = {};
        ((docs as any[]) ?? []).forEach((d: any) => {
          if (d.fonte_normativa_id) counts[d.fonte_normativa_id] = (counts[d.fonte_normativa_id] ?? 0) + 1;
        });
        if (mountedRef.current) setPdfCounts(counts);
      } else if (mountedRef.current) {
        setPdfCounts({});
      }
    } catch (err) {
      console.error("[QALegislacao] loadNormas error:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [debouncedBusca]);

  useEffect(() => { loadNormas(); }, [loadNormas]);

  const resetDialog = () => {
    setOpen(false);
    setSavedNorma(null);
    setPdfProgress(null);
    setForm({ titulo_norma: "", tipo_norma: "lei", numero_norma: "", ano_norma: "", orgao_emissor: "", ementa: "", texto_integral: "", palavras_chave: "" });
  };

  const handleSave = async () => {
    if (!form.titulo_norma) { toast.error("Título é obrigatório"); return; }
    setSaving(true);
    const numero = form.numero_norma?.trim() || null;
    const ano = form.ano_norma ? parseInt(form.ano_norma) : null;

    // Validação amigável: bloqueia duplicata antes de tentar inserir
    if (numero && ano) {
      const { data: existente } = await supabase
        .from("qa_fontes_normativas" as any)
        .select("id,titulo_norma")
        .eq("tipo_norma", form.tipo_norma)
        .eq("numero_norma", numero)
        .eq("ano_norma", ano)
        .maybeSingle();
      if (existente) {
        setSaving(false);
        toast.error(`Esta norma já está cadastrada: ${(existente as any).titulo_norma}`);
        return;
      }
    }

    const { data: inserted, error } = await supabase.from("qa_fontes_normativas" as any).insert({
      titulo_norma: form.titulo_norma,
      tipo_norma: form.tipo_norma,
      numero_norma: numero,
      ano_norma: ano,
      orgao_emissor: form.orgao_emissor || null,
      ementa: form.ementa || null,
      texto_integral: form.texto_integral || null,
      palavras_chave: form.palavras_chave ? form.palavras_chave.split(",").map(s => s.trim()) : [],
      origem: "cadastro_manual",
    }).select("id, titulo_norma, tipo_norma").single();
    setSaving(false);
    if (error) {
      if ((error as any).code === "23505") {
        toast.error("Esta norma (tipo + número + ano) já está cadastrada.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Norma cadastrada");
    // Ao invés de fechar, entra no modo "anexar PDF oficial"
    if (inserted) {
      setSavedNorma({ id: (inserted as any).id, titulo: (inserted as any).titulo_norma });
    } else {
      resetDialog();
    }
    loadNormas();
  };

  const handleAttachPdfs = async (files: FileList | null) => {
    if (!files || files.length === 0 || !savedNorma) return;
    setUploadingPdfs(true);
    setPdfProgress({ done: 0, total: files.length });
    const tipoDoc = TIPO_NORMA_TO_TIPO_DOC[form.tipo_norma] ?? "outro";
    let ok = 0;
    let fail = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const safeName = sanitizeFileName(file.name || `documento_${i + 1}.pdf`);
        const path = `normas/${savedNorma.id}/${Date.now()}_${i}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("qa-documentos")
          .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
        if (upErr) throw upErr;

        const titulo = files.length > 1
          ? `${savedNorma.titulo} — ${file.name}`
          : savedNorma.titulo;

        const { error: insErr } = await supabase.from("qa_documentos_conhecimento" as any).insert({
          titulo,
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type || "application/pdf",
          tamanho_bytes: file.size,
          enviado_por: profile?.id || null,
          tipo_documento: tipoDoc,
          tipo_origem: "arquivo_upload",
          papel_documento: "aprendizado",
          fonte_normativa_id: savedNorma.id,
          visivel_cliente: true,
          ativo_na_ia: true,
          status_validacao: "validado",
          status_processamento: "pendente",
        } as any);
        if (insErr) throw insErr;

        // Dispara o processamento (não bloqueia)
        supabase.functions.invoke("qa-ingest-document", {
          body: { storage_path: path, user_id: profile?.id || null },
        }).catch((e) => console.warn("qa-ingest-document invoke:", e));

        ok++;
      } catch (e: any) {
        console.error("[QALegislacao] attach pdf error:", e);
        fail++;
      } finally {
        setPdfProgress({ done: i + 1, total: files.length });
      }
    }

    setUploadingPdfs(false);
    if (ok > 0) toast.success(`${ok} PDF${ok > 1 ? "s" : ""} anexado${ok > 1 ? "s" : ""} — processamento iniciado.`);
    if (fail > 0) toast.error(`${fail} arquivo${fail > 1 ? "s" : ""} falhou.`);
    if (fail === 0) {
      resetDialog();
      loadNormas();
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
            Legislação
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Base normativa controlada</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <button className="qa-btn-primary flex items-center gap-1.5 no-glow">
                <Plus className="h-3.5 w-3.5" /> Nova Norma
              </button>
            </DialogTrigger>
            <DialogContent className="bg-white border-slate-200 text-slate-800 max-w-2xl max-h-[90dvh] overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))] rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>
                  {savedNorma ? "Anexar PDF oficial" : "Cadastrar Norma"}
                </DialogTitle>
              </DialogHeader>
              {!savedNorma ? (
              <div className="space-y-4 mt-4 uppercase">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Título *</Label>
                    <Input value={form.titulo_norma} onChange={e => setForm(f => ({ ...f, titulo_norma: e.target.value }))}
                      className="h-9 bg-white border-slate-200 text-slate-800 uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Tipo</Label>
                    <Select value={form.tipo_norma} onValueChange={v => setForm(f => ({ ...f, tipo_norma: v }))}>
                      <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-700"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_NORMA.map(t => <SelectItem key={t} value={t} className="uppercase">{t.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Número</Label>
                    <Input value={form.numero_norma} onChange={e => setForm(f => ({ ...f, numero_norma: e.target.value }))}
                      className="h-9 bg-white border-slate-200 text-slate-800 uppercase" placeholder="10.826" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Ano</Label>
                    <Input type="number" value={form.ano_norma} onChange={e => setForm(f => ({ ...f, ano_norma: e.target.value }))}
                      className="h-9 bg-white border-slate-200 text-slate-800" placeholder="2003" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Órgão Emissor</Label>
                    <Input value={form.orgao_emissor} onChange={e => setForm(f => ({ ...f, orgao_emissor: e.target.value }))}
                      className="h-9 bg-white border-slate-200 text-slate-800 uppercase" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Ementa</Label>
                  <Textarea value={form.ementa} onChange={e => setForm(f => ({ ...f, ementa: e.target.value }))}
                    className="bg-white border-slate-200 text-slate-800 min-h-[80px] uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Texto Integral</Label>
                  <Textarea value={form.texto_integral} onChange={e => setForm(f => ({ ...f, texto_integral: e.target.value }))}
                    className="bg-white border-slate-200 text-slate-800 min-h-[120px] uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Palavras-chave (separadas por vírgula)</Label>
                  <Input value={form.palavras_chave} onChange={e => setForm(f => ({ ...f, palavras_chave: e.target.value }))}
                    className="h-9 bg-white border-slate-200 text-slate-800 uppercase" placeholder="armas, posse, CAC" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={resetDialog} className="qa-btn-outline h-9 px-4 text-xs">Cancelar</button>
                  <button onClick={handleSave} disabled={saving} className="qa-btn-primary h-9 px-4 text-xs flex items-center gap-1.5 no-glow">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Salvar Norma
                  </button>
                </div>
              </div>
              ) : (
                <div className="space-y-4 mt-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <Paperclip className="h-4 w-4 text-[#7A1F2B] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800 uppercase truncate">{savedNorma.titulo}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          Envie o PDF oficial para a IA poder <strong>citar e buscar trechos</strong> desta norma.
                          Anexos da norma (formulários oficiais) podem ser enviados como arquivos separados.
                        </p>
                      </div>
                    </div>
                  </div>
                  <label className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-white hover:border-[#7A1F2B] hover:bg-slate-50 transition-colors p-6 text-center">
                    <Upload className="h-6 w-6 mx-auto text-slate-400 mb-2" />
                    <p className="text-xs text-slate-700 font-medium">Selecionar PDF(s)</p>
                    <p className="text-[11px] text-slate-500 mt-1">PDF, DOCX ou imagens • múltiplos arquivos permitidos</p>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                      className="hidden"
                      disabled={uploadingPdfs}
                      onChange={(e) => handleAttachPdfs(e.target.files)}
                    />
                  </label>
                  {pdfProgress && (
                    <div className="text-xs text-slate-600 text-center">
                      {uploadingPdfs ? (
                        <span className="inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Enviando {pdfProgress.done}/{pdfProgress.total}…</span>
                      ) : (
                        <span>{pdfProgress.done}/{pdfProgress.total} processados</span>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={resetDialog} disabled={uploadingPdfs} className="qa-btn-outline h-9 px-4 text-xs">
                      Pular por agora
                    </button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "hsl(220 10% 55%)" }} />
        <input
          placeholder="Buscar por título, número ou ementa..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-xl border bg-white text-sm uppercase outline-none transition-all"
          style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 20% 18%)" }}
          onFocus={e => e.currentTarget.style.borderColor = "hsl(352 60% 30%)"}
          onBlur={e => e.currentTarget.style.borderColor = "hsl(220 13% 91%)"}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-[#7A1F2B] rounded-full animate-spin" />
        </div>
      ) : normas.length === 0 ? (
        <div className="text-center py-16">
          <Scale className="h-12 w-12 mx-auto mb-3" style={{ color: "hsl(220 13% 85%)" }} />
          <p className="text-sm" style={{ color: "hsl(220 10% 55%)" }}>Nenhuma norma cadastrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {normas.map((n: any) => {
            const count = pdfCounts[n.id] ?? 0;
            return (
            <div key={n.id} className="qa-card qa-hover-lift p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold uppercase" style={{ color: "hsl(220 20% 18%)" }}>{n.titulo_norma}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="qa-badge text-[10px] uppercase">{n.tipo_norma?.replace(/_/g, " ")}</span>
                    {n.numero_norma && <span className="text-xs uppercase" style={{ color: "hsl(220 10% 55%)" }}>Nº {n.numero_norma}</span>}
                    {n.ano_norma && <span className="text-xs" style={{ color: "hsl(220 10% 55%)" }}>({n.ano_norma})</span>}
                    {n.orgao_emissor && <span className="text-xs uppercase" style={{ color: "hsl(220 10% 55%)" }}>• {n.orgao_emissor}</span>}
                    {count > 0 && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: "hsl(352 60% 96%)", color: "hsl(352 60% 30%)" }}
                        title="A IA usa o PDF anexado; o texto colado é apenas referência."
                      >
                        <FileText className="h-3 w-3" /> {count} PDF{count > 1 ? "s" : ""} anexado{count > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {n.ementa && <p className="text-xs mt-2 line-clamp-2 uppercase" style={{ color: "hsl(220 10% 45%)" }}>{n.ementa}</p>}
                  {count > 0 && (
                    <p className="text-[10px] mt-1.5 italic" style={{ color: "hsl(220 10% 55%)" }}>
                      A IA usa o PDF anexado; o texto colado manualmente é apenas referência.
                    </p>
                  )}
                </div>
                {n.revisada_humanamente && <span title="Revisada"><CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" /></span>}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

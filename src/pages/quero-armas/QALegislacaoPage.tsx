import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Scale, CheckCircle, Loader2 } from "lucide-react";
import { useQAAuthContext } from "@/components/quero-armas/QAAuthContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const TIPOS_NORMA = ["lei", "decreto", "instrucao_normativa", "portaria", "resolucao", "nota_tecnica", "outro"];

export default function QALegislacaoPage() {
  const { profile } = useQAAuthContext();
  const [normas, setNormas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
      if (mountedRef.current) setNormas((data as any[]) ?? []);
    } catch (err) {
      console.error("[QALegislacao] loadNormas error:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [debouncedBusca]);

  useEffect(() => { loadNormas(); }, [loadNormas]);

  const handleSave = async () => {
    if (!form.titulo_norma) { toast.error("Título é obrigatório"); return; }
    setSaving(true);
    const { error } = await supabase.from("qa_fontes_normativas" as any).insert({
      titulo_norma: form.titulo_norma,
      tipo_norma: form.tipo_norma,
      numero_norma: form.numero_norma || null,
      ano_norma: form.ano_norma ? parseInt(form.ano_norma) : null,
      orgao_emissor: form.orgao_emissor || null,
      ementa: form.ementa || null,
      texto_integral: form.texto_integral || null,
      palavras_chave: form.palavras_chave ? form.palavras_chave.split(",").map(s => s.trim()) : [],
      origem: "cadastro_manual",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Norma cadastrada");
    setOpen(false);
    setForm({ titulo_norma: "", tipo_norma: "lei", numero_norma: "", ano_norma: "", orgao_emissor: "", ementa: "", texto_integral: "", palavras_chave: "" });
    loadNormas();
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="qa-btn-primary flex items-center gap-1.5 no-glow">
                <Plus className="h-3.5 w-3.5" /> Nova Norma
              </button>
            </DialogTrigger>
            <DialogContent className="bg-white border-slate-200 text-slate-800 max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Cadastrar Norma</DialogTitle>
              </DialogHeader>
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
                  <button onClick={() => setOpen(false)} className="qa-btn-outline h-9 px-4 text-xs">Cancelar</button>
                  <button onClick={handleSave} disabled={saving} className="qa-btn-primary h-9 px-4 text-xs flex items-center gap-1.5 no-glow">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Salvar Norma
                  </button>
                </div>
              </div>
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
          onFocus={e => e.currentTarget.style.borderColor = "hsl(230 80% 56%)"}
          onBlur={e => e.currentTarget.style.borderColor = "hsl(220 13% 91%)"}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : normas.length === 0 ? (
        <div className="text-center py-16">
          <Scale className="h-12 w-12 mx-auto mb-3" style={{ color: "hsl(220 13% 85%)" }} />
          <p className="text-sm" style={{ color: "hsl(220 10% 55%)" }}>Nenhuma norma cadastrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {normas.map((n: any) => (
            <div key={n.id} className="qa-card qa-hover-lift p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold uppercase" style={{ color: "hsl(220 20% 18%)" }}>{n.titulo_norma}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="qa-badge text-[10px] uppercase">{n.tipo_norma?.replace(/_/g, " ")}</span>
                    {n.numero_norma && <span className="text-xs uppercase" style={{ color: "hsl(220 10% 55%)" }}>Nº {n.numero_norma}</span>}
                    {n.ano_norma && <span className="text-xs" style={{ color: "hsl(220 10% 55%)" }}>({n.ano_norma})</span>}
                    {n.orgao_emissor && <span className="text-xs uppercase" style={{ color: "hsl(220 10% 55%)" }}>• {n.orgao_emissor}</span>}
                  </div>
                  {n.ementa && <p className="text-xs mt-2 line-clamp-2 uppercase" style={{ color: "hsl(220 10% 45%)" }}>{n.ementa}</p>}
                </div>
                {n.revisada_humanamente && <span title="Revisada"><CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" /></span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Gavel, CheckCircle, Loader2 } from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";

export default function QAJurisprudenciaPage() {
  const { profile } = useQAAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tribunal: "", numero_processo: "", relator: "", orgao_julgador: "",
    data_julgamento: "", tema: "", ementa_resumida: "", tese_aplicavel: "",
    texto_controlado: "", palavras_chave: "",
  });

  const canEdit = profile?.perfil && ["administrador", "advogado", "assistente_juridico"].includes(profile.perfil);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("qa_jurisprudencias" as any).select("*").order("created_at", { ascending: false });
    if (busca) q = q.or(`tribunal.ilike.%${busca}%,numero_processo.ilike.%${busca}%,tema.ilike.%${busca}%,tese_aplicavel.ilike.%${busca}%`);
    const { data } = await q;
    setItems((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [busca]);

  const handleSave = async () => {
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
    setForm({ tribunal: "", numero_processo: "", relator: "", orgao_julgador: "", data_julgamento: "", tema: "", ementa_resumida: "", tese_aplicavel: "", texto_controlado: "", palavras_chave: "" });
    load();
  };

  const f = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-5 md:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
            Jurisprudência
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Precedentes e decisões validadas</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="qa-btn-primary flex items-center gap-1.5 no-glow">
                <Plus className="h-3.5 w-3.5" /> Nova Jurisprudência
              </button>
            </DialogTrigger>
            <DialogContent className="bg-white border-slate-200 text-slate-800 max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Cadastrar Jurisprudência</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4 uppercase">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Tribunal *</Label>
                    <Input value={form.tribunal} onChange={e => f("tribunal", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800 uppercase" placeholder="STF, STJ, TRF1..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Nº Processo</Label>
                    <Input value={form.numero_processo} onChange={e => f("numero_processo", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800 uppercase" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Relator</Label>
                    <Input value={form.relator} onChange={e => f("relator", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800 uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Órgão Julgador</Label>
                    <Input value={form.orgao_julgador} onChange={e => f("orgao_julgador", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800 uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Data Julgamento</Label>
                    <Input placeholder="DD/MM/AAAA" value={form.data_julgamento} onChange={e => f("data_julgamento", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Tema</Label>
                  <Input value={form.tema} onChange={e => f("tema", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800 uppercase" placeholder="Posse de arma de fogo" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Ementa Resumida *</Label>
                  <Textarea value={form.ementa_resumida} onChange={e => f("ementa_resumida", e.target.value)} className="bg-white border-slate-200 text-slate-800 min-h-[80px] uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Tese Aplicável</Label>
                  <Textarea value={form.tese_aplicavel} onChange={e => f("tese_aplicavel", e.target.value)} className="bg-white border-slate-200 text-slate-800 min-h-[60px] uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Texto Controlado</Label>
                  <Textarea value={form.texto_controlado} onChange={e => f("texto_controlado", e.target.value)} className="bg-white border-slate-200 text-slate-800 min-h-[100px] uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Palavras-chave (vírgula)</Label>
                  <Input value={form.palavras_chave} onChange={e => f("palavras_chave", e.target.value)} className="h-9 bg-white border-slate-200 text-slate-800 uppercase" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setOpen(false)} className="qa-btn-outline h-9 px-4 text-xs">Cancelar</button>
                  <button onClick={handleSave} disabled={saving} className="qa-btn-primary h-9 px-4 text-xs flex items-center gap-1.5 no-glow">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Salvar
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
          placeholder="Buscar por tribunal, processo, tema..."
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
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Gavel className="h-12 w-12 mx-auto mb-3" style={{ color: "hsl(220 13% 85%)" }} />
          <p className="text-sm" style={{ color: "hsl(220 10% 55%)" }}>Nenhuma jurisprudência cadastrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((j: any) => (
            <div key={j.id} className="qa-card qa-hover-lift p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-semibold uppercase" style={{ color: "hsl(230 80% 56%)" }}>{j.tribunal}</span>
                    {j.numero_processo && <span className="uppercase" style={{ color: "hsl(220 10% 45%)" }}>• {j.numero_processo}</span>}
                  </div>
                  {j.tema && <div className="text-xs mt-0.5 uppercase" style={{ color: "hsl(220 10% 55%)" }}>{j.tema}</div>}
                  {j.ementa_resumida && <p className="text-xs mt-2 line-clamp-3 uppercase" style={{ color: "hsl(220 10% 45%)" }}>{j.ementa_resumida}</p>}
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

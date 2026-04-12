import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Jurisprudência</h1>
          <p className="text-sm text-slate-500 mt-1">Precedentes e decisões validadas</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700"><Plus className="h-4 w-4 mr-2" /> Nova Jurisprudência</Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111111] border-slate-800 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-slate-100">Cadastrar Jurisprudência</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Tribunal *</Label>
                    <Input value={form.tribunal} onChange={e => f("tribunal", e.target.value)} className="bg-[#0d0d0d] border-slate-700 text-slate-100" placeholder="STF, STJ, TRF1..." />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Nº Processo</Label>
                    <Input value={form.numero_processo} onChange={e => f("numero_processo", e.target.value)} className="bg-[#0d0d0d] border-slate-700 text-slate-100" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Relator</Label>
                    <Input value={form.relator} onChange={e => f("relator", e.target.value)} className="bg-[#0d0d0d] border-slate-700 text-slate-100" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Órgão Julgador</Label>
                    <Input value={form.orgao_julgador} onChange={e => f("orgao_julgador", e.target.value)} className="bg-[#0d0d0d] border-slate-700 text-slate-100" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Data Julgamento</Label>
                    <Input type="date" value={form.data_julgamento} onChange={e => f("data_julgamento", e.target.value)} className="bg-[#0d0d0d] border-slate-700 text-slate-100" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Tema</Label>
                  <Input value={form.tema} onChange={e => f("tema", e.target.value)} className="bg-[#0d0d0d] border-slate-700 text-slate-100" placeholder="Posse de arma de fogo" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Ementa Resumida *</Label>
                  <Textarea value={form.ementa_resumida} onChange={e => f("ementa_resumida", e.target.value)} className="bg-[#0d0d0d] border-slate-700 text-slate-100 min-h-[80px]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Tese Aplicável</Label>
                  <Textarea value={form.tese_aplicavel} onChange={e => f("tese_aplicavel", e.target.value)} className="bg-[#0d0d0d] border-slate-700 text-slate-100 min-h-[60px]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Texto Controlado</Label>
                  <Textarea value={form.texto_controlado} onChange={e => f("texto_controlado", e.target.value)} className="bg-[#0d0d0d] border-slate-700 text-slate-100 min-h-[100px]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Palavras-chave (vírgula)</Label>
                  <Input value={form.palavras_chave} onChange={e => f("palavras_chave", e.target.value)} className="bg-[#0d0d0d] border-slate-700 text-slate-100" />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input placeholder="Buscar por tribunal, processo, tema..." value={busca} onChange={e => setBusca(e.target.value)}
          className="pl-10 bg-[#111111] border-slate-700 text-slate-100" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Gavel className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma jurisprudência cadastrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((j: any) => (
            <div key={j.id} className="bg-[#111111] border border-slate-800/40 rounded-lg p-4 hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-amber-400">{j.tribunal}</span>
                    {j.numero_processo && <span className="text-slate-400">• {j.numero_processo}</span>}
                  </div>
                  {j.tema && <div className="text-xs text-slate-500 mt-0.5">{j.tema}</div>}
                  {j.ementa_resumida && <p className="text-xs text-slate-400 mt-2 line-clamp-3">{j.ementa_resumida}</p>}
                  {j.tese_aplicavel && <p className="text-xs text-emerald-400/70 mt-1 line-clamp-2 italic">Tese: {j.tese_aplicavel}</p>}
                </div>
                {j.validada_humanamente && <span title="Validada"><CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" /></span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

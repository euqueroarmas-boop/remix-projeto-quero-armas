import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Scale, CheckCircle, Loader2 } from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";

const TIPOS_NORMA = ["lei", "decreto", "instrucao_normativa", "portaria", "resolucao", "nota_tecnica", "outro"];

export default function QALegislacaoPage() {
  const { profile } = useQAAuth();
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

  const loadNormas = async () => {
    setLoading(true);
    let q = supabase.from("qa_fontes_normativas" as any).select("*").eq("ativa", true).order("created_at", { ascending: false });
    if (busca) q = q.or(`titulo_norma.ilike.%${busca}%,numero_norma.ilike.%${busca}%,ementa.ilike.%${busca}%`);
    const { data } = await q;
    setNormas((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadNormas(); }, [busca]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Legislação</h1>
          <p className="text-sm text-slate-500 mt-1">Base normativa controlada</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white/10 hover:bg-white/15 text-white border border-white/10"><Plus className="h-4 w-4 mr-2" /> Nova Norma</Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111111] border-[#1a1a1a] text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-slate-100">Cadastrar Norma</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Título *</Label>
                    <Input value={form.titulo_norma} onChange={e => setForm(f => ({ ...f, titulo_norma: e.target.value }))}
                      className="bg-[#0d0d0d] border-[#1a1a1a] text-slate-100" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Tipo</Label>
                    <Select value={form.tipo_norma} onValueChange={v => setForm(f => ({ ...f, tipo_norma: v }))}>
                      <SelectTrigger className="bg-[#0d0d0d] border-[#1a1a1a] text-slate-300"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_NORMA.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Número</Label>
                    <Input value={form.numero_norma} onChange={e => setForm(f => ({ ...f, numero_norma: e.target.value }))}
                      className="bg-[#0d0d0d] border-[#1a1a1a] text-slate-100" placeholder="10.826" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Ano</Label>
                    <Input type="number" value={form.ano_norma} onChange={e => setForm(f => ({ ...f, ano_norma: e.target.value }))}
                      className="bg-[#0d0d0d] border-[#1a1a1a] text-slate-100" placeholder="2003" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Órgão Emissor</Label>
                    <Input value={form.orgao_emissor} onChange={e => setForm(f => ({ ...f, orgao_emissor: e.target.value }))}
                      className="bg-[#0d0d0d] border-[#1a1a1a] text-slate-100" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Ementa</Label>
                  <Textarea value={form.ementa} onChange={e => setForm(f => ({ ...f, ementa: e.target.value }))}
                    className="bg-[#0d0d0d] border-[#1a1a1a] text-slate-100 min-h-[80px]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Texto Integral</Label>
                  <Textarea value={form.texto_integral} onChange={e => setForm(f => ({ ...f, texto_integral: e.target.value }))}
                    className="bg-[#0d0d0d] border-[#1a1a1a] text-slate-100 min-h-[150px]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Palavras-chave (separadas por vírgula)</Label>
                  <Input value={form.palavras_chave} onChange={e => setForm(f => ({ ...f, palavras_chave: e.target.value }))}
                    className="bg-[#0d0d0d] border-[#1a1a1a] text-slate-100" placeholder="armas, posse, CAC" />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Norma"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input placeholder="Buscar por título, número ou ementa..." value={busca} onChange={e => setBusca(e.target.value)}
          className="pl-10 bg-[#111111] border-[#1a1a1a] text-slate-100" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : normas.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Scale className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma norma cadastrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {normas.map((n: any) => (
            <div key={n.id} className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 hover:border-[#1a1a1a] transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200">{n.titulo_norma}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                    <span className="px-1.5 py-0.5 rounded bg-[#161616] text-slate-400">{n.tipo_norma?.replace(/_/g, " ")}</span>
                    {n.numero_norma && <span>Nº {n.numero_norma}</span>}
                    {n.ano_norma && <span>({n.ano_norma})</span>}
                    {n.orgao_emissor && <span>• {n.orgao_emissor}</span>}
                  </div>
                  {n.ementa && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{n.ementa}</p>}
                </div>
                {n.revisada_humanamente && <span title="Revisada"><CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" /></span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";

interface ConfigItem {
  id: string;
  chave: string;
  valor: number;
  descricao: string | null;
}

interface Servico {
  id: number;
  nome_servico: string;
  valor_servico: number;
}

export default function QAConfiguracoesPage() {
  const { profile } = useQAAuth();
  const [stats, setStats] = useState<any>(null);
  const [config, setConfig] = useState<ConfigItem[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Serviços state
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ nome_servico: "", valor_servico: "" });
  const [newForm, setNewForm] = useState({ nome_servico: "", valor_servico: "" });
  const [showNew, setShowNew] = useState(false);
  const [savingSvc, setSavingSvc] = useState(false);

  const loadServicos = async () => {
    const { data } = await supabase.from("qa_servicos" as any).select("*").order("nome_servico");
    setServicos((data as any[]) ?? []);
  };

  useEffect(() => {
    const load = async () => {
      const [docs, normas, jurisps, pecas, consultas, refs, revisoes, configRes] = await Promise.all([
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_fontes_normativas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_jurisprudencias" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_consultas_ia" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_referencias_preferenciais" as any).select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("qa_revisoes_pecas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_config" as any).select("*").order("chave"),
      ]);
      setStats({
        documentos: docs.count ?? 0, normas: normas.count ?? 0,
        jurisprudencias: jurisps.count ?? 0, pecas: pecas.count ?? 0,
        consultas: consultas.count ?? 0, referencias: refs.count ?? 0,
        revisoes: revisoes.count ?? 0,
      });
      const items = (configRes.data as any[]) ?? [];
      setConfig(items);
      const initial: Record<string, string> = {};
      items.forEach((c: any) => { initial[c.id] = String(c.valor); });
      setEditedValues(initial);
      await loadServicos();
      setLoading(false);
    };
    load();
  }, []);

  const handleSaveWeights = async () => {
    setSaving(true);
    try {
      for (const item of config) {
        const newVal = parseFloat(editedValues[item.id] || "0");
        if (newVal !== item.valor) {
          await supabase.from("qa_config" as any).update({ valor: newVal, updated_at: new Date().toISOString() }).eq("id", item.id);
        }
      }
      toast.success("Pesos atualizados");
      const { data } = await supabase.from("qa_config" as any).select("*").order("chave");
      setConfig((data as any[]) ?? []);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleAddServico = async () => {
    if (!newForm.nome_servico.trim()) { toast.error("Nome obrigatório"); return; }
    setSavingSvc(true);
    try {
      const { error } = await supabase.from("qa_servicos" as any).insert({
        nome_servico: newForm.nome_servico.trim(),
        valor_servico: Number(newForm.valor_servico) || 0,
      });
      if (error) throw error;
      toast.success("Serviço cadastrado");
      setNewForm({ nome_servico: "", valor_servico: "" });
      setShowNew(false);
      await loadServicos();
    } catch (e: any) { toast.error(e.message); } finally { setSavingSvc(false); }
  };

  const handleUpdateServico = async (id: number) => {
    if (!editForm.nome_servico.trim()) { toast.error("Nome obrigatório"); return; }
    setSavingSvc(true);
    try {
      const { error } = await supabase.from("qa_servicos" as any).update({
        nome_servico: editForm.nome_servico.trim(),
        valor_servico: Number(editForm.valor_servico) || 0,
      }).eq("id", id);
      if (error) throw error;
      toast.success("Serviço atualizado");
      setEditingId(null);
      await loadServicos();
    } catch (e: any) { toast.error(e.message); } finally { setSavingSvc(false); }
  };

  const handleDeleteServico = async (id: number) => {
    if (!confirm("Excluir este serviço?")) return;
    try {
      const { error } = await supabase.from("qa_servicos" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Serviço excluído");
      await loadServicos();
    } catch (e: any) { toast.error(e.message); }
  };

  const startEdit = (svc: Servico) => {
    setEditingId(svc.id);
    setEditForm({ nome_servico: svc.nome_servico, valor_servico: String(svc.valor_servico) });
  };

  const isAdmin = profile?.perfil === "administrador";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-4 h-4 border-2 border-neutral-700 border-t-slate-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-5 max-w-4xl">
      <h1 className="text-sm md:text-base font-semibold text-neutral-300">Configurações</h1>

      {/* System Status */}
      <div className="bg-[#111111] border border-[#1c1c1c] rounded p-2.5 md:p-4">
        <span className="text-[9px] text-neutral-600 uppercase tracking-[0.12em] font-medium">Status</span>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5 md:gap-3 mt-2">
          {[
            { label: "Docs", value: stats?.documentos },
            { label: "Normas", value: stats?.normas },
            { label: "Jurisp.", value: stats?.jurisprudencias },
            { label: "Peças", value: stats?.pecas },
            { label: "Consultas", value: stats?.consultas },
            { label: "Refs", value: stats?.referencias },
            { label: "Revisões", value: stats?.revisoes },
          ].map(s => (
            <div key={s.label} className="bg-[#0a0a0a] rounded px-2 py-1.5 text-center">
              <div className="text-sm md:text-base font-semibold text-neutral-300 font-mono tabular-nums leading-tight">{s.value}</div>
              <div className="text-[7px] md:text-[9px] text-neutral-600 uppercase tracking-[0.08em]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Serviços CRUD */}
      {isAdmin && (
        <div className="bg-[#111111] border border-[#1c1c1c] rounded p-2.5 md:p-4">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <span className="text-[9px] text-neutral-600 uppercase tracking-[0.12em] font-medium">Serviços ({servicos.length})</span>
            <Button onClick={() => { setShowNew(!showNew); setNewForm({ nome_servico: "", valor_servico: "" }); }} size="sm"
              className="bg-[#7a1528] hover:bg-[#a52338] text-neutral-300 border border-[#1c1c1c] h-6 md:h-7 text-[9px] md:text-[10px]">
              <Plus className="h-3 w-3 mr-1" /> Novo Serviço
            </Button>
          </div>

          {/* New service form */}
          {showNew && (
            <div className="flex gap-2 items-end mb-3 bg-[#0a0a0a] rounded p-2 border border-[#1c1c1c]">
              <div className="flex-1">
                <Label className="text-neutral-500 text-[9px]">Nome</Label>
                <Input value={newForm.nome_servico} onChange={e => setNewForm(p => ({ ...p, nome_servico: e.target.value }))}
                  className="bg-[#0e0e0e] border-[#1c1c1c] text-neutral-200 h-7 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Nome do serviço" />
              </div>
              <div className="w-24">
                <Label className="text-neutral-500 text-[9px]">Valor (R$)</Label>
                <Input type="number" value={newForm.valor_servico} onChange={e => setNewForm(p => ({ ...p, valor_servico: e.target.value }))}
                  className="bg-[#0e0e0e] border-[#1c1c1c] text-neutral-200 h-7 text-[11px] font-mono focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="0" />
              </div>
              <Button size="sm" onClick={handleAddServico} disabled={savingSvc} className="bg-emerald-800 hover:bg-emerald-700 h-7 px-2">
                {savingSvc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNew(false)} className="h-7 px-2 text-neutral-500">
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Services list */}
          <div className="space-y-0.5">
            {servicos.map(svc => (
              <div key={svc.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-[11px] hover:bg-[#0a0a0a] transition-colors group">
                {editingId === svc.id ? (
                  <>
                    <Input value={editForm.nome_servico} onChange={e => setEditForm(p => ({ ...p, nome_servico: e.target.value }))}
                      className="flex-1 bg-[#0e0e0e] border-[#1c1c1c] text-neutral-200 h-6 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0" />
                    <Input type="number" value={editForm.valor_servico} onChange={e => setEditForm(p => ({ ...p, valor_servico: e.target.value }))}
                      className="w-20 bg-[#0e0e0e] border-[#1c1c1c] text-neutral-200 h-6 text-[11px] font-mono text-right focus-visible:ring-0 focus-visible:ring-offset-0" />
                    <Button size="sm" variant="ghost" onClick={() => handleUpdateServico(svc.id)} disabled={savingSvc} className="h-6 px-1.5 text-emerald-500 hover:text-emerald-400">
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-6 px-1.5 text-neutral-500">
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-neutral-400 truncate">{svc.nome_servico}</span>
                    <span className="text-neutral-600 font-mono shrink-0">R$ {svc.valor_servico}</span>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(svc)} className="h-6 px-1.5 text-neutral-600 hover:text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteServico(svc.id)} className="h-6 px-1.5 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            {servicos.length === 0 && <p className="text-[10px] text-neutral-600 py-2 text-center">Nenhum serviço cadastrado</p>}
          </div>
        </div>
      )}

      {/* Ranking Weights */}
      <div className="bg-[#111111] border border-[#1c1c1c] rounded p-2.5 md:p-4">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <span className="text-[9px] text-neutral-600 uppercase tracking-[0.12em] font-medium">Pesos de Ranking</span>
          {isAdmin && (
            <Button onClick={handleSaveWeights} disabled={saving} size="sm"
              className="bg-[#7a1528] hover:bg-[#a52338] text-neutral-400 border border-[#1c1c1c] h-6 md:h-7 text-[9px] md:text-[10px]">
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Salvar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
          {config.map(c => (
            <div key={c.id} className="space-y-0.5 md:space-y-1">
              <Label className="text-neutral-500 text-[9px] md:text-[10px]">{c.descricao || c.chave}</Label>
              <Input
                value={editedValues[c.id] || ""}
                onChange={e => setEditedValues(prev => ({ ...prev, [c.id]: e.target.value }))}
                disabled={!isAdmin}
                type="number" step="0.01"
                className="bg-[#0a0a0a] border-[#1c1c1c] text-neutral-400 h-7 md:h-8 text-[11px] font-mono"
              />
              <div className="text-[8px] text-neutral-700 font-mono">{c.chave}</div>
            </div>
          ))}
        </div>
        {!isAdmin && <p className="text-[9px] text-neutral-700 mt-2">Apenas administradores podem editar.</p>}
      </div>

      {/* Profile */}
      <div className="bg-[#111111] border border-[#1c1c1c] rounded p-2.5 md:p-4">
        <span className="text-[9px] text-neutral-600 uppercase tracking-[0.12em] font-medium">Perfil</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 md:gap-3 mt-2 text-[11px]">
          <div><span className="text-neutral-600">Nome:</span> <span className="text-neutral-400 ml-1">{profile?.nome || "—"}</span></div>
          <div><span className="text-neutral-600">Perfil:</span> <span className="text-neutral-400 ml-1 capitalize">{profile?.perfil?.replace(/_/g, " ") || "—"}</span></div>
          <div><span className="text-neutral-600">Email:</span> <span className="text-neutral-400 ml-1 truncate">{profile?.email || "—"}</span></div>
          <div><span className="text-neutral-600">Status:</span> <span className={`ml-1 ${profile?.ativo ? "text-emerald-400" : "text-red-400"}`}>{profile?.ativo ? "Ativo" : "Inativo"}</span></div>
        </div>
      </div>
    </div>
  );
}

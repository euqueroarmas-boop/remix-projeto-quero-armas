import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Plus, Pencil, Trash2, X, Check, Settings, Database, User } from "lucide-react";
import { useQAAuthContext } from "@/components/quero-armas/QAAuthContext";

interface ConfigItem { id: string; chave: string; valor: number; descricao: string | null; }
interface Servico { id: number; nome_servico: string; valor_servico: number; is_combo?: boolean; }

export default function QAConfiguracoesPage() {
  const { profile } = useQAAuthContext();
  const [stats, setStats] = useState<any>(null);
  const [config, setConfig] = useState<ConfigItem[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ nome_servico: "", valor_servico: "", is_combo: false });
  const [newForm, setNewForm] = useState({ nome_servico: "", valor_servico: "", is_combo: false });
  const [showNew, setShowNew] = useState(false);
  const [savingSvc, setSavingSvc] = useState(false);

  // Status de Serviço (CRUD)
  const [statuses, setStatuses] = useState<{ id: string; nome: string; ordem: number; ativo: boolean }[]>([]);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editStatusForm, setEditStatusForm] = useState({ nome: "", ordem: "" });
  const [newStatusForm, setNewStatusForm] = useState({ nome: "", ordem: "" });
  const [showNewStatus, setShowNewStatus] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const loadServicos = async () => {
    const { data } = await supabase.from("qa_servicos" as any).select("*").order("nome_servico");
    setServicos((data as any[]) ?? []);
  };

  const loadStatuses = async () => {
    const { data } = await supabase.from("qa_status_servico" as any).select("*").order("ordem", { ascending: true });
    setStatuses((data as any[]) ?? []);
  };

  const handleAddStatus = async () => {
    if (!newStatusForm.nome.trim()) { toast.error("Nome obrigatório"); return; }
    setSavingStatus(true);
    try {
      const { error } = await supabase.from("qa_status_servico" as any).insert({
        nome: newStatusForm.nome.trim(),
        ordem: Number(newStatusForm.ordem) || 0,
      });
      if (error) throw error;
      toast.success("Status criado");
      setNewStatusForm({ nome: "", ordem: "" });
      setShowNewStatus(false);
      await loadStatuses();
    } catch (e: any) { toast.error(e.message); } finally { setSavingStatus(false); }
  };

  const handleUpdateStatus = async (id: string) => {
    if (!editStatusForm.nome.trim()) { toast.error("Nome obrigatório"); return; }
    setSavingStatus(true);
    try {
      const { error } = await supabase.from("qa_status_servico" as any).update({
        nome: editStatusForm.nome.trim(),
        ordem: Number(editStatusForm.ordem) || 0,
      }).eq("id", id);
      if (error) throw error;
      toast.success("Status atualizado");
      setEditingStatusId(null);
      await loadStatuses();
    } catch (e: any) { toast.error(e.message); } finally { setSavingStatus(false); }
  };

  const handleDeleteStatus = async (id: string) => {
    if (!confirm("Excluir este status?")) return;
    try {
      const { error } = await supabase.from("qa_status_servico" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Status excluído");
      await loadStatuses();
    } catch (e: any) { toast.error(e.message); }
  };

  const startEditStatus = (s: { id: string; nome: string; ordem: number }) => {
    setEditingStatusId(s.id);
    setEditStatusForm({ nome: s.nome, ordem: String(s.ordem) });
  };

  useEffect(() => {
    const load = async () => {
      try {
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
      } catch (err) {
        console.error("[QAConfiguracoes] load error:", err);
      } finally {
        setLoading(false);
      }
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
    } finally { setSaving(false); }
  };

  const handleAddServico = async () => {
    if (!newForm.nome_servico.trim()) { toast.error("Nome obrigatório"); return; }
    setSavingSvc(true);
    try {
      const { error } = await supabase.from("qa_servicos" as any).insert({
        nome_servico: newForm.nome_servico.trim(),
        valor_servico: Number(newForm.valor_servico) || 0,
        is_combo: newForm.is_combo,
      });
      if (error) throw error;
      toast.success("Serviço cadastrado");
      setNewForm({ nome_servico: "", valor_servico: "", is_combo: false });
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
        is_combo: editForm.is_combo,
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
    setEditForm({ nome_servico: svc.nome_servico, valor_servico: String(svc.valor_servico), is_combo: !!svc.is_combo });
  };

  const isAdmin = profile?.perfil === "administrador";

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "hsl(220 20% 18%)" }}>
          <Settings className="h-5 w-5" style={{ color: "hsl(230 80% 56%)" }} /> Configurações
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Status do sistema, serviços e pesos de ranking</p>
      </div>

      {/* System Status */}
      <div className="qa-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-4 w-4" style={{ color: "hsl(230 80% 56%)" }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>Status</span>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
          {[
            { label: "Docs", value: stats?.documentos },
            { label: "Normas", value: stats?.normas },
            { label: "Jurisp.", value: stats?.jurisprudencias },
            { label: "Peças", value: stats?.pecas },
            { label: "Consultas", value: stats?.consultas },
            { label: "Refs", value: stats?.referencias },
            { label: "Revisões", value: stats?.revisoes },
          ].map(s => (
            <div key={s.label} className="text-center p-2 rounded-lg" style={{ background: "hsl(220 20% 97%)" }}>
              <div className="text-lg font-bold tabular-nums" style={{ color: "hsl(220 20% 18%)" }}>{s.value}</div>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: "hsl(220 10% 55%)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Serviços CRUD */}
      {isAdmin && (
        <div className="qa-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>Serviços ({servicos.length})</span>
            <button onClick={() => { setShowNew(!showNew); setNewForm({ nome_servico: "", valor_servico: "", is_combo: false }); }}
              className="qa-btn-primary h-8 px-3 text-[11px] flex items-center gap-1 no-glow">
              <Plus className="h-3 w-3" /> Novo Serviço
            </button>
          </div>

          {showNew && (
            <div className="flex gap-2 items-end mb-3 rounded-xl p-3 border" style={{ borderColor: "hsl(220 13% 91%)", background: "hsl(220 20% 97%)" }}>
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] uppercase" style={{ color: "hsl(220 10% 45%)" }}>Nome</Label>
                <Input value={newForm.nome_servico} onChange={e => setNewForm(p => ({ ...p, nome_servico: e.target.value }))}
                  className="h-9 bg-white border-slate-200 text-slate-700" placeholder="Nome do serviço" />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-[10px] uppercase" style={{ color: "hsl(220 10% 45%)" }}>Valor (R$)</Label>
                <Input type="number" value={newForm.valor_servico} onChange={e => setNewForm(p => ({ ...p, valor_servico: e.target.value }))}
                  className="h-9 bg-white border-slate-200 text-slate-700 font-mono" placeholder="0" />
              </div>
              <button onClick={handleAddServico} disabled={savingSvc} className="h-9 w-9 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 shrink-0">
                {savingSvc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => setShowNew(false)} className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="space-y-1">
            {servicos.map(svc => (
              <div key={svc.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] hover:bg-slate-50 transition-colors group">
                {editingId === svc.id ? (
                  <>
                    <Input value={editForm.nome_servico} onChange={e => setEditForm(p => ({ ...p, nome_servico: e.target.value }))}
                      className="flex-1 bg-white border-slate-200 text-slate-700 h-8 text-xs" />
                    <Input type="number" value={editForm.valor_servico} onChange={e => setEditForm(p => ({ ...p, valor_servico: e.target.value }))}
                      className="w-24 bg-white border-slate-200 text-slate-700 h-8 text-xs font-mono text-right" />
                    <button onClick={() => handleUpdateServico(svc.id)} disabled={savingSvc} className="h-7 w-7 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate" style={{ color: "hsl(220 20% 25%)" }}>{svc.nome_servico}</span>
                    <span className="font-mono shrink-0" style={{ color: "hsl(220 10% 55%)" }}>R$ {svc.valor_servico}</span>
                    <button onClick={() => startEdit(svc)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => handleDeleteServico(svc.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            ))}
            {servicos.length === 0 && <p className="text-xs text-center py-4" style={{ color: "hsl(220 10% 62%)" }}>Nenhum serviço cadastrado</p>}
          </div>
        </div>
      )}

      {/* Ranking Weights */}
      <div className="qa-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>Pesos de Ranking</span>
          {isAdmin && (
            <button onClick={handleSaveWeights} disabled={saving} className="qa-btn-primary h-8 px-3 text-[11px] flex items-center gap-1 no-glow">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {config.map(c => (
            <div key={c.id} className="space-y-1">
              <Label className="text-[11px] font-medium uppercase" style={{ color: "hsl(220 10% 45%)" }}>{c.descricao || c.chave}</Label>
              <Input
                value={editedValues[c.id] || ""}
                onChange={e => setEditedValues(prev => ({ ...prev, [c.id]: e.target.value }))}
                disabled={!isAdmin}
                type="number" step="0.01"
                className="h-9 bg-white border-slate-200 text-slate-700 font-mono"
              />
              <div className="text-[9px] font-mono" style={{ color: "hsl(220 10% 70%)" }}>{c.chave}</div>
            </div>
          ))}
        </div>
        {!isAdmin && <p className="text-xs mt-3" style={{ color: "hsl(220 10% 62%)" }}>Apenas administradores podem editar.</p>}
      </div>

      {/* Profile */}
      <div className="qa-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <User className="h-4 w-4" style={{ color: "hsl(230 80% 56%)" }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>Perfil</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
          <div><span style={{ color: "hsl(220 10% 55%)" }}>Nome:</span> <span className="ml-1 uppercase font-medium" style={{ color: "hsl(220 20% 25%)" }}>{profile?.nome || "—"}</span></div>
          <div><span style={{ color: "hsl(220 10% 55%)" }}>Perfil:</span> <span className="ml-1 uppercase font-medium" style={{ color: "hsl(220 20% 25%)" }}>{profile?.perfil?.replace(/_/g, " ") || "—"}</span></div>
          <div><span style={{ color: "hsl(220 10% 55%)" }}>Email:</span> <span className="ml-1 truncate uppercase" style={{ color: "hsl(220 20% 25%)" }}>{profile?.email || "—"}</span></div>
          <div><span style={{ color: "hsl(220 10% 55%)" }}>Status:</span> <span className={`ml-1 font-medium ${profile?.ativo ? "text-emerald-600" : "text-red-500"}`}>{profile?.ativo ? "ATIVO" : "INATIVO"}</span></div>
        </div>
      </div>
    </div>
  );
}

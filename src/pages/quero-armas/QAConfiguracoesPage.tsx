import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Plus, Pencil, Trash2, X, Check, Settings, Database, User } from "lucide-react";
import { useQAAuthContext } from "@/components/quero-armas/QAAuthContext";
import { BLOCOS_MONITORAMENTO } from "@/components/quero-armas/monitoramento/blocosCatalogo";
import { useMonitoramentoConfig } from "@/components/quero-armas/monitoramento/useMonitoramentoConfig";
import { Switch } from "@/components/ui/switch";

interface ConfigItem { id: string; chave: string; valor: number; descricao: string | null; }
interface Servico { id: number; nome_servico: string; valor_servico: number; is_combo?: boolean; }

type ServicoTab = "catalogo" | "internos";

export default function QAConfiguracoesPage() {
  const { profile } = useQAAuthContext();
  const [stats, setStats] = useState<any>(null);
  const [config, setConfig] = useState<ConfigItem[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [catalogoIds, setCatalogoIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<ServicoTab>("catalogo");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ nome_servico: "", valor_servico: "", is_combo: false });
  const [newForm, setNewForm] = useState({ nome_servico: "", valor_servico: "", is_combo: false });
  const [showNew, setShowNew] = useState(false);
  const [savingSvc, setSavingSvc] = useState(false);

  // Status de Serviço (CRUD) — fonte única editável pela Equipe Quero Armas
  type StatusRow = {
    id: string;
    codigo: string;
    nome: string;
    descricao: string | null;
    ordem: number;
    cor: string | null;
    ativo: boolean;
    finalizador: boolean;
    exige_data_protocolo: boolean;
    exige_numero_protocolo: boolean;
    visivel_cliente: boolean;
    visivel_equipe: boolean;
  };
  const emptyStatusForm = {
    codigo: "", nome: "", descricao: "", ordem: "",
    cor: "#94a3b8", finalizador: false,
    exige_data_protocolo: false, exige_numero_protocolo: false,
    visivel_cliente: true, visivel_equipe: true,
  };
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editStatusForm, setEditStatusForm] = useState<typeof emptyStatusForm>(emptyStatusForm);
  const [newStatusForm, setNewStatusForm] = useState<typeof emptyStatusForm>(emptyStatusForm);
  const [showNewStatus, setShowNewStatus] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const loadServicos = async () => {
    const { data } = await supabase.from("qa_servicos" as any).select("*").order("nome_servico");
    setServicos((data as any[]) ?? []);
  };

  const loadCatalogoIds = async () => {
    const { data } = await supabase
      .from("qa_servicos_catalogo" as any)
      .select("servico_id")
      .eq("ativo", true);
    const ids = new Set<number>(
      ((data as any[]) ?? [])
        .map((r) => r?.servico_id)
        .filter((v): v is number => typeof v === "number")
    );
    setCatalogoIds(ids);
  };

  const loadStatuses = async () => {
    const { data } = await supabase.from("qa_status_servico" as any).select("*").order("ordem", { ascending: true });
    setStatuses((data as any[]) ?? []);
  };

  const slugify = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  const handleAddStatus = async () => {
    if (!newStatusForm.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const codigo = (newStatusForm.codigo.trim() || slugify(newStatusForm.nome));
    if (!codigo) { toast.error("Código inválido"); return; }
    setSavingStatus(true);
    try {
      const { error } = await supabase.from("qa_status_servico" as any).insert({
        codigo,
        nome: newStatusForm.nome.trim().toUpperCase(),
        descricao: newStatusForm.descricao.trim() || null,
        ordem: Number(newStatusForm.ordem) || 0,
        cor: newStatusForm.cor || null,
        ativo: true,
        finalizador: newStatusForm.finalizador,
        exige_data_protocolo: newStatusForm.exige_data_protocolo,
        exige_numero_protocolo: newStatusForm.exige_numero_protocolo,
        visivel_cliente: newStatusForm.visivel_cliente,
        visivel_equipe: newStatusForm.visivel_equipe,
      });
      if (error) throw error;
      toast.success("Status criado");
      setNewStatusForm(emptyStatusForm);
      setShowNewStatus(false);
      await loadStatuses();
    } catch (e: any) { toast.error(e.message); } finally { setSavingStatus(false); }
  };

  const handleUpdateStatus = async (id: string) => {
    if (!editStatusForm.nome.trim()) { toast.error("Nome obrigatório"); return; }
    setSavingStatus(true);
    try {
      const { error } = await supabase.from("qa_status_servico" as any).update({
        codigo: editStatusForm.codigo.trim() || slugify(editStatusForm.nome),
        nome: editStatusForm.nome.trim().toUpperCase(),
        descricao: editStatusForm.descricao.trim() || null,
        ordem: Number(editStatusForm.ordem) || 0,
        cor: editStatusForm.cor || null,
        finalizador: editStatusForm.finalizador,
        exige_data_protocolo: editStatusForm.exige_data_protocolo,
        exige_numero_protocolo: editStatusForm.exige_numero_protocolo,
        visivel_cliente: editStatusForm.visivel_cliente,
        visivel_equipe: editStatusForm.visivel_equipe,
      }).eq("id", id);
      if (error) throw error;
      toast.success("Status atualizado");
      setEditingStatusId(null);
      await loadStatuses();
    } catch (e: any) { toast.error(e.message); } finally { setSavingStatus(false); }
  };

  const handleToggleStatusAtivo = async (s: StatusRow) => {
    const { error } = await supabase
      .from("qa_status_servico" as any)
      .update({ ativo: !s.ativo })
      .eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(!s.ativo ? "Status ativado" : "Status desativado");
    await loadStatuses();
  };

  const handleDeleteStatus = async (id: string) => {
    if (!confirm("Excluir este status? (Bloqueado se já estiver em uso — neste caso, desative.)")) return;
    try {
      const { error } = await supabase.from("qa_status_servico" as any).delete().eq("id", id);
      if (error) {
        toast.error(
          error.message.includes("em uso")
            ? error.message
            : "Não foi possível excluir. Se está em uso, desative em vez de excluir."
        );
        return;
      }
      toast.success("Status excluído");
      await loadStatuses();
    } catch (e: any) { toast.error(e.message); }
  };

  const startEditStatus = (s: StatusRow) => {
    setEditingStatusId(s.id);
    setEditStatusForm({
      codigo: s.codigo || "",
      nome: s.nome || "",
      descricao: s.descricao || "",
      ordem: String(s.ordem ?? 0),
      cor: s.cor || "#94a3b8",
      finalizador: !!s.finalizador,
      exige_data_protocolo: !!s.exige_data_protocolo,
      exige_numero_protocolo: !!s.exige_numero_protocolo,
      visivel_cliente: s.visivel_cliente !== false,
      visivel_equipe: s.visivel_equipe !== false,
    });
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
        await loadCatalogoIds();
        await loadStatuses();
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
          {(() => {
            const servicosCatalogo = servicos.filter((s) => catalogoIds.has(s.id));
            const servicosInternos = servicos.filter((s) => !catalogoIds.has(s.id));
            const lista = activeTab === "catalogo" ? servicosCatalogo : servicosInternos;
            return (
              <>
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <div className="flex items-center gap-1 rounded-lg p-0.5 border" style={{ borderColor: "hsl(220 13% 91%)", background: "hsl(220 20% 97%)" }}>
                    <button
                      onClick={() => setActiveTab("catalogo")}
                      className="h-7 px-3 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors"
                      style={{
                        background: activeTab === "catalogo" ? "white" : "transparent",
                        color: activeTab === "catalogo" ? "hsl(230 80% 56%)" : "hsl(220 10% 55%)",
                        boxShadow: activeTab === "catalogo" ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                      }}
                    >
                      Catálogo público ({servicosCatalogo.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("internos")}
                      className="h-7 px-3 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors"
                      style={{
                        background: activeTab === "internos" ? "white" : "transparent",
                        color: activeTab === "internos" ? "hsl(230 80% 56%)" : "hsl(220 10% 55%)",
                        boxShadow: activeTab === "internos" ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                      }}
                    >
                      Internos / legados ({servicosInternos.length})
                    </button>
                  </div>
                  <button onClick={() => { setShowNew(!showNew); setNewForm({ nome_servico: "", valor_servico: "", is_combo: false }); }}
                    className="qa-btn-primary h-8 px-3 text-[11px] flex items-center gap-1 no-glow">
                    <Plus className="h-3 w-3" /> Novo Serviço
                  </button>
                </div>

                {activeTab === "internos" && (
                  <p className="text-[11px] mb-3 px-2 py-1.5 rounded-md" style={{ color: "hsl(35 60% 30%)", background: "hsl(45 90% 95%)", border: "1px solid hsl(45 80% 85%)" }}>
                    Serviços operacionais/legados — mantidos para preservar vendas, processos e histórico. Não aparecem na vitrine pública.
                  </p>
                )}

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
            {lista.map(svc => (
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
            {lista.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: "hsl(220 10% 62%)" }}>
                {activeTab === "catalogo" ? "Nenhum serviço vinculado ao catálogo público" : "Nenhum serviço interno/legado"}
              </p>
            )}
          </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Status dos Serviços (CRUD — Equipe Quero Armas) */}
      {isAdmin && (
        <div className="qa-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>
                Status dos Serviços ({statuses.length})
              </span>
              <p className="text-[10px] mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
                Fonte única usada nos menus de status. Status em uso só podem ser desativados.
              </p>
            </div>
            <button
              onClick={() => { setShowNewStatus(!showNewStatus); setNewStatusForm(emptyStatusForm); }}
              className="qa-btn-primary h-8 px-3 text-[11px] flex items-center gap-1 no-glow"
            >
              <Plus className="h-3 w-3" /> Novo Status
            </button>
          </div>

          {showNewStatus && (
            <div className="mb-3 rounded-xl p-3 border space-y-3" style={{ borderColor: "hsl(220 13% 91%)", background: "hsl(220 20% 97%)" }}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-5 space-y-1">
                  <Label className="text-[10px] uppercase">Nome exibido</Label>
                  <Input
                    value={newStatusForm.nome}
                    onChange={e => setNewStatusForm(p => ({ ...p, nome: e.target.value, codigo: p.codigo || slugify(e.target.value) }))}
                    className="h-9 bg-white border-slate-200 text-slate-700 uppercase"
                    placeholder="ENVIADO AO ÓRGÃO"
                  />
                </div>
                <div className="md:col-span-4 space-y-1">
                  <Label className="text-[10px] uppercase">Código (estável)</Label>
                  <Input
                    value={newStatusForm.codigo}
                    onChange={e => setNewStatusForm(p => ({ ...p, codigo: slugify(e.target.value) }))}
                    className="h-9 bg-white border-slate-200 text-slate-700 font-mono"
                    placeholder="enviado_ao_orgao"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase">Ordem</Label>
                  <Input type="number" value={newStatusForm.ordem}
                    onChange={e => setNewStatusForm(p => ({ ...p, ordem: e.target.value }))}
                    className="h-9 bg-white border-slate-200 text-slate-700 font-mono text-right" placeholder="0" />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-[10px] uppercase">Cor</Label>
                  <Input type="color" value={newStatusForm.cor}
                    onChange={e => setNewStatusForm(p => ({ ...p, cor: e.target.value }))}
                    className="h-9 w-full p-1 bg-white border-slate-200" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Descrição (opcional)</Label>
                <Input value={newStatusForm.descricao}
                  onChange={e => setNewStatusForm(p => ({ ...p, descricao: e.target.value }))}
                  className="h-9 bg-white border-slate-200 text-slate-700" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {([
                  ["finalizador", "FINALIZADOR"],
                  ["exige_data_protocolo", "EXIGE DATA PROTOCOLO"],
                  ["exige_numero_protocolo", "EXIGE Nº PROTOCOLO"],
                  ["visivel_cliente", "VISÍVEL P/ CLIENTE"],
                  ["visivel_equipe", "VISÍVEL P/ EQUIPE"],
                ] as const).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-[10px] uppercase text-slate-600 cursor-pointer">
                    <Switch checked={(newStatusForm as any)[k]} onCheckedChange={(v) => setNewStatusForm(p => ({ ...p, [k]: v }))} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowNewStatus(false)} className="h-9 px-3 rounded-lg hover:bg-slate-100 text-slate-500 text-[11px]">Cancelar</button>
                <button onClick={handleAddStatus} disabled={savingStatus}
                  className="h-9 px-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-[11px] flex items-center gap-1">
                  {savingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Criar
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {statuses.map(s => {
              const isEditing = editingStatusId === s.id;
              return (
                <div key={s.id} className={`rounded-lg px-3 py-2 text-[12px] transition-colors ${isEditing ? "bg-slate-50 border border-slate-200" : "hover:bg-slate-50"} group`}>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <div className="md:col-span-5 space-y-1">
                          <Label className="text-[10px] uppercase">Nome exibido</Label>
                          <Input value={editStatusForm.nome} onChange={e => setEditStatusForm(p => ({ ...p, nome: e.target.value }))}
                            className="h-8 bg-white border-slate-200 text-slate-700 uppercase text-xs" />
                        </div>
                        <div className="md:col-span-4 space-y-1">
                          <Label className="text-[10px] uppercase">Código</Label>
                          <Input value={editStatusForm.codigo} onChange={e => setEditStatusForm(p => ({ ...p, codigo: slugify(e.target.value) }))}
                            className="h-8 bg-white border-slate-200 text-slate-700 font-mono text-xs" />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-[10px] uppercase">Ordem</Label>
                          <Input type="number" value={editStatusForm.ordem} onChange={e => setEditStatusForm(p => ({ ...p, ordem: e.target.value }))}
                            className="h-8 bg-white border-slate-200 text-slate-700 font-mono text-right text-xs" />
                        </div>
                        <div className="md:col-span-1 space-y-1">
                          <Label className="text-[10px] uppercase">Cor</Label>
                          <Input type="color" value={editStatusForm.cor} onChange={e => setEditStatusForm(p => ({ ...p, cor: e.target.value }))}
                            className="h-8 w-full p-1 bg-white border-slate-200" />
                        </div>
                      </div>
                      <Input value={editStatusForm.descricao} placeholder="Descrição (opcional)"
                        onChange={e => setEditStatusForm(p => ({ ...p, descricao: e.target.value }))}
                        className="h-8 bg-white border-slate-200 text-slate-700 text-xs" />
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {([
                          ["finalizador", "FINALIZADOR"],
                          ["exige_data_protocolo", "EXIGE DATA PROTOCOLO"],
                          ["exige_numero_protocolo", "EXIGE Nº PROTOCOLO"],
                          ["visivel_cliente", "VISÍVEL P/ CLIENTE"],
                          ["visivel_equipe", "VISÍVEL P/ EQUIPE"],
                        ] as const).map(([k, label]) => (
                          <label key={k} className="flex items-center gap-2 text-[10px] uppercase text-slate-600 cursor-pointer">
                            <Switch checked={(editStatusForm as any)[k]} onCheckedChange={(v) => setEditStatusForm(p => ({ ...p, [k]: v }))} />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingStatusId(null)} className="h-8 px-3 rounded-lg hover:bg-slate-100 text-slate-500 text-[11px]">Cancelar</button>
                        <button onClick={() => handleUpdateStatus(s.id)} disabled={savingStatus}
                          className="h-8 px-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-[11px] flex items-center gap-1">
                          {savingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full shrink-0 border" style={{ background: s.cor || "#cbd5e1", borderColor: "hsl(220 13% 85%)" }} />
                      <span className={`flex-1 truncate font-medium ${s.ativo ? "" : "line-through opacity-50"}`} style={{ color: "hsl(220 20% 25%)" }}>{s.nome}</span>
                      <span className="font-mono text-[10px] shrink-0 text-slate-400 truncate max-w-[160px]" title={s.codigo}>{s.codigo}</span>
                      <span className="font-mono text-[10px] shrink-0 text-slate-500">#{s.ordem}</span>
                      <Switch checked={s.ativo} onCheckedChange={() => handleToggleStatusAtivo(s)} />
                      <button onClick={() => startEditStatus(s)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => handleDeleteStatus(s.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500" title="Excluir (bloqueado se em uso)">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {statuses.length === 0 && <p className="text-xs text-center py-4" style={{ color: "hsl(220 10% 62%)" }}>Nenhum status cadastrado</p>}
          </div>
        </div>
      )}

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

      {/* Configurações de Monitoramento */}
      {isAdmin && <MonitoramentoToggles />}
    </div>
  );
}

function MonitoramentoToggles() {
  const { enabled, loading, setEnabled } = useMonitoramentoConfig();

  const handleToggle = async (key: any, value: boolean) => {
    try {
      await setEnabled(key, value);
      toast.success(value ? "Bloco ativado" : "Bloco desativado");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    }
  };

  return (
    <div className="qa-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Settings className="h-4 w-4" style={{ color: "hsl(230 80% 56%)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>
          Configurações de Monitoramento
        </span>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "hsl(220 10% 62%)" }}>
        Controle quais blocos aparecem na página <span className="font-semibold">Operação → Monitoramento</span>.
        Blocos desativados não executam queries.
      </p>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {BLOCOS_MONITORAMENTO.map((b) => (
            <label key={b.key}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer transition-colors"
              style={{ borderColor: "hsl(220 13% 91%)" }}>
              <Switch
                checked={!!enabled[b.key]}
                onCheckedChange={(v) => handleToggle(b.key, v)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium" style={{ color: "hsl(220 20% 25%)" }}>{b.label}</div>
                <div className="text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>{b.descricao}</div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

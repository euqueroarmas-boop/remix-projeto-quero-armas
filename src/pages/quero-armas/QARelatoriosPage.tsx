import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, Clock, CheckCircle, TrendingUp, Users, FileText,
  BarChart3, PieChart as PieChartIcon, Bell, RefreshCw, ChevronDown, ChevronUp, Save, X, Mail,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, LineChart, Line,
} from "recharts";

interface ItemVenda {
  id: number;
  status: string;
  data_protocolo: string | null;
  data_deferimento: string | null;
  data_ultima_atualizacao: string | null;
  data_vencimento: string | null;
  servico_id: number | null;
  venda_id: number;
  numero_processo: string | null;
  valor: number | null;
  numero_craf: string | null;
  numero_gte: string | null;
  numero_cr: string | null;
  numero_posse: string | null;
  numero_porte: string | null;
  numero_sigma: string | null;
  numero_sinarm: string | null;
  registro_cad: string | null;
}

interface Venda {
  id: number;
  data_cadastro: string;
  status: string;
  cliente_id: number;
  valor_a_pagar: number | null;
  forma_pagamento: string | null;
}

interface Cliente {
  id: number;
  nome_completo: string;
  celular: string | null;
}

interface Servico {
  id: number;
  nome_servico: string;
}

interface PendingItem {
  itemId: number;
  clienteNome: string;
  clienteCelular: string | null;
  servicoNome: string;
  status: string;
  dataCadastro: string;
  diasPendente: number;
  urgency: "green" | "yellow" | "red" | "critical";
}

const URGENCY_CONFIG = {
  critical: { label: "VENCIDO (+30d)", bg: "bg-red-900/40", text: "text-red-300", border: "border-red-700", dot: "bg-red-500" },
  red: { label: "URGENTE (25-30d)", bg: "bg-red-900/20", text: "text-red-400", border: "border-red-800", dot: "bg-red-500" },
  yellow: { label: "ATENÇÃO (10-24d)", bg: "bg-yellow-900/20", text: "text-yellow-400", border: "border-yellow-800", dot: "bg-yellow-500" },
  green: { label: "NO PRAZO (<10d)", bg: "bg-emerald-900/20", text: "text-emerald-400", border: "border-emerald-800", dot: "bg-emerald-500" },
};

const PIE_COLORS = ["#22c55e", "#eab308", "#ef4444", "#991b1b"];
const FINISHED_STATUSES = ["DEFERIDO", "CONCLUÍDO", "DESISTIU", "RESTITUÍDO", "INDEFERIDO"];

const STATUS_OPTIONS = [
  "À INICIAR", "À FAZER", "PRONTO PARA ANÁLISE", "EM ANÁLISE",
  "AGUARDANDO DOCUMENTAÇÃO", "PASTA FÍSICA - AGUARDANDO LIBERAÇÃO",
  "DEFERIDO", "INDEFERIDO", "CONCLUÍDO", "DESISTIU", "RESTITUÍDO",
];

const EDIT_FIELDS: { key: string; label: string; type: "date" | "text" }[] = [
  { key: "status", label: "Status", type: "text" },
  { key: "data_protocolo", label: "Data Protocolo", type: "date" },
  { key: "data_deferimento", label: "Data Deferimento", type: "date" },
  { key: "data_vencimento", label: "Data Vencimento", type: "date" },
  { key: "numero_processo", label: "Nº Processo", type: "text" },
  { key: "numero_craf", label: "Nº CRAF", type: "text" },
  { key: "numero_gte", label: "Nº GTE", type: "text" },
  { key: "numero_cr", label: "Nº CR", type: "text" },
  { key: "numero_posse", label: "Nº Posse", type: "text" },
  { key: "numero_porte", label: "Nº Porte", type: "text" },
  { key: "numero_sigma", label: "Nº SIGMA", type: "text" },
  { key: "numero_sinarm", label: "Nº SINARM", type: "text" },
  { key: "registro_cad", label: "Registro CAD", type: "text" },
];

function getDaysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgency(days: number): PendingItem["urgency"] {
  if (days >= 30) return "critical";
  if (days >= 25) return "red";
  if (days >= 10) return "yellow";
  return "green";
}

const inputClass = "w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#333]";

export default function QARelatoriosPage() {
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertSending, setAlertSending] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [tab, setTab] = useState<"pendentes" | "graficos">("pendentes");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [iRes, vRes, cRes, sRes] = await Promise.all([
      supabase.from("qa_itens_venda" as any).select("*"),
      supabase.from("qa_vendas" as any).select("*"),
      supabase.from("qa_clientes" as any).select("id, nome_completo, celular"),
      supabase.from("qa_servicos" as any).select("id, nome_servico"),
    ]);
    setItens((iRes.data as any[]) || []);
    setVendas((vRes.data as any[]) || []);
    setClientes((cRes.data as any[]) || []);
    setServicos((sRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const clienteMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const servicoMap = useMemo(() => new Map(servicos.map(s => [s.id, s])), [servicos]);
  const vendaMap = useMemo(() => new Map(vendas.map(v => [v.id, v])), [vendas]);

  const pendingItems = useMemo(() => {
    return itens
      .filter(i => !FINISHED_STATUSES.includes((i.status || "").toUpperCase()))
      .map(item => {
        const venda = vendaMap.get(item.venda_id);
        if (!venda) return null;
        const cliente = clienteMap.get(venda.cliente_id);
        const servico = item.servico_id ? servicoMap.get(item.servico_id) : null;
        const dataCadastro = venda.data_cadastro;
        const dias = getDaysSince(dataCadastro);
        return {
          itemId: item.id,
          clienteNome: cliente?.nome_completo || "—",
          clienteCelular: cliente?.celular || null,
          servicoNome: servico?.nome_servico || `Serviço #${item.servico_id || "?"}`,
          status: item.status || "Sem status",
          dataCadastro,
          diasPendente: dias,
          urgency: getUrgency(dias),
        } as PendingItem;
      })
      .filter(Boolean)
      .sort((a, b) => b!.diasPendente - a!.diasPendente) as PendingItem[];
  }, [itens, vendaMap, clienteMap, servicoMap]);

  const handleExpand = useCallback((itemId: number) => {
    if (expandedId === itemId) {
      setExpandedId(null);
      setEditForm({});
      return;
    }
    const item = itens.find(i => i.id === itemId);
    if (!item) return;
    setExpandedId(itemId);
    const form: Record<string, string> = {};
    EDIT_FIELDS.forEach(f => {
      form[f.key] = (item as any)[f.key] || "";
    });
    setEditForm(form);
  }, [expandedId, itens]);

  const handleSave = async () => {
    if (!expandedId) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      EDIT_FIELDS.forEach(f => {
        const val = editForm[f.key]?.trim() || null;
        updates[f.key] = val;
      });
      updates.data_ultima_atualizacao = new Date().toISOString().slice(0, 10);

      const { error } = await supabase
        .from("qa_itens_venda" as any)
        .update(updates)
        .eq("id", expandedId);

      if (error) throw error;

      // Update local state
      setItens(prev => prev.map(i => i.id === expandedId ? { ...i, ...updates } : i));
      setExpandedId(null);
      setEditForm({});
    } catch (e: any) {
      alert("Erro ao salvar: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  // --- Charts data ---
  const urgencyDistribution = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0, critical: 0 };
    pendingItems.forEach(i => counts[i.urgency]++);
    return [
      { name: "No Prazo (<10d)", value: counts.green },
      { name: "Atenção (10-24d)", value: counts.yellow },
      { name: "Urgente (25-30d)", value: counts.red },
      { name: "Vencido (+30d)", value: counts.critical },
    ];
  }, [pendingItems]);

  const statusDistribution = useMemo(() => {
    const map = new Map<string, number>();
    itens.forEach(i => {
      const s = i.status || "Sem status";
      map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [itens]);

  const serviceRanking = useMemo(() => {
    const map = new Map<string, number>();
    itens.forEach(i => {
      const s = i.servico_id ? servicoMap.get(i.servico_id)?.nome_servico || `#${i.servico_id}` : "N/A";
      map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name: name.length > 30 ? name.slice(0, 28) + "…" : name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [itens, servicoMap]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { total: number; deferidos: number }>();
    vendas.forEach(v => {
      const month = v.data_cadastro?.slice(0, 7);
      if (!month) return;
      if (!map.has(month)) map.set(month, { total: 0, deferidos: 0 });
      map.get(month)!.total++;
    });
    itens.forEach(i => {
      if ((i.status || "").toUpperCase() === "DEFERIDO" && i.data_deferimento) {
        const month = i.data_deferimento.slice(0, 7);
        if (!map.has(month)) map.set(month, { total: 0, deferidos: 0 });
        map.get(month)!.deferidos++;
      }
    });
    return Array.from(map.entries())
      .map(([month, d]) => ({ month, ...d }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [vendas, itens]);

  const revenueByStatus = useMemo(() => {
    const map = new Map<string, number>();
    vendas.forEach(v => {
      const s = v.status || "Sem status";
      map.set(s, (map.get(s) || 0) + (v.valor_a_pagar || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [vendas]);

  const topClients = useMemo(() => {
    const map = new Map<number, number>();
    vendas.forEach(v => map.set(v.cliente_id, (map.get(v.cliente_id) || 0) + 1));
    return Array.from(map.entries())
      .map(([id, count]) => ({ name: clienteMap.get(id)?.nome_completo || `#${id}`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [vendas, clienteMap]);

  const getCriticalItems = () => {
    const critical = pendingItems.filter(i => i.urgency === "red" || i.urgency === "critical");
    return critical.map(i => ({ clienteNome: i.clienteNome, celular: i.clienteCelular, servico: i.servicoNome, dias: i.diasPendente, status: i.status }));
  };

  const sendWhatsAppAlerts = async () => {
    setAlertSending(true);
    try {
      const items = getCriticalItems();
      const res = await supabase.functions.invoke("qa-whatsapp-alerts", {
        body: { items, channel: "whatsapp" },
      });
      if (res.error) throw res.error;
      alert(`WhatsApp: ${items.length} alerta(s) enviado(s)!`);
    } catch (e: any) {
      alert("Erro WhatsApp: " + (e.message || e));
    } finally {
      setAlertSending(false);
    }
  };

  const sendEmailAlerts = async () => {
    setEmailSending(true);
    try {
      const items = getCriticalItems();
      const res = await supabase.functions.invoke("qa-whatsapp-alerts", {
        body: { items, channel: "email" },
      });
      if (res.error) throw res.error;
      alert(`E-mail enviado para eu@queroarmas.com.br!`);
    } catch (e: any) {
      alert("Erro e-mail: " + (e.message || e));
    } finally {
      setEmailSending(false);
    }
  };

  const totalPendentes = pendingItems.length;
  const totalCriticos = pendingItems.filter(i => i.urgency === "red" || i.urgency === "critical").length;
  const totalDeferidos = itens.filter(i => (i.status || "").toUpperCase() === "DEFERIDO").length;
  const totalItens = itens.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080f]">
        <RefreshCw className="h-5 w-5 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-200 tracking-tight">Relatórios</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Visão completa de serviços, pendências e performance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-[#141414] border border-[#1c1c1c] text-neutral-400 hover:text-neutral-200 transition-colors">
            <RefreshCw className="h-3 w-3" /> Atualizar
          </button>
          <button
            onClick={sendWhatsAppAlerts}
            disabled={alertSending || totalCriticos === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-emerald-900/30 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50 transition-colors disabled:opacity-40"
          >
            <Bell className="h-3 w-3" />
            {alertSending ? "Enviando..." : `Alertar WhatsApp (${totalCriticos})`}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de Serviços", value: totalItens, icon: FileText, color: "text-blue-400" },
          { label: "Pendentes", value: totalPendentes, icon: Clock, color: "text-yellow-400" },
          { label: "Críticos (25d+)", value: totalCriticos, icon: AlertTriangle, color: "text-red-400" },
          { label: "Deferidos", value: totalDeferidos, icon: CheckCircle, color: "text-emerald-400" },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{kpi.label}</span>
            </div>
            <div className={`text-xl font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0d0d0d] border border-[#1c1c1c] rounded-lg p-1 w-fit">
        {[
          { key: "pendentes" as const, label: "Serviços Pendentes", icon: Clock },
          { key: "graficos" as const, label: "Gráficos", icon: BarChart3 },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all ${
              tab === t.key ? "bg-[#7a1528]/20 text-[#e8a0ad]" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <t.icon className="h-3 w-3" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "pendentes" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 text-[10px]">
            {Object.entries(URGENCY_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={cfg.text}>{cfg.label}</span>
              </div>
            ))}
          </div>

          <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 px-3 py-2 border-b border-[#1c1c1c] text-[10px] text-neutral-500 uppercase tracking-wider">
              <span>Cliente</span>
              <span>Serviço</span>
              <span className="text-center">Status</span>
              <span className="text-center">Dias</span>
              <span className="text-center">Urgência</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {pendingItems.length === 0 ? (
                <div className="p-8 text-center text-neutral-600 text-sm">Nenhum serviço pendente 🎉</div>
              ) : (
                pendingItems.map(item => {
                  const cfg = URGENCY_CONFIG[item.urgency];
                  const isExpanded = expandedId === item.itemId;
                  return (
                    <div key={item.itemId}>
                      <div
                        onClick={() => handleExpand(item.itemId)}
                        className={`grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 px-3 py-2 border-b border-[#111] text-xs cursor-pointer select-none ${cfg.bg} hover:brightness-125 transition-all`}
                      >
                        <span className="text-neutral-300 truncate flex items-center gap-1">
                          {isExpanded ? <ChevronUp className="h-3 w-3 shrink-0 text-neutral-500" /> : <ChevronDown className="h-3 w-3 shrink-0 text-neutral-500" />}
                          {item.clienteNome}
                        </span>
                        <span className="text-neutral-400 truncate">{item.servicoNome}</span>
                        <span className="text-neutral-500 text-center text-[10px]">{item.status}</span>
                        <span className={`font-mono font-bold text-center ${cfg.text}`}>{item.diasPendente}d</span>
                        <div className="flex justify-center">
                          <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} ${item.urgency === "critical" ? "animate-pulse" : ""}`} />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-[#0a0a0a] border-b border-[#1c1c1c] px-3 py-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-neutral-300">Editar — {item.servicoNome}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedId(null); setEditForm({}); }}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-neutral-500 hover:text-neutral-300 bg-[#141414] border border-[#1c1c1c] transition-colors"
                              >
                                <X className="h-3 w-3" /> Cancelar
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                disabled={saving}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-emerald-400 bg-emerald-900/20 border border-emerald-800/30 hover:bg-emerald-900/40 transition-colors disabled:opacity-40"
                              >
                                <Save className="h-3 w-3" /> {saving ? "Salvando..." : "Salvar"}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {EDIT_FIELDS.map(field => (
                              <div key={field.key}>
                                <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{field.label}</label>
                                {field.key === "status" ? (
                                  <select
                                    value={editForm[field.key] || ""}
                                    onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    className={inputClass}
                                  >
                                    <option value="">Selecionar...</option>
                                    {STATUS_OPTIONS.map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={editForm[field.key] || ""}
                                    onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    placeholder={field.type === "date" ? "DD/MM/AAAA" : "—"}
                                    className={inputClass}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "graficos" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Distribuição por Urgência" icon={PieChartIcon}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={urgencyDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {urgencyDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 12 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Serviços por Status" icon={BarChart3}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusDistribution} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis type="number" tick={{ fill: "#555", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#888", fontSize: 9 }} width={140} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#7a1528" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Tendência Mensal" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="month" tick={{ fill: "#555", fontSize: 10 }} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="total" stroke="#7a1528" name="Vendas" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="deferidos" stroke="#22c55e" name="Deferidos" strokeWidth={2} dot={{ r: 3 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Serviços Mais Vendidos" icon={FileText}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={serviceRanking} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis type="number" tick={{ fill: "#555", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#888", fontSize: 8 }} width={160} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#a52338" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Faturamento por Status" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueByStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 9 }} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Valor"]} />
                <Bar dataKey="value" fill="#eab308" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Clientes com Mais Vendas" icon={Users}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topClients} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis type="number" tick={{ fill: "#555", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#888", fontSize: 9 }} width={160} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Vendas" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-3.5 w-3.5 text-neutral-500" />
        <span className="text-xs font-medium text-neutral-300">{title}</span>
      </div>
      {children}
    </div>
  );
}

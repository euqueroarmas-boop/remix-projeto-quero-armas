import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, Clock, CheckCircle, TrendingUp, Users, FileText,
  BarChart3, PieChart as PieChartIcon, Bell, RefreshCw, ChevronDown, ChevronUp, Save, X, Mail, Search,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, LineChart, Line, AreaChart, Area,
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
  email: string | null;
  cpf: string | null;
}

interface Servico {
  id: number;
  nome_servico: string;
}

interface PendingItem {
  itemId: number;
  clienteNome: string;
  clienteCelular: string | null;
  clienteEmail: string | null;
  clienteCpf: string | null;
  servicoNome: string;
  status: string;
  dataCadastro: string;
  diasPendente: number;
  urgency: "green" | "yellow" | "red" | "critical";
}

const URGENCY_CONFIG = {
  critical: { label: "VENCIDO (+30d)", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500", ring: "ring-red-100" },
  red: { label: "URGENTE (25-30d)", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500", ring: "ring-orange-100" },
  yellow: { label: "ATENÇÃO (10-24d)", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", ring: "ring-amber-100" },
  green: { label: "NO PRAZO (<10d)", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", ring: "ring-emerald-100" },
};

const PIE_COLORS = ["#10b981", "#f59e0b", "#f97316", "#ef4444"];
const CHART_BLUE = "hsl(230, 80%, 56%)";
const CHART_INDIGO = "hsl(245, 58%, 51%)";
const CHART_EMERALD = "#10b981";
const CHART_AMBER = "#f59e0b";

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
  { key: "numero_craf", label: "Nº SIGMA", type: "text" },
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

function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function dateBrToIso(v: string): string | null {
  if (!v) return null;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function isoToBr(v: string | null): string {
  if (!v) return "";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const tooltipStyle = {
  background: "white",
  border: "1px solid hsl(220, 13%, 91%)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

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
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"cliente" | "servico" | "status" | "dias">("dias");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(col === "dias" ? "desc" : "asc");
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [iRes, vRes, cRes, sRes] = await Promise.all([
        supabase.from("qa_itens_venda" as any).select("*"),
        supabase.from("qa_vendas" as any).select("*"),
        supabase.from("qa_clientes" as any).select("id, nome_completo, celular, email, cpf"),
        supabase.from("qa_servicos" as any).select("id, nome_servico"),
      ]);
      setItens((iRes.data as any[]) || []);
      setVendas((vRes.data as any[]) || []);
      setClientes((cRes.data as any[]) || []);
      setServicos((sRes.data as any[]) || []);
    } catch (err) {
      console.error("[QARelatorios] load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const _loadedRef = useRef(false);
  useEffect(() => { if (_loadedRef.current) return; _loadedRef.current = true; load(); }, []);

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
          clienteEmail: cliente?.email || null,
          clienteCpf: cliente?.cpf || null,
          servicoNome: servico?.nome_servico || `Serviço #${item.servico_id || "?"}`,
          status: item.status || "Sem status",
          dataCadastro,
          diasPendente: dias,
          urgency: getUrgency(dias),
        } as PendingItem;
      })
      .filter(Boolean) as PendingItem[];
  }, [itens, vendaMap, clienteMap, servicoMap]);

  const filteredPendingItems = useMemo(() => {
    let list = pendingItems;
    if (search.trim()) {
      const s = search.toLowerCase().replace(/[.\-\/]/g, "");
      list = list.filter(item => {
        const nome = (item.clienteNome || "").toLowerCase();
        const email = (item.clienteEmail || "").toLowerCase();
        const celular = (item.clienteCelular || "").replace(/\D/g, "");
        const cpf = (item.clienteCpf || "").replace(/\D/g, "");
        const servico = (item.servicoNome || "").toLowerCase();
        return nome.includes(s) || email.includes(s) || celular.includes(s) || cpf.includes(s) || servico.includes(s);
      });
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortCol === "cliente") return dir * a.clienteNome.localeCompare(b.clienteNome, "pt-BR");
      if (sortCol === "servico") return dir * a.servicoNome.localeCompare(b.servicoNome, "pt-BR");
      if (sortCol === "status") return dir * a.status.localeCompare(b.status, "pt-BR");
      return dir * (a.diasPendente - b.diasPendente);
    });
  }, [pendingItems, search, sortCol, sortDir]);

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
      const raw = (item as any)[f.key] || "";
      form[f.key] = f.type === "date" ? isoToBr(raw) : raw;
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
        if (f.type === "date") {
          updates[f.key] = val ? dateBrToIso(val) : null;
        } else {
          updates[f.key] = val;
        }
      });
      updates.data_ultima_atualizacao = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("qa_itens_venda" as any)
        .update(updates)
        .eq("id", expandedId);
      if (error) throw error;
      setItens(prev => prev.map(i => i.id === expandedId ? { ...i, ...updates } : i));
      setExpandedId(null);
      setEditForm({});
    } catch (e: any) {
      alert("Erro ao salvar: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

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
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-400 tracking-wider">Carregando relatórios...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Relatórios</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visão completa de serviços, pendências e performance</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={load} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
          <button
            onClick={sendWhatsAppAlerts}
            disabled={alertSending || totalCriticos === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-all shadow-sm disabled:opacity-40"
          >
            <Bell className="h-3.5 w-3.5" />
            {alertSending ? "Enviando..." : `WhatsApp (${totalCriticos})`}
          </button>
          <button
            onClick={sendEmailAlerts}
            disabled={emailSending || totalCriticos === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all shadow-sm disabled:opacity-40"
          >
            <Mail className="h-3.5 w-3.5" />
            {emailSending ? "Enviando..." : `E-mail (${totalCriticos})`}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total de Serviços", value: totalItens, icon: FileText, color: "text-blue-600", bgIcon: "bg-blue-50" },
          { label: "Pendentes", value: totalPendentes, icon: Clock, color: "text-amber-600", bgIcon: "bg-amber-50" },
          { label: "Críticos (25d+)", value: totalCriticos, icon: AlertTriangle, color: "text-red-600", bgIcon: "bg-red-50" },
          { label: "Deferidos", value: totalDeferidos, icon: CheckCircle, color: "text-emerald-600", bgIcon: "bg-emerald-50" },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-8 h-8 rounded-lg ${kpi.bgIcon} flex items-center justify-center`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{kpi.label}</span>
            </div>
            <div className={`text-2xl font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200/80 rounded-xl p-1 w-fit shadow-sm">
        {[
          { key: "pendentes" as const, label: "Serviços Pendentes", icon: Clock },
          { key: "graficos" as const, label: "Gráficos", icon: BarChart3 },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.key
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "pendentes" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, CPF, e-mail, telefone ou serviço..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-[11px]">
              {Object.entries(URGENCY_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <span className={`font-medium ${cfg.text}`}>{cfg.label}</span>
                </div>
              ))}
            </div>
            {search && (
              <span className="text-xs text-slate-500">{filteredPendingItems.length} resultado(s)</span>
            )}
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-[1fr_1fr_160px_50px_60px] gap-3 px-4 py-3 border-b border-slate-100 text-[11px] text-slate-500 uppercase tracking-wider font-medium bg-slate-50/80">
              {([
                { col: "cliente" as const, label: "Cliente", align: "" },
                { col: "servico" as const, label: "Serviço", align: "" },
                { col: "status" as const, label: "Status", align: "text-right" },
                { col: "dias" as const, label: "Dias", align: "text-right" },
              ] as const).map(h => (
                <button
                  key={h.col}
                  onClick={() => toggleSort(h.col)}
                  className={`flex items-center gap-1 ${h.align} hover:text-slate-700 transition-colors cursor-pointer select-none ${h.align === "text-right" ? "justify-end" : ""}`}
                >
                  {h.label}
                  {sortCol === h.col ? (
                    sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3 opacity-30" />
                  )}
                </button>
              ))}
              <span className="text-right">Urgência</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {filteredPendingItems.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">{search ? "Nenhum resultado encontrado" : "Nenhum serviço pendente 🎉"}</div>
              ) : (
                filteredPendingItems.map(item => {
                  const cfg = URGENCY_CONFIG[item.urgency];
                  const isExpanded = expandedId === item.itemId;
                  return (
                    <div key={item.itemId}>
                      <div
                        onClick={() => handleExpand(item.itemId)}
                        className={`grid grid-cols-[1fr_1fr_160px_50px_60px] gap-3 px-4 py-3 border-b border-slate-100 text-sm cursor-pointer select-none ${cfg.bg} hover:brightness-[0.97] transition-all`}
                      >
                        <span className="text-slate-700 truncate flex items-center gap-1.5 font-medium">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                          {item.clienteNome}
                        </span>
                        <span className="text-slate-500 truncate text-xs">{item.servicoNome}</span>
                        <span className={`text-right text-[10px] font-medium ${cfg.text}`}>{item.status}</span>
                        <span className={`font-mono font-bold text-right text-xs ${cfg.text}`}>{item.diasPendente}d</span>
                        <div className="flex justify-end items-center">
                          <div className={`w-3 h-3 rounded-full ${cfg.dot} ${item.urgency === "critical" ? "animate-pulse" : ""} ring-2 ${cfg.ring}`} />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-700">Editar — {item.servicoNome}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedId(null); setEditForm({}); }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 bg-white border border-slate-200 transition-colors shadow-sm"
                              >
                                <X className="h-3 w-3" /> Cancelar
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                disabled={saving}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-40"
                              >
                                <Save className="h-3 w-3" /> {saving ? "Salvando..." : "Salvar"}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {EDIT_FIELDS.map(field => (
                              <div key={field.key}>
                                <label className="block text-[11px] text-slate-500 uppercase tracking-wider font-medium mb-1.5">{field.label}</label>
                                {field.key === "status" ? (
                                  <select
                                    value={editForm[field.key] || ""}
                                    onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
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
                                    onChange={e => {
                                      const raw = e.target.value;
                                      const val = field.type === "date" ? applyDateMask(raw) : raw.toUpperCase();
                                      setEditForm(prev => ({ ...prev, [field.key]: val }));
                                    }}
                                    placeholder={field.type === "date" ? "DD/MM/AAAA" : "—"}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Distribuição por Urgência" icon={PieChartIcon}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={urgencyDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3} strokeWidth={2} stroke="white">
                  {urgencyDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Serviços por Status" icon={BarChart3}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusDistribution} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 93%)" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#64748b", fontSize: 9 }} width={140} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill={CHART_BLUE} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Tendência Mensal" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDef" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_EMERALD} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={CHART_EMERALD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 93%)" />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="total" stroke={CHART_BLUE} fill="url(#gradTotal)" name="Vendas" strokeWidth={2} />
                <Area type="monotone" dataKey="deferidos" stroke={CHART_EMERALD} fill="url(#gradDef)" name="Deferidos" strokeWidth={2} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Serviços Mais Vendidos" icon={FileText}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={serviceRanking} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 93%)" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#64748b", fontSize: 8 }} width={160} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill={CHART_INDIGO} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Faturamento por Status" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueByStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 93%)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 9 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Valor"]} />
                <Bar dataKey="value" fill={CHART_AMBER} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Clientes com Mais Vendas" icon={Users}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topClients} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 93%)" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#64748b", fontSize: 9 }} width={160} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={CHART_BLUE} radius={[0, 6, 6, 0]} name="Vendas" />
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
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-slate-500" />
        </div>
        <span className="text-sm font-semibold text-slate-700">{title}</span>
      </div>
      {children}
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from "react";
import { adminQuery } from "@/lib/adminApi";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataPanel } from "@/components/admin/ui/AdminPrimitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  RefreshCw, Loader2, ChevronLeft, ChevronRight, Copy, ExternalLink,
  AlertTriangle, CheckCircle2, Clock, DollarSign, Users,
  FileText, CreditCard, Webhook, Eye, Search, ArrowLeft,
  TrendingUp, TrendingDown, BarChart3, Target, Crown, Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const PER_PAGE = 20;

// ─── Status helpers ───
const SERVICE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  contract_generated: { label: "Contrato Gerado", color: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  payment_pending: { label: "Pgto Pendente", color: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  payment_under_review: { label: "Em Revisão", color: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
  paid: { label: "Pago", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  active: { label: "Ativo", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  overdue: { label: "Inadimplente", color: "bg-red-500/15 text-red-400 border-red-500/25" },
  suspended: { label: "Suspenso", color: "bg-red-500/15 text-red-400 border-red-500/25" },
  cancelled: { label: "Cancelado", color: "bg-muted/50 text-muted-foreground border-border/60" },
};

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  PENDING: { label: "Pendente", color: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  RECEIVED: { label: "Recebido", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  CONFIRMED: { label: "Confirmado", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  OVERDUE: { label: "Vencido", color: "bg-red-500/15 text-red-400 border-red-500/25" },
  REFUNDED: { label: "Estornado", color: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
  REFUND_REQUESTED: { label: "Estorno Solicitado", color: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
};

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; color: string }> }) {
  const s = map[status] || { label: status, color: "bg-muted/50 text-muted-foreground border-border/60" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${s.color}`}>{s.label}</span>;
}

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// ─── Metric Card ───
function FinMetricCard({ title, value, icon: Icon, color, subtitle, trend }: {
  title: string; value: string | number; icon: any; color: string;
  subtitle?: string; trend?: { value: number; label: string };
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">{title}</p>
          <p className={`text-xl font-bold font-mono tabular-nums ${color} mt-1`}>{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-1 text-[10px] ${trend.value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}% {trend.label}</span>
            </div>
          )}
        </div>
        <div className="p-2 rounded-md bg-muted/40 shrink-0"><Icon className={`h-4 w-4 ${color} opacity-60`} /></div>
      </div>
    </div>
  );
}

// ─── Revenue Chart ───
function RevenueChart({ allPayments, contracts }: { allPayments: any[]; contracts: any[] }) {
  const [range, setRange] = useState("30d");

  const chartData = useMemo(() => {
    const now = new Date();
    const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
    const start = new Date(now.getTime() - days * 86400000);

    const confirmed = allPayments.filter((p) =>
      ["RECEIVED", "CONFIRMED"].includes(p.payment_status) && new Date(p.created_at) >= start
    );

    const recQuoteIds = new Set(contracts.filter((c: any) => c.contract_type === "recorrente").map((c: any) => c.quote_id));

    const buckets: Record<string, { date: string; total: number; recorrente: number; avulso: number }> = {};

    const groupBy = days <= 30 ? "day" : days <= 90 ? "week" : "month";

    confirmed.forEach((p) => {
      const d = new Date(p.created_at);
      let key: string;
      if (groupBy === "day") key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      else if (groupBy === "week") {
        const weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        key = `Sem ${weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
      } else key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

      if (!buckets[key]) buckets[key] = { date: key, total: 0, recorrente: 0, avulso: 0 };
      const amt = Number(p.amount) || 0;
      buckets[key].total += amt;
      if (recQuoteIds.has(p.quote_id)) buckets[key].recorrente += amt;
      else buckets[key].avulso += amt;
    });

    return Object.values(buckets);
  }, [allPayments, contracts, range]);

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-foreground">Receita</p>
        <div className="flex gap-1">
          {["7d", "30d", "90d", "ano"].map((r) => (
            <Button key={r} variant={range === r ? "default" : "ghost"} size="sm" className="h-6 text-[10px] px-2"
              onClick={() => setRange(r)}>{r === "ano" ? "Ano" : r}</Button>
          ))}
        </div>
      </div>
      {chartData.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">Sem dados para o período</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="recorrente" name="Recorrente" fill="hsl(142 76% 36%)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="avulso" name="Avulso" fill="hsl(217 91% 60%)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Funnel ───
function FinanceFunnel({ contracts, payments }: { contracts: any[]; payments: any[] }) {
  const steps = useMemo(() => {
    const generated = contracts.length;
    const pending = payments.filter((p) => ["pending", "PENDING"].includes(p.payment_status)).length;
    const confirmed = payments.filter((p) => ["RECEIVED", "CONFIRMED"].includes(p.payment_status)).length;
    const active = contracts.filter((c: any) => ["active", "paid"].includes(c.service_status)).length;
    return [
      { label: "Contratos Gerados", value: generated, color: "bg-blue-500" },
      { label: "Pgto Pendente", value: pending, color: "bg-amber-500" },
      { label: "Pgto Confirmado", value: confirmed, color: "bg-emerald-500" },
      { label: "Clientes Ativos", value: active, color: "bg-primary" },
    ];
  }, [contracts, payments]);

  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
      <p className="text-xs font-bold text-foreground">Funil Financeiro</p>
      <div className="space-y-2">
        {steps.map((s, i) => {
          const pct = (s.value / max) * 100;
          const convRate = i > 0 && steps[i - 1].value > 0 ? ((s.value / steps[i - 1].value) * 100).toFixed(0) : null;
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-foreground">{s.value}</span>
                  {convRate && <span className="text-[9px] text-muted-foreground">({convRate}%)</span>}
                </div>
              </div>
              <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Top Clients ───
function TopClients({ allPayments, customers, contracts }: { allPayments: any[]; customers: any[]; contracts: any[] }) {
  const ranked = useMemo(() => {
    const map: Record<string, { id: string; name: string; total: number; overdue: number }> = {};
    allPayments.forEach((p) => {
      const contract = contracts.find((c: any) => c.quote_id === p.quote_id);
      const customer = contract ? customers.find((cu: any) => cu.id === contract.customer_id) : null;
      if (!customer) return;
      if (!map[customer.id]) map[customer.id] = { id: customer.id, name: customer.nome_fantasia || customer.razao_social, total: 0, overdue: 0 };
      const amt = Number(p.amount) || 0;
      if (["RECEIVED", "CONFIRMED"].includes(p.payment_status)) map[customer.id].total += amt;
      if (p.payment_status === "OVERDUE") map[customer.id].overdue += amt;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [allPayments, customers, contracts]);

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
      <p className="text-xs font-bold text-foreground flex items-center gap-1.5"><Crown className="h-3.5 w-3.5 text-amber-400" /> Top Clientes</p>
      {ranked.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados</p> : (
        <div className="space-y-1.5">
          {ranked.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 text-[11px]">
              <span className="w-5 text-center font-mono text-muted-foreground">{i + 1}</span>
              <span className="flex-1 truncate text-foreground">{r.name}</span>
              <span className="font-mono text-emerald-400">{fmt(r.total)}</span>
              {r.overdue > 0 && <span className="font-mono text-red-400 text-[10px]">({fmt(r.overdue)} em atraso)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Alerts Block ───
function AlertsBlock({ alerts }: { alerts: { dueTodayCount: number; overdueCount: number; pendingContractsCount: number; webhookErrorsCount: number } }) {
  const items = [
    alerts.dueTodayCount > 0 && { icon: Clock, text: `${alerts.dueTodayCount} cobrança(s) vencendo hoje`, color: "text-amber-400" },
    alerts.overdueCount > 0 && { icon: AlertTriangle, text: `${alerts.overdueCount} cobrança(s) vencida(s)`, color: "text-red-400" },
    alerts.pendingContractsCount > 0 && { icon: FileText, text: `${alerts.pendingContractsCount} contrato(s) com pagamento pendente`, color: "text-orange-400" },
    alerts.webhookErrorsCount > 0 && { icon: Webhook, text: `${alerts.webhookErrorsCount} erro(s) de webhook recentes`, color: "text-red-400" },
  ].filter(Boolean) as { icon: any; text: string; color: string }[];

  if (items.length === 0) return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-3">
      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      <span className="text-xs text-emerald-400">Nenhum alerta financeiro no momento.</span>
    </div>
  );

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">⚠ Alertas</p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
          <span className={`text-xs ${item.color}`}>{item.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Billing Detail Panel ───
function BillingDetail({ payment, customers, contracts, webhooks, onClose }: {
  payment: any; customers: any[]; contracts: any[]; webhooks: any[]; onClose: () => void;
}) {
  const contract = contracts.find((c: any) => c.quote_id === payment.quote_id);
  const customer = contract ? customers.find((cu: any) => cu.id === contract.customer_id) : null;
  const relatedWebhooks = webhooks.filter((w: any) => {
    const p = typeof w.payload === "string" ? JSON.parse(w.payload) : w.payload;
    return p?.payment?.id === payment.asaas_payment_id;
  });
  const copyText = (text: string) => navigator.clipboard.writeText(text);

  const isLgpd = customer?.status_cliente === "excluido_lgpd";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 gap-1 text-xs"><ArrowLeft className="h-3.5 w-3.5" /> Voltar</Button>
        <h3 className="text-sm font-bold text-foreground">Detalhe da Cobrança</h3>
      </div>
      {isLgpd && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <div>
            <p className="text-xs font-bold text-red-400">Registro histórico restrito (LGPD)</p>
            <p className="text-[10px] text-red-400/80">Titular anonimizado. Operação bloqueada por LGPD. Sem ações de cobrança, reenvio ou reativação.</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cliente</p>
          {customer ? (
            customer.status_cliente === "excluido_lgpd" ? (
              <p className="text-xs text-red-400 italic">Titular anonimizado (LGPD)</p>
            ) : (<>
              <p className="text-xs text-foreground">{customer.nome_fantasia || customer.razao_social}</p>
              <p className="text-[11px] text-muted-foreground">{customer.email}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{customer.cnpj_ou_cpf}</p>
            </>)
          ) : <p className="text-xs text-muted-foreground">Cliente não vinculado</p>}
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pagamento</p>
          <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Status:</span><StatusBadge status={payment.payment_status || "pending"} map={PAYMENT_STATUS_MAP} /></div>
          <p className="text-xs text-muted-foreground">Método: <span className="text-foreground">{payment.billing_type || payment.payment_method || "—"}</span></p>
          <p className="text-xs text-muted-foreground">Vencimento: <span className="text-foreground font-mono">{payment.due_date ? new Date(payment.due_date).toLocaleDateString("pt-BR") : "—"}</span></p>
          <p className="text-xs text-muted-foreground">Valor: <span className="text-foreground font-mono">{payment.amount ? fmt(Number(payment.amount)) : "—"}</span></p>
          {payment.asaas_payment_id && (
            <div className="flex items-center gap-1"><span className="text-[10px] text-muted-foreground font-mono">{payment.asaas_payment_id}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyText(payment.asaas_payment_id)}><Copy className="h-3 w-3" /></Button></div>
          )}
          {payment.asaas_invoice_url && <a href={payment.asaas_invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary text-[11px] underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Abrir fatura</a>}
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contrato</p>
          {contract ? (<>
            <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Status:</span><StatusBadge status={contract.service_status || "contract_generated"} map={SERVICE_STATUS_MAP} /></div>
            <p className="text-xs text-muted-foreground">Tipo: <span className="text-foreground">{contract.contract_type || "—"}</span></p>
            <p className="text-xs text-muted-foreground">Valor mensal: <span className="text-foreground font-mono">{contract.monthly_value ? fmt(Number(contract.monthly_value)) : "—"}</span></p>
            {contract.activated_at && <p className="text-xs text-muted-foreground">Ativado: <span className="text-foreground font-mono">{new Date(contract.activated_at).toLocaleString("pt-BR")}</span></p>}
          </>) : <p className="text-xs text-muted-foreground">Sem contrato vinculado</p>}
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Webhooks ({relatedWebhooks.length})</p>
          {relatedWebhooks.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum webhook</p> : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {relatedWebhooks.map((w: any) => (
                <div key={w.id} className="flex items-center gap-2 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${w.processed ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <span className="text-muted-foreground font-mono">{new Date(w.created_at).toLocaleString("pt-BR")}</span>
                  <span className="text-foreground">{w.event}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════
// ─── Main Component ───
// ═══════════════════════════════
export default function AdminFinanceiro() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("inteligencia");
  const [page, setPage] = useState(0);

  // Raw data
  const [payments, setPayments] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [totalPayments, setTotalPayments] = useState(0);

  // Dashboard
  const [dashData, setDashData] = useState({
    monthRevenue: 0, prevMonthRevenue: 0, pendingPayments: 0, confirmedPayments: 0,
    activeContracts: 0, overduePayments: 0, openAmount: 0,
  });

  const [alerts, setAlerts] = useState({ dueTodayCount: 0, overdueCount: 0, pendingContractsCount: 0, webhookErrorsCount: 0 });
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
    const today = now.toISOString().split("T")[0];

    const paymentFilters: any[] = [];
    if (filterStatus !== "all") paymentFilters.push({ column: "payment_status", op: "eq", value: filterStatus });

    try {
      const results = await adminQuery([
        // 0: paginated payments
        { table: "payments", select: "*", count: true, filters: paymentFilters, order: { column: "created_at", ascending: false }, range: { from: page * PER_PAGE, to: (page + 1) * PER_PAGE - 1 } },
        // 1: customers
        { table: "customers", select: "id, razao_social, nome_fantasia, cnpj_ou_cpf, email, user_id, responsavel, status_cliente" },
        // 2: contracts
        { table: "contracts", select: "id, customer_id, quote_id, contract_type, monthly_value, service_status, signed, activated_at, status, created_at" },
        // 3: webhooks
        { table: "asaas_webhooks", select: "id, event, payload, processed, created_at", order: { column: "created_at", ascending: false }, limit: 100 },
        // 4: ALL payments for analytics
        { table: "payments", select: "id, amount, payment_status, billing_type, payment_method, created_at, due_date, quote_id, asaas_payment_id" },
        // 5: this month confirmed
        { table: "payments", select: "amount, quote_id", filters: [{ column: "payment_status", op: "in", value: ["RECEIVED", "CONFIRMED"] }, { column: "created_at", op: "gte", value: monthStart }] },
        // 6: prev month confirmed
        { table: "payments", select: "amount, quote_id", filters: [{ column: "payment_status", op: "in", value: ["RECEIVED", "CONFIRMED"] }, { column: "created_at", op: "gte", value: prevMonthStart }, { column: "created_at", op: "lte", value: prevMonthEnd }] },
        // 7: pending payments (fetch data for LGPD filtering)
        { table: "payments", select: "id, amount, quote_id", filters: [{ column: "payment_status", op: "in", value: ["pending", "PENDING"] }] },
        // 8: overdue payments (fetch data for LGPD filtering)
        { table: "payments", select: "id, quote_id", filters: [{ column: "payment_status", op: "eq", value: "OVERDUE" }] },
        // 9: active contracts (fetch data for LGPD filtering)
        { table: "contracts", select: "id, customer_id", filters: [{ column: "service_status", op: "in", value: ["active", "paid"] }] },
        // 10: open amounts (fetch data for LGPD filtering)
        { table: "payments", select: "amount, quote_id", filters: [{ column: "payment_status", op: "in", value: ["pending", "PENDING", "OVERDUE"] }] },
        // 11: due today (fetch data for LGPD filtering)
        { table: "payments", select: "id, quote_id", filters: [{ column: "due_date", op: "eq", value: today }, { column: "payment_status", op: "in", value: ["pending", "PENDING"] }] },
        // 12: pending contracts (fetch data for LGPD filtering)
        { table: "contracts", select: "id, customer_id", filters: [{ column: "service_status", op: "eq", value: "payment_pending" }] },
        // 13: unprocessed webhooks
        { table: "asaas_webhooks", select: "id", count: true, limit: 0, filters: [{ column: "processed", op: "eq", value: false }] },
      ]);

      const allCustomers = (results[1].data as any[]) || [];
      const allContracts = (results[2].data as any[]) || [];

      // Single source of truth for the operational financial layer
      const isOperationalCustomer = (customer: any) =>
        Boolean(customer) && String(customer.status_cliente || "").toLowerCase() !== "excluido_lgpd";

      const operationalCustomers = allCustomers.filter(isOperationalCustomer);
      const operationalCustomerIds = new Set(operationalCustomers.map((customer: any) => customer.id));

      const isOperationalContract = (contract: any) =>
        Boolean(contract?.customer_id) && operationalCustomerIds.has(contract.customer_id);

      const operationalContracts = allContracts.filter(isOperationalContract);
      const operationalQuoteIds = new Set(
        operationalContracts.map((contract: any) => contract.quote_id).filter(Boolean)
      );

      const isOperationalPayment = (payment: any) =>
        Boolean(payment?.quote_id) && operationalQuoteIds.has(payment.quote_id);

      const rawPayments = (results[0].data as any[]) || [];
      const rawAllPayments = (results[4].data as any[]) || [];
      const operationalPayments = rawPayments.filter(isOperationalPayment);
      const operationalAllPayments = rawAllPayments.filter(isOperationalPayment);
      const statusFilteredOperationalPayments = filterStatus === "all"
        ? operationalAllPayments
        : operationalAllPayments.filter((payment: any) => payment.payment_status === filterStatus);

      setPayments(operationalPayments);
      setTotalPayments(statusFilteredOperationalPayments.length);
      setCustomers(operationalCustomers);
      setContracts(operationalContracts);
      setWebhooks((results[3].data as any[]) || []);
      setAllPayments(operationalAllPayments);

      const opMonthConfirmed = ((results[5].data as any[]) || []).filter(isOperationalPayment);
      const opPrevMonthConfirmed = ((results[6].data as any[]) || []).filter(isOperationalPayment);
      const opPending = ((results[7].data as any[]) || []).filter(isOperationalPayment);
      const opOverdue = ((results[8].data as any[]) || []).filter(isOperationalPayment);
      const opActiveContracts = ((results[9].data as any[]) || []).filter(isOperationalContract);
      const opOpenAmounts = ((results[10].data as any[]) || []).filter(isOperationalPayment);
      const opDueToday = ((results[11].data as any[]) || []).filter(isOperationalPayment);
      const opPendingContracts = ((results[12].data as any[]) || []).filter(isOperationalContract);

      const monthRevenue = opMonthConfirmed.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      const prevMonthRevenue = opPrevMonthConfirmed.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      const openAmount = opOpenAmounts.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

      setDashData({
        monthRevenue, prevMonthRevenue, openAmount,
        confirmedPayments: opMonthConfirmed.length,
        pendingPayments: opPending.length,
        overduePayments: opOverdue.length,
        activeContracts: opActiveContracts.length,
      });

      setAlerts({
        dueTodayCount: opDueToday.length,
        overdueCount: opOverdue.length,
        pendingContractsCount: opPendingContracts.length,
        webhookErrorsCount: results[13].count || 0,
      });
    } catch (err) { console.error("Finance fetch error:", err); }
    setLoading(false);
  }, [page, filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("fin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "asaas_webhooks" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  // ─── Computed metrics ───
  const metrics = useMemo(() => {
    const confirmed = allPayments.filter((p) => ["RECEIVED", "CONFIRMED"].includes(p.payment_status));
    const totalRevenue = confirmed.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const ticketMedio = confirmed.length > 0 ? totalRevenue / confirmed.length : 0;

    // MRR from active recurring contracts
    const mrr = contracts
      .filter((c: any) => ["active", "paid"].includes(c.service_status) && c.contract_type === "recorrente")
      .reduce((s, c: any) => s + (Number(c.monthly_value) || 0), 0);

    // Churn
    const cancelled = contracts.filter((c: any) => ["suspended", "cancelled"].includes(c.service_status)).length;
    const totalContracts = contracts.length || 1;
    const churnPct = (cancelled / totalContracts) * 100;

    // Inadimplência
    const overdue = allPayments.filter((p) => p.payment_status === "OVERDUE");
    const overdueTotal = overdue.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const overduePct = allPayments.length > 0 ? (overdue.length / allPayments.length) * 100 : 0;

    // LTV
    const customerPayments: Record<string, number> = {};
    confirmed.forEach((p) => {
      const contract = contracts.find((c: any) => c.quote_id === p.quote_id);
      if (contract?.customer_id) {
        customerPayments[contract.customer_id] = (customerPayments[contract.customer_id] || 0) + (Number(p.amount) || 0);
      }
    });
    const customerIds = Object.keys(customerPayments);
    const ltv = customerIds.length > 0 ? customerIds.reduce((s, id) => s + customerPayments[id], 0) / customerIds.length : 0;

    // Month trend
    const mrrTrend = dashData.prevMonthRevenue > 0
      ? ((dashData.monthRevenue - dashData.prevMonthRevenue) / dashData.prevMonthRevenue) * 100
      : 0;

    // Service breakdown
    const byService: Record<string, { revenue: number; contracts: number; payments: number }> = {};
    confirmed.forEach((p) => {
      const contract = contracts.find((c: any) => c.quote_id === p.quote_id);
      const type = contract?.contract_type || "avulso";
      if (!byService[type]) byService[type] = { revenue: 0, contracts: 0, payments: 0 };
      byService[type].revenue += Number(p.amount) || 0;
      byService[type].payments += 1;
    });
    contracts.forEach((c: any) => {
      const type = c.contract_type || "avulso";
      if (!byService[type]) byService[type] = { revenue: 0, contracts: 0, payments: 0 };
      byService[type].contracts += 1;
    });

    return { ticketMedio, mrr, churnPct, cancelled, overdueTotal, overduePct, overdue: overdue.length, ltv, mrrTrend, byService };
  }, [allPayments, contracts, dashData]);

  // Helpers
  const getCustomerForPayment = (p: any) => {
    const contract = contracts.find((c: any) => c.quote_id === p.quote_id);
    return contract ? customers.find((cu: any) => cu.id === contract.customer_id) : null;
  };
  const getContractForPayment = (p: any) => contracts.find((c: any) => c.quote_id === p.quote_id);
  const copyText = (text: string) => navigator.clipboard.writeText(text);

  const filteredPayments = filterSearch
    ? payments.filter((p) => {
        const customer = getCustomerForPayment(p);
        const search = filterSearch.toLowerCase();
        return (customer?.razao_social?.toLowerCase().includes(search)) || (customer?.nome_fantasia?.toLowerCase().includes(search)) || (customer?.email?.toLowerCase().includes(search)) || (p.asaas_payment_id?.toLowerCase().includes(search));
      })
    : payments;

  const totalPages = Math.ceil(totalPayments / PER_PAGE);

  if (selectedPayment) {
    return <BillingDetail payment={selectedPayment} customers={customers} contracts={contracts} webhooks={webhooks} onClose={() => setSelectedPayment(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Central Financeira</h2>
          <p className="text-xs text-muted-foreground">Inteligência financeira · Receita · Inadimplência</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchAll} className="text-[11px] h-8 gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {loading && payments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando...</div>
      ) : (
        <>
          {/* KPI Cards - Row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <FinMetricCard title="Faturamento (Mês)" value={fmt(dashData.monthRevenue)} icon={DollarSign} color="text-emerald-400"
              trend={dashData.prevMonthRevenue > 0 ? { value: metrics.mrrTrend, label: "vs mês ant." } : undefined} />
            <FinMetricCard title="MRR" value={fmt(metrics.mrr)} icon={TrendingUp} color="text-blue-400" subtitle="Receita recorrente mensal" />
            <FinMetricCard title="Ticket Médio" value={fmt(metrics.ticketMedio)} icon={Target} color="text-purple-400" />
            <FinMetricCard title="LTV Médio" value={fmt(metrics.ltv)} icon={Crown} color="text-amber-400" subtitle="Valor médio por cliente" />
            <FinMetricCard title="Inadimplência" value={`${metrics.overduePct.toFixed(1)}%`} icon={AlertTriangle} color="text-red-400"
              subtitle={`${metrics.overdue} cobranças · ${fmt(metrics.overdueTotal)}`} />
            <FinMetricCard title="Churn" value={`${metrics.churnPct.toFixed(1)}%`} icon={Percent} color="text-orange-400"
              subtitle={`${metrics.cancelled} contratos cancelados/suspensos`} />
          </div>

          {/* Row 2 - Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FinMetricCard title="Contratos Ativos" value={dashData.activeContracts} icon={FileText} color="text-blue-400" />
            <FinMetricCard title="Pgto Pendentes" value={dashData.pendingPayments} icon={Clock} color="text-amber-400" />
            <FinMetricCard title="Pgto Confirmados" value={dashData.confirmedPayments} icon={CheckCircle2} color="text-emerald-400" />
            <FinMetricCard title="Valor em Aberto" value={fmt(dashData.openAmount)} icon={CreditCard} color="text-orange-400" />
          </div>

          {/* Alerts */}
          <AlertsBlock alerts={alerts} />

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-muted/30 border border-border/40 flex-wrap h-auto gap-0.5 p-1">
              <TabsTrigger value="inteligencia" className="text-xs gap-1"><BarChart3 className="h-3 w-3" /> Inteligência</TabsTrigger>
              <TabsTrigger value="cobrancas" className="text-xs gap-1"><CreditCard className="h-3 w-3" /> Cobranças</TabsTrigger>
              <TabsTrigger value="clientes" className="text-xs gap-1"><Users className="h-3 w-3" /> Clientes</TabsTrigger>
              <TabsTrigger value="webhooks" className="text-xs gap-1"><Webhook className="h-3 w-3" /> Webhooks</TabsTrigger>
            </TabsList>

            {/* ─── Inteligência Tab ─── */}
            <TabsContent value="inteligencia" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <RevenueChart allPayments={allPayments} contracts={contracts} />
                <FinanceFunnel contracts={contracts} payments={allPayments} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TopClients allPayments={allPayments} customers={customers} contracts={contracts} />
                {/* Service Performance */}
                <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
                  <p className="text-xs font-bold text-foreground">Performance por Tipo</p>
                  {Object.keys(metrics.byService).length === 0 ? <p className="text-xs text-muted-foreground">Sem dados</p> : (
                    <div className="space-y-2">
                      {Object.entries(metrics.byService).map(([type, data]) => (
                        <div key={type} className="flex items-center justify-between text-[11px] border-b border-border/20 pb-1.5">
                          <span className="text-foreground capitalize font-medium">{type}</span>
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <span>{data.contracts} contratos</span>
                            <span>{data.payments} pgtos</span>
                            <span className="text-emerald-400 font-mono">{fmt(data.revenue)}</span>
                            <span className="text-foreground font-mono">{data.payments > 0 ? fmt(data.revenue / data.payments) : "—"}/pgto</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ─── Cobranças Tab ─── */}
            <TabsContent value="cobrancas" className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-2 items-center rounded-lg border border-border/40 bg-card/50 p-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input placeholder="Buscar cliente, ID..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} className="pl-8 h-8 text-xs w-48 bg-muted/30 border-border/50" />
                </div>
                <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
                  <SelectTrigger className="w-36 text-[11px] h-8 bg-muted/30 border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="RECEIVED">Recebido</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                    <SelectItem value="OVERDUE">Vencido</SelectItem>
                    <SelectItem value="REFUNDED">Estornado</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground ml-auto font-mono">{totalPayments} cobranças</span>
              </div>

              {isMobile ? (
                <div className="space-y-2">
                  {filteredPayments.map((p) => {
                    const customer = getCustomerForPayment(p);
                    return (
                      <div key={p.id} className="rounded-lg border border-border/60 bg-card p-3 space-y-2" onClick={() => setSelectedPayment(p)}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-foreground truncate">{customer?.nome_fantasia || customer?.razao_social || "—"}</p>
                          <StatusBadge status={p.payment_status || "pending"} map={PAYMENT_STATUS_MAP} />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="font-mono">{p.amount ? fmt(Number(p.amount)) : "—"}</span>
                          <span className="font-mono">{p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "—"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <DataPanel>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Cliente</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Empresa</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Tipo</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Valor</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Status</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Vencimento</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Método</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Payment ID</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((p) => {
                        const customer = getCustomerForPayment(p);
                        const contract = getContractForPayment(p);
                        return (
                          <TableRow key={p.id} className="border-border/30 hover:bg-muted/20">
                            <TableCell className="text-xs text-foreground">{customer?.responsavel || customer?.razao_social || "—"}</TableCell>
                            <TableCell className="text-[11px] text-muted-foreground truncate max-w-[120px]">{customer?.nome_fantasia || "—"}</TableCell>
                            <TableCell><span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-border/60 bg-muted/30 text-muted-foreground">{contract?.contract_type || p.billing_type || "—"}</span></TableCell>
                            <TableCell className="text-xs font-mono text-foreground">{p.amount ? fmt(Number(p.amount)) : "—"}</TableCell>
                            <TableCell><StatusBadge status={p.payment_status || "pending"} map={PAYMENT_STATUS_MAP} /></TableCell>
                            <TableCell className="text-[11px] text-muted-foreground font-mono">{p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{p.billing_type || p.payment_method || "—"}</TableCell>
                            <TableCell>{p.asaas_payment_id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[80px]">{p.asaas_payment_id}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyText(p.asaas_payment_id)}><Copy className="h-2.5 w-2.5" /></Button>
                              </div>
                            ) : "—"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedPayment(p)} title="Detalhe"><Eye className="h-3 w-3" /></Button>
                                {p.asaas_invoice_url && <a href={p.asaas_invoice_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-6 w-6" title="Fatura"><ExternalLink className="h-3 w-3" /></Button></a>}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </DataPanel>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-xs text-muted-foreground font-mono">{page + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </TabsContent>

            {/* ─── Clientes Tab ─── */}
            <TabsContent value="clientes" className="space-y-4 mt-4">
              <DataPanel>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Nome</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Empresa</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-semibold">E-mail</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Status Contrato</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Valor Contratado</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Acesso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.filter((cu: any) => cu.status_cliente !== "excluido_lgpd").map((cu) => {
                      const contract = contracts.find((c: any) => c.customer_id === cu.id);
                      return (
                        <TableRow key={cu.id} className="border-border/30 hover:bg-muted/20">
                          <TableCell className="text-xs text-foreground font-medium">{cu.responsavel || cu.razao_social}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">{cu.nome_fantasia || "—"}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">{cu.email}</TableCell>
                          <TableCell>{contract ? <StatusBadge status={contract.service_status || "contract_generated"} map={SERVICE_STATUS_MAP} /> : <span className="text-[10px] text-muted-foreground">Sem contrato</span>}</TableCell>
                          <TableCell className="text-xs font-mono text-foreground">{contract?.monthly_value ? fmt(Number(contract.monthly_value)) : "—"}</TableCell>
                          <TableCell>{cu.user_id ? <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">✓ Portal</span> : <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-border/60 bg-muted/30 text-muted-foreground">Sem acesso</span>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </DataPanel>
            </TabsContent>

            {/* ─── Webhooks Tab ─── */}
            <TabsContent value="webhooks" className="space-y-4 mt-4">
              <DataPanel>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Data/Hora</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Evento</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Processado</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Payment ID</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Cliente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.map((w) => {
                      const payload = typeof w.payload === "string" ? JSON.parse(w.payload) : w.payload;
                      const paymentId = payload?.payment?.id || "—";
                      const relPayment = allPayments.find((p: any) => p.asaas_payment_id === paymentId);
                      const relCustomer = relPayment ? getCustomerForPayment(relPayment) : null;
                      return (
                        <TableRow key={w.id} className={cn("border-border/30 hover:bg-muted/20", !w.processed && "bg-amber-500/5")}>
                          <TableCell className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">{new Date(w.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-xs text-foreground">{w.event}</TableCell>
                          <TableCell>{w.processed ? <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">✓ Sim</span> : <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-amber-500/25 bg-amber-500/10 text-amber-400">⏳ Não</span>}</TableCell>
                          <TableCell className="text-[10px] font-mono text-muted-foreground">{paymentId}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">{relCustomer?.nome_fantasia || relCustomer?.razao_social || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </DataPanel>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

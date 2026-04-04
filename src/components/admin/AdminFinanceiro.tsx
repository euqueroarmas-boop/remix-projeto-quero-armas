import { useState, useEffect, useCallback } from "react";
import { adminQuery, adminQuerySingle } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader, DataPanel, MetricCard } from "@/components/admin/ui/AdminPrimitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw, Loader2, ChevronLeft, ChevronRight, Copy, ExternalLink,
  AlertTriangle, CheckCircle2, Clock, XCircle, DollarSign, Users,
  FileText, CreditCard, Webhook, Eye, Search, X, Ban, Unlock,
  Mail, ArrowLeft,
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

// ─── Dashboard Cards ───
function FinanceDashboard({ data }: { data: any }) {
  const cards = [
    { title: "Faturamento (Mês)", value: `R$ ${(data.monthRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-emerald-400" },
    { title: "Pagamentos Pendentes", value: data.pendingPayments, icon: Clock, color: "text-amber-400" },
    { title: "Pagamentos Confirmados", value: data.confirmedPayments, icon: CheckCircle2, color: "text-emerald-400" },
    { title: "Contratos Ativos", value: data.activeContracts, icon: FileText, color: "text-blue-400" },
    { title: "Inadimplentes", value: data.overduePayments, icon: AlertTriangle, color: "text-red-400" },
    { title: "Valor em Aberto", value: `R$ ${(data.openAmount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: CreditCard, color: "text-orange-400" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div key={c.title} className="rounded-lg border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">{c.title}</p>
              <p className={`text-xl font-bold font-mono tabular-nums ${c.color} mt-1`}>{c.value}</p>
            </div>
            <div className="p-2 rounded-md bg-muted/40">
              <c.icon className={`h-4 w-4 ${c.color} opacity-60`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Alerts Block ───
function AlertsBlock({ alerts }: { alerts: any }) {
  const items = [
    alerts.dueTodayCount > 0 && { icon: Clock, text: `${alerts.dueTodayCount} cobrança(s) vencendo hoje`, color: "text-amber-400" },
    alerts.overdueCount > 0 && { icon: AlertTriangle, text: `${alerts.overdueCount} cobrança(s) vencida(s)`, color: "text-red-400" },
    alerts.pendingContractsCount > 0 && { icon: FileText, text: `${alerts.pendingContractsCount} contrato(s) com pagamento pendente`, color: "text-orange-400" },
    alerts.webhookErrorsCount > 0 && { icon: Webhook, text: `${alerts.webhookErrorsCount} erro(s) de webhook recentes`, color: "text-red-400" },
  ].filter(Boolean) as { icon: any; text: string; color: string }[];

  if (items.length === 0) return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      <span className="text-xs text-emerald-400">Nenhum alerta financeiro no momento.</span>
    </div>
  );

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-2">⚠ Alertas Financeiros</p>
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
  payment: any;
  customers: any[];
  contracts: any[];
  webhooks: any[];
  onClose: () => void;
}) {
  const contract = contracts.find((c: any) => c.quote_id === payment.quote_id);
  const customer = contract ? customers.find((cu: any) => cu.id === contract.customer_id) : null;
  const relatedWebhooks = webhooks.filter((w: any) => {
    const p = typeof w.payload === "string" ? JSON.parse(w.payload) : w.payload;
    return p?.payment?.id === payment.asaas_payment_id;
  });

  const copyText = (text: string) => navigator.clipboard.writeText(text);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 gap-1 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Button>
        <h3 className="text-sm font-bold text-foreground">Detalhe da Cobrança</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Client info */}
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cliente</p>
          {customer ? (
            <>
              <p className="text-xs text-foreground">{customer.nome_fantasia || customer.razao_social}</p>
              <p className="text-[11px] text-muted-foreground">{customer.email}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{customer.cnpj_ou_cpf}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Cliente não vinculado</p>
          )}
        </div>

        {/* Payment info */}
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pagamento</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <StatusBadge status={payment.payment_status || "pending"} map={PAYMENT_STATUS_MAP} />
          </div>
          <p className="text-xs text-muted-foreground">Método: <span className="text-foreground">{payment.billing_type || payment.payment_method || "—"}</span></p>
          <p className="text-xs text-muted-foreground">Vencimento: <span className="text-foreground font-mono">{payment.due_date ? new Date(payment.due_date).toLocaleDateString("pt-BR") : "—"}</span></p>
          <p className="text-xs text-muted-foreground">Valor: <span className="text-foreground font-mono">R$ {payment.amount ? Number(payment.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}</span></p>
          {payment.asaas_payment_id && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground font-mono">{payment.asaas_payment_id}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyText(payment.asaas_payment_id)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
          {payment.asaas_invoice_url && (
            <a href={payment.asaas_invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary text-[11px] underline flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Abrir fatura
            </a>
          )}
        </div>

        {/* Contract info */}
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contrato</p>
          {contract ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <StatusBadge status={contract.service_status || "contract_generated"} map={SERVICE_STATUS_MAP} />
              </div>
              <p className="text-xs text-muted-foreground">Tipo: <span className="text-foreground">{contract.contract_type || "—"}</span></p>
              <p className="text-xs text-muted-foreground">Valor mensal: <span className="text-foreground font-mono">R$ {contract.monthly_value ? Number(contract.monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}</span></p>
              <p className="text-xs text-muted-foreground">Assinado: <span className="text-foreground">{contract.signed ? "Sim" : "Não"}</span></p>
              {contract.activated_at && <p className="text-xs text-muted-foreground">Ativado em: <span className="text-foreground font-mono">{new Date(contract.activated_at).toLocaleString("pt-BR")}</span></p>}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Sem contrato vinculado</p>
          )}
        </div>

        {/* Webhook history */}
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Webhooks ({relatedWebhooks.length})</p>
          {relatedWebhooks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum webhook relacionado</p>
          ) : (
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

// ─── Main Component ───
export default function AdminFinanceiro() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("cobrancas");
  const [page, setPage] = useState(0);

  // Data
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [totalPayments, setTotalPayments] = useState(0);

  // Dashboard
  const [dashData, setDashData] = useState({
    monthRevenue: 0, pendingPayments: 0, confirmedPayments: 0,
    activeContracts: 0, overduePayments: 0, openAmount: 0,
  });

  // Alerts
  const [alerts, setAlerts] = useState({
    dueTodayCount: 0, overdueCount: 0, pendingContractsCount: 0, webhookErrorsCount: 0,
  });

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");

  // Detail
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const today = new Date().toISOString().split("T")[0];

    try {
      // Build payment filters
      const paymentFilters: any[] = [];
      if (filterStatus !== "all") paymentFilters.push({ column: "payment_status", op: "eq", value: filterStatus });

      const results = await adminQuery([
        // 0: payments paginated
        {
          table: "payments", select: "*", count: true,
          filters: paymentFilters,
          order: { column: "created_at", ascending: false },
          range: { from: page * PER_PAGE, to: (page + 1) * PER_PAGE - 1 },
        },
        // 1: customers
        { table: "customers", select: "id, razao_social, nome_fantasia, cnpj_ou_cpf, email, user_id" },
        // 2: contracts
        { table: "contracts", select: "id, customer_id, quote_id, contract_type, monthly_value, service_status, signed, activated_at, status, created_at" },
        // 3: webhooks recent
        {
          table: "asaas_webhooks", select: "id, event, payload, processed, created_at",
          order: { column: "created_at", ascending: false },
          limit: 100,
        },
        // 4: confirmed this month
        {
          table: "payments", select: "amount", count: true, limit: 0,
          filters: [
            { column: "payment_status", op: "in", value: ["RECEIVED", "CONFIRMED"] },
            { column: "created_at", op: "gte", value: monthStart },
          ],
        },
        // 5: month revenue (all confirmed payments)
        {
          table: "payments", select: "amount",
          filters: [
            { column: "payment_status", op: "in", value: ["RECEIVED", "CONFIRMED"] },
            { column: "created_at", op: "gte", value: monthStart },
          ],
        },
        // 6: pending count
        {
          table: "payments", select: "id, amount", count: true, limit: 0,
          filters: [{ column: "payment_status", op: "in", value: ["pending", "PENDING"] }],
        },
        // 7: overdue count
        {
          table: "payments", select: "id", count: true, limit: 0,
          filters: [{ column: "payment_status", op: "eq", value: "OVERDUE" }],
        },
        // 8: active contracts
        {
          table: "contracts", select: "id", count: true, limit: 0,
          filters: [{ column: "service_status", op: "in", value: ["active", "paid"] }],
        },
        // 9: pending amounts
        {
          table: "payments", select: "amount",
          filters: [{ column: "payment_status", op: "in", value: ["pending", "PENDING", "OVERDUE"] }],
        },
        // 10: due today
        {
          table: "payments", select: "id", count: true, limit: 0,
          filters: [{ column: "due_date", op: "eq", value: today }, { column: "payment_status", op: "in", value: ["pending", "PENDING"] }],
        },
        // 11: pending contracts
        {
          table: "contracts", select: "id", count: true, limit: 0,
          filters: [{ column: "service_status", op: "eq", value: "payment_pending" }],
        },
        // 12: webhook errors (unprocessed)
        {
          table: "asaas_webhooks", select: "id", count: true, limit: 0,
          filters: [{ column: "processed", op: "eq", value: false }],
        },
      ]);

      setPayments((results[0].data as any[]) || []);
      setTotalPayments(results[0].count || 0);
      setCustomers((results[1].data as any[]) || []);
      setContracts((results[2].data as any[]) || []);
      setWebhooks((results[3].data as any[]) || []);

      const monthPayments = (results[5].data as any[]) || [];
      const monthRevenue = monthPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      const openPayments = (results[9].data as any[]) || [];
      const openAmount = openPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

      setDashData({
        monthRevenue,
        confirmedPayments: results[4].count || 0,
        pendingPayments: results[6].count || 0,
        overduePayments: results[7].count || 0,
        activeContracts: results[8].count || 0,
        openAmount,
      });

      setAlerts({
        dueTodayCount: results[10].count || 0,
        pendingContractsCount: results[11].count || 0,
        overdueCount: results[7].count || 0,
        webhookErrorsCount: results[12].count || 0,
      });
    } catch (err) {
      console.error("Finance fetch error:", err);
    }
    setLoading(false);
  }, [page, filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Helpers
  const getCustomerForPayment = (p: any) => {
    const contract = contracts.find((c: any) => c.quote_id === p.quote_id);
    return contract ? customers.find((cu: any) => cu.id === contract.customer_id) : null;
  };

  const getContractForPayment = (p: any) => contracts.find((c: any) => c.quote_id === p.quote_id);

  const copyText = (text: string) => navigator.clipboard.writeText(text);

  // Filter payments by search
  const filteredPayments = filterSearch
    ? payments.filter((p) => {
        const customer = getCustomerForPayment(p);
        const search = filterSearch.toLowerCase();
        return (
          (customer?.razao_social?.toLowerCase().includes(search)) ||
          (customer?.nome_fantasia?.toLowerCase().includes(search)) ||
          (customer?.email?.toLowerCase().includes(search)) ||
          (p.asaas_payment_id?.toLowerCase().includes(search)) ||
          (p.payment_status?.toLowerCase().includes(search))
        );
      })
    : payments;

  const totalPages = Math.ceil(totalPayments / PER_PAGE);

  if (selectedPayment) {
    return (
      <BillingDetail
        payment={selectedPayment}
        customers={customers}
        contracts={contracts}
        webhooks={webhooks}
        onClose={() => setSelectedPayment(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Central Financeira</h2>
          <p className="text-xs text-muted-foreground">Gestão de cobranças, contratos e pagamentos</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchAll} className="text-[11px] h-8 gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {loading && payments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando módulo financeiro...
        </div>
      ) : (
        <>
          {/* Dashboard Cards */}
          <FinanceDashboard data={dashData} />

          {/* Alerts */}
          <AlertsBlock alerts={alerts} />

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-muted/30 border border-border/40">
              <TabsTrigger value="cobrancas" className="text-xs gap-1"><CreditCard className="h-3 w-3" /> Cobranças</TabsTrigger>
              <TabsTrigger value="clientes" className="text-xs gap-1"><Users className="h-3 w-3" /> Clientes</TabsTrigger>
              <TabsTrigger value="webhooks" className="text-xs gap-1"><Webhook className="h-3 w-3" /> Webhooks</TabsTrigger>
            </TabsList>

            {/* Cobranças Tab */}
            <TabsContent value="cobrancas" className="space-y-4 mt-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-2 items-center rounded-lg border border-border/40 bg-card/50 p-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente, ID..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="pl-8 h-8 text-xs w-48 bg-muted/30 border-border/50"
                  />
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

              {/* Table */}
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
                          <span className="font-mono">R$ {p.amount ? Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}</span>
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
                            <TableCell className="text-[11px]">
                              <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-border/60 bg-muted/30 text-muted-foreground">
                                {contract?.contract_type || p.billing_type || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-mono text-foreground">R$ {p.amount ? Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}</TableCell>
                            <TableCell><StatusBadge status={p.payment_status || "pending"} map={PAYMENT_STATUS_MAP} /></TableCell>
                            <TableCell className="text-[11px] text-muted-foreground font-mono">{p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{p.billing_type || p.payment_method || "—"}</TableCell>
                            <TableCell>
                              {p.asaas_payment_id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[80px]">{p.asaas_payment_id}</span>
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyText(p.asaas_payment_id)}>
                                    <Copy className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedPayment(p)} title="Detalhe">
                                  <Eye className="h-3 w-3" />
                                </Button>
                                {p.asaas_invoice_url && (
                                  <a href={p.asaas_invoice_url} target="_blank" rel="noopener noreferrer">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Abrir fatura">
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                  </a>
                                )}
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

            {/* Clientes Tab */}
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
                    {customers.map((cu) => {
                      const contract = contracts.find((c: any) => c.customer_id === cu.id);
                      return (
                        <TableRow key={cu.id} className="border-border/30 hover:bg-muted/20">
                          <TableCell className="text-xs text-foreground font-medium">{cu.responsavel || cu.razao_social}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">{cu.nome_fantasia || "—"}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">{cu.email}</TableCell>
                          <TableCell>
                            {contract ? (
                              <StatusBadge status={contract.service_status || "contract_generated"} map={SERVICE_STATUS_MAP} />
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Sem contrato</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-foreground">
                            {contract?.monthly_value ? `R$ ${Number(contract.monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                          </TableCell>
                          <TableCell>
                            {cu.user_id ? (
                              <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">✓ Portal</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-border/60 bg-muted/30 text-muted-foreground">Sem acesso</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </DataPanel>
            </TabsContent>

            {/* Webhooks Tab */}
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
                      // Try to find customer
                      const relPayment = payments.find((p: any) => p.asaas_payment_id === paymentId);
                      const relCustomer = relPayment ? getCustomerForPayment(relPayment) : null;

                      return (
                        <TableRow key={w.id} className={cn("border-border/30 hover:bg-muted/20", !w.processed && "bg-amber-500/5")}>
                          <TableCell className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">{new Date(w.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-xs text-foreground">{w.event}</TableCell>
                          <TableCell>
                            {w.processed ? (
                              <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">✓ Sim</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-amber-500/25 bg-amber-500/10 text-amber-400">⏳ Não</span>
                            )}
                          </TableCell>
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

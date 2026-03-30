import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminQuerySingle, adminQuery } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart3, AlertTriangle, CreditCard, FileText, LogOut, RefreshCw, ChevronLeft, ChevronRight, Eye, Users, Plus, Loader2, Check, Copy, Shield,
  LayoutDashboard, ScrollText, CreditCard as CreditCardIcon, UserCog, Megaphone, ShieldAlert, Webhook, ClipboardCheck, Activity, Stethoscope, FlaskConical, PenTool, TestTube2, Brain, DollarSign, MessageSquareCode,
  Search, Bell, ChevronDown, PanelLeftClose, PanelLeft, Menu,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { StatusPill, SectionHeader, DataPanel } from "@/components/admin/ui/AdminPrimitives";
import AdminSecurityEvents from "@/components/admin/AdminSecurityEvents";
import AdminWebhooks from "@/components/admin/AdminWebhooks";
import AdminAudit from "@/components/admin/AdminAudit";
import AdminRiskMonitor from "@/components/admin/AdminRiskMonitor";
import AdminLeadsProposals from "@/components/admin/AdminLeadsProposals";
import AdminDiagnostics from "@/components/admin/AdminDiagnostics";
import AdminCommandCenter from "@/components/admin/AdminCommandCenter";
import AdminFullscreenMenu from "@/components/admin/AdminFullscreenMenu";
import LogFullscreenViewer from "@/components/admin/LogFullscreenViewer";
import { cn } from "@/lib/utils";

const QAPanel = lazy(() => import("@/components/admin/qa/QAPanel"));
const AdminBlogGenerator = lazy(() => import("@/components/admin/AdminBlogGenerator"));
const AdminTestCenter = lazy(() => import("@/components/admin/AdminTestCenter"));
const AdminPromptIntelligence = lazy(() => import("@/components/admin/AdminPromptIntelligence"));
const AdminRevenueIntelligence = lazy(() => import("@/components/admin/AdminRevenueIntelligence"));
const DevChatPanel = lazy(() => import("@/components/admin/DevChatPanel"));

const ITEMS_PER_PAGE = 20;

// ─── Navigation Structure ───
const NAV_GROUPS = [
  {
    label: "Visão Geral",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operações",
    items: [
      { id: "logs", label: "Logs", icon: ScrollText },
      { id: "errors", label: "Erros", icon: AlertTriangle },
      { id: "payments", label: "Pagamentos", icon: CreditCardIcon },
      { id: "clientes", label: "Clientes", icon: UserCog },
      { id: "leads", label: "Leads & Propostas", icon: Megaphone },
    ],
  },
  {
    label: "Segurança",
    items: [
      { id: "security", label: "Eventos", icon: ShieldAlert },
      { id: "webhooks", label: "Webhooks", icon: Webhook },
      { id: "audit", label: "Auditoria", icon: ClipboardCheck },
      { id: "risk", label: "Monitor de Risco", icon: Activity },
    ],
  },
  {
    label: "Qualidade & Conteúdo",
    items: [
      { id: "diagnostics", label: "Diagnóstico", icon: Stethoscope },
      { id: "qa", label: "QA", icon: FlaskConical },
      { id: "test-center", label: "Centro de Testes", icon: TestTube2 },
      { id: "blog-ai", label: "Blog IA", icon: PenTool },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { id: "prompt-intelligence", label: "Prompt Intelligence", icon: Brain },
      { id: "revenue-intelligence", label: "Receita", icon: DollarSign },
      { id: "dev-chat", label: "DevChat", icon: MessageSquareCode },
    ],
  },
];

// ─── Login ───
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("admin-auth", {
        body: { password },
      });
      if (fnErr || !data?.success) {
        setError(data?.error || "Senha incorreta");
      } else {
        sessionStorage.setItem("admin_token", data.token);
        onLogin();
      }
    } catch {
      setError("Erro ao autenticar");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg font-bold text-foreground">WMTi Operations</h1>
          <p className="text-xs text-muted-foreground mt-1">Centro de Controle · Produção</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Senha de Acesso</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-muted/30 border-border/60 text-foreground h-10"
              />
            </div>
            {error && <p className="text-destructive text-xs bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "Verificando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Types ───
type LogRow = {
  id: string;
  tipo: string;
  status: string;
  mensagem: string;
  payload: any;
  user_id: string | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  asaas_payment_id: string | null;
  payment_method: string | null;
  payment_status: string | null;
  billing_type: string | null;
  created_at: string;
  due_date: string | null;
  asaas_invoice_url: string | null;
  quote_id: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "success" || status === "RECEIVED"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
      : status === "error" || status === "OVERDUE"
      ? "bg-red-500/15 text-red-400 border-red-500/25"
      : status === "warning"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
      : "bg-muted/50 text-muted-foreground border-border/60";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${color}`}>{status}</span>;
}

// ─── Dashboard Stats ───
function Dashboard() {
  const [stats, setStats] = useState({ totalLogs: 0, errors24h: 0, webhooks: 0, payments: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      try {
        const results = await adminQuery([
          { table: "logs_sistema", select: "id", count: true, limit: 0 },
          { table: "logs_sistema", select: "id", count: true, limit: 0, filters: [{ column: "status", op: "eq", value: "error" }, { column: "created_at", op: "gte", value: yesterday }] },
          { table: "asaas_webhooks", select: "id", count: true, limit: 0 },
          { table: "payments", select: "id", count: true, limit: 0 },
        ]);

        setStats({
          totalLogs: results[0].count || 0,
          errors24h: results[1].count || 0,
          webhooks: results[2].count || 0,
          payments: results[3].count || 0,
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
      setLoading(false);
    })();
  }, []);

  const cards = [
    { title: "Total de Logs", value: stats.totalLogs, icon: FileText, color: "text-blue-400" },
    { title: "Erros (24h)", value: stats.errors24h, icon: AlertTriangle, color: "text-red-400" },
    { title: "Webhooks", value: stats.webhooks, icon: BarChart3, color: "text-purple-400" },
    { title: "Pagamentos", value: stats.payments, icon: CreditCard, color: "text-emerald-400" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.title} className="rounded-lg border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">{c.title}</p>
              <p className={`text-2xl font-bold font-mono tabular-nums ${c.color} mt-1`}>
                {loading ? "—" : c.value}
              </p>
            </div>
            <div className={`p-2 rounded-md bg-muted/40`}>
              <c.icon className={`h-4 w-4 ${c.color} opacity-60`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Logs Tab ───
function LogsTab({ onlyErrors = false }: { onlyErrors?: boolean }) {
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterStatus, setFilterStatus] = useState(onlyErrors ? "error" : "all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewerLog, setViewerLog] = useState<LogRow | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const filters: any[] = [];
    if (filterTipo !== "all") filters.push({ column: "tipo", op: "eq", value: filterTipo });
    if (filterStatus !== "all") filters.push({ column: "status", op: "eq", value: filterStatus });

    try {
      const result = await adminQuerySingle({
        table: "logs_sistema",
        select: "*",
        count: true,
        filters,
        order: { column: "created_at", ascending: false },
        range: { from: page * ITEMS_PER_PAGE, to: (page + 1) * ITEMS_PER_PAGE - 1 },
      });
      setLogs((result.data as LogRow[]) || []);
      setTotal(result.count || 0);
    } catch (err) {
      console.error("Logs fetch error:", err);
    }
    setLoading(false);
  }, [page, filterTipo, filterStatus]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 items-center rounded-lg border border-border/40 bg-card/50 p-3">
        <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(0); }}>
          <SelectTrigger className="w-36 text-[11px] h-8 bg-muted/30 border-border/50"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="checkout">Checkout</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="contrato">Contrato</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
            <SelectItem value="pagamento">Pagamento</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        {!onlyErrors && (
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
            <SelectTrigger className="w-32 text-[11px] h-8 bg-muted/30 border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button variant="ghost" size="sm" onClick={fetchLogs} className="text-[11px] h-8 gap-1">
          <RefreshCw className="h-3 w-3" /> Atualizar
        </Button>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono">{total} registros</span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Nenhum log encontrado</div>
      ) : isMobile ? (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className={cn("rounded-lg border bg-card p-3 space-y-2", log.status === "error" && "border-red-500/20")}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-border/60 bg-muted/30 text-muted-foreground">{log.tipo}</span>
                <StatusBadge status={log.status} />
              </div>
              <p className="text-xs text-foreground line-clamp-2">{log.mensagem}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setViewerLog(log)}>
                    Inspeção
                  </Button>
                </div>
              </div>
              {expandedId === log.id && (
                <pre className="text-[10px] text-muted-foreground bg-muted/30 p-3 rounded-md overflow-auto max-h-40 font-mono border border-border/30">{JSON.stringify(log.payload, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      ) : (
        <DataPanel>
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold w-[140px]">Data</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold w-[100px]">Tipo</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold w-[80px]">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Mensagem</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <>
                  <TableRow key={log.id} className={cn("border-border/30 hover:bg-muted/20", log.status === "error" && "bg-red-500/5")}>
                    <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap font-mono">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-border/60 bg-muted/30 text-muted-foreground">{log.tipo}</span>
                    </TableCell>
                    <TableCell><StatusBadge status={log.status} /></TableCell>
                    <TableCell className="text-xs text-foreground max-w-[300px] truncate">{log.mensagem}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setViewerLog(log)}>
                          Inspeção
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === log.id && (
                    <TableRow key={`${log.id}-detail`} className="border-border/20">
                      <TableCell colSpan={5} className="p-0">
                        <pre className="text-[10px] text-muted-foreground bg-muted/20 p-4 overflow-auto max-h-60 font-mono">{JSON.stringify(log.payload, null, 2)}</pre>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
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

      <LogFullscreenViewer log={viewerLog} onClose={() => setViewerLog(null)} />
    </div>
  );
}

// ─── Payments Tab ───
function PaymentsTab() {
  const isMobile = useIsMobile();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [webhookIds, setWebhookIds] = useState<Set<string>>(new Set());

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const results = await adminQuery([
        { table: "payments", select: "*", count: true, order: { column: "created_at", ascending: false }, range: { from: page * ITEMS_PER_PAGE, to: (page + 1) * ITEMS_PER_PAGE - 1 } },
        { table: "asaas_webhooks", select: "payload" },
      ]);
      setPayments((results[0].data as PaymentRow[]) || []);
      setTotal(results[0].count || 0);
      const ids = new Set<string>();
      ((results[1].data as any[]) || []).forEach((w: any) => {
        const paymentId = w.payload?.payment?.id;
        if (paymentId) ids.add(paymentId);
      });
      setWebhookIds(ids);
    } catch (err) {
      console.error("Payments fetch error:", err);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/50 p-3">
        <Button variant="ghost" size="sm" onClick={fetchPayments} className="text-[11px] h-8 gap-1"><RefreshCw className="h-3 w-3" /> Atualizar</Button>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono">{total} pagamentos</span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando...</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Nenhum pagamento encontrado</div>
      ) : isMobile ? (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-border/60 bg-muted/30 text-muted-foreground">{p.billing_type || p.payment_method || "—"}</span>
                <StatusBadge status={p.payment_status || "pending"} />
              </div>
              <div className="text-[11px] space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Data:</span><span className="text-foreground font-mono">{new Date(p.created_at).toLocaleString("pt-BR")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Asaas ID:</span><span className="font-mono text-foreground text-[10px]">{p.asaas_payment_id?.slice(0, 16) || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Webhook:</span><span>{p.asaas_payment_id && webhookIds.has(p.asaas_payment_id) ? "✓ Recebido" : "—"}</span></div>
              </div>
              {p.asaas_invoice_url && (
                <a href={p.asaas_invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary text-[11px] underline block text-right">Abrir Invoice</a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <DataPanel>
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Data</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Asaas ID</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Método</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Webhook</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id} className="border-border/30 hover:bg-muted/20">
                  <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap font-mono">{new Date(p.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-[11px] font-mono text-foreground">{p.asaas_payment_id || "—"}</TableCell>
                  <TableCell><span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-border/60 bg-muted/30 text-muted-foreground">{p.billing_type || p.payment_method || "—"}</span></TableCell>
                  <TableCell><StatusBadge status={p.payment_status || "pending"} /></TableCell>
                  <TableCell>{p.asaas_payment_id && webhookIds.has(p.asaas_payment_id) ? <span className="text-emerald-400 text-[10px]">✓ Recebido</span> : <span className="text-muted-foreground text-[10px]">—</span>}</TableCell>
                  <TableCell>{p.asaas_invoice_url ? <a href={p.asaas_invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary text-[10px] underline">Abrir</a> : "—"}</TableCell>
                </TableRow>
              ))}
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
    </div>
  );
}

// ─── Clientes Tab ───
function ClientesTab() {
  const isMobile = useIsMobile();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [copied, setCopied] = useState("");
  const [auditLogs, setAuditLogs] = useState<Record<string, any>>({});

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const results = await adminQuery([
        { table: "customers", select: "id, razao_social, nome_fantasia, cnpj_ou_cpf, email, user_id, created_at", order: { column: "created_at", ascending: false } },
        { table: "admin_audit_logs", select: "target_id, action, after_state, created_at", filters: [{ column: "action", op: "in", value: ["auto_user_created", "auto_user_creation_failed"] }], order: { column: "created_at", ascending: false } },
      ]);
      setCustomers((results[0].data as any[]) || []);
      const auditMap: Record<string, any> = {};
      ((results[1].data as any[]) || []).forEach((a: any) => {
        if (a.target_id && !auditMap[a.target_id]) auditMap[a.target_id] = a;
      });
      setAuditLogs(auditMap);
    } catch (err) {
      console.error("Customers fetch error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError("E-mail e senha são obrigatórios."); return; }
    if (form.password.length < 6) { setError("Senha deve ter ao menos 6 caracteres."); return; }

    setCreating(true);
    setError("");

    try {
      const adminToken = sessionStorage.getItem("admin_token");
      if (!adminToken) { setError("Sessão admin expirada. Faça login novamente."); setCreating(false); return; }
      
      const { data, error: fnErr } = await supabase.functions.invoke("create-client-user", {
        body: {
          customer_id: selectedCustomerId === "none" ? undefined : selectedCustomerId || undefined,
          email: form.email,
          user_password: form.password,
          name: form.name,
        },
        headers: { "x-admin-token": adminToken },
      });

      if (fnErr || !data?.success) {
        setError(data?.error || "Erro ao criar usuário.");
      } else {
        setResult({ email: form.email, password: form.password });
        fetchCustomers();
      }
    } catch {
      setError("Erro inesperado.");
    }
    setCreating(false);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(""), 2000);
  };

  const getAccessBadge = (c: any) => {
    if (c.user_id) {
      const audit = auditLogs[c.id];
      if (audit?.action === "auto_user_created") {
        const pwdChanged = audit.after_state?.password_change_required === false;
        return (
          <div className="space-y-1">
            <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">✓ Ativo (auto)</span>
            {!pwdChanged && <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-amber-500/25 bg-amber-500/10 text-amber-400 ml-1">Senha temp.</span>}
          </div>
        );
      }
      return <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">✓ Ativo</span>;
    }
    return <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-border/60 bg-muted/30 text-muted-foreground">Sem acesso</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-card/50 p-3">
        <Button variant="ghost" size="sm" onClick={fetchCustomers} className="text-[11px] h-8 gap-1"><RefreshCw className="h-3 w-3" /> Atualizar</Button>
        <Button size="sm" onClick={() => { setShowForm(!showForm); setResult(null); setError(""); }} className="text-[11px] h-8 gap-1"><Plus className="h-3 w-3" /> Criar Acesso</Button>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono">{customers.length} clientes</span>
      </div>

      {showForm && (
        <div className="rounded-xl border border-primary/20 bg-card p-5">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <Check size={18} /> <span className="font-bold text-sm">Usuário criado com sucesso!</span>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border/30">
                <div className="flex items-center justify-between">
                  <div className="min-w-0"><p className="text-[9px] text-muted-foreground uppercase tracking-wider">E-mail</p><p className="text-sm font-mono text-foreground truncate">{result.email}</p></div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(result.email, "email")}>{copied === "email" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-[9px] text-muted-foreground uppercase tracking-wider">Senha</p><p className="text-sm font-mono text-foreground">{result.password}</p></div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(result.password, "pwd")}>{copied === "pwd" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}</Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Envie essas credenciais ao cliente. Acesso em /area-do-cliente</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setResult(null); setShowForm(false); setForm({ email: "", password: "", name: "" }); }}>Fechar</Button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <h3 className="font-bold text-sm text-foreground">Criar Acesso para Cliente</h3>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Vincular a Cliente (opcional)</label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="bg-muted/30 text-xs border-border/50"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (criar sem vínculo)</SelectItem>
                    {customers.filter((c) => !c.user_id).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.razao_social} ({c.cnpj_ou_cpf})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Nome</label><Input placeholder="Nome do usuário" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-muted/30 border-border/50" /></div>
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">E-mail *</label><Input type="email" placeholder="email@cliente.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-muted/30 border-border/50" /></div>
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Senha *</label><Input type="text" placeholder="Mínimo 6 caracteres" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-muted/30 border-border/50" /></div>
              {error && <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={creating}>
                  {creating ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                  Criar Usuário
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Nenhum cliente cadastrado</div>
      ) : isMobile ? (
        <div className="space-y-2">
          {customers.map((c) => (
            <div key={c.id} className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground truncate">{c.nome_fantasia || c.razao_social}</p>
                {getAccessBadge(c)}
              </div>
              <div className="text-[11px] space-y-1 text-muted-foreground">
                <p><span className="text-foreground/70">CNPJ/CPF:</span> {c.cnpj_ou_cpf}</p>
                <p><span className="text-foreground/70">E-mail:</span> {c.email}</p>
                <p><span className="text-foreground/70">Cadastro:</span> {new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
                {auditLogs[c.id] && (
                  <p className="text-primary text-[10px]">{auditLogs[c.id].action === "auto_user_created" ? "🤖 Conta criada automaticamente" : "⚠️ Falha na criação automática"}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataPanel>
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Empresa</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">CNPJ/CPF</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">E-mail</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Acesso Portal</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Origem</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} className="border-border/30 hover:bg-muted/20">
                  <TableCell className="text-xs text-foreground font-medium">{c.nome_fantasia || c.razao_social}</TableCell>
                  <TableCell className="text-[11px] font-mono text-muted-foreground">{c.cnpj_ou_cpf}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{c.email}</TableCell>
                  <TableCell>{getAccessBadge(c)}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {auditLogs[c.id]?.action === "auto_user_created" ? <span className="text-primary">🤖 Auto</span> : auditLogs[c.id]?.action === "auto_user_creation_failed" ? <span className="text-destructive">⚠️ Falha</span> : c.user_id ? "Manual" : "—"}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap font-mono">{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      )}
    </div>
  );
}

// ─── Content Renderer ───
function AdminContent({ activeSection, onNavigate }: { activeSection: string; onNavigate: (s: string) => void }) {
  const fallback = (
    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />Carregando módulo...
    </div>
  );

  switch (activeSection) {
    case "dashboard": return <AdminCommandCenter onNavigate={onNavigate} />;
    case "logs": return <LogsTab />;
    case "errors": return <LogsTab onlyErrors />;
    case "payments": return <PaymentsTab />;
    case "clientes": return <ClientesTab />;
    case "leads": return <AdminLeadsProposals />;
    case "security": return <AdminSecurityEvents />;
    case "webhooks": return <AdminWebhooks />;
    case "audit": return <AdminAudit />;
    case "risk": return <AdminRiskMonitor />;
    case "diagnostics": return <AdminDiagnostics />;
    case "qa": return <Suspense fallback={fallback}><QAPanel /></Suspense>;
    case "test-center": return <Suspense fallback={fallback}><AdminTestCenter onBack={() => onNavigate("dashboard")} /></Suspense>;
    case "blog-ai": return <Suspense fallback={fallback}><AdminBlogGenerator /></Suspense>;
    case "prompt-intelligence": return <Suspense fallback={fallback}><AdminPromptIntelligence /></Suspense>;
    case "revenue-intelligence": return <Suspense fallback={fallback}><AdminRevenueIntelligence /></Suspense>;
    case "dev-chat": return <Suspense fallback={fallback}><DevChatPanel /></Suspense>;
    default: return <AdminCommandCenter onNavigate={onNavigate} />;
  }
}

// ─── Sidebar ───
function AdminSidebar({ activeSection, onNavigate, collapsed, onToggle }: {
  activeSection: string;
  onNavigate: (s: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className={cn(
      "h-screen sticky top-0 flex flex-col bg-[hsl(0,0%,5%)] border-r border-border/40 transition-all duration-300 shrink-0",
      collapsed ? "w-14" : "w-56"
    )}>
      {/* Brand */}
      <div className={cn("flex items-center border-b border-border/30 h-14 shrink-0", collapsed ? "justify-center px-2" : "px-4 gap-3")}>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground truncate">WMTi Ops</p>
            <p className="text-[9px] text-muted-foreground truncate">Centro de Controle</p>
          </div>
        )}
        <button onClick={onToggle} className="p-1.5 rounded-md hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground shrink-0">
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-2">
            {!collapsed && (
              <p className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "w-full flex items-center gap-2.5 transition-all duration-150",
                    collapsed ? "justify-center px-2 py-2.5" : "px-4 py-2",
                    isActive
                      ? "text-primary bg-primary/8 border-r-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive && "text-primary")} />
                  {!collapsed && <span className={cn("text-[11px] truncate", isActive && "font-semibold")}>{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn("border-t border-border/30 shrink-0", collapsed ? "p-2" : "p-3")}>
        <StatusPill status="online" label={collapsed ? undefined : "Produção"} />
      </div>
    </aside>
  );
}

// ─── Topbar ───
function AdminTopbar({ title, onMenuOpen, onLogout }: { title: string; onMenuOpen: () => void; onLogout: () => void }) {
  return (
    <header className="h-14 border-b border-border/30 bg-[hsl(0,0%,5%)] flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu */}
        <button onClick={onMenuOpen} className="md:hidden p-1.5 rounded-md hover:bg-muted/30 text-muted-foreground">
          <Menu className="h-4.5 w-4.5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground truncate">{title}</h2>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill status="online" label="Live" pulse />
        <div className="w-px h-5 bg-border/30 mx-1 hidden sm:block" />
        <Button variant="ghost" size="sm" onClick={onLogout} className="text-[11px] text-muted-foreground hover:text-foreground gap-1.5 h-8">
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}

// ─── Main Page ───
export default function AdminPage() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem("admin_token"));
  const [activeSection, setActiveSection] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  const handleLogout = () => {
    sessionStorage.removeItem("admin_token");
    setAuthed(false);
  };

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    setMenuOpen(false);
  };

  const currentLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeSection)?.label || "Dashboard";

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Fullscreen Menu (mobile) */}
      <AdminFullscreenMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeSection={activeSection}
        onNavigate={handleNavClick}
        onLogout={handleLogout}
      />

      {/* Sidebar - Desktop */}
      {!isMobile && (
        <AdminSidebar
          activeSection={activeSection}
          onNavigate={handleNavClick}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar
          title={currentLabel}
          onMenuOpen={() => setMenuOpen(true)}
          onLogout={handleLogout}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <AdminContent activeSection={activeSection} onNavigate={handleNavClick} />
        </main>
      </div>
    </div>
  );
}

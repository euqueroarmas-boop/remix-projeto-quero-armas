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
  LayoutDashboard, ScrollText, CreditCard as CreditCardIcon, UserCog, Megaphone, ShieldAlert, Webhook, ClipboardCheck, Activity, Stethoscope, FlaskConical, PenTool, TestTube2,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import AdminSecurityEvents from "@/components/admin/AdminSecurityEvents";
import AdminWebhooks from "@/components/admin/AdminWebhooks";
import AdminAudit from "@/components/admin/AdminAudit";
import AdminRiskMonitor from "@/components/admin/AdminRiskMonitor";
import AdminLeadsProposals from "@/components/admin/AdminLeadsProposals";
import AdminDiagnostics from "@/components/admin/AdminDiagnostics";
import AdminCommandCenter from "@/components/admin/AdminCommandCenter";
import AdminFullscreenMenu from "@/components/admin/AdminFullscreenMenu";
import LogFullscreenViewer from "@/components/admin/LogFullscreenViewer";

const QAPanel = lazy(() => import("@/components/admin/qa/QAPanel"));
const AdminBlogGenerator = lazy(() => import("@/components/admin/AdminBlogGenerator"));
const AdminTestCenter = lazy(() => import("@/components/admin/AdminTestCenter"));

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
];

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
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-foreground">🛡️ Painel Administrativo</CardTitle>
          <p className="text-center text-sm text-muted-foreground">WMTi Tecnologia</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Senha de acesso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-foreground"
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verificando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

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
    status === "success"
      ? "bg-green-600/20 text-green-400 border-green-600/30"
      : status === "error"
      ? "bg-red-600/20 text-red-400 border-red-600/30"
      : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>{status}</span>;
}

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
    { title: "Pagamentos", value: stats.payments, icon: CreditCard, color: "text-green-400" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{c.title}</p>
                <p className={`text-3xl font-bold ${c.color} mt-1`}>
                  {loading ? "..." : c.value}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted">
                <c.icon className={`h-5 w-5 ${c.color} opacity-60`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

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
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(0); }}>
          <SelectTrigger className="w-36 text-xs h-8"><SelectValue placeholder="Tipo" /></SelectTrigger>
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
            <SelectTrigger className="w-32 text-xs h-8"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={fetchLogs} className="text-xs h-8">
          <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{total} registros</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum log encontrado</div>
      ) : isMobile ? (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id} className={log.status === "error" ? "border-destructive/30" : ""}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-xs">{log.tipo}</Badge>
                  <StatusBadge status={log.status} />
                </div>
                <p className="text-sm text-foreground line-clamp-2">{log.mensagem}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
                {expandedId === log.id && (
                  <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded overflow-auto max-h-40">{JSON.stringify(log.payload, null, 2)}</pre>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Data</TableHead>
                <TableHead className="w-[100px]">Tipo</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <>
                  <TableRow key={log.id} className={log.status === "error" ? "bg-red-950/20" : ""}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{log.tipo}</Badge></TableCell>
                    <TableCell><StatusBadge status={log.status} /></TableCell>
                    <TableCell className="text-sm text-foreground max-w-[300px] truncate">{log.mensagem}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === log.id && (
                    <TableRow key={`${log.id}-detail`}>
                      <TableCell colSpan={5}>
                        <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded overflow-auto max-h-60">{JSON.stringify(log.payload, null, 2)}</pre>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}

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
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={fetchPayments} className="text-xs h-8"><RefreshCw className="h-3 w-3 mr-1" /> Atualizar</Button>
        <span className="text-xs text-muted-foreground ml-auto">{total} pagamentos</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando...</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum pagamento encontrado</div>
      ) : isMobile ? (
        <div className="space-y-2">
          {payments.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-xs">{p.billing_type || p.payment_method || "—"}</Badge>
                  <StatusBadge status={p.payment_status || "pending"} />
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Data:</span><span className="text-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Asaas ID:</span><span className="font-mono text-foreground text-[11px]">{p.asaas_payment_id?.slice(0, 16) || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Webhook:</span><span>{p.asaas_payment_id && webhookIds.has(p.asaas_payment_id) ? "✓ Recebido" : "—"}</span></div>
                </div>
                {p.asaas_invoice_url && (
                  <a href={p.asaas_invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs underline block text-right">Abrir Invoice</a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead><TableHead>Asaas ID</TableHead><TableHead>Método</TableHead><TableHead>Status</TableHead><TableHead>Webhook</TableHead><TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(p.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-xs font-mono text-foreground">{p.asaas_payment_id || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{p.billing_type || p.payment_method || "—"}</Badge></TableCell>
                  <TableCell><StatusBadge status={p.payment_status || "pending"} /></TableCell>
                  <TableCell>{p.asaas_payment_id && webhookIds.has(p.asaas_payment_id) ? <span className="text-green-400 text-xs">✓ Recebido</span> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell>{p.asaas_invoice_url ? <a href={p.asaas_invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs underline">Abrir</a> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}

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
            <Badge variant="outline" className="text-xs border-green-600/30 text-green-400">✓ Ativo (auto)</Badge>
            {!pwdChanged && <Badge variant="outline" className="text-xs border-amber-600/30 text-amber-400">Senha temp.</Badge>}
          </div>
        );
      }
      return <Badge variant="outline" className="text-xs border-green-600/30 text-green-400">✓ Ativo</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Sem acesso</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={fetchCustomers} className="text-xs h-8"><RefreshCw className="h-3 w-3 mr-1" /> Atualizar</Button>
        <Button size="sm" onClick={() => { setShowForm(!showForm); setResult(null); setError(""); }} className="text-xs h-8"><Plus className="h-3 w-3 mr-1" /> Criar Acesso</Button>
        <span className="text-xs text-muted-foreground ml-auto">{customers.length} clientes</span>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-5">
            {result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <Check size={18} /> <span className="font-bold text-sm">Usuário criado com sucesso!</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0"><p className="text-[10px] text-muted-foreground uppercase">E-mail</p><p className="text-sm font-mono text-foreground truncate">{result.email}</p></div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(result.email, "email")}>{copied === "email" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div><p className="text-[10px] text-muted-foreground uppercase">Senha</p><p className="text-sm font-mono text-foreground">{result.password}</p></div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(result.password, "pwd")}>{copied === "pwd" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Envie essas credenciais ao cliente. Acesso em /area-do-cliente</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setResult(null); setShowForm(false); setForm({ email: "", password: "", name: "" }); }}>Fechar</Button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <h3 className="font-bold text-sm text-foreground">Criar Acesso para Cliente</h3>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Vincular a Cliente (opcional)</label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger className="bg-card text-xs"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (criar sem vínculo)</SelectItem>
                      {customers.filter((c) => !c.user_id).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.razao_social} ({c.cnpj_ou_cpf})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Nome</label><Input placeholder="Nome do usuário" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-card" /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">E-mail *</label><Input type="email" placeholder="email@cliente.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-card" /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Senha *</label><Input type="text" placeholder="Mínimo 6 caracteres" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-card" /></div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button type="submit" size="sm" disabled={creating}>
                    {creating ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                    Criar Usuário
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum cliente cadastrado</div>
      ) : isMobile ? (
        <div className="space-y-2">
          {customers.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{c.nome_fantasia || c.razao_social}</p>
                  {getAccessBadge(c)}
                </div>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <p><span className="text-foreground/70">CNPJ/CPF:</span> {c.cnpj_ou_cpf}</p>
                  <p><span className="text-foreground/70">E-mail:</span> {c.email}</p>
                  <p><span className="text-foreground/70">Cadastro:</span> {new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
                  {auditLogs[c.id] && (
                    <p className="text-primary text-[11px]">{auditLogs[c.id].action === "auto_user_created" ? "🤖 Conta criada automaticamente" : "⚠️ Falha na criação automática"}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead><TableHead>CNPJ/CPF</TableHead><TableHead>E-mail</TableHead><TableHead>Acesso Portal</TableHead><TableHead>Origem</TableHead><TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm text-foreground font-medium">{c.nome_fantasia || c.razao_social}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{c.cnpj_ou_cpf}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.email}</TableCell>
                  <TableCell>{getAccessBadge(c)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {auditLogs[c.id]?.action === "auto_user_created" ? <span className="text-primary">🤖 Auto</span> : auditLogs[c.id]?.action === "auto_user_creation_failed" ? <span className="text-destructive">⚠️ Falha</span> : c.user_id ? "Manual" : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Content Renderer ───
function AdminContent({ activeSection, onNavigate }: { activeSection: string; onNavigate: (s: string) => void }) {
  const fallback = <div className="flex items-center justify-center py-12 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 animate-spin mr-2" />Carregando...</div>;

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
    case "test-center": return <Suspense fallback={fallback}><AdminTestCenter /></Suspense>;
    case "blog-ai": return <Suspense fallback={fallback}><AdminBlogGenerator /></Suspense>;
    default: return <AdminCommandCenter onNavigate={onNavigate} />;
  }
}

// ─── Main Page ───
export default function AdminPage() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem("admin_token"));
  const [activeSection, setActiveSection] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  const handleLogout = () => {
    sessionStorage.removeItem("admin_token");
    setAuthed(false);
  };

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    setMobileNavOpen(false);
    setMenuOpen(false);
  };

  const currentLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeSection)?.label || "Dashboard";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Fullscreen Menu */}
      <AdminFullscreenMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeSection={activeSection}
        onNavigate={handleNavClick}
        onLogout={handleLogout}
      />

      {/* Sidebar - Desktop */}
      {!isMobile && (
        <aside className="w-56 border-r border-border bg-card flex-shrink-0 flex flex-col h-screen sticky top-0">
          <div className="p-4 border-b border-border">
            <h1 className="text-sm font-bold text-foreground">🛡️ Admin WMTi</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Painel de Controle</p>
          </div>

          <nav className="flex-1 overflow-y-auto py-2">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5 mr-2" /> Sair
            </Button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        {isMobile && (
          <header className="border-b border-border px-4 py-3 flex items-center justify-between gap-2 bg-card sticky top-0 z-30">
            <button
              onClick={() => setMenuOpen(true)}
              className="text-xs font-bold text-foreground flex items-center gap-2"
            >
              <div className="flex flex-col gap-[3px]">
                <span className="block w-4 h-[2px] bg-foreground rounded" />
                <span className="block w-4 h-[2px] bg-foreground rounded" />
                <span className="block w-4 h-[2px] bg-foreground rounded" />
              </div>
              {currentLabel}
            </button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </header>
        )}

        {/* Desktop Header */}
        {!isMobile && (
          <header className="border-b border-border px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">{currentLabel}</h2>
            <Button variant="ghost" size="sm" onClick={() => setMenuOpen(true)} className="text-xs gap-1.5">
              <div className="flex flex-col gap-[3px]">
                <span className="block w-3.5 h-[1.5px] bg-foreground rounded" />
                <span className="block w-3.5 h-[1.5px] bg-foreground rounded" />
                <span className="block w-3.5 h-[1.5px] bg-foreground rounded" />
              </div>
              Menu
            </Button>
          </header>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <AdminContent activeSection={activeSection} onNavigate={handleNavClick} />
        </main>
      </div>
    </div>
  );
}

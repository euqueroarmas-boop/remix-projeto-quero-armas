import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart3, AlertTriangle, CreditCard, FileText, LogOut, RefreshCw, ChevronLeft, ChevronRight, Eye,
} from "lucide-react";

const ITEMS_PER_PAGE = 20;

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
          <CardTitle className="text-center text-foreground">Painel Administrativo</CardTitle>
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
  const variant = status === "success" ? "default" : status === "error" ? "destructive" : "secondary";
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

      const [logsRes, errorsRes, webhooksRes, paymentsRes] = await Promise.all([
        supabase.from("logs_sistema" as any).select("id", { count: "exact", head: true }),
        supabase.from("logs_sistema" as any).select("id", { count: "exact", head: true }).eq("status", "error").gte("created_at", yesterday),
        supabase.from("asaas_webhooks").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        totalLogs: logsRes.count || 0,
        errors24h: errorsRes.count || 0,
        webhooks: webhooksRes.count || 0,
        payments: paymentsRes.count || 0,
      });
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{c.title}</p>
                <p className={`text-3xl font-bold ${c.color}`}>
                  {loading ? "..." : c.value}
                </p>
              </div>
              <c.icon className={`h-8 w-8 ${c.color} opacity-50`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LogsTab({ onlyErrors = false }: { onlyErrors?: boolean }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterStatus, setFilterStatus] = useState(onlyErrors ? "error" : "all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("logs_sistema" as any)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

    if (filterTipo !== "all") query = query.eq("tipo", filterTipo);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);

    const { data, count } = await query;
    setLogs((data as LogRow[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page, filterTipo, filterStatus]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="checkout">Checkout</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="contrato">Contrato</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
            <SelectItem value="pagamento">Pagamento</SelectItem>
          </SelectContent>
        </Select>
        {!onlyErrors && (
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{total} registros</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum log encontrado</div>
      ) : (
        <div className="rounded-md border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Data</TableHead>
                <TableHead className="w-[100px]">Tipo</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="w-[60px]">Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <>
                  <TableRow key={log.id} className={log.status === "error" ? "bg-red-950/20" : ""}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.tipo}</Badge>
                    </TableCell>
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
                        <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded overflow-auto max-h-60">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
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
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function PaymentsTab() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from("payments")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

    setPayments((data as PaymentRow[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const [webhookIds, setWebhookIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("asaas_webhooks").select("payload");
      const ids = new Set<string>();
      data?.forEach((w: any) => {
        const paymentId = w.payload?.payment?.id;
        if (paymentId) ids.add(paymentId);
      });
      setWebhookIds(ids);
    })();
  }, []);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={fetchPayments}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{total} pagamentos</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum pagamento encontrado</div>
      ) : (
        <div className="rounded-md border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Asaas ID</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Webhook</TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-foreground">{p.asaas_payment_id || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{p.billing_type || p.payment_method || "—"}</Badge></TableCell>
                  <TableCell><StatusBadge status={p.payment_status || "pending"} /></TableCell>
                  <TableCell>
                    {p.asaas_payment_id && webhookIds.has(p.asaas_payment_id) ? (
                      <span className="text-green-400 text-xs">✓ Recebido</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.asaas_invoice_url ? (
                      <a href={p.asaas_invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs underline">
                        Abrir
                      </a>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem("admin_token"));

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  const handleLogout = () => {
    sessionStorage.removeItem("admin_token");
    setAuthed(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">🛡️ Admin — WMTi</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-1" /> Sair
        </Button>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <Tabs defaultValue="dashboard">
          <TabsList className="mb-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="errors">Erros</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><Dashboard /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
          <TabsContent value="errors"><LogsTab onlyErrors /></TabsContent>
          <TabsContent value="payments"><PaymentsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

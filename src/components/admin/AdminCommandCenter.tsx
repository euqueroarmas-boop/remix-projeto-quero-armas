import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import { adminQuery } from "@/lib/adminApi";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, Loader2,
  Pause, Play as PlayIcon,
  TestTube2, Megaphone, FileText, CreditCard, Webhook, Activity,
  ArrowRight, Zap, Database, Server, HardDrive, Link2, ShieldAlert,
  TrendingUp, Eye, Play,
} from "lucide-react";
import { formatDuration } from "@/lib/formatDuration";

interface CommandCenterProps {
  onNavigate: (section: string) => void;
}

type SystemStatus = "online" | "degraded" | "offline" | "checking";

const STATUS_DOT: Record<SystemStatus, string> = {
  online: "bg-emerald-400",
  degraded: "bg-amber-400",
  offline: "bg-red-400",
  checking: "bg-blue-400 animate-pulse",
};

// ─── Individual module hooks ───────────────────────────────────────

function useAlerts(autoRefreshRef: React.MutableRefObject<boolean>) {
  const [errors24h, setErrors24h] = useState(0);
  const [webhookErrors, setWebhookErrors] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    try {
      const res = await adminQuery([
        { table: "logs_sistema", select: "id", count: true, limit: 0, filters: [{ column: "status", op: "eq", value: "error" }, { column: "created_at", op: "gte", value: yesterday }] },
        { table: "integration_logs", select: "id", count: true, limit: 0, filters: [{ column: "status", op: "eq", value: "error" }, { column: "created_at", op: "gte", value: yesterday }] },
      ]);
      setErrors24h(res[0].count || 0);
      setWebhookErrors(res[1].count || 0);
    } catch { /* keep last state */ }
    setLoaded(true);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const ch = supabase
      .channel("cmd-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "logs_sistema" }, () => { if (autoRefreshRef.current) fetchData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "integration_logs" }, () => { if (autoRefreshRef.current) fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData, autoRefreshRef]);

  return { errors24h, webhookErrors, loaded, refetch: fetchData };
}

function useFunnel(autoRefreshRef: React.MutableRefObject<boolean>) {
  const [data, setData] = useState({ leads: 0, quotes: 0, contracts: 0, paymentsOk: 0, paymentsFail: 0 });
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    try {
      const res = await adminQuery([
        { table: "leads", select: "id", count: true, limit: 0, filters: [{ column: "created_at", op: "gte", value: todayStart }] },
        { table: "quotes", select: "id", count: true, limit: 0, filters: [{ column: "created_at", op: "gte", value: todayStart }] },
        { table: "contracts", select: "id", count: true, limit: 0, filters: [{ column: "created_at", op: "gte", value: todayStart }] },
        { table: "payments", select: "id", count: true, limit: 0, filters: [{ column: "created_at", op: "gte", value: todayStart }, { column: "payment_status", op: "eq", value: "RECEIVED" }] },
        { table: "payments", select: "id", count: true, limit: 0, filters: [{ column: "created_at", op: "gte", value: todayStart }, { column: "payment_status", op: "eq", value: "OVERDUE" }] },
      ]);
      setData({ leads: res[0].count || 0, quotes: res[1].count || 0, contracts: res[2].count || 0, paymentsOk: res[3].count || 0, paymentsFail: res[4].count || 0 });
    } catch { /* keep last state */ }
    setLoaded(true);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const guard = () => { if (autoRefreshRef.current) fetchData(); };
    const ch = supabase
      .channel("cmd-funnel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, guard)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, guard)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contracts" }, guard)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "quotes" }, guard)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData, autoRefreshRef]);

  return { ...data, loaded, refetch: fetchData };
}

function useTestRun(autoRefreshRef: React.MutableRefObject<boolean>) {
  const [testRun, setTestRun] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await adminQuery([
        { table: "test_runs", select: "*", order: { column: "created_at", ascending: false }, limit: 1 },
      ]);
      setTestRun(((res[0].data as any[]) || [])[0] || null);
    } catch { /* keep last state */ }
    setLoaded(true);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const ch = supabase
      .channel("cmd-tests")
      .on("postgres_changes", { event: "*", schema: "public", table: "test_runs" }, () => { if (autoRefreshRef.current) fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData, autoRefreshRef]);

  return { testRun, loaded, refetch: fetchData };
}

function useActivity(autoRefreshRef: React.MutableRefObject<boolean>) {
  const [logs, setLogs] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await adminQuery([
        { table: "logs_sistema", select: "id,tipo,status,mensagem,created_at", order: { column: "created_at", ascending: false }, limit: 5 },
        { table: "admin_audit_logs", select: "id,action,target_type,created_at", order: { column: "created_at", ascending: false }, limit: 5 },
      ]);
      setLogs((res[0].data as any[]) || []);
      setAudit((res[1].data as any[]) || []);
    } catch { /* keep last state */ }
    setLoaded(true);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const guard = () => { if (autoRefreshRef.current) fetchData(); };
    const ch = supabase
      .channel("cmd-activity")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "logs_sistema" }, guard)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_audit_logs" }, guard)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData, autoRefreshRef]);

  return { logs, audit, loaded, refetch: fetchData };
}

// ─── Memoized sub-components ───────────────────────────────────────

const AlertsBanner = memo(function AlertsBanner({ errors24h, webhookErrors, onNavigate }: { errors24h: number; webhookErrors: number; onNavigate: (s: string) => void }) {
  const total = errors24h + webhookErrors;
  if (total === 0) return null;
  return (
    <button
      onClick={() => onNavigate("errors")}
      className="w-full bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-3 hover:bg-red-500/15 transition-colors text-left"
    >
      <div className="p-2 rounded-full bg-red-500/20">
        <AlertTriangle className="h-4 w-4 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-400">{total} alerta{total > 1 ? "s" : ""} crítico{total > 1 ? "s" : ""}</p>
        <p className="text-xs text-red-400/70">{errors24h} erros · {webhookErrors} falhas de integração (24h)</p>
      </div>
      <ArrowRight className="h-4 w-4 text-red-400 shrink-0" />
    </button>
  );
});

const SystemStatusGrid = memo(function SystemStatusGrid({ errors24h, webhookErrors }: { errors24h: number; webhookErrors: number }) {
  const now = new Date().toLocaleTimeString("pt-BR");
  const items = useMemo(() => [
    { label: "Aplicação", status: "online" as SystemStatus, detail: "Operacional", icon: Server },
    { label: "Banco de Dados", status: "online" as SystemStatus, detail: "Operacional", icon: Database },
    { label: "Edge Functions", status: (errors24h > 10 ? "degraded" : "online") as SystemStatus, detail: errors24h > 10 ? `${errors24h} erros` : "Operacional", icon: Zap },
    { label: "Storage", status: "online" as SystemStatus, detail: "Buckets ativos", icon: HardDrive },
    { label: "Webhooks", status: (webhookErrors > 0 ? "degraded" : "online") as SystemStatus, detail: webhookErrors > 0 ? `${webhookErrors} falhas` : "Sem falhas", icon: Webhook },
    { label: "Integrações", status: (webhookErrors > 5 ? "degraded" : "online") as SystemStatus, detail: webhookErrors > 5 ? "Instabilidade" : "Operacional", icon: Link2 },
  ], [errors24h, webhookErrors]);

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Status do Sistema</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {items.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className={`border ${s.status === "online" ? "border-border" : s.status === "degraded" ? "border-amber-500/30" : "border-red-500/30"} transition-colors duration-500`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${STATUS_DOT[s.status]}`} />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-xs font-medium text-foreground truncate">{s.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{s.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
});

const TestsBlock = memo(function TestsBlock({ testRun, onNavigate }: { testRun: any; onNavigate: (s: string) => void }) {
  const testPct = testRun ? Math.round(((testRun.passed_tests || 0) / Math.max(testRun.total_tests || 1, 1)) * 100) : 0;
  return (
    <Card className={`border transition-colors duration-500 ${testRun?.status === "failed" ? "border-red-500/30" : testRun?.status === "passed" ? "border-emerald-500/30" : "border-border"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TestTube2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Testes</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("test-center")} className="text-xs gap-1 h-7">
            Detalhes <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        {testRun ? (
          <>
            <div className="flex items-center gap-2">
              {testRun.status === "passed" ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Aprovado</Badge>
              ) : testRun.status === "failed" ? (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Falhou</Badge>
              ) : testRun.status === "running" ? (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Executando</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">{testRun.status}</Badge>
              )}
              <span className="text-xs text-muted-foreground">{testRun.suite} · {new Date(testRun.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-mono text-foreground">{testPct}%</span>
              </div>
              <Progress value={testPct} className="h-2 transition-all duration-700" />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-lg font-bold text-foreground">{testRun.total_tests || 0}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
              <div><p className="text-lg font-bold text-emerald-400">{testRun.passed_tests || 0}</p><p className="text-[10px] text-muted-foreground">Aprovados</p></div>
              <div><p className="text-lg font-bold text-red-400">{testRun.failed_tests || 0}</p><p className="text-[10px] text-muted-foreground">Falhos</p></div>
              <div><p className="text-lg font-bold text-amber-400">{testRun.skipped_tests || 0}</p><p className="text-[10px] text-muted-foreground">Ignorados</p></div>
            </div>
            {testRun.duration_ms && <p className="text-[10px] text-muted-foreground">Duração: {formatDuration(testRun.duration_ms)}</p>}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Nenhum teste executado</p>
            <Button size="sm" className="mt-2 text-xs" onClick={() => onNavigate("test-center")}><Play className="h-3 w-3 mr-1" /> Executar Primeiro Teste</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

const FunnelBlock = memo(function FunnelBlock({ data, onNavigate }: { data: { leads: number; quotes: number; contracts: number; paymentsOk: number; paymentsFail: number; errors24h?: number }; onNavigate: (s: string) => void }) {
  const items = [
    { label: "Leads", value: data.leads, icon: Megaphone, color: "text-blue-400", nav: "leads" },
    { label: "Orçamentos", value: data.quotes, icon: FileText, color: "text-purple-400", nav: "leads" },
    { label: "Contratos", value: data.contracts, icon: FileText, color: "text-cyan-400", nav: "leads" },
    { label: "Pagamentos OK", value: data.paymentsOk, icon: CreditCard, color: "text-emerald-400", nav: "payments" },
    { label: "Pagamentos Falhos", value: data.paymentsFail, icon: XCircle, color: "text-red-400", nav: "payments" },
  ];
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Funil Operacional (Hoje)</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} onClick={() => onNavigate(item.nav)} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors text-left">
                <Icon className={`h-4 w-4 ${item.color} shrink-0`} />
                <div className="min-w-0">
                  <p className={`text-base font-bold ${item.color} transition-all duration-500`}>{item.value}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

const ActivityBlock = memo(function ActivityBlock({ logs, audit, onNavigate }: { logs: any[]; audit: any[]; onNavigate: (s: string) => void }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Atividade Recente</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("logs")} className="text-xs gap-1 h-7">
            Ver tudo <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-1">
          {logs.length === 0 && audit.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade recente</p>
          ) : (
            <>
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0 transition-opacity duration-300">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${log.status === "error" ? "bg-red-400" : log.status === "warning" ? "bg-amber-400" : "bg-emerald-400"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground truncate">{log.mensagem}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] h-4">{log.tipo}</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                </div>
              ))}
              {audit.map((a: any) => (
                <div key={a.id} className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0 transition-opacity duration-300">
                  <div className="mt-0.5 w-2 h-2 rounded-full shrink-0 bg-blue-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground truncate">{a.action} {a.target_type ? `→ ${a.target_type}` : ""}</p>
                    <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

const QuickActions = memo(function QuickActions({ onNavigate }: { onNavigate: (s: string) => void }) {
  const actions = [
    { label: "Centro de Testes", icon: TestTube2, nav: "test-center" },
    { label: "Alertas / Erros", icon: ShieldAlert, nav: "errors" },
    { label: "Leads & Propostas", icon: Megaphone, nav: "leads" },
    { label: "Contratos", icon: FileText, nav: "leads" },
    { label: "Pagamentos", icon: CreditCard, nav: "payments" },
    { label: "Logs Técnicos", icon: Eye, nav: "logs" },
    { label: "Diagnóstico", icon: Activity, nav: "diagnostics" },
    { label: "Webhooks", icon: Webhook, nav: "webhooks" },
  ];
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Ações Rápidas</h3>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.label} onClick={() => onNavigate(action.nav)} className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-left">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{action.label}</span>
                <ArrowRight className="h-3 w-3 ml-auto opacity-40" />
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

// ─── Main Component ────────────────────────────────────────────────

export default function AdminCommandCenter({ onNavigate }: CommandCenterProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const autoRefreshRef = useRef(true);
  useEffect(() => { autoRefreshRef.current = autoRefresh; }, [autoRefresh]);

  const alerts = useAlerts(autoRefreshRef);
  const funnel = useFunnel(autoRefreshRef);
  const tests = useTestRun(autoRefreshRef);
  const activity = useActivity(autoRefreshRef);

  const allLoaded = alerts.loaded && funnel.loaded && tests.loaded && activity.loaded;
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([alerts.refetch(), funnel.refetch(), tests.refetch(), activity.refetch()]);
    setLastUpdate(new Date());
    setRefreshing(false);
  }, [alerts, funnel, tests, activity]);

  // Update timestamp when any module reloads via realtime
  useEffect(() => {
    if (allLoaded) setLastUpdate(new Date());
  }, [alerts.errors24h, alerts.webhookErrors, funnel.leads, tests.testRun?.id, activity.logs.length]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Centro de Comando</h2>
          <p className="text-xs text-muted-foreground">
            {allLoaded ? `Última atualização: ${lastUpdate.toLocaleTimeString("pt-BR")}` : "Carregando..."} · Ambiente: <Badge variant="outline" className="text-[10px] ml-1">Produção</Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-xs gap-1"
          >
            {autoRefresh ? <Pause className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
            {autoRefresh ? "Auto" : "Pausado"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={refreshing} className="text-xs gap-1.5">
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <AlertsBanner errors24h={alerts.errors24h} webhookErrors={alerts.webhookErrors} onNavigate={onNavigate} />
      <SystemStatusGrid errors24h={alerts.errors24h} webhookErrors={alerts.webhookErrors} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TestsBlock testRun={tests.testRun} onNavigate={onNavigate} />
        <FunnelBlock data={{ leads: funnel.leads, quotes: funnel.quotes, contracts: funnel.contracts, paymentsOk: funnel.paymentsOk, paymentsFail: funnel.paymentsFail }} onNavigate={onNavigate} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ActivityBlock logs={activity.logs} audit={activity.audit} onNavigate={onNavigate} />
        </div>
        <QuickActions onNavigate={onNavigate} />
      </div>
    </div>
  );
}

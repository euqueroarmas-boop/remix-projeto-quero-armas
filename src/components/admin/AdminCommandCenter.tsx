import { useState, useEffect, useCallback } from "react";
import { adminQuery } from "@/lib/adminApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, Loader2,
  TestTube2, Megaphone, FileText, CreditCard, Webhook, Activity,
  ArrowRight, Zap, Database, Server, HardDrive, Link2, ShieldAlert,
  TrendingUp, Eye, Play,
} from "lucide-react";
import { formatDuration } from "@/lib/formatDuration";

interface CommandCenterProps {
  onNavigate: (section: string) => void;
}

type SystemStatus = "online" | "degraded" | "offline" | "checking";

interface StatusCard {
  label: string;
  status: SystemStatus;
  detail: string;
  lastCheck: string;
  icon: any;
}

interface DashboardData {
  // Funnel
  leadsToday: number;
  quotesToday: number;
  contractsToday: number;
  paymentsCompleted: number;
  paymentsFailed: number;
  // Alerts
  errors24h: number;
  webhookErrors: number;
  rlsIssues: number;
  // Tests
  lastTestRun: any;
  // Activity
  recentLogs: any[];
  recentAudit: any[];
  // System
  totalLogs: number;
  totalWebhooks: number;
  totalPayments: number;
}

const STATUS_COLORS: Record<SystemStatus, string> = {
  online: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  degraded: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  offline: "bg-red-500/20 text-red-400 border-red-500/30",
  checking: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const STATUS_DOT: Record<SystemStatus, string> = {
  online: "bg-emerald-400",
  degraded: "bg-amber-400",
  offline: "bg-red-400",
  checking: "bg-blue-400 animate-pulse",
};

export default function AdminCommandCenter({ onNavigate }: CommandCenterProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [systemStatuses, setSystemStatuses] = useState<StatusCard[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    try {
      const results = await adminQuery([
        // 0: leads today
        { table: "leads", select: "id", count: true, limit: 0, filters: [{ column: "created_at", op: "gte", value: todayStart }] },
        // 1: quotes today
        { table: "quotes", select: "id", count: true, limit: 0, filters: [{ column: "created_at", op: "gte", value: todayStart }] },
        // 2: contracts today
        { table: "contracts", select: "id", count: true, limit: 0, filters: [{ column: "created_at", op: "gte", value: todayStart }] },
        // 3: payments completed today
        { table: "payments", select: "id", count: true, limit: 0, filters: [{ column: "created_at", op: "gte", value: todayStart }, { column: "payment_status", op: "eq", value: "RECEIVED" }] },
        // 4: payments failed
        { table: "payments", select: "id", count: true, limit: 0, filters: [{ column: "created_at", op: "gte", value: todayStart }, { column: "payment_status", op: "eq", value: "OVERDUE" }] },
        // 5: errors 24h
        { table: "logs_sistema", select: "id", count: true, limit: 0, filters: [{ column: "status", op: "eq", value: "error" }, { column: "created_at", op: "gte", value: yesterday }] },
        // 6: webhook errors
        { table: "integration_logs", select: "id", count: true, limit: 0, filters: [{ column: "status", op: "eq", value: "error" }, { column: "created_at", op: "gte", value: yesterday }] },
        // 7: last test run
        { table: "test_runs", select: "*", order: { column: "created_at", ascending: false }, limit: 1 },
        // 8: recent logs
        { table: "logs_sistema", select: "id,tipo,status,mensagem,created_at", order: { column: "created_at", ascending: false }, limit: 5 },
        // 9: recent audit
        { table: "admin_audit_logs", select: "id,action,target_type,created_at", order: { column: "created_at", ascending: false }, limit: 5 },
        // 10: total logs
        { table: "logs_sistema", select: "id", count: true, limit: 0 },
        // 11: total webhooks
        { table: "asaas_webhooks", select: "id", count: true, limit: 0 },
        // 12: total payments
        { table: "payments", select: "id", count: true, limit: 0 },
      ]);

      const lastTest = ((results[7].data as any[]) || [])[0] || null;

      setData({
        leadsToday: results[0].count || 0,
        quotesToday: results[1].count || 0,
        contractsToday: results[2].count || 0,
        paymentsCompleted: results[3].count || 0,
        paymentsFailed: results[4].count || 0,
        errors24h: results[5].count || 0,
        webhookErrors: results[6].count || 0,
        rlsIssues: 0,
        lastTestRun: lastTest,
        recentLogs: (results[8].data as any[]) || [],
        recentAudit: (results[9].data as any[]) || [],
        totalLogs: results[10].count || 0,
        totalWebhooks: results[11].count || 0,
        totalPayments: results[12].count || 0,
      });

      // Derive system statuses
      const errCount = results[5].count || 0;
      const whErrors = results[6].count || 0;

      setSystemStatuses([
        { label: "Aplicação", status: "online", detail: "Operacional", lastCheck: now.toLocaleTimeString("pt-BR"), icon: Server },
        { label: "Banco de Dados", status: "online", detail: `${results[10].count || 0} logs registrados`, lastCheck: now.toLocaleTimeString("pt-BR"), icon: Database },
        { label: "Edge Functions", status: errCount > 10 ? "degraded" : "online", detail: errCount > 10 ? `${errCount} erros (24h)` : "Operacional", lastCheck: now.toLocaleTimeString("pt-BR"), icon: Zap },
        { label: "Storage", status: "online", detail: "Buckets ativos", lastCheck: now.toLocaleTimeString("pt-BR"), icon: HardDrive },
        { label: "Webhooks", status: whErrors > 0 ? "degraded" : "online", detail: whErrors > 0 ? `${whErrors} falhas (24h)` : "Sem falhas", lastCheck: now.toLocaleTimeString("pt-BR"), icon: Webhook },
        { label: "Integrações", status: whErrors > 5 ? "degraded" : "online", detail: whErrors > 5 ? "Instabilidade detectada" : "Operacional", lastCheck: now.toLocaleTimeString("pt-BR"), icon: Link2 },
      ]);

      setLastUpdate(now);
    } catch (err) {
      console.error("Command center fetch error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
        <span className="text-muted-foreground text-sm">Carregando centro de comando...</span>
      </div>
    );
  }

  if (!data) return null;

  const testRun = data.lastTestRun;
  const testPct = testRun ? Math.round(((testRun.passed_tests || 0) / Math.max(testRun.total_tests || 1, 1)) * 100) : 0;
  const criticalAlerts = data.errors24h + data.webhookErrors;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Centro de Comando</h2>
          <p className="text-xs text-muted-foreground">
            Última atualização: {lastUpdate.toLocaleTimeString("pt-BR")} · Ambiente: <Badge variant="outline" className="text-[10px] ml-1">Produção</Badge>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="text-xs gap-1.5">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts > 0 && (
        <button
          onClick={() => onNavigate("errors")}
          className="w-full bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-3 hover:bg-red-500/15 transition-colors text-left"
        >
          <div className="p-2 rounded-full bg-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400">{criticalAlerts} alerta{criticalAlerts > 1 ? "s" : ""} crítico{criticalAlerts > 1 ? "s" : ""} ativo{criticalAlerts > 1 ? "s" : ""}</p>
            <p className="text-xs text-red-400/70">{data.errors24h} erros · {data.webhookErrors} falhas de integração (últimas 24h)</p>
          </div>
          <ArrowRight className="h-4 w-4 text-red-400 shrink-0" />
        </button>
      )}

      {/* System Status Grid */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Status do Sistema</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {systemStatuses.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className={`border ${s.status === "online" ? "border-border" : s.status === "degraded" ? "border-amber-500/30" : "border-red-500/30"}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${STATUS_DOT[s.status]}`} />
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

      {/* Tests Block + Funnel Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tests Block */}
        <Card className={`border ${testRun?.status === "failed" ? "border-red-500/30" : testRun?.status === "passed" ? "border-emerald-500/30" : "border-border"}`}>
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
                  <span className="text-xs text-muted-foreground">
                    {testRun.suite} · {new Date(testRun.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-mono text-foreground">{testPct}%</span>
                  </div>
                  <Progress value={testPct} className="h-2" />
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-foreground">{testRun.total_tests || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-400">{testRun.passed_tests || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Aprovados</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-400">{testRun.failed_tests || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Falhos</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-400">{testRun.skipped_tests || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Ignorados</p>
                  </div>
                </div>

                {testRun.duration_ms && (
                  <p className="text-[10px] text-muted-foreground">Duração: {formatDuration(testRun.duration_ms)}</p>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Nenhum teste executado</p>
                <Button size="sm" className="mt-2 text-xs" onClick={() => onNavigate("test-center")}>
                  <Play className="h-3 w-3 mr-1" /> Executar Primeiro Teste
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operational Funnel */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Funil Operacional (Hoje)</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Leads", value: data.leadsToday, icon: Megaphone, color: "text-blue-400", nav: "leads" },
                { label: "Orçamentos", value: data.quotesToday, icon: FileText, color: "text-purple-400", nav: "leads" },
                { label: "Contratos", value: data.contractsToday, icon: FileText, color: "text-cyan-400", nav: "leads" },
                { label: "Pagamentos OK", value: data.paymentsCompleted, icon: CreditCard, color: "text-emerald-400", nav: "payments" },
                { label: "Pagamentos Falhos", value: data.paymentsFailed, icon: XCircle, color: "text-red-400", nav: "payments" },
                { label: "Erros (24h)", value: data.errors24h, icon: AlertTriangle, color: "text-amber-400", nav: "errors" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => onNavigate(item.nav)}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                  >
                    <Icon className={`h-4 w-4 ${item.color} shrink-0`} />
                    <div className="min-w-0">
                      <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline + Quick Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Timeline */}
        <div className="lg:col-span-2">
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
                {data.recentLogs.length === 0 && data.recentAudit.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade recente</p>
                ) : (
                  <>
                    {data.recentLogs.map((log: any) => (
                      <div key={log.id} className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
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
                    {data.recentAudit.map((a: any) => (
                      <div key={a.id} className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
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
        </div>

        {/* Quick Actions */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Ações Rápidas</h3>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {[
                { label: "Centro de Testes", icon: TestTube2, nav: "test-center" },
                { label: "Alertas / Erros", icon: ShieldAlert, nav: "errors" },
                { label: "Leads & Propostas", icon: Megaphone, nav: "leads" },
                { label: "Contratos", icon: FileText, nav: "leads" },
                { label: "Pagamentos", icon: CreditCard, nav: "payments" },
                { label: "Logs Técnicos", icon: Eye, nav: "logs" },
                { label: "Diagnóstico", icon: Activity, nav: "diagnostics" },
                { label: "Webhooks", icon: Webhook, nav: "webhooks" },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => onNavigate(action.nav)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-left"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{action.label}</span>
                    <ArrowRight className="h-3 w-3 ml-auto opacity-40" />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

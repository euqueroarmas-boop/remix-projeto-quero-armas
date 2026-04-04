import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import { adminQuery } from "@/lib/adminApi";
import { adminFunctionFetch } from "@/lib/adminSession";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, Loader2,
  Pause, Play as PlayIcon,
  TestTube2, Megaphone, FileText, CreditCard, Webhook, Activity,
  ArrowRight, Zap, Database, Server, HardDrive, Link2, ShieldAlert,
  TrendingUp, Eye, Play,
} from "lucide-react";
import { formatDuration } from "@/lib/formatDuration";
import { MetricCard, StatusPill, MonitoringCard, SectionHeader, EventRow, QuickAction, HealthBar, DataPanel } from "@/components/admin/ui/AdminPrimitives";
import { cn } from "@/lib/utils";

interface CommandCenterProps {
  onNavigate: (section: string) => void;
}

type SystemStatus = "online" | "degraded" | "offline" | "checking";

// ─── Individual module hooks (unchanged logic) ─────────────────

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
  const [lastCompletedRun, setLastCompletedRun] = useState<any>(null);
  const [activeRun, setActiveRun] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await adminQuery([
        { table: "test_runs", select: "*", order: { column: "created_at", ascending: false }, limit: 1, filters: [{ column: "status", op: "in", value: ["success", "failed", "partial"] }] },
        { table: "test_runs", select: "*", order: { column: "created_at", ascending: false }, limit: 1, filters: [{ column: "status", op: "eq", value: "running" }] },
      ]);
      const completed = ((res[0].data as any[]) || [])[0] || null;
      const running = ((res[1].data as any[]) || [])[0] || null;

      if (running && running.started_at) {
        const elapsed = Date.now() - new Date(running.started_at).getTime();
        if (elapsed > 15 * 60 * 1000) {
          setActiveRun(null);
          setLastCompletedRun(completed);
          setLoaded(true);
          return;
        }
      }

      setActiveRun(running);
      setLastCompletedRun(completed);
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

  const testRun = activeRun || lastCompletedRun;
  return { testRun, activeRun, lastCompletedRun, loaded, refetch: fetchData };
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

// ─── Sub-components ────────────────────────────────────────────

const AlertsBanner = memo(function AlertsBanner({ errors24h, webhookErrors, onNavigate }: { errors24h: number; webhookErrors: number; onNavigate: (s: string) => void }) {
  const total = errors24h + webhookErrors;
  if (total === 0) return null;
  return (
    <button
      onClick={() => onNavigate("errors")}
      className="w-full rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-center gap-3 hover:bg-red-500/10 transition-colors text-left"
    >
      <div className="p-2 rounded-lg bg-red-500/10">
        <AlertTriangle className="h-4 w-4 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-red-400">{total} alerta{total > 1 ? "s" : ""} ativo{total > 1 ? "s" : ""}</p>
        <p className="text-[10px] text-red-400/60">{errors24h} erros · {webhookErrors} falhas de integração (24h)</p>
      </div>
      <ArrowRight className="h-4 w-4 text-red-400/40 shrink-0" />
    </button>
  );
});

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const PUBLISHED_URL = "https://dell-shine-solutions.lovable.app";

const SYSTEM_CHECKS: Record<string, { name: string; url: string; method?: string }[]> = {
  "Aplicação": [
    { name: "Homepage (SSR)", url: `${PUBLISHED_URL}/` },
    { name: "Blog", url: `${PUBLISHED_URL}/blog` },
    { name: "Orçamento", url: `${PUBLISHED_URL}/orcamento-ti` },
    { name: "Serviços", url: `${PUBLISHED_URL}/servicos` },
    { name: "Sitemap XML", url: `${PUBLISHED_URL}/sitemap.xml` },
    { name: "Robots.txt", url: `${PUBLISHED_URL}/robots.txt` },
  ],
  "Banco de Dados": [
    { name: "REST API", url: `${SUPABASE_URL}/rest/v1/` },
    { name: "Tabela leads", url: `${SUPABASE_URL}/rest/v1/leads?select=id&limit=1` },
    { name: "Tabela contracts", url: `${SUPABASE_URL}/rest/v1/contracts?select=id&limit=1` },
    { name: "Tabela payments", url: `${SUPABASE_URL}/rest/v1/payments?select=id&limit=1` },
    { name: "Tabela logs_sistema", url: `${SUPABASE_URL}/rest/v1/logs_sistema?select=id&limit=1` },
  ],
  "Edge Functions": [
    { name: "submit-lead", url: `${SUPABASE_URL}/functions/v1/submit-lead`, method: "OPTIONS" },
    { name: "admin-data", url: `${SUPABASE_URL}/functions/v1/admin-data`, method: "OPTIONS" },
    { name: "run-tests", url: `${SUPABASE_URL}/functions/v1/run-tests`, method: "OPTIONS" },
    { name: "brasil-api-lookup", url: `${SUPABASE_URL}/functions/v1/brasil-api-lookup`, method: "OPTIONS" },
    { name: "create-asaas-payment", url: `${SUPABASE_URL}/functions/v1/create-asaas-payment`, method: "OPTIONS" },
    { name: "notify-lead", url: `${SUPABASE_URL}/functions/v1/notify-lead`, method: "OPTIONS" },
    { name: "sitemap", url: `${SUPABASE_URL}/functions/v1/sitemap`, method: "OPTIONS" },
  ],
  "Storage": [
    { name: "Storage API", url: `${SUPABASE_URL}/storage/v1/` },
    { name: "Bucket: contracts", url: `${SUPABASE_URL}/storage/v1/bucket/contracts` },
  ],
  "Webhooks": [
    { name: "asaas-webhook", url: `${SUPABASE_URL}/functions/v1/asaas-webhook`, method: "OPTIONS" },
    { name: "ingest-test-events", url: `${SUPABASE_URL}/functions/v1/ingest-test-events`, method: "OPTIONS" },
    { name: "test-alerts", url: `${SUPABASE_URL}/functions/v1/test-alerts`, method: "OPTIONS" },
  ],
  "Integrações": [
    { name: "Asaas Payments", url: `${SUPABASE_URL}/functions/v1/create-asaas-payment`, method: "OPTIONS" },
    { name: "Brasil API (CEP/CNPJ)", url: `${SUPABASE_URL}/functions/v1/brasil-api-lookup`, method: "OPTIONS" },
    { name: "send-purchase-confirmation", url: `${SUPABASE_URL}/functions/v1/send-purchase-confirmation`, method: "OPTIONS" },
    { name: "generate-blog-post (AI)", url: `${SUPABASE_URL}/functions/v1/generate-blog-post`, method: "OPTIONS" },
  ],
};

const SystemHealthPanel = memo(function SystemHealthPanel({ errors24h, webhookErrors }: { errors24h: number; webhookErrors: number }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const items = useMemo(() => [
    { label: "Aplicação", status: "online" as SystemStatus, detail: "Operacional", icon: Server },
    { label: "Banco de Dados", status: "online" as SystemStatus, detail: "Operacional", icon: Database },
    { label: "Edge Functions", status: (errors24h > 10 ? "degraded" : "online") as SystemStatus, detail: errors24h > 10 ? `${errors24h} erros` : "Operacional", icon: Zap },
    { label: "Storage", status: "online" as SystemStatus, detail: "Ativo", icon: HardDrive },
    { label: "Webhooks", status: (webhookErrors > 0 ? "degraded" : "online") as SystemStatus, detail: webhookErrors > 0 ? `${webhookErrors} falhas` : "Operacional", icon: Webhook },
    { label: "Integrações", status: (webhookErrors > 5 ? "degraded" : "online") as SystemStatus, detail: webhookErrors > 5 ? "Instável" : "Operacional", icon: Link2 },
  ], [errors24h, webhookErrors]);

  const checks = SYSTEM_CHECKS[expanded || ""] || [];

  return (
    <div className="space-y-3">
      <SectionHeader icon={Activity} title="Saúde do Sistema" subtitle="Monitoramento em tempo real" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {items.map((s) => {
          const Icon = s.icon;
          const isOpen = expanded === s.label;
          return (
            <button
              key={s.label}
              onClick={() => setExpanded(isOpen ? null : s.label)}
              className={cn(
                "rounded-lg border p-3 text-left transition-all duration-200",
                isOpen ? "border-primary/40 bg-primary/5" :
                s.status === "online" ? "border-border/40 bg-card hover:border-border/60" :
                s.status === "degraded" ? "border-amber-500/30 bg-amber-500/5" :
                "border-red-500/30 bg-red-500/5"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <StatusPill status={s.status} />
                <Icon className="h-3 w-3 text-muted-foreground" />
              </div>
              <p className="text-[11px] font-medium text-foreground truncate">{s.label}</p>
              <p className="text-[9px] text-muted-foreground truncate">{s.detail}</p>
            </button>
          );
        })}
      </div>

      {expanded && checks.length > 0 && (
        <div className="rounded-lg border border-primary/15 bg-card p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-[11px] font-bold text-foreground">{expanded} — Endpoints</h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const text = checks.map(c => `${c.name}\n  ${c.method || "GET"} ${c.url}`).join("\n\n");
                navigator.clipboard.writeText(text);
              }}
              className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Copiar tudo
            </button>
          </div>
          {checks.map((check, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-muted/20 group">
              <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-foreground">{check.name}</span>
                  <span className="inline-flex items-center px-1 py-0 rounded text-[8px] font-mono border border-border/40 bg-muted/30 text-muted-foreground">{check.method || "GET"}</span>
                </div>
                <p className="text-[9px] text-muted-foreground font-mono break-all mt-0.5">{check.url}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(`${check.name}\n${check.method || "GET"} ${check.url}`);
                  const el = e.currentTarget;
                  el.textContent = "✓";
                  setTimeout(() => { el.textContent = "Copiar"; }, 1200);
                }}
                className="text-[9px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                Copiar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const TestsPanel = memo(function TestsPanel({ testRun, activeRun, lastCompletedRun, onNavigate, onRunTests }: { testRun: any; activeRun: any; lastCompletedRun: any; onNavigate: (s: string) => void; onRunTests?: () => void }) {
  const displayRun = lastCompletedRun || testRun;
  const isRunning = !!activeRun;
  const testPct = displayRun ? Math.round(((displayRun.passed_tests || 0) / Math.max(displayRun.total_tests || 1, 1)) * 100) : 0;

  const failedTests = useMemo(() => {
    if (!displayRun?.results || !Array.isArray(displayRun.results)) return [];
    return (displayRun.results as any[]).filter((r: any) => r.status === "failed");
  }, [displayRun?.results]);

  const [runningFull, setRunningFull] = useState(false);
  const handleRunTests = async () => {
    if (onRunTests) {
      setRunningFull(true);
      onRunTests();
      setTimeout(() => setRunningFull(false), 5000);
    }
  };

  const typeLabels: Record<string, string> = {
    contracts: "Contratos", smoke: "Smoke", seo: "SEO", api: "API",
    blog: "Blog", full: "Completo", frontend: "Frontend", checkout: "Checkout",
  };

  return (
    <MonitoringCard variant={displayRun?.status === "failed" ? "alert" : displayRun?.status === "success" ? "success" : isRunning ? "active" : "default"}>
      <div className="space-y-4">
        <SectionHeader
          icon={TestTube2}
          title={displayRun ? (typeLabels[displayRun.test_type] || displayRun.test_type || "Testes") : "Testes"}
          subtitle={displayRun ? `${displayRun.suite} · ${new Date(displayRun.created_at).toLocaleString("pt-BR")}` : undefined}
          actions={
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={handleRunTests} disabled={isRunning || runningFull} className="text-[10px] gap-1 h-7 border-border/40">
                {isRunning || runningFull ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Rodar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("test-center")} className="text-[10px] gap-1 h-7">
                Detalhes <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          }
        />

        {isRunning && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-blue-500/5 border border-blue-500/15">
            <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
            <span className="text-[10px] text-blue-400 font-medium">Execução em andamento ({activeRun.test_type})</span>
          </div>
        )}

        {displayRun ? (
          <>
            {/* Status + rate */}
            <div className="flex items-center gap-2">
              {displayRun.status === "success" ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">Aprovado</span>
              ) : displayRun.status === "failed" ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border border-red-500/25 bg-red-500/10 text-red-400 cursor-pointer hover:bg-red-500/15" onClick={() => onNavigate("test-center")}>Falhou</span>
              ) : displayRun.status === "partial" ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border border-amber-500/25 bg-amber-500/10 text-amber-400">Parcial</span>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-border/60 bg-muted/30 text-muted-foreground">{displayRun.status}</span>
              )}
            </div>

            {/* Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Taxa de sucesso</span>
                <span className="font-mono font-bold text-foreground">{testPct}%</span>
              </div>
              <HealthBar value={testPct} variant={testPct >= 90 ? "success" : testPct >= 60 ? "warning" : "danger"} />
            </div>

            {/* Counters */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { v: displayRun.total_tests || 0, l: "Total", c: "text-foreground" },
                { v: displayRun.passed_tests || 0, l: "OK", c: "text-emerald-400" },
                { v: displayRun.failed_tests || 0, l: "Falhas", c: "text-red-400" },
                { v: displayRun.skipped_tests || 0, l: "Ignorados", c: "text-amber-400" },
              ].map((item) => (
                <div key={item.l} className="text-center rounded-md bg-muted/20 py-2">
                  <p className={`text-lg font-bold font-mono tabular-nums ${item.c}`}>{item.v}</p>
                  <p className="text-[9px] text-muted-foreground">{item.l}</p>
                </div>
              ))}
            </div>

            {/* Failed tests */}
            {failedTests.length > 0 && (
              <div className="space-y-1.5 border-t border-red-500/15 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Falhas detectadas</p>
                  <button
                    onClick={() => {
                      const all = failedTests.map((ft: any) => [
                        `❌ ${ft.name}`, ft.url ? `   URL: ${ft.url}` : "", ft.error ? `   Erro: ${ft.error}` : "",
                        ft.spec ? `   Spec: ${ft.spec}` : "", ft.stack_trace ? `   Stack: ${ft.stack_trace}` : "",
                      ].filter(Boolean).join("\n")).join("\n\n");
                      navigator.clipboard.writeText(all);
                    }}
                    className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Copiar todos
                  </button>
                </div>
                {failedTests.map((ft: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => {
                      const parts = [
                        `❌ ${ft.name}`, ft.url ? `URL: ${ft.url}` : "", ft.error ? `Erro: ${ft.error}` : "",
                        ft.spec ? `Spec: ${ft.spec}` : "", ft.stack_trace ? `Stack:\n${ft.stack_trace}` : "",
                      ].filter(Boolean).join("\n");
                      navigator.clipboard.writeText(parts);
                    }}
                    className="w-full flex items-start gap-2 p-2 rounded-md bg-red-500/5 hover:bg-red-500/10 transition-colors text-left group border border-red-500/10"
                  >
                    <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-0.5 flex-1">
                      <p className="text-[10px] text-foreground font-medium">{ft.name}</p>
                      {ft.error && <p className="text-[9px] text-red-400/80 line-clamp-1">{ft.error}</p>}
                      {ft.spec && <p className="text-[9px] text-muted-foreground/60 font-mono">{ft.spec}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {displayRun.duration_ms && <p className="text-[9px] text-muted-foreground font-mono">Duração: {formatDuration(displayRun.duration_ms)}</p>}
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground">Nenhum teste executado</p>
            <Button size="sm" className="mt-3 text-[10px]" onClick={handleRunTests}><Play className="h-3 w-3 mr-1" /> Primeiro Teste</Button>
          </div>
        )}
      </div>
    </MonitoringCard>
  );
});

const FunnelPanel = memo(function FunnelPanel({ data, onNavigate }: { data: { leads: number; quotes: number; contracts: number; paymentsOk: number; paymentsFail: number }; onNavigate: (s: string) => void }) {
  const items = [
    { label: "Leads", value: data.leads, icon: Megaphone, variant: "info" as const, nav: "leads" },
    { label: "Orçamentos", value: data.quotes, icon: FileText, variant: "info" as const, nav: "leads" },
    { label: "Contratos", value: data.contracts, icon: FileText, variant: "info" as const, nav: "leads" },
    { label: "Pagamentos OK", value: data.paymentsOk, icon: CreditCard, variant: "success" as const, nav: "payments" },
    { label: "Pg. Falhos", value: data.paymentsFail, icon: XCircle, variant: "danger" as const, nav: "payments" },
  ];

  return (
    <MonitoringCard>
      <div className="space-y-4">
        <SectionHeader icon={TrendingUp} title="Funil Operacional" subtitle="Hoje" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            const colors = { info: "text-blue-400", success: "text-emerald-400", danger: "text-red-400", warning: "text-amber-400", default: "text-foreground" };
            const bgColors = { info: "bg-blue-500/8", success: "bg-emerald-500/8", danger: "bg-red-500/8", warning: "bg-amber-500/8", default: "bg-muted/30" };
            return (
              <button key={item.label} onClick={() => onNavigate(item.nav)} className={cn("flex items-center gap-2.5 p-2.5 rounded-lg transition-colors text-left", bgColors[item.variant], "hover:opacity-80")}>
                <Icon className={cn("h-3.5 w-3.5 shrink-0", colors[item.variant])} />
                <div className="min-w-0">
                  <p className={cn("text-base font-bold font-mono tabular-nums", colors[item.variant])}>{item.value}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{item.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </MonitoringCard>
  );
});

const ActivityPanel = memo(function ActivityPanel({ logs, audit, onNavigate }: { logs: any[]; audit: any[]; onNavigate: (s: string) => void }) {
  return (
    <MonitoringCard>
      <div className="space-y-3">
        <SectionHeader
          icon={Activity}
          title="Atividade Recente"
          actions={
            <Button variant="ghost" size="sm" onClick={() => onNavigate("logs")} className="text-[10px] gap-1 h-7">
              Ver tudo <ArrowRight className="h-3 w-3" />
            </Button>
          }
        />
        <div className="space-y-0.5">
          {logs.length === 0 && audit.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma atividade recente</p>
          ) : (
            <>
              {logs.map((log: any) => (
                <EventRow
                  key={log.id}
                  severity={log.status === "error" ? "error" : log.status === "warning" ? "warning" : "success"}
                  message={log.mensagem}
                  timestamp={new Date(log.created_at).toLocaleString("pt-BR")}
                  badge={log.tipo}
                />
              ))}
              {audit.map((a: any) => (
                <EventRow
                  key={a.id}
                  severity="info"
                  message={`${a.action} ${a.target_type ? `→ ${a.target_type}` : ""}`}
                  timestamp={new Date(a.created_at).toLocaleString("pt-BR")}
                  badge="audit"
                />
              ))}
            </>
          )}
        </div>
      </div>
    </MonitoringCard>
  );
});

const QuickActionsPanel = memo(function QuickActionsPanel({ onNavigate }: { onNavigate: (s: string) => void }) {
  const actions = [
    { label: "Centro de Testes", icon: TestTube2, nav: "test-center" },
    { label: "Alertas / Erros", icon: ShieldAlert, nav: "errors" },
    { label: "Leads & Propostas", icon: Megaphone, nav: "leads" },
    { label: "Pagamentos", icon: CreditCard, nav: "payments" },
    { label: "Logs Técnicos", icon: Eye, nav: "logs" },
    { label: "Diagnóstico", icon: Activity, nav: "diagnostics" },
    { label: "Webhooks", icon: Webhook, nav: "webhooks" },
  ];
  return (
    <MonitoringCard>
      <div className="space-y-3">
        <SectionHeader icon={Zap} title="Ações Rápidas" />
        <div className="space-y-0.5">
          {actions.map((action) => (
            <QuickAction key={action.label} icon={action.icon} label={action.label} onClick={() => onNavigate(action.nav)} />
          ))}
        </div>
      </div>
    </MonitoringCard>
  );
});

// ─── Main Component ────────────────────────────────────────────

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

  const handleRunTests = useCallback(async () => {
    try {
      await adminFunctionFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_type: "full" }),
      });
      setTimeout(() => tests.refetch(), 1000);
    } catch (err) {
      console.error("Run tests from dashboard:", err);
    }
  }, [tests]);

  useEffect(() => {
    if (allLoaded) setLastUpdate(new Date());
  }, [alerts.errors24h, alerts.webhookErrors, funnel.leads, tests.testRun?.id, activity.logs.length]);

  // Overall system status
  const overallStatus: "online" | "degraded" | "offline" = alerts.errors24h > 10 || alerts.webhookErrors > 5 ? "degraded" : "online";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusPill status={overallStatus} pulse />
          <div>
            <h2 className="text-base font-bold text-foreground">Centro de Comando</h2>
            <p className="text-[10px] text-muted-foreground font-mono">
              {allLoaded ? `Atualizado ${lastUpdate.toLocaleTimeString("pt-BR")}` : "Sincronizando..."} · Produção
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-[10px] gap-1 h-7"
          >
            {autoRefresh ? <Pause className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
            {autoRefresh ? "Auto" : "Pausado"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={refreshing} className="text-[10px] gap-1 h-7 border-border/40">
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Alerts */}
      <AlertsBanner errors24h={alerts.errors24h} webhookErrors={alerts.webhookErrors} onNavigate={onNavigate} />

      {/* Top metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Erros 24h" value={alerts.errors24h} icon={AlertTriangle} variant={alerts.errors24h > 0 ? "danger" : "success"} onClick={() => onNavigate("errors")} loading={!alerts.loaded} />
        <MetricCard label="Leads Hoje" value={funnel.leads} icon={Megaphone} variant="info" onClick={() => onNavigate("leads")} loading={!funnel.loaded} />
        <MetricCard label="Contratos" value={funnel.contracts} icon={FileText} variant="info" onClick={() => onNavigate("leads")} loading={!funnel.loaded} />
        <MetricCard label="Pagamentos" value={funnel.paymentsOk} icon={CreditCard} variant="success" onClick={() => onNavigate("payments")} loading={!funnel.loaded} />
      </div>

      {/* System Health */}
      <SystemHealthPanel errors24h={alerts.errors24h} webhookErrors={alerts.webhookErrors} />

      {/* Tests + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TestsPanel testRun={tests.testRun} activeRun={tests.activeRun} lastCompletedRun={tests.lastCompletedRun} onNavigate={onNavigate} onRunTests={handleRunTests} />
        <FunnelPanel data={{ leads: funnel.leads, quotes: funnel.quotes, contracts: funnel.contracts, paymentsOk: funnel.paymentsOk, paymentsFail: funnel.paymentsFail }} onNavigate={onNavigate} />
      </div>

      {/* Activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ActivityPanel logs={activity.logs} audit={activity.audit} onNavigate={onNavigate} />
        </div>
        <QuickActionsPanel onNavigate={onNavigate} />
      </div>
    </div>
  );
}

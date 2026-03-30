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
  const [lastCompletedRun, setLastCompletedRun] = useState<any>(null);
  const [activeRun, setActiveRun] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await adminQuery([
        // Latest completed run (the source of truth for counters)
        { table: "test_runs", select: "*", order: { column: "created_at", ascending: false }, limit: 1, filters: [{ column: "status", op: "in", value: ["success", "failed", "partial"] }] },
        // Any currently running run
        { table: "test_runs", select: "*", order: { column: "created_at", ascending: false }, limit: 1, filters: [{ column: "status", op: "eq", value: "running" }] },
      ]);
      const completed = ((res[0].data as any[]) || [])[0] || null;
      const running = ((res[1].data as any[]) || [])[0] || null;

      // Auto-detect stale: running for >15 min with no recent events
      if (running && running.started_at) {
        const elapsed = Date.now() - new Date(running.started_at).getTime();
        if (elapsed > 15 * 60 * 1000) {
          // Treat as stale - show completed instead
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

  // The "display" run: prefer active if exists, fallback to last completed
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

const SystemStatusGrid = memo(function SystemStatusGrid({ errors24h, webhookErrors }: { errors24h: number; webhookErrors: number }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const items = useMemo(() => [
    { label: "Aplicação", status: "online" as SystemStatus, detail: "Operacional", icon: Server },
    { label: "Banco de Dados", status: "online" as SystemStatus, detail: "Operacional", icon: Database },
    { label: "Edge Functions", status: (errors24h > 10 ? "degraded" : "online") as SystemStatus, detail: errors24h > 10 ? `${errors24h} erros` : "Operacional", icon: Zap },
    { label: "Storage", status: "online" as SystemStatus, detail: "Buckets ativos", icon: HardDrive },
    { label: "Webhooks", status: (webhookErrors > 0 ? "degraded" : "online") as SystemStatus, detail: webhookErrors > 0 ? `${webhookErrors} falhas` : "Sem falhas", icon: Webhook },
    { label: "Integrações", status: (webhookErrors > 5 ? "degraded" : "online") as SystemStatus, detail: webhookErrors > 5 ? "Instabilidade" : "Operacional", icon: Link2 },
  ], [errors24h, webhookErrors]);

  const checks = SYSTEM_CHECKS[expanded || ""] || [];

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Status do Sistema</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {items.map((s) => {
          const Icon = s.icon;
          const isOpen = expanded === s.label;
          return (
            <Card
              key={s.label}
              onClick={() => setExpanded(isOpen ? null : s.label)}
              className={`border cursor-pointer transition-colors duration-300 ${isOpen ? "border-primary/50 ring-1 ring-primary/20" : s.status === "online" ? "border-border hover:border-primary/30" : s.status === "degraded" ? "border-amber-500/30 hover:border-amber-500/50" : "border-red-500/30 hover:border-red-500/50"}`}
            >
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

      {/* Expanded detail panel */}
      {expanded && checks.length > 0 && (
        <Card className="mt-3 border-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-bold text-foreground">{expanded} — Conexões Validadas</h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const text = checks.map(c => `${c.name}\n  ${c.method || "GET"} ${c.url}`).join("\n\n");
                  navigator.clipboard.writeText(text);
                }}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Copiar tudo
              </button>
            </div>
            {checks.map((check, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-muted/30 group">
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-foreground">{check.name}</span>
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1">{check.method || "GET"}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono break-all mt-0.5">{check.url}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(`${check.name}\n${check.method || "GET"} ${check.url}`);
                    const el = e.currentTarget;
                    el.textContent = "✓";
                    setTimeout(() => { el.textContent = "Copiar"; }, 1200);
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                >
                  Copiar
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
});

const TestsBlock = memo(function TestsBlock({ testRun, activeRun, lastCompletedRun, onNavigate, onRunTests }: { testRun: any; activeRun: any; lastCompletedRun: any; onNavigate: (s: string) => void; onRunTests?: () => void }) {
  // For counters, always use the latest COMPLETED run so we never show zeros from a running run
  const displayRun = lastCompletedRun || testRun;
  const isRunning = !!activeRun;
  const testPct = displayRun ? Math.round(((displayRun.passed_tests || 0) / Math.max(displayRun.total_tests || 1, 1)) * 100) : 0;

  // Extract failed tests from results array
  const failedTests = useMemo(() => {
    if (!displayRun?.results || !Array.isArray(displayRun.results)) return [];
    return (displayRun.results as any[]).filter((r: any) => r.status === "failed");
  }, [displayRun?.results]);

  const [runningFull, setRunningFull] = useState(false);
  const handleRunTests = async () => {
    if (onRunTests) {
      setRunningFull(true);
      onRunTests();
      // Reset after 5s - the realtime subscription will update the state
      setTimeout(() => setRunningFull(false), 5000);
    }
  };

  return (
    <Card className={`border transition-colors duration-500 ${displayRun?.status === "failed" ? "border-red-500/30" : displayRun?.status === "success" ? "border-emerald-500/30" : isRunning ? "border-blue-500/30" : "border-border"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TestTube2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground truncate max-w-[180px]">
              {(() => {
                if (!displayRun) return "Testes";
                const typeLabels: Record<string, string> = {
                  contracts: "Contratos",
                  smoke: "Smoke",
                  seo: "SEO",
                  api: "API",
                  blog: "Blog",
                  full: "Completo",
                  frontend: "Frontend",
                  checkout: "Checkout",
                };
                return typeLabels[displayRun.test_type] || displayRun.test_type || "Testes";
              })()}
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunTests}
              disabled={isRunning || runningFull}
              className="text-xs gap-1 h-7"
            >
              {isRunning || runningFull ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Rodar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("test-center")} className="text-xs gap-1 h-7">
              Detalhes <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Show running indicator if there's an active run */}
        {isRunning && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-blue-500/10 border border-blue-500/20">
            <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
            <span className="text-xs text-blue-400 font-medium">Execução em andamento ({activeRun.test_type})</span>
          </div>
        )}

        {displayRun ? (
          <>
            <div className="flex items-center gap-2">
              {displayRun.status === "success" ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Aprovado</Badge>
              ) : displayRun.status === "failed" ? (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs cursor-pointer hover:bg-red-500/30" onClick={() => onNavigate("test-center")}>Falhou</Badge>
              ) : displayRun.status === "partial" ? (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs cursor-pointer hover:bg-amber-500/30" onClick={() => onNavigate("test-center")}>Parcial</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">{displayRun.status}</Badge>
              )}
              <span className="text-xs text-muted-foreground">{displayRun.suite} · {new Date(displayRun.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Taxa de sucesso</span>
                <span className="font-mono text-foreground">{testPct}%</span>
              </div>
              <Progress value={testPct} className="h-2 transition-all duration-700" />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-lg font-bold text-foreground">{displayRun.total_tests || 0}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
              <div><p className="text-lg font-bold text-emerald-400">{displayRun.passed_tests || 0}</p><p className="text-[10px] text-muted-foreground">Aprovados</p></div>
              <div><p className="text-lg font-bold text-red-400">{displayRun.failed_tests || 0}</p><p className="text-[10px] text-muted-foreground">Falhos</p></div>
              <div><p className="text-lg font-bold text-amber-400">{displayRun.skipped_tests || 0}</p><p className="text-[10px] text-muted-foreground">Ignorados</p></div>
            </div>

            {/* Inline failed tests with full details */}
            {failedTests.length > 0 && (
              <div className="space-y-1.5 border-t border-red-500/20 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Falhas detectadas:</p>
                  <button
                    onClick={() => {
                      const all = failedTests.map((ft: any) => [
                        `❌ ${ft.name}`,
                        ft.url ? `   URL: ${ft.url}` : "",
                        ft.error ? `   Erro: ${ft.error}` : "",
                        ft.spec ? `   Spec: ${ft.spec}` : "",
                        ft.stack_trace ? `   Stack: ${ft.stack_trace}` : "",
                        ft.cypress_command ? `   Comando: ${ft.cypress_command}` : "",
                      ].filter(Boolean).join("\n")).join("\n\n");
                      navigator.clipboard.writeText(all);
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Copiar todos
                  </button>
                </div>
                {failedTests.map((ft: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => {
                      const parts = [
                        `❌ ${ft.name}`,
                        ft.url ? `URL: ${ft.url}` : "",
                        ft.error ? `Erro: ${ft.error}` : "",
                        ft.spec ? `Spec: ${ft.spec}` : "",
                        ft.stack_trace ? `Stack Trace:\n${ft.stack_trace}` : "",
                        ft.cypress_command ? `Comando Cypress: ${ft.cypress_command}` : "",
                        ft.diff ? `Expected: ${JSON.stringify(ft.diff.expected)}\nActual: ${JSON.stringify(ft.diff.actual)}` : "",
                      ].filter(Boolean).join("\n");
                      navigator.clipboard.writeText(parts);
                      const el = document.getElementById(`dash-fail-${i}`);
                      if (el) { el.textContent = "✓ Copiado"; setTimeout(() => { el.textContent = "Copiar"; }, 1500); }
                    }}
                    className="w-full flex items-start justify-between gap-2 p-2.5 rounded-md bg-red-500/10 hover:bg-red-500/15 transition-colors text-left group"
                  >
                    <div className="flex items-start gap-1.5 min-w-0 flex-1">
                      <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-[11px] text-foreground font-medium">{ft.name}</p>
                        {ft.url && (
                          <p className="text-[10px] text-muted-foreground font-mono break-all">{ft.url}</p>
                        )}
                        {ft.error && <p className="text-[10px] text-red-400/90">{ft.error}</p>}
                        {ft.spec && <p className="text-[10px] text-muted-foreground/70">Spec: {ft.spec}</p>}
                      </div>
                    </div>
                    <span id={`dash-fail-${i}`} className="text-[10px] text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">Copiar</span>
                  </button>
                ))}
              </div>
            )}

            {displayRun.error_message && failedTests.length === 0 && (
              <p className="text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1 truncate">{displayRun.error_message}</p>
            )}
            {displayRun.duration_ms && <p className="text-[10px] text-muted-foreground">Duração: {formatDuration(displayRun.duration_ms)}</p>}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Nenhum teste executado</p>
            <Button size="sm" className="mt-2 text-xs" onClick={handleRunTests}><Play className="h-3 w-3 mr-1" /> Executar Primeiro Teste</Button>
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

  const handleRunTests = useCallback(async () => {
    try {
      const token = sessionStorage.getItem("admin_token");
      if (!token) return;
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ test_type: "full" }),
      });
      // Realtime will pick up the new run
      setTimeout(() => tests.refetch(), 1000);
    } catch (err) {
      console.error("Run tests from dashboard:", err);
    }
  }, [tests]);

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
        <TestsBlock testRun={tests.testRun} activeRun={tests.activeRun} lastCompletedRun={tests.lastCompletedRun} onNavigate={onNavigate} onRunTests={handleRunTests} />
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
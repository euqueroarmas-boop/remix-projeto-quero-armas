import { useState, useEffect, useCallback, useRef } from "react";
import { formatDuration } from "@/lib/formatDuration";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play, RefreshCw, CheckCircle, XCircle, Clock, Loader2,
  Eye, Zap, Globe, FileText, Shield, ShoppingCart, FormInput,
  Monitor, BookOpen, Server, AlertTriangle, Rocket, ArrowLeft,
  Bell, Send, MessageSquare, Mail, Webhook, ChevronDown, Image,
  Video, Bug, Terminal, ExternalLink, Copy, Home, Square,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Types ───
interface TestRun {
  id: string;
  suite: string;
  test_type: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  environment: string;
  triggered_by: string;
  execution_engine: string;
  base_url: string | null;
  browser: string | null;
  github_run_id: string | null;
  github_run_url: string | null;
  logs: any;
  error_message: string | null;
  screenshot_urls: string[] | null;
  video_urls: string[] | null;
  report_url: string | null;
  results: any[] | null;
  created_at: string;
  // New direct columns
  progress_percent: number | null;
  current_spec: string | null;
  current_test: string | null;
  current_url: string | null;
  total_specs: number | null;
  completed_specs: number | null;
  completed_tests: number | null;
  last_event_at: string | null;
  error_summary: string | null;
}

interface DetailedTestResult {
  name: string;
  fullTitle?: string;
  status: "passed" | "failed" | "skipped";
  duration_ms: number;
  error?: string;
  stack_trace?: string;
  diff?: { expected: any; actual: any } | null;
  cypress_command?: string;
  spec?: string;
  url?: string;
}

// ─── Constants ───
const SUITES = [
  { id: "smoke", label: "Smoke Test", icon: Zap, description: "Verifica se o site está de pé", engine: "light" },
  { id: "seo", label: "SEO Técnico", icon: Globe, description: "Title, meta, H1, sitemap, robots", engine: "light" },
  { id: "api", label: "APIs & Webhooks", icon: Server, description: "Endpoints, DB, Edge Functions", engine: "light" },
  { id: "blog", label: "Blog & Linkagem", icon: BookOpen, description: "Posts, links internos", engine: "light" },
  { id: "frontend", label: "Front-End / UI", icon: Monitor, description: "Menus, CTAs, botões, layout", engine: "cypress" },
  { id: "business", label: "Fluxos de Negócio", icon: Rocket, description: "Seleção, cálculo, passagem de dados", engine: "cypress" },
  { id: "forms", label: "Formulários", icon: FormInput, description: "CNPJ, CEP, máscaras, validação", engine: "cypress" },
  { id: "contracts", label: "Contratos", icon: FileText, description: "Preview, cláusulas, dados jurídicos", engine: "cypress" },
  { id: "checkout", label: "Checkout", icon: ShoppingCart, description: "Fluxo financeiro completo", engine: "cypress" },
  { id: "portal", label: "Portal / Área Restrita", icon: Shield, description: "Login, autenticação, acesso", engine: "cypress" },
  { id: "regression", label: "Regressão Crítica", icon: AlertTriangle, description: "Todos os fluxos críticos", engine: "cypress" },
] as const;

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  success: { color: "bg-green-600/20 text-green-400 border-green-600/30", icon: CheckCircle, label: "Sucesso" },
  failed: { color: "bg-red-600/20 text-red-400 border-red-600/30", icon: XCircle, label: "Falhou" },
  running: { color: "bg-blue-600/20 text-blue-400 border-blue-600/30", icon: Loader2, label: "Rodando" },
  pending: { color: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30", icon: Clock, label: "Pendente" },
  partial: { color: "bg-orange-600/20 text-orange-400 border-orange-600/30", icon: AlertTriangle, label: "Parcial" },
  cancelled: { color: "bg-gray-600/20 text-gray-400 border-gray-600/30", icon: XCircle, label: "Cancelado" },
};

const ITEMS_PER_PAGE = 20;

// ─── Diagnostic dump builder ───
function buildRunDump(run: TestRun, mode: "full" | "error" = "full"): string {
  const header = [
    `═══ WMTi Test Run Diagnostic ═══`,
    `Run ID: ${run.id}`,
    `Suite: ${run.suite} | Type: ${run.test_type}`,
    `Status: ${run.status}`,
    `Engine: ${run.execution_engine}`,
    `Environment: ${run.environment}`,
    `Triggered by: ${run.triggered_by}`,
    `Created: ${run.created_at}`,
    run.started_at ? `Started: ${run.started_at}` : null,
    run.finished_at ? `Finished: ${run.finished_at}` : null,
    run.duration_ms ? `Duration: ${run.duration_ms}ms (${(run.duration_ms / 1000).toFixed(1)}s)` : null,
    run.base_url ? `Base URL: ${run.base_url}` : null,
    run.browser ? `Browser: ${run.browser}` : null,
    run.github_run_id ? `GitHub Run: ${run.github_run_id}` : null,
    run.github_run_url ? `GitHub URL: ${run.github_run_url}` : null,
    ``,
    `── Summary ──`,
    `Total: ${run.total_tests} | Passed: ${run.passed_tests} | Failed: ${run.failed_tests} | Skipped: ${run.skipped_tests}`,
    run.total_specs ? `Specs: ${run.completed_specs || 0}/${run.total_specs}` : null,
    run.progress_percent !== null ? `Progress: ${run.progress_percent}%` : null,
    run.current_spec ? `Current spec: ${run.current_spec}` : null,
    run.current_url ? `Current URL: ${run.current_url}` : null,
  ].filter(Boolean).join("\n");

  const errorSection = (run.error_message || run.error_summary) ? [
    ``,
    `── Error ──`,
    run.error_message ? `Message: ${run.error_message}` : null,
    run.error_summary && run.error_summary !== run.error_message ? `Summary: ${run.error_summary}` : null,
  ].filter(Boolean).join("\n") : "";

  if (mode === "error") {
    // Failed test details from results
    const failedDetails = (run.results || [])
      .filter((r: any) => r.status === "failed")
      .map((r: any, i: number) => [
        `  [${i + 1}] ${r.name}`,
        r.url ? `      URL: ${r.url}` : null,
        r.error ? `      Error: ${r.error}` : null,
        r.duration_ms ? `      Duration: ${r.duration_ms}ms` : null,
      ].filter(Boolean).join("\n"))
      .join("\n");

    return [header, errorSection, failedDetails ? `\n── Failed Tests ──\n${failedDetails}` : ""].join("\n");
  }

  // Full dump
  const resultsSection = run.results && run.results.length > 0 ? [
    ``,
    `── Test Results (${run.results.length}) ──`,
    ...run.results.map((r: any, i: number) => [
      `  [${i + 1}] ${r.status === "passed" ? "✓" : r.status === "failed" ? "✗" : "⊘"} ${r.name}`,
      r.url ? `      URL: ${r.url}` : null,
      r.error ? `      Error: ${r.error}` : null,
      r.duration_ms !== undefined ? `      Duration: ${r.duration_ms}ms` : null,
    ].filter(Boolean).join("\n")),
  ].join("\n") : "";

  const logsSection = run.logs ? [
    ``,
    `── Logs ──`,
    typeof run.logs === "string" ? run.logs : JSON.stringify(run.logs, null, 2),
  ].join("\n") : "";

  const artifactsSection = [
    (run.screenshot_urls?.length || 0) > 0 ? `\n── Screenshots ──\n${run.screenshot_urls!.join("\n")}` : "",
    (run.video_urls?.length || 0) > 0 ? `\n── Videos ──\n${run.video_urls!.join("\n")}` : "",
    run.report_url ? `\n── Report ──\n${run.report_url}` : "",
  ].filter(Boolean).join("\n");

  return [header, errorSection, resultsSection, logsSection, artifactsSection].filter(Boolean).join("\n");
}

function copyDiagnostic(run: TestRun, mode: "full" | "error" = "full") {
  try {
    const text = buildRunDump(run, mode);
    navigator.clipboard.writeText(text);
    toast.success(mode === "full" ? "Dump completo copiado" : "Erro copiado com diagnóstico");
  } catch (err) {
    console.error("[WMTi] Clipboard write failed:", err);
    toast.error("Falha ao copiar para clipboard");
  }
}

function getAdminToken() {
  return sessionStorage.getItem("admin_token") || "";
}

async function invokeRunTests(method: "GET" | "POST", params?: Record<string, string>, body?: any) {
  const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-tests`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": getAdminToken(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Status Badge ───
function RunStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${config.color}`}>
      <Icon className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  );
}

// formatDuration importado de @/lib/formatDuration

// ─── Screenshot Viewer Dialog ───
function ScreenshotViewer({ urls }: { urls: string[] }) {
  const [selected, setSelected] = useState(0);
  if (!urls || urls.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5">
          <Image className="h-3.5 w-3.5" />
          Screenshots ({urls.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-sm">Screenshots da Execução</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <img
            src={urls[selected]}
            alt={`Screenshot ${selected + 1}`}
            className="w-full rounded-lg border border-border"
          />
          {urls.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {urls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`flex-shrink-0 w-20 h-14 rounded border overflow-hidden ${i === selected ? "border-primary ring-2 ring-primary/30" : "border-border opacity-60 hover:opacity-100"}`}
                >
                  <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            {decodeURIComponent(urls[selected]?.split("/").pop() || "")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Video Viewer Dialog ───
function VideoViewer({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5">
          <Video className="h-3.5 w-3.5" />
          Vídeos ({urls.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-sm">Vídeos da Execução</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4">
            {urls.map((url, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  {decodeURIComponent(url.split("/").pop() || `Video ${i + 1}`)}
                </p>
                <video controls className="w-full rounded-lg border border-border" preload="metadata">
                  <source src={url} type="video/mp4" />
                  Seu navegador não suporta vídeo.
                </video>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Expandable Error Block ───
function ErrorDetail({ result }: { result: DetailedTestResult }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs space-y-1.5">
        <CollapsibleTrigger className="w-full">
          <div className="flex justify-between items-center cursor-pointer">
            <div className="flex items-center gap-2 text-left">
              <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
              <span className="font-medium text-foreground">{result.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{formatDuration(result.duration_ms)}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </div>
        </CollapsibleTrigger>

        {result.error && (
          <p className="text-destructive/90 text-[11px] pl-5">{result.error}</p>
        )}

        <CollapsibleContent className="space-y-2 pt-2">
          {result.spec && (
            <div className="pl-5">
              <span className="text-[10px] font-medium text-muted-foreground">Spec: </span>
              <span className="text-[10px] text-foreground font-mono">{result.spec}</span>
            </div>
          )}

          {result.diff && (
            <div className="pl-5 p-2 rounded bg-muted/50 border border-border space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground">Expected vs Actual</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-green-400 font-medium">Expected:</p>
                  <pre className="text-[10px] text-foreground font-mono break-all">{JSON.stringify(result.diff.expected, null, 2)}</pre>
                </div>
                <div>
                  <p className="text-[10px] text-red-400 font-medium">Actual:</p>
                  <pre className="text-[10px] text-foreground font-mono break-all">{JSON.stringify(result.diff.actual, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}

          {result.stack_trace && (
            <div className="pl-5">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Bug className="h-3 w-3" /> Stack Trace
              </p>
              <pre className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto max-h-48 font-mono whitespace-pre-wrap border border-border">
                {result.stack_trace}
              </pre>
            </div>
          )}

          {result.cypress_command && (
            <div className="pl-5">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Terminal className="h-3 w-3" /> Comando Cypress
              </p>
              <pre className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto max-h-32 font-mono whitespace-pre-wrap border border-border">
                {result.cypress_command}
              </pre>
            </div>
          )}

          {/* Copy full error button */}
          <div className="pl-5 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] h-6 px-2 gap-1"
              onClick={(e) => {
                e.stopPropagation();
                const parts = [
                  `Teste: ${result.name}`,
                  result.spec ? `Spec: ${result.spec}` : "",
                  `Status: ${result.status}`,
                  `Duração: ${formatDuration(result.duration_ms)}`,
                  result.error ? `\nErro:\n${result.error}` : "",
                  result.stack_trace ? `\nStack Trace:\n${result.stack_trace}` : "",
                  result.cypress_command ? `\nComando Cypress:\n${result.cypress_command}` : "",
                  result.diff ? `\nExpected: ${JSON.stringify(result.diff.expected)}\nActual: ${JSON.stringify(result.diff.actual)}` : "",
                ].filter(Boolean).join("\n");
                navigator.clipboard.writeText(parts);
                toast.success("Erro copiado com sucesso");
              }}
            >
              <Copy className="h-3 w-3" /> Copiar erro
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── GitHub Diagnostic Panel ───
function GitHubDiagnosticPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runDiag = async () => {
    setLoading(true);
    try {
      const data = await invokeRunTests("GET", { action: "github_status" });
      setResult(data);
    } catch (err) {
      setResult({ error: String(err) });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={runDiag} disabled={loading} className="text-xs gap-1.5">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bug className="h-3 w-3" />}
        Diagnosticar GitHub Actions
      </Button>
      {result && (
        <div className="space-y-2">
          {result.error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs space-y-1">
              <p className="font-bold text-destructive">❌ Problema detectado</p>
              <p className="text-destructive/80">{result.error}</p>
              {result.diagnostic?.fix && (
                <p className="text-foreground font-medium mt-2">💡 Solução: {result.diagnostic.fix}</p>
              )}
            </div>
          )}
          {result.diagnostic && !result.error && (
            <div className="p-3 rounded-lg bg-green-600/10 border border-green-600/30 text-xs space-y-2">
              <p className="font-bold text-green-400">✅ GitHub API acessível</p>
              <div className="text-muted-foreground space-y-0.5">
                <p>Repo: <span className="text-foreground font-mono">{result.diagnostic.repo}</span></p>
                <p>Workflow: <span className="text-foreground font-mono">{result.diagnostic.workflow}</span></p>
                <p>Total de execuções: <span className="text-foreground">{result.diagnostic.total_count}</span></p>
              </div>
              {result.diagnostic.recent_runs?.length > 0 && (
                <div className="space-y-1 mt-2">
                  <p className="font-semibold text-foreground">Últimas execuções:</p>
                  {result.diagnostic.recent_runs.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-muted/30 rounded px-2 py-1">
                      <div className="flex items-center gap-2">
                        <span className={r.conclusion === "success" ? "text-green-400" : r.conclusion === "failure" ? "text-red-400" : r.status === "in_progress" ? "text-blue-400" : "text-yellow-400"}>
                          {r.conclusion === "success" ? "✓" : r.conclusion === "failure" ? "✗" : r.status === "in_progress" ? "⟳" : "⏳"}
                        </span>
                        <span className="text-foreground">#{r.run_number}</span>
                        <span className="text-muted-foreground">{r.status}{r.conclusion ? ` (${r.conclusion})` : ""}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                        <a href={r.html_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 text-primary" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {result.diagnostic.recent_runs?.length === 0 && (
                <p className="text-amber-400 mt-1">⚠️ Nenhuma execução recente encontrada. O workflow pode nunca ter sido executado ou o PAT não tem permissão.</p>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-6 gap-1"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(result, null, 2));
              toast.success("Diagnóstico copiado");
            }}
          >
            <Copy className="h-3 w-3" /> Copiar diagnóstico
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Live Progress Panel (Enhanced with real-time details) ───
function LiveProgressPanel({ run }: { run: TestRun }) {
  const STALE_TIMEOUT_MS = 10 * 60 * 1000; // 10 min for individual tests
  const isStale = run.started_at && (Date.now() - new Date(run.started_at).getTime()) > STALE_TIMEOUT_MS;
  const isGitHub = run.execution_engine === "github_actions";

  // Detect GitHub stuck at 0% for more than 3 minutes
  const elapsedMs = run.started_at ? Date.now() - new Date(run.started_at).getTime() : 0;
  const isGitHubStuck = isGitHub && (run.progress_percent ?? 0) === 0 && elapsedMs > 3 * 60 * 1000;

  const completed = (run.completed_tests ?? 0) || (run.passed_tests + run.failed_tests + run.skipped_tests);
  const total = run.total_tests || 1;
  const pct = run.progress_percent ?? (total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0);
  const [elapsed, setElapsed] = useState(0);
  const [showLogs, setShowLogs] = useState(true);
  const [showDiag, setShowDiag] = useState(false);

  const logs = run.logs as any;
  const currentSpec = run.current_spec || logs?.current_spec || null;
  const currentTest = run.current_test || null;
  const currentUrl = run.current_url || logs?.current_url || null;
  const logEntries: Array<{ ts: string; event: string; detail?: string }> = logs?.entries || [];
  const specsCompleted = run.completed_specs ?? logs?.specs_completed ?? null;
  const totalSpecs = run.total_specs ?? logs?.total_specs ?? null;

  useEffect(() => {
    if (!run.started_at) return;
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - new Date(run.started_at!).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [run.started_at]);

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  };

  const estimatedRemaining = pct > 5 && elapsed > 0
    ? Math.round((elapsed / pct) * (100 - pct))
    : null;

  const recentActivity = logEntries.slice(-5).reverse();
  const lastScannedUrl = logEntries.filter(e => e.detail?.includes("→")).slice(-1)[0]?.detail?.split("→")[1]?.trim();

  if (isStale) {
    return (
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold text-foreground">
                {SUITES.find(s => s.id === run.test_type)?.label || run.test_type}
              </span>
            </div>
            <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">Expirado</Badge>
          </div>
          <p className="text-xs text-amber-400">
            Execução iniciada há mais de 10 minutos sem finalização. Pode ter falhado silenciosamente no GitHub Actions.
          </p>
          {run.github_run_url && (
            <a href={run.github_run_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Ver no GitHub Actions
            </a>
          )}
          <GitHubDiagnosticPanel />
          <p className="text-[10px] text-muted-foreground">
            Início: {run.started_at ? new Date(run.started_at).toLocaleString("pt-BR") : "—"} · Tempo decorrido: {formatElapsed(elapsed)}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
            <span className="text-sm font-bold text-foreground">
              {SUITES.find(s => s.id === run.test_type)?.label || run.test_type}
            </span>
          </div>
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            {isGitHub ? "GitHub Actions" : "Edge Function"}
          </Badge>
        </div>

        {/* Big percentage */}
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black text-primary tabular-nums">{pct}%</span>
          <div className="flex-1 space-y-1">
            <Progress value={pct} className="h-3" />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{completed} de {run.total_tests || "?"} testes concluídos</span>
              <span>{formatElapsed(elapsed)} decorridos</span>
            </div>
            {estimatedRemaining !== null && estimatedRemaining > 0 && (
              <p className="text-[10px] text-muted-foreground/70">
                ≈ {formatElapsed(estimatedRemaining)} restantes
              </p>
            )}
          </div>
        </div>

        {/* Spec progress (for Cypress) */}
        {specsCompleted !== null && totalSpecs !== null && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-1.5">
            📂 Spec {specsCompleted} de {totalSpecs} concluídos
          </div>
        )}

        {/* GitHub stuck warning */}
        {isGitHubStuck && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-amber-400 font-medium">
                GitHub Actions não enviou progresso há {formatElapsed(elapsed)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Possíveis causas: PAT sem permissão, workflow não encontrado no branch main, runner em fila, ou timeout da rede.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] h-6 gap-1"
              onClick={() => setShowDiag(!showDiag)}
            >
              <Bug className="h-3 w-3" /> {showDiag ? "Ocultar diagnóstico" : "Diagnosticar"}
            </Button>
            {showDiag && <GitHubDiagnosticPanel />}
          </div>
        )}

        {/* Current spec & URL */}
        <div className="space-y-1.5 bg-muted/20 rounded-lg p-2.5 border border-border/50">
          {currentSpec && (
            <div className="flex items-center gap-1.5 text-xs">
              <FileText className="h-3 w-3 text-primary flex-shrink-0" />
              <span className="text-muted-foreground">Escaneando:</span>
              <span className="font-medium text-foreground truncate">{currentSpec}</span>
            </div>
          )}
          {currentTest && (
            <div className="flex items-center gap-1.5 text-xs">
              <Play className="h-3 w-3 text-primary flex-shrink-0" />
              <span className="text-muted-foreground">Teste:</span>
              <span className="font-medium text-foreground truncate">{currentTest}</span>
            </div>
          )}
          {(currentUrl || lastScannedUrl) && (
            <div className="flex items-center gap-1.5 text-xs">
              <Globe className="h-3 w-3 text-primary flex-shrink-0" />
              <span className="text-muted-foreground">URL:</span>
              <span className="font-mono text-foreground truncate text-[11px]">{currentUrl || lastScannedUrl}</span>
            </div>
          )}
          {!currentSpec && !currentUrl && !lastScannedUrl && (
            <div className="flex items-center gap-1.5 text-xs">
              <Loader2 className="h-3 w-3 text-primary animate-spin flex-shrink-0" />
              <span className="text-muted-foreground">
                {isGitHub
                  ? "Aguardando GitHub Actions iniciar o runner..."
                  : "Iniciando verificação..."}
              </span>
            </div>
          )}
        </div>

        {/* Counters */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-green-600/10 rounded-md py-1.5 px-2">
            <div className="text-green-400 font-bold text-lg">{run.passed_tests}</div>
            <div className="text-green-400/70">Passaram</div>
          </div>
          <div className="bg-red-600/10 rounded-md py-1.5 px-2">
            <div className="text-red-400 font-bold text-lg">{run.failed_tests}</div>
            <div className="text-red-400/70">Falharam</div>
          </div>
          <div className="bg-yellow-600/10 rounded-md py-1.5 px-2">
            <div className="text-yellow-400 font-bold text-lg">{run.skipped_tests}</div>
            <div className="text-yellow-400/70">Pulados</div>
          </div>
        </div>

        {run.error_message && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-md p-2">{run.error_message}</p>
        )}

        {/* Live log entries */}
        {logEntries.length > 0 && (
          <Collapsible open={showLogs} onOpenChange={setShowLogs}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground cursor-pointer py-1">
                <span className="flex items-center gap-1">
                  <Terminal className="h-3 w-3" /> Atividade em tempo real ({logEntries.length})
                </span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showLogs ? "rotate-180" : ""}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="max-h-56 mt-1">
                <div className="space-y-0.5 font-mono text-[10px]">
                  {logEntries.slice(-30).reverse().map((entry, i) => {
                    const eventColor = entry.event?.includes("passed") || entry.event?.includes("completed")
                      ? "text-green-400"
                      : entry.event?.includes("failed")
                        ? "text-red-400"
                        : entry.event?.includes("started")
                          ? "text-blue-400"
                          : "text-muted-foreground";
                    return (
                      <div key={i} className="flex gap-2 py-0.5">
                        <span className="text-muted-foreground/50 flex-shrink-0 w-16">
                          {new Date(entry.ts).toLocaleTimeString("pt-BR")}
                        </span>
                        <span className={`${eventColor} flex-shrink-0 w-3`}>
                          {entry.event?.includes("passed") ? "✓" : entry.event?.includes("failed") ? "✗" : "→"}
                        </span>
                        <span className="text-foreground/80 break-all">{entry.detail || entry.event}</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Detail View (ENHANCED with full observability) ───
function RunDetail({ run, onBack }: { run: TestRun; onBack: () => void }) {
  const results = (run.results || []) as DetailedTestResult[];
  const passed = results.filter(r => r.status === "passed");
  const failed = results.filter(r => r.status === "failed");
  const skipped = results.filter(r => r.status === "skipped");
  const pct = run.total_tests > 0 ? Math.round((run.passed_tests / run.total_tests) * 100) : 0;

  // Group by spec file
  const specGroups = results.reduce<Record<string, DetailedTestResult[]>>((acc, r) => {
    const spec = r.spec || "Sem spec";
    if (!acc[spec]) acc[spec] = [];
    acc[spec].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-xs">
        <ArrowLeft className="h-3 w-3 mr-1" /> Voltar ao histórico
      </Button>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">
              {SUITES.find(s => s.id === run.test_type)?.label || run.test_type}
            </CardTitle>
            <RunStatusBadge status={run.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div><span className="text-muted-foreground block mb-0.5">Início</span><span className="text-foreground font-medium">{run.started_at ? new Date(run.started_at).toLocaleString("pt-BR") : "—"}</span></div>
            <div><span className="text-muted-foreground block mb-0.5">Duração</span><span className="text-foreground font-medium">{formatDuration(run.duration_ms)}</span></div>
            <div><span className="text-muted-foreground block mb-0.5">Motor</span><span className="text-foreground font-medium">{run.execution_engine}</span></div>
            <div><span className="text-muted-foreground block mb-0.5">Disparado por</span><span className="text-foreground font-medium">{run.triggered_by}</span></div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Taxa de sucesso</span>
              <span className="font-bold text-foreground">{pct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
              <div className="bg-green-500 h-full transition-all" style={{ width: `${(run.passed_tests / (run.total_tests || 1)) * 100}%` }} />
              <div className="bg-red-500 h-full transition-all" style={{ width: `${(run.failed_tests / (run.total_tests || 1)) * 100}%` }} />
              <div className="bg-yellow-500 h-full transition-all" style={{ width: `${(run.skipped_tests / (run.total_tests || 1)) * 100}%` }} />
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-green-400">✓ {run.passed_tests} passaram</span>
              <span className="text-red-400">✗ {run.failed_tests} falharam</span>
              {run.skipped_tests > 0 && <span className="text-yellow-400">⊘ {run.skipped_tests} pulados</span>}
              <span className="text-muted-foreground ml-auto">Total: {run.total_tests}</span>
            </div>
          </div>

          {run.error_message && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-xs">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-destructive">Erro principal</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1"
                  onClick={() => copyDiagnostic(run, "error")}
                >
                  <Copy className="h-3 w-3" /> Copiar erro
                </Button>
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap">{run.error_message}</p>
            </div>
          )}

          {/* Action buttons: screenshots, videos, GitHub */}
          <div className="flex flex-wrap gap-2">
            {run.screenshot_urls && run.screenshot_urls.length > 0 && (
              <ScreenshotViewer urls={run.screenshot_urls} />
            )}
            {run.video_urls && run.video_urls.length > 0 && (
              <VideoViewer urls={run.video_urls} />
            )}
            {run.github_run_url && (
              <a href={run.github_run_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  GitHub Actions
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Failed Tests - Detailed with expandable errors */}
      {failed.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Testes que Falharam ({failed.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-7 gap-1"
                onClick={() => {
                  const allErrors = failed.map(t => [
                    `❌ ${t.name}`,
                    t.spec ? `   Spec: ${t.spec}` : "",
                    t.error ? `   Erro: ${t.error}` : "",
                    t.stack_trace ? `   Stack: ${t.stack_trace}` : "",
                    t.cypress_command ? `   Comando: ${t.cypress_command}` : "",
                    "",
                  ].filter(Boolean).join("\n")).join("\n");
                  navigator.clipboard.writeText(allErrors);
                  toast.success("Todos os erros copiados");
                }}
              >
                <Copy className="h-3 w-3" /> Copiar todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failed.map((t, i) => (
                <ErrorDetail key={i} result={t} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tests grouped by spec */}
      {Object.keys(specGroups).length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Por Arquivo de Spec
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(specGroups).map(([spec, tests]) => {
                const specPassed = tests.filter(t => t.status === "passed").length;
                const specFailed = tests.filter(t => t.status === "failed").length;
                return (
                  <Collapsible key={spec}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                        <span className="text-xs font-mono text-foreground truncate">{spec}</span>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-green-400">{specPassed}✓</span>
                          {specFailed > 0 && <span className="text-red-400">{specFailed}✗</span>}
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-3 border-l-2 border-border ml-2 space-y-1 mt-1">
                        {tests.map((t, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 px-2">
                            <div className="flex items-center gap-1.5">
                              {t.status === "passed" ? (
                                <CheckCircle className="h-3 w-3 text-green-400" />
                              ) : t.status === "failed" ? (
                                <XCircle className="h-3 w-3 text-red-400" />
                              ) : (
                                <Clock className="h-3 w-3 text-yellow-400" />
                              )}
                              <span className="text-foreground">{t.name}</span>
                            </div>
                            <span className="text-muted-foreground">{formatDuration(t.duration_ms)}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passed Tests */}
      {passed.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Testes que Passaram ({passed.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {passed.map((t, i) => (
                <div key={i} className="flex justify-between items-center text-xs py-1.5 px-2 rounded hover:bg-muted/30">
                  <span className="text-foreground">{t.name}</span>
                  <span className="text-muted-foreground">{formatDuration(t.duration_ms)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skipped Tests */}
      {skipped.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-400 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Testes Pulados ({skipped.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {skipped.map((t, i) => (
                <div key={i} className="flex justify-between items-center text-xs py-1.5 px-2 rounded hover:bg-muted/30">
                  <span className="text-muted-foreground">{t.name}</span>
                  <span className="text-muted-foreground">{formatDuration(t.duration_ms)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Technical Logs */}
      {run.logs && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                Logs técnicos
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] gap-1"
                onClick={() => copyDiagnostic(run, "full")}
              >
                <Copy className="h-3 w-3" /> Copiar dump completo
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-[11px] text-muted-foreground bg-muted/50 p-3 rounded overflow-auto max-h-48 font-mono">
              {JSON.stringify(run.logs, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Alert Config Panel ───
interface AlertConfigItem {
  id?: string;
  channel: string;
  enabled: boolean;
  config: Record<string, string>;
}

const ALERT_CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare, configFields: [{ key: "phone", label: "Número (com DDD)", placeholder: "5512999887766" }] },
  { id: "email", label: "E-mail", icon: Mail, configFields: [{ key: "to", label: "E-mail de destino", placeholder: "admin@wmti.com.br" }] },
  { id: "webhook", label: "Webhook", icon: Webhook, configFields: [{ key: "url", label: "URL do webhook", placeholder: "https://..." }] },
];

function AlertConfigPanel() {
  const [localForms, setLocalForms] = useState<Record<string, { enabled: boolean; config: Record<string, string>; id?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-alerts`, {
        headers: { "x-admin-token": getAdminToken(), "Content-Type": "application/json" },
      });
      const data = await res.json();
      const configs = Array.isArray(data) ? data : [];

      const forms: typeof localForms = {};
      ALERT_CHANNELS.forEach(ch => {
        const existing = configs.find((c: AlertConfigItem) => c.channel === ch.id);
        forms[ch.id] = {
          enabled: existing?.enabled ?? false,
          config: existing?.config || {},
          id: existing?.id,
        };
      });
      setLocalForms(forms);
    } catch (err) {
      console.error("Fetch alert configs:", err);
      const forms: typeof localForms = {};
      ALERT_CHANNELS.forEach(ch => {
        forms[ch.id] = { enabled: false, config: {}, id: undefined };
      });
      setLocalForms(forms);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const updateLocalField = (channel: string, fieldKey: string, value: string) => {
    setLocalForms(prev => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        config: { ...prev[channel]?.config, [fieldKey]: value },
      },
    }));
  };

  const updateLocalEnabled = (channel: string, enabled: boolean) => {
    setLocalForms(prev => ({
      ...prev,
      [channel]: { ...prev[channel], enabled },
    }));
  };

  const handleSave = async (channel: string) => {
    const form = localForms[channel];
    if (!form) return;
    setSaving(channel);
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-alerts`, {
        method: "POST",
        headers: { "x-admin-token": getAdminToken(), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_config", id: form.id, channel, enabled: form.enabled, config: form.config }),
      });
      setSaveSuccess(channel);
      setTimeout(() => setSaveSuccess(null), 2000);
      await fetchConfigs();
    } catch (err) {
      console.error("Save config:", err);
    }
    setSaving(null);
  };

  const handleTest = async (channel: string) => {
    const form = localForms[channel];
    if (!form) return;
    setTesting(channel);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-alerts`, {
        method: "POST",
        headers: { "x-admin-token": getAdminToken(), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_alert", channel, config: form.config }),
      });
      const result = await res.json();
      alert(result.ok ? `✅ Alerta de teste enviado para ${channel}` : `❌ Falha: ${result.error}`);
    } catch (err) {
      alert(`❌ Erro: ${err}`);
    }
    setTesting(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando configurações...
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {ALERT_CHANNELS.map((ch) => {
        const form = localForms[ch.id] || { enabled: false, config: {} };
        const Icon = ch.icon;
        const hasValue = ch.configFields.some(f => form.config[f.key]?.trim());

        return (
          <Card key={ch.id} className={`transition-all ${form.enabled ? "border-primary/40 bg-primary/5" : "border-border"}`}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${form.enabled ? "bg-primary/20" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${form.enabled ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <span className="text-sm font-bold text-foreground">{ch.label}</span>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(checked) => updateLocalEnabled(ch.id, checked)}
                />
              </div>

              {ch.configFields.map((field) => (
                <div key={field.key}>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{field.label}</label>
                  <Input
                    type="text"
                    placeholder={field.placeholder}
                    value={form.config[field.key] || ""}
                    onChange={(e) => updateLocalField(ch.id, field.key, e.target.value)}
                    className="text-sm h-9"
                  />
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => handleSave(ch.id)}
                  disabled={saving === ch.id}
                  className="flex-1 h-8 text-xs"
                >
                  {saving === ch.id ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : saveSuccess === ch.id ? (
                    <CheckCircle className="h-3 w-3 mr-1 text-green-400" />
                  ) : null}
                  {saveSuccess === ch.id ? "Salvo!" : "Salvar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTest(ch.id)}
                  disabled={testing === ch.id || !hasValue}
                  className="h-8 text-xs"
                >
                  {testing === ch.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                  Testar
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Global Summary Card ───
function GlobalSummary({ suiteStatuses }: { suiteStatuses: { suite: typeof SUITES[number]; run: TestRun | null }[] }) {
  const withRuns = suiteStatuses.filter(s => s.run !== null);
  const totalSuites = withRuns.length;
  const failedSuites = withRuns.filter(s => ["failed", "partial"].includes(s.run!.status)).length;
  const successSuites = withRuns.filter(s => s.run!.status === "success").length;
  const runningSuites = withRuns.filter(s => s.run!.status === "running").length;

  const totalTests = withRuns.reduce((a, s) => a + (s.run!.total_tests || 0), 0);
  const passedTests = withRuns.reduce((a, s) => a + (s.run!.passed_tests || 0), 0);
  const failedTests = withRuns.reduce((a, s) => a + (s.run!.failed_tests || 0), 0);
  const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  // Find latest finished run
  const finishedRuns = withRuns
    .filter(s => s.run!.finished_at)
    .sort((a, b) => new Date(b.run!.finished_at!).getTime() - new Date(a.run!.finished_at!).getTime());
  const lastFinished = finishedRuns[0]?.run || null;

  // Global status
  let globalStatus: string;
  let globalStatusLabel: string;
  if (runningSuites > 0) {
    globalStatus = "running";
    globalStatusLabel = `${runningSuites} suite${runningSuites > 1 ? "s" : ""} em execução`;
  } else if (totalSuites === 0) {
    globalStatus = "neutral";
    globalStatusLabel = "Nenhum teste executado";
  } else if (failedSuites > 0) {
    globalStatus = "failed";
    globalStatusLabel = `${failedSuites} suite${failedSuites > 1 ? "s" : ""} com falha`;
  } else {
    globalStatus = "success";
    globalStatusLabel = "Todas as suites saudáveis";
  }

  const borderColor = globalStatus === "success" ? "border-green-600/30" : globalStatus === "failed" ? "border-red-600/30" : globalStatus === "running" ? "border-blue-600/30" : "border-border";
  const bgColor = globalStatus === "success" ? "bg-green-600/5" : globalStatus === "failed" ? "bg-red-600/5" : globalStatus === "running" ? "bg-blue-600/5" : "";

  return (
    <Card className={`${borderColor} ${bgColor}`}>
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: status + label */}
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${globalStatus === "success" ? "bg-green-600/15" : globalStatus === "failed" ? "bg-red-600/15" : globalStatus === "running" ? "bg-blue-600/15" : "bg-muted"}`}>
              {globalStatus === "success" && <CheckCircle className="h-6 w-6 text-green-400" />}
              {globalStatus === "failed" && <XCircle className="h-6 w-6 text-red-400" />}
              {globalStatus === "running" && <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />}
              {globalStatus === "neutral" && <Clock className="h-6 w-6 text-muted-foreground" />}
            </div>
            <div>
              <p className="text-base font-bold text-foreground">{globalStatusLabel}</p>
              {lastFinished && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Último ciclo: {new Date(lastFinished.finished_at!).toLocaleString("pt-BR")}
                  {lastFinished.duration_ms ? ` · ${formatDuration(lastFinished.duration_ms)}` : ""}
                </p>
              )}
            </div>
          </div>

          {/* Right: counters */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-lg font-black text-foreground tabular-nums">{totalSuites}</p>
              <p className="text-[10px] text-muted-foreground">Suites</p>
            </div>
            <div>
              <p className="text-lg font-black text-green-400 tabular-nums">{successSuites}</p>
              <p className="text-[10px] text-green-400/70">OK</p>
            </div>
            <div>
              <p className="text-lg font-black text-red-400 tabular-nums">{failedSuites}</p>
              <p className="text-[10px] text-red-400/70">Falhas</p>
            </div>
            <div>
              <p className="text-lg font-black text-foreground tabular-nums">{successRate}%</p>
              <p className="text-[10px] text-muted-foreground">Sucesso</p>
            </div>
          </div>
        </div>

        {/* Test-level breakdown bar */}
        {totalTests > 0 && (
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{passedTests} passaram · {failedTests} falharam · {totalTests} total</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden flex">
              <div className="bg-green-500 h-full transition-all" style={{ width: `${(passedTests / totalTests) * 100}%` }} />
              <div className="bg-red-500 h-full transition-all" style={{ width: `${(failedTests / totalTests) * 100}%` }} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Suite Card (standardized) ───
function SuiteCard({
  suite, lastRun, isRunning, onRun, onStop, onViewDetails, onCopyError,
}: {
  suite: typeof SUITES[number];
  lastRun: TestRun | null;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  onViewDetails: () => void;
  onCopyError: () => void;
}) {
  const Icon = suite.icon;
  const isLight = suite.engine === "light";
  const hasRunningInDb = lastRun && lastRun.status === "running";
  const showStop = isRunning || !!hasRunningInDb;
  const hasFailed = lastRun && ["failed", "partial"].includes(lastRun.status);
  const hasSuccess = lastRun && lastRun.status === "success";
  const neverRun = !lastRun;

  return (
    <Card className={`transition-all h-full flex flex-col ${showStop ? "border-blue-500/40 bg-blue-500/5" : hasFailed ? "border-red-600/20" : hasSuccess ? "border-green-600/20" : "border-border"}`}>
      <CardContent className="p-4 flex flex-col flex-1 gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-lg flex-shrink-0 ${showStop ? "bg-blue-500/15" : hasFailed ? "bg-red-600/10" : hasSuccess ? "bg-green-600/10" : "bg-muted"}`}>
              <Icon className={`h-4 w-4 ${showStop ? "text-blue-400 animate-pulse" : hasFailed ? "text-red-400" : hasSuccess ? "text-green-400" : "text-muted-foreground"}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{suite.label}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{suite.description}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-normal flex-shrink-0">
            {isLight ? "⚡ Leve" : "🧪 Cypress"}
          </Badge>
        </div>

        {/* Status + Results */}
        {neverRun ? (
          <div className="flex-1 flex items-center justify-center py-3">
            <p className="text-xs text-muted-foreground italic">Nunca executado</p>
          </div>
        ) : (
          <div className="flex-1 space-y-2">
            {/* Status badge + date */}
            <div className="flex items-center justify-between gap-2">
              <RunStatusBadge status={lastRun.status} />
              <span className="text-[10px] text-muted-foreground">
                {lastRun.finished_at
                  ? new Date(lastRun.finished_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                  : lastRun.started_at
                    ? new Date(lastRun.started_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                    : ""}
              </span>
            </div>

            {/* Numeric summary */}
            {lastRun.total_tests > 0 && (
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-green-600/10 rounded py-1">
                  <span className="text-sm font-bold text-green-400">{lastRun.passed_tests}</span>
                  <p className="text-[9px] text-green-400/70">OK</p>
                </div>
                <div className="bg-red-600/10 rounded py-1">
                  <span className="text-sm font-bold text-red-400">{lastRun.failed_tests}</span>
                  <p className="text-[9px] text-red-400/70">Falha</p>
                </div>
                <div className="bg-muted/50 rounded py-1">
                  <span className="text-sm font-bold text-foreground">{lastRun.total_tests}</span>
                  <p className="text-[9px] text-muted-foreground">Total</p>
                </div>
              </div>
            )}

            {/* Duration */}
            {lastRun.duration_ms && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {formatDuration(lastRun.duration_ms)}
              </p>
            )}

            {/* Running state */}
            {lastRun.status === "running" && lastRun.current_spec && (
              <p className="text-[10px] text-blue-400/90 bg-blue-500/10 rounded px-2 py-1 truncate">
                📂 {lastRun.current_spec}
              </p>
            )}
            {lastRun.status === "running" && lastRun.github_run_url && (
              <a href={lastRun.github_run_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <ExternalLink className="h-3 w-3" /> Ver no GitHub
              </a>
            )}

            {/* Error preview */}
            {hasFailed && lastRun.error_message && (
              <p className="text-[10px] text-red-400/90 bg-red-500/10 rounded px-2 py-1 line-clamp-2">
                {lastRun.error_message}
              </p>
            )}
          </div>
        )}

        {/* Actions (fixed at bottom) */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-border mt-auto">
          {showStop ? (
            <>
              <Button size="sm" variant="destructive" className="h-7 text-[10px] px-2 flex-1" onClick={e => { e.stopPropagation(); onStop(); }}>
                <Square className="h-3 w-3 mr-0.5" /> Parar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" disabled>
                <Loader2 className="h-3 w-3 animate-spin" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="h-7 text-[10px] px-2.5 flex-1" onClick={e => { e.stopPropagation(); onRun(); }}>
                <Play className="h-3 w-3 mr-0.5" /> Rodar
              </Button>
              {lastRun && (
                <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={e => { e.stopPropagation(); onViewDetails(); }}>
                  <Eye className="h-3 w-3" />
                </Button>
              )}
              {hasFailed && (
                <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 text-red-400" onClick={e => { e.stopPropagation(); onCopyError(); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── History Row (mobile) ───
function HistoryCardMobile({ run, onSelect }: { run: TestRun; onSelect: () => void }) {
  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-muted-foreground/30 ${run.status === "failed" ? "border-red-600/20 bg-red-600/5" : "border-border"}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-bold text-foreground truncate">
          {SUITES.find(s => s.id === run.test_type)?.label || run.test_type}
        </span>
        <RunStatusBadge status={run.status} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{run.started_at ? new Date(run.started_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
        <span>{formatDuration(run.duration_ms)}</span>
      </div>
      {run.total_tests > 0 && (
        <div className="flex items-center gap-2 mt-1.5 text-[11px]">
          <span className="text-green-400">{run.passed_tests}✓</span>
          <span className="text-red-400">{run.failed_tests}✗</span>
          <span className="text-muted-foreground">/ {run.total_tests}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───
export default function AdminTestCenter({ onBack }: { onBack?: () => void }) {
  const isMobile = useIsMobile();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
  const [activeTab, setActiveTab] = useState<"suites" | "history" | "alerts">("suites");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { action: "list", limit: String(ITEMS_PER_PAGE) };
      if (filterType !== "all") params.test_type = filterType;
      if (filterStatus !== "all") params.status = filterStatus;
      const data = await invokeRunTests("GET", params);
      setRuns(data || []);
    } catch (err) {
      console.error("Fetch runs error:", err);
    }
    setLoading(false);
  }, [filterType, filterStatus]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("test_runs_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "test_runs" }, (payload) => {
        const updated = payload.new as TestRun;
        if (!updated?.id) return;
        setRuns(prev => {
          const exists = prev.find(r => r.id === updated.id);
          if (exists) return prev.map(r => r.id === updated.id ? updated : r);
          return [updated, ...prev].slice(0, ITEMS_PER_PAGE);
        });
        if (selectedRun?.id === updated.id) setSelectedRun(updated);
        if (["success", "failed", "partial", "cancelled"].includes(updated.status)) {
          setRunningTests(prev => { const n = new Set(prev); n.delete(updated.test_type); return n; });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedRun?.id]);

  // Polling fallback
  useEffect(() => {
    const hasRunning = runningTests.size > 0 || runs.some(r => r.status === "running");
    if (hasRunning && !pollingRef.current) {
      pollingRef.current = setInterval(fetchRuns, 1500);
    }
    if (!hasRunning && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [runningTests.size, runs, fetchRuns]);

  // Watchdog
  useEffect(() => {
    const WATCHDOG_MS = 5 * 60 * 1000;
    const stuckRuns = runs.filter(r =>
      r.status === "running" &&
      r.execution_engine !== "edge_function" &&
      (r.progress_percent === null || r.progress_percent === 0) &&
      r.started_at &&
      Date.now() - new Date(r.started_at).getTime() > WATCHDOG_MS
    );
    stuckRuns.forEach(r => {
      const elapsed = Math.round((Date.now() - new Date(r.started_at!).getTime()) / 60000);
      supabase.from("test_runs").update({
        status: "failed" as any,
        finished_at: new Date().toISOString(),
        error_message: `Timeout: GitHub Actions não respondeu após ${elapsed} minutos`,
        error_summary: `Timeout de dispatch (${elapsed}min sem progresso)`,
        current_spec: null,
      } as any).eq("id", r.id).then(() => {
        setRunningTests(prev => { const n = new Set(prev); n.delete(r.test_type); return n; });
        fetchRuns();
        toast.error(`Teste ${r.test_type} expirou: GitHub Actions não iniciou`);
      });
    });
  }, [runs]);

  const handleRunTest = async (testType: string) => {
    setRunningTests(prev => new Set(prev).add(testType));
    try {
      invokeRunTests("POST", undefined, { test_type: testType })
        .then(() => fetchRuns())
        .catch((err) => {
          console.error("Run test error:", err);
          setRunningTests(prev => { const n = new Set(prev); n.delete(testType); return n; });
          toast.error(`Erro ao executar teste ${testType}`);
        });
      setTimeout(() => fetchRuns(), 500);
    } catch (err) {
      console.error("Run test error:", err);
      setRunningTests(prev => { const n = new Set(prev); n.delete(testType); return n; });
    }
  };

  const handleRunFull = async () => {
    setRunningTests(new Set(["full"]));
    try {
      invokeRunTests("POST", undefined, { test_type: "full" })
        .then(() => fetchRuns())
        .catch((err) => {
          console.error("Full test error:", err);
          toast.error("Erro ao executar teste completo");
        });
      setTimeout(() => fetchRuns(), 500);
    } catch (err) {
      console.error("Full test error:", err);
    }
  };

  const handleStopTest = (suiteId: string) => {
    setRunningTests(prev => { const n = new Set(prev); n.delete(suiteId); return n; });
    const lastRun = runs.find(r => r.test_type === suiteId && (r.status === "running" || r.status === "pending"));
    if (lastRun) {
      supabase.from("test_runs").update({
        status: "failed" as any,
        error_message: "Parado manualmente pelo admin",
        error_summary: "Parado manualmente",
        finished_at: new Date().toISOString(),
        progress_percent: lastRun.progress_percent || 0,
      } as any).eq("id", lastRun.id).then(() => fetchRuns());
    }
    toast.info("Teste parado");
  };

  // Auto-clear runningTests
  useEffect(() => {
    const completedStatuses = ["success", "failed", "partial", "cancelled"];
    runs.forEach(r => {
      if (completedStatuses.includes(r.status) && runningTests.has(r.test_type)) {
        setRunningTests(prev => { const n = new Set(prev); n.delete(r.test_type); return n; });
      }
    });
    if (runningTests.has("full") && !runs.some(r => r.status === "running")) {
      setRunningTests(prev => { const n = new Set(prev); n.delete("full"); return n; });
    }
  }, [runs]);

  // Build suite statuses (latest run per suite)
  const suiteStatuses = SUITES.map(suite => ({
    suite,
    run: runs.find(r => r.test_type === suite.id) || null,
  }));

  const STALE_TIMEOUT = 10 * 60 * 1000;
  const runningRuns = runs.filter(r => {
    if (r.status !== "running") return false;
    if (r.started_at && (Date.now() - new Date(r.started_at).getTime()) > STALE_TIMEOUT) return false;
    return true;
  });

  // Detail view
  if (selectedRun) {
    return <RunDetail run={selectedRun} onBack={() => { setSelectedRun(null); fetchRuns(); }} />;
  }

  return (
    <div className="space-y-6">
      {/* ═══ A) EXECUTIVE HEADER ═══ */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h3 className="text-xl font-bold text-foreground">Centro de Testes</h3>
              <p className="text-xs text-muted-foreground">Observabilidade e qualidade automatizada</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={fetchRuns} className="text-xs h-8 px-2.5">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ B) GLOBAL SUMMARY ═══ */}
      <GlobalSummary suiteStatuses={suiteStatuses} />

      {/* ═══ C) MAIN ACTIONS ═══ */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleRunFull} disabled={runningTests.has("full")} className="text-xs h-8">
          {runningTests.has("full") ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Rocket className="h-3.5 w-3.5 mr-1" />}
          Teste Completo
        </Button>
        <div className="flex-1" />
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <button
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "suites" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("suites")}
          >
            Suites
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "history" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("history")}
          >
            Histórico
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "alerts" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("alerts")}
          >
            <Bell className="h-3 w-3 inline mr-1" />Alertas
          </button>
        </div>
      </div>

      {/* ═══ LIVE PROGRESS (always visible when running) ═══ */}
      {runningRuns.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Execuções em andamento ({runningRuns.length})
          </h4>
          {runningRuns.map(run => <LiveProgressPanel key={run.id} run={run} />)}
        </div>
      )}

      {/* ═══ D) SUITES TAB ═══ */}
      {activeTab === "suites" && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-foreground">Módulos de Teste</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SUITES.map(suite => {
              const lastSuiteRun = runs.find(r => r.test_type === suite.id) || null;
              return (
                <SuiteCard
                  key={suite.id}
                  suite={suite}
                  lastRun={lastSuiteRun}
                  isRunning={runningTests.has(suite.id)}
                  onRun={() => handleRunTest(suite.id)}
                  onStop={() => handleStopTest(suite.id)}
                  onViewDetails={() => lastSuiteRun && setSelectedRun(lastSuiteRun)}
                  onCopyError={() => lastSuiteRun && copyDiagnostic(lastSuiteRun, "error")}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ E) HISTORY TAB ═══ */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h4 className="text-sm font-bold text-foreground">Histórico de Execuções</h4>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36 text-xs h-8"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {SUITES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  <SelectItem value="full">Teste Completo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32 text-xs h-8"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                  <SelectItem value="running">Rodando</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{runs.length} registros</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Carregando...
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma execução encontrada.
            </div>
          ) : isMobile ? (
            <div className="space-y-2">
              {runs.map(run => (
                <HistoryCardMobile key={run.id} run={run} onSelect={() => setSelectedRun(run)} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Suite</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Duração</TableHead>
                    <TableHead className="text-xs">Resultado</TableHead>
                    <TableHead className="text-xs">Motor</TableHead>
                    <TableHead className="text-xs w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map(run => (
                    <TableRow
                      key={run.id}
                      className={`cursor-pointer hover:bg-muted/50 ${run.status === "failed" ? "bg-red-950/10" : ""}`}
                      onClick={() => setSelectedRun(run)}
                    >
                      <TableCell className="text-xs font-medium text-foreground">
                        {SUITES.find(s => s.id === run.test_type)?.label || run.test_type}
                      </TableCell>
                      <TableCell><RunStatusBadge status={run.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {run.started_at ? new Date(run.started_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDuration(run.duration_ms)}</TableCell>
                      <TableCell className="text-xs">
                        <span className="text-green-400">{run.passed_tests}✓</span>{" "}
                        <span className="text-red-400">{run.failed_tests}✗</span>{" / "}
                        <span className="text-muted-foreground">{run.total_tests}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {run.execution_engine === "edge_function" ? "⚡" : "🧪"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelectedRun(run); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ═══ ALERTS TAB ═══ */}
      {activeTab === "alerts" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Configuração de Alertas
            </CardTitle>
            <CardDescription className="text-xs">Receba notificações quando testes falharem</CardDescription>
          </CardHeader>
          <CardContent><AlertConfigPanel /></CardContent>
        </Card>
      )}
    </div>
  );
}

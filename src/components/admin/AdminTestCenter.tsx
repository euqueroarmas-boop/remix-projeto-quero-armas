import { useState, useEffect, useCallback, useRef } from "react";
import { formatDuration } from "@/lib/formatDuration";
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
  Video, Bug, Terminal, ExternalLink,
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
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Live Progress Panel (Enhanced with real-time details) ───
function LiveProgressPanel({ run }: { run: TestRun }) {
  const completed = (run.completed_tests ?? 0) || (run.passed_tests + run.failed_tests + run.skipped_tests);
  const total = run.total_tests || 1;
  const pct = run.progress_percent ?? (total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0);
  const [elapsed, setElapsed] = useState(0);
  const [showLogs, setShowLogs] = useState(false);

  // Use direct columns first, fallback to logs JSON
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
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  // Estimate remaining time
  const estimatedRemaining = pct > 5 && elapsed > 0
    ? Math.round((elapsed / pct) * (100 - pct))
    : null;

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
            {run.execution_engine === "github_actions" ? "GitHub Actions" : "Edge Function"}
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

        {/* Current spec & URL */}
        {currentSpec && (
          <div className="space-y-1.5 bg-muted/20 rounded-lg p-2.5 border border-border/50">
            <div className="flex items-center gap-1.5 text-xs">
              <FileText className="h-3 w-3 text-primary flex-shrink-0" />
              <span className="text-muted-foreground">Spec atual:</span>
              <span className="font-medium text-foreground truncate">{currentSpec}</span>
            </div>
            {currentTest && (
              <div className="flex items-center gap-1.5 text-xs">
                <Play className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">Teste:</span>
                <span className="font-medium text-foreground truncate">{currentTest}</span>
              </div>
            )}
            {currentUrl && (
              <div className="flex items-center gap-1.5 text-xs">
                <Globe className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">URL:</span>
                <span className="font-mono text-foreground truncate text-[11px]">{currentUrl}</span>
              </div>
            )}
          </div>
        )}

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
                  <Terminal className="h-3 w-3" /> Logs em tempo real ({logEntries.length})
                </span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showLogs ? "rotate-180" : ""}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="max-h-48 mt-1">
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
              <p className="font-semibold text-destructive mb-1">Erro principal</p>
              <p className="text-muted-foreground">{run.error_message}</p>
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
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Testes que Falharam ({failed.length})
            </CardTitle>
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
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              Logs técnicos
            </CardTitle>
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

// ─── Main Component ───
export default function AdminTestCenter() {
  const isMobile = useIsMobile();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
  const [activeTab, setActiveTab] = useState<"suites" | "alerts">("suites");
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
    if (runningTests.size > 0 && !pollingRef.current) {
      pollingRef.current = setInterval(fetchRuns, 3000);
    }
    if (runningTests.size === 0 && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [runningTests.size, fetchRuns]);

  const handleRunTest = async (testType: string) => {
    setRunningTests(prev => new Set(prev).add(testType));
    try {
      const result = await invokeRunTests("POST", undefined, { test_type: testType });
      await fetchRuns();
      if (result.status === "success" || result.status === "failed") {
        setRunningTests(prev => { const n = new Set(prev); n.delete(testType); return n; });
      }
    } catch (err) {
      console.error("Run test error:", err);
      setRunningTests(prev => { const n = new Set(prev); n.delete(testType); return n; });
    }
  };

  const handleRunFull = async () => {
    setRunningTests(new Set(["full"]));
    try {
      await invokeRunTests("POST", undefined, { test_type: "full" });
      await fetchRuns();
    } catch (err) {
      console.error("Full test error:", err);
    }
  };

  const runningRuns = runs.filter(r => r.status === "running");
  const lastRun = runs.length > 0 ? runs[0] : null;

  if (selectedRun) {
    return <RunDetail run={selectedRun} onBack={() => { setSelectedRun(null); fetchRuns(); }} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            🧪 Centro de Testes
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Dispare, acompanhe e audite testes automatizados
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={activeTab === "suites" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("suites")} className="text-xs">
            <Play className="h-3 w-3 mr-1" /> Suites
          </Button>
          <Button variant={activeTab === "alerts" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("alerts")} className="text-xs">
            <Bell className="h-3 w-3 mr-1" /> Alertas
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button variant="outline" size="sm" onClick={fetchRuns} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
          </Button>
          <Button size="sm" onClick={handleRunFull} disabled={runningTests.has("full")} className="text-xs">
            {runningTests.has("full") ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Rocket className="h-3 w-3 mr-1" />}
            Teste Completo
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {lastRun && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Última execução</p>
            <p className="text-sm font-bold text-foreground mt-1">{lastRun.started_at ? new Date(lastRun.started_at).toLocaleString("pt-BR") : "—"}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Último status</p>
            <div className="mt-1"><RunStatusBadge status={lastRun.status} /></div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Duração</p>
            <p className="text-sm font-bold text-foreground mt-1">{formatDuration(lastRun.duration_ms)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Taxa de sucesso</p>
            <p className="text-sm font-bold text-green-400 mt-1">{lastRun.total_tests > 0 ? `${Math.round((lastRun.passed_tests / lastRun.total_tests) * 100)}%` : "—"}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Live Progress */}
      {runningRuns.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Execuções em andamento ({runningRuns.length})
          </h4>
          {runningRuns.map(run => <LiveProgressPanel key={run.id} run={run} />)}
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Configuração de Alertas</CardTitle>
            <CardDescription className="text-xs">Receba notificações quando testes falharem</CardDescription>
          </CardHeader>
          <CardContent><AlertConfigPanel /></CardContent>
        </Card>
      )}

      {/* Suites Tab */}
      {activeTab === "suites" && (
        <>
          <div>
            <h4 className="text-sm font-bold text-foreground mb-3">Disparar Testes</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {SUITES.map((suite) => {
                const isRunning = runningTests.has(suite.id);
                const Icon = suite.icon;
                const isLight = suite.engine === "light";
                const lastSuiteRun = runs.find(r => r.test_type === suite.id);
                return (
                  <Card key={suite.id} className={`transition-all ${isRunning ? "border-primary/50 bg-primary/5" : "hover:border-muted-foreground/30"}`}>
                    <CardContent className="p-3.5 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${isRunning ? "bg-primary/20" : "bg-muted"}`}>
                          <Icon className={`h-3.5 w-3.5 ${isRunning ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                        </div>
                        <span className="text-xs font-bold text-foreground truncate">{suite.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{suite.description}</p>
                      <div className="flex items-center justify-between gap-1">
                        <Badge variant="outline" className="text-[10px] font-normal">{isLight ? "⚡ Leve" : "🧪 Cypress"}</Badge>
                        <Button size="sm" variant={isRunning ? "ghost" : "outline"} onClick={() => handleRunTest(suite.id)} disabled={isRunning} className="h-7 text-[11px] px-2.5">
                          {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-0.5" />}
                          {isRunning ? "..." : "Rodar"}
                        </Button>
                      </div>
                      {lastSuiteRun && (
                        <div className="text-[10px] text-muted-foreground border-t border-border pt-1.5 mt-1">
                          <RunStatusBadge status={lastSuiteRun.status} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center pt-2">
            <h4 className="text-sm font-bold text-foreground mr-2">Histórico</h4>
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
            <span className="text-xs text-muted-foreground ml-auto">{runs.length} execuções</span>
          </div>

          {/* History */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Carregando histórico...
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma execução encontrada. Dispare um teste acima.</div>
          ) : isMobile ? (
            <div className="space-y-2">
              {runs.map((run) => (
                <Card key={run.id} className={`cursor-pointer hover:border-muted-foreground/30 transition-all ${run.status === "failed" ? "border-destructive/30" : ""}`} onClick={() => setSelectedRun(run)}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground truncate">{SUITES.find(s => s.id === run.test_type)?.label || run.test_type}</span>
                      <RunStatusBadge status={run.status} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{run.started_at ? new Date(run.started_at).toLocaleString("pt-BR") : "—"}</span>
                      <span>{formatDuration(run.duration_ms)}</span>
                    </div>
                    {run.total_tests > 0 && (
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
                        <div className="bg-green-500 h-full" style={{ width: `${(run.passed_tests / run.total_tests) * 100}%` }} />
                        <div className="bg-red-500 h-full" style={{ width: `${(run.failed_tests / run.total_tests) * 100}%` }} />
                      </div>
                    )}
                    <div className="text-[11px]">
                      <span className="text-green-400">{run.passed_tests}✓</span>{" / "}
                      <span className="text-red-400">{run.failed_tests}✗</span>{" / "}
                      <span className="text-muted-foreground">{run.total_tests} total</span>
                      {run.screenshot_urls && run.screenshot_urls.length > 0 && <span className="ml-2">📸 {run.screenshot_urls.length}</span>}
                      {run.video_urls && run.video_urls.length > 0 && <span className="ml-1">🎥 {run.video_urls.length}</span>}
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
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Início</TableHead>
                    <TableHead className="text-xs">Duração</TableHead>
                    <TableHead className="text-xs">Resultado</TableHead>
                    <TableHead className="text-xs">Artefatos</TableHead>
                    <TableHead className="text-xs">Motor</TableHead>
                    <TableHead className="text-xs w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id} className={`cursor-pointer hover:bg-muted/50 ${run.status === "failed" ? "bg-red-950/10" : ""}`} onClick={() => setSelectedRun(run)}>
                      <TableCell className="text-xs font-medium text-foreground">{SUITES.find(s => s.id === run.test_type)?.label || run.test_type}</TableCell>
                      <TableCell><RunStatusBadge status={run.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{run.started_at ? new Date(run.started_at).toLocaleString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDuration(run.duration_ms)}</TableCell>
                      <TableCell className="text-xs">
                        <span className="text-green-400">{run.passed_tests}✓</span>{" "}
                        <span className="text-red-400">{run.failed_tests}✗</span>{" / "}
                        <span className="text-muted-foreground">{run.total_tests}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          {run.screenshot_urls && run.screenshot_urls.length > 0 && (
                            <span title="Screenshots" className="text-muted-foreground">📸{run.screenshot_urls.length}</span>
                          )}
                          {run.video_urls && run.video_urls.length > 0 && (
                            <span title="Vídeos" className="text-muted-foreground">🎥{run.video_urls.length}</span>
                          )}
                          {(!run.screenshot_urls || run.screenshot_urls.length === 0) && (!run.video_urls || run.video_urls.length === 0) && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {run.execution_engine === "edge_function" ? "⚡" : run.execution_engine === "github_actions" ? "🧪" : "🔀"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedRun(run); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

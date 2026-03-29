import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Play, RefreshCw, CheckCircle, XCircle, Clock, Loader2,
  ChevronLeft, ChevronRight, Eye, Zap, Globe, FileText,
  Shield, ShoppingCart, FormInput, Monitor, BookOpen,
  Server, AlertTriangle, Rocket, ArrowLeft, Bell, Send,
  MessageSquare, Mail, Webhook, Settings,
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
}

interface TestResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  duration_ms: number;
  error?: string;
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${config.color}`}>
      <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  );
}

// ─── Duration formatter ───
function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

// ─── Detail View ───
function RunDetail({ run, onBack }: { run: TestRun; onBack: () => void }) {
  const results = (run.results || []) as TestResult[];
  const passed = results.filter(r => r.status === "passed");
  const failed = results.filter(r => r.status === "failed");

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-xs">
        <ArrowLeft className="h-3 w-3 mr-1" /> Voltar
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              {SUITES.find(s => s.id === run.test_type)?.label || run.test_type}
            </CardTitle>
            <RunStatusBadge status={run.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Início</span>
              <span className="text-foreground">{run.started_at ? new Date(run.started_at).toLocaleString("pt-BR") : "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Duração</span>
              <span className="text-foreground">{formatDuration(run.duration_ms)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Motor</span>
              <span className="text-foreground">{run.execution_engine}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Disparado por</span>
              <span className="text-foreground">{run.triggered_by}</span>
            </div>
          </div>

          {/* Summary bar */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-400">✓ {run.passed_tests} passaram</span>
            <span className="text-red-400">✗ {run.failed_tests} falharam</span>
            {run.skipped_tests > 0 && <span className="text-yellow-400">⊘ {run.skipped_tests} pulados</span>}
            <span className="text-muted-foreground ml-auto">Total: {run.total_tests}</span>
          </div>

          {/* Progress bar */}
          {run.total_tests > 0 && (
            <div className="h-2 rounded-full bg-muted overflow-hidden flex">
              <div className="bg-green-500 h-full" style={{ width: `${(run.passed_tests / run.total_tests) * 100}%` }} />
              <div className="bg-red-500 h-full" style={{ width: `${(run.failed_tests / run.total_tests) * 100}%` }} />
            </div>
          )}

          {run.error_message && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-xs">
              <p className="font-semibold text-destructive mb-1">Erro principal</p>
              <p className="text-muted-foreground">{run.error_message}</p>
            </div>
          )}

          {run.github_run_url && (
            <a href={run.github_run_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
              Ver no GitHub Actions →
            </a>
          )}
        </CardContent>
      </Card>

      {/* Failed tests */}
      {failed.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive">❌ Testes que Falharam ({failed.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failed.map((t, i) => (
                <div key={i} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-foreground">{t.name}</span>
                    <span className="text-muted-foreground">{formatDuration(t.duration_ms)}</span>
                  </div>
                  {t.error && <p className="text-destructive/80 font-mono text-[11px]">{t.error}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passed tests */}
      {passed.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-400">✓ Testes que Passaram ({passed.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {passed.map((t, i) => (
                <div key={i} className="flex justify-between items-center text-xs py-1 px-2 rounded hover:bg-muted/30">
                  <span className="text-foreground">{t.name}</span>
                  <span className="text-muted-foreground">{formatDuration(t.duration_ms)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw logs */}
      {run.logs && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Logs técnicos</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-[11px] text-muted-foreground bg-muted/50 p-3 rounded overflow-auto max-h-48">
              {JSON.stringify(run.logs, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Component ───
export default function AdminTestCenter() {
  const isMobile = useIsMobile();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);

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

  // Realtime subscription for running tests
  useEffect(() => {
    const channel = supabase
      .channel("test_runs_realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "test_runs" }, (payload) => {
        const updated = payload.new as TestRun;
        setRuns(prev => prev.map(r => r.id === updated.id ? updated : r));
        if (selectedRun?.id === updated.id) setSelectedRun(updated);
        if (["success", "failed", "partial", "cancelled"].includes(updated.status)) {
          setRunningTests(prev => { const n = new Set(prev); n.delete(updated.test_type); return n; });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedRun?.id]);

  const handleRunTest = async (testType: string) => {
    setRunningTests(prev => new Set(prev).add(testType));
    try {
      const result = await invokeRunTests("POST", undefined, { test_type: testType });
      // Refresh list
      await fetchRuns();
      // If light test completed immediately, remove from running
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

  if (selectedRun) {
    return <RunDetail run={selectedRun} onBack={() => { setSelectedRun(null); fetchRuns(); }} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-foreground">🧪 Centro de Testes</h3>
          <p className="text-xs text-muted-foreground">Dispare, acompanhe e audite testes de todas as camadas do site</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRuns} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
          </Button>
          <Button
            size="sm"
            onClick={handleRunFull}
            disabled={runningTests.has("full")}
            className="text-xs bg-primary hover:bg-primary/90"
          >
            {runningTests.has("full") ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Rocket className="h-3 w-3 mr-1" />}
            Teste Completo
          </Button>
        </div>
      </div>

      {/* Suite Cards — Dispatch Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {SUITES.map((suite) => {
          const isRunning = runningTests.has(suite.id);
          const Icon = suite.icon;
          const isLight = suite.engine === "light";
          return (
            <Card key={suite.id} className={`transition-all ${isRunning ? "border-primary/50 bg-primary/5" : "hover:border-primary/30"}`}>
              <CardContent className="p-3 md:p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isRunning ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                  <span className="text-xs font-semibold text-foreground truncate">{suite.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{suite.description}</p>
                <div className="flex items-center justify-between gap-1">
                  <Badge variant="outline" className="text-[10px]">{isLight ? "⚡ Leve" : "🧪 Cypress"}</Badge>
                  <Button
                    size="sm"
                    variant={isRunning ? "ghost" : "outline"}
                    onClick={() => handleRunTest(suite.id)}
                    disabled={isRunning}
                    className="h-7 text-[11px] px-2"
                  >
                    {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-0.5" />}
                    {isRunning ? "..." : "Rodar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
          <SelectTrigger className="w-36 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {SUITES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            <SelectItem value="full">Teste Completo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
          <SelectTrigger className="w-32 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
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

      {/* History Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Carregando histórico...
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma execução encontrada. Dispare um teste acima.
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {runs.map((run) => (
            <Card key={run.id} className={run.status === "failed" ? "border-destructive/30" : ""}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {SUITES.find(s => s.id === run.test_type)?.label || run.test_type}
                  </span>
                  <RunStatusBadge status={run.status} />
                </div>
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <div className="flex justify-between">
                    <span>Início:</span>
                    <span>{run.started_at ? new Date(run.started_at).toLocaleString("pt-BR") : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duração:</span>
                    <span>{formatDuration(run.duration_ms)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resultado:</span>
                    <span className="text-foreground">
                      <span className="text-green-400">{run.passed_tests}✓</span>
                      {" / "}
                      <span className="text-red-400">{run.failed_tests}✗</span>
                      {" / "}
                      {run.total_tests} total
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRun(run)} className="w-full h-7 text-xs">
                  <Eye className="h-3 w-3 mr-1" /> Ver detalhes
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Início</TableHead>
                <TableHead className="text-xs">Duração</TableHead>
                <TableHead className="text-xs">Resultado</TableHead>
                <TableHead className="text-xs">Motor</TableHead>
                <TableHead className="text-xs w-[60px]">Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id} className={run.status === "failed" ? "bg-red-950/10" : ""}>
                  <TableCell className="text-xs font-medium text-foreground">
                    {SUITES.find(s => s.id === run.test_type)?.label || run.test_type}
                  </TableCell>
                  <TableCell><RunStatusBadge status={run.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {run.started_at ? new Date(run.started_at).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDuration(run.duration_ms)}</TableCell>
                  <TableCell className="text-xs">
                    <span className="text-green-400">{run.passed_tests}✓</span>
                    {" "}
                    <span className="text-red-400">{run.failed_tests}✗</span>
                    {" / "}
                    <span className="text-muted-foreground">{run.total_tests}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {run.execution_engine === "edge_function" ? "⚡" : run.execution_engine === "github_actions" ? "🧪" : "🔀"} {run.execution_engine}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedRun(run)}>
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
  );
}

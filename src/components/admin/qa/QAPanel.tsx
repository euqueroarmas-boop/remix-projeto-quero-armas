import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play, RotateCw, Copy, Check, Download, Shield, AlertTriangle,
  CheckCircle2, XCircle, Clock, Filter, BarChart3, List, ClipboardList
} from "lucide-react";
import type { TestCase, TestResult, QAModule, ModuleStats } from "./qaTypes";
import { QA_MODULES, MODULE_LABELS } from "./qaTypes";
import { buildAllTests } from "./qaTests";
import { runTests, computeModuleStats, getEnvironment } from "./qaRunner";
import { generateReport, generateFailuresOnly, generatePriorityList } from "./qaExport";
import { QAModuleCard } from "./QAModuleCard";
import { QATestList } from "./QATestList";
import { QAChecklist } from "./QAChecklist";
import { DEFAULT_CHECKLIST_ITEMS } from "./qaFixtures";
import type { ChecklistItem } from "./qaTypes";

const RESULTS_KEY = "wmti_qa_results";
const CHECKLIST_KEY = "wmti_qa_checklist";

export default function QAPanel() {
  const allTests = useMemo(() => buildAllTests(), []);
  const [results, setResults] = useState<Map<string, TestResult>>(() => {
    try {
      const saved = localStorage.getItem(RESULTS_KEY);
      if (saved) return new Map(JSON.parse(saved));
    } catch {}
    return new Map();
  });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, current: "" });
  const [selectedModule, setSelectedModule] = useState<QAModule | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist results
  useEffect(() => {
    localStorage.setItem(RESULTS_KEY, JSON.stringify(Array.from(results.entries())));
  }, [results]);

  const moduleStats = useMemo(() => computeModuleStats(allTests, Array.from(results.values())), [allTests, results]);

  const filteredTests = useMemo(() => {
    let tests = allTests;
    if (selectedModule !== "all") tests = tests.filter(t => t.module === selectedModule);
    if (statusFilter !== "all") tests = tests.filter(t => {
      const r = results.get(t.id);
      if (statusFilter === "pending") return !r;
      return r?.status === statusFilter;
    });
    if (severityFilter !== "all") tests = tests.filter(t => t.severity === severityFilter);
    return tests;
  }, [allTests, selectedModule, statusFilter, severityFilter, results]);

  const runAll = useCallback(async (testsToRun?: TestCase[]) => {
    const tests = testsToRun || allTests;
    setRunning(true);
    abortRef.current = new AbortController();
    const newResults = await runTests(tests, (c, t, cur) => setProgress({ completed: c, total: t, current: cur }), abortRef.current.signal);
    setResults(prev => {
      const next = new Map(prev);
      newResults.forEach(r => next.set(r.testId, r));
      return next;
    });
    setRunning(false);
  }, [allTests]);

  const runModule = useCallback((mod: QAModule) => {
    runAll(allTests.filter(t => t.module === mod));
  }, [allTests, runAll]);

  const rerunTest = useCallback(async (test: TestCase) => {
    const [result] = await runTests([test]);
    setResults(prev => { const n = new Map(prev); n.set(result.testId, result); return n; });
  }, []);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const totalPass = Array.from(results.values()).filter(r => r.status === "pass").length;
  const totalFail = Array.from(results.values()).filter(r => r.status === "fail").length;
  const totalWarn = Array.from(results.values()).filter(r => r.status === "warn").length;
  const totalPending = allTests.length - results.size;
  const overallPct = allTests.length > 0 ? Math.round((totalPass / allTests.length) * 100) : 0;

  const overallStatus = totalFail > 0
    ? allTests.some(t => t.blocksPublish && results.get(t.id)?.status === "fail")
      ? "not_ready" : "caution"
    : totalPending > 0 ? "caution" : "ready";

  const checklist: ChecklistItem[] = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "[]");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-foreground text-sm md:text-base">Homologação & QA</h2>
          <Badge variant="outline" className="text-[10px]">{getEnvironment()}</Badge>
        </div>
        <div className="flex items-center gap-1">
          {running && (
            <span className="text-xs text-muted-foreground animate-pulse mr-2">
              {progress.completed}/{progress.total} — {progress.current}
            </span>
          )}
          <Button size="sm" onClick={() => runAll()} disabled={running} className="text-xs">
            <Play className="h-3 w-3 mr-1" /> Rodar Todos
          </Button>
          <Button size="sm" variant="outline" onClick={() => { abortRef.current?.abort(); setRunning(false); }} disabled={!running} className="text-xs">
            Parar
          </Button>
        </div>
      </div>

      {/* Summary Bar */}
      <Card className={overallStatus === "ready" ? "border-green-500/30" : overallStatus === "caution" ? "border-yellow-500/30" : "border-red-500/30"}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {overallStatus === "ready" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {overallStatus === "caution" && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              {overallStatus === "not_ready" && <XCircle className="h-5 w-5 text-red-500" />}
              <span className="font-bold text-sm">
                {overallStatus === "ready" ? "Pronto para Publicar" : overallStatus === "caution" ? "Publicação com Ressalvas" : "Não Pronto para Publicar"}
              </span>
            </div>
            <span className="text-lg font-bold text-foreground">{overallPct}%</span>
          </div>
          <Progress value={overallPct} className="h-3 mb-2" />
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>✅ {totalPass} aprovados</span>
            <span>❌ {totalFail} falhos</span>
            <span>⚠️ {totalWarn} avisos</span>
            <span>⏳ {totalPending} pendentes</span>
            <span className="ml-auto">{allTests.length} testes totais</span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Run Buttons */}
      <div className="flex flex-wrap gap-1">
        {(["contratacao", "calculadora", "whatsapp", "portal-cliente", "contrato-pdf", "rotas", "seo"] as QAModule[]).map(mod => (
          <Button key={mod} variant="outline" size="sm" className="text-[10px] h-7" onClick={() => runModule(mod)} disabled={running}>
            {MODULE_LABELS[mod]}
          </Button>
        ))}
      </div>

      <Tabs defaultValue="modules">
        <TabsList className="mb-3">
          <TabsTrigger value="modules" className="text-xs gap-1"><BarChart3 className="h-3 w-3" /> Módulos</TabsTrigger>
          <TabsTrigger value="tests" className="text-xs gap-1"><List className="h-3 w-3" /> Testes</TabsTrigger>
          <TabsTrigger value="priority" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" /> Prioridade</TabsTrigger>
          <TabsTrigger value="checklist" className="text-xs gap-1"><ClipboardList className="h-3 w-3" /> Checklist</TabsTrigger>
          <TabsTrigger value="export" className="text-xs gap-1"><Download className="h-3 w-3" /> Exportar</TabsTrigger>
        </TabsList>

        {/* Modules Tab */}
        <TabsContent value="modules">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {moduleStats.map(s => (
              <QAModuleCard
                key={s.module}
                stats={s}
                onClick={() => setSelectedModule(s.module)}
                selected={selectedModule === s.module}
              />
            ))}
          </div>
          {selectedModule !== "all" && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{MODULE_LABELS[selectedModule]}</h3>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => runModule(selectedModule)} disabled={running}>
                    <RotateCw className="h-3 w-3 mr-1" /> Testar módulo
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedModule("all")}>
                    Ver todos
                  </Button>
                </div>
              </div>
              <QATestList
                tests={allTests.filter(t => t.module === selectedModule)}
                results={results}
                onRerun={rerunTest}
              />
            </div>
          )}
        </TabsContent>

        {/* Tests Tab */}
        <TabsContent value="tests">
          <div className="flex flex-wrap gap-2 mb-3">
            <Select value={selectedModule} onValueChange={v => setSelectedModule(v as any)}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Módulo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {QA_MODULES.map(m => <SelectItem key={m} value={m} className="text-xs">{MODULE_LABELS[m]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pass">Aprovados</SelectItem>
                <SelectItem value="fail">Falhos</SelectItem>
                <SelectItem value="warn">Avisos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Severidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="low">Baixo</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground self-center">{filteredTests.length} testes</span>
          </div>
          <QATestList tests={filteredTests} results={results} onRerun={rerunTest} />
        </TabsContent>

        {/* Priority Tab */}
        <TabsContent value="priority">
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Ordem Recomendada de Correção
            </h3>
            <QATestList
              tests={allTests.filter(t => results.get(t.id)?.status === "fail")}
              results={results}
              onRerun={rerunTest}
            />
            {allTests.filter(t => results.get(t.id)?.status === "fail").length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {results.size === 0 ? "Execute os testes para ver a priorização" : "Nenhuma falha encontrada! 🎉"}
              </p>
            )}
          </div>
        </TabsContent>

        {/* Checklist Tab */}
        <TabsContent value="checklist">
          <QAChecklist moduleFilter={selectedModule} />
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h4 className="font-semibold text-sm">Relatório Completo</h4>
                <p className="text-xs text-muted-foreground">Todos os testes, checklist e resumo</p>
                <Button size="sm" className="w-full text-xs" onClick={() => handleCopy("full", generateReport(allTests, results, checklist))}>
                  {copied === "full" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied === "full" ? "Copiado!" : "Copiar Relatório"}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <h4 className="font-semibold text-sm">Apenas Falhas</h4>
                <p className="text-xs text-muted-foreground">Erros e avisos encontrados</p>
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => handleCopy("fails", generateFailuresOnly(allTests, results))}>
                  {copied === "fails" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied === "fails" ? "Copiado!" : "Copiar Falhas"}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <h4 className="font-semibold text-sm">Lista Priorizada</h4>
                <p className="text-xs text-muted-foreground">Correções em ordem de prioridade</p>
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => handleCopy("prio", generatePriorityList(allTests, results))}>
                  {copied === "prio" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied === "prio" ? "Copiado!" : "Copiar Prioridades"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

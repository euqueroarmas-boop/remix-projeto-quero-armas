import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play, RotateCw, Copy, Check, Download, Shield, AlertTriangle,
  CheckCircle2, XCircle, Clock, BarChart3, List, ClipboardList,
  GitCompare, History, ArrowUpCircle, ArrowDownCircle, MinusCircle
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
import {
  loadExecutions, saveExecution, compareExecutions,
  type QAExecutionRecord, type ComparisonItem
} from "./qaHistory";

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
  const [executions, setExecutions] = useState<QAExecutionRecord[]>(loadExecutions);
  const [comparison, setComparison] = useState<ComparisonItem[]>([]);

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
      if (statusFilter === "resolved") {
        const item = comparison.find(c => c.testId === t.id);
        return item?.category === "resolved";
      }
      if (statusFilter === "regression") {
        const item = comparison.find(c => c.testId === t.id);
        return item?.category === "regression";
      }
      if (statusFilter === "new_error") {
        const item = comparison.find(c => c.testId === t.id);
        return item?.category === "new_error";
      }
      return r?.status === statusFilter;
    });
    if (severityFilter !== "all") tests = tests.filter(t => t.severity === severityFilter);
    return tests;
  }, [allTests, selectedModule, statusFilter, severityFilter, results, comparison]);

  const runAll = useCallback(async (testsToRun?: TestCase[], runType: QAExecutionRecord["type"] = "all", modFilter?: string) => {
    const tests = testsToRun || allTests;
    const previousResults = Array.from(results.values());
    setRunning(true);
    abortRef.current = new AbortController();
    const start = Date.now();
    const newResults = await runTests(tests, (c, t, cur) => setProgress({ completed: c, total: t, current: cur }), abortRef.current.signal);

    setResults(prev => {
      const next = new Map(prev);
      newResults.forEach(r => next.set(r.testId, r));
      return next;
    });

    // Save execution record
    const exec: QAExecutionRecord = {
      id: crypto.randomUUID(),
      executedAt: new Date().toISOString(),
      environment: getEnvironment(),
      type: runType,
      moduleFilter: modFilter,
      duration: Date.now() - start,
      results: newResults,
      summary: {
        pass: newResults.filter(r => r.status === "pass").length,
        fail: newResults.filter(r => r.status === "fail").length,
        warn: newResults.filter(r => r.status === "warn").length,
        total: newResults.length,
      },
    };
    saveExecution(exec);
    setExecutions(loadExecutions());

    // Compare with previous
    if (previousResults.length > 0) {
      setComparison(compareExecutions(previousResults, newResults));
    }

    setRunning(false);
  }, [allTests, results]);

  const runModule = useCallback((mod: QAModule) => {
    runAll(allTests.filter(t => t.module === mod), "module", mod);
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

  const resolved = comparison.filter(c => c.category === "resolved").length;
  const regressions = comparison.filter(c => c.category === "regression").length;
  const newErrors = comparison.filter(c => c.category === "new_error").length;
  const persistent = comparison.filter(c => c.category === "persistent").length;

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
          <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
            <span>✅ {totalPass} aprovados</span>
            <span>❌ {totalFail} falhos</span>
            <span>⚠️ {totalWarn} avisos</span>
            <span>⏳ {totalPending} pendentes</span>
            <span className="ml-auto">{allTests.length} testes totais</span>
          </div>
          {comparison.length > 0 && (
            <div className="flex gap-4 text-xs mt-2 border-t border-border pt-2 flex-wrap">
              {resolved > 0 && <span className="text-green-500 flex items-center gap-1"><ArrowUpCircle className="h-3 w-3" /> {resolved} corrigidos</span>}
              {regressions > 0 && <span className="text-red-500 flex items-center gap-1"><ArrowDownCircle className="h-3 w-3" /> {regressions} regressões</span>}
              {newErrors > 0 && <span className="text-orange-500 flex items-center gap-1"><XCircle className="h-3 w-3" /> {newErrors} novos erros</span>}
              {persistent > 0 && <span className="text-muted-foreground flex items-center gap-1"><MinusCircle className="h-3 w-3" /> {persistent} persistentes</span>}
            </div>
          )}
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
        <TabsList className="mb-3 flex-wrap h-auto gap-1">
          <TabsTrigger value="modules" className="text-xs gap-1"><BarChart3 className="h-3 w-3" /> Módulos</TabsTrigger>
          <TabsTrigger value="tests" className="text-xs gap-1"><List className="h-3 w-3" /> Testes</TabsTrigger>
          <TabsTrigger value="priority" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" /> Prioridade</TabsTrigger>
          <TabsTrigger value="comparison" className="text-xs gap-1"><GitCompare className="h-3 w-3" /> Comparação</TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1"><History className="h-3 w-3" /> Histórico</TabsTrigger>
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
              <QATestList tests={allTests.filter(t => t.module === selectedModule)} results={results} onRerun={rerunTest} />
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
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pass">Aprovados</SelectItem>
                <SelectItem value="fail">Falhos</SelectItem>
                <SelectItem value="warn">Avisos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="resolved">✅ Corrigidos</SelectItem>
                <SelectItem value="regression">⬇️ Regressões</SelectItem>
                <SelectItem value="new_error">🆕 Novos erros</SelectItem>
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

        {/* Comparison Tab */}
        <TabsContent value="comparison">
          {comparison.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Execute os testes pelo menos duas vezes para ver a comparação entre execuções.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Resolved */}
              {resolved > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-500 flex items-center gap-2 mb-2">
                    <ArrowUpCircle className="h-4 w-4" /> Corrigidos ({resolved})
                  </h3>
                  <div className="space-y-1">
                    {comparison.filter(c => c.category === "resolved").map(c => (
                      <Card key={c.testId} className="border-green-500/20">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-medium text-foreground">{c.testId}</span>
                            <p className="text-[10px] text-muted-foreground">Antes: {c.previous?.message}</p>
                          </div>
                          <Badge className="bg-green-500/10 text-green-500 text-[10px]">Resolvido</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Regressions */}
              {regressions > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-500 flex items-center gap-2 mb-2">
                    <ArrowDownCircle className="h-4 w-4" /> Regressões ({regressions})
                  </h3>
                  <div className="space-y-1">
                    {comparison.filter(c => c.category === "regression").map(c => (
                      <Card key={c.testId} className="border-red-500/20">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-medium text-foreground">{c.testId}</span>
                            <p className="text-[10px] text-muted-foreground">Agora: {c.current?.message}</p>
                          </div>
                          <Badge className="bg-red-500/10 text-red-500 text-[10px]">Regressão</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* New Errors */}
              {newErrors > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-orange-500 flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4" /> Novos Erros ({newErrors})
                  </h3>
                  <div className="space-y-1">
                    {comparison.filter(c => c.category === "new_error").map(c => (
                      <Card key={c.testId} className="border-orange-500/20">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-medium text-foreground">{c.testId}</span>
                            <p className="text-[10px] text-muted-foreground">{c.current?.message}</p>
                          </div>
                          <Badge className="bg-orange-500/10 text-orange-500 text-[10px]">Novo</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Persistent */}
              {persistent > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-2">
                    <MinusCircle className="h-4 w-4" /> Persistentes ({persistent})
                  </h3>
                  <div className="space-y-1">
                    {comparison.filter(c => c.category === "persistent").map(c => (
                      <Card key={c.testId} className="border-border">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-medium text-foreground">{c.testId}</span>
                            <p className="text-[10px] text-muted-foreground">{c.current?.message}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">Persistente</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          {executions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma execução registrada ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {executions.map((exec, i) => (
                <Card key={exec.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {exec.type === "all" ? "Todos" : exec.type === "module" ? `Módulo: ${exec.moduleFilter}` : exec.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(exec.executedAt).toLocaleString("pt-BR")}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({(exec.duration / 1000).toFixed(1)}s)
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{exec.environment}</Badge>
                    </div>
                    <div className="flex gap-3 text-[10px]">
                      <span className="text-green-500">✅ {exec.summary.pass}</span>
                      <span className="text-red-500">❌ {exec.summary.fail}</span>
                      <span className="text-yellow-500">⚠️ {exec.summary.warn}</span>
                      <span className="text-muted-foreground">Total: {exec.summary.total}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
                <h4 className="font-semibold text-sm">Comparação</h4>
                <p className="text-xs text-muted-foreground">Mudanças desde a última execução</p>
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => {
                  const text = comparison.length === 0
                    ? "Nenhuma comparação disponível"
                    : [
                        `== Comparação de Execuções ==`,
                        `Corrigidos: ${resolved}`,
                        `Regressões: ${regressions}`,
                        `Novos erros: ${newErrors}`,
                        `Persistentes: ${persistent}`,
                        "",
                        ...comparison.filter(c => c.category !== "unchanged").map(c =>
                          `[${c.category.toUpperCase()}] ${c.testId}: ${c.current?.message || c.previous?.message || ""}`
                        ),
                      ].join("\n");
                  handleCopy("comp", text);
                }}>
                  {copied === "comp" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied === "comp" ? "Copiado!" : "Copiar Comparação"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

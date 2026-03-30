import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, Loader2, Copy, Check, Zap, Bug, Gauge, Layers, TrendingUp,
  ChevronDown, ChevronUp, Clock, Shield, Target, Sparkles,
  CheckCircle2, XCircle, ArrowUpRight,
} from "lucide-react";

type PromptItem = {
  type: "fix" | "create" | "optimize" | "standardize" | "conversion";
  title: string;
  description: string;
  prompt: string;
  priority: "high" | "medium" | "low";
  impact?: string;
  estimated_effort?: string;
  confidence?: number;
  impact_score?: number;
  source?: string;
  prompt_type?: string;
  auto_applicable?: boolean;
  applied?: boolean;
  rejected?: boolean;
  deduplicated?: boolean;
};

type AnalysisRecord = {
  id: string;
  status: string;
  summary: string | null;
  prompts: PromptItem[];
  total_prompts: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  created_at: string;
  finished_at: string | null;
  confidence?: number;
  impact_score?: number;
};

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  fix: { label: "Correção", icon: Bug, color: "text-red-500" },
  create: { label: "Criação", icon: Zap, color: "text-blue-500" },
  optimize: { label: "Otimização", icon: Gauge, color: "text-yellow-500" },
  standardize: { label: "Padronização", icon: Layers, color: "text-purple-500" },
  conversion: { label: "Conversão", icon: TrendingUp, color: "text-green-500" },
};

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Shield }> = {
  test: { label: "Testes", icon: Shield },
  log: { label: "Logs", icon: Bug },
  funnel: { label: "Funil", icon: TrendingUp },
  contract: { label: "Contratos", icon: Layers },
};

const BRAIN_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  correction: { label: "Correção", color: "bg-red-500/10 text-red-500" },
  growth: { label: "Crescimento", color: "bg-green-500/10 text-green-500" },
  conversion: { label: "Conversão", color: "bg-blue-500/10 text-blue-500" },
  seo: { label: "SEO", color: "bg-orange-500/10 text-orange-500" },
  ux: { label: "UX", color: "bg-purple-500/10 text-purple-500" },
};

const PRIORITY_CONFIG: Record<string, { label: string; variant: "destructive" | "default" | "secondary" | "outline" }> = {
  high: { label: "Alta", variant: "destructive" },
  medium: { label: "Média", variant: "default" },
  low: { label: "Baixa", variant: "secondary" },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground">{pct}%</span>
    </div>
  );
}

function PromptCard({
  item, index, analysisId, onApply, onReject,
}: {
  item: PromptItem; index: number; analysisId: string;
  onApply: (id: string, idx: number) => void;
  onReject: (id: string, idx: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const typeConf = TYPE_CONFIG[item.type] || TYPE_CONFIG.fix;
  const prioConf = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
  const brainType = BRAIN_TYPE_CONFIG[item.prompt_type || "correction"] || BRAIN_TYPE_CONFIG.correction;
  const sourceConf = SOURCE_CONFIG[item.source || "log"];
  const Icon = typeConf.icon;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(item.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isApplied = item.applied;
  const isRejected = item.rejected;

  return (
    <Card className={`border ${isApplied ? "border-green-500/30 bg-green-500/5" : isRejected ? "border-red-500/30 bg-red-500/5 opacity-60" : "border-border"}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
            <Icon className={`h-4 w-4 shrink-0 ${typeConf.color}`} />
            <span className="text-sm font-semibold truncate">{item.title}</span>
            {item.deduplicated && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-yellow-500/40 text-yellow-600">DUP</Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={prioConf.variant} className="text-[10px] px-1.5 py-0">{prioConf.label}</Badge>
            <Badge className={`text-[10px] px-1.5 py-0 ${brainType.color} border-0`}>{brainType.label}</Badge>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{item.description}</p>

        {/* Brain metadata row */}
        <div className="flex items-center gap-3 flex-wrap text-[10px]">
          {item.confidence !== undefined && (
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Confiança:</span>
              <ConfidenceBar value={item.confidence} />
            </div>
          )}
          {item.impact_score !== undefined && (
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Impacto:</span>
              <span className="font-bold text-foreground">{Math.round(item.impact_score * 100)}%</span>
            </div>
          )}
          {sourceConf && (
            <div className="flex items-center gap-1">
              <sourceConf.icon className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Fonte: {sourceConf.label}</span>
            </div>
          )}
          {item.auto_applicable && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-green-500/40 text-green-600">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Auto
            </Badge>
          )}
          {item.impact && (
            <span className="text-muted-foreground">Área: <strong className="text-foreground">{item.impact}</strong></span>
          )}
          {item.estimated_effort && (
            <span className="text-muted-foreground">Esforço: <strong className="text-foreground">{item.estimated_effort}</strong></span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {expanded ? "Ocultar" : "Ver prompt"}
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
          {!isApplied && !isRejected && (
            <>
              <Button
                variant="outline" size="sm"
                className="text-xs h-7 px-2 border-green-500/40 text-green-600 hover:bg-green-500/10"
                onClick={() => onApply(analysisId, index)}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> Aplicado
              </Button>
              <Button
                variant="outline" size="sm"
                className="text-xs h-7 px-2 border-red-500/40 text-red-600 hover:bg-red-500/10"
                onClick={() => onReject(analysisId, index)}
              >
                <XCircle className="h-3 w-3 mr-1" /> Rejeitar
              </Button>
            </>
          )}
          {isApplied && (
            <Badge className="text-[10px] bg-green-500/10 text-green-600 border-0">
              <CheckCircle2 className="h-3 w-3 mr-0.5" /> Aplicado
            </Badge>
          )}
          {isRejected && (
            <Badge className="text-[10px] bg-red-500/10 text-red-600 border-0">
              <XCircle className="h-3 w-3 mr-0.5" /> Rejeitado
            </Badge>
          )}
        </div>

        {expanded && (
          <div className="bg-muted/50 rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-words border border-border max-h-64 overflow-auto">
            {item.prompt}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPromptIntelligence() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisRecord | null>(null);
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"impact" | "confidence" | "priority">("impact");

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("prompt-intelligence", {
        body: { action: "analyze", type: "full" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCurrentAnalysis({
        id: data.id,
        status: "completed",
        summary: data.summary,
        prompts: data.prompts || [],
        total_prompts: data.counts?.total || 0,
        high_priority: data.counts?.high || 0,
        medium_priority: data.counts?.medium || 0,
        low_priority: data.counts?.low || 0,
        created_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        confidence: data.scores?.avgConfidence,
        impact_score: data.scores?.avgImpact,
      });

      toast({ title: "Análise concluída", description: `${data.prompts?.length || 0} prompts · ${data.counts?.auto || 0} auto-aplicáveis` });
    } catch (e: any) {
      toast({ title: "Erro na análise", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("prompt-intelligence", {
        body: { action: "list", limit: 5 },
      });
      if (!error && data?.results) {
        setHistory(data.results);
        setHistoryLoaded(true);
      }
    } catch { /* silent */ }
  }, []);

  const handleApply = useCallback(async (id: string, promptIndex: number) => {
    try {
      await supabase.functions.invoke("prompt-intelligence", {
        body: { action: "apply", id, promptIndex },
      });
      if (currentAnalysis) {
        const updated = { ...currentAnalysis };
        const p = [...updated.prompts];
        p[promptIndex] = { ...p[promptIndex], applied: true };
        updated.prompts = p;
        setCurrentAnalysis(updated);
      }
      toast({ title: "Marcado como aplicado" });
    } catch { /* silent */ }
  }, [currentAnalysis, toast]);

  const handleReject = useCallback(async (id: string, promptIndex: number) => {
    try {
      await supabase.functions.invoke("prompt-intelligence", {
        body: { action: "reject", id, promptIndex },
      });
      if (currentAnalysis) {
        const updated = { ...currentAnalysis };
        const p = [...updated.prompts];
        p[promptIndex] = { ...p[promptIndex], rejected: true };
        updated.prompts = p;
        setCurrentAnalysis(updated);
      }
      toast({ title: "Prompt rejeitado" });
    } catch { /* silent */ }
  }, [currentAnalysis, toast]);

  const prompts = currentAnalysis?.prompts || [];

  // Filter by brain type
  const filtered = filterType
    ? prompts.filter((p) => p.prompt_type === filterType || p.type === filterType)
    : prompts;

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "impact") return (b.impact_score || 0) - (a.impact_score || 0);
    if (sortBy === "confidence") return (b.confidence || 0) - (a.confidence || 0);
    const prio = { high: 3, medium: 2, low: 1 };
    return (prio[b.priority] || 0) - (prio[a.priority] || 0);
  });

  const autoCount = prompts.filter(p => p.auto_applicable).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Cérebro WMTi</h2>
        </div>
        <div className="flex items-center gap-2">
          {!historyLoaded && (
            <Button variant="outline" size="sm" className="text-xs" onClick={loadHistory}>
              <Clock className="h-3.5 w-3.5 mr-1" /> Histórico
            </Button>
          )}
          <Button size="sm" className="text-xs" onClick={runAnalysis} disabled={loading}>
            {loading ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Analisando...</>
            ) : (
              <><Brain className="h-3.5 w-3.5 mr-1" /> Analisar Sistema</>
            )}
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {!currentAnalysis && !loading && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-sm font-semibold">Cérebro Autônomo WMTi</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Analisa testes, erros, contratos, funil e estrutura. Gera prompts priorizados por impacto financeiro
              com confiança, deduplicação e auto-aplicação controlada.
            </p>
            <Button onClick={runAnalysis} size="sm" className="text-xs mt-2">
              <Brain className="h-3.5 w-3.5 mr-1" /> Iniciar Análise
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="text-sm font-medium">Cérebro processando...</p>
            <p className="text-xs text-muted-foreground">
              Coletando testes, erros, contratos e funil → IA gerando prompts → Enriquecendo com scores...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {currentAnalysis && !loading && (
        <>
          {/* Summary with scores */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-bold">Resumo da Análise</h3>
                <div className="flex gap-1.5">
                  <Badge variant="destructive" className="text-[10px]">{currentAnalysis.high_priority} alta</Badge>
                  <Badge className="text-[10px]">{currentAnalysis.medium_priority} média</Badge>
                  <Badge variant="secondary" className="text-[10px]">{currentAnalysis.low_priority} baixa</Badge>
                </div>
              </div>
              {currentAnalysis.summary && (
                <p className="text-xs text-muted-foreground">{currentAnalysis.summary}</p>
              )}
              {/* Score cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-background rounded-md p-2 text-center border border-border">
                  <p className="text-[10px] text-muted-foreground">Confiança Média</p>
                  <p className="text-sm font-bold text-foreground">
                    {currentAnalysis.confidence ? `${Math.round(currentAnalysis.confidence * 100)}%` : "—"}
                  </p>
                </div>
                <div className="bg-background rounded-md p-2 text-center border border-border">
                  <p className="text-[10px] text-muted-foreground">Impacto Médio</p>
                  <p className="text-sm font-bold text-foreground">
                    {currentAnalysis.impact_score ? `${Math.round(currentAnalysis.impact_score * 100)}%` : "—"}
                  </p>
                </div>
                <div className="bg-background rounded-md p-2 text-center border border-border">
                  <p className="text-[10px] text-muted-foreground">Auto-aplicáveis</p>
                  <p className="text-sm font-bold text-green-600">{autoCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters by brain type */}
          <div className="flex gap-1.5 flex-wrap">
            <Button
              variant={filterType === null ? "default" : "outline"}
              size="sm" className="text-[11px] h-7"
              onClick={() => setFilterType(null)}
            >
              Todos ({prompts.length})
            </Button>
            {Object.entries(BRAIN_TYPE_CONFIG).map(([key, conf]) => {
              const count = prompts.filter((p) => p.prompt_type === key).length;
              if (count === 0) return null;
              return (
                <Button
                  key={key}
                  variant={filterType === key ? "default" : "outline"}
                  size="sm" className="text-[11px] h-7"
                  onClick={() => setFilterType(key)}
                >
                  {conf.label} ({count})
                </Button>
              );
            })}
            {/* Also show original type filters if brain types are sparse */}
            {Object.entries(TYPE_CONFIG).map(([key, conf]) => {
              const count = prompts.filter((p) => p.type === key).length;
              if (count === 0) return null;
              const Icon = conf.icon;
              return (
                <Button
                  key={`type-${key}`}
                  variant={filterType === key ? "default" : "outline"}
                  size="sm" className="text-[11px] h-7"
                  onClick={() => setFilterType(key)}
                >
                  <Icon className="h-3 w-3 mr-1" /> {conf.label} ({count})
                </Button>
              );
            })}
          </div>

          {/* Sort controls */}
          <div className="flex gap-1.5 items-center">
            <span className="text-[10px] text-muted-foreground">Ordenar:</span>
            {([
              ["impact", "Impacto"],
              ["confidence", "Confiança"],
              ["priority", "Prioridade"],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                variant={sortBy === key ? "default" : "ghost"}
                size="sm" className="text-[10px] h-6 px-2"
                onClick={() => setSortBy(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Prompt List */}
          <div className="space-y-2">
            {sorted.map((item, i) => (
              <PromptCard
                key={`${currentAnalysis.id}-${i}`}
                item={item}
                index={prompts.indexOf(item)}
                analysisId={currentAnalysis.id}
                onApply={handleApply}
                onReject={handleReject}
              />
            ))}
          </div>

          {sorted.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhum prompt encontrado para este filtro.
            </p>
          )}
        </>
      )}

      {/* History */}
      {historyLoaded && history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Histórico de Análises</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between p-2 rounded border border-border text-xs cursor-pointer hover:bg-muted/50"
                onClick={() => setCurrentAnalysis(h)}
              >
                <div className="flex items-center gap-2">
                  <Badge variant={h.status === "completed" ? "default" : "destructive"} className="text-[10px]">
                    {h.status === "completed" ? "OK" : h.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(h.created_at).toLocaleDateString("pt-BR")} {new Date(h.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <span className="font-medium">{h.total_prompts} prompts</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

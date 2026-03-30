import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, Loader2, RefreshCw, Copy, Check, Zap, Bug, Gauge, Layers, TrendingUp,
  ChevronDown, ChevronUp, AlertTriangle, Clock,
} from "lucide-react";

type PromptItem = {
  type: "fix" | "create" | "optimize" | "standardize" | "conversion";
  title: string;
  description: string;
  prompt: string;
  priority: "high" | "medium" | "low";
  impact?: string;
  estimated_effort?: string;
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
};

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  fix: { label: "Correção", icon: Bug, color: "text-red-500" },
  create: { label: "Criação", icon: Zap, color: "text-blue-500" },
  optimize: { label: "Otimização", icon: Gauge, color: "text-yellow-500" },
  standardize: { label: "Padronização", icon: Layers, color: "text-purple-500" },
  conversion: { label: "Conversão", icon: TrendingUp, color: "text-green-500" },
};

const PRIORITY_CONFIG: Record<string, { label: string; variant: "destructive" | "default" | "secondary" | "outline" }> = {
  high: { label: "Alta", variant: "destructive" },
  medium: { label: "Média", variant: "default" },
  low: { label: "Baixa", variant: "secondary" },
};

function PromptCard({ item, index }: { item: PromptItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const typeConf = TYPE_CONFIG[item.type] || TYPE_CONFIG.fix;
  const prioConf = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
  const Icon = typeConf.icon;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(item.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border border-border">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
            <Icon className={`h-4 w-4 shrink-0 ${typeConf.color}`} />
            <span className="text-sm font-semibold truncate">{item.title}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={prioConf.variant} className="text-[10px] px-1.5 py-0">
              {prioConf.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {typeConf.label}
            </Badge>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{item.description}</p>

        {item.impact && (
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            <span>Impacto: <strong className="text-foreground">{item.impact}</strong></span>
            {item.estimated_effort && (
              <span>Esforço: <strong className="text-foreground">{item.estimated_effort}</strong></span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {expanded ? "Ocultar" : "Ver prompt"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copiado!" : "Copiar prompt"}
          </Button>
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
      });

      toast({ title: "Análise concluída", description: `${data.prompts?.length || 0} prompts gerados` });
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
    } catch {
      // silent
    }
  }, []);

  const prompts = currentAnalysis?.prompts || [];
  const filtered = filterType ? prompts.filter((p) => p.type === filterType) : prompts;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Prompt Intelligence</h2>
        </div>
        <div className="flex items-center gap-2">
          {!historyLoaded && (
            <Button variant="outline" size="sm" className="text-xs" onClick={loadHistory}>
              <Clock className="h-3.5 w-3.5 mr-1" /> Histórico
            </Button>
          )}
          <Button
            size="sm"
            className="text-xs"
            onClick={runAnalysis}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Analisando...</>
            ) : (
              <><Brain className="h-3.5 w-3.5 mr-1" /> Analisar Sistema</>
            )}
          </Button>
        </div>
      </div>

      {/* No analysis yet */}
      {!currentAnalysis && !loading && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-sm font-semibold">WMTi Prompt Intelligence</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Analisa testes, erros, contratos, funil e estrutura do projeto para gerar prompts
              específicos de criação, correção, otimização e conversão.
            </p>
            <Button onClick={runAnalysis} size="sm" className="text-xs mt-2">
              <Brain className="h-3.5 w-3.5 mr-1" /> Iniciar Análise Completa
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="text-sm font-medium">Analisando sistema WMTi...</p>
            <p className="text-xs text-muted-foreground">
              Coletando dados de testes, erros, contratos e funil de vendas...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {currentAnalysis && !loading && (
        <>
          {/* Summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-bold">Resumo da Análise</h3>
                <div className="flex gap-1.5">
                  <Badge variant="destructive" className="text-[10px]">
                    {currentAnalysis.high_priority} alta
                  </Badge>
                  <Badge className="text-[10px]">
                    {currentAnalysis.medium_priority} média
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {currentAnalysis.low_priority} baixa
                  </Badge>
                </div>
              </div>
              {currentAnalysis.summary && (
                <p className="text-xs text-muted-foreground">{currentAnalysis.summary}</p>
              )}
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex gap-1.5 flex-wrap">
            <Button
              variant={filterType === null ? "default" : "outline"}
              size="sm"
              className="text-[11px] h-7"
              onClick={() => setFilterType(null)}
            >
              Todos ({prompts.length})
            </Button>
            {Object.entries(TYPE_CONFIG).map(([key, conf]) => {
              const count = prompts.filter((p) => p.type === key).length;
              if (count === 0) return null;
              const Icon = conf.icon;
              return (
                <Button
                  key={key}
                  variant={filterType === key ? "default" : "outline"}
                  size="sm"
                  className="text-[11px] h-7"
                  onClick={() => setFilterType(key)}
                >
                  <Icon className="h-3 w-3 mr-1" /> {conf.label} ({count})
                </Button>
              );
            })}
          </div>

          {/* Prompt List */}
          <div className="space-y-2">
            {filtered.map((item, i) => (
              <PromptCard key={i} item={item} index={i} />
            ))}
          </div>

          {filtered.length === 0 && (
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

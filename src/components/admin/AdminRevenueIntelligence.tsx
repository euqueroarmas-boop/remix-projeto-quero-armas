import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, Loader2, TrendingUp, Target, Flame, AlertTriangle,
  Users, Zap, ShieldAlert, BookOpen, ArrowUpRight,
} from "lucide-react";

type LeadAnalysis = {
  lead_id: string | null;
  quote_id: string | null;
  service_type: string;
  lead_value_estimate: number;
  conversion_probability: number;
  urgency_level: string;
  decision_stage: string;
  strategy: string;
  company_size: string;
  machines_qty: number;
  pain_point: string;
  sector: string;
};

type AnalysisResult = {
  total: number;
  summary: string;
  stats: {
    totalValue: number;
    avgProbability: number;
    hotLeads: number;
    criticalLeads: number;
  };
  leads: LeadAnalysis[];
};

const URGENCY_CONFIG: Record<string, { label: string; color: string; icon: typeof Flame }> = {
  critica: { label: "Crítica", color: "text-red-500 bg-red-500/10", icon: ShieldAlert },
  alta: { label: "Alta", color: "text-orange-500 bg-orange-500/10", icon: Flame },
  media: { label: "Média", color: "text-yellow-500 bg-yellow-500/10", icon: Target },
  baixa: { label: "Baixa", color: "text-muted-foreground bg-muted", icon: Users },
};

const STRATEGY_CONFIG: Record<string, { label: string; icon: typeof Zap }> = {
  urgencia: { label: "Urgência", icon: Flame },
  autoridade: { label: "Autoridade", icon: ShieldAlert },
  pressao: { label: "Pressão", icon: TrendingUp },
  desconto: { label: "Desconto", icon: DollarSign },
  educacao: { label: "Educação", icon: BookOpen },
};

function ProbabilityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold">{pct}%</span>
    </div>
  );
}

function LeadCard({ lead }: { lead: LeadAnalysis }) {
  const urgConf = URGENCY_CONFIG[lead.urgency_level] || URGENCY_CONFIG.baixa;
  const stratConf = STRATEGY_CONFIG[lead.strategy] || STRATEGY_CONFIG.educacao;
  const UrgIcon = urgConf.icon;
  const StratIcon = stratConf.icon;

  return (
    <Card className="border border-border">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <DollarSign className="h-4 w-4 text-green-500 shrink-0" />
            <span className="text-sm font-bold">R$ {lead.lead_value_estimate.toLocaleString("pt-BR")}</span>
            <span className="text-xs text-muted-foreground truncate">· {lead.service_type}</span>
          </div>
          <Badge className={`text-[10px] px-1.5 py-0 border-0 ${urgConf.color}`}>
            <UrgIcon className="h-3 w-3 mr-0.5" />
            {urgConf.label}
          </Badge>
        </div>

        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Conversão:</span>
            <ProbabilityBar value={lead.conversion_probability} />
          </div>
          <div className="flex items-center gap-1">
            <StratIcon className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Estratégia: <strong className="text-foreground">{stratConf.label}</strong></span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap text-[10px] text-muted-foreground">
          <span>Setor: <strong className="text-foreground">{lead.sector}</strong></span>
          <span>Porte: <strong className="text-foreground">{lead.company_size}</strong></span>
          {lead.machines_qty > 0 && <span>Máquinas: <strong className="text-foreground">{lead.machines_qty}</strong></span>}
          <span>Estágio: <strong className="text-foreground">{lead.decision_stage}</strong></span>
          <span>Dor: <strong className="text-foreground">{lead.pain_point}</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminRevenueIntelligence() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [filterUrgency, setFilterUrgency] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("revenue-intelligence", {
        body: { action: "analyze" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data);
      toast({ title: "Análise de receita concluída", description: `${data.total} leads analisados` });
    } catch (e: any) {
      toast({ title: "Erro na análise", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const leads = result?.leads || [];
  const filtered = filterUrgency ? leads.filter(l => l.urgency_level === filterUrgency) : leads;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-500" />
          <h2 className="text-base font-bold">Inteligência de Receita</h2>
        </div>
        <Button size="sm" className="text-xs" onClick={runAnalysis} disabled={loading}>
          {loading ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Analisando...</>
          ) : (
            <><TrendingUp className="h-3.5 w-3.5 mr-1" /> Analisar Leads</>
          )}
        </Button>
      </div>

      {/* Empty */}
      {!result && !loading && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-sm font-semibold">Análise de Receita WMTi</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Analisa todos os leads e orçamentos para calcular probabilidade de conversão,
              valor estimado, urgência e estratégia de abordagem.
            </p>
            <Button onClick={runAnalysis} size="sm" className="text-xs mt-2">
              <TrendingUp className="h-3.5 w-3.5 mr-1" /> Analisar Agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-green-500" />
            <p className="text-sm font-medium">Analisando leads e orçamentos...</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Receita Potencial</p>
                <p className="text-lg font-bold text-green-600">
                  R$ {result.stats.totalValue.toLocaleString("pt-BR")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Conversão Média</p>
                <p className="text-lg font-bold text-blue-600">{result.stats.avgProbability}%</p>
              </CardContent>
            </Card>
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Leads Quentes</p>
                <p className="text-lg font-bold text-orange-600">{result.stats.hotLeads}</p>
              </CardContent>
            </Card>
            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Urgência Crítica</p>
                <p className="text-lg font-bold text-red-600">{result.stats.criticalLeads}</p>
              </CardContent>
            </Card>
          </div>

          {/* AI Summary */}
          {result.summary && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold">Análise IA</span>
                </div>
                <p className="text-xs text-muted-foreground">{result.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Urgency filters */}
          <div className="flex gap-1.5 flex-wrap">
            <Button
              variant={filterUrgency === null ? "default" : "outline"}
              size="sm" className="text-[11px] h-7"
              onClick={() => setFilterUrgency(null)}
            >
              Todos ({leads.length})
            </Button>
            {Object.entries(URGENCY_CONFIG).map(([key, conf]) => {
              const count = leads.filter(l => l.urgency_level === key).length;
              if (count === 0) return null;
              const Icon = conf.icon;
              return (
                <Button
                  key={key}
                  variant={filterUrgency === key ? "default" : "outline"}
                  size="sm" className="text-[11px] h-7"
                  onClick={() => setFilterUrgency(key)}
                >
                  <Icon className="h-3 w-3 mr-1" /> {conf.label} ({count})
                </Button>
              );
            })}
          </div>

          {/* Lead List */}
          <div className="space-y-2">
            {filtered.map((lead, i) => (
              <LeadCard key={`${lead.lead_id || i}-${i}`} lead={lead} />
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhum lead encontrado para este filtro.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * CIPA Pulse — Statistics Panel (Phase 5)
 * Displays monthly aggregated statistics with visual cards
 */

import { useEffect, useState } from "react";
import { BarChart3, TrendingDown, TrendingUp, Zap, Shield, Clock, Activity, AlertTriangle } from "lucide-react";
import { aggregateMonthStats, detectTriggers, type MonthlyStats } from "./PulseStatsAggregator";

const TRIGGER_LABELS: Record<string, { label: string; icon: string }> = {
  escalada_rapida: { label: "Escalada Rápida", icon: "⚡" },
  tensao_sustentada: { label: "Tensão Sustentada", icon: "🔥" },
  estresse_matinal: { label: "Estresse Matinal", icon: "🌅" },
};

export default function PulseStatistics() {
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [triggers, setTriggers] = useState<{ name: string; count: number; avgIntensity: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [s, t] = await Promise.all([aggregateMonthStats(), detectTriggers()]);
      if (!mounted) return;
      setStats(s);
      setTriggers(t);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-mono font-bold text-primary">Estatísticas Mensais</span>
        </div>
        <div className="text-[10px] text-muted-foreground animate-pulse">Calculando...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-mono font-bold text-primary">Estatísticas Mensais</span>
        </div>
        <div className="text-[10px] text-muted-foreground">Sem dados suficientes este mês</div>
      </div>
    );
  }

  const stabilityColor = stats.stability_score >= 70
    ? "text-green-500"
    : stats.stability_score >= 40
      ? "text-yellow-500"
      : "text-red-500";

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-mono font-bold text-primary">Estatísticas Mensais</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{stats.month_key}</span>
      </div>

      {/* Stability Score - Main Card */}
      <div className="bg-background/50 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Score de Estabilidade</span>
        </div>
        <div className={`text-3xl font-mono font-black ${stabilityColor}`}>
          {stats.stability_score}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {stats.stability_score >= 70 ? "Ambiente Estável" : stats.stability_score >= 40 ? "Atenção Necessária" : "Risco Elevado"}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<Activity className="w-3 h-3" />}
          label="Média"
          value={stats.average_score.toString()}
          sub={`de ${stats.total_readings} leituras`}
        />
        <StatCard
          icon={stats.max_score >= 81 ? <TrendingUp className="w-3 h-3 text-red-500" /> : <TrendingDown className="w-3 h-3 text-green-500" />}
          label="Pico Máximo"
          value={stats.max_score.toString()}
          sub={stats.max_score >= 81 ? "Zona de conflito" : "Controlado"}
        />
        <StatCard
          icon={<Zap className="w-3 h-3 text-orange-500" />}
          label="Eventos Críticos"
          value={stats.critical_events.toString()}
          sub="Leituras ≥ 70"
        />
        <StatCard
          icon={<AlertTriangle className="w-3 h-3 text-red-500" />}
          label="Conflitos"
          value={stats.conflict_events.toString()}
          sub="Leituras ≥ 81"
        />
        <StatCard
          icon={<Clock className="w-3 h-3 text-blue-500" />}
          label="Cooldown Médio"
          value={stats.cooldown_avg_minutes > 0 ? `${stats.cooldown_avg_minutes}min` : "—"}
          sub="Tempo de recuperação"
        />
        <StatCard
          icon={<BarChart3 className="w-3 h-3 text-primary" />}
          label="Total Leituras"
          value={stats.total_readings.toString()}
          sub="Este mês"
        />
      </div>

      {/* Triggers */}
      {triggers.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
            Padrões Detectados
          </div>
          {triggers.map(t => {
            const meta = TRIGGER_LABELS[t.name] || { label: t.name, icon: "📊" };
            return (
              <div key={t.name} className="flex items-center justify-between bg-background/50 rounded px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">{meta.icon}</span>
                  <span className="text-[11px] font-mono">{meta.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-mono font-bold">{t.count}×</span>
                  <span className="text-[9px] text-muted-foreground ml-1">int. {t.avgIntensity}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-background/50 rounded-lg p-2 space-y-0.5">
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-[9px] font-mono text-muted-foreground uppercase">{label}</span>
      </div>
      <div className="text-lg font-mono font-black leading-none">{value}</div>
      <div className="text-[9px] text-muted-foreground">{sub}</div>
    </div>
  );
}

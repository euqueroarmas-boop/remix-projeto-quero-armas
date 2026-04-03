import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, TrendingUp, TrendingDown, Flame, Shield, AlertTriangle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateDailyStats, detectEvents, type StressLog, type DailyStats } from "./stressEventEngine";

function riskLabel(risk: number) {
  if (risk <= 20) return { label: "Estável", icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
  if (risk <= 40) return { label: "Sensível", icon: Activity, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" };
  if (risk <= 60) return { label: "Atenção", icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" };
  if (risk <= 80) return { label: "Tensão Alta", icon: Zap, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" };
  return { label: "Crítico", icon: Flame, color: "text-red-500", bg: "bg-red-500/15", border: "border-red-500/40" };
}

export default function DailyScoreCard() {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [eventCount, setEventCount] = useState({ escalations: 0, nearFights: 0, fights: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    async function fetchToday() {
      const { data } = await supabase
        .from("cipa_stress_logs" as any)
        .select("*")
        .eq("day_key", today)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        const logs = data as unknown as StressLog[];
        const computed = calculateDailyStats(logs);
        setStats(computed);
        const events = detectEvents(logs);
        setEventCount({
          escalations: events.filter(e => e.type === "rapid_escalation").length,
          nearFights: events.filter(e => e.type === "near_fight").length,
          fights: events.filter(e => e.type === "fight").length,
        });
      }
      setLoading(false);
    }

    fetchToday();

    // Refresh every 30s
    const interval = setInterval(fetchToday, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return (
      <div className="rounded-xl bg-card border border-border p-3 text-center">
        <p className="text-[10px] font-mono text-muted-foreground">
          {loading ? "Carregando score..." : "Nenhum registro hoje"}
        </p>
      </div>
    );
  }

  const risk = stats.daily_conflict_risk;
  const info = riskLabel(risk);
  const RiskIcon = info.icon;

  return (
    <div className={`rounded-xl border ${info.border} ${info.bg} p-3 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">Score do Dia</span>
        </div>
        <div className="flex items-center gap-1">
          <RiskIcon className={`w-3 h-3 ${info.color}`} />
          <span className={`text-[10px] font-mono font-bold ${info.color}`}>{info.label}</span>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-end gap-3 mb-2">
        <motion.span
          className="text-3xl font-mono font-extrabold text-foreground tabular-nums"
          key={risk}
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
        >
          {risk.toFixed(0)}
        </motion.span>
        <span className="text-xs text-muted-foreground font-mono mb-1">/100</span>

        {/* Trend indicator */}
        <div className="ml-auto flex items-center gap-1">
          {risk <= 30 ? (
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5 text-red-400" />
          )}
        </div>
      </div>

      {/* Mini stats row */}
      <div className="grid grid-cols-4 gap-1.5">
        <MiniStat label="Pico" value={String(stats.max_value)} />
        <MiniStat label="Média" value={stats.weighted_average.toFixed(0)} />
        <MiniStat label="Escaladas" value={String(eventCount.escalations)} warn={eventCount.escalations > 0} />
        <MiniStat label="Brigas" value={String(eventCount.fights)} warn={eventCount.fights > 0} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-xs font-mono font-bold tabular-nums ${warn ? "text-red-400" : "text-foreground"}`}>{value}</p>
      <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

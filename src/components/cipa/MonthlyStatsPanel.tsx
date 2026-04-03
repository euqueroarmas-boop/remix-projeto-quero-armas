import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Calendar, Shield, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MonthlyStats {
  month_key: string;
  monthly_average: number;
  max_peak: number;
  high_risk_days: number;
  near_fight_events: number;
  fight_events: number;
  stable_days_percent: number;
  average_cooldown_time: number;
  monthly_stability_score: number;
  month_over_month_variation: number;
}

export default function MonthlyStatsPanel() {
  const [current, setCurrent] = useState<MonthlyStats | null>(null);
  const [previous, setPrevious] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const now = new Date();
      const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

      const { data } = await supabase
        .from("cipa_stress_monthly_stats" as any)
        .select("*")
        .in("month_key", [curKey, prevKey]);

      if (data) {
        const items = data as unknown as MonthlyStats[];
        setCurrent(items.find(i => i.month_key === curKey) || null);
        setPrevious(items.find(i => i.month_key === prevKey) || null);
      }
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) return null;
  if (!current) return (
    <div className="rounded-xl bg-card border border-border p-3 text-center">
      <p className="text-[10px] font-mono text-muted-foreground">Sem dados mensais ainda</p>
    </div>
  );

  const score = current.monthly_stability_score;
  const variation = current.month_over_month_variation;
  const improving = variation > 0;

  return (
    <div className="rounded-xl bg-card border border-border p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
            Estabilidade Mensal
          </span>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/60">{current.month_key}</span>
      </div>

      {/* Score + variation */}
      <div className="flex items-end gap-3">
        <motion.span
          className="text-3xl font-mono font-extrabold text-foreground tabular-nums"
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
        >
          {score.toFixed(0)}
        </motion.span>
        <span className="text-xs text-muted-foreground font-mono mb-1">/100</span>

        {variation !== 0 && (
          <div className={`ml-auto flex items-center gap-0.5 text-[10px] font-mono font-bold ${improving ? "text-emerald-400" : "text-red-400"}`}>
            {improving ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {improving ? "+" : ""}{variation.toFixed(1)}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Dias estáveis" value={`${current.stable_days_percent.toFixed(0)}%`} icon={Shield} good={current.stable_days_percent >= 70} />
        <StatBox label="Quase brigas" value={String(current.near_fight_events)} icon={Activity} good={current.near_fight_events === 0} />
        <StatBox label="Brigas" value={String(current.fight_events)} icon={Activity} good={current.fight_events === 0} />
      </div>

      {/* Comparison */}
      {previous && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-[9px] font-mono text-muted-foreground mb-1">vs. mês anterior ({previous.month_key})</p>
          <div className="flex gap-3 text-[10px] font-mono">
            <CompareItem label="Score" curr={score} prev={previous.monthly_stability_score} />
            <CompareItem label="Pico" curr={current.max_peak} prev={previous.max_peak} invert />
            <CompareItem label="Brigas" curr={current.fight_events} prev={previous.fight_events} invert />
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, icon: Icon, good }: { label: string; value: string; icon: any; good: boolean }) {
  return (
    <div className="text-center p-1.5 rounded-lg bg-muted/30">
      <Icon className={`w-3 h-3 mx-auto mb-0.5 ${good ? "text-emerald-400" : "text-red-400"}`} />
      <p className="text-xs font-mono font-bold text-foreground">{value}</p>
      <p className="text-[7px] font-mono text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function CompareItem({ label, curr, prev, invert }: { label: string; curr: number; prev: number; invert?: boolean }) {
  const diff = curr - prev;
  const better = invert ? diff < 0 : diff > 0;
  return (
    <span className={`${better ? "text-emerald-400" : diff === 0 ? "text-muted-foreground" : "text-red-400"}`}>
      {label}: {diff > 0 ? "+" : ""}{diff.toFixed(0)}
    </span>
  );
}

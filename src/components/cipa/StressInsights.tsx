import { useState, useEffect, useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DailyRow {
  day_key: string;
  max_value: number;
  weighted_average: number;
  fight_events_count: number;
  near_fight_events_count: number;
  rapid_escalation_count: number;
  cooldown_efficiency_score: number;
  daily_conflict_risk: number;
}

export default function StressInsights() {
  const [rows, setRows] = useState<DailyRow[]>([]);

  useEffect(() => {
    async function fetch() {
      const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("cipa_stress_daily_stats" as any)
        .select("*")
        .gte("day_key", thirtyAgo)
        .order("day_key", { ascending: true });

      if (data) setRows(data as unknown as DailyRow[]);
    }
    fetch();
  }, []);

  const insights = useMemo(() => {
    if (rows.length < 2) return [];
    const msgs: string[] = [];

    const totalFights = rows.reduce((s, r) => s + (r.fight_events_count || 0), 0);
    const totalNear = rows.reduce((s, r) => s + (r.near_fight_events_count || 0), 0);
    const totalEscalations = rows.reduce((s, r) => s + (r.rapid_escalation_count || 0), 0);
    const avgRisk = rows.reduce((s, r) => s + r.daily_conflict_risk, 0) / rows.length;
    const avgCooldown = rows.reduce((s, r) => s + (r.cooldown_efficiency_score || 0), 0) / rows.length;

    // Fights
    if (totalFights === 0) {
      msgs.push(`🎉 Nenhuma briga nos últimos ${rows.length} dias! Excelente.`);
    } else {
      msgs.push(`⚠️ ${totalFights} briga${totalFights > 1 ? "s" : ""} nos últimos ${rows.length} dias.`);
    }

    // Near fights
    if (totalNear > 0) {
      msgs.push(`🔶 ${totalNear} quase-briga${totalNear > 1 ? "s" : ""} evitada${totalNear > 1 ? "s" : ""}.`);
    }

    // Trend (first half vs second half)
    const mid = Math.floor(rows.length / 2);
    const firstHalf = rows.slice(0, mid);
    const secondHalf = rows.slice(mid);
    const firstAvg = firstHalf.reduce((s, r) => s + r.daily_conflict_risk, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, r) => s + r.daily_conflict_risk, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;

    if (diff < -5) {
      msgs.push(`📉 Tendência de melhora: risco médio caiu ${Math.abs(diff).toFixed(0)} pontos.`);
    } else if (diff > 5) {
      msgs.push(`📈 Atenção: risco médio subiu ${diff.toFixed(0)} pontos recentemente.`);
    }

    // Peak day
    const peakDay = rows.reduce((max, r) => r.max_value > max.max_value ? r : max, rows[0]);
    if (peakDay.max_value >= 60) {
      msgs.push(`🔴 Pico mais alto: ${peakDay.max_value} em ${formatDay(peakDay.day_key)}.`);
    }

    // Cooldown
    if (avgCooldown >= 70) {
      msgs.push(`💚 Boa recuperação: média de ${avgCooldown.toFixed(0)}% de eficiência.`);
    } else if (avgCooldown < 50 && avgCooldown > 0) {
      msgs.push(`⏱️ Recuperação lenta: média de ${avgCooldown.toFixed(0)}%. Tente técnicas de desescalada.`);
    }

    // Escalations
    if (totalEscalations >= 3) {
      msgs.push(`⚡ ${totalEscalations} escaladas rápidas detectadas. Fique atento aos gatilhos.`);
    }

    return msgs;
  }, [rows]);

  if (insights.length === 0) return null;

  return (
    <div className="rounded-xl bg-card border border-border p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">Insights</span>
      </div>
      <div className="space-y-1.5">
        {insights.map((msg, i) => (
          <p key={i} className="text-[11px] font-mono text-foreground/80 leading-relaxed">{msg}</p>
        ))}
      </div>
    </div>
  );
}

function formatDay(dayKey: string) {
  const [, m, d] = dayKey.split("-");
  return `${d}/${m}`;
}

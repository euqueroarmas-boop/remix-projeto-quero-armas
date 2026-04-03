import { useState, useEffect, useMemo } from "react";
import { Lightbulb, Mic } from "lucide-react";
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

interface VoiceDayRow {
  day_key: string;
  average_tension_score: number;
  peak_tension_score: number;
  anger_spikes_count: number;
  sustained_high_tension_minutes: number;
  cooldown_voice_recovery_score: number;
}

export default function StressInsights() {
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [voiceRows, setVoiceRows] = useState<VoiceDayRow[]>([]);

  useEffect(() => {
    const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    async function fetch() {
      const [{ data: stressData }, { data: voiceData }] = await Promise.all([
        supabase
          .from("cipa_stress_daily_stats" as any)
          .select("*")
          .gte("day_key", thirtyAgo)
          .order("day_key", { ascending: true }),
        supabase
          .from("cipa_voice_daily_stats" as any)
          .select("*")
          .gte("day_key", thirtyAgo)
          .order("day_key", { ascending: true }),
      ]);

      if (stressData) setRows(stressData as unknown as DailyRow[]);
      if (voiceData) setVoiceRows(voiceData as unknown as VoiceDayRow[]);
    }
    fetch();
  }, []);

  const insights = useMemo(() => {
    const msgs: string[] = [];

    // Manual stress insights
    if (rows.length >= 2) {
      const totalFights = rows.reduce((s, r) => s + (r.fight_events_count || 0), 0);
      const totalNear = rows.reduce((s, r) => s + (r.near_fight_events_count || 0), 0);
      const totalEscalations = rows.reduce((s, r) => s + (r.rapid_escalation_count || 0), 0);
      const avgCooldown = rows.reduce((s, r) => s + (r.cooldown_efficiency_score || 0), 0) / rows.length;

      if (totalFights === 0) {
        msgs.push(`🎉 Nenhuma briga nos últimos ${rows.length} dias! Excelente.`);
      } else {
        msgs.push(`⚠️ ${totalFights} briga${totalFights > 1 ? "s" : ""} nos últimos ${rows.length} dias.`);
      }

      if (totalNear > 0) {
        msgs.push(`🔶 ${totalNear} quase-briga${totalNear > 1 ? "s" : ""} evitada${totalNear > 1 ? "s" : ""}.`);
      }

      // Trend
      const mid = Math.floor(rows.length / 2);
      const firstAvg = rows.slice(0, mid).reduce((s, r) => s + r.daily_conflict_risk, 0) / mid;
      const secondAvg = rows.slice(mid).reduce((s, r) => s + r.daily_conflict_risk, 0) / (rows.length - mid);
      const diff = secondAvg - firstAvg;

      if (diff < -5) {
        msgs.push(`📉 Tendência de melhora: risco médio caiu ${Math.abs(diff).toFixed(0)} pontos.`);
      } else if (diff > 5) {
        msgs.push(`📈 Atenção: risco médio subiu ${diff.toFixed(0)} pontos recentemente.`);
      }

      // Peak
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

      if (totalEscalations >= 3) {
        msgs.push(`⚡ ${totalEscalations} escaladas rápidas detectadas. Fique atento aos gatilhos.`);
      }
    }

    // Voice insights
    if (voiceRows.length >= 1) {
      const totalAngerSpikes = voiceRows.reduce((s, r) => s + (r.anger_spikes_count || 0), 0);
      const avgVoiceTension = voiceRows.reduce((s, r) => s + r.average_tension_score, 0) / voiceRows.length;
      const maxVoicePeak = Math.max(...voiceRows.map(r => r.peak_tension_score));
      const totalSustained = voiceRows.reduce((s, r) => s + (r.sustained_high_tension_minutes || 0), 0);

      if (totalAngerSpikes === 0 && avgVoiceTension < 30) {
        msgs.push(`🎤 Voz calma nos últimos ${voiceRows.length} dias: média ${avgVoiceTension.toFixed(0)}/100.`);
      } else if (totalAngerSpikes > 0) {
        msgs.push(`🎤 ${totalAngerSpikes} pico${totalAngerSpikes > 1 ? "s" : ""} de raiva vocal detectado${totalAngerSpikes > 1 ? "s" : ""}.`);
      }

      if (maxVoicePeak >= 70) {
        const peakVDay = voiceRows.reduce((m, r) => r.peak_tension_score > m.peak_tension_score ? r : m, voiceRows[0]);
        msgs.push(`🗣️ Pico vocal: ${maxVoicePeak.toFixed(0)} em ${formatDay(peakVDay.day_key)}.`);
      }

      if (totalSustained >= 5) {
        msgs.push(`⏳ ${totalSustained.toFixed(0)} min de tensão vocal sustentada acumulada.`);
      }

      // Cross-correlation: days where both manual and voice are high
      if (rows.length >= 2) {
        const voiceMap = new Map(voiceRows.map(v => [v.day_key, v]));
        let crossHighDays = 0;
        for (const r of rows) {
          const v = voiceMap.get(r.day_key);
          if (v && r.daily_conflict_risk >= 50 && v.average_tension_score >= 40) {
            crossHighDays++;
          }
        }
        if (crossHighDays > 0) {
          msgs.push(`🔗 ${crossHighDays} dia${crossHighDays > 1 ? "s" : ""} com tensão alta confirmada por toque + voz.`);
        }
      }
    }

    return msgs;
  }, [rows, voiceRows]);

  if (insights.length === 0) return null;

  const hasVoice = voiceRows.length > 0;

  return (
    <div className="rounded-xl bg-card border border-border p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
          Insights {hasVoice && "(Híbrido)"}
        </span>
        {hasVoice && <Mic className="w-2.5 h-2.5 text-muted-foreground/50" />}
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

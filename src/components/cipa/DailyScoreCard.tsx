import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, TrendingUp, TrendingDown, Flame, Shield, AlertTriangle, Zap, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateDailyStats, detectEvents, type StressLog, type DailyStats } from "./stressEventEngine";
import { calculateHybridScore, type HybridResult } from "./hybridScoreEngine";

function riskLabel(risk: number) {
  if (risk <= 20) return { label: "Estável", icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
  if (risk <= 40) return { label: "Sensível", icon: Activity, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" };
  if (risk <= 60) return { label: "Atenção", icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" };
  if (risk <= 80) return { label: "Tensão Alta", icon: Zap, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" };
  return { label: "Crítico", icon: Flame, color: "text-red-500", bg: "bg-red-500/15", border: "border-red-500/40" };
}

interface VoiceDayStats {
  average_tension_score: number;
  peak_tension_score: number;
  anger_spikes_count: number;
}

export default function DailyScoreCard() {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [voiceStats, setVoiceStats] = useState<VoiceDayStats | null>(null);
  const [hybrid, setHybrid] = useState<HybridResult | null>(null);
  const [eventCount, setEventCount] = useState({ escalations: 0, nearFights: 0, fights: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    async function fetchToday() {
      // Fetch manual stress logs
      const { data: manualData } = await supabase
        .from("cipa_stress_logs" as any)
        .select("*")
        .eq("day_key", today)
        .order("created_at", { ascending: true });

      let manualStats: DailyStats | null = null;
      if (manualData && manualData.length > 0) {
        const logs = manualData as unknown as StressLog[];
        manualStats = calculateDailyStats(logs);
        setStats(manualStats);
        const events = detectEvents(logs);
        setEventCount({
          escalations: events.filter(e => e.type === "rapid_escalation").length,
          nearFights: events.filter(e => e.type === "near_fight").length,
          fights: events.filter(e => e.type === "fight").length,
        });
      }

      // Fetch voice daily stats
      const { data: voiceData } = await supabase
        .from("cipa_voice_daily_stats" as any)
        .select("average_tension_score, peak_tension_score, anger_spikes_count")
        .eq("day_key", today)
        .maybeSingle();

      const vStats = voiceData as unknown as VoiceDayStats | null;
      setVoiceStats(vStats);

      // Calculate hybrid score
      const result = calculateHybridScore({
        manualRisk: manualStats?.daily_conflict_risk ?? null,
        manualPeak: manualStats?.max_value ?? null,
        manualAvg: manualStats?.weighted_average ?? null,
        voiceTension: vStats?.average_tension_score ?? null,
        voicePeak: vStats?.peak_tension_score ?? null,
        voiceAngerSpikes: vStats?.anger_spikes_count ?? null,
      });
      setHybrid(result);

      setLoading(false);
    }

    fetchToday();
    const interval = setInterval(fetchToday, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || (!stats && !voiceStats)) {
    return (
      <div className="rounded-xl bg-card border border-border p-3 text-center">
        <p className="text-[10px] font-mono text-muted-foreground">
          {loading ? "Carregando score..." : "Nenhum registro hoje"}
        </p>
      </div>
    );
  }

  const risk = hybrid?.hybridScore ?? stats?.daily_conflict_risk ?? 0;
  const info = riskLabel(risk);
  const RiskIcon = info.icon;
  const isHybrid = hybrid?.dominantSource === "hybrid";

  return (
    <div className={`rounded-xl border ${info.border} ${info.bg} p-3 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
            Score do Dia {isHybrid && "(Híbrido)"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isHybrid && <Mic className="w-2.5 h-2.5 text-muted-foreground" />}
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

        {/* Trend + confidence */}
        <div className="ml-auto flex items-center gap-1.5">
          {hybrid && hybrid.confidence > 0 && (
            <span className="text-[8px] font-mono text-muted-foreground/60">{hybrid.confidence}% conf.</span>
          )}
          {risk <= 30 ? (
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5 text-red-400" />
          )}
        </div>
      </div>

      {/* Cross-signal alert */}
      {hybrid?.crossSignalAlert && (
        <div className="mb-2 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20">
          <p className="text-[9px] font-mono text-red-400 font-bold">
            ⚠ Alerta cruzado: tensão alta confirmada por toque + voz
          </p>
        </div>
      )}

      {/* Mini stats row */}
      <div className="grid grid-cols-4 gap-1.5">
        <MiniStat label="Pico" value={String(stats?.max_value ?? "—")} />
        <MiniStat label="Média" value={stats?.weighted_average?.toFixed(0) ?? "—"} />
        <MiniStat label="Escaladas" value={String(eventCount.escalations)} warn={eventCount.escalations > 0} />
        <MiniStat label="Brigas" value={String(eventCount.fights)} warn={eventCount.fights > 0} />
      </div>

      {/* Voice sub-row */}
      {voiceStats && (
        <div className="mt-1.5 pt-1.5 border-t border-border/50 grid grid-cols-3 gap-1.5">
          <MiniStat label="Voz Média" value={voiceStats.average_tension_score.toFixed(0)} />
          <MiniStat label="Voz Pico" value={voiceStats.peak_tension_score.toFixed(0)} />
          <MiniStat label="Raiva" value={String(voiceStats.anger_spikes_count)} warn={voiceStats.anger_spikes_count > 0} />
        </div>
      )}
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

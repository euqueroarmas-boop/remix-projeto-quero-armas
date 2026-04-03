/**
 * CIPA Pulse — Current Score Display (Phase 1)
 * Shows the current emotional level prominently
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gauge, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getZone } from "./PulseScoreEngine";

export default function PulseCurrentScore() {
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [todayAvg, setTodayAvg] = useState(0);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const load = async () => {
      const { data: logs } = await supabase
        .from("emotion_logs" as any)
        .select("manual_level, created_at")
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59.999`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (logs && logs.length > 0) {
        const entries = logs as any[];
        setCurrentLevel(entries[0].manual_level);
        setTodayCount(entries.length);
        const avg = Math.round(entries.reduce((a: number, b: any) => a + b.manual_level, 0) / entries.length);
        setTodayAvg(avg);
      } else {
        setCurrentLevel(null);
        setTodayCount(0);
        setTodayAvg(0);
      }
    };

    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (currentLevel === null) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <Gauge className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Nenhum registro hoje</p>
        <p className="text-[10px] font-mono text-muted-foreground/60 mt-1">Use o termômetro para começar</p>
      </div>
    );
  }

  const zone = getZone(currentLevel);
  const avgZone = getZone(todayAvg);

  return (
    <div className={`rounded-xl border ${zone.borderColor} ${zone.bgColor} p-4 transition-all duration-300`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Gauge className={`w-4 h-4 ${zone.textColor}`} />
          <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">Score Atual</span>
        </div>
        <span className={`text-[10px] font-mono font-bold ${zone.textColor} uppercase`}>{zone.displayLabel}</span>
      </div>

      <div className="flex items-end gap-4">
        <motion.div
          className="text-5xl font-mono font-extrabold text-foreground tabular-nums"
          key={currentLevel}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {currentLevel}
        </motion.div>

        <div className="flex-1 space-y-1 pb-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-mono text-muted-foreground">
              Média: <span className={`font-bold ${avgZone.textColor}`}>{todayAvg}</span>
            </span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground">{todayCount} registros hoje</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: zone.color }}
          animate={{ width: `${currentLevel}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        />
      </div>
    </div>
  );
}

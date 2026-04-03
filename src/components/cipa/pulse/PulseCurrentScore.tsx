/**
 * CIPA Pulse — Current Score (Health App Ring Design)
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
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
      <div className="rounded-2xl bg-card border border-border/50 p-6 text-center">
        <div className="w-20 h-20 mx-auto mb-3 rounded-full border-4 border-dashed border-muted-foreground/20 flex items-center justify-center">
          <span className="text-2xl text-muted-foreground/30">—</span>
        </div>
        <p className="text-sm font-semibold text-foreground">Registre seu estado agora</p>
        <p className="text-xs text-muted-foreground mt-1">Use o termômetro abaixo para iniciar</p>
      </div>
    );
  }

  const zone = getZone(currentLevel);
  const avgZone = getZone(todayAvg);
  const ringPercent = currentLevel;
  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference - (circumference * ringPercent) / 100;

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-5">
      <div className="flex items-center gap-5">
        {/* Ring */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="6"
              opacity={0.3}
            />
            <motion.circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke={zone.color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ type: "spring", stiffness: 60, damping: 15 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-3xl font-bold text-foreground tabular-nums leading-none"
              key={currentLevel}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.15 }}
            >
              {currentLevel}
            </motion.span>
            <span className="text-[9px] text-muted-foreground mt-0.5">/100</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 space-y-2">
          <div>
            <span
              className={`inline-block text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${zone.bgColor} ${zone.textColor}`}
            >
              {zone.displayLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>
              Média: <span className={`font-bold ${avgZone.textColor}`}>{todayAvg}</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{todayCount} registro{todayCount !== 1 ? "s" : ""} hoje</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 bg-border/20 rounded-full overflow-hidden">
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

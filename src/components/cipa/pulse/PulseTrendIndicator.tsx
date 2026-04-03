/**
 * CIPA Pulse — Trend Indicator (Phase 2)
 * Visual display of trend direction, acceleration and cooldown
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Thermometer, Zap, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateTrend, type TrendResult } from "./PulseTrendEngine";

const DIRECTION_CONFIG = {
  subida_rapida: { icon: TrendingUp, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  estavel: { icon: Minus, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  queda: { icon: TrendingDown, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  sem_dados: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border" },
};

export default function PulseTrendIndicator() {
  const [trend, setTrend] = useState<TrendResult | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const load = async () => {
      const { data: logs } = await supabase
        .from("emotion_logs" as any)
        .select("manual_level, created_at")
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59.999`)
        .order("created_at", { ascending: true });

      if (logs && logs.length >= 2) {
        setTrend(calculateTrend(logs as any[]));
      } else {
        setTrend(null);
      }
    };

    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!trend) {
    return (
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground/30" />
          <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">Tendência</span>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono mt-1">Mínimo 2 registros necessários</p>
      </div>
    );
  }

  const config = DIRECTION_CONFIG[trend.direction];
  const DirIcon = config.icon;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-3 transition-all duration-300`}>
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">Tendência</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Direction */}
        <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-background/50">
          <motion.div
            key={trend.directionIcon}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <DirIcon className={`w-5 h-5 ${config.color}`} />
          </motion.div>
          <span className={`text-[10px] font-mono font-bold ${config.color}`}>
            {trend.directionLabel}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            {trend.delta > 0 ? "+" : ""}{trend.delta} pts
          </span>
        </div>

        {/* Acceleration */}
        <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-background/50">
          <Zap className={`w-5 h-5 ${
            trend.acceleration > 5 ? "text-red-400" :
            trend.acceleration < -5 ? "text-blue-400" :
            "text-muted-foreground/50"
          }`} />
          <span className="text-[10px] font-mono font-bold text-foreground">
            {trend.accelerationLabel}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            {trend.acceleration > 0 ? "+" : ""}{trend.acceleration}
          </span>
        </div>

        {/* Cooldown */}
        <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-background/50">
          <Timer className={`w-5 h-5 ${
            trend.avgCooldownMinutes !== null && trend.avgCooldownMinutes < 10 ? "text-emerald-400" :
            trend.avgCooldownMinutes !== null && trend.avgCooldownMinutes < 30 ? "text-yellow-400" :
            trend.avgCooldownMinutes !== null ? "text-red-400" :
            "text-muted-foreground/50"
          }`} />
          <span className="text-[10px] font-mono font-bold text-foreground">
            {trend.avgCooldownMinutes !== null ? `${trend.avgCooldownMinutes}m` : "—"}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">Cooldown</span>
        </div>
      </div>
    </div>
  );
}

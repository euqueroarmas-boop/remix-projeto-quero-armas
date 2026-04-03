/**
 * CIPA Pulse — Trend Indicator (Health App Card)
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Zap, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateTrend, type TrendResult } from "./PulseTrendEngine";

const DIRECTION_CONFIG = {
  subida_rapida: { icon: TrendingUp, color: "text-red-400", bg: "bg-red-500/10" },
  estavel: { icon: Minus, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  queda: { icon: TrendingDown, color: "text-blue-400", bg: "bg-blue-500/10" },
  sem_dados: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted/30" },
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
      <div className="rounded-2xl bg-card border border-border/50 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-full bg-muted/30 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground/40" />
          </div>
          <span className="text-xs font-bold text-foreground">Tendência</span>
        </div>
        <p className="text-[10px] text-muted-foreground">Mínimo 2 registros necessários</p>
      </div>
    );
  }

  const config = DIRECTION_CONFIG[trend.direction];
  const DirIcon = config.icon;

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-3 transition-all duration-300">
      <div className="flex items-center gap-2 mb-2.5">
        <div className={`w-7 h-7 rounded-full ${config.bg} flex items-center justify-center`}>
          <motion.div
            key={trend.directionIcon}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <DirIcon className={`w-3.5 h-3.5 ${config.color}`} />
          </motion.div>
        </div>
        <div>
          <span className={`text-xs font-bold ${config.color}`}>{trend.directionLabel}</span>
          <span className="text-[9px] text-muted-foreground ml-1.5">
            {trend.delta > 0 ? "+" : ""}{trend.delta} pts
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 bg-muted/20 rounded-lg px-2 py-1.5">
          <Zap className={`w-3 h-3 ${
            trend.acceleration > 5 ? "text-red-400" :
            trend.acceleration < -5 ? "text-blue-400" :
            "text-muted-foreground/40"
          }`} />
          <div>
            <p className="text-[10px] font-bold text-foreground">{trend.accelerationLabel}</p>
            <p className="text-[8px] text-muted-foreground">Aceleração</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-muted/20 rounded-lg px-2 py-1.5">
          <Timer className={`w-3 h-3 ${
            trend.avgCooldownMinutes !== null && trend.avgCooldownMinutes < 10 ? "text-emerald-400" :
            trend.avgCooldownMinutes !== null && trend.avgCooldownMinutes < 30 ? "text-yellow-400" :
            trend.avgCooldownMinutes !== null ? "text-red-400" :
            "text-muted-foreground/40"
          }`} />
          <div>
            <p className="text-[10px] font-bold text-foreground">
              {trend.avgCooldownMinutes !== null ? `${trend.avgCooldownMinutes}m` : "—"}
            </p>
            <p className="text-[8px] text-muted-foreground">Cooldown</p>
          </div>
        </div>
      </div>
    </div>
  );
}

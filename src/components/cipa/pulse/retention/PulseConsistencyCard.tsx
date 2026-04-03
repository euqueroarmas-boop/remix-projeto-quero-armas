/**
 * CIPA Pulse — Consistency Score Card (Phase 10, Module 7)
 * Shows usage consistency as a percentage
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { getStreak, type StreakData } from "./PulseStreakService";

export default function PulseConsistencyCard() {
  const [streak, setStreak] = useState<StreakData | null>(null);

  useEffect(() => {
    getStreak().then(setStreak);
    const handle = () => getStreak().then(setStreak);
    window.addEventListener("pulse-streak-update", handle);
    return () => window.removeEventListener("pulse-streak-update", handle);
  }, []);

  if (!streak || streak.total_days_logged === 0) return null;

  const score = Math.min(streak.consistency_score, 100);

  const getColor = (s: number) => {
    if (s >= 70) return { bar: "bg-emerald-400", text: "text-emerald-400", label: "Excelente" };
    if (s >= 40) return { bar: "bg-yellow-400", text: "text-yellow-400", label: "Regular" };
    return { bar: "bg-red-400", text: "text-red-400", label: "Baixa" };
  };

  const c = getColor(score);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-mono font-bold text-foreground uppercase tracking-wider">
          Consistência Emocional
        </span>
        <span className={`text-[10px] font-mono font-bold ml-auto ${c.text}`}>{c.label}</span>
      </div>

      <div className="flex items-center gap-3">
        <motion.span
          className="text-2xl font-mono font-extrabold text-foreground tabular-nums"
          key={score}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
        >
          {score}%
        </motion.span>

        <div className="flex-1">
          <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${c.bar}`}
              animate={{ width: `${score}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
            />
          </div>
          <p className="text-[9px] font-mono text-muted-foreground mt-1">
            {streak.total_days_logged} dias monitorados
          </p>
        </div>
      </div>
    </div>
  );
}

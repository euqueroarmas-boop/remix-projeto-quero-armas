/**
 * CIPA Pulse — Streak Counter Card (Phase 10, Module 1)
 * Displays consecutive days of emotional logging
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, Trophy, Target } from "lucide-react";
import { getStreak, type StreakData } from "./PulseStreakService";

const MILESTONES = [7, 14, 30, 60, 90];

export default function PulseStreakCard() {
  const [streak, setStreak] = useState<StreakData | null>(null);

  useEffect(() => {
    getStreak().then(setStreak);
    const handle = () => getStreak().then(setStreak);
    window.addEventListener("pulse-streak-update", handle);
    return () => window.removeEventListener("pulse-streak-update", handle);
  }, []);

  if (!streak) return null;

  const nextMilestone = MILESTONES.find(m => m > streak.current_streak) || 100;
  const progress = Math.min((streak.current_streak / nextMilestone) * 100, 100);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        {/* Streak fire icon */}
        <motion.div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            streak.current_streak > 0
              ? "bg-orange-500/10 border-2 border-orange-500/30"
              : "bg-muted/30 border-2 border-border"
          }`}
          animate={streak.current_streak >= 7 ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Flame className={`w-5 h-5 ${streak.current_streak > 0 ? "text-orange-400" : "text-muted-foreground/40"}`} />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-mono font-extrabold text-foreground tabular-nums">
              {streak.current_streak}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {streak.current_streak === 1 ? "dia seguido" : "dias seguidos"}
            </span>
          </div>

          {/* Progress to next milestone */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-border/30 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-orange-400/60"
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
              />
            </div>
            <div className="flex items-center gap-0.5">
              <Target className="w-2.5 h-2.5 text-muted-foreground/50" />
              <span className="text-[9px] font-mono text-muted-foreground/50">{nextMilestone}d</span>
            </div>
          </div>

          {/* Record */}
          <div className="flex items-center gap-1 mt-1">
            <Trophy className="w-2.5 h-2.5 text-yellow-500/60" />
            <span className="text-[9px] font-mono text-muted-foreground">
              Recorde: {streak.longest_streak}d
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

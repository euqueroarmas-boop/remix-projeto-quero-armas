/**
 * CIPA Pulse — Insight Card (Phase 9, Module 4)
 * Displays automated insight from emotional data
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Moon, Sun, TrendingUp, Clock } from "lucide-react";
import { generateInitialInsight, type PulseInsight } from "./generateInitialInsight";

const ICON_MAP: Record<string, React.ReactNode> = {
  moon: <Moon className="w-4 h-4 text-indigo-400" />,
  sun: <Sun className="w-4 h-4 text-yellow-400" />,
  "trending-up": <TrendingUp className="w-4 h-4 text-orange-400" />,
  clock: <Clock className="w-4 h-4 text-blue-400" />,
};

export default function PulseInsightCard() {
  const [insight, setInsight] = useState<PulseInsight | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    generateInitialInsight().then(setInsight);
  }, []);

  if (!insight || !visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-xl border border-primary/20 bg-primary/5 p-3"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Lightbulb className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {ICON_MAP[insight.icon]}
            <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider">Insight</span>
          </div>
          <p className="text-xs font-mono text-foreground/80 leading-relaxed">
            {insight.text}
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-muted-foreground/40 hover:text-muted-foreground text-xs"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
}

/**
 * CIPA Pulse — Progress Insight (Phase 10, Module 5)
 * Generates comparative insights vs yesterday/trend
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PulseProgressInsight() {
  const [insight, setInsight] = useState<{ text: string; trend: "up" | "down" | "stable" } | null>(null);

  useEffect(() => {
    const generate = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);

      const [{ data: todayLogs }, { data: yLogs }] = await Promise.all([
        supabase
          .from("emotion_logs" as any)
          .select("manual_level")
          .gte("created_at", `${today}T00:00:00`)
          .lt("created_at", `${today}T23:59:59.999`),
        supabase
          .from("emotion_logs" as any)
          .select("manual_level")
          .gte("created_at", `${yStr}T00:00:00`)
          .lt("created_at", `${yStr}T23:59:59.999`),
      ]);

      if (!todayLogs || todayLogs.length === 0 || !yLogs || yLogs.length === 0) return;

      const avg = (arr: any[]) => Math.round(arr.reduce((a, b) => a + b.manual_level, 0) / arr.length);
      const todayAvg = avg(todayLogs as any[]);
      const yAvg = avg(yLogs as any[]);
      const diff = todayAvg - yAvg;

      if (diff < -5) {
        setInsight({ text: "Hoje você está mais estável que ontem", trend: "down" });
      } else if (diff > 5) {
        setInsight({ text: "Atenção: tendência de subida detectada", trend: "up" });
      } else {
        setInsight({ text: "Seu padrão está estável", trend: "stable" });
      }
    };

    generate();
    const handle = () => generate();
    window.addEventListener("pulse-streak-update", handle);
    return () => window.removeEventListener("pulse-streak-update", handle);
  }, []);

  if (!insight) return null;

  const colors = {
    down: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
    up: "text-orange-400 border-orange-500/20 bg-orange-500/5",
    stable: "text-blue-400 border-blue-400/20 bg-blue-400/5",
  };

  const Icon = insight.trend === "down" ? TrendingDown : insight.trend === "up" ? TrendingUp : Minus;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`rounded-lg border p-2 flex items-center gap-2 ${colors[insight.trend]}`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="text-[10px] font-mono text-foreground/80">{insight.text}</span>
    </motion.div>
  );
}

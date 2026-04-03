/**
 * CIPA Pulse — Daily Mission Card (Phase 10, Module 2)
 * Shows a daily goal to drive engagement
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PulseDailyMission() {
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const check = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("emotion_logs" as any)
        .select("id")
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59.999`)
        .eq("data_mode", "real")
        .limit(1);

      setCompleted(!!(data && data.length > 0));
    };

    check();
    const handle = () => check();
    window.addEventListener("pulse-streak-update", handle);
    return () => window.removeEventListener("pulse-streak-update", handle);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-3 transition-all duration-300 ${
        completed
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-primary/20 bg-primary/5"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {completed ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </motion.div>
        ) : (
          <Circle className="w-5 h-5 text-primary/50" />
        )}

        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-primary/60" />
            <span className="text-[10px] font-mono font-bold text-foreground uppercase tracking-wider">
              Missão de hoje
            </span>
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">
            {completed
              ? "Missão concluída ✔"
              : "Registre seu estado emocional hoje"}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * CIPA Pulse — Engagement Alert (Phase 10, Module 3)
 * Shows banner when user hasn't logged today
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PulseEngagementAlert() {
  const [showAlert, setShowAlert] = useState(false);
  const [alertType, setAlertType] = useState<"reminder" | "trend">("reminder");

  useEffect(() => {
    const check = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const hour = new Date().getHours();

      // Only show after 10am
      if (hour < 10) { setShowAlert(false); return; }

      const { data } = await supabase
        .from("emotion_logs" as any)
        .select("id")
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59.999`)
        .eq("data_mode", "real")
        .limit(1);

      if (!data || data.length === 0) {
        // Check yesterday's trend
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);
        const { data: yLogs } = await supabase
          .from("emotion_logs" as any)
          .select("manual_level")
          .gte("created_at", `${yStr}T00:00:00`)
          .lt("created_at", `${yStr}T23:59:59.999`)
          .limit(10);

        if (yLogs && yLogs.length > 0) {
          const avg = (yLogs as any[]).reduce((a, b) => a + b.manual_level, 0) / yLogs.length;
          setAlertType(avg > 50 ? "trend" : "reminder");
        }
        setShowAlert(true);
      } else {
        setShowAlert(false);
      }
    };

    check();
    const handle = () => check();
    window.addEventListener("pulse-streak-update", handle);
    return () => window.removeEventListener("pulse-streak-update", handle);
  }, []);

  if (!showAlert) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className={`rounded-xl border p-2.5 ${
        alertType === "trend"
          ? "border-orange-500/20 bg-orange-500/5"
          : "border-blue-400/20 bg-blue-400/5"
      }`}
    >
      <div className="flex items-center gap-2">
        {alertType === "trend" ? (
          <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
        ) : (
          <Bell className="w-4 h-4 text-blue-400 flex-shrink-0" />
        )}
        <p className="text-[10px] font-mono text-foreground/80">
          {alertType === "trend"
            ? "Seu padrão indica possível tensão agora. Registre para acompanhar."
            : "Você ainda não registrou hoje. Mantenha sua sequência!"}
        </p>
      </div>
    </motion.div>
  );
}

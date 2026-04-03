/**
 * CIPA Pulse — Watch Button "Estou Esquentando" (Phase 3)
 * Quick panic button that registers an instant peak event
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onTriggered?: () => void;
}

const SESSION_ID = `panic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function PulseWatchButton({ onTriggered }: Props) {
  const [fired, setFired] = useState(false);
  const [pressing, setPressing] = useState(false);

  const handleFire = useCallback(async () => {
    if (fired) return;
    setFired(true);

    try {
      // Log high emotion
      await supabase.from("emotion_logs" as any).insert({
        manual_level: 90,
        status_label: "conflito",
        session_id: SESSION_ID,
        bio_source: "panic_button",
      });

      // Create immediate event
      const now = new Date().toISOString();
      await supabase.from("emotion_events" as any).insert({
        started_at: now,
        peak_level: 90,
        ended_at: now,
        duration_minutes: 0,
        conflict_flag: true,
      });

      onTriggered?.();
    } catch (e) {
      console.error("[PulseWatch] fire failed:", e);
    }

    // Reset after 5s
    setTimeout(() => setFired(false), 5000);
  }, [fired, onTriggered]);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <motion.button
          onTouchStart={() => setPressing(true)}
          onTouchEnd={() => { setPressing(false); handleFire(); }}
          onMouseDown={() => setPressing(true)}
          onMouseUp={() => { setPressing(false); handleFire(); }}
          onMouseLeave={() => setPressing(false)}
          whileTap={{ scale: 0.92 }}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
            fired
              ? "bg-emerald-500/20 border-2 border-emerald-500/40"
              : pressing
              ? "bg-red-500/30 border-2 border-red-500/60 shadow-lg shadow-red-500/20"
              : "bg-red-500/10 border-2 border-red-500/30"
          }`}
          disabled={fired}
        >
          <AnimatePresence mode="wait">
            {fired ? (
              <motion.div
                key="check"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
              >
                <Check className="w-6 h-6 text-emerald-400" />
              </motion.div>
            ) : (
              <motion.div
                key="flame"
                animate={pressing ? { scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] } : {}}
                transition={{ duration: 0.3, repeat: pressing ? Infinity : 0 }}
              >
                <Flame className="w-6 h-6 text-red-400" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pulse ring when pressing */}
          {pressing && !fired && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-red-500/40"
              animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </motion.button>

        <div className="flex-1">
          <p className="text-xs font-mono font-bold text-foreground">
            {fired ? "Registrado!" : "Estou esquentando"}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {fired
              ? "Evento de pico salvo"
              : "Toque para registrar tensão imediata"}
          </p>
        </div>
      </div>
    </div>
  );
}

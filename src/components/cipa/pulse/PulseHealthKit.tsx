/**
 * CIPA Pulse — HealthKit Interface (Phase 3)
 * Placeholder for future native HealthKit integration
 * Currently provides manual bio input UI
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Activity, Moon, Watch, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_ID = `bio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

interface Props {
  onBioUpdate?: (bio: { heartRate?: number; hrv?: number; sleepScore?: number }) => void;
}

export default function PulseHealthKit({ onBioUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [heartRate, setHeartRate] = useState("");
  const [hrv, setHrv] = useState("");
  const [sleepScore, setSleepScore] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const hr = heartRate ? parseInt(heartRate) : undefined;
    const h = hrv ? parseFloat(hrv) : undefined;
    const ss = sleepScore ? parseInt(sleepScore) : undefined;

    if (!hr && !h && !ss) return;

    try {
      await supabase.from("emotion_logs" as any).insert({
        manual_level: 0,
        status_label: "calmo",
        session_id: SESSION_ID,
        heart_rate: hr || null,
        hrv: h || null,
        sleep_score: ss || null,
        bio_source: "manual_input",
      });

      onBioUpdate?.({ heartRate: hr, hrv: h, sleepScore: ss });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error("[HealthKit] save failed:", e);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3"
      >
        <div className="flex items-center gap-2">
          <Watch className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">Dados Biológicos</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground/60 uppercase">Manual</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="px-3 pb-3 space-y-2"
        >
          <p className="text-[10px] font-mono text-muted-foreground">
            Insira dados do Apple Watch ou manualmente. Integração nativa em breve.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {/* Heart Rate */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground uppercase">
                <Heart className="w-3 h-3 text-red-400" />
                BPM
              </label>
              <input
                type="number"
                placeholder="72"
                value={heartRate}
                onChange={e => setHeartRate(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* HRV */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground uppercase">
                <Activity className="w-3 h-3 text-blue-400" />
                VFC
              </label>
              <input
                type="number"
                placeholder="45"
                value={hrv}
                onChange={e => setHrv(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Sleep */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground uppercase">
                <Moon className="w-3 h-3 text-indigo-400" />
                Sono
              </label>
              <input
                type="number"
                placeholder="80"
                value={sleepScore}
                onChange={e => setSleepScore(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            className={`w-full py-2 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider transition-all ${
              saved
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
            }`}
          >
            {saved ? "✓ Salvo" : "Registrar Dados"}
          </button>
        </motion.div>
      )}
    </div>
  );
}

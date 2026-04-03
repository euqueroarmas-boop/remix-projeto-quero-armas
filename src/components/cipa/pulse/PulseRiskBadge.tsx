/**
 * CIPA Pulse — Risk Badge (Health App Card)
 */

import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { predictRisk, type PredictionResult } from "./PulsePredictionEngine";

const RISK_STYLES: Record<string, { bg: string; text: string; border: string; icon: typeof ShieldAlert }> = {
  baixo: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", icon: ShieldCheck },
  moderado: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20", icon: ShieldAlert },
  alto: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", icon: ShieldAlert },
  critico: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", icon: ShieldAlert },
};

export default function PulseRiskBadge() {
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data } = await supabase
          .from("emotion_logs" as any)
          .select("manual_level, created_at")
          .gte("created_at", `${today}T00:00:00`)
          .order("created_at", { ascending: true });

        if (!mounted) return;

        if (data && data.length > 0) {
          const readings = (data as any[]).map(d => d.manual_level as number);
          const timestamps = (data as any[]).map(d => d.created_at as string);
          setPrediction(predictRisk(readings, timestamps));
        } else {
          setPrediction(predictRisk([]));
        }
      } catch (e) {
        console.error("[PulseRiskBadge] load failed:", e);
      }
    }

    load();
    const handler = () => { load(); };
    window.addEventListener("pulse-chemical-update", handler);
    return () => {
      mounted = false;
      window.removeEventListener("pulse-chemical-update", handler);
    };
  }, []);

  if (!prediction) return null;

  const style = RISK_STYLES[prediction.riskLevel] || RISK_STYLES.baixo;
  const Icon = style.icon;

  return (
    <div className={`rounded-2xl bg-card border border-border/50 overflow-hidden transition-all`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 text-left"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`w-7 h-7 rounded-full ${style.bg} flex items-center justify-center`}>
            <Icon className={`w-3.5 h-3.5 ${style.text}`} />
          </div>
          <span className={`text-xs font-bold ${style.text}`}>{prediction.riskLabel}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Brain className="w-2.5 h-2.5" />
          <span>Previsão: ~{prediction.predictedNext}</span>
          {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
          {prediction.factors.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Fatores</span>
              {prediction.factors.map((f, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${f.impact >= 10 ? "bg-red-500" : f.impact >= 5 ? "bg-yellow-500" : "bg-emerald-500"}`} />
                    <span className="text-[10px]">{f.name}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground">{f.impact > 0 ? "+" : ""}{f.impact}</span>
                </div>
              ))}
            </div>
          )}
          <div className="bg-muted/30 rounded-xl p-2.5">
            <span className="text-[10px] leading-relaxed">{prediction.recommendation}</span>
          </div>
        </div>
      )}
    </div>
  );
}

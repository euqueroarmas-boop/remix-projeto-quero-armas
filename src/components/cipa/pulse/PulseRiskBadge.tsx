/**
 * CIPA Pulse — Risk Badge (Phase 7)
 * Visual badge showing predicted risk level with expandable details
 */

import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { predictRisk, type PredictionResult } from "./PulsePredictionEngine";

const RISK_STYLES: Record<string, { bg: string; text: string; border: string; icon: typeof ShieldAlert }> = {
  baixo: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/30", icon: ShieldCheck },
  moderado: { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/30", icon: ShieldAlert },
  alto: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30", icon: ShieldAlert },
  critico: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30", icon: ShieldAlert },
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

    // Refresh on new readings
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
    <div className={`${style.bg} border ${style.border} rounded-lg overflow-hidden transition-all`}>
      {/* Badge header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${style.text}`} />
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-mono font-bold ${style.text}`}>{prediction.riskLabel}</span>
              <span className="text-[9px] font-mono text-muted-foreground">
                ({prediction.riskScore}/100)
              </span>
            </div>
            <div className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
              <Brain className="w-2.5 h-2.5" />
              Previsão próxima leitura: ~{prediction.predictedNext}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {prediction.confidence > 0 && (
            <span className="text-[8px] font-mono text-muted-foreground">
              {Math.round(prediction.confidence * 100)}% conf.
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-border/30 pt-2">
          {/* Factors */}
          {prediction.factors.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-wider">Fatores</span>
              {prediction.factors.map((f, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${f.impact >= 10 ? "bg-red-500" : f.impact >= 5 ? "bg-yellow-500" : "bg-green-500"}`}
                    />
                    <span className="text-[10px] font-mono">{f.name}</span>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    {f.impact > 0 ? "+" : ""}{f.impact}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendation */}
          <div className="bg-background/50 rounded p-2">
            <span className="text-[10px] font-mono leading-relaxed">{prediction.recommendation}</span>
          </div>
        </div>
      )}
    </div>
  );
}

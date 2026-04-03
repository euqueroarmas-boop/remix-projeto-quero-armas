/**
 * CIPA Pulse — Chemical Indicator (Phase 4)
 * Visual display of accumulated stress and irritation levels
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Beaker, TrendingUp, RotateCcw } from "lucide-react";
import { createChemicalState, getChemicalSummary, resetChemicalState, type ChemicalState } from "./PulseChemicalEngine";

const LEVEL_CONFIG = {
  baixo: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", barColor: "hsl(152, 69%, 45%)" },
  moderado: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", barColor: "hsl(45, 93%, 55%)" },
  alto: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", barColor: "hsl(25, 95%, 53%)" },
  critico: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", barColor: "hsl(0, 72%, 51%)" },
};

export default function PulseChemicalIndicator() {
  const [state, setState] = useState<ChemicalState>(() => createChemicalState());

  // Refresh every 30s to show decay
  useEffect(() => {
    const interval = setInterval(() => {
      setState(createChemicalState());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for storage changes (from logger)
  useEffect(() => {
    const handler = () => setState(createChemicalState());
    window.addEventListener("storage", handler);
    window.addEventListener("pulse-chemical-update", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("pulse-chemical-update", handler);
    };
  }, []);

  const summary = getChemicalSummary(state);
  const config = LEVEL_CONFIG[summary.level];

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-3 transition-all duration-300`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Beaker className={`w-4 h-4 ${config.color}`} />
          <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">Motor Químico</span>
        </div>
        <button
          onClick={() => {
            resetChemicalState();
            setState(createChemicalState());
          }}
          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          title="Resetar acúmulo"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Stress Accumulated */}
        <div className="p-2 rounded-lg bg-background/50">
          <p className="text-[9px] font-mono text-muted-foreground uppercase mb-1">Estresse Acumulado</p>
          <div className="flex items-end gap-1">
            <span className={`text-lg font-mono font-extrabold ${config.color} tabular-nums`}>
              {summary.acumulado.toFixed(0)}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground mb-0.5">/100</span>
          </div>
          <div className="mt-1.5 h-1 bg-border/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: config.barColor }}
              animate={{ width: `${summary.acumulado}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Irritation Base */}
        <div className="p-2 rounded-lg bg-background/50">
          <p className="text-[9px] font-mono text-muted-foreground uppercase mb-1">Irritação Base</p>
          <div className="flex items-end gap-1">
            <span className={`text-lg font-mono font-extrabold ${config.color} tabular-nums`}>
              {summary.irritacao.toFixed(0)}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground mb-0.5">/50</span>
          </div>
          <div className="mt-1.5 h-1 bg-border/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: config.barColor }}
              animate={{ width: `${(summary.irritacao / 50) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
        <TrendingUp className={`w-3 h-3 ${config.color}`} />
        <span className={`text-[10px] font-mono font-bold ${config.color}`}>{summary.label}</span>
        <span className="text-[9px] font-mono text-muted-foreground ml-auto">{state.peakCount} picos</span>
        <span className="text-[9px] font-mono text-muted-foreground">decay 5%/h</span>
      </div>
    </div>
  );
}

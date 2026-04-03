/**
 * CIPA Pulse — Dashboard (Phase 1)
 * Main dashboard combining all Pulse components
 */

import PulseThermometer from "./PulseThermometer";
import PulseCurrentScore from "./PulseCurrentScore";
import PulseDailyChart from "./PulseDailyChart";
import PulseHeatmap from "./PulseHeatmap";
import { usePulseLogger } from "./usePulseLogger";

interface Props {
  onConflict?: () => void;
}

export default function PulseDashboard({ onConflict }: Props) {
  const { logEmotion } = usePulseLogger(onConflict);

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-mono font-bold text-primary uppercase tracking-[0.15em]">CIPA Pulse</span>
        <span className="text-[10px] font-mono text-muted-foreground ml-auto">Análise Emocional</span>
      </div>

      {/* Current Score */}
      <PulseCurrentScore />

      {/* Thermometer */}
      <PulseThermometer onRelease={logEmotion} />

      {/* Daily Chart */}
      <PulseDailyChart />

      {/* Monthly Heatmap */}
      <PulseHeatmap />
    </div>
  );
}

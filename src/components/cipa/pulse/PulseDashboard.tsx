/**
 * CIPA Pulse — Dashboard (Phase 1 + 2 + 3 + 4 + 5 + 6 + 7 + 9)
 * Main dashboard combining all Pulse components
 */

import { useState, useCallback } from "react";
import PulseThermometer from "./PulseThermometer";
import PulseCurrentScore from "./PulseCurrentScore";
import PulseDailyChart from "./PulseDailyChart";
import PulseHeatmap from "./PulseHeatmap";
import PulseTrendIndicator from "./PulseTrendIndicator";
import PulseWatchButton from "./PulseWatchButton";
import PulseHealthKit from "./PulseHealthKit";
import PulseChemicalIndicator from "./PulseChemicalIndicator";
import PulseStatistics from "./PulseStatistics";
import PulseWeeklyBars from "./PulseWeeklyBars";
import PulseRiskBadge from "./PulseRiskBadge";
import { usePulseLogger } from "./usePulseLogger";
import { isFirstSession } from "./onboarding/PulseFirstAccess";
import { incrementRealCount } from "./onboarding/PulseFirstAccess";
import PulseOnboardingModal from "./onboarding/PulseOnboardingModal";
import PulseInsightCard from "./onboarding/PulseInsightCard";
import PulseDataModeBadge from "./onboarding/PulseDataModeBadge";

interface Props {
  onConflict?: () => void;
}

export default function PulseDashboard({ onConflict }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(() => isFirstSession());
  const [refreshKey, setRefreshKey] = useState(0);

  const handleOnboardingComplete = useCallback((_score: number) => {
    setShowOnboarding(false);
    setRefreshKey(k => k + 1);
  }, []);

  const { logEmotion } = usePulseLogger(onConflict);

  const handleLogEmotion = useCallback((level: number) => {
    incrementRealCount();
    window.dispatchEvent(new Event("pulse-real-data"));
    logEmotion(level);
  }, [logEmotion]);

  return (
    <div className="space-y-2.5" key={refreshKey}>
      {/* Onboarding Modal (Phase 9) */}
      <PulseOnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />

      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-mono font-bold text-primary uppercase tracking-[0.15em]">CIPA Pulse</span>
        <div className="ml-auto flex items-center gap-2">
          <PulseDataModeBadge />
          <span className="text-[10px] font-mono text-muted-foreground">Análise Emocional</span>
        </div>
      </div>

      {/* Insight Card (Phase 9) */}
      <PulseInsightCard />

      {/* Current Score */}
      <PulseCurrentScore />

      {/* Risk Prediction Badge (Phase 7) */}
      <PulseRiskBadge />

      {/* Trend Indicator (Phase 2) */}
      <PulseTrendIndicator />

      {/* Panic Button (Phase 3) */}
      <PulseWatchButton onTriggered={onConflict} />

      {/* Thermometer */}
      <PulseThermometer onRelease={handleLogEmotion} />

      {/* Chemical Engine (Phase 4) */}
      <PulseChemicalIndicator />

      {/* Bio Data Input (Phase 3) */}
      <PulseHealthKit />

      {/* Daily Chart */}
      <PulseDailyChart />

      {/* Weekly Bars (Phase 6) */}
      <PulseWeeklyBars />

      {/* Monthly Heatmap */}
      <PulseHeatmap />

      {/* Monthly Statistics (Phase 5) */}
      <PulseStatistics />
    </div>
  );
}

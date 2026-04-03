/**
 * CIPA Pulse — Dashboard (Phase 1 + 2 + 3 + 4 + 5 + 6 + 7 + 9 + 10)
 * Main dashboard combining all Pulse components
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
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
import { isFirstSession, incrementRealCount } from "./onboarding/PulseFirstAccess";
import PulseOnboardingModal from "./onboarding/PulseOnboardingModal";
import PulseInsightCard from "./onboarding/PulseInsightCard";
import PulseDataModeBadge from "./onboarding/PulseDataModeBadge";
import PulseStreakCard from "./retention/PulseStreakCard";
import PulseDailyMission from "./retention/PulseDailyMission";
import PulseEngagementAlert from "./retention/PulseEngagementAlert";
import PulseProgressInsight from "./retention/PulseProgressInsight";
import PulseConsistencyCard from "./retention/PulseConsistencyCard";
import { updateStreak } from "./retention/PulseStreakService";

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

  const handleLogEmotion = useCallback(async (level: number) => {
    incrementRealCount();
    window.dispatchEvent(new Event("pulse-real-data"));
    await logEmotion(level);

    // Update streak (Phase 10)
    await updateStreak();
    window.dispatchEvent(new Event("pulse-streak-update"));

    // Feedback toast (Phase 10, Module 4)
    toast.success("Estado emocional atualizado", {
      description: `Nível ${level} registrado`,
      duration: 2000,
    });
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

      {/* Engagement Alert (Phase 10) */}
      <PulseEngagementAlert />

      {/* Daily Mission (Phase 10) */}
      <PulseDailyMission />

      {/* Insight Card (Phase 9) */}
      <PulseInsightCard />

      {/* Progress Insight (Phase 10) */}
      <PulseProgressInsight />

      {/* Current Score */}
      <PulseCurrentScore />

      {/* Streak Counter (Phase 10) */}
      <PulseStreakCard />

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

      {/* Consistency Score (Phase 10) */}
      <PulseConsistencyCard />

      {/* Monthly Statistics (Phase 5) */}
      <PulseStatistics />
    </div>
  );
}

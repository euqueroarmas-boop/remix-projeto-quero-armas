/**
 * CIPA Pulse — Dashboard (Phase 1–10 + UX Reorganization)
 * Two-level layout: Level 1 always visible, Level 2 collapsed
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ChevronDown, FlaskConical } from "lucide-react";
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
import VoiceTensionAnalyzer from "../VoiceTensionAnalyzer";

interface Props {
  onConflict?: () => void;
}

export default function PulseDashboard({ onConflict }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(() => isFirstSession());
  const [refreshKey, setRefreshKey] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleOnboardingComplete = useCallback((_score: number) => {
    setShowOnboarding(false);
    setRefreshKey(k => k + 1);
  }, []);

  const { logEmotion } = usePulseLogger(onConflict);

  const handleLogEmotion = useCallback(async (level: number) => {
    incrementRealCount();
    window.dispatchEvent(new Event("pulse-real-data"));
    await logEmotion(level);
    await updateStreak();
    window.dispatchEvent(new Event("pulse-streak-update"));
    toast.success("Estado emocional atualizado", {
      description: `Nível ${level} registrado`,
      duration: 2000,
    });
  }, [logEmotion]);

  return (
    <div className="space-y-2.5" key={refreshKey}>
      {/* Onboarding Modal */}
      <PulseOnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />

      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-mono font-bold text-primary uppercase tracking-[0.15em]">CIPA Pulse</span>
        <div className="ml-auto flex items-center gap-2">
          <PulseDataModeBadge />
        </div>
      </div>

      {/* Engagement Alert */}
      <PulseEngagementAlert />

      {/* Daily Mission */}
      <PulseDailyMission />

      {/* Main Insight (max 1 visible) */}
      <PulseInsightCard />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           NÍVEL 1 — SEMPRE VISÍVEL
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      {/* 1. Score Atual */}
      <PulseCurrentScore />

      {/* 2. Risco */}
      <PulseRiskBadge />

      {/* 3. Tendência */}
      <PulseTrendIndicator />

      {/* 4. Botão "Estou Esquentando" */}
      <PulseWatchButton onTriggered={onConflict} />

      {/* Termômetro */}
      <PulseThermometer onRelease={handleLogEmotion} />

      {/* 5. Pulse Diário */}
      <PulseDailyChart />

      {/* 6. Últimos 7 dias */}
      <PulseWeeklyBars />

      {/* 7. Heatmap */}
      <PulseHeatmap />

      {/* 8. Estatísticas Mensais */}
      <PulseStatistics />

      {/* Streak & Consistency */}
      <PulseStreakCard />
      <PulseProgressInsight />
      <PulseConsistencyCard />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           NÍVEL 2 — COLAPSADO POR PADRÃO
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setAdvancedOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
              Análise Avançada
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`}
          />
        </button>

        {advancedOpen && (
          <div className="px-4 pb-4 space-y-2.5 border-t border-border pt-3">
            {/* Análise de Tensão Vocal */}
            <VoiceTensionAnalyzer />

            {/* Dados Biológicos */}
            <PulseHealthKit />

            {/* Chemical Engine */}
            <PulseChemicalIndicator />
          </div>
        )}
      </div>
    </div>
  );
}

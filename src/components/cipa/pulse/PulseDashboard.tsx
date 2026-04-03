/**
 * CIPA Pulse — Dashboard (Apple Health–inspired)
 * Clean sections, ring score, generous spacing, muted palette
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ChevronRight, RotateCcw } from "lucide-react";
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

/* ── Apple Health–style Section ── */
const HealthSection = ({
  title,
  color = "text-primary",
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  color?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2.5">
      <button
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        className={`flex items-center justify-between w-full px-1 ${collapsible ? "cursor-pointer" : "cursor-default"}`}
      >
        <h2 className={`text-[15px] font-semibold tracking-tight ${color}`}>{title}</h2>
        {collapsible && (
          <ChevronRight
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          />
        )}
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  );
};

export default function PulseDashboard({ onConflict }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(() => isFirstSession());
  const [refreshKey, setRefreshKey] = useState(0);

  const handleOnboardingComplete = useCallback((_score: number) => {
    setShowOnboarding(false);
    setRefreshKey(k => k + 1);
  }, []);

  const { logEmotion, clearDayLogs } = usePulseLogger(onConflict);

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

  const handleReset = useCallback(async () => {
    await clearDayLogs();
    setRefreshKey(k => k + 1);
    toast.success("Pulse resetado", { description: "Dados do dia limpos", duration: 2000 });
  }, [clearDayLogs]);

  return (
    <div className="space-y-5 pb-4" key={refreshKey}>
      {/* Onboarding Modal */}
      <PulseOnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />

      {/* ── Header (Apple Health style) ── */}
      <div className="px-1">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="text-2xl font-bold text-foreground tracking-tight mt-0.5">Pulse</h1>
          </div>
          <PulseDataModeBadge />
        </div>
      </div>

      {/* ── Alerts (contextual, only show when needed) ── */}
      <PulseEngagementAlert />
      <PulseDailyMission />
      <PulseInsightCard />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESUMO — Score + Risco + Tendência
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <HealthSection title="Resumo" color="text-primary">
        <PulseCurrentScore />
        <div className="grid grid-cols-2 gap-2">
          <PulseRiskBadge />
          <PulseTrendIndicator />
        </div>
      </HealthSection>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           REGISTRAR — Termômetro + Pânico
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <HealthSection title="Registrar" color="text-red-400">
        <PulseThermometer onRelease={handleLogEmotion} />
        <PulseWatchButton onTriggered={onConflict} />
      </HealthSection>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           ATIVIDADE — Charts diários/semanais
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <HealthSection title="Atividade" color="text-cyan-400">
        <PulseDailyChart />
        <PulseWeeklyBars />
        <PulseHeatmap />
      </HealthSection>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           TENDÊNCIAS — Stats + Progresso
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <HealthSection title="Tendências" color="text-purple-400">
        <PulseStatistics />
        <PulseStreakCard />
        <PulseProgressInsight />
        <PulseConsistencyCard />
      </HealthSection>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           ANÁLISE AVANÇADA — Colapsada
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <HealthSection title="Análise Avançada" color="text-orange-400" collapsible defaultOpen={false}>
        <VoiceTensionAnalyzer />
        <PulseHealthKit />
        <PulseChemicalIndicator />
      </HealthSection>
    </div>
  );
}

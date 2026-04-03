/**
 * CIPA Pulse — Dashboard (Health App Design)
 * Premium card-based layout with generous spacing
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { RotateCcw, ChevronDown } from "lucide-react";
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

/* ── Card wrapper — Apple Health style ── */
const HealthCard = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`rounded-2xl bg-card border border-border/50 p-4 ${className}`}>
    {children}
  </div>
);

/* ── Section title ── */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-sm font-semibold text-foreground tracking-tight px-1">{children}</h2>
);

/* ── Collapsible section ── */
const CollapsibleSection = ({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-1"
      >
        <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="space-y-3">{children}</div>}
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

  const { logEmotion, clearAllPulse } = usePulseLogger(onConflict);

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
    await clearAllPulse();
    setRefreshKey(k => k + 1);
    toast.success("Pulse resetado", { description: "Todos os dados foram limpos", duration: 2000 });
  }, [clearAllPulse]);

  return (
    <div className="space-y-6 pb-6" key={refreshKey}>
      {/* Onboarding Modal */}
      <PulseOnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />

      {/* ── Header ── */}
      <div className="px-1 pt-1">
        <p className="text-xs text-muted-foreground font-medium">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Pulse</h1>
          <div className="flex items-center gap-2">
            <PulseDataModeBadge />
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-xs font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Resetar
            </button>
          </div>
        </div>
      </div>

      {/* ── Alerts ── */}
      <PulseEngagementAlert />
      <PulseDailyMission />
      <PulseInsightCard />

      {/* ━━━ SCORE ATUAL ━━━ */}
      <PulseCurrentScore />

      {/* ━━━ SCORE + RISCO ━━━ */}
      <div className="grid grid-cols-2 gap-3">
        <PulseRiskBadge />
        <PulseTrendIndicator />
      </div>

      {/* ━━━ REGISTRAR ━━━ */}
      <div className="space-y-3">
        <SectionLabel>Registrar</SectionLabel>
        <PulseThermometer onRelease={handleLogEmotion} />
        <PulseWatchButton onTriggered={onConflict} />
      </div>

      {/* ━━━ ATIVIDADE ━━━ */}
      <div className="space-y-3">
        <SectionLabel>Atividade</SectionLabel>
        <HealthCard><PulseDailyChart /></HealthCard>
        <HealthCard><PulseWeeklyBars /></HealthCard>
        <HealthCard><PulseHeatmap /></HealthCard>
      </div>

      {/* ━━━ TENDÊNCIAS ━━━ */}
      <div className="space-y-3">
        <SectionLabel>Tendências</SectionLabel>
        <HealthCard><PulseStatistics /></HealthCard>
        <div className="grid grid-cols-2 gap-3">
          <PulseStreakCard />
          <PulseConsistencyCard />
        </div>
        <PulseProgressInsight />
      </div>

      {/* ━━━ ANÁLISE AVANÇADA ━━━ */}
      <CollapsibleSection title="Análise Avançada" defaultOpen={false}>
        <HealthCard><VoiceTensionAnalyzer /></HealthCard>
        <HealthCard><PulseHealthKit /></HealthCard>
        <HealthCard><PulseChemicalIndicator /></HealthCard>
      </CollapsibleSection>
    </div>
  );
}

/**
 * CIPA Pulse — Onboarding Modal (Phase 9, Module 3)
 * Quick questionnaire for initial emotional calibration
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Moon, Zap, ArrowRight, Check } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getStatusLabel } from "../PulseScoreEngine";
import { markInitialized } from "./PulseFirstAccess";
import { generateInitialDataset } from "./generateInitialDataset";

interface Props {
  open: boolean;
  onComplete: (score: number) => void;
}

interface Question {
  icon: React.ReactNode;
  title: string;
  options: { label: string; emoji: string; value: number }[];
}

const QUESTIONS: Question[] = [
  {
    icon: <Heart className="w-5 h-5 text-red-400" />,
    title: "Como foi seu dia hoje?",
    options: [
      { label: "Tranquilo", emoji: "😌", value: 15 },
      { label: "Moderado", emoji: "😐", value: 40 },
      { label: "Tenso", emoji: "😤", value: 70 },
    ],
  },
  {
    icon: <Moon className="w-5 h-5 text-indigo-400" />,
    title: "Como você dormiu?",
    options: [
      { label: "Bem", emoji: "😴", value: -10 },
      { label: "Médio", emoji: "😑", value: 0 },
      { label: "Mal", emoji: "😩", value: 15 },
    ],
  },
  {
    icon: <Zap className="w-5 h-5 text-yellow-400" />,
    title: "Seu nível de energia agora?",
    options: [
      { label: "Alto", emoji: "⚡", value: -5 },
      { label: "Médio", emoji: "🔋", value: 5 },
      { label: "Baixo", emoji: "🪫", value: 10 },
    ],
  },
];

const SESSION_ID = `onb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function PulseOnboardingModal({ open, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finishing, setFinishing] = useState(false);

  const handleSelect = useCallback(async (value: number) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      setFinishing(true);

      // Calculate initial score
      const baseScore = newAnswers[0];
      const modifier = newAnswers.slice(1).reduce((a, b) => a + b, 0);
      const finalScore = Math.max(0, Math.min(100, baseScore + modifier));

      try {
        // Generate historical dataset
        await generateInitialDataset();

        // Register onboarding score
        await supabase.from("emotion_logs" as any).insert({
          manual_level: finalScore,
          status_label: getStatusLabel(finalScore),
          session_id: SESSION_ID,
          bio_source: "onboarding",
          data_mode: "real",
          source_type: "manual",
        });

        markInitialized();

        setTimeout(() => {
          onComplete(finalScore);
        }, 1200);
      } catch (e) {
        console.error("[Onboarding] save failed:", e);
        markInitialized();
        onComplete(finalScore);
      }
    }
  }, [answers, step, onComplete]);

  const currentQ = QUESTIONS[step];
  const progress = ((step + (finishing ? 1 : 0)) / QUESTIONS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden border-primary/20">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="text-center space-y-1.5">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-base font-bold text-foreground font-mono">
              Vamos entender seu padrão emocional
            </h2>
            <p className="text-xs text-muted-foreground font-mono">
              Leva menos de 10 segundos
            </p>
          </div>

          {/* Progress */}
          <div className="h-1 bg-border/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
            />
          </div>

          {/* Question */}
          <AnimatePresence mode="wait">
            {!finishing ? (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  {currentQ.icon}
                  <span className="text-sm font-mono font-bold text-foreground">
                    {currentQ.title}
                  </span>
                </div>

                <div className="space-y-2">
                  {currentQ.options.map((opt) => (
                    <motion.button
                      key={opt.label}
                      onClick={() => handleSelect(opt.value)}
                      whileTap={{ scale: 0.97 }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
                    >
                      <span className="text-xl">{opt.emoji}</span>
                      <span className="text-sm font-mono text-foreground">{opt.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4 space-y-3"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                  className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto"
                >
                  <Check className="w-7 h-7 text-emerald-400" />
                </motion.div>
                <p className="text-sm font-mono font-bold text-foreground">Calibrado!</p>
                <p className="text-xs font-mono text-muted-foreground">
                  Preparando sua análise emocional...
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step indicator */}
          {!finishing && (
            <div className="flex items-center justify-center gap-1.5">
              {QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                    i <= step ? "bg-primary" : "bg-border"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Activity, Shield, AlertTriangle, Zap, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceCapture } from "./useVoiceCapture";
import { updateVoiceDailyStats } from "./useVoiceDailyAggregator";
import {
  updateBaseline,
  calculateVoiceTension,
  getBaseline,
  isBaselineReady,
  type VoiceFeatures,
} from "./voiceBaselineEngine";

const SESSION_ID = `vs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function tensionZone(score: number) {
  if (score <= 20) return { label: "Calma", icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
  if (score <= 40) return { label: "Normal", icon: Activity, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" };
  if (score <= 60) return { label: "Elevada", icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" };
  if (score <= 80) return { label: "Alta", icon: Zap, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" };
  return { label: "Crítica", icon: Zap, color: "text-red-500", bg: "bg-red-500/15", border: "border-red-500/40" };
}

export default function VoiceTensionAnalyzer() {
  const [tensionScore, setTensionScore] = useState(0);
  const [angerProb, setAngerProb] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [baselineReady, setBaselineReady] = useState(isBaselineReady());
  const [sampleCount, setSampleCount] = useState(getBaseline()?.sampleCount || 0);
  const lastLogRef = useRef<number>(0);

  const handleFeatures = useCallback(async (features: VoiceFeatures) => {
    const baseline = updateBaseline(features);
    setSampleCount(baseline.sampleCount);
    setBaselineReady(baseline.sampleCount >= 5);

    if (baseline.sampleCount >= 5) {
      const result = calculateVoiceTension(features, baseline);
      setTensionScore(result.tensionScore);
      setAngerProb(result.angerProbability);
      setConfidence(result.confidence);

      const now = Date.now();
      if (now - lastLogRef.current >= 10000) {
        lastLogRef.current = now;
        const dayKey = new Date().toISOString().slice(0, 10);
        try {
          await supabase.from("voice_emotion_logs" as any).insert({
            day_key: dayKey,
            session_id: SESSION_ID,
            voice_energy: features.energy,
            pitch_mean: features.pitchMean,
            pitch_variation: features.pitchVariation,
            speech_rate_estimate: features.speechRate,
            tension_score: result.tensionScore,
            anger_probability_estimate: result.angerProbability,
            confidence_score: result.confidence,
            source: "voice_analysis",
          });
          updateVoiceDailyStats(dayKey);
        } catch {}
      }
    }
  }, []);

  const { isListening, start, stop, error, rawEnergy } = useVoiceCapture(handleFeatures);

  const zone = tensionZone(tensionScore);
  const ZoneIcon = zone.icon;
  const energyPercent = Math.min(100, rawEnergy);
  const isCapturing = isListening && rawEnergy > 0.3;
  const isCalibrating = isListening && !baselineReady;

  return (
    <div className={`rounded-2xl border ${isListening ? zone.border : "border-border"} ${isListening ? zone.bg : "bg-card"} p-4 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Mic className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
            Análise de Tensão Vocal
          </span>
        </div>
        {isListening && (
          <div className="flex items-center gap-1">
            {isCapturing && (
              <Volume2 className="w-3 h-3 text-emerald-400 animate-pulse" />
            )}
            <span className={`text-[8px] font-mono ${isCapturing ? "text-emerald-400" : "text-muted-foreground/50"}`}>
              {baselineReady 
                ? "analisando" 
                : `calibrando (${sampleCount}/5)`}
            </span>
          </div>
        )}
      </div>

      {/* Live audio level bar — visible whenever listening */}
      {isListening && (
        <div className="mb-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-mono text-muted-foreground">Nível do microfone</span>
            <span className="text-[8px] font-mono text-muted-foreground tabular-nums">{energyPercent.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: energyPercent > 50 
                  ? "hsl(var(--destructive))" 
                  : energyPercent > 10 
                    ? "hsl(45 90% 55%)" 
                    : "hsl(var(--muted-foreground))",
              }}
              animate={{ width: `${energyPercent}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          {isCalibrating && (
            <p className="text-[9px] font-mono text-muted-foreground/70 leading-snug">
              Fale normalmente por alguns segundos para calibrar seu padrão vocal individual.
            </p>
          )}
        </div>
      )}

      {/* Main toggle + score */}
      <div className="flex items-center gap-4">
        {/* Toggle button */}
        <button
          onClick={isListening ? stop : start}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
            isListening
              ? "bg-red-500/20 border-2 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
              : "bg-muted border-2 border-border hover:border-primary/30"
          }`}
        >
          {isListening && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-red-500/30"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          {isListening ? (
            <MicOff className="w-5 h-5 text-red-400 relative z-10" />
          ) : (
            <Mic className="w-5 h-5 text-muted-foreground relative z-10" />
          )}
        </button>

        {/* Score display */}
        <div className="flex-1">
          {isListening ? (
            <AnimatePresence mode="wait">
              {isCalibrating ? (
                <motion.div
                  key="calibrating"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1"
                >
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-blue-400">Calibrando...</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <motion.div 
                      className="h-full rounded-full bg-blue-400"
                      animate={{ width: `${(sampleCount / 5) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-[9px] font-mono text-muted-foreground">
                    {sampleCount === 0 
                      ? "Aguardando sua voz..."
                      : `${sampleCount} de 5 amostras coletadas`}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={Math.floor(tensionScore / 10)}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1"
                >
                  <div className="flex items-center gap-1.5">
                    <ZoneIcon className={`w-3.5 h-3.5 ${zone.color}`} />
                    <span className={`text-xs font-mono font-bold ${zone.color}`}>{zone.label}</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-mono font-extrabold text-foreground tabular-nums">
                      {tensionScore.toFixed(0)}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground mb-0.5">/100</span>
                  </div>
                  <div className="flex gap-2 text-[8px] font-mono text-muted-foreground">
                    <span>Raiva: {angerProb.toFixed(0)}%</span>
                    <span>•</span>
                    <span>Confiança: {confidence}%</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-mono text-foreground/70">
                {error ? "Erro no microfone" : "Toque para ativar"}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                Fale normalmente. O app aprende seu padrão e detecta tensão por desvio vocal. Nenhum áudio é gravado.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tension bar — only after calibration */}
      {isListening && baselineReady && (
        <div className="mt-3 flex gap-0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-full"
              style={{ height: 3, background: i < tensionScore / 5 ? `hsl(${Math.max(0, 120 - tensionScore * 1.2)} 70% 50%)` : "hsl(var(--border))" }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, delay: i * 0.04, repeat: Infinity }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

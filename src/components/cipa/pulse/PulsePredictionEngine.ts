/**
 * CIPA Pulse — Prediction Engine (Phase 7)
 * Local prediction based on historical patterns, trends, and peak frequency
 * No external AI — pure mathematical model
 */

export interface PredictionResult {
  riskLevel: "baixo" | "moderado" | "alto" | "critico";
  riskLabel: string;
  riskScore: number; // 0-100
  predictedNext: number; // predicted score for next period
  confidence: number; // 0-1
  factors: PredictionFactor[];
  recommendation: string;
}

interface PredictionFactor {
  name: string;
  impact: number; // -50 to +50
  description: string;
}

/**
 * Predict risk based on recent readings history
 */
export function predictRisk(readings: number[], timestamps?: string[]): PredictionResult {
  if (readings.length === 0) {
    return emptyPrediction();
  }

  const factors: PredictionFactor[] = [];
  let riskScore = 0;

  // 1. Recent average (last 5 readings) — weight 30%
  const recent = readings.slice(-5);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const avgImpact = (recentAvg / 100) * 30;
  riskScore += avgImpact;
  factors.push({
    name: "Média Recente",
    impact: Math.round(avgImpact),
    description: `Média das últimas ${recent.length} leituras: ${Math.round(recentAvg)}`,
  });

  // 2. Trend direction (last 3 readings) — weight 20%
  if (readings.length >= 3) {
    const last3 = readings.slice(-3);
    const trendDelta = last3[2] - last3[0];
    const trendImpact = Math.max(-20, Math.min(20, (trendDelta / 100) * 40));
    riskScore += Math.max(0, trendImpact);
    factors.push({
      name: "Tendência",
      impact: Math.round(trendImpact),
      description: trendDelta > 10 ? "Subindo rapidamente" : trendDelta > 0 ? "Subindo levemente" : trendDelta < -10 ? "Caindo rapidamente" : "Estável ou caindo",
    });
  }

  // 3. Peak frequency (readings >= 70 in last 10) — weight 20%
  const last10 = readings.slice(-10);
  const peakCount = last10.filter(r => r >= 70).length;
  const peakRatio = peakCount / Math.max(1, last10.length);
  const peakImpact = peakRatio * 20;
  riskScore += peakImpact;
  factors.push({
    name: "Frequência de Picos",
    impact: Math.round(peakImpact),
    description: `${peakCount} picos nas últimas ${last10.length} leituras`,
  });

  // 4. Volatility (standard deviation) — weight 15%
  if (readings.length >= 3) {
    const mean = readings.slice(-10).reduce((a, b) => a + b, 0) / Math.min(readings.length, 10);
    const variance = readings.slice(-10).reduce((s, v) => s + Math.pow(v - mean, 2), 0) / Math.min(readings.length, 10);
    const stdDev = Math.sqrt(variance);
    const volImpact = Math.min(15, (stdDev / 30) * 15);
    riskScore += volImpact;
    factors.push({
      name: "Volatilidade",
      impact: Math.round(volImpact),
      description: stdDev > 20 ? "Alta instabilidade" : stdDev > 10 ? "Moderada" : "Estável",
    });
  }

  // 5. Time-of-day pattern (if timestamps provided) — weight 15%
  if (timestamps && timestamps.length >= 3) {
    const lastHour = new Date(timestamps[timestamps.length - 1]).getHours();
    // Afternoon (14-18) tends to have higher stress
    const timeImpact = (lastHour >= 14 && lastHour <= 18) ? 8 : (lastHour >= 10 && lastHour <= 13) ? 5 : 2;
    riskScore += timeImpact;
    factors.push({
      name: "Padrão Horário",
      impact: timeImpact,
      description: lastHour >= 14 ? "Período de maior risco (tarde)" : "Período regular",
    });
  }

  // Clamp
  riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));

  // Predicted next reading (weighted projection)
  const predictedNext = Math.round(Math.min(100, Math.max(0,
    recentAvg * 0.6 + (readings.length >= 2 ? readings[readings.length - 1] * 0.4 : recentAvg * 0.4)
  )));

  // Confidence based on data quantity
  const confidence = Math.min(1, readings.length / 20);

  // Risk level
  const { level, label } = getRiskLevel(riskScore);

  // Recommendation
  const recommendation = getRecommendation(level, factors);

  return {
    riskLevel: level,
    riskLabel: label,
    riskScore,
    predictedNext,
    confidence: Math.round(confidence * 100) / 100,
    factors,
    recommendation,
  };
}

function getRiskLevel(score: number): { level: PredictionResult["riskLevel"]; label: string } {
  if (score >= 75) return { level: "critico", label: "Risco Crítico" };
  if (score >= 50) return { level: "alto", label: "Risco Alto" };
  if (score >= 25) return { level: "moderado", label: "Risco Moderado" };
  return { level: "baixo", label: "Risco Baixo" };
}

function getRecommendation(level: PredictionResult["riskLevel"], factors: PredictionFactor[]): string {
  const highestFactor = factors.reduce((a, b) => Math.abs(a.impact) > Math.abs(b.impact) ? a : b, factors[0]);

  switch (level) {
    case "critico":
      return "⚠️ Intervenção recomendada. Pausa e respiração profunda agora.";
    case "alto":
      return `Atenção elevada. Principal fator: ${highestFactor?.name || "múltiplos"}. Considere uma pausa.`;
    case "moderado":
      return "Monitoramento ativo. Mantenha atenção aos gatilhos.";
    case "baixo":
      return "Ambiente estável. Continue monitorando normalmente.";
  }
}

function emptyPrediction(): PredictionResult {
  return {
    riskLevel: "baixo",
    riskLabel: "Sem Dados",
    riskScore: 0,
    predictedNext: 0,
    confidence: 0,
    factors: [],
    recommendation: "Registre leituras para ativar a previsão.",
  };
}

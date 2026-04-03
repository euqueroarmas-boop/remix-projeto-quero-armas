/**
 * CIPA Pulse — Initial Insight Generator (Phase 9, Module 4)
 * Generates automatic insights from available data
 */

import { supabase } from "@/integrations/supabase/client";

export interface PulseInsight {
  text: string;
  type: "pattern" | "peak" | "recovery" | "time";
  icon: "moon" | "sun" | "trending-up" | "clock";
}

export async function generateInitialInsight(): Promise<PulseInsight | null> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: logs } = await supabase
      .from("emotion_logs" as any)
      .select("manual_level, created_at")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: true });

    if (!logs || logs.length < 3) return null;

    const entries = logs as any[];

    // Analyze by period
    const periods = { morning: [] as number[], afternoon: [] as number[], night: [] as number[] };
    entries.forEach((e: any) => {
      const hour = new Date(e.created_at).getHours();
      if (hour >= 6 && hour < 12) periods.morning.push(e.manual_level);
      else if (hour >= 12 && hour < 18) periods.afternoon.push(e.manual_level);
      else periods.night.push(e.manual_level);
    });

    const avgOf = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const morningAvg = avgOf(periods.morning);
    const afternoonAvg = avgOf(periods.afternoon);
    const nightAvg = avgOf(periods.night);

    // Find highest tension period
    const maxPeriod = Math.max(morningAvg, afternoonAvg, nightAvg);

    if (maxPeriod === nightAvg && nightAvg > 30) {
      return {
        text: "Seu padrão indica maior tensão no período noturno. Considere técnicas de relaxamento antes de dormir.",
        type: "time",
        icon: "moon",
      };
    }

    if (maxPeriod === afternoonAvg && afternoonAvg > 30) {
      return {
        text: "Picos de tensão concentrados à tarde. Pausas regulares podem ajudar a manter o equilíbrio.",
        type: "time",
        icon: "sun",
      };
    }

    // Check for consecutive high days
    const dayMap = new Map<string, number[]>();
    entries.forEach((e: any) => {
      const day = new Date(e.created_at).toISOString().slice(0, 10);
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(e.manual_level);
    });

    const dailyAvgs = Array.from(dayMap.values()).map(avgOf);
    let consecutive = 0;
    let maxConsecutive = 0;
    dailyAvgs.forEach(avg => {
      if (avg > 40) { consecutive++; maxConsecutive = Math.max(maxConsecutive, consecutive); }
      else consecutive = 0;
    });

    if (maxConsecutive >= 2) {
      return {
        text: "Você tende a acumular estresse após dias consecutivos. Priorize o descanso entre jornadas intensas.",
        type: "pattern",
        icon: "trending-up",
      };
    }

    // Average recovery
    const avgLevel = avgOf(entries.map((e: any) => e.manual_level));
    return {
      text: `Seu nível médio é ${avgLevel}. Continue monitorando para identificar gatilhos recorrentes.`,
      type: "recovery",
      icon: "clock",
    };
  } catch (e) {
    console.error("[PulseInsight] generation failed:", e);
    return null;
  }
}

import { supabase } from "@/integrations/supabase/client";

export async function updateMonthlyStats(monthKey: string) {
  try {
    // Get all daily stats for this month
    const { data: dailyStats } = await supabase
      .from("cipa_stress_daily_stats" as any)
      .select("*")
      .like("day_key", `${monthKey}%`)
      .order("day_key", { ascending: true });

    if (!dailyStats || dailyStats.length === 0) return;

    const days = dailyStats as any[];
    const totalDays = days.length;

    const monthlyAverage = days.reduce((s, d) => s + (d.weighted_average || 0), 0) / totalDays;
    const maxPeak = Math.max(...days.map(d => d.max_value || 0));
    const highRiskDays = days.filter(d => (d.daily_conflict_risk || 0) >= 60).length;
    const nearFightEvents = days.reduce((s, d) => s + (d.near_fight_events_count || 0), 0);
    const fightEvents = days.reduce((s, d) => s + (d.fight_events_count || 0), 0);
    const stableDays = days.filter(d => (d.daily_conflict_risk || 0) <= 30).length;
    const stableDaysPercent = (stableDays / totalDays) * 100;
    const avgCooldown = days.reduce((s, d) => s + (d.cooldown_efficiency_score || 0), 0) / totalDays;

    // Monthly stability score
    const stabilityScore = Math.max(0, Math.min(100,
      100
      - (monthlyAverage * 0.35)
      - (highRiskDays * 2.5)
      - (nearFightEvents * 3)
      - (fightEvents * 6)
    ));

    // Month-over-month variation
    const prevMonth = getPreviousMonth(monthKey);
    let variation = 0;
    const { data: prevData } = await supabase
      .from("cipa_stress_monthly_stats" as any)
      .select("monthly_stability_score")
      .eq("month_key", prevMonth)
      .single();
    if (prevData) {
      variation = stabilityScore - ((prevData as any).monthly_stability_score || 0);
    }

    await supabase.from("cipa_stress_monthly_stats" as any).upsert({
      month_key: monthKey,
      monthly_average: Math.round(monthlyAverage * 10) / 10,
      max_peak: maxPeak,
      high_risk_days: highRiskDays,
      near_fight_events: nearFightEvents,
      fight_events: fightEvents,
      stable_days_percent: Math.round(stableDaysPercent * 10) / 10,
      average_cooldown_time: Math.round(avgCooldown * 10) / 10,
      monthly_stability_score: Math.round(stabilityScore * 10) / 10,
      month_over_month_variation: Math.round(variation * 10) / 10,
      updated_at: new Date().toISOString(),
    }, { onConflict: "month_key" });
  } catch (e) {
    console.error("[MonthlyAggregator] failed:", e);
  }
}

function getPreviousMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * CIPA Pulse — Monthly Heatmap (Phase 1)
 * Color-coded grid showing daily emotion intensity
 */

import { useState, useEffect, useMemo } from "react";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getZone } from "./PulseScoreEngine";

interface DayData {
  day: number;
  avgLevel: number;
  count: number;
}

export default function PulseHeatmap() {
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [currentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    const load = async () => {
      const startDate = new Date(currentMonth.year, currentMonth.month, 1).toISOString().slice(0, 10);
      const endDate = new Date(currentMonth.year, currentMonth.month + 1, 0).toISOString().slice(0, 10);

      const { data: logs } = await supabase
        .from("emotion_logs" as any)
        .select("manual_level, created_at")
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59.999`)
        .order("created_at", { ascending: true });

      if (logs) {
        const byDay = new Map<number, number[]>();
        (logs as any[]).forEach(l => {
          const day = new Date(l.created_at).getDate();
          if (!byDay.has(day)) byDay.set(day, []);
          byDay.get(day)!.push(l.manual_level);
        });

        const result: DayData[] = [];
        byDay.forEach((values, day) => {
          const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
          result.push({ day, avgLevel: avg, count: values.length });
        });
        setMonthData(result);
      }
    };

    load();
  }, [currentMonth]);

  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString("pt-BR", { month: "long" });

  const dayMap = useMemo(() => {
    const map = new Map<number, DayData>();
    monthData.forEach(d => map.set(d.day, d));
    return map;
  }, [monthData]);

  const cells: (DayData | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(dayMap.get(d) || null);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-primary" />
        <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">Heatmap Emocional</span>
        <span className="text-[10px] font-mono text-muted-foreground ml-auto capitalize">{monthName}</span>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <div key={i} className="text-center text-[8px] font-mono text-muted-foreground/50">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          const dayNum = i >= firstDayOfWeek ? i - firstDayOfWeek + 1 : 0;
          if (dayNum === 0 || dayNum > daysInMonth) {
            return <div key={i} className="aspect-square" />;
          }

          const hasData = cell !== null;
          const zone = hasData ? getZone(cell.avgLevel) : null;

          return (
            <div
              key={i}
              className="aspect-square rounded-sm flex items-center justify-center relative group"
              style={{
                backgroundColor: hasData ? `${zone!.color}30` : "hsl(var(--muted) / 0.3)",
                border: hasData ? `1px solid ${zone!.color}50` : "1px solid transparent",
              }}
              title={hasData ? `Dia ${dayNum}: média ${cell.avgLevel} (${cell.count} registros)` : `Dia ${dayNum}`}
            >
              <span className={`text-[8px] font-mono ${hasData ? "text-foreground font-bold" : "text-muted-foreground/40"}`}>
                {dayNum}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {[
          { label: "Calmo", color: "hsl(152, 69%, 45%)" },
          { label: "Tensão", color: "hsl(25, 95%, 53%)" },
          { label: "Conflito", color: "hsl(0, 72%, 35%)" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: `${l.color}50` }} />
            <span className="text-[8px] font-mono text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

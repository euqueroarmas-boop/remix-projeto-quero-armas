/**
 * CIPA Pulse — Weekly Bars Chart (Phase 6)
 * Shows last 7 days of average stress as colored bars
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3 } from "lucide-react";

interface DayBar {
  label: string;
  dayKey: string;
  avg: number;
  count: number;
}

function getZoneColor(avg: number): string {
  if (avg >= 81) return "bg-red-600";
  if (avg >= 61) return "bg-orange-500";
  if (avg >= 41) return "bg-yellow-500";
  if (avg >= 21) return "bg-blue-400";
  return "bg-green-500";
}

function getZoneLabel(avg: number): string {
  if (avg >= 81) return "Conflito";
  if (avg >= 61) return "Crítico";
  if (avg >= 41) return "Tensão";
  if (avg >= 21) return "Atenção";
  return "Calmo";
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function PulseWeeklyBars() {
  const [bars, setBars] = useState<DayBar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const days: DayBar[] = [];
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dayKey = d.toISOString().slice(0, 10);
        const weekday = WEEKDAYS[d.getDay()];
        const dayNum = d.getDate();
        days.push({ label: `${weekday} ${dayNum}`, dayKey, avg: 0, count: 0 });
      }

      try {
        const startDate = `${days[0].dayKey}T00:00:00`;
        const endDate = `${days[6].dayKey}T23:59:59.999`;

        const { data } = await supabase
          .from("emotion_logs" as any)
          .select("manual_level, created_at")
          .gte("created_at", startDate)
          .lte("created_at", endDate)
          .order("created_at", { ascending: true });

        if (data) {
          for (const log of data as any[]) {
            const logDay = (log.created_at as string).slice(0, 10);
            const bar = days.find(d => d.dayKey === logDay);
            if (bar) {
              bar.avg = (bar.avg * bar.count + log.manual_level) / (bar.count + 1);
              bar.count++;
            }
          }
        }
      } catch (e) {
        console.error("[PulseWeeklyBars] load failed:", e);
      }

      if (mounted) {
        setBars(days.map(d => ({ ...d, avg: Math.round(d.avg) })));
        setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  const maxVal = Math.max(100, ...bars.map(b => b.avg));

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-mono font-bold text-primary">Últimos 7 Dias</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">Média diária</span>
      </div>

      {loading ? (
        <div className="text-[10px] text-muted-foreground animate-pulse">Carregando...</div>
      ) : (
        <div className="flex items-end gap-1.5 h-28">
          {bars.map(bar => {
            const height = bar.count > 0 ? Math.max(8, (bar.avg / maxVal) * 100) : 4;
            return (
              <div key={bar.dayKey} className="flex-1 flex flex-col items-center gap-1">
                {/* Value label */}
                {bar.count > 0 && (
                  <span className="text-[9px] font-mono font-bold">{bar.avg}</span>
                )}

                {/* Bar */}
                <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
                  <div
                    className={`w-full max-w-[28px] rounded-t ${bar.count > 0 ? getZoneColor(bar.avg) : "bg-muted/30"} transition-all duration-500`}
                    style={{ height: `${height}%` }}
                    title={bar.count > 0 ? `${getZoneLabel(bar.avg)} (${bar.avg})` : "Sem dados"}
                  />
                </div>

                {/* Day label */}
                <span className="text-[8px] font-mono text-muted-foreground leading-none">{bar.label.split(" ")[0]}</span>
                <span className="text-[8px] font-mono text-muted-foreground leading-none">{bar.label.split(" ")[1]}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-border/50">
        {[
          { color: "bg-green-500", label: "Calmo" },
          { color: "bg-blue-400", label: "Atenção" },
          { color: "bg-yellow-500", label: "Tensão" },
          { color: "bg-orange-500", label: "Crítico" },
          { color: "bg-red-600", label: "Conflito" },
        ].map(z => (
          <div key={z.label} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${z.color}`} />
            <span className="text-[8px] font-mono text-muted-foreground">{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

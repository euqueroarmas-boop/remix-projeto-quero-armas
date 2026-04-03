import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DayData {
  day_key: string;
  daily_conflict_risk: number;
}

function riskColor(risk: number): string {
  if (risk <= 20) return "bg-emerald-500/60";
  if (risk <= 40) return "bg-yellow-500/60";
  if (risk <= 60) return "bg-orange-500/60";
  if (risk <= 80) return "bg-red-500/60";
  return "bg-red-700/80";
}

export default function StressHeatmap() {
  const [days, setDays] = useState<DayData[]>([]);

  useEffect(() => {
    async function fetch() {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const { data } = await supabase
        .from("cipa_stress_daily_stats" as any)
        .select("day_key, daily_conflict_risk")
        .gte("day_key", firstDay)
        .lte("day_key", lastDay)
        .order("day_key", { ascending: true });

      if (data) setDays(data as unknown as DayData[]);
    }
    fetch();
  }, []);

  const grid = useMemo(() => {
    const now = new Date();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const firstDow = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const dayMap = new Map(days.map(d => [d.day_key, d.daily_conflict_risk]));

    const cells: { day: number; risk: number | null; key: string }[] = [];

    // Empty cells for offset
    for (let i = 0; i < firstDow; i++) {
      cells.push({ day: 0, risk: null, key: `empty-${i}` });
    }

    for (let d = 1; d <= totalDays; d++) {
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, risk: dayMap.get(key) ?? null, key });
    }

    return cells;
  }, [days]);

  const monthLabel = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl bg-card border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">Heatmap</p>
        <p className="text-[9px] font-mono text-muted-foreground/60 capitalize">{monthLabel}</p>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span key={i} className="text-[7px] font-mono text-muted-foreground/40 text-center">{d}</span>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map(cell => (
          <div
            key={cell.key}
            className={`aspect-square rounded-sm flex items-center justify-center text-[7px] font-mono ${
              cell.day === 0
                ? ""
                : cell.risk !== null
                  ? `${riskColor(cell.risk)} text-foreground/80`
                  : "bg-muted/20 text-muted-foreground/30"
            }`}
            title={cell.risk !== null ? `Risco: ${cell.risk.toFixed(0)}` : undefined}
          >
            {cell.day > 0 ? cell.day : ""}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-2 justify-center">
        {[
          { label: "Estável", cls: "bg-emerald-500/60" },
          { label: "Sensível", cls: "bg-yellow-500/60" },
          { label: "Atenção", cls: "bg-orange-500/60" },
          { label: "Alto", cls: "bg-red-500/60" },
          { label: "Crítico", cls: "bg-red-700/80" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-0.5">
            <div className={`w-2 h-2 rounded-sm ${l.cls}`} />
            <span className="text-[6px] font-mono text-muted-foreground/50">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

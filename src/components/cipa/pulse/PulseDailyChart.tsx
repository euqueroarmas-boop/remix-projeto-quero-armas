/**
 * CIPA Pulse — Daily Line Chart (Phase 1)
 * Shows emotion levels throughout the day
 */

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  manual_level: number;
  created_at: string;
}

export default function PulseDailyChart() {
  const [data, setData] = useState<{ time: string; level: number; hour: number }[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const load = async () => {
      const { data: logs } = await supabase
        .from("emotion_logs" as any)
        .select("manual_level, created_at")
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59.999`)
        .order("created_at", { ascending: true });

      if (logs && logs.length > 0) {
        const entries = (logs as unknown as LogEntry[]).map(l => {
          const d = new Date(l.created_at);
          return {
            time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            level: l.manual_level,
            hour: d.getHours(),
          };
        });
        setData(entries);
      }
    };

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">Pulse Diário</span>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono">Registre emoções para ver o gráfico</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-primary" />
        <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">Pulse Diário</span>
        <span className="text-[10px] font-mono text-muted-foreground ml-auto">{data.length} registros</span>
      </div>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={28} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
                fontFamily: "monospace",
              }}
              formatter={(val: number) => [`${val}`, "Nível"]}
            />
            <ReferenceLine y={60} stroke="hsl(25, 95%, 53%)" strokeDasharray="4 4" opacity={0.5} />
            <ReferenceLine y={81} stroke="hsl(0, 72%, 51%)" strokeDasharray="4 4" opacity={0.5} />
            <Line
              type="monotone"
              dataKey="level"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

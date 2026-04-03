import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface LogPoint {
  time: string;
  value: number;
}

export default function StressLineChart() {
  const [data, setData] = useState<LogPoint[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    async function fetch() {
      const { data: logs } = await supabase
        .from("cipa_stress_logs" as any)
        .select("created_at, value")
        .eq("day_key", today)
        .order("created_at", { ascending: true });

      if (logs) {
        setData((logs as any[]).map(l => ({
          time: new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          value: l.value,
        })));
      }
    }
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, []);

  if (data.length < 2) return null;

  return (
    <div className="rounded-xl bg-card border border-border p-3">
      <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2">
        Tensão — Hoje
      </p>
      <div style={{ width: "100%", height: 120 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="time" tick={{ fontSize: 8, fill: "hsl(0 0% 55%)" }} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: "hsl(0 0% 55%)" }} />
            <Tooltip
              contentStyle={{
                background: "hsl(0 0% 7%)",
                border: "1px solid hsl(0 0% 15%)",
                borderRadius: 8,
                fontSize: 10,
                fontFamily: "monospace",
              }}
            />
            <ReferenceLine y={81} stroke="hsl(0 72% 51%)" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={60} stroke="hsl(25 95% 53%)" strokeDasharray="3 3" strokeOpacity={0.3} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(16 100% 55%)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: "hsl(16 100% 55%)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

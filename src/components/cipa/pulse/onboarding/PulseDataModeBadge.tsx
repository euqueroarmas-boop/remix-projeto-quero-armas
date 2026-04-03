/**
 * CIPA Pulse — Data Mode Badge (Phase 9, Module 8)
 * Shows whether data is simulated, mixed, or real
 */

import { useState, useEffect } from "react";
import { Database, FlaskConical, CheckCircle2 } from "lucide-react";
import { getDataModeLabel } from "./PulseFirstAccess";

export default function PulseDataModeBadge() {
  const [mode, setMode] = useState<"simulated" | "real" | "mixed">("real");

  useEffect(() => {
    setMode(getDataModeLabel());
    const handle = () => setMode(getDataModeLabel());
    window.addEventListener("pulse-real-data", handle);
    return () => window.removeEventListener("pulse-real-data", handle);
  }, []);

  const config = {
    simulated: {
      icon: <FlaskConical className="w-3 h-3" />,
      label: "Dados simulados",
      className: "text-yellow-500/70 border-yellow-500/20 bg-yellow-500/5",
    },
    mixed: {
      icon: <Database className="w-3 h-3" />,
      label: "Dados mistos",
      className: "text-blue-400/70 border-blue-400/20 bg-blue-400/5",
    },
    real: {
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: "Dados reais",
      className: "text-emerald-400/70 border-emerald-400/20 bg-emerald-400/5",
    },
  };

  const c = config[mode];

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-mono ${c.className}`}>
      {c.icon}
      {c.label}
    </div>
  );
}

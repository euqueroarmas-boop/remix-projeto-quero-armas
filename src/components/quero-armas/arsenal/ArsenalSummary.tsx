import { ReactNode } from "react";
import { Crosshair, Layers, ShieldCheck, AlertTriangle, FileBadge, Boxes, ChevronRight } from "lucide-react";
import { TACTICAL } from "./utils";

export type ArsenalSummaryTarget = "armas" | "municoes" | "crafs" | "cr" | "calibres" | "alertas";

interface Props {
  totalArmas: number;
  totalMunicoes: number;
  totalCalibres: number;
  crStatus: "ok" | "warn" | "danger" | "muted";
  crLabel: string;
  totalCrafs: number;
  alerts: number;
  onNavigate?: (target: ArsenalSummaryTarget) => void;
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone = "cyan",
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "cyan" | "ok" | "warn" | "danger" | "steel";
  onClick?: () => void;
}) {
  const color =
    tone === "ok"
      ? TACTICAL.ok
      : tone === "warn"
      ? TACTICAL.warn
      : tone === "danger"
      ? TACTICAL.danger
      : tone === "steel"
      ? TACTICAL.steel
      : TACTICAL.cyan;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-300/50"
      style={{ boxShadow: `inset 0 0 0 1px ${color}10` }}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: `${color}14`, color }}
        >
          {icon}
        </div>
        <div
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em]"
          style={{ background: `${color}10`, color }}
        >
          KPI <ChevronRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-800 leading-none font-mono">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      {hint && <div className="mt-2 text-[10px] text-slate-400">{hint}</div>}
    </button>
  );
}

export function ArsenalSummary({
  totalArmas,
  totalMunicoes,
  totalCalibres,
  crStatus,
  crLabel,
  totalCrafs,
  alerts,
  onNavigate,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi
        icon={<Crosshair className="h-4 w-4" />}
        label="Armas"
        value={totalArmas}
        hint={totalArmas === 0 ? "Sem CRAFs cadastrados" : "Cadastradas"}
        tone="cyan"
        onClick={() => onNavigate?.("armas")}
      />
      <Kpi
        icon={<Boxes className="h-4 w-4" />}
        label="Munições"
        value={totalMunicoes.toLocaleString("pt-BR")}
        hint={totalCalibres > 0 ? `${totalCalibres} calibres` : "Sem estoque"}
        tone="steel"
        onClick={() => onNavigate?.("municoes")}
      />
      <Kpi
        icon={<FileBadge className="h-4 w-4" />}
        label="CRAFs"
        value={totalCrafs}
        hint="Vinculados ao acervo"
        tone="cyan"
        onClick={() => onNavigate?.("crafs")}
      />
      <Kpi
        icon={<ShieldCheck className="h-4 w-4" />}
        label="Status CR"
        value={crLabel}
        tone={crStatus === "muted" ? "steel" : crStatus}
        onClick={() => onNavigate?.("cr")}
      />
      <Kpi
        icon={<Layers className="h-4 w-4" />}
        label="Calibres"
        value={totalCalibres}
        hint="Diferentes em estoque"
        tone="ok"
        onClick={() => onNavigate?.("calibres")}
      />
      <Kpi
        icon={<AlertTriangle className="h-4 w-4" />}
        label="Alertas"
        value={alerts}
        hint={alerts === 0 ? "Tudo em dia" : "Vencimentos próximos"}
        tone={alerts === 0 ? "ok" : alerts > 2 ? "danger" : "warn"}
        onClick={() => onNavigate?.("alertas")}
      />
    </div>
  );
}
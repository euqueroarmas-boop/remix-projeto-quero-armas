import { cn } from "@/lib/utils";
import { LucideIcon, ArrowRight } from "lucide-react";
import { ReactNode } from "react";

// ─── MetricCard ───────────────────────────────────────────────
export function MetricCard({
  label, value, icon: Icon, trend, trendLabel, onClick, variant = "default", loading,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  onClick?: () => void;
  variant?: "default" | "success" | "danger" | "warning" | "info";
  loading?: boolean;
}) {
  const colors = {
    default: "text-foreground",
    success: "text-emerald-400",
    danger: "text-red-400",
    warning: "text-amber-400",
    info: "text-blue-400",
  };
  const bgColors = {
    default: "bg-muted/40",
    success: "bg-emerald-500/10",
    danger: "bg-red-500/10",
    warning: "bg-amber-500/10",
    info: "bg-blue-500/10",
  };
  const borderColors = {
    default: "border-border",
    success: "border-emerald-500/20",
    danger: "border-red-500/20",
    warning: "border-amber-500/20",
    info: "border-blue-500/20",
  };

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "relative group rounded-lg border p-4 text-left transition-all duration-200",
        borderColors[variant],
        "bg-card hover:bg-card/80",
        onClick && "cursor-pointer hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <p className={cn("text-2xl font-bold mt-1 font-mono tabular-nums", colors[variant])}>
            {loading ? "—" : value}
          </p>
          {trendLabel && (
            <p className={cn("text-[10px] mt-1", trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-muted-foreground")}>
              {trendLabel}
            </p>
          )}
        </div>
        <div className={cn("p-2 rounded-md shrink-0", bgColors[variant])}>
          <Icon className={cn("h-4 w-4", colors[variant], "opacity-70")} />
        </div>
      </div>
    </button>
  );
}

// ─── StatusPill ───────────────────────────────────────────────
export function StatusPill({ status, label, pulse }: { status: "online" | "degraded" | "offline" | "checking"; label?: string; pulse?: boolean }) {
  const colors = {
    online: "bg-emerald-400",
    degraded: "bg-amber-400",
    offline: "bg-red-400",
    checking: "bg-blue-400",
  };
  const textColors = {
    online: "text-emerald-400",
    degraded: "text-amber-400",
    offline: "text-red-400",
    checking: "text-blue-400",
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {(pulse || status === "checking") && <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", colors[status])} />}
        <span className={cn("relative inline-flex rounded-full h-2 w-2", colors[status])} />
      </span>
      {label && <span className={cn("text-[11px] font-medium", textColors[status])}>{label}</span>}
    </span>
  );
}

// ─── SectionHeader ────────────────────────────────────────────
export function SectionHeader({ icon: Icon, title, subtitle, actions }: { icon?: LucideIcon; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon className="h-4 w-4 text-primary shrink-0" />}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ─── MonitoringCard ───────────────────────────────────────────
export function MonitoringCard({ children, className, variant = "default", onClick }: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "alert" | "success" | "active";
  onClick?: () => void;
}) {
  const borders = {
    default: "border-border/60",
    alert: "border-red-500/30",
    success: "border-emerald-500/20",
    active: "border-blue-500/30",
  };
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card p-4 transition-all duration-200",
        borders[variant],
        onClick && "cursor-pointer hover:bg-card/80 hover:border-primary/30",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── EventRow ─────────────────────────────────────────────────
export function EventRow({ severity, message, timestamp, badge, onClick }: {
  severity: "success" | "error" | "warning" | "info";
  message: string;
  timestamp: string;
  badge?: string;
  onClick?: () => void;
}) {
  const dotColors = {
    success: "bg-emerald-400",
    error: "bg-red-400",
    warning: "bg-amber-400",
    info: "bg-blue-400",
  };
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full flex items-start gap-2.5 py-2.5 px-2 -mx-2 rounded-md text-left transition-colors",
        onClick && "hover:bg-muted/30"
      )}
    >
      <div className={cn("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", dotColors[severity])} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-foreground truncate">{message}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {badge && (
            <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border border-border bg-muted/30 text-muted-foreground">
              {badge}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground font-mono">{timestamp}</span>
        </div>
      </div>
    </button>
  );
}

// ─── QuickAction ──────────────────────────────────────────────
export function QuickAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors text-left group w-full"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{label}</span>
      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
    </button>
  );
}

// ─── DataPanel ────────────────────────────────────────────────
export function DataPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border/60 bg-card overflow-hidden", className)}>
      {children}
    </div>
  );
}

// ─── HealthBar ────────────────────────────────────────────────
export function HealthBar({ value, max = 100, variant = "default" }: { value: number; max?: number; variant?: "default" | "success" | "danger" | "warning" }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const colors = {
    default: "bg-primary",
    success: "bg-emerald-400",
    danger: "bg-red-400",
    warning: "bg-amber-400",
  };
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-out", colors[variant])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

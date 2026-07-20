/**
 * QA Operational Design System — padrão oficial do ecossistema Quero Armas.
 *
 * Inspirado no Arsenal do Cliente. TODA nova tela do Quero Armas deve nascer
 * usando estes componentes. Componentes antigos encontrados em fluxo
 * principal devem ser tratados como legado visual e migrados progressivamente
 * para cá, sem regressão.
 *
 * Paleta oficial: PRETO + VERMELHO BORDO #7A1F2B sobre papel #f6f5f1.
 * Âmbar / vermelho / esmeralda apenas em chips/alertas pontuais.
 */
import React from "react";

/* ─────────────── tones ─────────────── */
export type QATone = "neutral" | "info" | "ok" | "warn" | "danger" | "primary";

const TONE: Record<QATone, { bg: string; bd: string; fg: string; dot: string }> = {
  neutral: { bg: "#F1F5F9", bd: "#E2E8F0", fg: "#475569", dot: "#94A3B8" },
  info:    { bg: "#DBEAFE", bd: "#BFDBFE", fg: "#1E40AF", dot: "#1D4ED8" },
  ok:      { bg: "#D1FAE5", bd: "#A7F3D0", fg: "#065F46", dot: "#047857" },
  warn:    { bg: "#FEF3C7", bd: "#FDE68A", fg: "#7C2D12", dot: "#B45309" },
  danger:  { bg: "#FEE2E2", bd: "#FCA5A5", fg: "#7F1D1D", dot: "#B91C1C" },
  primary: { bg: "#FBF3F4", bd: "#E5C2C6", fg: "#7A1F2B", dot: "#7A1F2B" },
};

/* ─────────────── QAStatusChip ─────────────── */
export function QAStatusChip({
  label,
  tone = "neutral",
  icon: Icon,
  className = "",
}: {
  label: React.ReactNode;
  tone?: QATone;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}
      style={{ background: t.bg, borderColor: t.bd, color: t.fg }}
    >
      {Icon ? <Icon className="h-3 w-3" /> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.dot }} />}
      {label}
    </span>
  );
}

/* ─────────────── QAOperationalSection ─────────────── */
/** Cabeçalho de seção operacional: ícone bordô, título uppercase, status chip, ações. */
export function QAOperationalSection({
  icon: Icon,
  title,
  subtitle,
  status,
  statusTone,
  actions,
  children,
  dense,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: React.ReactNode;
  status?: React.ReactNode;
  statusTone?: QATone;
  actions?: React.ReactNode;
  children: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <section className={dense ? "space-y-1.5" : "space-y-2"}>
      <header className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
              style={{ background: "#FBF3F4", color: "#7A1F2B" }}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
          <h2
            className="text-[11px] font-bold uppercase tracking-[0.14em] truncate"
            style={{ color: "hsl(220 20% 22%)" }}
          >
            {title}
          </h2>
          {status && (
            typeof status === "string"
              ? <QAStatusChip label={status} tone={statusTone || "neutral"} />
              : status
          )}
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </header>
      {subtitle && (
        <div className="px-1 text-[11px] text-slate-500">{subtitle}</div>
      )}
      <div className={dense ? "space-y-2" : "space-y-3"}>{children}</div>
    </section>
  );
}

/* ─────────────── QAInfoCard ─────────────── */
/** Card branco com borda suave — base operacional. */
export function QAInfoCard({
  className = "",
  padding = "md",
  tone = "neutral",
  children,
}: {
  className?: string;
  padding?: "sm" | "md" | "lg" | "none";
  tone?: QATone;
  children: React.ReactNode;
}) {
  const pad =
    padding === "none" ? "" :
    padding === "sm" ? "p-3" :
    padding === "lg" ? "p-5 md:p-6" : "p-4 md:p-5";
  const accent = tone === "neutral"
    ? { borderColor: "hsl(220 13% 90%)" }
    : { borderColor: TONE[tone].bd };
  return (
    <div
      className={`rounded-xl border bg-white shadow-sm ${pad} ${className}`}
      style={accent}
    >
      {children}
    </div>
  );
}

/* ─────────────── QAMetricCard ─────────────── */
export function QAMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: QATone;
  onClick?: () => void;
}) {
  const t = TONE[tone];
  const Wrapper: any = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={`text-left rounded-xl border bg-white p-3 md:p-3.5 shadow-sm transition-colors ${onClick ? "hover:border-[#7A1F2B] hover:bg-[#FBF3F4]" : ""}`}
      style={{ borderColor: "hsl(220 13% 90%)" }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.14em]"
          style={{ color: "hsl(220 10% 50%)" }}
        >
          {label}
        </span>
        {Icon && (
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded"
            style={{ background: t.bg, color: t.fg }}
          >
            <Icon className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="text-[18px] md:text-[20px] font-bold leading-tight" style={{ color: "hsl(220 20% 18%)" }}>
        {value}
      </div>
      {hint && (
        <div className="text-[10px] mt-0.5" style={{ color: t.fg }}>{hint}</div>
      )}
    </Wrapper>
  );
}

/* ─────────────── QAActionCard ─────────────── */
/** Card operacional com título, descrição, status e ações. */
export function QAActionCard({
  title,
  description,
  status,
  statusTone,
  icon: Icon,
  actions,
  onClick,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  statusTone?: QATone;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-3 md:p-3.5 shadow-sm ${onClick ? "cursor-pointer hover:border-[#7A1F2B] hover:bg-[#FBF3F4] transition-colors" : ""}`}
      style={{ borderColor: "hsl(220 13% 90%)" }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {Icon && (
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0"
              style={{ background: "#FBF3F4", color: "#7A1F2B" }}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
          <div className="min-w-0">
            <div className="text-[12px] md:text-[13px] font-bold uppercase tracking-wide truncate" style={{ color: "hsl(220 20% 18%)" }}>
              {title}
            </div>
            {description && (
              <div className="text-[11px] text-slate-500 mt-0.5">{description}</div>
            )}
          </div>
        </div>
        {status && (
          typeof status === "string"
            ? <QAStatusChip label={status} tone={statusTone || "neutral"} />
            : status
        )}
      </div>
      {children && <div className="mt-2">{children}</div>}
      {actions && <div className="mt-2 flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}

/* ─────────────── QAAlertBlock ─────────────── */
export function QAAlertBlock({
  tone = "warn",
  title,
  icon: Icon,
  actions,
  children,
}: {
  tone?: QATone;
  title: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div
      className="rounded-xl border p-3 md:p-3.5"
      style={{ background: t.bg, borderColor: t.bd, color: t.fg }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
          <span className="text-[11px] font-bold uppercase tracking-wider truncate">{title}</span>
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </div>
      {children && <div className="text-[12px]">{children}</div>}
    </div>
  );
}

/* ─────────────── QAEmptyState ─────────────── */
export function QAEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
      {Icon && (
        <div className="mx-auto mb-2 inline-flex w-9 h-9 rounded-lg items-center justify-center" style={{ background: "#FBF3F4", color: "#7A1F2B" }}>
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="text-[12px] font-bold uppercase tracking-wider text-slate-700">{title}</div>
      {description && <div className="text-[11px] text-slate-500 mt-1">{description}</div>}
      {action && <div className="mt-3 inline-flex">{action}</div>}
    </div>
  );
}

/* ─────────────── QATimeline ─────────────── */
export interface QATimelineEvent {
  id?: string | number;
  date?: string | null;
  title: React.ReactNode;
  description?: React.ReactNode;
  origem?: React.ReactNode;
  ator?: React.ReactNode;
  tone?: QATone;
  icon?: React.ComponentType<{ className?: string }>;
  detail?: React.ReactNode;
  critical?: boolean;
}

function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch { return d || "—"; }
}

export function QATimelineItem({ event, isLast }: { event: QATimelineEvent; isLast?: boolean }) {
  const t = TONE[event.tone || "neutral"];
  const Icon = event.icon;
  return (
    <li className="relative pl-7">
      {!isLast && (
        <span
          aria-hidden
          className="absolute left-[10px] top-5 bottom-[-12px] w-px"
          style={{ background: "hsl(220 13% 90%)" }}
        />
      )}
      <span
        className={`absolute left-0 top-1 inline-flex items-center justify-center w-5 h-5 rounded-full border-2 bg-white ${event.critical ? "ring-2 ring-offset-1 ring-red-200" : ""}`}
        style={{ borderColor: t.dot, color: t.fg }}
      >
        {Icon ? <Icon className="h-2.5 w-2.5" /> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.dot }} />}
      </span>
      <div className="rounded-lg border bg-white px-3 py-2" style={{ borderColor: "hsl(220 13% 92%)" }}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "hsl(220 20% 18%)" }}>
            {event.title}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)" }}>
            {fmtDateTime(event.date)}
          </div>
        </div>
        {event.description && (
          <div className="text-[11px] text-slate-600 mt-1 leading-snug">{event.description}</div>
        )}
        {(event.origem || event.ator) && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {event.origem && <QAStatusChip label={<>Origem: {event.origem}</>} tone="info" />}
            {event.ator && <QAStatusChip label={<>Por: {event.ator}</>} tone="neutral" />}
          </div>
        )}
        {event.detail && <div className="mt-2">{event.detail}</div>}
      </div>
    </li>
  );
}

export function QATimeline({ events }: { events: QATimelineEvent[] }) {
  if (!events.length) {
    return null;
  }
  return (
    <ol className="space-y-3">
      {events.map((e, idx) => (
        <QATimelineItem key={e.id ?? idx} event={e} isLast={idx === events.length - 1} />
      ))}
    </ol>
  );
}

/* ─────────────── QAFieldRow ─────────────── */
/** Linha label/valor em UPPERCASE (regra de admin do projeto). */
export function QAFieldRow({
  label,
  value,
  icon: Icon,
  copyable,
  copyValue,
  highlight,
}: {
  label: string;
  value?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  copyable?: boolean;
  copyValue?: string;
  highlight?: boolean;
}) {
  const display = value ?? "—";
  const copyContent = copyValue ?? (typeof value === "string" ? value : "");
  return (
    <div className="flex items-start gap-2 group py-1">
      {Icon && <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />}
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-[0.14em] font-bold" style={{ color: "hsl(220 10% 50%)" }}>
          {label}
        </div>
        <div
          className="text-[12px] font-semibold uppercase break-words"
          style={{ color: highlight ? "hsl(152 60% 30%)" : "hsl(220 20% 18%)" }}
        >
          {display}
        </div>
      </div>
      {copyable && copyContent && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(copyContent);
          }}
          className="opacity-0 group-hover:opacity-100 text-[10px] uppercase font-bold text-[#7A1F2B] hover:underline"
        >
          Copiar
        </button>
      )}
    </div>
  );
}

/* ─────────────── QAFieldGrid ─────────────── */
export function QAFieldGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  const c = cols === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2";
  return <div className={`grid ${c} gap-x-4 gap-y-1`}>{children}</div>;
}
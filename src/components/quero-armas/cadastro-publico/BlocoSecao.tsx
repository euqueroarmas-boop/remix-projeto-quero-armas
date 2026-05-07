import React from "react";

/**
 * Wrapper visual para agrupar DetailCards por assunto na tela de
 * Conferência do Cadastro Público. NÃO é um substituto dos cards
 * existentes — apenas adiciona um cabeçalho de seção (ícone + título +
 * status opcional + ações) e permite que múltiplos cards convivam
 * dentro do mesmo bloco temático sem quebrar handlers atuais.
 */

export type BlocoTone = "neutral" | "warn" | "danger" | "ok" | "info";

const TONE: Record<BlocoTone, { dot: string; chip: string; chipBg: string; chipBd: string }> = {
  neutral: { dot: "#94a3b8", chip: "#475569", chipBg: "#F1F5F9", chipBd: "#E2E8F0" },
  warn:    { dot: "#B45309", chip: "#7C2D12", chipBg: "#FEF3C7", chipBd: "#FDE68A" },
  danger:  { dot: "#B91C1C", chip: "#7F1D1D", chipBg: "#FEE2E2", chipBd: "#FCA5A5" },
  ok:      { dot: "#047857", chip: "#065F46", chipBg: "#D1FAE5", chipBd: "#A7F3D0" },
  info:    { dot: "#1D4ED8", chip: "#1E40AF", chipBg: "#DBEAFE", chipBd: "#BFDBFE" },
};

export default function BlocoSecao({
  icon: Icon,
  titulo,
  statusLabel,
  statusTone = "neutral",
  acoes,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  titulo: string;
  statusLabel?: string | null;
  statusTone?: BlocoTone;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = TONE[statusTone];
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          {Icon ? (
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-md"
              style={{ background: "#FBF3F4", color: "#7A1F2B" }}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
          ) : (
            <span className="inline-block w-1.5 h-4 rounded-sm" style={{ background: "#7A1F2B" }} />
          )}
          <h2
            className="text-[11px] font-bold uppercase tracking-[0.14em] truncate"
            style={{ color: "hsl(220 20% 22%)" }}
          >
            {titulo}
          </h2>
          {statusLabel && (
            <span
              className="ml-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ color: t.chip, background: t.chipBg, borderColor: t.chipBd }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.dot }} />
              {statusLabel}
            </span>
          )}
        </div>
        {acoes && <div className="flex items-center gap-1.5 shrink-0">{acoes}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

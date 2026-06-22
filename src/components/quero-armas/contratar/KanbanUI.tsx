import type { ReactNode } from "react";

/**
 * Primitivos visuais compartilhados pelo fluxo "Contratar serviço" (cliente
 * logado e visitante): catálogo → identificar → solicitar → confirmar →
 * sucesso. Linguagem visual copiada de ResumoClienteKanbanMockPage (tag,
 * card com rodapé de status/responsável, chip de filtro, stat de resumo),
 * recolorida com as variáveis --qa-ref-* (dark premium, mesmo checkout
 * guiado em /cadastro). Requer um ancestral com a classe `qa-refinado`.
 */

export function KanbanTag({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" | "ok" | "warn" | "danger" }) {
  const map = {
    default: { bg: "var(--qa-ref-paper-2)", color: "var(--qa-ref-ink-soft)", border: "var(--qa-ref-border)" },
    accent: { bg: "var(--qa-ref-accent-soft)", color: "var(--qa-ref-accent)", border: "var(--qa-ref-accent-strong)" },
    ok: { bg: "var(--qa-ref-success-soft)", color: "var(--qa-ref-success)", border: "var(--qa-ref-success)" },
    warn: { bg: "var(--qa-ref-accent-soft)", color: "var(--qa-ref-accent)", border: "var(--qa-ref-accent-strong)" },
    danger: { bg: "rgba(185,74,72,0.12)", color: "var(--qa-ref-error)", border: "var(--qa-ref-error)" },
  } as const;
  const c = map[tone];
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
      padding: "2px 8px", borderRadius: 5, background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {children}
    </span>
  );
}

export function KanbanToolbarChip({ children, active = false, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 12px", borderRadius: 99,
        border: `1px solid ${active ? "var(--qa-ref-ink)" : "var(--qa-ref-border)"}`,
        background: active ? "var(--qa-ref-ink)" : "var(--qa-ref-paper)",
        color: active ? "var(--qa-ref-bg)" : "var(--qa-ref-ink-soft)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {children}
    </button>
  );
}

export function KanbanCard({ children }: { children: ReactNode }) {
  return (
    <article style={{
      background: "var(--qa-ref-paper-2)", border: "0.5px solid var(--qa-ref-border-soft)",
      borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8,
    }}>
      {children}
    </article>
  );
}

export function KanbanCardFooter({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      borderTop: "1px dashed var(--qa-ref-border-soft)", paddingTop: 8, marginTop: 2,
    }}>
      <span style={{ fontSize: 11, color: "var(--qa-ref-ink-soft)", display: "inline-flex", alignItems: "center", gap: 5 }}>{left}</span>
      <span style={{ fontSize: 11, color: "var(--qa-ref-ink-soft)", display: "inline-flex", alignItems: "center", gap: 6 }}>{right}</span>
    </div>
  );
}

export function KanbanAvatar({ initials }: { initials: string }) {
  return (
    <span style={{
      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
      background: "var(--qa-ref-accent)", color: "#1a1206",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 9, fontWeight: 800,
    }}>
      {initials}
    </span>
  );
}

export function KanbanSummaryStat({ label, value, small }: { label: string; value: string; small?: string }) {
  return (
    <div style={{
      background: "var(--qa-ref-paper)", border: "0.5px solid var(--qa-ref-border)",
      borderRadius: 10, padding: "10px 14px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--qa-ref-ink-soft)" }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--qa-ref-ink)", marginTop: 2, fontFamily: "var(--font-serif, Georgia, serif)" }}>
        {value}
        {small && <small style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 500, color: "var(--qa-ref-ink-soft)", marginLeft: 6 }}>{small}</small>}
      </div>
    </div>
  );
}

export function KanbanPageHeader({ crumb, title, meta, onBack }: {
  crumb: string; title: string; meta?: ReactNode; onBack?: () => void;
}) {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 10,
      background: "rgba(5,5,5,0.92)", backdropFilter: "blur(10px)",
      borderBottom: "0.5px solid var(--qa-ref-border-soft)",
      padding: "16px 20px",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--qa-ref-paper-2)", border: "0.5px solid var(--qa-ref-border)",
              color: "var(--qa-ref-ink)", cursor: "pointer",
            }}
            aria-label="Voltar"
          >
            ←
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--qa-ref-ink-soft)" }}>
            {crumb}
          </div>
          <h1 style={{
            fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em",
            color: "var(--qa-ref-ink)", margin: "2px 0 0", fontFamily: "var(--font-serif, Georgia, serif)",
          }}>
            {title}
          </h1>
          {meta && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 11, color: "var(--qa-ref-ink-soft)", marginTop: 4, flexWrap: "wrap" }}>
              {meta}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

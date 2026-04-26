import { AlertTriangle, Loader2, RefreshCcw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Estados padronizados para carregamento de telas/widgets do Quero Armas.
 *
 * Use em conjunto com `useResilientLoad`:
 * if (status === "loading") return <LoadingState />;
 * if (status === "error")   return <ErrorRetryState onRetry={reload} error={error} />;
 * if (!data?.length)        return <EmptyState title="Sem registros" />;
 */

interface LoadingStateProps {
  label?: string;
  /** "inline" para skeleton dentro de card; "block" para área cheia. */
  variant?: "inline" | "block";
  className?: string;
}

export function LoadingState({
  label = "Carregando…",
  variant = "block",
  className = "",
}: LoadingStateProps) {
  if (variant === "inline") {
    return (
      <div
        className={`flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground ${className}`}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>{label}</span>
      </div>
    );
  }
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-16 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin text-amber-500" aria-hidden />
      <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

interface ErrorRetryStateProps {
  error?: Error | string | null;
  onRetry?: () => void;
  title?: string;
  description?: string;
  variant?: "inline" | "block";
  className?: string;
}

export function ErrorRetryState({
  error,
  onRetry,
  title = "Não foi possível carregar",
  description,
  variant = "block",
  className = "",
}: ErrorRetryStateProps) {
  const detail =
    description ??
    (typeof error === "string"
      ? error
      : error?.message ?? "Verifique sua conexão e tente novamente.");

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 ${
        variant === "inline" ? "py-6" : "py-12"
      } text-center ${className}`}
      role="alert"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground max-w-md">{detail}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-1">
          <RefreshCcw className="mr-2 h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center ${className}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-md">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* ============================================================
   SKELETONS PREMIUM — reutilizáveis em listas, cards e tabelas
   ============================================================ */

interface SkeletonListProps {
  rows?: number;
  className?: string;
}

/** Lista vertical de linhas (ex.: cards de casos, clientes). */
export function SkeletonList({ rows = 5, className = "" }: SkeletonListProps) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonCardsProps {
  cards?: number;
  className?: string;
}

/** Grade de cards (ex.: dashboard KPIs, arsenal). */
export function SkeletonCards({ cards = 4, className = "" }: SkeletonCardsProps) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}
      aria-hidden
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card/50 p-4 space-y-3"
        >
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-2.5 w-full" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

/** Tabela densa (ex.: histórico, auditoria). */
export function SkeletonTable({
  rows = 6,
  cols = 4,
  className = "",
}: SkeletonTableProps) {
  return (
    <div
      className={`rounded-lg border border-border overflow-hidden ${className}`}
      aria-hidden
    >
      <div className="bg-muted/40 px-4 py-2.5 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-2/3" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="px-4 py-3 grid gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3.5 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

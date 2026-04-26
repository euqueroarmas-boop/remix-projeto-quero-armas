import { AlertTriangle, Loader2, RefreshCcw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

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

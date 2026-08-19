import { AlertCircle, Clock, RefreshCw } from "lucide-react";

interface Props {
  title?: string;
  state: "error" | "timeout";
  message?: string;
  onRetry: () => void;
}

/**
 * Estado visual elegante para falha/timeout de widget.
 * Usado no lugar do spinner eterno.
 */
export default function WidgetStateView({ title, state, message, onRetry }: Props) {
  const isTimeout = state === "timeout";
  const Icon = isTimeout ? Clock : AlertCircle;
  const color = isTimeout ? "text-[var(--qa-ambar)]" : "text-[var(--qa-vermelho)]";
  const bg = isTimeout ? "bg-[var(--qa-ambar-bg)] border-[var(--qa-ambar-borda)]" : "bg-[var(--qa-vermelho-bg)] border-[var(--qa-vermelho-borda)]";
  const heading = isTimeout
    ? "Tempo esgotado ao carregar"
    : "Não foi possível carregar agora";
  const sub = message ?? (isTimeout
    ? "A conexão demorou mais que o esperado."
    : "Indisponibilidade temporária.");

  return (
    <div className="space-y-3">
      {title && (
        <h3 className="text-sm font-bold text-[var(--qa-tinta)] uppercase tracking-wide">{title}</h3>
      )}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bg}`}>
        <Icon className={`h-4 w-4 shrink-0 ${color}`} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[var(--qa-tinta-2)]">{heading}</div>
          <div className="text-[11px] text-[var(--qa-tinta-3)]">{sub}</div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 h-8 text-[11px] font-semibold rounded-md bg-[var(--qa-paper)] border border-[var(--qa-linha)] text-[var(--qa-tinta-2)] hover:bg-[var(--qa-hover)] hover:border-[var(--qa-linha-2)] transition-colors shrink-0"
        >
          <RefreshCw className="h-3 w-3" />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

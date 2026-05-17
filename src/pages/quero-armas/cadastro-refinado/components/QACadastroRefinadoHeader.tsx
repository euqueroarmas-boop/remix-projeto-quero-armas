import { ChevronLeft } from "lucide-react";

interface Props {
  onBack?: () => void;
  showBack?: boolean;
  contextTag?: string;
  /** Step atual (0..total) — usado para a progress bar fina no topo. */
  step?: number;
  total?: number;
}

export default function QACadastroRefinadoHeader({
  onBack,
  showBack = true,
  contextTag = "TUDO PRONTO",
  step,
  total = 6,
}: Props) {
  const pct =
    typeof step === "number" && total > 0
      ? Math.min(100, Math.max(0, Math.round((step / total) * 100)))
      : 0;
  return (
    <header className="qa-ref-header">
      <div className="qa-ref-header-inner">
        <div className="qa-ref-logo">
          <span className="qa-ref-logo-mark">Q</span>
          <div className="qa-ref-header-eyebrow">
            <span className="qa-ref-header-eyebrow-top">ANÁLISE CONCLUÍDA</span>
            <span className="qa-ref-header-eyebrow-main">{contextTag}</span>
          </div>
        </div>
        {showBack && (
          <button type="button" className="qa-ref-back" onClick={onBack}>
            <ChevronLeft size={14} /> Voltar
          </button>
        )}
      </div>
      {typeof step === "number" && (
        <div className="qa-ref-progress-top" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
    </header>
  );
}
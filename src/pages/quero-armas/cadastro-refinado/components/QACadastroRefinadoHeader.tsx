import { ChevronLeft } from "lucide-react";

interface Props {
  onBack?: () => void;
  showBack?: boolean;
  contextTag?: string;
}

export default function QACadastroRefinadoHeader({ onBack, showBack = true, contextTag = "CONTRATAÇÃO DE SERVIÇO" }: Props) {
  return (
    <header className="qa-ref-header">
      <div className="qa-ref-header-inner">
        <div className="qa-ref-logo">
          <span className="qa-ref-logo-mark">Q</span>
          <div>
            <div className="qa-ref-logo-text">Eu Quero Armas</div>
            <div className="qa-ref-caps" style={{ fontSize: 9, marginTop: 1 }}>{contextTag}</div>
          </div>
        </div>
        {showBack && (
          <button type="button" className="qa-ref-back" onClick={onBack}>
            <ChevronLeft size={14} /> Voltar
          </button>
        )}
      </div>
    </header>
  );
}
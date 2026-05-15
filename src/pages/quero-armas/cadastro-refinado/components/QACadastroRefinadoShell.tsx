import { ReactNode } from "react";
import QACadastroRefinadoHeader from "./QACadastroRefinadoHeader";
import QACadastroRefinadoFooter from "./QACadastroRefinadoFooter";
import QACadastroRefinadoStepIndicator from "./QACadastroRefinadoStepIndicator";

interface Props {
  step: number;
  total?: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  children: ReactNode;
}

export default function QACadastroRefinadoShell({
  step,
  total = 5,
  eyebrow,
  title,
  subtitle,
  onBack,
  showBack = true,
  children,
}: Props) {
  return (
    <div className="qa-refinado">
      <QACadastroRefinadoHeader onBack={onBack} showBack={showBack} />
      <main className="qa-ref-shell">
        <QACadastroRefinadoStepIndicator current={step} total={total} />
        {eyebrow && <span className="qa-ref-caps qa-ref-eyebrow">{eyebrow}</span>}
        <h1 className="qa-ref-title">{title}</h1>
        {subtitle && <p className="qa-ref-subtitle">{subtitle}</p>}
        <div className="qa-ref-section">{children}</div>
      </main>
      <QACadastroRefinadoFooter />
    </div>
  );
}
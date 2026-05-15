import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  muted?: boolean;
  className?: string;
}

export default function QACadastroRefinadoCard({ children, muted, className = "" }: Props) {
  return (
    <div className={`qa-ref-card ${muted ? "qa-ref-card-muted" : ""} ${className}`}>{children}</div>
  );
}
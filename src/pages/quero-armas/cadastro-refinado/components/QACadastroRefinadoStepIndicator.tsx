interface Props {
  current: number; // 0..total
  total?: number;
}

export default function QACadastroRefinadoStepIndicator({ current, total = 6 }: Props) {
  const num = String(current).padStart(2, "0");
  const tot = String(total).padStart(2, "0");
  return (
    <div className="qa-ref-step-row">
      <span className="qa-ref-step-num">{num}</span>
      <span className="qa-ref-step-total">/ {tot}</span>
      <div className="qa-ref-step-bars">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={i < current ? "is-active" : ""} />
        ))}
      </div>
    </div>
  );
}
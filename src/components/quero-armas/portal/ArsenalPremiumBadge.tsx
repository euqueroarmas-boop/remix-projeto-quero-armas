import { Lock } from "lucide-react";

/**
 * Selo discreto do Arsenal Premium.
 * Ao tocar, leva o cliente ao Financeiro para cadastrar o cartão de crédito
 * e concluir a assinatura do serviço.
 */
export default function ArsenalPremiumBadge({ className = "" }: { className?: string }) {
  return (
    <a
      href="/area-do-cliente/financeiro?assinar=arsenal-premium"
      className={`qa-premium-chip ${className}`}
      aria-label="Assinar o Arsenal Premium — cadastrar cartão de crédito"
      title="Assinar o Arsenal Premium"
    >
      <style>{`
        .qa-premium-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(122,31,43,.28);background:rgba(122,31,43,.05);color:#7A1F2B;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:8.5px;font-weight:600;letter-spacing:.16em;padding:4px 9px;border-radius:999px;text-transform:uppercase;white-space:nowrap;text-decoration:none;line-height:1;opacity:.85;transition:opacity .15s ease,background .15s ease}
        .qa-premium-chip:hover{opacity:1;background:rgba(122,31,43,.1)}
        .qa-premium-chip svg{width:9px;height:9px}
      `}</style>
      <Lock />
      Premium
    </a>
  );
}

import { ArrowRight, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * Painel lateral "Próxima Ação" — orienta a equipe sobre qual o próximo
 * passo operacional para um cadastro público em conferência.
 * Pure UI: receber decisão pronta de cima.
 */

export type ProximaAcaoTone = "primary" | "warn" | "danger" | "ok" | "neutral";

export interface PendenciaItem {
  label: string;
  tone?: "warn" | "danger" | "info";
}

export interface ProximaAcaoPanelProps {
  titulo: string;
  descricao?: string;
  tone?: ProximaAcaoTone;
  pendencias?: PendenciaItem[];
  ctaLabel?: string;
  onCta?: () => void;
  ctaDisabled?: boolean;
  extra?: React.ReactNode;
}

function toneStyles(tone: ProximaAcaoTone) {
  switch (tone) {
    case "ok":
      return { wrap: "border-emerald-200 bg-emerald-50", title: "text-emerald-900", icon: "text-emerald-700", btn: "bg-emerald-600 hover:bg-emerald-700 text-white" };
    case "warn":
      return { wrap: "border-amber-200 bg-amber-50", title: "text-amber-900", icon: "text-amber-700", btn: "bg-amber-600 hover:bg-amber-700 text-white" };
    case "danger":
      return { wrap: "border-red-200 bg-red-50", title: "text-red-900", icon: "text-red-700", btn: "bg-red-600 hover:bg-red-700 text-white" };
    case "neutral":
      return { wrap: "border-slate-200 bg-slate-50", title: "text-slate-800", icon: "text-slate-600", btn: "bg-slate-700 hover:bg-slate-800 text-white" };
    default:
      return { wrap: "border-[#E5C2C6] bg-[#FBF3F4]", title: "text-[#3D0E16]", icon: "text-[#7A1F2B]", btn: "bg-[#7A1F2B] hover:bg-[#641722] text-white" };
  }
}

export default function ProximaAcaoPanel({
  titulo,
  descricao,
  tone = "primary",
  pendencias = [],
  ctaLabel,
  onCta,
  ctaDisabled,
  extra,
}: ProximaAcaoPanelProps) {
  const s = toneStyles(tone);
  return (
    <aside className={`rounded-2xl border ${s.wrap} p-4 space-y-3 sticky top-2`}>
      <div className="flex items-center gap-2">
        <Sparkles className={`h-4 w-4 ${s.icon}`} />
        <span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${s.title}`}>
          Próxima Ação
        </span>
      </div>
      <div>
        <div className={`text-[14px] font-bold leading-snug ${s.title}`}>{titulo}</div>
        {descricao && <p className="text-[11px] text-slate-700 mt-1 leading-snug">{descricao}</p>}
      </div>

      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          disabled={ctaDisabled}
          className={`w-full h-9 rounded-lg text-[12px] font-bold inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50 ${s.btn}`}
        >
          {ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}

      {pendencias.length > 0 && (
        <div className="border-t border-white/60 pt-2.5 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-600" /> Pendências
          </div>
          <ul className="space-y-1">
            {pendencias.map((p, i) => {
              const dot =
                p.tone === "danger" ? "bg-red-500" : p.tone === "info" ? "bg-[#7A1F2B]" : "bg-amber-500";
              return (
                <li key={i} className="flex items-start gap-2 text-[11px] text-slate-800">
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
                  <span className="leading-snug">{p.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pendencias.length === 0 && tone === "ok" && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5" /> Sem pendências críticas.
        </div>
      )}

      {extra}
    </aside>
  );
}
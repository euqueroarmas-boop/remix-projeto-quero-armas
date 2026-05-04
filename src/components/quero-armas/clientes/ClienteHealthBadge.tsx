/**
 * ClienteHealthBadge
 *
 * Semáforo de SAÚDE DOCUMENTAL do cliente — distinto do `status` (ciclo de vida:
 * ATIVO/DESISTENTE/PENDENTE). Consolida em um único indicador a pior cor entre:
 * CR · CRAFs · GTEs · Exames · Autorizações · Processos · Documentos.
 *
 * Usa o hook canônico `useClienteStatusAgregado` (não cria fetch paralelo).
 * Não substitui o badge de status do cliente — é COMPLEMENTAR.
 */

import { useClienteStatusAgregado } from "@/hooks/useClienteStatusAgregado";
import { TONE_TEXT_CLASS, TONE_BORDER_CLASS, TONE_SOFT_BG_CLASS } from "@/lib/quero-armas/statusColors";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ShieldAlert, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import type { CorStatus } from "@/lib/quero-armas/statusUnificado";

const TONE_DOT: Record<CorStatus, string> = {
  verde: "bg-emerald-500",
  azul: "bg-sky-500",
  amarelo: "bg-amber-500",
  laranja: "bg-orange-500",
  vermelho: "bg-red-500",
  cinza: "bg-slate-400",
};

function pickIcon(tone: CorStatus) {
  if (tone === "vermelho") return ShieldAlert;
  if (tone === "laranja" || tone === "amarelo") return AlertTriangle;
  if (tone === "verde") return ShieldCheck;
  return ShieldCheck;
}

interface Props {
  clienteId: number | null | undefined;
  /** "compact" = só dot + label curto. "full" = badge maior com ícone e popover de detalhes. */
  variant?: "compact" | "full";
  className?: string;
}

export default function ClienteHealthBadge({ clienteId, variant = "full", className = "" }: Props) {
  const { data, loading } = useClienteStatusAgregado(clienteId);

  if (loading && !data) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] border bg-slate-50 text-slate-400 border-slate-200 ${className}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        SAÚDE
      </span>
    );
  }

  if (!data) return null;

  const tone = data.tom_geral;
  const Icon = pickIcon(tone);
  const a = data.kpis.alertas;

  if (variant === "compact") {
    return (
      <span
        title={`Saúde documental: ${data.status_geral}${a.total ? ` · ${a.total} alerta(s)` : ""}`}
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] border ${TONE_SOFT_BG_CLASS[tone]} ${TONE_TEXT_CLASS[tone]} ${TONE_BORDER_CLASS[tone]} ${className}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />
        {data.status_geral}
      </span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] border transition-shadow hover:shadow-sm ${TONE_SOFT_BG_CLASS[tone]} ${TONE_TEXT_CLASS[tone]} ${TONE_BORDER_CLASS[tone]} ${className}`}
          title="Ver detalhe de saúde documental"
        >
          <Icon className="h-3 w-3" />
          SAÚDE: {data.status_geral}
          {a.total > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-white/60 px-1.5 text-[9px] font-black">
              {a.total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden bg-white border border-slate-200 shadow-lg">
        <div className={`px-3 py-2 ${TONE_SOFT_BG_CLASS[tone]} ${TONE_TEXT_CLASS[tone]} border-b ${TONE_BORDER_CLASS[tone]}`}>
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5" />
            <span className="text-[11px] font-black uppercase tracking-wider">SAÚDE DOCUMENTAL</span>
            <span className="ml-auto text-[10px] font-bold">{data.status_geral}</span>
          </div>
        </div>
        <div className="p-3 space-y-1.5 text-[11px] text-slate-700">
          <Row label="CR" tone={data.kpis.cr.tone} value={data.kpis.cr.label} />
          <Row label="CRAFs" tone={data.kpis.crafs.tone}
               value={`${data.kpis.crafs.total} cad. · ${data.kpis.crafs.vencidos} vencido(s) · ${data.kpis.crafs.vencendo} vencendo`} />
          <Row label="GTEs" tone={data.kpis.gtes.tone}
               value={`${data.kpis.gtes.total} cad. · ${data.kpis.gtes.vencidos} vencido(s) · ${data.kpis.gtes.vencendo} vencendo`} />
          <Row label="EXAMES" tone={data.kpis.exames.tone}
               value={`${data.kpis.exames.total} cad. · ${data.kpis.exames.vencidos} vencido(s) · ${data.kpis.exames.vencendo} vencendo`} />
          <Row label="AUTORIZ." tone={data.kpis.autorizacoes.tone}
               value={`${data.kpis.autorizacoes.total} cad. · ${data.kpis.autorizacoes.vencidos} vencido(s)`} />
          <Row label="PROCESSOS" tone={data.kpis.processos.tone}
               value={`${data.kpis.processos.total} · ${data.kpis.processos.indeferidos} indef. · ${data.kpis.processos.em_recurso} em recurso`} />
          <Row label="DOCS" tone={data.kpis.documentos.tone}
               value={`${data.kpis.documentos.aprovados}/${data.kpis.documentos.total} aprovados · ${data.kpis.documentos.pendentes} pend.`} />
        </div>
        {a.itens.length > 0 && (
          <div className="border-t border-slate-200 px-3 py-2 bg-slate-50">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Alertas ativos ({a.total})
            </div>
            <ul className="space-y-1 max-h-44 overflow-y-auto pr-1">
              {a.itens.slice(0, 8).map((it, i) => (
                <li key={i} className="flex items-center gap-2 text-[10px]">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${TONE_DOT[it.tone]}`} />
                  <span className="font-semibold uppercase text-slate-700 truncate">{it.fonte}: {it.titulo}</span>
                  <span className="ml-auto text-slate-500 shrink-0">
                    {it.dias_restantes !== null
                      ? it.dias_restantes < 0
                        ? `vencido há ${Math.abs(it.dias_restantes)}d`
                        : `${it.dias_restantes}d`
                      : "—"}
                  </span>
                </li>
              ))}
              {a.itens.length > 8 && (
                <li className="text-[10px] text-slate-400 italic">+{a.itens.length - 8} alerta(s)</li>
              )}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, tone, value }: { label: string; tone: CorStatus; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${TONE_DOT[tone]}`} />
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 w-20 shrink-0">{label}</span>
      <span className="text-[10px] text-slate-700 truncate">{value}</span>
    </div>
  );
}
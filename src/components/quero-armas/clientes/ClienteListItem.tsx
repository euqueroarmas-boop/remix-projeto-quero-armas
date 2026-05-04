/**
 * ClienteListItem
 *
 * Card de cliente na lista da área da Equipe Quero Armas.
 * A cor reflete o TOM OPERACIONAL agregado (alertas/vencimentos),
 * não apenas o status cadastral (ATIVO/PENDENTE/DESISTENTE).
 * O badge cadastral continua exibido, mas separado do semáforo de saúde.
 */

import { Phone, MapPin, Trash2 } from "lucide-react";
import { useClienteStatusAgregado } from "@/hooks/useClienteStatusAgregado";
import type { CorStatus } from "@/lib/quero-armas/statusUnificado";
import ClienteSelfieAvatar from "./ClienteSelfieAvatar";

const onlyDigits = (v: string | null | undefined) => String(v || "").replace(/\D/g, "");
const formatCpf = (v: string | null | undefined): string => {
  const d = onlyDigits(v);
  if (d.length !== 11) return v ?? "";
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
};
const formatPhone = (v: string | null | undefined): string => {
  const d = onlyDigits(v);
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return v ?? "";
};

const TONE_HSL: Record<CorStatus, string> = {
  verde: "hsl(152 60% 42%)",
  azul: "hsl(210 80% 50%)",
  amarelo: "hsl(48 92% 50%)",
  laranja: "hsl(28 92% 50%)",
  vermelho: "hsl(0 72% 55%)",
  cinza: "hsl(220 10% 60%)",
};

const STATUS_HSL = (status?: string) =>
  status === "ATIVO"
    ? "hsl(152 60% 42%)"
    : status === "DESISTENTE"
    ? "hsl(0 72% 55%)"
    : "hsl(38 92% 50%)";

interface Props {
  cliente: any;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export default function ClienteListItem({ cliente: c, onOpen, onDelete }: Props) {
  const { data: agregado } = useClienteStatusAgregado(c.id);
  const operacionalTone: CorStatus = agregado?.tom_geral ?? "cinza";
  const operacionalHsl = TONE_HSL[operacionalTone];
  const cadastralHsl = STATUS_HSL(c.status);
  const totalAlertas = agregado?.kpis.alertas.total ?? 0;
  // Tom dominante do CARD = operacional se houver dado; fallback no cadastral.
  const cardTone = agregado ? operacionalHsl : cadastralHsl;

  return (
    <button
      onClick={onOpen}
      className="w-full text-left group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.997]"
      style={{ boxShadow: `inset 0 0 0 1px ${cardTone}10, 0 1px 2px rgba(15,23,42,0.04)` }}
    >
      {/* Glow ambiente reflete o tom OPERACIONAL */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30 blur-2xl"
        style={{ background: cardTone }}
      />
      {/* Faixa lateral do tom operacional */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-1"
        style={{ background: cardTone }}
      />
      <div className="relative flex items-center gap-3 px-4 py-3.5">
        <ClienteSelfieAvatar cliente={c} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[14px] font-bold uppercase tracking-tight truncate" style={{ color: "hsl(220 20% 12%)" }}>
              {c.nome_completo}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500">
            <span className="font-mono tracking-wider text-slate-400">CPF {formatCpf(c.cpf)}</span>
            {c.celular && (
              <>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Phone className="h-2.5 w-2.5 text-slate-400" /> {formatPhone(c.celular)}
                </span>
              </>
            )}
            {c.cidade && (
              <>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1 uppercase tracking-wide">
                  <MapPin className="h-2.5 w-2.5 text-slate-400" /> {c.cidade}/{c.estado}
                </span>
              </>
            )}
            {(((c as any).servicos_contratados as string[] | undefined) || []).length > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1 uppercase tracking-wide">
                  {(((c as any).servicos_contratados as string[]) || []).join(" • ")}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex flex-col items-end gap-0.5">
            {/* Badge cadastral (ATIVO/PENDENTE/DESISTENTE) — sempre visível */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em]"
              style={{ background: `${cadastralHsl}14`, color: cadastralHsl, boxShadow: `inset 0 0 0 1px ${cadastralHsl}33` }}
            >
              <span className="h-1 w-1 rounded-full" style={{ background: cadastralHsl }} />
              {c.status}
            </span>
            {/* Selo de alertas operacionais — só aparece quando houver */}
            {totalAlertas > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em]"
                style={{ background: `${operacionalHsl}18`, color: operacionalHsl, boxShadow: `inset 0 0 0 1px ${operacionalHsl}40` }}
                title="Alertas operacionais ativos"
              >
                <span className="h-1 w-1 rounded-full" style={{ background: operacionalHsl }} />
                {totalAlertas} ALERTA{totalAlertas > 1 ? "S" : ""}
              </span>
            )}
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-slate-400">
              #{String((c as any).display_id ?? c.id).padStart(4, "0")}
            </span>
          </div>
          <button
            onClick={onDelete}
            className="h-8 w-8 rounded-xl flex items-center justify-center bg-white border border-slate-200 text-slate-300 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all md:opacity-0 md:group-hover:opacity-100"
            title="Excluir cliente"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </button>
  );
}
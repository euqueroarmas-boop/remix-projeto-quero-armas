/**
 * ClienteSearchRow
 *
 * Linha do cliente na pesquisa global. Reflete a COR DO STATUS conforme o
 * KPI Alertas agregado: se houver alertas, usa o tom da pior cor (vermelho/
 * laranja/amarelo). Se não houver alertas, mantém a cor original do status
 * cadastral (verde p/ ATIVO, vermelho p/ DESISTENTE, âmbar p/ outros).
 *
 * Não altera nenhum outro comportamento da linha.
 */

import { Phone, MapPin, Trash2 } from "lucide-react";
import ClienteSelfieAvatar from "./ClienteSelfieAvatar";
import { useClienteStatusAgregado } from "@/hooks/useClienteStatusAgregado";
import type { CorStatus } from "@/lib/quero-armas/statusUnificado";

function formatCpf(cpf: string | null | undefined) {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function formatPhone(p: string | null | undefined) {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}

const ALERT_TONE_HSL: Record<CorStatus, string | null> = {
  vermelho: "hsl(0 72% 55%)",
  laranja: "hsl(22 90% 52%)",
  amarelo: "hsl(38 92% 50%)",
  azul: null,
  verde: null,
  cinza: null,
};

interface Props {
  c: any;
  openClient: (c: any) => void;
  setDeleteModal: (m: any) => void;
}

export default function ClienteSearchRow({ c, openClient, setDeleteModal }: Props) {
  const { data: agregado } = useClienteStatusAgregado(c?.id ?? null);

  const baseTone =
    c.status === "ATIVO"
      ? "hsl(152 60% 42%)"
      : c.status === "DESISTENTE"
      ? "hsl(0 72% 55%)"
      : "hsl(38 92% 50%)";

  const totalAlertas = agregado?.kpis.alertas.total ?? 0;
  const alertOverride = totalAlertas > 0 ? ALERT_TONE_HSL[agregado!.tom_geral] : null;
  const statusTone = alertOverride ?? baseTone;

  return (
    <button
      onClick={() => openClient(c)}
      className="w-full text-left group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.997]"
      style={{ boxShadow: `inset 0 0 0 1px ${statusTone}10, 0 1px 2px rgba(15,23,42,0.04)` }}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30 blur-2xl"
        style={{ background: statusTone }}
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
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em]"
              style={{ background: `${statusTone}14`, color: statusTone, boxShadow: `inset 0 0 0 1px ${statusTone}33` }}
            >
              <span className="h-1 w-1 rounded-full" style={{ background: statusTone }} />
              {c.status}
            </span>
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-slate-400">
              #{String((c as any).display_id ?? c.id).padStart(4, "0")}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteModal({ open: true, table: "qa_clientes", id: c.id, title: "Excluir Cliente", desc: `Excluir "${c.nome_completo}" e todos os dados vinculados (vendas, armas, filiações)?` });
            }}
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
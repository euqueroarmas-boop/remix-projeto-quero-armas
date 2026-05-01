import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CircleDot, ArrowRight } from "lucide-react";
import { statusLabel, statusBadgeClass } from "@/lib/quero-armas/statusServico";

type EventoRow = {
  id: string;
  evento: string;
  status_anterior: string | null;
  status_novo: string | null;
  descricao: string | null;
  metadata: Record<string, any> | null;
  ator: string | null;
  created_at: string;
};

/**
 * Linha do tempo operacional de uma solicitação. Lê apenas
 * qa_solicitacao_eventos, populada pela trigger qa_log_status_change e
 * por inserts manuais (upload de documento, comunicação ao órgão, etc).
 */
export function SolicitacaoTimeline({ solicitacaoId }: { solicitacaoId: string }) {
  const [rows, setRows] = useState<EventoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase
      .from("qa_solicitacao_eventos" as any)
      .select("id, evento, status_anterior, status_novo, descricao, metadata, ator, created_at")
      .eq("solicitacao_id", solicitacaoId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!alive) return;
        setRows(((data as any[]) ?? []) as EventoRow[]);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [solicitacaoId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-[11px] text-slate-400 py-4 text-center uppercase tracking-wider">
        Sem eventos registrados
      </div>
    );
  }

  return (
    <ol className="relative border-s border-slate-200 ms-2 space-y-3">
      {rows.map((e) => (
        <li key={e.id} className="ms-3">
          <span className="absolute -start-1.5 mt-1 flex h-3 w-3 items-center justify-center rounded-full bg-white border border-slate-300">
            <CircleDot className="h-2.5 w-2.5 text-indigo-500" />
          </span>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">
            {new Date(e.created_at).toLocaleString("pt-BR")}
            {e.ator ? <span className="ml-1 text-slate-500">· {e.ator}</span> : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {e.status_anterior && (
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${statusBadgeClass(e.status_anterior)}`}>
                {statusLabel(e.status_anterior)}
              </span>
            )}
            {e.status_anterior && e.status_novo && <ArrowRight className="h-3 w-3 text-slate-400" />}
            {e.status_novo && (
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${statusBadgeClass(e.status_novo)}`}>
                {statusLabel(e.status_novo)}
              </span>
            )}
          </div>
          {e.descricao && (
            <div className="text-[11px] text-slate-600 mt-1">{e.descricao}</div>
          )}
        </li>
      ))}
    </ol>
  );
}
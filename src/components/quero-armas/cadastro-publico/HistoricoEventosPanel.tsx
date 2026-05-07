import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History, Loader2 } from "lucide-react";

interface EventoLite {
  id: string;
  origem: string;
  campo_status: string;
  status_anterior: string | null;
  status_novo: string | null;
  motivo: string | null;
  criado_em: string;
}

export interface HistoricoEventosPanelProps {
  cadastroId: string;
  refreshKey?: number;
}

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function rotuloEvento(e: EventoLite): string {
  const a = (e.status_anterior || "—").toUpperCase();
  const n = (e.status_novo || "—").toUpperCase();
  if (e.campo_status === "pago") return e.status_novo === "true" ? "Pagamento marcado" : "Pagamento desfeito";
  if (e.campo_status === "correcao_solicitada") return "Correção solicitada ao cliente";
  return `Status: ${a} → ${n}`;
}

export default function HistoricoEventosPanel({ cadastroId, refreshKey }: HistoricoEventosPanelProps) {
  const [loading, setLoading] = useState(true);
  const [eventos, setEventos] = useState<EventoLite[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("qa_status_eventos")
        .select("id, origem, campo_status, status_anterior, status_novo, motivo, criado_em")
        .eq("entidade", "cadastro_publico")
        .eq("entidade_id", cadastroId)
        .order("criado_em", { ascending: false })
        .limit(15);
      if (!cancel) {
        setEventos((data as any) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [cadastroId, refreshKey]);

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-slate-600" />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
          Histórico
        </span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </div>
      ) : eventos.length === 0 ? (
        <div className="text-[12px] text-slate-500">Nenhum evento registrado.</div>
      ) : (
        <ul className="space-y-2">
          {eventos.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-[12px] text-slate-800"
            >
              <div className="font-semibold leading-snug">{rotuloEvento(e)}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-0.5">
                {fmt(e.criado_em)} • {e.origem}
              </div>
              {e.motivo && (
                <div className="text-[11px] text-slate-700 mt-1 leading-snug">{e.motivo}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
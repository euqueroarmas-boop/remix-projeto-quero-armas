import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, ArrowRight, Inbox } from "lucide-react";

interface Row {
  id: string;
  cliente_id: number;
  servico_nome: string | null;
  updated_at: string;
  cliente?: { nome_completo: string | null; cpf: string | null } | null;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

/**
 * Lista enxuta de processos com status `pronto_para_protocolar`.
 * Aparece no dashboard admin para a equipe priorizar a entrada no órgão.
 */
export default function DashboardProntoProtocolar() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("qa_processos" as any)
          .select("id, cliente_id, servico_nome, updated_at")
          .eq("status", "pronto_para_protocolar")
          .order("updated_at", { ascending: true })
          .limit(50);
        const list = (data as any[]) ?? [];
        if (list.length > 0) {
          const ids = Array.from(new Set(list.map((r) => r.cliente_id))).filter(Boolean);
          const { data: clis } = await supabase
            .from("qa_clientes" as any)
            .select("id, nome_completo, cpf")
            .in("id", ids);
          const map: Record<number, any> = {};
          ((clis as any[]) ?? []).forEach((c) => { map[c.id] = c; });
          if (!cancelled) {
            setRows(list.map((r) => ({ ...r, cliente: map[r.cliente_id] ?? null })) as Row[]);
          }
        } else if (!cancelled) {
          setRows([]);
        }
      } catch (e) {
        console.warn("[DashboardProntoProtocolar]", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;

  return (
    <div className="qa-card overflow-hidden border-emerald-200">
      <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50/60 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <h3 className="text-[11px] uppercase tracking-[0.14em] font-bold text-emerald-800">
          PROCESSOS PRONTOS PARA PROTOCOLAR
        </h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded px-2 py-0.5">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-[11px] uppercase tracking-wider text-slate-400 inline-flex items-center justify-center gap-2 w-full">
          <Inbox className="h-3.5 w-3.5" />
          NENHUM PROCESSO AGUARDANDO PROTOCOLO NO MOMENTO
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-2.5 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold uppercase text-slate-800 truncate">
                  {r.cliente?.nome_completo ?? "—"}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 truncate">
                  CPF {r.cliente?.cpf ?? "—"} · {r.servico_nome ?? "SERVIÇO"} · PRONTO EM {formatDate(r.updated_at)}
                </div>
              </div>
              <Link
                to={`/quero-armas/processos?processo=${r.id}`}
                className="h-7 px-3 inline-flex items-center gap-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold text-white bg-emerald-600 hover:bg-emerald-700"
              >
                ABRIR PROCESSO <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
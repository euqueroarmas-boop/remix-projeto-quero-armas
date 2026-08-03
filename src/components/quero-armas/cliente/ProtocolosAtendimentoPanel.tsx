import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const BRAND = "#7A1F2B";
const OSWALD = "'Oswald','Arial Narrow',Arial,sans-serif";
const SP_TZ = "America/Sao_Paulo";

type ProtocoloRow = {
  id: string;
  numero_protocolo: string | null;
  titulo: string | null;
  status: string | null;
  created_at: string;
  last_activity_at: string | null;
  updated_at: string | null;
};

function fmtDMYHM(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { timeZone: SP_TZ })}, ${d.toLocaleTimeString("pt-BR", {
    timeZone: SP_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Protocolos de atendimento do Klal — visão do cliente dentro de Configurações.
 * Somente leitura: lista os protocolos abertos no chat, com data e status.
 */
export default function ProtocolosAtendimentoPanel({ clienteId }: { clienteId?: number | null }) {
  const [rows, setRows] = useState<ProtocoloRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!clienteId) { setLoading(false); return; }
      try {
        const { data } = await (supabase as any)
          .from("qa_chat_sessoes")
          .select("id, numero_protocolo, titulo, status, created_at, updated_at, last_activity_at")
          .eq("cliente_id", clienteId)
          .order("last_activity_at", { ascending: false })
          .limit(50);
        if (alive) setRows((data ?? []) as ProtocoloRow[]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clienteId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div
        className="uppercase mb-3"
        style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 12, letterSpacing: "0.18em", color: "#6B6B6B" }}
      >
        Protocolos de atendimento
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-slate-500">Nenhum protocolo de atendimento registrado até agora.</p>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
          {rows.map((p) => {
            const ativo = (p.status || "").toLowerCase() === "ativo";
            return (
              <div key={p.id} className="rounded-lg border border-slate-200 bg-[#FAFAFA] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="uppercase truncate"
                    style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", color: "#141414" }}
                  >
                    {p.numero_protocolo || "—"}
                  </span>
                  <span
                    className="uppercase shrink-0 px-2 py-0.5 rounded"
                    style={{
                      fontFamily: OSWALD,
                      fontWeight: 600,
                      fontSize: 9.5,
                      letterSpacing: "0.16em",
                      color: ativo ? "#FFFFFF" : "#6B6B6B",
                      background: ativo ? BRAND : "#EDEDED",
                    }}
                  >
                    {ativo ? "Aberto" : "Encerrado"}
                  </span>
                </div>
                {p.titulo && <div className="text-[11px] text-slate-600 mt-0.5 truncate">{p.titulo}</div>}
                <div className="text-[10.5px] text-slate-500 mt-1">
                  Aberto em {fmtDMYHM(p.created_at)} · Última atividade {fmtDMYHM(p.last_activity_at || p.updated_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

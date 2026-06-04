import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History, ChevronDown, ChevronUp, Loader2, FileText, Clock } from "lucide-react";
import { QATimeline, QAEmptyState, QAStatusChip, QAInfoCard } from "@/components/quero-armas/qa-operational";

interface ChangedField {
  field: string;
  label?: string;
  old: any;
  new: any;
}

interface HistoricoRow {
  id: string;
  cliente_id: number;
  cadastro_publico_id: string | null;
  changed_fields: ChangedField[] | null;
  snapshot_anterior: Record<string, any> | null;
  origem: string;
  autor: string | null;
  created_at: string;
}

const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const fmtValue = (v: any): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
};

interface Props {
  clienteId: number;
  /** When true, exposes the raw "snapshot anterior" to the user. Admin = true. */
  showSnapshot?: boolean;
}

export function HistoricoAtualizacoes({ clienteId, showSnapshot = false }: Props) {
  const [rows, setRows] = useState<HistoricoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("qa_cliente_historico_atualizacoes" as any)
          .select("*")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        if (active) setRows((data as unknown as HistoricoRow[]) ?? []);
      } catch (e) {
        console.error("[HistoricoAtualizacoes] erro:", e);
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [clienteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[11px] uppercase tracking-wider">Carregando histórico...</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <QAEmptyState
        icon={History}
        title="Nenhuma atualização registrada"
        description="Quando os dados do cliente forem atualizados, o registro aparecerá aqui em linha do tempo."
      />
    );
  }

  // Mapeia rows para eventos de timeline operacional.
  const events = rows.map((r) => {
    const fields = Array.isArray(r.changed_fields) ? r.changed_fields : [];
    const count = fields.length;
    const critical = count >= 5;
    const isOpen = openId === r.id;
    return {
      id: r.id,
      date: r.created_at,
      title: count > 0 ? `${count} ${count === 1 ? "Campo Atualizado" : "Campos Atualizados"}` : "Atualização Registrada",
      tone: (critical ? "warn" : "info") as any,
      icon: FileText,
      origem: r.origem ? r.origem.replace("_", " ").toUpperCase() : undefined,
      ator: r.autor || undefined,
      critical,
      detail: (
        <div>
          <button
            type="button"
            onClick={() => setOpenId(isOpen ? null : r.id)}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#7A1F2B] hover:underline"
          >
            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {isOpen ? "Recolher detalhes" : "Ver detalhes"}
          </button>
          {isOpen && (
            <div className="mt-2 space-y-1.5">
              {count === 0 && (
                <div className="text-[11px] text-slate-400 italic">Sem detalhamento de campos.</div>
              )}
              {fields.map((f, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-slate-500 mb-1">
                    {f.label || f.field}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Antes</span>
                      <span className="text-slate-500 line-through break-words">{fmtValue(f.old)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-emerald-600 block">Agora</span>
                      <span className="text-slate-800 font-semibold break-words">{fmtValue(f.new)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {showSnapshot && r.snapshot_anterior && (
                <details className="mt-2">
                  <summary className="text-[10px] uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-600 font-bold">
                    Snapshot completo do estado anterior
                  </summary>
                  <pre className="mt-2 text-[10px] bg-slate-50 text-slate-800 border border-slate-200 rounded-lg p-3 overflow-auto max-h-64">
                    {JSON.stringify(r.snapshot_anterior, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      ),
    };
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-slate-600">
            {rows.length} {rows.length === 1 ? "evento" : "eventos"}
          </span>
        </div>
        <QAStatusChip label="Auditoria" tone="info" />
      </div>
      <QATimeline events={events} />
    </div>
  );
}

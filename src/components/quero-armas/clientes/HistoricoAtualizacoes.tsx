import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History, ChevronDown, ChevronUp, Loader2, FileText } from "lucide-react";

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
      <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200">
        <History className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <div className="text-[12px] font-semibold text-slate-500">Nenhuma atualização registrada</div>
        <div className="text-[11px] text-slate-400 mt-1">
          Quando você (ou nossa equipe) atualizar seus dados, o registro aparecerá aqui.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const fields = Array.isArray(r.changed_fields) ? r.changed_fields : [];
        const isOpen = openId === r.id;
        return (
          <div key={r.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : r.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "hsl(230 80% 96%)" }}>
                <FileText className="h-3.5 w-3.5" style={{ color: "hsl(230 80% 56%)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-slate-700">
                  {fields.length > 0
                    ? `${fields.length} ${fields.length === 1 ? "campo atualizado" : "campos atualizados"}`
                    : "Atualização registrada"}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {fmtDateTime(r.created_at)}
                  {r.origem ? ` • origem: ${r.origem.replace("_", " ")}` : ""}
                </div>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/60 space-y-2">
                {fields.length === 0 ? (
                  <div className="text-[11px] text-slate-400 italic">Sem detalhamento de campos.</div>
                ) : (
                  <div className="space-y-1.5">
                    {fields.map((f, idx) => (
                      <div key={idx} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                          {f.label || f.field}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Antes</span>
                            <span className="text-slate-500 line-through break-words">{fmtValue(f.old)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-600 block font-semibold">Agora</span>
                            <span className="text-slate-800 font-medium break-words">{fmtValue(f.new)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {showSnapshot && r.snapshot_anterior && (
                  <details className="mt-2">
                    <summary className="text-[10px] uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-600">
                      Ver snapshot completo do estado anterior
                    </summary>
                    <pre className="mt-2 text-[10px] bg-slate-900 text-slate-100 rounded-lg p-3 overflow-auto max-h-64">
                      {JSON.stringify(r.snapshot_anterior, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

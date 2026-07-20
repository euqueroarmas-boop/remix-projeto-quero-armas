import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History, ChevronDown, ChevronUp, Loader2, FileText, Clock } from "lucide-react";

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
      timeZone: "America/Sao_Paulo",
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
      <div className="flex items-center justify-center gap-2 py-10 text-[#8A8A8A]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[11px] uppercase tracking-wider">Carregando histórico...</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-[#E4E4E4] bg-[#FFFFFF] px-6 py-10 text-center">
        <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-sm bg-[#FAFAFA] text-[#6A6A6A]">
          <History className="h-4 w-4" />
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0A0A0A]">Nenhuma atualização registrada</div>
        <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-[#6A6A6A]">
          Quando os dados do cliente forem atualizados, o registro aparecerá aqui em linha do tempo.
        </p>
      </div>
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
      icon: FileText,
      origem: r.origem ? r.origem.replace("_", " ").toUpperCase() : undefined,
      ator: r.autor || undefined,
      critical,
      detail: (
        <div>
          <button
            type="button"
            onClick={() => setOpenId(isOpen ? null : r.id)}
             className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#0A0A0A] hover:underline"
          >
            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {isOpen ? "Recolher detalhes" : "Ver detalhes"}
          </button>
          {isOpen && (
            <div className="mt-2 space-y-1.5">
              {count === 0 && (
                <div className="text-[11px] italic text-[#8A8A8A]">Sem detalhamento de campos.</div>
              )}
              {fields.map((f, idx) => (
                <div key={idx} className="rounded-sm border border-[#E4E4E4] bg-[#FAFAFA] px-3 py-2">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
                    {f.label || f.field}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <span className="block text-[9px] font-bold uppercase text-[#8A8A8A]">Antes</span>
                      <span className="break-words text-[#6A6A6A] line-through">{fmtValue(f.old)}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold uppercase text-[#0A0A0A]">Agora</span>
                      <span className="break-words font-semibold text-[#0A0A0A]">{fmtValue(f.new)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {showSnapshot && r.snapshot_anterior && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-[#6A6A6A] hover:text-[#0A0A0A]">
                    Snapshot completo do estado anterior
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-sm border border-[#E4E4E4] bg-[#FAFAFA] p-3 text-[10px] text-[#0A0A0A]">
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-[#6A6A6A]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
            {rows.length} {rows.length === 1 ? "evento" : "eventos"}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#E4E4E4] bg-[#FAFAFA] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
          <span className="h-2 w-2 rounded-full bg-[#C4C4C4]" /> Auditoria
        </span>
      </div>
      <div className="relative pl-6">
        <div className="absolute left-2.5 top-1 bottom-1 w-px bg-[#E4E4E4]" />
        <div className="space-y-4">
          {events.map((event) => {
            const Icon = event.icon;
            return (
              <div key={event.id} className="relative flex items-start gap-3">
                <span className="absolute -left-[18px] top-1.5 z-10 h-2 w-2 rounded-full border border-[#FFFFFF] bg-[#C4C4C4]" />
                <div className="min-w-0 flex-1 pl-4">
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-3 w-3 shrink-0 text-[#8A8A8A]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#0A0A0A]">{event.title}</div>
                      <div className="mt-0.5 text-[10px] text-[#8A8A8A]">{fmtDateTime(event.date)}</div>
                      {(event.origem || event.ator) && (
                        <div className="mt-1 text-[10px] text-[#6A6A6A]">
                          {[event.origem, event.ator].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div className="mt-2">{event.detail}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

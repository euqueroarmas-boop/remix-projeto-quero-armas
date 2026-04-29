/**
 * FASE 6 — Histórico de auditoria de uma arma manual/IA.
 *
 * Exibe os últimos eventos registrados em `qa_cliente_armas_auditoria` para a
 * arma informada. RLS já garante que cliente só vê os próprios e equipe vê todos.
 */
import { useEffect, useState } from "react";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  armaManualId: number | string | null | undefined;
  refreshKey?: number;
}

const fmtDateTime = (iso: string) => {
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
};

const ACAO_LABEL: Record<string, { label: string; color: string }> = {
  criada:           { label: "CRIADA",           color: "hsl(152 60% 38%)" },
  editada:          { label: "EDITADA",          color: "hsl(220 80% 45%)" },
  marcada_revisada: { label: "REVISADA",         color: "hsl(190 80% 35%)" },
  marcada_revisao:  { label: "MARCADA P/ REVISÃO", color: "hsl(28 92% 38%)" },
  excluida:         { label: "EXCLUÍDA",         color: "hsl(0 72% 50%)" },
  restaurada:       { label: "RESTAURADA",       color: "hsl(262 60% 45%)" },
};

const ATOR_LABEL: Record<string, string> = {
  cliente: "cliente",
  equipe:  "equipe",
  sistema: "sistema",
  ia_ocr:  "IA/OCR",
};

export default function ArmaHistoricoBlock({ armaManualId, refreshKey }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!armaManualId) { setEvents([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("qa_cliente_armas_auditoria" as any)
          .select("id, acao, ator_tipo, origem, campos_alterados, created_at")
          .eq("arma_manual_id", armaManualId)
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        if (!cancelled) setEvents((data as any[]) ?? []);
      } catch (e) {
        console.warn("[ArmaHistoricoBlock] load error", e);
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [armaManualId, refreshKey]);

  if (!armaManualId) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700"
      >
        <span className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          Histórico {events.length > 0 && <span className="text-slate-500 font-normal normal-case">({events.length})</span>}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="px-3 pb-3">
          {loading ? (
            <div className="text-[11px] text-slate-500">Carregando…</div>
          ) : events.length === 0 ? (
            <div className="text-[11px] text-slate-500">Sem eventos registrados.</div>
          ) : (
            <ul className="space-y-1.5">
              {events.map((ev) => {
                const cfg = ACAO_LABEL[ev.acao] || { label: ev.acao?.toUpperCase(), color: "hsl(220 10% 40%)" };
                const campos = Array.isArray(ev.campos_alterados) ? ev.campos_alterados : [];
                return (
                  <li key={ev.id} className="flex items-start gap-2 text-[10.5px]">
                    <span
                      className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider shrink-0"
                      style={{ background: `${cfg.color}1A`, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-700">
                        {fmtDateTime(ev.created_at)} · <b>{ATOR_LABEL[ev.ator_tipo] || ev.ator_tipo}</b>
                        {ev.origem && <> · <span className="text-slate-500">{ev.origem}</span></>}
                      </div>
                      {campos.length > 0 && (
                        <div className="text-slate-500 truncate">
                          Campos: {campos.join(", ")}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
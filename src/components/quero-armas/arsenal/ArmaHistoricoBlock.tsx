/**
 * FASE 6 + FASE 7 — Histórico de auditoria de uma arma manual/IA.
 *
 * Exibe os últimos eventos registrados em `qa_cliente_armas_auditoria` para a
 * arma informada. RLS já garante que cliente só vê os próprios e equipe vê todos.
 *
 * FASE 7: Cada evento pode ser expandido para mostrar a tabela
 *         Campo / Antes / Depois (a partir de dados_antes e dados_depois),
 *         já filtrando ruído (id, timestamps, ids internos, jsons crus).
 */
import { useEffect, useState } from "react";
import { History, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
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

const ORIGEM_LABEL: Record<string, string> = {
  portal_cliente:  "portal cliente",
  modulo_clientes: "módulo clientes",
  ocr_ia:          "OCR/IA",
  sistema:         "sistema",
};

/** Campos exibíveis em ordem de relevância. Outros campos são ignorados. */
const CAMPOS_VISIVEIS: { key: string; label: string }[] = [
  { key: "sistema",                   label: "SISTEMA" },
  { key: "tipo_arma",                 label: "TIPO" },
  { key: "marca",                     label: "MARCA" },
  { key: "modelo",                    label: "MODELO" },
  { key: "calibre",                   label: "CALIBRE" },
  { key: "numero_serie",              label: "Nº SÉRIE" },
  { key: "numero_craf",               label: "CRAF" },
  { key: "numero_sinarm",             label: "SINARM" },
  { key: "numero_sigma",              label: "SIGMA" },
  { key: "numero_autorizacao_compra", label: "AUT. COMPRA" },
  { key: "status_documental",         label: "STATUS DOC." },
  { key: "needs_review",              label: "PRECISA REVISÃO" },
  { key: "origem",                    label: "ORIGEM" },
];

const fmtVal = (v: any): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "SIM" : "NÃO";
  return String(v);
};

function buildDiff(ev: any): { key: string; label: string; antes: any; depois: any }[] {
  const antes = (ev?.dados_antes && typeof ev.dados_antes === "object") ? ev.dados_antes : null;
  const depois = (ev?.dados_depois && typeof ev.dados_depois === "object") ? ev.dados_depois : null;
  const camposAlt: string[] = Array.isArray(ev?.campos_alterados) ? ev.campos_alterados : [];
  const out: { key: string; label: string; antes: any; depois: any }[] = [];

  if (ev.acao === "criada") {
    // mostra campos não vazios do registro criado
    if (!depois) return out;
    for (const c of CAMPOS_VISIVEIS) {
      const v = (depois as any)[c.key];
      if (v !== null && v !== undefined && v !== "") {
        out.push({ key: c.key, label: c.label, antes: null, depois: v });
      }
    }
    return out;
  }
  if (ev.acao === "excluida") {
    if (!antes) return out;
    for (const c of CAMPOS_VISIVEIS) {
      const v = (antes as any)[c.key];
      if (v !== null && v !== undefined && v !== "") {
        out.push({ key: c.key, label: c.label, antes: v, depois: null });
      }
    }
    return out;
  }
  // editada / marcada_*
  const keys = camposAlt.length
    ? camposAlt
    : CAMPOS_VISIVEIS.map((c) => c.key).filter((k) =>
        antes && depois && (antes as any)[k] !== (depois as any)[k]
      );
  for (const k of keys) {
    const meta = CAMPOS_VISIVEIS.find((c) => c.key === k);
    if (!meta) continue; // ignora campos ruído (id, updated_at, qa_cliente_id, user_id, etc.)
    out.push({
      key: k,
      label: meta.label,
      antes: antes ? (antes as any)[k] : null,
      depois: depois ? (depois as any)[k] : null,
    });
  }
  return out;
}

export default function ArmaHistoricoBlock({ armaManualId, refreshKey }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!armaManualId) { setEvents([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("qa_cliente_armas_auditoria" as any)
          .select("id, acao, ator_tipo, origem, campos_alterados, dados_antes, dados_depois, created_at")
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
            <ul className="space-y-2">
              {events.map((ev) => {
                const cfg = ACAO_LABEL[ev.acao] || { label: ev.acao?.toUpperCase(), color: "hsl(220 10% 40%)" };
                const diff = buildDiff(ev);
                const isOpen = !!expanded[ev.id];
                const canExpand = diff.length > 0;
                return (
                  <li key={ev.id} className="rounded-md border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => canExpand && setExpanded((m) => ({ ...m, [ev.id]: !m[ev.id] }))}
                      className="w-full flex items-start gap-2 text-left px-2 py-1.5 text-[10.5px]"
                    >
                      <span
                        className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider shrink-0"
                        style={{ background: `${cfg.color}1A`, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-700">
                          <b>{ATOR_LABEL[ev.ator_tipo] || ev.ator_tipo}</b>
                          {ev.origem && <> · <span className="text-slate-500">{ORIGEM_LABEL[ev.origem] || ev.origem}</span></>}
                          <span className="text-slate-400"> · {fmtDateTime(ev.created_at)}</span>
                        </div>
                        {diff.length > 0 && !isOpen && (
                          <div className="text-slate-500 truncate">
                            {diff.length === 1
                              ? `${diff[0].label}: ${fmtVal(diff[0].antes)} → ${fmtVal(diff[0].depois)}`
                              : `${diff.length} campos alterados — clique para detalhar`}
                          </div>
                        )}
                      </div>
                      {canExpand && (
                        isOpen
                          ? <ChevronDown className="h-3 w-3 mt-1 text-slate-400 shrink-0" />
                          : <ChevronRight className="h-3 w-3 mt-1 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && diff.length > 0 && (
                      <div className="px-2 pb-2">
                        {/* Desktop: tabela. Mobile: lista empilhada. */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-[10.5px] border border-slate-200 rounded">
                            <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider">
                              <tr>
                                <th className="text-left px-2 py-1 font-semibold w-1/3">Campo</th>
                                <th className="text-left px-2 py-1 font-semibold">Antes</th>
                                <th className="text-left px-2 py-1 font-semibold">Depois</th>
                              </tr>
                            </thead>
                            <tbody>
                              {diff.map((d) => (
                                <tr key={d.key} className="border-t border-slate-200">
                                  <td className="px-2 py-1 font-semibold text-slate-700">{d.label}</td>
                                  <td className="px-2 py-1 text-slate-500 line-through decoration-slate-300">{fmtVal(d.antes)}</td>
                                  <td className="px-2 py-1 text-slate-800 font-medium">{fmtVal(d.depois)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="sm:hidden space-y-1.5">
                          {diff.map((d) => (
                            <div key={d.key} className="border border-slate-200 rounded p-1.5 text-[10.5px]">
                              <div className="text-[9px] uppercase tracking-wider font-bold text-slate-600">{d.label}</div>
                              <div className="text-slate-500 line-through decoration-slate-300 break-all">{fmtVal(d.antes)}</div>
                              <div className="text-slate-800 font-medium break-all">→ {fmtVal(d.depois)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
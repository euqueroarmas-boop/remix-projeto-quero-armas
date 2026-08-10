import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowUp, Inbox } from "lucide-react";
import { trilhaDoProcesso, trilhaCompacta } from "@/lib/quero-armas/trilhaChecklist";

/**
 * Painel editorial de progresso por cliente.
 * Lista TODOS os processos ativos (decisão do cliente), densa, sem cards.
 * Todas as colunas são ordenáveis.
 */

interface Row {
  processo_id: string;
  cliente_id: number;
  cliente_nome: string | null;
  servico_nome: string | null;
  fase: string;
  total_docs: number;
  entregues: number;
  proximo_doc: string | null;
  dias_parado: number;
  cobrancas: number;
  criado_em: string;
}

type SortKey = "cliente_nome" | "servico_nome" | "fase" | "progresso" | "proximo_doc" | "dias_parado" | "cobrancas" | "criado_em";

const COLS: { key: SortKey; label: string; className?: string }[] = [
  { key: "cliente_nome", label: "CLIENTE", className: "min-w-[180px]" },
  { key: "fase", label: "FASE", className: "w-[110px]" },
  { key: "progresso", label: "PROGRESSO", className: "w-[150px]" },
  { key: "proximo_doc", label: "PRÓXIMO DOCUMENTO", className: "min-w-[180px]" },
  { key: "criado_em", label: "ABERTO EM", className: "w-[100px]" },
  { key: "cobrancas", label: "COBRANÇAS", className: "w-[96px]" },
  { key: "dias_parado", label: "PARADO", className: "w-[84px]" },
];

function corSensor(d: number) {
  if (d >= 15) return "hsl(352 60% 38%)";
  if (d >= 7) return "hsl(38 80% 38%)";
  return "hsl(152 40% 32%)";
}

function fmtData(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

export default function DashboardProgressoClientes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("dias_parado");
  const [asc, setAsc] = useState(false);
  const [trilhas, setTrilhas] = useState<Record<string, string[]>>({});
  const [filtroTrilha, setFiltroTrilha] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc("qa_painel_progresso_clientes" as any);
        const lista = ((data as any[]) ?? []) as Row[];
        if (cancelled) return;
        setRows(lista);

        const ids = lista.map((r) => r.processo_id).filter(Boolean);
        if (ids.length > 0) {
          const { data: docs } = await supabase
            .from("qa_processo_documentos")
            .select("processo_id, tipo_documento")
            .in("processo_id", ids);
          const porProcesso: Record<string, string[]> = {};
          for (const d of ((docs as any[]) ?? [])) {
            (porProcesso[d.processo_id] ||= []).push(d.tipo_documento);
          }
          const mapa: Record<string, string[]> = {};
          for (const [pid, tipos] of Object.entries(porProcesso)) {
            mapa[pid] = trilhaDoProcesso(tipos);
          }
          if (!cancelled) setTrilhas(mapa);
        }
      } catch (e) {
        console.warn("[DashboardProgressoClientes]", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const trilhasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    Object.values(trilhas).forEach((ls) => ls.forEach((l) => set.add(l)));
    return [...set].sort();
  }, [trilhas]);

  const filtradas = useMemo(
    () => (filtroTrilha ? rows.filter((r) => (trilhas[r.processo_id] ?? []).includes(filtroTrilha)) : rows),
    [rows, trilhas, filtroTrilha],
  );

  const ordenadas = useMemo(() => {
    const val = (r: Row) => {
      switch (sortKey) {
        case "progresso": return r.total_docs > 0 ? r.entregues / r.total_docs : 0;
        case "dias_parado": return r.dias_parado;
        case "cobrancas": return r.cobrancas;
        case "criado_em": return new Date(r.criado_em).getTime();
        default: return String((r as any)[sortKey] ?? "").toLowerCase();
      }
    };
    return [...filtradas].sort((a, b) => {
      const va = val(a); const vb = val(b);
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * (asc ? 1 : -1);
    });
  }, [filtradas, sortKey, asc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setAsc(v => !v);
    else { setSortKey(k); setAsc(k === "cliente_nome" || k === "servico_nome" || k === "proximo_doc"); }
  };

  if (loading) return null;

  return (
    <div className="qa-card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <h3 className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-700">
          PROGRESSO DOS CLIENTES
        </h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-slate-500">
          {filtroTrilha ? `${filtradas.length} DE ${rows.length}` : `${rows.length} ATIVOS`}
        </span>
      </div>

      {trilhasDisponiveis.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-slate-300 mr-1">TRILHA</span>
          {trilhasDisponiveis.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFiltroTrilha((v) => (v === t ? null : t))}
              className={`shrink-0 text-[9px] uppercase tracking-[0.12em] px-2 py-1 rounded-full border transition-colors ${
                filtroTrilha === t
                  ? "border-slate-800 text-slate-800 font-bold"
                  : "border-slate-200 text-slate-400 hover:text-slate-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-[11px] uppercase tracking-wider text-slate-400 inline-flex items-center justify-center gap-2 w-full">
          <Inbox className="h-3.5 w-3.5" /> NENHUM PROCESSO ATIVO
        </div>
      ) : (
        <>
        {/* MOBILE: lista compacta */}
        <div className="md:hidden">
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {COLS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className={`shrink-0 inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] font-bold px-2 py-1 rounded-full border transition-colors ${
                  sortKey === c.key
                    ? "border-slate-800 text-slate-800"
                    : "border-slate-200 text-slate-400"
                }`}
              >
                {c.label}
                {sortKey === c.key && (asc ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)}
              </button>
            ))}
          </div>
          {ordenadas.map((r) => {
            const pct = r.total_docs > 0 ? Math.round((r.entregues / r.total_docs) * 100) : 0;
            return (
              <Link
                key={r.processo_id}
                to={`/quero-armas/clientes/${r.cliente_id}`}
                className="block px-4 py-3 border-b border-slate-50 active:bg-slate-50"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-semibold uppercase text-slate-800 truncate flex-1">
                    {r.cliente_nome ?? "—"}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: corSensor(r.dias_parado) }}>
                    {r.dias_parado}d
                  </span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 truncate">
                  {r.servico_nome ?? "—"}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-700 tabular-nums w-10">
                    {r.entregues}/{r.total_docs}
                  </span>
                  <div className="flex-1 h-[3px] bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "hsl(220 12% 45%)" }} />
                  </div>
                  <span className="text-[9.5px] uppercase tracking-wider text-slate-400">{r.fase}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] uppercase text-slate-500">
                  <span className="truncate flex-1">{r.proximo_doc ?? "—"}</span>
                  {r.cobrancas > 0 && (
                    <span className="shrink-0 tabular-nums text-slate-400">{r.cobrancas} COB.</span>
                  )}
                </div>
                {(trilhas[r.processo_id] ?? []).length > 0 && (
                  <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-slate-300 truncate">
                    {trilhaCompacta(trilhas[r.processo_id]).join(" · ")}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* DESKTOP: tabela */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                {COLS.map((c) => (
                  <th key={c.key} className={`px-3 py-2 text-left ${c.className ?? ""}`}>
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className="inline-flex items-center gap-1 text-[9.5px] uppercase tracking-[0.12em] font-bold text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {c.label}
                      {sortKey === c.key && (asc ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((r) => {
                const pct = r.total_docs > 0 ? Math.round((r.entregues / r.total_docs) * 100) : 0;
                return (
                  <tr key={r.processo_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-3 py-2.5">
                      <Link to={`/quero-armas/clientes/${r.cliente_id}`} className="block">
                        <div className="text-[12px] font-semibold uppercase text-slate-800 truncate">
                          {r.cliente_nome ?? "—"}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 truncate">
                          {r.servico_nome ?? "—"}
                        </div>
                        {(trilhas[r.processo_id] ?? []).length > 0 && (
                          <div className="text-[9px] uppercase tracking-[0.12em] text-slate-300 truncate">
                            {(trilhas[r.processo_id] ?? []).join(" · ")}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                      {r.fase}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-700 tabular-nums w-10">
                          {r.entregues}/{r.total_docs}
                        </span>
                        <div className="flex-1 h-[3px] bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "hsl(220 12% 45%)" }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] uppercase text-slate-600 truncate max-w-[220px]">
                      {r.proximo_doc ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-500 tabular-nums">
                      {fmtData(r.criado_em)}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-400 tabular-nums">
                      {r.cobrancas > 0 ? r.cobrancas : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] font-semibold tabular-nums" style={{ color: corSensor(r.dias_parado) }}>
                      {r.dias_parado}d
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <div className="px-4 py-2 border-t border-slate-100 text-[9.5px] uppercase tracking-[0.12em] text-slate-400">
        VERDE ATÉ 6 DIAS · AMARELO 7 A 14 · VERMELHO 15+ (COBRANÇA SEMANAL AUTOMÁTICA)
      </div>
    </div>
  );
}

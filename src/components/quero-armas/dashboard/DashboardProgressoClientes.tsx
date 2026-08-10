import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowUp, Inbox, Lock, CheckCircle2, Clock3, AlertTriangle, HelpCircle } from "lucide-react";
import { trilhaDoProcesso, trilhaCompacta, type DocTrilha } from "@/lib/quero-armas/trilhaChecklist";

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
  proximo_tipo?: string | null;
  dias_parado: number;
  cobrancas: number;
  criado_em: string;
  /** Espelho da área do cliente — já vinham da função e não eram exibidos. */
  grupo_atual?: string | null;
  grupo_total?: number | null;
  grupo_concluidos?: number | null;
  /** Leitura por grupos: em qual grupo está e quantos faltam. */
  grupos_total?: number | null;
  grupo_indice?: number | null;
  grupos_concluidos?: number | null;
  grupos_restantes?: number | null;
  documentos_pendentes?: number | null;
  perguntas_pendentes?: number | null;
  em_analise?: number | null;
  dispensados?: number | null;
  reaproveitados?: number | null;
  bloqueado_por_prerequisito?: boolean | null;
}

type SortKey = "cliente_nome" | "servico_nome" | "fase" | "progresso" | "proximo_doc" | "dias_parado" | "cobrancas" | "criado_em";

const COLS: { key: SortKey; label: string; className?: string }[] = [
  { key: "cliente_nome", label: "CLIENTE", className: "min-w-[220px]" },
  { key: "fase", label: "ETAPA ATUAL", className: "w-[190px]" },
  { key: "progresso", label: "PROGRESSO", className: "w-[190px]" },
  { key: "proximo_doc", label: "PRÓXIMO PASSO", className: "min-w-[200px]" },
  { key: "criado_em", label: "ABERTO EM", className: "w-[104px]" },
  { key: "cobrancas", label: "COBRANÇAS", className: "w-[96px]" },
  { key: "dias_parado", label: "PARADO", className: "w-[84px]" },
];

/* Cores semânticas travadas: verde = em dia, âmbar = atenção, vermelho = crítico. */
const VERDE = "#0F7A45";
const VERDE_BG = "#F1FAF4";
const AMBAR = "#8A6A17";
const AMBAR_BG = "#FDFAF1";
const VERMELHO = "#7A1F2B";
const VERMELHO_BG = "#FDF4F5";
const TINTA = "#0A0A0A";
const TINTA_2 = "#3A3A3A";
const TINTA_3 = "#6A6A6A";

type Saude = "ok" | "atencao" | "critico";

function saudeDe(d: number): Saude {
  if (d >= 15) return "critico";
  if (d >= 7) return "atencao";
  return "ok";
}

function corSensor(d: number) {
  const s = saudeDe(d);
  return s === "critico" ? VERMELHO : s === "atencao" ? AMBAR : VERDE;
}

function fundoSensor(d: number) {
  const s = saudeDe(d);
  return s === "critico" ? VERMELHO_BG : s === "atencao" ? AMBAR_BG : VERDE_BG;
}

function corProgresso(pct: number, dias: number) {
  if (pct >= 100) return VERDE;
  return corSensor(dias);
}

function Chip({
  children, cor, fundo, titulo,
}: { children: React.ReactNode; cor: string; fundo: string; titulo?: string }) {
  return (
    <span
      title={titulo}
      className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.1em] whitespace-nowrap"
      style={{ background: fundo, color: cor }}
    >
      {children}
    </span>
  );
}

type ContadorKey = "todos" | "pronto" | "analise" | "pendencia" | "parado" | "bloqueado";

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
  const [contador, setContador] = useState<ContadorKey>("todos");

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
          const [{ data: docs }, { data: procs }] = await Promise.all([
            supabase
              .from("qa_processo_documentos")
              .select("processo_id, tipo_documento, status")
              .in("processo_id", ids),
            supabase
              .from("qa_processos")
              .select("id, condicao_profissional")
              .in("id", ids),
          ]);
          const condicaoPorProcesso: Record<string, string | null> = {};
          for (const p of ((procs as any[]) ?? [])) condicaoPorProcesso[p.id] = p.condicao_profissional ?? null;

          const porProcesso: Record<string, DocTrilha[]> = {};
          for (const d of ((docs as any[]) ?? [])) {
            (porProcesso[d.processo_id] ||= []).push({ tipo: d.tipo_documento, status: d.status });
          }
          const mapa: Record<string, string[]> = {};
          for (const pid of ids) {
            mapa[pid] = trilhaDoProcesso(porProcesso[pid] ?? [], condicaoPorProcesso[pid]);
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

  const contadores = useMemo(() => {
    const pronto = rows.filter((r) => r.total_docs > 0 && r.entregues >= r.total_docs).length;
    const analise = rows.filter((r) => (r.em_analise ?? 0) > 0).length;
    const pendencia = rows.filter((r) => (r.documentos_pendentes ?? 0) + (r.perguntas_pendentes ?? 0) > 0).length;
    const parado = rows.filter((r) => r.dias_parado >= 15).length;
    const bloqueado = rows.filter((r) => !!r.bloqueado_por_prerequisito).length;
    return { todos: rows.length, pronto, analise, pendencia, parado, bloqueado };
  }, [rows]);

  const filtradas = useMemo(() => {
    let base = rows;
    if (filtroTrilha) base = base.filter((r) => (trilhas[r.processo_id] ?? []).includes(filtroTrilha));
    switch (contador) {
      case "pronto": base = base.filter((r) => r.total_docs > 0 && r.entregues >= r.total_docs); break;
      case "analise": base = base.filter((r) => (r.em_analise ?? 0) > 0); break;
      case "pendencia": base = base.filter((r) => (r.documentos_pendentes ?? 0) + (r.perguntas_pendentes ?? 0) > 0); break;
      case "parado": base = base.filter((r) => r.dias_parado >= 15); break;
      case "bloqueado": base = base.filter((r) => !!r.bloqueado_por_prerequisito); break;
      default: break;
    }
    return base;
  }, [rows, trilhas, filtroTrilha, contador]);

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
      <div className="px-4 py-3 border-b border-[#E4E4E4] flex items-center gap-2">
        <h3 className="text-[11.5px] uppercase tracking-[0.14em] font-bold" style={{ color: TINTA }}>
          PROGRESSO DOS CLIENTES
        </h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider font-bold" style={{ color: TINTA_3 }}>
          {filtradas.length === rows.length ? `${rows.length} ATIVOS` : `${filtradas.length} DE ${rows.length}`}
        </span>
      </div>

      {/* CONTADORES VISUAIS — clicáveis como filtro */}
      <div className="px-4 py-3 border-b border-[#E4E4E4] grid grid-cols-3 md:grid-cols-6 gap-2">
        {([
          { k: "todos", label: "ATIVOS", v: contadores.todos, cor: TINTA, fundo: "#F4F4F4" },
          { k: "pronto", label: "PRONTOS", v: contadores.pronto, cor: VERDE, fundo: VERDE_BG },
          { k: "analise", label: "EM ANÁLISE", v: contadores.analise, cor: AMBAR, fundo: AMBAR_BG },
          { k: "pendencia", label: "COM PENDÊNCIA", v: contadores.pendencia, cor: AMBAR, fundo: AMBAR_BG },
          { k: "parado", label: "PARADOS 15+", v: contadores.parado, cor: VERMELHO, fundo: VERMELHO_BG },
          { k: "bloqueado", label: "BLOQUEADOS", v: contadores.bloqueado, cor: VERMELHO, fundo: VERMELHO_BG },
        ] as { k: ContadorKey; label: string; v: number; cor: string; fundo: string }[]).map((c) => (
          <button
            key={c.k}
            type="button"
            onClick={() => setContador((v) => (v === c.k ? "todos" : c.k))}
            className={`rounded-sm border px-3 py-2 text-left transition-colors ${
              contador === c.k ? "border-[#0A0A0A]" : "border-[#E4E4E4] hover:border-[#BDBDBD]"
            }`}
            style={{ background: contador === c.k ? c.fundo : "#FFFFFF" }}
          >
            <div className="text-[18px] font-bold tabular-nums leading-none" style={{ color: c.cor }}>
              {c.v}
            </div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: TINTA_3 }}>
              {c.label}
            </div>
          </button>
        ))}
      </div>

      {trilhasDisponiveis.length > 0 && (
        <div className="px-4 py-2 border-b border-[#E4E4E4] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] mr-1" style={{ color: TINTA_3 }}>TRILHA</span>
          {trilhasDisponiveis.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFiltroTrilha((v) => (v === t ? null : t))}
              className={`shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full border transition-colors ${
                filtroTrilha === t
                  ? "border-[#0A0A0A] text-[#0A0A0A] font-bold bg-[#F4F4F4]"
                  : "border-[#DADADA] text-[#3A3A3A] hover:border-[#0A0A0A]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="px-4 py-6 text-center text-[11px] font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2 w-full" style={{ color: TINTA_3 }}>
          <Inbox className="h-3.5 w-3.5" /> NENHUM PROCESSO ATIVO
        </div>
      ) : (
        <>
        {/* MOBILE: lista compacta */}
        <div className="md:hidden">
          <div className="px-4 py-2 border-b border-[#E4E4E4] flex items-center gap-2 overflow-x-auto no-scrollbar">
            {COLS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className={`shrink-0 inline-flex items-center gap-1 text-[9.5px] uppercase tracking-[0.12em] font-bold px-2 py-1 rounded-full border transition-colors ${
                  sortKey === c.key
                    ? "border-[#0A0A0A] text-[#0A0A0A]"
                    : "border-[#DADADA] text-[#3A3A3A]"
                }`}
              >
                {c.label}
                {sortKey === c.key && (asc ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)}
              </button>
            ))}
          </div>
          {ordenadas.map((r) => {
            const pct = r.total_docs > 0 ? Math.round((r.entregues / r.total_docs) * 100) : 0;
            const pendencias = (r.documentos_pendentes ?? 0) + (r.perguntas_pendentes ?? 0);
            return (
              <Link
                key={r.processo_id}
                to={`/quero-armas/clientes/${r.cliente_id}`}
                className="block px-4 py-3 border-b border-[#EFEFEF] active:bg-[#FAFAFA]"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-bold uppercase truncate flex-1" style={{ color: TINTA }}>
                    {r.cliente_nome ?? "—"}
                  </span>
                  <Chip cor={corSensor(r.dias_parado)} fundo={fundoSensor(r.dias_parado)} titulo="Dias sem movimento">
                    {r.dias_parado}d
                  </Chip>
                </div>
                <div className="text-[10px] font-medium uppercase tracking-wider truncate" style={{ color: TINTA_3 }}>
                  {r.servico_nome ?? "—"}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11.5px] font-bold tabular-nums w-12" style={{ color: TINTA }}>
                    {r.entregues}/{r.total_docs}
                  </span>
                  <div className="flex-1 h-[6px] bg-[#EDEDED] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: corProgresso(pct, r.dias_parado) }} />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: TINTA_2 }}>{pct}%</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {r.bloqueado_por_prerequisito ? (
                    <Chip cor={VERMELHO} fundo={VERMELHO_BG}><Lock className="h-3 w-3" />AGUARDA ETAPA ANTERIOR</Chip>
                  ) : (
                    <Chip cor={TINTA} fundo="#F4F4F4">
                      {r.grupo_atual ?? r.fase}
                      {(r.grupo_total ?? 0) > 0 ? ` ${r.grupo_concluidos ?? 0}/${r.grupo_total}` : ""}
                    </Chip>
                  )}
                  {(r.em_analise ?? 0) > 0 && <Chip cor={AMBAR} fundo={AMBAR_BG}><Clock3 className="h-3 w-3" />{r.em_analise} EM ANÁLISE</Chip>}
                  {pendencias > 0 && <Chip cor={VERMELHO} fundo={VERMELHO_BG}><AlertTriangle className="h-3 w-3" />{pendencias} PENDENTE(S)</Chip>}
                  {pct >= 100 && <Chip cor={VERDE} fundo={VERDE_BG}><CheckCircle2 className="h-3 w-3" />PRONTO</Chip>}
                  {r.cobrancas > 0 && <Chip cor={TINTA_2} fundo="#F4F4F4">{r.cobrancas} COB.</Chip>}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-medium uppercase" style={{ color: TINTA_2 }}>
                  {r.proximo_tipo === "pergunta" && <HelpCircle className="h-3 w-3 shrink-0" />}
                  <span className="truncate flex-1">{r.proximo_doc ?? "—"}</span>
                </div>
                {(trilhas[r.processo_id] ?? []).length > 0 && (
                  <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] truncate" style={{ color: TINTA_3 }}>
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
              <tr className="border-b border-[#DADADA] bg-[#FAFAFA]">
                {COLS.map((c) => (
                  <th key={c.key} className={`px-3 py-2 text-left ${c.className ?? ""}`}>
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-bold text-[#3A3A3A] hover:text-[#0A0A0A] transition-colors"
                    >
                      {c.label}
                      {sortKey === c.key && (asc ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((r, i) => {
                const pct = r.total_docs > 0 ? Math.round((r.entregues / r.total_docs) * 100) : 0;
                const pendencias = (r.documentos_pendentes ?? 0) + (r.perguntas_pendentes ?? 0);
                return (
                  <tr
                    key={r.processo_id}
                    className="border-b border-[#EFEFEF] hover:bg-[#F6F6F6]"
                    style={{ background: i % 2 === 1 ? "#FCFCFC" : "#FFFFFF" }}
                  >
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-[6px] h-2 w-2 shrink-0 rounded-full"
                          style={{ background: corSensor(r.dias_parado) }}
                          title="Sinalizador de movimento"
                        />
                      <Link to={`/quero-armas/clientes/${r.cliente_id}`} className="block">
                        <div className="text-[12.5px] font-bold uppercase truncate" style={{ color: TINTA }}>
                          {r.cliente_nome ?? "—"}
                        </div>
                        <div className="text-[10.5px] font-medium uppercase tracking-wider truncate" style={{ color: TINTA_2 }}>
                          {r.servico_nome ?? "—"}
                        </div>
                        {(trilhas[r.processo_id] ?? []).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(trilhas[r.processo_id] ?? []).map((t) => (
                              <span
                                key={t}
                                className="rounded-full border border-[#DADADA] px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-[0.1em]"
                                style={{ color: TINTA_3 }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </Link>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {r.bloqueado_por_prerequisito ? (
                        <Chip cor={VERMELHO} fundo={VERMELHO_BG}><Lock className="h-3 w-3" />AGUARDA ETAPA ANTERIOR</Chip>
                      ) : (
                        <div className="space-y-1">
                          <Chip cor={TINTA} fundo="#F4F4F4">{r.grupo_atual ?? r.fase}</Chip>
                          {(r.grupo_total ?? 0) > 0 && (
                            <div className="text-[10px] font-bold tabular-nums" style={{ color: TINTA_2 }}>
                              {r.grupo_concluidos ?? 0} de {r.grupo_total} nesta etapa
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] font-bold tabular-nums w-12" style={{ color: TINTA }}>
                          {r.entregues}/{r.total_docs}
                        </span>
                        <div className="flex-1 h-[6px] bg-[#EDEDED] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: corProgresso(pct, r.dias_parado) }} />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums w-8 text-right" style={{ color: TINTA_2 }}>{pct}%</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {pct >= 100 && <Chip cor={VERDE} fundo={VERDE_BG}><CheckCircle2 className="h-3 w-3" />PRONTO</Chip>}
                        {(r.em_analise ?? 0) > 0 && <Chip cor={AMBAR} fundo={AMBAR_BG}><Clock3 className="h-3 w-3" />{r.em_analise} EM ANÁLISE</Chip>}
                        {pendencias > 0 && <Chip cor={VERMELHO} fundo={VERMELHO_BG}><AlertTriangle className="h-3 w-3" />{pendencias} PENDENTE(S)</Chip>}
                        {(r.perguntas_pendentes ?? 0) > 0 && <Chip cor={AMBAR} fundo={AMBAR_BG}><HelpCircle className="h-3 w-3" />{r.perguntas_pendentes} CADASTRO</Chip>}
                        {((r.dispensados ?? 0) + (r.reaproveitados ?? 0)) > 0 && (
                          <Chip cor={TINTA_3} fundo="#F4F4F4" titulo="Dispensados / reaproveitados">
                            {(r.dispensados ?? 0) + (r.reaproveitados ?? 0)} DISP./REAP.
                          </Chip>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-[11.5px] font-medium uppercase max-w-[240px]" style={{ color: TINTA }}>
                      <span className="inline-flex items-start gap-1.5">
                        {r.proximo_tipo === "pergunta" && <HelpCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" style={{ color: AMBAR }} />}
                        <span className="truncate">{r.proximo_doc ?? "—"}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top text-[11.5px] tabular-nums" style={{ color: TINTA_2 }}>
                      {fmtData(r.criado_em)}
                    </td>
                    <td className="px-3 py-3 align-top text-[11.5px] font-semibold tabular-nums" style={{ color: (r.cobrancas ?? 0) > 0 ? VERMELHO : TINTA_3 }}>
                      {r.cobrancas > 0 ? r.cobrancas : "—"}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <Chip cor={corSensor(r.dias_parado)} fundo={fundoSensor(r.dias_parado)} titulo="Dias sem movimento">
                        {r.dias_parado}d
                      </Chip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <div className="px-4 py-2.5 border-t border-[#E4E4E4] flex flex-wrap items-center gap-3 text-[9.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: TINTA_2 }}>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: VERDE }} />ATÉ 6 DIAS</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: AMBAR }} />7 A 14 DIAS</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: VERMELHO }} />15+ (COBRANÇA SEMANAL AUTOMÁTICA)</span>
      </div>
    </div>
  );
}

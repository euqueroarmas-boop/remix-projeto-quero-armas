/**
 * FASE 5 + FASE 7 — Painel administrativo de revisão de arsenal.
 *
 * Lê a view `qa_cliente_armas` (CRAFs + manuais/IA consolidados) e permite:
 *  - Visualizar tudo separado por fonte (CRAF · MANUAL · IA/OCR).
 *  - Editar (apenas armas vindas de `qa_cliente_armas_manual`).
 *  - Marcar como revisado quando `needs_review = true`.
 *
 * Armas com `fonte = craf` são SOMENTE LEITURA nesta fase (não toca em qa_crafs).
 *
 * FASE 7:
 *  - Resumo no topo (total / CRAF / Manual-IA / revisão).
 *  - Filtros: TODAS · PRECISA REVISÃO · MANUAL/IA · CRAF · SINARM · SIGMA.
 *  - Armas com needs_review aparecem no topo, com card alaranjado e botão destacado.
 *  - Badges padronizados (FONTE / STATUS / SISTEMA).
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Crosshair, Edit, Lock, AlertTriangle, RefreshCw, Search, History, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import ArmaManualEditModal from "@/components/quero-armas/arsenal/ArmaManualEditModal";

interface Props {
  qaClienteId: number;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
};

function FonteBadge({ fonte }: { fonte: string }) {
  const cfg = (() => {
    switch ((fonte || "").toLowerCase()) {
      case "craf":   return { label: "CRAF",   bg: "hsl(220 80% 56% / 0.10)", color: "hsl(220 80% 40%)" };
      case "manual": return { label: "MANUAL", bg: "hsl(262 60% 55% / 0.10)", color: "hsl(262 60% 40%)" };
      case "ocr":
      case "ia":     return { label: "IA/OCR", bg: "hsl(190 80% 42% / 0.12)", color: "hsl(190 80% 32%)" };
      default:       return { label: (fonte || "?").toUpperCase(), bg: "hsl(220 13% 92%)", color: "hsl(220 10% 40%)" };
    }
  })();
  return (
    <span
      className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function StatusBadge({ readonly, needsReview }: { readonly: boolean; needsReview: boolean }) {
  if (needsReview) {
    return (
      <span
        className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"
        style={{ background: "hsl(38 92% 50% / 0.18)", color: "hsl(28 92% 32%)" }}
      >
        <AlertTriangle className="h-2.5 w-2.5" /> PRECISA REVISÃO
      </span>
    );
  }
  if (readonly) {
    return (
      <span
        className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider"
        style={{ background: "hsl(220 13% 92%)", color: "hsl(220 10% 35%)" }}
      >
        SOMENTE LEITURA
      </span>
    );
  }
  return (
    <span
      className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider"
      style={{ background: "hsl(152 60% 38% / 0.12)", color: "hsl(152 60% 28%)" }}
    >
      EDITÁVEL
    </span>
  );
}

type FiltroKey = "todas" | "revisao" | "manual_ia" | "craf" | "sinarm" | "sigma";

export default function ClienteArsenalReview({ qaClienteId }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [filtro, setFiltro] = useState<FiltroKey>("todas");
  const [busca, setBusca] = useState("");
  const [visiveis, setVisiveis] = useState(10);
  const PAGE = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("qa_cliente_armas" as any)
        .select("*")
        .eq("qa_cliente_id", qaClienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data as any[]) ?? []);
    } catch (e) {
      console.error("[ClienteArsenalReview] load error", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [qaClienteId]);

  useEffect(() => { void load(); }, [load]);

  // Resetar paginação ao mudar filtro/busca
  useEffect(() => { setVisiveis(PAGE); }, [filtro, busca]);

  const handleEdit = async (row: any) => {
    if (row.fonte === "craf") return;
    // arma_uid no formato "manual:<id>" / "ocr:<id>"
    const id = String(row.arma_uid || "").split(":")[1];
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("qa_cliente_armas_manual" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return;
      setEditing(data);
      setEditOpen(true);
    } catch (e) {
      console.error("[ClienteArsenalReview] fetch arma error", e);
    }
  };

  const totalCraf = rows.filter((r) => r.fonte === "craf").length;
  const totalManual = rows.filter((r) => r.fonte === "manual" || r.fonte === "ocr" || r.fonte === "ia").length;
  const totalReview = rows.filter((r) => r.needs_review).length;
  const total = rows.length;

  const filtered = useMemo(() => {
    let arr = rows;
    switch (filtro) {
      case "revisao":   arr = rows.filter((r) => r.needs_review); break;
      case "manual_ia": arr = rows.filter((r) => r.fonte === "manual" || r.fonte === "ocr" || r.fonte === "ia"); break;
      case "craf":      arr = rows.filter((r) => r.fonte === "craf"); break;
      case "sinarm":    arr = rows.filter((r) => (r.sistema || "").toUpperCase() === "SINARM"); break;
      case "sigma":     arr = rows.filter((r) => (r.sistema || "").toUpperCase() === "SIGMA"); break;
      default: break;
    }
    // FASE 8 — busca textual
    const q = busca.trim().toLowerCase();
    if (q) {
      arr = arr.filter((r) => {
        const hay = [
          r.marca, r.modelo, r.calibre, r.tipo_arma,
          r.numero_serie, r.numero_craf, r.numero_sinarm, r.numero_sigma,
          r.numero_autorizacao_compra, r.sistema, r.fonte, r.status_documental,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    // Ordenação: needs_review primeiro, depois mais recentes
    return [...arr].sort((a, b) => {
      if (!!b.needs_review !== !!a.needs_review) return b.needs_review ? 1 : -1;
      const da = a.created_at ? +new Date(a.created_at) : 0;
      const db = b.created_at ? +new Date(b.created_at) : 0;
      return db - da;
    });
  }, [rows, filtro, busca]);

  const visibleRows = filtered.slice(0, visiveis);
  const hasFilterOrSearch = filtro !== "todas" || busca.trim().length > 0;
  const limparFiltros = () => { setFiltro("todas"); setBusca(""); };

  const FILTROS: { key: FiltroKey; label: string; count: number }[] = [
    { key: "todas",     label: "TODAS",            count: total },
    { key: "revisao",   label: "PRECISA REVISÃO",  count: totalReview },
    { key: "manual_ia", label: "MANUAL/IA",        count: totalManual },
    { key: "craf",      label: "CRAF",             count: totalCraf },
    { key: "sinarm",    label: "SINARM",           count: rows.filter((r) => (r.sistema || "").toUpperCase() === "SINARM").length },
    { key: "sigma",     label: "SIGMA",            count: rows.filter((r) => (r.sistema || "").toUpperCase() === "SIGMA").length },
  ];

  return (
    <div className="qa-card p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(190 80% 42% / 0.12)" }}>
            <Crosshair className="h-3.5 w-3.5" style={{ color: "hsl(190 80% 42%)" }} />
          </div>
          <h3 className="text-[11px] uppercase tracking-[0.14em] font-bold" style={{ color: "hsl(190 80% 42%)" }}>
            Arsenal — Revisão Administrativa
          </h3>
        </div>
        <button onClick={load} className="text-[10px] flex items-center gap-1 hover:underline" style={{ color: "hsl(220 10% 50%)" }}>
          <RefreshCw className="h-3 w-3" /> ATUALIZAR
        </button>
      </div>

      {/* FASE 7 — Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3 text-[10px]">
        <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Total</div>
          <div className="text-[14px] font-bold text-slate-800">{total}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">CRAF (R/O)</div>
          <div className="text-[14px] font-bold" style={{ color: "hsl(220 80% 40%)" }}>{totalCraf}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Manual/IA</div>
          <div className="text-[14px] font-bold" style={{ color: "hsl(262 60% 40%)" }}>{totalManual}</div>
        </div>
        <div
          className="rounded-md border px-2 py-1.5"
          style={{
            background: totalReview > 0 ? "hsl(38 92% 50% / 0.10)" : "white",
            borderColor: totalReview > 0 ? "hsl(38 92% 50% / 0.40)" : "hsl(220 13% 90%)",
          }}
        >
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Revisão</div>
          <div className="text-[14px] font-bold" style={{ color: totalReview > 0 ? "hsl(28 92% 32%)" : "hsl(220 10% 50%)" }}>
            {totalReview}
          </div>
        </div>
      </div>

      {/* FASE 7 — Filtros */}
      <div className="flex flex-wrap gap-1 mb-3">
        {FILTROS.map((f) => {
          const active = filtro === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition ${
                active
                  ? "bg-[#7A1F2B] text-white border-[#7A1F2B]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {f.label} <span className={active ? "opacity-80" : "text-slate-400"}>({f.count})</span>
            </button>
          );
        })}
      </div>

      {/* FASE 8 — Busca textual */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar marca, modelo, calibre, série, CRAF, SINARM, SIGMA…"
          className="w-full h-8 pl-7 pr-7 rounded-md border border-slate-200 bg-white text-[11px] placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* FASE 8 — Contador do filtro ativo */}
      {!loading && (
        <div className="text-[10px] text-slate-500 mb-2">
          Exibindo <b className="text-slate-700">{Math.min(visibleRows.length, filtered.length)}</b> de{" "}
          <b className="text-slate-700">{total}</b> armas
          {filtered.length !== total && <> (filtradas: <b className="text-slate-700">{filtered.length}</b>)</>}
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>Carregando arsenal…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
          {hasFilterOrSearch ? (
            <>
              <div className="mb-2">Nenhuma arma encontrada com esses critérios.</div>
              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={limparFiltros}>
                LIMPAR FILTROS
              </Button>
            </>
          ) : (
            <>Nenhuma arma cadastrada.</>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {visibleRows.map((r) => {
            const readonly = r.fonte === "craf";
            const labelArma = [r.marca, r.modelo, r.calibre].filter(Boolean).join(" ").toUpperCase() || "ARMA SEM IDENTIFICAÇÃO";
            return (
              <div
                key={r.arma_uid}
                className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${
                  r.needs_review
                    ? "bg-amber-50/60 border-amber-300 ring-1 ring-amber-200"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <FonteBadge fonte={r.fonte} />
                    {r.sistema && (
                      <span className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase" style={{ background: "hsl(220 13% 94%)", color: "hsl(220 10% 35%)" }}>
                        {r.sistema}
                      </span>
                    )}
                    <StatusBadge readonly={readonly} needsReview={!!r.needs_review} />
                  </div>
                  <div className="text-[12px] font-semibold mt-1" style={{ color: "hsl(220 20% 18%)" }}>
                    {labelArma}
                  </div>
                  <div className="text-[10px] mt-0.5 grid grid-cols-2 gap-x-3 gap-y-0.5" style={{ color: "hsl(220 10% 50%)" }}>
                    {r.tipo_arma && <span>Tipo: <b className="text-slate-700">{r.tipo_arma}</b></span>}
                    {r.numero_serie && <span>Sér.: <b className="text-slate-700">{r.numero_serie}</b></span>}
                    {r.numero_craf && <span>CRAF: <b className="text-slate-700">{r.numero_craf}</b></span>}
                    {r.numero_sinarm && <span>SINARM: <b className="text-slate-700">{r.numero_sinarm}</b></span>}
                    {r.numero_sigma && <span>SIGMA: <b className="text-slate-700">{r.numero_sigma}</b></span>}
                    {r.numero_autorizacao_compra && <span>Aut.Compra: <b className="text-slate-700">{r.numero_autorizacao_compra}</b></span>}
                    {r.status_documental && <span>Status: <b className="text-slate-700">{r.status_documental}</b></span>}
                    {r.created_at && <span>Criada: <b className="text-slate-700">{fmtDate(r.created_at)}</b></span>}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col gap-1 items-end">
                  {readonly ? (
                    <span title="CRAFs são somente leitura nesta fase" className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                      <Lock className="h-3 w-3" /> R/O
                    </span>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant={r.needs_review ? "default" : "outline"}
                        className={`h-7 px-2 text-[10px] ${
                          r.needs_review ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" : ""
                        }`}
                        onClick={() => handleEdit(r)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        {r.needs_review ? "REVISAR" : "EDITAR"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleEdit(r)}
                        className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800"
                        title="Abrir histórico no modal de edição"
                      >
                        <History className="h-3 w-3" /> HISTÓRICO
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* FASE 8 — Mostrar mais */}
          {filtered.length > visibleRows.length && (
            <div className="pt-2 flex justify-center">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-[10px]"
                onClick={() => setVisiveis((v) => v + PAGE)}
              >
                MOSTRAR MAIS ({filtered.length - visibleRows.length} restantes)
              </Button>
            </div>
          )}
        </div>
      )}

      <ArmaManualEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        arma={editing}
        onSaved={async () => { await load(); }}
      />
    </div>
  );
}
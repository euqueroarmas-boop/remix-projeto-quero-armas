/**
 * FASE 5 — Painel administrativo de revisão de arsenal.
 *
 * Lê a view `qa_cliente_armas` (CRAFs + manuais/IA consolidados) e permite:
 *  - Visualizar tudo separado por fonte (CRAF · MANUAL · IA/OCR).
 *  - Editar (apenas armas vindas de `qa_cliente_armas_manual`).
 *  - Marcar como revisado quando `needs_review = true`.
 *
 * Armas com `fonte = craf` são SOMENTE LEITURA nesta fase (não toca em qa_crafs).
 */
import { useEffect, useState, useCallback } from "react";
import { Crosshair, Edit, Lock, AlertTriangle, RefreshCw } from "lucide-react";
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

export default function ClienteArsenalReview({ qaClienteId }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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

      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px]">
        <span className="px-2 py-0.5 rounded-full font-bold" style={{ background: "hsl(220 80% 56% / 0.10)", color: "hsl(220 80% 40%)" }}>
          {totalCraf} CRAF (somente leitura)
        </span>
        <span className="px-2 py-0.5 rounded-full font-bold" style={{ background: "hsl(262 60% 55% / 0.10)", color: "hsl(262 60% 40%)" }}>
          {totalManual} Manual/IA (editável)
        </span>
        {totalReview > 0 && (
          <span className="px-2 py-0.5 rounded-full font-bold" style={{ background: "hsl(38 92% 50% / 0.15)", color: "hsl(28 92% 35%)" }}>
            {totalReview} PRECISA REVISÃO
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-6 text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>Carregando arsenal…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-6 text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>Nenhuma arma cadastrada.</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const readonly = r.fonte === "craf";
            const labelArma = [r.marca, r.modelo, r.calibre].filter(Boolean).join(" ").toUpperCase() || "ARMA SEM IDENTIFICAÇÃO";
            return (
              <div
                key={r.arma_uid}
                className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${r.needs_review ? "bg-amber-50/60 border-amber-200/70" : "bg-white border-slate-200"}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <FonteBadge fonte={r.fonte} />
                    {r.sistema && (
                      <span className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase" style={{ background: "hsl(220 13% 94%)", color: "hsl(220 10% 35%)" }}>
                        {r.sistema}
                      </span>
                    )}
                    {r.needs_review && (
                      <span className="px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ background: "hsl(38 92% 50% / 0.15)", color: "hsl(28 92% 35%)" }}>
                        <AlertTriangle className="h-2.5 w-2.5" /> PRECISA REVISÃO
                      </span>
                    )}
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
                <div className="shrink-0">
                  {readonly ? (
                    <span title="CRAFs são somente leitura nesta fase" className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                      <Lock className="h-3 w-3" /> R/O
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => handleEdit(r)}>
                      <Edit className="h-3 w-3 mr-1" /> EDITAR
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
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
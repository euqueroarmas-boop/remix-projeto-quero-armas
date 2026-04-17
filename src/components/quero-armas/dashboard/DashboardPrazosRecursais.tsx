/**
 * Dashboard — Prazos Recursais (PF: Posse e Porte)
 *
 * Regra fiscal/processual:
 * - Quando um item de venda (Posse OU Porte na Polícia Federal) é marcado
 *   como INDEFERIDO, abre-se prazo de 10 DIAS CORRIDOS para protocolar
 *   recurso administrativo (Lei 9.784/99 art. 59 + Decreto 9.847/19 art. 10).
 * - O contador para quando o usuário preenche `data_recurso_administrativo`
 *   no item (ou quando o status muda para algo diferente de INDEFERIDO).
 * - Cores: 🟢 > 5d · 🟡 ≤ 5d · 🔴 ≤ 2d · ⚫ vencido (perdeu o prazo).
 *
 * Linha do tempo visual: barra de progresso indicando posição entre
 * a data do indeferimento e o limite (10 dias após).
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Scale, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ItemRow {
  id: number;
  venda_id: number;
  servico_id: number | null;
  status: string | null;
  data_indeferimento: string | null;
  data_recurso_administrativo: string | null;
}
interface VendaRow { id: number; cliente_id: number | null; }
interface ClienteRow { id: number; id_legado: number | null; nome_completo: string | null; }
interface ServicoRow { id: number; nome_servico: string | null; }

interface PrazoRow {
  itemId: number;
  vendaId: number;
  clienteId: number | null;
  clienteIdLegado: number | null;
  clienteNome: string;
  servicoNome: string;
  tipo: "Posse" | "Porte";
  dataIndeferimento: string;          // ISO
  dataLimite: string;                 // ISO (indef + 10d)
  diasRestantes: number;              // pode ser negativo (vencido)
  progresso: number;                  // 0..1 (0=acabou de indeferir, 1=hoje é o limite)
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function diffDays(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00").getTime();
  const b = new Date(toISO + "T00:00:00").getTime();
  return Math.floor((b - a) / 86_400_000);
}
function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Classifica Posse/Porte na PF pelo nome do serviço. */
function classifyPF(nome: string): "Posse" | "Porte" | null {
  const n = (nome || "").toLowerCase();
  const isPF = n.includes("polícia federal") || n.includes("policia federal") || n.includes("pf");
  if (!isPF) return null;
  if (n.includes("posse")) return "Posse";
  if (n.includes("porte")) return "Porte";
  return null;
}

function toneFor(dias: number) {
  if (dias < 0)  return { bar: "bg-slate-800", text: "text-slate-700", border: "border-slate-300", bg: "bg-slate-100/80", label: "VENCIDO" };
  if (dias <= 2) return { bar: "bg-rose-600",  text: "text-rose-700",  border: "border-rose-200",  bg: "bg-rose-50/60",   label: "CRÍTICO" };
  if (dias <= 5) return { bar: "bg-amber-500", text: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50/60",  label: "ATENÇÃO" };
  return            { bar: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50/40", label: "EM PRAZO" };
}

export default function DashboardPrazosRecursais() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PrazoRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) itens INDEFERIDOS sem recurso protocolado
        const { data: itens, error: e1 } = await supabase
          .from("qa_itens_venda" as any)
          .select("id, venda_id, servico_id, status, data_indeferimento, data_recurso_administrativo")
          .ilike("status", "INDEFERIDO")
          .is("data_recurso_administrativo", null)
          .not("data_indeferimento", "is", null);
        if (e1) throw e1;
        const itensList = (itens || []) as unknown as ItemRow[];
        if (!itensList.length) { if (!cancelled) { setRows([]); setLoading(false); } return; }

        // 2) carrega vendas, clientes e serviços relacionados
        const vendaIds = Array.from(new Set(itensList.map(i => i.venda_id)));
        const servicoIds = Array.from(new Set(itensList.map(i => i.servico_id).filter(Boolean) as number[]));

        const [vendasRes, servicosRes] = await Promise.all([
          supabase.from("qa_vendas" as any).select("id, cliente_id").in("id", vendaIds as any),
          servicoIds.length
            ? supabase.from("qa_servicos" as any).select("id, nome_servico").in("id", servicoIds as any)
            : Promise.resolve({ data: [] as any[], error: null }),
        ]);
        const vendas = ((vendasRes as any).data || []) as VendaRow[];
        const servicos = ((servicosRes as any).data || []) as ServicoRow[];

        const clienteIds = Array.from(new Set(vendas.map(v => v.cliente_id).filter(Boolean) as number[]));
        const { data: clientesData } = clienteIds.length
          ? await supabase.from("qa_clientes" as any).select("id, id_legado, nome_completo").in("id", clienteIds as any)
          : { data: [] as any[] };
        const clientes = (clientesData || []) as ClienteRow[];

        const vMap = new Map(vendas.map(v => [v.id, v]));
        const cMap = new Map(clientes.map(c => [c.id, c]));
        const sMap = new Map(servicos.map(s => [s.id, s]));

        const today = todayISO();
        const built: PrazoRow[] = [];
        for (const it of itensList) {
          const servico = it.servico_id ? sMap.get(it.servico_id) : null;
          const tipo = classifyPF(servico?.nome_servico || "");
          if (!tipo) continue; // só PF: Posse ou Porte

          const dIndef = it.data_indeferimento!;
          const dLimite = addDaysISO(dIndef, 10);
          const diasRestantes = diffDays(today, dLimite);
          const total = 10;
          const consumido = Math.min(total, Math.max(0, diffDays(dIndef, today)));
          const progresso = Math.min(1, Math.max(0, consumido / total));

          const venda = vMap.get(it.venda_id);
          const cliente = venda?.cliente_id ? cMap.get(venda.cliente_id) : null;

          built.push({
            itemId: it.id,
            vendaId: it.venda_id,
            clienteId: cliente?.id ?? null,
            clienteIdLegado: cliente?.id_legado ?? null,
            clienteNome: cliente?.nome_completo || `Cliente #${venda?.cliente_id ?? "—"}`,
            servicoNome: servico?.nome_servico || "—",
            tipo,
            dataIndeferimento: dIndef,
            dataLimite: dLimite,
            diasRestantes,
            progresso,
          });
        }

        // ordena: mais urgente primeiro (vencidos no topo, depois menor diasRestantes)
        built.sort((a, b) => a.diasRestantes - b.diasRestantes);
        if (!cancelled) { setRows(built); setLoading(false); }
      } catch (err) {
        console.error("[DashboardPrazosRecursais]", err);
        if (!cancelled) { setRows([]); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const vencidos = rows.filter(r => r.diasRestantes < 0).length;
    const criticos = rows.filter(r => r.diasRestantes >= 0 && r.diasRestantes <= 2).length;
    const atencao = rows.filter(r => r.diasRestantes > 2 && r.diasRestantes <= 5).length;
    return { vencidos, criticos, atencao, total: rows.length };
  }, [rows]);

  if (loading) {
    return (
      <div className="qa-card p-6 flex items-center justify-center text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-xs">Carregando prazos recursais…</span>
      </div>
    );
  }

  if (!rows.length) return null; // não polui a dashboard quando não há prazos abertos

  return (
    <div className="qa-card p-5 border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-slate-700" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
            Recursos Administrativos — Prazo de 10 dias (PF)
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {stats.vencidos > 0 && (
            <span className="text-[10px] font-bold px-2 py-1 bg-slate-800 text-white rounded">
              {stats.vencidos} VENCIDO{stats.vencidos > 1 ? "S" : ""}
            </span>
          )}
          {stats.criticos > 0 && (
            <span className="text-[10px] font-bold px-2 py-1 bg-rose-100 text-rose-700 rounded">
              {stats.criticos} CRÍTICO{stats.criticos > 1 ? "S" : ""}
            </span>
          )}
          {stats.atencao > 0 && (
            <span className="text-[10px] font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded">
              {stats.atencao} ATENÇÃO
            </span>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 mb-4">
        Após o indeferimento, há <strong>10 dias corridos</strong> para protocolar recurso administrativo
        (Lei 9.784/99, art. 59 + Decreto 9.847/19). O contador para automaticamente quando você preencher a
        “Data do Recurso Administrativo” no item.
      </p>

      <div className="space-y-3">
        {rows.map(r => {
          const tone = toneFor(r.diasRestantes);
          const linkCliente = r.clienteIdLegado
            ? `/quero-armas/clientes?cliente=${r.clienteIdLegado}`
            : `/quero-armas/clientes`;
          return (
            <Link
              key={r.itemId}
              to={linkCliente}
              className={`block border ${tone.border} ${tone.bg} rounded-lg p-3 hover:shadow-sm transition-shadow`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                    {r.diasRestantes < 0 && <AlertTriangle className="h-3.5 w-3.5 text-slate-700 shrink-0" />}
                    {r.clienteNome}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {r.tipo} PF · Indeferido em {fmtBR(r.dataIndeferimento)}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className={`text-2xl font-black leading-none ${tone.text}`}>
                    {r.diasRestantes < 0 ? Math.abs(r.diasRestantes) : r.diasRestantes}
                  </div>
                  <div className={`text-[10px] uppercase font-bold ${tone.text}`}>
                    {r.diasRestantes < 0 ? "dias vencidos" : "dias restantes"}
                  </div>
                </div>
              </div>

              {/* Barra de progresso 10 dias */}
              <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full ${tone.bar} transition-all`}
                  style={{ width: `${Math.round(r.progresso * 100)}%` }}
                />
                <div
                  className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 ${tone.bar.replace("bg-", "border-")} shadow`}
                  style={{ left: `calc(${Math.round(r.progresso * 100)}% - 6px)` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>{fmtBR(r.dataIndeferimento)}</span>
                <span className={`font-bold ${tone.text}`}>HOJE</span>
                <span>{fmtBR(r.dataLimite)} (limite)</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

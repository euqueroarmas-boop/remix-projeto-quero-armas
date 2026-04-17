/**
 * Dashboard — Prazos Recursais (PF: Posse e Porte)
 *
 * IMPORTANTE: qa_itens_venda.venda_id referencia qa_vendas.id_legado (NÃO id).
 *
 * Regra: item INDEFERIDO de Posse/Porte na PF abre prazo de 10 dias corridos
 * para protocolar recurso (Lei 9.784/99 art. 59 + Decreto 9.847/19 art. 10).
 * Contador para quando data_recurso_administrativo é preenchida.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ItemRow {
  id: number;
  venda_id: number;            // refere qa_vendas.id_legado
  servico_id: number | null;
  status: string | null;
  data_indeferimento: string | null;
  data_recurso_administrativo: string | null;
}
interface VendaRow { id: number; id_legado: number | null; cliente_id: number | null; }
interface ClienteRow { id: number; id_legado: number | null; nome_completo: string | null; }
interface ServicoRow { id: number; nome_servico: string | null; }

interface PrazoRow {
  itemId: number;
  clienteId: number | null;
  clienteIdLegado: number | null;
  clienteNome: string;
  tipo: "Posse" | "Porte";
  dataIndeferimento: string;
  dataLimite: string;
  diasRestantes: number;
  progresso: number;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const diffDays = (a: string, b: string) =>
  Math.floor((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000);
const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const fmtBR = (iso: string) => { const [y,m,d] = iso.slice(0,10).split("-"); return `${d}/${m}/${y}`; };

function classifyPF(nome: string): "Posse" | "Porte" | null {
  const n = (nome || "").toLowerCase();
  const isPF = n.includes("polícia federal") || n.includes("policia federal") || /\bpf\b/.test(n);
  if (!isPF) return null;
  if (n.includes("posse")) return "Posse";
  if (n.includes("porte")) return "Porte";
  return null;
}

function toneFor(dias: number) {
  if (dias < 0)  return { bar: "bg-slate-800", text: "text-slate-700", border: "border-slate-300", bg: "bg-slate-50",   label: "VENCIDO" };
  if (dias <= 2) return { bar: "bg-rose-600",  text: "text-rose-700",  border: "border-rose-200",  bg: "bg-rose-50/60", label: "CRÍTICO" };
  if (dias <= 5) return { bar: "bg-amber-500", text: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50/60",label: "ATENÇÃO" };
  return            { bar: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50/40", label: "EM PRAZO" };
}

export default function DashboardPrazosRecursais() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PrazoRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: itens, error: e1 } = await supabase
          .from("qa_itens_venda" as any)
          .select("id, venda_id, servico_id, status, data_indeferimento, data_recurso_administrativo")
          .ilike("status", "INDEFERIDO")
          .is("data_recurso_administrativo", null)
          .not("data_indeferimento", "is", null);
        if (e1) throw e1;
        const itensList = (itens || []) as unknown as ItemRow[];
        if (!itensList.length) { if (!cancelled) { setRows([]); setLoading(false); } return; }

        const vendaLegadoIds = Array.from(new Set(itensList.map(i => i.venda_id)));
        const servicoIds = Array.from(new Set(itensList.map(i => i.servico_id).filter(Boolean) as number[]));

        // CORREÇÃO: venda_id em qa_itens_venda referencia qa_vendas.id_legado
        const [vendasRes, servicosRes] = await Promise.all([
          supabase.from("qa_vendas" as any).select("id, id_legado, cliente_id").in("id_legado", vendaLegadoIds as any),
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

        const vMap = new Map(vendas.map(v => [v.id_legado, v]));
        const cMap = new Map(clientes.map(c => [c.id, c]));
        const sMap = new Map(servicos.map(s => [s.id, s]));

        const today = todayISO();
        const built: PrazoRow[] = [];
        for (const it of itensList) {
          const servico = it.servico_id ? sMap.get(it.servico_id) : null;
          const tipo = classifyPF(servico?.nome_servico || "");
          if (!tipo) continue;

          const venda = vMap.get(it.venda_id);
          const cliente = venda?.cliente_id ? cMap.get(venda.cliente_id) : null;
          if (!cliente) continue; // sem cliente identificável, não exibe

          const dIndef = it.data_indeferimento!;
          const dLimite = addDaysISO(dIndef, 10);
          const diasRestantes = diffDays(today, dLimite);
          const consumido = Math.min(10, Math.max(0, diffDays(dIndef, today)));
          const progresso = Math.min(1, Math.max(0, consumido / 10));

          built.push({
            itemId: it.id,
            clienteId: cliente.id,
            clienteIdLegado: cliente.id_legado ?? null,
            clienteNome: cliente.nome_completo || `Cliente #${cliente.id}`,
            tipo,
            dataIndeferimento: dIndef,
            dataLimite: dLimite,
            diasRestantes,
            progresso,
          });
        }

        built.sort((a, b) => a.diasRestantes - b.diasRestantes);
        if (!cancelled) { setRows(built); setLoading(false); }
      } catch (err) {
        console.error("[DashboardPrazosRecursais]", err);
        if (!cancelled) { setRows([]); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => ({
    vencidos: rows.filter(r => r.diasRestantes < 0).length,
    criticos: rows.filter(r => r.diasRestantes >= 0 && r.diasRestantes <= 2).length,
    atencao:  rows.filter(r => r.diasRestantes > 2 && r.diasRestantes <= 5).length,
    total:    rows.length,
  }), [rows]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Recursos Administrativos — Prazo de 10 Dias (PF)</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Carregando…</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-center shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!rows.length) return null;

  return (
    <div className="space-y-4">
      {/* Header — mesmo padrão do Monitoramento de Exames */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Recursos Administrativos — Prazo de 10 Dias (PF)
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {stats.total} recurso(s) em andamento · clique no card para abrir o cadastro
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
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

      {/* Container padrão — igual ao Monitoramento de Exames */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="divide-y divide-slate-100">
          {rows.map(r => {
            const tone = toneFor(r.diasRestantes);
            const linkCliente = r.clienteIdLegado
              ? `/quero-armas/clientes?cliente=${r.clienteIdLegado}`
              : `/quero-armas/clientes`;
            return (
              <Link
                key={r.itemId}
                to={linkCliente}
                className={`block px-4 py-3 ${tone.bg} hover:bg-slate-50 transition-colors`}
                title={`Abrir cadastro de ${r.clienteNome}`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      {r.diasRestantes < 0 && <AlertTriangle className="h-3.5 w-3.5 text-slate-700 shrink-0" />}
                      <span className="text-sm font-bold text-slate-900 uppercase truncate hover:text-blue-700 hover:underline">
                        {r.clienteNome}
                      </span>
                      <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" />
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {r.tipo} PF · Indeferido em {fmtBR(r.dataIndeferimento)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-2xl font-black leading-none ${tone.text}`}>
                      {r.diasRestantes < 0 ? Math.abs(r.diasRestantes) : r.diasRestantes}
                    </div>
                    <div className={`text-[10px] uppercase font-bold ${tone.text}`}>
                      {r.diasRestantes < 0 ? "dias vencidos" : "dias restantes"}
                    </div>
                  </div>
                </div>

                <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`absolute left-0 top-0 h-full ${tone.bar} transition-all`}
                       style={{ width: `${Math.round(r.progresso * 100)}%` }} />
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
    </div>
  );
}

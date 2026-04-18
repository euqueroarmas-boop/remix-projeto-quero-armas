/**
 * Dashboard — Prazos Recursais (PF: Posse e Porte)
 *
 * Trigger: item de Posse/Porte na PF com status = 'RECURSO ADMINISTRATIVO'.
 * Janela: D = data_indeferimento; prazo = D+10 (Lei 9.784/99 art. 59 +
 * Decreto 9.847/19 art. 10). Vencidos NÃO aparecem (filtra diasRestantes >= 0).
 * Cores por dias restantes: 🟢 8–10 · 🟡 5–7 · 🔴 0–4.
 *
 * FKs em produção:
 *   - qa_itens_venda.venda_id  → qa_vendas.id_legado
 *   - qa_vendas.cliente_id     → qa_clientes.id_legado
 *
 * Layout: grid de até 9 cards pequenos (mais antigo → mais novo). 10º card "+N".
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ItemRow {
  id: number;
  venda_id: number;            // → qa_vendas.id_legado
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
  clienteIdLegado: number | null;
  clienteNome: string;
  tipo: "Posse" | "Porte";
  dataIndeferimento: string;
  dataLimite: string;
  diasRestantes: number;
}

const MAX_CARDS = 9; // 9 cards individuais + 1 card "+N"
const todayISO = () => new Date().toISOString().slice(0, 10);
const diffDays = (a: string, b: string) =>
  Math.floor((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000);
const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

function classifyPF(nome: string): "Posse" | "Porte" | null {
  const n = (nome || "").toLowerCase();
  const isPF = n.includes("polícia federal") || n.includes("policia federal") || /\bpf\b/.test(n);
  if (!isPF) return null;
  if (n.includes("posse")) return "Posse";
  if (n.includes("porte")) return "Porte";
  return null;
}

function toneFor(dias: number) {
  // dias = dias restantes até o limite (D+10). Sempre 0..10 aqui (vencidos já filtrados).
  if (dias <= 4) return { dot: "bg-rose-600",    text: "text-rose-700",    border: "border-rose-200",    bg: "bg-rose-50",    label: "CRÍTICO" };
  if (dias <= 7) return { dot: "bg-amber-500",   text: "text-amber-700",   border: "border-amber-200",   bg: "bg-amber-50",   label: "ATENÇÃO" };
  return            { dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200", bg: "bg-white",     label: "EM PRAZO" };
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
          .ilike("status", "RECURSO ADMINISTRATIVO")
          .not("data_indeferimento", "is", null);
        if (e1) throw e1;
        const itensList = (itens || []) as unknown as ItemRow[];
        if (!itensList.length) { if (!cancelled) { setRows([]); setLoading(false); } return; }

        const vendaLegadoIds = Array.from(new Set(itensList.map(i => i.venda_id)));
        const servicoIds = Array.from(new Set(itensList.map(i => i.servico_id).filter(Boolean) as number[]));

        // FK: qa_itens_venda.venda_id → qa_vendas.id_legado
        const [vendasRes, servicosRes] = await Promise.all([
          supabase.from("qa_vendas" as any).select("id, id_legado, cliente_id").in("id_legado", vendaLegadoIds as any),
          servicoIds.length
            ? supabase.from("qa_servicos" as any).select("id, nome_servico").in("id", servicoIds as any)
            : Promise.resolve({ data: [] as any[], error: null }),
        ]);
        const vendas = ((vendasRes as any).data || []) as VendaRow[];
        const servicos = ((servicosRes as any).data || []) as ServicoRow[];

        // FK: qa_vendas.cliente_id → qa_clientes.id_legado
        const clienteLegadoIds = Array.from(new Set(vendas.map(v => v.cliente_id).filter(Boolean) as number[]));
        const { data: clientesData } = clienteLegadoIds.length
          ? await supabase.from("qa_clientes" as any).select("id, id_legado, nome_completo").in("id_legado", clienteLegadoIds as any)
          : { data: [] as any[] };
        const clientes = (clientesData || []) as ClienteRow[];

        const vMap = new Map(vendas.map(v => [v.id_legado, v]));
        const cMap = new Map(clientes.map(c => [c.id_legado, c])); // chave = id_legado
        const sMap = new Map(servicos.map(s => [s.id, s]));

        const today = todayISO();
        const built: PrazoRow[] = [];
        for (const it of itensList) {
          const servico = it.servico_id ? sMap.get(it.servico_id) : null;
          const tipo = classifyPF(servico?.nome_servico || "");
          if (!tipo) continue;

          const venda = vMap.get(it.venda_id);
          const cliente = venda?.cliente_id != null ? cMap.get(venda.cliente_id) : null;
          if (!cliente) continue;

          const dIndef = it.data_indeferimento!;
          const dLimite = addDaysISO(dIndef, 10);
          const diasRestantes = diffDays(today, dLimite);
          // Filtra vencidos (negativos) e fora da janela de 10 dias.
          if (diasRestantes < 0 || diasRestantes > 10) continue;

          built.push({
            itemId: it.id,
            clienteIdLegado: cliente.id_legado ?? null,
            clienteNome: cliente.nome_completo || `Cliente #${cliente.id}`,
            tipo,
            dataIndeferimento: dIndef,
            dataLimite: dLimite,
            diasRestantes,
          });
        }

        // ordem: mais antigo (menor diasRestantes / mais vencido) → mais novo
        built.sort((a, b) => a.diasRestantes - b.diasRestantes);
        if (!cancelled) { setRows(built); setLoading(false); }
      } catch (err) {
        console.error("[DashboardPrazosRecursais]", err);
        if (!cancelled) { setRows([]); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => rows.slice(0, MAX_CARDS), [rows]);
  const overflow = useMemo(() => rows.slice(MAX_CARDS), [rows]);

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
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
          Recursos Administrativos — Prazo de 10 Dias (PF)
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {rows.length} cliente(s) em prazo de recurso · ordenado do mais antigo ao mais novo
        </p>
      </div>

      {/* Grid de cards pequenos — 2/3/5 colunas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-100">
          {visible.map(r => {
            const tone = toneFor(r.diasRestantes);
            const link = r.clienteIdLegado
              ? `/quero-armas/clientes?cliente=${r.clienteIdLegado}`
              : `/quero-armas/clientes`;
            const dias = r.diasRestantes < 0 ? Math.abs(r.diasRestantes) : r.diasRestantes;
            return (
              <Link
                key={r.itemId}
                to={link}
                title={`${r.clienteNome} — ${r.tipo} PF`}
                className={`group flex flex-col gap-1.5 px-3 py-3 ${tone.bg} hover:bg-slate-50 transition-colors min-h-[88px]`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${tone.dot} shrink-0`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${tone.text}`}>
                    {tone.label}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-900 leading-tight line-clamp-2 group-hover:text-blue-700 group-hover:underline uppercase">
                  {r.clienteNome}
                </div>
                <div className="mt-auto flex items-baseline gap-1">
                  <span className={`text-xl font-black leading-none ${tone.text}`}>{r.diasRestantes}</span>
                  <span className={`text-[9px] font-bold uppercase ${tone.text}`}>d. restantes</span>
                </div>
              </Link>
            );
          })}

          {/* 10º card = agregador "+N" */}
          {overflow.length > 0 && (
            <div
              className="flex flex-col items-center justify-center gap-1 px-3 py-3 bg-slate-50 min-h-[88px]"
              title={overflow.map(o => `${o.clienteNome} (${o.diasRestantes}d)`).join(" · ")}
            >
              <Plus className="h-4 w-4 text-slate-500" />
              <span className="text-2xl font-black text-slate-700 leading-none">+{overflow.length}</span>
              <span className="text-[9px] font-bold uppercase text-slate-500 text-center">
                outros em prazo
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

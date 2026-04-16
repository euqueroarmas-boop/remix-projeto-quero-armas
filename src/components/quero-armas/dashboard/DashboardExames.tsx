import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  HeartPulse, Crosshair, AlertTriangle, CheckCircle2, XCircle,
  Clock, ArrowRight, Loader2, Filter, Users,
} from "lucide-react";
import { computeExameStatus, type ExameComStatus, type ExameTipo } from "@/components/quero-armas/clientes/ClienteExames";

/* ================================================================
 * Tipos
 * ================================================================ */

interface ExameRow {
  id: string;
  cliente_id: number;
  tipo: ExameTipo;
  data_realizacao: string;
  data_vencimento: string;
  observacoes: string | null;
}

interface ClienteRow {
  id: number;
  nome_completo: string | null;
}

interface ItemServicoRow {
  venda_id: number;
  status: string;
}

interface VendaRow {
  id: number;
  cliente_id: number;
}

interface ExameDashItem {
  exameId: string;
  clienteId: number;
  clienteNome: string;
  tipo: ExameTipo;
  dataRealizacao: string;
  dataVencimento: string;
  diasRestantes: number;
  status: ExameComStatus["status"];
  temServicoPendente: boolean;
}

const FINISHED = ["DEFERIDO", "CONCLUÍDO", "DESISTIU", "RESTITUÍDO", "INDEFERIDO"];

const STATUS_CFG = {
  vencido: { cls: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle, label: "VENCIDO", order: 0 },
  a_vencer: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle, label: "A VENCER", order: 1 },
  vigente: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "VIGENTE", order: 2 },
} as const;

const fmtDate = (s: string) => {
  const [y, m, d] = s.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};

/* ================================================================
 * Componente Principal
 * ================================================================ */

export default function DashboardExames() {
  const [items, setItems] = useState<ExameDashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroServicoPendente, setFiltroServicoPendente] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [examesRes, clientesRes, itensRes, vendasRes] = await Promise.all([
          supabase.from("qa_exames_cliente" as any).select("id, cliente_id, tipo, data_realizacao, data_vencimento, observacoes"),
          supabase.from("qa_clientes" as any).select("id, nome_completo"),
          supabase.from("qa_itens_venda" as any).select("venda_id, status"),
          supabase.from("qa_vendas" as any).select("id, cliente_id"),
        ]);

        const exames = (examesRes.data || []) as ExameRow[];
        const clientes = (clientesRes.data || []) as ClienteRow[];
        const itens = (itensRes.data || []) as ItemServicoRow[];
        const vendas = (vendasRes.data || []) as VendaRow[];

        const clienteMap = new Map(clientes.map((c) => [c.id, c.nome_completo || "—"]));
        const vendaMap = new Map(vendas.map((v) => [v.id, v.cliente_id]));

        // Clientes com serviço pendente
        const clientesComPendente = new Set<number>();
        for (const item of itens) {
          if (!FINISHED.includes((item.status || "").toUpperCase())) {
            const cid = vendaMap.get(item.venda_id);
            if (cid) clientesComPendente.add(cid);
          }
        }

        // Pegar o exame mais recente de cada (cliente, tipo)
        const latestMap = new Map<string, ExameRow>();
        for (const e of exames) {
          const key = `${e.cliente_id}_${e.tipo}`;
          const existing = latestMap.get(key);
          if (!existing || e.data_realizacao > existing.data_realizacao) {
            latestMap.set(key, e);
          }
        }

        const result: ExameDashItem[] = [];
        for (const e of latestMap.values()) {
          const { status, dias_restantes } = computeExameStatus(e.data_vencimento);
          result.push({
            exameId: e.id,
            clienteId: e.cliente_id,
            clienteNome: clienteMap.get(e.cliente_id) || "—",
            tipo: e.tipo,
            dataRealizacao: e.data_realizacao,
            dataVencimento: e.data_vencimento,
            diasRestantes: dias_restantes,
            status,
            temServicoPendente: clientesComPendente.has(e.cliente_id),
          });
        }

        // Ordenar: vencidos primeiro, depois a_vencer, vigente
        result.sort((a, b) => {
          const oa = STATUS_CFG[a.status].order;
          const ob = STATUS_CFG[b.status].order;
          if (oa !== ob) return oa - ob;
          return a.diasRestantes - b.diasRestantes;
        });

        setItems(result);
      } catch (err) {
        console.error("[DashboardExames] load:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(
    () => (filtroServicoPendente ? items.filter((i) => i.temServicoPendente) : items),
    [items, filtroServicoPendente],
  );

  const psiItems = useMemo(() => filtered.filter((i) => i.tipo === "psicologico"), [filtered]);
  const tiroItems = useMemo(() => filtered.filter((i) => i.tipo === "tiro"), [filtered]);

  const countByStatus = (list: ExameDashItem[]) => ({
    vencido: list.filter((i) => i.status === "vencido").length,
    a_vencer_45: list.filter((i) => i.status === "a_vencer").length,
    a_vencer_30: list.filter((i) => i.status === "a_vencer" && i.diasRestantes <= 30).length,
    a_vencer_15: list.filter((i) => i.status === "a_vencer" && i.diasRestantes <= 15).length,
    a_vencer_7: list.filter((i) => i.status === "a_vencer" && i.diasRestantes <= 7).length,
    vigente: list.filter((i) => i.status === "vigente").length,
  });

  const psiCounts = useMemo(() => countByStatus(psiItems), [psiItems]);
  const tiroCounts = useMemo(() => countByStatus(tiroItems), [tiroItems]);

  if (loading) {
    return (
      <div className="qa-card p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>
            Monitoramento de Exames
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
            Validade e alertas de exames psicológicos e de tiro
          </p>
        </div>
        <button
          onClick={() => setFiltroServicoPendente(!filtroServicoPendente)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider border transition-all ${
            filtroServicoPendente
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          <Filter className="h-3 w-3" />
          {filtroServicoPendente ? "Com pendências" : "Todos"}
        </button>
      </div>

      {/* Cards por tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExameSummaryCard
          tipo="psicologico"
          icon={HeartPulse}
          color="violet"
          counts={psiCounts}
          total={psiItems.length}
        />
        <ExameSummaryCard
          tipo="tiro"
          icon={Crosshair}
          color="orange"
          counts={tiroCounts}
          total={tiroItems.length}
        />
      </div>

      {/* Lista operacional */}
      <div className="qa-card overflow-hidden">
        <div className="px-5 py-3 border-b" style={{ borderColor: "hsl(220 13% 91%)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 20% 18%)" }}>
                Lista Operacional Diária
              </h4>
              <p className="text-[10px] mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
                {filtered.filter((i) => i.status !== "vigente").length} exame(s) requer(em) atenção
              </p>
            </div>
            <Link
              to="/quero-armas/clientes"
              className="text-[11px] font-medium flex items-center gap-1"
              style={{ color: "hsl(230 80% 56%)" }}
            >
              Ver clientes <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filtered.filter((i) => i.status !== "vigente").length === 0 ? (
            <div className="text-center py-8 text-xs" style={{ color: "hsl(220 10% 62%)" }}>
              Nenhum exame requer atenção no momento
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: "hsl(220 13% 93%)", background: "hsl(220 14% 97%)" }}>
                  <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)", fontSize: "10px" }}>Cliente</th>
                  <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)", fontSize: "10px" }}>Tipo</th>
                  <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "hsl(220 10% 50%)", fontSize: "10px" }}>Realizado</th>
                  <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "hsl(220 10% 50%)", fontSize: "10px" }}>Vence</th>
                  <th className="text-center px-4 py-2.5 font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)", fontSize: "10px" }}>Dias</th>
                  <th className="text-center px-4 py-2.5 font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)", fontSize: "10px" }}>Status</th>
                  <th className="text-center px-4 py-2.5 font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)", fontSize: "10px" }}>Pend.</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .filter((i) => i.status !== "vigente")
                  .map((item) => {
                    const cfg = STATUS_CFG[item.status];
                    const SIcon = cfg.icon;
                    return (
                      <tr key={item.exameId} className="border-b hover:bg-slate-50 transition-colors" style={{ borderColor: "hsl(220 13% 95%)" }}>
                        <td className="px-4 py-2.5 font-medium" style={{ color: "hsl(220 20% 25%)" }}>{item.clienteNome}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5">
                            {item.tipo === "psicologico" ? (
                              <HeartPulse className="h-3 w-3 text-violet-500" />
                            ) : (
                              <Crosshair className="h-3 w-3 text-orange-500" />
                            )}
                            <span style={{ color: "hsl(220 10% 40%)" }}>
                              {item.tipo === "psicologico" ? "Psicológico" : "Tiro"}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 hidden sm:table-cell" style={{ color: "hsl(220 10% 50%)" }}>{fmtDate(item.dataRealizacao)}</td>
                        <td className="px-4 py-2.5 hidden sm:table-cell" style={{ color: "hsl(220 10% 50%)" }}>{fmtDate(item.dataVencimento)}</td>
                        <td className="px-4 py-2.5 text-center font-bold" style={{ color: item.status === "vencido" ? "hsl(0 72% 55%)" : "hsl(38 92% 42%)" }}>
                          {item.diasRestantes < 0 ? Math.abs(item.diasRestantes) : item.diasRestantes}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${cfg.cls}`}>
                            <SIcon className="h-2.5 w-2.5" /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {item.temServicoPendente ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Users className="h-2.5 w-2.5" /> SIM
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
 * Card de resumo por tipo
 * ================================================================ */

interface SummaryCounts {
  vencido: number;
  a_vencer_45: number;
  a_vencer_30: number;
  a_vencer_15: number;
  a_vencer_7: number;
  vigente: number;
}

function ExameSummaryCard({ tipo, icon: Icon, color, counts, total }: {
  tipo: ExameTipo;
  icon: any;
  color: "violet" | "orange";
  counts: SummaryCounts;
  total: number;
}) {
  const gradients = {
    violet: "from-violet-500 to-purple-600",
    orange: "from-orange-500 to-amber-600",
  };

  const labels = {
    psicologico: "Exame Psicológico",
    tiro: "Exame de Tiro",
  };

  const alertRows = [
    { label: "Vencidos", value: counts.vencido, cls: "text-rose-600 bg-rose-50" },
    { label: "≤ 7 dias", value: counts.a_vencer_7, cls: "text-red-600 bg-red-50" },
    { label: "≤ 15 dias", value: counts.a_vencer_15, cls: "text-orange-600 bg-orange-50" },
    { label: "≤ 30 dias", value: counts.a_vencer_30, cls: "text-amber-600 bg-amber-50" },
    { label: "≤ 45 dias", value: counts.a_vencer_45, cls: "text-yellow-600 bg-yellow-50" },
    { label: "Vigentes", value: counts.vigente, cls: "text-emerald-600 bg-emerald-50" },
  ];

  return (
    <div className="qa-card overflow-hidden">
      <div className={`bg-gradient-to-r ${gradients[color]} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-white" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">{labels[tipo]}</span>
        </div>
        <span className="text-xs font-bold text-white/80">{total} cliente(s)</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2">
          {alertRows.map((row) => (
            <div key={row.label} className={`rounded-lg px-3 py-2 text-center ${row.cls}`}>
              <div className="text-lg font-black">{row.value}</div>
              <div className="text-[9px] font-semibold uppercase tracking-wider opacity-80">{row.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

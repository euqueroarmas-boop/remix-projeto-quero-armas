import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  HeartPulse, Crosshair, AlertTriangle, CheckCircle2, XCircle,
  Clock, ArrowRight, Loader2, Filter, Users, Phone, FileText,
  ShieldAlert, ShieldCheck, Activity, ChevronRight, Calendar,
} from "lucide-react";
import {
  computeExameStatus, formatExameCountdown,
  type ExameComStatus, type ExameTipo,
} from "@/components/quero-armas/clientes/ClienteExames";

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
interface ClienteRow { id: number; nome_completo: string | null; telefone_principal?: string | null; }
interface ItemServicoRow { venda_id: number; status: string; }
interface VendaRow { id: number; cliente_id: number; }

interface ExameDashItem {
  exameId: string;
  clienteId: number;
  clienteNome: string;
  clienteTelefone: string | null;
  tipo: ExameTipo;
  dataRealizacao: string;
  dataVencimento: string;
  diasRestantes: number;
  status: ExameComStatus["status"];
  temServicoPendente: boolean;
  /** prioridade operacional 0=máxima */
  prioridade: number;
  bucket: "vencido" | "d7" | "d15" | "d30" | "d45" | "vigente";
}

const FINISHED = ["DEFERIDO", "CONCLUÍDO", "DESISTIU", "RESTITUÍDO", "INDEFERIDO"];

/* Bucket por urgência operacional */
function bucketize(status: ExameComStatus["status"], dias: number): ExameDashItem["bucket"] {
  if (status === "vencido") return "vencido";
  if (status === "vigente") return "vigente";
  if (dias <= 7) return "d7";
  if (dias <= 15) return "d15";
  if (dias <= 30) return "d30";
  return "d45";
}
const BUCKET_ORDER: Record<ExameDashItem["bucket"], number> = {
  vencido: 0, d7: 1, d15: 2, d30: 3, d45: 4, vigente: 5,
};

/* Paleta operacional por urgência (não altera regra, só apresentação) */
const URGENCY = {
  vencido: { ring: "ring-rose-300", text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500", label: "VENCIDO", icon: XCircle },
  d7:      { ring: "ring-red-300",  text: "text-red-700",  bg: "bg-red-50",  border: "border-red-200",  dot: "bg-red-500",  label: "≤ 7 DIAS",  icon: ShieldAlert },
  d15:     { ring: "ring-orange-300", text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500", label: "≤ 15 DIAS", icon: AlertTriangle },
  d30:     { ring: "ring-amber-300",  text: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  dot: "bg-amber-500",  label: "≤ 30 DIAS", icon: Clock },
  d45:     { ring: "ring-yellow-300", text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", dot: "bg-yellow-400", label: "≤ 45 DIAS", icon: Activity },
  vigente: { ring: "ring-emerald-300", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", label: "VIGENTE", icon: ShieldCheck },
} as const;

const fmtDate = (s: string) => {
  const [y, m, d] = s.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};

type FilterKey = "todos" | "vencido" | "d7" | "d15" | "d30" | "d45" | "pend" | "psicologico" | "tiro";

/* ================================================================
 * Componente Principal
 * ================================================================ */

export default function DashboardExames() {
  const [items, setItems] = useState<ExameDashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKey, setFilterKey] = useState<FilterKey>("todos");

  useEffect(() => {
    const load = async () => {
      try {
        const [examesRes, clientesRes, itensRes, vendasRes] = await Promise.all([
          supabase.from("qa_exames_cliente" as any).select("id, cliente_id, tipo, data_realizacao, data_vencimento, observacoes"),
          supabase.from("qa_clientes" as any).select("id, nome_completo, telefone_principal"),
          supabase.from("qa_itens_venda" as any).select("venda_id, status"),
          supabase.from("qa_vendas" as any).select("id, cliente_id"),
        ]);

        const exames = ((examesRes.data || []) as any[]) as ExameRow[];
        const clientes = ((clientesRes.data || []) as any[]) as ClienteRow[];
        const itens = ((itensRes.data || []) as any[]) as ItemServicoRow[];
        const vendas = ((vendasRes.data || []) as any[]) as VendaRow[];

        const clienteMap = new Map(clientes.map((c) => [c.id, c]));
        const vendaMap = new Map(vendas.map((v) => [v.id, v.cliente_id]));

        const clientesComPendente = new Set<number>();
        for (const item of itens) {
          if (!FINISHED.includes((item.status || "").toUpperCase())) {
            const cid = vendaMap.get(item.venda_id);
            if (cid) clientesComPendente.add(cid);
          }
        }

        // pega exame mais recente por (cliente, tipo)
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
          const cli = clienteMap.get(e.cliente_id);
          const { status, dias_restantes } = computeExameStatus(e.data_vencimento);
          const bucket = bucketize(status, dias_restantes);
          result.push({
            exameId: e.id,
            clienteId: e.cliente_id,
            clienteNome: cli?.nome_completo || "—",
            clienteTelefone: cli?.telefone_principal || null,
            tipo: e.tipo,
            dataRealizacao: e.data_realizacao,
            dataVencimento: e.data_vencimento,
            diasRestantes: dias_restantes,
            status,
            temServicoPendente: clientesComPendente.has(e.cliente_id),
            prioridade: BUCKET_ORDER[bucket],
            bucket,
          });
        }

        // ordenamento operacional
        result.sort((a, b) => {
          if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
          if (a.status === "vencido") return a.diasRestantes - b.diasRestantes; // mais antigo (mais negativo) primeiro
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

  /* ====== KPIs executivos (sobre o universo completo) ====== */
  const kpis = useMemo(() => {
    const vencidos = items.filter((i) => i.bucket === "vencido").length;
    const d7 = items.filter((i) => i.bucket === "d7").length;
    const d15 = items.filter((i) => i.bucket === "d15").length;
    const d30 = items.filter((i) => i.bucket === "d30").length;
    const d45 = items.filter((i) => i.bucket === "d45").length;
    const vigentes = items.filter((i) => i.bucket === "vigente").length;
    const pend = items.filter((i) => i.temServicoPendente && i.status !== "vigente").length;
    return { vencidos, d7, d15, d30, d45, vigentes, pend, total: items.length };
  }, [items]);

  /* ====== Lista filtrada ====== */
  const filtered = useMemo(() => {
    switch (filterKey) {
      case "vencido": return items.filter((i) => i.bucket === "vencido");
      case "d7":  return items.filter((i) => ["vencido", "d7"].includes(i.bucket));
      case "d15": return items.filter((i) => ["vencido", "d7", "d15"].includes(i.bucket));
      case "d30": return items.filter((i) => ["vencido", "d7", "d15", "d30"].includes(i.bucket));
      case "d45": return items.filter((i) => i.status !== "vigente");
      case "pend": return items.filter((i) => i.temServicoPendente && i.status !== "vigente");
      case "psicologico": return items.filter((i) => i.tipo === "psicologico");
      case "tiro": return items.filter((i) => i.tipo === "tiro");
      default: return items;
    }
  }, [items, filterKey]);

  const psiItems  = useMemo(() => items.filter((i) => i.tipo === "psicologico"), [items]);
  const tiroItems = useMemo(() => items.filter((i) => i.tipo === "tiro"), [items]);

  const countByBucket = (list: ExameDashItem[]) => ({
    vencido: list.filter((i) => i.bucket === "vencido").length,
    d7:      list.filter((i) => i.bucket === "d7").length,
    d15:     list.filter((i) => i.bucket === "d15").length,
    d30:     list.filter((i) => i.bucket === "d30").length,
    d45:     list.filter((i) => i.bucket === "d45").length,
    vigente: list.filter((i) => i.bucket === "vigente").length,
    total:   list.length,
  });

  const psiCounts  = useMemo(() => countByBucket(psiItems),  [psiItems]);
  const tiroCounts = useMemo(() => countByBucket(tiroItems), [tiroItems]);

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
      {/* ============ Header ============ */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Monitoramento de Exames</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Painel operacional · {kpis.total} exame(s) monitorado(s)</p>
        </div>
      </div>

      {/* ============ FAIXA EXECUTIVA DE KPIs ============ */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-slate-100">
          <KpiTile label="Vencidos"  value={kpis.vencidos} active={filterKey === "vencido"} onClick={() => setFilterKey("vencido")} variant="vencido" icon={XCircle} />
          <KpiTile label="≤ 7 dias"  value={kpis.d7}  active={filterKey === "d7"}  onClick={() => setFilterKey("d7")}  variant="d7"  icon={ShieldAlert} />
          <KpiTile label="≤ 15 dias" value={kpis.d15} active={filterKey === "d15"} onClick={() => setFilterKey("d15")} variant="d15" icon={AlertTriangle} />
          <KpiTile label="≤ 30 dias" value={kpis.d30} active={filterKey === "d30"} onClick={() => setFilterKey("d30")} variant="d30" icon={Clock} />
          <KpiTile label="≤ 45 dias" value={kpis.d45} active={filterKey === "d45"} onClick={() => setFilterKey("d45")} variant="d45" icon={Activity} />
          <KpiTile label="Vigentes"  value={kpis.vigentes} active={false} variant="vigente" icon={ShieldCheck} />
          <KpiTile label="C/ Pend."  value={kpis.pend} active={filterKey === "pend"} onClick={() => setFilterKey("pend")} variant="pend" icon={Users} />
        </div>
      </div>

      {/* ============ Cards por tipo ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExameSummaryCard tipo="psicologico" icon={HeartPulse} color="violet" counts={psiCounts} />
        <ExameSummaryCard tipo="tiro"        icon={Crosshair}  color="orange" counts={tiroCounts} />
      </div>

      {/* ============ Lista operacional ============ */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Lista Operacional Diária</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {filtered.filter((i) => i.status !== "vigente").length} exame(s) requer(em) atenção
            </p>
          </div>
          <Link to="/quero-armas/clientes" className="text-[11px] font-semibold flex items-center gap-1 text-blue-600 hover:text-blue-800">
            Ver clientes <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Filtros chips */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-slate-100 bg-slate-50/60 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            <Filter className="h-3 w-3 text-slate-400 mr-1 shrink-0" />
            <Chip active={filterKey === "todos"}    onClick={() => setFilterKey("todos")}    label="Todos" />
            <Chip active={filterKey === "vencido"}  onClick={() => setFilterKey("vencido")}  label="Vencidos" tone="vencido" count={kpis.vencidos} />
            <Chip active={filterKey === "d7"}       onClick={() => setFilterKey("d7")}       label="≤ 7 dias" tone="d7" count={kpis.d7} />
            <Chip active={filterKey === "d15"}      onClick={() => setFilterKey("d15")}      label="≤ 15 dias" tone="d15" count={kpis.d15} />
            <Chip active={filterKey === "d30"}      onClick={() => setFilterKey("d30")}      label="≤ 30 dias" tone="d30" count={kpis.d30} />
            <Chip active={filterKey === "d45"}      onClick={() => setFilterKey("d45")}      label="≤ 45 dias" tone="d45" count={kpis.d45} />
            <Chip active={filterKey === "pend"}     onClick={() => setFilterKey("pend")}     label="C/ Pendência" tone="pend" count={kpis.pend} />
            <span className="w-px h-4 bg-slate-200 mx-1" />
            <Chip active={filterKey === "psicologico"} onClick={() => setFilterKey("psicologico")} label="Psicológico" />
            <Chip active={filterKey === "tiro"}     onClick={() => setFilterKey("tiro")}     label="Tiro" />
          </div>
        </div>

        <div className="max-h-[28rem] overflow-y-auto">
          {filtered.filter((i) => i.status !== "vigente").length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              Nenhum exame requer atenção neste filtro.
            </div>
          ) : (
            <>
              {/* Desktop: tabela */}
              <table className="w-full text-xs hidden md:table">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <Th>Cliente</Th>
                    <Th>Tipo</Th>
                    <Th>Realizado</Th>
                    <Th>Vencimento</Th>
                    <Th center>Situação</Th>
                    <Th center>Status</Th>
                    <Th center>Pend.</Th>
                    <Th center>Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.filter((i) => i.status !== "vigente").map((item) => {
                    const u = URGENCY[item.bucket];
                    const SIcon = u.icon;
                    return (
                      <tr key={item.exameId} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                        {/* prioridade visual: barra colorida à esquerda */}
                        <td className="px-3 py-2.5 font-semibold text-slate-800 relative">
                          <span className={`absolute left-0 top-0 bottom-0 w-1 ${u.dot}`} />
                          <span className="pl-2 block truncate max-w-[220px]" title={item.clienteNome}>{item.clienteNome}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <TipoBadge tipo={item.tipo} />
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{fmtDate(item.dataRealizacao)}</td>
                        <td className="px-3 py-2.5 text-slate-700 font-medium">{fmtDate(item.dataVencimento)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <CountdownCell dias={item.diasRestantes} bucket={item.bucket} />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${u.bg} ${u.text} ${u.border}`}>
                            <SIcon className="h-2.5 w-2.5" /> {u.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {item.temServicoPendente ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Users className="h-2.5 w-2.5" /> SIM
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <QuickActions item={item} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile: lista de cards */}
              <ul className="md:hidden divide-y divide-slate-100">
                {filtered.filter((i) => i.status !== "vigente").map((item) => {
                  const u = URGENCY[item.bucket];
                  const SIcon = u.icon;
                  return (
                    <li key={item.exameId} className="px-4 py-3 relative">
                      <span className={`absolute left-0 top-0 bottom-0 w-1 ${u.dot}`} />
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <TipoBadge tipo={item.tipo} compact />
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${u.bg} ${u.text} ${u.border}`}>
                              <SIcon className="h-2.5 w-2.5" /> {u.label}
                            </span>
                            {item.temServicoPendente && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <Users className="h-2.5 w-2.5" /> PEND.
                              </span>
                            )}
                          </div>
                          <div className="mt-1 font-semibold text-slate-900 text-[13px] truncate" title={item.clienteNome}>
                            {item.clienteNome}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Realizado {fmtDate(item.dataRealizacao)} · vence {fmtDate(item.dataVencimento)}
                          </div>
                          <div className="mt-1.5">
                            <CountdownCell dias={item.diasRestantes} bucket={item.bucket} inline />
                          </div>
                        </div>
                      </div>
                      <div className="mt-2.5">
                        <QuickActions item={item} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
 * Subcomponentes
 * ================================================================ */

const KPI_VARIANTS = {
  vencido: { dot: "bg-rose-500",   text: "text-rose-700",   ring: "ring-rose-300" },
  d7:      { dot: "bg-red-500",    text: "text-red-700",    ring: "ring-red-300" },
  d15:     { dot: "bg-orange-500", text: "text-orange-700", ring: "ring-orange-300" },
  d30:     { dot: "bg-amber-500",  text: "text-amber-700",  ring: "ring-amber-300" },
  d45:     { dot: "bg-yellow-400", text: "text-yellow-700", ring: "ring-yellow-300" },
  vigente: { dot: "bg-emerald-500",text: "text-emerald-700",ring: "ring-emerald-300" },
  pend:    { dot: "bg-blue-500",   text: "text-blue-700",   ring: "ring-blue-300" },
} as const;

function KpiTile({
  label, value, variant, icon: Icon, active, onClick,
}: {
  label: string; value: number; variant: keyof typeof KPI_VARIANTS; icon: any;
  active?: boolean; onClick?: () => void;
}) {
  const v = KPI_VARIANTS[variant];
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`group relative px-3 py-3 text-left transition-all ${
        clickable ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"
      } ${active ? `ring-2 ${v.ring} ring-inset bg-slate-50` : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${v.dot}`} />
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={`text-2xl font-black ${v.text}`}>{value}</span>
        <Icon className={`h-3.5 w-3.5 ${v.text} opacity-60`} />
      </div>
    </button>
  );
}

function Chip({ active, onClick, label, tone, count }: {
  active: boolean; onClick: () => void; label: string;
  tone?: keyof typeof KPI_VARIANTS; count?: number;
}) {
  const v = tone ? KPI_VARIANTS[tone] : null;
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
        active
          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
      }`}
    >
      {v && <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />}
      {label}
      {typeof count === "number" && count > 0 && (
        <span className={`ml-0.5 px-1.5 py-px rounded-full text-[9px] font-bold ${
          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
        }`}>{count}</span>
      )}
    </button>
  );
}

function Th({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <th className={`px-3 py-2.5 font-bold uppercase tracking-wider text-[10px] text-slate-500 ${center ? "text-center" : "text-left"}`}>
      {children}
    </th>
  );
}

function TipoBadge({ tipo, compact }: { tipo: ExameTipo; compact?: boolean }) {
  const isPsi = tipo === "psicologico";
  return (
    <span className={`inline-flex items-center gap-1 ${compact ? "" : ""}`}>
      {isPsi ? <HeartPulse className="h-3 w-3 text-violet-500" /> : <Crosshair className="h-3 w-3 text-orange-500" />}
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${isPsi ? "text-violet-700" : "text-orange-700"}`}>
        {isPsi ? "Psicológico" : "Tiro"}
      </span>
    </span>
  );
}

function CountdownCell({ dias, bucket, inline }: { dias: number; bucket: ExameDashItem["bucket"]; inline?: boolean }) {
  const u = URGENCY[bucket];
  const abs = Math.abs(dias);
  const numero = dias === 0 ? "HOJE" : abs.toString();
  const label = formatExameCountdown(dias);
  if (inline) {
    return (
      <span className={`inline-flex items-baseline gap-1.5 ${u.text}`}>
        <span className="text-base font-black leading-none">{numero}</span>
        <span className="text-[10px] font-medium opacity-80">{label}</span>
      </span>
    );
  }
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className={`text-base font-black ${u.text}`}>{numero}</span>
      <span className={`text-[9px] font-semibold uppercase tracking-wider ${u.text} opacity-80`}>{label}</span>
    </div>
  );
}

function QuickActions({ item }: { item: ExameDashItem }) {
  const telLink = item.clienteTelefone
    ? `https://wa.me/55${item.clienteTelefone.replace(/\D/g, "")}`
    : null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Link
        to={`/quero-armas/clientes?cliente=${item.clienteId}`}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
      >
        Abrir <ChevronRight className="h-3 w-3" />
      </Link>
      <Link
        to={`/quero-armas/clientes?cliente=${item.clienteId}&tab=exames`}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
        title="Abrir aba Exames"
      >
        <FileText className="h-3 w-3" /> Exames
      </Link>
      {telLink && (
        <a
          href={telLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors"
          title="Contato via WhatsApp"
        >
          <Phone className="h-3 w-3" /> Contato
        </a>
      )}
    </div>
  );
}

/* ================================================================
 * Card resumo por tipo (mais compacto e hierárquico)
 * ================================================================ */

interface SummaryCounts {
  vencido: number; d7: number; d15: number; d30: number; d45: number; vigente: number; total: number;
}

function ExameSummaryCard({ tipo, icon: Icon, color, counts }: {
  tipo: ExameTipo; icon: any; color: "violet" | "orange"; counts: SummaryCounts;
}) {
  const gradients = {
    violet: "from-violet-500 to-purple-600",
    orange: "from-orange-500 to-amber-600",
  };
  const labels = { psicologico: "Exame Psicológico", tiro: "Exame de Tiro" };

  const operacional = counts.vencido + counts.d7 + counts.d15 + counts.d30 + counts.d45;
  const pct = (n: number) => counts.total > 0 ? Math.round((n / counts.total) * 100) : 0;

  // segmentos da barra de saúde
  const segs = [
    { key: "vencido", n: counts.vencido, cls: "bg-rose-500" },
    { key: "d7",      n: counts.d7,      cls: "bg-red-500" },
    { key: "d15",     n: counts.d15,     cls: "bg-orange-500" },
    { key: "d30",     n: counts.d30,     cls: "bg-amber-500" },
    { key: "d45",     n: counts.d45,     cls: "bg-yellow-400" },
    { key: "vigente", n: counts.vigente, cls: "bg-emerald-500" },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className={`bg-gradient-to-r ${gradients[color]} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-white" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">{labels[tipo]}</span>
        </div>
        <span className="text-[11px] font-bold text-white/90">{counts.total}</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Destaque: o que exige ação agora */}
        <div className="flex items-stretch gap-2">
          <div className="flex-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-rose-600">Vencidos</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-rose-700">{counts.vencido}</span>
              <span className="text-[10px] font-semibold text-rose-500">{pct(counts.vencido)}%</span>
            </div>
          </div>
          <div className="flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-red-600">Crítico ≤ 7d</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-red-700">{counts.d7}</span>
              <span className="text-[10px] font-semibold text-red-500">{pct(counts.d7)}%</span>
            </div>
          </div>
          <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Vigentes</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-emerald-700">{counts.vigente}</span>
              <span className="text-[10px] font-semibold text-emerald-500">{pct(counts.vigente)}%</span>
            </div>
          </div>
        </div>

        {/* Mini-stats */}
        <div className="grid grid-cols-3 gap-1.5">
          <MiniStat label="≤ 15d" value={counts.d15} cls="text-orange-700 bg-orange-50 border-orange-200" />
          <MiniStat label="≤ 30d" value={counts.d30} cls="text-amber-700 bg-amber-50 border-amber-200" />
          <MiniStat label="≤ 45d" value={counts.d45} cls="text-yellow-700 bg-yellow-50 border-yellow-200" />
        </div>

        {/* Barra de saúde segmentada */}
        <div>
          <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
            <span>Distribuição</span>
            <span className="text-slate-700">
              {operacional} pendência{operacional === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
            {counts.total > 0 && segs.map((s) => (
              <div
                key={s.key}
                className={s.cls}
                style={{ width: `${(s.n / counts.total) * 100}%` }}
                title={`${s.key}: ${s.n}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-md border px-2 py-1.5 text-center ${cls}`}>
      <div className="text-sm font-black leading-none">{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wider opacity-80 mt-0.5">{label}</div>
    </div>
  );
}

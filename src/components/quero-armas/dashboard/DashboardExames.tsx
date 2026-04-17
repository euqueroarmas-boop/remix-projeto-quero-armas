import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  HeartPulse, Crosshair, AlertTriangle, CheckCircle2, XCircle,
  Clock, ArrowRight, Loader2, Users, Phone, ChevronRight, Calendar,
  ShieldAlert, ShieldCheck, Activity,
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
  prioridade: number;
  bucket: "vencido" | "d7" | "d15" | "d30" | "d45" | "vigente";
}

const FINISHED = ["DEFERIDO", "CONCLUÍDO", "DESISTIU", "RESTITUÍDO", "INDEFERIDO"];
// Status que "consomem" o exame — quando o cliente tem QUALQUER serviço DEFERIDO,
// seus exames somem do monitoramento do Dashboard (foram usados no processo).
const CONSUMED_STATUSES = ["DEFERIDO"];

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

const fmtDate = (s: string) => {
  const [y, m, d] = s.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};

type FilterKey = "vencido" | "d7" | "d15" | "d30" | "d45" | "pend" | "vigente";

const KPI_VARIANTS = {
  vencido: { dot: "bg-rose-500",   text: "text-rose-700",   ring: "ring-rose-300",   bg: "bg-rose-50",   border: "border-rose-200",   label: "VENCIDOS",  icon: XCircle },
  d7:      { dot: "bg-red-500",    text: "text-red-700",    ring: "ring-red-300",    bg: "bg-red-50",    border: "border-red-200",    label: "≤ 7 DIAS",  icon: ShieldAlert },
  d15:     { dot: "bg-orange-500", text: "text-orange-700", ring: "ring-orange-300", bg: "bg-orange-50", border: "border-orange-200", label: "≤ 15 DIAS", icon: AlertTriangle },
  d30:     { dot: "bg-amber-500",  text: "text-amber-700",  ring: "ring-amber-300",  bg: "bg-amber-50",  border: "border-amber-200",  label: "≤ 30 DIAS", icon: Clock },
  d45:     { dot: "bg-yellow-400", text: "text-yellow-700", ring: "ring-yellow-300", bg: "bg-yellow-50", border: "border-yellow-200", label: "≤ 45 DIAS", icon: Activity },
  vigente: { dot: "bg-emerald-500",text: "text-emerald-700",ring: "ring-emerald-300",bg: "bg-emerald-50",border: "border-emerald-200",label: "VIGENTES",  icon: ShieldCheck },
  pend:    { dot: "bg-blue-500",   text: "text-blue-700",   ring: "ring-blue-300",   bg: "bg-blue-50",   border: "border-blue-200",   label: "C/ PEND.",  icon: Users },
} as const;

/* ================================================================
 * Componente Principal
 * ================================================================ */

export default function DashboardExames() {
  const [items, setItems] = useState<ExameDashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKey, setFilterKey] = useState<FilterKey | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const handleKpiClick = (key: FilterKey) => {
    const next = filterKey === key ? null : key;
    setFilterKey(next);
    if (next) {
      setTimeout(() => {
        listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [examesRes, itensRes, vendasRes] = await Promise.all([
          supabase.from("qa_exames_cliente" as any).select("id, cliente_id, tipo, data_realizacao, data_vencimento, observacoes").limit(5000),
          supabase.from("qa_itens_venda" as any).select("venda_id, status").limit(10000),
          supabase.from("qa_vendas" as any).select("id, cliente_id").limit(10000),
        ]);

        const exames = ((examesRes.data || []) as any[]) as ExameRow[];
        const itens = ((itensRes.data || []) as any[]) as ItemServicoRow[];
        const vendas = ((vendasRes.data || []) as any[]) as VendaRow[];

        // Busca apenas os clientes que efetivamente possuem exames cadastrados
        const clienteIds = Array.from(new Set(exames.map((e) => e.cliente_id).filter(Boolean)));
        let clientes: ClienteRow[] = [];
        if (clienteIds.length > 0) {
          const clientesRes = await supabase
            .from("qa_clientes" as any)
            .select("id, nome_completo, telefone_principal")
            .in("id", clienteIds);
          clientes = ((clientesRes.data || []) as any[]) as ClienteRow[];
        }

        // Normaliza chaves para String para evitar mismatch entre bigint (string) e integer (number)
        const clienteMap = new Map(clientes.map((c) => [String(c.id), c]));
        const vendaMap = new Map(vendas.map((v) => [String(v.id), String(v.cliente_id)]));

        const clientesComPendente = new Set<string>();
        const clientesComDeferido = new Set<string>();
        for (const item of itens) {
          const status = (item.status || "").toUpperCase();
          const cid = vendaMap.get(String(item.venda_id));
          if (!cid) continue;
          if (CONSUMED_STATUSES.includes(status)) {
            clientesComDeferido.add(cid);
          }
          if (!FINISHED.includes(status)) {
            clientesComPendente.add(cid);
          }
        }

        const latestMap = new Map<string, ExameRow>();
        for (const e of exames) {
          // Oculta exames de clientes que já tiveram serviço DEFERIDO
          if (clientesComDeferido.has(String(e.cliente_id))) continue;
          const key = `${e.cliente_id}_${e.tipo}`;
          const existing = latestMap.get(key);
          if (!existing || e.data_realizacao > existing.data_realizacao) {
            latestMap.set(key, e);
          }
        }

        const result: ExameDashItem[] = [];
        for (const e of latestMap.values()) {
          const cli = clienteMap.get(String(e.cliente_id));
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
            temServicoPendente: clientesComPendente.has(String(e.cliente_id)),
            prioridade: BUCKET_ORDER[bucket],
            bucket,
          });
        }

        result.sort((a, b) => {
          if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
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

  const kpis = useMemo(() => ({
    vencido: items.filter((i) => i.bucket === "vencido").length,
    d7: items.filter((i) => i.bucket === "d7").length,
    d15: items.filter((i) => i.bucket === "d15").length,
    d30: items.filter((i) => i.bucket === "d30").length,
    d45: items.filter((i) => i.bucket === "d45").length,
    vigente: items.filter((i) => i.bucket === "vigente").length,
    pend: items.filter((i) => i.temServicoPendente && i.status !== "vigente").length,
    total: items.length,
  }), [items]);

  const filtered = useMemo(() => {
    if (!filterKey) return [];
    if (filterKey === "pend") return items.filter((i) => i.temServicoPendente && i.status !== "vigente");
    return items.filter((i) => i.bucket === filterKey);
  }, [items, filterKey]);

  // Agrupa por cliente — mostra TODOS os exames do cliente para visão completa
  const groupedByCliente = useMemo(() => {
    if (!filterKey) return [];
    const clienteIds = Array.from(new Set(filtered.map((i) => i.clienteId)));
    return clienteIds.map((cid) => {
      const matched = filtered.filter((i) => i.clienteId === cid);
      const allOfCliente = items.filter((i) => i.clienteId === cid);
      const principal = matched[0];
      return {
        clienteId: cid,
        clienteNome: principal.clienteNome,
        clienteTelefone: principal.clienteTelefone,
        temServicoPendente: principal.temServicoPendente,
        exames: allOfCliente.sort((a, b) => a.prioridade - b.prioridade),
        prioridadeCliente: Math.min(...matched.map((m) => m.prioridade)),
      };
    }).sort((a, b) => a.prioridadeCliente - b.prioridadeCliente);
  }, [filtered, items, filterKey]);

  if (loading) {
    return (
      <div className="qa-card p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (items.length === 0) return null;

  const activeVariant = filterKey ? KPI_VARIANTS[filterKey] : null;
  const ActiveIcon = activeVariant?.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Monitoramento de Exames</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {kpis.total} exame(s) monitorado(s) · clique em um indicador para ver os clientes
        </p>
      </div>

      {/* KPIs clicáveis */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 divide-x divide-y sm:divide-y-0 divide-slate-100">
          <KpiTile variant="vencido" value={kpis.vencido} active={filterKey === "vencido"} onClick={() => handleKpiClick("vencido")} />
          <KpiTile variant="d7"      value={kpis.d7}      active={filterKey === "d7"}      onClick={() => handleKpiClick("d7")} />
          <KpiTile variant="d15"     value={kpis.d15}     active={filterKey === "d15"}     onClick={() => handleKpiClick("d15")} />
          <KpiTile variant="d30"     value={kpis.d30}     active={filterKey === "d30"}     onClick={() => handleKpiClick("d30")} />
          <KpiTile variant="d45"     value={kpis.d45}     active={filterKey === "d45"}     onClick={() => handleKpiClick("d45")} />
          <KpiTile variant="vigente" value={kpis.vigente} active={filterKey === "vigente"} onClick={() => handleKpiClick("vigente")} />
          <KpiTile variant="pend"    value={kpis.pend}    active={filterKey === "pend"}    onClick={() => handleKpiClick("pend")} />
        </div>
      </div>

      {/* Lista de clientes (aparece ao clicar em um KPI) */}
      {filterKey && activeVariant && ActiveIcon && (
        <div ref={listRef} className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-md scroll-mt-4 ring-1 ring-slate-200">
          <div className={`px-4 py-3 border-b ${activeVariant.border} ${activeVariant.bg} flex items-center justify-between gap-2`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`h-2 w-2 rounded-full ${activeVariant.dot} shrink-0`} />
              <ActiveIcon className={`h-4 w-4 ${activeVariant.text} shrink-0`} />
              <h4 className={`text-xs font-bold uppercase tracking-wider ${activeVariant.text} truncate`}>
                Clientes · {activeVariant.label}
              </h4>
              <span className={`text-[10px] font-bold ${activeVariant.text} shrink-0`}>
                ({filtered.length})
              </span>
            </div>
            <button
              onClick={() => setFilterKey(null)}
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 shrink-0 uppercase tracking-wider"
            >
              Fechar
            </button>
          </div>

          <div className="max-h-[32rem] overflow-y-auto">
            {groupedByCliente.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                Nenhum cliente neste indicador.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {groupedByCliente.map((g) => (
                  <ClienteCard key={g.clienteId} group={g} variant={activeVariant} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
 * Subcomponentes
 * ================================================================ */

function KpiTile({
  variant, value, active, onClick,
}: {
  variant: keyof typeof KPI_VARIANTS; value: number;
  active?: boolean; onClick?: () => void;
}) {
  const v = KPI_VARIANTS[variant];
  const Icon = v.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative px-3 py-3 text-left transition-all hover:bg-slate-50 cursor-pointer ${
        active ? `ring-2 ${v.ring} ring-inset bg-slate-50` : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${v.dot}`} />
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{v.label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={`text-2xl font-black ${v.text}`}>{value}</span>
        <Icon className={`h-3.5 w-3.5 ${v.text} opacity-60`} />
      </div>
    </button>
  );
}

function ClienteCard({
  group,
  variant,
}: {
  group: {
    clienteId: number;
    clienteNome: string;
    clienteTelefone: string | null;
    temServicoPendente: boolean;
    exames: ExameDashItem[];
  };
  variant: typeof KPI_VARIANTS[keyof typeof KPI_VARIANTS];
}) {
  const telLink = group.clienteTelefone
    ? `https://wa.me/55${group.clienteTelefone.replace(/\D/g, "")}`
    : null;

  return (
    <li className="px-4 py-3 relative hover:bg-slate-50/70 transition-colors">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${variant.dot}`} />
      <div className="pl-2 space-y-2">
        {/* Cabeçalho: Nome + Ações */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CLIENTE</span>
              {group.temServicoPendente && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <Users className="h-2.5 w-2.5" /> SERVIÇO PENDENTE
                </span>
              )}
            </div>
            <div className="font-bold text-slate-900 text-[14px] break-words" title={group.clienteNome}>
              {group.clienteNome}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              to={`/quero-armas/clientes?cliente=${group.clienteId}&tab=servicos`}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
              title="Marcar serviço como DEFERIDO no cadastro do cliente"
            >
              <CheckCircle2 className="h-3 w-3" /> DEFERIDO
            </Link>
            {telLink && (
              <a
                href={telLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors"
                title="WhatsApp"
              >
                <Phone className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Lista de exames do cliente */}
        <ul className="space-y-1.5">
          {group.exames.map((ex) => (
            <ExameLine key={ex.exameId} item={ex} />
          ))}
        </ul>

        {/* Link discreto para abrir cadastro completo */}
        <Link
          to={`/quero-armas/clientes?cliente=${group.clienteId}`}
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 uppercase tracking-wider"
        >
          Abrir cadastro completo <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </li>
  );
}

function ExameLine({ item }: { item: ExameDashItem }) {
  const isPsi = item.tipo === "psicologico";
  const abs = Math.abs(item.diasRestantes);
  const numero = item.diasRestantes === 0 ? "HOJE" : abs.toString();
  const label = formatExameCountdown(item.diasRestantes);

  // Cor do exame conforme bucket individual
  const colorByBucket: Record<ExameDashItem["bucket"], { text: string; bg: string; border: string }> = {
    vencido: { text: "text-rose-700",   bg: "bg-rose-50",   border: "border-rose-200" },
    d7:      { text: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
    d15:     { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
    d30:     { text: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
    d45:     { text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
    vigente: { text: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200" },
  };
  const c = colorByBucket[item.bucket];

  return (
    <li className={`rounded-md border ${c.border} ${c.bg} px-2.5 py-1.5`}>
      <div className="flex items-center gap-2 flex-wrap">
        {isPsi
          ? <HeartPulse className="h-3 w-3 text-violet-600 shrink-0" />
          : <Crosshair className="h-3 w-3 text-orange-600 shrink-0" />}
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isPsi ? "text-violet-700" : "text-orange-700"}`}>
          {isPsi ? "Psicológico" : "Tiro"}
        </span>
        <span className="text-[10px] text-slate-500 flex items-center gap-1">
          <Calendar className="h-2.5 w-2.5" />
          <span>Vence <span className="font-semibold text-slate-700">{fmtDate(item.dataVencimento)}</span></span>
        </span>
        <span className={`ml-auto inline-flex items-baseline gap-1 ${c.text}`}>
          <span className="text-xs font-black leading-none">{numero}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">{label}</span>
        </span>
      </div>
    </li>
  );
}

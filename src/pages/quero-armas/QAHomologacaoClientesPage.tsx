/**
 * FASE 20-E — Painel Operacional de Homologação de Clientes Legados.
 *
 * Equipe Quero Armas usa esta tela para regularizar clientes antigos do Access:
 *   - KPIs em tempo real (views qa_clientes_homologacao_kpis e _dry_run)
 *   - Filtros completos + busca + ordenação
 *   - Ações: marcar em revisão, solicitar docs, marcar docs enviados,
 *            homologar (qa_homologar_cliente) e reabrir (qa_reabrir_homologacao_cliente)
 *   - Histórico imutável dos eventos por cliente
 *   - Meta sugerida 1/dia + próximo cliente sugerido
 *
 * NÃO altera vendas, processos, checklist, pagamento, qa_crafs,
 * qa_cliente_armas_manual, qa_documentos_cliente, fotos de armas, ArsenalView,
 * ArmaManualForm, WeaponSilhouette ou self-service do cliente. Tela apenas
 * leitura + RPCs aprovadas (qa_atualizar_status_homologacao_cliente,
 * qa_homologar_cliente, qa_reabrir_homologacao_cliente).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  RefreshCw, Loader2, Search, ShieldCheck, History as HistoryIcon,
  CheckCircle2, AlertTriangle, Filter, Users, Clock, Inbox,
  Eye, FileSearch, FileCheck2, RotateCcw, Target, ArrowUpDown, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

/* ─── Tipos ─── */
interface KpiRow {
  total_clientes: number | null;
  total_cliente_app: number | null;
  total_novos_com_portal: number | null;
  total_legado_pendente: number | null;
  total_revisar_manual: number | null;
  total_homologado: number | null;
  total_em_revisao: number | null;
  total_aguardando_documentos: number | null;
  total_documentos_enviados: number | null;
  total_marcados_legado: number | null;
  total_tentaram_comprar: number | null;
  faltam_homologar: number | null;
  meta_1_por_dia_dias_restantes: number | null;
}

interface DryRunRow {
  cliente_id: number;
  id_legado: number | null;
  nome_completo: string | null;
  cpf: string | null;
  email: string | null;
  celular: string | null;
  tipo_cliente: string | null;
  origem: string | null;
  user_id: string | null;
  cliente_legado_atual: boolean | null;
  homologacao_status_atual: string | null;
  tem_venda_antiga: boolean | null;
  tem_arma_manual: boolean | null;
  tem_craf: boolean | null;
  tem_documento_cliente: boolean | null;
  tentou_comprar: boolean | null;
  sem_cpf: boolean | null;
  cpf_duplicado: boolean | null;
  email_duplicado: boolean | null;
  classificacao_sugerida: string | null;
  motivo_classificacao: string | null;
  prioridade_homologacao: number | null;
}

interface ClienteExtra {
  id: number;
  recadastramento_status: string | null;
  tentativa_compra_legado_count: number | null;
  tentativa_compra_legado_em: string | null;
}

interface EventoRow {
  id: string;
  qa_cliente_id: number;
  tipo_evento: string;
  descricao: string | null;
  ator: string | null;
  user_id: string | null;
  dados_json: Record<string, unknown> | null;
  created_at: string;
}

type Filtro =
  | "todos"
  | "pendentes"
  | "homologados"
  | "em_revisao"
  | "aguardando_documentos"
  | "documentos_enviados"
  | "tentaram_comprar"
  | "prioridade_1"
  | "prioridade_3_craf"
  | "prioridade_4_venda"
  | "sem_cpf"
  | "com_tentativa";

type Ordem = "prioridade" | "tentativa_recente" | "nome" | "status" | "id_legado";

type AcaoTipo =
  | "homologar"
  | "em_revisao"
  | "aguardando_documentos"
  | "documentos_enviados"
  | "reabrir";

interface AcaoEstado {
  cliente: DryRunRow;
  tipo: AcaoTipo;
}

/* ─── Utils ─── */
function fmtData(s: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("pt-BR"); } catch { return s; }
}

function statusBadge(status: string | null) {
  const s = (status || "pendente").toUpperCase();
  const map: Record<string, string> = {
    HOMOLOGADO: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    PENDENTE: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    EM_REVISAO: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    AGUARDANDO_DOCUMENTOS: "bg-orange-500/10 text-orange-700 border-orange-500/30",
    DOCUMENTOS_ENVIADOS: "bg-violet-500/10 text-violet-700 border-violet-500/30",
  };
  const cls = map[s] || "bg-slate-500/10 text-slate-700 border-slate-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold tracking-wide ${cls}`}>
      {s}
    </span>
  );
}

function flag(label: string, on: boolean | null | undefined, tone: "neutral" | "warn" = "neutral") {
  if (!on) return null;
  const cls = tone === "warn"
    ? "bg-amber-100 text-amber-800 border border-amber-200"
    : "bg-slate-200 text-slate-700";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase mr-1 ${cls}`}>
      {label}
    </span>
  );
}

/* ─── Página ─── */
export default function QAHomologacaoClientesPage() {
  const [kpis, setKpis] = useState<KpiRow | null>(null);
  const [rows, setRows] = useState<DryRunRow[]>([]);
  const [extra, setExtra] = useState<Record<number, ClienteExtra>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [ordem, setOrdem] = useState<Ordem>("prioridade");
  const [busca, setBusca] = useState("");
  const [acao, setAcao] = useState<AcaoEstado | null>(null);
  const [obs, setObs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState<DryRunRow | null>(null);
  const [eventos, setEventos] = useState<EventoRow[]>([]);
  const [eventosLoading, setEventosLoading] = useState(false);

  const carregar = useCallback(async () => {
    setRefreshing(true);
    try {
      const [{ data: kpiData, error: kpiErr }, { data: rowsData, error: rowsErr }] = await Promise.all([
        supabase.from("qa_clientes_homologacao_kpis" as any).select("*").maybeSingle(),
        supabase
          .from("qa_clientes_homologacao_dry_run" as any)
          .select("*")
          .order("prioridade_homologacao", { ascending: true })
          .order("nome_completo", { ascending: true })
          .limit(1000),
      ]);
      if (kpiErr) throw kpiErr;
      if (rowsErr) throw rowsErr;
      const list = ((rowsData as unknown as DryRunRow[]) ?? []);
      setKpis((kpiData as unknown as KpiRow) ?? null);
      setRows(list);

      // Buscar dados extras (recadastramento_status, tentativa) só dos clientes legados
      const ids = list.filter(r => r.cliente_legado_atual).map(r => r.cliente_id);
      if (ids.length > 0) {
        const { data: ex } = await supabase
          .from("qa_clientes")
          .select("id, recadastramento_status, tentativa_compra_legado_count, tentativa_compra_legado_em")
          .in("id", ids);
        const map: Record<number, ClienteExtra> = {};
        for (const r of (ex as ClienteExtra[] | null) ?? []) map[r.id] = r;
        setExtra(map);
      } else {
        setExtra({});
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar painel";
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      const status = (r.homologacao_status_atual || "pendente").toLowerCase();
      const ex = extra[r.cliente_id];
      const tentativas = ex?.tentativa_compra_legado_count ?? 0;
      switch (filtro) {
        case "pendentes": if (status !== "pendente") return false; break;
        case "homologados": if (status !== "homologado") return false; break;
        case "em_revisao": if (status !== "em_revisao") return false; break;
        case "aguardando_documentos": if (status !== "aguardando_documentos") return false; break;
        case "documentos_enviados": if (status !== "documentos_enviados") return false; break;
        case "tentaram_comprar": if (!r.tentou_comprar && tentativas === 0) return false; break;
        case "com_tentativa": if (tentativas <= 0) return false; break;
        case "prioridade_1": if (r.prioridade_homologacao !== 1) return false; break;
        case "prioridade_3_craf": if (r.prioridade_homologacao !== 3) return false; break;
        case "prioridade_4_venda": if (r.prioridade_homologacao !== 4) return false; break;
        case "sem_cpf": if (!r.sem_cpf) return false; break;
        case "todos": default: break;
      }
      if (!buscaNorm) return true;
      const hay = [r.nome_completo, r.cpf, r.email, String(r.id_legado ?? "")]
        .filter(Boolean).map((s) => String(s).toLowerCase()).join(" ");
      return hay.includes(buscaNorm);
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (ordem) {
        case "tentativa_recente": {
          const da = extra[a.cliente_id]?.tentativa_compra_legado_em || "";
          const db_ = extra[b.cliente_id]?.tentativa_compra_legado_em || "";
          return db_.localeCompare(da);
        }
        case "nome": return (a.nome_completo || "").localeCompare(b.nome_completo || "");
        case "status": return (a.homologacao_status_atual || "").localeCompare(b.homologacao_status_atual || "");
        case "id_legado": return (a.id_legado ?? 0) - (b.id_legado ?? 0);
        case "prioridade":
        default:
          return (a.prioridade_homologacao ?? 99) - (b.prioridade_homologacao ?? 99)
            || (a.nome_completo || "").localeCompare(b.nome_completo || "");
      }
    });
    return sorted;
  }, [rows, filtro, busca, ordem, extra]);

  // Próximo cliente sugerido (meta 1/dia)
  const sugerido = useMemo(() => {
    const candidatos = rows.filter(r =>
      r.cliente_legado_atual === true &&
      (r.homologacao_status_atual || "pendente") !== "homologado"
    );
    candidatos.sort((a, b) => {
      const ta = (extra[a.cliente_id]?.tentativa_compra_legado_count ?? 0) > 0 ? 0 : 1;
      const tb = (extra[b.cliente_id]?.tentativa_compra_legado_count ?? 0) > 0 ? 0 : 1;
      if (ta !== tb) return ta - tb;
      const pa = a.prioridade_homologacao ?? 99;
      const pb = b.prioridade_homologacao ?? 99;
      if (pa !== pb) return pa - pb;
      const ca = a.tem_craf ? 0 : 1;
      const cb = b.tem_craf ? 0 : 1;
      if (ca !== cb) return ca - cb;
      const va = a.tem_venda_antiga ? 0 : 1;
      const vb = b.tem_venda_antiga ? 0 : 1;
      if (va !== vb) return va - vb;
      return (a.nome_completo || "").localeCompare(b.nome_completo || "");
    });
    return candidatos[0] || null;
  }, [rows, extra]);

  // Progresso
  const totalLegado = kpis?.total_marcados_legado ?? 0;
  const homologados = kpis?.total_homologado ?? 0;
  const pctHomologado = totalLegado > 0 ? Math.round((homologados / totalLegado) * 100) : 0;
  const faltam = kpis?.faltam_homologar ?? 0;
  const diasRestantes = kpis?.meta_1_por_dia_dias_restantes ?? 0;

  const executar = useCallback(async () => {
    if (!acao) return;
    if (acao.tipo === "reabrir" && !obs.trim()) {
      toast.error("Motivo é obrigatório para reabrir homologação.");
      return;
    }
    setSubmitting(true);
    try {
      let rpcName: string;
      let params: Record<string, unknown>;
      switch (acao.tipo) {
        case "homologar":
          rpcName = "qa_homologar_cliente";
          params = { p_cliente_id: acao.cliente.cliente_id, p_observacao: obs.trim() || null };
          break;
        case "reabrir":
          rpcName = "qa_reabrir_homologacao_cliente";
          params = { p_cliente_id: acao.cliente.cliente_id, p_motivo: obs.trim() };
          break;
        case "em_revisao":
        case "aguardando_documentos":
        case "documentos_enviados":
          rpcName = "qa_atualizar_status_homologacao_cliente";
          params = {
            p_cliente_id: acao.cliente.cliente_id,
            p_status: acao.tipo,
            p_observacao: obs.trim() || null,
          };
          break;
      }
      const { data, error } = await supabase.rpc(rpcName as any, params as any);
      if (error) throw error;
      const result = (data ?? {}) as { ja_estava?: boolean; ja_estava_homologado?: boolean };
      if (result.ja_estava || result.ja_estava_homologado) {
        toast.info("Status já estava aplicado. Sem alteração.");
      } else {
        toast.success("Ação aplicada com sucesso.");
      }
      setAcao(null);
      setObs("");
      void carregar();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao aplicar ação";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [acao, obs, carregar]);

  const abrirHistorico = useCallback(async (r: DryRunRow) => {
    setHistoricoAberto(r);
    setEventos([]);
    setEventosLoading(true);
    try {
      const { data, error } = await supabase
        .from("qa_cliente_homologacao_eventos" as any)
        .select("*")
        .eq("qa_cliente_id", r.cliente_id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setEventos((data as unknown as EventoRow[]) ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar histórico";
      toast.error(msg);
    } finally {
      setEventosLoading(false);
    }
  }, []);

  const KpiCard = ({ label, value, icon: Icon, tone = "default" }: {
    label: string; value: number | null | undefined;
    icon: React.ComponentType<{ className?: string }>;
    tone?: "default" | "warn" | "ok" | "info";
  }) => {
    const toneCls = {
      default: "bg-white border-slate-200 text-slate-900",
      warn: "bg-amber-50 border-amber-200 text-amber-900",
      ok: "bg-emerald-50 border-emerald-200 text-emerald-900",
      info: "bg-blue-50 border-blue-200 text-blue-900",
    }[tone];
    return (
      <div className={`rounded-lg border p-3 ${toneCls}`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
          <Icon className="h-3.5 w-3.5 opacity-60" />
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value ?? 0}</div>
      </div>
    );
  };

  const tituloAcao: Record<AcaoTipo, string> = {
    homologar: "Homologar cliente",
    em_revisao: "Marcar em revisão",
    aguardando_documentos: "Solicitar documentos",
    documentos_enviados: "Marcar documentos enviados",
    reabrir: "Reabrir homologação",
  };
  const descAcao: Record<AcaoTipo, string> = {
    homologar: "Libera o cliente legado para operar no sistema novo sem recadastramento obrigatório.",
    em_revisao: "Marca o cliente como 'em revisão' pela Equipe Operacional.",
    aguardando_documentos: "Solicita ao cliente o envio dos documentos do recadastramento.",
    documentos_enviados: "Confirma que os documentos foram recebidos e estão sob análise.",
    reabrir: "Reabre o processo de homologação. Motivo é obrigatório.",
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto space-y-5">
        {/* Cabeçalho executivo */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-blue-700" />
              Homologação de Clientes Legados
            </h1>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
              Controle dos clientes migrados do Access que precisam ser recadastrados ou
              homologados antes de comprar novos serviços.
            </p>
          </div>
          <Button onClick={carregar} disabled={refreshing} variant="outline" size="sm">
            {refreshing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Atualizar
          </Button>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Total legados" value={kpis?.total_marcados_legado} icon={Users} />
          <KpiCard label="Pendentes" value={kpis?.total_legado_pendente} icon={Clock} tone="warn" />
          <KpiCard label="Homologados" value={kpis?.total_homologado} icon={CheckCircle2} tone="ok" />
          <KpiCard label="Em revisão" value={kpis?.total_em_revisao} icon={AlertTriangle} tone="info" />
          <KpiCard label="Aguardando docs" value={kpis?.total_aguardando_documentos} icon={Inbox} />
          <KpiCard label="Docs enviados" value={kpis?.total_documentos_enviados} icon={Inbox} />
          <KpiCard label="Tentaram comprar" value={kpis?.total_tentaram_comprar} icon={AlertTriangle} tone="warn" />
          <KpiCard label="Faltam homologar" value={kpis?.faltam_homologar} icon={Clock} tone="warn" />
          <KpiCard label="Meta 1/dia" value={1} icon={Target} />
          <KpiCard label="Dias restantes" value={kpis?.meta_1_por_dia_dias_restantes} icon={Clock} tone="info" />
        </section>

        {/* Progresso + Próximo sugerido */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-blue-700" /> Progresso da homologação
              </h2>
              <span className="text-[11px] text-slate-600">
                {homologados} de {totalLegado} ({pctHomologado}%) · faltam {faltam}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pctHomologado}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Meta sugerida: homologar 1 cliente por dia. Prazo estimado: <strong>{diasRestantes} dias</strong>.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" /> Próximo cliente sugerido
            </h2>
            {sugerido ? (
              <div className="mt-2">
                <div className="text-sm font-bold text-slate-900 uppercase truncate">
                  {sugerido.nome_completo || "—"}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  CPF: {sugerido.cpf || "—"} · ID legado: {sugerido.id_legado ?? "—"}
                </div>
                <div className="mt-1 flex flex-wrap">
                  {flag("TENTOU COMPRAR", sugerido.tentou_comprar, "warn")}
                  {flag("CRAF", sugerido.tem_craf)}
                  {flag("VENDA ANT.", sugerido.tem_venda_antiga)}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => { setBusca(sugerido.cpf || sugerido.nome_completo || ""); setFiltro("todos"); }}
                >
                  Localizar na lista
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500 italic">
                Nenhum cliente legado pendente. Meta atingida 🎉
              </p>
            )}
          </div>
        </section>

        {/* Filtros + busca + ordenação */}
        <section className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nome, CPF, e-mail ou ID legado"
              value={busca}
              onChange={(e) => setBusca(e.target.value.toUpperCase())}
              className="h-9 pl-8 uppercase"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as Filtro)}
              className="h-9 border border-slate-200 rounded-md px-2 text-xs bg-white uppercase font-semibold"
            >
              <option value="todos">TODOS</option>
              <option value="pendentes">PENDENTES</option>
              <option value="em_revisao">EM REVISÃO</option>
              <option value="aguardando_documentos">AGUARDANDO DOCUMENTOS</option>
              <option value="documentos_enviados">DOCUMENTOS ENVIADOS</option>
              <option value="homologados">HOMOLOGADOS</option>
              <option value="tentaram_comprar">TENTARAM COMPRAR</option>
              <option value="com_tentativa">COM TENTATIVA DE COMPRA</option>
              <option value="prioridade_1">PRIORIDADE 1</option>
              <option value="prioridade_3_craf">PRIORIDADE 3 — TÊM CRAF</option>
              <option value="prioridade_4_venda">PRIORIDADE 4 — VENDA ANTIGA</option>
              <option value="sem_cpf">SEM CPF</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Ordem)}
              className="h-9 border border-slate-200 rounded-md px-2 text-xs bg-white uppercase font-semibold"
            >
              <option value="prioridade">PRIORIDADE</option>
              <option value="tentativa_recente">TENTATIVA + RECENTE</option>
              <option value="nome">NOME</option>
              <option value="status">STATUS</option>
              <option value="id_legado">ID LEGADO</option>
            </select>
          </div>
          <span className="text-xs text-slate-500 ml-auto">
            {filtradas.length} resultado{filtradas.length === 1 ? "" : "s"}
          </span>
        </section>

        {/* Lista */}
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-10 flex items-center justify-center text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando clientes…
            </div>
          ) : filtradas.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhum cliente encontrado para este filtro.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtradas.map((r) => {
                const status = (r.homologacao_status_atual || "pendente").toLowerCase();
                const homologado = status === "homologado";
                const ex = extra[r.cliente_id];
                const tentativas = ex?.tentativa_compra_legado_count ?? 0;
                const recad = ex?.recadastramento_status;
                return (
                  <li key={r.cliente_id} className="p-3 md:p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 uppercase truncate">
                            {r.nome_completo || "—"}
                          </span>
                          {statusBadge(r.homologacao_status_atual)}
                          {typeof r.prioridade_homologacao === "number" && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#2563EB] text-white">
                              P{r.prioridade_homologacao}
                            </span>
                          )}
                          {recad && (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              REC: {recad}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>CPF: <strong className="text-slate-800">{r.cpf || "—"}</strong></span>
                          <span>E-mail: <strong className="text-slate-800">{r.email || "—"}</strong></span>
                          <span>Tel: <strong className="text-slate-800">{r.celular || "—"}</strong></span>
                          <span>ID legado: <strong className="text-slate-800">{r.id_legado ?? "—"}</strong></span>
                          {tentativas > 0 && (
                            <span className="text-amber-700">
                              Tentativas: <strong>{tentativas}</strong> · última {fmtData(ex?.tentativa_compra_legado_em ?? null)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap">
                          {flag("VENDA ANT.", r.tem_venda_antiga)}
                          {flag("CRAF", r.tem_craf)}
                          {flag("DOC", r.tem_documento_cliente)}
                          {flag("ARMA MANUAL", r.tem_arma_manual)}
                          {flag("TENTOU COMPRAR", r.tentou_comprar || tentativas > 0, "warn")}
                          {flag("SEM CPF", r.sem_cpf)}
                          {flag("CPF DUP.", r.cpf_duplicado)}
                        </div>
                        {r.motivo_classificacao && (
                          <p className="mt-1.5 text-[11px] text-slate-500 italic">
                            {r.motivo_classificacao}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-end">
                        <Button variant="outline" size="sm" onClick={() => abrirHistorico(r)}>
                          <HistoryIcon className="h-3.5 w-3.5 mr-1" /> Histórico
                        </Button>
                        {!homologado && (
                          <>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => { setAcao({ cliente: r, tipo: "em_revisao" }); setObs(""); }}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> Em revisão
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => { setAcao({ cliente: r, tipo: "aguardando_documentos" }); setObs(""); }}
                            >
                              <FileSearch className="h-3.5 w-3.5 mr-1" /> Solicitar docs
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => { setAcao({ cliente: r, tipo: "documentos_enviados" }); setObs(""); }}
                            >
                              <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Docs enviados
                            </Button>
                            <Button
                              size="sm"
                              className="bg-blue-700 hover:bg-blue-800 text-white"
                              onClick={() => { setAcao({ cliente: r, tipo: "homologar" }); setObs(""); }}
                            >
                              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Homologar
                            </Button>
                          </>
                        )}
                        {homologado && (
                          <Button
                            variant="outline" size="sm"
                            className="border-amber-300 text-amber-800 hover:bg-amber-50"
                            onClick={() => { setAcao({ cliente: r, tipo: "reabrir" }); setObs(""); }}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reabrir
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Modal de ação genérico */}
      <Dialog open={!!acao} onOpenChange={(o) => !o && setAcao(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase text-base">
              {acao ? tituloAcao[acao.tipo] : ""}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {acao ? descAcao[acao.tipo] : ""}
            </DialogDescription>
          </DialogHeader>
          {acao && (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs space-y-0.5">
                <div className="font-bold uppercase text-slate-900">{acao.cliente.nome_completo}</div>
                <div className="text-slate-600">CPF: {acao.cliente.cpf || "—"}</div>
                <div className="text-slate-600">E-mail: {acao.cliente.email || "—"}</div>
                <div className="text-slate-600">ID legado: {acao.cliente.id_legado ?? "—"}</div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-700 mb-1 block">
                  {acao.tipo === "reabrir" ? "Motivo (obrigatório)" : "Observação (opcional)"}
                </label>
                <Textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value.toUpperCase())}
                  rows={3}
                  className="text-xs uppercase"
                  placeholder={acao.tipo === "reabrir" ? "MOTIVO DA REABERTURA" : "OBSERVAÇÃO OPCIONAL"}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAcao(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className={
                acao?.tipo === "reabrir"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : acao?.tipo === "homologar"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-blue-700 hover:bg-blue-800 text-white"
              }
              onClick={executar}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de histórico */}
      <Dialog open={!!historicoAberto} onOpenChange={(o) => !o && setHistoricoAberto(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase text-base">Histórico de homologação</DialogTitle>
            <DialogDescription className="text-xs">
              {historicoAberto?.nome_completo}
            </DialogDescription>
          </DialogHeader>
          {eventosLoading ? (
            <div className="p-6 flex items-center justify-center text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando…
            </div>
          ) : eventos.length === 0 ? (
            <p className="text-xs text-slate-500 p-3">Nenhum evento registrado.</p>
          ) : (
            <ul className="space-y-2">
              {eventos.map((ev) => {
                const destacar = [
                  "cliente_legado_marcado",
                  "tentativa_compra_legado",
                  "status_homologacao_alterado",
                  "cliente_homologado",
                  "homologacao_reaberta",
                ].includes(ev.tipo_evento);
                return (
                  <li key={ev.id} className={`border rounded-md p-2.5 text-xs ${destacar ? "border-blue-200 bg-blue-50/40" : "border-slate-200"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase text-slate-800">{ev.tipo_evento}</span>
                      <span className="text-[10px] text-slate-500">{fmtData(ev.created_at)}</span>
                    </div>
                    {ev.descricao && <p className="mt-0.5 text-slate-600">{ev.descricao}</p>}
                    {ev.ator && <p className="mt-0.5 text-[10px] text-slate-500 uppercase">Ator: {ev.ator}</p>}
                    {ev.dados_json && Object.keys(ev.dados_json).length > 0 && (
                      <pre className="mt-1 text-[10px] text-slate-500 bg-slate-50 rounded px-1.5 py-1 overflow-x-auto">
                        {JSON.stringify(ev.dados_json, null, 0)}
                      </pre>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * FASE 20-C — Painel de Homologação de Clientes Legados.
 *
 * Permite à Equipe Operacional:
 *   - acompanhar quantos clientes antigos do Access ainda faltam homologar
 *     (views: qa_clientes_homologacao_kpis e qa_clientes_homologacao_dry_run);
 *   - homologar manualmente 1 cliente por vez via RPC qa_homologar_cliente;
 *   - reabrir homologação via RPC qa_reabrir_homologacao_cliente;
 *   - consultar histórico de eventos em qa_cliente_homologacao_eventos.
 *
 * NÃO altera vendas, processos, checklist, pagamento, qa_crafs,
 * qa_cliente_armas_manual, qa_documentos_cliente, fotos de armas
 * nem o self-service do cliente. Esta tela é apenas leitura + RPCs aprovadas.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  RefreshCw, Loader2, Search, ShieldCheck, History as HistoryIcon,
  CheckCircle2, AlertTriangle, Filter, Users, Clock, Inbox,
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

interface EventoRow {
  id: string;
  cliente_id: number;
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
  | "prioridade_4_venda";

/* ─── Utils ─── */
function fmtData(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR");
  } catch {
    return s;
  }
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

function flag(label: string, on: boolean | null | undefined) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-semibold uppercase mr-1">
      {label}
    </span>
  );
}

/* ─── Página ─── */
export default function QAHomologacaoClientesPage() {
  const [kpis, setKpis] = useState<KpiRow | null>(null);
  const [rows, setRows] = useState<DryRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [busca, setBusca] = useState("");
  const [acaoCliente, setAcaoCliente] = useState<DryRunRow | null>(null);
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
      setKpis((kpiData as unknown as KpiRow) ?? null);
      setRows(((rowsData as unknown as DryRunRow[]) ?? []));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar painel";
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtradas = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    return rows.filter((r) => {
      const status = (r.homologacao_status_atual || "pendente").toLowerCase();
      switch (filtro) {
        case "pendentes": if (status !== "pendente") return false; break;
        case "homologados": if (status !== "homologado") return false; break;
        case "em_revisao": if (status !== "em_revisao") return false; break;
        case "aguardando_documentos": if (status !== "aguardando_documentos") return false; break;
        case "documentos_enviados": if (status !== "documentos_enviados") return false; break;
        case "tentaram_comprar": if (!r.tentou_comprar) return false; break;
        case "prioridade_1": if (r.prioridade_homologacao !== 1) return false; break;
        case "prioridade_3_craf": if (r.prioridade_homologacao !== 3) return false; break;
        case "prioridade_4_venda": if (r.prioridade_homologacao !== 4) return false; break;
        case "todos": default: break;
      }
      if (!buscaNorm) return true;
      const hay = [
        r.nome_completo, r.cpf, r.email, String(r.id_legado ?? ""),
      ].filter(Boolean).map((s) => String(s).toLowerCase()).join(" ");
      return hay.includes(buscaNorm);
    });
  }, [rows, filtro, busca]);

  const homologar = useCallback(async () => {
    if (!acaoCliente) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("qa_homologar_cliente" as any, {
        p_cliente_id: acaoCliente.cliente_id,
        p_observacao: obs.trim() || null,
      });
      if (error) throw error;
      const result = data as { ja_estava_homologado?: boolean } | null;
      if (result?.ja_estava_homologado) {
        toast.info("Cliente já estava homologado.");
      } else {
        toast.success("Cliente homologado com sucesso.");
      }
      setAcaoCliente(null);
      setObs("");
      void carregar();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao homologar cliente";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [acaoCliente, obs, carregar]);

  const abrirHistorico = useCallback(async (r: DryRunRow) => {
    setHistoricoAberto(r);
    setEventos([]);
    setEventosLoading(true);
    try {
      const { data, error } = await supabase
        .from("qa_cliente_homologacao_eventos" as any)
        .select("*")
        .eq("cliente_id", r.cliente_id)
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

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto space-y-5">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-blue-700" />
              Homologação de Clientes
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Equipe Operacional · clientes legados do Access pendentes de homologação
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
          <KpiCard label="Meta 1/dia" value={1} icon={CheckCircle2} />
          <KpiCard label="Dias restantes" value={kpis?.meta_1_por_dia_dias_restantes} icon={Clock} tone="info" />
        </section>

        {/* Filtros */}
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
              <option value="pendentes">PENDENTES</option>
              <option value="homologados">HOMOLOGADOS</option>
              <option value="em_revisao">EM REVISÃO</option>
              <option value="aguardando_documentos">AGUARDANDO DOCUMENTOS</option>
              <option value="documentos_enviados">DOCUMENTOS ENVIADOS</option>
              <option value="tentaram_comprar">TENTARAM COMPRAR</option>
              <option value="prioridade_1">PRIORIDADE 1</option>
              <option value="prioridade_3_craf">PRIORIDADE 3 (CRAF)</option>
              <option value="prioridade_4_venda">PRIORIDADE 4 (VENDA ANTIGA)</option>
              <option value="todos">TODOS</option>
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
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-900 text-white">
                              P{r.prioridade_homologacao}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>CPF: <strong className="text-slate-800">{r.cpf || "—"}</strong></span>
                          <span>E-mail: <strong className="text-slate-800">{r.email || "—"}</strong></span>
                          <span>Tel: <strong className="text-slate-800">{r.celular || "—"}</strong></span>
                          <span>ID legado: <strong className="text-slate-800">{r.id_legado ?? "—"}</strong></span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap">
                          {flag("VENDA ANT.", r.tem_venda_antiga)}
                          {flag("CRAF", r.tem_craf)}
                          {flag("DOC", r.tem_documento_cliente)}
                          {flag("ARMA MANUAL", r.tem_arma_manual)}
                          {flag("TENTOU COMPRAR", r.tentou_comprar)}
                          {flag("SEM CPF", r.sem_cpf)}
                          {flag("CPF DUP.", r.cpf_duplicado)}
                        </div>
                        {r.motivo_classificacao && (
                          <p className="mt-1.5 text-[11px] text-slate-500 italic">
                            {r.motivo_classificacao}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => abrirHistorico(r)}>
                          <HistoryIcon className="h-3.5 w-3.5 mr-1.5" /> Histórico
                        </Button>
                        {!homologado && (
                          <Button
                            size="sm"
                            className="bg-blue-700 hover:bg-blue-800 text-white"
                            onClick={() => { setAcaoCliente(r); setObs(""); }}
                          >
                            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Homologar cliente
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

      {/* Modal de homologação */}
      <Dialog open={!!acaoCliente} onOpenChange={(o) => !o && setAcaoCliente(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase text-base">Homologar cliente</DialogTitle>
            <DialogDescription className="text-xs">
              Confirme a homologação manual deste cliente legado.
            </DialogDescription>
          </DialogHeader>
          {acaoCliente && (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs space-y-0.5">
                <div className="font-bold uppercase text-slate-900">{acaoCliente.nome_completo}</div>
                <div className="text-slate-600">CPF: {acaoCliente.cpf || "—"}</div>
                <div className="text-slate-600">E-mail: {acaoCliente.email || "—"}</div>
                <div className="text-slate-600">ID legado: {acaoCliente.id_legado ?? "—"}</div>
              </div>
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Esta ação libera o cliente antigo para operar no sistema novo sem
                  recadastramento obrigatório. A origem legada é preservada.
                </span>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-700 mb-1 block">
                  Observação (opcional)
                </label>
                <Textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value.toUpperCase())}
                  rows={3}
                  className="text-xs uppercase"
                  placeholder="MOTIVO OU CONTEXTO DA HOMOLOGAÇÃO"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAcaoCliente(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={homologar}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
              Confirmar homologação
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
              {eventos.map((ev) => (
                <li key={ev.id} className="border border-slate-200 rounded-md p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase text-slate-800">{ev.tipo_evento}</span>
                    <span className="text-[10px] text-slate-500">{fmtData(ev.created_at)}</span>
                  </div>
                  {ev.descricao && <p className="mt-0.5 text-slate-600">{ev.descricao}</p>}
                  {ev.ator && <p className="mt-0.5 text-[10px] text-slate-500 uppercase">Ator: {ev.ator}</p>}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
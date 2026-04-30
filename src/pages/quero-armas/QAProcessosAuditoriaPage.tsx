/**
 * Auditoria de Processos — Painel de observabilidade da Central de Documentos.
 * KPIs (volume, taxa aprovação IA, divergências, tempo médio), filtros e timeline.
 * Lê: qa_processos, qa_processo_documentos, qa_processo_eventos.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldCheck, ArrowLeft, FileSearch, AlertTriangle, CheckCircle, Clock, TrendingUp,
  Filter, RefreshCw, Sparkles, User, FileText, ChevronRight,
} from "lucide-react";
import {
  getStatusProcesso, getStatusDocumento, formatDateTime, formatDate,
} from "@/components/quero-armas/processos/processoConstants";

type Processo = {
  id: string; cliente_id: number; servico_id: number; servico_nome: string | null;
  status: string; data_criacao: string; data_validacao: string | null;
  observacoes_admin: string | null; created_at: string; updated_at: string;
};
type Documento = {
  id: string; processo_id: string; tipo_documento: string; nome_documento: string;
  status: string; obrigatorio: boolean; motivo_rejeicao: string | null;
  validacao_ia_status: string | null; validacao_ia_confianca: number | null;
  validacao_ia_modelo: string | null; data_envio: string | null; data_validacao: string | null;
  divergencias_json: any; created_at: string;
};
type Evento = {
  id: string; processo_id: string; documento_id: string | null;
  tipo_evento: string; descricao: string | null; dados_json: any;
  ator: string | null; user_id: string | null; created_at: string;
};
type Cliente = { id: number; nome: string | null; cpf: string | null };

const RANGES = [
  { id: "24h", label: "24H", hours: 24 },
  { id: "7d", label: "7D", hours: 24 * 7 },
  { id: "30d", label: "30D", hours: 24 * 30 },
  { id: "all", label: "TUDO", hours: 0 },
] as const;

export default function QAProcessosAuditoriaPage() {
  const [range, setRange] = useState<typeof RANGES[number]["id"]>("30d");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [clientes, setClientes] = useState<Record<number, Cliente>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const fromIso = useMemo(() => {
    const r = RANGES.find(x => x.id === range)!;
    if (r.hours === 0) return null;
    return new Date(Date.now() - r.hours * 3600 * 1000).toISOString();
  }, [range]);

  const load = async () => {
    setLoading(true);
    try {
      let pq: any = supabase.from("qa_processos" as any).select("*").order("created_at", { ascending: false }).limit(500);
      if (fromIso) pq = pq.gte("created_at", fromIso);
      if (statusFilter !== "all") pq = pq.eq("status", statusFilter);
      const { data: pData } = await pq;
      const procs = (pData || []) as Processo[];
      setProcessos(procs);

      const procIds = procs.map(p => p.id);
      const cliIds = Array.from(new Set(procs.map(p => p.cliente_id).filter(Boolean)));

      const [{ data: dData }, { data: eData }, { data: cData }] = await Promise.all([
        procIds.length
          ? supabase.from("qa_processo_documentos" as any).select("*").in("processo_id", procIds)
          : Promise.resolve({ data: [] as any[] }),
        procIds.length
          ? supabase.from("qa_processo_eventos" as any).select("*").in("processo_id", procIds).order("created_at", { ascending: false }).limit(500)
          : Promise.resolve({ data: [] as any[] }),
        cliIds.length
          ? supabase.from("qa_clientes" as any).select("id, nome, cpf").in("id", cliIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      setDocumentos((dData || []) as Documento[]);
      setEventos((eData || []) as Evento[]);
      const cmap: Record<number, Cliente> = {};
      (cData || []).forEach((c: any) => { cmap[c.id] = c; });
      setClientes(cmap);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range, statusFilter]);

  // ============ KPIs ============
  const kpis = useMemo(() => {
    const total = processos.length;
    const concluidos = processos.filter(p => p.status === "concluido" || p.status === "aprovado").length;
    const cancelados = processos.filter(p => p.status === "cancelado" || p.status === "bloqueado").length;
    const ativos = total - concluidos - cancelados;

    const docsTotal = documentos.length;
    const docsAprov = documentos.filter(d => d.status === "aprovado" || d.status === "dispensado_grupo").length;
    const docsDiverg = documentos.filter(d => d.status === "divergente" || d.status === "invalido").length;
    const docsRevHumana = documentos.filter(d => d.status === "revisao_humana").length;

    const iaValidados = documentos.filter(d => d.validacao_ia_status);
    const iaOk = iaValidados.filter(d => d.validacao_ia_status === "aprovado" || d.validacao_ia_status === "ok").length;
    const taxaIA = iaValidados.length ? Math.round((iaOk / iaValidados.length) * 100) : 0;
    const confMedia = iaValidados.length
      ? (iaValidados.reduce((s, d) => s + Number(d.validacao_ia_confianca || 0), 0) / iaValidados.length)
      : 0;

    // Tempo médio: criação → primeira validação humana/aprovado
    const tempos = processos
      .filter(p => p.data_validacao)
      .map(p => (new Date(p.data_validacao!).getTime() - new Date(p.data_criacao).getTime()) / 3600000);
    const tempoMedioH = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

    return {
      total, concluidos, cancelados, ativos,
      docsTotal, docsAprov, docsDiverg, docsRevHumana,
      taxaIA, confMedia, tempoMedioH,
    };
  }, [processos, documentos]);

  // ============ Detalhe selecionado ============
  const procSel = processos.find(p => p.id === selected) || null;
  const docsSel = documentos.filter(d => d.processo_id === selected);
  const eventosSel = eventos.filter(e => e.processo_id === selected);
  const cliSel = procSel ? clientes[procSel.cliente_id] : null;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/auditoria" className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
            <ArrowLeft className="h-4 w-4 text-slate-700" />
          </Link>
          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-[#2563EB] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 uppercase">
              Auditoria — Central de Documentos
            </h1>
            <p className="text-xs text-slate-500">Observabilidade dos processos, validações IA e timeline imutável de eventos.</p>
          </div>
        </div>
        <button onClick={load} className="px-3 h-9 text-xs font-bold uppercase tracking-wide rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Período:</span>
        {RANGES.map(r => (
          <button key={r.id}
            onClick={() => setRange(r.id)}
            className={`px-3 h-7 text-[11px] font-bold uppercase rounded-md border transition ${
              range === r.id ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
            }`}>{r.label}</button>
        ))}
        <span className="mx-3 h-5 w-px bg-slate-200" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Status:</span>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-7 text-[11px] font-bold uppercase border border-slate-200 rounded-md px-2 bg-white text-slate-700">
          <option value="all">TODOS</option>
          <option value="aguardando_pagamento">AGUARDANDO PAGAMENTO</option>
          <option value="aguardando_documentos">AGUARDANDO DOCUMENTOS</option>
          <option value="em_validacao_ia">VALIDAÇÃO AUTOMÁTICA</option>
          <option value="em_revisao_humana">EM REVISÃO HUMANA</option>
          <option value="aprovado">APROVADO</option>
          <option value="em_andamento">EM ANDAMENTO</option>
          <option value="concluido">CONCLUÍDO</option>
          <option value="cancelado">CANCELADO</option>
          <option value="bloqueado">BLOQUEADO</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={FileSearch} label="Processos" value={kpis.total} hint={`${kpis.ativos} ativos`} color="#0F172A" />
        <KpiCard icon={CheckCircle} label="Aprovados" value={kpis.concluidos} hint={`${kpis.cancelados} cancel.`} color="#10B981" />
        <KpiCard icon={Sparkles} label="Taxa IA OK" value={`${kpis.taxaIA}%`} hint={`${kpis.confMedia.toFixed(2)} conf. média`} color="#6366F1" />
        <KpiCard icon={Clock} label="Tempo médio" value={kpis.tempoMedioH ? `${kpis.tempoMedioH.toFixed(1)}h` : "—"} hint="criação → validação" color="#F59E0B" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={FileText} label="Documentos" value={kpis.docsTotal} color="#0EA5E9" />
        <KpiCard icon={CheckCircle} label="Docs aprovados" value={kpis.docsAprov} color="#10B981" />
        <KpiCard icon={AlertTriangle} label="Divergentes/Inv." value={kpis.docsDiverg} color="#F59E0B" />
        <KpiCard icon={User} label="Revisão humana" value={kpis.docsRevHumana} color="#0EA5E9" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lista de Processos */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Processos ({processos.length})</h2>
            <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
            {loading && <div className="p-6 text-center text-xs text-slate-400 uppercase">CARREGANDO…</div>}
            {!loading && processos.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400 uppercase">NENHUM PROCESSO NO PERÍODO</div>
            )}
            {processos.map(p => {
              const st = getStatusProcesso(p.status);
              const cli = clientes[p.cliente_id];
              const docsP = documentos.filter(d => d.processo_id === p.id);
              const aprov = docsP.filter(d => d.status === "aprovado" || d.status === "dispensado_grupo").length;
              return (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-center gap-3 ${
                    selected === p.id ? "bg-slate-50 border-l-2 border-[#2563EB]" : ""
                  }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${st.bg} ${st.text} border ${st.border}`}>
                        {st.label}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">{p.id.slice(0, 8)}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 uppercase truncate">
                      {cli?.nome || `CLIENTE #${p.cliente_id}`}
                    </div>
                    <div className="text-[11px] text-slate-500 uppercase truncate">
                      {p.servico_nome || `SERVIÇO #${p.servico_id}`} · {formatDateTime(p.created_at)}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400 uppercase tracking-wider">
                      {aprov}/{docsP.length} DOCS APROVADOS
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Detalhe + Timeline */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {procSel ? "Detalhe do Processo" : "Selecione um processo"}
            </h2>
          </div>
          {!procSel && (
            <div className="p-10 text-center text-xs text-slate-400 uppercase">
              CLIQUE EM UM PROCESSO À ESQUERDA PARA VER A TIMELINE COMPLETA.
            </div>
          )}
          {procSel && (
            <div className="max-h-[600px] overflow-y-auto p-4 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cliente</div>
                <div className="text-sm font-bold uppercase text-slate-900">{cliSel?.nome || `#${procSel.cliente_id}`}</div>
                {cliSel?.cpf && <div className="text-[11px] font-mono text-slate-500">{cliSel.cpf}</div>}
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-slate-400 uppercase">Serviço:</span> <span className="font-semibold uppercase">{procSel.servico_nome || `#${procSel.servico_id}`}</span></div>
                  <div><span className="text-slate-400 uppercase">Criado:</span> {formatDate(procSel.created_at)}</div>
                </div>
              </div>

              {/* Documentos */}
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Documentos ({docsSel.length})</h3>
                <div className="space-y-1.5">
                  {docsSel.map(d => {
                    const sd = getStatusDocumento(d.status);
                    return (
                      <div key={d.id} className="border border-slate-200 rounded-md p-2 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold uppercase truncate">{d.nome_documento}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border" style={{ color: sd.color, borderColor: sd.color + "40" }}>{sd.label}</span>
                        </div>
                        {d.validacao_ia_status && (
                          <div className="mt-1 text-slate-500 flex items-center gap-2 flex-wrap">
                            <Sparkles className="h-3 w-3 text-indigo-500" />
                            <span className="uppercase">IA: {d.validacao_ia_status}</span>
                            {d.validacao_ia_confianca != null && <span className="font-mono">conf {Number(d.validacao_ia_confianca).toFixed(2)}</span>}
                            {d.validacao_ia_modelo && <span className="text-slate-400 uppercase">{d.validacao_ia_modelo}</span>}
                          </div>
                        )}
                        {d.motivo_rejeicao && (
                          <div className="mt-1 text-amber-700 uppercase">⚠ {d.motivo_rejeicao}</div>
                        )}
                      </div>
                    );
                  })}
                  {docsSel.length === 0 && <div className="text-[11px] text-slate-400 uppercase">SEM DOCUMENTOS</div>}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Timeline ({eventosSel.length})</h3>
                <ol className="relative border-l-2 border-slate-200 ml-2 space-y-3">
                  {eventosSel.map(ev => (
                    <li key={ev.id} className="ml-4">
                      <div className="absolute -left-[7px] w-3 h-3 rounded-full bg-slate-900 border-2 border-white" />
                      <div className="text-[10px] font-mono text-slate-400 uppercase">{formatDateTime(ev.created_at)}</div>
                      <div className="text-[12px] font-bold uppercase text-slate-800">{ev.tipo_evento}</div>
                      {ev.descricao && <div className="text-[11px] text-slate-600">{ev.descricao}</div>}
                      <div className="text-[10px] text-slate-400 uppercase">ATOR: {ev.ator || "SISTEMA"}</div>
                    </li>
                  ))}
                  {eventosSel.length === 0 && <div className="text-[11px] text-slate-400 uppercase ml-2">SEM EVENTOS REGISTRADOS</div>}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint, color }: { icon: any; label: string; value: any; hint?: string; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight" style={{ color }}>{value}</div>
      {hint && <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
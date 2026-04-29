import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Inbox, ArrowRight, ExternalLink, AlertCircle, CheckCircle2,
  FileText, CreditCard, Clock, User, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bloco "Novos Cadastros Recebidos"
 * Fonte: tabela qa_cadastro_publico (formulário público de cadastro).
 * Ordem: do mais antigo para o mais novo (created_at ASC).
 * Para cada cadastro: tenta cruzar com qa_processos / qa_vendas via cliente_id_vinculado.
 */

type CadastroRow = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  servico_interesse: string | null;
  status: string | null;
  pago: boolean | null;
  pago_em: string | null;
  cliente_id_vinculado: number | null;
  processado_em: string | null;
  created_at: string;
  end1_cidade: string | null;
  end1_estado: string | null;
};

type ProcessoMin = {
  id: string;
  cliente_id: number;
  servico_nome: string | null;
  status: string | null;
  pagamento_status: string | null;
  created_at: string;
};

type VendaMin = {
  id: number;
  cliente_id: number;
  status: string | null;
  numero_processo: string | null;
};

type FilterKey =
  | "todos"
  | "nao_analisados"
  | "sem_servico"
  | "sem_processo"
  | "com_prazo"
  | "aguard_docs"
  | "pgto_pendente"
  | "incompletos";

interface ConsolidatedRow {
  cadastro: CadastroRow;
  processo: ProcessoMin | null;
  venda: VendaMin | null;
  statusInicial: string;
  statusColor: string;
  prazoLabel: string;
  pendencias: string[];
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function classifyStatus(c: CadastroRow, p: ProcessoMin | null, v: VendaMin | null): { label: string; color: string } {
  if (c.status === "rejeitado") return { label: "Rejeitado", color: "#dc2626" };
  if (!c.servico_interesse) return { label: "Sem serviço identificado", color: "#dc2626" };
  if (!c.cliente_id_vinculado && !c.processado_em) return { label: "Aguardando análise", color: "#ca8a04" };
  if (c.pago === false) return { label: "Pagamento pendente", color: "#ea580c" };
  if (c.cliente_id_vinculado && !p && !v) return { label: "Serviço recebido — processo ainda não aberto", color: "#0891b2" };
  if (p?.status === "aguardando_pagamento") return { label: "Pagamento pendente", color: "#ea580c" };
  if (p?.status?.includes("documento")) return { label: "Aguardando documentos", color: "#ca8a04" };
  if (p) return { label: "Processo aberto", color: "#16a34a" };
  if (c.cliente_id_vinculado) return { label: "Cadastro aprovado", color: "#16a34a" };
  return { label: "Novo cadastro", color: "#6366f1" };
}

function buildPrazoLabel(c: CadastroRow, p: ProcessoMin | null): string {
  if (!p) {
    if (!c.cliente_id_vinculado) return "Ainda sem prazo processual iniciado";
    return "Aguardando abertura de processo";
  }
  if (p.status === "aguardando_pagamento") return "Aguardando pagamento";
  if (p.status?.includes("protocolo")) return "Aguardando protocolo PF";
  if (p.status?.includes("notificacao")) return "Aguardando notificação PF";
  return "Prazo PF iniciado";
}

function buildPendencias(c: CadastroRow, p: ProcessoMin | null, v: VendaMin | null): string[] {
  const out: string[] = [];
  if (!c.servico_interesse) out.push("Serviço não informado");
  if (!c.cliente_id_vinculado) out.push("Não vinculado em /clientes");
  if (c.pago === false && !p) out.push("Sem pagamento confirmado");
  if (c.cliente_id_vinculado && !p && !v) out.push("Sem processo/venda aberto");
  return out;
}

export default function DashboardNovosCadastrosRecebidos() {
  const [rows, setRows] = useState<CadastroRow[]>([]);
  const [processos, setProcessos] = useState<ProcessoMin[]>([]);
  const [vendas, setVendas] = useState<VendaMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [analisados, setAnalisados] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("qa_novos_cad_analisados") || "[]")); } catch { return new Set(); }
  });
  const [arquivados, setArquivados] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("qa_novos_cad_arquivados") || "[]")); } catch { return new Set(); }
  });

  async function load() {
    setLoading(true);
    const { data: cads } = await supabase
      .from("qa_cadastro_publico")
      .select("id,nome_completo,cpf,email,servico_interesse,status,pago,pago_em,cliente_id_vinculado,processado_em,created_at,end1_cidade,end1_estado")
      .order("created_at", { ascending: true })
      .limit(100);
    const list = ((cads as any[]) ?? []) as CadastroRow[];
    setRows(list);

    const clienteIds = list.map(r => r.cliente_id_vinculado).filter((x): x is number => !!x);
    if (clienteIds.length > 0) {
      const { data: pData } = await supabase
        .from("qa_processos")
        .select("id,cliente_id,servico_nome,status,pagamento_status,created_at")
        .in("cliente_id", clienteIds)
        .order("created_at", { ascending: false });
      setProcessos(((pData as any[]) ?? []) as ProcessoMin[]);

      const { data: vData } = await supabase
        .from("qa_vendas")
        .select("id,cliente_id,status,numero_processo")
        .in("cliente_id", clienteIds)
        .order("data_cadastro", { ascending: false });
      setVendas(((vData as any[]) ?? []) as VendaMin[]);
    } else {
      setProcessos([]); setVendas([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    let alive = true;
    load();
    // Realtime: novos cadastros entram no monitor automaticamente
    const ch = supabase
      .channel("dash-novos-cadastros")
      .on("postgres_changes", { event: "*", schema: "public", table: "qa_cadastro_publico" }, () => { if (alive) load(); })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const consolidated: ConsolidatedRow[] = useMemo(() => {
    return rows.map(c => {
      const p = c.cliente_id_vinculado
        ? processos.find(x => x.cliente_id === c.cliente_id_vinculado) ?? null
        : null;
      const v = c.cliente_id_vinculado
        ? vendas.find(x => x.cliente_id === c.cliente_id_vinculado) ?? null
        : null;
      const st = classifyStatus(c, p, v);
      return {
        cadastro: c,
        processo: p,
        venda: v,
        statusInicial: st.label,
        statusColor: st.color,
        prazoLabel: buildPrazoLabel(c, p),
        pendencias: buildPendencias(c, p, v),
      };
    });
  }, [rows, processos, vendas]);

  const visible = useMemo(() => {
    return consolidated.filter(r => {
      if (arquivados.has(r.cadastro.id)) return false;
      switch (filter) {
        case "nao_analisados": return !analisados.has(r.cadastro.id);
        case "sem_servico": return !r.cadastro.servico_interesse;
        case "sem_processo": return !r.processo;
        case "com_prazo": return !!r.processo && !["aguardando_pagamento"].includes(r.processo.status || "");
        case "aguard_docs": return r.statusInicial.includes("documento");
        case "pgto_pendente": return r.statusInicial.includes("Pagamento");
        case "incompletos": return !r.cadastro.cliente_id_vinculado || !r.cadastro.servico_interesse;
        default: return true;
      }
    });
  }, [consolidated, filter, analisados, arquivados]);

  const totalPendentes = consolidated.filter(r => !analisados.has(r.cadastro.id) && !arquivados.has(r.cadastro.id)).length;

  function toggleAnalisado(id: string) {
    setAnalisados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("qa_novos_cad_analisados", JSON.stringify([...next]));
      return next;
    });
  }
  function arquivar(id: string) {
    setArquivados(prev => {
      const next = new Set(prev); next.add(id);
      localStorage.setItem("qa_novos_cad_arquivados", JSON.stringify([...next]));
      return next;
    });
  }

  const filters: { key: FilterKey; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "nao_analisados", label: "Não analisados" },
    { key: "sem_servico", label: "Sem serviço" },
    { key: "sem_processo", label: "Sem processo" },
    { key: "com_prazo", label: "Com prazo iniciado" },
    { key: "aguard_docs", label: "Aguardando docs" },
    { key: "pgto_pendente", label: "Pagamento pendente" },
    { key: "incompletos", label: "Cadastro incompleto" },
  ];

  return (
    <div className="qa-card p-4 md:p-6" style={{ background: "#ffffff" }}>
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5" style={{ color: "hsl(220 30% 30%)" }} />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "hsl(220 20% 18%)" }}>
              Novos Cadastros Recebidos {!loading && <span className="text-blue-600">— {totalPendentes} pendente{totalPendentes !== 1 ? "s" : ""}</span>}
            </h3>
            <p className="text-xs text-slate-500">Clientes que entraram pelo formulário público — ordenados do mais antigo para o mais novo.</p>
          </div>
        </div>
        <Link to="/clientes" className="text-xs font-medium text-blue-600 flex items-center gap-1 hover:underline">
          Ver clientes <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
              filter === f.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : visible.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          {consolidated.length === 0 ? "Nenhum cadastro público recebido." : "Nenhum cadastro corresponde ao filtro selecionado."}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(r => {
            const c = r.cadastro;
            const isAnalisado = analisados.has(c.id);
            return (
              <div
                key={c.id}
                className="border rounded-lg p-3 hover:shadow-sm transition"
                style={{ borderColor: "#e2e8f0", background: isAnalisado ? "#f8fafc" : "#ffffff", opacity: isAnalisado ? 0.75 : 1 }}
              >
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "hsl(220 20% 18%)" }}>{c.nome_completo}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: r.statusColor }}>
                        {r.statusInicial}
                      </span>
                      {isAnalisado && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium uppercase">Analisado</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span><strong>CPF:</strong> {c.cpf || "—"}</span>
                      <span><strong>Recebido:</strong> {formatDateTime(c.created_at)}</span>
                      <span><strong>Origem:</strong> Formulário público</span>
                      {c.end1_cidade && <span>{c.end1_cidade}/{c.end1_estado}</span>}
                    </div>
                    <div className="text-xs text-slate-700 mt-1.5">
                      <strong>Serviço:</strong> {c.servico_interesse || <span className="text-red-600">não informado</span>}
                      {" · "}
                      <strong>Prazo:</strong> <span className="text-slate-600">{r.prazoLabel}</span>
                    </div>
                    {r.pendencias.length > 0 && (
                      <div className="mt-1.5 flex items-start gap-1 text-xs text-amber-700">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{r.pendencias.join(" · ")}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {c.cliente_id_vinculado ? (
                      <Link
                        to={`/clientes?focus=${c.cliente_id_vinculado}`}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                      >
                        <User className="w-3 h-3" /> Abrir cliente <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <Link
                        to="/clientes"
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
                      >
                        <User className="w-3 h-3" /> Buscar em /clientes
                      </Link>
                    )}
                    {r.processo && (
                      <Link
                        to={`/processos?focus=${r.processo.id}`}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                      >
                        <FileText className="w-3 h-3" /> Abrir processo
                      </Link>
                    )}
                    {r.venda && (
                      <Link
                        to={`/financeiro?venda=${r.venda.id}`}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100"
                      >
                        <CreditCard className="w-3 h-3" /> Abrir venda
                      </Link>
                    )}
                    <button
                      onClick={() => toggleAnalisado(c.id)}
                      className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
                    >
                      <CheckCircle2 className="w-3 h-3" /> {isAnalisado ? "Desfazer" : "Marcar analisado"}
                    </button>
                    <button
                      onClick={() => arquivar(c.id)}
                      className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-500 bg-white hover:bg-slate-50"
                    >
                      <Clock className="w-3 h-3" /> Arquivar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

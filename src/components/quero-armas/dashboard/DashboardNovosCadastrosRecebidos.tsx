import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Inbox, ArrowRight, ExternalLink, AlertCircle, CheckCircle2,
  FileText, CreditCard, Clock, User, Loader2, ClipboardCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bloco "Novos Cadastros Recebidos"
 * Fonte: tabela qa_cadastro_publico (formulário público de cadastro).
 * Ordem: do mais antigo para o mais novo (created_at ASC).
 * Para cada cadastro: tenta cruzar com qa_processos / qa_vendas via cliente_id_vinculado.
 *
 * SEMÂNTICA DE STATUS (não confundir):
 *   - "Formulário conferido" = o admin já leu/conferiu o cadastro recebido pela
 *     internet. NÃO significa cliente aprovado, pagamento confirmado ou processo
 *     aberto. No banco, é gravado como qa_cadastro_publico.status = "conferido"
 *     (legado: "analisado" — mapeado no front para "Formulário conferido").
 *   - "Cadastro aprovado" = aprovação cadastral (qa_cadastro_publico.status =
 *     "aprovado"), feita dentro da ficha do cliente, com vínculo formal.
 *   - "Rejeitado" = recusa cadastral.
 *   - "Arquivado" = ocultado da operação ativa, dados preservados.
 *
 * Cada faceta (Formulário, Cadastro, Financeiro, Processo) tem badge própria
 * para evitar ambiguidade na Dashboard.
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
  | "nao_conferidos"
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
  prazoLabel: string;
  pendencias: string[];
  facetas: FacetaBadges;
}

/**
 * Cada faceta tem contexto explícito ("Formulário", "Cadastro", "Financeiro",
 * "Processo") + valor + cor. Nunca exibir só o valor sem contexto.
 */
type FacetaBadge = { contexto: string; valor: string; color: string };
interface FacetaBadges {
  formulario: FacetaBadge;            // recebido | conferido | arquivado
  cadastro: FacetaBadge;              // aguardando análise | aprovado | rejeitado
  financeiro: FacetaBadge;            // sem cobrança | pagto pendente | confirmado
  processo: FacetaBadge;              // não aberto | aberto | aguardando docs etc.
}

/** "analisado" (legado) vira "conferido" no front. */
function normalizarStatusFormulario(raw: string | null | undefined): "recebido" | "conferido" | "arquivado" | "rejeitado" | "aprovado" | "pendente" {
  const v = (raw || "").toLowerCase();
  if (v === "analisado") return "conferido";
  if (v === "conferido") return "conferido";
  if (v === "arquivado") return "arquivado";
  if (v === "rejeitado") return "rejeitado";
  if (v === "aprovado") return "aprovado";
  if (v === "pendente" || !v) return "pendente";
  return "pendente";
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Constrói badges contextuais separadas por faceta.
 * Nunca devolve label genérico tipo "ANALISADO" — todo valor vem com seu contexto.
 */
function buildFacetas(c: CadastroRow, p: ProcessoMin | null, v: VendaMin | null): FacetaBadges {
  const formStatus = normalizarStatusFormulario(c.status);

  // A) Formulário público (recebido / conferido / arquivado / rejeitado)
  let formulario: FacetaBadge;
  if (formStatus === "conferido") {
    formulario = { contexto: "Formulário", valor: "Conferido", color: "#0891b2" };
  } else if (formStatus === "arquivado") {
    formulario = { contexto: "Formulário", valor: "Arquivado", color: "#64748b" };
  } else if (formStatus === "rejeitado") {
    formulario = { contexto: "Formulário", valor: "Recusado", color: "#dc2626" };
  } else {
    formulario = { contexto: "Formulário", valor: "Recebido", color: "#6366f1" };
  }

  // B) Análise cadastral (independente da conferência do formulário)
  let cadastro: FacetaBadge;
  if (formStatus === "rejeitado") {
    cadastro = { contexto: "Cadastro", valor: "Rejeitado", color: "#dc2626" };
  } else if (formStatus === "aprovado" || c.cliente_id_vinculado) {
    cadastro = { contexto: "Cadastro", valor: "Aprovado", color: "#16a34a" };
  } else {
    cadastro = { contexto: "Cadastro", valor: "Aguardando análise", color: "#ca8a04" };
  }

  // C) Financeiro — só usa fonte real (venda/cobrança); nunca inventa pelo formulário.
  let financeiro: FacetaBadge;
  if (!v && c.pago !== true) {
    financeiro = { contexto: "Financeiro", valor: "Sem cobrança vinculada", color: "#64748b" };
  } else if (c.pago === true || p?.pagamento_status === "pago" || v?.status === "pago") {
    financeiro = { contexto: "Financeiro", valor: "Pagamento confirmado", color: "#16a34a" };
  } else if (p?.status === "aguardando_pagamento" || v?.status === "aguardando_pagamento") {
    financeiro = { contexto: "Financeiro", valor: "Pagamento pendente", color: "#ea580c" };
  } else {
    financeiro = { contexto: "Financeiro", valor: "Sem cobrança vinculada", color: "#64748b" };
  }

  // D) Processo — fonte real (qa_processos vinculado).
  let processo: FacetaBadge;
  if (!p) {
    processo = { contexto: "Processo", valor: "Ainda não aberto", color: "#64748b" };
  } else if (p.status?.includes("documento")) {
    processo = { contexto: "Processo", valor: "Aguardando documentos", color: "#ca8a04" };
  } else if (p.status?.includes("notificacao") || p.status?.includes("protocolo")) {
    processo = { contexto: "Processo", valor: "Aguardando órgão", color: "#0891b2" };
  } else {
    processo = { contexto: "Processo", valor: "Aberto", color: "#16a34a" };
  }

  return { formulario, cadastro, financeiro, processo };
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
  if (!c.cliente_id_vinculado) out.push("Cadastro ainda não vinculado");
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
  // "conferidos" = formulário público já foi conferido administrativamente.
  // NÃO é o mesmo que "aprovado" (análise cadastral) — propositalmente separado.
  const [conferidos, setConferidos] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("qa_novos_cad_conferidos") || localStorage.getItem("qa_novos_cad_analisados") || "[]")); } catch { return new Set(); }
  });
  const [arquivados, setArquivados] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("qa_novos_cad_arquivados") || "[]")); } catch { return new Set(); }
  });

  async function load() {
    setLoading(true);
    const { data: cads } = await supabase
      .from("qa_cadastro_publico")
      .select("id,nome_completo,cpf,email,servico_interesse,status,pago,pago_em,cliente_id_vinculado,processado_em,created_at,end1_cidade,end1_estado")
      .neq("status", "arquivado")
      .order("created_at", { ascending: true })
      .limit(100);
    const list = ((cads as any[]) ?? []) as CadastroRow[];
    setRows(list);

    // Hidrata estados centrais. Banco é fonte canônica.
    // ATENÇÃO: "aprovado" NÃO conta como "conferido" — são facetas distintas.
    // Apenas "conferido" (novo) e "analisado" (legado) são tratados como
    // conferência do formulário.
    setConferidos(prev => {
      const next = new Set(prev);
      list.forEach(r => {
        if (r.status === "conferido" || r.status === "analisado") next.add(r.id);
      });
      return next;
    });
    setArquivados(prev => {
      const next = new Set(prev);
      list.forEach(r => { if (r.status === "arquivado") next.add(r.id); });
      return next;
    });

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
      return {
        cadastro: c,
        processo: p,
        venda: v,
        prazoLabel: buildPrazoLabel(c, p),
        pendencias: buildPendencias(c, p, v),
        facetas: buildFacetas(c, p, v),
      };
    });
  }, [rows, processos, vendas]);

  const visible = useMemo(() => {
    return consolidated.filter(r => {
      if (arquivados.has(r.cadastro.id)) return false;
      switch (filter) {
        case "nao_conferidos": return !conferidos.has(r.cadastro.id);
        case "sem_servico": return !r.cadastro.servico_interesse;
        case "sem_processo": return !r.processo;
        case "com_prazo": return !!r.processo && !["aguardando_pagamento"].includes(r.processo.status || "");
        case "aguard_docs": return r.facetas.processo.valor.toLowerCase().includes("documento");
        case "pgto_pendente": return r.facetas.financeiro.valor.toLowerCase().includes("pendente");
        case "incompletos": return !r.cadastro.cliente_id_vinculado || !r.cadastro.servico_interesse;
        default: return true;
      }
    });
  }, [consolidated, filter, conferidos, arquivados]);

  const totalPendentes = consolidated.filter(r => !conferidos.has(r.cadastro.id) && !arquivados.has(r.cadastro.id)).length;

  /**
   * Marca/desmarca o FORMULÁRIO PÚBLICO como conferido administrativamente.
   * Não confundir com aprovação cadastral.
   * Banco: status = "conferido" (novo) | "pendente" (reabertura).
   */
  function toggleConferido(id: string) {
    const wasConferido = conferidos.has(id);
    setConferidos(prev => {
      const next = new Set(prev);
      if (wasConferido) next.delete(id); else next.add(id);
      localStorage.setItem("qa_novos_cad_conferidos", JSON.stringify([...next]));
      return next;
    });
    void (async () => {
      const novoStatus = wasConferido ? "pendente" : "conferido";
      const { error } = await supabase
        .from("qa_cadastro_publico" as any)
        .update({ status: novoStatus })
        .eq("id", id);
      if (error) console.warn("[DashboardNovosCadastros] persist conferido falhou:", error.message);
    })();
  }
  function arquivar(id: string) {
    setArquivados(prev => {
      const next = new Set(prev); next.add(id);
      localStorage.setItem("qa_novos_cad_arquivados", JSON.stringify([...next]));
      return next;
    });
    void (async () => {
      const { error } = await supabase
        .from("qa_cadastro_publico" as any)
        .update({ status: "arquivado" })
        .eq("id", id);
      if (error) console.warn("[DashboardNovosCadastros] persist arquivado falhou:", error.message);
    })();
  }

  const filters: { key: FilterKey; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "nao_conferidos", label: "Não conferidos" },
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
            const isConferido = conferidos.has(c.id);
            return (
              <div
                key={c.id}
                className="border rounded-lg p-3 hover:shadow-sm transition"
                style={{ borderColor: "#e2e8f0", background: isConferido ? "#f8fafc" : "#ffffff", opacity: isConferido ? 0.85 : 1 }}
              >
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "hsl(220 20% 18%)" }}>{c.nome_completo}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide"
                        style={{ background: "#eef2ff", color: "#4338ca" }}
                        title="Cadastro recebido pelo formulário público da internet"
                      >
                        Origem: Formulário público
                      </span>
                    </div>

                    {/* Badges contextuais — uma por faceta, sempre com rótulo do contexto */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {([r.facetas.formulario, r.facetas.cadastro, r.facetas.financeiro, r.facetas.processo] as FacetaBadge[]).map((f, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                          style={{ borderColor: f.color, color: f.color, background: "#ffffff" }}
                        >
                          <strong>{f.contexto}:</strong> {f.valor}
                        </span>
                      ))}
                    </div>

                    <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span><strong>CPF:</strong> {c.cpf || "—"}</span>
                      <span><strong>Recebido:</strong> {formatDateTime(c.created_at)}</span>
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
                    {/* Comando principal: SEMPRE leva à ficha real do cliente.
                        Se já vinculado → abre cliente direto (?cliente=ID).
                        Se ainda não vinculado → abre o painel do cadastro público
                        em /clientes (?cadastro_publico=UUID), de onde o admin
                        analisa, vincula/cria cliente e aprova. */}
                    {c.cliente_id_vinculado ? (
                      <Link
                        to={`/clientes?cliente=${c.cliente_id_vinculado}`}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 font-medium"
                      >
                        <User className="w-3 h-3" /> Abrir cliente <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <Link
                        to={`/clientes?cadastro_publico=${c.id}`}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 font-medium"
                      >
                        <User className="w-3 h-3" /> Abrir cliente <ExternalLink className="w-3 h-3" />
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
                      onClick={() => toggleConferido(c.id)}
                      className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
                      title={isConferido
                        ? "Reabrir conferência do formulário público (volta ao status Recebido)"
                        : "Marca apenas que o formulário público foi lido/conferido. Não aprova cadastro, pagamento ou processo."}
                    >
                      {isConferido
                        ? (<><ClipboardCheck className="w-3 h-3" /> Reabrir conferência</>)
                        : (<><CheckCircle2 className="w-3 h-3" /> Marcar formulário como conferido</>)}
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

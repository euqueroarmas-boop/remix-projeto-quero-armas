import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, FileStack, Search, RefreshCw, ShoppingBag, AlertTriangle,
  CheckCircle, Clock, FileText, ChevronRight, CreditCard, XCircle,
} from "lucide-react";
import { getStatusProcesso, formatDate, formatDateTime } from "@/components/quero-armas/processos/processoConstants";
import { ProcessoDetalheDrawer } from "@/components/quero-armas/processos/ProcessoDetalheDrawer";

interface Processo {
  id: string;
  servico_nome: string;
  status: string;
  pagamento_status: string;
  data_criacao: string;
  observacoes_admin: string | null;
  total_docs: number;
  pendentes: number;
  aprovados: number;
}

type FiltroStatus = "todas" | "ativas" | "aguardando_pagamento" | "concluidas" | "canceladas";

const FILTROS: { id: FiltroStatus; label: string }[] = [
  { id: "todas", label: "TODAS" },
  { id: "ativas", label: "EM ANDAMENTO" },
  { id: "aguardando_pagamento", label: "AGUARDANDO PAGAMENTO" },
  { id: "concluidas", label: "CONCLUÍDAS" },
  { id: "canceladas", label: "CANCELADAS" },
];

export default function QAClienteContratacoesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [filtro, setFiltro] = useState<FiltroStatus>("todas");
  const [busca, setBusca] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [eventosByProc, setEventosByProc] = useState<Record<string, any[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/area-do-cliente/login", { replace: true }); return; }

      const { data: link } = await supabase
        .from("cliente_auth_links" as any)
        .select("qa_cliente_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("activated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      const cid = (link as any)?.qa_cliente_id;
      if (!cid) { toast.error("Vínculo de cliente não encontrado."); navigate("/area-do-cliente", { replace: true }); return; }
      setClienteId(cid);

      const { data: procs, error } = await supabase
        .from("qa_processos")
        .select("id, servico_nome, status, pagamento_status, data_criacao, observacoes_admin")
        .eq("cliente_id", cid)
        .order("data_criacao", { ascending: false });
      if (error) throw error;

      const procIds = (procs ?? []).map((p: any) => p.id);
      const { data: docs } = procIds.length
        ? await supabase
            .from("qa_processo_documentos")
            .select("processo_id, status, obrigatorio")
            .in("processo_id", procIds)
        : { data: [] as any[] };

      const enriched: Processo[] = (procs ?? []).map((p: any) => {
        const myDocs = (docs ?? []).filter((d: any) => d.processo_id === p.id);
        const total = myDocs.length;
        const pendentes = myDocs.filter((d: any) => d.obrigatorio && (d.status === "pendente" || d.status === "invalido" || d.status === "divergente")).length;
        const aprovados = myDocs.filter((d: any) => d.status === "aprovado" || d.status === "dispensado_grupo").length;
        return { ...p, total_docs: total, pendentes, aprovados };
      });
      setProcessos(enriched);
    } catch (e: any) {
      toast.error("Erro ao carregar contratações: " + (e?.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { carregar(); }, [carregar]);

  const carregarEventos = async (processoId: string) => {
    if (eventosByProc[processoId]) {
      setExpandedId(expandedId === processoId ? null : processoId);
      return;
    }
    const { data } = await supabase
      .from("qa_processo_eventos")
      .select("id, tipo_evento, descricao, ator, created_at")
      .eq("processo_id", processoId)
      .order("created_at", { ascending: false })
      .limit(50);
    setEventosByProc((m) => ({ ...m, [processoId]: (data as any[]) ?? [] }));
    setExpandedId(processoId);
  };

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return processos.filter((p) => {
      // Filtro por status
      if (filtro === "aguardando_pagamento" && p.pagamento_status !== "aguardando") return false;
      if (filtro === "ativas") {
        if (p.pagamento_status === "aguardando") return false;
        if (["concluido", "cancelado"].includes(p.status)) return false;
      }
      if (filtro === "concluidas" && p.status !== "concluido") return false;
      if (filtro === "canceladas" && p.status !== "cancelado") return false;
      // Busca por nome do serviço
      if (termo && !p.servico_nome.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [processos, filtro, busca]);

  const contagens = useMemo(() => {
    const ativas = processos.filter(p => p.pagamento_status !== "aguardando" && !["concluido", "cancelado"].includes(p.status)).length;
    const aguardando = processos.filter(p => p.pagamento_status === "aguardando").length;
    const concluidas = processos.filter(p => p.status === "concluido").length;
    const canceladas = processos.filter(p => p.status === "cancelado").length;
    return { todas: processos.length, ativas, aguardando_pagamento: aguardando, concluidas, canceladas };
  }, [processos]);

  return (
    <div data-tactical-portal className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/area-do-cliente")}
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> VOLTAR
          </button>
          <div className="flex-1" />
          <button
            onClick={carregar}
            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 hover:text-slate-800"
          >
            <RefreshCw className="h-3 w-3" /> ATUALIZAR
          </button>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center">
              <FileStack className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Minhas Contratações</h1>
              <p className="text-[11px] text-slate-500">Histórico completo de serviços contratados pelo portal.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        {/* CTA Contratar novo */}
        <button
          onClick={() => navigate("/area-do-cliente/contratar")}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/60 hover:from-amber-100 hover:to-amber-200/60 border border-amber-200 hover:border-amber-300 transition group"
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500 text-white shrink-0 group-hover:scale-105 transition">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[12px] font-bold text-slate-900 uppercase tracking-tight">Contratar novo serviço</div>
            <div className="text-[10px] text-slate-600 mt-0.5">Posse, porte, CRAF, CR, GTE e mais.</div>
          </div>
          <ChevronRight className="h-4 w-4 text-amber-700 shrink-0" />
        </button>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="BUSCAR POR SERVIÇO..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm uppercase placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => {
            const active = filtro === f.id;
            const count = contagens[f.id];
            return (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] uppercase tracking-wider font-bold transition ${
                  active
                    ? "bg-[#7A1F2B] text-white"
                    : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                }`}
              >
                {f.label}
                <span className={`inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded text-[9px] ${active ? "bg-white/20" : "bg-slate-100"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-xs uppercase tracking-wider text-slate-400 text-center py-12">CARREGANDO...</div>
        ) : filtrados.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl py-12 text-center">
            <FileStack className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs uppercase tracking-wider text-slate-400">
              {processos.length === 0 ? "VOCÊ AINDA NÃO POSSUI CONTRATAÇÕES" : "NENHUMA CONTRATAÇÃO PARA OS FILTROS APLICADOS"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtrados.map((p) => {
              const st = getStatusProcesso(p.status);
              const aguardandoPagto = p.pagamento_status === "aguardando";
              const cancelado = p.status === "cancelado";
              const concluido = p.status === "concluido";
              const isExpanded = expandedId === p.id;
              return (
                <div
                  key={p.id}
                  className={`bg-white border rounded-xl overflow-hidden ${
                    aguardandoPagto ? "border-[#E5C2C6] ring-1 ring-[#7A1F2B]" :
                    cancelado ? "border-slate-200 opacity-75" :
                    concluido ? "border-emerald-200" :
                    "border-slate-200"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            CONTRATADO EM {formatDate(p.data_criacao)}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 uppercase mt-1">{p.servico_nome}</h4>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${st.bg} ${st.text} border ${st.border}`}>
                            {st.label}
                          </span>
                          {(p.total_docs ?? 0) > 0 && !aguardandoPagto && (
                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                              {p.aprovados}/{p.total_docs} DOCS APROVADOS
                            </span>
                          )}
                          {p.pendentes > 0 && !aguardandoPagto && !cancelado && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-amber-700">
                              <AlertTriangle className="h-3 w-3" /> {p.pendentes} PENDENTE(S)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setOpenId(p.id)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#7A1F2B] hover:bg-[#641722] text-white text-[11px] uppercase tracking-wider font-bold"
                      >
                        ABRIR DETALHES <ChevronRight className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => carregarEventos(p.id)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-[11px] uppercase tracking-wider font-bold"
                      >
                        <Clock className="h-3 w-3" /> {isExpanded ? "OCULTAR" : "VER"} TIMELINE
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">
                          HISTÓRICO DE EVENTOS
                        </div>
                        {(eventosByProc[p.id] ?? []).length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">Nenhum evento registrado.</p>
                        ) : (
                          <div className="space-y-2">
                            {(eventosByProc[p.id] ?? []).map((ev: any) => (
                              <div key={ev.id} className="flex items-start gap-2.5 text-[11px]">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-slate-700">{ev.descricao}</div>
                                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                                    {formatDateTime(ev.created_at)} · {ev.ator || "sistema"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {openId && (
        <ProcessoDetalheDrawer
          processoId={openId}
          onClose={() => setOpenId(null)}
          onUpdated={carregar}
        />
      )}
    </div>
  );
}

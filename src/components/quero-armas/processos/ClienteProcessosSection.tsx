import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileStack, ChevronRight, AlertTriangle, CheckCircle, Clock, Eye, Sparkles, RefreshCw, FileText, CreditCard, CalendarClock, Timer, Activity } from "lucide-react";
import { getStatusProcesso, formatDate } from "./processoConstants";
import { ProcessoDetalheDrawer } from "./ProcessoDetalheDrawer";
import { isChecklistCumprido, isChecklistPendente } from "@/lib/quero-armas/checklistMetrics";

/* =============================================================================
 * ClienteProcessosSection — Estilo Catálogo Light
 * Paleta: Page #FAFAFA | Paper #FFFFFF | Ink #0A0A0A | Border #E4E4E4
 *         Secondary #6A6A6A | Micro-dots RGB apenas para status (8px)
 * ============================================================================= */

interface Processo {
  id: string;
  servico_nome: string;
  status: string;
  pagamento_status: string;
  data_criacao: string;
  respostas_questionario_json?: any;
  total_docs?: number;
  pendentes?: number;
  aprovados?: number;
  acao?: string;
  etapa_liberada_ate?: number | null;
  prazo_critico_data?: string | null;
  primeiro_doc_aprovado_em?: string | null;
  prazo_critico_doc_label?: string | null;
}

interface Props {
  clienteId: number;
  processoIdFiltro?: string | null;
}

const ETAPA_LABELS: Record<number, string> = {
  1: "ENDEREÇO",
  2: "CONDIÇÃO PROFISSIONAL",
  3: "ANTECEDENTES",
  4: "DECLARAÇÕES",
  5: "EXAMES TÉCNICOS",
};

const diasRestantes = (d?: string | null): number | null => {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
};

/** Catálogo Light: apenas micro-dot + cor de texto neutra. Sem fundos coloridos. */
const prazoDot = (dias: number | null) => {
  if (dias === null) return { dot: "#6A6A6A", text: "text-[#6A6A6A]" };
  if (dias < 0) return { dot: "#FF5F57", text: "text-[#0A0A0A]" };
  if (dias <= 7) return { dot: "#FF5F57", text: "text-[#0A0A0A]" };
  if (dias <= 30) return { dot: "#FEBC2E", text: "text-[#0A0A0A]" };
  return { dot: "#28C840", text: "text-[#0A0A0A]" };
};

/** Mapeia status para micro-dot RGB discreto (8px). */
const statusDotColor = (status: string) => {
  const green = new Set(["concluido", "aprovado", "pronto_para_protocolar", "deferido", "protocolado", "em_analise_orgao", "em_validacao_ia"]);
  const yellow = new Set(["em_revisao_humana", "em_andamento", "aguardando_documentos"]);
  const red = new Set(["aguardando_pagamento", "indeferido", "bloqueado", "cancelado"]);
  if (green.has(status)) return "#28C840";
  if (yellow.has(status)) return "#FEBC2E";
  if (red.has(status)) return "#FF5F57";
  return "#6A6A6A";
};

export function ClienteProcessosSection({ clienteId, processoIdFiltro = null }: Props) {
  const [loading, setLoading] = useState(true);
  const [processosRaw, setProcessosRaw] = useState<Processo[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [eventosByProc, setEventosByProc] = useState<Record<string, any[]>>({});

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: procs, error } = await supabase
        .from("qa_processos")
        .select("id, servico_nome, status, pagamento_status, data_criacao, etapa_liberada_ate, prazo_critico_data, prazo_critico_doc_id, primeiro_doc_aprovado_em, respostas_questionario_json")
        .eq("cliente_id", clienteId)
        // Processos cancelados/arquivados pela reconciliação (sem venda/contrato real)
        // NUNCA devem aparecer para o cliente final. Apenas staff vê na auditoria.
        .not("status", "in", "(cancelado,arquivado)")
        .order("data_criacao", { ascending: false });
      if (error) throw error;

      const procIds = (procs ?? []).map((p) => p.id);
      const { data: docs } = procIds.length
        ? await supabase.from("qa_processo_documentos").select("id, processo_id, status, obrigatorio, tipo_documento").in("processo_id", procIds)
        : { data: [] as any[] };

      const { data: evts } = procIds.length
        ? await supabase
            .from("qa_processo_eventos")
            .select("id, processo_id, tipo_evento, descricao, ator, created_at")
            .in("processo_id", procIds)
            .order("created_at", { ascending: false })
            .limit(200)
        : { data: [] as any[] };
      const byProc: Record<string, any[]> = {};
      (evts ?? []).forEach((ev: any) => {
        const k = String(ev.processo_id);
        if (!byProc[k]) byProc[k] = [];
        byProc[k].push(ev);
      });
      setEventosByProc(byProc);

      const enriched: Processo[] = (procs ?? []).map((p: any) => {
        const myDocs = (docs ?? []).filter((d: any) => d.processo_id === p.id);
        const total = myDocs.length;
        const pendentes = myDocs.filter((d: any) => d.obrigatorio && isChecklistPendente(d.status)).length;
        const aprovados = myDocs.filter((d: any) => isChecklistCumprido(d.status)).length;
        const docCritico = p.prazo_critico_doc_id ? myDocs.find((d: any) => d.id === p.prazo_critico_doc_id) : null;
        const prazo_critico_doc_label = docCritico?.tipo_documento ? String(docCritico.tipo_documento).replace(/_/g, " ").toUpperCase() : null;

        let acao = "ACOMPANHAR";
        if (p.status === "aguardando_pagamento") acao = "AGUARDANDO PAGAMENTO";
        else if (p.status === "aguardando_documentos" || pendentes > 0) acao = `${pendentes} DOC(S) PENDENTE(S)`;
        else if (p.status === "em_validacao_ia") acao = "VALIDANDO AUTOMATICAMENTE";
        else if (p.status === "em_revisao_humana") acao = "AGUARDE REVISÃO";
        else if (p.status === "aprovado") acao = "DOCUMENTAÇÃO APROVADA";
        else if (p.status === "concluido") acao = "PROCESSO CONCLUÍDO";

        return { ...p, total_docs: total, pendentes, aprovados, acao, prazo_critico_doc_label };
      });
      setProcessosRaw(enriched);
    } catch (e: any) {
      toast.error("Erro ao carregar processos: " + (e?.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  const processos = processoIdFiltro
    ? processosRaw.filter((p) => p.id === processoIdFiltro)
    : processosRaw;

  if (loading) return <div className="text-xs uppercase tracking-wider text-[#6A6A6A] text-center py-6">CARREGANDO PROCESSOS…</div>;

  if (processos.length === 0) {
    return (
      <div className="text-center py-8">
        <FileStack className="h-8 w-8 mx-auto text-[#E4E4E4] mb-2" />
        <p className="text-xs uppercase tracking-wider text-[#6A6A6A]">VOCÊ AINDA NÃO POSSUI PROCESSOS ATIVOS</p>
      </div>
    );
  }

  // Banner global: menor prazo entre todos os processos ativos — estilo Catálogo Light
  const ativos = processos.filter((p) => p.status !== "concluido" && p.pagamento_status !== "aguardando");
  const comPrazo = ativos.filter((p) => !!p.prazo_critico_data);
  const menor = comPrazo.length
    ? comPrazo.reduce((acc, cur) => {
        const a = diasRestantes(acc.prazo_critico_data) ?? Infinity;
        const b = diasRestantes(cur.prazo_critico_data) ?? Infinity;
        return b < a ? cur : acc;
      })
    : null;
  const menorDias = diasRestantes(menor?.prazo_critico_data);
  const menorTone = prazoDot(menorDias);

  return (
    <div className="space-y-2.5">
      {menor && menorDias !== null && (
        <div className="rounded-sm border border-[#E4E4E4] bg-[#FFFFFF] p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-sm flex items-center justify-center border border-[#E4E4E4]">
              <Timer className="h-4 w-4 text-[#6A6A6A]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 rounded-full" style={{ background: menorTone.dot }} aria-hidden="true" />
                <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#6A6A6A]">PRAZO CRÍTICO DA SUA DOCUMENTAÇÃO</span>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm border border-[#E4E4E4] bg-[#FAFAFA] text-[#0A0A0A]">
                  {menorDias < 0 ? `VENCIDO HÁ ${Math.abs(menorDias)}D` : menorDias === 0 ? "VENCE HOJE" : `${menorDias} DIAS RESTANTES`}
                </span>
              </div>
              <p className="text-[12px] leading-relaxed mt-1.5 text-[#0A0A0A]">
                Você precisa enviar todos os documentos antes de <strong>{formatDate(menor.prazo_critico_data!)}</strong>.
                {menor.prazo_critico_doc_label ? (
                  <> Documento mais próximo do vencimento: <strong>{menor.prazo_critico_doc_label}</strong>.</>
                ) : null}
              </p>
              <p className="text-[11px] leading-relaxed mt-1 normal-case text-[#6A6A6A]">
                Se algum documento vencer antes do protocolo, será necessário emitir uma versão atualizada e reenviar.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <button onClick={carregar} className="text-[10px] uppercase tracking-wider font-bold text-[#6A6A6A] hover:text-[#0A0A0A] inline-flex items-center gap-1 transition">
          <RefreshCw className="h-3 w-3" /> ATUALIZAR
        </button>
      </div>

      {processos.map((p) => {
        const st = getStatusProcesso(p.status);
        const precisaAcao = (p.pendentes ?? 0) > 0 || p.status === "aguardando_documentos";
        const aguardandoPagto = p.pagamento_status === "aguardando";
        const dias = diasRestantes(p.prazo_critico_data);
        const prTone = prazoDot(dias);
        const etapa = Math.max(1, Math.min(5, p.etapa_liberada_ate ?? 1));
        const sDot = statusDotColor(p.status);
        const protocolo = p.respostas_questionario_json?.protocolo?.numero_protocolo || p.respostas_questionario_json?.protocolo?.numero || null;

        return (
          <button
            key={p.id}
            onClick={() => setOpenId(p.id)}
            className="w-full text-left bg-[#FFFFFF] border border-[#E4E4E4] rounded-sm p-4 hover:border-[#0A0A0A] transition shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText className="h-3.5 w-3.5 text-[#6A6A6A]" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#6A6A6A]">PROCESSO · {formatDate(p.data_criacao)}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#6A6A6A]">PROTOCOLO: {protocolo ? String(protocolo).toUpperCase() : "—"}</span>
                </div>
                <h4 className="font-bold text-sm text-[#0A0A0A] uppercase mt-1 line-clamp-2">{p.servico_nome}</h4>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#0A0A0A]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sDot }} aria-hidden="true" />
                    {st.label}
                  </span>
                  {(p.total_docs ?? 0) > 0 && !aguardandoPagto && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[#6A6A6A]">
                      {p.aprovados}/{p.total_docs} DOCS APROVADOS
                    </span>
                  )}
                  {!aguardandoPagto && (
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm bg-[#FAFAFA] text-[#6A6A6A] border border-[#E4E4E4]">
                      ETAPA {etapa}/5 · {ETAPA_LABELS[etapa]}
                    </span>
                  )}
                </div>

                {!aguardandoPagto && dias !== null && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-[#0A0A0A]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: prTone.dot }} aria-hidden="true" />
                    <CalendarClock className="h-3 w-3 text-[#6A6A6A]" />
                    PRAZO: {dias < 0 ? `VENCIDO HÁ ${Math.abs(dias)}D` : dias === 0 ? "VENCE HOJE" : `${dias}D`} · ATÉ {formatDate(p.prazo_critico_data!)}
                  </div>
                )}

                {aguardandoPagto ? (
                  <div className="mt-3 rounded-sm bg-[#FFFFFF] border border-[#E4E4E4] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-[#0A0A0A]">
                      <span className="w-2 h-2 rounded-full shrink-0 bg-[#FF5F57]" aria-hidden="true" />
                      <CreditCard className="h-3 w-3 text-[#6A6A6A]" /> AGUARDANDO PAGAMENTO
                    </div>
                    <p className="text-[11px] text-[#6A6A6A] mt-1 leading-relaxed normal-case">
                      Cadastro recebido. Nossa Equipe Quero Armas validará os dados e confirmará o pagamento manualmente. Após a confirmação, o checklist documental será liberado.
                    </p>
                    <a
                      href="https://wa.me/5511978481919?text=Ol%C3%A1!%20Acabei%20de%20contratar%20um%20servi%C3%A7o%20pelo%20portal%20e%20gostaria%20de%20combinar%20o%20pagamento."
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white text-[11px] uppercase tracking-wider font-bold transition"
                    >
                      Falar no WhatsApp
                    </a>
                  </div>
                ) : precisaAcao && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-[#0A0A0A]">
                    <span className="w-2 h-2 rounded-full shrink-0 bg-[#FEBC2E]" aria-hidden="true" />
                    <AlertTriangle className="h-3 w-3 text-[#6A6A6A]" /> {p.acao}
                  </div>
                )}

                {(() => {
                  const evs = (eventosByProc[p.id] ?? []).slice(0, 5);
                  if (evs.length === 0) return null;
                  return (
                    <div className="mt-4 border-t border-[#E4E4E4] pt-3">
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Activity className="h-3 w-3 text-[#6A6A6A]" />
                        <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#6A6A6A]">LINHA DO TEMPO DESTE PROCESSO</span>
                      </div>
                      <div className="relative pl-4">
                        <div className="absolute left-[5px] top-1 bottom-1 w-px bg-[#E4E4E4]" />
                        <div className="space-y-2">
                          {evs.map((ev: any) => {
                            const t = String(ev.tipo_evento || "").toLowerCase();
                            const dot = t.includes("aprov") || t.includes("defer") || t.includes("concl")
                              ? "#28C840"
                              : t.includes("reprov") || t.includes("indef") || t.includes("rejei")
                                ? "#FF5F57"
                                : t.includes("protoc") || t.includes("revis") || t.includes("alter")
                                  ? "#FEBC2E"
                                  : "#C4C4C4";
                            return (
                              <div key={ev.id} className="relative flex items-start gap-2.5">
                                <span
                                  className="absolute -left-[14px] top-1.5 z-10 h-2 w-2 rounded-full border border-white shrink-0"
                                  style={{ background: dot }}
                                  aria-hidden="true"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] leading-snug text-[#0A0A0A] normal-case">
                                    {ev.descricao || ev.tipo_evento}
                                  </div>
                                  <div className="text-[10px] text-[#8A8A8A] mt-0.5 font-mono uppercase tracking-wider">
                                    {formatDate(ev.created_at)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <ChevronRight className="h-4 w-4 text-[#6A6A6A] shrink-0 mt-1" />
            </div>
          </button>
        );
      })}

      {openId && <ProcessoDetalheDrawer processoId={openId} onClose={() => setOpenId(null)} onUpdated={carregar} />}
    </div>
  );
}

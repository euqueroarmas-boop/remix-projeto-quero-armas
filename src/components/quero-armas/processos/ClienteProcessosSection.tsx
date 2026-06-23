import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileStack, ChevronRight, AlertTriangle, CheckCircle, Clock, RefreshCw, CreditCard, CalendarClock } from "lucide-react";
import { getStatusProcesso, formatDate } from "./processoConstants";
import { ProcessoDetalheDrawer } from "./ProcessoDetalheDrawer";
import { isChecklistCumprido, isChecklistPendente } from "@/lib/quero-armas/checklistMetrics";

/* =============================================================================
 * ClienteProcessosSection — Estilo Catálogo Light (v2 Dossiê 8/4)
 * Page #FAFAFA · Paper #FFFFFF · Ink #0A0A0A · Hairline #E4E4E4 · Muted #6A6A6A
 * Micro-dots: #28C840 (ok) · #FEBC2E (em curso) · #FF5F57 (atenção)
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

const prazoDot = (dias: number | null) => {
  if (dias === null) return { dot: "#6A6A6A" };
  if (dias <= 7) return { dot: "#FF5F57" };
  if (dias <= 30) return { dot: "#FEBC2E" };
  return { dot: "#28C840" };
};

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

  const totalProc = processos.length;
  const emAnalise = processos.filter((p) => ["em_analise_orgao", "em_validacao_ia", "em_revisao_humana", "protocolado"].includes(p.status)).length;
  const pendencias = processos.filter((p) => (p.pendentes ?? 0) > 0 || p.status === "aguardando_documentos" || p.pagamento_status === "aguardando").length;
  const concluidos = processos.filter((p) => p.status === "concluido").length;

  return (
    <div className="space-y-8">
      {/* §00 — Banda de KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 border border-[#E4E4E4] bg-white rounded-sm divide-x divide-[#E4E4E4]">
        <KpiCell label="TOTAL DE PROCESSOS" value={String(totalProc).padStart(2, "0")} />
        <KpiCell label="EM ANÁLISE" value={String(emAnalise).padStart(2, "0")} dot={emAnalise > 0 ? "#FEBC2E" : undefined} />
        <KpiCell label="PENDÊNCIAS" value={String(pendencias).padStart(2, "0")} dot={pendencias > 0 ? "#FF5F57" : undefined} />
        <KpiCell
          label="PRÓXIMO PRAZO"
          value={menor?.prazo_critico_data ? formatDate(menor.prazo_critico_data) : "—"}
          mono
          accent={menorDias !== null && menorDias <= 7}
        />
      </section>

      <div className="grid grid-cols-12 gap-6">
        {/* Coluna esquerda — processos */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          <div className="flex items-end justify-between border-b border-[#E4E4E4] pb-2">
            <h2 className="font-serif italic text-2xl text-[#0A0A0A] leading-none">
              <span className="text-[#6A6A6A]">§01</span> Meus processos
            </h2>
            <button onClick={carregar} className="text-[10px] uppercase tracking-wider font-bold text-[#6A6A6A] hover:text-[#0A0A0A] inline-flex items-center gap-1 transition">
              <RefreshCw className="h-3 w-3" /> ATUALIZAR
            </button>
          </div>

          {processos.map((p, idx) => {
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
                className="group w-full text-left bg-white border border-[#E4E4E4] rounded-sm p-6 hover:border-[#0A0A0A] transition"
              >
                {/* Cabeçalho da ficha */}
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-serif italic text-sm text-[#6A6A6A]">{String(idx + 1).padStart(3, "0")}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#6A6A6A]">
                        {protocolo ? String(protocolo).toUpperCase() : "PROTOCOLO PENDENTE"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-[#6A6A6A]">· {formatDate(p.data_criacao)}</span>
                    </div>
                    <h3 className="font-serif text-xl text-[#0A0A0A] leading-tight">{p.servico_nome}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sDot }} aria-hidden="true" />
                      <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#0A0A0A]">{st.label}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#6A6A6A] shrink-0 mt-1 transition group-hover:translate-x-0.5 group-hover:text-[#0A0A0A]" />
                </div>

                {!aguardandoPagto && (
                  <div className="border-t border-[#E4E4E4] pt-4 grid grid-cols-12 gap-6">
                    <div className="col-span-12 sm:col-span-7">
                      <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#6A6A6A] mb-3">CRONOGRAMA DE ETAPAS</div>
                      <ol className="space-y-2">
                        {[1, 2, 3, 4, 5].map((n) => {
                          const done = n < etapa;
                          const current = n === etapa;
                          return (
                            <li key={n} className="flex items-baseline gap-3">
                              <span className="font-mono text-[10px] text-[#6A6A6A] w-6 shrink-0">{String(n).padStart(2, "0")}</span>
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: done ? "#28C840" : current ? "#FEBC2E" : "#E4E4E4" }}
                                aria-hidden="true"
                              />
                              <span className={`text-[11px] uppercase tracking-wider ${done ? "text-[#0A0A0A]" : current ? "text-[#0A0A0A] font-bold" : "text-[#6A6A6A]"}`}>
                                {ETAPA_LABELS[n]}
                              </span>
                              {done && <CheckCircle className="h-3 w-3 text-[#28C840]" />}
                              {current && <span className="text-[9px] uppercase tracking-widest text-[#0A0A0A] font-bold ml-1">EM CURSO</span>}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                    <div className="col-span-12 sm:col-span-5 space-y-3 sm:border-l sm:border-[#E4E4E4] sm:pl-6">
                      {(p.total_docs ?? 0) > 0 && (
                        <Field label="DOCUMENTAÇÃO">
                          <span className="text-sm font-mono text-[#0A0A0A]">{p.aprovados}/{p.total_docs}</span>
                          <span className="text-[10px] uppercase tracking-wider text-[#6A6A6A] ml-2">APROVADOS</span>
                        </Field>
                      )}
                      {dias !== null && (
                        <Field label="PRAZO">
                          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-[#0A0A0A]">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: prTone.dot }} aria-hidden="true" />
                            <CalendarClock className="h-3 w-3 text-[#6A6A6A]" />
                            {dias < 0 ? `VENCIDO HÁ ${Math.abs(dias)}D` : dias === 0 ? "VENCE HOJE" : `${dias}D`}
                          </span>
                          <div className="text-[10px] text-[#6A6A6A] mt-0.5 font-mono">ATÉ {formatDate(p.prazo_critico_data!)}</div>
                        </Field>
                      )}
                      {precisaAcao && (
                        <Field label="PRÓXIMA AÇÃO">
                          <span className="text-[11px] uppercase tracking-wider font-bold text-[#0A0A0A] inline-flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3 text-[#FEBC2E]" /> {p.acao}
                          </span>
                        </Field>
                      )}
                    </div>
                  </div>
                )}

                {aguardandoPagto && (
                  <div className="border-t border-[#E4E4E4] pt-4">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold text-[#0A0A0A]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF5F57]" aria-hidden="true" />
                      <CreditCard className="h-3 w-3 text-[#6A6A6A]" /> AGUARDANDO PAGAMENTO
                    </div>
                    <p className="text-[11px] text-[#6A6A6A] mt-1.5 leading-relaxed normal-case">
                      Cadastro recebido. Nossa equipe Quero Armas validará os dados e confirmará o pagamento manualmente. Após a confirmação, o checklist documental será liberado.
                    </p>
                    <a
                      href="https://wa.me/5511978481919?text=Ol%C3%A1!%20Acabei%20de%20contratar%20um%20servi%C3%A7o%20pelo%20portal%20e%20gostaria%20de%20combinar%20o%20pagamento."
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white text-[11px] uppercase tracking-wider font-bold transition"
                    >
                      FALAR NO WHATSAPP
                    </a>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Coluna direita — sticky ficha do prazo */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="lg:sticky lg:top-6 space-y-5">
            {menor && menorDias !== null ? (
              <div className="bg-white border border-[#0A0A0A] rounded-sm p-6">
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="font-serif italic text-xl text-[#0A0A0A]">§02</span>
                  <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#0A0A0A]">PRAZO CRÍTICO</span>
                </div>
                <div className="font-serif text-4xl text-[#0A0A0A] leading-none tracking-tight">
                  {formatDate(menor.prazo_critico_data!)}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: menorTone.dot }} aria-hidden="true" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#0A0A0A]">
                    {menorDias < 0 ? `VENCIDO HÁ ${Math.abs(menorDias)}D` : menorDias === 0 ? "VENCE HOJE" : `${menorDias} DIAS RESTANTES`}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed mt-3 text-[#6A6A6A] normal-case">
                  Envie todos os documentos antes desta data.
                  {menor.prazo_critico_doc_label ? <> Documento mais próximo: <strong className="text-[#0A0A0A]">{menor.prazo_critico_doc_label}</strong>.</> : null}
                </p>
                <button
                  onClick={() => setOpenId(menor.id)}
                  className="mt-5 w-full h-9 rounded-sm bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white text-[10px] uppercase tracking-[0.14em] font-bold transition"
                >
                  ABRIR DOSSIÊ
                </button>
              </div>
            ) : (
              <div className="bg-white border border-[#E4E4E4] rounded-sm p-6 text-center">
                <Clock className="h-5 w-5 text-[#6A6A6A] mx-auto mb-2" />
                <div className="text-[10px] uppercase tracking-wider font-bold text-[#6A6A6A]">SEM PRAZOS CRÍTICOS NO MOMENTO</div>
              </div>
            )}

            <div className="bg-white border border-[#E4E4E4] rounded-sm p-6">
              <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#0A0A0A] mb-3">RESUMO</div>
              <ul className="space-y-2 text-[11px] uppercase tracking-wider">
                <li className="flex items-center justify-between"><span className="text-[#6A6A6A]">ATIVOS</span><span className="font-mono text-[#0A0A0A]">{String(Math.max(0, totalProc - concluidos)).padStart(2, "0")}</span></li>
                <li className="flex items-center justify-between"><span className="text-[#6A6A6A]">EM ANÁLISE</span><span className="font-mono text-[#0A0A0A]">{String(emAnalise).padStart(2, "0")}</span></li>
                <li className="flex items-center justify-between"><span className="text-[#6A6A6A]">PENDÊNCIAS</span><span className="font-mono text-[#0A0A0A]">{String(pendencias).padStart(2, "0")}</span></li>
                <li className="flex items-center justify-between"><span className="text-[#6A6A6A]">CONCLUÍDOS</span><span className="font-mono text-[#0A0A0A]">{String(concluidos).padStart(2, "0")}</span></li>
              </ul>
            </div>

            <div className="bg-white border border-[#E4E4E4] rounded-sm p-6">
              <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#0A0A0A] mb-3">PRECISA DE AJUDA?</div>
              <p className="text-[11px] leading-relaxed text-[#6A6A6A] normal-case mb-3">
                Fale com a Equipe Quero Armas para tirar dúvidas sobre seus processos.
              </p>
              <a
                href="https://wa.me/5511978481919"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white text-[10px] uppercase tracking-[0.14em] font-bold transition"
              >
                FALAR NO WHATSAPP
              </a>
            </div>
          </div>
        </aside>
      </div>

      {openId && <ProcessoDetalheDrawer processoId={openId} onClose={() => setOpenId(null)} onUpdated={carregar} />}
    </div>
  );
}

/* ─── Subcomponentes do Catálogo Light ─────────────────────────────────── */
function KpiCell({ label, value, dot, mono, accent }: { label: string; value: string; dot?: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="p-5">
      <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#6A6A6A]">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} aria-hidden="true" />}
        <span className={`${mono ? "font-mono text-base" : "font-serif text-2xl"} ${accent ? "text-[#FF5F57]" : "text-[#0A0A0A]"} leading-none`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-[#6A6A6A] mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}

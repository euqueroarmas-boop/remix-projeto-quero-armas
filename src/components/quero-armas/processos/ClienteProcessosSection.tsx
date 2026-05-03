import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileStack, ChevronRight, AlertTriangle, CheckCircle, Clock, Eye, Sparkles, RefreshCw, FileText, CreditCard, CalendarClock, Timer } from "lucide-react";
import { getStatusProcesso, formatDate } from "./processoConstants";
import { ProcessoDetalheDrawer } from "./ProcessoDetalheDrawer";

interface Processo {
  id: string;
  servico_nome: string;
  status: string;
  pagamento_status: string;
  data_criacao: string;
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

const prazoTone = (dias: number | null) => {
  if (dias === null) return { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700", chip: "bg-slate-200 text-slate-800" };
  if (dias < 0) return { bg: "bg-red-50", border: "border-red-300", text: "text-red-800", chip: "bg-red-600 text-white" };
  if (dias <= 7) return { bg: "bg-red-50", border: "border-red-300", text: "text-red-800", chip: "bg-red-600 text-white" };
  if (dias <= 30) return { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-900", chip: "bg-amber-500 text-white" };
  return { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-900", chip: "bg-emerald-600 text-white" };
};

export function ClienteProcessosSection({ clienteId }: Props) {
  const [loading, setLoading] = useState(true);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: procs, error } = await supabase
        .from("qa_processos")
        .select("id, servico_nome, status, pagamento_status, data_criacao, etapa_liberada_ate, prazo_critico_data, prazo_critico_doc_id, primeiro_doc_aprovado_em")
        .eq("cliente_id", clienteId)
        .order("data_criacao", { ascending: false });
      if (error) throw error;

      const procIds = (procs ?? []).map((p) => p.id);
      const { data: docs } = procIds.length
        ? await supabase.from("qa_processo_documentos").select("id, processo_id, status, obrigatorio, tipo_documento").in("processo_id", procIds)
        : { data: [] as any[] };

      const enriched: Processo[] = (procs ?? []).map((p: any) => {
        const myDocs = (docs ?? []).filter((d: any) => d.processo_id === p.id);
        const total = myDocs.length;
        // pendentes: apenas obrigatórios não satisfeitos. dispensado_grupo NÃO é pendência.
        const pendentes = myDocs.filter((d: any) => d.obrigatorio && (d.status === "pendente" || d.status === "invalido" || d.status === "divergente")).length;
        const aprovados = myDocs.filter((d: any) => d.status === "aprovado" || d.status === "dispensado_grupo").length;
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
      setProcessos(enriched);
    } catch (e: any) {
      toast.error("Erro ao carregar processos: " + (e?.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) return <div className="text-xs uppercase tracking-wider text-slate-400 text-center py-6">CARREGANDO PROCESSOS...</div>;

  if (processos.length === 0) {
    return (
      <div className="text-center py-8">
        <FileStack className="h-8 w-8 mx-auto text-slate-300 mb-2" />
        <p className="text-xs uppercase tracking-wider text-slate-400">VOCÊ AINDA NÃO POSSUI PROCESSOS ATIVOS</p>
      </div>
    );
  }

  // Banner global: menor prazo entre todos os processos ativos
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
  const tone = prazoTone(menorDias);

  return (
    <div className="space-y-2.5">
      {menor && menorDias !== null && (
        <div className={`rounded-xl border ${tone.border} ${tone.bg} p-4`}>
          <div className="flex items-start gap-3">
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${tone.chip}`}>
              <Timer className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] uppercase tracking-[0.14em] font-bold ${tone.text}`}>PRAZO CRÍTICO DA SUA DOCUMENTAÇÃO</span>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${tone.chip}`}>
                  {menorDias < 0 ? `VENCIDO HÁ ${Math.abs(menorDias)}D` : menorDias === 0 ? "VENCE HOJE" : `${menorDias} DIAS RESTANTES`}
                </span>
              </div>
              <p className={`text-[12px] leading-relaxed mt-1.5 ${tone.text}`}>
                Você precisa enviar todos os documentos antes de <strong>{formatDate(menor.prazo_critico_data!)}</strong>.
                {menor.prazo_critico_doc_label ? (
                  <> Documento mais próximo do vencimento: <strong>{menor.prazo_critico_doc_label}</strong>.</>
                ) : null}
              </p>
              <p className={`text-[11px] leading-relaxed mt-1 normal-case ${tone.text}/80 opacity-80`}>
                Se algum documento vencer antes do protocolo, será necessário emitir uma versão atualizada e reenviar.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <button onClick={carregar} className="text-[10px] uppercase tracking-wider font-bold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> ATUALIZAR
        </button>
      </div>
      {processos.map((p) => {
        const st = getStatusProcesso(p.status);
        const precisaAcao = (p.pendentes ?? 0) > 0 || p.status === "aguardando_documentos";
        const aguardandoPagto = p.pagamento_status === "aguardando";
        const dias = diasRestantes(p.prazo_critico_data);
        const tonePr = prazoTone(dias);
        const etapa = Math.max(1, Math.min(5, p.etapa_liberada_ate ?? 1));
        return (
          <button
            key={p.id}
            onClick={() => setOpenId(p.id)}
            className={`w-full text-left bg-white border rounded-xl p-4 hover:shadow-md transition ${aguardandoPagto ? "border-[#E5C2C6] ring-1 ring-[#7A1F2B]" : precisaAcao ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">PROCESSO · {formatDate(p.data_criacao)}</span>
                </div>
                <h4 className="font-bold text-sm text-slate-800 uppercase mt-1 line-clamp-2">{p.servico_nome}</h4>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${st.bg} ${st.text} border ${st.border}`}>{st.label}</span>
                  {(p.total_docs ?? 0) > 0 && !aguardandoPagto && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      {p.aprovados}/{p.total_docs} DOCS APROVADOS
                    </span>
                  )}
                  {!aguardandoPagto && (
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      ETAPA {etapa}/5 · {ETAPA_LABELS[etapa]}
                    </span>
                  )}
                </div>
                {!aguardandoPagto && dias !== null && (
                  <div className={`mt-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold ${tonePr.text}`}>
                    <CalendarClock className="h-3 w-3" />
                    PRAZO: {dias < 0 ? `VENCIDO HÁ ${Math.abs(dias)}D` : dias === 0 ? "VENCE HOJE" : `${dias}D`} · ATÉ {formatDate(p.prazo_critico_data!)}
                  </div>
                )}
                {aguardandoPagto ? (
                  <div className="mt-3 rounded-lg bg-[#FBF3F4] border border-[#E5C2C6] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-[#7A1F2B]">
                      <CreditCard className="h-3 w-3" /> AGUARDANDO PAGAMENTO
                    </div>
                    <p className="text-[11px] text-[#7A1F2B] mt-1 leading-relaxed normal-case">
                      Cadastro recebido. Nossa Equipe Operacional validará os dados e confirmará o pagamento manualmente. Após a confirmação, o checklist documental será liberado.
                    </p>
                    <a
                      href="https://wa.me/5511978481919?text=Ol%C3%A1!%20Acabei%20de%20contratar%20um%20servi%C3%A7o%20pelo%20portal%20e%20gostaria%20de%20combinar%20o%20pagamento."
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] uppercase tracking-wider font-bold"
                    >
                      Falar no WhatsApp
                    </a>
                  </div>
                ) : precisaAcao && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-amber-700">
                    <AlertTriangle className="h-3 w-3" /> {p.acao}
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 mt-1" />
            </div>
          </button>
        );
      })}

      {openId && <ProcessoDetalheDrawer processoId={openId} onClose={() => setOpenId(null)} onUpdated={carregar} />}
    </div>
  );
}
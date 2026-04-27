import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileStack, ChevronRight, AlertTriangle, CheckCircle, Clock, Eye, Sparkles, RefreshCw, FileText } from "lucide-react";
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
}

interface Props {
  clienteId: number;
}

export function ClienteProcessosSection({ clienteId }: Props) {
  const [loading, setLoading] = useState(true);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: procs, error } = await supabase
        .from("qa_processos")
        .select("id, servico_nome, status, pagamento_status, data_criacao")
        .eq("cliente_id", clienteId)
        .order("data_criacao", { ascending: false });
      if (error) throw error;

      const procIds = (procs ?? []).map((p) => p.id);
      const { data: docs } = procIds.length
        ? await supabase.from("qa_processo_documentos").select("processo_id, status, obrigatorio").in("processo_id", procIds)
        : { data: [] as any[] };

      const enriched: Processo[] = (procs ?? []).map((p: any) => {
        const myDocs = (docs ?? []).filter((d: any) => d.processo_id === p.id);
        const total = myDocs.length;
        // pendentes: apenas obrigatórios não satisfeitos. dispensado_grupo NÃO é pendência.
        const pendentes = myDocs.filter((d: any) => d.obrigatorio && (d.status === "pendente" || d.status === "invalido" || d.status === "divergente")).length;
        const aprovados = myDocs.filter((d: any) => d.status === "aprovado" || d.status === "dispensado_grupo").length;

        let acao = "ACOMPANHAR";
        if (p.status === "aguardando_pagamento") acao = "AGUARDANDO PAGAMENTO";
        else if (p.status === "aguardando_documentos" || pendentes > 0) acao = `${pendentes} DOC(S) PENDENTE(S)`;
        else if (p.status === "em_validacao_ia") acao = "VALIDANDO AUTOMATICAMENTE";
        else if (p.status === "em_revisao_humana") acao = "AGUARDE REVISÃO";
        else if (p.status === "aprovado") acao = "DOCUMENTAÇÃO APROVADA";
        else if (p.status === "concluido") acao = "PROCESSO CONCLUÍDO";

        return { ...p, total_docs: total, pendentes, aprovados, acao };
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

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-end">
        <button onClick={carregar} className="text-[10px] uppercase tracking-wider font-bold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> ATUALIZAR
        </button>
      </div>
      {processos.map((p) => {
        const st = getStatusProcesso(p.status);
        const precisaAcao = (p.pendentes ?? 0) > 0 || p.status === "aguardando_documentos";
        return (
          <button
            key={p.id}
            onClick={() => setOpenId(p.id)}
            className={`w-full text-left bg-white border rounded-xl p-4 hover:shadow-md transition ${precisaAcao ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"}`}
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
                  {(p.total_docs ?? 0) > 0 && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      {p.aprovados}/{p.total_docs} DOCS APROVADOS
                    </span>
                  )}
                </div>
                {precisaAcao && (
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
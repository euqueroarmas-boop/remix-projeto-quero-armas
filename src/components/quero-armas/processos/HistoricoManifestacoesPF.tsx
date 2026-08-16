// ============================================================================
// HistoricoManifestacoesPF — o que a PF já escreveu, para a equipe
// ----------------------------------------------------------------------------
// Registrar a segunda manifestação sem ver a primeira é como responder a um
// e-mail sem ler a conversa: dá duplicata, dá prazo recontado do zero, e dá
// recurso repetindo o que o delegado já rejeitou.
//
// A aba Histórico do processo mostra o EVENTO ("manifestação registrada"), que
// serve como rastro. O que ela não mostra — porque evento não guarda — é o
// texto. Ele fica aqui, na íntegra, colapsado por padrão para não empurrar o
// resto da aba para baixo.
//
// Ordem: do MAIS RECENTE para o mais antigo. Aqui não é linha do tempo para o
// cliente entender a história; é a mesa de trabalho da equipe, e o que ela
// precisa primeiro é o último documento.
// ============================================================================

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface ManifestacaoRegistrada {
  id: string;
  tipo: string | null;
  status_processo: string | null;
  texto: string;
  delegado_nome: string | null;
  delegado_cargo: string | null;
  unidade_pf: string | null;
  data_documento: string | null;
  prazo_limite: string | null;
  created_at: string | null;
}

const TIPO_ROTULO: Record<string, string> = {
  notificacao: "NOTIFICAÇÃO",
  parecer: "PARECER",
  manifestacao: "MANIFESTAÇÃO",
  decisao: "DECISÃO",
};

function fmt(v?: string | null): string {
  const s = String(v ?? "").trim();
  if (!s) return "—";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

export default function HistoricoManifestacoesPF({
  processoId,
  recarregarEm,
}: {
  processoId: string;
  /** Muda para forçar recarga depois que a equipe registra uma nova. */
  recarregarEm?: number;
}) {
  const [linhas, setLinhas] = useState<ManifestacaoRegistrada[]>([]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const { data } = await supabase
        .from("qa_processo_manifestacoes_pf" as never)
        .select(
          "id, tipo, status_processo, texto, delegado_nome, delegado_cargo, unidade_pf, data_documento, prazo_limite, created_at",
        )
        .eq("processo_id", processoId)
        .order("created_at", { ascending: false });
      if (vivo) setLinhas((data as unknown as ManifestacaoRegistrada[]) ?? []);
    })();
    return () => { vivo = false; };
  }, [processoId, recarregarEm]);

  if (linhas.length === 0) return null;

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/40">
      <div className="border-b border-indigo-200 px-4 py-2">
        <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-800">
          <FileText className="h-3.5 w-3.5" />
          O que a Polícia Federal escreveu · {linhas.length} documento(s)
        </h4>
        <p className="mt-0.5 text-[10px] text-indigo-700">
          Texto copiado do SINARM. O cliente vê o mesmo conteúdo no portal.
        </p>
      </div>
      <div className="divide-y divide-indigo-100">
        {linhas.map((m) => (
          <details key={m.id} className="px-4 py-2">
            <summary className="cursor-pointer list-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
                {TIPO_ROTULO[String(m.tipo ?? "").toLowerCase()] ?? "DOCUMENTO"}
              </span>
              <span className="ml-2 text-[10px] text-slate-500">
                {fmt(m.data_documento || m.created_at)}
                {m.prazo_limite ? ` · prazo até ${fmt(m.prazo_limite)}` : ""}
                {m.delegado_nome ? ` · ${m.delegado_nome}` : ""}
              </span>
            </summary>
            {/*
              `whitespace-pre-wrap`: o texto foi colado como veio, com as
              quebras do delegado. Reformatar mudaria a leitura de uma peça
              que é prova e que fundamenta o recurso.
            */}
            <p className="mt-1.5 whitespace-pre-wrap rounded-md bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-800">
              {m.texto}
            </p>
            {(m.delegado_cargo || m.unidade_pf) && (
              <p className="mt-1 text-[10px] text-slate-400">
                {[m.delegado_cargo, m.unidade_pf].filter(Boolean).join(" · ")}
              </p>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, FileText, Clock, ShieldCheck, ExternalLink, Loader2 } from "lucide-react";

type LinhaExigencia = {
  id: string;
  tipo_documento: string;
  nome_documento: string;
  etapa: string;
  obrigatorio: boolean;
  validade_dias: number | null;
  ordem: number;
  link_emissao: string | null;
  observacoes_cliente: string | null;
  instrucoes: string | null;
  biblioteca_id: string | null;
};

type Biblioteca = {
  id: string;
  descricao_o_que_e: string | null;
  descricao_como_enviar: string | null;
  observacao_cliente: string | null;
  link_emissao: string | null;
  link_modelo: string | null;
  base_legal: string | null;
};

interface Props {
  servicoId: number | null;
  servicoNome?: string;
  onClose: () => void;
}

function labelValidade(d: number | null): string {
  if (!d) return "Sem prazo de validade";
  if (d < 60) return `Vale por ${d} dias`;
  if (d < 365) return `Vale por ${Math.round(d / 30)} meses`;
  return `Vale por ${Math.round(d / 365)} ano(s)`;
}

const ETAPA_LABEL: Record<string, string> = {
  base: "Documentos básicos",
  complementar: "Complementares",
  tecnico: "Técnicos",
  final: "Finais",
};

export default function PreviaClienteChecklistModal({ servicoId, servicoNome, onClose }: Props) {
  const [linhas, setLinhas] = useState<LinhaExigencia[]>([]);
  const [bibMap, setBibMap] = useState<Map<string, Biblioteca>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!servicoId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data: docs } = await supabase
          .from("qa_servicos_documentos" as any)
          .select("id, tipo_documento, nome_documento, etapa, obrigatorio, validade_dias, ordem, link_emissao, observacoes_cliente, instrucoes, biblioteca_id, ativo")
          .eq("servico_id", servicoId)
          .eq("ativo", true)
          .order("ordem");
        const lista = (((docs as any[]) ?? []) as LinhaExigencia[]);
        if (!alive) return;
        setLinhas(lista);
        const bibIds = lista.map((l) => l.biblioteca_id).filter(Boolean) as string[];
        if (bibIds.length > 0) {
          const { data: bib } = await supabase
            .from("qa_documentos_biblioteca" as any)
            .select("id, descricao_o_que_e, descricao_como_enviar, observacao_cliente, link_emissao, link_modelo, base_legal")
            .in("id", bibIds);
          const m = new Map<string, Biblioteca>();
          for (const b of ((bib as any[]) ?? [])) m.set((b as any).id, b as Biblioteca);
          if (alive) setBibMap(m);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [servicoId]);

  // Agrupa por etapa
  const grupos = new Map<string, LinhaExigencia[]>();
  for (const l of linhas) {
    const k = l.etapa || "base";
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(l);
  }
  const ordemEtapas = ["base", "complementar", "tecnico", "final"];
  const etapasOrdenadas = ordemEtapas.filter((e) => grupos.has(e));
  const totalObrigatorios = linhas.filter((l) => l.obrigatorio).length;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-start md:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-3xl bg-white rounded-xl border border-slate-200 shadow-xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" style={{ color: "hsl(352 60% 30%)" }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Pré-via do cliente</span>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-6 md:px-10 py-6">
          <h2 className="text-xl font-semibold text-[#0A0A0A] tracking-tight mb-1">
            Olá, [NOME DO CLIENTE] 👋
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Para dar andamento em <b>{servicoNome ?? "seu serviço"}</b>, você precisa enviar os documentos abaixo.
          </p>

          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : linhas.length === 0 ? (
            <p className="py-10 text-center text-sm italic text-slate-400">
              Este serviço ainda não tem checklist configurado.
            </p>
          ) : (
            <>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 mb-4 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {linhas.length} documento{linhas.length !== 1 ? "s" : ""} · {totalObrigatorios} obrigatório{totalObrigatorios !== 1 ? "s" : ""}
              </div>

              <div className="space-y-6">
                {etapasOrdenadas.map((etapa) => (
                  <div key={etapa}>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
                      {ETAPA_LABEL[etapa] ?? etapa}
                    </h3>
                    <div className="space-y-2">
                      {grupos.get(etapa)!.map((linha) => {
                        const bib = linha.biblioteca_id ? bibMap.get(linha.biblioteca_id) : undefined;
                        const oQueE = bib?.descricao_o_que_e ?? null;
                        const comoEnviar = bib?.descricao_como_enviar ?? linha.instrucoes ?? null;
                        const obs = bib?.observacao_cliente ?? linha.observacoes_cliente ?? null;
                        const link = linha.link_emissao ?? bib?.link_emissao ?? null;
                        const modelo = bib?.link_modelo ?? null;
                        const legal = bib?.base_legal ?? null;
                        return (
                          <div key={linha.id} className="rounded-lg border border-slate-200 p-3 bg-white">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800">{linha.nome_documento}</p>
                                {oQueE && (
                                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{oQueE}</p>
                                )}
                              </div>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${
                                  linha.obrigatorio
                                    ? "text-red-700 bg-red-50 border-red-200"
                                    : "text-slate-500 bg-slate-50 border-slate-200"
                                }`}
                              >
                                {linha.obrigatorio ? "OBRIGATÓRIO" : "OPCIONAL"}
                              </span>
                            </div>

                            {comoEnviar && (
                              <div className="mt-2 rounded bg-slate-50 border border-slate-100 p-2 text-[12px] text-slate-700 leading-relaxed">
                                <b className="text-slate-800">Como enviar:</b> {comoEnviar}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {labelValidade(linha.validade_dias)}
                              </span>
                              {obs && <span>· {obs}</span>}
                              {legal && <span>· Base: {legal}</span>}
                            </div>

                            {(link || modelo) && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {link && (
                                  <a
                                    href={link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7A1F2B] hover:underline"
                                  >
                                    <ExternalLink className="w-3 h-3" /> Onde emitir
                                  </a>
                                )}
                                {modelo && (
                                  <a
                                    href={modelo}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:underline"
                                  >
                                    <FileText className="w-3 h-3" /> Baixar modelo
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs h-8 px-4 rounded-md border border-slate-200 hover:bg-slate-100"
          >
            Fechar pré-via
          </button>
        </div>
      </div>
    </div>
  );
}

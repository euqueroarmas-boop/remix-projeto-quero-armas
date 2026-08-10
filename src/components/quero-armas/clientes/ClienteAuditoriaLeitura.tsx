/* =============================================================================
 * Auditoria de leitura — o dossiê de tudo que decidiu o destino de um documento
 *
 * Por que existe
 * --------------
 * Quando um cliente é recusado, a pergunta que chega à equipe é sempre a mesma:
 * "por que essa certidão foi rejeitada, se o nome está lá?". Até aqui, responder
 * exigia reproduzir o upload — e o arquivo do cliente já não estava mais na mão
 * de ninguém. Esta aba mostra, por documento: o texto que o sistema enxergou, de
 * onde saiu cada campo crítico, o que foi comparado contra o cadastro e a
 * mensagem exata que o cliente recebeu.
 *
 * Visibilidade: ADMINISTRADOR apenas. É dado bruto de leitura, com PII, e não
 * tem leitura fora do contexto de investigação.
 * ============================================================================= */
import { useEffect, useState } from "react";
import { Loader2, ChevronDown, ChevronRight, ScanText, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AchadoAudit {
  campo: string;
  label: string;
  problema: string;
  no_documento?: string;
  no_cadastro?: string;
  mensagem: string;
}

interface Auditoria {
  versao?: number;
  lido_em?: string;
  motor?: string;
  orgao_identificado?: string;
  tipo_identificado?: string;
  fonte_do_nome?: string | null;
  nome_resgatado?: boolean;
  campos_vazios?: string[];
  /** Campos que o layout do documento não imprime — ausência esperada. */
  campos_nao_aplicaveis?: string[];
  filiacao_lida?: string[];
  filiacao_fonte?: string | null;
  veredicto?: string;
  mensagem_ao_cliente?: string | null;
  achados?: AchadoAudit[];
  texto_lido?: string;
  texto_truncado?: boolean;
}

interface DocLinha {
  id: string;
  tipo_documento: string | null;
  status: string | null;
  arquivo_nome: string | null;
  created_at: string;
  auditoria: Auditoria | null;
  parser: Record<string, unknown> | null;
  lido_por: string | null;
}

interface NotificacaoLinha {
  id: string;
  titulo: string | null;
  mensagem: string | null;
  created_at: string;
}

const dataHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

const FONTE_LABEL: Record<string, string> = {
  parser_do_orgao: "REGRA DO PRÓPRIO ÓRGÃO",
  rotulo_mesma_linha: "RÓTULO NA MESMA LINHA",
  rotulo_linha_seguinte: "RÓTULO NA LINHA ACIMA",
  rotulo_coluna: "RÓTULO EM COLUNA AO LADO",
  literal_cadastro_no_pdf: "TEXTO LITERAL DO CADASTRO ENCONTRADO NO PDF",
};

const CorVeredicto: Record<string, string> = {
  aprovado: "#166534",
  rejeitado: "#7A1F2B",
  revisao: "#92400E",
  revisao_humana: "#92400E",
  cadastro_pendente: "#1E3A8A",
};

/** Rótulo humano do veredicto — a badge não deve exibir o slug cru. */
const LabelVeredicto: Record<string, string> = {
  aprovado: "APROVADO",
  rejeitado: "REJEITADO",
  revisao: "REVISÃO",
  revisao_humana: "REVISÃO HUMANA",
  cadastro_pendente: "CADASTRO PENDENTE",
};

export default function ClienteAuditoriaLeitura({ cliente }: { cliente: any }) {
  const [carregando, setCarregando] = useState(true);
  const [docs, setDocs] = useState<DocLinha[]>([]);
  const [notificacoes, setNotificacoes] = useState<NotificacaoLinha[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    if (!cliente?.id) return;
    let vivo = true;
    (async () => {
      setCarregando(true);
      const [{ data: docsData }, { data: notifData }] = await Promise.all([
        supabase
          .from("qa_documentos_cliente" as any)
          .select("id, tipo_documento, status, arquivo_nome, created_at, ia_dados_extraidos")
          .eq("qa_cliente_id", cliente.id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("qa_notificacoes_cliente" as any)
          .select("id, titulo, mensagem, created_at")
          .eq("cliente_id", cliente.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (!vivo) return;
      setDocs(
        ((docsData as any[]) ?? []).map((d) => {
          const ia = (d?.ia_dados_extraidos ?? {}) as Record<string, any>;
          return {
            id: d.id,
            tipo_documento: d.tipo_documento,
            status: d.status,
            arquivo_nome: d.arquivo_nome,
            created_at: d.created_at,
            auditoria: (ia.auditoria_leitura ?? null) as Auditoria | null,
            parser: (ia.parser ?? null) as Record<string, unknown> | null,
            lido_por: ia.lido_por ?? null,
          };
        }),
      );
      setNotificacoes(((notifData as any[]) ?? []) as NotificacaoLinha[]);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [cliente?.id]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[10px] uppercase tracking-wider">CARREGANDO AUDITORIA...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
        REGISTRO TÉCNICO DE LEITURA. MOSTRA O TEXTO QUE O SISTEMA ENXERGOU NO ARQUIVO, DE ONDE SAIU
        CADA CAMPO, O QUE FOI COMPARADO COM O CADASTRO E O QUE O CLIENTE RECEBEU DE RESPOSTA.
        DOCUMENTOS ENVIADOS ANTES DESTE REGISTRO APARECEM SEM DOSSIÊ — NÃO É FALHA, É AUSÊNCIA DE DADO.
      </p>

      <div className="space-y-2">
        {docs.length === 0 && (
          <div className="text-[11px] uppercase tracking-wider text-slate-400 py-6 text-center">
            NENHUM DOCUMENTO ENVIADO POR ESTE CLIENTE.
          </div>
        )}
        {docs.map((d) => {
          const a = d.auditoria;
          const expandido = aberto === d.id;
          return (
            <div key={d.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setAberto(expandido ? null : d.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
              >
                {expandido ? (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                )}
                <ScanText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-[12px] font-bold text-slate-800 uppercase truncate">
                  {(d.tipo_documento ?? "—").replace(/_/g, " ")}
                </span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  {dataHora(d.created_at)}
                </span>
                {a?.veredicto && (
                  <span
                    className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white whitespace-nowrap"
                    style={{ background: CorVeredicto[a.veredicto] ?? "#475569" }}
                  >
                    {LabelVeredicto[a.veredicto] ?? a.veredicto.replace(/_/g, " ").toUpperCase()}
                  </span>
                )}
              </button>

              {expandido && (
                <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                    <Info rotulo="ARQUIVO" valor={d.arquivo_nome ?? "—"} />
                    <Info rotulo="STATUS NO HUB" valor={(d.status ?? "—").toUpperCase()} />
                    <Info rotulo="MOTOR DE LEITURA" valor={(a?.motor ?? d.lido_por ?? "—").toUpperCase()} />
                    <Info rotulo="ÓRGÃO IDENTIFICADO" valor={(a?.orgao_identificado ?? "—").toUpperCase()} />
                    <Info
                      rotulo="DE ONDE SAIU O NOME"
                      valor={a?.fonte_do_nome ? (FONTE_LABEL[a.fonte_do_nome] ?? a.fonte_do_nome) : "—"}
                    />
                    <Info
                      rotulo="PRECISOU DE RESGATE"
                      valor={a?.nome_resgatado ? "SIM — O PARSER DO ÓRGÃO NÃO ACHOU" : "NÃO"}
                    />
                    <Info rotulo="LIDO EM" valor={dataHora(a?.lido_em)} />
                    <Info
                      rotulo="CAMPOS SEM VALOR"
                      valor={a?.campos_vazios?.length ? a.campos_vazios.join(", ").toUpperCase() : "NENHUM"}
                    />
                    <Info
                      rotulo="NÃO EXISTE NESTE DOCUMENTO"
                      valor={
                        a?.campos_nao_aplicaveis?.length
                          ? a.campos_nao_aplicaveis.join(", ").toUpperCase()
                          : "—"
                      }
                    />
                    <Info
                      rotulo="FILIAÇÃO LIDA"
                      valor={a?.filiacao_lida?.length ? a.filiacao_lida.join(" · ").toUpperCase() : "—"}
                    />
                  </dl>

                  {!!a?.achados?.length && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        O QUE A CONFERÊNCIA APONTOU
                      </p>
                      {a.achados.map((ach, i) => (
                        <div
                          key={i}
                          className="rounded-lg border p-2 text-[11px]"
                          style={{ borderColor: "#F1D6DA", background: "#FDF7F8" }}
                        >
                          <p className="font-bold uppercase" style={{ color: "#7A1F2B" }}>
                            {ach.label} — {ach.problema.replace(/_/g, " ").toUpperCase()}
                          </p>
                          <p className="text-slate-700 mt-0.5">{ach.mensagem}</p>
                          <p className="text-slate-500 mt-1 text-[10px] uppercase tracking-wider">
                            NO DOCUMENTO: {ach.no_documento || "—"} · NO CADASTRO: {ach.no_cadastro || "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {a?.mensagem_ao_cliente && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        O QUE O CLIENTE LEU NA TELA
                      </p>
                      <p className="text-[11px] text-slate-700">{a.mensagem_ao_cliente}</p>
                    </div>
                  )}

                  {d.parser && (
                    <details className="rounded-lg border border-slate-200 bg-white p-2">
                      <summary className="text-[10px] font-bold uppercase tracking-wider text-slate-500 cursor-pointer">
                        CAMPOS EXTRAÍDOS DO DOCUMENTO
                      </summary>
                      <pre className="mt-2 text-[10px] text-slate-600 whitespace-pre-wrap break-words max-h-64 overflow-auto">
                        {JSON.stringify(d.parser, null, 2)}
                      </pre>
                    </details>
                  )}

                  {a?.texto_lido && (
                    <details className="rounded-lg border border-slate-200 bg-white p-2">
                      <summary className="text-[10px] font-bold uppercase tracking-wider text-slate-500 cursor-pointer">
                        TEXTO QUE O SISTEMA ENXERGOU NO ARQUIVO
                        {a.texto_truncado ? " (RECORTE)" : ""}
                      </summary>
                      <pre className="mt-2 text-[10px] text-slate-600 whitespace-pre-wrap break-words max-h-80 overflow-auto">
                        {a.texto_lido}
                      </pre>
                    </details>
                  )}

                  {!a && (
                    <p className="text-[11px] text-slate-500">
                      ESTE DOCUMENTO FOI ENVIADO ANTES DO REGISTRO DE AUDITORIA. NÃO HÁ TEXTO LIDO GUARDADO.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" /> AVISOS ENVIADOS AO CLIENTE
        </p>
        {notificacoes.length === 0 && (
          <div className="text-[11px] uppercase tracking-wider text-slate-400 py-3">NENHUM AVISO REGISTRADO.</div>
        )}
        {notificacoes.map((n) => (
          <div key={n.id} className="border border-slate-200 rounded-xl bg-white px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-800 uppercase">{n.titulo ?? "—"}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-400">
                {dataHora(n.created_at)}
              </span>
            </div>
            {n.mensagem && <p className="text-[11px] text-slate-600 mt-1">{n.mensagem}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{rotulo}</dt>
      <dd className="text-[11px] text-slate-800 break-words">{valor}</dd>
    </div>
  );
}
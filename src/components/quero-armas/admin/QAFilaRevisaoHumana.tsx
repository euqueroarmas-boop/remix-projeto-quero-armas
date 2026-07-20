/**
 * BLOCO 4 — Fila de Revisão Humana + Promoção de modelos de processos deferidos.
 *
 * Camada ADITIVA. Não altera componentes existentes. Consome edges/tabelas que
 * já existem:
 *  - tabela qa_processo_documentos (status='em_revisao_humana' / 'aprovado')
 *  - tabela qa_processos (status='deferido' | 'concluido' | 'finalizado')
 *  - edge qa-doc-acao-equipe  (ações: aprovar | aprovar_e_modelar | rejeitar | signed_url)
 *  - edge qa-modelo-aprovado-criar (promove um documento aprovado a modelo)
 *
 * Visual Premium Light (marca #7A1F2B), terminologia "Equipe Quero Armas"
 * (nunca "admin"). Documentos sempre abertos via DocumentoViewerModal.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  GraduationCap,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DocumentoViewerModal, {
  useDocumentoViewer,
} from "@/components/quero-armas/DocumentoViewerModal";

// ---------------------------------------------------------------------------
// Tipos locais
// ---------------------------------------------------------------------------
type DocRow = {
  id: string;
  cliente_id: number | null;
  processo_id: string | null;
  tipo_documento: string;
  nome_documento: string;
  status: string;
  motivo_rejeicao: string | null;
  arquivo_storage_key: string | null;
  data_envio: string | null;
  updated_at: string | null;
  usado_como_modelo: boolean;
  validacao_ia_confianca: number | null;
  validacao_ia_status: string | null;
  decisao_ia: string | null;
  cliente_nome?: string | null;
  servico_nome?: string | null;
};

type ProcessoRow = {
  id: string;
  cliente_id: number | null;
  servico_nome: string | null;
  status: string;
  updated_at: string | null;
  cliente_nome?: string | null;
  docs_aprovados?: number;
  docs_pendentes_modelo?: number;
};

const STATUS_CONCLUSAO = ["deferido", "concluido", "finalizado"] as const;

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function QAFilaRevisaoHumana() {
  const [aba, setAba] = useState<"fila" | "deferidos">("fila");

  return (
    <div className="qa-scope mx-auto w-full max-w-[1400px] px-4 md:px-6">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#7A1F2B]" />
          <h2 className="text-[14px] font-bold uppercase tracking-widest text-slate-900">
            Revisão IA · Equipe Quero Armas
          </h2>
        </div>
        <p className="mt-1 text-[12px] text-slate-500">
          Documentos que a IA enviou para conferência humana e promoção de
          aprovações em modelos de treino.
        </p>
        <div className="mt-4 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <TabBtn active={aba === "fila"} onClick={() => setAba("fila")} icon={<Inbox className="h-3.5 w-3.5" />}>
            Fila de Conferência
          </TabBtn>
          <TabBtn active={aba === "deferidos"} onClick={() => setAba("deferidos")} icon={<GraduationCap className="h-3.5 w-3.5" />}>
            Processos Deferidos
          </TabBtn>
        </div>
      </header>

      {aba === "fila" ? <FilaConferencia /> : <ProcessosDeferidos />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
        active
          ? "bg-white text-[#7A1F2B] shadow-sm border border-[#7A1F2B]/30"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Bloco 4.1 — Fila de Conferência (status = em_revisao_humana)
// ---------------------------------------------------------------------------
function FilaConferencia() {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [busca, setBusca] = useState("");
  const [acaoLoadingId, setAcaoLoadingId] = useState<string | null>(null);

  const [rejeicao, setRejeicao] = useState<DocRow | null>(null);
  const [motivo, setMotivo] = useState("");

  const [aprovacao, setAprovacao] = useState<DocRow | null>(null);
  const [usarComoModelo, setUsarComoModelo] = useState(false);

  const viewer = useDocumentoViewer();
  const [docNoViewer, setDocNoViewer] = useState<DocRow | null>(null);
  const [aprovandoModeloViewer, setAprovandoModeloViewer] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("qa_processo_documentos")
        .select(
          "id, cliente_id, processo_id, tipo_documento, nome_documento, status, motivo_rejeicao, arquivo_storage_key, data_envio, updated_at, usado_como_modelo, validacao_ia_confianca, validacao_ia_status, decisao_ia"
        )
        .eq("status", "em_revisao_humana")
        .order("updated_at", { ascending: false })
        .limit(300);
      if (error) throw error;

      const rows = (data ?? []) as DocRow[];
      const cliIds = Array.from(new Set(rows.map((d) => d.cliente_id).filter((v): v is number => v != null)));
      const procIds = Array.from(new Set(rows.map((d) => d.processo_id).filter(Boolean))) as string[];
      const [cliRes, procRes] = await Promise.all([
        cliIds.length
          ? supabase.from("qa_clientes").select("id, nome_completo").in("id", cliIds)
          : Promise.resolve({ data: [] as any[] }),
        procIds.length
          ? supabase.from("qa_processos").select("id, servico_nome").in("id", procIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const cliMap = new Map<number, string>(
        (cliRes.data ?? []).map((c: any) => [c.id as number, c.nome_completo as string])
      );
      const procMap = new Map<string, string>(
        (procRes.data ?? []).map((p: any) => [p.id as string, (p.servico_nome ?? "") as string])
      );
      setDocs(
        rows.map((d) => ({
          ...d,
          cliente_nome: d.cliente_id ? cliMap.get(d.cliente_id) ?? null : null,
          servico_nome: d.processo_id ? procMap.get(d.processo_id) ?? null : null,
        }))
      );
    } catch (e: any) {
      toast.error("Falha ao carregar fila: " + (e?.message ?? "erro"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const docsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      [d.cliente_nome, d.nome_documento, d.tipo_documento, d.servico_nome]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [docs, busca]);

  const callAcao = async (doc: DocRow, payload: Record<string, unknown>) => {
    setAcaoLoadingId(doc.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-doc-acao-equipe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ documento_id: doc.id, ...payload }),
        }
      );
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out?.error || `Falha (${r.status})`);
      return out;
    } finally {
      setAcaoLoadingId(null);
    }
  };

  const abrirDocumento = async (doc: DocRow) => {
    try {
      const fileName =
        (doc.arquivo_storage_key || doc.nome_documento || "documento").split("/").pop() ||
        "documento";
      setDocNoViewer(doc);
      if (doc.arquivo_storage_key) {
        viewer.abrirStorage("qa-processo-docs", doc.arquivo_storage_key, {
          fileName,
          title: doc.nome_documento || fileName,
        });
        return;
      }
      const out = await callAcao(doc, { acao: "signed_url" });
      if (out?.url) {
        viewer.abrirUrl(out.url, { fileName, title: doc.nome_documento || fileName });
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao abrir documento.");
    }
  };

  const confirmarAprovacao = async () => {
    if (!aprovacao) return;
    try {
      if (usarComoModelo) {
        const nomeModelo = (aprovacao.nome_documento || aprovacao.tipo_documento || "MODELO").toUpperCase();
        await callAcao(aprovacao, {
          acao: "aprovar_e_modelar",
          nome_modelo: nomeModelo,
          observacoes: "Aprovado pela Equipe e promovido a modelo de treino.",
        });
        toast.success("Documento aprovado e promovido a modelo de treino.");
      } else {
        await callAcao(aprovacao, { acao: "aprovar" });
        toast.success("Documento aprovado.");
      }
      setAprovacao(null);
      setUsarComoModelo(false);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao aprovar.");
    }
  };

  const confirmarRejeicao = async () => {
    if (!rejeicao) return;
    const m = motivo.trim();
    if (m.length < 5) {
      toast.error("Descreva o motivo (mínimo 5 caracteres).");
      return;
    }
    try {
      await callAcao(rejeicao, { acao: "rejeitar", motivo: m });
      toast.success("Documento rejeitado. O cliente verá o motivo no portal.");
      setRejeicao(null);
      setMotivo("");
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao rejeitar.");
    }
  };

  const aprovarComoModeloDoViewer = async () => {
    const doc = docNoViewer;
    if (!doc) return;
    setAprovandoModeloViewer(true);
    try {
      const nomeModelo = (doc.nome_documento || doc.tipo_documento || "MODELO").toUpperCase();
      await callAcao(doc, {
        acao: "aprovar_e_modelar",
        nome_modelo: nomeModelo,
        observacoes: "Aprovado como modelo IA pelo visualizador.",
      });
      toast.success("Documento aprovado e promovido a modelo de treino.");
      viewer.fechar();
      setDocNoViewer(null);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao aprovar como modelo.");
    } finally {
      setAprovandoModeloViewer(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] font-bold uppercase tracking-wider text-slate-700">
          {loading ? "Carregando…" : `${docsFiltrados.length} documento(s) para conferência`}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, serviço ou documento…"
              className="h-9 w-[280px] rounded-md border border-slate-200 bg-white pl-7 pr-2 text-[12px] uppercase tracking-wide text-slate-700 placeholder:text-slate-400 placeholder:normal-case focus:border-[#7A1F2B] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => void carregar()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {!loading && docsFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          <div className="text-[13px] font-bold uppercase tracking-wider text-slate-700">
            Nenhum documento aguardando a equipe
          </div>
          <div className="text-[11px] text-slate-500">
            A IA está dando conta sozinha — ótimo sinal de treino consistente.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Serviço</th>
                <th className="px-3 py-2 text-left">Documento</th>
                <th className="px-3 py-2 text-left">IA</th>
                <th className="px-3 py-2 text-left">Enviado</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docsFiltrados.map((d) => {
                const conf =
                  typeof d.validacao_ia_confianca === "number"
                    ? `${Math.round(d.validacao_ia_confianca * 100)}%`
                    : "—";
                const enviado = d.data_envio ? new Date(d.data_envio).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
                return (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-medium uppercase text-slate-800">
                      {d.cliente_nome ?? `Cliente #${d.cliente_id ?? "?"}`}
                    </td>
                    <td className="px-3 py-2 uppercase text-slate-600">{d.servico_nome ?? "—"}</td>
                    <td className="px-3 py-2 uppercase text-slate-700">
                      <div className="font-semibold">{d.nome_documento}</div>
                      <div className="text-[10px] text-slate-400">{d.tipo_documento}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        <AlertCircle className="h-3 w-3" /> Em revisão · {conf}
                      </div>
                      {d.decisao_ia && (
                        <div className="mt-0.5 text-[10px] text-slate-500">{d.decisao_ia}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{enviado}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void abrirDocumento(d)}
                          disabled={acaoLoadingId === d.id}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Eye className="h-3 w-3" /> Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAprovacao(d);
                            setUsarComoModelo(false);
                          }}
                          disabled={acaoLoadingId === d.id}
                          className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-600 px-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejeicao(d);
                            setMotivo("");
                          }}
                          disabled={acaoLoadingId === d.id}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-[#7A1F2B]/30 bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-[#7A1F2B] hover:bg-[#7A1F2B]/5 disabled:opacity-50"
                        >
                          <XCircle className="h-3 w-3" /> Reprovar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Aprovação */}
      {aprovacao && (
        <ModalShell onClose={() => setAprovacao(null)} title="APROVAR DOCUMENTO">
          <div className="space-y-3 text-[12px] text-slate-700">
            <div>
              <div className="font-bold uppercase">{aprovacao.nome_documento}</div>
              <div className="text-[11px] text-slate-500 uppercase">
                {aprovacao.cliente_nome ?? "Cliente"} · {aprovacao.servico_nome ?? ""}
              </div>
            </div>
            <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-2.5">
              <input
                type="checkbox"
                checked={usarComoModelo}
                onChange={(e) => setUsarComoModelo(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                  Usar este envio como modelo de treino
                </div>
                <div className="text-[11px] text-slate-500">
                  A IA passa a comparar futuros envios contra este documento. Recomendado quando
                  o documento é representativo de "padrão aprovado".
                </div>
              </div>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAprovacao(null)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarAprovacao()}
                disabled={acaoLoadingId === aprovacao.id}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {acaoLoadingId === aprovacao.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Confirmar Aprovação
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Modal Rejeição */}
      {rejeicao && (
        <ModalShell onClose={() => setRejeicao(null)} title="REPROVAR DOCUMENTO">
          <div className="space-y-3 text-[12px] text-slate-700">
            <div>
              <div className="font-bold uppercase">{rejeicao.nome_documento}</div>
              <div className="text-[11px] text-slate-500 uppercase">
                {rejeicao.cliente_nome ?? "Cliente"} · {rejeicao.servico_nome ?? ""}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Motivo da Rejeição (visível ao cliente)
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={4}
                placeholder="Descreva o ajuste necessário em linguagem simples. Ex.: A foto está cortada. Reenvie em formato A4 com a assinatura visível."
                className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-[#7A1F2B] focus:outline-none"
              />
              <div className="mt-1 text-[10px] text-slate-400">Mínimo 5 caracteres.</div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRejeicao(null)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarRejeicao()}
                disabled={acaoLoadingId === rejeicao.id || motivo.trim().length < 5}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#7A1F2B] px-3 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-[#5e1622] disabled:opacity-50"
              >
                {acaoLoadingId === rejeicao.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Confirmar Reprovação
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      <DocumentoViewerModal
        open={viewer.open}
        onClose={() => {
          viewer.fechar();
          setDocNoViewer(null);
        }}
        source={viewer.source}
        title={viewer.title}
        onAprovarComoModelo={docNoViewer ? aprovarComoModeloDoViewer : undefined}
        aprovandoModelo={aprovandoModeloViewer}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bloco 4.2 — Processos deferidos: promoção em lote
// ---------------------------------------------------------------------------
function ProcessosDeferidos() {
  const [loading, setLoading] = useState(true);
  const [processos, setProcessos] = useState<ProcessoRow[]>([]);
  const [docsPorProc, setDocsPorProc] = useState<Record<string, DocRow[]>>({});
  const [busca, setBusca] = useState("");
  const [promovendoId, setPromovendoId] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: procData, error: pErr } = await supabase
        .from("qa_processos")
        .select("id, cliente_id, servico_nome, status, updated_at")
        .in("status", STATUS_CONCLUSAO as unknown as string[])
        .order("updated_at", { ascending: false })
        .limit(80);
      if (pErr) throw pErr;
      const procRows = (procData ?? []) as ProcessoRow[];
      if (!procRows.length) {
        setProcessos([]);
        setDocsPorProc({});
        return;
      }
      const procIds = procRows.map((p) => p.id);
      const cliIds = Array.from(new Set(procRows.map((p) => p.cliente_id).filter((v): v is number => v != null)));
      const [docsRes, cliRes] = await Promise.all([
        supabase
          .from("qa_processo_documentos")
          .select(
            "id, cliente_id, processo_id, tipo_documento, nome_documento, status, motivo_rejeicao, arquivo_storage_key, data_envio, updated_at, usado_como_modelo, validacao_ia_confianca, validacao_ia_status, decisao_ia"
          )
          .in("processo_id", procIds)
          .eq("status", "aprovado"),
        cliIds.length
          ? supabase.from("qa_clientes").select("id, nome_completo").in("id", cliIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (docsRes.error) throw docsRes.error;
      const cliMap = new Map<number, string>(
        (cliRes.data ?? []).map((c: any) => [c.id as number, c.nome_completo as string])
      );
      const byProc: Record<string, DocRow[]> = {};
      for (const d of (docsRes.data ?? []) as DocRow[]) {
        if (!d.processo_id) continue;
        (byProc[d.processo_id] ??= []).push(d);
      }
      const enriched: ProcessoRow[] = procRows.map((p) => {
        const arr = byProc[p.id] ?? [];
        return {
          ...p,
          cliente_nome: p.cliente_id ? cliMap.get(p.cliente_id) ?? null : null,
          docs_aprovados: arr.length,
          docs_pendentes_modelo: arr.filter((d) => !d.usado_como_modelo).length,
        };
      });
      setProcessos(enriched);
      setDocsPorProc(byProc);
    } catch (e: any) {
      toast.error("Falha ao carregar processos: " + (e?.message ?? "erro"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return processos;
    return processos.filter((p) =>
      [p.cliente_nome, p.servico_nome].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [processos, busca]);

  const promoverEmLote = async (proc: ProcessoRow) => {
    const candidatos = (docsPorProc[proc.id] ?? []).filter((d) => !d.usado_como_modelo);
    if (!candidatos.length) {
      toast.info("Nenhum documento aprovado pendente de promoção.");
      return;
    }
    setPromovendoId(proc.id);
    let ok = 0;
    let fail = 0;
    for (const d of candidatos) {
      try {
        const { data, error } = await supabase.functions.invoke("qa-modelo-aprovado-criar", {
          body: {
            documento_id: d.id,
            observacoes: `Promovido em lote a partir do processo deferido (${proc.servico_nome ?? "serviço"}).`,
          },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        ok++;
      } catch (e) {
        console.warn("promoção falhou", d.id, e);
        fail++;
      }
    }
    setPromovendoId(null);
    if (ok > 0) toast.success(`${ok} documento(s) promovido(s) a modelo de treino.`);
    if (fail > 0) toast.error(`${fail} falha(s) ao promover.`);
    await carregar();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] font-bold uppercase tracking-wider text-slate-700">
          {loading ? "Carregando…" : `${filtrados.length} processo(s) concluído(s)`}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente ou serviço…"
              className="h-9 w-[260px] rounded-md border border-slate-200 bg-white pl-7 pr-2 text-[12px] uppercase tracking-wide text-slate-700 placeholder:text-slate-400 placeholder:normal-case focus:border-[#7A1F2B] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => void carregar()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>
      </div>

      <p className="mb-3 rounded-md border border-[#7A1F2B]/15 bg-[#7A1F2B]/5 px-3 py-2 text-[11px] text-[#7A1F2B]">
        Ao final de um processo deferido, os documentos aprovados podem virar modelos da IA com um
        clique. Itens já promovidos são automaticamente pulados.
      </p>

      {!loading && filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-[12px] text-slate-500">
          Nenhum processo concluído recente.
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((p) => {
            const docs = docsPorProc[p.id] ?? [];
            const pendentes = p.docs_pendentes_modelo ?? 0;
            const total = p.docs_aprovados ?? 0;
            const expand = expandido === p.id;
            return (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold uppercase tracking-wider text-slate-800">
                      {p.cliente_nome ?? `Cliente #${p.cliente_id ?? "?"}`}
                    </div>
                    <div className="text-[11px] uppercase text-slate-500">
                      {p.servico_nome ?? "—"} · {p.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      {total} aprovados
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        pendentes > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {pendentes} a promover
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandido(expand ? null : p.id)}
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                    >
                      {expand ? "Ocultar" : "Detalhes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void promoverEmLote(p)}
                      disabled={promovendoId === p.id || pendentes === 0}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#7A1F2B] px-2.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#5e1622] disabled:opacity-50"
                    >
                      {promovendoId === p.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <GraduationCap className="h-3 w-3" />
                      )}
                      Promover modelos
                    </button>
                  </div>
                </div>
                {expand && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-3">
                    {docs.length === 0 ? (
                      <div className="text-[11px] text-slate-500">Sem documentos aprovados.</div>
                    ) : (
                      <ul className="grid gap-1.5 sm:grid-cols-2">
                        {docs.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px]"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-semibold uppercase text-slate-700">
                                {d.nome_documento}
                              </div>
                              <div className="truncate text-[10px] text-slate-400">
                                {d.tipo_documento}
                              </div>
                            </div>
                            {d.usado_como_modelo ? (
                              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                <CheckCircle2 className="h-3 w-3" /> Modelo
                              </span>
                            ) : (
                              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                Pendente
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal Shell — leve, sem dependências externas
// ---------------------------------------------------------------------------
function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#7A1F2B]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  Eye,
  Trash2,
  Sparkles,
  CheckCircle2,
  XCircle,
  FileText,
  Plus,
  Search,
  X,
} from "lucide-react";
import DocumentoViewerModal from "@/components/quero-armas/DocumentoViewerModal";

/* =============================================================================
 * QAServicoDocumentosRefs — Modelos de referência por exigência.
 *
 * Camada ADITIVA. Usa SOMENTE:
 *   - tabela qa_document_examples (visual / catálogo)
 *   - tabela qa_processo_documentos (origem para treinamento)
 *   - edge function qa-modelo-aprovado-criar (promove a modelo aprovado)
 *   - tabela qa_documentos_modelos_aprovados (apenas leitura → contador)
 *
 * Bucket: qa-documentos (já usado em outras refs do projeto). Path:
 *   servico-documentos-examples/{servico_id}/{tipo_documento}/{file}
 *
 * Visual: Premium Light (#7A1F2B sobre branco). Linguagem: Equipe Quero Armas.
 * ============================================================================= */

const BUCKET = "qa-documentos";
const REFS_FOLDER = "servico-documentos-examples";

type ExampleRow = {
  id: string;
  tipo_documento: string;
  servico_id: number | null;
  arquivo_url: string;
  descricao: string | null;
  exemplo_valido: boolean;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
};

type ProcessoDocAprovado = {
  id: string;
  tipo_documento: string;
  nome_documento: string | null;
  arquivo_storage_key: string | null;
  processo_id: string | null;
  usado_como_modelo: boolean | null;
};

interface Props {
  servicoId: number;
  tipoDocumento: string;
}

/** Tenta extrair documento_origem_id embutido em observacoes JSON. */
function extractDocOrigem(observacoes: string | null): string | null {
  if (!observacoes) return null;
  try {
    const j = JSON.parse(observacoes);
    return typeof j?.documento_origem_id === "string" ? j.documento_origem_id : null;
  } catch {
    return null;
  }
}

function buildObservacoes(payload: Record<string, any>, extra?: string): string {
  return JSON.stringify({ ...payload, nota: extra ?? null });
}

export default function QAServicoDocumentosRefs({ servicoId, tipoDocumento }: Props) {
  const [examples, setExamples] = useState<ExampleRow[]>([]);
  const [modelosAtivos, setModelosAtivos] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [treinandoId, setTreinandoId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ bucket: string; path: string; fileName?: string } | null>(null);
  const [importerOpen, setImporterOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!servicoId || !tipoDocumento) return;
    setLoading(true);
    const [{ data: ex, error: e1 }, { count }] = await Promise.all([
      supabase
        .from("qa_document_examples" as any)
        .select("*")
        .eq("servico_id", servicoId)
        .eq("tipo_documento", tipoDocumento)
        .order("created_at", { ascending: false }),
      supabase
        .from("qa_documentos_modelos_aprovados" as any)
        .select("*", { count: "exact", head: true })
        .eq("tipo_documento", tipoDocumento)
        .eq("ativo", true),
    ]);
    if (e1) toast.error("FALHA AO CARREGAR MODELOS — " + e1.message.toUpperCase());
    setExamples(((ex ?? []) as unknown) as ExampleRow[]);
    setModelosAtivos(count ?? 0);
    setLoading(false);
  }, [servicoId, tipoDocumento]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadNovo(file: File, exemploValido: boolean) {
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${REFS_FOLDER}/${servicoId}/${tipoDocumento}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (up.error) throw up.error;
      const { error } = await supabase.from("qa_document_examples" as any).insert({
        servico_id: servicoId,
        tipo_documento: tipoDocumento,
        arquivo_url: path,
        exemplo_valido: exemploValido,
        ativo: true,
        descricao: exemploValido ? "MODELO DE REFERÊNCIA" : "EXEMPLO DO QUE NÃO ACEITAR",
      });
      if (error) throw error;
      toast.success("MODELO DE REFERÊNCIA ADICIONADO");
      void load();
    } catch (e: any) {
      toast.error("FALHA NO UPLOAD — " + (e?.message ?? "ERRO").toUpperCase());
    } finally {
      setUploading(false);
    }
  }

  async function patchExample(id: string, patch: Partial<ExampleRow>) {
    setSavingId(id);
    const { error } = await supabase.from("qa_document_examples" as any).update(patch).eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error("FALHA — " + error.message.toUpperCase());
      return;
    }
    setExamples((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function removerExemplo(row: ExampleRow) {
    if (!confirm("REMOVER ESTE MODELO DE REFERÊNCIA?")) return;
    const { error } = await supabase.from("qa_document_examples" as any).delete().eq("id", row.id);
    if (error) {
      toast.error("FALHA — " + error.message.toUpperCase());
      return;
    }
    setExamples((prev) => prev.filter((e) => e.id !== row.id));
    toast.success("MODELO REMOVIDO");
  }

  async function treinarComExemplo(row: ExampleRow) {
    const docId = extractDocOrigem(row.observacoes);
    if (!docId) {
      toast.error(
        "ESTE MODELO NÃO ESTÁ VINCULADO A UM PROCESSO APROVADO — USE 'IMPORTAR DE PROCESSO APROVADO' PARA TREINAR A IA",
      );
      return;
    }
    setTreinandoId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("qa-modelo-aprovado-criar", {
        body: { documento_id: docId, observacoes: row.descricao ?? undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("MODELO TREINADO — IA ATUALIZADA");
      void load();
    } catch (e: any) {
      toast.error("FALHA NO TREINAMENTO — " + (e?.message ?? "ERRO").toUpperCase());
    } finally {
      setTreinandoId(null);
    }
  }

  const counterText = useMemo(() => {
    const refs = examples.filter((e) => e.ativo && e.exemplo_valido).length;
    return `${modelosAtivos} MODELO(S) TREINADO(S) NA IA · ${refs} ARQUIVO(S) DE REFERÊNCIA`;
  }, [examples, modelosAtivos]);

  return (
    <div className="col-span-12 rounded-lg border border-[#7A1F2B]/20 bg-white p-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#7A1F2B]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7A1F2B]">
            MODELOS DE REFERÊNCIA — ALIMENTAM A IA
          </span>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 font-mono">
          {counterText}
        </div>
      </div>

      <p className="text-[11px] text-slate-600 mb-2 leading-snug">
        A IA compara cada envio do cliente contra estes modelos. Quanto mais modelos aprovados,
        mais precisa a aprovação automática. Adicione exemplos <b>válidos</b> (documentos deferidos)
        e exemplos <b>inválidos</b> (do que NÃO aceitar).
      </p>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="h-8 inline-flex items-center gap-1 px-2.5 rounded-md bg-[#7A1F2B] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#5e1820] disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          ENVIAR MODELO VÁLIDO
        </button>
        <button
          type="button"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pdf,.png,.jpg,.jpeg,.webp";
            input.onchange = () => {
              const f = input.files?.[0];
              if (f) void uploadNovo(f, false);
            };
            input.click();
          }}
          disabled={uploading}
          className="h-8 inline-flex items-center gap-1 px-2.5 rounded-md bg-white border border-slate-300 text-slate-700 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 disabled:opacity-50"
        >
          <XCircle className="h-3 w-3 text-rose-500" /> ENVIAR EXEMPLO INVÁLIDO
        </button>
        <button
          type="button"
          onClick={() => setImporterOpen(true)}
          className="h-8 inline-flex items-center gap-1 px-2.5 rounded-md bg-white border border-slate-300 text-slate-700 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50"
        >
          <Plus className="h-3 w-3" /> IMPORTAR DE PROCESSO APROVADO
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadNovo(f, true);
            e.target.value = "";
          }}
        />
      </div>

      {loading ? (
        <div className="py-4 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-[#7A1F2B]" />
        </div>
      ) : examples.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-[11px] uppercase tracking-wider text-slate-500">
          NENHUM MODELO DE REFERÊNCIA AINDA. ENVIE OU IMPORTE PARA COMEÇAR A TREINAR A IA.
        </div>
      ) : (
        <div className="space-y-1.5">
          {examples.map((ex) => {
            const docOrigem = extractDocOrigem(ex.observacoes);
            return (
              <div
                key={ex.id}
                className={`rounded-md border bg-white p-2 grid grid-cols-12 gap-2 items-center ${
                  ex.exemplo_valido ? "border-emerald-200" : "border-rose-200"
                }`}
              >
                <div className="col-span-12 md:col-span-5 flex items-center gap-2 min-w-0">
                  {ex.exemplo_valido ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  )}
                  <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="text-[11px] font-mono truncate text-slate-700" title={ex.arquivo_url}>
                    {ex.arquivo_url.split("/").pop()}
                  </span>
                </div>
                <div className="col-span-12 md:col-span-4">
                  <input
                    defaultValue={ex.descricao ?? ""}
                    onBlur={(e) =>
                      e.target.value !== (ex.descricao ?? "")
                        ? void patchExample(ex.id, { descricao: e.target.value || null })
                        : null
                    }
                    placeholder="DESCRIÇÃO (OPCIONAL)"
                    className="h-8 w-full px-2 rounded border border-slate-200 bg-white text-[11px] uppercase text-slate-800 focus:outline-none focus:border-[#7A1F2B]/40"
                  />
                </div>
                <div className="col-span-12 md:col-span-3 flex items-center justify-end gap-1">
                  <label className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-600">
                    <input
                      type="checkbox"
                      checked={ex.ativo}
                      onChange={(e) => void patchExample(ex.id, { ativo: e.target.checked })}
                      className="accent-[#7A1F2B]"
                    />
                    ATIVO
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setViewer({ bucket: BUCKET, path: ex.arquivo_url, fileName: ex.arquivo_url.split("/").pop() })
                    }
                    className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    title="Ver"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                  {ex.exemplo_valido && (
                    <button
                      type="button"
                      onClick={() => void treinarComExemplo(ex)}
                      disabled={treinandoId === ex.id || !docOrigem}
                      title={
                        docOrigem
                          ? "Treinar IA com este modelo"
                          : "Disponível somente para modelos importados de processos aprovados"
                      }
                      className="h-7 px-2 inline-flex items-center gap-1 rounded bg-[#7A1F2B] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#5e1820] disabled:opacity-40"
                    >
                      {treinandoId === ex.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      TREINAR
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void removerExemplo(ex)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {savingId === ex.id && (
                  <div className="col-span-12 text-[10px] text-slate-400 font-mono">SALVANDO…</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DocumentoViewerModal
        open={!!viewer}
        onClose={() => setViewer(null)}
        source={viewer ? { kind: "storage", bucket: viewer.bucket, path: viewer.path, fileName: viewer.fileName } : null}
        title="MODELO DE REFERÊNCIA"
      />

      {importerOpen && (
        <ImportadorProcessoAprovado
          servicoId={servicoId}
          tipoDocumento={tipoDocumento}
          onClose={() => setImporterOpen(false)}
          onImported={() => {
            setImporterOpen(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ----------------------- Importador de processo aprovado ------------------- */

function ImportadorProcessoAprovado({
  servicoId,
  tipoDocumento,
  onClose,
  onImported,
}: {
  servicoId: number;
  tipoDocumento: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [docs, setDocs] = useState<ProcessoDocAprovado[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [viewer, setViewer] = useState<{ bucket: string; path: string; fileName?: string } | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("qa_processo_documentos")
        .select("id, tipo_documento, nome_documento, arquivo_storage_key, processo_id, usado_como_modelo")
        .eq("tipo_documento", tipoDocumento)
        .eq("status", "aprovado")
        .order("aprovado_em", { ascending: false })
        .limit(50);
      if (error) toast.error("FALHA AO BUSCAR DOCUMENTOS — " + error.message.toUpperCase());
      setDocs(((data ?? []) as unknown) as ProcessoDocAprovado[]);
      setLoading(false);
    })();
  }, [tipoDocumento]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        (d.nome_documento ?? "").toLowerCase().includes(q) ||
        (d.processo_id ?? "").toLowerCase().includes(q),
    );
  }, [docs, busca]);

  async function importar(doc: ProcessoDocAprovado) {
    if (!doc.arquivo_storage_key) {
      toast.error("DOCUMENTO SEM ARQUIVO VINCULADO");
      return;
    }
    setImportingId(doc.id);
    try {
      // 1) cria entrada visual em qa_document_examples vinculada ao doc origem
      const { error: e1 } = await supabase.from("qa_document_examples" as any).insert({
        servico_id: servicoId,
        tipo_documento: tipoDocumento,
        arquivo_url: doc.arquivo_storage_key,
        exemplo_valido: true,
        ativo: true,
        descricao: `MODELO IMPORTADO DE PROCESSO APROVADO`,
        observacoes: buildObservacoes({ documento_origem_id: doc.id, processo_id: doc.processo_id }),
      });
      if (e1) throw e1;

      // 2) treina imediatamente na IA
      const { data, error } = await supabase.functions.invoke("qa-modelo-aprovado-criar", {
        body: { documento_id: doc.id, observacoes: "IMPORTADO VIA CATÁLOGO DE EXIGÊNCIAS" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success("MODELO IMPORTADO E TREINADO");
      onImported();
    } catch (e: any) {
      toast.error("FALHA — " + (e?.message ?? "ERRO").toUpperCase());
    } finally {
      setImportingId(null);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-tight text-slate-900 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#7A1F2B]" />
              IMPORTAR MODELO DE UM PROCESSO APROVADO — {tipoDocumento.toUpperCase()}
            </div>
            <button
              onClick={onClose}
              className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-3">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="BUSCAR POR NOME OU ID DE PROCESSO"
                className="h-9 w-full pl-8 pr-2 rounded-md border border-slate-200 bg-white text-xs uppercase text-slate-800 focus:outline-none focus:border-[#7A1F2B]/40"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loading ? (
              <div className="py-8 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-[#7A1F2B]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-[11px] uppercase tracking-wider text-slate-500">
                NENHUM DOCUMENTO APROVADO ENCONTRADO PARA O TIPO "{tipoDocumento}".
              </div>
            ) : (
              <div className="space-y-1.5">
                {filtered.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-md border border-slate-200 bg-white p-2 flex items-center gap-2"
                  >
                    <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-slate-900 truncate uppercase">
                        {d.nome_documento ?? "DOCUMENTO"}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">
                        PROC {d.processo_id?.slice(0, 8)}… · {d.usado_como_modelo ? "JÁ É MODELO" : "DEFERIDO"}
                      </div>
                    </div>
                    {d.arquivo_storage_key && (
                      <button
                        type="button"
                        onClick={() =>
                          setViewer({
                            bucket: "qa-processo-docs",
                            path: d.arquivo_storage_key!,
                            fileName: d.nome_documento ?? undefined,
                          })
                        }
                        className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        title="Ver"
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void importar(d)}
                      disabled={importingId === d.id}
                      className="h-7 px-2.5 inline-flex items-center gap-1 rounded bg-[#7A1F2B] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#5e1820] disabled:opacity-40"
                    >
                      {importingId === d.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      IMPORTAR E TREINAR
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DocumentoViewerModal
        open={!!viewer}
        onClose={() => setViewer(null)}
        source={viewer ? { kind: "storage", bucket: viewer.bucket, path: viewer.path, fileName: viewer.fileName } : null}
        title="DOCUMENTO APROVADO"
      />
    </>
  );
}
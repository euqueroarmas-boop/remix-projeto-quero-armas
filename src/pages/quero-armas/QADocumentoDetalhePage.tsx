import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, FileText, CheckCircle, Clock, AlertCircle, Loader2, RefreshCw, Database, Hash, Star } from "lucide-react";

export default function QADocumentoDetalhePage() {
  const { id } = useParams();
  const [doc, setDoc] = useState<any>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const [embedCount, setEmbedCount] = useState(0);
  const [refCount, setRefCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [docRes, chunksRes, embedRes, refRes] = await Promise.all([
      supabase.from("qa_documentos_conhecimento" as any).select("*").eq("id", id).single(),
      supabase.from("qa_chunks_conhecimento" as any).select("id, ordem_chunk, texto_chunk, resumo_chunk, embedding_status").eq("documento_id", id).order("ordem_chunk"),
      supabase.from("qa_embeddings" as any).select("id, chunk_id", { count: "exact", head: false })
        .in("chunk_id", []),  // will be replaced
      supabase.from("qa_referencias_preferenciais" as any).select("id", { count: "exact", head: true }).eq("origem_id", id).eq("ativo", true),
    ]);
    setDoc(docRes.data);
    setChunks(chunksRes.data ?? []);
    setRefCount(refRes.count ?? 0);

    // Get embed count from chunks
    if (chunksRes.data?.length) {
      const chunkIds = chunksRes.data.map((c: any) => c.id);
      const { count } = await supabase.from("qa_embeddings" as any).select("id", { count: "exact", head: true }).in("chunk_id", chunkIds);
      setEmbedCount(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const reprocess = async () => {
    if (!doc) return;
    setReprocessing(true);
    try {
      const { error } = await supabase.functions.invoke("qa-ingest-document", {
        body: { storage_path: doc.storage_path, user_id: doc.enviado_por },
      });
      if (error) throw error;
      toast.success("Reprocessamento iniciado");
      setTimeout(load, 3000);
    } catch (err: any) {
      toast.error(err.message || "Erro ao reprocessar");
    } finally {
      setReprocessing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>;
  if (!doc) return <div className="text-center py-12 text-slate-500">Documento não encontrado</div>;

  const statusIcon = (s: string) => {
    if (s === "concluido") return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    if (s === "processando") return <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />;
    if (s === "erro") return <AlertCircle className="h-4 w-4 text-red-400" />;
    return <Clock className="h-4 w-4 text-slate-500" />;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to="/quero-armas/base-conhecimento">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-200"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" /> {doc.titulo}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">{doc.tipo_documento?.replace(/_/g, " ")}</span>
              {doc.categoria && <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">{doc.categoria}</span>}
              <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
              {doc.tamanho_bytes && <span>{(doc.tamanho_bytes / 1024).toFixed(0)} KB</span>}
              <span>{doc.mime_type}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={reprocess} disabled={reprocessing} className="border-slate-700 text-slate-300 shrink-0">
            {reprocessing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Reprocessar
          </Button>
        </div>

        {/* Status badges */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <div className="bg-[#0c0c14] rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1.5">{statusIcon(doc.status_processamento)}<span className="text-xs text-slate-300 capitalize">{doc.status_processamento}</span></div>
            <div className="text-[10px] text-slate-600 mt-0.5">Processamento</div>
          </div>
          <div className="bg-[#0c0c14] rounded-lg p-3 text-center">
            <div className={`text-xs font-medium ${doc.status_validacao === "validado" ? "text-emerald-400" : "text-slate-500"}`}>{doc.status_validacao?.replace(/_/g, " ") || "—"}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">Validação</div>
          </div>
          <div className="bg-[#0c0c14] rounded-lg p-3 text-center">
            <div className="text-xs font-medium text-slate-300">{chunks.length}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">Chunks</div>
          </div>
          <div className="bg-[#0c0c14] rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1"><Database className="h-3 w-3 text-purple-400" /><span className="text-xs font-medium text-slate-300">{embedCount}</span></div>
            <div className="text-[10px] text-slate-600 mt-0.5">Embeddings</div>
          </div>
          <div className="bg-[#0c0c14] rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1"><Star className="h-3 w-3 text-amber-400" /><span className="text-xs font-medium text-slate-300">{refCount}</span></div>
            <div className="text-[10px] text-slate-600 mt-0.5">Referências</div>
          </div>
        </div>
      </div>

      {/* Hash */}
      {doc.hash_arquivo && (
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-[#12121c] border border-slate-800/40 rounded-lg px-4 py-2">
          <Hash className="h-3.5 w-3.5" /> SHA-256: <code className="text-slate-500 font-mono">{doc.hash_arquivo}</code>
        </div>
      )}

      {/* Summary */}
      {doc.resumo_extraido && (
        <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-2">Resumo Extraído</h2>
          <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{doc.resumo_extraido}</p>
        </div>
      )}

      {/* Extracted text */}
      {doc.texto_extraido && (
        <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-2">Texto Extraído</h2>
          <div className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono bg-[#0c0c14] rounded-lg p-4">
            {doc.texto_extraido}
          </div>
        </div>
      )}

      {/* Chunks */}
      {chunks.length > 0 && (
        <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-3">Chunks ({chunks.length})</h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {chunks.map((c: any, i: number) => (
              <div key={c.id} className="bg-[#0c0c14] rounded-lg p-3 border border-slate-800/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider">Chunk {c.ordem_chunk + 1}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.embedding_status === "concluido" ? "bg-emerald-500/10 text-emerald-400" : c.embedding_status === "erro" ? "bg-red-500/10 text-red-400" : "bg-slate-800 text-slate-500"}`}>
                    {c.embedding_status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-3 font-mono">{c.texto_chunk}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {doc.metadados_json && Object.keys(doc.metadados_json).length > 0 && (
        <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-2">Metadados</h2>
          <pre className="text-xs text-slate-500 font-mono bg-[#0c0c14] rounded-lg p-3 overflow-x-auto">
            {JSON.stringify(doc.metadados_json, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

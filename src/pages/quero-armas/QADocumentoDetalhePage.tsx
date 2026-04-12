import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, FileText, CheckCircle, Clock, AlertCircle, Loader2, RefreshCw,
  Database, Hash, Star, Trash2, Power, ShieldCheck, ShieldX, Zap, ZapOff,
  StarOff, Globe, Upload, Link2,
} from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

/* ─── Governance Status Badge ─── */
function GovBadge({ label, value, variant }: { label: string; value: string; variant: "ok" | "warn" | "off" | "neutral" }) {
  const colors = {
    ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    off: "bg-red-500/10 text-red-400 border-red-500/20",
    neutral: "bg-slate-800 text-slate-400 border-slate-700/40",
  };
  return (
    <div className={`rounded-lg p-3 text-center border ${colors[variant]}`}>
      <div className="text-xs font-medium">{value}</div>
      <div className="text-[10px] text-slate-600 mt-0.5">{label}</div>
    </div>
  );
}

export default function QADocumentoDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useQAAuth();
  const [doc, setDoc] = useState<any>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const [embedCount, setEmbedCount] = useState(0);
  const [refCount, setRefCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [acting, setActing] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [docRes, chunksRes, , refRes] = await Promise.all([
      supabase.from("qa_documentos_conhecimento" as any).select("*").eq("id", id).single(),
      supabase.from("qa_chunks_conhecimento" as any).select("id, ordem_chunk, texto_chunk, resumo_chunk, embedding_status").eq("documento_id", id).order("ordem_chunk"),
      Promise.resolve(null),
      supabase.from("qa_referencias_preferenciais" as any).select("id", { count: "exact", head: true }).eq("origem_id", id).eq("ativo", true),
    ]);
    setDoc(docRes.data);
    setChunks(chunksRes.data ?? []);
    setRefCount(refRes.count ?? 0);
    if (chunksRes.data?.length) {
      const chunkIds = chunksRes.data.map((c: any) => c.id);
      const { count } = await supabase.from("qa_embeddings" as any).select("id", { count: "exact", head: true }).in("chunk_id", chunkIds);
      setEmbedCount(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  /* ─── Governance Actions ─── */
  const auditLog = async (acao: string, detalhes: Record<string, any>) => {
    if (!user || !doc) return;
    await supabase.from("qa_logs_auditoria" as any).insert({
      usuario_id: user.id, acao, entidade_tipo: "documento", entidade_id: doc.id,
      detalhes: { titulo: doc.titulo, tipo: doc.tipo_documento, ...detalhes },
    });
  };

  const updateDoc = async (fields: Record<string, any>) => {
    await supabase.from("qa_documentos_conhecimento" as any)
      .update({ ...fields, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
  };

  const handleAction = async (action: string) => {
    if (!doc || !user) return;
    setActing(true);
    try {
      switch (action) {
        case "validar":
          await updateDoc({ status_validacao: "validado" });
          await auditLog("documento_validado", {});
          toast.success("Documento validado. Agora será utilizado pela IA.");
          break;
        case "rejeitar":
          await updateDoc({ status_validacao: "rejeitado", ativo_na_ia: false });
          await auditLog("documento_rejeitado", {});
          toast.success("Documento rejeitado. Não será utilizado pela IA.");
          break;
        case "desativar_ia":
          await updateDoc({ ativo_na_ia: false });
          await auditLog("documento_desativado_ia", {});
          toast.success("Documento desativado da IA.");
          break;
        case "ativar_ia":
          await updateDoc({ ativo_na_ia: true });
          await auditLog("documento_ativado_ia", {});
          toast.success("Documento reativado na IA.");
          break;
        case "promover_referencia":
          await updateDoc({ referencia_preferencial: true });
          // Also create/reactivate in qa_referencias_preferenciais if needed
          const { data: existingRef } = await (supabase.from("qa_referencias_preferenciais" as any)
            .select("id").eq("origem_id", doc.id).maybeSingle() as any);
          if (existingRef) {
            await supabase.from("qa_referencias_preferenciais" as any)
              .update({ ativo: true } as any).eq("id", existingRef.id);
          } else {
            await supabase.from("qa_referencias_preferenciais" as any).insert({
              origem_tipo: "documento", origem_id: doc.id,
              criado_por: user.id, peso: 1.0, ativo: true,
            });
          }
          await auditLog("documento_promovido_referencia", {});
          toast.success("Documento promovido como referência preferencial.");
          break;
        case "remover_referencia":
          await updateDoc({ referencia_preferencial: false });
          await supabase.from("qa_referencias_preferenciais" as any)
            .update({ ativo: false } as any).eq("origem_id", doc.id);
          await auditLog("documento_removido_referencia", {});
          toast.success("Documento removido das referências.");
          break;
      }
      await load();
    } catch (err: any) {
      toast.error(err.message || "Erro ao executar ação");
    } finally {
      setActing(false);
    }
  };

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

  const handleDeactivate = async () => {
    if (!doc || !user) return;
    setDeleting(true);
    try {
      await updateDoc({ ativo: false, ativo_na_ia: false });
      await auditLog("documento_desativado", {});
      toast.success("Documento desativado da IA.");
      navigate("/quero-armas/base-conhecimento");
    } catch (err: any) {
      toast.error(err.message || "Erro ao desativar");
    } finally {
      setDeleting(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!doc || !user) return;
    setDeleting(true);
    try {
      const { data: chunkRows } = await supabase.from("qa_chunks_conhecimento" as any).select("id").eq("documento_id", doc.id);
      if (chunkRows?.length) {
        await supabase.from("qa_embeddings" as any).delete().in("chunk_id", chunkRows.map((c: any) => c.id));
      }
      await supabase.from("qa_chunks_conhecimento" as any).delete().eq("documento_id", doc.id);
      await supabase.from("qa_referencias_preferenciais" as any).delete().eq("origem_id", doc.id);
      if (doc.storage_path) await supabase.storage.from("qa-documentos").remove([doc.storage_path]);
      await auditLog("documento_excluido_permanente", { storage_path: doc.storage_path });
      await supabase.from("qa_documentos_conhecimento" as any).delete().eq("id", doc.id);
      toast.success("Documento excluído permanentemente.");
      navigate("/quero-armas/base-conhecimento");
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    } finally {
      setDeleting(false);
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

  const isValidado = doc.status_validacao === "validado";
  const isRejeitado = doc.status_validacao === "rejeitado";
  const isAtivoIA = doc.ativo_na_ia === true;
  const isRef = doc.referencia_preferencial === true;
  const isConcluido = doc.status_processamento === "concluido";
  const isAuxiliar = doc.papel_documento === "auxiliar_caso";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to="/quero-armas/base-conhecimento">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-200"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" /> {doc.titulo}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">{doc.tipo_documento?.replace(/_/g, " ")}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${isAuxiliar ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"}`}>
                {isAuxiliar ? "Auxiliar do Caso" : "Aprendizado"}
              </span>
              {isAuxiliar && doc.caso_id && (
                <span className="px-2 py-0.5 rounded bg-cyan-500/5 text-cyan-400/70 text-[10px]">caso: {doc.caso_id}</span>
              )}
              {doc.categoria && <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">{doc.categoria}</span>}
              <span className="flex items-center gap-1">
                {doc.tipo_origem === "link_publico" ? <Globe className="h-3 w-3 text-blue-400" /> : <Upload className="h-3 w-3 text-slate-500" />}
                {doc.tipo_origem === "link_publico" ? "Link público" : doc.tipo_origem === "cadastro_manual" ? "Manual" : "Upload"}
              </span>
              <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
              {doc.tamanho_bytes && <span>{(doc.tamanho_bytes / 1024).toFixed(0)} KB</span>}
              <span>{doc.mime_type}</span>
              {doc.metodo_extracao && <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">parser: {doc.metodo_extracao}</span>}
            </div>
            {doc.url_origem && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Link2 className="h-3 w-3 text-blue-400 shrink-0" />
                <a href={doc.url_origem} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400/80 hover:text-blue-300 truncate">
                  {doc.url_origem}
                </a>
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={reprocess} disabled={reprocessing} className="border-slate-700 text-slate-300">
              {reprocessing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Reprocessar
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)} className="gap-1">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
        </div>

        {/* Governance Status Badges */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <GovBadge
            label="Papel"
            value={isAuxiliar ? "Auxiliar do Caso" : "Aprendizado"}
            variant={isAuxiliar ? "neutral" : "ok"}
          />
          <GovBadge
            label="Processamento"
            value={doc.status_processamento === "concluido" ? "Concluído" : doc.status_processamento === "processando" ? "Processando" : doc.status_processamento === "erro" || doc.status_processamento === "texto_invalido" ? "Falhou" : "Pendente"}
            variant={isConcluido ? "ok" : doc.status_processamento === "erro" || doc.status_processamento === "texto_invalido" ? "off" : "neutral"}
          />
          <GovBadge
            label="Validação"
            value={isAuxiliar ? "N/A" : isValidado ? "Validado" : isRejeitado ? "Rejeitado" : "Pendente"}
            variant={isAuxiliar ? "neutral" : isValidado ? "ok" : isRejeitado ? "off" : "warn"}
          />
          <GovBadge
            label="Uso na IA Global"
            value={isAuxiliar ? "Somente caso" : isAtivoIA ? "Ativo" : "Desativado"}
            variant={isAuxiliar ? "neutral" : isAtivoIA ? "ok" : "off"}
          />
          <GovBadge
            label="Referência"
            value={isAuxiliar ? "Bloqueado" : isRef ? "Sim" : "Não"}
            variant={isAuxiliar ? "off" : isRef ? "ok" : "neutral"}
          />
        </div>

        {isAuxiliar && (
          <div className="mt-3 bg-cyan-500/5 border border-cyan-500/15 rounded-lg px-4 py-3 text-xs text-cyan-400/80 space-y-2">
            <div>
              <strong>Documento auxiliar do caso.</strong> Este documento é utilizado apenas como suporte factual do caso concreto. Não alimenta o aprendizado global da IA, não aparece no ranking de referências e não serve como modelo de peça.
            </div>
            {doc.caso_id && <div className="text-cyan-400/60">Vinculado ao caso: <strong>{doc.caso_id}</strong></div>}
            {/* Extraction integrity stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-2 text-center">
                <div className="text-xs font-medium text-cyan-300">
                  {doc.texto_extraido ? `${(doc.texto_extraido.length).toLocaleString("pt-BR")}` : "—"}
                </div>
                <div className="text-[10px] text-cyan-400/50 mt-0.5">Caracteres extraídos</div>
              </div>
              <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-2 text-center">
                <div className="text-xs font-medium text-cyan-300">
                  {doc.texto_extraido ? (doc.texto_extraido ? "✓ Sim" : "✗ Não") : "—"}
                </div>
                <div className="text-[10px] text-cyan-400/50 mt-0.5">Texto integral extraído</div>
              </div>
              <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-2 text-center">
                <div className="text-xs font-medium text-cyan-300">{chunks.length}</div>
                <div className="text-[10px] text-cyan-400/50 mt-0.5">Blocos analisáveis</div>
              </div>
              <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-2 text-center">
                <div className="text-xs font-medium text-cyan-300">✓ Integral</div>
                <div className="text-[10px] text-cyan-400/50 mt-0.5">Uso na geração</div>
              </div>
            </div>
            <div className="text-[10px] text-cyan-400/40 mt-1">
              Sem limite artificial de caracteres. O documento é considerado integralmente na formulação da peça, com processamento por múltiplos blocos se necessário.
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className={`grid ${isAuxiliar ? "grid-cols-2" : "grid-cols-3"} gap-3 mt-3`}>
          <div className="bg-[#0c0c14] rounded-lg p-3 text-center">
            <div className="text-xs font-medium text-slate-300">{chunks.length}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">Chunks</div>
          </div>
          <div className="bg-[#0c0c14] rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1"><Database className="h-3 w-3 text-purple-400" /><span className="text-xs font-medium text-slate-300">{embedCount}</span></div>
            <div className="text-[10px] text-slate-600 mt-0.5">Embeddings</div>
          </div>
          {!isAuxiliar && (
            <div className="bg-[#0c0c14] rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1"><Star className="h-3 w-3 text-amber-400" /><span className="text-xs font-medium text-slate-300">{refCount}</span></div>
              <div className="text-[10px] text-slate-600 mt-0.5">Referências</div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Governance Actions ─── */}
      <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
        <h2 className="text-sm font-medium text-slate-300 mb-3">Ações de Governança</h2>
        {isAuxiliar ? (
          <p className="text-xs text-slate-500">Documentos auxiliares do caso não possuem ações de governança de aprendizado. São utilizados apenas como suporte factual.</p>
        ) : (
        <div className="flex flex-wrap gap-2">
          {!isValidado && isConcluido && (
            <Button size="sm" disabled={acting} onClick={() => handleAction("validar")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Validar documento
            </Button>
          )}
          {!isRejeitado && isConcluido && (
            <Button size="sm" variant="outline" disabled={acting} onClick={() => handleAction("rejeitar")}
              className="border-red-600/40 text-red-400 hover:bg-red-500/10 gap-1.5">
              <ShieldX className="h-3.5 w-3.5" /> Rejeitar documento
            </Button>
          )}
          {isAtivoIA ? (
            <Button size="sm" variant="outline" disabled={acting} onClick={() => handleAction("desativar_ia")}
              className="border-amber-600/40 text-amber-400 hover:bg-amber-500/10 gap-1.5">
              <ZapOff className="h-3.5 w-3.5" /> Desativar da IA
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={acting} onClick={() => handleAction("ativar_ia")}
              className="border-emerald-600/40 text-emerald-400 hover:bg-emerald-500/10 gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Ativar na IA
            </Button>
          )}
          {isValidado && !isRef && (
            <Button size="sm" variant="outline" disabled={acting} onClick={() => handleAction("promover_referencia")}
              className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 gap-1.5">
              <Star className="h-3.5 w-3.5" /> Promover como referência
            </Button>
          )}
          {isRef && (
            <Button size="sm" variant="outline" disabled={acting} onClick={() => handleAction("remover_referencia")}
              className="border-slate-600 text-slate-400 hover:bg-slate-700/40 gap-1.5">
              <StarOff className="h-3.5 w-3.5" /> Remover da referência
            </Button>
          )}
          {acting && <Loader2 className="h-4 w-4 animate-spin text-amber-400 ml-2 self-center" />}
        </div>
        )}
      </div>

      {doc.hash_arquivo && (
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-[#12121c] border border-slate-800/40 rounded-lg px-4 py-2">
          <Hash className="h-3.5 w-3.5" /> SHA-256: <code className="text-slate-500 font-mono">{doc.hash_arquivo}</code>
        </div>
      )}

      {doc.resumo_extraido && (
        <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-2">Resumo Extraído</h2>
          <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{doc.resumo_extraido}</p>
        </div>
      )}

      {doc.texto_extraido && (
        <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-2">Texto Extraído</h2>
          <div className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono bg-[#0c0c14] rounded-lg p-4">
            {doc.texto_extraido}
          </div>
        </div>
      )}

      {chunks.length > 0 && (
        <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-3">Chunks ({chunks.length})</h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {chunks.map((c: any) => (
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

      {doc.metadados_json && Object.keys(doc.metadados_json).length > 0 && (
        <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-2">Metadados</h2>
          <pre className="text-xs text-slate-500 font-mono bg-[#0c0c14] rounded-lg p-3 overflow-x-auto">
            {JSON.stringify(doc.metadados_json, null, 2)}
          </pre>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#12121c] border-slate-700 text-slate-100 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Excluir documento</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              <strong className="text-slate-200 block mb-1">{doc.titulo}</strong>
              Tem certeza que deseja remover este documento da base de conhecimento? A IA não utilizará mais esse conteúdo em consultas futuras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <Button variant="outline" disabled={deleting} onClick={handleDeactivate}
              className="w-full border-amber-600/40 text-amber-400 hover:bg-amber-500/10 justify-start gap-2">
              <Power className="h-4 w-4" /> Desativar da IA
              <span className="text-[10px] text-slate-500 ml-auto">reversível</span>
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handlePermanentDelete}
              className="w-full justify-start gap-2">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Excluir permanentemente
              <span className="text-[10px] text-red-300/60 ml-auto">irreversível</span>
            </Button>
            <AlertDialogCancel className="w-full border-slate-700 text-slate-400">Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

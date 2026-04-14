import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Upload, Search, FileText, CheckCircle, Clock, AlertCircle, Loader2,
  ExternalLink, RefreshCw, Trash2, Power, Star, Zap, ShieldCheck,
  Link2, Globe, Plus, X, ArrowRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";
import { Link } from "react-router-dom";
import { formatDuration } from "@/lib/formatDuration";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const TIPOS_DOC = [
  { value: "defesa_posse_arma", label: "Defesa para Posse de Arma" },
  { value: "defesa_porte_arma", label: "Defesa para Porte de Arma" },
  { value: "recurso_administrativo", label: "Recurso Administrativo" },
  { value: "resposta_a_notificacao", label: "Resposta à Notificação" },
  { value: "lei", label: "Lei" },
  { value: "decreto", label: "Decreto" },
  { value: "instrucao_normativa", label: "Instrução Normativa" },
  { value: "portaria", label: "Portaria" },
  { value: "jurisprudencia", label: "Jurisprudência" },
  { value: "decisao_favoravel", label: "Decisão Favorável" },
  { value: "decisao_desfavoravel", label: "Decisão Desfavorável" },
  { value: "modelo_interno", label: "Modelo Interno" },
  { value: "outro", label: "Outro" },
];

const TIPOS_AUXILIAR = [
  { value: "boletim_ocorrencia", label: "Boletim de Ocorrência" },
  { value: "laudo_medico", label: "Laudo Médico" },
  { value: "laudo_psicologico", label: "Laudo Psicológico/Psiquiátrico" },
  { value: "notificacao_recebida", label: "Notificação Recebida" },
  { value: "indeferimento", label: "Indeferimento" },
  { value: "comprovante", label: "Comprovante" },
  { value: "certidao", label: "Certidão" },
  { value: "documento_pessoal", label: "Documento Pessoal" },
  { value: "declaracao", label: "Declaração" },
  { value: "relatorio", label: "Relatório" },
  { value: "exame", label: "Exame" },
  { value: "anexo_cliente", label: "Anexo do Cliente" },
  { value: "outro_auxiliar", label: "Outro (auxiliar)" },
];

const TIPOS_ORIGEM_FILTER = [
  { value: "todos", label: "Todas origens" },
  { value: "arquivo_upload", label: "Upload" },
  { value: "link_publico", label: "Link público" },
  { value: "cadastro_manual", label: "Manual" },
];

const PAPEIS_DOC_FILTER = [
  { value: "todos", label: "Todos os papéis" },
  { value: "aprendizado", label: "Aprendizado / Modelo" },
  { value: "auxiliar_caso", label: "Auxiliar do Caso" },
];

/* ─── Import stage definitions ─── */
const IMPORT_STAGES = [
  { key: "pendente", label: "Iniciando importação", pct: 5 },
  { key: "acessando_url", label: "Acessando URL", pct: 15 },
  { key: "extraindo_texto", label: "Extraindo texto", pct: 35 },
  { key: "gerando_resumo", label: "Gerando resumo com IA", pct: 55 },
  { key: "criando_chunks", label: "Criando chunks", pct: 70 },
  { key: "gerando_embeddings", label: "Gerando embeddings", pct: 85 },
  { key: "concluido", label: "Concluído", pct: 100 },
  { key: "erro", label: "Falhou", pct: 0 },
  { key: "texto_invalido", label: "Texto inválido", pct: 0 },
];

function getStageInfo(status: string) {
  return IMPORT_STAGES.find(s => s.key === status) || IMPORT_STAGES[0];
}

const TERMINAL = ["concluido", "erro", "texto_invalido"];

/* ─── Tracked import type ─── */
type TrackedImport = {
  doc_id: string;
  url: string;
  titulo: string;
  status: string;
  resumo?: string;
  started_at: number;
  finished_at?: number;
  tipo_documento?: string;
  tipo_origem?: string;
};

/* ─── Dashboard stat card ─── */
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}><Icon className="h-4 w-4" /></div>
      <div>
        <div className="text-lg font-bold text-slate-700">{value}</div>
        <div className="text-[11px] text-slate-500">{label}</div>
      </div>
    </div>
  );
}

/* ─── Activity bar item ─── */
function ActivityItem({ item, onDismiss, onReprocess }: { item: TrackedImport; onDismiss: () => void; onReprocess: () => void }) {
  const stage = getStageInfo(item.status);
  const isFailed = item.status === "erro" || item.status === "texto_invalido";
  const isDone = item.status === "concluido";
  const isActive = !TERMINAL.includes(item.status);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(() => setElapsed(Date.now() - item.started_at), 1000);
    return () => clearInterval(iv);
  }, [isActive, item.started_at]);

  const duration = isActive ? elapsed : (item.finished_at ? item.finished_at - item.started_at : 0);
  const tipoLabel = TIPOS_DOC.find(t => t.value === item.tipo_documento)?.label
    || TIPOS_AUXILIAR.find(t => t.value === item.tipo_documento)?.label
    || item.tipo_documento;
  const origemLabel = item.tipo_origem === "link_publico" ? "Link público" : item.tipo_origem === "arquivo_upload" ? "Upload" : "Manual";

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all ${
      isFailed ? "bg-red-500/5 border-red-500/20" :
      isDone ? "bg-emerald-500/5 border-emerald-500/20" :
      "bg-blue-500/5 border-blue-500/20"
    }`}>
      <div className="shrink-0">
        {isActive && <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />}
        {isDone && <CheckCircle className="h-4 w-4 text-emerald-400" />}
        {isFailed && <AlertCircle className="h-4 w-4 text-red-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-700 truncate">{item.titulo || item.url}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
            isFailed ? "bg-red-500/10 text-red-400" :
            isDone ? "bg-emerald-500/10 text-emerald-400" :
            "bg-blue-500/10 text-blue-400"
          }`}>{stage.label}</span>
          {duration > 0 && (
            <span className="text-[10px] text-slate-500 tabular-nums">{formatDuration(duration)}</span>
          )}
        </div>
        {/* Meta info on success */}
        {isDone && (tipoLabel || origemLabel) && (
          <div className="flex items-center gap-2 mt-0.5">
            {tipoLabel && <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{tipoLabel}</span>}
            <span className="text-[10px] text-slate-400">{origemLabel}</span>
          </div>
        )}
        {isActive && (
          <div className="mt-1.5">
            <Progress value={stage.pct} className="h-1.5 bg-slate-100" />
          </div>
        )}
        {isFailed && item.resumo && (
          <p className="text-[10px] text-red-400/70 mt-0.5 truncate">{item.resumo}</p>
        )}
      </div>
      {isDone && (
        <Link to={`/quero-armas/base-conhecimento/${item.doc_id}`} className="shrink-0">
          <Button size="sm" variant="ghost" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-7 px-2 text-[10px] gap-1">
            Abrir <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      )}
      {isFailed && (
        <Button size="sm" variant="ghost" onClick={onReprocess} className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-7 px-2 text-[10px] gap-1 shrink-0">
          <RefreshCw className="h-3 w-3" /> Reprocessar
        </Button>
      )}
      {TERMINAL.includes(item.status) && (
        <button onClick={onDismiss} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default function QABaseConhecimentoPage() {
  const { user } = useQAAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todos");
  const [busca, setBusca] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // Link import
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitulo, setLinkTitulo] = useState("");
  const [linkTipo, setLinkTipo] = useState("outro");
  const [linkPapel, setLinkPapel] = useState<"aprendizado" | "auxiliar_caso">("aprendizado");
  const [linkCasoId, setLinkCasoId] = useState("");
  const [importingLink, setImportingLink] = useState(false);
  const [filtroPapel, setFiltroPapel] = useState("todos");

  // Bulk import
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkLinks, setBulkLinks] = useState("");
  const [bulkTipo, setBulkTipo] = useState("outro");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // Tracked imports (activity queue)
  const [trackedImports, setTrackedImports] = useState<TrackedImport[]>([]);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDocs = useCallback(async () => {
    let q = supabase.from("qa_documentos_conhecimento" as any).select("*").eq("ativo", true).eq("papel_documento", "aprendizado").order("created_at", { ascending: false });
    if (filtroTipo !== "todos") q = q.eq("tipo_documento", filtroTipo);
    if (filtroStatus !== "todos") q = q.eq("status_processamento", filtroStatus);
    if (filtroOrigem !== "todos") q = q.eq("tipo_origem", filtroOrigem);
    if (busca) q = q.ilike("titulo", `%${busca}%`);
    const { data } = await q;
    setDocs((data as any[]) ?? []);
    setLoading(false);
  }, [filtroTipo, filtroStatus, filtroOrigem, busca]);

  useEffect(() => { setLoading(true); loadDocs(); }, [loadDocs]);

  // Poll tracked imports for status updates
  useEffect(() => {
    const activeImports = trackedImports.filter(t => !TERMINAL.includes(t.status));
    if (activeImports.length === 0) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const ids = activeImports.map(t => t.doc_id);
      const { data } = await supabase.from("qa_documentos_conhecimento" as any)
        .select("id, status_processamento, resumo_extraido, tipo_documento, tipo_origem").in("id", ids);
      if (!data) return;
      let anyCompleted = false;
      setTrackedImports(prev => prev.map(t => {
        const updated = (data as any[]).find((d: any) => d.id === t.doc_id);
        if (!updated) return t;
        const nowTerminal = TERMINAL.includes(updated.status_processamento) && !TERMINAL.includes(t.status);
        if (nowTerminal) anyCompleted = true;
        return {
          ...t,
          status: updated.status_processamento,
          resumo: updated.resumo_extraido || t.resumo,
          tipo_documento: updated.tipo_documento || t.tipo_documento,
          tipo_origem: updated.tipo_origem || t.tipo_origem,
          finished_at: nowTerminal ? Date.now() : t.finished_at,
        };
      }));
      if (anyCompleted) loadDocs();
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [trackedImports, loadDocs]);

  // Also auto-poll docs that are processing (legacy behavior)
  useEffect(() => {
    const hasProcessing = docs.some(d => d.status_processamento === "pendente" || d.status_processamento === "processando"
      || d.status_processamento === "acessando_url" || d.status_processamento === "extraindo_texto"
      || d.status_processamento === "gerando_resumo" || d.status_processamento === "criando_chunks"
      || d.status_processamento === "gerando_embeddings");
    if (!hasProcessing) return;
    const interval = setInterval(() => { loadDocs(); }, 5000);
    return () => clearInterval(interval);
  }, [docs, loadDocs]);

  const addTrackedImport = (doc_id: string, url: string, titulo: string, tipo_documento?: string, tipo_origem?: string) => {
    setTrackedImports(prev => [{ doc_id, url, titulo, status: "pendente", started_at: Date.now(), tipo_documento, tipo_origem }, ...prev]);
  };

  const dismissTracked = (doc_id: string) => {
    setTrackedImports(prev => prev.filter(t => t.doc_id !== doc_id));
  };

  // Auto-dismiss completed items after 2 minutes
  useEffect(() => {
    const completed = trackedImports.filter(t => t.status === "concluido" && t.finished_at);
    if (!completed.length) return;
    const timers = completed.map(t => {
      const remaining = Math.max(0, 120_000 - (Date.now() - (t.finished_at || Date.now())));
      return setTimeout(() => dismissTracked(t.doc_id), remaining);
    });
    return () => timers.forEach(clearTimeout);
  }, [trackedImports]);

  const handleReprocessFromQueue = async (item: TrackedImport) => {
    if (!user) return;
    try {
      await supabase.from("qa_documentos_conhecimento" as any)
        .update({ status_processamento: "pendente", resumo_extraido: null, updated_at: new Date().toISOString() })
        .eq("id", item.doc_id);
      await supabase.from("qa_chunks_conhecimento" as any).delete().eq("documento_id", item.doc_id);
      setTrackedImports(prev => prev.map(t => t.doc_id === item.doc_id ? { ...t, status: "pendente", started_at: Date.now(), finished_at: undefined, resumo: undefined } : t));
      if (item.tipo_origem === "link_publico" || item.url.startsWith("http")) {
        await supabase.functions.invoke("qa-ingest-url", {
          body: { url: item.url, titulo: item.titulo, tipo_documento: item.tipo_documento, user_id: user.id },
        });
      } else {
        await supabase.functions.invoke("qa-ingest-document", { body: { storage_path: item.url, user_id: user.id } });
      }
      toast.success("Reprocessamento iniciado.");
    } catch (err: any) {
      toast.error("Erro ao reprocessar: " + (err.message || ""));
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("qa-documentos").upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: insertData, error: insertErr } = await supabase.from("qa_documentos_conhecimento" as any).insert({
          titulo: file.name.replace(/\.[^.]+$/, ""),
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
          enviado_por: user.id,
          tipo_documento: "outro",
          status_processamento: "pendente",
          status_validacao: "nao_validado",
          tipo_origem: "arquivo_upload",
        }).select("id").single();
        if (insertErr) throw insertErr;
        if (insertData) addTrackedImport((insertData as any).id, file.name, file.name.replace(/\.[^.]+$/, ""), "outro", "arquivo_upload");
        supabase.functions.invoke("qa-ingest-document", { body: { storage_path: path, user_id: user.id } }).catch(() => {});
      }
      toast.success(`${files.length} documento(s) enviado(s). Acompanhe o progresso acima.`);
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleImportLink = async () => {
    if (!linkUrl.trim() || !user) return;
    setImportingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-ingest-url", {
        body: {
          url: linkUrl.trim(),
          titulo: linkTitulo.trim() || undefined,
          tipo_documento: linkTipo,
          user_id: user.id,
          papel_documento: "aprendizado",
          caso_id: null,
        },
      });
      if (error) throw error;
      const docId = data?.doc_id;
      if (docId) {
        addTrackedImport(docId, linkUrl.trim(), linkTitulo.trim() || linkUrl.trim(), linkTipo, "link_publico");
        await supabase.from("qa_documentos_conhecimento" as any)
          .update({ papel_documento: "aprendizado" } as any)
          .eq("id", docId);
      }
      toast.success("Importação iniciada. Acompanhe o progresso na fila de atividade.");
      setShowLinkDialog(false);
      setLinkUrl("");
      setLinkTitulo("");
      setLinkTipo("outro");
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar link");
    } finally {
      setImportingLink(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkLinks.trim() || !user) return;
    const urls = bulkLinks.split("\n").map(l => l.trim()).filter(l => l.length > 5);
    if (!urls.length) { toast.error("Nenhum link válido encontrado."); return; }
    setBulkImporting(true);
    setBulkProgress({ done: 0, total: urls.length });
    let ok = 0;
    for (const url of urls) {
      try {
        const { data } = await supabase.functions.invoke("qa-ingest-url", {
          body: { url, tipo_documento: bulkTipo, user_id: user.id },
        });
        if (data?.doc_id) addTrackedImport(data.doc_id, url, url, bulkTipo, "link_publico");
        ok++;
      } catch { /* skip */ }
      setBulkProgress({ done: ok, total: urls.length });
    }
    toast.success(`${ok}/${urls.length} links importados. Acompanhe na fila de atividade.`);
    setBulkImporting(false);
    setShowBulkDialog(false);
    setBulkLinks("");
    loadDocs();
  };

  const handleReprocess = async (doc: any) => {
    if (!user) return;
    setReprocessingId(doc.id);
    try {
      await supabase.from("qa_documentos_conhecimento" as any)
        .update({ status_processamento: "pendente", resumo_extraido: null, updated_at: new Date().toISOString() })
        .eq("id", doc.id);
      await supabase.from("qa_chunks_conhecimento" as any).delete().eq("documento_id", doc.id);
      addTrackedImport(doc.id, doc.url_origem || doc.nome_arquivo, doc.titulo);
      if (doc.tipo_origem === "link_publico" && doc.url_origem) {
        await supabase.functions.invoke("qa-ingest-url", {
          body: { url: doc.url_origem, titulo: doc.titulo, tipo_documento: doc.tipo_documento, user_id: user.id },
        });
      } else {
        await supabase.functions.invoke("qa-ingest-document", { body: { storage_path: doc.storage_path, user_id: user.id } });
      }
      toast.success("Reprocessamento iniciado.");
      loadDocs();
    } catch (err: any) {
      toast.error("Erro ao reprocessar: " + (err.message || ""));
    } finally {
      setReprocessingId(null);
    }
  };

  const handleDeactivate = async (doc: any) => {
    if (!user) return;
    setDeleting(true);
    try {
      await supabase.from("qa_documentos_conhecimento" as any)
        .update({ ativo: false, ativo_na_ia: false, updated_at: new Date().toISOString() } as any)
        .eq("id", doc.id);
      await supabase.from("qa_logs_auditoria" as any).insert({
        usuario_id: user.id, acao: "documento_desativado",
        entidade_tipo: "documento", entidade_id: doc.id,
        detalhes: { titulo: doc.titulo, tipo: doc.tipo_documento },
      });
      toast.success("Documento desativado da IA.");
      setDeleteTarget(null);
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao desativar");
    } finally {
      setDeleting(false);
    }
  };

  const handlePermanentDelete = async (doc: any) => {
    if (!user) return;
    setDeleting(true);
    try {
      const { data: chunks } = await supabase.from("qa_chunks_conhecimento" as any).select("id").eq("documento_id", doc.id);
      if (chunks?.length) {
        await supabase.from("qa_embeddings" as any).delete().in("chunk_id", chunks.map((c: any) => c.id));
      }
      await supabase.from("qa_chunks_conhecimento" as any).delete().eq("documento_id", doc.id);
      await supabase.from("qa_referencias_preferenciais" as any).delete().eq("origem_id", doc.id);
      if (doc.storage_path) await supabase.storage.from("qa-documentos").remove([doc.storage_path]);
      await supabase.from("qa_logs_auditoria" as any).insert({
        usuario_id: user.id, acao: "documento_excluido_permanente",
        entidade_tipo: "documento", entidade_id: doc.id,
        detalhes: { titulo: doc.titulo, tipo: doc.tipo_documento, storage_path: doc.storage_path },
      });
      await supabase.from("qa_documentos_conhecimento" as any).delete().eq("id", doc.id);
      toast.success("Documento excluído permanentemente.");
      setDeleteTarget(null);
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  };

  const statusIcon = (s: string) => {
    if (s === "concluido") return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    if (s === "erro" || s === "texto_invalido") return <AlertCircle className="h-4 w-4 text-red-400" />;
    if (TERMINAL.includes(s)) return <Clock className="h-4 w-4 text-slate-500" />;
    // Any processing stage
    if (s !== "pendente") return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
    return <Clock className="h-4 w-4 text-slate-500" />;
  };

  const statusLabel = (s: string) => {
    const stage = getStageInfo(s);
    if (s === "concluido") return { text: "Concluído", cls: "bg-emerald-500/10 text-emerald-400" };
    if (s === "texto_invalido") return { text: "Texto Inválido", cls: "bg-orange-500/10 text-orange-400" };
    if (s === "erro") return { text: "Falhou", cls: "bg-red-500/10 text-red-400" };
    if (s !== "pendente" && !TERMINAL.includes(s)) return { text: stage.label, cls: "bg-blue-500/10 text-blue-400" };
    return { text: "Pendente", cls: "bg-slate-100 text-slate-600" };
  };

  const origemIcon = (t: string) => {
    if (t === "link_publico") return <Globe className="h-3 w-3 text-blue-400" />;
    return <Upload className="h-3 w-3 text-slate-500" />;
  };

  // Dashboard stats
  const totalDocs = docs.length;
  const validados = docs.filter(d => d.status_validacao === "validado").length;
  const pendentes = docs.filter(d => d.status_validacao === "nao_validado" || d.status_validacao === "pendente_validacao").length;
  const ativosIA = docs.filter(d => d.ativo_na_ia === true && d.status_validacao === "validado" && d.status_processamento === "concluido").length;
  const referencias = docs.filter(d => d.referencia_preferencial === true).length;

  const activeTracked = trackedImports.filter(t => !TERMINAL.includes(t.status));
  const doneTracked = trackedImports.filter(t => t.status === "concluido");
  const errorTracked = trackedImports.filter(t => t.status === "erro" || t.status === "texto_invalido");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-700">Base de Conhecimento</h1>
          <p className="text-sm text-slate-500 mt-1">Documentos que alimentam a IA jurídica</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowLinkDialog(true)} className="border-blue-600/40 text-blue-400 hover:bg-blue-500/10 gap-1.5">
            <Link2 className="h-4 w-4" /> Importar por Link
          </Button>
          <Button variant="outline" onClick={() => setShowBulkDialog(true)} className="border-purple-600/40 text-purple-400 hover:bg-purple-500/10 gap-1.5">
            <Plus className="h-4 w-4" /> Carga em Lote
          </Button>
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.doc,.docx,.txt,.rtf" multiple />
            <Button asChild disabled={uploading} className="bg-[#7a1528] hover:bg-[#a52338] text-slate-700 border border-slate-200">
              <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />} Enviar Documento</span>
            </Button>
          </label>
        </div>
      </div>

      {/* ─── Activity Queue ─── */}
      {trackedImports.length > 0 && (
        <div className="bg-white border border-slate-200 rounded p-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => setQueueCollapsed(c => !c)} className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-700 transition-colors">
              {activeTracked.length > 0 && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
              Fila de Processamento
              {queueCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>
            <div className="flex items-center gap-2">
              {/* Counters */}
              {activeTracked.length > 0 && (
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-medium">
                  {activeTracked.length} ativa{activeTracked.length > 1 ? "s" : ""}
                </span>
              )}
              {doneTracked.length > 0 && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                  {doneTracked.length} concluída{doneTracked.length > 1 ? "s" : ""}
                </span>
              )}
              {errorTracked.length > 0 && (
                <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium">
                  {errorTracked.length} erro{errorTracked.length > 1 ? "s" : ""}
                </span>
              )}
              {trackedImports.every(t => TERMINAL.includes(t.status)) && (
                <button onClick={() => setTrackedImports([])} className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
                  Limpar tudo
                </button>
              )}
            </div>
          </div>
          {!queueCollapsed && trackedImports.map(item => (
            <ActivityItem
              key={item.doc_id}
              item={item}
              onDismiss={() => dismissTracked(item.doc_id)}
              onReprocess={() => handleReprocessFromQueue(item)}
            />
          ))}
        </div>
      )}

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={FileText} label="Total" value={totalDocs} color="bg-slate-100 text-slate-600" />
        <StatCard icon={ShieldCheck} label="Validados" value={validados} color="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={Clock} label="Pendentes" value={pendentes} color="bg-amber-500/10 text-amber-400" />
        <StatCard icon={Zap} label="Ativos na IA" value={ativosIA} color="bg-purple-500/10 text-purple-400" />
        <StatCard icon={Star} label="Referências" value={referencias} color="bg-amber-500/10 text-amber-300" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input placeholder="Buscar por título..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-10 bg-white border-slate-200 text-slate-700" />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[180px] bg-white border-slate-200 text-slate-700"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS_DOC.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
          <SelectTrigger className="w-[160px] bg-white border-slate-200 text-slate-700"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
          {TIPOS_ORIGEM_FILTER.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[160px] bg-white border-slate-200 text-slate-700"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="processando">Processando</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="texto_invalido">Texto Inválido</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-600" /></div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum documento encontrado</p>
          <p className="text-xs mt-1">Envie documentos ou importe por link para alimentar a base</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d: any) => {
            const status = statusLabel(d.status_processamento);
            const isError = d.status_processamento === "erro" || d.status_processamento === "texto_invalido";
            const isReprocessing = reprocessingId === d.id;
            const isValidado = d.status_validacao === "validado";
            const isRejeitado = d.status_validacao === "rejeitado";
            const isRef = d.referencia_preferencial === true;
            const isAtivoIA = d.ativo_na_ia === true;
            const isProcessing = !TERMINAL.includes(d.status_processamento) && d.status_processamento !== "pendente";
            return (
              <div key={d.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-4 hover:border-neutral-600 transition-all group">
                {statusIcon(d.status_processamento)}
                <Link to={`/quero-armas/base-conhecimento/${d.id}`} className="flex-1 min-w-0 cursor-pointer">
                  <div className="text-sm font-medium text-slate-700 truncate group-hover:text-[#c43b52] transition-colors flex items-center gap-1.5">
                    {d.titulo}
                    {isRef && <Star className="h-3 w-3 text-amber-400 shrink-0" />}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{d.tipo_documento?.replace(/_/g, " ")}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400">Aprendizado IA</span>
                    <span className="flex items-center gap-1">{origemIcon(d.tipo_origem)}{d.tipo_origem === "link_publico" ? "Link" : "Upload"}</span>
                    <span>{new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
                    {d.tamanho_bytes && <span>{(d.tamanho_bytes / 1024).toFixed(0)} KB</span>}
                    {d.caso_id && <span className="text-[10px] text-[#c43b52]/60">caso: {d.caso_id}</span>}
                  </div>
                  {d.url_origem && (
                    <div className="text-[10px] text-blue-400/60 truncate mt-0.5">{d.url_origem}</div>
                  )}
                  {isError && d.resumo_extraido && (
                    <div className="text-xs text-red-400/80 mt-1 truncate">{d.resumo_extraido}</div>
                  )}
                  {isProcessing && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress value={getStageInfo(d.status_processamento).pct} className="h-1 bg-slate-100 flex-1 max-w-[200px]" />
                      <span className="text-[10px] text-blue-400">{getStageInfo(d.status_processamento).label}</span>
                    </div>
                  )}
                </Link>
                {/* Governance badges */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium whitespace-nowrap ${status.cls}`}>
                    {status.text}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium whitespace-nowrap ${
                    isValidado ? "bg-emerald-500/10 text-emerald-400" :
                    isRejeitado ? "bg-red-500/10 text-red-400" :
                    "bg-slate-100 text-slate-500"
                  }`}>
                    {isValidado ? "validado" : isRejeitado ? "rejeitado" : "pendente"}
                  </span>
                  {isAtivoIA && isValidado && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium bg-purple-500/10 text-purple-400 whitespace-nowrap">
                      IA
                    </span>
                  )}
                </div>
                {isError && (
                  <Button size="sm" variant="ghost" disabled={isReprocessing} onClick={() => handleReprocess(d)}
                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 shrink-0">
                    {isReprocessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); setDeleteTarget(d); }}
                  className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Link to={`/quero-armas/base-conhecimento/${d.id}`}>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#c43b52] shrink-0" />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Import by Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="bg-white border-slate-200 text-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-700 flex items-center gap-2"><Link2 className="h-5 w-5 text-blue-400" /> Importar por Link Público</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-[10px] text-emerald-600 bg-emerald-50 rounded px-2 py-1.5 border border-emerald-200">
              ⚠️ Esta base é exclusiva para conhecimento jurídico (leis, decretos, petições aprovadas). Documentos de clientes devem ser anexados diretamente no caso.
            </p>
            <div>
              <Label className="text-slate-700 text-xs">URL pública *</Label>
              <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://www.planalto.gov.br/ccivil_03/leis/..." className="bg-white border-slate-200 text-slate-700 mt-1" />
              <p className="text-[10px] text-slate-400 mt-1">Páginas HTML, PDFs públicos, documentos governamentais</p>
            </div>
            <div>
              <Label className="text-slate-700 text-xs">Título (opcional)</Label>
              <Input value={linkTitulo} onChange={e => setLinkTitulo(e.target.value)} placeholder="Ex: Lei 10.826/2003 - Estatuto do Desarmamento" className="bg-white border-slate-200 text-slate-700 mt-1" />
            </div>
            <div>
              <Label className="text-slate-700 text-xs">Classificação</Label>
              <Select value={linkTipo} onValueChange={setLinkTipo}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-700 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOC.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)} className="border-slate-200 text-slate-600">Cancelar</Button>
            <Button onClick={handleImportLink} disabled={!linkUrl.trim() || importingLink} className="bg-blue-600 hover:bg-blue-700">
              {importingLink ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</> : <><Globe className="h-4 w-4 mr-2" /> Importar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="bg-white border-slate-200 text-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-700 flex items-center gap-2"><Plus className="h-5 w-5 text-purple-400" /> Carga em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-700 text-xs">Links (um por linha)</Label>
              <Textarea value={bulkLinks} onChange={e => setBulkLinks(e.target.value)} rows={8}
                placeholder={"https://www.planalto.gov.br/ccivil_03/leis/2003/l10.826.htm\nhttps://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5.123.htm"}
                className="bg-white border-slate-200 text-slate-700 mt-1 font-mono text-xs" />
              <p className="text-[10px] text-slate-400 mt-1">{bulkLinks.split("\n").filter(l => l.trim().length > 5).length} links detectados</p>
            </div>
            <div>
              <Label className="text-slate-700 text-xs">Classificação padrão</Label>
              <Select value={bulkTipo} onValueChange={setBulkTipo}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-700 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOC.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {bulkImporting && (
              <div className="space-y-1.5">
                <div className="text-xs text-amber-400">{bulkProgress.done}/{bulkProgress.total} importados...</div>
                <Progress value={(bulkProgress.done / Math.max(bulkProgress.total, 1)) * 100} className="h-1.5 bg-slate-100" />
              </div>
            )}
            <div>
              <Label className="text-slate-700 text-xs">Ou envie múltiplos arquivos</Label>
              <label className="cursor-pointer block mt-1">
                <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.doc,.docx,.txt,.rtf" multiple />
                <Button asChild variant="outline" disabled={uploading} className="border-slate-200 text-slate-600 w-full">
                  <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />} Selecionar arquivos</span>
                </Button>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)} className="border-slate-200 text-slate-600">Cancelar</Button>
            <Button onClick={handleBulkImport} disabled={!bulkLinks.trim() || bulkImporting} className="bg-purple-600 hover:bg-purple-700">
              {bulkImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Importar Links
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-white border-slate-200 text-slate-700 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-700">Excluir documento</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              <strong className="text-slate-700 block mb-1">{deleteTarget?.titulo}</strong>
              Tem certeza que deseja remover este documento da base de conhecimento? A IA não utilizará mais esse conteúdo em consultas futuras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <Button variant="outline" disabled={deleting} onClick={() => handleDeactivate(deleteTarget)}
              className="w-full border-amber-600/40 text-amber-400 hover:bg-amber-500/10 justify-start gap-2">
              <Power className="h-4 w-4" /> Desativar da IA
              <span className="text-[10px] text-slate-500 ml-auto">reversível</span>
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => handlePermanentDelete(deleteTarget)}
              className="w-full justify-start gap-2">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Excluir permanentemente
              <span className="text-[10px] text-red-300/60 ml-auto">irreversível</span>
            </Button>
            <AlertDialogCancel className="w-full border-slate-200 text-slate-600">Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

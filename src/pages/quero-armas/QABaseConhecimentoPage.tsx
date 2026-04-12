import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Search, FileText, CheckCircle, Clock, AlertCircle, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";
import { Link } from "react-router-dom";

const TIPOS_DOC = [
  "peticao", "recurso", "mandado_seguranca", "parecer", "jurisprudencia",
  "decisao_favoravel", "decisao_desfavoravel", "lei", "decreto",
  "instrucao_normativa", "portaria", "nota_tecnica", "modelo_interno",
  "estrategia_interna", "outro",
];

export default function QABaseConhecimentoPage() {
  const { user } = useQAAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");

  const loadDocs = useCallback(async () => {
    let q = supabase.from("qa_documentos_conhecimento" as any).select("*").order("created_at", { ascending: false });
    if (filtroTipo !== "todos") q = q.eq("tipo_documento", filtroTipo);
    if (filtroStatus !== "todos") q = q.eq("status_processamento", filtroStatus);
    if (busca) q = q.ilike("titulo", `%${busca}%`);
    const { data } = await q;
    setDocs((data as any[]) ?? []);
    setLoading(false);
  }, [filtroTipo, filtroStatus, busca]);

  useEffect(() => { 
    setLoading(true);
    loadDocs(); 
  }, [loadDocs]);

  // Poll for documents that are still processing
  useEffect(() => {
    const hasProcessing = docs.some(d => d.status_processamento === "pendente" || d.status_processamento === "processando");
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadDocs();
    }, 5000);

    return () => clearInterval(interval);
  }, [docs, loadDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("qa-documentos").upload(path, file);
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("qa_documentos_conhecimento" as any).insert({
        titulo: file.name.replace(/\.[^.]+$/, ""),
        nome_arquivo: file.name,
        storage_path: path,
        mime_type: file.type,
        tamanho_bytes: file.size,
        enviado_por: user.id,
        tipo_documento: "outro",
        status_processamento: "pendente",
        status_validacao: "nao_validado",
      });
      if (insertErr) throw insertErr;

      toast.success("Documento enviado. Processamento iniciado.");
      loadDocs();

      // Trigger ingestion (fire-and-forget)
      supabase.functions.invoke("qa-ingest-document", {
        body: { storage_path: path, user_id: user.id },
      }).catch(() => {});
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleReprocess = async (doc: any) => {
    if (!user) return;
    setReprocessingId(doc.id);
    try {
      // Reset status to pendente
      await supabase.from("qa_documentos_conhecimento" as any)
        .update({ status_processamento: "pendente", resumo_extraido: null, updated_at: new Date().toISOString() })
        .eq("id", doc.id);

      // Delete old chunks
      await supabase.from("qa_chunks_conhecimento" as any)
        .delete()
        .eq("documento_id", doc.id);

      // Re-trigger ingestion
      await supabase.functions.invoke("qa-ingest-document", {
        body: { storage_path: doc.storage_path, user_id: user.id },
      });

      toast.success("Reprocessamento iniciado.");
      loadDocs();
    } catch (err: any) {
      toast.error("Erro ao reprocessar: " + (err.message || ""));
    } finally {
      setReprocessingId(null);
    }
  };

  const statusIcon = (s: string) => {
    if (s === "concluido") return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    if (s === "processando") return <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />;
    if (s === "erro") return <AlertCircle className="h-4 w-4 text-red-400" />;
    return <Clock className="h-4 w-4 text-slate-500" />;
  };

  const statusLabel = (s: string) => {
    if (s === "concluido") return { text: "Concluído", cls: "bg-emerald-500/10 text-emerald-400" };
    if (s === "processando") return { text: "Processando...", cls: "bg-amber-500/10 text-amber-400" };
    if (s === "erro") return { text: "Falhou", cls: "bg-red-500/10 text-red-400" };
    return { text: "Pendente", cls: "bg-slate-800 text-slate-400" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Base de Conhecimento</h1>
          <p className="text-sm text-slate-500 mt-1">Documentos que alimentam a IA jurídica</p>
        </div>
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.doc,.docx,.txt,.rtf" />
          <Button asChild disabled={uploading} className="bg-amber-600 hover:bg-amber-700">
            <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />} Enviar Documento</span>
          </Button>
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input placeholder="Buscar por título..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-10 bg-[#12121c] border-slate-700 text-slate-100" />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[180px] bg-[#12121c] border-slate-700 text-slate-300">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS_DOC.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[180px] bg-[#12121c] border-slate-700 text-slate-300">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="processando">Processando</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum documento encontrado</p>
          <p className="text-xs mt-1">Envie documentos para alimentar a base de conhecimento</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d: any) => {
            const status = statusLabel(d.status_processamento);
            const isError = d.status_processamento === "erro";
            const isReprocessing = reprocessingId === d.id;

            return (
              <div key={d.id} className="flex items-center gap-4 bg-[#12121c] border border-slate-800/40 rounded-lg p-4 hover:border-amber-500/30 transition-all group">
                {statusIcon(d.status_processamento)}
                <Link to={`/quero-armas/base-conhecimento/${d.id}`} className="flex-1 min-w-0 cursor-pointer">
                  <div className="text-sm font-medium text-slate-200 truncate group-hover:text-amber-400 transition-colors">{d.titulo}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{d.tipo_documento?.replace(/_/g, " ")}</span>
                    <span>{new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
                    {d.tamanho_bytes && <span>{(d.tamanho_bytes / 1024).toFixed(0)} KB</span>}
                  </div>
                  {isError && d.resumo_extraido && (
                    <div className="text-xs text-red-400/80 mt-1 truncate">{d.resumo_extraido}</div>
                  )}
                </Link>
                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium whitespace-nowrap ${status.cls}`}>
                  {status.text}
                </span>
                {isError && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isReprocessing}
                    onClick={() => handleReprocess(d)}
                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 shrink-0"
                  >
                    {isReprocessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    <span className="ml-1 text-xs">Reprocessar</span>
                  </Button>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium ${
                  d.status_validacao === "validado" ? "bg-emerald-500/10 text-emerald-400" :
                  d.status_validacao === "rejeitado" ? "bg-red-500/10 text-red-400" :
                  "bg-slate-800 text-slate-500"
                }`}>
                  {d.status_validacao?.replace(/_/g, " ")}
                </span>
                <Link to={`/quero-armas/base-conhecimento/${d.id}`}>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-600 group-hover:text-amber-400 shrink-0" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

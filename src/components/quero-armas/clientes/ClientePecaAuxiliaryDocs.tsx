import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Paperclip,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";

type DocUploadStage = "pending" | "queued" | "uploading" | "saved" | "extracting" | "processing" | "done" | "failed";

export interface AuxiliaryDocItemState {
  file: File;
  nome: string;
  tipo: string;
  stage: DocUploadStage;
  etapaAtual?: string;
  docId?: string;
  storagePath?: string;
  error?: string;
  startedAt?: number;
}

interface Props {
  onChange?: (items: AuxiliaryDocItemState[]) => void;
  userId?: string;
  caseId?: string | null;
}

const TIPOS_DOC_AUXILIAR = [
  { value: "boletim_ocorrencia", label: "Boletim de Ocorrência" },
  { value: "laudo_medico", label: "Laudo Médico" },
  { value: "laudo_psiquiatrico", label: "Laudo Psiquiátrico" },
  { value: "laudo_psicologico", label: "Laudo Psicológico" },
  { value: "relatorio_clinico", label: "Relatório Clínico" },
  { value: "atestado_medico", label: "Atestado Médico" },
  { value: "notificacao_administrativa", label: "Notificação Administrativa" },
  { value: "indeferimento_administrativo", label: "Indeferimento Administrativo" },
  { value: "certidao", label: "Certidão" },
  { value: "documento_pessoal", label: "Documento Pessoal" },
  { value: "comprovante_residencia", label: "Comprovante de Residência" },
  { value: "declaracao", label: "Declaração" },
  { value: "decisao_administrativa", label: "Decisão Administrativa" },
  { value: "outro", label: "Outro documento probatório" },
];

const STAGE_LABELS: Record<DocUploadStage, string> = {
  pending: "Aguardando classificação",
  queued: "Na fila",
  uploading: "Enviando arquivo...",
  saved: "Arquivo salvo",
  extracting: "Extraindo texto...",
  processing: "Processando documento...",
  done: "Concluído",
  failed: "Falhou",
};

const ETAPA_LABELS: Record<string, string> = {
  criado: "Na fila",
  pendente: "Na fila",
  verificando_arquivo: "Verificando arquivo...",
  arquivo_confirmado: "Arquivo confirmado",
  registrando_documento: "Registrando documento...",
  extracao_texto: "Extraindo texto...",
  extraindo_texto: "Extraindo texto...",
  aguardando_extracao: "Aguardando extração...",
  extracao_em_andamento: "Extração em andamento...",
  rodando_ocr: "Executando OCR...",
  estruturando_campos: "Estruturando campos...",
  processamento_tipado: "Classificando conteúdo...",
  gerando_resumo: "Gerando resumo...",
  criando_chunks: "Preparando trechos...",
  gerando_embeddings: "Finalizando processamento...",
  processando: "Processando documento...",
  salvando_metadados: "Salvando metadados...",
  concluido: "Concluído",
  texto_invalido: "Texto insuficiente",
  erro: "Falhou",
};

type DocComplexity = "light" | "medium" | "heavy";

const DOC_COMPLEXITY: Record<string, DocComplexity> = {
  documento_pessoal: "light",
  comprovante_residencia: "light",
  declaracao: "light",
  certidao: "light",
  atestado_medico: "medium",
  notificacao_administrativa: "medium",
  indeferimento_administrativo: "medium",
  decisao_administrativa: "medium",
  relatorio_clinico: "medium",
  boletim_ocorrencia: "heavy",
  laudo_medico: "heavy",
  laudo_psiquiatrico: "heavy",
  laudo_psicologico: "heavy",
  outro: "medium",
};

const COMPLEXITY_LABEL: Record<DocComplexity, string> = {
  light: "⚡ rápido",
  medium: "📄 médio",
  heavy: "📑 detalhado",
};

const SUPPORTED_AUXILIARY_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt", ".rtf", ".png", ".jpg", ".jpeg", ".webp"];
const MAX_AUXILIARY_FILE_SIZE = 20 * 1024 * 1024;

function getFileExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  return lastDot === -1 ? "" : name.slice(lastDot).toLowerCase();
}

function validateAuxiliaryFile(file: File): string | null {
  const ext = getFileExtension(file.name);

  if (file.size > MAX_AUXILIARY_FILE_SIZE) {
    return "Arquivo acima de 20MB. Reduza o tamanho e tente novamente.";
  }

  if (!SUPPORTED_AUXILIARY_EXTENSIONS.includes(ext)) {
    return "Formato não suportado. Use PDF, DOCX, TXT, PNG, JPG ou WEBP.";
  }

  if (ext === ".doc") {
    return "Arquivos .doc antigos não são suportados aqui. Exporte para PDF ou DOCX e envie novamente.";
  }

  return null;
}

function mapKnowledgeStatusToStage(status?: string | null): DocUploadStage {
  switch (status) {
    case "pendente":
      return "queued";
    case "verificando_arquivo":
    case "arquivo_confirmado":
    case "registrando_documento":
      return "saved";
    case "extraindo_texto":
      return "extracting";
    case "rodando_ocr":
    case "gerando_resumo":
    case "criando_chunks":
    case "gerando_embeddings":
    case "processando":
      return "processing";
    case "concluido":
      return "done";
    case "erro":
    case "texto_invalido":
      return "failed";
    default:
      return "processing";
  }
}

function getDisplayLabel(stage: DocUploadStage, etapaAtual?: string): string {
  if (stage === "done" || stage === "failed" || stage === "pending" || stage === "uploading") return STAGE_LABELS[stage];
  if (etapaAtual) {
    const base = etapaAtual.split(" (")[0];
    return ETAPA_LABELS[base] || etapaAtual.replace(/_/g, " ");
  }
  return STAGE_LABELS[stage];
}

function stageProgress(stage: DocUploadStage): number {
  return { pending: 0, queued: 5, uploading: 20, saved: 40, extracting: 60, processing: 80, done: 100, failed: 100 }[stage];
}

function stageTone(stage: DocUploadStage): string {
  if (stage === "failed") return "text-destructive";
  if (stage === "done") return "text-foreground";
  return "text-muted-foreground";
}

function ElapsedTime({ startedAt }: { startedAt?: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const interval = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <span className="text-[10px] text-muted-foreground tabular-nums">
      {minutes > 0 ? `${minutes}m${seconds.toString().padStart(2, "0")}s` : `${seconds}s`}
    </span>
  );
}

export default function ClientePecaAuxiliaryDocs({ onChange, userId, caseId }: Props) {
  const [items, setItems] = useState<AuxiliaryDocItemState[]>([]);
  const [showList, setShowList] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadQueueRef = useRef<Array<{ item: AuxiliaryDocItemState; index: number }>>([]);
  const uploadRunningRef = useRef(false);

  const docTotal = items.length;
  const docDone = items.filter((item) => item.stage === "done").length;
  const docFailed = items.filter((item) => item.stage === "failed").length;
  const docPendingClassification = items.filter((item) => item.stage === "pending").length;

  useEffect(() => {
    onChange?.(items);
  }, [items, onChange]);

  const sanitizeFileName = (name: string): string => {
    let sanitized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "_");
    sanitized = sanitized.toLowerCase();
    sanitized = sanitized.replace(/_{2,}/g, "_").replace(/^_+|_+$/g, "");
    return sanitized || "file";
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error(`Timeout: ${label} excedeu ${Math.round(ms / 1000)}s`)), ms)),
    ]);
  };

  const setDocStage = (index: number, stage: DocUploadStage, extra?: Partial<AuxiliaryDocItemState>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, stage, ...extra } : item)));
  };

  const triggerTypedProcessing = async (docId: string) => {
    try {
      await supabase.functions.invoke("qa-processar-documento", {
        body: { documento_id: docId, user_id: userId || null },
      });
    } catch {
      // Não bloqueia o fluxo.
    }
  };

  const pollDocumentStatus = async (docId: string, index: number, fileName: string) => {
    const MAX_POLLS = 300;
    let polls = 0;

    while (polls < MAX_POLLS) {
      const interval = polls < 15 ? 1000 : polls < 40 ? 3000 : 5000;
      await new Promise((resolve) => window.setTimeout(resolve, interval));
      polls += 1;

      try {
        const { data: doc } = await supabase
          .from("qa_documentos_conhecimento" as any)
          .select("status_processamento, resumo_extraido")
          .eq("id", docId)
          .maybeSingle();

        if (!doc) continue;

        const current = doc as any;
        const uiStage = mapKnowledgeStatusToStage(current.status_processamento);

        if (current.status_processamento === "concluido") {
          setDocStage(index, "done", { docId, etapaAtual: "concluido" });
          void triggerTypedProcessing(docId);
          return;
        }

        if (current.status_processamento === "erro" || current.status_processamento === "texto_invalido") {
          setDocStage(index, "failed", {
            docId,
            etapaAtual: current.status_processamento,
            error: current.resumo_extraido || "Não foi possível concluir o processamento do documento.",
          });
          return;
        }

        setDocStage(index, uiStage, {
          docId,
          etapaAtual: current.status_processamento || undefined,
        });
      } catch {
        // Continua em background.
      }
    }

    setDocStage(index, "processing", { docId, etapaAtual: "processando" });
    toast.info(`${fileName}: processamento continua em background.`);
  };

  const dispatchDocumentIngestion = async (index: number, storagePath: string, docId: string, fileName: string) => {
    try {
      setDocStage(index, "queued", { docId, storagePath, etapaAtual: "pendente" });

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-ingest-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ storage_path: storagePath, user_id: userId || null }),
        signal: controller.signal,
      });
      window.clearTimeout(timer);

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(`Ingestão falhou (${response.status}): ${errBody || "sem detalhes"}`);
      }

      setDocStage(index, "extracting", { docId, storagePath, etapaAtual: "extraindo_texto" });
      void pollDocumentStatus(docId, index, fileName);
    } catch (error: any) {
      setDocStage(index, "failed", {
        docId,
        storagePath,
        error: error.message || "Falha ao iniciar o processamento do documento.",
      });
    }
  };

  const startDocJob = async (item: AuxiliaryDocItemState, index: number): Promise<string | null> => {
    if (item.stage === "done" && item.docId) return item.docId;
    if (!item.tipo) {
      toast.error("Selecione o tipo documental primeiro");
      return null;
    }

    setDocStage(index, "uploading", { startedAt: Date.now(), error: undefined, etapaAtual: undefined });

    try {
      const safeName = sanitizeFileName(item.file.name);
      const storagePath = `auxiliares/${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeName}`;

      const uploadResult = await withTimeout(
        supabase.storage.from("qa-documentos").upload(storagePath, item.file) as Promise<{ data: any; error: any }>,
        60000,
        `upload ${item.file.name}`,
      );

      if (uploadResult.error) throw new Error(`Upload falhou: ${uploadResult.error.message}`);

      const insertResult = await withTimeout(
        supabase
          .from("qa_documentos_conhecimento" as any)
          .insert({
            titulo: item.file.name.replace(/\.[^.]+$/, ""),
            nome_arquivo: item.file.name,
            storage_path: storagePath,
            mime_type: item.file.type || null,
            tamanho_bytes: item.file.size,
            enviado_por: userId || null,
            tipo_documento: item.tipo,
            categoria: item.tipo,
            status_processamento: "pendente",
            status_validacao: "validado",
            tipo_origem: "arquivo_upload",
            papel_documento: "auxiliar_caso",
            ativo: true,
            ativo_na_ia: false,
            caso_id: caseId ?? null,
          })
          .select("id")
          .single() as unknown as Promise<{ data: any; error: any }>,
        15000,
        "registrar documento",
      );

      const { data: docData, error: insertError } = insertResult;
      if (insertError) {
        await supabase.storage.from("qa-documentos").remove([storagePath]).catch(() => undefined);
        throw new Error(`Erro ao registrar documento: ${insertError.message}`);
      }

      const docId = (docData as any).id;
      setDocStage(index, "saved", { storagePath, docId, etapaAtual: "arquivo_confirmado" });
      void dispatchDocumentIngestion(index, storagePath, docId, item.file.name);
      return docId;
    } catch (error: any) {
      toast.error(`${item.file.name}: ${error.message || "Falha no upload"}`);
      setDocStage(index, "failed", { error: error.message || "Falha no upload" });
      return null;
    }
  };

  const processUploadQueue = async () => {
    if (uploadRunningRef.current) return;
    uploadRunningRef.current = true;

    while (uploadQueueRef.current.length > 0) {
      const current = uploadQueueRef.current.shift();
      if (!current) continue;
      await startDocJob(current.item, current.index);
    }

    uploadRunningRef.current = false;
  };

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return;

    const accepted: AuxiliaryDocItemState[] = [];
    const rejectedMessages: string[] = [];

    for (const file of Array.from(files)) {
      const validationError = validateAuxiliaryFile(file);
      if (validationError) {
        rejectedMessages.push(`${file.name}: ${validationError}`);
        continue;
      }

      accepted.push({
        file,
        nome: file.name,
        tipo: "",
        stage: "pending",
      });
    }

    if (accepted.length > 0) {
      setItems((prev) => [...prev, ...accepted]);
      setShowList(true);
    }

    if (rejectedMessages.length > 0) {
      toast.error(`${rejectedMessages.length} arquivo(s) não puderam ser adicionados. ${rejectedMessages[0]}`);
    }
  };

  const handleRemoveFile = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChangeTipoDoc = (index: number, tipo: string) => {
    if (!tipo) return;

    setItems((prev) => {
      const updated = prev.map((item, i) => (i === index ? { ...item, tipo } : item));
      const current = updated[index];

      if (current && current.stage === "pending") {
        uploadQueueRef.current.push({ item: { ...current, tipo }, index });
        queueMicrotask(() => {
          void processUploadQueue();
        });
      }

      return updated;
    });
  };

  const handleRetryDoc = async (index: number) => {
    const item = items[index];
    if (!item) return;

    if (item.docId && item.storagePath) {
      try {
        await supabase
          .from("qa_documentos_conhecimento" as any)
          .update({
            status_processamento: "pendente",
            resumo_extraido: null,
            texto_extraido: null,
            metodo_extracao: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.docId);

        await supabase.from("qa_chunks_conhecimento" as any).delete().eq("documento_id", item.docId);

        setDocStage(index, "queued", {
          error: undefined,
          startedAt: Date.now(),
          etapaAtual: "pendente",
        });

        const retryController = new AbortController();
        const retryTimer = window.setTimeout(() => retryController.abort(), 15000);
        const retryResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-ingest-document`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ storage_path: item.storagePath, user_id: userId || null }),
          signal: retryController.signal,
        });
        window.clearTimeout(retryTimer);

        if (!retryResponse.ok) throw new Error(`Reprocessamento falhou (${retryResponse.status})`);

        void pollDocumentStatus(item.docId, index, item.nome);
        return;
      } catch (error: any) {
        setDocStage(index, "failed", { error: error.message || "Falha ao reiniciar o processamento" });
        return;
      }
    }

    const docId = await startDocJob(item, index);
    if (docId) toast.success(`${item.nome} reenviado para processamento`);
  };

  return (
    <div className="rounded-xl border-2 border-border/60 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Paperclip className="h-3 w-3 text-primary" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
              Provas e documentos auxiliares
            </span>
            {docTotal > 0 && (
              <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                {docDone}/{docTotal}{docFailed > 0 ? ` · ${docFailed} falha(s)` : ""}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
            BOs, laudos e demais provas seguem com extração integral antes da IA gerar a peça.
          </p>
        </div>

        {docTotal > 0 && (
          <button
            type="button"
            onClick={() => setShowList((prev) => !prev)}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
            aria-label={showList ? "Ocultar anexos" : "Mostrar anexos"}
          >
            {showList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(event) => {
          handleAddFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 px-4 text-[10px] font-bold uppercase tracking-wider bg-background border-border/70 text-foreground hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3 w-3 mr-1.5" />
          Anexar provas
        </Button>
        {docPendingClassification > 0 && (
          <span className="text-[10px] text-muted-foreground">
            Classifique os anexos para iniciar a extração.
          </span>
        )}
      </div>

      {docTotal > 0 && showList && (
        <div className="space-y-2">
          {items.map((item, index) => {
            const isInProgress = ["queued", "uploading", "saved", "extracting", "processing"].includes(item.stage);
            const selectedTipo = TIPOS_DOC_AUXILIAR.find((tipo) => tipo.value === item.tipo)?.label || item.tipo;
            const complexity = item.tipo ? DOC_COMPLEXITY[item.tipo] : null;

            return (
              <div
                key={`${item.nome}-${index}`}
                className="rounded-md border border-border/70 bg-background px-3 py-2.5 space-y-2"
              >
                <div className="flex items-start gap-2.5">
                  <FileText className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${stageTone(item.stage)}`} />

                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-foreground truncate">{item.nome}</div>

                    <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] ${stageTone(item.stage)}`}>
                        {getDisplayLabel(item.stage, item.etapaAtual)}
                      </span>

                      {isInProgress && <ElapsedTime startedAt={item.startedAt} />}

                      {complexity && isInProgress && (
                        <span className="text-[9px] text-muted-foreground">{COMPLEXITY_LABEL[complexity]}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.stage === "pending" ? (
                      <Select value={item.tipo || undefined} onValueChange={(value) => handleChangeTipoDoc(index, value)}>
                        <SelectTrigger className="h-7 w-44 text-[10px]">
                          <SelectValue placeholder="Selecionar opção" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_DOC_AUXILIAR.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="max-w-[128px] truncate text-[9px] text-muted-foreground">
                        {selectedTipo}
                      </span>
                    )}

                    {item.stage === "failed" && (
                      <Button type="button" variant="outline" size="sm" className="h-6 text-[9px]" onClick={() => handleRetryDoc(index)}>
                        <RefreshCw className="h-2.5 w-2.5 mr-1" />
                        Reprocessar
                      </Button>
                    )}

                    {item.stage === "done" && <CheckCircle className="h-3.5 w-3.5 text-foreground" />}

                    {!isInProgress && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={`Remover ${item.nome}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {item.stage !== "pending" && item.stage !== "done" && (
                  <Progress value={stageProgress(item.stage)} className="h-1.5" />
                )}

                {item.error && (
                  <div className="rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1 text-[9px] text-destructive">
                    {item.error}
                  </div>
                )}

                {isInProgress && (
                  <div className="text-[9px] text-muted-foreground">
                    O processamento continua mesmo se você sair da tela.
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
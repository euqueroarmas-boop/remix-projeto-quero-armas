import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import {
  PenTool, Send, Loader2, AlertTriangle, Download, CheckCircle, Scale, Gavel,
  BookOpen, MapPin, Building2, Info, Paperclip, FileText, X, Upload, RefreshCw,
  Search, ChevronDown, ChevronUp, XCircle, Clock, FolderOpen, User, ChevronsUpDown,
} from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";
import { logSistema } from "@/lib/logSistema";
import DraftingView, { type DraftingResult } from "@/components/quero-armas/DraftingView";

/* ── Types ── */
type DocUploadStage = "pending" | "queued" | "uploading" | "saved" | "extracting" | "processing" | "done" | "failed";

interface ArquivoAuxiliar {
  file: File;
  nome: string;
  tipo: string;
  stage: DocUploadStage;
  etapaAtual?: string;
  docId?: string;
  jobId?: string;
  storagePath?: string;
  error?: string;
  startedAt?: number;
}

interface CircunscricaoResolvida {
  unidade_pf: string;
  sigla_unidade: string;
  tipo_unidade: string;
  municipio_sede: string;
  uf: string;
  base_legal: string;
}

type CircunscricaoStatus = "idle" | "resolving" | "resolved" | "not_found" | "error" | "pending_review";
type CepStatus = "idle" | "loading" | "found" | "not_found" | "error";

type GenerationStep =
  | "idle"
  | "resolving_circumscription"
  | "uploading_docs"
  | "extracting_docs"
  | "building_context"
  | "recovering_sources"
  | "generating_draft"
  | "validating"
  | "saving_case"
  | "done"
  | "error";

type DraftingPipelineStep = "context" | "sources" | "writing" | "reviewing" | "validating" | "saving" | "done" | "error";

const GENERATION_STEPS: { key: GenerationStep; label: string }[] = [
  { key: "resolving_circumscription", label: "Resolvendo circunscrição da PF" },
  { key: "uploading_docs", label: "Verificando documentos auxiliares" },
  { key: "building_context", label: "Montando contexto do caso" },
  { key: "recovering_sources", label: "Recuperando fontes jurídicas" },
  { key: "generating_draft", label: "Gerando minuta" },
  { key: "validating", label: "Validando qualidade" },
  { key: "saving_case", label: "Salvando caso" },
];

function stepIndex(s: GenerationStep): number {
  const idx = GENERATION_STEPS.findIndex(g => g.key === s);
  return idx === -1 ? -1 : idx;
}

/* ── Constants ── */
const CIRCUNSCRICAO_TIMEOUT_MS = 12000;

const toTitleCase = (s: string) =>
  s.toLowerCase().replace(/(?:^|\s|'|-)\S/g, c => c.toUpperCase())
    .replace(/\b(Da|Das|De|Do|Dos|E)\b/g, m => m.toLowerCase());

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

const TIPOS_PECA = [
  { value: "defesa_posse_arma", label: "Defesa para Posse de Arma" },
  { value: "defesa_porte_arma", label: "Defesa para Porte de Arma" },
  { value: "recurso_administrativo", label: "Recurso Administrativo" },
  { value: "resposta_a_notificacao", label: "Resposta à Notificação" },
];

// TIPOS_SERVICO removido — redundante com TIPOS_PECA

const FOCOS = [
  { value: "legalidade", label: "Legalidade" },
  { value: "motivacao", label: "Motivação" },
  { value: "efetiva_necessidade", label: "Efetiva Necessidade" },
  { value: "proporcionalidade", label: "Proporcionalidade" },
  { value: "erro_material", label: "Erro Material" },
  { value: "controle_judicial", label: "Controle Judicial" },
];

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
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

function getDisplayLabel(stage: DocUploadStage, etapaAtual?: string): string {
  if (stage === "done" || stage === "failed" || stage === "pending" || stage === "uploading") return STAGE_LABELS[stage];
  if (etapaAtual) {
    // Handle composite etapa like "extracao_em_andamento (pendente)"
    const base = etapaAtual.split(" (")[0];
    return ETAPA_LABELS[base] || etapaAtual.replace(/_/g, " ");
  }
  return STAGE_LABELS[stage];
}

/** Classify doc complexity for expected time estimation */
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

function stageProgress(s: DocUploadStage): number {
  return { pending: 0, queued: 5, uploading: 20, saved: 40, extracting: 60, processing: 80, done: 100, failed: 100 }[s];
}

function stageColor(s: DocUploadStage): string {
  if (s === "done") return "text-emerald-400";
  if (s === "failed") return "text-red-400";
  return "text-cyan-400";
}

function ElapsedTime({ startedAt }: { startedAt?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startedAt]);
  if (!startedAt) return null;
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span className="text-[10px] text-slate-600 tabular-nums">
      {m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`}
    </span>
  );
}

/* ── Component ── */
export default function QAGerarPecaPage() {
  const { user } = useQAAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lookupCep, cepLoading } = useBrasilApiLookup();

  // Form fields
  const [nomeRequerente, setNomeRequerente] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [entradaCaso, setEntradaCaso] = useState("");
  const [tipoPeca, setTipoPeca] = useState("defesa_posse_arma");
  const [foco, setFoco] = useState("legalidade");
  const [clienteCidade, setClienteCidade] = useState("");
  const [clienteUf, setClienteUf] = useState("");
  const [clienteEndereco, setClienteEndereco] = useState("");
  const [clienteBairro, setClienteBairro] = useState("");
  const [clienteCep, setClienteCep] = useState("");
  const [dataNotificacao, setDataNotificacao] = useState("");
  const [infoTempestividade, setInfoTempestividade] = useState("");

  // Editing existing case
  const [casoId, setCasoId] = useState<string | null>(null);

  // CEP
  const [cepStatus, setCepStatus] = useState<CepStatus>("idle");
  const cepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cepLookupRef = useRef(0);

  // Municipality autocomplete
  const [municipiosList, setMunicipiosList] = useState<string[]>([]);
  const [municipiosLoading, setMunicipiosLoading] = useState(false);
  const [cidadePopoverOpen, setCidadePopoverOpen] = useState(false);
  const municipiosLoadedUfRef = useRef("");

  // Auxiliary documents
  const [arquivosAuxiliares, setArquivosAuxiliares] = useState<ArquivoAuxiliar[]>([]);
  const [showDocList, setShowDocList] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Circumscription
  const circunscricaoRequestRef = useRef(0);
  const [circunscricaoResolvida, setCircunscricaoResolvida] = useState<CircunscricaoResolvida | null>(null);
  const [circunscricaoStatus, setCircunscricaoStatus] = useState<CircunscricaoStatus>("idle");
  const [circunscricaoMensagem, setCircunscricaoMensagem] = useState("");

  // Generation
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<DraftingResult | null>(null);
  const [genStep, setGenStep] = useState<GenerationStep>("idle");
  const [genError, setGenError] = useState("");
  const [genStartedAt, setGenStartedAt] = useState<number | undefined>();
  const [savedCasoId, setSavedCasoId] = useState<string | null>(null);

  // Streaming state
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [draftingStep, setDraftingStep] = useState<DraftingPipelineStep | "done" | "error">("context");
  const [showDraftingView, setShowDraftingView] = useState(false);

  const needsTempestividade = tipoPeca === "recurso_administrativo" || tipoPeca === "resposta_a_notificacao";

  // Doc counters
  const docTotal = arquivosAuxiliares.length;
  const docDone = arquivosAuxiliares.filter(a => a.stage === "done").length;
  const docFailed = arquivosAuxiliares.filter(a => a.stage === "failed").length;
  const docActive = arquivosAuxiliares.filter(a => !["pending", "done", "failed"].includes(a.stage)).length;

  const tipoPecaLabel = TIPOS_PECA.find(t => t.value === tipoPeca)?.label || tipoPeca;

  /* ── Load existing case if ?caso=ID ── */
  useEffect(() => {
    const casoParam = searchParams.get("caso");
    if (!casoParam) return;
    const loadCase = async () => {
      const { data } = await supabase.from("qa_casos" as any).select("*").eq("id", casoParam).maybeSingle();
      if (!data) return;
      const c = data as any;
      setCasoId(c.id);
      // titulo auto-gerado a partir do nome
      setNomeRequerente(c.nome_requerente || "");
      setCpfCnpj(c.cpf_cnpj || "");
      setEntradaCaso(c.descricao_caso || "");
      setTipoPeca(c.tipo_peca || "defesa_posse_arma");
      setFoco(c.foco_argumentativo || "legalidade");
      setClienteCidade(c.cidade || "");
      setClienteUf(c.uf || "");
      setClienteCep(c.cep || "");
      setClienteEndereco(c.endereco || "");
      setClienteBairro(c.bairro || "");
      if (c.minuta_gerada) setResultado({ minuta_gerada: c.minuta_gerada, geracao_id: c.geracao_id, score_confianca: 0, fontes_utilizadas: [] });
      // Try to match tipo_servico
      // tipo_servico derivado de tipo_peca
      const matchPeca = TIPOS_PECA.find(t => t.label === c.tipo_servico || t.value === c.tipo_peca);
      if (matchPeca) setTipoPeca(matchPeca.value);
      if (c.unidade_pf) {
        setCircunscricaoResolvida({ unidade_pf: c.unidade_pf, sigla_unidade: c.sigla_unidade_pf || "", tipo_unidade: "", municipio_sede: "", uf: c.uf || "", base_legal: "" });
        setCircunscricaoStatus("resolved");
      }
    };
    loadCase();
  }, [searchParams]);

  /* ── CEP auto-lookup ── */
  const handleCepChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length > 5) formatted = digits.slice(0, 5) + "-" + digits.slice(5, 8);
    setClienteCep(formatted);
    setCepStatus("idle");
    if (cepTimeoutRef.current) clearTimeout(cepTimeoutRef.current);
    if (digits.length === 8) {
      cepTimeoutRef.current = setTimeout(() => void doCepLookup(digits), 600);
    }
  };

  const doCepLookup = async (digits: string) => {
    const reqId = ++cepLookupRef.current;
    setCepStatus("loading");
    try {
      const result = await Promise.race([
        lookupCep(digits),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("cep_timeout")), 10000)),
      ]);
      if (reqId !== cepLookupRef.current) return; // stale
      if (!result) { setCepStatus("not_found"); return; }
      setCepStatus("found");
      if (result.state) setClienteUf(result.state);
      if (result.street) setClienteEndereco(result.street);
      if (result.neighborhood) setClienteBairro(result.neighborhood);
      if (result.city && result.state) {
        setClienteCidade(result.city);
        void resolverCircunscricao(result.city, result.state);
      }
    } catch {
      if (reqId !== cepLookupRef.current) return;
      setCepStatus("error");
    }
  };

  /* ── Circumscription ── */
  const resetCircunscricaoState = () => {
    circunscricaoRequestRef.current += 1;
    setCircunscricaoResolvida(null);
    setCircunscricaoStatus("idle");
    setCircunscricaoMensagem("");
  };

  const resolverCircunscricao = async (cidade: string, uf: string): Promise<CircunscricaoResolvida | null> => {
    const c = cidade.replace(/\s+/g, " ").trim();
    const u = uf.trim().toUpperCase();
    if (!c || !u) return null;
    const requestId = ++circunscricaoRequestRef.current;
    setCircunscricaoStatus("resolving");
    setCircunscricaoMensagem("");
    try {
      const { data, error } = await Promise.race([
        supabase.rpc("qa_resolver_circunscricao_pf", { p_municipio: c, p_uf: u }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("circunscricao_timeout")), CIRCUNSCRICAO_TIMEOUT_MS)),
      ]);
      if (requestId !== circunscricaoRequestRef.current) return null;
      if (error) {
        setCircunscricaoResolvida(null); setCircunscricaoStatus("error");
        setCircunscricaoMensagem("Erro ao resolver a circunscrição da PF.");
        return null;
      }
      if (!data || data.length === 0) {
        setCircunscricaoResolvida(null); setCircunscricaoStatus("not_found");
        setCircunscricaoMensagem("Circunscrição não encontrada para o município/UF informado.");
        return null;
      }
      const resultado = data[0] as CircunscricaoResolvida;
      setCircunscricaoResolvida(resultado); setCircunscricaoStatus("resolved");
      return resultado;
    } catch (err: any) {
      if (requestId !== circunscricaoRequestRef.current) return null;
      setCircunscricaoResolvida(null); setCircunscricaoStatus("error");
      setCircunscricaoMensagem(err?.message === "circunscricao_timeout"
        ? "Tempo limite excedido. Tente novamente."
        : "Erro ao resolver circunscrição.");
      return null;
    }
  };

  /* ── Load municipalities when UF changes ── */
  const loadMunicipios = useCallback(async (uf: string) => {
    if (!uf) { setMunicipiosList([]); return; }
    if (municipiosLoadedUfRef.current === uf) return; // already loaded
    municipiosLoadedUfRef.current = uf;
    setMunicipiosLoading(true);
    try {
      const { data, error } = await supabase.rpc("qa_listar_municipios_por_uf" as any, { p_uf: uf });
      if (municipiosLoadedUfRef.current !== uf) return; // stale
      if (!error && data) {
        setMunicipiosList((data as any[]).map((r: any) => r.municipio));
      } else {
        setMunicipiosList([]);
      }
    } catch {
      if (municipiosLoadedUfRef.current !== uf) return;
      setMunicipiosList([]);
    } finally {
      setMunicipiosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clienteUf) {
      municipiosLoadedUfRef.current = ""; // reset to allow reload
      loadMunicipios(clienteUf);
    } else {
      municipiosLoadedUfRef.current = "";
      setMunicipiosList([]);
    }
  }, [clienteUf, loadMunicipios]);

  const handleUfChange = async (uf: string) => {
    const u = uf.trim().toUpperCase();
    setClienteUf(u);
    setClienteCidade("");
    resetCircunscricaoState();
  };

  const handleCidadeSelect = async (cidade: string) => {
    setClienteCidade(cidade);
    setCidadePopoverOpen(false);
    resetCircunscricaoState();
    if (cidade && clienteUf) await resolverCircunscricao(cidade, clienteUf);
  };

  const handleRetryCircunscricao = async () => {
    if (!clienteCidade.trim() || !clienteUf.trim()) {
      setCircunscricaoStatus("error");
      setCircunscricaoMensagem("Informe cidade e UF.");
      return;
    }
    await resolverCircunscricao(clienteCidade, clienteUf);
  };

  /* ── File name sanitization ── */
  const sanitizeFileName = (name: string): string => {
    let s = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    s = s.replace(/[^a-zA-Z0-9._-]/g, "_");
    s = s.toLowerCase();
    s = s.replace(/_{2,}/g, "_").replace(/^_+|_+$/g, "");
    return s || "file";
  };

  /* ── Auxiliary documents ── */
  const handleAddFiles = (files: FileList | null) => {
    if (!files) return;

    const acceptedFiles: ArquivoAuxiliar[] = [];
    const rejectedMessages: string[] = [];

    for (const file of Array.from(files)) {
      const validationError = validateAuxiliaryFile(file);

      if (validationError) {
        rejectedMessages.push(`${file.name}: ${validationError}`);
        continue;
      }

      acceptedFiles.push({
        file,
        nome: file.name,
        tipo: "",
        stage: "pending" as DocUploadStage,
      });
    }

    if (acceptedFiles.length > 0) {
      setArquivosAuxiliares(prev => [...prev, ...acceptedFiles]);
    }

    if (rejectedMessages.length > 0) {
      toast.error(`${rejectedMessages.length} arquivo(s) não puderam ser adicionados. ${rejectedMessages[0]}`);
    }
  };

  const handleRemoveFile = (index: number) => {
    setArquivosAuxiliares(prev => prev.filter((_, i) => i !== index));
  };

  const handleChangeTipoDoc = (index: number, tipo: string) => {
    if (!tipo) return;
    // Update tipo inline — we need the latest state for startDocJob
    setArquivosAuxiliares(prev => {
      const updated = prev.map((a, i) => i === index ? { ...a, tipo } : a);
      // Trigger upload immediately using the updated item
      const arq = updated[index];
      if (arq && arq.stage === "pending") {
        // Use microtask to let React commit the state first
        queueMicrotask(() => void startDocJob({ ...arq, tipo }, index));
      }
      return updated;
    });
  };

  const setDocStage = (index: number, stage: DocUploadStage, extra?: Partial<ArquivoAuxiliar>) => {
    setArquivosAuxiliares(prev => prev.map((a, i) => i === index ? { ...a, stage, ...extra } : a));
  };

  const triggerTypedProcessing = async (docId: string) => {
    try {
      await supabase.functions.invoke("qa-processar-documento", {
        body: { documento_id: docId, user_id: user?.id || null },
      });
    } catch {
      // Não bloqueia a geração da peça.
    }
  };

  const pollDocumentStatus = async (docId: string, index: number, fileName: string) => {
    const MAX_POLLS = 300;
    let polls = 0;

    while (polls < MAX_POLLS) {
      // Adaptive polling: fast at first (1s), slower after 30s (3s), even slower after 2min (5s)
      const interval = polls < 15 ? 1000 : polls < 40 ? 3000 : 5000;
      await new Promise(r => setTimeout(r, interval));
      polls++;

      try {
        const { data: doc } = await supabase
          .from("qa_documentos_conhecimento" as any)
          .select("status_processamento, resumo_extraido")
          .eq("id", docId)
          .maybeSingle();

        if (!doc) continue;
        const d = doc as any;
        const uiStage = mapKnowledgeStatusToStage(d.status_processamento);

        if (d.status_processamento === "concluido") {
          setDocStage(index, "done", { docId, etapaAtual: "concluido" });
          void triggerTypedProcessing(docId);
          return;
        }

        if (d.status_processamento === "erro" || d.status_processamento === "texto_invalido") {
          setDocStage(index, "failed", {
            docId,
            etapaAtual: d.status_processamento,
            error: d.resumo_extraido || "Não foi possível concluir o processamento do documento.",
          });
          return;
        }

        setDocStage(index, uiStage, {
          docId,
          etapaAtual: d.status_processamento || undefined,
        });
      } catch {
        // O processamento continua em background.
      }
    }

    setDocStage(index, "processing", { docId, etapaAtual: "processando" });
    toast.info(`${fileName}: processamento continua em background.`);
  };

  const dispatchDocumentIngestion = async (index: number, storagePath: string, docId: string, fileName: string) => {
    try {
      setDocStage(index, "queued", { docId, storagePath, etapaAtual: "pendente" });

      const { error } = await supabase.functions.invoke("qa-ingest-document", {
        body: { storage_path: storagePath, user_id: user?.id || null },
      });

      if (error) throw error;

      setDocStage(index, "extracting", { docId, storagePath, etapaAtual: "extraindo_texto" });
      void pollDocumentStatus(docId, index, fileName);
    } catch (err: any) {
      setDocStage(index, "failed", {
        docId,
        storagePath,
        error: err.message || "Falha ao iniciar o processamento do documento.",
      });
    }
  };

  /** Upload file to storage, register document and start ingestion */
  const startDocJob = async (arq: ArquivoAuxiliar, index: number): Promise<string | null> => {
    if (arq.stage === "done" && arq.docId) return arq.docId;
    if (!arq.tipo) { toast.error("Selecione o tipo documental primeiro"); return null; }

    setDocStage(index, "uploading", { startedAt: Date.now(), error: undefined, etapaAtual: undefined });

    try {
      const safeName = sanitizeFileName(arq.file.name);
      const storagePath = `auxiliares/${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeName}`;

      const { error: upErr } = await supabase.storage.from("qa-documentos").upload(storagePath, arq.file);
      if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

      const { data: docData, error: insertErr } = await supabase.from("qa_documentos_conhecimento" as any).insert({
        titulo: arq.file.name.replace(/\.[^.]+$/, ""),
        nome_arquivo: arq.file.name,
        storage_path: storagePath,
        mime_type: arq.file.type || null,
        tamanho_bytes: arq.file.size,
        enviado_por: user?.id || null,
        tipo_documento: arq.tipo,
        categoria: arq.tipo,
        status_processamento: "pendente",
        status_validacao: "validado",
        tipo_origem: "arquivo_upload",
        papel_documento: "auxiliar_caso",
        ativo: true,
        ativo_na_ia: false,
        caso_id: casoId ?? null,
      }).select("id").single();

      if (insertErr) {
        await supabase.storage.from("qa-documentos").remove([storagePath]).catch(() => undefined);
        throw new Error(`Erro ao registrar documento: ${insertErr.message}`);
      }

      const docId = (docData as any).id;
      setDocStage(index, "saved", { storagePath, docId, etapaAtual: "arquivo_confirmado" });

      void dispatchDocumentIngestion(index, storagePath, docId, arq.file.name);
      return docId;
    } catch (err: any) {
      setDocStage(index, "failed", { error: err.message || "Falha no upload" });
      return null;
    }
  };

  const uploadAllAuxiliares = async (): Promise<string[]> => {
    // All docs should already be processed via jobs — just collect IDs
    return arquivosAuxiliares.filter(a => a.stage === "done" && a.docId).map(a => a.docId!);
  };

  const handleRetryDoc = async (index: number) => {
    const arq = arquivosAuxiliares[index];
    if (!arq) return;

    if (arq.docId && arq.storagePath) {
      try {
        await supabase.from("qa_documentos_conhecimento" as any).update({
          status_processamento: "pendente",
          resumo_extraido: null,
          texto_extraido: null,
          metodo_extracao: null,
          updated_at: new Date().toISOString(),
        }).eq("id", arq.docId);

        await supabase.from("qa_chunks_conhecimento" as any).delete().eq("documento_id", arq.docId);

        setDocStage(index, "queued", {
          error: undefined,
          startedAt: Date.now(),
          etapaAtual: "pendente",
        });

        const { error } = await supabase.functions.invoke("qa-ingest-document", {
          body: { storage_path: arq.storagePath, user_id: user?.id || null },
        });

        if (error) throw error;

        void pollDocumentStatus(arq.docId, index, arq.nome);
        return;
      } catch (err: any) {
        setDocStage(index, "failed", { error: err.message || "Falha ao reiniciar o processamento" });
        return;
      }
    }

    const id = await startDocJob(arq, index);
    if (id) toast.success(`${arq.nome} reenviado para processamento`);
  };

  /* ── Save case ── */
  const saveCaso = async (geracaoResult: any, auxiliarDocIds: string[], circ: CircunscricaoResolvida | null): Promise<string | null> => {
    try {
      const docsJson = arquivosAuxiliares.map(a => ({
        nome: a.nome, tipo: a.tipo, stage: a.stage, docId: a.docId || null, error: a.error || null,
      }));
      const errosJson = arquivosAuxiliares.filter(a => a.stage === "failed").map(a => ({
        nome: a.nome, tipo: a.tipo, error: a.error || "Erro desconhecido",
      }));

      const casoData: Record<string, any> = {
        titulo: `Caso ${nomeRequerente || "sem título"}`,
        nome_requerente: nomeRequerente,
        cpf_cnpj: cpfCnpj || null,
        tipo_peca: tipoPeca,
        tipo_servico: tipoPecaLabel || null,
        cidade: clienteCidade || null,
        uf: clienteUf || null,
        cep: clienteCep || null,
        endereco: clienteEndereco || null,
        bairro: clienteBairro || null,
        unidade_pf: circ?.unidade_pf || null,
        sigla_unidade_pf: circ?.sigla_unidade || null,
        descricao_caso: entradaCaso,
        foco_argumentativo: foco,
        status: "gerado",
        minuta_gerada: geracaoResult?.minuta_gerada || null,
        geracao_id: geracaoResult?.geracao_id || null,
        documentos_auxiliares_json: docsJson,
        erros_documentos_json: errosJson.length > 0 ? errosJson : null,
        usuario_id: user?.id || null,
        updated_at: new Date().toISOString(),
      };

      let savedId: string;
      if (casoId) {
        // Update existing case
        await supabase.from("qa_casos" as any).update(casoData).eq("id", casoId);
        savedId = casoId;
      } else {
        const { data, error } = await supabase.from("qa_casos" as any).insert(casoData).select("id").single();
        if (error) throw error;
        savedId = (data as any).id;
        setCasoId(savedId);
      }

      if (auxiliarDocIds.length > 0) {
        const { error: linkDocsError } = await supabase.from("qa_documentos_conhecimento" as any)
          .update({ caso_id: savedId, updated_at: new Date().toISOString() })
          .in("id", auxiliarDocIds);

        if (linkDocsError) {
          console.error("Erro ao vincular documentos auxiliares ao caso:", linkDocsError);
        }
      }

      // Audit log
      await supabase.from("qa_logs_auditoria" as any).insert({
        usuario_id: user?.id,
        entidade: "qa_casos",
        entidade_id: savedId,
        acao: casoId ? "atualizar_caso" : "criar_caso",
        detalhes_json: {
          nome_requerente: nomeRequerente,
          tipo_servico: tipoPecaLabel,
          tipo_peca: tipoPeca,
          docs_total: docTotal,
          docs_ok: docDone,
          docs_falha: docFailed,
          unidade_pf: circ?.sigla_unidade || null,
        },
      });

      return savedId;
    } catch (err: any) {
      console.error("Erro ao salvar caso:", err);
      return null;
    }
  };

  /* ── Generation ── */
  const hasDocsPending = arquivosAuxiliares.some(a => !["done", "failed", "pending"].includes(a.stage));
  const hasDocsFailed = arquivosAuxiliares.some(a => a.stage === "failed");
  const hasDocsUnclassified = arquivosAuxiliares.some(a => a.stage === "pending");
  const canGenerate = !loading && !hasDocsPending && !hasDocsFailed && !hasDocsUnclassified && arquivosAuxiliares.every(a => a.tipo);

  const gerar = async () => {
    if (!nomeRequerente.trim()) { toast.error("Informe o nome completo do requerente"); return; }
    if (!entradaCaso.trim()) { toast.error("Descreva o caso"); return; }
    if (!clienteCidade.trim() || !clienteUf.trim()) { toast.error("Informe a cidade e o estado do cliente."); return; }

    setLoading(true);
    setResultado(null);
    setGenError("");
    setGenStartedAt(Date.now());
    setSavedCasoId(null);
    setStreamedText("");
    setIsStreaming(false);
    setShowDraftingView(true);
    setDraftingStep("context");

    try {
      // Step 1: Circumscription
      setGenStep("resolving_circumscription");
      let circ = circunscricaoResolvida;
      if (!circ) circ = await resolverCircunscricao(clienteCidade, clienteUf);
      if (!circ) {
        setCircunscricaoStatus("pending_review");
        setCircunscricaoMensagem("Circunscrição pendente para revisão.");
        toast.warning("Circunscrição não resolvida. A peça seguirá com marcador pendente.", { duration: 5000 });
      }

      // Step 2: Collect already-processed doc IDs
      let auxiliarDocIds: string[] = [];
      if (arquivosAuxiliares.length > 0) {
        setGenStep("uploading_docs");
        auxiliarDocIds = arquivosAuxiliares.filter(a => a.stage === "done" && a.docId).map(a => a.docId!);
        await new Promise(r => setTimeout(r, 300));

        const unfinished = arquivosAuxiliares.filter(a => a.stage !== "done");
        if (unfinished.length > 0) {
          const msg = `Geração bloqueada: ${unfinished.length} documento(s) não foram processados.`;
          throw new Error(msg);
        }
      }

      // Step 3-4: Build context
      setGenStep("building_context");
      setDraftingStep("context");
      await new Promise(r => setTimeout(r, 300));
      setGenStep("recovering_sources");
      setDraftingStep("sources");
      await new Promise(r => setTimeout(r, 300));

      // Step 5: Stream generation
      setGenStep("generating_draft");
      setDraftingStep("writing");
      setIsStreaming(true);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/qa-gerar-peca`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          stream: true,
          usuario_id: user?.id, caso_titulo: nomeRequerente, entrada_caso: entradaCaso,
          tipo_peca: tipoPeca, foco,
          cliente_cidade: clienteCidade.trim(), cliente_uf: clienteUf.trim(),
          cliente_endereco: clienteEndereco.trim() || null, cliente_cep: clienteCep.trim() || null,
          nome_requerente: nomeRequerente.trim(),
          tipo_servico: tipoPecaLabel || null,
          circunscricao_resolvida: circ ? {
            unidade_pf: circ.unidade_pf, sigla_unidade: circ.sigla_unidade,
            tipo_unidade: circ.tipo_unidade, municipio_sede: circ.municipio_sede,
            uf: circ.uf, base_legal: circ.base_legal,
          } : null,
          data_notificacao: dataNotificacao.trim() || null,
          info_tempestividade: infoTempestividade.trim() || null,
          documentos_auxiliares_ids: auxiliarDocIds.length > 0 ? auxiliarDocIds : null,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Erro na geração" }));
        throw new Error(errData.error || "Erro na geração");
      }

      // Read SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: DraftingResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          try {
            const evt = JSON.parse(payload);
            if (evt.type === "chunk" && evt.text) {
              setStreamedText(prev => prev + evt.text);
            } else if (evt.type === "done") {
              finalResult = evt as DraftingResult;
            } else if (evt.type === "error") {
              throw new Error(evt.error || "Erro na geração");
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes("JSON")) throw parseErr;
          }
        }
      }

      setIsStreaming(false);

      if (!finalResult) throw new Error("Geração não retornou resultado final");

      // Step 6: Validate
      setGenStep("validating");
      setDraftingStep("validating");
      await new Promise(r => setTimeout(r, 400));

      setResultado(finalResult);

      // Step 7: Save case
      setGenStep("saving_case");
      setDraftingStep("saving");
      const sId = await saveCaso(finalResult, auxiliarDocIds, circ);
      setSavedCasoId(sId);

      // Validate final text
      const finalText = finalResult.minuta_gerada || streamedText;
      const vErrors = validateFinalText(finalText);
      setValidationErrors(vErrors);

      setGenStep("done");
      setDraftingStep("done");
      if (vErrors.length > 0) {
        toast.warning(`Peça gerada com ${vErrors.length} aviso(s) de validação`);
      } else {
        toast.success("Peça gerada e caso salvo com sucesso");
      }
    } catch (err: any) {
      setGenStep("error");
      setDraftingStep("error");
      setGenError(err.message || "Erro na geração");
      setIsStreaming(false);
      toast.error(err.message || "Erro na geração");
    } finally {
      setLoading(false);
    }
  };

  /* ── Validation ── */
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const validateFinalText = useCallback((text: string): string[] => {
    const errors: string[] = [];
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < 2000) errors.push(`Texto com ${wordCount} palavras (mínimo 2000).`);
    if (!clienteCidade.trim()) errors.push("Cidade não preenchida.");
    if (!nomeRequerente.trim()) errors.push("Nome do requerente não preenchido.");
    // Check for placeholders
    const placeholders = text.match(/\[(DATA|CIDADE|NOME|ASSINATURA|OAB|ADVOGADO)[^\]]*\]/gi);
    if (placeholders) errors.push(`Placeholders encontrados: ${placeholders.slice(0, 3).join(", ")}`);
    // Check for advogado/OAB in closing
    const closingMatch = text.match(/nestes\s+termos[\s\S]{0,500}$/i);
    if (closingMatch) {
      const closing = closingMatch[0].toLowerCase();
      if (/\badvogad[oa]\b/.test(closing)) errors.push("Referência a advogado no fechamento.");
      if (/\boab\b/.test(closing)) errors.push("Referência a OAB no fechamento.");
    }
    return errors;
  }, [clienteCidade, nomeRequerente]);

  const formatDataExtenso = (): string => {
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const now = new Date();
    return `${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;
  };

  const copiarMinuta = async () => {
    const text = resultado?.minuta_gerada || streamedText;
    if (!text) { toast.error("Nenhum texto para copiar"); return; }

    // Clean the text: just the legal document content
    let cleanText = text.trim();

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cleanText);
        toast.success("Texto copiado com sucesso");
        return;
      }
    } catch {
      // Fallback below
    }

    // Fallback for mobile/older browsers
    try {
      const textarea = document.createElement("textarea");
      textarea.value = cleanText;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) {
        toast.success("Texto copiado com sucesso");
      } else {
        toast.error("Não foi possível copiar. Selecione o texto manualmente.");
      }
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  };

  const exportarDocx = async () => {
    if (!resultado?.geracao_id) { toast.error("Geração não encontrada"); return; }
    setIsExporting(true);

    const dataExtenso = formatDataExtenso();
    const cidadeFormatada = clienteCidade.trim() ? toTitleCase(clienteCidade.trim()) : "";
    const nomeFormatado = nomeRequerente.trim();
    const dataHoje = new Date();
    const dataFile = `${dataHoje.getFullYear()}-${String(dataHoje.getMonth() + 1).padStart(2, "0")}-${String(dataHoje.getDate()).padStart(2, "0")}`;
    const tipoSlug = tipoPeca.replace(/_/g, "-");
    const nomeSlug = nomeFormatado.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").toLowerCase();
    const fileName = `peca-${tipoSlug}-${nomeSlug}-${dataFile}.docx`;

    try {
      const { data, error } = await supabase.functions.invoke("qa-export-docx", {
        body: {
          geracao_id: resultado.geracao_id,
          variables: {
            cliente_nome: nomeFormatado,
            cidade: cidadeFormatada,
            estado: clienteUf.trim(),
            data_atual: cidadeFormatada
              ? `${cidadeFormatada}, ${dataExtenso}.`
              : `${dataExtenso}.`,
            assinatura: nomeFormatado,
            titulo: tipoPecaLabel,
          },
        },
      });
      if (error) throw error;
      const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (savedCasoId || casoId) {
        await supabase.from("qa_casos" as any).update({ docx_path: fileName, updated_at: new Date().toISOString() }).eq("id", savedCasoId || casoId);
      }
      toast.success("Word baixado com sucesso");
    } catch (err: any) {
      toast.error(err.message || "Erro ao exportar DOCX");
    } finally {
      setIsExporting(false);
    }
  };

  const scoreColor = (s: number) => s >= 0.7 ? "text-emerald-400" : s >= 0.4 ? "text-amber-400" : "text-red-400";

  /* ── Generation progress panel ── */
  const currentStepIdx = stepIndex(genStep);
  const genPercent = genStep === "done" ? 100 : genStep === "error" ? 0 : currentStepIdx >= 0 ? Math.round(((currentStepIdx + 1) / GENERATION_STEPS.length) * 100) : 0;

  return (
    <div className="space-y-3 md:space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-sm md:text-base font-semibold text-slate-300 flex items-center gap-1.5">
            <PenTool className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{casoId ? "Editar Caso" : "Gerar Peça"}</span>
          </h1>
        </div>
        {(savedCasoId || casoId) && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/quero-armas/casos`)}
            className="bg-[#0c0c16] border-[#1a1a2e] text-slate-400 hover:text-slate-300 h-6 md:h-7 text-[10px] shrink-0">
            <FolderOpen className="h-3 w-3 mr-1" /> Casos
          </Button>
        )}
      </div>

      <div className="bg-slate-500/5 border border-slate-500/10 rounded p-2 text-[10px] text-slate-500 flex items-start gap-1.5">
        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
        <span>Toda minuta deve ser revisada por profissional habilitado.</span>
      </div>

      <div className="space-y-3 md:space-y-4 bg-[#0c0c16] border border-[#1a1a2e] rounded p-2.5 md:p-4">
        {/* ── Requerente + Serviço ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-medium">Dados do Requerente</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-500 text-[11px]">Nome completo do requerente *</Label>
              <Input value={nomeRequerente} onChange={e => setNomeRequerente(e.target.value)}
                className="bg-[#08080f] border-[#1a1a2e] text-slate-300 h-9 text-sm" placeholder="Nome completo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-500 text-[11px]">CPF / CNPJ</Label>
              <Input value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)}
                className="bg-[#08080f] border-[#1a1a2e] text-slate-300 h-9 text-sm" placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-500 text-[11px]">Tipo de Peça *</Label>
              <Select value={tipoPeca} onValueChange={setTipoPeca}>
                <SelectTrigger className="bg-[#08080f] border-[#1a1a2e] text-slate-300 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_PECA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Client address ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-medium">Endereço / Localidade</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-500 text-[11px]">CEP</Label>
              <div className="relative">
                <Input value={clienteCep} onChange={e => handleCepChange(e.target.value)} maxLength={9}
                  className="bg-[#08080f] border-[#1a1a2e] text-slate-300 pr-8 h-9 text-sm" placeholder="00000-000" />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {cepStatus === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
                  {cepStatus === "found" && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                  {cepStatus === "not_found" && <XCircle className="h-3.5 w-3.5 text-amber-400" />}
                  {cepStatus === "error" && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                </div>
              </div>
              {cepStatus === "loading" && <span className="text-[10px] text-slate-600">Buscando CEP...</span>}
              {cepStatus === "found" && <span className="text-[10px] text-emerald-400/70">CEP encontrado</span>}
              {cepStatus === "not_found" && <span className="text-[10px] text-amber-400/70">CEP não encontrado</span>}
              {cepStatus === "error" && <span className="text-[10px] text-red-400/70">Erro ao consultar CEP</span>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-500 text-[11px]">Cidade *</Label>
              <Popover open={cidadePopoverOpen} onOpenChange={setCidadePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" aria-expanded={cidadePopoverOpen}
                    disabled={!clienteUf || municipiosLoading}
                    className="w-full justify-between bg-[#08080f] border-[#1a1a2e] text-slate-300 h-9 text-sm font-normal hover:bg-[#0c0c18] hover:text-slate-200">
                    {clienteCidade ? toTitleCase(clienteCidade) : (municipiosLoading ? "Carregando..." : !clienteUf ? "Selecione UF primeiro" : "Selecione a cidade...")}
                    {municipiosLoading ? <Loader2 className="ml-2 h-3.5 w-3.5 shrink-0 animate-spin opacity-50" /> : <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-[#0c0c18] border-[#1a1a2e]" align="start">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Digite para buscar..." className="h-9 text-sm text-slate-300" />
                    <CommandList className="max-h-[240px]">
                      <CommandEmpty className="py-4 text-center text-[11px] text-slate-500">
                        Nenhum município encontrado. Verifique a grafia ou selecione outra UF.
                      </CommandEmpty>
                      <CommandGroup>
                        {municipiosList.map(m => (
                          <CommandItem key={m} value={m} onSelect={() => handleCidadeSelect(m)}
                            className="text-sm text-slate-300 cursor-pointer data-[selected=true]:bg-cyan-500/10 data-[selected=true]:text-cyan-300">
                            <CheckCircle className={`mr-2 h-3.5 w-3.5 ${clienteCidade === m ? "opacity-100 text-emerald-400" : "opacity-0"}`} />
                            {toTitleCase(m)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {!clienteUf && <span className="text-[10px] text-slate-600">Selecione o estado primeiro</span>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-500 text-[11px]">UF *</Label>
              <Select value={clienteUf} onValueChange={handleUfChange}>
                <SelectTrigger className="bg-[#08080f] border-[#1a1a2e] text-slate-300 h-9 text-sm"><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-500 text-[11px]">Endereço</Label>
              <Input value={clienteEndereco} onChange={e => setClienteEndereco(e.target.value)}
                className="bg-[#08080f] border-[#1a1a2e] text-slate-300 h-9 text-sm" placeholder="Rua, número..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-500 text-[11px]">Bairro</Label>
              <Input value={clienteBairro} onChange={e => setClienteBairro(e.target.value)}
                className="bg-[#08080f] border-[#1a1a2e] text-slate-300 h-9 text-sm" placeholder="Bairro" />
            </div>
          </div>

          {/* Circumscription feedback */}
          {circunscricaoStatus === "resolving" && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Resolvendo circunscrição da PF...</div>
          )}
          {circunscricaoStatus === "resolved" && circunscricaoResolvida && (
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded p-2.5 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium"><CheckCircle className="h-3 w-3" /> Unidade PF resolvida</div>
              <div className="text-slate-400"><span className="font-medium">{circunscricaoResolvida.unidade_pf}</span>{circunscricaoResolvida.sigla_unidade && <span className="text-slate-600 ml-1.5">({circunscricaoResolvida.sigla_unidade})</span>}</div>
              <div className="text-slate-600 text-[10px]">{circunscricaoResolvida.municipio_sede}/{circunscricaoResolvida.uf}</div>
            </div>
          )}
          {(circunscricaoStatus === "not_found" || circunscricaoStatus === "error") && (
            <div className={`border rounded p-2.5 text-[11px] flex items-start gap-1.5 ${circunscricaoStatus === "error" ? "bg-red-500/5 border-red-500/10 text-red-400" : "bg-amber-500/5 border-amber-500/10 text-amber-400"}`}>
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <span>{circunscricaoMensagem}</span>
                <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={handleRetryCircunscricao}><RefreshCw className="h-3 w-3 mr-1" /> Tentar</Button>
              </div>
            </div>
          )}
          {circunscricaoStatus === "pending_review" && (
            <div className="bg-amber-500/5 border border-amber-500/10 rounded p-2 text-[10px] text-amber-400 flex items-center gap-1.5">
              <Info className="h-3 w-3" /> {circunscricaoMensagem}
            </div>
          )}
        </div>

        {/* ── Foco ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-slate-500 text-[11px]">Foco Argumentativo</Label>
            <Select value={foco} onValueChange={setFoco}>
              <SelectTrigger className="bg-[#08080f] border-[#1a1a2e] text-slate-300 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{FOCOS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Tempestividade ── */}
        {needsTempestividade && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-amber-500/5 border border-amber-500/10 rounded p-3">
            <div className="space-y-1.5">
              <Label className="text-amber-400/70 text-[11px]">Data da notificação / decisão</Label>
              <Input type="date" value={dataNotificacao} onChange={e => setDataNotificacao(e.target.value)} className="bg-[#08080f] border-[#1a1a2e] text-slate-300 h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-amber-400/70 text-[11px]">Informações sobre prazo</Label>
              <Input value={infoTempestividade} onChange={e => setInfoTempestividade(e.target.value)} className="bg-[#08080f] border-[#1a1a2e] text-slate-300 h-9 text-sm" placeholder="Ex: prazo de 15 dias" />
            </div>
          </div>
        )}

        {/* ── Case description ── */}
        <div className="space-y-1.5">
          <Label className="text-slate-500 text-[11px]">Descrição completa do caso *</Label>
          <Textarea value={entradaCaso} onChange={e => setEntradaCaso(e.target.value)}
            className="bg-[#08080f] border-[#1a1a2e] text-slate-300 min-h-[180px] text-sm"
            placeholder="Descreva detalhadamente os fatos, a situação jurídica, o histórico do caso..." />
        </div>

        {/* ── Auxiliary Documents ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-medium">Documentos Auxiliares</span>
              {docTotal > 0 && (
                <span className="text-[9px] bg-[#14142a] text-slate-500 px-2 py-0.5 rounded">
                  {docDone}/{docTotal}
                  {docFailed > 0 && <span className="text-red-400 ml-1">• {docFailed} falha(s)</span>}
                </span>
              )}
            </div>
            {docTotal > 0 && (
              <button onClick={() => setShowDocList(!showDocList)} className="text-slate-600 hover:text-slate-400">
                {showDocList ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg,.webp" className="hidden"
            onChange={e => { handleAddFiles(e.target.files); e.target.value = ""; }} />
          <Button type="button" variant="outline" size="sm" className="bg-[#08080f] border-[#1a1a2e] text-slate-500 hover:text-slate-300 h-7 text-[11px]"
            onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1.5" /> Anexar documentos
          </Button>

          {docTotal > 0 && showDocList && (
            <div className="space-y-1.5">
              {arquivosAuxiliares.map((arq, i) => (
                <div key={i} className={`bg-[#08080f] border rounded p-2.5 space-y-1.5 ${
                  arq.stage === "done" ? "border-emerald-500/10" : arq.stage === "failed" ? "border-red-500/10" : "border-[#1a1a2e]"
                }`}>
                  <div className="flex items-center gap-2">
                    <FileText className={`h-3.5 w-3.5 shrink-0 ${stageColor(arq.stage)}`} />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="text-[12px] text-slate-400 truncate">{arq.nome}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] ${stageColor(arq.stage)}`}>{getDisplayLabel(arq.stage, arq.etapaAtual)}</span>
                        {!["pending", "done", "failed"].includes(arq.stage) && <ElapsedTime startedAt={arq.startedAt} />}
                        {arq.tipo && arq.stage !== "done" && arq.stage !== "failed" && arq.stage !== "pending" && DOC_COMPLEXITY[arq.tipo] && (
                          <span className="text-[9px] text-slate-600">{COMPLEXITY_LABEL[DOC_COMPLEXITY[arq.tipo]]}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {arq.stage === "pending" && (
                        <Select value={arq.tipo || undefined} onValueChange={v => handleChangeTipoDoc(i, v)}>
                          <SelectTrigger className="h-6 text-[10px] bg-[#0c0c16] border-[#1a1a2e] text-slate-500 w-44">
                            <SelectValue placeholder="Selecionar opção" />
                          </SelectTrigger>
                          <SelectContent>{TIPOS_DOC_AUXILIAR.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                      {arq.stage !== "pending" && arq.tipo && (
                        <span className="text-[9px] text-slate-600 max-w-[120px] truncate">
                          {TIPOS_DOC_AUXILIAR.find(t => t.value === arq.tipo)?.label || arq.tipo}
                        </span>
                      )}
                      {arq.stage === "failed" && (
                        <Button type="button" variant="outline" size="sm" className="h-5 text-[9px] border-red-500/20 text-red-400" onClick={() => handleRetryDoc(i)}>
                          <RefreshCw className="h-2.5 w-2.5 mr-1" /> Retry
                        </Button>
                      )}
                      {arq.stage === "done" && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                      {!["queued", "uploading", "saved", "extracting", "processing"].includes(arq.stage) && (
                        <button onClick={() => handleRemoveFile(i)} className="text-slate-700 hover:text-red-400"><X className="h-3 w-3" /></button>
                      )}
                    </div>
                  </div>
                  {!["pending", "done"].includes(arq.stage) && <Progress value={stageProgress(arq.stage)} className="h-1" />}
                  {arq.error && <div className="text-[9px] text-red-400/80 bg-red-500/5 rounded px-2 py-0.5">{arq.error}</div>}
                  {!["pending", "done", "failed"].includes(arq.stage) && (
                    <div className="text-[9px] text-slate-600 italic">O processamento continua mesmo se você sair da tela.</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Doc status indicator */}
        {docTotal > 0 && (
          <div className={`flex items-center flex-wrap gap-2 text-xs px-3 py-1.5 rounded border ${
            docFailed > 0 ? "border-red-500/30 bg-red-500/5 text-red-400" :
            docActive > 0 ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-400" :
            hasDocsUnclassified ? "border-amber-500/30 bg-amber-500/5 text-amber-400" :
            docDone === docTotal ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" :
            "border-slate-700 bg-slate-800/50 text-slate-400"
          }`}>
            {docDone === docTotal && docTotal > 0 && <CheckCircle className="h-3.5 w-3.5" />}
            {docFailed > 0 && <XCircle className="h-3.5 w-3.5" />}
            {docActive > 0 && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {hasDocsUnclassified && !docActive && !docFailed && <AlertTriangle className="h-3.5 w-3.5" />}
            <span>{docDone}/{docTotal} documentos prontos</span>
            {hasDocsUnclassified && <span className="text-amber-400 font-medium">· {arquivosAuxiliares.filter(a => a.stage === "pending").length} aguardando classificação</span>}
            {docFailed > 0 && <span className="text-red-400 font-medium">· {docFailed} com erro</span>}
            {docActive > 0 && <span>· {docActive} processando</span>}
          </div>
        )}

        {/* Generation blocked warning */}
        {docTotal > 0 && (hasDocsFailed || hasDocsPending || hasDocsUnclassified) && (
          <div className="text-[10px] text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded px-3 py-1.5 flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              {hasDocsUnclassified ? "Classifique o tipo de cada documento para iniciar o processamento. " : ""}
              {hasDocsFailed ? "Reprocesse ou remova os documentos com erro. " : ""}
              {hasDocsPending ? "Aguarde o processamento dos documentos. " : ""}
              Geração bloqueada até todos os documentos estarem concluídos.
            </span>
          </div>
        )}

        <Button onClick={gerar} disabled={!canGenerate} className="bg-[#14142a] hover:bg-[#1a1a35] text-slate-300 border border-[#1a1a2e] w-full md:w-auto h-9 text-sm disabled:opacity-40">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Gerar Peça
        </Button>
      </div>

      {/* ── Drafting View (replaces old progress + result panels) ── */}
      <DraftingView
        visible={showDraftingView}
        pipelineStep={draftingStep}
        streamedText={streamedText}
        isStreaming={isStreaming}
        error={genError}
        startedAt={genStartedAt}
        result={resultado}
        savedCasoId={savedCasoId}
        onRetry={() => { setGenStep("idle"); setGenError(""); setShowDraftingView(false); setStreamedText(""); gerar(); }}
        onCopy={copiarMinuta}
        onExportDocx={exportarDocx}
        onOpenCase={() => savedCasoId && navigate(`/quero-armas/gerar-peca?caso=${savedCasoId}`)}
      />
    </div>
  );
}
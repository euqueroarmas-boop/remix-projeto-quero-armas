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

/* ── Types ── */
type DocUploadStage = "pending" | "uploading" | "saved" | "extracting" | "processing" | "done" | "failed";

interface ArquivoAuxiliar {
  file: File;
  nome: string;
  tipo: string;
  stage: DocUploadStage;
  docId?: string;
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
  uploading: "Enviando arquivo...",
  saved: "Arquivo salvo",
  extracting: "Extraindo texto...",
  processing: "Processando documento...",
  done: "Concluído",
  failed: "Falhou",
};

function stageProgress(s: DocUploadStage): number {
  return { pending: 0, uploading: 20, saved: 40, extracting: 60, processing: 80, done: 100, failed: 100 }[s];
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

  // Municipality autocomplete
  const [municipiosList, setMunicipiosList] = useState<string[]>([]);
  const [municipiosLoading, setMunicipiosLoading] = useState(false);
  const [cidadePopoverOpen, setCidadePopoverOpen] = useState(false);

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
  const [resultado, setResultado] = useState<any>(null);
  const [genStep, setGenStep] = useState<GenerationStep>("idle");
  const [genError, setGenError] = useState("");
  const [genStartedAt, setGenStartedAt] = useState<number | undefined>();
  const [savedCasoId, setSavedCasoId] = useState<string | null>(null);

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
      cepTimeoutRef.current = setTimeout(() => void doCepLookup(digits), 400);
    }
  };

  const doCepLookup = async (digits: string) => {
    setCepStatus("loading");
    try {
      const data = await lookupCep(digits);
      if (!data) { setCepStatus("not_found"); return; }
      setCepStatus("found");
      if (data.state) setClienteUf(data.state);
      if (data.street) setClienteEndereco(data.street);
      if (data.neighborhood) setClienteBairro(data.neighborhood);
      // City from CEP: set it and resolve circumscription directly
      if (data.city && data.state) {
        setClienteCidade(data.city);
        void resolverCircunscricao(data.city, data.state);
      }
    } catch { setCepStatus("error"); }
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
    setMunicipiosLoading(true);
    try {
      const { data, error } = await supabase.rpc("qa_listar_municipios_por_uf" as any, { p_uf: uf });
      if (!error && data) {
        setMunicipiosList((data as any[]).map((r: any) => r.municipio));
      } else {
        setMunicipiosList([]);
      }
    } catch {
      setMunicipiosList([]);
    } finally {
      setMunicipiosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clienteUf) loadMunicipios(clienteUf);
    else setMunicipiosList([]);
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
    const newFiles: ArquivoAuxiliar[] = Array.from(files).map(f => ({
      file: f, nome: f.name, tipo: "", stage: "pending" as DocUploadStage,
    }));
    setArquivosAuxiliares(prev => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setArquivosAuxiliares(prev => prev.filter((_, i) => i !== index));
  };

  const handleChangeTipoDoc = (index: number, tipo: string) => {
    if (!tipo) return;
    setArquivosAuxiliares(prev => prev.map((a, i) => i === index ? { ...a, tipo } : a));
    // Immediately trigger upload+processing after classification
    const arq = arquivosAuxiliares[index];
    if (arq && arq.stage === "pending") {
      setTimeout(() => {
        void uploadSingleDoc({ ...arq, tipo }, index);
      }, 50);
    }
  };

  const setDocStage = (index: number, stage: DocUploadStage, extra?: Partial<ArquivoAuxiliar>) => {
    setArquivosAuxiliares(prev => prev.map((a, i) => i === index ? { ...a, stage, ...extra } : a));
  };

  const uploadSingleDoc = async (arq: ArquivoAuxiliar, index: number): Promise<string | null> => {
    if (arq.stage === "done" && arq.docId) return arq.docId;
    setDocStage(index, "uploading", { startedAt: Date.now(), error: undefined });
    try {
      const safeName = sanitizeFileName(arq.file.name);
      const storagePath = `auxiliares/${Date.now()}_${crypto.randomUUID().slice(0,8)}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("qa-documentos").upload(storagePath, arq.file);
      if (upErr) throw upErr;
      setDocStage(index, "saved");
      const { data: docData, error: dbErr } = await supabase.from("qa_documentos_conhecimento").insert({
        titulo: arq.nome, nome_arquivo: arq.file.name, storage_path: storagePath,
        tipo_documento: arq.tipo, tipo_origem: "upload", papel_documento: "auxiliar_caso",
        categoria: arq.tipo, status_processamento: "pendente", status_validacao: "validado",
        ativo: true, ativo_na_ia: false, caso_id: nomeRequerente || null,
        enviado_por: user?.id || null, mime_type: arq.file.type || null, tamanho_bytes: arq.file.size,
      }).select("id").single();
      if (dbErr) throw dbErr;
      setDocStage(index, "extracting");
      await supabase.functions.invoke("qa-ingest-document", { body: { storage_path: storagePath, user_id: user?.id } });
      setDocStage(index, "processing");
      const docId = docData.id;
      const pollStart = Date.now();
      while (Date.now() - pollStart < 60000) {
        await new Promise(r => setTimeout(r, 3000));
        const { data: check } = await supabase.from("qa_documentos_conhecimento").select("status_processamento").eq("id", docId).maybeSingle();
        if (check?.status_processamento === "concluido") { setDocStage(index, "done", { docId }); return docId; }
        if (check?.status_processamento === "erro" || check?.status_processamento === "texto_invalido") throw new Error(`Extração falhou: ${check.status_processamento}`);
      }
      setDocStage(index, "done", { docId });
      return docId;
    } catch (err: any) {
      setDocStage(index, "failed", { error: err.message || "Falha no processamento" });
      return null;
    }
  };

  const uploadAllAuxiliares = async (): Promise<string[]> => {
    const results = await Promise.all(arquivosAuxiliares.map((arq, i) => uploadSingleDoc(arq, i)));
    return results.filter((id): id is string => id !== null);
  };

  const handleRetryDoc = async (index: number) => {
    const arq = arquivosAuxiliares[index];
    if (!arq) return;
    const id = await uploadSingleDoc(arq, index);
    if (id) toast.success(`${arq.nome} processado com sucesso`);
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
  const canGenerate = !loading && !hasDocsPending && !hasDocsFailed && !hasDocsUnclassified;

  const gerar = async () => {
    if (!nomeRequerente.trim()) { toast.error("Informe o nome completo do requerente"); return; }
    if (!entradaCaso.trim()) { toast.error("Descreva o caso"); return; }
    if (!clienteCidade.trim() || !clienteUf.trim()) { toast.error("Informe a cidade e o estado do cliente."); return; }

    setLoading(true);
    setResultado(null);
    setGenError("");
    setGenStartedAt(Date.now());
    setSavedCasoId(null);

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

      // Step 2: Collect already-processed doc IDs (upload happened on classification)
      let auxiliarDocIds: string[] = [];
      if (arquivosAuxiliares.length > 0) {
        setGenStep("uploading_docs");
        auxiliarDocIds = arquivosAuxiliares.filter(a => a.stage === "done" && a.docId).map(a => a.docId!);
        await new Promise(r => setTimeout(r, 300));

        const unfinished = arquivosAuxiliares.filter(a => a.stage !== "done");
        if (unfinished.length > 0) {
          const msg = `Geração bloqueada: ${unfinished.length} documento(s) não foram processados. Classifique, reprocesse ou remova antes de gerar.`;
          try {
            await supabase.from("qa_logs_auditoria" as any).insert({
              usuario_id: user?.id, entidade: "qa_casos", entidade_id: casoId || "new",
              acao: "geracao_bloqueada_anexos_incompletos",
              detalhes_json: { total: arquivosAuxiliares.length, concluidos: auxiliarDocIds.length, pendentes: unfinished.length },
            });
          } catch { /* non-critical */ }
          throw new Error(msg);
        }
      }

      // Step 4-7: Generate
      setGenStep("building_context");
      await new Promise(r => setTimeout(r, 300));
      setGenStep("recovering_sources");
      await new Promise(r => setTimeout(r, 300));
      setGenStep("generating_draft");

      const { data, error } = await supabase.functions.invoke("qa-gerar-peca", {
        body: {
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
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGenStep("validating");
      await new Promise(r => setTimeout(r, 400));

      setResultado(data);

      // Step 8: Save case
      setGenStep("saving_case");
      const sId = await saveCaso(data, auxiliarDocIds, circ);
      setSavedCasoId(sId);

      setGenStep("done");
      toast.success("Peça gerada e caso salvo com sucesso");
    } catch (err: any) {
      setGenStep("error");
      setGenError(err.message || "Erro na geração");
      toast.error(err.message || "Erro na geração");
    } finally {
      setLoading(false);
    }
  };

  const copiarMinuta = () => {
    if (resultado?.minuta_gerada) {
      navigator.clipboard.writeText(resultado.minuta_gerada);
      toast.success("Minuta copiada");
    }
  };

  const exportarDocx = async () => {
    if (!resultado?.geracao_id) return;
    try {
      const { data, error } = await supabase.functions.invoke("qa-export-docx", {
        body: { geracao_id: resultado.geracao_id, variables: { cliente_nome: nomeRequerente } },
      });
      if (error) throw error;
      const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${nomeRequerente || "peca"}.docx`; a.click();
      URL.revokeObjectURL(url);

      // Update case with docx path
      if (savedCasoId || casoId) {
        await supabase.from("qa_casos" as any).update({ docx_path: `exported_${resultado.geracao_id}.docx`, updated_at: new Date().toISOString() }).eq("id", savedCasoId || casoId);
      }
      toast.success("DOCX exportado");
    } catch (err: any) { toast.error(err.message || "Erro ao exportar DOCX"); }
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

          <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" className="hidden"
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
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] ${stageColor(arq.stage)}`}>{STAGE_LABELS[arq.stage]}</span>
                        {!["pending", "done", "failed"].includes(arq.stage) && <ElapsedTime startedAt={arq.startedAt} />}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {arq.stage === "pending" && (
                        <Select value={arq.tipo} onValueChange={v => handleChangeTipoDoc(i, v)}>
                          <SelectTrigger className="h-6 text-[10px] bg-[#0c0c16] border-[#1a1a2e] text-slate-500 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>{TIPOS_DOC_AUXILIAR.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                      {arq.stage === "failed" && (
                        <Button type="button" variant="outline" size="sm" className="h-5 text-[9px] border-red-500/20 text-red-400" onClick={() => handleRetryDoc(i)}>
                          <RefreshCw className="h-2.5 w-2.5 mr-1" /> Retry
                        </Button>
                      )}
                      {arq.stage === "done" && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                      {!["uploading", "saved", "extracting", "processing"].includes(arq.stage) && (
                        <button onClick={() => handleRemoveFile(i)} className="text-slate-700 hover:text-red-400"><X className="h-3 w-3" /></button>
                      )}
                    </div>
                  </div>
                  {!["pending", "done"].includes(arq.stage) && <Progress value={stageProgress(arq.stage)} className="h-1" />}
                  {arq.error && <div className="text-[9px] text-red-400/80 bg-red-500/5 rounded px-2 py-0.5">{arq.error}</div>}
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

      {/* ── Generation Progress Panel ── */}
      {genStep !== "idle" && (
        <div className="bg-[#0c0c16] border border-[#1a1a2e] rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-medium">Progresso</span>
            <div className="flex items-center gap-2">
              <ElapsedTime startedAt={genStartedAt} />
              {genStep === "done" && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
              {genStep === "error" && <XCircle className="h-3.5 w-3.5 text-red-400" />}
            </div>
          </div>
          <Progress value={genPercent} className="h-1.5" />
          <div className="space-y-1">
            {GENERATION_STEPS.map((step, idx) => {
              const isActive = step.key === genStep;
              const isDone = currentStepIdx > idx || genStep === "done";
              return (
                <div key={step.key} className={`flex items-center gap-2 text-[11px] py-0.5 px-2 rounded ${
                  isActive ? "text-slate-300" : isDone ? "text-emerald-400/60" : "text-slate-700"
                }`}>
                  {isDone && !isActive ? <CheckCircle className="h-3 w-3 shrink-0" /> : isActive ? <Loader2 className="h-3 w-3 animate-spin shrink-0" /> : <div className="h-3 w-3 rounded-full border border-slate-800 shrink-0" />}
                  <span>{step.label}</span>
                  {isActive && step.key === "uploading_docs" && docTotal > 0 && <span className="text-[9px] text-slate-600 ml-auto">{docDone}/{docTotal}</span>}
                </div>
              );
            })}
          </div>
          {docTotal > 0 && (
            <div className="text-[9px] text-slate-600 border-t border-[#1a1a2e] pt-2">
              Docs: {docTotal} anexados • {docDone} ok{docFailed > 0 && <span className="text-red-400"> • {docFailed} falha(s)</span>}
            </div>
          )}
          {genError && (
            <div className="bg-red-500/5 border border-red-500/10 rounded p-2.5 text-[11px] text-red-400 space-y-2">
              <div className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> Erro</div>
              <p className="text-[10px]">{genError}</p>
              <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => { setGenStep("idle"); setGenError(""); gerar(); }}>
                <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Case Saved Confirmation ── */}
      {genStep === "done" && savedCasoId && (
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="text-[12px] text-emerald-400 font-medium">Caso salvo com sucesso</div>
              <div className="text-[9px] text-slate-600 font-mono">ID: {savedCasoId.slice(0, 8)}...</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/quero-armas/gerar-peca?caso=${savedCasoId}`)}
              className="h-7 text-[10px] border-emerald-500/20 text-emerald-400">
              <FolderOpen className="h-3 w-3 mr-1" /> Abrir Caso
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/quero-armas/casos")}
              className="h-7 text-[10px] border-[#1a1a2e] text-slate-400">
              Ver Todos
            </Button>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {resultado && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-[#0c0c16] border border-[#1a1a2e] rounded p-3">
            <div className="text-center">
              <div className={`text-lg font-semibold font-mono ${scoreColor(resultado.score_confianca)}`}>
                {(resultado.score_confianca * 100).toFixed(0)}%
              </div>
              <div className="text-[9px] text-slate-600 uppercase tracking-wider">Confiança</div>
            </div>
            <div className="flex-1 text-[11px] text-slate-500">
              {resultado.fontes_utilizadas?.length || 0} fontes • {resultado.fontes_utilizadas?.filter((f: any) => f.validada).length || 0} validadas
              {resultado.circunscricao_utilizada && (
                <div className="text-emerald-400/60 mt-0.5 text-[10px]">✓ {resultado.circunscricao_utilizada.unidade_pf}</div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={copiarMinuta} className="bg-[#08080f] border-[#1a1a2e] text-slate-400 h-7 text-[10px]">
              Copiar
            </Button>
            <Button size="sm" onClick={exportarDocx} className="bg-[#14142a] hover:bg-[#1a1a35] text-slate-300 border border-[#1a1a2e] h-7 text-[10px]">
              <Download className="h-3 w-3 mr-1" /> DOCX
            </Button>
          </div>

          {resultado.fontes_utilizadas?.length > 0 && (
            <div className="bg-[#0c0c16] border border-[#1a1a2e] rounded p-3">
              <span className="text-[9px] text-slate-600 uppercase tracking-[0.15em]">Fontes</span>
              <div className="space-y-0.5 mt-2">
                {resultado.fontes_utilizadas.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    {f.tipo === "norma" && <Scale className="h-3 w-3 text-emerald-400" />}
                    {f.tipo === "jurisprudencia" && <Gavel className="h-3 w-3 text-purple-400" />}
                    {f.tipo === "documento" && <BookOpen className="h-3 w-3 text-blue-400" />}
                    {f.tipo === "referencia_aprovada" && <CheckCircle className="h-3 w-3 text-slate-400" />}
                    <span className="text-slate-400">{f.titulo}</span>
                    <span className="text-slate-700">• {f.referencia}</span>
                    {f.validada && <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#0c0c16] border border-[#1a1a2e] rounded p-4">
            <span className="text-[9px] text-slate-600 uppercase tracking-[0.15em]">Minuta</span>
            <div className="text-[12px] text-slate-300 whitespace-pre-wrap leading-relaxed font-serif mt-2">
              {resultado.minuta_gerada}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

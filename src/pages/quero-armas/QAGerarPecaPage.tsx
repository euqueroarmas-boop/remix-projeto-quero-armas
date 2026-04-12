import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  PenTool, Send, Loader2, AlertTriangle, Download, CheckCircle, Scale, Gavel,
  BookOpen, MapPin, Building2, Info, Paperclip, FileText, X, Upload, RefreshCw,
  Search, ChevronDown, ChevronUp, XCircle, Clock,
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
  | "done"
  | "error";

const GENERATION_STEPS: { key: GenerationStep; label: string }[] = [
  { key: "resolving_circumscription", label: "Resolvendo circunscrição da PF" },
  { key: "uploading_docs", label: "Enviando documentos auxiliares" },
  { key: "extracting_docs", label: "Extraindo documentos auxiliares" },
  { key: "building_context", label: "Montando contexto do caso" },
  { key: "recovering_sources", label: "Recuperando fontes jurídicas" },
  { key: "generating_draft", label: "Gerando minuta" },
  { key: "validating", label: "Validando qualidade" },
];

function stepIndex(s: GenerationStep): number {
  const idx = GENERATION_STEPS.findIndex(g => g.key === s);
  return idx === -1 ? -1 : idx;
}

/* ── Constants ── */
const CIRCUNSCRICAO_TIMEOUT_MS = 12000;

const TIPOS_DOC_AUXILIAR = [
  { value: "boletim_ocorrencia", label: "Boletim de Ocorrência" },
  { value: "laudo_medico", label: "Laudo Médico" },
  { value: "laudo_psiquiatrico", label: "Laudo Psiquiátrico" },
  { value: "laudo_psicologico", label: "Laudo Psicológico" },
  { value: "notificacao", label: "Notificação" },
  { value: "indeferimento", label: "Indeferimento" },
  { value: "comprovante", label: "Comprovante" },
  { value: "certidao", label: "Certidão" },
  { value: "documento_pessoal", label: "Documento Pessoal" },
  { value: "declaracao", label: "Declaração" },
  { value: "relatorio", label: "Relatório" },
  { value: "decisao_administrativa", label: "Decisão Administrativa" },
  { value: "outro", label: "Outro documento de suporte" },
];

const TIPOS_PECA = [
  { value: "defesa_posse_arma", label: "Defesa para Posse de Arma" },
  { value: "defesa_porte_arma", label: "Defesa para Porte de Arma" },
  { value: "recurso_administrativo", label: "Recurso Administrativo" },
  { value: "resposta_a_notificacao", label: "Resposta à Notificação" },
];

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
  pending: "Aguardando",
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
  const { lookupCep, cepLoading } = useBrasilApiLookup();

  // Form fields
  const [casoTitulo, setCasoTitulo] = useState("");
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

  // CEP
  const [cepStatus, setCepStatus] = useState<CepStatus>("idle");
  const cepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const needsTempestividade = tipoPeca === "recurso_administrativo" || tipoPeca === "resposta_a_notificacao";

  // Doc counters
  const docTotal = arquivosAuxiliares.length;
  const docDone = arquivosAuxiliares.filter(a => a.stage === "done").length;
  const docFailed = arquivosAuxiliares.filter(a => a.stage === "failed").length;
  const docActive = arquivosAuxiliares.filter(a => !["pending", "done", "failed"].includes(a.stage)).length;

  /* ── CEP auto-lookup ── */
  const handleCepChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    // Format as 00000-000
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
      if (!data) {
        setCepStatus("not_found");
        return;
      }
      setCepStatus("found");
      if (data.city) setClienteCidade(data.city);
      if (data.state) setClienteUf(data.state);
      if (data.street) setClienteEndereco(data.street);
      if (data.neighborhood) setClienteBairro(data.neighborhood);

      // Auto-resolve circumscription
      if (data.city && data.state) {
        void resolverCircunscricao(data.city, data.state);
      }
    } catch {
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
        setCircunscricaoResolvida(null);
        setCircunscricaoStatus("error");
        setCircunscricaoMensagem("Erro ao resolver a circunscrição da PF. Tente novamente.");
        void logSistema({ tipo: "erro", status: "error", mensagem: "Erro circunscrição PF", payload: { cidade: c, uf: u, detalhe: error.message, modulo: "quero-armas" }, user_id: user?.id });
        return null;
      }

      if (!data || data.length === 0) {
        setCircunscricaoResolvida(null);
        setCircunscricaoStatus("not_found");
        setCircunscricaoMensagem("Circunscrição não encontrada para o município/UF informado.");
        return null;
      }

      const resultado = data[0] as CircunscricaoResolvida;
      setCircunscricaoResolvida(resultado);
      setCircunscricaoStatus("resolved");
      setCircunscricaoMensagem("");
      return resultado;
    } catch (err: any) {
      if (requestId !== circunscricaoRequestRef.current) return null;
      const timeout = err?.message === "circunscricao_timeout";
      setCircunscricaoResolvida(null);
      setCircunscricaoStatus("error");
      setCircunscricaoMensagem(timeout
        ? "A resolução excedeu o tempo limite. Tente novamente ou siga com revisão pendente."
        : "Erro ao resolver a circunscrição da PF. Tente novamente.");
      void logSistema({ tipo: "erro", status: "warning", mensagem: timeout ? "Timeout circunscrição PF" : "Erro circunscrição PF", payload: { cidade: c, uf: u, detalhe: err?.message, modulo: "quero-armas" }, user_id: user?.id });
      return null;
    }
  };

  const handleUfChange = async (uf: string) => {
    const u = uf.trim().toUpperCase();
    setClienteUf(u);
    resetCircunscricaoState();
    if (clienteCidade.trim() && u) await resolverCircunscricao(clienteCidade, u);
  };

  const handleCidadeBlur = async () => {
    if (clienteCidade.trim() && clienteUf) await resolverCircunscricao(clienteCidade, clienteUf);
  };

  const handleRetryCircunscricao = async () => {
    if (!clienteCidade.trim() || !clienteUf.trim()) {
      setCircunscricaoStatus("error");
      setCircunscricaoMensagem("Informe cidade e UF para tentar novamente.");
      return;
    }
    await resolverCircunscricao(clienteCidade, clienteUf);
  };

  /* ── Auxiliary documents ── */
  const handleAddFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles: ArquivoAuxiliar[] = Array.from(files).map(f => ({
      file: f, nome: f.name, tipo: "outro", stage: "pending" as DocUploadStage,
    }));
    setArquivosAuxiliares(prev => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setArquivosAuxiliares(prev => prev.filter((_, i) => i !== index));
  };

  const handleChangeTipoDoc = (index: number, tipo: string) => {
    setArquivosAuxiliares(prev => prev.map((a, i) => i === index ? { ...a, tipo } : a));
  };

  const setDocStage = (index: number, stage: DocUploadStage, extra?: Partial<ArquivoAuxiliar>) => {
    setArquivosAuxiliares(prev => prev.map((a, i) => i === index ? { ...a, stage, ...extra } : a));
  };

  const uploadSingleDoc = async (arq: ArquivoAuxiliar, index: number): Promise<string | null> => {
    if (arq.stage === "done" && arq.docId) return arq.docId;

    setDocStage(index, "uploading", { startedAt: Date.now(), error: undefined });
    try {
      const storagePath = `auxiliares/${Date.now()}_${arq.file.name}`;
      const { error: upErr } = await supabase.storage.from("qa-documentos").upload(storagePath, arq.file);
      if (upErr) throw upErr;

      setDocStage(index, "saved");

      const { data: docData, error: dbErr } = await supabase.from("qa_documentos_conhecimento").insert({
        titulo: arq.nome, nome_arquivo: arq.file.name, storage_path: storagePath,
        tipo_documento: arq.tipo, tipo_origem: "upload", papel_documento: "auxiliar_caso",
        categoria: arq.tipo, status_processamento: "pendente", status_validacao: "validado",
        ativo: true, ativo_na_ia: false, caso_id: casoTitulo || null,
        enviado_por: user?.id || null, mime_type: arq.file.type || null, tamanho_bytes: arq.file.size,
      }).select("id").single();
      if (dbErr) throw dbErr;

      setDocStage(index, "extracting");

      await supabase.functions.invoke("qa-ingest-document", {
        body: { storage_path: storagePath, user_id: user?.id },
      });

      setDocStage(index, "processing");

      // Poll for extraction completion (max 60s)
      const docId = docData.id;
      const pollStart = Date.now();
      while (Date.now() - pollStart < 60000) {
        await new Promise(r => setTimeout(r, 3000));
        const { data: check } = await supabase
          .from("qa_documentos_conhecimento")
          .select("status_processamento")
          .eq("id", docId)
          .maybeSingle();
        if (check?.status_processamento === "concluido") {
          setDocStage(index, "done", { docId });
          return docId;
        }
        if (check?.status_processamento === "erro" || check?.status_processamento === "texto_invalido") {
          throw new Error(`Extração falhou: ${check.status_processamento}`);
        }
      }

      // Timeout — still proceed
      setDocStage(index, "done", { docId });
      return docId;
    } catch (err: any) {
      setDocStage(index, "failed", { error: err.message || "Falha no processamento" });
      return null;
    }
  };

  const uploadAllAuxiliares = async (): Promise<string[]> => {
    const results = await Promise.all(
      arquivosAuxiliares.map((arq, i) => uploadSingleDoc(arq, i))
    );
    return results.filter((id): id is string => id !== null);
  };

  const handleRetryDoc = async (index: number) => {
    const arq = arquivosAuxiliares[index];
    if (!arq) return;
    const id = await uploadSingleDoc(arq, index);
    if (id) toast.success(`${arq.nome} processado com sucesso`);
  };

  /* ── Generation ── */
  const gerar = async () => {
    if (!entradaCaso.trim()) { toast.error("Descreva o caso"); return; }
    if (!clienteCidade.trim() || !clienteUf.trim()) {
      toast.error("Informe a cidade e o estado do cliente."); return;
    }

    setLoading(true);
    setResultado(null);
    setGenError("");
    setGenStartedAt(Date.now());

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

      // Step 2-3: Upload docs
      let auxiliarDocIds: string[] = [];
      if (arquivosAuxiliares.length > 0) {
        setGenStep("uploading_docs");
        auxiliarDocIds = await uploadAllAuxiliares();
        setGenStep("extracting_docs");
        // Small delay to show extracting step visually
        await new Promise(r => setTimeout(r, 500));
      }

      // Step 4-7: Generate
      setGenStep("building_context");
      await new Promise(r => setTimeout(r, 300));

      setGenStep("recovering_sources");
      await new Promise(r => setTimeout(r, 300));

      setGenStep("generating_draft");

      const { data, error } = await supabase.functions.invoke("qa-gerar-peca", {
        body: {
          usuario_id: user?.id, caso_titulo: casoTitulo, entrada_caso: entradaCaso,
          tipo_peca: tipoPeca, foco,
          cliente_cidade: clienteCidade.trim(), cliente_uf: clienteUf.trim(),
          cliente_endereco: clienteEndereco.trim() || null, cliente_cep: clienteCep.trim() || null,
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
      setGenStep("done");
      toast.success("Peça gerada com sucesso");
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
        body: { geracao_id: resultado.geracao_id, variables: { cliente_nome: casoTitulo } },
      });
      if (error) throw error;
      const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${casoTitulo || "peca"}.docx`; a.click();
      URL.revokeObjectURL(url);
      toast.success("DOCX exportado");
    } catch (err: any) { toast.error(err.message || "Erro ao exportar DOCX"); }
  };

  const scoreColor = (s: number) => s >= 0.7 ? "text-emerald-400" : s >= 0.4 ? "text-amber-400" : "text-red-400";

  /* ── Generation progress panel ── */
  const currentStepIdx = stepIndex(genStep);
  const genPercent = genStep === "done" ? 100 : genStep === "error" ? 0 : currentStepIdx >= 0 ? Math.round(((currentStepIdx + 1) / GENERATION_STEPS.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <PenTool className="h-6 w-6 text-amber-500" /> Gerar Peça Jurídica
        </h1>
        <p className="text-sm text-slate-500 mt-1">Geração assistida com base viva de conhecimento</p>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400/80 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>A peça será gerada com base exclusiva nas fontes cadastradas. Toda minuta deve ser revisada por profissional habilitado antes do uso.</span>
      </div>

      <div className="space-y-4 bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
        {/* Title + Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Título do Caso</Label>
            <Input value={casoTitulo} onChange={e => setCasoTitulo(e.target.value)}
              className="bg-[#0c0c14] border-slate-700 text-slate-100" placeholder="Ex: Defesa para registro de arma" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Tipo de Peça</Label>
            <Select value={tipoPeca} onValueChange={setTipoPeca}>
              <SelectTrigger className="bg-[#0c0c14] border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_PECA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Client address */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-cyan-400" />
            <Label className="text-slate-300 text-sm font-medium">Endereço do Cliente / Caso</Label>
            <span className="text-[10px] text-slate-600 ml-1">(resolução automática da unidade PF)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CEP with auto-lookup */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">CEP</Label>
              <div className="relative">
                <Input
                  value={clienteCep}
                  onChange={e => handleCepChange(e.target.value)}
                  maxLength={9}
                  className="bg-[#0c0c14] border-slate-700 text-slate-100 pr-8"
                  placeholder="00000-000"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {cepStatus === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />}
                  {cepStatus === "found" && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                  {cepStatus === "not_found" && <XCircle className="h-3.5 w-3.5 text-amber-400" />}
                  {cepStatus === "error" && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                </div>
              </div>
              {cepStatus === "loading" && <span className="text-[10px] text-cyan-400/70">Buscando CEP...</span>}
              {cepStatus === "found" && <span className="text-[10px] text-emerald-400/70">CEP encontrado</span>}
              {cepStatus === "not_found" && <span className="text-[10px] text-amber-400/70">CEP não encontrado</span>}
              {cepStatus === "error" && <span className="text-[10px] text-red-400/70">Erro ao consultar CEP</span>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Cidade do cliente *</Label>
              <Input value={clienteCidade} onChange={e => { setClienteCidade(e.target.value); resetCircunscricaoState(); }}
                onBlur={handleCidadeBlur}
                className="bg-[#0c0c14] border-slate-700 text-slate-100" placeholder="Ex: São Paulo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Estado (UF) *</Label>
              <Select value={clienteUf} onValueChange={handleUfChange}>
                <SelectTrigger className="bg-[#0c0c14] border-slate-700 text-slate-300">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Endereço (logradouro)</Label>
              <Input value={clienteEndereco} onChange={e => setClienteEndereco(e.target.value)}
                className="bg-[#0c0c14] border-slate-700 text-slate-100" placeholder="Rua, número..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Bairro</Label>
              <Input value={clienteBairro} onChange={e => setClienteBairro(e.target.value)}
                className="bg-[#0c0c14] border-slate-700 text-slate-100" placeholder="Bairro" />
            </div>
          </div>

          {/* Circumscription feedback */}
          {circunscricaoStatus === "resolving" && (
            <div className="flex items-center gap-2 text-xs text-cyan-400/70">
              <Loader2 className="h-3 w-3 animate-spin" /> Resolvendo circunscrição da PF...
            </div>
          )}
          {circunscricaoStatus === "resolved" && circunscricaoResolvida && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle className="h-3.5 w-3.5" /> Unidade PF competente resolvida
              </div>
              <div className="text-slate-300">
                <span className="font-medium">{circunscricaoResolvida.unidade_pf}</span>
                {circunscricaoResolvida.sigla_unidade && <span className="text-slate-500 ml-1.5">({circunscricaoResolvida.sigla_unidade})</span>}
              </div>
              <div className="text-slate-500">
                {circunscricaoResolvida.tipo_unidade === "superintendencia" ? "Superintendência Regional" : "Delegacia"} — Sede: {circunscricaoResolvida.municipio_sede}/{circunscricaoResolvida.uf}
              </div>
              <div className="text-slate-600 text-[10px]">Base legal: {circunscricaoResolvida.base_legal}</div>
            </div>
          )}
          {circunscricaoStatus === "not_found" && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 text-[11px] text-amber-400/80 flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <span>{circunscricaoMensagem || "Circunscrição não encontrada."}</span>
                <Button type="button" variant="outline" size="sm" className="h-7 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={handleRetryCircunscricao}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
                </Button>
              </div>
            </div>
          )}
          {circunscricaoStatus === "error" && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2.5 text-[11px] text-red-400/90 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <span>{circunscricaoMensagem}</span>
                <Button type="button" variant="outline" size="sm" className="h-7 border-red-500/30 text-red-300 hover:bg-red-500/10" onClick={handleRetryCircunscricao}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
                </Button>
              </div>
            </div>
          )}
          {circunscricaoStatus === "pending_review" && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 text-[11px] text-amber-400/80 flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{circunscricaoMensagem}</span>
            </div>
          )}
        </div>

        {/* Foco */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Foco Argumentativo</Label>
            <Select value={foco} onValueChange={setFoco}>
              <SelectTrigger className="bg-[#0c0c14] border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FOCOS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end pb-1">
            <div className="text-[10px] text-slate-600 flex items-center gap-1">
              <Info className="h-3 w-3" /> Profundidade e tom fixados: técnico, preciso e conciso.
            </div>
          </div>
        </div>

        {/* Tempestividade */}
        {needsTempestividade && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-500/5 border border-amber-500/10 rounded-lg p-4">
            <div className="space-y-2">
              <Label className="text-amber-400 text-xs">Data da notificação / decisão</Label>
              <Input type="date" value={dataNotificacao} onChange={e => setDataNotificacao(e.target.value)}
                className="bg-[#0c0c14] border-slate-700 text-slate-100" />
            </div>
            <div className="space-y-2">
              <Label className="text-amber-400 text-xs">Informações sobre prazo / tempestividade</Label>
              <Input value={infoTempestividade} onChange={e => setInfoTempestividade(e.target.value)}
                className="bg-[#0c0c14] border-slate-700 text-slate-100"
                placeholder="Ex: notificado em 01/03/2026, prazo de 15 dias" />
            </div>
          </div>
        )}

        {/* Case description */}
        <div className="space-y-2">
          <Label className="text-slate-300">Descrição completa do caso</Label>
          <Textarea value={entradaCaso} onChange={e => setEntradaCaso(e.target.value)}
            className="bg-[#0c0c14] border-slate-700 text-slate-100 min-h-[200px]"
            placeholder="Descreva detalhadamente os fatos, a situação jurídica, o histórico do caso..." />
        </div>

        {/* ── Auxiliary Documents ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-amber-400" />
              <Label className="text-slate-300 text-sm font-medium">Documentos Auxiliares do Caso</Label>
              {docTotal > 0 && (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                  {docDone}/{docTotal} prontos
                  {docFailed > 0 && <span className="text-red-400 ml-1">• {docFailed} falha(s)</span>}
                  {docActive > 0 && <span className="text-cyan-400 ml-1">• {docActive} ativo(s)</span>}
                </span>
              )}
            </div>
            {docTotal > 0 && (
              <button onClick={() => setShowDocList(!showDocList)} className="text-slate-500 hover:text-slate-300 transition-colors">
                {showDocList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            Anexe provas e documentos de suporte. Serão lidos integralmente como base factual da peça.
          </p>

          <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" className="hidden"
            onChange={e => { handleAddFiles(e.target.files); e.target.value = ""; }} />

          <Button type="button" variant="outline" size="sm" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Anexar documentos
          </Button>

          {docTotal > 0 && showDocList && (
            <div className="space-y-2">
              {arquivosAuxiliares.map((arq, i) => (
                <div key={i} className={`bg-slate-900/50 border rounded-lg p-3 space-y-2 ${
                  arq.stage === "done" ? "border-emerald-500/20" :
                  arq.stage === "failed" ? "border-red-500/20" : "border-slate-800/50"
                }`}>
                  <div className="flex items-center gap-3">
                    <FileText className={`h-4 w-4 shrink-0 ${stageColor(arq.stage)}`} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-xs text-slate-200 truncate">{arq.nome}</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-medium ${stageColor(arq.stage)}`}>
                          {STAGE_LABELS[arq.stage]}
                        </span>
                        {!["pending", "done", "failed"].includes(arq.stage) && <ElapsedTime startedAt={arq.startedAt} />}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {arq.stage === "pending" && (
                        <Select value={arq.tipo} onValueChange={v => handleChangeTipoDoc(i, v)}>
                          <SelectTrigger className="h-7 text-[11px] bg-[#0c0c14] border-slate-700 text-slate-400 w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS_DOC_AUXILIAR.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      {arq.stage === "failed" && (
                        <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] border-red-500/30 text-red-300 hover:bg-red-500/10"
                          onClick={() => handleRetryDoc(i)}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Reprocessar
                        </Button>
                      )}
                      {arq.stage === "done" && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                      {!["uploading", "saved", "extracting", "processing"].includes(arq.stage) && (
                        <button onClick={() => handleRemoveFile(i)} className="text-slate-600 hover:text-red-400 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  {!["pending", "done"].includes(arq.stage) && (
                    <Progress value={stageProgress(arq.stage)} className="h-1.5" />
                  )}
                  {arq.error && (
                    <div className="text-[10px] text-red-400/80 bg-red-500/5 rounded px-2 py-1">{arq.error}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Button onClick={gerar} disabled={loading} className="bg-amber-600 hover:bg-amber-700 w-full md:w-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Gerar Peça
        </Button>
      </div>

      {/* ── Generation Progress Panel ── */}
      {genStep !== "idle" && (
        <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">Progresso da Geração</h3>
            <div className="flex items-center gap-2">
              <ElapsedTime startedAt={genStartedAt} />
              {genStep === "done" && <CheckCircle className="h-4 w-4 text-emerald-400" />}
              {genStep === "error" && <XCircle className="h-4 w-4 text-red-400" />}
            </div>
          </div>

          <Progress value={genPercent} className="h-2" />

          <div className="space-y-1.5">
            {GENERATION_STEPS.map((step, idx) => {
              const isActive = step.key === genStep;
              const isDone = currentStepIdx > idx || genStep === "done";
              const isError = genStep === "error" && step.key === genStep;

              return (
                <div key={step.key} className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${
                  isActive ? "bg-cyan-500/5 text-cyan-400" :
                  isDone ? "text-emerald-400/70" :
                  "text-slate-600"
                }`}>
                  {isDone && !isActive ? (
                    <CheckCircle className="h-3 w-3 shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-slate-700 shrink-0" />
                  )}
                  <span>{step.label}</span>
                  {isActive && step.key === "uploading_docs" && docTotal > 0 && (
                    <span className="text-[10px] text-slate-500 ml-auto">{docDone}/{docTotal}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Doc summary */}
          {docTotal > 0 && (genStep !== "idle") && (
            <div className="text-[10px] text-slate-500 border-t border-slate-800/50 pt-2">
              Documentos auxiliares: {docTotal} anexados • {docDone} processados
              {docFailed > 0 && <span className="text-red-400"> • {docFailed} falha(s)</span>}
              {docDone === docTotal && docFailed === 0 && (
                <span className="text-emerald-400"> • ✓ todos prontos</span>
              )}
            </div>
          )}

          {genError && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="font-medium">Erro na geração</span>
              </div>
              <p>{genError}</p>
              <Button type="button" variant="outline" size="sm"
                className="h-7 border-red-500/30 text-red-300 hover:bg-red-500/10"
                onClick={() => { setGenStep("idle"); setGenError(""); gerar(); }}>
                <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Result ── */}
      {resultado && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-[#12121c] border border-slate-800/40 rounded-xl p-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${scoreColor(resultado.score_confianca)}`}>
                {(resultado.score_confianca * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Confiança</div>
            </div>
            <div className="flex-1 text-xs text-slate-400">
              {resultado.fontes_utilizadas?.length || 0} fontes recuperadas •
              {resultado.fontes_utilizadas?.filter((f: any) => f.validada).length || 0} validadas
              {resultado.circunscricao_utilizada && (
                <div className="text-emerald-400/70 mt-0.5">✓ Unidade PF: {resultado.circunscricao_utilizada.unidade_pf}</div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={copiarMinuta} className="border-slate-700 text-slate-300">
              <Download className="h-3.5 w-3.5 mr-1" /> Copiar
            </Button>
            <Button size="sm" onClick={exportarDocx} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Download className="h-3.5 w-3.5 mr-1" /> DOCX
            </Button>
          </div>

          {resultado.fontes_utilizadas?.length > 0 && (
            <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Fontes Utilizadas</h3>
              <div className="space-y-2">
                {resultado.fontes_utilizadas.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {f.tipo === "norma" && <Scale className="h-3.5 w-3.5 text-emerald-400" />}
                    {f.tipo === "jurisprudencia" && <Gavel className="h-3.5 w-3.5 text-purple-400" />}
                    {f.tipo === "documento" && <BookOpen className="h-3.5 w-3.5 text-blue-400" />}
                    {f.tipo === "referencia_aprovada" && <CheckCircle className="h-3.5 w-3.5 text-amber-400" />}
                    <span className="text-slate-300">{f.titulo}</span>
                    <span className="text-slate-600">• {f.referencia}</span>
                    {f.validada && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Minuta Gerada</h3>
            <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-serif">
              {resultado.minuta_gerada}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

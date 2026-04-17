import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadGeracaoDocx } from "@/lib/qaDocxDownload";
import {
  FileText, Download, Plus, Loader2, Clock, CheckCircle,
  AlertCircle, PenTool, User, Scale, Sparkles, Send,
  Mail, Phone, MapPin, Building2, Shield, Briefcase,
  Calendar, Heart, GraduationCap, Flag, Users, BookOpen, Info,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQAAuthContext } from "@/components/quero-armas/QAAuthContext";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import DraftingView, { type DraftingResult } from "@/components/quero-armas/DraftingView";
import ClientePecaAuxiliaryDocs, { type AuxiliaryDocItemState } from "@/components/quero-armas/clientes/ClientePecaAuxiliaryDocs";

interface Props {
  cliente: {
    id: number;
    cpf: string;
    nome_completo: string;
    email?: string;
    celular?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cep?: string;
    cidade?: string;
    estado?: string;
    complemento?: string;
    profissao?: string;
    estado_civil?: string;
    rg?: string;
    emissor_rg?: string;
    uf_emissor_rg?: string;
    nacionalidade?: string;
    data_nascimento?: string;
    naturalidade?: string;
    nome_mae?: string;
    nome_pai?: string;
    escolaridade?: string;
    titulo_eleitor?: string;
    expedicao_rg?: string;
    observacao?: string;
  };
}

interface GeracaoRow {
  id: string;
  titulo_geracao: string;
  tipo_peca: string;
  status: string;
  status_revisao: string | null;
  score_confianca: number | null;
  created_at: string;
  docx_path: string | null;
}

interface CasoRow {
  id: string;
  titulo: string;
  tipo_peca: string | null;
  tipo_servico: string | null;
  status: string;
  created_at: string;
  geracao_id: string | null;
  nome_requerente: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  rascunho: { label: "RASCUNHO", color: "hsl(40 80% 50%)", icon: PenTool },
  aprovado: { label: "APROVADO", color: "hsl(145 60% 40%)", icon: CheckCircle },
  rejeitado: { label: "REJEITADO", color: "hsl(0 70% 55%)", icon: AlertCircle },
  concluido: { label: "CONCLUÍDO", color: "hsl(145 60% 40%)", icon: CheckCircle },
  gerando: { label: "GERANDO...", color: "hsl(210 60% 55%)", icon: Loader2 },
  erro: { label: "ERRO", color: "hsl(0 70% 55%)", icon: AlertCircle },
};

const TIPO_LABELS: Record<string, string> = {
  recurso_administrativo: "RECURSO ADMINISTRATIVO",
  mandado_seguranca: "MANDADO DE SEGURANÇA",
  acao_declaratoria: "AÇÃO DECLARATÓRIA",
  peticao_inicial: "PETIÇÃO INICIAL",
  defesa_administrativa: "DEFESA ADMINISTRATIVA",
  defesa_posse_arma: "DEFESA PARA POSSE",
  defesa_porte_arma: "DEFESA PARA PORTE",
  resposta_a_notificacao: "RESPOSTA À NOTIFICAÇÃO",
  impugnacao: "IMPUGNAÇÃO",
};

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

type PipelineStep = "context" | "sources" | "writing" | "expanding" | "reviewing" | "validating" | "saving" | "done" | "error";

/* ── Data Field ── */
const DataField = ({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) => (
  <div className="flex items-start gap-2.5 py-2">
    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
      style={{ background: "hsl(220 15% 96%)" }}>
      <Icon className="h-3.5 w-3.5" style={{ color: "hsl(220 10% 50%)" }} />
    </div>
    <div className="min-w-0">
      <span className="text-[9px] font-bold uppercase tracking-wider block" style={{ color: "hsl(220 10% 55%)" }}>
        {label}
      </span>
      <p className={`text-[12px] font-semibold mt-0.5 uppercase ${mono ? "font-mono" : ""}`}
        style={{ color: "hsl(220 20% 18%)" }}>
        {value || "—"}
      </p>
    </div>
  </div>
);

export default function ClientePecas({ cliente }: Props) {
  const { user } = useQAAuthContext();
  const { lookupCep } = useBrasilApiLookup();

  const [loading, setLoading] = useState(true);
  const [casos, setCasos] = useState<CasoRow[]>([]);
  const [geracoes, setGeracoes] = useState<GeracaoRow[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Generation state
  const [tipoPeca, setTipoPeca] = useState("defesa_posse_arma");
  const [foco, setFoco] = useState("legalidade");
  const [entradaCaso, setEntradaCaso] = useState("");
  const [dataNotificacao, setDataNotificacao] = useState("");
  const [infoTempestividade, setInfoTempestividade] = useState("");
  const [numeroRequerimento, setNumeroRequerimento] = useState("");

  const [circunscricao, setCircunscricao] = useState<any>(null);
  const [circStatus, setCircStatus] = useState<"idle" | "resolving" | "resolved" | "error">("idle");

  const [generating, setGenerating] = useState(false);
  const [resultado, setResultado] = useState<DraftingResult | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [draftingStep, setDraftingStep] = useState<PipelineStep>("context");
  const [showDrafting, setShowDrafting] = useState(false);
  const [genError, setGenError] = useState("");
  const [genStartedAt, setGenStartedAt] = useState<number | undefined>();
  const [savedCasoId, setSavedCasoId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [auxiliaryDocs, setAuxiliaryDocs] = useState<AuxiliaryDocItemState[]>([]);
  const [showClientData, setShowClientData] = useState(false);

  const cpfNorm = (cliente.cpf || "").replace(/\D/g, "");
  const cpfFormatted = cpfNorm.length === 11
    ? cpfNorm.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : cpfNorm;
  const clienteCidade = cliente.cidade || "";
  const clienteUf = cliente.estado || "";
  const clienteEndereco = [cliente.endereco, cliente.numero].filter(Boolean).join(", ");
  const clienteBairro = cliente.bairro || "";
  const clienteCep = cliente.cep || "";
  const enderecoCompleto = [clienteEndereco, clienteBairro].filter(Boolean).join(", ");
  const cidadeUf = [clienteCidade, clienteUf].filter(Boolean).join(" / ");
  const needsTempestividade = tipoPeca === "recurso_administrativo" || tipoPeca === "resposta_a_notificacao";
  const tipoPecaLabel = TIPOS_PECA.find(t => t.value === tipoPeca)?.label || tipoPeca;

  // ── Load data ──
  const loadData = useCallback(async () => {
    if (!cpfNorm) { setLoading(false); return; }
    try {
      const { data: casosData } = await supabase
        .from("qa_casos" as any)
        .select("id, titulo, tipo_peca, tipo_servico, status, created_at, geracao_id, nome_requerente")
        .eq("cpf_cnpj", cpfNorm)
        .order("created_at", { ascending: false });
      const rows = (casosData as any[]) || [];
      setCasos(rows);
      const geracaoIds = rows.map(c => c.geracao_id).filter(Boolean);
      if (geracaoIds.length > 0) {
        const { data: geracoesData } = await supabase
          .from("qa_geracoes_pecas" as any)
          .select("id, titulo_geracao, tipo_peca, status, status_revisao, score_confianca, created_at, docx_path")
          .in("id", geracaoIds)
          .order("created_at", { ascending: false });
        setGeracoes((geracoesData as any[]) || []);
      } else {
        setGeracoes([]);
      }
    } catch (err) {
      console.error("[ClientePecas] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [cpfNorm]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Circumscription ──
  useEffect(() => {
    if (clienteCidade && clienteUf && circStatus === "idle") {
      resolverCircunscricao(clienteCidade, clienteUf);
    }
  }, []);

  const resolverCircunscricao = async (cidade: string, uf: string) => {
    const c = cidade.replace(/\s+/g, " ").trim();
    const u = uf.trim().toUpperCase();
    if (!c || !u) return null;
    setCircStatus("resolving");
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/qa_resolver_circunscricao_pf`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_municipio: c, p_uf: u }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { setCircStatus("error"); return null; }
      const data = await res.json();
      if (!data || data.length === 0) { setCircStatus("error"); return null; }
      setCircunscricao(data[0]);
      setCircStatus("resolved");
      return data[0];
    } catch {
      setCircStatus("error");
      return null;
    }
  };

  // ── Save caso ──
  const saveCaso = async (geracaoResult: DraftingResult, circ: any, auxiliarDocIds: string[]) => {
    try {
      const docsJson = auxiliaryDocs.map((a) => ({
        nome: a.nome,
        tipo: a.tipo,
        stage: a.stage,
        docId: a.docId || null,
        error: a.error || null,
      }));
      const errosJson = auxiliaryDocs.filter((a) => a.stage === "failed").map((a) => ({
        nome: a.nome,
        tipo: a.tipo,
        error: a.error || "Erro desconhecido",
      }));

      const casoData: Record<string, any> = {
        titulo: `Caso ${cliente.nome_completo || "sem título"}`,
        nome_requerente: cliente.nome_completo,
        cpf_cnpj: cpfNorm || null,
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
        documentos_auxiliares_json: docsJson.length > 0 ? docsJson : null,
        erros_documentos_json: errosJson.length > 0 ? errosJson : null,
        usuario_id: user?.id || null,
        updated_at: new Date().toISOString(),
      };
      if (geracaoResult?.geracao_id) casoData.geracao_id = geracaoResult.geracao_id;
      const { data, error } = await supabase
        .from("qa_casos" as any)
        .insert(casoData)
        .select("id, geracao_id")
        .single();
      if (error) throw error;
      if (auxiliarDocIds.length > 0) {
        await supabase
          .from("qa_documentos_conhecimento" as any)
          .update({ caso_id: (data as any).id, updated_at: new Date().toISOString() })
          .in("id", auxiliarDocIds);
      }
      return (data as any).id;
    } catch (err: any) {
      console.error("Erro ao salvar caso:", err);
      return null;
    }
  };

  // ── Generate ──
  const gerar = async () => {
    if (!cliente.nome_completo.trim()) { toast.error("Nome do requerente ausente"); return; }
    if (!entradaCaso.trim()) { toast.error("Descreva o caso"); return; }
    if (!clienteCidade.trim() || !clienteUf.trim()) { toast.error("Cidade e estado são obrigatórios"); return; }

    setGenerating(true);
    setResultado(null);
    setGenError("");
    setGenStartedAt(Date.now());
    setSavedCasoId(null);
    setStreamedText("");
    setIsStreaming(false);
    setShowDrafting(true);
    setDraftingStep("context");

    try {
      let circ = circunscricao;
      if (!circ) circ = await resolverCircunscricao(clienteCidade, clienteUf);

      let auxiliarDocIds: string[] = [];
      if (auxiliaryDocs.length > 0) {
        auxiliarDocIds = auxiliaryDocs.filter((a) => a.stage === "done" && a.docId).map((a) => a.docId!) as string[];
        const unfinished = auxiliaryDocs.filter((a) => a.stage !== "done");
        if (unfinished.length > 0) {
          throw new Error(`Geração bloqueada: ${unfinished.length} documento(s) ainda não foram processados.`);
        }
      }

      setDraftingStep("context");
      await new Promise(r => setTimeout(r, 300));
      setDraftingStep("sources");
      await new Promise(r => setTimeout(r, 300));
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
          usuario_id: user?.id,
          caso_titulo: cliente.nome_completo,
          entrada_caso: entradaCaso,
          tipo_peca: tipoPeca,
          foco,
          caso_id: null,
          cliente_id: cliente.id,
          cliente_cidade: clienteCidade.trim(),
          cliente_uf: clienteUf.trim(),
          cliente_endereco: clienteEndereco.trim() || null,
          cliente_cep: clienteCep.trim() || null,
          nome_requerente: cliente.nome_completo.trim(),
          tipo_servico: tipoPecaLabel || null,
          circunscricao_resolvida: circ ? {
            unidade_pf: circ.unidade_pf,
            sigla_unidade: circ.sigla_unidade,
            tipo_unidade: circ.tipo_unidade,
            municipio_sede: circ.municipio_sede,
            uf: circ.uf,
            base_legal: circ.base_legal,
          } : null,
          data_notificacao: dataNotificacao.trim() || null,
          info_tempestividade: infoTempestividade.trim() || null,
          numero_requerimento: numeroRequerimento.trim() || null,
          documentos_auxiliares_ids: auxiliarDocIds.length > 0 ? auxiliarDocIds : null,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Erro na geração" }));
        throw new Error(errData.error || "Erro na geração");
      }

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
            if (evt.type === "chunk" && evt.text) setStreamedText(prev => prev + evt.text);
            else if (evt.type === "done") finalResult = evt as DraftingResult;
            else if (evt.type === "error") throw new Error(evt.error || "Erro na geração");
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes("JSON")) throw parseErr;
          }
        }
      }

      setIsStreaming(false);
      if (!finalResult) throw new Error("Geração não retornou resultado final");

      setDraftingStep("validating");
      await new Promise(r => setTimeout(r, 400));
      setResultado(finalResult);
      setDraftingStep("saving");
      const sId = await saveCaso(finalResult, circ, auxiliarDocIds);
      setSavedCasoId(sId);
      setDraftingStep("done");
      toast.success("Peça gerada e caso salvo com sucesso");
      loadData();
    } catch (err: any) {
      setDraftingStep("error");
      setGenError(err.message || "Erro na geração");
      setIsStreaming(false);
      toast.error(err.message || "Erro na geração");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (g: GeracaoRow) => {
    setDownloading(g.id);
    try {
      await downloadGeracaoDocx(g.id, {
        titulo: g.titulo_geracao,
        tipoPeca: g.tipo_peca,
        nomeRequerente: cliente.nome_completo,
      });
    } finally {
      setDownloading(null);
    }
  };

  const exportarDocx = async () => {
    const geracaoId = resultado?.geracao_id;
    if (!geracaoId) { toast.error("Nenhuma peça para exportar"); return; }
    setIsExporting(true);
    try {
      await downloadGeracaoDocx(geracaoId, {
        titulo: `Caso ${cliente.nome_completo}`,
        tipoPeca,
        nomeRequerente: cliente.nome_completo,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const copiarMinuta = async () => {
    const text = resultado?.minuta_gerada || streamedText;
    if (!text) { toast.error("Nenhum texto para copiar"); return; }
    try {
      await navigator.clipboard.writeText(text.trim());
      toast.success("Texto copiado");
    } catch { toast.error("Erro ao copiar"); }
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center"
          style={{ background: "hsl(220 15% 96%)" }}>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "hsl(220 10% 50%)" }} />
        </div>
        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "hsl(220 10% 55%)" }}>
          CARREGANDO PEÇAS...
        </span>
      </div>
    );
  }

  // ── Drafting View (full-screen within tab) ──
  if (showDrafting) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(220 20% 18%), hsl(220 20% 28%))" }}>
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold uppercase tracking-wide" style={{ color: "hsl(220 20% 18%)" }}>
                GERANDO PEÇA JURÍDICA
              </h3>
              <p className="text-[10px] uppercase mt-0.5 font-medium" style={{ color: "hsl(220 10% 50%)" }}>
                {cliente.nome_completo} • {cpfFormatted}
              </p>
            </div>
          </div>
          {draftingStep === "done" && (
            <Button size="sm" onClick={() => setShowDrafting(false)}
              className="h-8 px-4 text-[10px] font-bold uppercase tracking-wide rounded-lg"
              style={{ background: "hsl(220 20% 18%)", color: "white" }}>
              VOLTAR À LISTA
            </Button>
          )}
        </div>
        <DraftingView
          visible={true}
          pipelineStep={draftingStep}
          streamedText={streamedText}
          isStreaming={isStreaming}
          error={genError}
          startedAt={genStartedAt}
          result={resultado}
          onRetry={() => { setShowDrafting(false); setGenError(""); }}
          onCopy={copiarMinuta}
          onExportDocx={exportarDocx}
          savedCasoId={savedCasoId}
          isExporting={isExporting}
        />
      </div>
    );
  }

  const total = geracoes.length;
  const aprovadas = geracoes.filter(g => g.status_revisao === "aprovado").length;
  const hasDocsPending = auxiliaryDocs.some((a) => !["done", "failed", "pending"].includes(a.stage));
  const hasDocsFailed = auxiliaryDocs.some((a) => a.stage === "failed");
  const hasDocsUnclassified = auxiliaryDocs.some((a) => a.stage === "pending");
  const canGenerate = !generating && !!entradaCaso.trim() && !hasDocsPending && !hasDocsFailed && !hasDocsUnclassified;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, hsl(260 50% 50%), hsl(260 50% 60%))" }}>
          <Scale className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold uppercase tracking-wide" style={{ color: "hsl(220 20% 18%)" }}>
            PEÇAS JURÍDICAS
          </h3>
          <p className="text-[10px] mt-0.5 uppercase font-semibold" style={{ color: "hsl(220 10% 50%)" }}>
            {total === 0 ? "NENHUMA PEÇA GERADA" : `${total} PEÇA${total > 1 ? "S" : ""} • ${aprovadas} APROVADA${aprovadas !== 1 ? "S" : ""}`}
          </p>
        </div>
      </div>

      {/* ── Client Data Card (compact + collapsible) ── */}
      <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: "hsl(220 15% 93%)", background: "white" }}>
        <button
          type="button"
          onClick={() => setShowClientData(v => !v)}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
          style={{ background: showClientData ? "hsl(220 15% 97.5%)" : "transparent", borderBottom: showClientData ? "1px solid hsl(220 15% 93%)" : "none" }}
        >
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "hsl(210 60% 50% / 0.1)" }}>
            <User className="h-3.5 w-3.5" style={{ color: "hsl(210 60% 50%)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider truncate" style={{ color: "hsl(220 20% 18%)" }}>
                {cliente.nome_completo}
              </span>
              <span className="text-[8px] uppercase px-2 py-0.5 rounded-full font-bold tracking-wider shrink-0"
                style={{ background: "hsl(145 60% 40% / 0.12)", color: "hsl(145 55% 35%)" }}>
                AUTO
              </span>
            </div>
            <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: "hsl(220 10% 50%)" }}>
              {cpfFormatted}{cidadeUf ? ` • ${cidadeUf}` : ""}
            </p>
          </div>
          {showClientData
            ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: "hsl(220 10% 50%)" }} />
            : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "hsl(220 10% 50%)" }} />}
        </button>

        {showClientData && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 pt-1">
              {cliente.email && <DataField icon={Mail} label="E-mail" value={cliente.email} />}
              {cliente.celular && <DataField icon={Phone} label="Celular" value={cliente.celular} mono />}
              {enderecoCompleto && <DataField icon={MapPin} label="Endereço" value={enderecoCompleto} />}
              {clienteCep && <DataField icon={MapPin} label="CEP" value={clienteCep} mono />}
              {cliente.rg && (
                <DataField icon={FileText} label="RG"
                  value={`${cliente.rg}${cliente.emissor_rg ? ` — ${cliente.emissor_rg}` : ""}${cliente.uf_emissor_rg ? ` ${cliente.uf_emissor_rg}` : ""}`} mono />
              )}
              {cliente.data_nascimento && <DataField icon={Calendar} label="Nascimento" value={cliente.data_nascimento} />}
              {cliente.estado_civil && <DataField icon={Heart} label="Estado Civil" value={cliente.estado_civil} />}
              {cliente.profissao && <DataField icon={Briefcase} label="Profissão" value={cliente.profissao} />}
            </div>
          </div>
        )}

        {/* Circumscription — sempre visível, é crítico para a peça */}
        {circStatus === "resolved" && circunscricao && (
          <div className="mx-4 mb-4 mt-2 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5"
            style={{ background: "hsl(145 60% 40% / 0.06)", border: "1px solid hsl(145 60% 40% / 0.15)" }}>
            <Building2 className="h-4 w-4 shrink-0" style={{ color: "hsl(145 55% 35%)" }} />
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider block" style={{ color: "hsl(145 55% 35%)" }}>
                CIRCUNSCRIÇÃO PF
              </span>
              <p className="text-[11px] font-bold uppercase mt-0.5 truncate" style={{ color: "hsl(145 45% 30%)" }}>
                {circunscricao.sigla_unidade} — {circunscricao.unidade_pf}
              </p>
            </div>
          </div>
        )}
        {circStatus === "resolving" && (
          <div className="mx-4 mb-4 mt-2 rounded-lg px-3.5 py-2.5 flex items-center gap-2"
            style={{ background: "hsl(210 60% 55% / 0.06)" }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "hsl(210 60% 55%)" }} />
            <span className="text-[10px] font-semibold uppercase" style={{ color: "hsl(210 60% 55%)" }}>
              RESOLVENDO CIRCUNSCRIÇÃO...
            </span>
          </div>
        )}
      </div>

      {/* ── Generation Config (always visible) ── */}
      <div className="rounded-xl border-2 p-4 space-y-4" style={{ borderColor: "hsl(220 15% 93%)", background: "white" }}>
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ background: "hsl(260 50% 55% / 0.1)" }}>
            <Scale className="h-3.5 w-3.5" style={{ color: "hsl(260 50% 55%)" }} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "hsl(220 20% 18%)" }}>
            CONFIGURAÇÃO DA PEÇA
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)" }}>
              TIPO DE PEÇA
            </Label>
            <Select value={tipoPeca} onValueChange={setTipoPeca}>
              <SelectTrigger className="h-10 text-[11px] uppercase rounded-lg border-2 font-semibold bg-white"
                style={{ borderColor: "hsl(220 15% 90%)", color: "hsl(220 20% 18%)" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PECA.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-[11px] uppercase font-medium">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)" }}>
              FOCO ARGUMENTATIVO
            </Label>
            <Select value={foco} onValueChange={setFoco}>
              <SelectTrigger className="h-10 text-[11px] uppercase rounded-lg border-2 font-semibold bg-white"
                style={{ borderColor: "hsl(220 15% 90%)", color: "hsl(220 20% 18%)" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOCOS.map(f => (
                  <SelectItem key={f.value} value={f.value} className="text-[11px] uppercase font-medium">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {needsTempestividade && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)" }}>
                DATA NOTIFICAÇÃO
              </Label>
              <Input value={dataNotificacao} onChange={e => setDataNotificacao(e.target.value)}
                placeholder="DD/MM/AAAA"
                className="h-10 text-[11px] uppercase rounded-lg border-2 font-semibold bg-white"
                style={{ borderColor: "hsl(220 15% 90%)", color: "hsl(220 20% 18%)" }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)" }}>
                Nº REQUERIMENTO
              </Label>
              <Input value={numeroRequerimento} onChange={e => setNumeroRequerimento(e.target.value)}
                className="h-10 text-[11px] uppercase rounded-lg border-2 font-semibold bg-white"
                style={{ borderColor: "hsl(220 15% 90%)", color: "hsl(220 20% 18%)" }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)" }}>
                INFO TEMPESTIVIDADE
              </Label>
              <Input value={infoTempestividade} onChange={e => setInfoTempestividade(e.target.value)}
                className="h-10 text-[11px] uppercase rounded-lg border-2 font-semibold bg-white"
                style={{ borderColor: "hsl(220 15% 90%)", color: "hsl(220 20% 18%)" }} />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)" }}>
            DESCRIÇÃO DO CASO *
          </Label>
          <Textarea
            value={entradaCaso}
            onChange={e => setEntradaCaso(e.target.value)}
            placeholder="DESCREVA OS FATOS, CIRCUNSTÂNCIAS E INFORMAÇÕES RELEVANTES PARA A DEFESA..."
            className="min-h-[120px] text-[11px] uppercase resize-none rounded-lg border-2 font-medium leading-relaxed bg-white"
            style={{ borderColor: "hsl(220 15% 90%)", color: "hsl(220 20% 18%)" }}
          />
          <div className="flex items-center gap-1.5 mt-1.5">
            <Info className="h-3 w-3" style={{ color: "hsl(210 60% 55%)" }} />
            <span className="text-[9px] uppercase font-semibold tracking-wide" style={{ color: "hsl(220 10% 55%)" }}>
              QUANTO MAIS DETALHES, MELHOR SERÁ A PEÇA GERADA
            </span>
          </div>
        </div>

        <ClientePecaAuxiliaryDocs
          userId={user?.id}
          caseId={null}
          onChange={setAuxiliaryDocs}
        />

        {(hasDocsPending || hasDocsFailed || hasDocsUnclassified) && (
          <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-[10px] font-medium text-muted-foreground">
            {hasDocsUnclassified
              ? "Classifique os anexos para liberar a geração."
              : hasDocsPending
                ? "Aguarde a extração integral das provas antes de gerar a peça."
                : "Reprocesse ou remova os anexos com falha para continuar."}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            onClick={gerar}
            disabled={!canGenerate}
            className="h-11 px-7 text-[12px] font-bold uppercase tracking-wider rounded-xl border-2 bg-white text-foreground transition-all duration-200 hover:bg-primary/5 hover:border-primary/50 hover:text-primary hover:shadow-md disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-foreground disabled:hover:border-border"
            style={{ borderColor: "hsl(220 15% 88%)" }}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            GERAR PEÇA JURÍDICA
          </Button>
        </div>
      </div>

      {/* ── Existing Pieces List ── */}
      {(geracoes.length > 0 || casos.filter(c => !c.geracao_id).length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ background: "hsl(210 60% 50% / 0.1)" }}>
              <FileText className="h-3.5 w-3.5" style={{ color: "hsl(210 60% 50%)" }} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "hsl(220 20% 18%)" }}>
              PEÇAS GERADAS ({total})
            </span>
          </div>

          <div className="space-y-2.5">
            {geracoes.map(g => {
              const caso = casos.find(c => c.geracao_id === g.id);
              const st = STATUS_MAP[g.status_revisao || g.status] || STATUS_MAP.rascunho;
              const StIcon = st.icon;
              const isDownloading = downloading === g.id;
              return (
                <div key={g.id}
                  className="rounded-xl border-2 p-4 flex flex-col sm:flex-row sm:items-center gap-3.5 group transition-all duration-200 hover:shadow-md"
                  style={{ borderColor: "hsl(220 15% 93%)", background: "white" }}>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${st.color}12` }}>
                    <StIcon className="h-4.5 w-4.5" style={{ color: st.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-bold uppercase truncate" style={{ color: "hsl(220 20% 18%)" }}>
                        {g.titulo_geracao || "SEM TÍTULO"}
                      </span>
                      <Badge variant="outline"
                        className="text-[8px] font-bold uppercase border-2 px-2 py-0 h-[18px] rounded-md"
                        style={{ color: st.color, borderColor: `${st.color}35`, background: `${st.color}08` }}>
                        {st.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase" style={{ color: "hsl(260 50% 55%)" }}>
                        {TIPO_LABELS[g.tipo_peca] || g.tipo_peca?.replace(/_/g, " ").toUpperCase() || "—"}
                      </span>
                      <span className="text-[10px] flex items-center gap-1 font-medium" style={{ color: "hsl(220 10% 55%)" }}>
                        <Clock className="h-3 w-3" /> {formatDate(g.created_at)}
                      </span>
                      {g.score_confianca != null && (
                        <span className="text-[10px] font-bold" style={{
                          color: g.score_confianca >= 80 ? "hsl(145 60% 38%)" : g.score_confianca >= 50 ? "hsl(40 80% 45%)" : "hsl(0 70% 50%)"
                        }}>
                          {g.score_confianca}% CONFIANÇA
                        </span>
                      )}
                    </div>
                    {caso && (
                      <div className="text-[9px] mt-1.5 uppercase font-semibold" style={{ color: "hsl(220 10% 62%)" }}>
                        CASO: {caso.titulo}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" disabled={isDownloading} onClick={() => handleDownload(g)}
                    className="h-8 px-3.5 text-[10px] font-bold uppercase tracking-wide rounded-lg border-2 transition-all duration-200 hover:shadow-sm bg-white"
                    style={{ borderColor: "hsl(220 15% 88%)" }}>
                    {isDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                    DOCX
                  </Button>
                </div>
              );
            })}

            {casos.filter(c => !c.geracao_id).map(c => (
              <div key={c.id}
                className="rounded-xl border-2 border-dashed p-4 flex flex-col sm:flex-row sm:items-center gap-3.5 opacity-60"
                style={{ borderColor: "hsl(220 15% 88%)", background: "hsl(220 15% 98%)" }}>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "hsl(40 80% 50% / 0.1)" }}>
                  <Clock className="h-4 w-4" style={{ color: "hsl(40 80% 50%)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold uppercase truncate" style={{ color: "hsl(220 20% 18%)" }}>
                    {c.titulo || "CASO EM ANDAMENTO"}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase" style={{ color: "hsl(40 80% 45%)" }}>
                      {c.status?.toUpperCase() || "EM ANDAMENTO"}
                    </span>
                    <span className="text-[10px] flex items-center gap-1 font-medium" style={{ color: "hsl(220 10% 55%)" }}>
                      <Clock className="h-3 w-3" /> {formatDate(c.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

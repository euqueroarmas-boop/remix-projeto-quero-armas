import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Send, Loader2, User, MapPin, FileText, Scale, ChevronUp, ChevronDown,
  CheckCircle, AlertTriangle, X, Building2, Info, Mail, Phone, Briefcase,
  Shield, Sparkles, Calendar, Heart, GraduationCap, Flag, Users, BookOpen,
} from "lucide-react";
import { useQAAuthContext } from "@/components/quero-armas/QAAuthContext";
import DraftingView, { type DraftingResult } from "@/components/quero-armas/DraftingView";
import { downloadGeracaoDocx } from "@/lib/qaDocxDownload";

/* ── Types ── */
interface ClienteData {
  id: number;
  nome_completo: string;
  cpf: string;
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
}

interface Props {
  cliente: ClienteData;
  onClose: () => void;
  onSaved: () => void;
}

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

export default function ClientePecasGerador({ cliente, onClose, onSaved }: Props) {
  const { user } = useQAAuthContext();
  const { lookupCep } = useBrasilApiLookup();

  const [nomeRequerente] = useState(cliente.nome_completo || "");
  const [cpfCnpj] = useState((cliente.cpf || "").replace(/\D/g, ""));
  const [clienteCidade] = useState(cliente.cidade || "");
  const [clienteUf] = useState(cliente.estado || "");
  const [clienteEndereco] = useState(
    [cliente.endereco, cliente.numero].filter(Boolean).join(", ") || ""
  );
  const [clienteBairro] = useState(cliente.bairro || "");
  const [clienteCep] = useState(cliente.cep || "");

  const [tipoPeca, setTipoPeca] = useState("defesa_posse_arma");
  const [foco, setFoco] = useState("legalidade");
  const [entradaCaso, setEntradaCaso] = useState("");
  const [dataNotificacao, setDataNotificacao] = useState("");
  const [infoTempestividade, setInfoTempestividade] = useState("");
  const [numeroRequerimento, setNumeroRequerimento] = useState("");

  const [circunscricao, setCircunscricao] = useState<any>(null);
  const [circStatus, setCircStatus] = useState<"idle" | "resolving" | "resolved" | "error">("idle");

  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<DraftingResult | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [draftingStep, setDraftingStep] = useState<PipelineStep>("context");
  const [showDrafting, setShowDrafting] = useState(false);
  const [genError, setGenError] = useState("");
  const [genStartedAt, setGenStartedAt] = useState<number | undefined>();
  const [savedCasoId, setSavedCasoId] = useState<string | null>(null);
  const [showClientData, setShowClientData] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const needsTempestividade = tipoPeca === "recurso_administrativo" || tipoPeca === "resposta_a_notificacao";
  const tipoPecaLabel = TIPOS_PECA.find(t => t.value === tipoPeca)?.label || tipoPeca;

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

  const saveCaso = async (geracaoResult: DraftingResult, circ: any) => {
    try {
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
      const savedId = (data as any).id;

      await supabase.from("qa_logs_auditoria" as any).insert({
        usuario_id: user?.id,
        entidade: "qa_casos",
        entidade_id: savedId,
        acao: "criar_caso",
        detalhes_json: {
          nome_requerente: nomeRequerente,
          tipo_servico: tipoPecaLabel,
          tipo_peca: tipoPeca,
          origem: "aba_pecas_cliente",
        },
      });

      return savedId;
    } catch (err: any) {
      console.error("Erro ao salvar caso:", err);
      return null;
    }
  };

  const gerar = async () => {
    if (!nomeRequerente.trim()) { toast.error("Informe o nome completo do requerente"); return; }
    if (!entradaCaso.trim()) { toast.error("Descreva o caso"); return; }
    if (!clienteCidade.trim() || !clienteUf.trim()) { toast.error("Informe a cidade e o estado."); return; }

    setLoading(true);
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
          caso_titulo: nomeRequerente,
          entrada_caso: entradaCaso,
          tipo_peca: tipoPeca,
          foco,
          caso_id: null,
          cliente_cidade: clienteCidade.trim(),
          cliente_uf: clienteUf.trim(),
          cliente_endereco: clienteEndereco.trim() || null,
          cliente_cep: clienteCep.trim() || null,
          nome_requerente: nomeRequerente.trim(),
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
          documentos_auxiliares_ids: null,
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

      setDraftingStep("validating");
      await new Promise(r => setTimeout(r, 400));
      setResultado(finalResult);

      setDraftingStep("saving");
      const sId = await saveCaso(finalResult, circ);
      setSavedCasoId(sId);

      setDraftingStep("done");
      toast.success("Peça gerada e caso salvo com sucesso");
      onSaved();
    } catch (err: any) {
      setDraftingStep("error");
      setGenError(err.message || "Erro na geração");
      setIsStreaming(false);
      toast.error(err.message || "Erro na geração");
    } finally {
      setLoading(false);
    }
  };

  const exportarDocx = async () => {
    const geracaoId = resultado?.geracao_id;
    if (!geracaoId) { toast.error("Nenhuma peça para exportar"); return; }
    setIsExporting(true);
    try {
      await downloadGeracaoDocx(geracaoId, {
        titulo: `Caso ${nomeRequerente}`,
        tipoPeca,
        nomeRequerente,
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
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const cpfFormatted = cpfCnpj.length === 11
    ? cpfCnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : cpfCnpj;

  const enderecoCompleto = [clienteEndereco, clienteBairro].filter(Boolean).join(", ");
  const cidadeUf = [clienteCidade, clienteUf].filter(Boolean).join(" / ");

  // ── Drafting View ──
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
                {nomeRequerente} • {cpfFormatted}
              </p>
            </div>
          </div>
          {draftingStep === "done" && (
            <Button
              size="sm"
              onClick={onClose}
              className="h-8 px-4 text-[10px] font-bold uppercase tracking-wide rounded-lg"
              style={{ background: "hsl(220 20% 18%)", color: "white" }}
            >
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

  // ── Data Field Component ──
  const DataField = ({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) => (
    <div className="flex items-start gap-2.5 py-2.5">
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

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, hsl(220 20% 18%), hsl(220 20% 28%))" }}>
            <Scale className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold uppercase tracking-wide" style={{ color: "hsl(220 20% 18%)" }}>
              NOVA PEÇA JURÍDICA
            </h3>
            <p className="text-[10px] uppercase mt-0.5 font-medium" style={{ color: "hsl(220 10% 50%)" }}>
              DADOS DO CLIENTE CARREGADOS AUTOMATICAMENTE
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onClose}
          className="h-8 px-3.5 text-[10px] font-bold uppercase tracking-wide rounded-lg border-2"
          style={{ borderColor: "hsl(220 15% 88%)", color: "hsl(220 10% 45%)" }}
        >
          <X className="h-3 w-3 mr-1.5" /> CANCELAR
        </Button>
      </div>

      {/* ── Client Data Card ── */}
      <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: "hsl(220 15% 93%)", background: "white" }}>
        <button
          onClick={() => setShowClientData(!showClientData)}
          className="w-full flex items-center justify-between px-4 py-3 transition-colors"
          style={{ background: "hsl(220 15% 97.5%)" }}
        >
          <div className="flex items-center gap-2.5">
            <User className="h-4 w-4" style={{ color: "hsl(210 60% 50%)" }} />
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "hsl(220 20% 18%)" }}>
              DADOS DO CLIENTE
            </span>
            <span className="text-[8px] uppercase px-2 py-0.5 rounded-full font-bold tracking-wider"
              style={{ background: "hsl(145 60% 40% / 0.12)", color: "hsl(145 55% 35%)" }}>
              AUTO-PREENCHIDO
            </span>
          </div>
          {showClientData
            ? <ChevronUp className="h-4 w-4" style={{ color: "hsl(220 10% 55%)" }} />
            : <ChevronDown className="h-4 w-4" style={{ color: "hsl(220 10% 55%)" }} />
          }
        </button>

        {showClientData && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 pt-1"
              style={{ borderTop: "1px solid hsl(220 15% 93%)" }}>
              <DataField icon={User} label="Nome Completo" value={nomeRequerente} />
              <DataField icon={Shield} label="CPF" value={cpfFormatted} mono />
              {cliente.email && <DataField icon={Mail} label="E-mail" value={cliente.email} />}
              {cliente.celular && <DataField icon={Phone} label="Celular" value={cliente.celular} mono />}
              <DataField icon={MapPin} label="Endereço" value={enderecoCompleto} />
              <DataField icon={Building2} label="Cidade / UF" value={cidadeUf} />
              {cliente.profissao && <DataField icon={Briefcase} label="Profissão" value={cliente.profissao} />}
              {cliente.rg && (
                <DataField icon={FileText} label="RG" value={`${cliente.rg}${cliente.emissor_rg ? ` — ${cliente.emissor_rg}` : ""}`} mono />
              )}
            </div>

            {/* Circumscription */}
            {circStatus === "resolved" && circunscricao && (
              <div className="mt-2 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5"
                style={{ background: "hsl(145 60% 40% / 0.06)", border: "1px solid hsl(145 60% 40% / 0.15)" }}>
                <Building2 className="h-4 w-4 shrink-0" style={{ color: "hsl(145 55% 35%)" }} />
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider block" style={{ color: "hsl(145 55% 35%)" }}>
                    CIRCUNSCRIÇÃO PF
                  </span>
                  <p className="text-[11px] font-bold uppercase mt-0.5" style={{ color: "hsl(145 45% 30%)" }}>
                    {circunscricao.sigla_unidade} — {circunscricao.unidade_pf}
                  </p>
                </div>
              </div>
            )}
            {circStatus === "resolving" && (
              <div className="mt-2 rounded-lg px-3.5 py-2.5 flex items-center gap-2"
                style={{ background: "hsl(210 60% 55% / 0.06)" }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "hsl(210 60% 55%)" }} />
                <span className="text-[10px] font-semibold uppercase" style={{ color: "hsl(210 60% 55%)" }}>
                  RESOLVENDO CIRCUNSCRIÇÃO...
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Configuration Card ── */}
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
              <SelectTrigger className="h-10 text-[11px] uppercase rounded-lg border-2 font-semibold"
                style={{ borderColor: "hsl(220 15% 90%)" }}>
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
              <SelectTrigger className="h-10 text-[11px] uppercase rounded-lg border-2 font-semibold"
                style={{ borderColor: "hsl(220 15% 90%)" }}>
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
              <Input
                value={dataNotificacao}
                onChange={e => setDataNotificacao(e.target.value)}
                placeholder="DD/MM/AAAA"
                className="h-10 text-[11px] uppercase rounded-lg border-2 font-semibold"
                style={{ borderColor: "hsl(220 15% 90%)" }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)" }}>
                Nº REQUERIMENTO
              </Label>
              <Input
                value={numeroRequerimento}
                onChange={e => setNumeroRequerimento(e.target.value)}
                className="h-10 text-[11px] uppercase rounded-lg border-2 font-semibold"
                style={{ borderColor: "hsl(220 15% 90%)" }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)" }}>
                INFO TEMPESTIVIDADE
              </Label>
              <Input
                value={infoTempestividade}
                onChange={e => setInfoTempestividade(e.target.value)}
                className="h-10 text-[11px] uppercase rounded-lg border-2 font-semibold"
                style={{ borderColor: "hsl(220 15% 90%)" }}
              />
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
            className="min-h-[120px] text-[11px] uppercase resize-none rounded-lg border-2 font-medium leading-relaxed"
            style={{ borderColor: "hsl(220 15% 90%)" }}
          />
          <div className="flex items-center gap-1.5 mt-1.5">
            <Info className="h-3 w-3" style={{ color: "hsl(210 60% 55%)" }} />
            <span className="text-[9px] uppercase font-semibold tracking-wide" style={{ color: "hsl(220 10% 55%)" }}>
              QUANTO MAIS DETALHES, MELHOR SERÁ A PEÇA GERADA
            </span>
          </div>
        </div>
      </div>

      {/* ── Generate Button ── */}
      <div className="flex justify-end pt-1">
        <Button
          onClick={gerar}
          disabled={loading || !entradaCaso.trim() || !nomeRequerente.trim()}
          className="h-11 px-7 text-[12px] font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          style={{
            background: "linear-gradient(135deg, hsl(220 20% 18%), hsl(220 20% 28%))",
            color: "white",
          }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          GERAR PEÇA JURÍDICA
        </Button>
      </div>
    </div>
  );
}

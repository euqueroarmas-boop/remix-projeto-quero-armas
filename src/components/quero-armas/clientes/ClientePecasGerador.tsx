import { useState, useRef, useEffect, useCallback } from "react";
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
  CheckCircle, AlertTriangle, X, Building2, Info,
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
  nacionalidade?: string;
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

  // Pre-filled from client
  const [nomeRequerente, setNomeRequerente] = useState(cliente.nome_completo || "");
  const [cpfCnpj] = useState((cliente.cpf || "").replace(/\D/g, ""));
  const [clienteCidade, setClienteCidade] = useState(cliente.cidade || "");
  const [clienteUf, setClienteUf] = useState(cliente.estado || "");
  const [clienteEndereco, setClienteEndereco] = useState(
    [cliente.endereco, cliente.numero].filter(Boolean).join(", ") || ""
  );
  const [clienteBairro, setClienteBairro] = useState(cliente.bairro || "");
  const [clienteCep, setClienteCep] = useState(cliente.cep || "");

  // Form fields
  const [tipoPeca, setTipoPeca] = useState("defesa_posse_arma");
  const [foco, setFoco] = useState("legalidade");
  const [entradaCaso, setEntradaCaso] = useState("");
  const [dataNotificacao, setDataNotificacao] = useState("");
  const [infoTempestividade, setInfoTempestividade] = useState("");
  const [numeroRequerimento, setNumeroRequerimento] = useState("");

  // Circumscription
  const [circunscricao, setCircunscricao] = useState<any>(null);
  const [circStatus, setCircStatus] = useState<"idle" | "resolving" | "resolved" | "error">("idle");

  // Generation
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

  // Auto-resolve circumscription when city/uf available
  useEffect(() => {
    if (clienteCidade && clienteUf && circStatus === "idle") {
      resolverCircunscricao(clienteCidade, clienteUf);
    }
  }, []); // Only on mount

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
      // Circumscription
      let circ = circunscricao;
      if (!circ) circ = await resolverCircunscricao(clienteCidade, clienteUf);

      // Build context
      setDraftingStep("context");
      await new Promise(r => setTimeout(r, 300));
      setDraftingStep("sources");
      await new Promise(r => setTimeout(r, 300));

      // Stream generation - same edge function
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

  const cpfFormatted = cpfCnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

  // If drafting view is active, show it
  if (showDrafting) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "hsl(220 20% 18%)" }}>
              GERANDO PEÇA
            </h3>
            <p className="text-[10px] uppercase mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>
              {nomeRequerente} • {cpfFormatted}
            </p>
          </div>
          {draftingStep === "done" && (
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="h-7 text-[10px] font-semibold uppercase"
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "hsl(220 20% 18%)" }}>
            NOVA PEÇA JURÍDICA
          </h3>
          <p className="text-[10px] uppercase mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>
            DADOS DO CLIENTE CARREGADOS AUTOMATICAMENTE
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onClose}
          className="h-7 px-3 text-[10px] font-semibold uppercase"
        >
          <X className="h-3 w-3 mr-1" /> CANCELAR
        </Button>
      </div>

      {/* Client data summary - collapsible */}
      <div className="qa-card overflow-hidden">
        <button
          onClick={() => setShowClientData(!showClientData)}
          className="w-full flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5" style={{ color: "hsl(210 60% 55%)" }} />
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "hsl(220 20% 18%)" }}>
              DADOS DO CLIENTE
            </span>
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold"
              style={{ background: "hsl(145 60% 40% / 0.1)", color: "hsl(145 60% 40%)" }}>
              AUTO-PREENCHIDO
            </span>
          </div>
          {showClientData ? <ChevronUp className="h-3.5 w-3.5" style={{ color: "hsl(220 10% 55%)" }} /> : <ChevronDown className="h-3.5 w-3.5" style={{ color: "hsl(220 10% 55%)" }} />}
        </button>
        {showClientData && (
          <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t" style={{ borderColor: "hsl(220 15% 93%)" }}>
            <div className="pt-2">
              <span className="text-[9px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>NOME COMPLETO</span>
              <p className="text-[11px] font-semibold uppercase mt-0.5" style={{ color: "hsl(220 20% 18%)" }}>{nomeRequerente || "—"}</p>
            </div>
            <div className="pt-2">
              <span className="text-[9px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>CPF</span>
              <p className="text-[11px] font-mono font-semibold mt-0.5" style={{ color: "hsl(220 20% 18%)" }}>{cpfFormatted || "—"}</p>
            </div>
            {cliente.email && (
              <div>
                <span className="text-[9px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>E-MAIL</span>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: "hsl(220 20% 18%)" }}>{cliente.email}</p>
              </div>
            )}
            {cliente.celular && (
              <div>
                <span className="text-[9px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>CELULAR</span>
                <p className="text-[11px] font-mono font-semibold mt-0.5" style={{ color: "hsl(220 20% 18%)" }}>{cliente.celular}</p>
              </div>
            )}
            <div>
              <span className="text-[9px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>ENDEREÇO</span>
              <p className="text-[11px] font-semibold uppercase mt-0.5" style={{ color: "hsl(220 20% 18%)" }}>
                {[clienteEndereco, clienteBairro].filter(Boolean).join(", ") || "—"}
              </p>
            </div>
            <div>
              <span className="text-[9px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>CIDADE / UF</span>
              <p className="text-[11px] font-semibold uppercase mt-0.5" style={{ color: "hsl(220 20% 18%)" }}>
                {[clienteCidade, clienteUf].filter(Boolean).join(" / ") || "—"}
              </p>
            </div>
            {circStatus === "resolved" && circunscricao && (
              <div className="sm:col-span-2">
                <span className="text-[9px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>CIRCUNSCRIÇÃO PF</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Building2 className="h-3 w-3" style={{ color: "hsl(145 60% 40%)" }} />
                  <p className="text-[11px] font-semibold uppercase" style={{ color: "hsl(145 60% 40%)" }}>
                    {circunscricao.sigla_unidade} — {circunscricao.unidade_pf}
                  </p>
                </div>
              </div>
            )}
            {circStatus === "resolving" && (
              <div className="sm:col-span-2 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" style={{ color: "hsl(210 60% 55%)" }} />
                <span className="text-[10px] uppercase" style={{ color: "hsl(210 60% 55%)" }}>RESOLVENDO CIRCUNSCRIÇÃO...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="qa-card p-3 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Scale className="h-3.5 w-3.5" style={{ color: "hsl(260 50% 55%)" }} />
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "hsl(220 20% 18%)" }}>
            CONFIGURAÇÃO DA PEÇA
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>TIPO DE PEÇA</Label>
            <Select value={tipoPeca} onValueChange={setTipoPeca}>
              <SelectTrigger className="h-9 text-[11px] uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PECA.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-[11px] uppercase">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>FOCO ARGUMENTATIVO</Label>
            <Select value={foco} onValueChange={setFoco}>
              <SelectTrigger className="h-9 text-[11px] uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOCOS.map(f => (
                  <SelectItem key={f.value} value={f.value} className="text-[11px] uppercase">{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {needsTempestividade && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>DATA NOTIFICAÇÃO</Label>
              <Input
                value={dataNotificacao}
                onChange={e => setDataNotificacao(e.target.value)}
                placeholder="DD/MM/AAAA"
                className="h-9 text-[11px] uppercase"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>Nº REQUERIMENTO</Label>
              <Input
                value={numeroRequerimento}
                onChange={e => setNumeroRequerimento(e.target.value)}
                className="h-9 text-[11px] uppercase"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>INFO TEMPESTIVIDADE</Label>
              <Input
                value={infoTempestividade}
                onChange={e => setInfoTempestividade(e.target.value)}
                className="h-9 text-[11px] uppercase"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase" style={{ color: "hsl(220 10% 55%)" }}>
            DESCRIÇÃO DO CASO *
          </Label>
          <Textarea
            value={entradaCaso}
            onChange={e => setEntradaCaso(e.target.value)}
            placeholder="DESCREVA OS FATOS, CIRCUNSTÂNCIAS E INFORMAÇÕES RELEVANTES PARA A DEFESA..."
            className="min-h-[100px] text-[11px] uppercase resize-none"
          />
          <div className="flex items-center gap-1.5 mt-1">
            <Info className="h-3 w-3" style={{ color: "hsl(210 60% 55%)" }} />
            <span className="text-[9px] uppercase" style={{ color: "hsl(220 10% 55%)" }}>
              QUANTO MAIS DETALHES, MELHOR SERÁ A PEÇA GERADA
            </span>
          </div>
        </div>
      </div>

      {/* Generate button */}
      <div className="flex justify-end">
        <Button
          onClick={gerar}
          disabled={loading || !entradaCaso.trim() || !nomeRequerente.trim()}
          className="h-9 px-6 text-[11px] font-bold uppercase tracking-wide rounded-lg shadow-sm"
          style={{ background: "hsl(220 20% 18%)", color: "hsl(0 0% 100%)" }}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5 mr-1.5" />
          )}
          GERAR PEÇA JURÍDICA
        </Button>
      </div>
    </div>
  );
}

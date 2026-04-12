import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PenTool, Send, Loader2, AlertTriangle, Download, CheckCircle, Scale, Gavel, BookOpen, MapPin, Building2, Info, Paperclip, FileText, X, Upload } from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";

interface ArquivoAuxiliar {
  file: File;
  nome: string;
  tipo: string;
  uploading: boolean;
  uploaded: boolean;
  docId?: string;
  error?: string;
}

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

interface CircunscricaoResolvida {
  unidade_pf: string;
  sigla_unidade: string;
  tipo_unidade: string;
  municipio_sede: string;
  uf: string;
  base_legal: string;
}

export default function QAGerarPecaPage() {
  const { user } = useQAAuth();
  const [casoTitulo, setCasoTitulo] = useState("");
  const [entradaCaso, setEntradaCaso] = useState("");
  const [tipoPeca, setTipoPeca] = useState("defesa_posse_arma");
  const [foco, setFoco] = useState("legalidade");
  // Client address fields (for circumscription resolution)
  const [clienteCidade, setClienteCidade] = useState("");
  const [clienteUf, setClienteUf] = useState("");
  const [clienteEndereco, setClienteEndereco] = useState("");
  const [clienteCep, setClienteCep] = useState("");
  // Tempestividade fields
  const [dataNotificacao, setDataNotificacao] = useState("");
  const [infoTempestividade, setInfoTempestividade] = useState("");
  // State
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [circunscricaoResolvida, setCircunscricaoResolvida] = useState<CircunscricaoResolvida | null>(null);
  const [resolvendoCircunscricao, setResolvendoCircunscricao] = useState(false);

  const needsTempestividade = tipoPeca === "recurso_administrativo" || tipoPeca === "resposta_a_notificacao";

  const resolverCircunscricao = async (cidade: string, uf: string): Promise<CircunscricaoResolvida | null> => {
    if (!cidade.trim() || !uf.trim()) return null;
    setResolvendoCircunscricao(true);
    try {
      const { data, error } = await supabase.rpc("qa_resolver_circunscricao_pf", {
        p_municipio: cidade.trim(),
        p_uf: uf.trim(),
      });
      if (error || !data || data.length === 0) return null;
      return data[0] as CircunscricaoResolvida;
    } catch {
      return null;
    } finally {
      setResolvendoCircunscricao(false);
    }
  };

  // Auto-resolve when city/state change
  const handleUfChange = async (uf: string) => {
    setClienteUf(uf);
    setCircunscricaoResolvida(null);
    if (clienteCidade.trim() && uf) {
      const result = await resolverCircunscricao(clienteCidade, uf);
      setCircunscricaoResolvida(result);
    }
  };

  const handleCidadeBlur = async () => {
    setCircunscricaoResolvida(null);
    if (clienteCidade.trim() && clienteUf) {
      const result = await resolverCircunscricao(clienteCidade, clienteUf);
      setCircunscricaoResolvida(result);
    }
  };

  const gerar = async () => {
    if (!entradaCaso.trim()) { toast.error("Descreva o caso"); return; }
    if (!clienteCidade.trim() || !clienteUf.trim()) {
      toast.error("Informe a cidade e o estado do cliente para resolução automática da unidade PF competente.");
      return;
    }

    // Resolve circumscription if not already done
    let circ = circunscricaoResolvida;
    if (!circ) {
      circ = await resolverCircunscricao(clienteCidade, clienteUf);
      setCircunscricaoResolvida(circ);
    }

    if (!circ) {
      toast.warning("Não foi possível resolver automaticamente a unidade da PF para o município informado. A peça será gerada com marcador pendente.", { duration: 5000 });
    }

    setLoading(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("qa-gerar-peca", {
        body: {
          usuario_id: user?.id,
          caso_titulo: casoTitulo,
          entrada_caso: entradaCaso,
          tipo_peca: tipoPeca,
          foco,
          // Client address for circumscription
          cliente_cidade: clienteCidade.trim(),
          cliente_uf: clienteUf.trim(),
          cliente_endereco: clienteEndereco.trim() || null,
          cliente_cep: clienteCep.trim() || null,
          // Resolved circumscription (pre-resolved on client)
          circunscricao_resolvida: circ ? {
            unidade_pf: circ.unidade_pf,
            sigla_unidade: circ.sigla_unidade,
            tipo_unidade: circ.tipo_unidade,
            municipio_sede: circ.municipio_sede,
            uf: circ.uf,
            base_legal: circ.base_legal,
          } : null,
          // Tempestividade
          data_notificacao: dataNotificacao.trim() || null,
          info_tempestividade: infoTempestividade.trim() || null,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setResultado(data);
      toast.success("Peça gerada com sucesso");
    } catch (err: any) {
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
      a.href = url;
      a.download = `${casoTitulo || "peca"}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("DOCX exportado com sucesso");
    } catch (err: any) {
      toast.error(err.message || "Erro ao exportar DOCX");
    }
  };

  const scoreColor = (s: number) => {
    if (s >= 0.7) return "text-emerald-400";
    if (s >= 0.4) return "text-amber-400";
    return "text-red-400";
  };

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
        {/* Row 1: Title + Type */}
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

        {/* Row 2: Client address (for automatic PF unit resolution) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-cyan-400" />
            <Label className="text-slate-300 text-sm font-medium">Endereço do Cliente / Caso</Label>
            <span className="text-[10px] text-slate-600 ml-1">(para resolução automática da unidade PF competente)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Cidade do cliente *</Label>
              <Input value={clienteCidade} onChange={e => setClienteCidade(e.target.value)}
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
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">CEP (opcional)</Label>
              <Input value={clienteCep} onChange={e => setClienteCep(e.target.value)}
                className="bg-[#0c0c14] border-slate-700 text-slate-100" placeholder="00000-000" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Endereço completo (opcional)</Label>
            <Input value={clienteEndereco} onChange={e => setClienteEndereco(e.target.value)}
              className="bg-[#0c0c14] border-slate-700 text-slate-100" placeholder="Rua, número, bairro..." />
          </div>

          {/* Circumscription resolution feedback */}
          {resolvendoCircunscricao && (
            <div className="flex items-center gap-2 text-xs text-cyan-400/70">
              <Loader2 className="h-3 w-3 animate-spin" />
              Resolvendo circunscrição da PF...
            </div>
          )}
          {circunscricaoResolvida && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle className="h-3.5 w-3.5" />
                Unidade PF competente resolvida automaticamente
              </div>
              <div className="text-slate-300">
                <span className="font-medium">{circunscricaoResolvida.unidade_pf}</span>
                {circunscricaoResolvida.sigla_unidade && (
                  <span className="text-slate-500 ml-1.5">({circunscricaoResolvida.sigla_unidade})</span>
                )}
              </div>
              <div className="text-slate-500">
                {circunscricaoResolvida.tipo_unidade === "superintendencia" ? "Superintendência Regional" : "Delegacia"} — Sede: {circunscricaoResolvida.municipio_sede}/{circunscricaoResolvida.uf}
              </div>
              <div className="text-slate-600 text-[10px]">
                Base legal: {circunscricaoResolvida.base_legal}
              </div>
            </div>
          )}
          {!resolvendoCircunscricao && !circunscricaoResolvida && clienteCidade && clienteUf && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 text-[11px] text-amber-400/80 flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Município não encontrado na tabela de circunscrições da PF. O endereçamento será marcado como pendente para revisão manual.</span>
            </div>
          )}
        </div>

        {/* Row 3: Foco argumentativo */}
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
              <Info className="h-3 w-3" />
              Profundidade e tom fixados: técnico, preciso e conciso.
            </div>
          </div>
        </div>

        {/* Row 4: Conditional fields for tempestividade */}
        {needsTempestividade && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-500/5 border border-amber-500/10 rounded-lg p-4">
            <div className="space-y-2">
              <Label className="text-amber-400 text-xs">Data da notificação / decisão</Label>
              <Input type="date" value={dataNotificacao} onChange={e => setDataNotificacao(e.target.value)}
                className="bg-[#0c0c14] border-slate-700 text-slate-100" />
              <p className="text-[10px] text-slate-600">Usada para alegar tempestividade. Deixe em branco se não souber.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-amber-400 text-xs">Informações sobre prazo / tempestividade</Label>
              <Input value={infoTempestividade} onChange={e => setInfoTempestividade(e.target.value)}
                className="bg-[#0c0c14] border-slate-700 text-slate-100"
                placeholder="Ex: notificado em 01/03/2026, prazo de 15 dias" />
              <p className="text-[10px] text-slate-600">Dados adicionais sobre cumprimento de prazo.</p>
            </div>
          </div>
        )}

        {/* Row 5: Case description */}
        <div className="space-y-2">
          <Label className="text-slate-300">Descrição completa do caso</Label>
          <Textarea value={entradaCaso} onChange={e => setEntradaCaso(e.target.value)}
            className="bg-[#0c0c14] border-slate-700 text-slate-100 min-h-[200px]"
            placeholder="Descreva detalhadamente os fatos, a situação jurídica, o histórico do caso, documentos relevantes e o que precisa na peça..." />
        </div>

        <Button onClick={gerar} disabled={loading} className="bg-amber-600 hover:bg-amber-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Gerar Peça
        </Button>
      </div>

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
                <div className="text-emerald-400/70 mt-0.5">
                  ✓ Unidade PF: {resultado.circunscricao_utilizada.unidade_pf}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={copiarMinuta} className="border-slate-700 text-slate-300">
              <Download className="h-3.5 w-3.5 mr-1" /> Copiar
            </Button>
            <Button size="sm" onClick={exportarDocx} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar DOCX
            </Button>
          </div>

          {resultado.fontes_utilizadas?.length > 0 && (
            <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Fontes Utilizadas na Geração</h3>
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

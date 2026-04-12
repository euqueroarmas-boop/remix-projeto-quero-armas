import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PenTool, Send, Loader2, AlertTriangle, Download, CheckCircle, Scale, Gavel, BookOpen } from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";

const TIPOS_PECA = [
  "peticao_inicial", "recurso", "mandado_seguranca", "parecer",
  "defesa", "memoriais", "contrarrazoes", "embargo", "outro",
];

const PROFUNDIDADES = [
  { value: "objetiva", label: "Objetiva" },
  { value: "intermediaria", label: "Intermediária" },
  { value: "aprofundada", label: "Aprofundada" },
];

const TONS = [
  { value: "tecnico_padrao", label: "Técnico Padrão" },
  { value: "mais_combativo", label: "Mais Combativo" },
  { value: "mais_conservador", label: "Mais Conservador" },
];

const FOCOS = [
  { value: "legalidade", label: "Legalidade" },
  { value: "motivacao", label: "Motivação" },
  { value: "efetiva_necessidade", label: "Efetiva Necessidade" },
  { value: "proporcionalidade", label: "Proporcionalidade" },
  { value: "erro_material", label: "Erro Material" },
  { value: "controle_judicial", label: "Controle Judicial" },
];

export default function QAGerarPecaPage() {
  const { user } = useQAAuth();
  const [casoTitulo, setCasoTitulo] = useState("");
  const [entradaCaso, setEntradaCaso] = useState("");
  const [tipoPeca, setTipoPeca] = useState("peticao_inicial");
  const [profundidade, setProfundidade] = useState("intermediaria");
  const [tom, setTom] = useState("tecnico_padrao");
  const [foco, setFoco] = useState("legalidade");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const gerar = async () => {
    if (!entradaCaso.trim()) { toast.error("Descreva o caso"); return; }
    setLoading(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("qa-gerar-peca", {
        body: {
          usuario_id: user?.id,
          caso_titulo: casoTitulo,
          entrada_caso: entradaCaso,
          tipo_peca: tipoPeca,
          profundidade, tom, foco,
        },
      });
      if (error) throw error;
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
      // Download the blob
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Título do Caso</Label>
            <Input value={casoTitulo} onChange={e => setCasoTitulo(e.target.value)}
              className="bg-[#0c0c14] border-slate-700 text-slate-100" placeholder="Ex: MS contra indeferimento de CR" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Tipo de Peça</Label>
            <Select value={tipoPeca} onValueChange={setTipoPeca}>
              <SelectTrigger className="bg-[#0c0c14] border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_PECA.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Profundidade</Label>
            <Select value={profundidade} onValueChange={setProfundidade}>
              <SelectTrigger className="bg-[#0c0c14] border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROFUNDIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Tom</Label>
            <Select value={tom} onValueChange={setTom}>
              <SelectTrigger className="bg-[#0c0c14] border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Foco Argumentativo</Label>
            <Select value={foco} onValueChange={setFoco}>
              <SelectTrigger className="bg-[#0c0c14] border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FOCOS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Descrição completa do caso</Label>
          <Textarea value={entradaCaso} onChange={e => setEntradaCaso(e.target.value)}
            className="bg-[#0c0c14] border-slate-700 text-slate-100 min-h-[200px]"
            placeholder="Descreva detalhadamente os fatos, a situação jurídica, o histórico do caso e o que precisa na peça..." />
        </div>

        <Button onClick={gerar} disabled={loading} className="bg-amber-600 hover:bg-amber-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Gerar Peça
        </Button>
      </div>

      {resultado && (
        <div className="space-y-4">
          {/* Confidence Score */}
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
            </div>
            <Button variant="outline" size="sm" onClick={copiarMinuta} className="border-slate-700 text-slate-300">
              <Download className="h-3.5 w-3.5 mr-1" /> Copiar
            </Button>
            <Button size="sm" onClick={exportarDocx} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar DOCX
            </Button>
          </div>

          {/* Sources used */}
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

          {/* Generated piece */}
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

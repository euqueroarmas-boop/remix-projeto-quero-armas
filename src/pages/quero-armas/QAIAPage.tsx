import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, Send, Loader2, BookOpen, Scale, Gavel, AlertTriangle, CheckCircle, BarChart3 } from "lucide-react";
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

export default function QAIAPage() {
  const { user } = useQAAuth();
  const [casoTitulo, setCasoTitulo] = useState("");
  const [entrada, setEntrada] = useState("");
  const [tipoPeca, setTipoPeca] = useState("peticao_inicial");
  const [profundidade, setProfundidade] = useState("intermediaria");
  const [tom, setTom] = useState("tecnico_padrao");
  const [foco, setFoco] = useState("legalidade");
  const [loading, setLoading] = useState(false);
  const [resposta, setResposta] = useState<any>(null);

  const consultar = async () => {
    if (!entrada.trim()) { toast.error("Descreva o caso"); return; }
    setLoading(true);
    setResposta(null);
    try {
      const { data, error } = await supabase.functions.invoke("qa-consulta-ia", {
        body: {
          usuario_id: user?.id,
          caso_titulo: casoTitulo,
          entrada_usuario: entrada,
          tipo_peca: tipoPeca,
          profundidade, tom, foco,
        },
      });
      if (error) throw error;
      setResposta(data);
    } catch (err: any) {
      toast.error(err.message || "Erro na consulta");
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (s: number) => {
    if (s >= 0.7) return "text-emerald-600";
    if (s >= 0.4) return "text-amber-600";
    return "text-red-500";
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "hsl(220 20% 18%)" }}>
          <Bot className="h-6 w-6" style={{ color: "hsl(230 80% 56%)" }} /> IA Jurídica
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Consulta assistida com base viva de conhecimento</p>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border bg-amber-50 border-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <span className="text-xs text-amber-700">A IA consulta exclusivamente as fontes cadastradas e validadas. Nunca inventa fatos, leis, artigos, jurisprudência ou precedentes. Fontes são ranqueadas por confiança.</span>
      </div>

      {/* Form */}
      <div className="qa-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Título do Caso</Label>
            <Input value={casoTitulo} onChange={e => setCasoTitulo(e.target.value)}
              className="h-9 bg-white border-slate-200 text-slate-800 uppercase" placeholder="Ex: Mandado de Segurança - CAC" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Tipo de Peça</Label>
            <Select value={tipoPeca} onValueChange={setTipoPeca}>
              <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-700 uppercase"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_PECA.map(t => <SelectItem key={t} value={t} className="uppercase">{t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Profundidade</Label>
            <Select value={profundidade} onValueChange={setProfundidade}>
              <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-700 uppercase"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROFUNDIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Tom</Label>
            <Select value={tom} onValueChange={setTom}>
              <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-700 uppercase"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Foco</Label>
            <Select value={foco} onValueChange={setFoco}>
              <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-700 uppercase"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FOCOS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium" style={{ color: "hsl(220 10% 45%)" }}>Descreva o caso e o que precisa</Label>
          <Textarea value={entrada} onChange={e => setEntrada(e.target.value)}
            className="bg-white border-slate-200 text-slate-800 min-h-[150px] uppercase"
            placeholder="Descreva os fatos, a situação jurídica e o que espera da IA..." />
        </div>
        <button onClick={consultar} disabled={loading} className="qa-btn-primary flex items-center gap-1.5 no-glow">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Consultar IA
        </button>
      </div>

      {/* Response */}
      {resposta && (
        <div className="space-y-4">
          {/* Confidence Score */}
          <div className="qa-card p-4 flex items-center gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${scoreColor(resposta.score_confianca)}`}>
                {((resposta.score_confianca || 0) * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "hsl(220 10% 55%)" }}>Confiança</div>
            </div>
            <div className="flex-1 text-xs" style={{ color: "hsl(220 10% 45%)" }}>
              <BarChart3 className="inline h-3 w-3 mr-1" />
              {resposta.fontes_recuperadas?.length || 0} fontes recuperadas
            </div>
          </div>

          {resposta.fontes_recuperadas?.length > 0 && (
            <div className="qa-card p-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: "hsl(220 20% 18%)" }}>Fontes Utilizadas (por relevância)</h3>
              <div className="space-y-2">
                {resposta.fontes_recuperadas.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {f.tipo === "norma" && <Scale className="h-3.5 w-3.5 text-emerald-500" />}
                    {f.tipo === "jurisprudencia" && <Gavel className="h-3.5 w-3.5 text-purple-500" />}
                    {f.tipo === "documento" && <BookOpen className="h-3.5 w-3.5 text-blue-500" />}
                    {f.tipo === "referencia_aprovada" && <CheckCircle className="h-3.5 w-3.5 text-amber-500" />}
                    <span className="flex-1 uppercase" style={{ color: "hsl(220 20% 18%)" }}>{f.titulo || f.referencia}</span>
                    <span className="tabular-nums" style={{ color: "hsl(220 10% 55%)" }}>
                      {(f.score_final || 0).toFixed(2)}
                    </span>
                    {f.score_validacao > 0 && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="qa-card p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "hsl(220 20% 18%)" }}>Resposta da IA</h3>
            <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "hsl(220 20% 25%)" }}>
              {resposta.resposta_ia}
            </div>
            {resposta.observacoes_ia && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                <strong>Observações:</strong> {resposta.observacoes_ia}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

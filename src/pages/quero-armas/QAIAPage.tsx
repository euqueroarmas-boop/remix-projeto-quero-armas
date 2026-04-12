import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, Send, Loader2, BookOpen, Scale, Gavel, AlertTriangle } from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";

const TIPOS_PECA = [
  "peticao_inicial", "recurso", "mandado_seguranca", "parecer",
  "defesa", "memoriais", "contrarrazoes", "embargo", "outro",
];

export default function QAIAPage() {
  const { user } = useQAAuth();
  const [casoTitulo, setCasoTitulo] = useState("");
  const [entrada, setEntrada] = useState("");
  const [tipoPeca, setTipoPeca] = useState("peticao_inicial");
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Bot className="h-6 w-6 text-amber-500" /> IA Jurídica
        </h1>
        <p className="text-sm text-slate-500 mt-1">Consulta assistida com base viva de conhecimento</p>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400/80 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>A IA consulta exclusivamente as fontes cadastradas e validadas no sistema. Ela não inventa fatos, leis, artigos, jurisprudência ou precedentes.</span>
      </div>

      <div className="space-y-4 bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Título do Caso</Label>
            <Input value={casoTitulo} onChange={e => setCasoTitulo(e.target.value)}
              className="bg-[#0c0c14] border-slate-700 text-slate-100" placeholder="Ex: Mandado de Segurança - CAC" />
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
        <div className="space-y-2">
          <Label className="text-slate-300">Descreva o caso e o que precisa</Label>
          <Textarea value={entrada} onChange={e => setEntrada(e.target.value)}
            className="bg-[#0c0c14] border-slate-700 text-slate-100 min-h-[150px]"
            placeholder="Descreva os fatos, a situação jurídica e o que espera da IA..." />
        </div>
        <Button onClick={consultar} disabled={loading} className="bg-amber-600 hover:bg-amber-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Consultar IA
        </Button>
      </div>

      {resposta && (
        <div className="space-y-4">
          {resposta.fontes_recuperadas?.length > 0 && (
            <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Fontes Utilizadas</h3>
              <div className="space-y-2">
                {resposta.fontes_recuperadas.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {f.tipo === "norma" && <Scale className="h-3.5 w-3.5 text-emerald-400" />}
                    {f.tipo === "jurisprudencia" && <Gavel className="h-3.5 w-3.5 text-purple-400" />}
                    {f.tipo === "documento" && <BookOpen className="h-3.5 w-3.5 text-blue-400" />}
                    <span className="text-slate-400">{f.titulo || f.referencia}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Resposta da IA</h3>
            <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
              {resposta.resposta_ia}
            </div>
            {resposta.observacoes_ia && (
              <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-amber-400/80">
                <strong>Observações:</strong> {resposta.observacoes_ia}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

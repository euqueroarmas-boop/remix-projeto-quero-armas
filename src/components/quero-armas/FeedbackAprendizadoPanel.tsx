import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Award, TrendingUp, AlertTriangle, X, Loader2, CheckCircle } from "lucide-react";

const RESULTADOS = [
  { value: "pendente", label: "Pendente", color: "text-slate-500" },
  { value: "deferida", label: "Deferida", color: "text-emerald-600" },
  { value: "parcialmente_deferida", label: "Parcialmente Deferida", color: "text-amber-600" },
  { value: "indeferida", label: "Indeferida", color: "text-red-600" },
];

const CLASSIFICACOES = [
  { value: "nao_avaliada", label: "Não Avaliada", color: "text-slate-500", peso: 0 },
  { value: "peca_modelo", label: "Peça Modelo", color: "text-purple-700", peso: 1.0 },
  { value: "excelente_fundamentacao", label: "Excelente Fundamentação", color: "text-emerald-700", peso: 0.9 },
  { value: "precisa_melhorar", label: "Precisa Melhorar", color: "text-amber-700", peso: 0.2 },
  { value: "nao_usar", label: "Não Usar como Referência", color: "text-red-600", peso: 0 },
];

interface Props {
  geracaoId: string;
  userId?: string;
  existingFeedback?: any;
  onSaved?: () => void;
}

export default function FeedbackAprendizadoPanel({ geracaoId, userId, existingFeedback, onSaved }: Props) {
  const [resultado, setResultado] = useState(existingFeedback?.resultado_pratico || "pendente");
  const [classificacao, setClassificacao] = useState(existingFeedback?.classificacao_aprendizado || "nao_avaliada");
  const [observacoes, setObservacoes] = useState(existingFeedback?.observacoes || "");
  const [aprovadaModelo, setAprovadaModelo] = useState(existingFeedback?.aprovada_como_modelo || false);
  const [saving, setSaving] = useState(false);

  const calcularPeso = (res: string, cls: string): number => {
    const classInfo = CLASSIFICACOES.find(c => c.value === cls);
    let peso = classInfo?.peso || 0;
    if (res === "deferida") peso = Math.max(peso, 0.8);
    if (res === "parcialmente_deferida") peso = Math.max(peso, 0.4);
    if (res === "indeferida") peso = Math.min(peso, 0.1);
    if (cls === "nao_usar") peso = 0;
    return Math.round(peso * 100) / 100;
  };

  const salvar = async () => {
    setSaving(true);
    try {
      const peso = calcularPeso(resultado, classificacao);
      const isModelo = aprovadaModelo || classificacao === "peca_modelo" || (resultado === "deferida" && classificacao === "excelente_fundamentacao");

      const payload = {
        geracao_id: geracaoId,
        usuario_id: userId || "00000000-0000-0000-0000-000000000000",
        resultado_pratico: resultado,
        classificacao_aprendizado: classificacao,
        peso_aprendizado: peso,
        aprovada_como_modelo: isModelo,
        observacoes: observacoes || null,
        status_feedback: resultado === "deferida" ? "aprovada" : resultado === "indeferida" ? "rejeitada" : "pendente",
        incorporada_aprendizado: isModelo && resultado === "deferida",
        incorporada_em: isModelo && resultado === "deferida" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (existingFeedback?.id) {
        await supabase.from("qa_feedback_geracoes" as any)
          .update(payload as any)
          .eq("id", existingFeedback.id);
      } else {
        await supabase.from("qa_feedback_geracoes" as any)
          .insert(payload as any);
      }

      // Log
      await supabase.from("qa_logs_auditoria" as any).insert({
        usuario_id: userId,
        entidade: "qa_feedback_geracoes",
        entidade_id: geracaoId,
        acao: "feedback_aprendizado",
        detalhes_json: { resultado, classificacao, peso, aprovada_modelo: isModelo },
      });

      toast.success(isModelo ? "Peça incorporada ao aprendizado da IA" : "Feedback salvo com sucesso");
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar feedback");
    } finally {
      setSaving(false);
    }
  };

  const pesoAtual = calcularPeso(resultado, classificacao);

  return (
    <div className="space-y-3 p-4 rounded-xl border" style={{ borderColor: "hsl(220 13% 91%)", background: "hsl(220 20% 98%)" }}>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4" style={{ color: "hsl(230 80% 56%)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 20% 18%)" }}>
          Feedback de Aprendizado
        </span>
        {pesoAtual > 0.5 && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
            Peso: {pesoAtual}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] font-medium uppercase" style={{ color: "hsl(220 10% 45%)" }}>Resultado Prático</Label>
          <Select value={resultado} onValueChange={setResultado}>
            <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-700 text-xs uppercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESULTADOS.map(r => (
                <SelectItem key={r.value} value={r.value} className="text-xs">
                  <span className={r.color}>{r.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-medium uppercase" style={{ color: "hsl(220 10% 45%)" }}>Classificação para IA</Label>
          <Select value={classificacao} onValueChange={setClassificacao}>
            <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-700 text-xs uppercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLASSIFICACOES.map(c => (
                <SelectItem key={c.value} value={c.value} className="text-xs">
                  <span className={c.color}>{c.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] font-medium uppercase" style={{ color: "hsl(220 10% 45%)" }}>Observações (opcional)</Label>
        <Textarea
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          className="bg-white border-slate-200 text-xs min-h-[60px] uppercase"
          placeholder="O que funcionou bem? O que pode melhorar?"
        />
      </div>

      {/* Info box */}
      {resultado === "deferida" && classificacao !== "nao_usar" && (
        <div className="flex items-start gap-2 text-[11px] p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <span className="text-emerald-700">
            Esta peça será incorporada como referência de aprendizado da IA com peso {pesoAtual}.
            A estrutura argumentativa e fundamentos serão usados para aprimorar futuras gerações.
          </span>
        </div>
      )}

      {classificacao === "nao_usar" && (
        <div className="flex items-start gap-2 text-[11px] p-2.5 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
          <span className="text-red-600">
            Esta peça NÃO será usada como referência pela IA. Nenhum aprendizado será incorporado.
          </span>
        </div>
      )}

      <button
        onClick={salvar}
        disabled={saving}
        className="qa-btn-primary flex items-center gap-1.5 no-glow w-full justify-center"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
        {existingFeedback?.id ? "Atualizar Feedback" : "Salvar Feedback"}
      </button>
    </div>
  );
}

import { useState, useMemo } from "react";
import { AlertTriangle, Check, X, BookOpen, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CorrecaoAlerta } from "./DraftingView";

const CATEGORIA_LABEL: Record<string, string> = {
  enderecamento_errado: "Endereçamento errado",
  circunscricao_errada: "Circunscrição/Delegacia errada",
  fundamento_juridico_incorreto: "Fundamento jurídico incorreto",
  tese_inadequada: "Tese inadequada",
  excesso_linguagem: "Excesso de linguagem",
  omissao_fato_relevante: "Omissão de fato relevante",
  uso_dado_inexistente: "Uso de dado inexistente",
  confusao_posse_porte: "Confusão posse × porte",
  confusao_sinarm_sigma: "Confusão SINARM × SIGMA",
  confusao_pf_exercito: "Confusão PF × Exército",
  prazo_administrativo_errado: "Prazo administrativo errado",
  redacao_fraca: "Redação fraca",
  pedido_final_incorreto: "Pedido final incorreto",
  conclusao_desalinhada: "Conclusão desalinhada",
  outro: "Outro",
};

export interface CorrecoesAlertaPanelProps {
  alertas: CorrecaoAlerta[];
  onAplicar: (alerta: CorrecaoAlerta) => boolean;
  onIgnorar: (correcao_id: string) => void;
}

export default function CorrecoesAlertaPanel({
  alertas,
  onAplicar,
  onIgnorar,
}: CorrecoesAlertaPanelProps) {
  const [aplicados, setAplicados] = useState<Set<string>>(new Set());
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set());

  const visiveis = useMemo(
    () => alertas.filter(a => !aplicados.has(a.correcao_id) && !ignorados.has(a.correcao_id)),
    [alertas, aplicados, ignorados],
  );

  if (!alertas || alertas.length === 0) return null;
  if (visiveis.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2 text-[12px] text-emerald-800">
        <Check className="h-4 w-4" />
        Todos os alertas de correções da IA foram tratados nesta peça.
      </div>
    );
  }

  return (
    <div className="border border-amber-300 bg-amber-50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-amber-100/70 border-b border-amber-200 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-800" />
        <div className="flex-1">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-amber-900">
            Esta peça pode conter trecho semelhante a erro já corrigido anteriormente
          </div>
          <div className="text-[11px] text-amber-800/80 mt-0.5">
            {visiveis.length} alerta(s) detectado(s). Revise antes de baixar/copiar a peça.
          </div>
        </div>
      </div>

      <div className="divide-y divide-amber-200">
        {visiveis.map((a) => (
          <div key={a.correcao_id} className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-amber-200 text-amber-900">
                {CATEGORIA_LABEL[a.categoria] || a.categoria}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-white border border-amber-200 text-amber-900">
                escopo: {a.escopo}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-white border border-amber-200 text-amber-900">
                detecção: {a.metodo}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-white border border-red-200 rounded p-2">
                <div className="text-[9px] font-mono uppercase tracking-wider text-red-700 mb-1">
                  Trecho suspeito encontrado
                </div>
                <div className="text-[12px] text-slate-800 font-serif leading-relaxed whitespace-pre-wrap">
                  {a.trecho_suspeito}
                </div>
              </div>
              <div className="bg-white border border-emerald-200 rounded p-2">
                <div className="text-[9px] font-mono uppercase tracking-wider text-emerald-700 mb-1">
                  Correção recomendada
                </div>
                <div className="text-[12px] text-slate-800 font-serif leading-relaxed whitespace-pre-wrap">
                  {a.trecho_correto}
                </div>
              </div>
            </div>

            {(a.explicacao || a.regra_aplicavel) && (
              <div className="text-[11px] text-amber-900/90 bg-white/60 border border-amber-200 rounded p-2 flex gap-2">
                <BookOpen className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  {a.explicacao && <div><span className="font-semibold">Explicação:</span> {a.explicacao}</div>}
                  {a.regra_aplicavel && <div><span className="font-semibold">Regra:</span> {a.regra_aplicavel}</div>}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => {
                  const ok = onAplicar(a);
                  if (ok) setAplicados(prev => new Set(prev).add(a.correcao_id));
                }}
                className="h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              >
                <Wand2 className="h-3.5 w-3.5 mr-1" /> Aplicar correção
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIgnorados(prev => new Set(prev).add(a.correcao_id));
                  onIgnorar(a.correcao_id);
                }}
                className="h-8 text-[11px] border-amber-300 text-amber-900 hover:bg-amber-100"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Ignorar alerta
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
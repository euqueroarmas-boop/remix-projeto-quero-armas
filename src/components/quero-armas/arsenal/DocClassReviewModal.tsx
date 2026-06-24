/**
 * DocClassReviewModal
 *
 * Modal de revisão SEMPRE exibido após classificação automática de qualquer
 * documento do Arsenal (CRAF/GT/GTE/Guia de Trânsito/Nota Fiscal/Exame).
 *
 * REGRA DE NEGÓCIO (escolha do cliente):
 *   "Sempre mostrar tela de revisão" — mesmo com confiança >= 95% o cliente
 *   precisa confirmar visualmente antes do documento alimentar KPIs/Bancada
 *   Tática. A recomendação da IA só altera o TOM da tela.
 *
 * Tons:
 *  - alta confiança (>=80%) e SEM divergência: "A IA identificou com alta confiança"
 *  - média confiança (50–79%):                  "Confirmar classificação"
 *  - divergência:                                "Tipo divergente detectado"
 *  - baixa confiança (<50%) ou DESCONHECIDO:    "Revisão obrigatória recomendada"
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, X } from "lucide-react";

export type DocTipoArsenal =
  | "CRAF"
  | "GT"
  | "GTE"
  | "GUIA_TRANSITO"
  | "NOTA_FISCAL"
  | "EXAME_LAUDO"
  | "DESCONHECIDO";

export interface ClassificacaoIA {
  tipoDetectado: DocTipoArsenal;
  confianca: number;
  justificativa: string;
  camposExtraidos?: Record<string, string | undefined> | null;
  divergenciaComSelecaoManual: boolean;
  recomendacao: "aceitar" | "confirmar" | "revisao_obrigatoria";
  revisao_obrigatoria: boolean;
}

interface Props {
  open: boolean;
  tipoSelecionado: DocTipoArsenal;
  classificacao: ClassificacaoIA;
  onResolve: (r: {
    decision: "corrigir" | "manter_revisao" | "cancelar";
    tipoFinal: DocTipoArsenal;
    revisaoObrigatoria: boolean;
  }) => void;
}

const TIPO_LABEL: Record<DocTipoArsenal, string> = {
  CRAF: "CRAF — Certificado de Registro de Arma de Fogo",
  GT: "GT — Guia de Tráfego",
  GTE: "GTE — Guia de Tráfego Eventual",
  GUIA_TRANSITO: "Guia de Trânsito SINARM/PF",
  NOTA_FISCAL: "Nota Fiscal (NF-e/DANFE)",
  EXAME_LAUDO: "Exame / Laudo",
  DESCONHECIDO: "Não identificado",
};

export default function DocClassReviewModal({
  open,
  tipoSelecionado,
  classificacao,
  onResolve,
}: Props) {
  const { tipoDetectado, confianca, justificativa, camposExtraidos, divergenciaComSelecaoManual, revisao_obrigatoria } =
    classificacao;
  const pct = Math.round((confianca || 0) * 100);

  const altaConfianca = (classificacao.confianca || 0) >= 0.8;
  const titulo = revisao_obrigatoria
    ? "Revisão obrigatória recomendada"
    : divergenciaComSelecaoManual
    ? "Tipo divergente detectado"
    : altaConfianca
    ? "A IA identificou com alta confiança"
    : "Confirmar classificação";

  const cor = revisao_obrigatoria
    ? "#7A1F2B"
    : divergenciaComSelecaoManual
    ? "#B45309"
    : "#0A0A0A";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onResolve({ decision: "cancelar", tipoFinal: tipoSelecionado, revisaoObrigatoria: false })}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="!p-0 border-0 bg-white shadow-2xl overflow-hidden !max-w-md flex flex-col !max-h-[90vh]"
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-200/80">
          <DialogTitle className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: cor }}>
            {revisao_obrigatoria ? (
              <ShieldAlert className="h-4 w-4" />
            ) : divergenciaComSelecaoManual ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {titulo}
          </DialogTitle>
          <p className="text-[11px] text-slate-500 mt-1">
            Todo documento do Arsenal passa por revisão visual antes de salvar — mesmo
            quando a IA tem alta confiança. Confirme, corrija o tipo ou envie para a Equipe.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">Sua seleção</p>
              <p className="mt-1 text-[12px] font-bold uppercase text-slate-800 leading-tight">
                {TIPO_LABEL[tipoSelecionado]}
              </p>
            </div>
            <div
              className="rounded-md border p-3"
              style={{
                background: divergenciaComSelecaoManual ? "rgba(122,31,43,0.06)" : "rgba(16,185,129,0.06)",
                borderColor: divergenciaComSelecaoManual ? "rgba(122,31,43,0.30)" : "rgba(16,185,129,0.30)",
              }}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: divergenciaComSelecaoManual ? "#7A1F2B" : "#047857" }}>
                IA detectou
              </p>
              <p className="mt-1 text-[12px] font-bold uppercase leading-tight" style={{ color: divergenciaComSelecaoManual ? "#7A1F2B" : "#065F46" }}>
                {TIPO_LABEL[tipoDetectado]}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">Confiança: <b>{pct}%</b></p>
            </div>
          </div>

          {justificativa && (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Justificativa da IA</p>
              <p className="text-[11px] leading-snug text-slate-700">{justificativa}</p>
            </div>
          )}

          {camposExtraidos && Object.values(camposExtraidos).some((v) => !!v) && (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">Campos extraídos</p>
              <ul className="text-[11px] text-slate-700 space-y-1">
                {Object.entries(camposExtraidos).map(([k, v]) =>
                  v ? (
                    <li key={k} className="flex gap-2">
                      <span className="uppercase text-[10px] text-slate-500 min-w-[120px]">{k.replace(/_/g, " ")}:</span>
                      <span className="font-semibold uppercase">{String(v)}</span>
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          )}

          {revisao_obrigatoria && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800 flex gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Este documento será salvo com <b>status REVISÃO OBRIGATÓRIA</b> e <b>não alimentará</b> KPIs,
                CRAF válido, GTE ativa nem vínculos automáticos da arma até a Equipe Quero Armas confirmar.
              </span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200/80 px-5 py-3 flex flex-col gap-2 bg-slate-50/60">
          {/* Confirmar como o tipo escolhido pelo cliente (default seguro) */}
          {!revisao_obrigatoria && (
            <Button
              size="sm"
              onClick={() =>
                onResolve({
                  decision: "corrigir",
                  tipoFinal: divergenciaComSelecaoManual ? tipoDetectado : tipoSelecionado,
                  revisaoObrigatoria: false,
                })
              }
              className="w-full text-white"
              style={{ background: "#0A0A0A" }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {divergenciaComSelecaoManual
                ? `Corrigir para ${TIPO_LABEL[tipoDetectado]} e salvar`
                : "Confirmar e salvar"}
            </Button>
          )}
          {/* Sempre disponível: enviar para revisão da Equipe */}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onResolve({ decision: "manter_revisao", tipoFinal: tipoSelecionado, revisaoObrigatoria: true })
            }
            className="w-full"
            style={{ borderColor: "#7A1F2B", color: "#7A1F2B" }}
          >
            Enviar para revisão da Equipe Quero Armas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onResolve({ decision: "cancelar", tipoFinal: tipoSelecionado, revisaoObrigatoria: false })
            }
            className="w-full text-slate-500"
          >
            <X className="h-4 w-4 mr-1" /> Cancelar envio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

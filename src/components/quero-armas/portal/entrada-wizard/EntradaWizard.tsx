import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronRight,
  Compass,
  FileSignature,
  Loader2,
  Sparkles,
  Target,
  Wrench,
  HelpCircle,
  ShieldCheck,
  Shield,
  Crosshair,
  Archive,
  Leaf,
} from "lucide-react";

/* =============================================================================
 * EntradaWizard — Assistente de Entrada do portal
 *
 * Passo 1: objetivo (4 opções)
 *   inicial        → Tirar/renovar CR de CAC          (SINARM CAC)
 *   defesa_pessoal → Adquirir arma para defesa pessoal (PF/SINARM)
 *   continuidade   → Mexer em arma que já tenho
 *   indefinido     → Não tenho certeza (vai direto ao catálogo completo)
 *
 * Passo 2:
 *   inicial / defesa_pessoal → "Você já possui arma registrada?" (sim/nao/nao_sei)
 *   continuidade              → "Qual é a finalidade?" (caca/tiro_esportivo/colecionamento/defesa_pessoal)
 *   indefinido                → pula o passo 2, vai direto ao catálogo
 *
 * onConcluido devolve { objetivo, possuiArma, finalidadeArma }.
 * ============================================================================= */

const MARROM = "#7A1F2B";

export type EntradaObjetivo = "inicial" | "defesa_pessoal" | "continuidade" | "indefinido";
export type EntradaPossuiArma = "sim" | "nao" | "nao_sei";
export type EntradaFinalidade = "caca" | "tiro_esportivo" | "colecionamento" | "defesa_pessoal";

export interface EntradaWizardRespostas {
  objetivo: EntradaObjetivo;
  possuiArma: EntradaPossuiArma | null;
  finalidadeArma: EntradaFinalidade | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string | number | null | undefined;
  onConcluido?: (respostas: EntradaWizardRespostas) => void;
}

type Step = 1 | 2;

export default function EntradaWizard({ open, onOpenChange, clienteId, onConcluido }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [objetivo, setObjetivo] = useState<EntradaObjetivo | null>(null);
  const [possuiArma, setPossuiArma] = useState<EntradaPossuiArma | null>(null);
  const [finalidadeArma, setFinalidadeArma] = useState<EntradaFinalidade | null>(null);
  const [salvando, setSalvando] = useState(false);

  const precisaPasso2 = objetivo !== "indefinido";
  const passo2EhFinalidade = objetivo === "continuidade";

  async function concluir() {
    if (!objetivo || !clienteId) {
      toast.error("Não foi possível salvar suas respostas. Recarregue a página.");
      return;
    }
    // Para continuidade, possuiArma é implicitamente "sim"
    const possuiArmaFinal: EntradaPossuiArma | null =
      objetivo === "continuidade" ? "sim" : possuiArma;

    setSalvando(true);
    try {
      const { error } = await supabase
        .from("qa_clientes" as any)
        .update({
          entrada_objetivo: objetivo,
          entrada_possui_arma: possuiArmaFinal,
          entrada_finalidade_arma: finalidadeArma,
          entrada_respondida_em: new Date().toISOString(),
        })
        .eq("id", clienteId);
      if (error) {
        toast.error("Não foi possível salvar suas respostas. Tente novamente.");
        setSalvando(false);
        return;
      }
      onConcluido?.({ objetivo, possuiArma: possuiArmaFinal, finalidadeArma });
      onOpenChange(false);
      setTimeout(() => {
        setStep(1);
        setObjetivo(null);
        setPossuiArma(null);
        setFinalidadeArma(null);
        setSalvando(false);
      }, 250);
    } catch {
      toast.error("Não foi possível salvar suas respostas. Tente novamente.");
      setSalvando(false);
    }
  }

  const passo2Completo = passo2EhFinalidade ? !!finalidadeArma : !!possuiArma;

  return (
    <Dialog open={open} onOpenChange={(o) => !salvando && onOpenChange(o)}>
      <DialogContent className="max-w-lg bg-[#f6f5f1] border-slate-200 max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${MARROM}14` }}>
              <Compass className="h-4 w-4" style={{ color: MARROM }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[13px] font-bold uppercase tracking-tight text-slate-900">
                Quer adquirir um novo serviço? Iremos te guiar pelo caminho certo
              </DialogTitle>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Passo {step} de {precisaPasso2 ? "2" : "1"}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* ── Passo 1: objetivo ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-[12px] text-slate-600">
              Escolha a opção que mais combina com o que você precisa — isso
              só ajuda a mostrar os serviços certos. Você pode mudar depois.
            </p>

            <OptionCard
              icon={<FileSignature className="h-5 w-5" style={{ color: MARROM }} />}
              title="Tirar ou renovar meu CR de CAC"
              subtitle="Concessão de CR, filiação a clube, declarações iniciais — SINARM CAC"
              selected={objetivo === "inicial"}
              onClick={() => setObjetivo("inicial")}
            />
            <OptionCard
              icon={<Shield className="h-5 w-5" style={{ color: MARROM }} />}
              title="Adquirir uma arma para defesa pessoal"
              subtitle="Posse, registro, porte, aquisição — Polícia Federal/SINARM"
              selected={objetivo === "defesa_pessoal"}
              onClick={() => setObjetivo("defesa_pessoal")}
            />
            <OptionCard
              icon={<Wrench className="h-5 w-5" style={{ color: MARROM }} />}
              title="Mexer numa arma que já tenho"
              subtitle="Renovar CRAF, transferir, apostilar, GTE, regularizar"
              selected={objetivo === "continuidade"}
              onClick={() => setObjetivo("continuidade")}
            />
            <OptionCard
              icon={<Target className="h-5 w-5" style={{ color: MARROM }} />}
              title="Não tenho certeza, me mostre tudo"
              subtitle="Vou navegar e escolher"
              selected={objetivo === "indefinido"}
              onClick={() => setObjetivo("indefinido")}
            />

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={!objetivo}
                onClick={() => {
                  if (!objetivo) return;
                  if (objetivo === "indefinido") {
                    void concluir();
                  } else {
                    setStep(2);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
                style={{ background: MARROM }}
              >
                {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Continuar <ChevronRight className="h-3.5 w-3.5" /></>}
              </button>
            </div>
          </div>
        )}

        {/* ── Passo 2a: possuiArma (inicial / defesa_pessoal) ──────────── */}
        {step === 2 && !passo2EhFinalidade && (
          <div className="space-y-3">
            <p className="text-[12px] text-slate-600">
              Você já possui arma de fogo registrada em seu nome?
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <SmallOption
                icon={<ShieldCheck className="h-4 w-4" style={{ color: MARROM }} />}
                label="Sim"
                selected={possuiArma === "sim"}
                onClick={() => setPossuiArma("sim")}
              />
              <SmallOption
                icon={<Sparkles className="h-4 w-4 text-slate-400" />}
                label="Não"
                selected={possuiArma === "nao"}
                onClick={() => setPossuiArma("nao")}
              />
              <SmallOption
                icon={<HelpCircle className="h-4 w-4 text-slate-400" />}
                label="Não tenho certeza"
                selected={possuiArma === "nao_sei"}
                onClick={() => setPossuiArma("nao_sei")}
              />
            </div>

            <p className="text-[10px] italic text-slate-500">
              Essa resposta serve para organizar seu Meu Arsenal. Não restringe o que você pode fazer.
            </p>

            <StepNavButtons
              salvando={salvando}
              onVoltar={() => setStep(1)}
              onConcluir={() => void concluir()}
              disabled={!passo2Completo}
            />
          </div>
        )}

        {/* ── Passo 2b: finalidadeArma (continuidade) ───────────────────── */}
        {step === 2 && passo2EhFinalidade && (
          <div className="space-y-3">
            <p className="text-[12px] text-slate-600">
              Qual é a finalidade da arma que você quer regularizar ou renovar?
            </p>

            <div className="grid grid-cols-2 gap-2">
              <SmallOption
                icon={<Crosshair className="h-4 w-4" style={{ color: MARROM }} />}
                label="Tiro esportivo"
                selected={finalidadeArma === "tiro_esportivo"}
                onClick={() => setFinalidadeArma("tiro_esportivo")}
              />
              <SmallOption
                icon={<Leaf className="h-4 w-4" style={{ color: MARROM }} />}
                label="Caça"
                selected={finalidadeArma === "caca"}
                onClick={() => setFinalidadeArma("caca")}
              />
              <SmallOption
                icon={<Archive className="h-4 w-4" style={{ color: MARROM }} />}
                label="Colecionamento"
                selected={finalidadeArma === "colecionamento"}
                onClick={() => setFinalidadeArma("colecionamento")}
              />
              <SmallOption
                icon={<Shield className="h-4 w-4" style={{ color: MARROM }} />}
                label="Defesa pessoal"
                selected={finalidadeArma === "defesa_pessoal"}
                onClick={() => setFinalidadeArma("defesa_pessoal")}
              />
            </div>

            <p className="text-[10px] italic text-slate-500">
              Isso determina quais serviços são mostrados (SINARM CAC para atirador/caçador/colecionador, PF para defesa pessoal).
            </p>

            <StepNavButtons
              salvando={salvando}
              onVoltar={() => setStep(1)}
              onConcluir={() => void concluir()}
              disabled={!passo2Completo}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function StepNavButtons({
  salvando,
  onVoltar,
  onConcluir,
  disabled,
}: {
  salvando: boolean;
  onVoltar: () => void;
  onConcluir: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-1">
      <button
        type="button"
        onClick={onVoltar}
        disabled={salvando}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </button>
      <button
        type="button"
        disabled={disabled || salvando}
        onClick={onConcluir}
        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
        style={{ background: "#7A1F2B" }}
      >
        {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Ver meus serviços
      </button>
    </div>
  );
}

function OptionCard({
  icon,
  title,
  subtitle,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
        selected
          ? "border-[#7A1F2B] bg-[#FBF3F4] shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-slate-900">{title}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-slate-600">{subtitle}</div>
      </div>
      <span
        className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-[#7A1F2B]" : "border-slate-300"
        }`}
      >
        {selected && <span className="h-2 w-2 rounded-full" style={{ background: "#7A1F2B" }} />}
      </span>
    </button>
  );
}

function SmallOption({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition ${
        selected
          ? "border-[#7A1F2B] bg-[#FBF3F4] shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      {icon}
      <span className="text-[12px] font-bold text-slate-900">{label}</span>
    </button>
  );
}

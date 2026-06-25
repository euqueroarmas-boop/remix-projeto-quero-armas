import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  FileSignature,
  Loader2,
  Target,
  Wrench,
  HelpCircle,
  ShieldCheck,
  Shield,
  Crosshair,
  Archive,
  Leaf,
} from "lucide-react";

/* Cockpit Z6 Light · V4 Denso Enxuto */
const INK = "#0A0A0A";
const SUB = "#6A6A6A";
const LINE = "#E5E5E5";
const SOFT = "#EFEFEF";
const PAPER = "#FFFFFF";
const BORDO = "#7A1F2B";
const OSWALD = { fontFamily: "Oswald, sans-serif" } as const;
const INTER = { fontFamily: "Inter, sans-serif" } as const;

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

  const totalSteps = precisaPasso2 ? 2 : 1;

  const objetivoList = [
    { key: "inicial" as const,        icon: FileSignature, title: "TIRAR OU RENOVAR MEU CR DE CAC",      sub: "Concessão de CR, filiação a clube, declarações iniciais — SINARM CAC" },
    { key: "defesa_pessoal" as const, icon: Shield,        title: "ADQUIRIR ARMA PARA DEFESA PESSOAL",   sub: "Posse, registro, porte, aquisição — Polícia Federal/SINARM" },
    { key: "continuidade" as const,   icon: Wrench,        title: "MEXER NUMA ARMA QUE JÁ TENHO",        sub: "Renovar CRAF, transferir, apostilar, GTE, regularizar" },
    { key: "indefinido" as const,     icon: Target,        title: "NÃO TENHO CERTEZA, ME MOSTRE TUDO",   sub: "Vou navegar e escolher" },
  ];

  const possuiList = [
    { key: "sim" as const,     icon: ShieldCheck, label: "SIM" },
    { key: "nao" as const,     icon: Crosshair,   label: "NÃO" },
    { key: "nao_sei" as const, icon: HelpCircle,  label: "NÃO TENHO CERTEZA" },
  ];

  const finalidadeList = [
    { key: "tiro_esportivo" as const, icon: Crosshair, label: "TIRO ESPORTIVO" },
    { key: "caca" as const,           icon: Leaf,      label: "CAÇA" },
    { key: "colecionamento" as const, icon: Archive,   label: "COLECIONAMENTO" },
    { key: "defesa_pessoal" as const, icon: Shield,    label: "DEFESA PESSOAL" },
  ];

  function handleContinuar() {
    if (step === 1) {
      if (!objetivo) return;
      if (objetivo === "indefinido") void concluir();
      else setStep(2);
      return;
    }
    if (!passo2Completo) return;
    void concluir();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !salvando && onOpenChange(o)}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ background: PAPER, borderColor: LINE }}
      >
        {/* ── Header: NOVO SERVIÇO · n/total + progress ──────────────── */}
        <div className="px-5 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: SOFT }}>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ ...OSWALD, color: BORDO }}>
            NOVO SERVIÇO · {step}/{totalSteps}
          </div>
          <div className="flex gap-1 w-32">
            <div className="h-[3px] flex-1 rounded-sm" style={{ background: BORDO }} />
            <div className="h-[3px] flex-1 rounded-sm" style={{ background: step === 2 ? BORDO : SOFT }} />
          </div>
        </div>

        {/* ── Title ──────────────────────────────────────────────────── */}
        <div className="px-5 pt-4">
          <h2 className="text-[20px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>
            Quer adquirir um novo serviço?<br />Iremos te guiar pelo caminho certo.
          </h2>
        </div>

        {/* ── Lista de opções ────────────────────────────────────────── */}
        <div className="px-5 pb-5 pt-3">
          {step === 1 && (
            <ul className="divide-y rounded border" style={{ borderColor: LINE }}>
              {objetivoList.map((o) => {
                const selected = objetivo === o.key;
                return (
                  <li key={o.key}>
                    <button
                      type="button"
                      onClick={() => setObjetivo(o.key)}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left transition"
                      style={{ background: selected ? `${BORDO}0F` : PAPER }}
                    >
                      <o.icon className="h-4 w-4 shrink-0" style={{ color: BORDO }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{o.title}</div>
                        <div className="text-[11px] leading-snug" style={{ ...INTER, color: SUB }}>{o.sub}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0" style={{ color: selected ? BORDO : SUB }} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {step === 2 && !passo2EhFinalidade && (
            <>
              <div className="text-[11px] font-bold uppercase mb-2 tracking-wider" style={{ ...OSWALD, color: INK }}>
                Você já possui arma de fogo registrada?
              </div>
              <ul className="divide-y rounded border" style={{ borderColor: LINE }}>
                {possuiList.map((p) => {
                  const selected = possuiArma === p.key;
                  return (
                    <li key={p.key}>
                      <button
                        type="button"
                        onClick={() => setPossuiArma(p.key)}
                        className="flex w-full items-center gap-3 px-3 py-3 text-left transition"
                        style={{ background: selected ? `${BORDO}0F` : PAPER }}
                      >
                        <p.icon className="h-4 w-4 shrink-0" style={{ color: BORDO }} />
                        <div className="flex-1 text-[12.5px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{p.label}</div>
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: selected ? BORDO : "#CFCFCF" }}>
                          {selected && <span className="h-2 w-2 rounded-full" style={{ background: BORDO }} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[10.5px] italic" style={{ ...INTER, color: SUB }}>
                Essa resposta serve para organizar seu Meu Arsenal. Não restringe o que você pode fazer.
              </p>
            </>
          )}

          {step === 2 && passo2EhFinalidade && (
            <>
              <div className="text-[11px] font-bold uppercase mb-2 tracking-wider" style={{ ...OSWALD, color: INK }}>
                Qual é a finalidade da arma?
              </div>
              <ul className="divide-y rounded border" style={{ borderColor: LINE }}>
                {finalidadeList.map((f) => {
                  const selected = finalidadeArma === f.key;
                  return (
                    <li key={f.key}>
                      <button
                        type="button"
                        onClick={() => setFinalidadeArma(f.key)}
                        className="flex w-full items-center gap-3 px-3 py-3 text-left transition"
                        style={{ background: selected ? `${BORDO}0F` : PAPER }}
                      >
                        <f.icon className="h-4 w-4 shrink-0" style={{ color: BORDO }} />
                        <div className="flex-1 text-[12.5px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{f.label}</div>
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: selected ? BORDO : "#CFCFCF" }}>
                          {selected && <span className="h-2 w-2 rounded-full" style={{ background: BORDO }} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[10.5px] italic" style={{ ...INTER, color: SUB }}>
                Isso determina quais serviços são mostrados (SINARM CAC para atirador/caçador/colecionador, PF para defesa pessoal).
              </p>
            </>
          )}

          {/* ── Footer ─────────────────────────────────────────────── */}
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              disabled={salvando}
              onClick={() => (step === 2 ? setStep(1) : onOpenChange(false))}
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase disabled:opacity-50"
              style={{ ...OSWALD, color: SUB }}
            >
              <ArrowLeft className="h-3 w-3" /> {step === 2 ? "VOLTAR" : "CANCELAR"}
            </button>
            <button
              type="button"
              disabled={salvando || (step === 1 ? !objetivo : !passo2Completo)}
              onClick={handleContinuar}
              className="inline-flex items-center gap-1.5 rounded-sm px-4 py-2 text-[11.5px] font-bold uppercase text-white disabled:opacity-50"
              style={{ ...OSWALD, background: BORDO }}
            >
              {salvando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  {step === 2 ? "VER SERVIÇOS" : "CONTINUAR"} <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

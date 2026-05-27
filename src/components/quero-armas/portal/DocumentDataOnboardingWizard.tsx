// ============================================================================
// DocumentDataOnboardingWizard
// ----------------------------------------------------------------------------
// Wizard KYC para coleta dos dados que faltam ANTES de gerar um modelo .docx
// do portal do cliente. Substitui o antigo TemplateDataConfirmationModal no
// fluxo de cliente.
//
// Fluxo:
//   1. open=true  → probe (qa-fill-template-cliente probe:true)
//   2. ok=true    → gera direto, devolve blob via onGenerated
//   3. faltando   → renderiza 1 pergunta por tela com "Salvar e continuar"
//   4. revisão    → cliente confirma → tenta gerar
//   5. 422 no gerar → recarrega o wizard com os campos restantes
//   6. unknown_placeholders → tela de "modelo precisa revisão da equipe"
//
// Persistência:
//   - source=cliente  → qa-cliente-atualizar-cadastro
//   - source=processo → qa-processo-template-data-salvar
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Headphones,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PlaceholderDef,
  TEMPLATE_PLACEHOLDERS,
} from "@/lib/quero-armas/templatePlaceholders";
import {
  FIELDS_NEEDING_SUPPORT,
  FillTemplateError,
  WizardStep,
  buildWizardSteps,
  generateTemplateBlob,
  isValueValid,
  loadIaSuggestions,
  maskValue,
  probeTemplate,
  saveWizardAnswer,
} from "@/lib/quero-armas/documentOnboardingEngine";
import { loadPlaceholderOverrides } from "@/lib/quero-armas/templatePlaceholderOverrides";

const MARROM = "#7A1F2B";

interface Props {
  open: boolean;
  onClose: () => void;
  processoId: string | null;
  clienteId: number | null;
  templateKey: string | null;
  documentoNome?: string | null;
  /** Callback quando o documento foi gerado com sucesso (blob pronto). */
  onGenerated: (blob: Blob, filename: string) => void;
  /** Callback opcional após salvar qualquer campo (para recarregar dashboard). */
  onUpdated?: () => void;
}

type Fase =
  | "probe"
  | "step"
  | "review"
  | "gerando"
  | "sucesso"
  | "unknown_template"
  | "needs_support"
  | "erro";

export default function DocumentDataOnboardingWizard({
  open,
  onClose,
  processoId,
  clienteId,
  templateKey,
  documentoNome,
  onGenerated,
  onUpdated,
}: Props) {
  const [fase, setFase] = useState<Fase>("probe");
  const [erro, setErro] = useState<string | null>(null);
  const [unknownTokens, setUnknownTokens] = useState<string[]>([]);
  const [steps, setSteps] = useState<WizardStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [stepValue, setStepValue] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [valoresFinal, setValoresFinal] = useState<Record<string, { def: PlaceholderDef; value: string; origem: "cadastro" | "processo" | "ia" | "agora" }>>({});
  const [unsupportedField, setUnsupportedField] = useState<PlaceholderDef | null>(null);
  const carregouRef = useRef(false);

  // -------------------------------------------------------------------------
  // Carga inicial: probe + sugestões + dados atuais
  // -------------------------------------------------------------------------
  const carregar = useCallback(async () => {
    if (!processoId || !templateKey || !clienteId) return;
    setFase("probe");
    setErro(null);
    setUnknownTokens([]);
    try {
      const [probe, ia, clienteRow, processoRow, overrides] = await Promise.all([
        probeTemplate({ templateKey, processoId }),
        loadIaSuggestions(processoId),
        supabase.from("qa_clientes").select("*").eq("id", clienteId).maybeSingle(),
        supabase
          .from("qa_processos")
          .select("respostas_questionario_json")
          .eq("id", processoId)
          .maybeSingle(),
        loadPlaceholderOverrides(),
      ]);

      const cliente = (clienteRow.data ?? null) as Record<string, any> | null;
      const respostas = (processoRow.data as any)?.respostas_questionario_json;
      const templateData =
        respostas && typeof respostas === "object" && !Array.isArray(respostas)
          ? (respostas.template_data ?? null)
          : null;

      // Unknown placeholders: bloqueia, time tem que revisar template.
      if (probe.unknown_placeholders.length > 0 && probe.missing_placeholders.length === 0) {
        setUnknownTokens(probe.unknown_placeholders);
        setFase("unknown_template");
        return;
      }

      if (probe.ok) {
        // Pronto para gerar.
        setFase("gerando");
        await gerarAgora(); // usa onGenerated → fecha
        return;
      }

      // Monta passos.
      const nextSteps = buildWizardSteps({
        missing: probe.missing_placeholders,
        cliente,
        templateData,
        iaSuggestions: ia,
        overrides,
      });

      // Se algum step depende de suporte (cpf/email/nome) → tela específica.
      const blocker = nextSteps.find((s) => FIELDS_NEEDING_SUPPORT.has(s.def.key));
      if (blocker) {
        setUnsupportedField(blocker.def);
        setFase("needs_support");
        return;
      }

      // Pré-popula valoresFinal com o que já temos no banco.
      const initial: typeof valoresFinal = {};
      for (const s of nextSteps) {
        if (s.initialValue) {
          initial[s.def.key] = {
            def: s.def,
            value: s.initialValue,
            origem: s.def.source === "cliente" ? "cadastro" : "processo",
          };
        }
      }
      setValoresFinal(initial);
      setSteps(nextSteps);
      // Resume: primeiro step com initialValue vazio.
      const resumeIdx = nextSteps.findIndex((s) => !s.initialValue);
      const idx = resumeIdx >= 0 ? resumeIdx : 0;
      setStepIdx(idx);
      const cur = nextSteps[idx];
      setStepValue(cur?.initialValue || cur?.iaSuggestion || "");
      setUnknownTokens(probe.unknown_placeholders);
      setFase(nextSteps.length === 0 ? "review" : "step");
    } catch (e: any) {
      setErro(e?.message || "Não conseguimos consultar este modelo agora.");
      setFase("erro");
    }
  }, [processoId, templateKey, clienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) {
      carregouRef.current = false;
      return;
    }
    if (carregouRef.current) return;
    carregouRef.current = true;
    void carregar();
  }, [open, carregar]);

  // -------------------------------------------------------------------------
  // Geração final
  // -------------------------------------------------------------------------
  const gerarAgora = useCallback(async () => {
    if (!processoId || !templateKey) return;
    setFase("gerando");
    setErro(null);
    try {
      const blob = await generateTemplateBlob({ processoId, templateKey });
      const baseNome = (documentoNome || templateKey).toString().replace(/\s+/g, "_").slice(0, 80);
      const filename = `${baseNome || "documento"}.docx`;
      onGenerated(blob, filename);
      setFase("sucesso");
    } catch (e) {
      const err = e as FillTemplateError;
      if (err?.status === 422 && Array.isArray(err.missing_placeholders) && err.missing_placeholders.length > 0) {
        // Re-abre wizard com o que faltou (refaz o ciclo).
        toast.message("Ainda precisamos completar alguns dados.");
        carregouRef.current = false;
        void carregar();
        return;
      }
      if (err?.status === 422 && Array.isArray(err.unknown_placeholders) && err.unknown_placeholders.length > 0) {
        setUnknownTokens(err.unknown_placeholders);
        setFase("unknown_template");
        return;
      }
      setErro((e as Error)?.message || "Erro ao gerar documento.");
      setFase("erro");
    }
  }, [processoId, templateKey, documentoNome, onGenerated, carregar]);

  // -------------------------------------------------------------------------
  // Avançar passo (salva no backend)
  // -------------------------------------------------------------------------
  const currentStep = steps[stepIdx] || null;

  const handleContinuar = useCallback(async () => {
    if (!currentStep || !processoId) return;
    const v = stepValue.trim();
    if (!isValueValid(v, currentStep.def)) {
      toast.error("Confira o formato deste campo.");
      return;
    }
    setSalvando(true);
    try {
      await saveWizardAnswer({ processoId, def: currentStep.def, value: v });
      toast.success("Salvo ✓");
      onUpdated?.();
      // Atualiza valoresFinal
      const origem: "cadastro" | "processo" | "ia" | "agora" = v === currentStep.iaSuggestion
        ? "ia"
        : "agora";
      setValoresFinal((prev) => ({
        ...prev,
        [currentStep.def.key]: { def: currentStep.def, value: v, origem },
      }));

      const next = stepIdx + 1;
      if (next >= steps.length) {
        setFase("review");
      } else {
        setStepIdx(next);
        const ns = steps[next];
        setStepValue(ns?.initialValue || ns?.iaSuggestion || "");
      }
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar agora.");
    } finally {
      setSalvando(false);
    }
  }, [currentStep, stepValue, stepIdx, steps, processoId, onUpdated]);

  const handleVoltar = useCallback(() => {
    if (stepIdx === 0) return;
    const prev = stepIdx - 1;
    setStepIdx(prev);
    const ps = steps[prev];
    const known = valoresFinal[ps.def.key]?.value;
    setStepValue(known || ps?.initialValue || ps?.iaSuggestion || "");
  }, [stepIdx, steps, valoresFinal]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const total = steps.length;
  const pct = total === 0 ? 100 : Math.round(((stepIdx + (fase === "review" ? 1 : 0)) / Math.max(total, 1)) * 100);

  const reset = () => {
    carregouRef.current = false;
    setFase("probe");
    setSteps([]);
    setStepIdx(0);
    setStepValue("");
    setValoresFinal({});
    setUnknownTokens([]);
    setUnsupportedField(null);
    setErro(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // -------------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={(n) => !n && handleClose()}>
      <DialogContent
        className="qa-scope w-[calc(100vw-1rem)] max-w-lg rounded-[24px] border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl max-h-[94dvh] overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden"
      >
        {/* Cabeçalho */}
        <div className="shrink-0 border-b border-slate-200 px-5 py-4" style={{ background: "linear-gradient(180deg,#FBF3F4,#ffffff)" }}>
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ background: MARROM }}
            >
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.3} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Assistente de cadastro documental
              </div>
              <h2 className="text-[17px] font-extrabold leading-tight text-slate-900">
                Vamos completar seus dados para gerar este documento
              </h2>
              {documentoNome && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Documento: <span className="font-semibold text-slate-700">{documentoNome}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Barra de progresso */}
          {(fase === "step" || fase === "review") && total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Passo {Math.min(stepIdx + 1, total)} de {total}</span>
                <span>{pct}%</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: MARROM }} />
              </div>
            </div>
          )}
        </div>

        {/* Corpo */}
        <div className="min-h-[260px] flex-1 overflow-y-auto px-5 py-5">
          {fase === "probe" && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Verificando o que falta para gerar...</p>
            </div>
          )}

          {fase === "gerando" && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <p className="text-sm text-slate-700 font-semibold">Gerando seu documento...</p>
              <p className="text-xs text-slate-500">Pode levar alguns segundos.</p>
            </div>
          )}

          {fase === "sucesso" && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Documento gerado</h3>
              <p className="text-sm text-slate-500">Confira o arquivo baixado.</p>
              <button
                onClick={handleClose}
                className="mt-2 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white"
                style={{ background: MARROM }}
              >
                Concluir
              </button>
            </div>
          )}

          {fase === "step" && currentStep && (
            <StepView
              step={currentStep}
              value={stepValue}
              salvando={salvando}
              onChange={(v) => setStepValue(maskValue(v, currentStep.def.input))}
            />
          )}

          {fase === "review" && (
            <ReviewView valores={valoresFinal} />
          )}

          {fase === "unknown_template" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <strong className="font-bold uppercase tracking-wide">Modelo precisa de revisão da equipe.</strong>
                  <p className="mt-1">
                    Este modelo possui marcadores que ainda não foram mapeados pelo sistema.
                    Avisamos a Equipe Quero Armas — não há nada para você fazer agora.
                  </p>
                  {unknownTokens.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {unknownTokens.map((t) => (
                        <span key={t} className="rounded-md border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] font-mono text-amber-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Entendi
              </button>
            </div>
          )}

          {fase === "needs_support" && unsupportedField && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] text-amber-900">
                <Headphones className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <strong className="font-bold uppercase tracking-wide">
                    Precisamos da equipe para atualizar “{unsupportedField.label}”.
                  </strong>
                  <p className="mt-1">
                    Por segurança, este campo só pode ser corrigido pela Equipe Quero Armas. Fale com a gente
                    no chat para liberar a geração deste documento.
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Entendi
              </button>
            </div>
          )}

          {fase === "erro" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-[12px] text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <strong className="font-bold uppercase tracking-wide">Algo deu errado.</strong>
                  <p className="mt-1">{erro || "Tente novamente em alguns instantes."}</p>
                </div>
              </div>
              <button
                onClick={() => { carregouRef.current = false; void carregar(); }}
                className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white"
                style={{ background: MARROM }}
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>

        {/* Rodapé */}
        {(fase === "step" || fase === "review") && (
          <div className="shrink-0 border-t border-slate-200 bg-slate-50/60 px-5 py-3">
            <p className="mb-2 text-center text-[10px] uppercase tracking-wider text-slate-400">
              Salvamos automaticamente ao continuar
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              {fase === "step" ? (
                <>
                  <button
                    type="button"
                    onClick={handleVoltar}
                    disabled={salvando || stepIdx === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleContinuar}
                    disabled={salvando || !isValueValid(stepValue, currentStep!.def)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold text-white shadow-sm disabled:opacity-50"
                    style={{ background: MARROM }}
                  >
                    {salvando ? (<><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>) : (
                      <>{stepIdx + 1 >= total ? "Salvar e revisar" : "Salvar e continuar"} <ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (steps.length === 0) return;
                      setFase("step");
                      const last = steps.length - 1;
                      setStepIdx(last);
                      const ls = steps[last];
                      const known = valoresFinal[ls.def.key]?.value;
                      setStepValue(known || ls?.initialValue || ls?.iaSuggestion || "");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <ArrowLeft className="h-4 w-4" /> Ajustar
                  </button>
                  <button
                    type="button"
                    onClick={() => void gerarAgora()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold text-white shadow-sm"
                    style={{ background: MARROM }}
                  >
                    Confirmar e baixar <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// StepView — 1 pergunta por tela
// ---------------------------------------------------------------------------
function StepView({
  step,
  value,
  salvando,
  onChange,
}: {
  step: WizardStep;
  value: string;
  salvando: boolean;
  onChange: (v: string) => void;
}) {
  const { def, iaSuggestion } = step;
  const enunciado = def.question || `Informe ${def.label.toLowerCase()}`;
  const grupo = def.group;
  const mostraIa = iaSuggestion && iaSuggestion.trim() && value !== iaSuggestion;

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{grupo}</div>
      <h3 className="text-base font-extrabold leading-snug text-slate-900">{enunciado}</h3>
      {def.helper && <p className="text-[12px] text-slate-500">{def.helper}</p>}

      {def.input === "estado_civil" || def.input === "uf" || def.input === "select" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(def.options ?? []).map((op) => (
            <button
              key={op.value}
              type="button"
              disabled={salvando}
              onClick={() => onChange(op.value)}
              className={
                "rounded-xl border px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide " +
                (value === op.value
                  ? "border-[#7A1F2B] bg-[#FBF3F4] text-[#7A1F2B]"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300")
              }
            >
              {op.label}
            </button>
          ))}
        </div>
      ) : (
        <input
          type={def.input === "email" ? "email" : "text"}
          inputMode={def.input === "phone" || def.input === "cpf" || def.input === "cnpj" || def.input === "cep" ? "numeric" : undefined}
          autoFocus
          disabled={salvando}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.inputPlaceholder}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] font-semibold uppercase text-slate-900 outline-none focus:border-[#7A1F2B] focus:ring-2 focus:ring-[#FBE2E6]"
        />
      )}

      {mostraIa && (
        <button
          type="button"
          onClick={() => onChange(iaSuggestion)}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Sugerido pela IA: <span className="font-mono uppercase">{iaSuggestion}</span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReviewView — confirmação final
// ---------------------------------------------------------------------------
function ReviewView({
  valores,
}: {
  valores: Record<string, { def: PlaceholderDef; value: string; origem: "cadastro" | "processo" | "ia" | "agora" }>;
}) {
  const lista = TEMPLATE_PLACEHOLDERS.filter((p) => valores[p.key]).map((p) => valores[p.key]);
  return (
    <div className="space-y-3">
      <h3 className="text-base font-extrabold text-slate-900">Confira antes de gerar</h3>
      <p className="text-[12px] text-slate-500">
        Estes dados serão usados para preencher o documento. Você pode ajustar qualquer um antes de confirmar.
      </p>
      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {lista.length === 0 && (
          <div className="px-3 py-4 text-[12px] text-slate-500">
            Não há novos dados — vamos apenas regerar o documento.
          </div>
        )}
        {lista.map((row) => (
          <div key={row.def.key} className="flex items-center justify-between gap-3 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {row.def.label}
            </dt>
            <dd className="flex items-center gap-2 text-right">
              <span className="text-[13px] font-medium text-slate-800">{row.value}</span>
              <OrigemBadge origem={row.origem} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function OrigemBadge({ origem }: { origem: "cadastro" | "processo" | "ia" | "agora" }) {
  const map: Record<typeof origem, { label: string; cls: string }> = {
    cadastro: { label: "Cadastro", cls: "bg-slate-100 text-slate-600" },
    processo: { label: "Processo", cls: "bg-slate-100 text-slate-600" },
    ia: { label: "IA", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
    agora: { label: "Você agora", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  };
  const m = map[origem];
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${m.cls}`}>
      {m.label}
    </span>
  );
}

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw,
  Copy, Download, FolderOpen, FileText, Sparkles,
} from "lucide-react";

/* ── Section detection ── */
const DRAFT_SECTIONS = [
  { key: "enderecamento", label: "Endereçamento", pattern: /^A\s+DOUTA/m },
  { key: "preambulo", label: "Preâmbulo", pattern: /vem,?\s+respeitosamente/i },
  { key: "dos_fatos", label: "I — DOS FATOS", pattern: /I\s*[—–-]\s*DOS\s+FATOS/i },
  { key: "do_direito", label: "II — DO DIREITO", pattern: /II\s*[—–-]\s*DO\s+DIREITO/i },
  { key: "alegacoes", label: "III — ALEGAÇÕES FINAIS", pattern: /III\s*[—–-]\s*ALEGA[ÇC][ÕO]ES\s+FINAIS/i },
  { key: "fechamento", label: "IV — FECHAMENTO", pattern: /IV\s*[—–-]\s*FECHAMENTO/i },
] as const;

type DraftSection = typeof DRAFT_SECTIONS[number]["key"];

const PIPELINE_STEPS = [
  { key: "context", label: "Montando contexto final" },
  { key: "sources", label: "Organizando fundamentos" },
  { key: "writing", label: "Redigindo peça" },
  { key: "reviewing", label: "Revisando coerência" },
  { key: "validating", label: "Validando qualidade" },
  { key: "saving", label: "Salvando caso" },
] as const;

type PipelineStep = typeof PIPELINE_STEPS[number]["key"];

export interface DraftingResult {
  geracao_id?: string;
  minuta_gerada: string;
  fontes_utilizadas?: any[];
  score_confianca?: number;
  quality_issues?: string[];
  circunscricao_utilizada?: any;
  evidence_analysis?: any;
}

interface DraftingViewProps {
  visible: boolean;
  pipelineStep: PipelineStep | "done" | "error";
  streamedText: string;
  isStreaming: boolean;
  error?: string;
  startedAt?: number;
  result?: DraftingResult | null;
  onRetry?: () => void;
  onCopy?: () => void;
  onExportDocx?: () => void;
  onOpenCase?: () => void;
  savedCasoId?: string | null;
}

function ElapsedTimer({ startedAt }: { startedAt?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startedAt]);
  if (!startedAt) return null;
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span className="text-[11px] text-slate-500 tabular-nums font-mono flex items-center gap-1">
      <Clock className="h-3 w-3" />
      {m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`}
    </span>
  );
}

export default function DraftingView({
  visible, pipelineStep, streamedText, isStreaming, error,
  startedAt, result, onRetry, onCopy, onExportDocx, onOpenCase, savedCasoId,
}: DraftingViewProps) {
  const textAreaRef = useRef<HTMLDivElement>(null);
  const [stalled, setStalled] = useState(false);
  const lastTextLenRef = useRef(0);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (textAreaRef.current && isStreaming) {
      textAreaRef.current.scrollTop = textAreaRef.current.scrollHeight;
    }
  }, [streamedText, isStreaming]);

  // Stall detection: if text hasn't grown in 30s during streaming
  useEffect(() => {
    if (!isStreaming) { setStalled(false); return; }
    if (streamedText.length !== lastTextLenRef.current) {
      lastTextLenRef.current = streamedText.length;
      setStalled(false);
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(() => setStalled(true), 30000);
    }
    return () => { if (stallTimerRef.current) clearTimeout(stallTimerRef.current); };
  }, [streamedText, isStreaming]);

  // Detect which sections are present in the streamed text
  const detectedSections = useMemo(() => {
    const found: { key: DraftSection; label: string; done: boolean }[] = [];
    for (const sec of DRAFT_SECTIONS) {
      if (sec.pattern.test(streamedText)) {
        found.push({ key: sec.key, label: sec.label, done: true });
      }
    }
    return found;
  }, [streamedText]);

  // Current writing section — the last detected section
  const currentWritingSection = detectedSections.length > 0
    ? detectedSections[detectedSections.length - 1].label
    : streamedText.length > 0 ? "Endereçamento" : null;

  // Pipeline progress
  const pipelineIdx = PIPELINE_STEPS.findIndex(s => s.key === pipelineStep);
  const pipelinePercent = pipelineStep === "done" ? 100
    : pipelineStep === "error" ? 0
    : pipelineIdx >= 0 ? Math.round(((pipelineIdx + 0.5) / PIPELINE_STEPS.length) * 100) : 0;

  // Section progress (0-6)
  const sectionPercent = Math.round((detectedSections.length / DRAFT_SECTIONS.length) * 100);

  // Overall progress blends pipeline + section
  const overallPercent = pipelineStep === "done" ? 100
    : pipelineStep === "error" ? 0
    : pipelineStep === "writing" ? Math.round(20 + (sectionPercent * 0.6))
    : pipelinePercent;

  const isDone = pipelineStep === "done";
  const isError = pipelineStep === "error";

  if (!visible) return null;

  return (
    <div className="bg-[#0a0a14] border border-[#1a1a2e] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-[#0c0c18] border-b border-[#1a1a2e] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {isDone ? (
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          ) : isError ? (
            <XCircle className="h-4 w-4 text-red-400" />
          ) : (
            <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
          )}
          <span className="text-sm font-medium text-slate-300">
            {isDone ? "Minuta concluída" : isError ? "Erro na geração" : "Redigindo minuta..."}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ElapsedTimer startedAt={startedAt} />
          {isDone && (
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={onCopy}
                className="h-7 text-[10px] bg-[#0c0c16] border-[#1a1a2e] text-slate-400">
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
              <Button variant="outline" size="sm" onClick={onExportDocx}
                className="h-7 text-[10px] bg-[#0c0c16] border-[#1a1a2e] text-slate-400">
                <Download className="h-3 w-3 mr-1" /> DOCX
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-1">
        <Progress value={overallPercent} className="h-1.5" />
      </div>

      {/* Pipeline + Section steps */}
      <div className="px-4 py-2 flex gap-6">
        {/* Pipeline steps */}
        <div className="space-y-0.5 flex-1">
          <span className="text-[9px] text-slate-600 uppercase tracking-[0.15em]">Etapas</span>
          {PIPELINE_STEPS.map((step, idx) => {
            const isActive = step.key === pipelineStep;
            const stepDone = pipelineIdx > idx || isDone;
            return (
              <div key={step.key} className={`flex items-center gap-1.5 text-[11px] py-0.5 ${
                isActive ? "text-cyan-300" : stepDone ? "text-emerald-400/60" : "text-slate-700"
              }`}>
                {stepDone && !isActive ? (
                  <CheckCircle className="h-3 w-3 shrink-0" />
                ) : isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-slate-800 shrink-0" />
                )}
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* Section detection — only when writing */}
        {(pipelineStep === "writing" || isDone) && streamedText.length > 0 && (
          <div className="space-y-0.5 flex-1">
            <span className="text-[9px] text-slate-600 uppercase tracking-[0.15em]">Seções da peça</span>
            {DRAFT_SECTIONS.map((sec) => {
              const found = detectedSections.some(d => d.key === sec.key);
              const isCurrent = currentWritingSection === sec.label && isStreaming;
              return (
                <div key={sec.key} className={`flex items-center gap-1.5 text-[11px] py-0.5 ${
                  isCurrent ? "text-cyan-300" : found ? "text-emerald-400/60" : "text-slate-700"
                }`}>
                  {found && !isCurrent ? (
                    <CheckCircle className="h-3 w-3 shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-slate-800 shrink-0" />
                  )}
                  <span>{sec.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Writing indicator */}
      {isStreaming && currentWritingSection && (
        <div className="px-4 pb-2">
          <div className="text-[11px] text-cyan-400/70 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Redigindo: {currentWritingSection}
          </div>
        </div>
      )}

      {/* Stall warning */}
      {stalled && isStreaming && (
        <div className="mx-4 mb-2 bg-amber-500/5 border border-amber-500/10 rounded p-2 text-[11px] text-amber-400 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>A geração parece mais lenta que o normal. Aguardando resposta da IA...</span>
        </div>
      )}

      {/* Text area — the draft being written */}
      {streamedText.length > 0 && (
        <div className="px-4 pb-3">
          <div
            ref={textAreaRef}
            className="bg-[#08080f] border border-[#1a1a2e] rounded-lg p-4 max-h-[60vh] overflow-y-auto scroll-smooth"
          >
            <div className="text-[12px] text-slate-300 whitespace-pre-wrap leading-relaxed font-serif">
              {streamedText}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-cyan-400 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state while waiting to start writing */}
      {streamedText.length === 0 && !isError && (
        <div className="px-4 pb-4">
          <div className="bg-[#08080f] border border-[#1a1a2e] rounded-lg p-8 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 text-cyan-400/40 animate-spin" />
            <span className="text-[11px] text-slate-600">Preparando geração...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && error && (
        <div className="px-4 pb-4">
          <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-red-400 text-[12px] font-medium">
              <AlertTriangle className="h-4 w-4" /> Erro na geração
            </div>
            <p className="text-[11px] text-red-400/80">{error}</p>
            {streamedText.length > 0 && (
              <p className="text-[10px] text-slate-500">
                O rascunho parcial acima foi preservado. Você pode copiá-lo ou tentar novamente.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onRetry}
                className="h-7 text-[10px] border-red-500/20 text-red-400">
                <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
              </Button>
              {streamedText.length > 0 && (
                <Button variant="outline" size="sm" onClick={onCopy}
                  className="h-7 text-[10px] border-[#1a1a2e] text-slate-400">
                  <Copy className="h-3 w-3 mr-1" /> Copiar rascunho parcial
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Done — case saved */}
      {isDone && savedCasoId && (
        <div className="px-4 pb-3">
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <div>
                <div className="text-[12px] text-emerald-400 font-medium">Caso salvo com sucesso</div>
                <div className="text-[9px] text-slate-600 font-mono">ID: {savedCasoId.slice(0, 8)}...</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenCase}
              className="h-7 text-[10px] border-emerald-500/20 text-emerald-400">
              <FolderOpen className="h-3 w-3 mr-1" /> Abrir Caso
            </Button>
          </div>
        </div>
      )}

      {/* Done — score + sources */}
      {isDone && result && (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex items-center gap-3 bg-[#0c0c16] border border-[#1a1a2e] rounded p-3">
            <div className="text-center">
              <div className={`text-lg font-semibold font-mono ${
                (result.score_confianca || 0) >= 0.7 ? "text-emerald-400" :
                (result.score_confianca || 0) >= 0.4 ? "text-amber-400" : "text-red-400"
              }`}>
                {((result.score_confianca || 0) * 100).toFixed(0)}%
              </div>
              <div className="text-[9px] text-slate-600 uppercase tracking-wider">Confiança</div>
            </div>
            <div className="flex-1 text-[11px] text-slate-500">
              {result.fontes_utilizadas?.length || 0} fontes • {result.fontes_utilizadas?.filter((f: any) => f.validada).length || 0} validadas
              {result.circunscricao_utilizada && (
                <div className="text-emerald-400/60 mt-0.5 text-[10px]">✓ {result.circunscricao_utilizada.unidade_pf}</div>
              )}
            </div>
          </div>
          {(result.quality_issues?.length || 0) > 0 && (
            <div className="text-[10px] text-amber-400/70 bg-amber-500/5 border border-amber-500/10 rounded p-2">
              <span className="font-medium">Avisos de qualidade:</span> {result.quality_issues?.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

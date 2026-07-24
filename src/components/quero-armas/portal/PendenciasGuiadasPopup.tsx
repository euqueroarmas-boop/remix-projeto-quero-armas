// ============================================================================
// PendenciasGuiadasPopup — Fase 1 da unificação
// ----------------------------------------------------------------------------
// Reaproveita o layout "janela macOS" do antigo popup de assinaturas pendentes
// e passa a apresentar TAMBÉM as exigências documentais do checklist como
// passos sequenciais, cada um com uma explicação curta e um botão de entrega.
//
// Escopo Fase 1: apresentação. As ações (assinar, abrir Hub Documental) são
// callbacks do portal — o wizard antigo (ChecklistGuiadoModal) segue disponível
// como fallback e continua acessível pelo Speed Dial / bus.
// ============================================================================

import { Download, ExternalLink, FileText, Upload } from "lucide-react";
import { getExplicacaoPendencia } from "@/lib/quero-armas/pendenciasExplicacoes";

export type PendenciaKind = "signature" | "documento";

export interface PendenciaItem {
  id: string;
  kind: PendenciaKind;
  /** Rótulo curto exibido na lista de próximos passos. */
  label: string;
  /** Tipo canônico (para signature: "contract"|"procuration"; para documento: hub_tipo). */
  tipo: string;
  /** Tipo cru do checklist (`tipo_documento`) — usado para buscar explicação específica antes do fallback pelo hub_tipo. */
  rawTipo?: string | null;
  /** Nome fallback caso o tipo não tenha explicação cadastrada. */
  fallbackNome?: string | null;
  /** Protocolo/contexto exibido no header. */
  contexto?: string | null;
  /** Callback do botão primário (Assinar/Baixar). */
  onPrimary: () => void;
  /** Callback do botão secundário — no caso de signature abre o Hub focado. */
  onEntregar: () => void;
  /** Texto do primário; default "Baixar contrato/procuração" ou "Ver instruções". */
  primaryLabel?: string;
  /** Texto do secundário; default "Enviar assinado" (signature) ou "Entregar" (documento). */
  entregarLabel?: string;
  /** Instruções do admin (qa_servicos_documentos.instrucoes) — exibidas no lugar do texto estático quando preenchidas. */
  instrucoesCatalogo?: string | null;
  /** Link de emissão do admin (qa_servicos_documentos.link_emissao). */
  linkEmissao?: string | null;
  /** Observações do admin (qa_servicos_documentos.observacoes_cliente). */
  observacoesCatalogo?: string | null;
}

interface Props {
  open: boolean;
  pendencias: PendenciaItem[];
  onDismiss: () => void;
}

export default function PendenciasGuiadasPopup({ open, pendencias, onDismiss }: Props) {
  if (!open || pendencias.length === 0) return null;
  const active = pendencias[0];
  const total = pendencias.length;

  const isSignature = active.kind === "signature";
  const explicBase = isSignature
    ? {
        titulo:
          active.tipo === "contract"
            ? "Contrato de adesão aguardando sua assinatura"
            : "Procuração aguardando sua assinatura",
        passos: [
          "Baixe o documento no botão ao lado.",
          "Assine com sua conta GOV.BR ou certificado ICP-Brasil.",
          "Envie o PDF assinado usando o botão \"Enviar assinado\".",
        ],
        observacao: "A IA valida a assinatura antes de destravar as próximas etapas.",
      }
    : getExplicacaoPendencia(active.rawTipo || active.tipo, active.fallbackNome, active.tipo);

  // Se o admin cadastrou instrucoes no catálogo, sobrescreve o texto estático.
  const explic = (!isSignature && active.instrucoesCatalogo)
    ? {
        ...explicBase,
        passos: active.instrucoesCatalogo
          .split(/\n+/)
          .map((l) => l.trim())
          .filter(Boolean),
        observacao: active.observacoesCatalogo || explicBase.observacao,
      }
    : { ...explicBase, observacao: (!isSignature && active.observacoesCatalogo) ? active.observacoesCatalogo : explicBase.observacao };

  const headerContexto =
    active.contexto ||
    (isSignature
      ? active.tipo === "contract"
        ? "Contrato pendente"
        : "Procuração pendente"
      : "Exigência pendente");

  const primaryLabel =
    active.primaryLabel ||
    (isSignature
      ? active.tipo === "contract"
        ? "Baixar contrato"
        : "Baixar procuração"
      : "Ver instruções");

  const entregarLabel =
    active.entregarLabel ||
    (isSignature
      ? active.tipo === "contract"
        ? "Enviar contrato assinado"
        : "Enviar procuração assinada"
      : "Entregar documento");

  const eyebrow = isSignature
    ? active.tipo === "contract"
      ? "Contrato aguardando sua assinatura"
      : "Procuração aguardando sua assinatura"
    : "Documento aguardando envio";

  const passoAtual = 1;
  const passoLabel = `Passo ${passoAtual} de ${total}`;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      data-qa-overlay
      onClick={onDismiss}
      style={{ pointerEvents: "auto" }}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-sm border border-[#E4E4E4] shadow-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: "auto" }}
      >
        {/* Window Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E4E4] bg-[#FAFAFA]">
          <div className="flex gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div className="text-[10px] font-bold text-[#6A6A6A] tracking-[0.1em] uppercase">
            {headerContexto}
          </div>
          <div className="w-8" />
        </div>

        {/* Split Body */}
        <div className="flex flex-col md:flex-row">
          {/* Sidebar */}
          <div className="hidden md:flex w-48 bg-[#FAFAFA] border-r border-[#E4E4E4] p-8 flex-col items-center justify-center text-center shrink-0">
            <div className="text-6xl font-light text-[#0A0A0A] leading-none tracking-tighter">
              {String(passoAtual).padStart(2, "0")}
              <span className="text-2xl text-[#6A6A6A]">/{String(total).padStart(2, "0")}</span>
            </div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-[#6A6A6A] uppercase mt-1 mb-8">
              {total > 1 ? "Passo Atual" : "Pendente"}
            </div>
            <div className="relative flex flex-col items-center">
              <div className="w-px h-10 bg-[#E4E4E4]" />
              <div className="w-9 h-9 rounded-full border border-[#E4E4E4] flex items-center justify-center bg-white my-2">
                <FileText className="h-4 w-4 text-[#0A0A0A]" />
              </div>
              <div className="w-px h-10 bg-[#E4E4E4]" />
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 p-6 md:p-10 flex flex-col justify-center">
            <header className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block text-[10px] font-bold tracking-[0.25em] text-[#6A6A6A] uppercase">
                  {eyebrow}
                </span>
                {total > 1 ? (
                  <span className="inline-flex items-center rounded-sm border border-[#E4E4E4] bg-[#FAFAFA] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
                    {passoLabel}
                  </span>
                ) : null}
              </div>
              <h2 className="text-xl md:text-2xl font-medium text-[#0A0A0A] leading-tight tracking-tight">
                {explic.titulo}
              </h2>
              <p className="mt-2 text-xs text-[#6A6A6A] leading-relaxed">
                {active.label}
              </p>
            </header>

            <div className="space-y-5">
              <ol className="space-y-2 text-sm text-[#3A3A3A] leading-relaxed">
                {explic.passos.map((p, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#E4E4E4] bg-white text-[10px] font-bold text-[#0A0A0A]">
                      {i + 1}
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ol>

              {explic.observacao ? (
                <p className="text-xs text-[#6A6A6A] leading-relaxed border-l-2 border-[#E4E4E4] pl-3">
                  {explic.observacao}
                </p>
              ) : null}

              {!isSignature && active.linkEmissao ? (
                <a
                  href={active.linkEmissao}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#8A1224] underline"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  Acessar site de emissão
                </a>
              ) : null}

              {total > 1 ? (
                <div className="flex items-center justify-between rounded-sm border border-[#E4E4E4] bg-[#FAFAFA] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
                  <span>Resolva um por vez</span>
                  <span>Faltam {total - 1} após esta</span>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-2 pt-1">
                {isSignature ? (
                  <button
                    type="button"
                    onClick={active.onPrimary}
                    className="inline-flex h-14 w-full min-w-0 items-center justify-center gap-2 rounded-sm bg-[#0A0A0A] px-4 text-center text-[11px] font-bold uppercase leading-[1.2] tracking-[0.14em] text-white transition-colors hover:bg-[#1a1a1a]"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    {primaryLabel}
                  </button>
                ) : (
                  <div className="hidden md:block" />
                )}
                <button
                  type="button"
                  onClick={active.onEntregar}
                  className={`inline-flex h-14 w-full min-w-0 items-center justify-center gap-2 rounded-sm px-4 text-center text-[11px] font-bold uppercase leading-[1.2] tracking-[0.14em] transition-colors ${
                    isSignature
                      ? "border border-[#8A1224] bg-white text-[#8A1224] hover:bg-[#FFF7F8]"
                      : "bg-[#8A1224] text-white hover:bg-[#6f0f1e] md:col-span-2"
                  }`}
                >
                  <Upload className="h-3.5 w-3.5 shrink-0" />
                  {entregarLabel}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 md:px-10 py-3 bg-white border-t border-[#FAFAFA] flex justify-end items-center">
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#28C840]" />
            <span className="text-[10px] font-medium text-[#6A6A6A] uppercase tracking-wider">
              Ambiente seguro
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
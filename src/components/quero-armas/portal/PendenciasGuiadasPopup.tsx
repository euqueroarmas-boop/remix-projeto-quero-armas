// ============================================================================
// PendenciasGuiadasPopup — Fase 2 da unificação (refino visual v1)
// ----------------------------------------------------------------------------
// Fila multi-passo real: as pendências (assinaturas + exigências documentais)
// viram uma sequência navegável (Anterior / Próximo) dentro da mesma janela.
// Versão visual mobile-first inspirada no "Refinamento institucional":
// header limpo, lista de passos com linha vertical, callout em destaque,
// link de emissão em botão bordô e ações fixadas no rodapé.
// ============================================================================

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, ExternalLink, Upload, X } from "lucide-react";
import { getExplicacaoPendencia } from "@/lib/quero-armas/pendenciasExplicacoes";
import { grupoDaPendencia, type PendenciaGrupoId } from "@/lib/quero-armas/pendenciasGrupos";

export type PendenciaKind = "signature" | "documento" | "pergunta";

export interface PendenciaItem {
  id: string;
  kind: PendenciaKind;
  /** Serviço/processo que originou esta pendência (para segmentar a fila
   *  por serviço contratado: Autorização, Posse, CRAF+GT, etc.). */
  servicoId?: string | number | null;
  servicoLabel?: string | null;
  /** Grupo temático (antecedentes, endereço, ocupação, etc.). Calculado no
   *  portal quando o item é montado; usado para (1) ordenar a fila e
   *  (2) exibir o chip de grupo no header do popup. */
  grupoId?: PendenciaGrupoId;
  grupoLabel?: string;
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
  // ─── Campos exclusivos de `kind: "pergunta"` ───
  /** Chave da pergunta (ex.: "ainda_reside_imovel"). */
  perguntaChave?: string;
  /** Opções de resposta (ex.: [{valor:"sim",label:"Sim"},{valor:"nao",label:"Não"}]). */
  perguntaOpcoes?: { valor: string; label?: string }[];
  /** Resposta já registrada (readonly — apenas exibida). */
  respostaAtual?: string | null;
  /** Callback do handler de resposta (chama edge function + refresh). */
  onResponder?: (valor: string) => Promise<void> | void;
  /** Frase que reforça o que acontece após responder (contexto pedagógico). */
  perguntaAjudaPos?: string | null;
}

interface Props {
  open: boolean;
  pendencias: PendenciaItem[];
  onDismiss: () => void;
  /** Id da pendência que deve aparecer primeiro (ex.: doc clicado pelo cliente). */
  pinnedId?: string | null;
}

export default function PendenciasGuiadasPopup({ open, pendencias, onDismiss, pinnedId }: Props) {
  if (!open || pendencias.length === 0) return null;
  const total = pendencias.length;

  // Contagem por grupo para o header (ex.: "Antecedentes 2 de 5").
  const gruposOrdenados: { id: PendenciaGrupoId; label: string; ids: string[] }[] = (() => {
    const map = new Map<PendenciaGrupoId, { label: string; ids: string[] }>();
    for (const p of pendencias) {
      const g = p.grupoId || grupoDaPendencia(p.rawTipo, p.tipo).id;
      const label = p.grupoLabel || grupoDaPendencia(p.rawTipo, p.tipo).label;
      const cur = map.get(g) || { label, ids: [] };
      cur.ids.push(p.id);
      map.set(g, cur);
    }
    return [...map.entries()].map(([id, v]) => ({ id, label: v.label, ids: v.ids }));
  })();

  // Índice controlado internamente para permitir navegação Anterior/Próximo.
  // Sincroniza com `pinnedId` sempre que o portal pede foco em uma pendência
  // específica (ex.: clique em card do kanban / botão "Enviar X").
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (pinnedId) {
      const i = pendencias.findIndex((p) => p.id === pinnedId);
      if (i >= 0) {
        setIndice(i);
        return;
      }
    }
    setIndice((cur) => Math.min(cur, Math.max(0, pendencias.length - 1)));
    // Reagimos a mudanças de foco/lista; abrir/fechar reseta pelo `open` guard.
  }, [open, pinnedId, pendencias]);

  const atual = Math.min(indice, total - 1);
  const active = pendencias[atual];
  const activeGrupo = active.grupoLabel || grupoDaPendencia(active.rawTipo, active.tipo).label;
  const activeGrupoId = active.grupoId || grupoDaPendencia(active.rawTipo, active.tipo).id;
  const grupoInfo = gruposOrdenados.find((g) => g.id === activeGrupoId);
  const posicaoNoGrupo = grupoInfo ? grupoInfo.ids.indexOf(active.id) + 1 : 0;
  const totalNoGrupo = grupoInfo?.ids.length ?? 0;
  const podeVoltar = atual > 0;
  const podeAvancar = atual < total - 1;

  const isSignature = active.kind === "signature";
  const isPergunta = active.kind === "pergunta";
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

  // Regra: os passos ricos (código) SEMPRE têm precedência sobre `instrucoes`
  // curtas do catálogo, para garantir explicação passo-a-passo para leigos.
  // Só usamos o texto do admin quando o REGISTRO estático não tem passos
  // detalhados (menos de 2 passos).
  const passosCatalogo = active.instrucoesCatalogo
    ? active.instrucoesCatalogo.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    : [];
  const estaticoRico = !isSignature && explicBase.passos.length >= 2;
  const usarCatalogo = !isSignature && !estaticoRico && passosCatalogo.length > 0;
  const explic = usarCatalogo
    ? {
        ...explicBase,
        passos: passosCatalogo,
        observacao: active.observacoesCatalogo || explicBase.observacao,
      }
    : {
        ...explicBase,
        observacao: (!isSignature && active.observacoesCatalogo) ? active.observacoesCatalogo : explicBase.observacao,
      };

  const headerContexto =
    active.contexto ||
    (isSignature
      ? active.tipo === "contract"
        ? "Contrato pendente"
        : "Procuração pendente"
      : isPergunta
        ? "Pergunta rápida"
        : "Exigência pendente");

  const [respondendo, setRespondendo] = useState<string | null>(null);
  useEffect(() => {
    setRespondendo(null);
  }, [active.id]);
  const handleResponder = async (valor: string) => {
    if (!active.onResponder) return;
    setRespondendo(valor);
    try {
      await active.onResponder(valor);
    } finally {
      setRespondendo(null);
    }
  };

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

  const passoAtual = atual + 1;
  const passoLabel = `Passo ${passoAtual} de ${total}`;
  const faltam = total - passoAtual;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      data-qa-overlay
      onClick={onDismiss}
    >
      <div
        className="relative w-full sm:max-w-2xl bg-white sm:rounded-2xl sm:shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 z-20 p-2 rounded-full text-[#6A6A6A] hover:bg-black/5 transition-colors"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="px-6 pt-8 pb-4 shrink-0">
          {active.servicoLabel ? (
            <div className="mb-2">
              <span className="inline-flex items-center rounded-md bg-[#0A0A0A] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white">
                Serviço: {active.servicoLabel}
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] font-bold tracking-[0.25em] text-[#8A1224] uppercase">
              {activeGrupo}
            </span>
            {totalNoGrupo > 1 ? (
              <span className="inline-flex items-center rounded-full border border-[#8A1224]/20 bg-[#FFF7F8] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8A1224]">
                {posicaoNoGrupo} de {totalNoGrupo} no grupo
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full border border-[#E4E4E4] bg-white px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
              {headerContexto}
            </span>
            {total > 1 ? (
              <span className="inline-flex items-center rounded-full border border-[#E4E4E4] bg-[#FAFAFA] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
                {passoLabel}
              </span>
            ) : null}
          </div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] leading-tight tracking-tight">
            {explic.titulo}
          </h2>
          <p className="mt-1.5 text-sm text-[#6A6A6A] leading-relaxed">
            {active.label}
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {/* Step list with vertical timeline */}
          <div className="relative">
            <div className="absolute left-[15px] top-3 bottom-3 w-px bg-[#E4E4E4]" />
            <ul className="space-y-5 relative">
              {explic.passos.map((p, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FFF7F8] text-[#8A1224] border border-[#8A1224]/10 flex items-center justify-center text-xs font-bold z-10">
                    {i + 1}
                  </span>
                  <p className="text-[14px] leading-relaxed text-[#3A3A3A] pt-1">
                    {p}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Observation */}
          {explic.observacao ? (
            <div className="mt-6 p-4 bg-[#FFF7F8] rounded-xl border border-[#8A1224]/10">
              <p className="text-xs leading-relaxed text-[#8A1224]">
                {explic.observacao}
              </p>
            </div>
          ) : null}

          {/* Botões de resposta inline — perguntas pivot */}
          {isPergunta && Array.isArray(active.perguntaOpcoes) && active.perguntaOpcoes.length > 0 ? (
            <div className="mt-6 rounded-xl border border-[#8A1224]/20 bg-white p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A1224] mb-3">
                {active.respostaAtual
                  ? `Resposta registrada: ${String(active.respostaAtual).toUpperCase()}`
                  : "Responda para liberar o próximo passo"}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {active.perguntaOpcoes.map((op) => {
                  const ativo = active.respostaAtual === op.valor;
                  const loading = respondendo === op.valor;
                  return (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => handleResponder(op.valor)}
                      disabled={!!respondendo || !!active.respostaAtual}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold uppercase tracking-wider transition-colors border-2 ${
                        ativo
                          ? "bg-[#8A1224] border-[#8A1224] text-white"
                          : "bg-white border-[#8A1224] text-[#8A1224] hover:bg-[#FFF7F8]"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {ativo ? <Check className="h-4 w-4" /> : null}
                      {loading ? "..." : String(op.label || op.valor).toUpperCase()}
                    </button>
                  );
                })}
              </div>
              {active.perguntaAjudaPos ? (
                <p className="mt-3 text-[11px] leading-relaxed text-[#6A6A6A]">
                  {active.perguntaAjudaPos}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Emission site link */}
          {!isSignature && !isPergunta && active.linkEmissao ? (
            <a
              href={active.linkEmissao}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 mb-2 w-full py-4 border-2 border-[#3A3A3A] bg-[#3A3A3A] text-white rounded-xl font-bold text-xs tracking-wider flex items-center justify-center gap-2 hover:bg-[#2A2A2A] hover:border-[#2A2A2A] transition-colors uppercase"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              Acessar site de emissão
            </a>
          ) : null}
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-[#E4E4E4] bg-white shrink-0">
          {total > 1 ? (
            <div className="px-6 py-3 flex justify-between items-center">
              <span className="text-[10px] font-bold text-[#6A6A6A] tracking-widest uppercase">
                Resolva um por vez
              </span>
              <span className="text-[10px] font-bold text-[#6A6A6A] tracking-widest uppercase">
                Faltam {faltam} após esta
              </span>
            </div>
          ) : null}

          <div className="px-6 py-4 flex flex-col gap-3">
            {total > 1 ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIndice((i) => Math.max(0, i - 1))}
                  disabled={!podeVoltar}
                  className="flex-1 py-3 px-4 rounded-lg border border-[#E4E4E4] text-[#0A0A0A] font-bold text-[11px] uppercase tracking-widest bg-white hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setIndice((i) => Math.min(total - 1, i + 1))}
                  disabled={!podeAvancar}
                  className="flex-1 py-3 px-4 rounded-lg border border-[#E4E4E4] text-[#0A0A0A] font-bold text-[11px] uppercase tracking-widest bg-white hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                  Próximo <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-2">
              {isPergunta ? null : isSignature ? (
                <button
                  type="button"
                  onClick={active.onPrimary}
                  className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-4 text-center text-[11px] font-bold uppercase leading-[1.2] tracking-[0.14em] text-white transition-colors hover:bg-[#1a1a1a]"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  {primaryLabel}
                </button>
              ) : (
                <div className="hidden md:block" />
              )}
              {isPergunta ? null : (
                <button
                  type="button"
                  onClick={active.onEntregar}
                  className={`inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl px-4 text-center text-[11px] font-bold uppercase leading-[1.2] tracking-[0.14em] transition-colors ${
                    isSignature
                      ? "border border-[#8A1224] bg-white text-[#8A1224] hover:bg-[#FFF7F8]"
                      : "bg-[#8A1224] text-white hover:bg-[#6f0f1e] md:col-span-2"
                  }`}
                >
                  <Upload className="h-3.5 w-3.5 shrink-0" />
                  {entregarLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

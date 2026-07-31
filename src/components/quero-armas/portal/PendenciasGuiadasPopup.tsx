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
import { Check, ChevronLeft, ChevronRight, Download, Upload, X } from "lucide-react";
import { getExplicacaoPendencia } from "@/lib/quero-armas/pendenciasExplicacoes";
import { grupoDaPendencia, type PendenciaGrupoId } from "@/lib/quero-armas/pendenciasGrupos";
import {
  resolveLinkAntecedentePorUf,
  aplicarUfEmTexto,
} from "@/lib/quero-armas/linksAntecedentesPorUf";

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
  /**
   * UF do cliente (resolvida no portal a partir do cadastro / comprovante
   * de endereço). Quando presente, o popup troca links e textos genéricos
   * (que hoje referenciam TJSP / Polícia Civil de SP) pelos oficiais do
   * estado do cliente. Serve tanto para antecedentes estaduais quanto para
   * o TRF regional correspondente.
   */
  ufCliente?: string | null;
  /**
   * Números REAIS do processo, contados fora daqui.
   *
   * A fila do popup mostra só o que está liberado agora; sem este resumo o
   * cliente lê "5 de 5" e conclui que acabou, quando ainda faltam laudos,
   * requerimento e perguntas. O contador da fila responde "onde estou"; este
   * responde "quanto falta".
   */
  resumoProcesso?: {
    documentosPendentes: number;
    perguntasPendentes: number;
    totalObrigatorios: number;
    concluidos: number;
  } | null;
}

/**
 * Transforma endereços de site em links clicáveis dentro do texto do passo.
 *
 * Os passos são escritos como frases ("Abra o assinador oficial do Gov.br:
 * assinador.iti.br"), e o cliente lia o endereço e tinha que digitar à mão no
 * navegador — no celular, letra por letra. Errar um caractere leva a lugar
 * nenhum, e o cliente conclui que a instrução está errada.
 *
 * Reconhece tanto `https://…` quanto domínio solto (`assinador.iti.br`,
 * `www.tjsp.jus.br/...`). Domínio sem protocolo recebe `https://` ao abrir.
 */
const RE_URL = /((?:https?:\/\/|www\.)[^\s,;)]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+){1,3}\.(?:br|com|org|gov|jus|net)(?:\/[^\s,;)]*)?)/gi;

function TextoComLinks({ texto }: { texto: string }) {
  const partes = String(texto ?? "").split(RE_URL);
  return (
    <>
      {partes.map((parte, i) => {
        // Os índices ímpares são os grupos capturados pelo split — as URLs.
        if (i % 2 === 0) return <span key={i}>{parte}</span>;
        const href = /^https?:\/\//i.test(parte) ? parte : `https://${parte}`;
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#8A1224] underline decoration-[#8A1224]/30 underline-offset-2 hover:decoration-[#8A1224] break-all"
          >
            {parte}
          </a>
        );
      })}
    </>
  );
}

export default function PendenciasGuiadasPopup({ open, pendencias, onDismiss, pinnedId, ufCliente, resumoProcesso }: Props) {
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
  // UMA EXIGÊNCIA POR VEZ (regra do usuário, 31/07/2026).
  //
  // A navegação livre foi REMOVIDA de propósito: o cliente pulava para a
  // quarta pendência, mandava aquele documento, e a primeira ficava
  // esquecida — que foi como o processo do cliente 214 acumulou itens meio
  // resolvidos. Resolvida a atual, ela sai da lista e a seguinte assume.
  //
  // "Anterior" continua disponível quando há pendência pinada (o cliente
  // clicou num card específico): aí ele veio de fora da ordem e precisa
  // conseguir voltar para a fila normal.
  const podeVoltar = atual > 0;
  const podeAvancar = false;

  const isSignature = active.kind === "signature";
  const isPergunta = active.kind === "pergunta";
  const doc = active.tipo === "contract" ? "contrato" : "procuracao";
  const explicBase = isSignature
    ? {
        titulo:
          active.tipo === "contract"
            ? "Contrato de adesão aguardando sua assinatura"
            : "Procuração aguardando sua assinatura",
        // MESMO passo a passo do e-mail (usuário, 31/07/2026). Ele pediu
        // explicitamente que portal e e-mail digam a mesma coisa: o cliente lê
        // um, abre o outro, e qualquer diferença entre os dois vira dúvida.
        //
        // Os itens 4 e 8 são os que faltavam e faziam o cliente travar: sem
        // "Atalhos gov.br" ele não acha a tela de assinatura, e sem o reenvio
        // do código ele desiste quando o SMS não chega.
        passos: [
          doc === "contrato"
            ? "Clique em \"Baixar contrato\" aqui embaixo e salve o arquivo no seu celular ou computador."
            : "Clique em \"Baixar procuração\" aqui embaixo e salve o arquivo no seu celular ou computador.",
          "Faça login com seu CPF e senha gov.br. Se ainda não tem conta, crie em sso.acesso.gov.br",
          "Sua conta gov.br precisa ser nível Prata ou Ouro. Se estiver Bronze, eleve pelo app gov.br (biometria facial via CNH digital ou banco credenciado).",
          "Clique ou toque em \"Atalhos gov.br\" e, na janela que se abrirá, escolha \"Assinar Documentos\". Toque novamente no redirecionamento \"Assinar documentos\" para ser levado ao assinador.iti.br",
          "Clique ou toque em \"+ Escolher arquivo\", navegue até a pasta onde salvou e anexe o documento no assinador.",
          "Apenas toque ou clique no botão azul \"Avançar\".",
          `A assinatura será colada automaticamente na última página d${doc === "contrato" ? "o contrato" : "a procuração"} — mantenha ela onde está. Clique em "Assinar", toque novamente em "Assinar" e autorize com o código enviado por SMS ou pela notificação no app gov.br.`,
          "Se o código não chegar pelo app nem por SMS, abra somente o aplicativo gov.br no celular, volte à tela de autorização e toque em reenviar código — ele chega na hora.",
          "Copie e cole o código no campo de assinatura e clique no botão azul \"Autorizar\".",
          "Clique ou toque em \"Baixar arquivo assinado\" e salve no seu celular ou computador.",
          doc === "contrato"
            ? "Volte aqui e clique em \"Enviar contrato assinado\"."
            : "Volte aqui e clique em \"Enviar procuração assinada\".",
        ],
        observacao: "NÃO imprima, edite, altere nem refaça o arquivo original baixado — nem mesmo reimprimir em PDF. A assinatura perde a validade e o documento não será aceito no Arsenal Inteligente. Envie o arquivo original baixado.",
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

  // ─── State-aware: reescreve links/textos genéricos usando a UF do cliente ───
  // Regra: o cérebro do sistema resolve a UF pelo cadastro/comprovante e
  // troca hardcodes de SP (TJSP, Polícia Civil/SP, TRF3, etc.) pelos
  // equivalentes do estado do cliente. Passa a limpo apenas quando a UF
  // está mapeada em `linksAntecedentesPorUf`.
  // Prioridade: link cadastrado no banco (qa_servicos_documentos.link_emissao)
  // vence qualquer fallback. O resolver por UF só entra quando o admin não
  // cadastrou nada — evita sobrescrever URL específica por link genérico.
  const linkPorUf = !isSignature && !isPergunta
    ? resolveLinkAntecedentePorUf(active.rawTipo || active.tipo, ufCliente)
    : null;
  const linkEmissaoFinal = active.linkEmissao || linkPorUf || null;
  if (!isSignature && !isPergunta && ufCliente) {
    explic.titulo = aplicarUfEmTexto(explic.titulo, ufCliente);
    if (explic.observacao) explic.observacao = aplicarUfEmTexto(explic.observacao, ufCliente);
    explic.passos = explic.passos.map((p) => aplicarUfEmTexto(p, ufCliente));
  }

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
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {/* O badge mostra o GRUPO do processo — Identificação, Antecedentes
                criminais, Ocupação lícita — e não mais a posição dentro dele.
                "1 de 4 no grupo" competia com "Passo 1 de 4" e não dizia ao
                cliente em que parte do processo ele estava. */}
            <span className="inline-flex items-center rounded-full border border-[#8A1224]/20 bg-[#FFF7F8] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8A1224]">
              {activeGrupo}
            </span>
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

          {/* Link fixo para o site oficial — permanece abaixo do título,
              independentemente da rolagem do conteúdo. */}
          {!isSignature && !isPergunta && linkEmissaoFinal ? (
            <p className="mt-3 text-[13px] leading-relaxed text-[#3A3A3A]">
              {(() => {
                const t = explic.titulo || "";
                const i = t.indexOf("—");
                const nome = i >= 0 ? t.slice(i + 1).trim() : activeGrupo;
                return nome
                  ? `Acesse o site oficial da ${nome} para baixar: `
                  : `Acesse o site oficial para baixar: `;
              })()}
              <a
                href={linkEmissaoFinal}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#8A1224] underline underline-offset-2 break-all"
              >
                {linkEmissaoFinal}
              </a>
            </p>
          ) : null}
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
                    <TextoComLinks texto={p} />
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Observation */}
          {explic.observacao && activeGrupoId !== "antecedentes" ? (
            <div className="mt-6 p-4 bg-[#FFF7F8] rounded-xl border border-[#8A1224]/10">
              <p className="text-xs leading-relaxed text-[#8A1224]">
                <TextoComLinks texto={explic.observacao} />
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

        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-[#E4E4E4] bg-white shrink-0">
          {/* Números do PROCESSO, não da fila. A fila mostra o que está
              liberado agora; o cliente precisa saber o tamanho do caminho. */}
          {resumoProcesso && (resumoProcesso.documentosPendentes + resumoProcesso.perguntasPendentes) > 0 ? (
            <div className="px-6 py-3 border-b border-[#F0F0F0]">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-bold text-[#6A6A6A] tracking-widest uppercase">
                  Resolva um por vez
                </span>
                <span className="text-[10px] font-bold text-[#8A1224] tracking-widest uppercase">
                  {resumoProcesso.concluidos} de {resumoProcesso.totalObrigatorios} concluídos
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-[#6A6A6A]">
                Ainda faltam{" "}
                {resumoProcesso.documentosPendentes > 0 ? (
                  <strong className="text-[#0A0A0A]">
                    {resumoProcesso.documentosPendentes}{" "}
                    {resumoProcesso.documentosPendentes === 1 ? "documento" : "documentos"}
                  </strong>
                ) : null}
                {resumoProcesso.documentosPendentes > 0 && resumoProcesso.perguntasPendentes > 0 ? " e " : null}
                {resumoProcesso.perguntasPendentes > 0 ? (
                  <strong className="text-[#0A0A0A]">
                    {resumoProcesso.perguntasPendentes}{" "}
                    {resumoProcesso.perguntasPendentes === 1 ? "pergunta" : "perguntas"}
                  </strong>
                ) : null}{" "}
                neste processo.
              </p>
            </div>
          ) : total > 1 ? (
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
            {total > 1 && podeVoltar ? (
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

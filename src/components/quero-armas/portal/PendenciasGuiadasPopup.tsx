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
import { Check, ChevronLeft, ChevronRight, Download, ExternalLink, FileUp, Upload, X } from "lucide-react";
import { getExplicacaoPendencia, temExplicacaoBiblioteca } from "@/lib/quero-armas/pendenciasExplicacoes";
import { carregarExplicacoesBiblioteca } from "@/lib/quero-armas/bibliotecaExplicacoes";
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
  /**
   * Dado concreto que a pergunta está questionando — hoje, o endereço.
   *
   * "Você ainda reside neste imóvel?" é impossível de responder sem dizer
   * QUAL imóvel. O cliente não tem como saber a que endereço nos referimos.
   */
  detalheContexto?: string | null;
  /**
 * Conteúdo próprio da pendência, renderizado DENTRO do pop-up guiado.
 *
 * Regra do usuário (09/08/2026): nenhum fluxo pode abrir um segundo pop-up por
 * cima do guiado. A Efetiva Necessidade entrega aqui os seus passos — o cliente
 * segue no mesmo checklist, com o mesmo header, o mesmo X bordô e os mesmos
 * contadores. Quando `corpo` existe, o passo a passo padrão e os botões de
 * ação do rodapé saem de cena: quem manda é o fluxo embutido.
 */
  corpo?: React.ReactNode;
}

interface Props {
  open: boolean;
  pendencias: PendenciaItem[];
  onDismiss: () => void;
  /**
   * Quando true o popup vira obrigatório: sem botão de fechar e sem dispensar
   * clicando fora. Usado enquanto houver contrato ou procuração pendente de
   * assinatura — o cliente só usa o portal depois de cumprir a obrigação.
   */
  bloqueante?: boolean;
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
    /** Documentos dispensados automaticamente por reaproveitamento do histórico. */
    reaproveitados?: number;
    /**
     * Grupos do PROCESSO INTEIRO, na ordem em que o cliente vai encontrá-los —
     * incluindo os que ainda não foram liberados na fila. Sem isto o popup só
     * sabia dizer "Passo 1 de 6" da fila do momento, e o cliente não tinha
     * ideia de quantas frentes ainda existem.
     */
    grupos?: Array<{ id: string; label: string; total: number; concluidos: number }>;
  } | null;
  /** Nome do cliente — usado no H1 de abertura do popup. */
  nomeCliente?: string | null;
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

export default function PendenciasGuiadasPopup({ open, pendencias, onDismiss, pinnedId, ufCliente, resumoProcesso, nomeCliente, bloqueante = false, asPage = false }: Props & { asPage?: boolean }) {
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
    // REGRA DE NEGÓCIO (ordem inegociável): 1) contrato e procuração,
    // 2) exigências cadastrais, 3) checklist documental. Enquanto houver
    // assinatura na fila, o popup fica travado nela — nenhum pin de card
    // (declaração, comprovante, etc.) pode passar na frente.
    const iAssinatura = pendencias.findIndex((p) => p.kind === "signature");
    if (iAssinatura >= 0) {
      const pinEhAssinatura =
        pinnedId != null && pendencias.find((p) => p.id === pinnedId)?.kind === "signature";
      setIndice(pinEhAssinatura ? pendencias.findIndex((p) => p.id === pinnedId) : iAssinatura);
      return;
    }
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
  // Biblioteca de documentos = fonte única do passo a passo. Carrega uma vez
  // (cacheado) e força re-render quando chega, para o cliente ver o texto
  // gerenciado pelo admin, não o fallback estático.
  const [bibliotecaCarregada, setBibliotecaCarregada] = useState(false);
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    void carregarExplicacoesBiblioteca().then(() => { if (vivo) setBibliotecaCarregada(true); });
    return () => { vivo = false; };
  }, [open]);
  const activeGrupo = active.grupoLabel || grupoDaPendencia(active.rawTipo, active.tipo).label;
  const activeGrupoId = active.grupoId || grupoDaPendencia(active.rawTipo, active.tipo).id;
  const grupoInfo = gruposOrdenados.find((g) => g.id === activeGrupoId);
  const posicaoNoGrupo = grupoInfo ? grupoInfo.ids.indexOf(active.id) + 1 : 0;
  const totalNoGrupo = grupoInfo?.ids.length ?? 0;
  // Posição do grupo entre os grupos do processo, na ordem em que a fila os
  // apresenta. `gruposOrdenados` já preserva essa ordem.
  const grupoOrdem = gruposOrdenados.findIndex((g) => g.id === activeGrupoId) + 1;

  /**
   * Posição do grupo atual entre os grupos do PROCESSO.
   *
   * Diferente de `grupoOrdem`, que conta só os grupos presentes na fila
   * liberada agora. É este que responde "1 de quantos grupos faltam".
   */
  const gruposProcesso = resumoProcesso?.grupos ?? [];
  const grupoNoProcesso = (() => {
    if (gruposProcesso.length < 2) return null;
    const i = gruposProcesso.findIndex((g) => g.id === activeGrupoId);
    if (i < 0) return null;
    const g = gruposProcesso[i];
    return {
      posicao: i + 1,
      totalGrupos: gruposProcesso.length,
      total: g.total,
      concluidos: g.concluidos,
    };
  })();
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

  // Regra (04/08/2026 — CORREÇÃO): o texto da Biblioteca só substitui o passo a
  // passo do REGISTRO quando ele é REALMENTE um passo a passo. Antes, uma linha
  // solta cadastrada pela equipe ("Emita no site do TSE e envie o PDF
  // original.") apagava as 5–8 etapas detalhadas que o cliente precisa para
  // conseguir emitir a certidão. Agora:
  //   - catálogo com MAIS passos que o registro → catálogo vence (é mais rico);
  //   - registro sem passos → catálogo vence (único conteúdo existente);
  //   - caso contrário → mantém o passo a passo detalhado e a linha do
  //     catálogo entra como primeira etapa/resumo, sem destruir o resto.
  const passosCatalogo = active.instrucoesCatalogo
    ? active.instrucoesCatalogo.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    : [];
  const passosRegistro = Array.isArray(explicBase.passos) ? explicBase.passos : [];
  // Se o passo a passo veio da Biblioteca de documentos, ele é definitivo:
  // é lá que o admin gerencia o texto (fonte única). O catálogo do serviço
  // (qa_servicos_documentos) só entra quando a biblioteca não tem nada.
  const daBiblioteca =
    !isSignature && bibliotecaCarregada &&
    temExplicacaoBiblioteca(active.rawTipo || active.tipo, active.tipo);
  const usarCatalogo =
    !isSignature &&
    !daBiblioteca &&
    passosCatalogo.length > 0 &&
    (passosRegistro.length === 0 || passosCatalogo.length >= passosRegistro.length);
  const mesclarCatalogo =
    !isSignature && !daBiblioteca && passosCatalogo.length > 0 && !usarCatalogo;
  const explic = usarCatalogo
    ? {
        ...explicBase,
        passos: passosCatalogo,
        observacao: active.observacoesCatalogo || explicBase.observacao,
      }
    : mesclarCatalogo
    ? {
        ...explicBase,
        passos: [
          ...passosCatalogo.filter(
            (p) => !passosRegistro.some((r) => r.trim().toLowerCase() === p.toLowerCase()),
          ),
          ...passosRegistro,
        ],
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
  const linkEmissaoFinal = active.linkEmissao || linkPorUf || explic.siteUrl || null;
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

  const getPerguntaButtonClassName = (valor: string, ativo: boolean) => {
    if (active.perguntaChave === "ainda_reside_imovel") {
      if (ativo) {
        return valor === "sim"
          ? "bg-emerald-600 border-emerald-600 text-white"
          : "bg-red-600 border-red-600 text-white";
      }
      if (valor === "sim") {
        return "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100 hover:border-emerald-300";
      }
      if (valor === "nao") {
        return "bg-red-50 border-red-200 text-red-900 hover:bg-red-100 hover:border-red-300";
      }
    }
    return ativo
      ? "bg-[#8A1224] border-[#8A1224] text-white"
      : "bg-white border-[#8A1224] text-[#8A1224] hover:bg-[#FFF7F8]";
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
  const faltam = total - passoAtual;
  const totalItensGrupo = grupoNoProcesso?.total ?? totalNoGrupo;
  const concluidosGrupo = grupoNoProcesso?.concluidos ?? Math.max(0, posicaoNoGrupo - 1);
  const pendenciasGrupo = Math.max(0, totalItensGrupo - concluidosGrupo);
  const pendenciasGrupoLabel = `${pendenciasGrupo} pendência${pendenciasGrupo === 1 ? "" : "s"}`;

  // Só o primeiro nome: "WILLIAN RODRIGUES DA SILVA MASSAROTO, VOCÊ ESTÁ..."
  // quebrava em três linhas e dominava o topo do card.
  const primeiroNomeRaw = (nomeCliente || "").trim().split(/\s+/)[0] || "";
  const primeiroNome = primeiroNomeRaw
    ? primeiroNomeRaw.charAt(0).toUpperCase() + primeiroNomeRaw.slice(1).toLowerCase()
    : "";

  return (
    <div
      className={
        asPage
          ? "w-full h-full min-h-0"
          : "fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-hidden"
      }
      role={asPage ? undefined : "dialog"}
      aria-modal={asPage ? undefined : true}
      style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "#0A0A0A" }}
      data-qa-overlay={asPage ? undefined : true}
      onClick={asPage || bloqueante ? undefined : onDismiss}
    >
      <div
        className={
          asPage
            ? "relative w-full h-full min-h-0 overflow-hidden flex flex-col"
            : "relative w-full sm:w-[42rem] sm:max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[calc(100dvh-1.5rem)] sm:h-[min(90dvh,760px)]"
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — apenas no pop-up. No modo página (granada) não há X. */}
        {!asPage && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 z-20 rounded-full bg-[#8A1224] p-2 text-white hover:bg-[#6f0f1e] transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
        )}

        {/* Abertura pessoal — bloco limpo, no mesmo papel branco das demais
            páginas. Sem gradiente: só o filete bordô e a tipografia fazem a
            hierarquia. REGRA DE LAYOUT: nenhum texto do header deve competir
            com o botão de fechar (X) no canto superior direito. O padding-right
            abaixo reserva a zona do botão em todas as larguras. */}
        <div
          className={
            asPage
              ? "shrink-0 border-b border-[#EFEFEF] px-0 pt-0 pb-4"
              : "shrink-0 border-b border-[#EFEFEF] px-5 pt-5 pb-2 pr-12 sm:px-6 sm:pr-14"
          }
        >
          {asPage ? (
            /* ⚠️ LAYOUT TRAVADO — MODO PÁGINA (ícone da granada) ⚠️
               Aprovado pelo usuário em 03/08/2026. Regras congeladas:
               - SEM kicker "Checklist guiado"
               - SEM a palavra "VOCÊ" no H1
               - SEM fundo branco / card (bg-transparent, sem borda)
               - H1 alinhado à esquerda com o restante da página (px-0)
               - Oswald 700, 22px, uppercase, tracking .04em, nome em bordô
               NÃO ALTERAR sem confirmar com o usuário DUAS vezes ("tem certeza?"
               e depois "confirma mesmo?"). Não replicar no pop-up. */
            <div className="min-w-0">
              <h1
                style={{
                  fontFamily: "Oswald,'Arial Narrow',Arial,sans-serif",
                  fontWeight: 700,
                  fontSize: "22px",
                  lineHeight: 1.05,
                  letterSpacing: ".04em",
                  color: "#0A0A0A",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                {primeiroNome ? (
                  <>
                    <span style={{ color: "#7A1F2B" }}>{primeiroNome.toUpperCase()}</span>, ESTÁ NOS DEVENDO
                    <br />{total === 1 ? "ENVIAR ESTE DOCUMENTO!" : "ENVIAR ESSES DOCUMENTOS!"}
                  </>
                ) : (
                  <>ESTÁ NOS DEVENDO<br />{total === 1 ? "ENVIAR ESTE DOCUMENTO!" : "ENVIAR ESSES DOCUMENTOS!"}</>
                )}
              </h1>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#8A1224]/15 bg-[#FFF7F8]">
                <FileUp className="h-4 w-4 text-[#8A1224]" />
              </span>
              <div className="min-w-0">
                <p className="font-['Oswald',sans-serif] text-[10px] font-black uppercase tracking-[0.22em] text-[#8A1224]">
                  Checklist guiado
                </p>
                {/* Sem quebra de linha forçada: em telas estreitas ela produzia
                    "Fabio, você está nos / devendo / enviar este documento!".
                    O balanceamento nativo distribui as linhas sem cortar frase. */}
                <h1
                  className="mt-1 font-['Oswald',sans-serif] text-[22px] font-bold leading-[1.15] tracking-[0.01em] text-[#0A0A0A]"
                  style={{ textWrap: "balance", hyphens: "none" } as React.CSSProperties}
                >
                  {primeiroNome ? `${primeiroNome}, você está nos devendo ` : "Você está nos devendo "}
                  {total === 1 ? "enviar este documento!" : "enviar esses documentos!"}
                </h1>
              </div>
            </div>
          )}
        </div>

        {/* Header */}
        <div className={asPage ? "px-0 pt-2 pb-4 shrink-0 sm:pt-2" : "px-5 pt-2 pb-4 shrink-0 sm:px-6 sm:pt-2"}>
          <div className={asPage ? "flex items-center gap-2 flex-wrap" : "pl-[44px] flex items-center gap-2 flex-wrap"}>
            {/* O badge mostra o GRUPO do processo — Identificação, Antecedentes
                criminais, Ocupação lícita — e não mais a posição dentro dele.
                "1 de 4 no grupo" competia com "Passo 1 de 4" e não dizia ao
                cliente em que parte do processo ele estava. */}
            <span className="qa-eyebrow inline-flex items-center rounded-full border border-[#8A1224]/20 bg-[#FFF7F8] px-2 py-0.5 text-[9px] tracking-[0.14em]" style={{ color: "#7A1F2B" }}>
              {activeGrupo}
              {/* Onde este grupo fica no processo inteiro. Sem isto o cliente
                  via só o nome do grupo e não tinha ideia de quantas frentes
                  ainda existem — "Antecedentes" podia ser a única ou a
                  segunda de seis. */}
              {grupoNoProcesso ? (
                <span className="ml-1.5 font-bold text-[#8A1224]/70">
                  · GRUPO {grupoNoProcesso.posicao} DE {grupoNoProcesso.totalGrupos}
                </span>
              ) : null}
            </span>
            {/* NÃO reintroduzir "N de M no grupo": quando a fila tem um grupo
                só — que é o caso comum — ele repete exatamente os números do
                "Passo N de M" ao lado, e o cliente lê a mesma informação duas
                vezes com nomes diferentes. */}
            <span className="qa-eyebrow inline-flex items-center rounded-full border border-[#E4E4E4] bg-white px-2 py-0.5 text-[9px] tracking-[0.14em]">
              {headerContexto}
            </span>
            {pendenciasGrupo > 0 ? (
              <span className="qa-eyebrow inline-flex items-center rounded-full border border-[#E4E4E4] bg-[#FAFAFA] px-2 py-0.5 text-[9px] tracking-[0.14em]">
                {pendenciasGrupoLabel}
              </span>
            ) : null}
          </div>
          <div className="mt-4 mb-1 h-px bg-[#F0F0F0]" />
          <div className={asPage ? "" : "pl-[44px]"}>
            {/* Corpo customizado (ex.: efetiva necessidade) já traz o próprio
                título da etapa — o título grande repetiria o nome do grupo. */}
            {active.corpo ? null : (
              <h2 className="qa-h1 mt-4" style={{ letterSpacing: ".02em" }}>
                {explic.titulo}
              </h2>
            )}

            {active.detalheContexto ? (
              <p className="qa-body qa-body--soft mt-3 rounded-sm border border-[#E5E5E5] bg-white px-3 py-2">
                {active.detalheContexto}
              </p>
            ) : null}

            {/* Link de acesso ao site oficial — sem retângulo; somente o texto. */}
            {!isSignature && !isPergunta && linkEmissaoFinal ? (
              <a
                href={linkEmissaoFinal}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#7A1F2B] hover:text-[#8A1224] hover:underline underline-offset-2"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                Acessar site pra emissão
              </a>
            ) : null}
          </div>
        </div>

        {/* Scrollable body */}
        <div className={asPage ? "no-scrollbar flex-1 overflow-y-auto px-0 pb-2" : "no-scrollbar flex-1 overflow-y-auto px-6 pb-2"}>


          {active.corpo ? (
            <div className="pt-1">{active.corpo}</div>
          ) : (
          <>
          {/* Step list with vertical timeline */}
          <div className="relative">
            <div className="absolute left-[15px] top-3 bottom-3 w-px bg-[#E4E4E4]" />
            <ul className="space-y-5 relative">
              {explic.passos.map((p, i) => (
                <li key={i} className="flex gap-4">
                  <span className="qa-btn-label flex-shrink-0 w-8 h-8 rounded-full bg-[#FFF7F8] text-[#8A1224] border border-[#8A1224]/10 flex items-center justify-center z-10" style={{ letterSpacing: 0, fontSize: 12 }}>
                    {i + 1}
                  </span>
                  <p className="qa-body qa-body--soft pt-1">
                    <TextoComLinks texto={p} />
                  </p>
              </li>
              ))}
            </ul>
          </div>


          {/* Observation */}
          {explic.observacao && activeGrupoId !== "antecedentes" ? (
            <div className="mt-6 p-4 bg-[#FFF7F8] rounded-sm border border-[#8A1224]/10">
              <p className="qa-caption" style={{ color: "#7A1F2B" }}>
                <TextoComLinks texto={explic.observacao} />
              </p>
            </div>
          ) : null}

          {/* Botões de resposta inline — perguntas pivot */}
          {isPergunta && Array.isArray(active.perguntaOpcoes) && active.perguntaOpcoes.length > 0 ? (
            <div className="mt-6 rounded-sm border border-[#8A1224]/20 bg-white p-4">
              <div className="qa-eyebrow mb-3" style={{ color: "#7A1F2B" }}>
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
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold uppercase tracking-wider transition-colors border-2 ${getPerguntaButtonClassName(String(op.valor), ativo)} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {ativo ? <Check className="h-4 w-4" /> : null}
                      {loading ? "..." : String(op.label || op.valor).toUpperCase()}
                    </button>
                  );
                })}
              </div>
              {active.perguntaAjudaPos ? (
                <p className="qa-caption mt-3">
                  {active.perguntaAjudaPos}
                </p>
              ) : null}
            </div>
          ) : null}
          </>
          )}

          {/* Modo página (granada): o card "Resolva um por vez" NÃO fica travado
              no rodapé nem em fundo branco — ele rola junto com o conteúdo. */}
          {asPage && resumoProcesso && (resumoProcesso.documentosPendentes + resumoProcesso.perguntasPendentes) > 0 ? (
            <div className="mt-4 border-t border-[#EFEFEF] pt-3">
              <div className="flex justify-between items-baseline">
                <span className="qa-kpi-label">
                  Resolva um por vez
                </span>
                <span className="qa-kpi-label" style={{ color: "#7A1F2B" }}>
                  {resumoProcesso.concluidos} de {resumoProcesso.totalObrigatorios} concluídos
                </span>
              </div>
              <p className="qa-caption mt-1.5">
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
              {grupoNoProcesso ? (
                <p className="qa-caption mt-1">
                  Neste grupo — <strong className="text-[#0A0A0A]">{activeGrupo}</strong> —{" "}
                  {grupoNoProcesso.concluidos} de {grupoNoProcesso.total}{" "}
                  {grupoNoProcesso.total === 1 ? "item concluído" : "itens concluídos"}.
                </p>
              ) : null}
              {(resumoProcesso.reaproveitados ?? 0) > 0 ? (
                <p className="qa-caption mt-2 text-emerald-700 font-medium">
                  ✓{" "}
                  {resumoProcesso.reaproveitados === 1
                    ? "1 documento já reconhecido do seu histórico."
                    : `${resumoProcesso.reaproveitados} documentos já reconhecidos do seu histórico.`}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          className={
            asPage
              ? "mt-auto border-t border-[#E4E4E4] bg-transparent shrink-0"
              : "mt-auto border-t border-[#E4E4E4] bg-white shrink-0"
          }
        >
          {/* Números do PROCESSO, não da fila. A fila mostra o que está
              liberado agora; o cliente precisa saber o tamanho do caminho. */}
          {asPage ? null : resumoProcesso && (resumoProcesso.documentosPendentes + resumoProcesso.perguntasPendentes) > 0 ? (
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
              {grupoNoProcesso ? (
                <p className="mt-1 text-[11px] text-[#6A6A6A]">
                  Neste grupo — <strong className="text-[#0A0A0A]">{activeGrupo}</strong> —{" "}
                  {grupoNoProcesso.concluidos} de {grupoNoProcesso.total}{" "}
                  {grupoNoProcesso.total === 1 ? "item concluído" : "itens concluídos"}.
                </p>
              ) : null}
              {(resumoProcesso.reaproveitados ?? 0) > 0 ? (
                <p className="mt-2 text-[11px] text-emerald-700 font-medium">
                  ✓{" "}
                  {resumoProcesso.reaproveitados === 1
                    ? "1 documento já reconhecido do seu histórico."
                    : `${resumoProcesso.reaproveitados} documentos já reconhecidos do seu histórico.`}
                </p>
              ) : null}
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

          {active.corpo ? null : (
          <div className={asPage ? "px-0 py-4 flex flex-col gap-3" : "px-6 py-4 flex flex-col gap-3"}>
            {total > 1 && podeVoltar ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIndice((i) => Math.max(0, i - 1))}
                  disabled={!podeVoltar}
                  className="qa-btn-label flex-1 py-3 px-4 rounded-sm border border-[#E4E4E4] text-[#0A0A0A] bg-white hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setIndice((i) => Math.min(total - 1, i + 1))}
                  disabled={!podeAvancar}
                  className="qa-btn-label flex-1 py-3 px-4 rounded-sm border border-[#E4E4E4] text-[#0A0A0A] bg-white hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
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
          )}
        </div>
      </div>
    </div>
  );
}

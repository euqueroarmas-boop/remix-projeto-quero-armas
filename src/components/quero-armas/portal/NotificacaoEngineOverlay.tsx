import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronRight,
  CreditCard,
  FileSignature,
  FileText,
  FileX2,
  Info,
  ShieldCheck,
  Trash2,
  UserCog,
  X,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type NotificacaoAtiva = {
  id: string;
  categoria: string;
  urgencia: "urgente" | "normal";
  titulo: string;
  mensagem: string;
  link: string | null;
  created_at: string;
  is_teste?: boolean;
};

// Consulta as pendências uma única vez a cada abertura do portal (sem
// polling agressivo). O reaparecimento de uma notificação urgente
// respeita 24h — o cliente vê no máximo 1x por dia até resolver.
const REAPARECER_MS = 24 * 60 * 60_000; // 24h

function hiddenUntilKey(id: string) {
  return `qa_notif_hidden_${id}`;
}
function seenNormalKey(id: string) {
  return `qa_notif_seen_normal_${id}`;
}
// "Limpar tudo" é definitivo: o id fica marcado no aparelho e a notificação
// não volta mais, mesmo que a pendência continue aberta no banco (avisos
// urgentes sintéticos, como contrato pendente, não têm linha para dispensar).
function limpaKey(id: string) {
  return `qa_notif_limpa_${id}`;
}
function estaLimpa(id: string) {
  try {
    return localStorage.getItem(limpaKey(id)) === "1";
  } catch {
    return false;
  }
}

// Só os avisos gravados em qa_notificacoes_cliente têm uuid — os sintéticos
// (contrato-<id>) quebrariam o RPC de dispensa, que espera uuid.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Arrastar com o dedo para remover: a partir de 6px já é arrasto (e não
// toque), e soltar depois de 56px descarta o aviso.
const ARRASTO_MINIMO = 6;
const ARRASTO_DESCARTE = 56;

// Seções do portal por categoria de notificação. Sem isso, links genéricos
// "/area-do-cliente" caíam em "resumo" — a seção onde o cliente já estava —
// e o clique em "Ver detalhes" parecia não fazer nada.
function secaoPorCategoria(categoria: string): string | null {
  const c = String(categoria || "").toLowerCase();
  if (c.includes("documento") || c.includes("certidao") || c.includes("prova") || c.includes("exigencia")) return "documentos";
  if (c.includes("pagamento") || c.includes("financ") || c.includes("premium") || c.includes("cobranca")) return "financeiro";
  if (c.includes("processo")) return "processos";
  if (c.includes("arsenal")) return "arsenal";
  if (c.includes("cadastro")) return "configuracoes";
  return null;
}

// Tem para onde levar o cliente? Contrato/assinatura abre o popup de
// assinaturas mesmo sem link; o resto depende do link gravado.
function temAcao(n: { categoria: string; link: string | null }) {
  const c = String(n.categoria || "").toLowerCase();
  if (c.includes("contrato") || c.includes("assinatura") || c.includes("procuracao")) return true;
  return Boolean(n.link);
}

// Ícone por categoria da notificação (o "assunto" gravado no banco), para o
// cliente identificar o tema do aviso antes mesmo de ler o título.
function iconePorCategoria(categoria: string, urgente: boolean): LucideIcon {
  const c = String(categoria || "").toLowerCase();
  if (c.includes("contrato") || c.includes("assinatura") || c.includes("procuracao")) return FileSignature;
  if (c.includes("documento_excluido")) return Trash2;
  if (c.includes("rejeitad") || c.includes("recusad") || c.includes("certidao_rejeitada")) return FileX2;
  if (c.includes("documento_em_dia") || c.includes("exigencia_cumprida") || c.includes("prova")) return BadgeCheck;
  if (c.includes("documento")) return FileText;
  if (c.includes("pagamento") || c.includes("financ") || c.includes("cobranca")) return CreditCard;
  if (c.includes("premium") || c.includes("arsenal")) return ShieldCheck;
  if (c.includes("cadastro")) return UserCog;
  return urgente ? AlertTriangle : Info;
}

/**
 * Motor de notificações persistentes do cliente. Renderizado uma única vez,
 * fora dos blocos condicionais de seção do portal — por isso aparece em
 * qualquer "tela" (na verdade todas são o mesmo componente, só trocam
 * activeSection). Notificações urgentes (contrato pendente, exames e
 * documentos vencendo em até 30 dias) reaparecem no dia seguinte até a
 * pendência real ser resolvida — fechar no X só esconde temporariamente.
 * Notificações normais somem até o próximo login ao serem fechadas.
 * Os avisos vêm agrupados num bloco único, e "Limpar tudo" apaga o bloco
 * inteiro em definitivo (nem os urgentes voltam).
 */
export default function NotificacaoEngineOverlay({ clienteId, bloqueado = false }: { clienteId: number | null; bloqueado?: boolean }) {
  const [todas, setTodas] = useState<NotificacaoAtiva[]>([]);
  const [visiveis, setVisiveis] = useState<NotificacaoAtiva[]>([]);
  const [arrasto, setArrasto] = useState<{ id: string; dx: number } | null>(null);
  const arrastoId = useRef<string | null>(null);
  const arrastoInicioX = useRef(0);
  const arrastoDx = useRef(0);
  const arrastoCapturado = useRef(false);
  // Marca que houve arrasto para o clique seguinte não abrir os detalhes.
  const arrastou = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!clienteId) return;
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase.rpc("qa_cliente_notificacoes_ativas" as any, {
        p_cliente_id: clienteId,
      });
      if (!cancelado && !error && Array.isArray(data)) {
        setTodas(data as NotificacaoAtiva[]);
        // Notificações de teste aparecem 1x apenas: assim que a lista chega,
        // dispara o desligamento server-side (função marca ativa=false).
        const testes = (data as NotificacaoAtiva[]).filter((n) => n.is_teste);
        for (const n of testes) {
          supabase.rpc("qa_notificacao_marcar_vista" as any, { p_id: n.id }).then(() => {});
        }
      }
    })();
    return () => { cancelado = true; };
  }, [clienteId]);

  useEffect(() => {
    const agora = Date.now();
    const filtradas = todas.filter((n) => {
      if (estaLimpa(n.id)) return false;
      if (n.urgencia === "urgente") {
        const escondidoAte = Number(localStorage.getItem(hiddenUntilKey(n.id)) || 0);
        return agora >= escondidoAte;
      }
      return !sessionStorage.getItem(seenNormalKey(n.id));
    });
    // Deduplicação: um único aviso por categoria (o mais recente). O motor
    // cria uma linha por evento (ex: cada arquivo removido), o que empilhava
    // dezenas de cartões idênticos no portal. Sem corte de quantidade — o
    // cliente precisa ver quantos avisos tem; a lista rola dentro do bloco.
    const porCategoria = new Map<string, NotificacaoAtiva>();
    for (const n of [...filtradas].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )) {
      const chave = `${n.categoria}|${n.titulo}`;
      if (!porCategoria.has(chave)) porCategoria.set(chave, n);
    }
    setVisiveis(Array.from(porCategoria.values()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todas]);

  // Remoção definitiva de um aviso — pelo X ou arrastando com o dedo. Vale o
  // mesmo do "Limpar tudo": marca no aparelho e, para os avisos com linha no
  // banco, dispensa server-side. Uma vez removido, não volta.
  function fechar(n: NotificacaoAtiva) {
    try {
      localStorage.setItem(limpaKey(n.id), "1");
      if (n.urgencia === "urgente") {
        localStorage.setItem(hiddenUntilKey(n.id), String(Date.now() + REAPARECER_MS));
      } else {
        sessionStorage.setItem(seenNormalKey(n.id), "1");
      }
    } catch {
      /* storage indisponível: a remoção vale ao menos para esta sessão */
    }
    if (UUID_RE.test(n.id)) {
      supabase.rpc("qa_notificacao_dispensar" as any, { p_id: n.id }).then(() => {});
    }
    setVisiveis((prev) => prev.filter((x) => x.id !== n.id));
  }

  // Limpa o bloco inteiro de uma vez, com a mesma regra do X.
  function limparTodas() {
    for (const n of visiveis) fechar(n);
    setVisiveis([]);
  }

  // ── Arrastar com o dedo para remover ────────────────────────────────
  // A captura do ponteiro só começa depois de 6px de movimento: assim o
  // toque no X continua sendo um clique normal no botão, sem sequestro.
  function arrastoInicio(e: React.PointerEvent, n: NotificacaoAtiva) {
    arrastoId.current = n.id;
    arrastoInicioX.current = e.clientX;
    arrastoDx.current = 0;
    arrastoCapturado.current = false;
    arrastou.current = false;
    setArrasto({ id: n.id, dx: 0 });
  }

  function arrastoMover(e: React.PointerEvent, n: NotificacaoAtiva) {
    if (arrastoId.current !== n.id) return;
    const dx = e.clientX - arrastoInicioX.current;
    if (!arrastoCapturado.current && Math.abs(dx) > ARRASTO_MINIMO) {
      arrastoCapturado.current = true;
      arrastou.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* navegador sem pointer capture: o arrasto ainda funciona dentro da linha */
      }
    }
    arrastoDx.current = dx;
    setArrasto({ id: n.id, dx });
  }

  function arrastoFim(n: NotificacaoAtiva) {
    if (arrastoId.current !== n.id) return;
    const dx = arrastoDx.current;
    arrastoId.current = null;
    arrastoDx.current = 0;
    arrastoCapturado.current = false;
    setArrasto(null);
    if (Math.abs(dx) >= ARRASTO_DESCARTE) fechar(n);
  }

  function abrirDetalhes(n: NotificacaoAtiva, e: React.MouseEvent) {
    e.preventDefault();
    // Categoria de contrato/procuração pendente: abre o popup de assinaturas
    // do portal em vez de navegar (a rota /area-do-cliente/contratos não existe
    // e caía no fallback da home).
    const cat = String(n.categoria || "").toLowerCase();
    if (cat.includes("contrato") || cat.includes("assinatura") || cat.includes("procuracao")) {
      window.dispatchEvent(new CustomEvent("qa:abrir-assinaturas-pendentes"));
      return;
    }
    // Demais categorias: o portal é uma SPA de seções, então links internos
    // do tipo /area-do-cliente/<secao> devem trocar a seção em vez de navegar
    // (navegar caía no fallback da home e "nada acontecia").
    const link = String(n.link || "");
    const interna = link.match(/^\/area-do-cliente\/?([a-z_-]*)/i);
    if (interna) {
      const secao = (interna[1] || "").toLowerCase();
      const mapa: Record<string, string> = {
        documentos: "documentos",
        processos: "processos",
        financeiro: "financeiro",
        contratos: "contratos",
        arsenal: "arsenal",
        pendencias: "pendencias",
        mensagens: "mensagens",
        configuracoes: "configuracoes",
      };
      const destino = mapa[secao] || secaoPorCategoria(n.categoria) || "documentos";
      window.dispatchEvent(
        new CustomEvent("qa:portal-ir-para-secao", { detail: { secao: destino } }),
      );
      fechar(n);
      return;
    }
    if (link) navigate(link);
  }

  if (visiveis.length === 0 || bloqueado) return null;

  return (
    // Bloco único no alto à direita, encostado à esquerda do rail de ícones
    // (56px) e, no desktop, abaixo do avatar fixo. Antes eram cartões soltos
    // de ~380px com folga larga, que no celular tomavam quase a tela toda.
    <div className="fixed top-2 right-[64px] z-[200] w-[66vw] max-w-[250px] lg:top-[84px] lg:right-[72px] lg:w-[250px]">
      <div className="rounded-xl border border-black/5 bg-white/90 backdrop-blur-xl shadow-[0_8px_24px_-10px_rgba(0,0,0,0.32)] overflow-hidden animate-in slide-in-from-top-2 fade-in">
        <div className="flex items-center justify-between gap-2 px-2 py-1 border-b border-black/5 bg-black/[0.03]">
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-black/40">
            {visiveis.length} {visiveis.length > 1 ? "avisos" : "aviso"}
          </span>
          <button
            onClick={limparTodas}
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-black/60 hover:text-[#7A1F2B] hover:bg-black/5"
            aria-label="Limpar todas as notificações"
          >
            <Trash2 className="w-2.5 h-2.5" />
            Limpar tudo
          </button>
        </div>
        {/* Lista rolável: nenhum aviso fica escondido atrás do outro, e a
            contagem do cabeçalho é sempre o total real. */}
        <ul className="divide-y divide-black/5 max-h-[42vh] overflow-y-auto overscroll-contain">
          {visiveis.map((n) => {
            const urgente = n.urgencia === "urgente";
            const IconeCategoria = iconePorCategoria(n.categoria, urgente);
            const dx = arrasto?.id === n.id ? arrasto.dx : 0;
            return (
              <li
                key={n.id}
                onPointerDown={(e) => arrastoInicio(e, n)}
                onPointerMove={(e) => arrastoMover(e, n)}
                onPointerUp={() => arrastoFim(n)}
                onPointerCancel={() => arrastoFim(n)}
                onClick={
                  temAcao(n)
                    ? (e) => {
                        // Depois de arrastar, o clique do navegador não deve
                        // abrir a seção — o dedo estava removendo o aviso.
                        if (arrastou.current) {
                          arrastou.current = false;
                          return;
                        }
                        abrirDetalhes(n, e);
                      }
                    : undefined
                }
                onKeyDown={
                  temAcao(n)
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") abrirDetalhes(n, e as unknown as React.MouseEvent);
                      }
                    : undefined
                }
                role={temAcao(n) ? "button" : undefined}
                tabIndex={temAcao(n) ? 0 : undefined}
                style={{
                  transform: dx ? `translateX(${dx}px)` : undefined,
                  opacity: dx ? Math.max(0.25, 1 - Math.abs(dx) / 140) : undefined,
                  transition: dx ? "none" : "transform 160ms ease, opacity 160ms ease",
                  touchAction: "pan-y",
                }}
                className={`flex items-start gap-1.5 px-2 py-1.5 bg-white/0 ${
                  temAcao(n) ? "cursor-pointer hover:bg-black/[0.03]" : ""
                }`}
              >
                <span
                  className={`shrink-0 mt-[1px] h-4 w-4 rounded-md flex items-center justify-center ${
                    urgente ? "bg-[#7A1F2B]" : "bg-black/80"
                  }`}
                >
                  <IconeCategoria className="w-2.5 h-2.5 text-white" />
                </span>
                <div className="min-w-0 flex-1">
                  {/* A linha inteira abre os detalhes — o chevron substitui o
                      antigo link "Ver detalhes", que gastava uma linha só dele. */}
                  <p className="flex items-start gap-0.5 text-[11px] leading-tight font-semibold text-black tracking-[-0.01em]">
                    <span className="line-clamp-2">{n.titulo}</span>
                    {temAcao(n) && (
                      <ChevronRight
                        className={`shrink-0 w-3 h-3 ${urgente ? "text-[#7A1F2B]" : "text-black/40"}`}
                      />
                    )}
                  </p>
                  <p className="text-[10.5px] leading-[1.3] text-black/55 line-clamp-2">
                    {n.mensagem}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fechar(n);
                  }}
                  className="shrink-0 -mr-0.5 h-5 w-5 rounded-full flex items-center justify-center text-black/30 hover:text-black/70 hover:bg-black/5"
                  aria-label="Fechar notificação"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

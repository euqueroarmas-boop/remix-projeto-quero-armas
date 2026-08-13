import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
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

// Cascata: quantos cartões aparecem atrás do da frente e quantos pixels cada
// um desce, deixando visível que há mais avisos na pilha.
const MAX_CASCATA = 3;
const DESLOCAMENTO_CASCATA = 7;

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
 * Os avisos aparecem em cascata (um cartão sobre o outro, como na Central
 * de Notificação do admin): só o da frente é legível, os de trás mostram a
 * borda. Remoção 1 a 1 pelo X ou arrastando com o dedo, e "Limpar tudo"
 * apaga a pilha inteira — em qualquer um dos casos o aviso não volta.
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
    // rodapé mostra quantos avisos existem de fato na pilha.
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

  // Cascata: só o aviso da frente é legível; os de trás aparecem deslocados
  // para baixo e para a esquerda, mostrando que existem mais. Mesmo padrão da
  // Central de Notificação do administrador.
  const frente = visiveis[0];
  const atras = visiveis.slice(1, 1 + MAX_CASCATA);
  const urgente = frente.urgencia === "urgente";
  const IconeFrente = iconePorCategoria(frente.categoria, urgente);
  const dx = arrasto?.id === frente.id ? arrasto.dx : 0;

  return (
    // Bloco no alto à direita, encostado à esquerda do rail de ícones (56px)
    // e, no desktop, abaixo do avatar fixo. Antes ficava centralizado com
    // ~380px, tomando quase toda a largura no celular.
    <div className="fixed top-2 right-[64px] z-[200] w-[70vw] max-w-[260px] lg:top-[84px] lg:right-[72px] lg:w-[260px]">
      <div style={{ paddingBottom: atras.length * DESLOCAMENTO_CASCATA }}>
        <div className="relative">
          {/* Cartões de trás — sem interação, só a borda aparecendo. */}
          {atras.map((n, i) => {
            const nivel = i + 1;
            const urgenteAtras = n.urgencia === "urgente";
            const IconeAtras = iconePorCategoria(n.categoria, urgenteAtras);
            return (
              <div
                key={n.id}
                aria-hidden
                className="absolute inset-0 overflow-hidden rounded-2xl border border-black/5 bg-white/80 backdrop-blur-xl shadow-[0_4px_14px_-8px_rgba(0,0,0,0.28)] px-3 py-2.5 pr-8 pointer-events-none"
                style={{
                  transform: `translate(${-nivel * 4}px, ${nivel * DESLOCAMENTO_CASCATA}px) scale(${1 - nivel * 0.02})`,
                  transformOrigin: "top center",
                  zIndex: 10 - nivel,
                  opacity: Math.max(0.45, 1 - nivel * 0.18),
                }}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`shrink-0 mt-0.5 h-6 w-6 rounded-[9px] flex items-center justify-center ${
                      urgenteAtras ? "bg-[#7A1F2B]" : "bg-black/80"
                    }`}
                  >
                    <IconeAtras className="w-3.5 h-3.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] leading-tight font-semibold text-black tracking-[-0.01em]">
                      {n.titulo}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Aviso da frente — arrastar para o lado ou tocar no X remove. */}
          <div
            key={frente.id}
            onPointerDown={(e) => arrastoInicio(e, frente)}
            onPointerMove={(e) => arrastoMover(e, frente)}
            onPointerUp={() => arrastoFim(frente)}
            onPointerCancel={() => arrastoFim(frente)}
            style={{
              transform: dx ? `translateX(${dx}px)` : undefined,
              opacity: dx ? Math.max(0.25, 1 - Math.abs(dx) / 140) : undefined,
              transition: dx ? "none" : "transform 160ms ease, opacity 160ms ease",
              touchAction: "pan-y",
            }}
            className="relative z-20 rounded-2xl border border-black/5 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_-8px_rgba(0,0,0,0.28)] px-3 py-2.5 pr-8 animate-in slide-in-from-top-2 fade-in"
          >
            <button
              onClick={() => fechar(frente)}
              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center text-black/35 hover:text-black/70 hover:bg-black/5"
              aria-label="Fechar notificação"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-start gap-2.5">
              <span
                className={`shrink-0 mt-0.5 h-6 w-6 rounded-[9px] flex items-center justify-center ${
                  urgente ? "bg-[#7A1F2B]" : "bg-black/80"
                }`}
              >
                <IconeFrente className="w-3.5 h-3.5 text-white" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-tight font-semibold text-black tracking-[-0.01em]">
                  {frente.titulo}
                </p>
                <p className="text-[12px] leading-snug mt-0.5 text-black/55 line-clamp-2">
                  {frente.mensagem}
                </p>
                {frente.link && (
                  <a
                    href={frente.link}
                    onClick={(e) => {
                      // Depois de arrastar, o clique do navegador não deve
                      // abrir a seção — o dedo estava removendo o aviso.
                      if (arrastou.current) {
                        arrastou.current = false;
                        e.preventDefault();
                        return;
                      }
                      abrirDetalhes(frente, e);
                    }}
                    className={`text-[12px] font-semibold mt-1 inline-block ${urgente ? "text-[#7A1F2B]" : "text-black/80"}`}
                  >
                    Ver detalhes
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé: quantos avisos existem ao todo e a limpeza de uma vez só. */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-[0.18em] text-black/40">
          {visiveis.length} {visiveis.length > 1 ? "avisos" : "aviso"}
        </span>
        <button
          onClick={limparTodas}
          className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-black/50 hover:text-[#7A1F2B] hover:bg-black/5"
          aria-label="Limpar todas as notificações"
        >
          <Trash2 className="w-2.5 h-2.5" />
          Limpar tudo
        </button>
      </div>
    </div>
  );
}

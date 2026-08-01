import { useEffect, useMemo, useRef, useState } from "react";

/* =============================================================================
 * Painel "Disparo" — tudo que está esperando o cliente, em ordem de prioridade
 *
 * Fica no rail, acima do Suporte. Passar o cursor (ou tocar, no celular) abre
 * a lista completa.
 *
 * ── A ordem, confirmada pelo usuário (01/08/2026) ────────────────────────
 *
 * O critério é: primeiro o que TRAVA tudo, depois o que tem PRAZO legal, por
 * último o que é ROTINA.
 *
 *   1. Pagamento pendente          — sem ele o processo não existe
 *   2. Contrato/procuração         — trava o processo inteiro
 *   3. Cadastro incompleto         — trava a geração de documentos
 *   4. Documento VENCIDO           — o processo regrediu e o cliente não sabe
 *   5. Vencendo em até 7 dias      — janela curta para reemitir
 *   6. Exigência do processo       — na ordem dos grupos
 *   7. Vencendo em até 30 dias     — dá tempo, mas convém avisar
 *   8. Habitualidade e filiação    — obrigação contínua do CAC
 *   9. Acervo inconsistente        — importa, mas não bloqueia o processo
 *
 * O vencido vem ANTES da exigência em aberto de propósito: ele derrubou algo
 * que já estava pronto, e o cliente não tem como saber disso sozinho. A
 * exigência em aberto ele já sabe que existe.
 * ============================================================================= */

export type PrioridadeDisparo =
  | "pagamento"
  | "assinatura"
  | "cadastro"
  | "vencido"
  | "vence_7d"
  | "exigencia"
  | "vence_30d"
  | "habitualidade"
  | "acervo";

/** Peso de ordenação. Número menor aparece primeiro. */
const PESO: Record<PrioridadeDisparo, number> = {
  pagamento: 10,
  assinatura: 20,
  cadastro: 30,
  vencido: 40,
  vence_7d: 50,
  exigencia: 60,
  vence_30d: 70,
  habitualidade: 80,
  acervo: 90,
};

const ROTULO: Record<PrioridadeDisparo, string> = {
  pagamento: "Pagamento",
  assinatura: "Assinatura",
  cadastro: "Cadastro",
  vencido: "Vencido",
  vence_7d: "Vence esta semana",
  exigencia: "Documento do processo",
  vence_30d: "Vence este mês",
  habitualidade: "Habitualidade",
  acervo: "Acervo",
};

/** Cor por urgência. Segue a mesma régua do resto do portal: ≤7 vermelho,
 *  ≤30 âmbar, o resto neutro. */
const COR: Record<PrioridadeDisparo, string> = {
  pagamento: "#8A1224",
  assinatura: "#8A1224",
  cadastro: "#8A1224",
  vencido: "#8A1224",
  vence_7d: "#B45309",
  exigencia: "#B45309",
  vence_30d: "#B45309",
  habitualidade: "#6A6A6A",
  acervo: "#6A6A6A",
};

function RifleDisparoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12h10.6" />
      <path d="M13.6 12h4.4" />
      <path d="m18 10.7 3.6 1.3-3.6 1.3" />
      <path d="M5.2 10.4h7.8" />
      <path d="M6.4 12 4.8 16H3.5" />
      <path d="m8.8 12 1.7 4.2" />
      <path d="M11.1 12v2.2h2.2" />
      <path d="M15.4 10.2h2.4" />
    </svg>
  );
}

export interface ItemDisparo {
  id: string;
  prioridade: PrioridadeDisparo;
  titulo: string;
  /** Linha de apoio: prazo, nome do serviço, o que fazer. */
  detalhe?: string | null;
  /** Dias restantes, quando fizer sentido. Negativo = vencido. */
  dias?: number | null;
  onClick?: () => void;
}

interface Props {
  itens: ItemDisparo[];
  /** Cor dos ícones do rail, para o botão não destoar. */
  corIcone: string;
}

export default function PainelDisparo({ itens, corIcone }: Props) {
  const [aberto, setAberto] = useState(false);
  const painelRef = useRef<HTMLDivElement | null>(null);

  const ordenados = useMemo(
    () =>
      [...itens].sort((a, b) => {
        const p = PESO[a.prioridade] - PESO[b.prioridade];
        if (p !== 0) return p;
        // Dentro da mesma prioridade, o mais urgente primeiro. Item sem prazo
        // vai para o fim do próprio grupo.
        const da = a.dias ?? Number.MAX_SAFE_INTEGER;
        const db = b.dias ?? Number.MAX_SAFE_INTEGER;
        return da - db;
      }),
    [itens],
  );

  const total = ordenados.length;

  useEffect(() => {
    if (!aberto) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!painelRef.current?.contains(event.target as Node)) {
        setAberto(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAberto(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [aberto]);

  return (
    <div ref={painelRef} className="relative flex h-10 w-10 items-center justify-center">
      <button
        type="button"
        // No celular não existe hover: o toque abre e fecha.
        onClick={() => setAberto((v) => !v)}
        onMouseEnter={() => setAberto(true)}
        title={total ? `${total} ${total === 1 ? "pendência" : "pendências"}` : "Nada pendente"}
        aria-label={total ? `${total} pendências` : "Nada pendente"}
        aria-expanded={aberto}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
        style={
          aberto
            ? { background: `${corIcone}33`, color: corIcone }
            : { color: total ? corIcone : `${corIcone}88` }
        }
      >
        <RifleDisparoIcon className="h-[18px] w-[18px] shrink-0" />
        {total > 0 && (
          // O número no próprio botão: sem hover o cliente já sabe que há algo
          // esperando por ele — e no celular hover nem existe.
          <span
            className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-[4px] text-[9px] font-bold leading-none text-white ring-2 ring-[#0A0A0A]"
            style={{ background: "#8A1224" }}
          >
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {aberto && (
        <div
          className="fixed bottom-[86px] right-[64px] z-[9999] w-[320px] overflow-hidden rounded-lg border border-[#E4E4E4] bg-white shadow-2xl"
          role="dialog"
        >
          <div className="border-b border-[#F0F0F0] px-4 py-2.5">
            <div className="font-heading text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A1224]">
              {total > 0 ? "Esperando você" : "Tudo em dia"}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-[#6A6A6A]">
              {total > 0
                ? "Do que trava o processo ao que é rotina — nesta ordem."
                : "Nenhuma pendência no momento. Assim que algo vencer ou o processo pedir um documento, aparece aqui."}
            </p>
          </div>

          {total > 0 && (
            <div className="max-h-[380px] overflow-y-auto">
              {ordenados.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    item.onClick?.();
                  }}
                  className="flex w-full items-start gap-2.5 border-b border-[#F5F5F5] px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[#FAFAFA]"
                >
                  <span
                    className="mt-[3px] h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ background: COR[item.prioridade] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading text-[9px] font-bold uppercase tracking-[0.14em]"
                          style={{ color: COR[item.prioridade] }}>
                      {ROTULO[item.prioridade]}
                    </span>
                    <span className="mt-0.5 block text-[12px] font-semibold leading-snug text-[#0A0A0A]">
                      {item.titulo}
                    </span>
                    {item.detalhe ? (
                      <span className="mt-0.5 block text-[11px] leading-snug text-[#6A6A6A]">
                        {item.detalhe}
                      </span>
                    ) : null}
                  </span>
                  {typeof item.dias === "number" && (
                    <span
                      className="shrink-0 font-heading text-[10px] font-bold tabular-nums"
                      style={{ color: COR[item.prioridade] }}
                    >
                      {item.dias < 0 ? "vencido" : `${item.dias}d`}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

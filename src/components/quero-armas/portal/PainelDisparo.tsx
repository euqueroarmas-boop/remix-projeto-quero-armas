/* =============================================================================
 * Botão "Disparo" — atalho do rail para o popup guiado já existente.
 *
 * Este componente NÃO cria lista própria nem painel lateral. O portal já tem um
 * padrão para resolver pendências: o PendenciasGuiadasPopup. Aqui só mostramos
 * o contador e abrimos esse fluxo.
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

export interface ItemDisparo {
  id: string;
  prioridade: PrioridadeDisparo;
  titulo: string;
  detalhe?: string | null;
  dias?: number | null;
  onClick?: () => void;
}

interface Props {
  itens: ItemDisparo[];
  corIcone: string;
  onOpen: () => void;
}

export default function PainelDisparo({ itens, corIcone, onOpen }: Props) {
  const total = itens.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={total ? `${total} ${total === 1 ? "pendência" : "pendências"}` : "Nada pendente"}
      aria-label={total ? `Abrir ${total} pendências` : "Nada pendente"}
      className="relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
      style={{ color: total ? corIcone : `${corIcone}88` }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${corIcone}1F`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span
        aria-hidden="true"
        className="h-[18px] w-[23px] shrink-0"
        style={{
          backgroundColor: corIcone,
          opacity: total ? 1 : 0.53,
          WebkitMaskImage: "url(/icone-arma-cadastro.png)",
          maskImage: "url(/icone-arma-cadastro.png)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
      {total > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-[4px] text-[9px] font-bold leading-none text-white ring-2 ring-[#0A0A0A]"
          style={{ background: "#8A1224" }}
        >
          {total > 9 ? "9+" : total}
        </span>
      )}
    </button>
  );
}

/* =============================================================================
 * Botão "Disparo" — atalho do rail para o popup guiado já existente.
 *
 * Este componente NÃO cria lista própria nem painel lateral. O portal já tem um
 * padrão para resolver pendências: o PendenciasGuiadasPopup. Aqui só mostramos
 * o contador e abrimos esse fluxo.
 * ============================================================================= */

import { IconBomb } from "@tabler/icons-react";

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
  /** Contador exibido no badge (pendências do checklist guiado). */
  badge?: number;
  /** Realce quando a seção do checklist está aberta (mobile — vira página). */
  active?: boolean;
}

export default function PainelDisparo({ itens, corIcone, onOpen, badge, active = false }: Props) {
  const total = typeof badge === "number" ? badge : itens.length;
  const ativo = total > 0 || itens.length > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={total ? `Checklist guiado — ${total} ${total === 1 ? "pendência" : "pendências"}` : "Checklist guiado"}
      aria-label={total ? `Abrir checklist guiado, ${total} pendências` : "Abrir checklist guiado"}
      className="relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
      style={{ color: ativo ? corIcone : `${corIcone}88`, background: active ? `${corIcone}33` : "transparent" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${corIcone}1F`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? `${corIcone}33` : "transparent"; }}
    >
      <IconBomb
        className="h-[19px] w-[19px] shrink-0"
        stroke={1.6}
        style={{ color: corIcone, opacity: ativo ? 1 : 0.53 }}
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

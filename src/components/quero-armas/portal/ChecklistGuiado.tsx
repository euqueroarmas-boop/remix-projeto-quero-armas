// ============================================================================
// ChecklistGuiado — Orquestrador (camada NOVA, aditiva)
// ----------------------------------------------------------------------------
// Montado UMA vez no portal. Responsável por:
//   1. Abrir o modal quando qualquer <ChecklistGuiadoBotao/> for clicado (bus).
//
// Regra de produto:
// - Pendências podem aparecer na tela, mas o Hub Documental só abre quando o
//   cliente clica em uma pendência clara ou em um botão explícito de envio.
// - Não existe auto-popup por pendência genérica nem por contrato validado.
// ============================================================================

import { useEffect, useState } from "react";
import { onAbrirChecklistGuiado, AbrirChecklistPayload } from "@/lib/quero-armas/checklistGuiadoBus";
import ChecklistGuiadoModal from "./ChecklistGuiadoModal";

interface Props {
  clienteId: number;
  /** chamado quando o assistente altera algo (para recarregar contadores do portal) */
  onUpdated?: () => void;
  /** chamado sempre que o modal abre ou fecha — permite o portal suprimir notificações concorrentes */
  onOpenChange?: (open: boolean) => void;
}

export default function ChecklistGuiado({ clienteId, onUpdated, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [processoIdAlvo, setProcessoIdAlvo] = useState<string | null>(null);
  const [focusDocId, setFocusDocId] = useState<string | null>(null);

  // Sempre abre o Assistente Guiado (com passo a passo explicativo).
  // O Hub Documental só é aberto DENTRO do assistente, quando o cliente
  // clica em "Entregar" em uma exigência específica.
  useEffect(() => {
    const off = onAbrirChecklistGuiado((payload?: AbrirChecklistPayload) => {
      setProcessoIdAlvo(payload?.processoId ?? null);
      setFocusDocId(payload?.focusDocId ?? null);
      setOpen(true);
      onOpenChange?.(true);
    });
    return off;
  }, [clienteId]);

  if (!clienteId) return null;

  return (
    <ChecklistGuiadoModal
        clienteId={clienteId}
        open={open}
        onClose={() => {
          setOpen(false);
          setProcessoIdAlvo(null);
          setFocusDocId(null);
          onOpenChange?.(false);
        }}
        processoIdInicial={processoIdAlvo}
        focusDocIdInicial={focusDocId}
        onUpdated={onUpdated}
    />
  );
}

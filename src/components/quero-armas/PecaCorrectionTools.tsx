import { useEffect, useRef, useState } from "react";
import { GraduationCap, AlertTriangle } from "lucide-react";
import MarcarErroIAModal, { type CorrecaoContext } from "./MarcarErroIAModal";

interface Props {
  /** Visível apenas após a peça gerada (não durante streaming) */
  enabled: boolean;
  /** Contexto vindo da tela de geração — preenche escopo automaticamente */
  context: CorrecaoContext;
}

/**
 * Captura seleção de texto dentro do container da peça gerada
 * (procura `[data-peca-text="true"]`) e exibe:
 *  - botão fixo "Nova correção" sempre visível
 *  - botão flutuante "Marcar como erro" próximo à seleção
 * Ambos abrem o mesmo `MarcarErroIAModal`.
 */
export default function PecaCorrectionTools({ enabled, context }: Props) {
  const [openModal, setOpenModal] = useState(false);
  const [trechoInicial, setTrechoInicial] = useState<string>("");
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<string>("");
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!enabled) {
      setFloatingPos(null);
      setPendingSelection("");
      return;
    }

    function handleSelection() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setFloatingPos(null);
        setPendingSelection("");
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 5) {
        setFloatingPos(null);
        setPendingSelection("");
        return;
      }
      // verificar se o anchor está dentro de um nó marcado como peça
      const anchorNode = sel.anchorNode;
      const container = (anchorNode?.nodeType === 1 ? anchorNode as HTMLElement : anchorNode?.parentElement)?.closest('[data-peca-text="true"]');
      if (!container) {
        setFloatingPos(null);
        setPendingSelection("");
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      // Posicionar botão flutuante acima da seleção
      setFloatingPos({
        x: rect.left + rect.width / 2 + window.scrollX,
        y: rect.top + window.scrollY - 8,
      });
      setPendingSelection(text);
    }

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("touchend", handleSelection);
    document.addEventListener("selectionchange", () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setFloatingPos(null);
      }
    });

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("touchend", handleSelection);
    };
  }, [enabled]);

  if (!enabled) return null;

  const openWithSelection = () => {
    setTrechoInicial(pendingSelection);
    setOpenModal(true);
    setFloatingPos(null);
    // limpa a seleção visual
    window.getSelection()?.removeAllRanges();
  };

  const openEmpty = () => {
    setTrechoInicial("");
    setOpenModal(true);
  };

  return (
    <>
      {/* Barra fixa com botão "Nova correção" */}
      <div className="mt-3 flex items-center justify-between gap-2 p-3 rounded-lg border bg-amber-50/50" style={{ borderColor: "hsl(40 80% 80%)" }}>
        <div className="flex items-start gap-2 text-[11px]" style={{ color: "hsl(35 60% 30%)" }}>
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Encontrou algum trecho errado? <strong>Selecione o texto</strong> para marcar rapidamente, ou clique em "Nova correção" para registrar manualmente. A IA vai aprender e não repetir.
          </span>
        </div>
        <button
          ref={buttonRef}
          onClick={openEmpty}
          className="shrink-0 inline-flex items-center gap-2 h-8 px-3 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors"
          style={{ background: "hsl(35 90% 50%)", color: "white" }}
        >
          <GraduationCap className="h-3.5 w-3.5" /> Nova correção
        </button>
      </div>

      {/* Botão flutuante na seleção */}
      {floatingPos && (
        <button
          onMouseDown={(e) => { e.preventDefault(); openWithSelection(); }}
          onTouchStart={(e) => { e.preventDefault(); openWithSelection(); }}
          className="fixed z-50 -translate-x-1/2 -translate-y-full inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-semibold uppercase tracking-wider shadow-lg transition-all"
          style={{
            left: floatingPos.x,
            top: floatingPos.y,
            background: "hsl(35 90% 50%)",
            color: "white",
          }}
        >
          <GraduationCap className="h-3.5 w-3.5" /> Marcar como erro
        </button>
      )}

      <MarcarErroIAModal
        open={openModal}
        onOpenChange={setOpenModal}
        trechoInicial={trechoInicial}
        context={context}
      />
    </>
  );
}
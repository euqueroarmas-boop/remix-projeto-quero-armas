// ============================================================================
// ChecklistGuiadoBotao — botão para abrir o assistente guiado (camada NOVA)
// ----------------------------------------------------------------------------
// Pode ser colocado em qualquer lugar da Área do Cliente. Apenas dispara o
// "bus"; o modal é controlado pelo orquestrador <ChecklistGuiado/>.
// ============================================================================

import { Wand2 } from "lucide-react";
import { abrirChecklistGuiado } from "@/lib/quero-armas/checklistGuiadoBus";

interface Props {
  /** "full" = botão de destaque; "inline" = link discreto */
  variante?: "full" | "inline";
  rotulo?: string;
  className?: string;
}

export default function ChecklistGuiadoBotao({ variante = "full", rotulo, className }: Props) {
  if (variante === "inline") {
    return (
      <button
        type="button"
        onClick={abrirChecklistGuiado}
        className={`inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-[#7A1F2B] hover:underline ${className ?? ""}`}
      >
        <Wand2 className="h-3.5 w-3.5" /> {rotulo ?? "Enviar documentos com o assistente"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={abrirChecklistGuiado}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-white shadow-sm transition hover:brightness-110 ${className ?? ""}`}
      style={{ background: "#7A1F2B" }}
    >
      <Wand2 className="h-4 w-4" /> {rotulo ?? "Enviar documentos (assistente guiado)"}
    </button>
  );
}

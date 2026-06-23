// ============================================================================
// PortalScopeSelector — segmented control horizontal (Arsenal UI papel/bordô).
// Aparece no topo das abas detalhadas para alternar entre "Todos os processos"
// e cada processo/serviço do cliente.
// ============================================================================

import { useEffect, useRef } from "react";
import { useProcessoFiltro } from "./PortalFilterContext";
import { Layers } from "lucide-react";

interface Props {
  /** Texto curto explicando o efeito do filtro nesta aba. */
  hint?: string;
  className?: string;
}

export default function PortalScopeSelector({ hint, className }: Props) {
  const { scopes, selectedScopeId, setSelectedScopeId } = useProcessoFiltro();
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Garante que o chip ativo fique visível ao trocar de aba/escopo.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const el = track.querySelector<HTMLButtonElement>(`[data-scope-id="${CSS.escape(selectedScopeId)}"]`);
    if (el && typeof el.scrollIntoView === "function") {
      try {
        el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      } catch {
        // Safari antigo: ignora silenciosamente.
      }
    }
  }, [selectedScopeId, scopes]);

  // Sem processos cadastrados → não mostra seletor (apenas "Todos").
  if (!scopes || scopes.length <= 1) return null;

  return (
    <div
      className={`rounded-sm border border-[#E4E4E4] bg-[#FFFFFF] p-3 shadow-sm ${className ?? ""}`}
      role="region"
      aria-label="Filtro de processos"
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Layers className="h-3.5 w-3.5 text-[#6A6A6A]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6A6A6A]">
          FILTRAR POR PROCESSO
        </span>
        {hint ? (
          <span className="sm:ml-auto text-[10px] text-[#8A8A8A] sm:truncate sm:max-w-[60%] normal-case">{hint}</span>
        ) : null}
      </div>
      <div
        ref={trackRef}
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scroll-smooth snap-x snap-mandatory [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Selecionar processo"
      >
        {scopes.map((s) => {
          const active = s.id === selectedScopeId;
          return (
            <button
              key={s.id}
              data-scope-id={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`Filtrar por ${s.label}`}
              onClick={() => setSelectedScopeId(s.id)}
              className={`shrink-0 snap-start inline-flex items-center gap-1.5 rounded-sm border px-3 min-h-9 h-9 text-[11px] font-bold uppercase tracking-wider transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-1 ${
                active
                  ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                  : "bg-[#FAFAFA] text-[#0A0A0A] border-[#E4E4E4] hover:border-[#0A0A0A]"
              }`}
              title={s.label}
            >
              <span className="max-w-[60vw] sm:max-w-[200px] truncate">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
// ============================================================================
// PortalScopeSelector — segmented control horizontal (Arsenal UI papel/bordô).
// Aparece no topo das abas detalhadas para alternar entre "Todos os processos"
// e cada processo/serviço do cliente.
// ============================================================================

import { useProcessoFiltro } from "./PortalFilterContext";
import { Layers } from "lucide-react";

interface Props {
  /** Texto curto explicando o efeito do filtro nesta aba. */
  hint?: string;
  className?: string;
}

export default function PortalScopeSelector({ hint, className }: Props) {
  const { scopes, selectedScopeId, setSelectedScopeId } = useProcessoFiltro();

  // Sem processos cadastrados → não mostra seletor (apenas "Todos").
  if (!scopes || scopes.length <= 1) return null;

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Layers className="h-3.5 w-3.5 text-[#7A1F2B]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
          Filtrar por processo
        </span>
        {hint ? (
          <span className="ml-auto text-[10px] text-slate-400 truncate">{hint}</span>
        ) : null}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {scopes.map((s) => {
          const active = s.id === selectedScopeId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedScopeId(s.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 h-8 text-[11px] font-bold uppercase tracking-wider transition ${
                active
                  ? "bg-[#7A1F2B] text-white border-[#7A1F2B] shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:border-[#7A1F2B]/40 hover:text-[#7A1F2B]"
              }`}
              title={s.label}
            >
              <span className="max-w-[180px] truncate">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
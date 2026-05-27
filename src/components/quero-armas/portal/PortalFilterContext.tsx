// ============================================================================
// PortalFilterContext — filtro multi-processo do Portal do Cliente (aditivo).
// ----------------------------------------------------------------------------
// Provider local, montado em QAClientePortalPage. Ninguém é obrigado a usar:
// componentes que ainda não foram migrados continuam ignorando o filtro.
// Quando uma aba de detalhe (Pendências / Processos / Financeiro / Documentos /
// Contratos) for refatorada (Fase 3), basta consumir `useProcessoFiltro()`.
// ============================================================================

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ProcessoFiltroValor = "todos" | string;

export interface ProcessoOpcaoFiltro {
  id: string;
  label: string;
}

interface PortalFilterContextValue {
  /** "todos" ou o id do processo selecionado */
  processoSelecionado: ProcessoFiltroValor;
  setProcessoSelecionado: (v: ProcessoFiltroValor) => void;
  /** opções renderizadas no segmented control de cada aba detalhada */
  opcoes: ProcessoOpcaoFiltro[];
  setOpcoes: (opcoes: ProcessoOpcaoFiltro[]) => void;
}

const Ctx = createContext<PortalFilterContextValue | null>(null);

export function PortalFilterProvider({ children }: { children: ReactNode }) {
  const [processoSelecionado, setProcessoSelecionado] = useState<ProcessoFiltroValor>("todos");
  const [opcoes, setOpcoes] = useState<ProcessoOpcaoFiltro[]>([]);
  const value = useMemo(
    () => ({ processoSelecionado, setProcessoSelecionado, opcoes, setOpcoes }),
    [processoSelecionado, opcoes],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProcessoFiltro(): PortalFilterContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fallback inerte — permite componentes serem usados fora do provider sem crashar.
    return {
      processoSelecionado: "todos",
      setProcessoSelecionado: () => {},
      opcoes: [],
      setOpcoes: () => {},
    };
  }
  return ctx;
}
// ============================================================================
// PortalFilterContext — filtro multi-processo/serviço do Portal do Cliente.
// ----------------------------------------------------------------------------
// Fase 3: provider passa a aceitar `scopes` controlados de fora (a página
// monta os escopos a partir de qa_processos). Mantém API antiga
// (`processoSelecionado`/`setProcessoSelecionado`) como alias para zero
// regressão.
// ============================================================================

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ProcessoFiltroValor = "todos" | string;

export interface ProcessoOpcaoFiltro {
  id: string;
  label: string;
}

export interface PortalScope {
  id: string;                       // "todos" ou processo.id
  label: string;
  type: "todos" | "processo" | "servico" | "venda";
  processoId?: string | null;
  vendaId?: number | null;
  serviceSlug?: string | null;
  serviceName?: string | null;
}

interface PortalFilterContextValue {
  // novo (Fase 3)
  selectedScopeId: string;
  setSelectedScopeId: (id: string) => void;
  scopes: PortalScope[];
  scope: PortalScope;               // escopo resolvido (fallback = "todos")
  // compat (Fases 1/2)
  processoSelecionado: ProcessoFiltroValor;
  setProcessoSelecionado: (v: ProcessoFiltroValor) => void;
  opcoes: ProcessoOpcaoFiltro[];
  setOpcoes: (opcoes: ProcessoOpcaoFiltro[]) => void;
}

const TODOS_SCOPE: PortalScope = { id: "todos", label: "Todos os processos", type: "todos" };

const Ctx = createContext<PortalFilterContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  scopes?: PortalScope[];
  selectedScopeId?: string;
  onScopeChange?: (id: string) => void;
}

export function PortalFilterProvider({ children, scopes, selectedScopeId, onScopeChange }: ProviderProps) {
  const [internalSelected, setInternalSelected] = useState<string>("todos");
  const [internalOpcoes, setInternalOpcoes] = useState<ProcessoOpcaoFiltro[]>([]);

  const isControlled = typeof selectedScopeId === "string";
  const currentSelected = isControlled ? (selectedScopeId as string) : internalSelected;

  const setSelected = (id: string) => {
    if (!isControlled) setInternalSelected(id);
    onScopeChange?.(id);
  };

  const resolvedScopes = useMemo<PortalScope[]>(() => {
    const base = scopes && scopes.length > 0 ? scopes : [];
    const hasTodos = base.some((s) => s.id === "todos");
    return hasTodos ? base : [TODOS_SCOPE, ...base];
  }, [scopes]);

  const scope = useMemo<PortalScope>(
    () => resolvedScopes.find((s) => s.id === currentSelected) || TODOS_SCOPE,
    [resolvedScopes, currentSelected],
  );

  const value = useMemo<PortalFilterContextValue>(
    () => ({
      selectedScopeId: currentSelected,
      setSelectedScopeId: setSelected,
      scopes: resolvedScopes,
      scope,
      processoSelecionado: currentSelected,
      setProcessoSelecionado: setSelected,
      opcoes: internalOpcoes,
      setOpcoes: setInternalOpcoes,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentSelected, resolvedScopes, scope, internalOpcoes],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProcessoFiltro(): PortalFilterContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fallback inerte — componentes usados fora do provider não crasham.
    return {
      selectedScopeId: "todos",
      setSelectedScopeId: () => {},
      scopes: [TODOS_SCOPE],
      scope: TODOS_SCOPE,
      processoSelecionado: "todos",
      setProcessoSelecionado: () => {},
      opcoes: [],
      setOpcoes: () => {},
    };
  }
  return ctx;
}
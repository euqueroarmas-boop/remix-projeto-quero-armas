import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Tema do admin Quero Armas (claro / noturno).
 *
 * A classe `qa-noite` é aplicada no <html> para que também alcance os portais
 * do Radix (Dialog, Popover, Select), que renderizam fora da árvore do layout.
 * Ela é removida ao desmontar o layout admin, então a área do cliente e o site
 * público nunca herdam o modo noturno.
 */

export const QA_TEMA_LS = "qa_admin_tema";

type Tema = "claro" | "noite";

type Ctx = { tema: Tema; noturno: boolean; alternar: () => void };

const QATemaCtx = createContext<Ctx>({ tema: "claro", noturno: false, alternar: () => {} });

export function lerTemaSalvo(): Tema {
  try {
    const v = localStorage.getItem(QA_TEMA_LS);
    if (v === "noite" || v === "claro") return v;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "noite" : "claro";
  } catch {
    return "claro";
  }
}

export function QATemaProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => (typeof window === "undefined" ? "claro" : lerTemaSalvo()));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("qa-noite", tema === "noite");
    try { localStorage.setItem(QA_TEMA_LS, tema); } catch { /* storage bloqueado */ }
    return () => { root.classList.remove("qa-noite"); };
  }, [tema]);

  const alternar = useCallback(() => setTema((t) => (t === "noite" ? "claro" : "noite")), []);

  const value = useMemo<Ctx>(() => ({ tema, noturno: tema === "noite", alternar }), [tema, alternar]);

  return <QATemaCtx.Provider value={value}>{children}</QATemaCtx.Provider>;
}

export function useQATema() {
  return useContext(QATemaCtx);
}
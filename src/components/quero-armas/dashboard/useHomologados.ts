/**
 * useHomologados — validação visual local (apenas localStorage).
 * Permite marcar/desmarcar itens como "homologados" para inspeção
 * de confiabilidade do banco. Não altera nenhum dado remoto.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "qa:homologados:v1";

function read(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((n) => typeof n === "number"));
  } catch {
    return new Set();
  }
}

function write(s: Set<number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(s)));
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function useHomologados() {
  const [set, setSet] = useState<Set<number>>(() => read());

  // Sincroniza entre abas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSet(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isHomologado = useCallback(
    (itemIds: number[]) => itemIds.length > 0 && itemIds.every((id) => set.has(id)),
    [set],
  );

  const toggle = useCallback((itemIds: number[]) => {
    setSet((prev) => {
      const next = new Set(prev);
      const allIn = itemIds.every((id) => next.has(id));
      if (allIn) itemIds.forEach((id) => next.delete(id));
      else itemIds.forEach((id) => next.add(id));
      write(next);
      return next;
    });
  }, []);

  return { isHomologado, toggle, homologadosSet: set };
}

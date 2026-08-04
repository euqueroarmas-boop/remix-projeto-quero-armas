import { useCallback, useEffect, useRef } from "react";

/**
 * Permite arrastar horizontalmente um container com overflow-x:
 * - Desktop: clicar, segurar e puxar com o cursor (esquerda <-> direita)
 * - Mobile: swipe nativo do navegador (touch-action: pan-x)
 * Cliques normais continuam funcionando (só bloqueia se houve arrasto real).
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const state = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // deixa o scroll nativo cuidar
      state.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
      el.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!state.current.down) return;
      const dx = e.clientX - state.current.startX;
      if (Math.abs(dx) > 3) state.current.moved = true;
      el.scrollLeft = state.current.startScroll - dx;
    };
    const end = () => {
      if (!state.current.down) return;
      state.current.down = false;
      el.style.cursor = "grab";
      // libera o clique no próximo tick
      setTimeout(() => { state.current.moved = false; }, 0);
    };
    const onClickCapture = (e: MouseEvent) => {
      if (state.current.moved) { e.preventDefault(); e.stopPropagation(); }
    };

    el.style.cursor = "grab";
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  /** Rola a aba ativa para dentro da área visível. */
  const scrollActiveIntoView = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const active = el.querySelector('[data-state="active"]') as HTMLElement | null;
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, []);

  return { ref, scrollActiveIntoView };
}

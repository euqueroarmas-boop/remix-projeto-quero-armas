import { useEffect } from "react";

/**
 * Gesto da gaveta do menu no celular:
 *   • dedo da borda esquerda para a direita  → abre
 *   • dedo para a esquerda com ela aberta    → fecha
 *
 * Só vale em tela pequena (o desktop tem a coluna fixa) e é ignorado quando o
 * gesto começa dentro de algo que rola na horizontal — tabela larga, faixa de
 * chips — senão o arrasto do menu roubaria a rolagem daquele elemento.
 *
 * Observação sobre o iPhone: a mesma faixa da borda é onde o Safari escuta o
 * "voltar". Por isso a zona de partida vai um pouco para dentro da tela e o
 * movimento horizontal é cancelado (preventDefault) assim que fica claro que o
 * gesto é do menu.
 */
export function useGestoGaveta(aberta: boolean, definir: (v: boolean) => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;

    /** De onde o gesto de abrir pode partir (px a partir da borda esquerda). */
    const zonaBorda = Math.max(40, Math.round(window.innerWidth * 0.14));
    /** O quanto o dedo precisa andar para valer. */
    const distancia = 70;
    /** A partir daqui o movimento é considerado horizontal. */
    const limiar = 12;

    let x0 = 0;
    let y0 = 0;
    let valendo = false;
    let horizontal = false;

    const rolaNaHorizontal = (alvo: EventTarget | null) => {
      let el = alvo instanceof Element ? (alvo as HTMLElement) : null;
      while (el && el !== document.body) {
        if (el.scrollWidth > el.clientWidth + 4) {
          const eixo = getComputedStyle(el).overflowX;
          if (eixo === "auto" || eixo === "scroll") return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const inicio = (e: TouchEvent) => {
      valendo = false;
      horizontal = false;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      x0 = t.clientX;
      y0 = t.clientY;
      if (rolaNaHorizontal(e.target)) return;
      valendo = aberta || t.clientX <= zonaBorda;
    };

    const move = (e: TouchEvent) => {
      if (!valendo) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (!horizontal) {
        // Rolagem vertical: o gesto não é nosso, sai de cena.
        if (Math.abs(dy) > limiar && Math.abs(dy) >= Math.abs(dx)) {
          valendo = false;
          return;
        }
        if (Math.abs(dx) > limiar && Math.abs(dx) > Math.abs(dy)) horizontal = true;
      }
      // Enquanto o gesto é do menu, segura a rolagem e o "voltar" do navegador.
      if (horizontal && e.cancelable) e.preventDefault();
    };

    const fim = (e: TouchEvent) => {
      if (!valendo) return;
      valendo = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (!aberta && dx >= distancia) definir(true);
      else if (aberta && dx <= -distancia) definir(false);
    };

    const cancelar = () => { valendo = false; };

    document.addEventListener("touchstart", inicio, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", fim, { passive: true });
    document.addEventListener("touchcancel", cancelar, { passive: true });
    return () => {
      document.removeEventListener("touchstart", inicio);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", fim);
      document.removeEventListener("touchcancel", cancelar);
    };
  }, [aberta, definir]);
}

export default useGestoGaveta;

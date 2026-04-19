import { useEffect, useRef, useState, ReactNode } from "react";

/**
 * Renderiza children apenas quando o placeholder entra na viewport.
 * Usado para diferir widgets pesados do dashboard até o usuário rolar
 * até eles, mantendo o pós-login leve em mobile/iPhone.
 */
interface Props {
  children: ReactNode;
  /** Altura mínima do placeholder para reservar espaço no layout */
  minHeight?: number;
  /** Margem para começar a carregar antes de entrar na tela */
  rootMargin?: string;
  /** Fallback enquanto não carregou */
  fallback?: ReactNode;
}

export function LazyOnVisible({
  children,
  minHeight = 120,
  rootMargin = "200px",
  fallback = null,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={{ minHeight: visible ? undefined : minHeight }}>
      {visible ? children : fallback}
    </div>
  );
}

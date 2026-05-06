/**
 * useArsenalCardSize
 *
 * Hook compartilhado pelos cards de CRAF, GTE e AUTORIZAÇÕES no Arsenal.
 * Permite ao cliente escolher entre 3 tamanhos de card: grande (padrão),
 * médio e pequeno. A preferência é persistida em localStorage para
 * sobreviver ao próximo login.
 *
 * Mantemos uma única chave global para o cliente — quando ele muda o
 * tamanho num bloco, todos os blocos do Arsenal acompanham.
 */
import { useCallback, useEffect, useState } from "react";

export type ArsenalCardSize = "lg" | "md" | "sm";

const STORAGE_KEY = "qa_arsenal_card_size";
const DEFAULT_SIZE: ArsenalCardSize = "lg";

const isValid = (v: unknown): v is ArsenalCardSize =>
  v === "lg" || v === "md" || v === "sm";

function readStored(): ArsenalCardSize {
  if (typeof window === "undefined") return DEFAULT_SIZE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isValid(raw) ? raw : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

export function useArsenalCardSize() {
  const [size, setSizeState] = useState<ArsenalCardSize>(() => readStored());

  // Sincroniza com mudanças vindas de outros blocos / abas.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isValid(e.newValue)) {
        setSizeState(e.newValue);
      }
    };
    const onCustom = (e: Event) => {
      const next = (e as CustomEvent<ArsenalCardSize>).detail;
      if (isValid(next)) setSizeState(next);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("qa-arsenal-card-size", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("qa-arsenal-card-size", onCustom as EventListener);
    };
  }, []);

  const setSize = useCallback((next: ArsenalCardSize) => {
    setSizeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent("qa-arsenal-card-size", { detail: next }));
    } catch {
      // ignora storage indisponível
    }
  }, []);

  return { size, setSize };
}

/** Classes utilitárias por tamanho — aplicadas ao <li> de cada card. */
export const SIZE_CLASSES: Record<ArsenalCardSize, {
  row: string;
  title: string;
  meta: string;
  iconBox: string;
  badge: string;
}> = {
  lg: {
    row: "px-3 py-3 text-[12px]",
    title: "text-[12px]",
    meta: "text-[10px]",
    iconBox: "h-4 w-4",
    badge: "text-[9px] px-2 py-[1px]",
  },
  md: {
    row: "px-2.5 py-2 text-[11px]",
    title: "text-[11px]",
    meta: "text-[9.5px]",
    iconBox: "h-3.5 w-3.5",
    badge: "text-[8.5px] px-1.5 py-[1px]",
  },
  sm: {
    row: "px-2 py-1.5 text-[10px]",
    title: "text-[10px]",
    meta: "text-[9px]",
    iconBox: "h-3 w-3",
    badge: "text-[8px] px-1 py-[1px]",
  },
};

/**
 * Cor da borda lateral que destaca a urgência do card.
 * Usa as mesmas cores semânticas dos badges (TONE_FG) para reforço visual.
 */
export const TONE_BORDER: Record<"ok" | "warn" | "danger" | "muted", string> = {
  ok: "hsl(142 70% 38%)",
  warn: "hsl(38 92% 45%)",
  danger: "hsl(0 78% 50%)",
  muted: "hsl(220 13% 80%)",
};

/** Tom de fundo bem suave para reforçar o status sem poluir a leitura. */
export const TONE_ROW_BG: Record<"ok" | "warn" | "danger" | "muted", string> = {
  ok: "hsl(142 70% 45% / 0.05)",
  warn: "hsl(38 92% 50% / 0.07)",
  danger: "hsl(0 78% 55% / 0.07)",
  muted: "transparent",
};

interface ToggleProps {
  size: ArsenalCardSize;
  onChange: (s: ArsenalCardSize) => void;
}

/**
 * Botões compactos para alternar o tamanho dos cards. Aparecem no header
 * de cada bloco (CRAF, GTE, Autorizações) — clicar em qualquer um afeta
 * todos os blocos e persiste a escolha.
 */
export function ArsenalCardSizeToggle({ size, onChange }: ToggleProps) {
  const opts: { v: ArsenalCardSize; label: string; title: string }[] = [
    { v: "lg", label: "G", title: "Cards grandes" },
    { v: "md", label: "M", title: "Cards médios" },
    { v: "sm", label: "P", title: "Cards pequenos" },
  ];
  return (
    <div
      role="group"
      aria-label="Tamanho dos cards"
      className="inline-flex items-center overflow-hidden rounded-md border border-slate-200 bg-white"
    >
      {opts.map((o) => {
        const active = o.v === size;
        return (
          <button
            key={o.v}
            type="button"
            title={o.title}
            aria-pressed={active}
            onClick={() => onChange(o.v)}
            className={
              "px-2 py-[3px] text-[10px] font-bold uppercase tracking-wider transition-colors " +
              (active
                ? "bg-[#7A1F2B] text-white"
                : "text-slate-600 hover:bg-slate-50")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
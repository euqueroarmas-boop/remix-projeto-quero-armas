/**
 * Classes utilitárias para tornar DialogContent (shadcn) mobile-safe no Quero Armas.
 * - Limita altura a 90dvh (suporta barras dinâmicas no iOS Safari).
 * - Permite scroll interno suave (-webkit-overflow-scrolling: touch via Tailwind overflow-y-auto).
 * - Respeita safe-area do iPhone (notch e home indicator).
 * - Mantém largura total em telas pequenas.
 *
 * Uso:
 *   <DialogContent className={qaDialogMobile()}> ... </DialogContent>
 *
 * Para rodapé fixo dentro do modal:
 *   <DialogFooter className={qaDialogFooterSticky()}>
 */

export function qaDialogMobile(extra?: string) {
  return [
    // tamanho responsivo
    "max-h-[90dvh] w-[calc(100%-1rem)] sm:w-full",
    // scroll interno + safe-area
    "overflow-y-auto overscroll-contain",
    "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
    "pt-[max(1.5rem,env(safe-area-inset-top))]",
    extra || "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function qaDialogFooterSticky(extra?: string) {
  return [
    "sticky bottom-0 -mx-6 px-6 py-3",
    "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
    "border-t border-border",
    "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
    extra || "",
  ]
    .filter(Boolean)
    .join(" ");
}
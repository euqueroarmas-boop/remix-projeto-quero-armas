type CheckoutGuiadoOptions = {
  origem: string;
  servicoConfirmado?: boolean;
  retomar?: boolean;
  perfilV2?: string | null;
  subperfilV2?: string | null;
  extra?: Record<string, string | null | undefined>;
};

export const CHECKOUT_GUIADO_DESIGN_NAME = "Checkout Guiado Dark Premium Quero Armas";

export function buildCheckoutGuiadoUrl(
  slugs: string | string[],
  options: CheckoutGuiadoOptions,
) {
  const list = Array.isArray(slugs) ? slugs : [slugs];
  const normalizedSlugs = list
    .map((slug) => String(slug || "").trim())
    .filter(Boolean)
    .join(",");

  const params = new URLSearchParams();
  if (normalizedSlugs) params.set("servico", normalizedSlugs);
  params.set("origem", options.origem);
  if (options.servicoConfirmado) params.set("servico_confirmado", "1");
  if (options.retomar) params.set("retomar", "1");
  if (options.perfilV2) params.set("perfil_v2", options.perfilV2);
  if (options.subperfilV2) params.set("subperfil_v2", options.subperfilV2);
  if (options.extra) {
    Object.entries(options.extra).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
  }

  return `/cadastro?${params.toString()}`;
}

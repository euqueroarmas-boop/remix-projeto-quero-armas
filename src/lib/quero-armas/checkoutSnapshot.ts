/**
 * Helpers puros usados pela UI de checkout Quero Armas.
 *
 * O snapshot canônico é produzido SERVER-SIDE pela edge function
 * `qa-checkout-criar-venda`; aqui ficam apenas utilitários determinísticos
 * para o frontend exibir/conferir o carrinho.
 */

export interface CartLine {
  service_id: string;
  service_slug: string;
  service_name: string;
  unit_price_cents: number;
  quantity: number;
}

export interface SnapshotLine {
  service_id: string;
  service_slug: string;
  service_name: string;
  unit_price_cents: number;
  quantity: number;
  subtotal_cents: number;
}

export function snapshotCart(items: CartLine[]): {
  lines: SnapshotLine[];
  total_cents: number;
} {
  const lines = items.map((i) => ({
    service_id: i.service_id,
    service_slug: i.service_slug,
    service_name: i.service_name,
    unit_price_cents: i.unit_price_cents,
    quantity: Math.max(1, i.quantity | 0),
    subtotal_cents: Math.max(1, i.quantity | 0) * i.unit_price_cents,
  }));
  const total_cents = lines.reduce((acc, l) => acc + l.subtotal_cents, 0);
  return { lines, total_cents };
}

/**
 * Garante que o snapshot capturado no momento da compra independe
 * de variações futuras do catálogo. Compara duas versões de catálogo
 * (no momento da compra vs. agora) e devolve o subtotal CONGELADO.
 */
export function frozenSubtotal(
  snapshotUnitCents: number,
  quantity: number,
  _catalogPriceNow: number,
): number {
  // Sempre usa o snapshot — o preço atual do catálogo é IRRELEVANTE.
  return snapshotUnitCents * Math.max(1, quantity | 0);
}

export function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

export function isValidCPF(cpf: string): boolean {
  const c = onlyDigits(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  return true;
}

export function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || "");
}

export function isValidIdentificacao(input: {
  nome_completo?: string;
  cpf?: string;
  email?: string;
  celular?: string;
}): boolean {
  const nome = (input.nome_completo || "").trim();
  const cel = onlyDigits(input.celular);
  return (
    nome.length >= 3 &&
    isValidCPF(input.cpf || "") &&
    isValidEmail(input.email || "") &&
    cel.length >= 10
  );
}
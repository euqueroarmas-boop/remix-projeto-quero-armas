import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/shared/cart/CartProvider';
import { formatBRL } from '@/shared/lib/formatters';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const CartPage = () => {
  const { items, totalCents, updateQuantity, removeItem, revalidate } = useCart();
  const navigate = useNavigate();
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    document.title = 'Carrinho | Quero Armas';
    revalidate()
      .then(({ removed, updated }) => {
        if (removed.length) toast.warning(`Removidos: ${removed.join(', ')}`);
        if (updated.length) toast.info(`Preços atualizados: ${updated.join(', ')}`);
      })
      .catch(() => undefined)
      .finally(() => setValidating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SiteShell>
      <section className="container py-10 sm:py-14">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">Carrinho</h1>
        {validating && <p className="mt-4 text-sm text-muted-foreground">Validando itens...</p>}
        {items.length === 0 ? (
          <div className="mt-10 rounded-sm border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">Seu carrinho está vazio.</p>
            <Button asChild className="mt-6"><Link to="/servicos">Ver serviços</Link></Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.service_id} className="flex flex-col gap-3 rounded-sm border border-border bg-surface-elevated p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link to={`/servicos/${item.service_slug}`} className="font-heading text-sm uppercase tracking-wide hover:text-accent">
                      {item.service_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatBRL(item.unit_price_cents)} un.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input type="number" min={1} value={item.quantity}
                      onChange={(e) => updateQuantity(item.service_id, Math.max(1, Number(e.target.value) || 1))}
                      className="w-20" />
                    <p className="w-24 text-right font-heading font-semibold text-accent">{formatBRL(item.unit_price_cents * item.quantity)}</p>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.service_id)} aria-label="Remover">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="h-fit rounded-sm border border-border bg-surface-elevated p-6">
              <h2 className="font-heading text-sm uppercase tracking-widest text-accent">Resumo</h2>
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatBRL(totalCents)}</span>
              </div>
              <div className="mt-2 flex justify-between font-heading text-lg font-bold">
                <span>Total</span>
                <span className="text-accent">{formatBRL(totalCents)}</span>
              </div>
              <Button className="mt-6 w-full" size="lg" onClick={() => navigate('/checkout')}>Ir para checkout</Button>
            </aside>
          </div>
        )}
      </section>
    </SiteShell>
  );
};

export default CartPage;
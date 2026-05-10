import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Trash2,
  ShoppingCart,
  Sparkles,
  Headphones,
  MapPin,
  Lock,
  UserCheck,
} from 'lucide-react';

import SiteShell from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/shared/cart/CartProvider';
import { formatBRL } from '@/shared/lib/formatters';
import { useToast } from '@/hooks/use-toast';

const TRUST_ITEMS = [
  { icon: MapPin, label: 'Atendimento nacional' },
  { icon: ShieldCheck, label: 'Processo legal estruturado' },
  { icon: UserCheck, label: 'Portal do cliente incluso' },
  { icon: Headphones, label: 'Acompanhamento especializado' },
  { icon: Lock, label: 'Compra segura' },
];

export default function CarrinhoPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { items, totalCents, itemCount, removeItem, clear } = useCart();

  const primaryItem = items[0];
  const checkoutSlug = primaryItem?.service_slug ?? '';

  const subtotalCents = useMemo(
    () => items.reduce((acc, i) => acc + i.unit_price_cents * i.quantity, 0),
    [items],
  );

  const handleRemove = (id: string, name: string) => {
    removeItem(id);
    toast({ title: 'Item removido', description: `${name} foi removido do carrinho.` });
  };

  const handleClear = () => {
    clear();
    toast({ title: 'Carrinho esvaziado' });
  };

  const handleCheckout = () => {
    if (!checkoutSlug) return;
    navigate(`/area-do-cliente/contratar/${checkoutSlug}/identificar`);
  };

  if (itemCount === 0) {
    return (
      <SiteShell>
        <section className="relative overflow-hidden border-b border-border bg-background">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(var(--accent)/0.18),transparent_55%),radial-gradient(circle_at_80%_70%,hsl(var(--accent)/0.08),transparent_60%)]"
          />
          <div className="container relative flex flex-col items-center justify-center py-20 text-center sm:py-28">
            <div className="flex size-20 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
              <ShoppingCart className="size-9" />
            </div>
            <h1 className="mt-6 font-heading text-3xl font-bold uppercase tracking-tight sm:text-5xl">
              Seu carrinho está vazio
            </h1>
            <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
              Escolha um serviço e comece agora sua jornada com a Quero Armas.
            </p>
            <Button asChild size="lg" className="mt-8 font-heading uppercase tracking-wide">
              <Link to="/servicos">
                Ver serviços <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      {/* HERO MINI */}
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,hsl(var(--accent)/0.18),transparent_55%),radial-gradient(circle_at_80%_70%,hsl(var(--accent)/0.08),transparent_60%)]"
        />
        <div className="container relative py-12 sm:py-16">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.3em] text-accent">
            Carrinho
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-bold uppercase leading-[1.05] tracking-tight sm:text-5xl">
            Você está a um passo de começar seu processo
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Revise sua contratação e finalize com segurança. Assim que o pagamento for confirmado,
            sua jornada com a Quero Armas começa.
          </p>
        </div>
      </section>

      {/* CONTEÚDO */}
      <section className="bg-background">
        <div className="container grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1.5fr_1fr] lg:py-14">
          {/* COLUNA ESQUERDA — ITENS */}
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-bold uppercase tracking-wide sm:text-xl">
                Resumo do serviço
              </h2>
              <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent">
                <Sparkles className="mr-1.5 size-3" /> Catálogo oficial
              </Badge>
            </div>
            <p className="-mt-3 text-xs text-muted-foreground">
              Preço sincronizado com o catálogo oficial da Quero Armas.
            </p>

            <ul className="space-y-4">
              {items.map((item) => {
                const subtotal = item.unit_price_cents * item.quantity;
                return (
                  <li
                    key={item.service_id}
                    className="rounded-sm border border-border bg-surface-elevated/40 p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                          {item.service_slug}
                        </p>
                        <h3 className="mt-1 font-heading text-lg font-bold uppercase leading-tight tracking-tight sm:text-xl">
                          {item.service_name}
                        </h3>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>
                            Unitário:{' '}
                            <strong className="text-foreground">
                              {formatBRL(item.unit_price_cents)}
                            </strong>
                          </span>
                          <span>
                            Quantidade: <strong className="text-foreground">{item.quantity}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-start">
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Subtotal
                          </p>
                          <p className="font-heading text-2xl font-bold text-accent">
                            {formatBRL(subtotal)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(item.service_id, item.service_name)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="mr-1.5 size-4" /> Remover
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button asChild variant="outline" className="font-heading uppercase tracking-wide">
                <Link to="/servicos">Continuar comprando</Link>
              </Button>
              <Button
                variant="ghost"
                onClick={handleClear}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="mr-1.5 size-4" /> Limpar carrinho
              </Button>
            </div>
          </div>

          {/* COLUNA DIREITA — CONFIANÇA + FINANCEIRO */}
          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            {/* Resumo financeiro */}
            <div className="relative overflow-hidden rounded-sm border border-accent/30 bg-surface-elevated/60 p-6 shadow-tactical">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,hsl(var(--accent)/0.18),transparent_60%)]"
              />
              <div className="relative">
                <p className="font-heading text-xs font-bold uppercase tracking-[0.3em] text-accent">
                  Resumo da contratação
                </p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-medium">{formatBRL(subtotalCents)}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className="font-heading text-sm font-bold uppercase tracking-wide">
                    Total
                  </span>
                  <span className="font-heading text-3xl font-bold text-accent">
                    {formatBRL(totalCents)}
                  </span>
                </div>
                <Button
                  size="lg"
                  onClick={handleCheckout}
                  disabled={!checkoutSlug}
                  className="mt-5 w-full font-heading text-base uppercase tracking-wide"
                >
                  Finalizar contratação <ArrowRight className="ml-2 size-4" />
                </Button>
                <p className="mt-3 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Lock className="mr-1 inline size-3" /> Ambiente seguro
                </p>
              </div>
            </div>

            {/* Provas de confiança */}
            <div className="rounded-sm border border-border bg-surface-elevated/40 p-6">
              <p className="font-heading text-xs font-bold uppercase tracking-[0.3em] text-accent">
                Por que com a Quero Armas
              </p>
              <ul className="mt-4 space-y-3">
                {TRUST_ITEMS.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-accent/40 bg-accent/10 text-accent">
                      <Icon className="size-4" />
                    </span>
                    <span className="font-medium">{label}</span>
                    <CheckCircle2 className="ml-auto size-4 text-accent" />
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </SiteShell>
  );
}
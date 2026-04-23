import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/shared/cart/CartProvider';
import { useAuth } from '@/shared/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { formatBRL } from '@/shared/lib/formatters';
import { runCheckout } from '@/shared/checkout/checkoutService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ProfileMin { full_name: string | null; cpf: string | null; }

const CheckoutPage = () => {
  const { items, totalCents, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileMin | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Checkout | Quero Armas';
    if (!user) return;
    supabase
      .from('profiles' as any)
      .select('full_name, cpf')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: any) => setProfile((data as ProfileMin) ?? { full_name: null, cpf: null }));
  }, [user]);

  if (items.length === 0) {
    return (
      <SiteShell>
        <div className="container py-20 text-center">
          <h1 className="font-heading text-2xl uppercase">Nada para pagar</h1>
          <p className="mt-3 text-muted-foreground">Seu carrinho está vazio.</p>
          <Button asChild className="mt-6"><Link to="/servicos">Ver serviços</Link></Button>
        </div>
      </SiteShell>
    );
  }

  const handleSubmit = async () => {
    if (!user) return;
    if (!accepted) { toast.error('Aceite o termo comercial para continuar.'); return; }
    setSubmitting(true);
    try {
      const result = await runCheckout({
        userId: user.id,
        customer: {
          name: profile?.full_name ?? (user.user_metadata as any)?.full_name ?? null,
          email: user.email ?? '',
          cpf: profile?.cpf ?? null,
        },
        items,
        notes: notes || undefined,
        termsAccepted: accepted,
      });
      clear();
      if (result.redirectUrl) { window.location.href = result.redirectUrl; return; }
      navigate(`/checkout/sucesso?order=${result.orderNumber}&status=${result.paymentStatus}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao processar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SiteShell>
      <section className="container py-10 sm:py-14">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">Checkout</h1>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <div className="rounded-sm border border-border bg-surface-elevated p-6">
              <h2 className="font-heading text-sm uppercase tracking-widest text-accent">Seus dados</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs uppercase text-muted-foreground">Nome</dt><dd>{profile?.full_name ?? '—'}</dd></div>
                <div><dt className="text-xs uppercase text-muted-foreground">E-mail</dt><dd className="break-all">{user?.email}</dd></div>
                <div><dt className="text-xs uppercase text-muted-foreground">CPF</dt><dd>{profile?.cpf ?? '—'}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Atualize seus dados no <Link to="/quero-armas/area-do-cliente" className="text-accent hover:underline">portal</Link>.
              </p>
            </div>
            <div className="rounded-sm border border-border bg-surface-elevated p-6">
              <h2 className="font-heading text-sm uppercase tracking-widest text-accent">Observações (opcional)</h2>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Inclua qualquer informação útil para o atendimento." className="mt-3" />
            </div>
            <div className="rounded-sm border border-border bg-surface-elevated p-6">
              <h2 className="font-heading text-sm uppercase tracking-widest text-accent">Termo Comercial</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Declaro estar ciente de que o serviço contratado consiste em assessoria documental, sem garantia de deferimento por parte dos órgãos competentes. O contrato formal completo será disponibilizado após a confirmação do pagamento.
              </p>
              <label className="mt-4 flex items-start gap-3 text-sm">
                <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(Boolean(v))} className="mt-0.5" />
                <span>Li e aceito o termo comercial e o resumo do pedido acima.</span>
              </label>
            </div>
          </div>
          <aside className="h-fit rounded-sm border border-border bg-surface-elevated p-6">
            <h2 className="font-heading text-sm uppercase tracking-widest text-accent">Pedido</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {items.map((i) => (
                <li key={i.service_id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{i.quantity}× {i.service_name}</span>
                  <span>{formatBRL(i.unit_price_cents * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-border pt-4 font-heading text-lg font-bold">
              <span>Total</span>
              <span className="text-accent">{formatBRL(totalCents)}</span>
            </div>
            <Button className="mt-6 w-full" size="lg" onClick={handleSubmit} disabled={submitting || !accepted}>
              {submitting ? <><Loader2 className="mr-2 size-4 animate-spin" /> Processando...</> : 'Confirmar pedido'}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Nenhum gateway de pagamento está conectado nesta etapa. O pedido será criado e ficará aguardando o provider real ser configurado.
            </p>
          </aside>
        </div>
      </section>
    </SiteShell>
  );
};

export default CheckoutPage;
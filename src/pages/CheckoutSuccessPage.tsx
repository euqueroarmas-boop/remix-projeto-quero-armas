import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, FileText, ListChecks, ArrowRight } from 'lucide-react';

const CheckoutSuccessPage = () => {
  const [params] = useSearchParams();
  const orderNumber = params.get('order');
  const status = params.get('status') ?? 'awaiting_provider';
  const awaitingProvider = status === 'awaiting_provider';

  useEffect(() => { document.title = 'Pedido confirmado | Quero Armas'; }, []);

  return (
    <SiteShell>
      <section className="container py-12 sm:py-20">
        <div className="mx-auto max-w-2xl rounded-sm border border-border bg-surface-elevated p-6 text-center sm:p-10">
          {awaitingProvider ? <Clock className="mx-auto size-12 text-accent" /> : <CheckCircle2 className="mx-auto size-12 text-accent" />}
          <h1 className="mt-4 font-heading text-2xl font-bold uppercase sm:text-3xl">
            {awaitingProvider ? 'Pedido registrado' : 'Pedido confirmado'}
          </h1>
          {orderNumber && (
            <p className="mt-2 font-heading text-sm uppercase tracking-widest text-muted-foreground">Nº {orderNumber}</p>
          )}
          <p className="mt-5 text-sm text-muted-foreground sm:text-base">
            {awaitingProvider
              ? 'Seu pedido foi criado e o aceite comercial registrado com IP e horário. O pagamento será habilitado assim que o gateway oficial for conectado.'
              : 'Seu pedido foi confirmado e o pagamento iniciado. Acompanhe pelo seu portal.'}
          </p>
          <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
            <Link to="/area-do-cliente" className="group flex items-start gap-3 rounded-sm border border-border bg-background p-4 transition-colors hover:border-accent/40">
              <ListChecks className="mt-0.5 size-5 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="font-heading text-sm font-semibold uppercase tracking-wide">Meus pedidos</p>
                <p className="mt-1 text-xs text-muted-foreground">Acompanhe o andamento.</p>
              </div>
              <ArrowRight className="ml-auto mt-1 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
            <Link to="/area-do-cliente" className="group flex items-start gap-3 rounded-sm border border-border bg-background p-4 transition-colors hover:border-accent/40">
              <FileText className="mt-0.5 size-5 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="font-heading text-sm font-semibold uppercase tracking-wide">Meu contrato</p>
                <p className="mt-1 text-xs text-muted-foreground">Veja e assine o contrato formal.</p>
              </div>
              <ArrowRight className="ml-auto mt-1 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg"><Link to="/area-do-cliente">Ir para o portal</Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/servicos">Voltar ao catálogo</Link></Button>
          </div>
        </div>
      </section>
    </SiteShell>
  );
};

export default CheckoutSuccessPage;
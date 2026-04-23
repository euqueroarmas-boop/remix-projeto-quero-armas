import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getServiceBySlug, type ServiceWithCategory } from '@/shared/data/catalog';
import { useCart } from '@/shared/cart/CartProvider';
import { formatBRL } from '@/shared/lib/formatters';
import { ArrowLeft, Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

const ServiceSalesPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [service, setService] = useState<ServiceWithCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!slug) return;
    getServiceBySlug(slug).then((res) => {
      if (res) {
        setService(res.service);
        document.title = `Contratar ${res.service.name} | Quero Armas`;
      }
      setLoading(false);
    });
  }, [slug]);

  const handleAdd = () => {
    if (!service) return;
    addItem({
      service_id: service.id,
      service_slug: service.slug,
      service_name: service.name,
      unit_price_cents: service.base_price_cents,
      quantity,
    });
    toast.success('Adicionado ao carrinho');
    navigate('/carrinho');
  };

  if (loading) {
    return (
      <SiteShell>
        <div className="container flex items-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando...
        </div>
      </SiteShell>
    );
  }
  if (!service) {
    return (
      <SiteShell>
        <div className="container py-20 text-center">
          <h1 className="font-heading text-2xl uppercase">Serviço não encontrado</h1>
          <Button asChild className="mt-6"><Link to="/servicos">Ver catálogo</Link></Button>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="container py-10 sm:py-14">
        <Link
          to={`/servicos/${service.slug}`}
          className="mb-6 inline-flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-accent"
        >
          <ArrowLeft className="size-3.5" />
          Voltar
        </Link>
        <p className="font-heading text-xs uppercase tracking-[0.2em] text-accent">Contratação</p>
        <h1 className="mt-2 font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
          {service.name}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{service.short_description}</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-sm border border-border bg-surface-elevated p-6">
            <h2 className="font-heading text-sm uppercase tracking-widest text-accent">
              Detalhes
            </h2>
            <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
              {service.long_description ?? service.short_description}
            </p>
          </div>

          <aside className="rounded-sm border border-border bg-surface-elevated p-6">
            <p className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
              Valor unitário
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-accent">
              {formatBRL(service.base_price_cents)}
            </p>

            <div className="mt-6 space-y-2">
              <Label htmlFor="qty">Quantidade</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>

            <Button onClick={handleAdd} size="lg" className="mt-6 w-full">
              <ShoppingCart className="mr-2 size-4" /> Adicionar ao carrinho
            </Button>
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link to={`/servicos/${service.slug}`}>Voltar</Link>
            </Button>
          </aside>
        </div>
      </section>
    </SiteShell>
  );
};

export default ServiceSalesPage;

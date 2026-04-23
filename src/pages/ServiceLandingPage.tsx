import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { getServiceBySlug, type ServiceWithCategory } from '@/shared/data/catalog';
import { formatBRL } from '@/shared/lib/formatters';
import { ArrowRight, Loader2 } from 'lucide-react';

const ServiceLandingPage = () => {
  const { slug } = useParams();
  const [service, setService] = useState<ServiceWithCategory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    getServiceBySlug(slug).then((res) => {
      if (res) {
        setService(res.service);
        document.title = `${res.service.name} | Quero Armas`;
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <SiteShell><div className="container flex items-center gap-2 py-20 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando...</div></SiteShell>;
  if (!service) return <SiteShell><div className="container py-20 text-center"><h1 className="font-heading text-2xl uppercase">Serviço não encontrado</h1><Button asChild className="mt-6"><Link to="/servicos">Ver catálogo</Link></Button></div></SiteShell>;

  return (
    <SiteShell>
      <section className="container py-12 sm:py-16">
        {service.category && <p className="font-heading text-xs uppercase tracking-[0.2em] text-accent">{service.category.name}</p>}
        <h1 className="mt-3 max-w-3xl font-heading text-3xl font-bold uppercase tracking-tight sm:text-5xl">{service.name}</h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">{service.short_description}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button asChild size="lg"><Link to={`/servicos/${service.slug}/contratar`}>Contratar agora <ArrowRight className="ml-2 size-4" /></Link></Button>
          <div>
            <p className="font-heading text-xs uppercase tracking-widest text-muted-foreground">A partir de</p>
            <p className="font-heading text-2xl font-bold text-accent">{formatBRL(service.base_price_cents)}</p>
          </div>
        </div>
        {service.long_description && (
          <div className="mt-12 max-w-3xl whitespace-pre-line text-muted-foreground">{service.long_description}</div>
        )}
      </section>
    </SiteShell>
  );
};

export default ServiceLandingPage;
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { listActiveServices, type ServiceWithCategory } from '@/shared/data/catalog';
import { formatBRL } from '@/shared/lib/formatters';
import { ArrowRight, Loader2 } from 'lucide-react';

const ServicesListPage = () => {
  const [services, setServices] = useState<ServiceWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Serviços | Quero Armas';
    listActiveServices()
      .then(setServices)
      .catch((e) => setError(e?.message ?? 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SiteShell>
      <section className="container py-10 sm:py-14">
        <header className="mb-10 max-w-3xl">
          <p className="font-heading text-xs uppercase tracking-[0.2em] text-accent">Catálogo oficial · Quero Armas</p>
          <h1 className="mt-2 font-heading text-3xl font-bold uppercase leading-[1.05] tracking-tight sm:text-5xl">
            Pare de tentar entender PF e Exército sozinho. <span className="text-accent">A gente faz o processo certo, com preço fechado.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Cada serviço com nome, preço e jurisdição definidos — sem orçamento misterioso. Posse e Porte na PF (SINARM), CR e acervo no Exército (SIGMA), cursos operacionais e equipamento tático.
          </p>
        </header>
        {loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando catálogo...</div>}
        {error && <p className="text-destructive">{error}</p>}
        {!loading && !error && services.length === 0 && (
          <div className="rounded-sm border border-dashed border-border p-10 text-center text-muted-foreground">
            Nenhum serviço cadastrado ainda. Cadastre serviços no painel administrativo.
          </div>
        )}
        {!loading && services.length > 0 && (
          <ul className="divide-y divide-border border-y border-border">
            {services.map((s) => (
              <li key={s.id} className="grid grid-cols-1 gap-4 py-8 transition-colors hover:bg-surface-elevated/50 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-8 sm:px-3">
                <div className="min-w-0">
                  <Link to={`/servicos/${s.slug}`} className="block font-heading text-lg font-bold uppercase tracking-tight transition-colors hover:text-accent sm:text-xl">
                    {s.name}
                  </Link>
                  {s.short_description && <p className="mt-2 text-base leading-relaxed text-muted-foreground">{s.short_description}</p>}
                </div>
                <div className="flex flex-col sm:items-end">
                  <span className="font-heading text-xs uppercase tracking-widest text-muted-foreground">A partir de</span>
                  <span className="font-heading text-xl font-bold text-accent sm:text-2xl">{formatBRL(s.base_price_cents)}</span>
                </div>
                <Button asChild size="default" variant="outline" className="w-full sm:w-auto">
                  <Link to={`/servicos/${s.slug}`}>Detalhes <ArrowRight className="ml-1 size-4" /></Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SiteShell>
  );
};

export default ServicesListPage;
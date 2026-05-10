import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Autoplay from 'embla-carousel-autoplay';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/shared/cart/CartProvider';
import { listActiveServices, type ServiceWithCategory } from '@/shared/data/catalog';
import { formatBRL } from '@/shared/lib/formatters';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Shield,
  Award,
  Boxes,
  GraduationCap,
  Wrench,
  MessageSquare,
  Layers,
  MapPin,
  FileCheck2,
  HeadphonesIcon,
  LayoutDashboard,
  Tag,
  Lock,
  ShieldCheck,
  Users,
  Heart,
  Phone,
  ChevronDown,
  ShoppingCart,
} from 'lucide-react';
import heroWill from '@/assets/servicos-hero-will.png';

const WHATSAPP_URL = 'https://wa.me/5511978481919?text=' + encodeURIComponent('Olá! Quero falar com um especialista da Quero Armas sobre os serviços.');

type GroupKey = 'sinarm' | 'sigma' | 'sigma-sinarm' | 'cursos' | 'equipamento' | 'consultoria' | 'outros';

interface GroupDef {
  key: GroupKey;
  label: string;
  entity: string;
  blurb: string;
  icon: typeof Shield;
  match: (s: ServiceWithCategory) => boolean;
}

const GROUPS: GroupDef[] = [
  {
    key: 'sinarm',
    label: 'SINARM',
    entity: 'Polícia Federal',
    blurb: 'Posse, Porte e registros de armas civis sob a Polícia Federal.',
    icon: Shield,
    match: (s) =>
      s.category?.slug === 'sinarm-pf' &&
      !/sigma/i.test(s.name) &&
      !/transferencia/i.test(s.slug),
  },
  {
    key: 'sigma',
    label: 'SIGMA',
    entity: 'Exército Brasileiro',
    blurb: 'CR de Atirador, Caçador, Colecionador, registro de arma CAC e gestão do acervo.',
    icon: Award,
    match: (s) =>
      s.category?.slug === 'sigma-eb' &&
      !/transferencia-arma-sigma/.test(s.slug),
  },
  {
    key: 'sigma-sinarm',
    label: 'SIGMA + SINARM',
    entity: 'Exército + Polícia Federal',
    blurb: 'Serviços que cruzam as duas jurisdições — transferências, migrações e operações conjuntas.',
    icon: Layers,
    match: (s) => /transferencia-arma-sigma/.test(s.slug),
  },
  {
    key: 'cursos',
    label: 'Cursos',
    entity: 'Treinamento Operacional',
    blurb: 'Formação técnica de tiro — pistola, espingarda calibre 12 e revólver.',
    icon: GraduationCap,
    match: (s) => s.category?.slug === 'treinamento' || /^curso-/.test(s.slug),
  },
  {
    key: 'equipamento',
    label: 'Equipamento Tático',
    entity: 'Aquisição assessorada',
    blurb: 'Coletes balísticos e equipamentos com autorização do Exército.',
    icon: Boxes,
    match: (s) => s.category?.slug === 'equipamento',
  },
  {
    key: 'consultoria',
    label: 'Consultoria',
    entity: 'Orientação técnica',
    blurb: 'Munição defensiva, aquisição em loja e orientação normativa.',
    icon: MessageSquare,
    match: (s) => s.category?.slug === 'consultoria',
  },
];

const FALLBACK_GROUP: GroupDef = {
  key: 'outros',
  label: 'Outros',
  entity: 'Demais serviços',
  blurb: '',
  icon: Wrench,
  match: () => true,
};

const BENEFICIOS = [
  { icon: MapPin, label: 'Atendimento nacional' },
  { icon: FileCheck2, label: 'Processo legal e organizado' },
  { icon: HeadphonesIcon, label: 'Acompanhamento técnico real' },
  { icon: LayoutDashboard, label: 'Portal do cliente + Arsenal Digital' },
  { icon: Tag, label: 'Preço claro' },
];

const ETAPAS = [
  { n: 1, titulo: 'ESCOLHA SEU SERVIÇO', desc: 'Veja os serviços disponíveis com preço transparente e descrição completa.' },
  { n: 2, titulo: 'ADICIONE AO CARRINHO', desc: 'Selecione o serviço ideal e adicione ao carrinho de compra.' },
  { n: 3, titulo: 'FINALIZE SUA COMPRA', desc: 'Pagamento seguro e confirmação no portal.' },
  { n: 4, titulo: 'COMECE SEU PROCESSO', desc: 'Acompanhamento, checklist, documentos e orientação até o resultado.' },
];

const SEGURANCA = [
  { icon: Lock, label: 'Sua privacidade é nossa prioridade' },
  { icon: ShieldCheck, label: 'Ambiente seguro' },
  { icon: Users, label: 'Suporte especializado' },
  { icon: Heart, label: 'Atendimento humanizado' },
];

const ServicesListPage = () => {
  const [services, setServices] = useState<ServiceWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupKey | 'all'>('all');
  const [api, setApi] = useState<CarouselApi | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addItem } = useCart();

  const autoplayRef = useRef(
    Autoplay({ delay: 4500, stopOnInteraction: false, stopOnMouseEnter: true }),
  );

  useEffect(() => {
    document.title = 'Serviços | Quero Armas';
    listActiveServices()
      .then(setServices)
      .catch((e) => setError(e?.message ?? 'Erro ao carregar serviços.'))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const buckets = new Map<GroupKey, ServiceWithCategory[]>();
    GROUPS.forEach((g) => buckets.set(g.key, []));
    buckets.set('outros', []);
    const used = new Set<string>();
    for (const g of GROUPS) {
      for (const s of services) {
        if (used.has(s.id)) continue;
        if (g.match(s)) {
          buckets.get(g.key)!.push(s);
          used.add(s.id);
        }
      }
    }
    for (const s of services) if (!used.has(s.id)) buckets.get('outros')!.push(s);
    for (const [, list] of buckets) list.sort((a, b) => a.display_order - b.display_order);
    return buckets;
  }, [services]);

  const allGroups = [...GROUPS, FALLBACK_GROUP].filter((g) => (grouped.get(g.key)?.length ?? 0) > 0);

  const visibleServices = useMemo(() => {
    if (activeGroup === 'all') {
      return allGroups.flatMap((g) => grouped.get(g.key) ?? []);
    }
    return grouped.get(activeGroup) ?? [];
  }, [activeGroup, allGroups, grouped]);

  const scrollToCatalogo = () => {
    const el = document.getElementById('catalogo-servicos');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const stopAutoplay = () => {
    autoplayRef.current?.stop();
  };

  // Stop autoplay also on drag interactions
  useEffect(() => {
    if (!api) return;
    const handler = () => stopAutoplay();
    api.on('pointerDown', handler);
    return () => {
      api.off('pointerDown', handler);
    };
  }, [api]);

  const handleAddToCart = (s: ServiceWithCategory) => {
    addItem({
      service_id: s.id,
      service_slug: s.slug,
      service_name: s.name,
      unit_price_cents: s.base_price_cents,
      quantity: 1,
    });
    toast({
      title: 'Adicionado ao carrinho',
      description: `${s.name} foi adicionado.`,
    });
    navigate('/carrinho');
  };

  const groupLabelOf = (s: ServiceWithCategory): string => {
    for (const g of GROUPS) if (g.match(s)) return g.label;
    return FALLBACK_GROUP.label;
  };

  return (
    <SiteShell>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,hsl(var(--accent)/0.18),transparent_55%),radial-gradient(circle_at_80%_70%,hsl(var(--accent)/0.08),transparent_60%)]"
        />
        <div className="container relative grid grid-cols-1 items-center gap-8 py-8 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-12">
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.3em] text-accent">
              Serviços
            </p>
            <h1 className="mt-4 font-heading text-3xl font-bold uppercase leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
              Você não precisa enfrentar a burocracia sozinho.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Da posse ao porte, do CR ao Arsenal Digital — a Quero Armas organiza o caminho legal,
              técnico e documental para você agir com segurança e dentro da lei.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={scrollToCatalogo} className="font-heading uppercase tracking-wide">
                Ver catálogo de serviços <ChevronDown className="ml-2 size-4" />
              </Button>
              <Button asChild size="lg" variant="outline" className="font-heading uppercase tracking-wide">
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                  <Phone className="mr-2 size-4" /> Falar com especialista
                </a>
              </Button>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-tr from-accent/20 via-transparent to-transparent blur-2xl" aria-hidden />
            <div className="relative overflow-hidden rounded-xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]">
              <img
                src={heroWill}
                alt="Especialista da Quero Armas pronto para atender"
                loading="eager"
                className="mx-auto h-auto w-full max-h-[520px] object-cover"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-background/40 to-transparent" aria-hidden />
            </div>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="border-b border-border bg-surface-elevated/30">
        <div className="container py-10">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {BENEFICIOS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-sm border border-border bg-background px-4 py-4"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-accent/40 bg-accent/10 text-accent">
                  <Icon className="size-4" />
                </span>
                <span className="font-heading text-xs font-bold uppercase tracking-wide leading-tight">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="border-b border-border">
        <div className="container py-14 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.3em] text-accent">
              Como funciona
            </p>
            <h2 className="mt-3 font-heading text-2xl font-bold uppercase tracking-tight sm:text-4xl">
              4 passos. Sem mistério.
            </h2>
          </div>
          <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ETAPAS.map((e) => (
              <li key={e.n} className="relative rounded-sm border border-border bg-surface-elevated/40 p-6">
                <div className="font-heading text-5xl font-bold leading-none text-accent/80">
                  {String(e.n).padStart(2, '0')}
                </div>
                <h3 className="mt-4 font-heading text-base font-bold uppercase tracking-tight">
                  {e.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-border bg-gradient-to-br from-accent/15 via-background to-background">
        <div className="container flex flex-col items-start gap-6 py-12 sm:flex-row sm:items-center sm:justify-between sm:py-16">
          <div className="max-w-xl">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              Pronto para dar o próximo passo?
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Escolha o serviço ideal para seu caso e inicie agora sua contratação com a Quero Armas.
            </p>
          </div>
          <Button
            size="lg"
            onClick={scrollToCatalogo}
            className="font-heading uppercase tracking-wide"
          >
            Ver catálogo de serviços <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      </section>

      {/* CATÁLOGO EM CARROSSEL */}
      <section id="catalogo-servicos" className="scroll-mt-24 border-b border-border">
        <div className="container py-14 sm:py-20">
          <div className="mb-8 max-w-3xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.3em] text-accent">
              Catálogo
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              Serviços disponíveis
            </h2>
            <p className="mt-3 text-muted-foreground">
              Filtre pela entidade do seu caso, leia o que está incluso e contrate com 1 clique.
            </p>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando catálogo...
            </div>
          )}
          {error && <p className="text-destructive">{error}</p>}

          {!loading && !error && (
            <>
              {/* Filtro por categoria/grupo */}
              <nav className="mb-8 flex flex-wrap gap-2 border-b border-border pb-5">
                <FilterChip active={activeGroup === 'all'} onClick={() => setActiveGroup('all')}>
                  Todos ({services.length})
                </FilterChip>
                {allGroups.map((g) => {
                  const count = grouped.get(g.key)?.length ?? 0;
                  return (
                    <FilterChip
                      key={g.key}
                      active={activeGroup === g.key}
                      onClick={() => setActiveGroup(g.key)}
                    >
                      {g.label} ({count})
                    </FilterChip>
                  );
                })}
              </nav>

              {visibleServices.length === 0 ? (
                <p className="text-muted-foreground">Nenhum serviço encontrado neste grupo.</p>
              ) : (
                <div className="relative">
                <Carousel
                  setApi={setApi}
                  opts={{ align: 'start', loop: true }}
                  plugins={[autoplayRef.current]}
                  className="px-0"
                >
                  <CarouselContent className="-ml-4">
                    {visibleServices.map((s) => (
                      <CarouselItem
                        key={s.id}
                        className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                      >
                        <article className="flex h-full flex-col rounded-sm border border-border bg-surface-elevated/40 p-5 transition-colors hover:border-accent/60">
                          <p className="font-heading text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
                            {groupLabelOf(s)}
                          </p>
                          <h3 className="mt-3 font-heading text-lg font-bold uppercase leading-tight tracking-tight">
                            {s.name}
                          </h3>
                          {s.short_description && (
                            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                              {s.short_description}
                            </p>
                          )}
                          <div className="mt-4">
                            <span className="block font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                              A partir de
                            </span>
                            <span className="font-heading text-2xl font-bold text-accent">
                              {formatBRL(s.base_price_cents)}
                            </span>
                          </div>
                          <div className="mt-5 flex flex-col gap-2 pt-4 border-t border-border/60">
                            <Button asChild variant="outline" size="sm" className="w-full">
                              <Link to={`/servicos/${s.slug}`}>
                                Ver detalhes <ArrowRight className="ml-1 size-4" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => handleAddToCart(s)}
                            >
                              <ShoppingCart className="mr-2 size-4" /> Adicionar ao carrinho
                            </Button>
                          </div>
                        </article>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    type="button"
                    aria-label="Anterior"
                    onClick={() => { stopAutoplay(); api?.scrollPrev(); }}
                    className="flex size-11 items-center justify-center rounded-full border border-border bg-background transition-colors hover:border-accent hover:text-accent"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Próximo"
                    onClick={() => { stopAutoplay(); api?.scrollNext(); }}
                    className="flex size-11 items-center justify-center rounded-full border border-border bg-background transition-colors hover:border-accent hover:text-accent"
                  >
                    <ArrowRight className="size-4" />
                  </button>
                </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* SEGURANÇA */}
      <section className="bg-surface-elevated/30">
        <div className="container py-10">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SEGURANCA.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-sm border border-border bg-background px-4 py-4"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-accent/40 bg-accent/10 text-accent">
                  <Icon className="size-4" />
                </span>
                <span className="font-heading text-xs font-bold uppercase tracking-wide leading-tight">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </SiteShell>
  );
};

const FilterChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={
      'rounded-sm border px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wide transition-colors ' +
      (active
        ? 'border-accent bg-accent text-accent-foreground'
        : 'border-border bg-background text-muted-foreground hover:border-accent/60 hover:text-foreground')
    }
  >
    {children}
  </button>
);

export default ServicesListPage;

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
  BadgeCheck,
  Timer,
  Sparkles,
} from 'lucide-react';
import heroWill from '@/assets/servicos-hero-will.png';
import heroArsenal from '@/assets/hero-servicos-arsenal.png';

const WHATSAPP_URL = 'https://wa.me/5511978481919?text=' + encodeURIComponent('Olá! Quero falar com um especialista da Quero Armas sobre os serviços.');

const publicSectionCls = 'relative left-1/2 w-dvw max-w-none -translate-x-1/2 overflow-hidden';
const publicInnerCls = 'w-full px-4 sm:px-6 lg:px-10 2xl:px-16';

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

const compactDescription = (text?: string | null) => {
  const value = String(text || '').trim();
  if (!value) return 'Detalhes disponíveis na próxima etapa.';
  return value.length > 150 ? `${value.slice(0, 147).trim()}...` : value;
};

const servicePriceLabel = (cents: number) => {
  if (!cents || cents <= 0) return 'Valor sob consulta';
  return formatBRL(cents);
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
      title: 'Serviço selecionado para contratação.',
      description: s.name,
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
      <section
        className={`${publicSectionCls} min-h-[720px] border-b border-border bg-background lg:min-h-[760px] xl:min-h-[800px]`}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-background" />

        {/* Imagem cinematográfica do arsenal — desktop */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[72vw] lg:block xl:w-[70vw] 2xl:w-[68vw]">
          <img
            src={heroArsenal}
            alt="Especialista da Quero Armas no estande de tiro"
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover object-right"
            style={{ filter: 'saturate(0.9) brightness(1.05) contrast(1.03) hue-rotate(-4deg)' }}
          />
          {/* Fade horizontal — esquerda sólida, fundindo suavemente sob o personagem */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, hsl(var(--background)) 0%, hsl(var(--background) / 0.7) 18%, hsl(var(--background) / 0.3) 42%, hsl(var(--background) / 0.08) 75%, transparent 100%)',
            }}
          />
          {/* Fades verticais sutis — profundidade editorial */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background/50 to-transparent"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/50 to-transparent"
          />
        </div>

        <div className="relative z-10 flex min-h-[inherit] w-full flex-col justify-center px-4 py-10 sm:px-6 lg:px-10 lg:py-14 2xl:px-16">
          <div className="max-w-[620px] 2xl:max-w-[680px]">
            <p className="font-heading text-[11px] font-bold uppercase tracking-[0.32em] text-accent">
              Serviços
            </p>
            <h1 className="mt-5 font-heading font-extrabold uppercase tracking-tight text-white text-[2.5rem] leading-[1.02] sm:text-5xl lg:text-[4.25rem] lg:leading-[0.96] xl:text-[4.7rem] 2xl:text-[5.25rem] 2xl:leading-[0.98]">
              Você não precisa enfrentar a burocracia sozinho.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg lg:mt-4 2xl:mt-6">
              A Quero Armas usa tecnologia, inteligência artificial e análise documental guiada
              para acelerar sua contratação, revisar seus documentos e montar seu processo com
              máxima agilidade.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
              Sem enrolação: você envia, nossa plataforma organiza, a IA ajuda a identificar
              pendências e a Equipe Quero Armas corrige o que for necessário para deixar tudo
              pronto o quanto antes.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row 2xl:mt-8">
              <Button
                size="lg"
                onClick={scrollToCatalogo}
                className="h-12 px-6 font-heading uppercase tracking-wide text-white shadow-lg shadow-black/40"
                style={{ backgroundColor: '#5a6b3b' }}
              >
                Ver catálogo de serviços <ChevronDown className="ml-2 size-4" />
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/20 bg-transparent px-6 font-heading uppercase tracking-wide text-white hover:bg-white/5 hover:text-white"
              >
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                  <Phone className="mr-2 size-4" /> Falar com especialista
                </a>
              </Button>
            </div>

            {/* Trust strip */}
            <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {[
                { icon: Sparkles, title: 'IA Documental', desc: 'Análise inteligente dos documentos' },
                { icon: Timer, title: 'Sem enrolação', desc: 'Processo organizado em poucos dias' },
                { icon: BadgeCheck, title: 'Equipe especialista', desc: 'Correção técnica antes do envio' },
                { icon: Lock, title: 'Segurança', desc: 'Dados e documentos protegidos' },
              ].map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-5 shrink-0 text-accent" />
                  <div>
                    <p className="font-heading text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                      {title}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-zinc-400">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Imagem mobile/tablet */}
          <div className="relative mt-10 overflow-hidden rounded-sm lg:hidden">
            <img
              src={heroArsenal}
              alt="Especialista da Quero Armas no estande de tiro"
              loading="eager"
              className="h-[380px] w-full object-cover object-[center_top] sm:h-[460px]"
              style={{ filter: 'saturate(0.9) brightness(1.05) contrast(1.03) hue-rotate(-4deg)' }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent"
            />
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className={`${publicSectionCls} border-b border-border bg-surface-elevated/30`}>
        <div className={`${publicInnerCls} py-10`}>
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
      <section className={`${publicSectionCls} border-b border-border`}>
        <div className={`${publicInnerCls} py-14 sm:py-20`}>
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
      <section className={`${publicSectionCls} border-b border-border bg-gradient-to-br from-accent/15 via-background to-background`}>
        <div className={`${publicInnerCls} flex flex-col items-start gap-6 py-12 sm:flex-row sm:items-center sm:justify-between sm:py-16`}>
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
      <section id="catalogo-servicos" className={`${publicSectionCls} scroll-mt-24 border-b border-border`}>
        <div className={`${publicInnerCls} py-14 sm:py-20`}>
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
                        <article className="flex h-full min-h-[390px] flex-col rounded-sm border border-border bg-surface-elevated/40 p-5 transition-colors hover:border-accent/60">
                          <p className="font-heading text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
                            {groupLabelOf(s)}
                          </p>
                          <h3 className="mt-3 line-clamp-2 min-h-[3.25rem] font-heading text-lg font-bold uppercase leading-tight tracking-tight">
                            {s.name}
                          </h3>
                          <p className="mt-3 line-clamp-3 min-h-[4.05rem] text-sm leading-relaxed text-muted-foreground">
                            {compactDescription(s.short_description)}
                          </p>
                          <div className="mt-4 min-h-[3.25rem]">
                            <span className="block font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                              {s.base_price_cents > 0 ? 'A partir de' : 'Investimento'}
                            </span>
                            <span className="font-heading text-2xl font-bold text-accent">
                              {servicePriceLabel(s.base_price_cents)}
                            </span>
                          </div>
                          <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-border/60">
                            <Button asChild variant="outline" size="sm" className="w-full">
                              <Link to={`/servicos/${s.slug}`}>
                                Ver detalhes <ArrowRight className="ml-1 size-4" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              className="w-full font-heading uppercase tracking-wide text-white"
                              style={{ backgroundColor: '#5a6b3b' }}
                              onClick={() => handleAddToCart(s)}
                            >
                              <ShoppingCart className="mr-2 size-4" /> Contratar este serviço
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
      <section className={`${publicSectionCls} bg-surface-elevated/30`}>
        <div className={`${publicInnerCls} py-10`}>
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

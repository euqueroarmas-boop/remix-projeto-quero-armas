import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { listActiveServices, type ServiceWithCategory } from '@/shared/data/catalog';
import { formatBRL } from '@/shared/lib/formatters';
import { ArrowRight, Loader2, Shield, Award, Boxes, GraduationCap, Wrench, MessageSquare, Layers } from 'lucide-react';

/**
 * Agrupamento curado por ENTIDADE (não por category_id puro).
 * Permite consolidar serviços que vivem em mais de uma jurisdição
 * (ex: transferência SIGMA↔SINARM) num grupo próprio.
 */
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

const ServicesListPage = () => {
  const [services, setServices] = useState<ServiceWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupKey | 'all'>('all');

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

    // ordena cada bucket por display_order
    for (const [, list] of buckets) list.sort((a, b) => a.display_order - b.display_order);
    return buckets;
  }, [services]);

  const allGroups = [...GROUPS, FALLBACK_GROUP].filter((g) => (grouped.get(g.key)?.length ?? 0) > 0);
  const visibleGroups =
    activeGroup === 'all' ? allGroups : allGroups.filter((g) => g.key === activeGroup);

  return (
    <SiteShell>
      <section className="container py-10 sm:py-14">
        <header className="mb-10 max-w-3xl">
          <p className="font-heading text-xs uppercase tracking-[0.2em] text-accent">
            Catálogo oficial · Quero Armas
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold uppercase leading-[1.05] tracking-tight sm:text-5xl">
            Pare de tentar entender PF e Exército sozinho.{' '}
            <span className="text-accent">A gente faz o processo certo, na entidade certa, com preço fechado.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Cada serviço abaixo tem <strong className="text-foreground">nome, preço e jurisdição definidos</strong> — sem orçamento misterioso, sem "depende", sem promessa vazia. Você escolhe, contrata e a gente conduz da papelada ao deferimento. Posse e Porte na <strong className="text-foreground">PF (SINARM)</strong>, CR e acervo no <strong className="text-foreground">Exército (SIGMA)</strong>, transferências entre os dois sistemas, cursos operacionais e equipamento tático — tudo num só lugar.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="font-heading text-xs uppercase tracking-widest text-accent">Como funciona →</span>{' '}
            Filtre pela entidade do seu caso, leia o que está incluso, contrate com 1 clique. Atendemos Brasil todo via assessoria à distância — sem sair de casa.
          </p>
        </header>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando catálogo...
          </div>
        )}
        {error && <p className="text-destructive">{error}</p>}

        {!loading && !error && (
          <>
            {/* Filtro por entidade */}
            <nav className="mb-10 flex flex-wrap gap-2 border-b border-border pb-5">
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

            <div className="space-y-20 sm:space-y-28">
              {visibleGroups.map((group) => {
                const items = grouped.get(group.key) ?? [];
                if (!items.length) return null;
                const Icon = group.icon;
                return (
                  <section key={group.key} aria-labelledby={`grp-${group.key}`}>
                    {/* Header da entidade — premium */}
                    <div className="relative mb-7 overflow-hidden rounded-sm border border-border bg-gradient-to-br from-surface-elevated/80 via-background to-background">
                      {/* Faixa lateral acentuada */}
                      <div className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden />
                      {/* Marca d'água do ícone */}
                      <Icon
                        className="pointer-events-none absolute -right-6 -top-6 size-40 text-accent/[0.04]"
                        strokeWidth={1.25}
                        aria-hidden
                      />
                      <div className="relative flex items-center gap-6 px-6 py-8 sm:px-8 sm:py-10">
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-sm border border-accent/50 bg-accent/15 shadow-[0_0_0_1px_hsl(var(--accent)/0.1)_inset] sm:size-20">
                          <Icon className="size-8 text-accent sm:size-10" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="h-px w-8 bg-accent" aria-hidden />
                            <p className="font-heading text-sm font-bold uppercase tracking-[0.25em] text-accent sm:text-base">
                              {group.entity}
                            </p>
                          </div>
                          <h2
                            id={`grp-${group.key}`}
                            className="mt-3 font-heading text-3xl font-bold uppercase leading-none tracking-tight text-foreground sm:text-4xl"
                          >
                            {group.label}
                          </h2>
                          {group.blurb && (
                            <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                              {group.blurb}
                            </p>
                          )}
                        </div>
                        <div className="hidden shrink-0 flex-col items-end border-l border-border/60 pl-6 sm:flex">
                          <span className="font-heading text-5xl font-bold leading-none text-foreground">
                            {String(items.length).padStart(2, '0')}
                          </span>
                          <span className="mt-2 font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {items.length === 1 ? 'serviço' : 'serviços'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Lista densa — não-card */}
                    <ul className="divide-y divide-border border-y border-border">
                      {items.map((s) => (
                        <li
                          key={s.id}
                          className="group grid grid-cols-1 gap-4 py-8 transition-colors hover:bg-surface-elevated/50 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-8 sm:px-3"
                        >
                          <div className="min-w-0">
                            <Link
                              to={`/servicos/${s.slug}`}
                              className="block font-heading text-lg font-bold uppercase tracking-tight transition-colors group-hover:text-accent sm:text-xl"
                            >
                              {s.name}
                            </Link>
                            {s.short_description && (
                              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                                {s.short_description}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col sm:items-end">
                            <span className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
                              A partir de
                            </span>
                            <span className="font-heading text-xl font-bold text-accent sm:text-2xl">
                              {formatBRL(s.base_price_cents)}
                            </span>
                          </div>
                          <Button
                            asChild
                            size="default"
                            variant="outline"
                            className="w-full sm:w-auto"
                          >
                            <Link to={`/servicos/${s.slug}`}>
                              Detalhes <ArrowRight className="ml-1 size-4" />
                            </Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
        )}
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

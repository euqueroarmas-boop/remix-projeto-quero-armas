import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { getServiceBySlug, type ServiceLandingData, type ServiceWithCategory } from '@/shared/data/catalog';
import { formatBRL } from '@/shared/lib/formatters';
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Target,
  FileCheck2,
  AlertTriangle,
  Quote,
  ArrowRight,
  Scale,
  Home,
  Ban,
  Fingerprint,
  ClipboardList,
  ArrowLeft,
  Brain,
  Crosshair,
  FileSignature,
  ShoppingBag,
  BadgeCheck,
  Truck,
  Lock,
  Calendar,
  AlertOctagon,
  Gavel,
  Coins,
  Clock,
  HelpCircle,
  XCircle,
} from 'lucide-react';
import * as React from 'react';
import {
  BarChart,
  Bar as RBar,
  XAxis as RXAxis,
  YAxis as RYAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend as RLegend,
  ResponsiveContainer,
} from 'recharts';

const Bar = RBar as unknown as React.FC<any>;
const XAxis = RXAxis as unknown as React.FC<any>;
const YAxis = RYAxis as unknown as React.FC<any>;
const RechartsTooltip = RTooltip as unknown as React.FC<any>;
const Legend = RLegend as unknown as React.FC<any>;

// ---------------- Tipagem dos blocos ----------------
// Tolerante: aceita `desc` ou `description`, `body`/`text`, `q`/`question`, etc.
type TitleDesc = { title: string; desc?: string; description?: string };
type QA = { q?: string; a?: string; question?: string; answer?: string };
type Block =
  | { type: 'intro'; eyebrow?: string; title?: string; body?: string; text?: string }
  | { type: 'features'; title?: string; items: string[] }
  | { type: 'pillars'; title?: string; items: TitleDesc[] }
  | { type: 'steps'; title?: string; items: TitleDesc[] }
  | {
      type: 'polarization';
      title?: string;
      intro?: string;
      victim: TitleDesc;
      protector: TitleDesc;
    }
  | { type: 'benefits'; title?: string; intro?: string; items: TitleDesc[] }
  | { type: 'responsibility'; title?: string; quote?: string; body?: string; items: TitleDesc[] }
  | { type: 'checklist'; title?: string; intro?: string; body?: string; items: string[] }
  | { type: 'faq'; title?: string; items: QA[] }
  | { type: 'quote'; text: string; author?: string; caption?: string }
  | {
      type: 'cta';
      title: string;
      desc?: string;
      body?: string;
      button?: string;
      primary_label?: string;
      href?: string;
    }
  | { type: 'disclaimer'; text?: string; body?: string; title?: string }
  | {
      type: 'technical_dossier';
      eyebrow?: string;
      title?: string;
      intro?: string;
      legal_refs?: string[];
      definition?: { title?: string; body?: string; allowed?: string[]; forbidden?: string[] };
      requirements?: { title?: string; intro?: string; items: TitleDesc[] };
      flow?: { title?: string; intro?: string; items: TitleDesc[] };
      workflow?: { title?: string; rows: { stage: string; action: string; term: string }[] };
      changes?: { title?: string; intro?: string; items: TitleDesc[] };
      obligations?: { title?: string; items: TitleDesc[] };
      calibers?: {
        title?: string;
        intro?: string;
        allowed: { caliber: string; note?: string }[];
        restricted: { caliber: string; note?: string }[];
      };
      costs?: {
        title?: string;
        intro?: string;
        items: { label: string; value: string; note?: string }[];
        footnote?: string;
      };
      timeline?: {
        title?: string;
        intro?: string;
        total?: string;
        items: { phase: string; range: string; desc?: string }[];
      };
      penalties?: {
        title?: string;
        intro?: string;
        warning?: string;
        rows: { offense: string; range: string; regime: string }[];
        chart?: { offense: string; min: number; max: number }[];
      };
      faq_technical?: { title?: string; intro?: string; items: QA[] };
      footnote?: string;
    };

// Helpers para resolver aliases
const td = (it: TitleDesc) => ({ title: it.title, desc: it.desc ?? it.description ?? '' });
const qa = (it: QA) => ({
  q: it.q ?? it.question ?? '',
  a: it.a ?? it.answer ?? '',
});

const ServiceLandingPage = () => {
  const { slug } = useParams();
  const [service, setService] = useState<ServiceWithCategory | null>(null);
  const [landing, setLanding] = useState<ServiceLandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getServiceBySlug(slug)
      .then((res) => {
        if (!res) {
          setNotFound(true);
          return;
        }
        setService(res.service);
        setLanding(res.landing);
        document.title = (res.landing?.seo_title ?? res.service.name) + ' | Quero Armas';
        const desc = res.landing?.seo_description ?? res.service.short_description ?? '';
        const meta = document.querySelector('meta[name="description"]');
        if (meta && desc) meta.setAttribute('content', desc);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <SiteShell>
        <div className="container flex items-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando serviço...
        </div>
      </SiteShell>
    );
  }
  if (notFound || !service) {
    return (
      <SiteShell>
        <div className="container py-20 text-center">
          <h1 className="font-heading text-2xl uppercase">Serviço não encontrado</h1>
          <Button asChild className="mt-6">
            <Link to="/servicos">Ver catálogo</Link>
          </Button>
        </div>
      </SiteShell>
    );
  }

  const blocks: Block[] = Array.isArray(landing?.blocks) ? (landing!.blocks as Block[]) : [];
  const features = blocks.find((b): b is Extract<Block, { type: 'features' }> => b.type === 'features');
  const otherBlocks = blocks.filter((b) => b.type !== 'features');

  const contractHref = `/servicos/${service.slug}/contratar`;

  return (
    <SiteShell>
      {/* HERO */}
      <section className="relative border-b border-border/60 bg-surface-overlay">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-tactical" />
        <div className="container py-12 sm:py-16 lg:py-20">
          <Link
            to="/servicos"
            className="mb-6 inline-flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-accent"
          >
            <ArrowLeft className="size-3.5" />
            Voltar para serviços
          </Link>
          {service.category && (
            <p className="font-heading text-xs uppercase tracking-[0.2em] text-accent">
              {service.category.name}
            </p>
          )}
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-bold uppercase tracking-tight sm:text-5xl">
            {landing?.hero_title ?? service.name}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {landing?.hero_subtitle ?? service.short_description}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="font-heading uppercase tracking-[0.1em]">
              <Link to={contractHref}>
                Quero minha posse legal <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <div>
              <p className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
                A partir de
              </p>
              <p className="font-heading text-2xl font-bold text-accent">
                {formatBRL(service.base_price_cents)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SOBRE + INCLUSO */}
      <section className="container grid gap-10 py-12 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent sm:text-xs">
            Sobre o serviço
          </div>
          <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            Por que a posse legal é um direito de defesa?
          </h2>
          <p className="mt-4 whitespace-pre-line text-muted-foreground">
            {service.long_description ?? service.short_description}
          </p>
        </div>
        {features && features.items.length > 0 && (
          <aside className="rounded-sm border border-border bg-surface-elevated p-6">
            <h3 className="font-heading text-sm uppercase tracking-widest text-accent">
              {features.title ?? 'O que está incluso'}
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              {features.items.map((f, idx) => (
                <li key={idx} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </section>

      {/* BLOCOS DINÂMICOS */}
      {otherBlocks.map((block, idx) => (
        <BlockRenderer key={idx} block={block} contractHref={contractHref} />
      ))}
    </SiteShell>
  );
};

// ---------------- Renderizadores ----------------

const BlockRenderer = ({ block, contractHref }: { block: Block; contractHref: string }) => {
  switch (block.type) {
    case 'intro':
      return (
        <section className="border-t border-border/60 py-12 sm:py-16">
          <div className="container max-w-4xl">
            {block.eyebrow && (
              <p className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent sm:text-xs">
                {block.eyebrow}
              </p>
            )}
            {block.title && (
              <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                {block.title}
              </h2>
            )}
            {(block.body ?? block.text) && (
              <p className="mt-4 whitespace-pre-line text-muted-foreground">
                {block.body ?? block.text}
              </p>
            )}
          </div>
        </section>
      );

    case 'pillars':
      return (
        <section className="border-t border-border/60 bg-surface-overlay/40 py-12 sm:py-16">
          <div className="container">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.title ?? 'Nossos pilares'}
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-6">
              {(block.items ?? []).map(td).map((it, i) => {
                const Icon = [ShieldCheck, Target, FileCheck2][i % 3];
                return (
                  <article
                    key={i}
                    className="rounded-sm border border-border bg-card p-6 transition-colors hover:border-accent/40"
                  >
                    <Icon className="size-6 text-accent" />
                    <h3 className="mt-4 font-heading text-base font-bold uppercase tracking-wide">
                      {it.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">{it.desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      );

    case 'steps':
      return (
        <section className="border-t border-border/60 py-12 sm:py-16">
          <div className="container">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.title ?? 'Como funciona o processo'}
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
              {(block.items ?? []).map(td).map((it, i) => (
                <li key={i} className="relative rounded-sm border border-border bg-card p-6">
                  <span className="font-heading text-3xl font-bold text-accent/70 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-2 font-heading text-base font-bold uppercase tracking-wide">
                    {it.title}
                  </h3>
                  {it.desc && <p className="mt-2 text-sm text-muted-foreground">{it.desc}</p>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      );

    case 'polarization': {
      const v = td(block.victim ?? { title: '', desc: '' });
      const p = td(block.protector ?? { title: '', desc: '' });
      return (
        <section className="border-t border-border/60 bg-surface-overlay/40 py-12 sm:py-16">
          <div className="container">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.title ?? 'O mundo real não tem botão de pausa'}
            </h2>
            {block.intro && (
              <p className="mt-4 max-w-3xl text-muted-foreground">{block.intro}</p>
            )}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
              <article className="rounded-sm border border-destructive/40 bg-destructive/5 p-6">
                <div className="flex items-center gap-2 font-heading text-xs uppercase tracking-[0.18em] text-destructive">
                  <AlertTriangle className="size-4" /> Vítima
                </div>
                <h3 className="mt-3 font-heading text-lg font-bold uppercase tracking-wide">
                  {v.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
              </article>
              <article className="rounded-sm border border-primary/40 bg-primary/5 p-6">
                <div className="flex items-center gap-2 font-heading text-xs uppercase tracking-[0.18em] text-accent">
                  <ShieldCheck className="size-4" /> Protetor
                </div>
                <h3 className="mt-3 font-heading text-lg font-bold uppercase tracking-wide">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              </article>
            </div>
          </div>
        </section>
      );
    }

    case 'benefits':
      return (
        <section className="border-t border-border/60 py-12 sm:py-16">
          <div className="container">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.title ?? 'Benefícios da assessoria especializada'}
            </h2>
            {block.intro && (
              <p className="mt-4 max-w-3xl text-muted-foreground">{block.intro}</p>
            )}
            <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-6">
              {(block.items ?? []).map(td).map((it, i) => (
                <article key={i} className="rounded-sm border border-border bg-card p-6">
                  <CheckCircle2 className="size-5 text-accent" />
                  <h3 className="mt-3 font-heading text-base font-bold uppercase tracking-wide">
                    {it.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{it.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      );

    case 'responsibility':
      return (
        <section className="border-t border-border/60 bg-surface-overlay/40 py-12 sm:py-16">
          <div className="container grid gap-8 lg:grid-cols-[1fr_2fr]">
            <div>
              <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                {block.title ?? 'Segurança é treinamento e consciência'}
              </h2>
              {block.quote && (
                <blockquote className="mt-4 border-l-2 border-accent pl-4 text-sm italic text-muted-foreground">
                  {block.quote}
                </blockquote>
              )}
              {block.body && (
                <p className="mt-4 text-sm text-muted-foreground">{block.body}</p>
              )}
            </div>
            <div className="grid gap-4">
              {(block.items ?? []).map(td).map((it, i) => (
                <div key={i} className="rounded-sm border border-border bg-card p-5">
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-accent">
                    {it.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{it.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case 'checklist':
      return (
        <section className="border-t border-border/60 py-12 sm:py-16">
          <div className="container">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.title ?? 'Você está pronto para começar?'}
            </h2>
            {(block.intro ?? block.body) && (
              <p className="mt-4 max-w-3xl text-muted-foreground">{block.intro ?? block.body}</p>
            )}
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {(block.items ?? []).map((it, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-sm border border-border bg-card p-4 text-sm"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );

    case 'faq':
      return (
        <section className="border-t border-border/60 bg-surface-overlay/40 py-12 sm:py-16">
          <div className="container">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.title ?? 'Perguntas frequentes'}
            </h2>
            <div className="mt-8 grid gap-4">
              {(block.items ?? []).map(qa).map((it, i) => (
                <article key={i} className="rounded-sm border border-border bg-card p-5">
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-accent">
                    {it.q}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{it.a}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      );

    case 'quote':
      return (
        <section className="border-t border-border/60 py-12 sm:py-16">
          <div className="container max-w-3xl text-center">
            <Quote className="mx-auto size-8 text-accent" />
            <p className="mt-4 font-heading text-xl uppercase leading-snug tracking-wide sm:text-2xl">
              “{block.text}”
            </p>
            {(block.author || block.caption) && (
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {block.author ? `— ${block.author}` : block.caption}
              </p>
            )}
          </div>
        </section>
      );

    case 'cta':
      return (
        <section className="border-t border-border/60 bg-primary/10 py-12 sm:py-16">
          <div className="container max-w-3xl text-center">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.title}
            </h2>
            {(block.desc ?? block.body) && (
              <p className="mt-4 text-muted-foreground">{block.desc ?? block.body}</p>
            )}
            <Button
              asChild
              size="lg"
              className="mt-6 font-heading uppercase tracking-[0.1em]"
            >
              <Link to={block.href || contractHref}>
                {block.button ?? block.primary_label ?? 'Quero contratar'}
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </section>
      );

    case 'disclaimer':
      return (
        <section className="py-10 sm:py-14">
          <div className="container">
            <div className="relative overflow-hidden rounded-sm border-2 border-accent/60 bg-accent/5 p-5 sm:p-8">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-tactical" />
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-accent/60 bg-accent/10 sm:size-12">
                  <AlertTriangle className="size-5 text-accent sm:size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  {block.title && (
                    <p className="font-heading text-xs font-bold uppercase tracking-[0.25em] text-accent sm:text-sm">
                      {block.title}
                    </p>
                  )}
                  <p className="mt-3 text-sm leading-relaxed text-foreground sm:text-base">
                    {block.text ?? block.body}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      );

    case 'technical_dossier':
      return <TechnicalDossier block={block} contractHref={contractHref} />;

    default:
      return null;
  }
};

// ---------------- Technical Dossier ----------------

type DossierBlock = Extract<Block, { type: 'technical_dossier' }>;

const STEP_ICONS = [Brain, FileSignature, ShoppingBag, BadgeCheck, Truck];
const REQ_ICONS = [Calendar, Scale, Fingerprint, Home, Crosshair, Brain];
const CHANGE_ICONS = [Ban, Target, Lock];
const OBLIGATION_ICONS = [Truck, AlertOctagon, Lock];

const TechnicalDossier = ({
  block,
  contractHref,
}: {
  block: DossierBlock;
  contractHref: string;
}) => {
  const def = block.definition;
  const reqs = block.requirements?.items?.map(td) ?? [];
  const flow = block.flow?.items?.map(td) ?? [];
  const changes = block.changes?.items?.map(td) ?? [];
  const obligations = block.obligations?.items?.map(td) ?? [];
  const workflowRows = block.workflow?.rows ?? [];

  return (
    <section className="relative border-y border-border/60 bg-background py-16 sm:py-24">
      {/* Top tactical line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-tactical" />

      <div className="container">
        {/* Header */}
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.35em] text-accent sm:text-sm">
            {block.eyebrow ?? 'Dossiê Técnico'}
          </p>
          <h2 className="mt-4 font-heading text-3xl font-bold uppercase leading-tight tracking-tight sm:text-5xl">
            {block.title ?? 'Você entendeu a dor. Agora entenda a técnica.'}
          </h2>
          {block.intro && (
            <p className="mt-6 text-base text-muted-foreground sm:text-lg">{block.intro}</p>
          )}
          {block.legal_refs && block.legal_refs.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {block.legal_refs.map((r, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-accent/30 bg-accent/5 px-3 py-1.5 font-heading text-[11px] font-bold uppercase tracking-[0.18em] text-accent"
                >
                  <Scale className="size-3" /> {r}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 1. Definition: Posse vs Porte */}
        {def && (
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="font-heading text-5xl font-bold leading-none text-accent/40 tabular-nums">
                01
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Definição
              </span>
            </div>
            <h3 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {def.title ?? 'O que é, de fato, a Posse de Arma de Fogo'}
            </h3>
            {def.body && (
              <p className="mt-4 max-w-3xl text-muted-foreground">{def.body}</p>
            )}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
              <article className="group rounded-sm border border-primary/40 bg-primary/5 p-6 transition-colors hover:border-primary/70">
                <div className="flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">
                  <Home className="size-4" /> Posse permite
                </div>
                <ul className="mt-4 space-y-3">
                  {(def.allowed ?? []).map((it, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/90">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </article>
              <article className="group rounded-sm border border-destructive/40 bg-destructive/5 p-6 transition-colors hover:border-destructive/70">
                <div className="flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-destructive">
                  <Ban className="size-4" /> Posse NÃO autoriza
                </div>
                <ul className="mt-4 space-y-3">
                  {(def.forbidden ?? []).map((it, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/90">
                      <Ban className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        )}

        {/* 2. Requirements */}
        {reqs.length > 0 && (
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="font-heading text-5xl font-bold leading-none text-accent/40 tabular-nums">
                02
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Crivo Legal
              </span>
            </div>
            <h3 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.requirements?.title ?? 'Requisitos cumulativos da PF'}
            </h3>
            {block.requirements?.intro && (
              <p className="mt-4 max-w-3xl text-muted-foreground">
                {block.requirements.intro}
              </p>
            )}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reqs.map((it, i) => {
                const Icon = REQ_ICONS[i % REQ_ICONS.length];
                return (
                  <article
                    key={i}
                    className="rounded-sm border border-border bg-card p-5 transition-colors hover:border-accent/50"
                  >
                    <div className="flex size-10 items-center justify-center rounded-sm border border-accent/30 bg-accent/10 text-accent">
                      <Icon className="size-5" />
                    </div>
                    <h4 className="mt-4 font-heading text-sm font-bold uppercase tracking-wide">
                      {it.title}
                    </h4>
                    <p className="mt-2 text-sm text-muted-foreground">{it.desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Flow steps */}
        {flow.length > 0 && (
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="font-heading text-5xl font-bold leading-none text-accent/40 tabular-nums">
                03
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Passo a Passo
              </span>
            </div>
            <h3 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.flow?.title ?? 'O fluxo real do processo na PF'}
            </h3>
            {block.flow?.intro && (
              <p className="mt-4 max-w-3xl text-muted-foreground">{block.flow.intro}</p>
            )}
            <ol className="mt-8 space-y-4">
              {flow.map((it, i) => {
                const Icon = STEP_ICONS[i % STEP_ICONS.length];
                return (
                  <li
                    key={i}
                    className="relative grid grid-cols-[auto_auto_1fr] items-start gap-4 rounded-sm border border-border bg-card p-5 sm:gap-6 sm:p-6"
                  >
                    <span className="font-heading text-3xl font-bold tabular-nums text-accent sm:text-4xl">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex size-10 items-center justify-center rounded-sm border border-accent/30 bg-accent/10 text-accent sm:size-12">
                      <Icon className="size-5 sm:size-6" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-heading text-base font-bold uppercase tracking-wide sm:text-lg">
                        {it.title}
                      </h4>
                      {it.desc && (
                        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                          {it.desc}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* 4. Workflow table */}
        {workflowRows.length > 0 && (
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="font-heading text-5xl font-bold leading-none text-accent/40 tabular-nums">
                04
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Workflow
              </span>
            </div>
            <h3 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.workflow?.title ?? 'Resumo do fluxo de trabalho'}
            </h3>
            <div className="mt-8 overflow-hidden rounded-sm border border-border bg-border">
              <div className="grid grid-cols-[1fr_2fr_1.4fr] gap-px">
                {/* Header */}
                <div className="bg-surface-overlay px-4 py-3 font-heading text-[11px] font-bold uppercase tracking-[0.2em] text-accent sm:px-6 sm:text-xs">
                  Etapa
                </div>
                <div className="bg-surface-overlay px-4 py-3 font-heading text-[11px] font-bold uppercase tracking-[0.2em] text-accent sm:px-6 sm:text-xs">
                  Ação principal
                </div>
                <div className="bg-surface-overlay px-4 py-3 font-heading text-[11px] font-bold uppercase tracking-[0.2em] text-accent sm:px-6 sm:text-xs">
                  Validade / Prazo
                </div>
                {/* Rows */}
                {workflowRows.map((r, i) => (
                  <div key={i} className="contents">
                    <div className="bg-card px-4 py-4 font-heading text-sm font-bold uppercase tracking-wide text-foreground sm:px-6 sm:py-5 sm:text-base">
                      {r.stage}
                    </div>
                    <div className="bg-card px-4 py-4 text-sm text-foreground/90 sm:px-6 sm:py-5 sm:text-base">
                      {r.action}
                    </div>
                    <div className="bg-card px-4 py-4 text-sm text-muted-foreground sm:px-6 sm:py-5 sm:text-base">
                      {r.term}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. Decreto changes */}
        {changes.length > 0 && (
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="font-heading text-5xl font-bold leading-none text-accent/40 tabular-nums">
                05
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Mudanças do Decreto
              </span>
            </div>
            <h3 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.changes?.title ?? 'O que o Decreto 11.615/2023 mudou'}
            </h3>
            {block.changes?.intro && (
              <p className="mt-4 max-w-3xl text-muted-foreground">{block.changes.intro}</p>
            )}
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {changes.map((it, i) => {
                const Icon = CHANGE_ICONS[i % CHANGE_ICONS.length];
                return (
                  <article
                    key={i}
                    className="relative overflow-hidden rounded-sm border border-destructive/30 bg-destructive/5 p-6"
                  >
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-destructive/60" />
                    <Icon className="size-6 text-destructive" />
                    <h4 className="mt-4 font-heading text-base font-bold uppercase tracking-wide">
                      {it.title}
                    </h4>
                    <p className="mt-2 text-sm text-muted-foreground">{it.desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. Post-posse obligations */}
        {obligations.length > 0 && (
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="font-heading text-5xl font-bold leading-none text-accent/40 tabular-nums">
                06
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Pós-Posse
              </span>
            </div>
            <h3 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.obligations?.title ?? 'Obrigações contínuas do possuidor'}
            </h3>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {obligations.map((it, i) => {
                const Icon = OBLIGATION_ICONS[i % OBLIGATION_ICONS.length];
                return (
                  <article
                    key={i}
                    className="rounded-sm border border-border bg-card p-6"
                  >
                    <Icon className="size-5 text-accent" />
                    <h4 className="mt-3 font-heading text-sm font-bold uppercase tracking-wide">
                      {it.title}
                    </h4>
                    <p className="mt-2 text-sm text-muted-foreground">{it.desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* 07. Calibres permitidos vs restritos */}
        {block.calibers && (block.calibers.allowed?.length || block.calibers.restricted?.length) && (
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="font-heading text-5xl font-bold leading-none text-accent/40 tabular-nums">
                07
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Calibres
              </span>
            </div>
            <h3 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.calibers.title ?? 'Calibres permitidos vs. restritos para o civil'}
            </h3>
            {block.calibers.intro && (
              <p className="mt-4 max-w-3xl text-muted-foreground">{block.calibers.intro}</p>
            )}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
              <article className="rounded-sm border border-primary/40 bg-primary/5 p-6">
                <div className="flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">
                  <CheckCircle2 className="size-4" /> Permitidos para posse civil
                </div>
                <ul className="mt-4 space-y-3">
                  {(block.calibers.allowed ?? []).map((it, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 inline-flex min-w-[72px] justify-center rounded-sm border border-accent/40 bg-accent/10 px-2 py-1 font-heading text-[11px] font-bold uppercase tracking-wider text-accent">
                        {it.caliber}
                      </span>
                      {it.note && <span className="text-muted-foreground">{it.note}</span>}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="rounded-sm border border-destructive/40 bg-destructive/5 p-6">
                <div className="flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-destructive">
                  <XCircle className="size-4" /> Restritos (sem acesso civil)
                </div>
                <ul className="mt-4 space-y-3">
                  {(block.calibers.restricted ?? []).map((it, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 inline-flex min-w-[72px] justify-center rounded-sm border border-destructive/40 bg-destructive/10 px-2 py-1 font-heading text-[11px] font-bold uppercase tracking-wider text-destructive">
                        {it.caliber}
                      </span>
                      {it.note && <span className="text-muted-foreground">{it.note}</span>}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        )}

        {/* 08. Custos reais do processo */}
        {block.costs && block.costs.items?.length > 0 && (
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="font-heading text-5xl font-bold leading-none text-accent/40 tabular-nums">
                08
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Custos Reais
              </span>
            </div>
            <h3 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.costs.title ?? 'Custos reais do processo (além da nossa assessoria)'}
            </h3>
            {block.costs.intro && (
              <p className="mt-4 max-w-3xl text-muted-foreground">{block.costs.intro}</p>
            )}
            <div className="mt-8 overflow-hidden rounded-sm border border-border bg-card">
              <ul className="divide-y divide-border">
                {block.costs.items.map((it, i) => (
                  <li key={i} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-4 sm:gap-6 sm:px-6 sm:py-5">
                    <div className="flex size-9 items-center justify-center rounded-sm border border-accent/30 bg-accent/10 text-accent">
                      <Coins className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading text-sm font-bold uppercase tracking-wide">
                        {it.label}
                      </p>
                      {it.note && <p className="mt-1 text-xs text-muted-foreground">{it.note}</p>}
                    </div>
                    <p className="whitespace-nowrap font-heading text-sm font-bold tabular-nums text-accent sm:text-base">
                      {it.value}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            {block.costs.footnote && (
              <p className="mt-4 text-xs text-muted-foreground">{block.costs.footnote}</p>
            )}
          </div>
        )}

        {/* 09. Linha do tempo realista */}
        {block.timeline && block.timeline.items?.length > 0 && (
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="font-heading text-5xl font-bold leading-none text-accent/40 tabular-nums">
                09
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Linha do Tempo
              </span>
            </div>
            <h3 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.timeline.title ?? 'Quanto tempo leva, de verdade'}
            </h3>
            {block.timeline.intro && (
              <p className="mt-4 max-w-3xl text-muted-foreground">{block.timeline.intro}</p>
            )}
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {block.timeline.items.map((it, i) => (
                <li key={i} className="relative rounded-sm border border-border bg-card p-5">
                  <div className="flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">
                    <Clock className="size-4" /> Fase {String(i + 1).padStart(2, '0')}
                  </div>
                  <p className="mt-3 font-heading text-base font-bold uppercase tracking-wide">
                    {it.phase}
                  </p>
                  <p className="mt-1 font-heading text-sm font-bold text-accent">{it.range}</p>
                  {it.desc && <p className="mt-2 text-xs text-muted-foreground">{it.desc}</p>}
                </li>
              ))}
            </ol>
            {block.timeline.total && (
              <div className="mt-6 inline-flex items-center gap-2 rounded-sm border border-accent/40 bg-accent/10 px-4 py-2 font-heading text-sm font-bold uppercase tracking-wide text-accent">
                Total estimado: {block.timeline.total}
              </div>
            )}
          </div>
        )}

        {/* 10. Penalidades */}
        {block.penalties && block.penalties.rows?.length > 0 && (
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="font-heading text-5xl font-bold leading-none text-accent/40 tabular-nums">
                10
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Penalidades
              </span>
            </div>
            <h3 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.penalties.title ?? 'Penalidades por irregularidade'}
            </h3>
            {block.penalties.intro && (
              <p className="mt-4 max-w-3xl text-muted-foreground">{block.penalties.intro}</p>
            )}

            <div className="mt-8 overflow-hidden rounded-sm border border-border bg-card">
              <div className="grid grid-cols-[2fr_1fr_1fr] gap-px bg-border font-heading text-[11px] font-bold uppercase tracking-[0.2em] text-accent sm:text-xs">
                <div className="bg-surface-overlay px-4 py-3 sm:px-6">Conduta</div>
                <div className="bg-surface-overlay px-4 py-3 sm:px-6">Pena</div>
                <div className="bg-surface-overlay px-4 py-3 sm:px-6">Regime</div>
              </div>
              <div className="grid grid-cols-[2fr_1fr_1fr] gap-px bg-border">
                {block.penalties.rows.map((r, i) => (
                  <div key={i} className="contents">
                    <div className="bg-card px-4 py-4 text-sm text-foreground/90 sm:px-6 sm:py-5">
                      {r.offense}
                    </div>
                    <div className="bg-card px-4 py-4 sm:px-6 sm:py-5">
                      <span className="inline-flex rounded-sm border border-destructive/40 bg-destructive/10 px-2 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-destructive">
                        {r.range}
                      </span>
                    </div>
                    <div className="bg-card px-4 py-4 text-sm text-muted-foreground sm:px-6 sm:py-5">
                      {r.regime}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {block.penalties.warning && (
              <div className="mt-6 flex items-start gap-3 rounded-sm border border-destructive/40 bg-destructive/5 p-4">
                <AlertOctagon className="mt-0.5 size-5 shrink-0 text-destructive" />
                <p className="text-sm text-foreground/90">
                  <span className="font-heading font-bold uppercase tracking-wide text-destructive">
                    Atenção:
                  </span>{' '}
                  {block.penalties.warning}
                </p>
              </div>
            )}

            {block.penalties.chart && block.penalties.chart.length > 0 && (
              <div className="mt-8 rounded-sm border border-border bg-card p-4 sm:p-6">
                <p className="mb-4 font-heading text-sm font-bold uppercase tracking-wide">
                  Comparativo de Penas (em anos)
                </p>
                <div className="h-[460px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={block.penalties.chart}
                      layout="vertical"
                      margin={{ top: 10, right: 20, bottom: 60, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Anos', position: 'insideBottom', offset: -4, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="offense"
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 12 }}
                        width={110}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      />
                      <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12, paddingTop: 24, bottom: 0 }} />
                      <Bar dataKey="min" name="Pena mínima" fill="hsl(var(--accent) / 0.45)" />
                      <Bar dataKey="max" name="Pena máxima" fill="hsl(var(--accent))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 11. FAQ Técnico */}
        {block.faq_technical && block.faq_technical.items?.length > 0 && (
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="font-heading text-5xl font-bold leading-none text-accent/40 tabular-nums">
                11
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
                FAQ Técnico
              </span>
            </div>
            <h3 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {block.faq_technical.title ?? 'Perguntas técnicas frequentes'}
            </h3>
            {block.faq_technical.intro && (
              <p className="mt-4 max-w-3xl text-muted-foreground">{block.faq_technical.intro}</p>
            )}
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {block.faq_technical.items.map(qa).map((it, i) => (
                <article key={i} className="rounded-sm border border-border bg-card p-5">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="mt-0.5 size-4 shrink-0 text-accent" />
                    <h4 className="font-heading text-sm font-bold uppercase tracking-wide text-accent">
                      {it.q}
                    </h4>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{it.a}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Footnote + CTA */}
        {block.footnote && (
          <div className="mx-auto mt-16 max-w-4xl rounded-sm border-l-2 border-accent bg-surface-overlay/40 p-5">
            <p className="font-heading text-[11px] uppercase tracking-[0.22em] text-accent">
              Nota Técnica
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {block.footnote}
            </p>
          </div>
        )}

        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Esse é o caminho. A gente cuida do administrativo, você cuida da decisão.
          </p>
          <Button asChild size="lg" className="font-heading uppercase tracking-[0.1em]">
            <Link to={contractHref}>
              Quero contratar a assessoria <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ServiceLandingPage;

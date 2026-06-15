import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { SiteShell } from "@/shared/components/layout/SiteShell";
import { SEO } from "@/shared/components/SEO";
import { Button } from "@/components/ui/button";
import type { InfoPageConfig, InfoPageLink, InfoPageSection } from "./infoPages";

function CtaLink({ link, secondary = false }: { link: InfoPageLink; secondary?: boolean }) {
  const className = "w-full sm:w-auto font-heading uppercase tracking-[0.12em]";

  if (link.external) {
    return (
      <Button asChild size="lg" variant={secondary ? "outline" : "default"} className={className}>
        <a href={link.to} target="_blank" rel="noopener noreferrer">
          {link.label}
          {!secondary && <ArrowRight className="ml-2 size-4" />}
        </a>
      </Button>
    );
  }

  return (
    <Button asChild size="lg" variant={secondary ? "outline" : "default"} className={className}>
      <Link to={link.to}>
        {link.label}
        {!secondary && <ArrowRight className="ml-2 size-4" />}
      </Link>
    </Button>
  );
}

function SectionBlock({ section }: { section: InfoPageSection }) {
  return (
    <section id={section.id} className="rounded-sm border border-border/60 bg-card/90 p-6 shadow-deep sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-border/60" />
        <h2 className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-accent">
          {section.title}
        </h2>
        <span className="h-px flex-1 bg-border/60" />
      </div>

      <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
        {section.paragraphs?.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}

        {section.bullets && (
          <ul className="space-y-3">
            {section.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        {section.numberedItems && (
          <div className="space-y-4">
            {section.numberedItems.map((item, index) => (
              <article key={item.title} className="rounded-sm border border-border/50 bg-background/50 p-4 sm:p-5">
                <div className="mb-2 flex items-center gap-3">
                  <span className="font-heading text-xs uppercase tracking-[0.18em] text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-heading text-lg font-semibold uppercase tracking-[0.06em] text-foreground">
                    {item.title}
                  </h3>
                </div>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function InfoPageTemplate({ page }: { page: InfoPageConfig }) {
  return (
    <SiteShell>
      <SEO title={page.title} description={page.description} />

      <div className="relative left-1/2 w-dvw max-w-none -translate-x-1/2 overflow-x-clip border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.16),transparent_62%)]" />
        <div className="w-full px-4 py-10 sm:px-6 sm:py-14 lg:px-10 2xl:px-16">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-sm border border-primary/40 bg-primary/10 px-3 py-1.5">
              <span className="font-heading text-[11px] uppercase tracking-[0.22em] text-primary">
                {page.heroEyebrow}
              </span>
            </div>
            <h1 className="max-w-4xl font-heading text-3xl font-bold uppercase leading-[1.02] tracking-tight sm:text-5xl">
              {page.heroTitle}
            </h1>
            <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {page.heroParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaLink link={page.primaryCta} />
              {page.secondaryCta && <CtaLink link={page.secondaryCta} secondary />}
            </div>
          </div>
        </div>
      </div>

      <div className="relative left-1/2 w-dvw max-w-none -translate-x-1/2 overflow-x-clip bg-surface-overlay/35 py-10 sm:py-14">
        <div className="w-full px-4 sm:px-6 lg:px-10 2xl:px-16">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            {page.sections.map((section) => (
              <SectionBlock key={section.title} section={section} />
            ))}
          </div>
        </div>
      </div>

      {page.finalCta && (
        <div className="relative left-1/2 w-dvw max-w-none -translate-x-1/2 overflow-x-clip border-t border-border/60 bg-background py-12 sm:py-16">
          <div className="w-full px-4 sm:px-6 lg:px-10 2xl:px-16">
            <div className="mx-auto max-w-4xl rounded-sm border border-primary/30 bg-card p-8 text-center shadow-deep sm:p-10">
              <div className="mb-3 inline-flex items-center gap-2 font-heading text-[11px] uppercase tracking-[0.22em] text-accent">
                Encerramento
                <ChevronRight className="size-3.5" />
              </div>
              <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl">
                {page.finalCta.title}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {page.finalCta.description}
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
                <CtaLink link={page.finalCta.primary} />
                {page.finalCta.secondary && <CtaLink link={page.finalCta.secondary} secondary />}
              </div>
            </div>
          </div>
        </div>
      )}
    </SiteShell>
  );
}

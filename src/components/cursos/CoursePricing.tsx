import { Course } from '@/shared/data/coursesCatalog';
import { Check, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildWhatsAppLink } from '@/shared/data/coursesCatalog';

interface CoursePricingProps {
  course: Course;
}

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const CoursePricing = ({ course }: CoursePricingProps) => {
  if (!course.pricing?.enabled) return null;
  const { pricing } = course;

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-sm border border-accent/40 bg-accent/5 px-3 py-1.5">
          <Users className="size-3.5 text-accent" />
          <p className="font-heading text-[10px] uppercase tracking-[0.25em] text-accent">
            Engajamento · Reserva de posição
          </p>
        </div>
        <h3 className="mb-4 font-heading text-2xl uppercase leading-tight tracking-tight text-foreground sm:text-3xl">
          {pricing.classSize.split(' ').map((word, i) =>
            /\d/.test(word) ? (
              <span key={i} className="text-accent">
                {word}{' '}
              </span>
            ) : (
              <span key={i}>{word} </span>
            ),
          )}
        </h3>
        <p className="text-base text-muted-foreground sm:text-lg">{pricing.rationale}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {pricing.tiers.map((tier) => {
          const wa = buildWhatsAppLink(
            course.whatsappNumber,
            `Olá! Tenho interesse no curso ${course.title} — plano ${tier.name} (R$ ${formatBRL(tier.price)}).`,
          );
          const isElite = !!tier.emphasis;
          return (
            <div
              key={tier.id}
              className={`group relative overflow-hidden rounded-md border p-6 transition-all duration-300 sm:p-8 ${
                isElite
                  ? 'border-accent/60 bg-gradient-to-br from-accent/[0.06] via-background to-background shadow-[0_0_60px_-20px_hsl(var(--accent)/0.4)]'
                  : 'border-border/60 bg-surface-elevated/40 hover:border-accent/40'
              }`}
            >
              {tier.badge && (
                <div className="absolute right-0 top-0 flex items-center gap-1.5 border-b border-l border-accent/60 bg-accent/10 px-3 py-1.5 backdrop-blur-sm">
                  <span className="size-1.5 rounded-full bg-accent shadow-[0_0_6px_hsl(var(--accent))]" />
                  <span className="font-heading text-[10px] uppercase tracking-[0.25em] text-accent">
                    {tier.badge}
                  </span>
                </div>
              )}

              <p className="mb-3 font-heading text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {tier.name}
              </p>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  R$
                </span>
                <span className="font-heading text-5xl uppercase tracking-tight text-foreground sm:text-6xl">
                  {formatBRL(tier.price)}
                </span>
              </div>
              <p className="mb-6 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                {tier.installments}
              </p>
              <p className="mb-6 text-sm text-foreground/80 sm:text-base">{tier.tagline}</p>

              <ul className="mb-8 space-y-3">
                {tier.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3 text-sm text-foreground/85">
                    <Check
                      className={`mt-0.5 size-4 shrink-0 ${isElite ? 'text-accent' : 'text-accent/70'}`}
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                size="lg"
                variant={isElite ? 'default' : 'outline'}
                className="w-full font-heading uppercase tracking-[0.15em]"
              >
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  Reservar — {tier.name.split(' · ')[1] ?? tier.name}
                </a>
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
          <MapPin className="size-3.5 text-accent" />
          <span>
            {course.location.city.toUpperCase()} / {course.location.state} · TURMA DE {course.weekday.toUpperCase()}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground/80 sm:max-w-md sm:text-right">
          {pricing.footnote}
        </p>
      </div>
    </div>
  );
};

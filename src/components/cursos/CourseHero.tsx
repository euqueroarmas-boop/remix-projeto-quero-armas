import { Button } from '@/components/ui/button';
import { ArrowRight, MessageCircle, ChevronDown, ShieldCheck, Clock, MapPin } from 'lucide-react';
import { Course, buildWhatsAppLink } from '@/shared/data/coursesCatalog';
import heroImage from '@/assets/cursos/operador-pistola-hero.jpg';

interface CourseHeroProps {
  course: Course;
}

export const CourseHero = ({ course }: CourseHeroProps) => {
  const wa = buildWhatsAppLink(course.whatsappNumber, course.whatsappMessage);
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-background">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          width={1920}
          height={1080}
          className="h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--accent)/0.18),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <div className="container relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-10 sm:py-24 lg:py-28">
        <div className="animate-fade-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/5 px-4 py-1.5 backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]" />
            <p className="font-heading text-xs uppercase tracking-[0.3em] text-accent">
              Cursos · {course.categoryLabel} · Nível {course.level}
            </p>
          </div>
          <h1 className="mb-6 max-w-4xl font-heading text-4xl uppercase leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-7xl">
            {course.heroTitle}
          </h1>
          <p className="mb-6 max-w-3xl text-lg text-foreground/80 sm:text-xl">{course.heroSubtitle}</p>
          {course.heroImpact && (
            <p className="mb-10 max-w-3xl border-l-2 border-accent pl-5 text-base italic text-muted-foreground sm:text-lg">
              {course.heroImpact}
            </p>
          )}
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="font-heading uppercase tracking-[0.15em] shadow-[0_0_30px_hsl(var(--accent)/0.25)]">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                {course.ctaWhatsApp} <ArrowRight className="ml-2 size-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="font-heading uppercase tracking-[0.15em] backdrop-blur-sm">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 size-4" /> Falar com a Quero Armas
              </a>
            </Button>
            <Button asChild variant="ghost" size="lg" className="font-heading uppercase tracking-[0.15em]">
              <a href="#detalhes">
                Ver detalhes <ChevronDown className="ml-2 size-4" />
              </a>
            </Button>
          </div>

          {/* Hero meta strip */}
          <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
            {[
              { icon: Clock, label: 'Duração', value: '8 horas' },
              { icon: ShieldCheck, label: 'Formato', value: 'Supervisionado' },
              { icon: MapPin, label: 'Local', value: 'Jacareí — SP' },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-md border border-border/60 bg-surface-overlay/60 p-3 backdrop-blur-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-accent/30 bg-accent/10 text-accent">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="truncate text-sm font-medium text-foreground">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
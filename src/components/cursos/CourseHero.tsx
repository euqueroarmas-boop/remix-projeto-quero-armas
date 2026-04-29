import { Button } from '@/components/ui/button';
import { ArrowRight, MessageCircle, ChevronDown } from 'lucide-react';
import { Course, buildWhatsAppLink } from '@/shared/data/coursesCatalog';

interface CourseHeroProps {
  course: Course;
}

export const CourseHero = ({ course }: CourseHeroProps) => {
  const wa = buildWhatsAppLink(course.whatsappNumber, course.whatsappMessage);
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.08),transparent_60%)]" />
      <div className="container relative z-10 mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <p className="mb-4 font-heading text-xs uppercase tracking-[0.3em] text-accent">
          Cursos · {course.categoryLabel}
        </p>
        <h1 className="mb-6 font-heading text-4xl uppercase leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          {course.heroTitle}
        </h1>
        <p className="mb-6 max-w-3xl text-lg text-muted-foreground sm:text-xl">{course.heroSubtitle}</p>
        {course.heroImpact && (
          <p className="mb-10 max-w-3xl border-l-2 border-accent/60 pl-4 text-base text-foreground/80 sm:text-lg">
            {course.heroImpact}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button asChild size="lg" className="font-heading uppercase tracking-[0.15em]">
            <a href={wa} target="_blank" rel="noopener noreferrer">
              {course.ctaWhatsApp} <ArrowRight className="ml-2 size-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="font-heading uppercase tracking-[0.15em]">
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 size-4" /> Falar com a Quero Armas
            </a>
          </Button>
          <Button asChild variant="ghost" size="lg" className="font-heading uppercase tracking-[0.15em]">
            <a href="#detalhes">
              Ver detalhes do curso <ChevronDown className="ml-2 size-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};
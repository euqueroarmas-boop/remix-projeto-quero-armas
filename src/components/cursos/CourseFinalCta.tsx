import { Button } from '@/components/ui/button';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Course, buildWhatsAppLink } from '@/shared/data/coursesCatalog';

interface CourseFinalCtaProps {
  course: Course;
}

export const CourseFinalCta = ({ course }: CourseFinalCtaProps) => {
  const wa = buildWhatsAppLink(course.whatsappNumber, course.whatsappMessage);
  return (
    <section className="border-b border-border/60 bg-gradient-to-b from-background to-surface-overlay/60">
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
        <h2 className="mb-4 font-heading text-3xl uppercase leading-tight tracking-tight text-foreground sm:text-4xl">
          Comece do jeito certo. Com segurança, responsabilidade e orientação.
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Antes de buscar confiança com uma pistola, busque preparo. O Operador de Pistola — Nível I é o
          primeiro passo para quem quer treinar com seriedade.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full font-heading uppercase tracking-[0.15em] sm:w-auto">
            <a href={wa} target="_blank" rel="noopener noreferrer">
              Reservar minha vaga <ArrowRight className="ml-2 size-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full font-heading uppercase tracking-[0.15em] sm:w-auto">
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 size-4" /> Falar com a equipe
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};
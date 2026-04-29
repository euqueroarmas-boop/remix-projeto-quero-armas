import { useParams, Link } from 'react-router-dom';
import { findCourseBySlug, buildWhatsAppLink } from '@/shared/data/coursesCatalog';
import { CourseLandingPage } from '@/components/cursos/CourseLandingPage';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { SEO } from '@/shared/components/SEO';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, Clock } from 'lucide-react';

export default function CursoPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const course = findCourseBySlug(slug);

  if (!course) {
    return (
      <SiteShell hideBackButton>
        <SEO
          title="Curso não encontrado | Quero Armas"
          description="Este curso não está disponível."
          canonical={`/cursos/${slug}`}
        />
        <div className="container mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="mb-4 font-heading text-3xl uppercase">Curso não encontrado</h1>
          <p className="mb-8 text-muted-foreground">
            O curso que você procura não existe ou foi movido.
          </p>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 size-4" /> Voltar para a home
            </Link>
          </Button>
        </div>
      </SiteShell>
    );
  }

  if (course.status === 'em_breve') {
    const wa = buildWhatsAppLink(course.whatsappNumber, course.whatsappMessage);
    return (
      <SiteShell hideBackButton>
        <SEO
          title={course.seoTitle}
          description={course.seoDescription}
          canonical={`/cursos/${course.slug}`}
        />
        <div className="container mx-auto max-w-3xl px-4 py-24 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 font-heading text-xs uppercase tracking-[0.2em] text-accent">
            <Clock className="size-3.5" /> Em breve
          </span>
          <h1 className="mb-4 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl">
            {course.title}
          </h1>
          <p className="mb-8 text-muted-foreground sm:text-lg">
            Estamos preparando este curso. Fale com a equipe Quero Armas para ser avisado quando a
            próxima turma abrir.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="font-heading uppercase tracking-[0.15em]">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 size-4" /> Falar com a equipe
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="font-heading uppercase tracking-[0.15em]">
              <Link to="/cursos/operador-de-pistola-nivel-i">
                Conhecer o Nível I
              </Link>
            </Button>
          </div>
        </div>
      </SiteShell>
    );
  }

  return <CourseLandingPage course={course} />;
}
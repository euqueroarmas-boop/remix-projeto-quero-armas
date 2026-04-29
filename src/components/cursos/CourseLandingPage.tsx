import { SiteShell } from '@/shared/components/layout/SiteShell';
import { SEO } from '@/shared/components/SEO';
import { Course } from '@/shared/data/coursesCatalog';
import { CourseHero } from './CourseHero';
import { CourseSection } from './CourseSection';
import { CourseBenefits } from './CourseBenefits';
import { CourseIncludedItems } from './CourseIncludedItems';
import { CourseTimeline } from './CourseTimeline';
import { CourseLocationCard } from './CourseLocationCard';
import { CourseFaq } from './CourseFaq';
import { CourseFinalCta } from './CourseFinalCta';
import { AlertTriangle, Users } from 'lucide-react';

interface CourseLandingPageProps {
  course: Course;
}

export const CourseLandingPage = ({ course }: CourseLandingPageProps) => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.shortDescription,
    provider: {
      '@type': 'Organization',
      name: 'Quero Armas',
      url: 'https://queroarmas.com.br',
    },
    locationCreated: {
      '@type': 'Place',
      name: course.location.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: course.location.address,
        addressLocality: course.location.city,
        addressRegion: course.location.state,
        postalCode: course.location.zip,
        addressCountry: 'BR',
      },
    },
  };

  return (
    <SiteShell>
      <SEO
        title={course.seoTitle}
        description={course.seoDescription}
        canonical={`/cursos/${course.slug}`}
        type="website"
        jsonLd={jsonLd}
      />

      <CourseHero course={course} />

      <CourseSection
        id="conscientizacao"
        eyebrow="Consciência"
        title="O maior risco não está na arma. Está na falta de preparo."
        tone="muted"
      >
        <div className="space-y-4 text-base text-muted-foreground sm:text-lg">
          <p>
            Muitas pessoas buscam uma arma de fogo pensando apenas na compra, no documento ou na sensação
            de segurança. Mas a verdade é simples: sem treinamento, uma arma pode se tornar um risco para
            você, para sua família e para terceiros.
          </p>
          <p>
            O curso Operador de Pistola — Nível I foi criado para quem entende que responsabilidade vem
            antes da posse, que segurança vem antes da confiança e que treinamento sério começa pelo
            básico bem feito.
          </p>
        </div>
      </CourseSection>

      <CourseSection
        id="para-quem-e"
        eyebrow="Público"
        title={`Para quem é o ${course.title}?`}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {course.targetAudience.map((item) => (
            <div
              key={item}
              className="flex items-start gap-3 rounded-md border border-border/50 bg-surface-elevated/40 p-4 transition-colors hover:border-accent/50"
            >
              <Users className="mt-0.5 size-5 shrink-0 text-accent" />
              <span className="text-sm text-foreground/90 sm:text-base">{item}</span>
            </div>
          ))}
        </div>
      </CourseSection>

      <CourseSection
        id="detalhes"
        eyebrow="Formação"
        title="O que você vai desenvolver"
        description="Conteúdo institucional e formativo, sem técnica operacional sensível."
        tone="muted"
      >
        <CourseBenefits items={course.benefits} />
      </CourseSection>

      <CourseSection eyebrow="Estrutura" title="O que está incluso no curso">
        <CourseIncludedItems items={course.includedItems} />
      </CourseSection>

      <CourseSection eyebrow="Processo" title="Como funciona o treinamento" tone="muted">
        <CourseTimeline steps={course.timeline} />
      </CourseSection>

      <CourseSection
        eyebrow="Quero Armas"
        title="Treinamento sério para quem leva segurança a sério."
      >
        <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
          A Quero Armas atua com orientação, documentação e acompanhamento de clientes que buscam
          regularidade, segurança jurídica e responsabilidade no universo das armas de fogo. O curso
          Operador de Pistola — Nível I nasce dentro dessa mesma visão: formar alunos mais conscientes,
          mais cuidadosos e mais preparados para agir dentro da lei e das regras de segurança.
        </p>
      </CourseSection>

      <CourseSection eyebrow="Local" title="Onde acontece o curso" tone="muted">
        <CourseLocationCard course={course} />
      </CourseSection>

      <section className="border-b border-border/60 bg-background">
        <div className="container mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <div className="rounded-lg border border-accent/40 bg-accent/5 p-6 sm:p-8">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-sm border border-accent/40 bg-accent/10 text-accent">
                <AlertTriangle className="size-5" />
              </span>
              <p className="font-heading text-xs uppercase tracking-[0.25em] text-accent">
                Aviso de responsabilidade
              </p>
            </div>
            <h2 className="mb-3 font-heading text-xl uppercase leading-tight tracking-tight text-foreground sm:text-2xl">
              Este curso não é promessa de autorização, posse, porte ou aprovação administrativa.
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              O Operador de Pistola — Nível I é um curso de formação e treinamento responsável. Ele não
              substitui exigências legais, avaliações psicológicas, testes de capacidade técnica,
              autorizações administrativas ou qualquer procedimento exigido pelos órgãos competentes.
            </p>
          </div>
        </div>
      </section>

      <CourseSection eyebrow="FAQ" title="Perguntas frequentes" tone="muted">
        <CourseFaq items={course.faq} />
      </CourseSection>

      <CourseFinalCta course={course} />
    </SiteShell>
  );
};
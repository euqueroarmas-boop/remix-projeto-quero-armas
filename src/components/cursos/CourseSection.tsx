import { ReactNode } from 'react';

interface CourseSectionProps {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  tone?: 'default' | 'muted';
}

export const CourseSection = ({
  id,
  eyebrow,
  title,
  description,
  children,
  tone = 'default',
}: CourseSectionProps) => {
  return (
    <section
      id={id}
      className={`border-b border-border/60 ${tone === 'muted' ? 'bg-surface-overlay/40' : 'bg-background'}`}
    >
      <div className="container mx-auto max-w-5xl px-4 py-14 sm:py-20">
        {eyebrow && (
          <p className="mb-3 font-heading text-xs uppercase tracking-[0.3em] text-accent">{eyebrow}</p>
        )}
        <h2 className="mb-4 font-heading text-2xl uppercase leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          {title}
        </h2>
        {description && <p className="mb-8 max-w-3xl text-base text-muted-foreground sm:text-lg">{description}</p>}
        {children}
      </div>
    </section>
  );
};
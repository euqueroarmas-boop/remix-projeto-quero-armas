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
      className={`relative border-b border-border/60 ${tone === 'muted' ? 'bg-surface-overlay/40' : 'bg-background'}`}
    >
      <div className="container mx-auto max-w-6xl px-4 py-16 sm:py-24">
        {eyebrow && (
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-8 bg-accent/60" />
            <p className="font-heading text-xs uppercase tracking-[0.3em] text-accent">{eyebrow}</p>
          </div>
        )}
        <h2 className="mb-4 max-w-4xl font-heading text-2xl uppercase leading-[1.1] tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          {title}
        </h2>
        {description && (
          <p className="mb-10 max-w-3xl text-base text-muted-foreground sm:text-lg">{description}</p>
        )}
        {!description && <div className="mb-10" />}
        {children}
      </div>
    </section>
  );
};
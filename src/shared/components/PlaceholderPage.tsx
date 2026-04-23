import { ReactNode } from 'react';

interface PlaceholderProps {
  title: string;
  description: string;
  layer: 'public' | 'transactional' | 'portal' | 'admin';
  children?: ReactNode;
}

export const PlaceholderPage = ({ title, description, layer, children }: PlaceholderProps) => (
  <div className="container py-16">
    <div className="mx-auto max-w-2xl rounded-sm border border-border bg-card p-12 text-center shadow-deep">
      <div className="mb-3 font-heading text-xs uppercase tracking-[0.2em] text-accent">
        Camada · {layer}
      </div>
      <h1 className="mb-4 font-heading text-3xl font-bold uppercase tracking-tight">{title}</h1>
      <p className="mb-6 text-muted-foreground">{description}</p>
      <div className="inline-flex items-center gap-2 rounded-sm border border-primary/40 bg-primary/10 px-4 py-1.5 font-heading text-xs uppercase tracking-widest text-primary-foreground/90">
        <span className="size-1.5 animate-pulse rounded-full bg-primary" />
        Em breve
      </div>
      {children && <div className="mt-8">{children}</div>}
    </div>
  </div>
);

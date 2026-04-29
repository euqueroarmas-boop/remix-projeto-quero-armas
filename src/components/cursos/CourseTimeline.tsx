import { CourseTimelineStep } from '@/shared/data/coursesCatalog';
import { ArrowRight } from 'lucide-react';

interface CourseTimelineProps {
  steps: CourseTimelineStep[];
}

export const CourseTimeline = ({ steps }: CourseTimelineProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <div
          key={s.step}
          className="group relative overflow-hidden rounded-md border border-border/60 bg-surface-elevated/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_8px_30px_hsl(var(--accent)/0.12)]"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="mb-4 flex items-center justify-between">
            <span className="flex size-10 items-center justify-center rounded-sm border border-accent/40 bg-accent/10 font-heading text-sm text-accent">
              {s.step}
            </span>
            {i < steps.length - 1 && (
              <ArrowRight className="size-4 text-border transition-colors group-hover:text-accent/60" />
            )}
          </div>
          <h3 className="mb-2 font-heading text-base uppercase leading-tight tracking-wide text-foreground">
            {s.title}
          </h3>
          <p className="text-sm text-muted-foreground">{s.description}</p>
        </div>
      ))}
    </div>
  );
};
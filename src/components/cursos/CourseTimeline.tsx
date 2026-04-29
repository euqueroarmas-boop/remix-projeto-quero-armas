import { CourseTimelineStep } from '@/shared/data/coursesCatalog';

interface CourseTimelineProps {
  steps: CourseTimelineStep[];
}

export const CourseTimeline = ({ steps }: CourseTimelineProps) => {
  return (
    <ol className="relative space-y-6 border-l border-border/60 pl-6">
      {steps.map((s) => (
        <li key={s.step} className="relative">
          <span className="absolute -left-[34px] flex size-8 items-center justify-center rounded-full border border-accent/40 bg-background font-heading text-xs text-accent">
            {s.step}
          </span>
          <h3 className="font-heading text-base uppercase tracking-wide text-foreground sm:text-lg">
            Etapa {s.step} — {s.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{s.description}</p>
        </li>
      ))}
    </ol>
  );
};
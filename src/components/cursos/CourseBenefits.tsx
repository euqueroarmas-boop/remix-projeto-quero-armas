import { CheckCircle2 } from 'lucide-react';

interface CourseBenefitsProps {
  items: string[];
}

export const CourseBenefits = ({ items }: CourseBenefitsProps) => {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
      {items.map((item) => (
        <li
          key={item}
          className="group flex items-start gap-3 rounded-md border border-border/50 bg-surface-elevated/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/60 hover:bg-surface-elevated/70"
        >
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
            <CheckCircle2 className="size-4" />
          </span>
          <span className="text-sm text-foreground/90 sm:text-base">{item}</span>
        </li>
      ))}
    </ul>
  );
};
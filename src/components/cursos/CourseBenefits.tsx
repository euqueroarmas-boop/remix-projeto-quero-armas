import { CheckCircle2 } from 'lucide-react';

interface CourseBenefitsProps {
  items: string[];
}

export const CourseBenefits = ({ items }: CourseBenefitsProps) => {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-3 rounded-md border border-border/50 bg-surface-elevated/40 p-4 transition-colors hover:border-accent/50"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" />
          <span className="text-sm text-foreground/90 sm:text-base">{item}</span>
        </li>
      ))}
    </ul>
  );
};
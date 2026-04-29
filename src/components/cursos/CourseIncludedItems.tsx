import {
  Clock, Coffee, Target, Package, Glasses, Volume2, Building2, UserCheck, ShieldCheck,
} from 'lucide-react';

const ICONS = [Clock, Coffee, Target, Package, Glasses, Volume2, Building2, UserCheck, ShieldCheck];

interface CourseIncludedItemsProps {
  items: string[];
}

export const CourseIncludedItems = ({ items }: CourseIncludedItemsProps) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, idx) => {
        const Icon = ICONS[idx % ICONS.length];
        return (
          <div
            key={item}
            className="group flex items-center gap-3 rounded-md border border-border/50 bg-surface-elevated/40 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_8px_24px_hsl(var(--accent)/0.1)]"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-accent/30 bg-accent/10 text-accent transition-all group-hover:scale-105 group-hover:border-accent/60 group-hover:bg-accent/20">
              <Icon className="size-5" />
            </span>
            <span className="text-sm text-foreground sm:text-base">{item}</span>
          </div>
        );
      })}
    </div>
  );
};
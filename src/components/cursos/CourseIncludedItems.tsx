import {
  Clock, Coffee, Target, Package, Glasses, Volume2, Building2, UserCheck, ShieldCheck,
} from 'lucide-react';

const ICONS = [Clock, Coffee, Target, Package, Glasses, Volume2, Building2, UserCheck, ShieldCheck];

interface CourseIncludedItemsProps {
  items: string[];
}

export const CourseIncludedItems = ({ items }: CourseIncludedItemsProps) => {
  return (
    <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, idx) => {
        const Icon = ICONS[idx % ICONS.length];
        return (
          <li key={item} className="flex items-start gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.5} />
            <span className="text-base leading-snug text-foreground/90">{item}</span>
          </li>
        );
      })}
    </ul>
  );
};
interface CourseBenefitsProps {
  items: string[];
}

export const CourseBenefits = ({ items }: CourseBenefitsProps) => {
  return (
    <ul className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
      {items.map((item, idx) => (
        <li
          key={item}
          className="group flex items-start gap-4 border-b border-border/40 pb-5 last:border-b-0"
        >
          <span className="font-heading text-xs uppercase tracking-[0.2em] text-accent/80 pt-0.5">
            {String(idx + 1).padStart(2, '0')}
          </span>
          <span className="text-base leading-relaxed text-foreground/90 sm:text-lg">{item}</span>
        </li>
      ))}
    </ul>
  );
};
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { CourseFaqItem } from '@/shared/data/coursesCatalog';

interface CourseFaqProps {
  items: CourseFaqItem[];
}

export const CourseFaq = ({ items }: CourseFaqProps) => {
  return (
    <Accordion type="single" collapsible className="mx-auto w-full max-w-3xl space-y-3">
      {items.map((item, idx) => (
        <AccordionItem
          key={idx}
          value={`item-${idx}`}
          className="overflow-hidden rounded-md border border-border/60 bg-surface-elevated/40 px-5 transition-colors data-[state=open]:border-accent/50 data-[state=open]:bg-surface-elevated/70"
        >
          <AccordionTrigger className="text-left font-heading text-sm uppercase tracking-wide text-foreground hover:text-accent hover:no-underline sm:text-base">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground sm:text-base">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
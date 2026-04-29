import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { CourseFaqItem } from '@/shared/data/coursesCatalog';

interface CourseFaqProps {
  items: CourseFaqItem[];
}

export const CourseFaq = ({ items }: CourseFaqProps) => {
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((item, idx) => (
        <AccordionItem key={idx} value={`item-${idx}`} className="border-border/60">
          <AccordionTrigger className="text-left font-heading text-base uppercase tracking-wide text-foreground hover:text-accent sm:text-lg">
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
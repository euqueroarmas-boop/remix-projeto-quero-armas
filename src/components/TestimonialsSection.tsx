import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const TestimonialsSection = () => {
  const { t } = useTranslation();
  const items = t("testimonials.items", { returnObjects: true }) as {
    name: string;
    role: string;
    company: string;
    text: string;
  }[];

  const initials = ["TP", "FO", "RS"];

  return (
    <section className="py-20 md:py-24 section-dark">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 md:mb-16"
        >
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            {t("testimonials.tag")}
          </p>
          <h2 className="text-2xl md:text-5xl max-w-2xl">
            {t("testimonials.title")} <span className="text-primary">{t("testimonials.titleHighlight")}</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-px bg-border">
          {items.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="bg-background p-6 md:p-8 group hover:bg-muted/50 transition-colors duration-300 relative flex flex-col"
            >
              <Quote
                size={32}
                className="text-primary/20 absolute top-6 right-6"
                strokeWidth={1}
              />

              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star key={idx} size={14} className="text-primary fill-primary" />
                ))}
              </div>

              <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mb-6 flex-1">
                "{item.text}"
              </p>

              <div className="border-t border-border pt-4 flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-primary/30">
                  <AvatarFallback className="bg-primary/10 text-primary font-mono text-xs font-bold">
                    {initials[i] || item.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-heading text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="font-mono text-[10px] md:text-xs text-muted-foreground tracking-wider uppercase">{item.role}</p>
                  <p className="font-mono text-[10px] md:text-xs text-primary/70 tracking-wider">{item.company}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;

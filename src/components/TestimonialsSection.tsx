import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const testimonials = [
  {
    name: "Maria Angela",
    role: "Tabeliã",
    company: "1º Tabelião de Jacareí",
    text: "A WMTi reestruturou toda nossa infraestrutura de rede e servidores. Desde a migração para o PowerEdge, não tivemos nenhuma parada crítica. Atendimento excepcional.",
    stars: 5,
    initials: "TP",
  },
  {
    name: "Fernanda Oliveira",
    role: "Gerente Administrativa",
    company: "Construtora Horizonte",
    text: "O serviço de locação de desktops transformou nossa operação. Sem investimento inicial e com suporte técnico incluso, ganhamos agilidade e economia.",
    stars: 5,
    initials: "FO",
  },
  {
    name: "Ricardo Santos",
    role: "Sócio-Proprietário",
    company: "Escritório Santos & Associados",
    text: "A implementação do pfSense com VPN site-to-site conectou nossas 3 unidades com segurança. O monitoramento 24/7 nos dá total tranquilidade.",
    stars: 5,
    initials: "RS",
  },
];

const TestimonialsSection = () => {
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
            // Depoimentos
          </p>
          <h2 className="text-2xl md:text-5xl max-w-2xl">
            Quem confia na <span className="text-primary">WMTi</span>.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-px bg-border">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
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
                {Array.from({ length: t.stars }).map((_, idx) => (
                  <Star
                    key={idx}
                    size={14}
                    className="text-primary fill-primary"
                  />
                ))}
              </div>

              <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mb-6 flex-1">
                "{t.text}"
              </p>

              <div className="border-t border-border pt-4 flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-primary/30">
                  <AvatarFallback className="bg-primary/10 text-primary font-mono text-xs font-bold">
                    {t.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-heading text-sm font-semibold text-foreground">
                    {t.name}
                  </p>
                  <p className="font-mono text-[10px] md:text-xs text-muted-foreground tracking-wider uppercase">
                    {t.role}
                  </p>
                  <p className="font-mono text-[10px] md:text-xs text-primary/70 tracking-wider">
                    {t.company}
                  </p>
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

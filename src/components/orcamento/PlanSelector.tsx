import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";

export interface Plan {
  id: string;
  name: string;
  cpu: string;
  ram: string;
  ssd: string;
  extras: string[];
  price: number;
  popular?: boolean;
}

export const plans: Plan[] = [
  {
    id: "essencial",
    name: "Essencial",
    cpu: "Core i5 8ª geração",
    ram: "16GB RAM",
    ssd: "240GB SSD",
    extras: ["Placa de rede Gigabit", "Monitor Dell 18.5\"", "Teclado e mouse"],
    price: 249,
  },
  {
    id: "equilibrio",
    name: "Equilíbrio",
    cpu: "Core i5 10ª geração",
    ram: "16GB RAM",
    ssd: "240GB SSD",
    extras: ["Placa de rede Gigabit", "Monitor Dell 18.5\"", "Teclado e mouse"],
    price: 299,
    popular: true,
  },
  {
    id: "performance",
    name: "Performance",
    cpu: "Core i5 13ª geração",
    ram: "16GB RAM",
    ssd: "240GB SSD",
    extras: ["Placa de rede Gigabit", "Monitor Dell 18.5\"", "Teclado e mouse"],
    price: 399,
  },
];

interface Props {
  selectedPlan: string;
  onSelectPlan: (planId: string) => void;
}

const PlanSelector = ({ selectedPlan, onSelectPlan }: Props) => {
  return (
    <section id="plans" className="py-20 section-dark">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            Configurações
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            Escolha a <span className="text-primary">configuração</span> ideal
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Dell OptiPlex — o desktop corporativo mais confiável do mercado.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                onClick={() => onSelectPlan(plan.id)}
                className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all duration-300 hover:scale-[1.02] ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-card hover:border-primary/30"
                } ${plan.popular ? "md:-mt-4 md:mb-0" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" /> Mais escolhido
                  </div>
                )}

                <h3 className="text-xl font-heading font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">Dell OptiPlex</p>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" /> {plan.cpu}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" /> {plan.ram}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" /> {plan.ssd}
                  </div>
                  {plan.extras.map((e, j) => (
                    <div key={j} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary" /> {e}
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-heading font-bold text-primary">
                      R${plan.price}
                    </span>
                    <span className="text-sm text-muted-foreground">/computador/mês</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-muted-foreground mt-8 max-w-xl mx-auto"
        >
          Todas as locações incluem suporte de serviços durante toda a vigência do contrato.
        </motion.p>
      </div>
    </section>
  );
};

export default PlanSelector;

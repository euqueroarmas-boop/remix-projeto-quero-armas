import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Check, Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    cpu: "Intel Core i3 (8ª à 12ª geração)",
    ram: "8GB RAM",
    ssd: "240GB SSD",
    extras: ["Placa de rede Gigabit", "Monitor Dell 18.5\"", "Teclado e mouse"],
    price: 249,
  },
  {
    id: "equilibrio",
    name: "Equilíbrio",
    cpu: "Intel Core i5 (8ª à 13ª geração)",
    ram: "16GB RAM",
    ssd: "240GB SSD",
    extras: ["Placa de rede Gigabit", "Monitor Dell 18.5\"", "Teclado e mouse"],
    price: 299,
    popular: true,
  },
  {
    id: "performance",
    name: "Performance",
    cpu: "Intel Core i7 (10ª à 14ª geração)",
    ram: "16GB RAM",
    ssd: "240GB SSD",
    extras: ["Placa de rede Gigabit", "Monitor Dell 18.5\"", "Teclado e mouse"],
    price: 399,
  },
];

interface Props {
  selectedPlan: string;
  onSelectPlan: (planId: string) => void;
  onShowBudget?: () => void;
}

const PlanSelector = ({ selectedPlan, onSelectPlan, onShowBudget }: Props) => {
  const { t } = useTranslation();
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
            A recomendação automática usa seu perfil de uso, mas você pode ajustar manualmente antes de contratar.
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
                <p className="text-sm text-muted-foreground mb-4">Configuração corporativa WMTi</p>

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
                    <span className="text-3xl font-heading font-bold text-primary">R${plan.price}</span>
                    <span className="text-sm text-muted-foreground">/computador/mês</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA button — appears right after cards when a plan is selected */}
        {selectedPlan && onShowBudget && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 max-w-md mx-auto text-center"
          >
            <Button
              onClick={onShowBudget}
              className="h-14 px-10 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {t("contratar.verOrcamento")}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default PlanSelector;

import { motion } from "framer-motion";
import { Award, MapPin, Building2, ShieldCheck } from "lucide-react";

const metrics = [
  { icon: Award, value: "15+", label: "Anos de experiência em TI" },
  { icon: MapPin, value: "SP", label: "Suporte em todo o estado de São Paulo" },
  { icon: Building2, value: "100+", label: "Empresas atendidas" },
  { icon: ShieldCheck, value: "99.9%", label: "Confiabilidade da infraestrutura" },
];

const BudgetAuthority = () => (
  <section className="py-16 bg-card">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
        {metrics.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="text-center"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <m.icon className="w-6 h-6 text-primary" />
            </div>
            <div className="text-2xl md:text-3xl font-heading font-bold text-primary mb-1">
              {m.value}
            </div>
            <p className="text-sm text-muted-foreground">{m.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default BudgetAuthority;

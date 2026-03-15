import { motion } from "framer-motion";
import { CheckCircle, Calculator, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const benefits = [
  "Locação corporativa de computadores",
  "Active Directory completo",
  "Backup automático a cada 30 minutos",
  "Migração de dados do servidor antigo",
  "Controle de usuários por departamento",
  "VPN e segurança com firewall pfSense",
];

const BudgetHero = () => {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-[90vh] flex items-center section-dark overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-gunmetal to-background opacity-90" />
      <div className="absolute top-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-primary/3 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
              Orçamento Online
            </span>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 leading-tight">
              Infraestrutura de TI{" "}
              <span className="text-primary">previsível</span> para sua empresa
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
              Computadores a partir de <span className="text-primary font-semibold">R$249/mês</span> com
              implantação completa de servidor Windows sem custo adicional em projetos elegíveis.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto mb-10"
          >
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-foreground/90">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{b}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              size="lg"
              className="text-base px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => scrollTo("calculator")}
            >
              <Calculator className="w-5 h-5 mr-2" />
              Calcular investimento da minha empresa
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 py-6 border-primary/30 hover:bg-primary/10 text-foreground"
              onClick={() =>
                window.open(
                  "https://wa.me/5512981156000?text=Olá! Gostaria de falar com um especialista sobre infraestrutura de TI.",
                  "_blank"
                )
              }
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Falar com especialista
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BudgetHero;

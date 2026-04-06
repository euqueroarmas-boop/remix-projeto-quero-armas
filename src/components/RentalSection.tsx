import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, ArrowRight, Star, Wrench, DollarSign, TrendingDown, Headphones, AlertTriangle, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { openWhatsApp } from "@/lib/whatsapp";
import { trackWhatsApp } from "@/lib/tracking";

const RentalSection = () => {
  const { t } = useTranslation();

  const leaseFeatures = [
    { text: "R$ 0 de entrada", icon: CheckCircle2 },
    { text: "Manutenção inclusa", icon: CheckCircle2 },
    { text: "Peças sem custo", icon: CheckCircle2 },
    { text: "Sem depreciação", icon: CheckCircle2 },
    { text: "Suporte 24/7 incluso", icon: CheckCircle2 },
  ];

  const buyFeatures = [
    { text: "R$ 4.000+ por máquina", icon: DollarSign },
    { text: "Manutenção por sua conta", icon: Wrench },
    { text: "Peças com custo extra", icon: Package },
    { text: "Depreciação constante", icon: TrendingDown },
    { text: "Suporte pago à parte", icon: AlertTriangle },
  ];

  const summaryBuy = [
    "R$4.000+ por máquina",
    "Manutenção por sua conta",
    "Custo extra com peças",
    "Suporte pago à parte",
  ];

  const summaryLease = [
    "R$ 0 para começar",
    "Manutenção inclusa",
    "Peças sem custo",
    "Suporte 24/7 incluso",
  ];

  const handleSimulate = () => {
    trackWhatsApp("rental-comparison", "simulacao");
    openWhatsApp({ pageTitle: "Simular Locação de Computadores", intent: "proposal" });
  };

  const handleSpecialist = () => {
    trackWhatsApp("rental-comparison", "especialista");
    openWhatsApp({ pageTitle: "Falar com Especialista - Locação", intent: "proposal" });
  };

  return (
    <section id="locacao" className="relative py-20 md:py-28 overflow-hidden bg-[hsl(var(--background))]">
      <div className="container px-4 sm:px-6">

        {/* BLOCO 1 — HEADLINE */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10 md:mb-14"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
            Comprar vs. <span className="text-primary">Locar</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl">
            Locar elimina <strong className="text-foreground">surpresas</strong> e mantém sua operação rodando.
          </p>
        </motion.div>

        {/* BLOCO 2 — DOIS CARDS PRINCIPAIS */}
        <div className="grid md:grid-cols-2 gap-5 md:gap-6 mb-10 md:mb-14">

          {/* CARD LOCAR (destaque) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative order-1 rounded-xl border-2 border-primary bg-primary/[0.04] p-6 sm:p-8 shadow-[0_0_40px_-12px_hsl(var(--primary)/0.25)]"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-primary/15 border border-primary/30 rounded-full px-4 py-1.5 mb-5">
              <Star size={14} className="text-primary fill-primary" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                Mais escolhido pelas empresas
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-5">
              Locar com WMTi
            </h3>

            <ul className="space-y-3 mb-7">
              {leaseFeatures.map((f) => (
                <li key={f.text} className="flex items-start gap-3">
                  <f.icon size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-foreground">{f.text}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleSimulate}
                className="w-full rounded-lg bg-primary text-primary-foreground px-6 py-3.5 font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all"
              >
                Simular locação
              </button>
              <button
                onClick={handleSpecialist}
                className="w-full rounded-lg border border-border text-foreground px-6 py-3.5 font-medium text-sm hover:border-primary hover:text-primary transition-all"
              >
                Falar com especialista
              </button>
            </div>
          </motion.div>

          {/* CARD COMPRAR (neutro) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative order-2 rounded-xl border border-border bg-muted/30 p-6 sm:p-8"
          >
            <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-5 mt-2">
              Comprar
            </h3>

            <ul className="space-y-3 mb-7">
              {buyFeatures.map((f) => (
                <li key={f.text} className="flex items-start gap-3">
                  <f.icon size={18} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-muted-foreground">{f.text}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => {
                trackWhatsApp("rental-buy", "comprar");
                openWhatsApp({ pageTitle: "Comprar Computadores", intent: "proposal" });
              }}
              className="w-full rounded-lg border border-border text-muted-foreground px-6 py-3.5 font-medium text-sm hover:border-foreground hover:text-foreground transition-all flex items-center justify-center gap-2"
            >
              Comprar <ArrowRight size={14} />
            </button>
          </motion.div>
        </div>

        {/* BLOCO 3 — COMPARATIVO RESUMIDO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 gap-4 md:gap-6 mb-10 md:mb-14"
        >
          {/* Comprar */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <XCircle size={20} className="text-primary" />
              <h4 className="text-base sm:text-lg font-bold text-primary">Comprar</h4>
            </div>
            <ul className="space-y-2.5">
              {summaryBuy.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-xs sm:text-sm text-muted-foreground">
                  <span className="flex-shrink-0 mt-0.5">💸</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Locar */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={20} className="text-green-500" />
              <h4 className="text-base sm:text-lg font-bold text-green-500">Locar com WMTi</h4>
            </div>
            <ul className="space-y-2.5">
              {summaryLease.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground">
                  <CheckCircle2 size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* BLOCO 4 — CTA FINAL */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 leading-tight">
            Pare de gastar com equipamentos.
            <br />
            Foque no seu crescimento.
          </h3>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 max-w-md mx-auto">
            <button
              onClick={handleSimulate}
              className="w-full sm:w-auto rounded-lg bg-primary text-primary-foreground px-8 py-4 font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all"
            >
              Simular locação
            </button>
            <Link
              to="/locacao-de-computadores-para-empresas-jacarei"
              className="w-full sm:w-auto rounded-lg border border-border text-foreground px-8 py-4 font-medium text-sm hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
            >
              Falar com especialista <ArrowRight size={14} />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default RentalSection;

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, Shield, Clock, Headphones } from "lucide-react";

interface Props {
  contractHref: string;
  pageTitle: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

const RecurringPlanPreview = ({ contractHref, pageTitle }: Props) => {
  const { t } = useTranslation();

  const terms = [
    { months: 12, discount: "0%", label: t("recurringPreview.term12", "12 meses") },
    { months: 24, discount: "7%", label: t("recurringPreview.term24", "24 meses – 7% de desconto") },
    { months: 36, discount: "12%", label: t("recurringPreview.term36", "36 meses – 12% de desconto") },
  ];

  const benefits = [
    { icon: Shield, text: t("recurringPreview.benefit1", "SLA de atendimento garantido") },
    { icon: Clock, text: t("recurringPreview.benefit2", "Suporte prioritário e contínuo") },
    { icon: Headphones, text: t("recurringPreview.benefit3", "Opção de suporte 24h (+35%)") },
  ];

  return (
    <motion.section {...fadeIn} className="py-12 md:py-16">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-3">
            {t("recurringPreview.tag", "Plano recorrente")}
          </p>
          <h2 className="text-xl md:text-3xl font-bold text-foreground mb-2">
            {t("recurringPreview.title", "Proteção contínua para sua empresa")}
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            {t("recurringPreview.subtitle", "Escolha o prazo ideal e garanta descontos progressivos no seu contrato mensal.")}
          </p>
        </div>

        {/* Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {terms.map((term) => (
            <div
              key={term.months}
              className="rounded-lg border border-border bg-card p-4 text-center"
            >
              <p className="text-2xl font-bold text-foreground">{term.months}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("recurringPreview.months", "meses")}</p>
              {term.months > 12 && (
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded-full">
                  {term.discount} {t("recurringPreview.off", "de desconto")}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {benefits.map((b) => (
            <div key={b.text} className="flex items-center gap-3 rounded-lg bg-card border border-border p-4">
              <b.icon className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm text-foreground/90">{b.text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            to="/orcamento-ti"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded"
          >
            <ArrowRight size={16} />
            {t("recurringPreview.cta", "Contratar plano mensal")}
          </Link>
        </div>
      </div>
    </motion.section>
  );
};

export default RecurringPlanPreview;

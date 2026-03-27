import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Monitor, Wrench, Headphones, RefreshCw, DollarSign, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import optiplexImage from "@/assets/optiplex-desktop.webp";
import MobileSummary from "@/components/MobileSummary";

const benefitIcons = [Monitor, Wrench, RefreshCw, Headphones, DollarSign, ShieldCheck];

const RentalSection = () => {
  const { t } = useTranslation();
  const benefits = (t("custom.rentalSection.benefits", { returnObjects: true }) as { title: string; desc: string }[]).map((item, index) => ({
    ...item,
    icon: benefitIcons[index],
  }));
  const comparisons = t("custom.rentalSection.comparisons", { returnObjects: true }) as { item: string; compra: string; locacao: string }[];

  return (
    <section id="locacao" className="section-light">

      {/* Full content */}
      <div className="py-20 md:py-24">
        <div className="container">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 md:mb-16"
          >
             <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// {t("custom.rentalSection.desktopTag")}</p>
            <h2 className="text-3xl md:text-5xl max-w-3xl mb-6">
               {t("custom.rentalSection.desktopTitle1").split("\n")[0]}
               <br />
               {t("custom.rentalSection.desktopTitle1").split("\n")[1]}<span className="text-primary">{t("custom.rentalSection.desktopHighlight")}</span>
            </h2>
            <p className="font-body text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
               {t("custom.rentalSection.desktopDescription")}
            </p>
          </motion.div>

          {/* Hero image + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden mb-12 md:mb-16"
          >
            <img
              src={optiplexImage}
              alt="Dell OptiPlex completo com monitor, teclado e mouse em escritório corporativo"
              className="w-full h-56 md:h-80 object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center">
              <div className="p-6 md:p-12 max-w-lg bg-secondary/80 backdrop-blur-sm">
                 <p className="font-mono text-xs md:text-sm text-primary mb-2">{t("custom.rentalSection.heroOverlayTag")}</p>
                <h3 className="text-xl md:text-3xl text-foreground mb-3 md:mb-4">
                   {t("custom.rentalSection.heroOverlayTitle")}
                </h3>
                <a
                  href="https://wa.me/5511963166915?text=Olá! Gostaria de saber mais sobre a locação de computadores."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 font-mono text-xs md:text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
                >
                   {t("custom.rentalSection.heroOverlayCta")}
                  <ArrowRight size={16} />
                </a>
              </div>
            </div>
          </motion.div>

          {/* Benefits grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border mb-12 md:mb-16">
            {benefits.map((benefit, i) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-background p-6 md:p-8 group hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary group-hover:bg-primary/5 transition-all">
                    <benefit.icon size={18} className="text-primary" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base md:text-lg font-mono font-bold">{benefit.title}</h3>
                </div>
                <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed">
                  {benefit.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Comparison table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 md:mb-16"
          >
            <h3 className="text-xl md:text-2xl mb-6">
               {t("custom.rentalSection.comparisonTitle1")}<span className="text-primary">{t("custom.rentalSection.comparisonHighlight")}</span>
            </h3>
            <div className="border border-border overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left font-mono text-xs md:text-sm uppercase tracking-wider p-3 md:p-4 text-muted-foreground"></th>
                     <th className="text-left font-mono text-xs md:text-sm uppercase tracking-wider p-3 md:p-4 text-muted-foreground">{t("custom.rentalSection.comparisonHeaders.buy")}</th>
                     <th className="text-left font-mono text-xs md:text-sm uppercase tracking-wider p-3 md:p-4 text-primary">{t("custom.rentalSection.comparisonHeaders.lease")}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row) => (
                    <tr key={row.item} className="border-t border-border">
                      <td className="p-3 md:p-4 font-body text-sm md:text-base font-medium">{row.item}</td>
                      <td className="p-3 md:p-4 font-body text-sm md:text-base text-muted-foreground">{row.compra}</td>
                      <td className="p-3 md:p-4 font-body text-sm md:text-base text-primary font-medium flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-primary flex-shrink-0" />
                        {row.locacao}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-secondary p-8 md:p-12 text-center"
          >
            <h3 className="text-xl md:text-3xl text-secondary-foreground mb-3 md:mb-4">
               {t("custom.rentalSection.finalTitle1")}<span className="text-primary">{t("custom.rentalSection.finalHighlight")}</span>{t("custom.rentalSection.finalTitle2")}
            </h3>
            <p className="font-body text-sm md:text-base text-secondary-foreground/70 max-w-xl mx-auto mb-6 md:mb-8 leading-relaxed">
               {t("custom.rentalSection.finalDescription")}
            </p>
            <a
              href="https://wa.me/5511963166915?text=Olá! Quero saber mais sobre a locação de computadores a partir de R$249/mês."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
            >
               {t("custom.rentalSection.finalCta")}
              <ArrowRight size={16} />
            </a>
            <Link
              to="/locacao-de-computadores-para-empresas-jacarei"
              className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-4 font-mono text-sm uppercase tracking-wider hover:border-primary hover:text-primary transition-all"
            >
               {t("custom.rentalSection.finalLink")}
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default RentalSection;

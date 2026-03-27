import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Users, ShieldCheck, TrendingUp, Briefcase, RefreshCcw,
  HeadphonesIcon, BarChart3, Building2, ArrowRight
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { openWhatsApp } from "@/lib/whatsapp";

const fadeIn = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const benefitIcons = [RefreshCcw, ShieldCheck, Users, Briefcase, BarChart3, TrendingUp, HeadphonesIcon, Building2];

const TerceirizacaoPage = () => {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = "Terceirização de Mão de Obra em TI | WMTi";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "A WMTi oferece terceirização de mão de obra em TI, incluindo absorção e gestão de profissionais já existentes, com mais controle, continuidade e redução de responsabilidade operacional para sua empresa.");
    }
    window.scrollTo(0, 0);
  }, []);

  const benefits = (t("custom.outsourcing.benefits", { returnObjects: true }) as { title: string; desc: string }[]).map((item, index) => ({
    ...item,
    icon: benefitIcons[index],
  }));
  const sections = t("custom.outsourcing.sections", { returnObjects: true }) as { title: string; content: string }[];

    const whatsappMsg = encodeURIComponent(t("custom.outsourcing.whatsappMessage"));
    const whatsappNumber = "5511963166915";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <motion.div {...fadeIn} className="max-w-3xl">
            <span className="inline-block font-mono text-xs uppercase tracking-[0.2em] text-primary mb-4">
              {t("custom.outsourcing.heroTag")}
            </span>
            <h1 className="font-display text-3xl md:text-5xl font-bold leading-tight mb-6">
              {t("custom.outsourcing.heroTitle1")}<span className="text-primary">{t("custom.outsourcing.heroHighlight")}</span>{t("custom.outsourcing.heroTitle2")}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-4">
              {t("custom.outsourcing.intro1")}
            </p>
            <p className="text-base text-muted-foreground leading-relaxed mb-8">
              <strong className="text-foreground">{t("custom.outsourcing.intro2")}</strong>
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider px-6 py-3 hover:bg-primary/90 transition-colors"
              >
                {t("custom.outsourcing.primaryCta")}
                <ArrowRight size={16} />
              </a>
              <Link
                to="/suporte-ti-jacarei"
                className="inline-flex items-center justify-center gap-2 border border-border text-foreground font-mono text-sm uppercase tracking-wider px-6 py-3 hover:border-primary/50 hover:text-primary transition-colors"
              >
                {t("custom.outsourcing.secondaryCta")}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Content sections */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="grid gap-12 md:gap-16 max-w-4xl">
            {sections.map((section, idx) => (
              <motion.div
                key={idx}
                {...fadeIn}
                transition={{ ...fadeIn.transition, delay: idx * 0.08 }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 flex items-center justify-center bg-primary/10 text-primary font-mono text-sm font-bold shrink-0 mt-1">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <h2 className="font-display text-xl md:text-2xl font-bold mb-3">
                      {section.title}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 md:py-24 bg-card/50">
        <div className="container">
          <motion.div {...fadeIn} className="text-center mb-12">
            <span className="inline-block font-mono text-xs uppercase tracking-[0.2em] text-primary mb-3">
              {t("custom.outsourcing.benefitsTag")}
            </span>
            <h2 className="font-display text-2xl md:text-3xl font-bold">
              {t("custom.outsourcing.benefitsTitle")}
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b, idx) => (
              <motion.div
                key={idx}
                {...fadeIn}
                transition={{ ...fadeIn.transition, delay: idx * 0.06 }}
                className="bg-card border border-border/60 p-6 hover:border-primary/30 transition-colors group"
              >
                <b.icon size={28} className="text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wider mb-2">
                  {b.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {b.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="max-w-2xl mx-auto text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">
              {t("custom.outsourcing.finalTitle")}
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              {t("custom.outsourcing.finalDesc")}
            </p>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider px-8 py-4 hover:bg-primary/90 transition-colors"
            >
              {t("custom.outsourcing.finalCta")}
              <ArrowRight size={16} />
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TerceirizacaoPage;

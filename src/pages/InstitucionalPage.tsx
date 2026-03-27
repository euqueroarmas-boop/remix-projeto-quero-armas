import { useEffect } from "react";
import { motion } from "framer-motion";
import { Target, Eye, Heart, Shield, Award, Handshake, Lightbulb, CheckCircle, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";
import heroImg from "@/assets/institucional-hero.webp";
import dedicationImg from "@/assets/institucional-dedication.webp";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

const valueIcons = [Shield, Award, CheckCircle, Search, Lightbulb, Handshake];

const InstitucionalPage = () => {
  const { t } = useTranslation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const valores = (t("custom.institutional.values", { returnObjects: true }) as string[]).map((title, index) => ({
    icon: valueIcons[index],
    title,
  }));

  return (
    <div className="min-h-screen">
      <SeoHead
        title="Institucional | WMTi Tecnologia da Informação"
        description="Conheça a missão, visão e valores da WMTi, empresa especializada em infraestrutura de TI, segurança digital e soluções tecnológicas para empresas."
        canonical="https://wmti.com.br/institucional"
      />
      <Navbar />

      {/* Hero */}
      <section className="relative pt-14 md:pt-16">
        <div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
          <img src={heroImg} alt="Infraestrutura de TI corporativa WMTi" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/70 to-secondary/30" />
          <div className="absolute inset-0 flex items-end">
            <div className="container pb-12 md:pb-16">
              <motion.div {...fadeIn} className="max-w-3xl">
                <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// {t("custom.institutional.heroTag")}</p>
                <h1 className="text-3xl md:text-5xl lg:text-6xl mb-4 text-primary-foreground">
                  {t("custom.institutional.heroTitlePrefix")}<span className="text-primary">{t("custom.institutional.heroTitleHighlight")}</span>
                </h1>
                <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
                  {t("custom.institutional.heroDescription")}
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Missão, Visão, Valores */}
      <section className="section-dark py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="text-center mb-16">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// {t("custom.institutional.aboutTag")}</p>
            <h2 className="text-2xl md:text-4xl">{t("custom.institutional.aboutTitle")}</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-px bg-border">
            {/* Missão */}
            <motion.div {...fadeIn} className="bg-background p-8 md:p-10">
              <div className="w-14 h-14 bg-primary/10 flex items-center justify-center mb-6">
                <Target size={24} className="text-primary" />
              </div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider mb-4 text-primary">{t("custom.institutional.missionTitle")}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                {t("custom.institutional.missionText")}
              </p>
            </motion.div>

            {/* Visão */}
            <motion.div {...fadeIn} className="bg-background p-8 md:p-10">
              <div className="w-14 h-14 bg-primary/10 flex items-center justify-center mb-6">
                <Eye size={24} className="text-primary" />
              </div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider mb-4 text-primary">{t("custom.institutional.visionTitle")}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                {t("custom.institutional.visionText")}
              </p>
            </motion.div>

            {/* Valores */}
            <motion.div {...fadeIn} className="bg-background p-8 md:p-10">
              <div className="w-14 h-14 bg-primary/10 flex items-center justify-center mb-6">
                <Heart size={24} className="text-primary" />
              </div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider mb-4 text-primary">{t("custom.institutional.valuesTitle")}</h3>
              <ul className="space-y-3">
                {valores.map((v) => (
                  <li key={v.title} className="flex items-center gap-3 font-body text-sm text-muted-foreground">
                    <v.icon size={16} className="text-primary shrink-0" />
                    {v.title}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Colossenses 3:23 */}
      <section className="section-light py-16 md:py-24">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="overflow-hidden"
            >
              <img
                src={dedicationImg}
                alt="Dedicação e excelência no trabalho com tecnologia"
                className="w-full h-64 md:h-96 object-cover"
                loading="lazy"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-6">// {t("custom.institutional.purposeTag")}</p>
              <blockquote className="text-xl md:text-2xl lg:text-3xl italic text-foreground leading-relaxed mb-6 border-l-4 border-primary pl-6">
                "{t("custom.institutional.quote")}" 
              </blockquote>
              <p className="font-mono text-sm text-primary tracking-wider">{t("custom.institutional.quoteAuthor")}</p>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default InstitucionalPage;

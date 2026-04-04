import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Globe, Zap, ShieldCheck, Mail, CreditCard, Link2, Brain, Workflow,
  CheckCircle2, Star, ArrowRight,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import JsonLd from "@/components/JsonLd";
import { openWhatsApp } from "@/lib/whatsapp";
import WebDevCalculator from "@/components/orcamento/WebDevCalculator";

const deliverableIcons = [Zap, ShieldCheck, Mail, CreditCard, Link2, Brain, Workflow];

const DesenvolvimentoWebPage = () => {
  const { t } = useTranslation();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const deliverables = (t("custom.devWeb.deliverables", { returnObjects: true }) as { title: string; items: string[] }[]).map((item, index) => ({
    ...item,
    icon: deliverableIcons[index],
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Desenvolvimento De Sites E Sistemas Web Profissionais",
    provider: { "@type": "Organization", name: "WMTi Tecnologia da Informação" },
    description: "Desenvolvimento de sites, sistemas web, integrações com APIs, inteligência artificial e automação de processos para empresas.",
    areaServed: { "@type": "Country", name: "BR" },
  };

  return (
    <>
      <SeoHead
        title="Desenvolvimento De Sites E Sistemas Web Profissionais | WMTi"
        description="Criamos plataformas completas de negócio: sites, sistemas web, integrações, IA personalizada, automação de processos e sistema financeiro completo."
        canonical="/desenvolvimento-de-sites-e-sistemas-web"
      />
      <JsonLd data={jsonLd} />
      <Navbar />

      <main className="min-h-screen bg-background pt-16">
        {/* Hero */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[140px]" />
          </div>
          <div className="container relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// {t("custom.devWeb.heroTag")}</p>
              <h1 className="text-3xl md:text-5xl lg:text-6xl max-w-4xl mb-6">
                {t("custom.devWeb.heroTitle1")}<span className="text-primary">{t("custom.devWeb.heroHighlight")}</span>{t("custom.devWeb.heroTitle2")}
              </h1>
              <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 leading-relaxed">
                {t("custom.devWeb.heroDescription")}
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => openWhatsApp({ pageTitle: "Desenvolvimento Web", intent: "specialist" })}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider hover:brightness-110 transition-all"
                >
                  {t("custom.devWeb.primaryCta")} <ArrowRight size={16} />
                </button>
                <Link
                  to="/orcamento-ti"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-border text-foreground font-mono text-sm uppercase tracking-wider hover:bg-muted transition-colors"
                >
                  {t("custom.devWeb.secondaryCta")}
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* O que entregamos */}
        <section className="py-16 md:py-20 border-t border-border">
          <div className="container">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// {t("custom.devWeb.deliverablesTag")}</p>
            <h2 className="text-2xl md:text-4xl mb-12">{t("custom.devWeb.deliverablesTitle")}</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
              {deliverables.map((block, i) => {
                const Icon = block.icon;
                return (
                  <motion.div
                    key={block.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="bg-background p-6 md:p-8"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Icon size={20} className="text-primary" strokeWidth={1.5} />
                      <h3 className="text-base md:text-lg font-heading">{block.title}</h3>
                    </div>
                    <ul className="space-y-2">
                      {block.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
                          <span className="font-body text-sm text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Resultado final */}
        <section className="py-16 md:py-24 border-t border-border">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto text-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-6">
                <Star size={16} className="text-primary" />
                <span className="font-mono text-xs uppercase tracking-wider text-primary">{t("custom.devWeb.resultBadge")}</span>
              </div>
              <h2 className="text-2xl md:text-4xl mb-4">
                {t("custom.devWeb.resultTitle1")}<span className="text-primary">{t("custom.devWeb.resultHighlight")}</span>
              </h2>
              <p className="font-body text-base text-muted-foreground mb-8 leading-relaxed">
                {t("custom.devWeb.resultDescription")}
              </p>
              <button
                onClick={() => openWhatsApp({ pageTitle: "Desenvolvimento Web", intent: "proposal" })}
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider hover:brightness-110 transition-all"
              >
                  {t("custom.devWeb.finalCta")} <ArrowRight size={16} />
              </button>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default DesenvolvimentoWebPage;

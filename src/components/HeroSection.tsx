import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import heroImage from "@/assets/hero-server.webp";
import { Award, Shield, Handshake } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { trackWhatsApp } from "@/lib/tracking";

const HeroSection = () => {
  const { t } = useTranslation();

  useEffect(() => {
    const existing = document.querySelector('link[rel="preload"][as="image"][data-hero]');
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = heroImage;
      link.setAttribute("data-hero", "true");
      document.head.appendChild(link);
    }
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden section-dark">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Infraestrutura de TI corporativa com servidores Dell PowerEdge"
          className="w-full h-full object-cover opacity-30"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-secondary/70" />
      </div>

      <div className="container relative z-10 py-24">
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="font-mono text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] uppercase text-primary mb-4 md:mb-6">
              {t("hero.tag")}
            </p>
            <h1 className="text-3xl md:text-5xl lg:text-7xl leading-[1.1] mb-6 md:mb-8">
              {t("hero.title1")}
              <br className="hidden md:block" />
              {" "}{t("hero.title2")}{" "}
              <span className="text-primary">{t("hero.title3")}</span>
            </h1>
            <p className="font-body text-base md:text-xl text-gunmetal-foreground/70 max-w-2xl mb-4 leading-relaxed">
              {t("hero.desc1")}
            </p>
            <p className="font-body text-base md:text-xl text-gunmetal-foreground/70 max-w-2xl mb-8 md:mb-12 leading-relaxed">
              {t("hero.desc2_1")} <strong className="text-foreground">{t("hero.desc2_2")}</strong> {t("hero.desc2_3")}
              <strong className="text-primary"> {t("hero.desc2_4")}</strong>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 md:gap-4"
          >
            <a
              href="#contato"
              className="group inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 md:px-10 py-4 md:py-5 font-mono text-sm md:text-base font-bold uppercase tracking-wider hover:brightness-110 transition-all btn-glow"
            >
              {t("hero.ctaDiag")}
              <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
            </a>
            <button
              onClick={() => {
                trackWhatsApp("home-hero", "especialista");
                openWhatsApp({ pageTitle: t("hero.tag"), intent: "specialist" });
              }}
              className="inline-flex items-center justify-center gap-2 border border-gunmetal-foreground/30 text-gunmetal-foreground px-6 md:px-8 py-3.5 md:py-4 font-mono text-sm font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-all"
            >
              {t("hero.ctaWhatsapp")}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mt-12 md:mt-20 flex flex-col sm:flex-row gap-6 sm:gap-12 border-t border-gunmetal-foreground/10 pt-6 md:pt-8"
          >
            {[
              { icon: Award, label: t("hero.auth_years"), status: t("hero.auth_years_desc") },
              { icon: Shield, label: t("hero.auth_uptime"), status: t("hero.auth_uptime_desc") },
              { icon: Handshake, label: t("hero.auth_partners"), status: t("hero.auth_partners_desc") },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary led-pulse" />
                <div>
                  <p className="font-mono text-xs md:text-sm text-primary">{item.label}</p>
                  <p className="font-body text-xs md:text-sm text-gunmetal-foreground/50">{item.status}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

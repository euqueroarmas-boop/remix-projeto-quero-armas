import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import poweredgeImage from "@/assets/poweredge-server.webp";
import serverDetail from "@/assets/server-detail.webp";

const specKeys = [
  "processor", "memory", "storage", "network", "management", "redundancy",
] as const;

const InfraSection = () => {
  const { t } = useTranslation();

  return (
    <section id="infraestrutura" className="section-dark">
      <div className="py-20 md:py-24">
        <div className="container">
          <div className="grid lg:grid-cols-12 gap-8 md:gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-5 lg:sticky lg:top-24"
            >
              <img
                src={poweredgeImage}
                alt={t("infraSection.imageAlt")}
                className="w-full md:max-h-[500px] object-cover"
                loading="lazy"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-7"
            >
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
                // Dell PowerEdge
              </p>
              <h2 className="text-2xl md:text-5xl mb-4 md:mb-6">
                {t("infraSection.title1")}
                <br />
                <span className="text-primary">{t("infraSection.titleHighlight")}</span>
              </h2>
              <p className="font-body text-gunmetal-foreground/70 text-base md:text-lg max-w-xl mb-8 md:mb-12 leading-relaxed">
                {t("infraSection.description")}
              </p>

              <div className="grid grid-cols-2 gap-px bg-gunmetal-foreground/10 mb-8 md:mb-12">
                {specKeys.map((key) => (
                  <div key={key} className="bg-secondary p-4 md:p-5">
                    <p className="font-mono text-[10px] md:text-xs tracking-[0.2em] uppercase text-primary mb-1">
                      {t(`infraSection.specs.${key}.label`)}
                    </p>
                    <p className="font-body text-xs md:text-sm text-gunmetal-foreground">
                      {t(`infraSection.specs.${key}.value`)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="relative overflow-hidden">
                <img
                  src={serverDetail}
                  alt={t("infraSection.detailAlt")}
                  className="w-full h-48 md:h-64 object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-secondary/90 to-transparent p-4 md:p-6">
                  <p className="font-mono text-xs text-primary">
                    STATUS: OPERATIONAL // UPTIME 99.99%
                  </p>
                </div>
              </div>

              <Link
                to="/infraestrutura-ti-corporativa-jacarei"
                className="inline-flex items-center gap-2 mt-6 font-mono text-xs uppercase tracking-wider text-primary hover:brightness-110 transition-colors"
              >
                {t("infraSection.cta")} <ArrowRight size={14} />
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InfraSection;

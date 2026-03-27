import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Server, Cloud, Shield, HardDrive, Network, MonitorCog, ArrowRight } from "lucide-react";
import datacenterImage from "@/assets/network-datacenter.webp";

const serviceKeys = [
  { icon: Server, key: "servicesSection.items.dell" as const, href: "/servidor-dell-poweredge-jacarei" },
  { icon: Cloud, key: "servicesSection.items.m365" as const, href: "/microsoft-365-para-empresas-jacarei" },
  { icon: Shield, key: "servicesSection.items.pfsense" as const, href: "/firewall-pfsense-jacarei" },
  { icon: HardDrive, key: "servicesSection.items.backup" as const, href: "/backup-empresarial-jacarei" },
  { icon: Network, key: "servicesSection.items.redes" as const, href: "/montagem-e-monitoramento-de-redes-jacarei" },
  { icon: MonitorCog, key: "servicesSection.items.suporte" as const, href: "/suporte-ti-jacarei" },
];

const ServicesSection = () => {
  const { t } = useTranslation();

  return (
    <section id="servicos" className="section-light">
      <div className="py-20 md:py-24">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center mb-12 md:mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
                // {t("servicesSection.tag")}
              </p>
              <h2 className="text-2xl md:text-5xl max-w-2xl">
                {t("servicesSection.title1")}
                <br />
                {t("servicesSection.title2")}
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative overflow-hidden"
            >
              <img
                src={datacenterImage}
                alt={t("servicesSection.imageAlt")}
                className="w-full h-48 md:h-72 object-cover"
                loading="lazy"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/70 to-transparent p-4 md:p-6">
                <p className="font-mono text-xs text-primary">
                  {t("servicesSection.imageBadge")}
                </p>
              </div>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {serviceKeys.map((service, i) => {
              const tag = t(`${service.key}.tag`);
              const title = t(`${service.key}.title`);
              const description = t(`${service.key}.description`);
              const specs = t(`${service.key}.specs`, { returnObjects: true }) as string[];

              return (
                <motion.div
                  key={service.key}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="bg-background p-6 md:p-10 group hover:bg-muted hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-4 md:mb-6">
                    <service.icon size={18} className="text-primary" strokeWidth={1.5} />
                    <span className="font-mono text-[11px] md:text-xs tracking-[0.2em] uppercase text-muted-foreground">
                      {tag}
                    </span>
                  </div>
                  <h3 className="text-lg md:text-xl mb-3 md:mb-4">{title}</h3>
                  <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mb-5 md:mb-6">
                    {description}
                  </p>
                  <div className="border-t border-border pt-4 mb-4">
                    {Array.isArray(specs) && specs.map((spec) => (
                      <div key={spec} className="flex items-center gap-2 mb-1.5">
                        <span className="w-1 h-1 bg-primary rounded-full flex-shrink-0" />
                        <span className="font-mono text-xs md:text-sm text-muted-foreground">{spec}</span>
                      </div>
                    ))}
                  </div>
                  <Link
                    to={service.href}
                    className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-primary hover:brightness-110 transition-colors group-hover:translate-x-1 transition-transform"
                  >
                    {t("cta.learnMore")} <ArrowRight size={14} />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;

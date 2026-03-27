import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
const clients = [
  "Dell Technologies",
  "Microsoft",
  "pfSense",
  "VMware",
  "Veeam",
  "Fortinet",
];

const ClientLogosSection = () => {
  return (
    <section className="py-12 md:py-16 bg-background border-y border-border">
      <div className="container">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-muted-foreground text-center mb-8">
          {t("clientLogos.tag")}
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
          {clients.map((name, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="font-heading text-lg md:text-xl font-bold text-muted-foreground/40 hover:text-primary transition-colors duration-300 cursor-default"
            >
              {name}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ClientLogosSection;

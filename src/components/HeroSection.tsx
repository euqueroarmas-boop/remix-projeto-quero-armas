import { motion } from "framer-motion";
import heroImage from "@/assets/hero-server.jpg";
import { Server, Shield, Cloud } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden section-dark">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Dell PowerEdge server rack em operação"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-secondary/80" />
      </div>

      <div className="container relative z-10 py-24">
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="font-mono text-sm tracking-[0.3em] uppercase text-primary mb-6">
              // Infraestrutura. Segurança. Performance.
            </p>
            <h1 className="text-4xl md:text-6xl lg:text-7xl leading-[1.05] mb-8">
              Construímos a infraestrutura
              <br />
              sobre a qual sua empresa
              <br />
              <span className="text-primary">opera.</span>
            </h1>
            <p className="font-body text-lg md:text-xl text-gunmetal-foreground/70 max-w-2xl mb-12 leading-relaxed">
              Servidores Dell PowerEdge. Ecossistema Microsoft 365 & Azure.
              Firewalls pfSense. Implementação, gerenciamento e suporte
              especializado para ambientes críticos.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap gap-4"
          >
            <a
              href="#servicos"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
            >
              Ver Serviços
              <span className="text-lg">→</span>
            </a>
            <a
              href="#contato"
              className="inline-flex items-center gap-2 border border-gunmetal-foreground/30 text-gunmetal-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-all"
            >
              Solicitar Orçamento
            </a>
          </motion.div>

          {/* Status indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mt-20 flex gap-12 border-t border-gunmetal-foreground/10 pt-8"
          >
            {[
              { icon: Server, label: "Dell PowerEdge", status: "Partner Autorizado" },
              { icon: Cloud, label: "Microsoft 365", status: "Soluções Cloud" },
              { icon: Shield, label: "pfSense", status: "Segurança de Rede" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary led-pulse" />
                <div>
                  <p className="font-mono text-xs text-primary">{item.label}</p>
                  <p className="font-body text-xs text-gunmetal-foreground/50">{item.status}</p>
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

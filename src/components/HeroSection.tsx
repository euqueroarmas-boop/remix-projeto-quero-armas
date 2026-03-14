import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-server.webp";
import { Award, Shield, Handshake } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden section-dark">
      {/* Background image */}
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
              // Infraestrutura. Segurança. Performance.
            </p>
            <h1 className="text-3xl md:text-5xl lg:text-7xl leading-[1.1] mb-6 md:mb-8">
              Infraestrutura de TI segura
              <br className="hidden md:block" />
              {" "}e estável para{" "}
              <span className="text-primary">empresas.</span>
            </h1>
            <p className="font-body text-base md:text-xl text-gunmetal-foreground/70 max-w-2xl mb-4 leading-relaxed">
              A WMTi Tecnologia da Informação é especialista em infraestrutura
              corporativa, servidores Dell PowerEdge, redes empresariais,
              Microsoft 365, Azure e segurança de rede com firewall pfSense.
            </p>
            <p className="font-body text-base md:text-xl text-gunmetal-foreground/70 max-w-2xl mb-8 md:mb-12 leading-relaxed">
              Há mais de 15 anos ajudando empresas a manter seus sistemas
              funcionando com segurança, desempenho e confiabilidade.
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
              className="group inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 md:px-10 py-4 md:py-5 font-mono text-sm md:text-base font-bold uppercase tracking-wider hover:brightness-110 transition-all shadow-[0_0_30px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_40px_hsl(var(--primary)/0.5)]"
            >
              Solicitar Diagnóstico de TI
              <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
            </a>
            <a
              href="https://wa.me/5511963166915?text=Ol%C3%A1%2C%20gostaria%20de%20falar%20com%20um%20especialista%20em%20TI."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border border-gunmetal-foreground/30 text-gunmetal-foreground px-6 md:px-8 py-3.5 md:py-4 font-mono text-sm font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-all"
            >
              Falar com Especialista
            </a>
          </motion.div>

          {/* Authority indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mt-12 md:mt-20 flex flex-col sm:flex-row gap-6 sm:gap-12 border-t border-gunmetal-foreground/10 pt-6 md:pt-8"
          >
            {[
              { icon: Award, label: "Mais de 15 anos", status: "de experiência" },
              { icon: Shield, label: "Especialistas", status: "em infraestrutura corporativa" },
              { icon: Handshake, label: "Parceiros", status: "Dell, Microsoft e ESET" },
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

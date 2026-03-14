import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import poweredgeImage from "@/assets/poweredge-server.jpg";
import serverDetail from "@/assets/server-detail.jpg";
import MobileSummary from "@/components/MobileSummary";

const specs = [
  { label: "Processador", value: "Intel Xeon Scalable 4ª Geração" },
  { label: "Memória", value: "Até 2TB DDR5 RDIMM" },
  { label: "Storage", value: "24x NVMe / SAS / SATA" },
  { label: "Rede", value: "2x 25GbE + OCP 3.0" },
  { label: "Gerenciamento", value: "iDRAC9 Enterprise" },
  { label: "Redundância", value: "PSU Hot-Plug 2+1" },
];

const InfraSection = () => {
  return (
    <section id="infraestrutura" className="section-dark">
      {/* Mobile summary */}
      <MobileSummary
        tag="Dell PowerEdge"
        title={<>Hardware que não falha. <span className="text-primary">R750xs.</span></>}
        description="Servidores rack 2U com processadores Intel Xeon de 4ª geração, projetados para virtualização, bancos de dados e aplicações de missão crítica. Firewall pfSense como espinha dorsal de segurança."
        to="/infraestrutura"
        className="section-dark"
      />

      {/* Full content - desktop only */}
      <div className="hidden md:block py-20 md:py-24">
        <div className="container">
          <div className="grid lg:grid-cols-12 gap-8 md:gap-16 items-start">
            {/* Left: Server image */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-5 lg:sticky lg:top-24"
            >
              <img
                src={poweredgeImage}
                alt="Servidores Dell PowerEdge em rack de data center com LEDs laranjas"
                className="w-full md:max-h-[500px] object-cover"
                loading="lazy"
              />
            </motion.div>

            {/* Right: Content */}
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
                Hardware que não falha.
                <br />
                <span className="text-primary">R750xs.</span>
              </h2>
              <p className="font-body text-gunmetal-foreground/70 text-base md:text-lg max-w-xl mb-8 md:mb-12 leading-relaxed">
                Servidores rack 2U com processadores Intel Xeon de 4ª geração,
                projetados para workloads de virtualização, bancos de dados e
                aplicações de missão crítica.
              </p>

              {/* Specs grid */}
              <div className="grid grid-cols-2 gap-px bg-gunmetal-foreground/10 mb-8 md:mb-12">
                {specs.map((spec) => (
                  <div key={spec.label} className="bg-secondary p-4 md:p-5">
                    <p className="font-mono text-[10px] md:text-xs tracking-[0.2em] uppercase text-primary mb-1">
                      {spec.label}
                    </p>
                    <p className="font-body text-xs md:text-sm text-gunmetal-foreground">
                      {spec.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Server image */}
              <div className="relative overflow-hidden">
                <img
                  src={serverDetail}
                  alt="Detalhe de servidor Dell PowerEdge com LEDs de status"
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
                Ver infraestrutura completa <ArrowRight size={14} />
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InfraSection;

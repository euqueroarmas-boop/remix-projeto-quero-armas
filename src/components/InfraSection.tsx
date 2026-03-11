import { motion } from "framer-motion";
import serverDetail from "@/assets/server-detail.jpg";

const ServerRackSVG = () => (
  <svg viewBox="0 0 200 400" className="w-full max-w-[200px]" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Rack frame */}
    <rect x="10" y="10" width="180" height="380" rx="2" stroke="hsl(var(--gunmetal-foreground))" strokeWidth="1" opacity="0.3" />
    
    {/* Server units */}
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i} transform={`translate(20, ${30 + i * 70})`}>
        <rect width="160" height="55" rx="1" fill="hsl(var(--gunmetal))" stroke="hsl(var(--gunmetal-foreground))" strokeWidth="0.5" opacity="0.6" />
        {/* Drive bays */}
        {[0, 1, 2, 3].map((j) => (
          <rect key={j} x={8 + j * 18} y="8" width="14" height="20" rx="1" stroke="hsl(var(--gunmetal-foreground))" strokeWidth="0.3" opacity="0.4" />
        ))}
        {/* LED indicators */}
        <circle cx="140" cy="15" r="3" className={i % 2 === 0 ? "led-pulse" : "led-pulse-delay"} fill="hsl(var(--signal-orange))" />
        <circle cx="150" cy="15" r="3" className={i % 2 === 1 ? "led-pulse" : "led-pulse-delay"} fill="hsl(var(--signal-orange))" opacity="0.6" />
        {/* Label */}
        <text x="8" y="48" fill="hsl(var(--gunmetal-foreground))" fontSize="7" fontFamily="Roboto Mono" opacity="0.5">
          R750-{String(i + 1).padStart(2, "0")}
        </text>
      </g>
    ))}
  </svg>
);

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
    <section id="infraestrutura" className="py-24 section-dark">
      <div className="container">
        <div className="grid lg:grid-cols-12 gap-16 items-start">
          {/* Left: SVG rack */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-3 flex justify-center lg:sticky lg:top-24"
          >
            <ServerRackSVG />
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-9"
          >
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Dell PowerEdge
            </p>
            <h2 className="text-3xl md:text-5xl mb-6">
              Hardware que não falha.
              <br />
              <span className="text-primary">R750xs.</span>
            </h2>
            <p className="font-body text-gunmetal-foreground/70 text-lg max-w-xl mb-12 leading-relaxed">
              Servidores rack 2U com processadores Intel Xeon de 4ª geração,
              projetados para workloads de virtualização, bancos de dados e
              aplicações de missão crítica.
            </p>

            {/* Specs grid */}
            <div className="grid sm:grid-cols-2 gap-px bg-gunmetal-foreground/10 mb-12">
              {specs.map((spec) => (
                <div key={spec.label} className="bg-secondary p-5">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary mb-1">
                    {spec.label}
                  </p>
                  <p className="font-body text-sm text-gunmetal-foreground">
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
                className="w-full h-64 object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-secondary/90 to-transparent p-6">
                <p className="font-mono text-xs text-primary">
                  STATUS: OPERATIONAL // UPTIME 99.99%
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default InfraSection;

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Shield, Lock, Eye, Wifi, ArrowRight } from "lucide-react";
import firewallImage from "@/assets/firewall-security.jpg";
import MobileSummary from "@/components/MobileSummary";

const features = [
  {
    icon: Shield,
    title: "Firewall pfSense",
    desc: "Appliances dedicados com regras stateful, NAT avançado e inspeção profunda de pacotes. Sem licenciamento por usuário.",
  },
  {
    icon: Lock,
    title: "VPN Site-to-Site",
    desc: "Túneis IPsec e OpenVPN com criptografia AES-256-GCM. Conexão segura entre filiais e ambientes cloud Azure.",
  },
  {
    icon: Eye,
    title: "IDS/IPS Suricata",
    desc: "Detecção e prevenção de intrusão em tempo real com regras ET Open e Snort. Alertas integrados ao NOC.",
  },
  {
    icon: Wifi,
    title: "Multi-WAN Failover",
    desc: "Balanceamento de carga entre múltiplos links com failover automático. Zero downtime em falhas de provedor.",
  },
];

const SecuritySection = () => {
  return (
    <section id="seguranca" className="section-light">
      {/* Mobile summary - hidden since InfraSection already links to /infraestrutura */}
      <MobileSummary
        tag="Segurança"
        title={<>Perímetro blindado. <span className="text-primary">pfSense</span> como espinha dorsal.</>}
        description="Firewalls pfSense com VPN IPsec/OpenVPN, IDS/IPS Suricata, balanceamento de carga e failover automático de links WAN. Segurança sem compromisso."
        to="/infraestrutura"
        className="section-light"
      />

      {/* Full content - desktop only */}
      <div className="hidden md:block py-20 md:py-24">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center mb-12 md:mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
                // Segurança
              </p>
              <h2 className="text-2xl md:text-5xl max-w-3xl">
                Perímetro blindado.
                <br />
                <span className="text-primary">pfSense</span> como espinha dorsal.
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
                src={firewallImage}
                alt="Appliance de firewall pfSense com cabos de rede conectados em data center"
                className="w-full h-48 md:h-72 object-cover"
                loading="lazy"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/70 to-transparent p-4 md:p-6">
                <p className="font-mono text-xs text-primary">
                  FIREWALL STATUS: ACTIVE // THREATS BLOCKED
                </p>
              </div>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-border">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-background p-6 md:p-10 group hover:bg-muted/50 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary group-hover:bg-primary/5 transition-all flex-shrink-0">
                    <feature.icon size={18} className="text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg mb-2">{feature.title}</h3>
                    <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Network diagram */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 md:mt-16 border border-border p-6 md:p-12"
          >
            <p className="font-mono text-[10px] md:text-xs tracking-[0.2em] uppercase text-muted-foreground mb-6">
              // Diagrama de Rede Simplificado
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 font-mono text-xs">
              <div className="border border-border px-4 py-3 text-center w-full md:w-auto">
                <p className="text-primary text-[10px] md:text-xs">WAN</p>
                <p className="text-muted-foreground text-xs md:text-sm">ISP 1 / ISP 2</p>
              </div>
              <span className="text-muted-foreground hidden md:block">──────</span>
              <span className="text-muted-foreground md:hidden">│</span>
              <div className="border-2 border-primary px-6 py-4 text-center bg-primary/5 w-full md:w-auto">
                <p className="text-primary font-bold text-sm">pfSense</p>
                <p className="text-muted-foreground text-[10px] md:text-xs">FW / VPN / IDS</p>
              </div>
              <span className="text-muted-foreground hidden md:block">──────</span>
              <span className="text-muted-foreground md:hidden">│</span>
              <div className="border border-border px-4 py-3 text-center w-full md:w-auto">
                <p className="text-primary text-[10px] md:text-xs">LAN</p>
                <p className="text-muted-foreground text-xs md:text-sm">VLAN 10/20/30</p>
              </div>
              <span className="text-muted-foreground hidden md:block">──────</span>
              <span className="text-muted-foreground md:hidden">│</span>
              <div className="border border-border px-4 py-3 text-center w-full md:w-auto">
                <p className="text-primary text-[10px] md:text-xs">SERVERS</p>
                <p className="text-muted-foreground text-xs md:text-sm">PowerEdge Cluster</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default SecuritySection;

import { motion } from "framer-motion";
import { Shield, Lock, Eye, Wifi } from "lucide-react";

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
    <section id="seguranca" className="py-24 section-light">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            // Segurança
          </p>
          <h2 className="text-3xl md:text-5xl max-w-3xl">
            Perímetro blindado.
            <br />
            <span className="text-primary">pfSense</span> como espinha dorsal.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-px bg-border">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-background p-10 group"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary group-hover:bg-primary/5 transition-all">
                  <feature.icon size={18} className="text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-lg mb-2">{feature.title}</h3>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">
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
          className="mt-16 border border-border p-8 md:p-12"
        >
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-6">
            // Diagrama de Rede Simplificado
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 font-mono text-xs">
            <div className="border border-border px-4 py-3 text-center">
              <p className="text-primary text-[10px]">WAN</p>
              <p className="text-muted-foreground">ISP 1 / ISP 2</p>
            </div>
            <span className="text-muted-foreground hidden md:block">──────</span>
            <span className="text-muted-foreground md:hidden">│</span>
            <div className="border-2 border-primary px-6 py-4 text-center bg-primary/5">
              <p className="text-primary font-bold">pfSense</p>
              <p className="text-muted-foreground text-[10px]">FW / VPN / IDS</p>
            </div>
            <span className="text-muted-foreground hidden md:block">──────</span>
            <span className="text-muted-foreground md:hidden">│</span>
            <div className="border border-border px-4 py-3 text-center">
              <p className="text-primary text-[10px]">LAN</p>
              <p className="text-muted-foreground">VLAN 10/20/30</p>
            </div>
            <span className="text-muted-foreground hidden md:block">──────</span>
            <span className="text-muted-foreground md:hidden">│</span>
            <div className="border border-border px-4 py-3 text-center">
              <p className="text-primary text-[10px]">SERVERS</p>
              <p className="text-muted-foreground">PowerEdge Cluster</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SecuritySection;

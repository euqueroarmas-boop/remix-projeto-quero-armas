import { motion } from "framer-motion";
import { Server, Cloud, Shield, HardDrive, Network, MonitorCog } from "lucide-react";

const services = [
  {
    icon: Server,
    tag: "DELL POWEREDGE",
    title: "Infraestrutura de Servidores",
    description:
      "Implementamos e gerenciamos servidores Dell PowerEdge R750, R650 e T550. Configuração de RAID, iDRAC, clusters de failover com Hyper-V e alta disponibilidade para ambientes de produção.",
    specs: ["PowerEdge R750xs / R650xs", "RAID H755 / H355", "iDRAC9 Enterprise", "Hyper-V Clustering"],
  },
  {
    icon: Cloud,
    tag: "MICROSOFT 365",
    title: "Ecossistema Microsoft & Azure",
    description:
      "Migração completa para Microsoft 365, configuração de Azure AD, Exchange Online, SharePoint e Teams. Ambientes híbridos com Active Directory on-premises sincronizado com Azure AD Connect.",
    specs: ["Microsoft 365 Business", "Azure AD Connect", "Exchange Online", "Windows Server 2022"],
  },
  {
    icon: Shield,
    tag: "PFSENSE",
    title: "Segurança de Perímetro",
    description:
      "Firewalls pfSense em appliances dedicados com VPN IPsec/OpenVPN, IDS/IPS com Suricata, filtro de conteúdo, balanceamento de carga e failover de links WAN. Segurança sem compromisso.",
    specs: ["VPN IPsec / OpenVPN", "Suricata IDS/IPS", "HAProxy Load Balancer", "Multi-WAN Failover"],
  },
  {
    icon: HardDrive,
    tag: "BACKUP",
    title: "Backup & Recuperação",
    description:
      "Estratégias de backup 3-2-1 com Veeam Backup & Replication sobre storage Dell PowerVault. Testes de restauração periódicos e RPO/RTO definidos para cada workload crítico.",
    specs: ["Veeam B&R v12", "Dell PowerVault ME5", "Backup 3-2-1", "DR Automatizado"],
  },
  {
    icon: Network,
    tag: "REDES",
    title: "Infraestrutura de Rede",
    description:
      "Switches Dell gerenciáveis, VLANs segmentadas, QoS configurado e monitoramento SNMP. Cabeamento estruturado Cat6A e fibra óptica para ambientes de alta performance.",
    specs: ["Dell Networking N-Series", "VLAN / QoS / STP", "Cat6A / Fibra Óptica", "Zabbix Monitoring"],
  },
  {
    icon: MonitorCog,
    tag: "SUPORTE",
    title: "Gestão & Monitoramento",
    description:
      "NOC próprio com monitoramento 24/7 via Zabbix e Grafana. SLA definido por criticidade, atendimento remoto e presencial com equipe técnica certificada Dell e Microsoft.",
    specs: ["NOC 24/7", "Zabbix + Grafana", "SLA por Criticidade", "Dell & MS Certified"],
  },
];

const ServicesSection = () => {
  return (
    <section id="servicos" className="py-24 section-light">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            // Serviços
          </p>
          <h2 className="text-3xl md:text-5xl max-w-2xl">
            Engenharia de sistemas,
            <br />
            não consultoria genérica.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {services.map((service, i) => (
            <motion.div
              key={service.tag}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-background p-8 lg:p-10 group hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3 mb-6">
                <service.icon size={18} className="text-primary" strokeWidth={1.5} />
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  {service.tag}
                </span>
              </div>
              <h3 className="text-xl mb-4">{service.title}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-6">
                {service.description}
              </p>
              <div className="border-t border-border pt-4">
                {service.specs.map((spec) => (
                  <div key={spec} className="flex items-center gap-2 mb-1.5">
                    <span className="w-1 h-1 bg-primary rounded-full" />
                    <span className="font-mono text-[11px] text-muted-foreground">{spec}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;

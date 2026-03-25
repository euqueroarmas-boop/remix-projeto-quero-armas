import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Server, Cloud, Shield, HardDrive, Network, MonitorCog,
  Stethoscope, Scale, Building2, Briefcase, BookOpen, Landmark,
  ArrowRight, MapPin, Globe,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import brasilCoverage from "@/assets/brasil-coverage.webp";

const sections = [
  {
    title: "Serviços de TI",
    items: [
      { icon: MonitorCog, label: "Suporte TI", desc: "NOC 24/7, SLA por criticidade, atendimento remoto e presencial.", href: "/suporte-ti-jacarei" },
      { icon: Server, label: "Servidores Dell PowerEdge", desc: "Implementação e gestão de servidores Dell R750, R650, T550.", href: "/servidor-dell-poweredge-jacarei" },
      { icon: Cloud, label: "Microsoft 365 & Azure", desc: "Migração, Azure AD, Exchange Online, SharePoint e Teams.", href: "/microsoft-365-para-empresas-jacarei" },
      { icon: Shield, label: "Firewall pfSense", desc: "VPN, IDS/IPS Suricata, filtro de conteúdo e failover WAN.", href: "/firewall-pfsense-jacarei" },
      { icon: HardDrive, label: "Backup Empresarial", desc: "Veeam Backup, estratégia 3-2-1, testes de restauração.", href: "/backup-empresarial-jacarei" },
      { icon: Network, label: "Montagem de Redes", desc: "Switches Dell, VLANs, Cat6A, fibra óptica e Zabbix.", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { icon: Shield, label: "Segurança da Informação", desc: "Proteção de perímetro, antivírus gerenciado, compliance.", href: "/seguranca-informacao-empresarial" },
      { icon: MonitorCog, label: "Locação de Computadores", desc: "Equipamentos Dell com gestão inclusa e substituição expressa.", href: "/locacao-de-computadores-para-empresas-jacarei" },
      { icon: Server, label: "Infraestrutura Corporativa", desc: "Projeto completo de datacenter, racks, nobreaks e climatização.", href: "/infraestrutura-ti-corporativa-jacarei" },
    ],
  },
  {
    title: "Segmentos Atendidos",
    items: [
      { icon: Landmark, label: "TI para Cartórios", desc: "Conformidade com Provimento 213 CNJ, segurança e backup.", href: "/ti-para-cartorios" },
      { icon: Stethoscope, label: "TI para Hospitais e Clínicas", desc: "Servidores PACS/DICOM, backup de prontuários, LGPD e suporte 24/7.", href: "/ti-para-hospitais-e-clinicas" },
      { icon: Scale, label: "TI para Advocacia", desc: "Proteção de dados, e-mail seguro e compliance LGPD.", href: "/ti-para-escritorios-de-advocacia" },
      { icon: BookOpen, label: "TI para Contabilidades", desc: "Servidores, backup e conectividade para sistemas contábeis.", href: "/ti-para-contabilidades" },
      { icon: Building2, label: "TI para Escritórios", desc: "Infraestrutura completa para escritórios corporativos.", href: "/ti-para-escritorios-corporativos" },
      { icon: Briefcase, label: "TI para Indústrias", desc: "Redes industriais, servidores de produção e monitoramento.", href: "/ti-para-industrias-alimenticias" },
    ],
  },
  {
    title: "Regiões Atendidas",
    items: [
      { icon: MapPin, label: "TI em Jacareí", desc: "Sede WMTi — atendimento imediato e presencial.", href: "/empresa-de-ti-jacarei" },
      { icon: MapPin, label: "TI em São José dos Campos", desc: "Suporte presencial e remoto para empresas em SJC.", href: "/empresa-de-ti-sao-jose-dos-campos" },
      { icon: MapPin, label: "TI em Taubaté", desc: "Cobertura completa para empresas em Taubaté.", href: "/empresa-de-ti-taubate" },
      { icon: MapPin, label: "TI no Vale do Paraíba", desc: "Atuação regional com equipe certificada.", href: "/empresa-de-ti-vale-do-paraiba" },
      { icon: Building2, label: "TI no Estado de São Paulo", desc: "Atendimento presencial e remoto em todo o estado de SP.", href: "/empresa-de-ti-sao-paulo" },
      { icon: Globe, label: "TI em Todo o Brasil", desc: "Suporte remoto 24/7 e implantações presenciais em qualquer estado.", href: "/empresa-de-ti-brasil" },
    ],
  },
];

const ServicosPage = () => (
  <div className="min-h-screen">
    <Navbar />
    <div className="pt-14 md:pt-16">
      {/* Hero */}
      <section className="section-dark py-16 md:py-24">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Todos os Serviços
            </p>
            <h1 className="text-3xl md:text-5xl max-w-3xl mb-4">
              Soluções completas de TI para{" "}
              <span className="text-primary">sua empresa.</span>
            </h1>
            <p className="font-body text-base md:text-lg text-muted-foreground max-w-2xl">
              Servidores, redes, segurança, nuvem e suporte — tudo com equipe certificada Dell e Microsoft.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Sections */}
      {sections.map((section, si) => (
        <section
          key={section.title}
          className={si % 2 === 0 ? "section-light py-16 md:py-20" : "section-dark py-16 md:py-20"}
        >
          <div className="container">
            <h2 className="text-2xl md:text-3xl mb-8 md:mb-12">{section.title}</h2>

            {/* Special Brasil banner for regions */}
            {section.title === "Regiões Atendidas" && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative mb-8 overflow-hidden h-56 md:h-72 lg:h-80 bg-center bg-cover bg-no-repeat"
                style={{ backgroundImage: `url(${brasilCoverage})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/50" />
                <div className="relative z-10 flex items-center justify-center h-full px-4">
                  <div className="text-center">
                    <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-3">// Cobertura Nacional</p>
                    <p className="text-2xl md:text-4xl font-bold text-foreground">Atendemos empresas em <span className="text-primary">todo o Brasil</span></p>
                    <p className="font-body text-sm md:text-base text-muted-foreground mt-3">Sede em Jacareí (SP) • NOC 24/7 • Equipes de campo em todos os estados</p>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
              {section.items.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                >
                  <Link
                    to={item.href}
                    className="block bg-background p-6 md:p-8 h-full group hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <item.icon size={18} className="text-primary" strokeWidth={1.5} />
                      <span className="font-mono text-xs tracking-[0.15em] uppercase text-muted-foreground">
                        {item.label}
                      </span>
                    </div>
                    <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
                      {item.desc}
                    </p>
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-primary group-hover:translate-x-1 transition-transform">
                      Saiba mais <ArrowRight size={13} />
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
    <Footer />
    <WhatsAppButton />
  </div>
);

export default ServicosPage;

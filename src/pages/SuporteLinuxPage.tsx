import { Server, Shield, Activity, Wrench, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SuporteLinuxPage = () => (
  <ServicePageTemplate
    title="Suporte Linux"
    metaTitle="Suporte Linux Corporativo | Ubuntu, CentOS, Debian | WMTi"
    metaDescription="Suporte técnico especializado em servidores Linux. Ubuntu Server, CentOS, Debian, firewall iptables, containers Docker e administração de serviços."
    tag="Suporte Linux"
    headline={<>Suporte <span className="text-primary">Linux Corporativo</span></>}
    description="A WMTi oferece suporte técnico especializado em servidores Linux para ambientes corporativos, incluindo Ubuntu Server, CentOS, Debian, firewalls, containers e serviços de rede."
    whatsappMessage="Olá! Preciso de suporte para servidores Linux."
    painPoints={[
      "Servidor Linux sem administração profissional",
      "Serviços de rede instáveis em ambiente Linux",
      "Firewall iptables/nftables mal configurado",
      "Sem atualizações de segurança aplicadas",
      "Containers Docker sem gerenciamento adequado",
    ]}
    solutions={[
      "Administração profissional de Ubuntu Server, CentOS e Debian",
      "Configuração e manutenção de serviços de rede em Linux",
      "Firewall iptables/nftables com regras otimizadas",
      "Gerenciamento de containers Docker e Docker Compose",
      "Hardening e aplicação de patches de segurança",
    ]}
    benefits={[
      { icon: Server, title: "Servidores Linux", text: "Administração de Ubuntu Server, CentOS, Debian e derivados." },
      { icon: Shield, title: "Firewall", text: "Configuração de iptables/nftables com regras otimizadas." },
      { icon: Lock, title: "Hardening", text: "Hardening de segurança e aplicação de patches de segurança." },
      { icon: Activity, title: "Monitoramento", text: "Monitoramento de serviços e performance de servidores Linux." },
      { icon: Wrench, title: "Containers", text: "Gerenciamento de Docker e Docker Compose para aplicações." },
      { icon: Headphones, title: "Suporte dedicado", text: "Equipe com expertise em administração de ambientes Linux." },
    ]}
    faq={[
      { question: "Quais distribuições vocês suportam?", answer: "Ubuntu Server, CentOS, Debian, Rocky Linux e outras distribuições enterprise." },
      { question: "Vocês gerenciam containers Docker?", answer: "Sim. Administramos ambientes Docker e Docker Compose para aplicações corporativas." },
      { question: "Fazem migração de Windows para Linux?", answer: "Sim. Realizamos migrações planejadas de ambientes Windows para Linux quando aplicável." },
    ]}
    relatedLinks={[
      { label: "Suporte Windows Server", href: "/suporte-windows-server" },
      { label: "Administração de servidores", href: "/administracao-de-servidores" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
    ]}
    localContent="Suporte para servidores Linux em Jacareí, Vale do Paraíba e em todo o Brasil."
    showHoursCalculator
  />
);

export default SuporteLinuxPage;

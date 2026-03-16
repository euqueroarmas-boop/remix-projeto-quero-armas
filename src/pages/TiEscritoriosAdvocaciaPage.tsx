import { Server, HardDrive, Shield, Activity, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/escritorios-advocacia.jpg";

const TiEscritoriosAdvocaciaPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Escritórios de Advocacia"
    metaTitle="Infraestrutura de TI para Escritórios de Advocacia | Segurança e Sigilo | WMTi"
    metaDescription="Soluções de infraestrutura de TI para escritórios de advocacia. Servidores seguros, VPN, backup criptografado, firewall corporativo e suporte técnico especializado."
    tag="TI para Escritórios de Advocacia"
    headline={<>Infraestrutura de TI para <span className="text-primary">Escritórios de Advocacia</span></>}
    description="Escritórios de advocacia lidam com dados confidenciais de clientes que exigem máxima segurança e sigilo. A WMTi oferece infraestrutura de TI sob medida para escritórios jurídicos, com proteção de dados sensíveis, VPN segura, backup criptografado e suporte técnico dedicado."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura de TI do meu escritório de advocacia."
    heroImage={heroImg}
    heroImageAlt="Escritório de advocacia moderno com infraestrutura de TI corporativa"
    painPoints={[
      "Risco de vazamento de dados confidenciais de clientes",
      "Falta de VPN segura para acesso remoto a processos",
      "Sistemas jurídicos lentos ou incompatíveis",
      "Ausência de backup criptografado para documentos",
      "Sem proteção adequada contra ataques cibernéticos",
      "Suporte técnico reativo sem manutenção preventiva",
    ]}
    solutions={[
      "Servidores corporativos com criptografia e controle de acesso por perfil",
      "VPN segura para acesso remoto a processos e documentos jurídicos",
      "Backup criptografado com replicação local e em nuvem",
      "Firewalls corporativos com políticas de segurança avançadas",
      "Monitoramento contínuo da infraestrutura para identificar falhas",
      "Suporte técnico especializado com manutenção preventiva",
    ]}
    benefits={[
      { icon: Lock, title: "Sigilo e proteção", text: "Criptografia e controle de acesso para proteger dados confidenciais de clientes." },
      { icon: Shield, title: "VPN segura", text: "Acesso remoto seguro a processos e documentos jurídicos de qualquer lugar." },
      { icon: HardDrive, title: "Backup criptografado", text: "Backup automatizado com criptografia AES-256 e replicação em nuvem." },
      { icon: Server, title: "Servidores corporativos", text: "Servidores Windows Server configurados para sistemas jurídicos com alta disponibilidade." },
      { icon: Activity, title: "Monitoramento contínuo", text: "Monitoramento de servidores e rede para evitar interrupções no escritório." },
      { icon: Headphones, title: "Suporte dedicado", text: "Equipe técnica especializada em infraestrutura de TI para escritórios jurídicos." },
    ]}
    faq={[
      { question: "A WMTi atende escritórios de advocacia?", answer: "Sim. Oferecemos soluções de TI sob medida para escritórios de advocacia, com foco em sigilo, segurança de dados e suporte técnico dedicado." },
      { question: "Como funciona a VPN para acesso remoto?", answer: "Implementamos VPN corporativa segura que permite acesso remoto criptografado a processos e documentos do escritório de qualquer localidade." },
      { question: "Vocês fazem backup de dados jurídicos?", answer: "Sim. Implementamos backup criptografado com replicação local e em nuvem, garantindo proteção total dos dados do escritório." },
      { question: "Atendem fora da região de Jacareí?", answer: "Sim. Atendemos escritórios em todo o estado de São Paulo e realizamos projetos em todo o Brasil." },
    ]}
    relatedLinks={[
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Microsoft 365", href: "/microsoft-365-para-empresas-jacarei" },
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
    ]}
    localContent="Solicite uma análise da infraestrutura de TI do seu escritório. Atendemos em Jacareí, Vale do Paraíba e em todo o estado de São Paulo."
  />
);

export default TiEscritoriosAdvocaciaPage;

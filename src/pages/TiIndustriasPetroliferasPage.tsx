import { Server, Shield, HardDrive, Activity, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/industrias-petroliferas.webp";

const TiIndustriasPetroliferasPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Indústrias Petrolíferas"
    metaTitle="Infraestrutura de TI para Indústrias Petrolíferas | Segurança e Monitoramento | WMTi"
    metaDescription="Infraestrutura de TI para indústrias petrolíferas e empresas do setor de combustíveis. Servidores corporativos, segurança de rede, backup e monitoramento."
    tag="TI para Indústrias Petrolíferas"
    headline={<>Infraestrutura de TI para <span className="text-primary">Indústrias Petrolíferas</span></>}
    description="Empresas do setor petrolífero operam com sistemas críticos que exigem alta disponibilidade e segurança da informação. A WMTi fornece soluções completas de infraestrutura de TI para empresas do setor de combustíveis e operações industriais críticas."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura tecnológica da minha empresa do setor petrolífero."
    heroImage={heroImg}
    heroImageAlt="Refinaria de petróleo com torres de destilação ao pôr do sol"
    painPoints={[
      "Sistemas operacionais críticos sem alta disponibilidade",
      "Falta de proteção contra ataques cibernéticos",
      "Ausência de backup corporativo para dados operacionais",
      "Sem monitoramento contínuo de servidores e rede",
      "Suporte técnico inadequado para ambientes críticos",
    ]}
    solutions={[
      "Servidores corporativos de alta disponibilidade para sistemas operacionais críticos",
      "Firewalls corporativos e políticas avançadas de segurança",
      "Backup corporativo seguro para proteção de informações operacionais",
      "Monitoramento 24 horas de servidores e rede para evitar interrupções",
      "Equipe especializada em ambientes de infraestrutura tecnológica crítica",
    ]}
    benefits={[
      { icon: Server, title: "Alta disponibilidade", text: "Servidores corporativos para suportar sistemas operacionais críticos com redundância." },
      { icon: Shield, title: "Segurança avançada", text: "Firewalls corporativos e políticas avançadas de segurança contra ataques cibernéticos." },
      { icon: HardDrive, title: "Backup seguro", text: "Proteção de informações operacionais com soluções de backup corporativo." },
      { icon: Activity, title: "Monitoramento 24h", text: "Monitoramento contínuo de servidores e rede para evitar interrupções operacionais." },
      { icon: Lock, title: "Proteção de dados", text: "Criptografia e controle de acesso para informações sensíveis do setor." },
      { icon: Headphones, title: "Suporte especializado", text: "Equipe especializada em ambientes de infraestrutura tecnológica crítica." },
    ]}
    faq={[
      { question: "A WMTi atende indústrias petrolíferas?", answer: "Sim. Fornecemos soluções completas de infraestrutura de TI para empresas do setor de combustíveis e operações industriais críticas." },
      { question: "Vocês oferecem monitoramento 24 horas?", answer: "Sim. Realizamos monitoramento contínuo de servidores e rede para evitar interrupções operacionais." },
      { question: "Como funciona a segurança de rede?", answer: "Implementamos firewalls corporativos e políticas avançadas de segurança para proteger a infraestrutura contra ataques cibernéticos." },
      { question: "Atendem em todo o Brasil?", answer: "Sim. Atendemos empresas do setor petrolífero em todo o Brasil com suporte remoto e visitas técnicas programadas." },
    ]}
    relatedLinks={[
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
    ]}
    localContent="Solicite uma análise da infraestrutura tecnológica da sua empresa. Atendemos em Jacareí, Vale do Paraíba e em todo o Brasil."
  />
);

export default TiIndustriasPetroliferasPage;

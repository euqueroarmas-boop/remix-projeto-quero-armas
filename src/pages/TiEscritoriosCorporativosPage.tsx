import { Server, HardDrive, Shield, Activity, Headphones, Network } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/empresas-corporativas.webp";

const TiEscritoriosCorporativosPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Empresas Corporativas"
    metaTitle="Infraestrutura de TI para Empresas Corporativas | Servidores e Redes | WMTi"
    metaDescription="Soluções completas de infraestrutura de TI para empresas corporativas. Servidores Dell, redes corporativas, backup, firewall, monitoramento e suporte técnico."
    tag="TI para Empresas Corporativas"
    headline={<>Infraestrutura de TI para <span className="text-primary">Empresas Corporativas</span></>}
    description="Empresas corporativas exigem infraestrutura de TI robusta e confiável para garantir a continuidade das operações. A WMTi oferece soluções completas de TI corporativa, desde servidores Dell PowerEdge até redes segmentadas, backup automatizado e monitoramento 24/7."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura de TI da minha empresa."
    heroImage={heroImg}
    heroImageAlt="Data center corporativo com racks de servidores e infraestrutura de TI"
    painPoints={[
      "Servidores instáveis comprometendo a operação da empresa",
      "Rede corporativa lenta e sem segmentação adequada",
      "Falta de backup automatizado para dados críticos",
      "Ausência de firewall e políticas de segurança",
      "Sem monitoramento proativo da infraestrutura",
      "Suporte técnico inadequado para ambientes corporativos",
    ]}
    solutions={[
      "Servidores Dell PowerEdge dimensionados para operação corporativa contínua",
      "Redes corporativas segmentadas com switches gerenciáveis e VLANs",
      "Backup automatizado com replicação local e em nuvem",
      "Firewalls corporativos com IDS/IPS e políticas de segurança avançadas",
      "Monitoramento 24/7 de servidores, redes e dispositivos críticos",
      "Suporte técnico especializado com manutenção preventiva e SLA definido",
    ]}
    benefits={[
      { icon: Server, title: "Servidores corporativos", text: "Servidores Dell PowerEdge com virtualização e alta disponibilidade para operação contínua." },
      { icon: Network, title: "Redes corporativas", text: "Projeto e implantação de redes segmentadas com switches gerenciáveis e VLANs." },
      { icon: HardDrive, title: "Backup automatizado", text: "Backup corporativo com replicação local e em nuvem para proteção de dados críticos." },
      { icon: Shield, title: "Segurança avançada", text: "Firewalls corporativos com IDS/IPS e políticas de segurança contra ameaças." },
      { icon: Activity, title: "Monitoramento 24/7", text: "Monitoramento contínuo de toda a infraestrutura para prevenir falhas." },
      { icon: Headphones, title: "Suporte com SLA", text: "Suporte técnico especializado com tempo de resposta definido por SLA." },
    ]}
    faq={[
      { question: "A WMTi atende empresas corporativas?", answer: "Sim. Oferecemos soluções completas de infraestrutura de TI para empresas de médio e grande porte em todo o Brasil." },
      { question: "Vocês fazem projeto de redes corporativas?", answer: "Sim. Realizamos projeto e implantação de redes segmentadas com switches gerenciáveis, VLANs e cabeamento estruturado." },
      { question: "Qual o tempo de resposta do suporte?", answer: "Trabalhamos com SLA definido por contrato, com tempos de resposta adequados à criticidade do ambiente." },
      { question: "Atendem fora da região de Jacareí?", answer: "Sim. Atendemos empresas em todo o estado de São Paulo e realizamos projetos em todo o Brasil." },
    ]}
    relatedLinks={[
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
    ]}
    localContent="Solicite uma análise da infraestrutura de TI da sua empresa. Atendemos em Jacareí, Vale do Paraíba e em todo o Brasil."
  />
);

export default TiEscritoriosCorporativosPage;

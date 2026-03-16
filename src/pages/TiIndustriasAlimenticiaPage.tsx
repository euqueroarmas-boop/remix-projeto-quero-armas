import { Server, Network, Shield, HardDrive, Activity, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/industrias-alimenticias.jpg";

const TiIndustriasAlimenticiaPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Indústrias Alimentícias"
    metaTitle="Infraestrutura de TI para Indústrias Alimentícias | Servidores, Redes e Segurança | WMTi"
    metaDescription="Soluções de TI para indústrias alimentícias. Infraestrutura de servidores, redes corporativas, backup, segurança e suporte técnico especializado."
    tag="TI para Indústrias Alimentícias"
    headline={<>Infraestrutura de TI para <span className="text-primary">Indústrias Alimentícias</span></>}
    description="A operação de uma indústria alimentícia depende diretamente da estabilidade da infraestrutura tecnológica. Sistemas de produção, controle de estoque, rastreabilidade de lotes e integração logística exigem redes confiáveis e servidores de alto desempenho. A WMTi oferece soluções completas de infraestrutura de TI para indústrias alimentícias, garantindo continuidade operacional e proteção de dados."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura de TI da minha indústria alimentícia."
    heroImage={heroImg}
    heroImageAlt="Linha de produção de indústria alimentícia com equipamentos modernos"
    painPoints={[
      "Sistemas de produção instáveis comprometendo a operação",
      "Redes industriais sem segmentação adequada",
      "Falta de backup corporativo para dados de produção",
      "Ausência de firewall e políticas de segurança",
      "Sem monitoramento contínuo de servidores e rede",
    ]}
    solutions={[
      "Servidores corporativos para sistemas ERP, controle de produção e gestão logística",
      "Redes corporativas industriais com comunicação segura entre sistemas",
      "Firewalls empresariais e políticas de segurança contra ataques cibernéticos",
      "Backup corporativo e recuperação de desastres para continuidade operacional",
      "Monitoramento contínuo de servidores e redes para identificar falhas preventivamente",
    ]}
    benefits={[
      { icon: Server, title: "Servidores industriais", text: "Implantação e gerenciamento de servidores corporativos para sistemas ERP e controle de produção." },
      { icon: Network, title: "Redes corporativas", text: "Projeto e implantação de redes para ambientes industriais com comunicação segura." },
      { icon: Shield, title: "Segurança da informação", text: "Firewalls empresariais e políticas de segurança para proteger a infraestrutura." },
      { icon: HardDrive, title: "Backup e recuperação", text: "Soluções de backup corporativo e recuperação de desastres para continuidade operacional." },
      { icon: Activity, title: "Monitoramento contínuo", text: "Monitoramento de servidores e redes para identificar falhas antes de impactar a produção." },
      { icon: Headphones, title: "Suporte especializado", text: "Equipe técnica especializada em infraestrutura de TI para ambientes industriais." },
    ]}
    faq={[
      { question: "A WMTi atende indústrias alimentícias?", answer: "Sim. Oferecemos soluções completas de infraestrutura de TI para indústrias alimentícias, incluindo servidores, redes, backup, segurança e suporte técnico." },
      { question: "Vocês fazem projeto de redes industriais?", answer: "Sim. Realizamos projeto e implantação de redes corporativas para ambientes industriais, garantindo comunicação segura entre sistemas de produção e gestão." },
      { question: "Como funciona o monitoramento?", answer: "Realizamos monitoramento contínuo de servidores e redes para identificar falhas antes que impactem a produção da sua indústria." },
      { question: "Atendem fora da região de Jacareí?", answer: "Sim. Atendemos indústrias em todo o estado de São Paulo e realizamos projetos em todo o Brasil." },
    ]}
    relatedLinks={[
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
    ]}
    localContent="Solicite uma análise da infraestrutura de TI da sua indústria. Atendemos em Jacareí, Vale do Paraíba e em todo o estado de São Paulo."
  />
);

export default TiIndustriasAlimenticiaPage;

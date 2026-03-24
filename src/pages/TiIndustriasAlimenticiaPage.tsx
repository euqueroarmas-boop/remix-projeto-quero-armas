import { Server, Network, Shield, HardDrive, Activity, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/industrias-alimenticias.webp";

const TiIndustriasAlimenticiaPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Indústrias Alimentícias"
    metaTitle="Infraestrutura de TI para Indústrias Alimentícias | Servidores, Redes e Segurança | WMTi"
    metaDescription="Soluções de TI para indústrias alimentícias. Infraestrutura de servidores, redes corporativas, backup, segurança e suporte técnico especializado."
    tag="TI para Indústrias Alimentícias"
    headline={<>Uma falha de TI na sua indústria pode <span className="text-primary">parar a linha de produção inteira</span></>}
    description="ERP fora do ar. Sistema de rastreabilidade travado. Balança sem comunicação. Estoque desatualizado. E a linha de produção esperando. Em indústria alimentícia, uma falha de TI não é só inconveniente — é produção perdida, lote comprometido, entrega atrasada. E os custos se acumulam rápido. A infraestrutura de TI precisa funcionar no mesmo ritmo da produção. Sem pausa, sem instabilidade, sem surpresa. A WMTi estrutura a TI da sua indústria para que a tecnologia nunca seja o gargalo."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura de TI da minha indústria alimentícia."
    heroImage={heroImg}
    heroImageAlt="Linha de produção de indústria alimentícia com equipamentos modernos"
    painPoints={[
      "ERP e sistemas de produção instáveis comprometendo a operação",
      "Rede industrial sem segmentação — produção e escritório misturados",
      "Sem backup confiável para dados de produção e rastreabilidade",
      "Sem proteção contra ataques que podem paralisar a fábrica",
      "Problemas de TI descobertos só quando a produção já parou",
    ]}
    solutions={[
      "Servidores corporativos dimensionados para ERP, controle de produção e logística",
      "Rede industrial segmentada — produção isolada do escritório",
      "Firewall e políticas de segurança contra ataques cibernéticos",
      "Backup automatizado com recuperação rápida para continuidade operacional",
      "Monitoramento contínuo para agir antes da falha, não depois",
    ]}
    benefits={[
      { icon: Server, title: "Servidores industriais", text: "Servidores dimensionados para ERP pesado e controle de produção em tempo real." },
      { icon: Network, title: "Rede segmentada", text: "Produção e escritório separados. Problema em um não derruba o outro." },
      { icon: Shield, title: "Proteção industrial", text: "Firewall e políticas de segurança para proteger a infraestrutura da fábrica." },
      { icon: HardDrive, title: "Backup de produção", text: "Dados de rastreabilidade e produção protegidos com backup automatizado." },
      { icon: Activity, title: "Monitoramento contínuo", text: "Falhas detectadas antes de pararem a produção. Proativo, não reativo." },
      { icon: Headphones, title: "Suporte industrial", text: "Equipe que entende a urgência de ambiente industrial. Resolve rápido." },
    ]}
    faq={[
      { question: "A WMTi atende indústrias alimentícias?", answer: "Sim. Entendemos que produção não pode parar. A TI é estruturada para funcionar no ritmo da fábrica." },
      { question: "Vocês fazem projeto de redes industriais?", answer: "Sim. Rede segmentada para separar produção de escritório, com comunicação segura entre sistemas." },
      { question: "Como funciona o monitoramento?", answer: "Monitoramento contínuo de servidores e rede. Alerta antes da falha, ação antes da parada." },
      { question: "Atendem fora da região de Jacareí?", answer: "Sim. São Paulo inteiro e projetos em todo o Brasil." },
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

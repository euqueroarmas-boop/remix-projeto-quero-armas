import { Network, Shield, Activity, Wrench, Headphones, Eye } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SuporteRedesCorporativasPage = () => (
  <ServicePageTemplate
    title="Suporte Técnico Para Redes Corporativas"
    metaTitle="Suporte Técnico Para Redes Corporativas | WMTi"
    metaDescription="Suporte técnico especializado para redes corporativas. Diagnóstico, manutenção, otimização e monitoramento de switches, access points e cabeamento estruturado."
    tag="Suporte Técnico Para Redes Corporativas"
    headline={<>Suporte Técnico Para <span className="text-primary">Redes Corporativas</span></>}
    description="A WMTi oferece suporte técnico especializado para redes corporativas, incluindo diagnóstico de falhas, otimização de performance, manutenção de switches e access points e monitoramento contínuo."
    whatsappMessage="Olá! Preciso de suporte técnico para minha rede corporativa."
    painPoints={[
      "Rede corporativa lenta sem diagnóstico",
      "Switches e access points sem gerenciamento",
      "Cabeamento desorganizado e sem certificação",
      "Sem suporte para problemas de conectividade",
    ]}
    solutions={[
      "Diagnóstico completo de falhas e gargalos de rede",
      "Gerenciamento de switches e access points corporativos",
      "Certificação e reorganização de cabeamento estruturado",
      "Suporte técnico para problemas de conectividade e performance",
    ]}
    benefits={[
      { icon: Network, title: "Diagnóstico de rede", text: "Análise completa de falhas, gargalos e oportunidades de melhoria." },
      { icon: Shield, title: "Gerenciamento", text: "Gerenciamento de switches e access points com configuração centralizada." },
      { icon: Activity, title: "Performance", text: "Otimização de performance da rede corporativa." },
      { icon: Wrench, title: "Cabeamento", text: "Certificação e reorganização de cabeamento estruturado Cat6A." },
      { icon: Eye, title: "Monitoramento", text: "Monitoramento contínuo de disponibilidade e performance da rede." },
      { icon: Headphones, title: "Suporte técnico", text: "Equipe especializada em infraestrutura de rede corporativa." },
    ]}
    faq={[
      { question: "Vocês diagnosticam problemas de rede?", answer: "Sim. Realizamos diagnóstico completo com ferramentas profissionais para identificar falhas e gargalos." },
      { question: "Atendem qual tipo de rede?", answer: "Redes cabeadas e Wi-Fi corporativas com switches gerenciáveis e access points profissionais." },
      { question: "Fazem certificação de cabeamento?", answer: "Sim. Certificamos cabeamento estruturado Cat6A com relatórios de teste." },
    ]}
    relatedLinks={[
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { label: "Monitoramento de rede", href: "/monitoramento-de-rede" },
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
    ]}
    localContent="Suporte para redes corporativas em Jacareí, Vale do Paraíba e em todo o Brasil."
    showHoursCalculator
  />
);

export default SuporteRedesCorporativasPage;

import { Activity, Network, AlertTriangle, Eye, Shield, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const MonitoramentoDeRedePage = () => (
  <ServicePageTemplate
    title="Monitoramento De Rede"
    metaTitle="Monitoramento De Rede Corporativa 24/7 | WMTi"
    metaDescription="Monitoramento contínuo de redes corporativas. Alertas em tempo real, análise de tráfego, detecção de falhas e suporte técnico especializado."
    tag="Monitoramento De Rede"
    headline={<>Monitoramento De <span className="text-primary">Rede Corporativa</span></>}
    description="O monitoramento contínuo da rede permite identificar gargalos, falhas e ameaças antes que impactem a operação. A WMTi oferece monitoramento 24/7 com alertas e análise de tráfego."
    whatsappMessage="Olá! Preciso de monitoramento de rede corporativa."
    painPoints={[
      "Rede lenta sem diagnóstico de causa",
      "Falhas de conectividade sem previsão",
      "Sem visibilidade sobre uso da banda",
      "Equipamentos de rede sem gerenciamento",
    ]}
    solutions={[
      "Monitoramento 24/7 de switches, access points e roteadores",
      "Análise de tráfego e uso de banda por dispositivo",
      "Alertas em tempo real para falhas e degradação de performance",
      "Gerenciamento de equipamentos de rede com configuração centralizada",
    ]}
    benefits={[
      { icon: Activity, title: "Monitoramento 24/7", text: "Monitoramento contínuo de toda a infraestrutura de rede." },
      { icon: Network, title: "Análise de tráfego", text: "Visibilidade completa do uso de banda e tráfego por dispositivo." },
      { icon: AlertTriangle, title: "Alertas proativos", text: "Notificações automáticas para falhas e degradação de performance." },
      { icon: Eye, title: "Dashboards", text: "Painéis de monitoramento em tempo real para acompanhamento." },
      { icon: Shield, title: "Segurança", text: "Detecção de dispositivos não autorizados na rede." },
      { icon: Headphones, title: "Suporte técnico", text: "Equipe especializada em infraestrutura de rede corporativa." },
    ]}
    faq={[
      { question: "O que é monitorado na rede?", answer: "Switches, access points, roteadores, links de internet, tráfego e disponibilidade de serviços." },
      { question: "Vocês detectam problemas antes de pararem?", answer: "Sim. O monitoramento identifica tendências e anomalias que indicam possíveis falhas futuras." },
      { question: "Funciona com qualquer equipamento?", answer: "Sim. Monitoramos equipamentos de qualquer fabricante que suporte SNMP ou protocolos padrão." },
    ]}
    relatedLinks={[
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { label: "Segurança de rede", href: "/seguranca-de-rede" },
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
    ]}
    localContent="Monitoramos redes corporativas em Jacareí, Vale do Paraíba e em todo o Brasil."
    showHoursCalculator
  />
);

export default MonitoramentoDeRedePage;

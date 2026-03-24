import { Activity, Network, AlertTriangle, Eye, Shield, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const MonitoramentoDeRedePage = () => (
  <ServicePageTemplate
    title="Monitoramento De Rede"
    metaTitle="Monitoramento De Rede Corporativa 24/7 | WMTi"
    metaDescription="Monitoramento contínuo de redes corporativas. Alertas em tempo real, análise de tráfego, detecção de falhas e suporte técnico especializado."
    tag="Monitoramento De Rede"
    headline={<>Você não sabe o que está acontecendo <span className="text-primary">na sua rede agora</span></>}
    description="Quantos dispositivos estão conectados? Qual link está sobrecarregado? Tem alguém acessando o que não deveria? Tem equipamento prestes a falhar? Se você não sabe responder, está operando no escuro. E quando a rede cai, você descobre da pior forma — com todo mundo parado. Monitorar não é luxo. É o mínimo para uma empresa que depende de tecnologia. A WMTi monitora sua rede 24/7 e age antes que o problema aconteça."
    whatsappMessage="Olá! Preciso de monitoramento de rede corporativa."
    painPoints={[
      "Rede lenta e ninguém consegue identificar a causa",
      "Falhas de conectividade que aparecem sem aviso",
      "Sem visibilidade sobre quem usa o quê na rede",
      "Equipamentos de rede funcionando no piloto automático",
    ]}
    solutions={[
      "Monitoramento 24/7 de switches, access points e roteadores",
      "Análise de tráfego e uso de banda por dispositivo em tempo real",
      "Alertas automáticos para falhas e degradação de performance",
      "Gerenciamento centralizado de todos os equipamentos de rede",
    ]}
    benefits={[
      { icon: Activity, title: "Monitoramento 24/7", text: "Sua rede inteira monitorada em tempo real — não só quando alguém reclama." },
      { icon: Network, title: "Visibilidade total", text: "Saber exatamente o que está consumindo banda e onde está o gargalo." },
      { icon: AlertTriangle, title: "Alertas antes da falha", text: "Notificações automáticas quando algo sai do normal — antes de parar tudo." },
      { icon: Eye, title: "Dashboards em tempo real", text: "Painéis visuais mostrando a saúde da rede a qualquer momento." },
      { icon: Shield, title: "Segurança", text: "Detecção de dispositivos não autorizados conectados na sua rede." },
      { icon: Headphones, title: "Suporte proativo", text: "Equipe que age quando o alerta toca — não quando você liga reclamando." },
    ]}
    faq={[
      { question: "O que é monitorado na rede?", answer: "Tudo: switches, access points, roteadores, links de internet, tráfego e disponibilidade de serviços. Se está na rede, a gente monitora." },
      { question: "Vocês detectam problemas antes de pararem?", answer: "Sim. O monitoramento identifica tendências e anomalias que indicam falhas futuras. A gente age antes de virar problema." },
      { question: "Funciona com qualquer equipamento?", answer: "Sim. Monitoramos equipamentos de qualquer fabricante que suporte SNMP ou protocolos padrão de rede." },
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

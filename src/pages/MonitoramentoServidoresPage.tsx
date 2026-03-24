import { Activity, Server, Shield, AlertTriangle, Headphones, Eye } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const MonitoramentoServidoresPage = () => (
  <ServicePageTemplate
    title="Monitoramento De Servidores"
    metaTitle="Monitoramento De Servidores 24/7 | Infraestrutura Corporativa | WMTi"
    metaDescription="Monitoramento contínuo de servidores corporativos. Alertas em tempo real, dashboards de performance, prevenção de falhas e suporte técnico especializado."
    tag="Monitoramento De Servidores"
    headline={<>Seu servidor pode parar a qualquer momento — e <span className="text-primary">você só vai saber quando já for tarde</span></>}
    description="Disco cheio. Memória esgotada. Processo travado consumindo tudo. Temperatura alta. E ninguém viu. Ninguém alertou. Ninguém agiu. Até que o servidor parou. E quando o servidor para, a empresa para. Sem acesso a arquivos, sem sistema, sem operação. E aí vem a correria para resolver às pressas o que poderia ter sido evitado. A WMTi monitora seus servidores 24/7 e age no primeiro sinal de problema — não no último."
    whatsappMessage="Olá! Preciso de monitoramento de servidores corporativos."
    painPoints={[
      "Falhas descobertas só quando o servidor já parou",
      "Sem visibilidade sobre CPU, memória e disco em tempo real",
      "Discos enchendo sem aviso até causar parada total",
      "Nenhum alerta configurado para situações críticas",
    ]}
    solutions={[
      "Monitoramento 24/7 de CPU, memória, disco e rede de cada servidor",
      "Alertas em tempo real quando indicadores atingem níveis críticos",
      "Dashboards de performance para visibilidade completa da infraestrutura",
      "Ações preventivas baseadas em tendências — antes da falha, não depois",
    ]}
    benefits={[
      { icon: Activity, title: "Monitoramento 24/7", text: "Seus servidores monitorados o tempo todo — não só em horário comercial." },
      { icon: AlertTriangle, title: "Alertas imediatos", text: "Indicador crítico? Alerta na hora. Ação antes que vire parada." },
      { icon: Eye, title: "Visibilidade total", text: "Dashboards mostrando a saúde de cada servidor em tempo real." },
      { icon: Server, title: "Prevenção de falhas", text: "Tendências identificadas antes que se transformem em problemas reais." },
      { icon: Shield, title: "Segurança", text: "Detecção de atividades anômalas e tentativas de acesso indevido." },
      { icon: Headphones, title: "Ação proativa", text: "Equipe que age quando o alerta toca — não quando você liga desesperado." },
    ]}
    faq={[
      { question: "O que é monitorado nos servidores?", answer: "CPU, memória RAM, disco, rede, serviços críticos e logs. Tudo que pode indicar um problema antes dele acontecer." },
      { question: "Os alertas são em tempo real?", answer: "Sim. Indicador crítico dispara alerta imediatamente. A equipe age na hora, não no dia seguinte." },
      { question: "Funciona para servidores em nuvem?", answer: "Sim. Físicos, virtuais, on-premises e nuvem. Se é servidor, a gente monitora." },
    ]}
    relatedLinks={[
      { label: "Administração de servidores", href: "/administracao-de-servidores" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
    ]}
    localContent="Monitoramos servidores de empresas em Jacareí, Vale do Paraíba e em todo o Brasil."
    showHoursCalculator
  />
);

export default MonitoramentoServidoresPage;

import { Activity, Server, Shield, AlertTriangle, Headphones, Eye } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const MonitoramentoServidoresPage = () => (
  <ServicePageTemplate
    title="Monitoramento De Servidores"
    metaTitle="Monitoramento De Servidores 24/7 | Infraestrutura Corporativa | WMTi"
    metaDescription="Monitoramento contínuo de servidores corporativos. Alertas em tempo real, dashboards de performance, prevenção de falhas e suporte técnico especializado."
    tag="Monitoramento De Servidores"
    headline={<>Monitoramento De <span className="text-primary">Servidores 24/7</span></>}
    description="O monitoramento contínuo de servidores permite identificar falhas antes que impactem a operação da empresa. A WMTi oferece monitoramento 24/7 com alertas em tempo real e suporte proativo."
    whatsappMessage="Olá! Preciso de monitoramento de servidores corporativos."
    painPoints={[
      "Falhas em servidores descobertas só quando o sistema para",
      "Sem visibilidade sobre performance da infraestrutura",
      "Discos cheios causando paradas inesperadas",
      "Sem alertas para problemas críticos",
    ]}
    solutions={[
      "Monitoramento 24/7 de CPU, memória, disco e rede",
      "Alertas em tempo real para situações críticas",
      "Dashboards de performance para visibilidade completa",
      "Ações preventivas antes que falhas impactem a operação",
    ]}
    benefits={[
      { icon: Activity, title: "Monitoramento 24/7", text: "Monitoramento contínuo de todos os servidores e recursos críticos." },
      { icon: AlertTriangle, title: "Alertas em tempo real", text: "Notificações imediatas quando indicadores atingem níveis críticos." },
      { icon: Eye, title: "Dashboards", text: "Visibilidade completa da saúde da infraestrutura em tempo real." },
      { icon: Server, title: "Prevenção de falhas", text: "Ações preventivas baseadas em tendências de performance." },
      { icon: Shield, title: "Segurança", text: "Detecção de atividades anômalas e tentativas de acesso indevido." },
      { icon: Headphones, title: "Suporte proativo", text: "Equipe técnica atuando proativamente para prevenir problemas." },
    ]}
    faq={[
      { question: "O que é monitorado nos servidores?", answer: "Monitoramos CPU, memória RAM, espaço em disco, tráfego de rede, serviços críticos e logs de eventos." },
      { question: "Os alertas são em tempo real?", answer: "Sim. Quando um indicador atinge nível crítico, alertas são enviados imediatamente para nossa equipe atuar." },
      { question: "Funciona para servidores em nuvem?", answer: "Sim. Monitoramos servidores físicos e virtuais, on-premises e em nuvem." },
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

import { Server, Shield, Cpu, HardDrive, Activity, Wrench } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const ServidoresDellPage = () => (
  <ServicePageTemplate
    title="Servidores Dell PowerEdge em Jacareí"
    metaTitle="Servidores Dell PowerEdge em Jacareí e São José dos Campos | WMTi"
    metaDescription="Implantação e gerenciamento de servidores Dell PowerEdge R750, R650 e T550 em Jacareí, São José dos Campos e Vale do Paraíba. RAID, Hyper-V, iDRAC e suporte 24/7."
    tag="Dell PowerEdge"
    headline={<>Servidores Dell PowerEdge para sua empresa em <span className="text-primary">Jacareí e região.</span></>}
    description="Implantamos e gerenciamos servidores Dell PowerEdge para virtualização, bancos de dados e aplicações de missão crítica. Configuração de RAID, iDRAC, clustering Hyper-V e alta disponibilidade."
    whatsappMessage="Olá! Gostaria de um orçamento para servidores Dell PowerEdge para minha empresa."
    painPoints={[
      "Servidor atual apresenta lentidão e travamentos frequentes",
      "Dados críticos em risco por falta de redundância (sem RAID)",
      "Custo alto com manutenções emergenciais em hardware antigo",
      "Downtime não planejado impactando produtividade da equipe",
      "Falta de monitoramento remoto e alertas proativos",
    ]}
    solutions={[
      "Servidores Dell PowerEdge R750xs e R650xs com processadores Intel Xeon de 4ª geração",
      "RAID com controladora H755/H355 para proteção total dos dados",
      "Gerenciamento remoto via iDRAC9 Enterprise — acesso de qualquer lugar",
      "Clustering Hyper-V para alta disponibilidade e failover automático",
      "Monitoramento 24/7 com alertas proativos via Zabbix e Grafana",
    ]}
    benefits={[
      { icon: Server, title: "Hardware enterprise", text: "Servidores projetados para operação contínua 24/7 com componentes hot-swap." },
      { icon: Shield, title: "Redundância total", text: "RAID, fontes redundantes e clustering para zero downtime não planejado." },
      { icon: Cpu, title: "Performance superior", text: "Intel Xeon Scalable de 4ª geração com até 2TB de memória DDR5." },
      { icon: HardDrive, title: "Storage escalável", text: "Até 24 baías NVMe/SAS/SATA para crescimento sob demanda." },
      { icon: Activity, title: "Monitoramento contínuo", text: "NOC 24/7 com alertas automáticos e resposta imediata a incidentes." },
      { icon: Wrench, title: "Suporte especializado", text: "Equipe certificada Dell com atendimento presencial e remoto." },
    ]}
    faq={[
      { question: "Qual servidor Dell é ideal para minha empresa?", answer: "Depende do volume de dados, número de usuários e aplicações. O R750xs é ideal para virtualização pesada e bancos de dados. O R650xs atende aplicações web e file servers. O T550 é perfeito para escritórios menores. Fazemos um diagnóstico gratuito para recomendar o modelo ideal." },
      { question: "Quanto custa um servidor Dell PowerEdge?", answer: "O investimento varia conforme a configuração. Oferecemos servidores a partir de R$ 15.000 com instalação e configuração inclusas. Também trabalhamos com leasing e financiamento. Solicite um orçamento personalizado." },
      { question: "Vocês fazem a instalação e configuração completa?", answer: "Sim. Cuidamos de todo o projeto: dimensionamento, aquisição, instalação física, configuração do sistema operacional, RAID, rede, backup e monitoramento. Entregamos o servidor funcionando e monitorado." },
      { question: "Atendem empresas em São José dos Campos?", answer: "Sim. Atendemos empresas em Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba com atendimento presencial e suporte remoto 24/7." },
    ]}
    relatedLinks={[
      { label: "Microsoft 365", href: "/microsoft-365-para-empresas-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa" },
      { label: "Suporte de TI", href: "/suporte-ti-empresarial-jacarei" },
    ]}
    localContent="A WMTi atende empresas de todos os portes em Jacareí, São José dos Campos, Taubaté e região do Vale do Paraíba. Nossos técnicos certificados Dell realizam a implementação presencial de servidores PowerEdge, garantindo instalação profissional com cabeamento estruturado, configuração de rede e integração com sua infraestrutura existente. Atendimento emergencial presencial em até 4 horas para clientes com contrato de suporte."
    showHoursCalculator
  />
);

export default ServidoresDellPage;

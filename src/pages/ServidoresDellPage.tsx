import { Server, Shield, Cpu, HardDrive, Activity, Wrench } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const ServidoresDellPage = () => (
  <ServicePageTemplate
    title="Servidor Dell PowerEdge em Jacareí"
    metaTitle="Servidor Dell PowerEdge em Jacareí — Sua empresa está rodando no limite | WMTi"
    metaDescription="Servidor Dell PowerEdge em Jacareí. Servidores profissionais, configuração correta, segurança de dados e performance estável. Sua empresa está rodando no limite e isso vai virar problema."
    tag="Dell PowerEdge"
    headline={<>Sua empresa está rodando no <span className="text-primary">limite</span> e isso vai virar problema</>}
    description="Sistema lento não é só incômodo — é sintoma. Quando sua empresa começa a travar, demorar, apresentar falhas ou instabilidade, isso não acontece por acaso. Isso acontece porque a estrutura não está acompanhando o crescimento. E isso é perigoso. Porque você continua operando… até o dia que algo para. E quando para, para tudo: acesso aos arquivos, sistemas internos, operação da equipe, atendimento ao cliente. E aí o prejuízo é imediato. A maioria das empresas trabalha no limite da infraestrutura. Até o dia que não aguenta mais."
    whatsappMessage="Olá! Gostaria de um orçamento para servidores Dell PowerEdge para minha empresa."
    painPoints={[
      "Sistema lento — sintoma de estrutura que não acompanha o crescimento",
      "Travamentos e instabilidade constantes na operação",
      "Risco de parada total: arquivos, sistemas e atendimento inacessíveis",
      "Empresa trabalhando no limite da infraestrutura sem saber",
      "Prejuízo imediato quando a estrutura finalmente não aguenta mais",
    ]}
    solutions={[
      "Servidores profissionais dimensionados para o crescimento da empresa",
      "Configuração correta desde o início — sem improvisos",
      "Segurança de dados com redundância e proteção real",
      "Performance estável para que a operação funcione sem sustos",
      "Saída de um ambiente instável e imprevisível para uma estrutura preparada para crescer",
    ]}
    benefits={[
      { icon: Server, title: "Servidores profissionais", text: "A WMTi estrutura sua empresa para não chegar no ponto de parada. Servidores projetados para operação contínua 24/7." },
      { icon: Shield, title: "Segurança de dados", text: "Redundância total com RAID, fontes redundantes e clustering para zero downtime não planejado." },
      { icon: Cpu, title: "Performance estável", text: "Crescer sem estrutura não é crescimento — é risco acumulado. Performance dimensionada para o futuro." },
      { icon: HardDrive, title: "Configuração correta", text: "Ambiente instável e imprevisível vira estrutura preparada para crescer sob demanda." },
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

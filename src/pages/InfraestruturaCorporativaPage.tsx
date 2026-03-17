import { Server, Network, Shield, Cloud, Activity, HardDrive } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/dell-infrastructure.webp";

const InfraestruturaCorporativaPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI Corporativa"
    metaTitle="Infraestrutura de TI Corporativa em Jacareí e São José dos Campos | WMTi"
    metaDescription="Projetos completos de infraestrutura de TI corporativa em Jacareí e Vale do Paraíba. Servidores, redes, segurança, backup, nuvem e monitoramento 24/7 com equipe certificada."
    tag="Infraestrutura Corporativa"
    headline={<>Infraestrutura de TI <span className="text-primary">completa</span> para sua empresa.</>}
    description="Projetos completos de infraestrutura de TI: servidores Dell, redes estruturadas, firewall pfSense, backup Veeam, Microsoft 365 e monitoramento 24/7. Da concepção à operação, com equipe certificada."
    whatsappMessage="Olá! Gostaria de um projeto completo de infraestrutura de TI para minha empresa."
    heroImage={heroImg}
    heroImageAlt="Infraestrutura corporativa Dell com desktops OptiPlex, workstations e servidores PowerEdge para empresas"
    painPoints={[
      "Infraestrutura de TI desorganizada e sem padrão",
      "Múltiplos fornecedores sem integração entre soluções",
      "Falta de documentação técnica e plano de continuidade",
      "Incapacidade de escalar a TI conforme o crescimento da empresa",
      "Riscos de segurança por falta de política unificada",
    ]}
    solutions={[
      "Projeto integrado de infraestrutura: servidor + rede + segurança + backup + nuvem",
      "Fornecedor único para toda a TI — menos complexidade, mais eficiência",
      "Documentação completa: topologia de rede, PCN, PRD e inventário de ativos",
      "Arquitetura escalável que cresce com sua empresa",
      "Monitoramento unificado 24/7 de toda a infraestrutura via NOC próprio",
    ]}
    benefits={[
      { icon: Server, title: "Servidores Dell", text: "PowerEdge enterprise com RAID, redundância e virtualização Hyper-V." },
      { icon: Network, title: "Redes estruturadas", text: "Cabeamento Cat6A/fibra, switches Dell gerenciáveis e VLANs." },
      { icon: Shield, title: "Segurança integrada", text: "pfSense, VPN, IDS/IPS, antivírus gerenciado e controle de acesso." },
      { icon: Cloud, title: "Nuvem Microsoft", text: "Microsoft 365, Azure AD, Exchange Online e backup em nuvem." },
      { icon: HardDrive, title: "Backup 3-2-1", text: "Veeam + storage local + nuvem com testes de restauração periódicos." },
      { icon: Activity, title: "NOC 24/7", text: "Monitoramento contínuo com Zabbix, dashboards Grafana e SLA." },
    ]}
    faq={[
      { question: "A WMTi faz o projeto completo de TI?", answer: "Sim. Do levantamento de requisitos ao monitoramento contínuo. Dimensionamos servidores, projetamos a rede, implementamos segurança, configuramos backup e mantemos tudo funcionando com suporte 24/7." },
      { question: "Quanto tempo leva para montar uma infraestrutura completa?", answer: "Para empresas de 10-50 estações, o projeto completo leva de 2 a 4 semanas. Projetos maiores ou mais complexos podem levar de 4 a 8 semanas. Planejamos a implementação para minimizar o impacto na operação." },
      { question: "Vocês atendem indústrias?", answer: "Sim. Atendemos indústrias, escritórios, clínicas, cartórios, lojas e empresas de todos os segmentos em Jacareí, São José dos Campos, Taubaté e Vale do Paraíba." },
      { question: "Posso contratar apenas parte dos serviços?", answer: "Sim. Cada serviço pode ser contratado individualmente: apenas servidores, apenas rede, apenas firewall, etc. Porém, projetos integrados oferecem melhor custo-benefício e maior eficiência operacional." },
    ]}
    relatedLinks={[
      { label: "Servidores Dell", href: "/servidores-dell-poweredge-jacarei" },
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Microsoft 365", href: "/microsoft-365-para-empresas-jacarei" },
      { label: "Suporte de TI", href: "/suporte-ti-empresarial-jacarei" },
    ]}
    localContent="A WMTi é referência em infraestrutura de TI corporativa em Jacareí, São José dos Campos, Taubaté e região do Vale do Paraíba. Atendemos empresas de todos os portes e segmentos — de escritórios com 5 estações a indústrias com 200+ colaboradores. Todo o projeto é executado por equipe própria certificada Dell e Microsoft."
    showHoursCalculator
  />
);

export default InfraestruturaCorporativaPage;

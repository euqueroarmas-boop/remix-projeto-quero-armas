import { Server, Network, Shield, Cloud, Activity, HardDrive } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/dell-infrastructure.webp";

const InfraestruturaCorporativaPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI Corporativa"
    metaTitle="Infraestrutura de TI Corporativa em Jacareí e São José dos Campos | WMTi"
    metaDescription="Projetos completos de infraestrutura de TI corporativa em Jacareí e Vale do Paraíba. Servidores, redes, segurança, backup, nuvem e monitoramento 24/7 com equipe certificada."
    tag="Infraestrutura Corporativa"
    headline={<>Sua empresa cresceu, mas <span className="text-primary">a TI ficou para trás</span></>}
    description="Mais gente, mais computadores, mais sistemas, mais demanda. Mas a mesma rede de quando tinha metade dos funcionários. O mesmo servidor de três anos atrás. O mesmo 'jeitinho' que alguém configurou uma vez e nunca mais mexeu. E agora tudo trava, demora, cai e ninguém sabe por quê. Porque o problema não é o computador. É que a infraestrutura não acompanhou o crescimento. A WMTi projeta e implementa a infraestrutura que sua empresa precisa para funcionar — e crescer — sem travar."
    whatsappMessage="Olá! Gostaria de um projeto completo de infraestrutura de TI para minha empresa."
    heroImage={heroImg}
    heroImageAlt="Infraestrutura corporativa Dell com desktops OptiPlex, workstations e servidores PowerEdge para empresas"
    painPoints={[
      "TI que foi montada aos poucos, sem projeto nem padrão",
      "Vários fornecedores diferentes que não conversam entre si",
      "Sem documentação — ninguém sabe o que está configurado",
      "Infraestrutura que não aguenta mais o ritmo da empresa",
      "Problemas de segurança por falta de política unificada",
    ]}
    solutions={[
      "Projeto integrado: servidor + rede + segurança + backup + nuvem — tudo pensado junto",
      "Fornecedor único para toda a TI — menos complexidade, mais resultado",
      "Documentação completa: topologia de rede, inventário, PCN e PRD",
      "Arquitetura escalável que cresce junto com sua empresa",
      "Monitoramento unificado 24/7 de toda a infraestrutura",
    ]}
    benefits={[
      { icon: Server, title: "Servidores Dell", text: "PowerEdge enterprise com RAID, redundância e virtualização. Servidor de verdade, não PC fazendo papel de servidor." },
      { icon: Network, title: "Rede profissional", text: "Cabeamento Cat6A, switches Dell gerenciáveis e VLANs. Rede que funciona de verdade." },
      { icon: Shield, title: "Segurança integrada", text: "pfSense, VPN, IDS/IPS, antivírus gerenciado. Proteção em camadas, não remendo." },
      { icon: Cloud, title: "Nuvem Microsoft", text: "Microsoft 365, Azure AD, Exchange Online e backup em nuvem integrados." },
      { icon: HardDrive, title: "Backup 3-2-1", text: "Veeam + storage local + nuvem com testes de restauração. Backup que funciona quando precisa." },
      { icon: Activity, title: "NOC 24/7", text: "Monitoramento contínuo com alertas e SLA. Saber antes, agir antes." },
    ]}
    faq={[
      { question: "A WMTi faz o projeto completo de TI?", answer: "Sim. Do levantamento ao monitoramento contínuo. Servidores, rede, segurança, backup — tudo integrado por um fornecedor que entende o todo." },
      { question: "Quanto tempo leva para montar uma infraestrutura completa?", answer: "De 2 a 4 semanas para 10-50 estações. Projetos maiores de 4 a 8 semanas. Planejamos para minimizar impacto na operação." },
      { question: "Vocês atendem indústrias?", answer: "Sim. Indústrias, escritórios, clínicas, cartórios — qualquer empresa que precise de TI que funcione de verdade." },
      { question: "Posso contratar apenas parte dos serviços?", answer: "Sim. Cada serviço funciona individualmente. Mas projetos integrados entregam mais resultado por menos investimento." },
    ]}
    relatedLinks={[
      { label: "Servidores Dell", href: "/servidores-dell-poweredge-jacarei" },
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Microsoft 365", href: "/microsoft-365-para-empresas-jacarei" },
      { label: "Suporte de TI", href: "/suporte-ti-empresarial-jacarei" },
    ]}
    localContent="A WMTi é referência em infraestrutura de TI corporativa em Jacareí, São José dos Campos, Taubaté e Vale do Paraíba. De escritórios com 5 estações a indústrias com 200+ colaboradores. Equipe própria certificada Dell e Microsoft."
    showHoursCalculator
  />
);

export default InfraestruturaCorporativaPage;

import { Server, HardDrive, Shield, Activity, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/escritorios-contabilidade.webp";

const TiContabilidadesPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Escritórios de Contabilidade"
    metaTitle="Infraestrutura de TI para Escritórios de Contabilidade | Segurança Fiscal | WMTi"
    metaDescription="Soluções de TI para escritórios de contabilidade. Servidores seguros, backup fiscal automatizado, integração com sistemas contábeis e suporte técnico especializado."
    tag="TI para Escritórios de Contabilidade"
    headline={<>Seu escritório de contabilidade depende de sistemas que <span className="text-primary">podem falhar a qualquer momento</span></>}
    description="Período de fechamento fiscal. Sistema travando. Servidor lento. Arquivo que sumiu. Backup que ninguém sabe se está funcionando. E seus clientes esperando as obrigações serem entregues no prazo. Um escritório de contabilidade não pode ter TI instável. Dados fiscais, tributários e financeiros dos seus clientes dependem de infraestrutura que funcione — sempre. Não amanhã. Não quando der. Sempre. A WMTi estrutura a TI do seu escritório para que o sistema nunca seja o gargalo."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura de TI do meu escritório de contabilidade."
    heroImage={heroImg}
    heroImageAlt="Escritório de contabilidade moderno com múltiplos monitores e sistemas financeiros"
    painPoints={[
      "Perda de dados fiscais por falta de backup confiável",
      "Sistema contábil travando no período de fechamento",
      "Dados financeiros de clientes sem proteção adequada",
      "Servidor antigo sem manutenção preventiva",
      "Rede lenta comprometendo a produtividade da equipe",
      "Sem firewall protegendo informações sensíveis",
    ]}
    solutions={[
      "Backup fiscal automatizado com replicação local e em nuvem — nunca mais perder dado",
      "Servidores dimensionados para aguentar o fechamento sem travar",
      "Criptografia e controle de acesso para dados financeiros de clientes",
      "Firewall corporativo com políticas de segurança para o escritório",
      "Monitoramento contínuo para evitar falhas em períodos críticos",
      "Manutenção preventiva programada — não só quando dá problema",
    ]}
    benefits={[
      { icon: HardDrive, title: "Backup fiscal seguro", text: "Backup automatizado de dados fiscais com replicação segura. Nunca mais rezar para o backup funcionar." },
      { icon: Server, title: "Servidor que aguenta", text: "Windows Server dimensionado para sistemas contábeis pesados. Sem travar no fechamento." },
      { icon: Lock, title: "Dados protegidos", text: "Criptografia e controle de acesso. Dados dos seus clientes seguros de verdade." },
      { icon: Shield, title: "Firewall corporativo", text: "Proteção de rede com firewall profissional. Não só o roteador da operadora." },
      { icon: Activity, title: "Monitoramento contínuo", text: "Servidores e rede monitorados para garantir estabilidade quando mais importa." },
      { icon: Headphones, title: "Suporte que entende", text: "Equipe que conhece a rotina de escritório contábil e resolve rápido." },
    ]}
    faq={[
      { question: "A WMTi atende escritórios de contabilidade?", answer: "Sim. Entendemos a rotina de fechamento fiscal, as demandas de performance e a criticidade dos dados. A TI é configurada para isso." },
      { question: "Como funciona o backup fiscal?", answer: "Automático, com replicação local e em nuvem. Testado periodicamente para garantir que funciona quando precisar. Não é cópia manual em HD externo." },
      { question: "Vocês garantem performance durante o fechamento?", answer: "Sim. Dimensionamos servidores e rede para aguentar picos de carga. O sistema não pode travar justo quando mais precisa funcionar." },
      { question: "Atendem fora da região de Jacareí?", answer: "Sim. São Paulo inteiro e projetos em todo o Brasil." },
    ]}
    relatedLinks={[
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Microsoft 365", href: "/microsoft-365-para-empresas-jacarei" },
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
    ]}
    localContent="Solicite uma análise da infraestrutura de TI do seu escritório. Atendemos em Jacareí, Vale do Paraíba e em todo o estado de São Paulo."
  />
);

export default TiContabilidadesPage;

import { Server, HardDrive, Shield, Activity, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/escritorios-advocacia.webp";

const TiEscritoriosAdvocaciaPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Escritórios de Advocacia"
    metaTitle="Infraestrutura de TI para Escritórios de Advocacia | Segurança e Sigilo | WMTi"
    metaDescription="Soluções de infraestrutura de TI para escritórios de advocacia. Servidores seguros, VPN, backup criptografado, firewall corporativo e suporte técnico especializado."
    tag="TI para Escritórios de Advocacia"
    headline={<>Os dados confidenciais dos seus clientes <span className="text-primary">estão em risco</span> — e você pode nem saber</>}
    description="Processos salvos no computador de alguém. Acesso remoto sem criptografia. Sem controle de quem vê o quê. Backup que ninguém testa. E dados sigilosos de clientes passando por uma rede sem proteção. Escritório de advocacia lida com informação sensível todos os dias. E se essa informação vazar, não é só problema técnico — é problema ético, jurídico e reputacional. A WMTi protege os dados do seu escritório com infraestrutura que leva sigilo a sério."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura de TI do meu escritório de advocacia."
    heroImage={heroImg}
    heroImageAlt="Escritório de advocacia moderno com infraestrutura de TI corporativa"
    painPoints={[
      "Dados confidenciais de clientes sem proteção adequada",
      "Acesso remoto a processos sem VPN segura",
      "Documentos jurídicos sem backup criptografado",
      "Sistemas jurídicos lentos ou incompatíveis",
      "Sem firewall protegendo a rede do escritório",
      "Equipe sem controle de acesso por perfil",
    ]}
    solutions={[
      "Servidores com criptografia e controle de acesso por perfil — quem deve ver, vê",
      "VPN segura para acessar processos de qualquer lugar sem risco",
      "Backup criptografado com replicação local e em nuvem",
      "Firewall corporativo com políticas de segurança avançadas",
      "Monitoramento contínuo para identificar tentativas de acesso indevido",
      "Manutenção preventiva para o sistema nunca travar na hora errada",
    ]}
    benefits={[
      { icon: Lock, title: "Sigilo de verdade", text: "Criptografia e controle de acesso granular. Dados dos seus clientes protegidos como devem ser." },
      { icon: Shield, title: "VPN segura", text: "Acesso remoto criptografado a processos e documentos. De qualquer lugar, com segurança total." },
      { icon: HardDrive, title: "Backup criptografado", text: "AES-256 com replicação em nuvem. Nunca mais depender da sorte para proteger dados." },
      { icon: Server, title: "Servidor profissional", text: "Windows Server configurado para sistemas jurídicos com alta disponibilidade." },
      { icon: Activity, title: "Monitoramento", text: "Servidores e rede monitorados para detectar problemas antes que virem incidentes." },
      { icon: Headphones, title: "Suporte dedicado", text: "Equipe que entende a rotina de escritório jurídico e a urgência de cada demanda." },
    ]}
    faq={[
      { question: "A WMTi atende escritórios de advocacia?", answer: "Sim. Entendemos a criticidade do sigilo profissional e implementamos infraestrutura à altura da responsabilidade que seu escritório carrega." },
      { question: "Como funciona a VPN para acesso remoto?", answer: "VPN corporativa criptografada que permite acessar processos e documentos do escritório de qualquer lugar — com segurança, não com preocupação." },
      { question: "Vocês fazem backup de dados jurídicos?", answer: "Sim. Backup criptografado, automatizado, com replicação em nuvem e testes periódicos. Proteção real, não cópia manual." },
      { question: "Atendem fora da região de Jacareí?", answer: "Sim. São Paulo inteiro e projetos em todo o Brasil." },
    ]}
    relatedLinks={[
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Microsoft 365", href: "/microsoft-365-para-empresas-jacarei" },
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
    ]}
    localContent="Solicite uma análise da infraestrutura de TI do seu escritório. Atendemos em Jacareí, Vale do Paraíba e em todo o estado de São Paulo."
  />
);

export default TiEscritoriosAdvocaciaPage;

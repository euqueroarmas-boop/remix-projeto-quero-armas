import { Server, HardDrive, Shield, Activity, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/escritorios-contabilidade.jpg";

const TiContabilidadesPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Escritórios de Contabilidade"
    metaTitle="Infraestrutura de TI para Escritórios de Contabilidade | Segurança Fiscal | WMTi"
    metaDescription="Soluções de TI para escritórios de contabilidade. Servidores seguros, backup fiscal automatizado, integração com sistemas contábeis e suporte técnico especializado."
    tag="TI para Escritórios de Contabilidade"
    headline={<>Infraestrutura de TI para <span className="text-primary">Escritórios de Contabilidade</span></>}
    description="Escritórios de contabilidade dependem de sistemas estáveis e seguros para processar dados fiscais, tributários e financeiros de seus clientes. A WMTi oferece infraestrutura de TI otimizada para escritórios contábeis, com backup automatizado, segurança de dados fiscais e suporte técnico."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura de TI do meu escritório de contabilidade."
    heroImage={heroImg}
    heroImageAlt="Escritório de contabilidade moderno com múltiplos monitores e sistemas financeiros"
    painPoints={[
      "Perda de dados fiscais por falta de backup adequado",
      "Lentidão em sistemas contábeis durante período de fechamento",
      "Falta de segurança para dados financeiros de clientes",
      "Sistemas desatualizados sem manutenção preventiva",
      "Sem monitoramento contínuo de servidores e rede",
      "Ausência de firewall corporativo e políticas de segurança",
    ]}
    solutions={[
      "Backup fiscal automatizado com replicação local e em nuvem",
      "Servidores corporativos dimensionados para sistemas contábeis de alta performance",
      "Criptografia e controle de acesso para dados financeiros de clientes",
      "Firewalls corporativos com políticas de segurança avançadas",
      "Monitoramento contínuo da infraestrutura para evitar falhas em períodos críticos",
      "Suporte técnico especializado com manutenção preventiva programada",
    ]}
    benefits={[
      { icon: HardDrive, title: "Backup fiscal", text: "Backup automatizado de dados fiscais com replicação segura e recuperação rápida." },
      { icon: Server, title: "Servidores otimizados", text: "Servidores Windows Server dimensionados para sistemas contábeis com alta performance." },
      { icon: Lock, title: "Segurança de dados", text: "Criptografia e controle de acesso para proteger dados financeiros de clientes." },
      { icon: Shield, title: "Firewall corporativo", text: "Proteção de rede com firewalls empresariais e políticas de segurança." },
      { icon: Activity, title: "Monitoramento contínuo", text: "Monitoramento de servidores e rede para garantir estabilidade em períodos de fechamento." },
      { icon: Headphones, title: "Suporte especializado", text: "Manutenção preventiva e suporte técnico dedicado para escritórios contábeis." },
    ]}
    faq={[
      { question: "A WMTi atende escritórios de contabilidade?", answer: "Sim. Oferecemos infraestrutura de TI otimizada para escritórios contábeis, com backup automatizado, segurança de dados fiscais e suporte técnico." },
      { question: "Como funciona o backup fiscal?", answer: "Implementamos backup automatizado com replicação local e em nuvem, garantindo proteção dos dados fiscais e recuperação rápida em caso de falhas." },
      { question: "Vocês garantem performance durante o fechamento?", answer: "Sim. Dimensionamos servidores e redes para suportar picos de carga durante períodos de fechamento contábil e fiscal." },
      { question: "Atendem fora da região de Jacareí?", answer: "Sim. Atendemos escritórios em todo o estado de São Paulo e realizamos projetos em todo o Brasil." },
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

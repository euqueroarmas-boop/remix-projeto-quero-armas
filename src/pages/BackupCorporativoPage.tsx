import { HardDrive, Shield, Cloud, Server, Activity, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const BackupCorporativoPage = () => (
  <ServicePageTemplate
    title="Backup Corporativo"
    metaTitle="Backup Corporativo | Proteção De Dados Empresariais | WMTi"
    metaDescription="Soluções de backup corporativo com Veeam, replicação local e em nuvem, estratégia 3-2-1 e recuperação rápida de dados para empresas."
    tag="Backup Corporativo"
    headline={<>Backup Corporativo para <span className="text-primary">proteção total dos seus dados</span></>}
    description="A perda de dados pode comprometer a operação da sua empresa. A WMTi implementa soluções de backup corporativo com Veeam, replicação local e em nuvem, e testes de restauração periódicos."
    whatsappMessage="Olá! Preciso de soluções de backup corporativo para minha empresa."
    painPoints={[
      "Dados críticos sem backup automatizado",
      "Backup em mídia externa sem verificação",
      "Sem estratégia de recuperação de desastres",
      "Dados na nuvem sem proteção adequada",
    ]}
    solutions={[
      "Backup automatizado com Veeam Backup & Replication",
      "Estratégia 3-2-1: três cópias, dois tipos de mídia, uma cópia externa",
      "Replicação em nuvem Azure para recuperação de desastres",
      "Testes de restauração mensais para garantir integridade dos dados",
    ]}
    benefits={[
      { icon: HardDrive, title: "Veeam Backup", text: "Backup automatizado com Veeam para servidores, VMs e estações de trabalho." },
      { icon: Cloud, title: "Replicação em nuvem", text: "Cópia segura dos dados na nuvem Azure para recuperação de desastres." },
      { icon: Shield, title: "Criptografia", text: "Dados criptografados AES-256 em trânsito e em repouso." },
      { icon: Server, title: "Estratégia 3-2-1", text: "Três cópias dos dados em dois tipos de mídia com uma cópia externa." },
      { icon: Activity, title: "Testes mensais", text: "Testes de restauração mensais para garantir que os dados são recuperáveis." },
      { icon: Headphones, title: "Suporte especializado", text: "Equipe técnica para gerenciamento e suporte do ambiente de backup." },
    ]}
    faq={[
      { question: "O que é a estratégia de backup 3-2-1?", answer: "É manter três cópias dos dados, em dois tipos de mídia diferentes, com uma cópia armazenada externamente (nuvem)." },
      { question: "Vocês usam qual software de backup?", answer: "Utilizamos Veeam Backup & Replication, líder de mercado em backup corporativo." },
      { question: "Os backups são testados?", answer: "Sim. Realizamos testes de restauração mensais para garantir que os dados são recuperáveis." },
    ]}
    relatedLinks={[
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Segurança de rede", href: "/seguranca-de-rede" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
    ]}
    localContent="Implementamos backup corporativo em empresas de Jacareí, Vale do Paraíba e em todo o Brasil."
    showHoursCalculator
  />
);

export default BackupCorporativoPage;

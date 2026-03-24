import { HardDrive, Shield, Cloud, Server, Activity, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const BackupCorporativoPage = () => (
  <ServicePageTemplate
    title="Backup Corporativo em Jacareí"
    metaTitle="Backup Corporativo em Jacareí — Se você perder tudo hoje, sua empresa continua? | WMTi"
    metaDescription="Backup corporativo em Jacareí. Backup automático, versionamento seguro, armazenamento confiável e recuperação rápida. Se você perder tudo hoje, sua empresa continua funcionando?"
    tag="Backup Corporativo"
    headline={<>Se você perder tudo hoje, sua empresa <span className="text-primary">continua funcionando?</span></>}
    description="Vamos direto ao ponto. Se hoje você perder todos os seus dados… sua empresa continua amanhã? Se a resposta for não, você está operando em risco. E esse risco não é raro. Erro humano acontece. Sistema falha. Equipamento queima. Vírus entra. Ataque acontece. E quando acontece… não dá tempo de correr atrás. A maioria das empresas acredita que 'nunca vai acontecer'. Até acontecer. E aí já é tarde. Backup não é copiar arquivo de vez em quando. Isso é falsa sensação de segurança. Backup de verdade é estrutura."
    whatsappMessage="Olá! Preciso de soluções de backup corporativo para minha empresa."
    painPoints={[
      "Dados críticos sem backup automatizado — operando em risco",
      "Backup manual em mídia externa sem verificação real",
      "Falsa sensação de segurança copiando arquivo de vez em quando",
      "Sem estratégia de recuperação quando o problema acontecer",
      "A maioria acredita que 'nunca vai acontecer' — até acontecer",
    ]}
    solutions={[
      "Backup automático — sem depender de alguém lembrar de fazer",
      "Versionamento seguro dos dados com histórico de alterações",
      "Armazenamento confiável com redundância real",
      "Recuperação rápida quando o problema acontecer",
      "Saída da dependência da sorte para ter garantia real dos dados",
    ]}
    benefits={[
      { icon: HardDrive, title: "Backup automático", text: "A WMTi implementa backup automático. Você deixa de depender da sorte e passa a ter garantia. Porque quando o problema acontece, não existe plano B sem backup." },
      { icon: Cloud, title: "Armazenamento confiável", text: "Cópia segura dos dados com redundância real. Não é copiar arquivo de vez em quando — é estrutura." },
      { icon: Shield, title: "Versionamento seguro", text: "Histórico completo de alterações. Se algo corromper ou for excluído, você volta ao ponto certo." },
      { icon: Server, title: "Recuperação rápida", text: "Quando o problema acontece, recuperação em minutos, não em dias. Sua empresa não para." },
      { icon: Activity, title: "Verificação contínua", text: "Testes periódicos de restauração para garantir que os dados são realmente recuperáveis." },
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

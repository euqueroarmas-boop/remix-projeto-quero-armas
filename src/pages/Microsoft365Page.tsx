import { Cloud, Shield, Users, Mail, HardDrive, Activity } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const Microsoft365Page = () => (
  <ServicePageTemplate
    title="Microsoft 365 para Empresas em Jacareí"
    metaTitle="Microsoft 365 para Empresas em Jacareí e São José dos Campos | WMTi"
    metaDescription="Migração e gestão de Microsoft 365 para empresas em Jacareí e Vale do Paraíba. Exchange Online, Teams, SharePoint, Azure AD e licenciamento oficial."
    tag="Microsoft 365 & Azure"
    headline={<>Microsoft 365 para empresas em <span className="text-primary">Jacareí e região.</span></>}
    description="Migração completa para Microsoft 365 com configuração de Exchange Online, Teams, SharePoint, Azure AD e ambientes híbridos. Licenciamento oficial e suporte especializado."
    whatsappMessage="Olá! Gostaria de saber mais sobre Microsoft 365 para minha empresa."
    painPoints={[
      "Email corporativo instável ou hospedado em servidores pessoais",
      "Falta de colaboração em tempo real entre equipes",
      "Dados sem backup na nuvem e risco de perda",
      "Licenças piratas expondo a empresa a riscos legais",
      "Dificuldade de gerenciar acessos e permissões dos colaboradores",
    ]}
    solutions={[
      "Migração completa para Exchange Online com domínio próprio da empresa",
      "Microsoft Teams para comunicação, videoconferência e colaboração",
      "SharePoint e OneDrive para armazenamento seguro na nuvem",
      "Azure AD com autenticação multifator (MFA) para segurança",
      "Licenciamento oficial Microsoft 365 Business com suporte WMTi",
    ]}
    benefits={[
      { icon: Cloud, title: "Nuvem Microsoft", text: "Dados seguros na nuvem Azure com 99,9% de uptime garantido pela Microsoft." },
      { icon: Mail, title: "Email profissional", text: "Exchange Online com domínio próprio, antispam e calendário compartilhado." },
      { icon: Users, title: "Colaboração", text: "Teams, SharePoint e OneDrive integrados para produtividade máxima." },
      { icon: Shield, title: "Segurança", text: "Azure AD com MFA, acesso condicional e proteção contra ameaças." },
      { icon: HardDrive, title: "Backup incluso", text: "Armazenamento de 1TB por usuário com versionamento e recuperação." },
      { icon: Activity, title: "Gestão central", text: "Painel administrativo para gerenciar todos os usuários e licenças." },
    ]}
    faq={[
      { question: "Quanto custa o Microsoft 365 por usuário?", answer: "O Microsoft 365 Business Basic começa em torno de R$ 30/usuário/mês. O Business Standard, com apps desktop, fica em torno de R$ 60/usuário/mês. Oferecemos preços especiais para volumes maiores e incluímos migração e suporte." },
      { question: "Como é feita a migração do email?", answer: "Realizamos a migração sem downtime. Transferimos todos os emails, contatos e calendários do servidor antigo para o Exchange Online. O processo é transparente para os usuários e geralmente leva 24-48 horas." },
      { question: "Preciso de servidor local com Microsoft 365?", answer: "Na maioria dos casos, não. Com Microsoft 365, tudo roda na nuvem. Porém, para ambientes híbridos (Active Directory local + Azure AD), configuramos o Azure AD Connect para sincronização." },
      { question: "Vocês dão suporte após a implantação?", answer: "Sim. Oferecemos planos de suporte contínuo que incluem gestão de licenças, criação/remoção de usuários, configuração de políticas e suporte técnico para qualquer problema com o Microsoft 365." },
    ]}
    relatedLinks={[
      { label: "Servidores Dell", href: "/servidores-dell-poweredge-jacarei" },
      { label: "Suporte de TI", href: "/suporte-ti-empresarial-jacarei" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa" },
    ]}
    localContent="Implantamos Microsoft 365 em empresas de Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba. A migração é realizada presencialmente por nossa equipe certificada Microsoft, com treinamento incluso para seus colaboradores aproveitarem ao máximo as ferramentas de produtividade."
    showHoursCalculator
  />
);

export default Microsoft365Page;

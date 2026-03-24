import { Cloud, Shield, Users, Mail, HardDrive, Activity } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const Microsoft365Page = () => (
  <ServicePageTemplate
    title="Microsoft 365 para Empresas em Jacareí"
    metaTitle="Microsoft 365 para Empresas em Jacareí e São José dos Campos | WMTi"
    metaDescription="Migração e gestão de Microsoft 365 para empresas em Jacareí e Vale do Paraíba. Exchange Online, Teams, SharePoint, Azure AD e licenciamento oficial."
    tag="Microsoft 365 & Azure"
    headline={<>Sua empresa ainda depende de email gratuito ou servidor próprio — e <span className="text-primary">isso está custando caro</span></>}
    description="Email que cai. Caixa cheia. Spam entrando. Colaboração por WhatsApp. Arquivo salvo no PC de alguém. Servidor de email que ninguém sabe manter. Parece funcionar — mas não é profissional, não é seguro, e não escala. E o custo invisível disso é enorme: perda de informação, retrabalho, falhas de comunicação e risco de dados. O Microsoft 365 resolve tudo isso de uma vez. E a WMTi faz a migração completa, sem dor de cabeça."
    whatsappMessage="Olá! Gostaria de saber mais sobre Microsoft 365 para minha empresa."
    painPoints={[
      "Email corporativo instável ou hospedado em servidor caseiro",
      "Equipes sem ferramentas de colaboração em tempo real",
      "Dados importantes salvos no PC de alguém, sem backup",
      "Licenças irregulares expondo a empresa a riscos legais",
      "Sem controle de acessos e permissões dos colaboradores",
    ]}
    solutions={[
      "Migração completa para Exchange Online com domínio próprio da empresa",
      "Microsoft Teams para comunicação, videoconferência e colaboração real",
      "SharePoint e OneDrive para armazenamento seguro e centralizado na nuvem",
      "Azure AD com autenticação multifator para segurança de verdade",
      "Licenciamento oficial Microsoft 365 com gestão contínua pela WMTi",
    ]}
    benefits={[
      { icon: Cloud, title: "Nuvem Microsoft", text: "Dados seguros na nuvem Azure com 99,9% de uptime. Sem depender de servidor local." },
      { icon: Mail, title: "Email profissional", text: "Exchange Online com domínio próprio, antispam e calendário. Email que funciona de verdade." },
      { icon: Users, title: "Colaboração real", text: "Teams, SharePoint e OneDrive integrados. Chega de mandar arquivo por WhatsApp." },
      { icon: Shield, title: "Segurança", text: "Azure AD com MFA e acesso condicional. Controle de quem acessa o quê." },
      { icon: HardDrive, title: "1TB por usuário", text: "Armazenamento de 1TB com versionamento e recuperação. Nunca mais perder arquivo." },
      { icon: Activity, title: "Gestão centralizada", text: "Painel para gerenciar todos os usuários e licenças em um lugar só." },
    ]}
    faq={[
      { question: "Quanto custa o Microsoft 365 por usuário?", answer: "Business Basic a partir de R$ 30/mês por usuário. Business Standard com apps desktop, R$ 60/mês. A WMTi oferece preços especiais para volumes maiores e inclui migração e suporte." },
      { question: "Como é feita a migração do email?", answer: "Sem downtime. Transferimos tudo — emails, contatos, calendários — do servidor antigo para o Exchange Online. Transparente para os usuários, geralmente em 24-48 horas." },
      { question: "Preciso de servidor local com Microsoft 365?", answer: "Na maioria dos casos, não. Para ambientes híbridos com Active Directory local, configuramos o Azure AD Connect para sincronização." },
      { question: "Vocês dão suporte após a implantação?", answer: "Sim. Gestão contínua de licenças, criação de usuários, políticas de segurança e suporte técnico para qualquer problema com o 365." },
    ]}
    relatedLinks={[
      { label: "Servidores Dell", href: "/servidores-dell-poweredge-jacarei" },
      { label: "Suporte de TI", href: "/suporte-ti-empresarial-jacarei" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa" },
    ]}
    localContent="Implantamos Microsoft 365 em empresas de Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba. Migração presencial por equipe certificada Microsoft, com treinamento incluso para sua equipe."
    showHoursCalculator
  />
);

export default Microsoft365Page;

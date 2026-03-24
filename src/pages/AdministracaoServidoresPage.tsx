import { Server, Shield, Activity, HardDrive, Headphones, Wrench } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const AdministracaoServidoresPage = () => (
  <ServicePageTemplate
    title="Administração De Servidores"
    metaTitle="Administração De Servidores Corporativos | Windows Server e Linux | WMTi"
    metaDescription="Serviços profissionais de administração de servidores corporativos. Gerenciamento de Windows Server, Linux, Active Directory, GPOs e virtualização Hyper-V."
    tag="Administração De Servidores"
    headline={<>Seu servidor está rodando sem <span className="text-primary">ninguém cuidando dele</span> de verdade</>}
    description="Ele liga. Ele funciona. Até o dia que não funciona mais. E quando para, para tudo — arquivos, sistemas, acesso, operação inteira travada. Servidor corporativo não é algo que você liga e esquece. Ele precisa de atualização, monitoramento, manutenção e alguém que saiba o que está fazendo. A maioria das empresas só descobre isso quando já perdeu dados ou ficou horas parada. A WMTi administra seus servidores para que isso nunca aconteça."
    whatsappMessage="Olá! Preciso de serviços de administração de servidores corporativos."
    painPoints={[
      "Servidor rodando sem monitoramento nem manutenção há meses",
      "Active Directory e GPOs desconfigurados causando falhas diárias",
      "Sem atualizações de segurança — vulnerabilidades acumulando",
      "Virtualização mal dimensionada consumindo recursos e travando",
      "Ninguém sabe o que acontece dentro do servidor até dar problema",
    ]}
    solutions={[
      "Gerenciamento contínuo de Windows Server e Linux com rotinas definidas",
      "Active Directory e GPOs configurados corretamente para sua operação",
      "Atualizações de segurança aplicadas antes que virem vulnerabilidades",
      "Virtualização Hyper-V dimensionada para usar os recursos certos",
      "Monitoramento real de CPU, memória, disco e rede — antes da falha",
    ]}
    benefits={[
      { icon: Server, title: "Gestão completa", text: "Alguém cuida do seu servidor de verdade — não só quando dá problema." },
      { icon: Shield, title: "Segurança real", text: "Patches aplicados, hardening feito, vulnerabilidades corrigidas antes de serem exploradas." },
      { icon: Activity, title: "Visibilidade total", text: "Você sabe o que está acontecendo no servidor antes que vire um problema." },
      { icon: HardDrive, title: "Virtualização eficiente", text: "Hyper-V dimensionado para não desperdiçar recurso nem travar." },
      { icon: Wrench, title: "Manutenção preventiva", text: "Rotinas programadas que evitam surpresas e paradas inesperadas." },
      { icon: Headphones, title: "Suporte direto", text: "Equipe que conhece seu ambiente e resolve rápido." },
    ]}
    faq={[
      { question: "Vocês administram servidores Windows Server?", answer: "Sim. Cuidamos de todo o ambiente — Active Directory, GPOs, DNS, DHCP, File Server e Hyper-V. De verdade, não só quando dá problema." },
      { question: "Administram servidores Linux também?", answer: "Sim. Ubuntu Server, CentOS, Debian — firewalls, serviços de rede, containers. Se roda Linux, a gente gerencia." },
      { question: "Como funciona o monitoramento?", answer: "Monitoramos CPU, memória, disco e rede em tempo real. Se algo sair do normal, a gente age antes de virar problema." },
    ]}
    relatedLinks={[
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
    ]}
    localContent="Administramos servidores corporativos em Jacareí, Vale do Paraíba e em todo o Brasil."
    showHoursCalculator
  />
);

export default AdministracaoServidoresPage;

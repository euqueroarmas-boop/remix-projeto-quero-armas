import { Server, Shield, Activity, HardDrive, Headphones, Wrench } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const AdministracaoServidoresPage = () => (
  <ServicePageTemplate
    title="Administração De Servidores"
    metaTitle="Administração De Servidores Corporativos | Windows Server e Linux | WMTi"
    metaDescription="Serviços profissionais de administração de servidores corporativos. Gerenciamento de Windows Server, Linux, Active Directory, GPOs e virtualização Hyper-V."
    tag="Administração De Servidores"
    headline={<>Administração De <span className="text-primary">Servidores Corporativos</span></>}
    description="A administração profissional de servidores é essencial para garantir desempenho, segurança e disponibilidade da infraestrutura corporativa. A WMTi realiza gerenciamento completo de servidores Windows Server e Linux."
    whatsappMessage="Olá! Preciso de serviços de administração de servidores corporativos."
    painPoints={[
      "Servidores sem gerenciamento profissional",
      "Active Directory e GPOs desconfigurados",
      "Falta de atualizações de segurança",
      "Virtualização mal dimensionada",
      "Sem monitoramento de performance",
    ]}
    solutions={[
      "Gerenciamento completo de Windows Server e Linux",
      "Configuração e manutenção de Active Directory e GPOs",
      "Aplicação de patches e atualizações de segurança",
      "Virtualização Hyper-V otimizada para performance",
      "Monitoramento contínuo de recursos e performance",
    ]}
    benefits={[
      { icon: Server, title: "Windows Server", text: "Gerenciamento completo de ambientes Windows Server com Active Directory e GPOs." },
      { icon: Shield, title: "Segurança", text: "Aplicação de patches, hardening e políticas de segurança nos servidores." },
      { icon: Activity, title: "Monitoramento", text: "Monitoramento contínuo de CPU, memória, disco e rede dos servidores." },
      { icon: HardDrive, title: "Virtualização", text: "Gerenciamento de ambientes Hyper-V com alocação otimizada de recursos." },
      { icon: Wrench, title: "Manutenção preventiva", text: "Rotinas programadas de manutenção para evitar falhas." },
      { icon: Headphones, title: "Suporte dedicado", text: "Equipe especializada em administração de servidores corporativos." },
    ]}
    faq={[
      { question: "Vocês administram servidores Windows Server?", answer: "Sim. Gerenciamos ambientes Windows Server com Active Directory, GPOs, DNS, DHCP e virtualização Hyper-V." },
      { question: "Administram servidores Linux também?", answer: "Sim. Oferecemos gerenciamento de servidores Linux para aplicações corporativas, firewalls e serviços de rede." },
      { question: "Como funciona o monitoramento?", answer: "Monitoramos CPU, memória, disco e rede dos servidores para identificar problemas antes que impactem a operação." },
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

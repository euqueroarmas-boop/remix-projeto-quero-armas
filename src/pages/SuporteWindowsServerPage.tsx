import { Server, Shield, HardDrive, Activity, Headphones, Wrench } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SuporteWindowsServerPage = () => (
  <ServicePageTemplate
    title="Suporte Windows Server"
    metaTitle="Suporte Windows Server | Administração e Manutenção | WMTi"
    metaDescription="Suporte técnico especializado em Windows Server. Active Directory, GPOs, Hyper-V, DNS, DHCP, File Server e manutenção preventiva."
    tag="Suporte Windows Server"
    headline={<>Suporte <span className="text-primary">Windows Server</span></>}
    description="A WMTi oferece suporte técnico especializado em ambientes Windows Server, incluindo Active Directory, Group Policies, Hyper-V, DNS, DHCP e File Server com manutenção preventiva."
    whatsappMessage="Olá! Preciso de suporte para Windows Server."
    painPoints={[
      "Active Directory desconfigurado ou instável",
      "GPOs não aplicando corretamente",
      "Serviços DNS e DHCP com falhas",
      "Virtualização Hyper-V com problemas de performance",
      "Sem atualizações de segurança aplicadas",
    ]}
    solutions={[
      "Gerenciamento completo de Active Directory e Group Policies",
      "Configuração e manutenção de DNS, DHCP e File Server",
      "Administração de Hyper-V com otimização de recursos",
      "Aplicação de patches e atualizações de segurança",
      "Manutenção preventiva programada para Windows Server",
    ]}
    benefits={[
      { icon: Server, title: "Active Directory", text: "Gerenciamento completo de AD, GPOs, usuários e permissões." },
      { icon: Shield, title: "Segurança", text: "Patches, hardening e políticas de segurança para Windows Server." },
      { icon: HardDrive, title: "Hyper-V", text: "Administração de virtualização com otimização de recursos." },
      { icon: Activity, title: "Monitoramento", text: "Monitoramento de serviços críticos do Windows Server." },
      { icon: Wrench, title: "Manutenção preventiva", text: "Rotinas programadas para manter estabilidade do servidor." },
      { icon: Headphones, title: "Suporte dedicado", text: "Equipe certificada Microsoft para Windows Server." },
    ]}
    faq={[
      { question: "Vocês gerenciam Active Directory?", answer: "Sim. Gerenciamos AD completo incluindo GPOs, usuários, grupos, permissões e políticas de segurança." },
      { question: "Suportam qual versão do Windows Server?", answer: "Suportamos Windows Server 2016, 2019 e 2022, incluindo migrações entre versões." },
      { question: "Fazem virtualização Hyper-V?", answer: "Sim. Administramos ambientes Hyper-V com criação, manutenção e otimização de máquinas virtuais." },
    ]}
    relatedLinks={[
      { label: "Suporte Linux", href: "/suporte-linux" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Administração de servidores", href: "/administracao-de-servidores" },
    ]}
    localContent="Suporte para Windows Server em Jacareí, Vale do Paraíba e em todo o Brasil."
    showHoursCalculator
  />
);

export default SuporteWindowsServerPage;

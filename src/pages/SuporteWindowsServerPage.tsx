import { Server, Shield, HardDrive, Activity, Headphones, Wrench } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SuporteWindowsServerPage = () => (
  <ServicePageTemplate
    title="Suporte Windows Server"
    metaTitle="Suporte Windows Server | Administração e Manutenção | WMTi"
    metaDescription="Suporte técnico especializado em Windows Server. Active Directory, GPOs, Hyper-V, DNS, DHCP, File Server e manutenção preventiva."
    tag="Suporte Windows Server"
    headline={<>Seu Windows Server está funcionando <span className="text-primary">na base da sorte</span></>}
    description="Active Directory com problemas. GPOs que não aplicam. DNS falhando. DHCP conflitando. E ninguém sabe exatamente o que está configurado, por quê, ou quando foi a última vez que alguém olhou de verdade. Seu servidor Windows funciona — mas na base da sorte. E uma hora a sorte acaba. Quando acaba, tudo para: login, arquivos, impressoras, sistemas, operação inteira. A WMTi cuida do seu Windows Server para que funcione por competência, não por sorte."
    whatsappMessage="Olá! Preciso de suporte para Windows Server."
    painPoints={[
      "Active Directory instável e ninguém sabe o que está configurado",
      "GPOs que não aplicam e ninguém consegue descobrir por quê",
      "DNS e DHCP com falhas que afetam toda a rede",
      "Hyper-V travando por falta de dimensionamento",
      "Meses sem atualizações de segurança no servidor",
    ]}
    solutions={[
      "Active Directory e GPOs configurados, documentados e funcionando",
      "DNS, DHCP e File Server estáveis e bem configurados",
      "Hyper-V dimensionado e otimizado para sua carga de trabalho",
      "Patches e atualizações de segurança aplicados regularmente",
      "Manutenção preventiva programada — não só quando dá problema",
    ]}
    benefits={[
      { icon: Server, title: "AD que funciona", text: "Active Directory, GPOs, usuários e permissões configurados por quem entende." },
      { icon: Shield, title: "Servidor seguro", text: "Patches aplicados, hardening feito, servidor protegido de verdade." },
      { icon: HardDrive, title: "Hyper-V estável", text: "Virtualização dimensionada para funcionar sem travar e sem desperdiçar recurso." },
      { icon: Activity, title: "Monitoramento real", text: "Serviços críticos do Windows Server monitorados — antes da falha, não depois." },
      { icon: Wrench, title: "Manutenção preventiva", text: "Rotinas programadas que evitam o 'parou tudo e ninguém sabe por quê'." },
      { icon: Headphones, title: "Equipe certificada", text: "Suporte Microsoft de verdade — não alguém que vai pesquisar na hora." },
    ]}
    faq={[
      { question: "Vocês gerenciam Active Directory?", answer: "Sim. AD completo — GPOs, usuários, grupos, permissões e políticas. Configurado e documentado para funcionar de verdade." },
      { question: "Suportam qual versão do Windows Server?", answer: "2016, 2019 e 2022. Inclusive migrações entre versões, com planejamento e sem downtime desnecessário." },
      { question: "Fazem virtualização Hyper-V?", answer: "Sim. Criação, manutenção e otimização de VMs. Dimensionado para sua carga real, não no chute." },
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

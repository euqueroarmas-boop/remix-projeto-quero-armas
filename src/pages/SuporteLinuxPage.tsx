import { Server, Shield, Activity, Wrench, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SuporteLinuxPage = () => (
  <ServicePageTemplate
    title="Suporte Linux"
    metaTitle="Suporte Linux Corporativo | Ubuntu, CentOS, Debian | WMTi"
    metaDescription="Suporte técnico especializado em servidores Linux. Ubuntu Server, CentOS, Debian, firewall iptables, containers Docker e administração de serviços."
    tag="Suporte Linux"
    headline={<>Seu servidor Linux está funcionando — mas <span className="text-primary">ninguém sabe o que acontece</span> dentro dele</>}
    description="Ele roda. Ele responde. Mas ninguém olha os logs. Ninguém aplica patches. Ninguém verifica se tem processo consumindo memória. Ninguém sabe se o firewall está configurado certo. E quando algo falha num servidor Linux sem administração, a recuperação é difícil — porque ninguém documentou nada. A WMTi administra seu ambiente Linux com quem entende de verdade. Sem improvisação."
    whatsappMessage="Olá! Preciso de suporte para servidores Linux."
    painPoints={[
      "Servidor Linux rodando sem ninguém administrando de verdade",
      "Serviços de rede instáveis e sem diagnóstico claro",
      "Firewall iptables/nftables configurado por tentativa e erro",
      "Meses sem atualizações de segurança aplicadas",
      "Containers Docker rodando sem gerenciamento adequado",
    ]}
    solutions={[
      "Administração profissional de Ubuntu Server, CentOS e Debian",
      "Serviços de rede estáveis com configuração documentada",
      "Firewall iptables/nftables com regras otimizadas e auditáveis",
      "Containers Docker gerenciados com boas práticas de produção",
      "Hardening real e patches de segurança aplicados regularmente",
    ]}
    benefits={[
      { icon: Server, title: "Linux de verdade", text: "Administração feita por quem vive Linux — não por quem googla o comando na hora." },
      { icon: Shield, title: "Firewall profissional", text: "iptables/nftables configurado com regras que fazem sentido para sua operação." },
      { icon: Lock, title: "Hardening real", text: "Servidor protegido de verdade — não só com as configurações padrão." },
      { icon: Activity, title: "Monitoramento", text: "Serviços e performance monitorados para agir antes da falha." },
      { icon: Wrench, title: "Docker gerenciado", text: "Containers rodando com orquestração, logs e manutenção adequada." },
      { icon: Headphones, title: "Suporte especializado", text: "Equipe que resolve problema em Linux sem precisar reiniciar tudo." },
    ]}
    faq={[
      { question: "Quais distribuições vocês suportam?", answer: "Ubuntu Server, CentOS, Debian, Rocky Linux e outras enterprise. Se roda Linux, a gente gerencia." },
      { question: "Vocês gerenciam containers Docker?", answer: "Sim. Docker e Docker Compose em produção, com monitoramento, logs e boas práticas de segurança." },
      { question: "Fazem migração de Windows para Linux?", answer: "Sim. Quando faz sentido para o ambiente, migramos com planejamento e sem impacto na operação." },
    ]}
    relatedLinks={[
      { label: "Suporte Windows Server", href: "/suporte-windows-server" },
      { label: "Administração de servidores", href: "/administracao-de-servidores" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
    ]}
    localContent="Suporte para servidores Linux em Jacareí, Vale do Paraíba e em todo o Brasil."
    showHoursCalculator
  />
);

export default SuporteLinuxPage;

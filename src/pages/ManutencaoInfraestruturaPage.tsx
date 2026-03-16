import { Wrench, Server, Shield, Activity, HardDrive, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const ManutencaoInfraestruturaPage = () => (
  <ServicePageTemplate
    title="Manutenção De Infraestrutura De TI"
    metaTitle="Manutenção De Infraestrutura De TI | Preventiva e Corretiva | WMTi"
    metaDescription="Manutenção preventiva e corretiva de infraestrutura de TI. Servidores, redes, firewalls, backup e equipamentos corporativos com suporte especializado."
    tag="Manutenção De Infraestrutura De TI"
    headline={<>Manutenção De <span className="text-primary">Infraestrutura De TI</span></>}
    description="A manutenção regular da infraestrutura de TI é essencial para evitar falhas e garantir a continuidade das operações. A WMTi realiza manutenção preventiva e corretiva de servidores, redes, firewalls e equipamentos corporativos."
    whatsappMessage="Olá! Preciso de manutenção de infraestrutura de TI para minha empresa."
    painPoints={[
      "Equipamentos sem manutenção preventiva",
      "Falhas recorrentes por falta de atualização",
      "Servidores com performance degradada",
      "Rede com problemas de conectividade frequentes",
    ]}
    solutions={[
      "Manutenção preventiva programada de servidores e equipamentos",
      "Atualização de firmware e software para corrigir vulnerabilidades",
      "Otimização de performance de servidores e rede",
      "Substituição planejada de equipamentos obsoletos",
    ]}
    benefits={[
      { icon: Wrench, title: "Preventiva e corretiva", text: "Manutenção programada para evitar falhas e correção rápida de problemas." },
      { icon: Server, title: "Servidores", text: "Manutenção de servidores Dell PowerEdge e ambientes Windows Server/Linux." },
      { icon: Shield, title: "Atualizações", text: "Aplicação de patches de segurança e atualização de firmware." },
      { icon: Activity, title: "Performance", text: "Otimização de performance de servidores e rede corporativa." },
      { icon: HardDrive, title: "Equipamentos", text: "Manutenção de switches, firewalls, access points e storage." },
      { icon: Headphones, title: "Suporte técnico", text: "Equipe certificada para manutenção de infraestrutura corporativa." },
    ]}
    faq={[
      { question: "O que inclui a manutenção preventiva?", answer: "Verificação de hardware, limpeza de logs, atualização de firmware, análise de performance e testes de backup." },
      { question: "Com que frequência é feita?", answer: "Recomendamos manutenção preventiva mensal para ambientes corporativos." },
      { question: "Vocês atendem emergências?", answer: "Sim. Além da manutenção preventiva, oferecemos suporte emergencial para falhas críticas." },
    ]}
    relatedLinks={[
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
      { label: "Monitoramento de servidores", href: "/monitoramento-de-servidores" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
    ]}
    localContent="Manutenção de infraestrutura de TI em Jacareí, Vale do Paraíba e em todo o Brasil."
    showHoursCalculator
  />
);

export default ManutencaoInfraestruturaPage;

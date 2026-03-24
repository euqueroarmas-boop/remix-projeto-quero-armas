import { Wrench, Server, Shield, Activity, HardDrive, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const ManutencaoInfraestruturaPage = () => (
  <ServicePageTemplate
    title="Manutenção De Infraestrutura De TI"
    metaTitle="Manutenção De Infraestrutura De TI | Preventiva e Corretiva | WMTi"
    metaDescription="Manutenção preventiva e corretiva de infraestrutura de TI. Servidores, redes, firewalls, backup e equipamentos corporativos com suporte especializado."
    tag="Manutenção De Infraestrutura De TI"
    headline={<>Sua infraestrutura de TI está envelhecendo sem cuidado — e <span className="text-primary">os problemas estão se acumulando</span></>}
    description="Equipamento sem atualização. Firmware desatualizado. Logs que ninguém olha. Performance que vai caindo aos poucos. E você vai se acostumando. Até que um dia o servidor trava. O switch queima. O backup falha. E aí o custo da manutenção que não foi feita aparece de uma vez — em downtime, prejuízo e correria. Manutenção preventiva não é gasto. É o que impede que o gasto real apareça. A WMTi mantém sua infraestrutura funcionando antes que ela resolva parar."
    whatsappMessage="Olá! Preciso de manutenção de infraestrutura de TI para minha empresa."
    painPoints={[
      "Equipamentos sem manutenção preventiva há meses",
      "Falhas recorrentes que ninguém resolve na causa",
      "Servidores com performance caindo aos poucos",
      "Rede com problemas frequentes que vão sendo 'aceitados'",
    ]}
    solutions={[
      "Manutenção preventiva programada — com rotina e checklist definidos",
      "Atualização de firmware e software antes que virem vulnerabilidades",
      "Otimização de performance de servidores e rede periodicamente",
      "Plano de substituição de equipamentos antes que quebrem",
    ]}
    benefits={[
      { icon: Wrench, title: "Preventiva de verdade", text: "Manutenção programada com rotina real — não só quando dá problema." },
      { icon: Server, title: "Servidores cuidados", text: "Dell PowerEdge, Windows Server, Linux — mantidos por quem entende." },
      { icon: Shield, title: "Sempre atualizado", text: "Patches de segurança e firmware aplicados antes de virarem risco." },
      { icon: Activity, title: "Performance mantida", text: "Servidores e rede funcionando como no primeiro dia — todo mês." },
      { icon: HardDrive, title: "Equipamentos longevos", text: "Switches, firewalls, access points e storage com vida útil estendida." },
      { icon: Headphones, title: "Equipe técnica", text: "Profissionais certificados que conhecem sua infraestrutura." },
    ]}
    faq={[
      { question: "O que inclui a manutenção preventiva?", answer: "Verificação de hardware, limpeza de logs, atualização de firmware, análise de performance e testes de backup. Tudo o que deveria ser feito todo mês e quase nunca é." },
      { question: "Com que frequência é feita?", answer: "Mensal para ambientes corporativos. Porque esperar dar problema para agir é a forma mais cara de manter TI." },
      { question: "Vocês atendem emergências?", answer: "Sim. Além da preventiva, temos suporte emergencial. Mas o objetivo é que você nunca precise dele." },
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

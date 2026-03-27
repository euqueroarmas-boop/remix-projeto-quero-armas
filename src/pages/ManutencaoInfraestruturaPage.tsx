import { Wrench, Server, Shield, Activity, HardDrive, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const ManutencaoInfraestruturaPage = () => (
  <ServicePageTemplate
    title="Manutenção de Infraestrutura de TI"
    metaTitle="Manutenção De Infraestrutura De TI — Sua infraestrutura está envelhecendo sem cuidado e os problemas estão se acumulando | WMTi"
    metaDescription="Manutenção preventiva e corretiva de infraestrutura de TI em Jacareí. Servidores, redes, firewalls e equipamentos corporativos. Os problemas estão se acumulando — e o custo de não cuidar é muito maior."
    tag="Manutenção de Infraestrutura"
    headline={<>Sua infraestrutura de TI está envelhecendo sem cuidado — e <span className="text-primary">os problemas estão se acumulando</span></>}
    description="Equipamento sem atualização. Firmware desatualizado. Logs que ninguém olha. Performance que vai caindo aos poucos. E você vai se acostumando. Até que um dia o servidor trava. O switch queima. O backup falha. E aí o custo da manutenção que não foi feita aparece de uma vez — em downtime, prejuízo e correria. Quanto custa uma hora inteira da empresa parada? Quanto custa perder dados porque ninguém verificou o backup? Quanto custa trocar equipamento às pressas porque ninguém fez manutenção? Manutenção preventiva não é gasto. É o que impede que o gasto real apareça. A WMTi mantém sua infraestrutura funcionando antes que ela resolva parar."
    whatsappMessage="Olá! Preciso de manutenção de infraestrutura de TI para minha empresa."
    painPoints={[
      "Equipamentos sem manutenção preventiva há meses — acumulando risco",
      "Falhas recorrentes que ninguém resolve na causa — só no sintoma",
      "Servidores com performance caindo aos poucos — e todo mundo aceitando como normal",
      "Rede com problemas frequentes que vão sendo 'absorvidos' pela equipe",
      "Custo invisível de não cuidar: paradas, emergências e trocas forçadas",
    ]}
    solutions={[
      "Manutenção preventiva programada — com rotina, checklist e resultado documentado",
      "Atualização de firmware e software antes que virem vulnerabilidades ou falhas",
      "Otimização de performance de servidores e rede periodicamente — não só quando trava",
      "Plano de substituição de equipamentos antes que quebrem — previsibilidade, não surpresa",
      "Saída do modo reativo para o modo preventivo — cuidar custa menos do que consertar",
    ]}
    benefits={[
      { icon: Wrench, title: "Preventiva de verdade", text: "Manutenção programada com rotina real — não só quando dá problema. Porque esperar quebrar é a forma mais cara de manter TI." },
      { icon: Server, title: "Servidores cuidados", text: "Dell PowerEdge, Windows Server, Linux — mantidos por quem entende. Seu servidor merece mais do que ser ligado e esquecido." },
      { icon: Shield, title: "Sempre atualizado", text: "Patches de segurança e firmware aplicados antes de virarem risco. Vulnerabilidade acumulada é bomba-relógio." },
      { icon: Activity, title: "Performance mantida", text: "Servidores e rede funcionando como no primeiro dia — todo mês. Não aceite lentidão como normal." },
      { icon: HardDrive, title: "Equipamentos longevos", text: "Switches, firewalls, access points e storage com vida útil estendida. Cuidar é mais barato do que trocar." },
      { icon: Headphones, title: "Equipe técnica", text: "Profissionais certificados que conhecem sua infraestrutura. Não precisam redescobrir tudo a cada visita." },
    ]}
    faq={[
      { question: "O que inclui a manutenção preventiva?", answer: "Verificação de hardware, limpeza de logs, atualização de firmware, análise de performance e testes de backup. Tudo o que deveria ser feito todo mês e quase nunca é — até dar problema." },
      { question: "Com que frequência é feita?", answer: "Mensal para ambientes corporativos. Porque esperar dar problema para agir é a forma mais cara de manter TI. E o prejuízo de uma parada paga muitas manutenções." },
      { question: "Vocês atendem emergências?", answer: "Sim. Além da preventiva, temos suporte emergencial. Mas o objetivo é que você nunca precise dele — prevenção é sempre mais barata que correria." },
      { question: "Quanto custa não fazer manutenção?", answer: "Muito mais do que fazer. Uma parada de servidor pode custar milhares em horas paradas, dados perdidos e substituições de emergência. Manutenção preventiva evita tudo isso." },
    ]}
    relatedLinks={[
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
      { label: "Monitoramento de servidores", href: "/monitoramento-de-servidores" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
    ]}
    localContent="Manutenção de infraestrutura de TI em Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba. Equipe própria certificada com atendimento presencial na região."
    showHoursCalculator
  />
);

export default ManutencaoInfraestruturaPage;

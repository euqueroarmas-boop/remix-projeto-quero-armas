import { Headphones, Clock, Shield, Activity, Wrench, Users } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SuporteTiPage = () => (
  <ServicePageTemplate
    title="Suporte de TI Empresarial em Jacareí"
    metaTitle="Suporte de TI Empresarial em Jacareí e São José dos Campos | WMTi"
    metaDescription="Suporte técnico de TI para empresas em Jacareí e São José dos Campos. Atendimento remoto e presencial, monitoramento 24/7, SLA definido e equipe certificada Dell e Microsoft."
    tag="Suporte de TI"
    headline={<>Suporte de TI empresarial em <span className="text-primary">Jacareí e região.</span></>}
    description="Suporte técnico com SLA definido, atendimento remoto e presencial, monitoramento 24/7 e equipe certificada Dell e Microsoft. Resolução rápida para manter sua operação funcionando."
    whatsappMessage="Olá! Gostaria de saber mais sobre os planos de suporte de TI da WMTi."
    painPoints={[
      "Chamados de TI demoram dias para serem atendidos",
      "Técnicos generalistas que não resolvem problemas complexos",
      "Sem SLA definido — não há garantia de tempo de resposta",
      "Custos imprevisíveis com chamados avulsos de TI",
      "Nenhum monitoramento — problemas só são detectados quando param tudo",
    ]}
    solutions={[
      "SLA definido por criticidade: resposta em até 1h para incidentes críticos",
      "Equipe certificada Dell e Microsoft com atendimento presencial e remoto",
      "Monitoramento proativo 24/7 via Zabbix — identificamos problemas antes de impactar",
      "Custo fixo mensal previsível — sem surpresas com chamados avulsos",
      "Relatórios mensais de desempenho, uptime e incidentes resolvidos",
    ]}
    benefits={[
      { icon: Headphones, title: "Suporte dedicado", text: "Canal exclusivo com equipe técnica fixa que conhece seu ambiente." },
      { icon: Clock, title: "SLA garantido", text: "Tempos de resposta definidos por contrato conforme criticidade." },
      { icon: Activity, title: "Monitoramento 24/7", text: "NOC próprio com Zabbix e Grafana monitorando toda sua infraestrutura." },
      { icon: Shield, title: "Segurança inclusa", text: "Atualizações de segurança, patches e antivírus gerenciado." },
      { icon: Wrench, title: "Manutenção preventiva", text: "Revisões periódicas de hardware e software para evitar falhas." },
      { icon: Users, title: "Escalável", text: "Planos que crescem com sua empresa, de 5 a 500+ estações." },
    ]}
    faq={[
      { question: "Como funciona o suporte remoto?", answer: "Utilizamos ferramentas de acesso remoto seguro. Ao abrir um chamado, nosso técnico acessa sua máquina remotamente (com sua autorização) e resolve o problema em tempo real. Para questões que exigem presença física, deslocamos um técnico." },
      { question: "Vocês atendem fora do horário comercial?", answer: "Sim. Nossos planos incluem suporte 24/7 para incidentes críticos. Manutenções programadas podem ser realizadas em horários alternativos para não impactar a operação." },
      { question: "Qual o custo mensal do suporte?", answer: "Depende do número de estações, servidores e complexidade do ambiente. Oferecemos planos a partir de R$ 50/estação/mês para suporte completo. Solicite uma proposta personalizada." },
      { question: "Posso contratar suporte avulso?", answer: "Sim, atendemos chamados avulsos. Porém, contratos mensais oferecem melhor custo-benefício com monitoramento proativo, manutenção preventiva e prioridade no atendimento." },
    ]}
    relatedLinks={[
      { label: "Locação de computadores", href: "/locacao-de-computadores-para-empresas" },
      { label: "Microsoft 365", href: "/microsoft-365-para-empresas-jacarei" },
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa" },
    ]}
    localContent="Oferecemos suporte presencial e remoto para empresas em Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba. Nossa equipe está a menos de 30 minutos de deslocamento para atendimentos emergenciais na região. Atendemos escritórios, clínicas, lojas, indústrias, cartórios e empresas de todos os segmentos."
    showHoursCalculator
  />
);

export default SuporteTiPage;

import { Activity, Server, Shield, AlertTriangle, Headphones, Eye } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const MonitoramentoServidoresPage = () => (
  <ServicePageTemplate
    title="Monitoramento de Servidores Corporativos"
    metaTitle="Monitoramento De Servidores 24/7 — Seu servidor pode parar a qualquer momento e você só vai saber quando já for tarde | WMTi"
    metaDescription="Monitoramento de servidores corporativos 24/7 em Jacareí. Alertas em tempo real, dashboards de performance, prevenção de falhas. Seu servidor pode parar a qualquer momento — e o prejuízo é imediato."
    tag="Monitoramento de Servidores"
    headline={<>Seu servidor pode parar a qualquer momento — e <span className="text-primary">você só vai saber quando já for tarde</span></>}
    description="Disco cheio. Memória esgotada. Processo travado consumindo tudo. Temperatura alta. E ninguém viu. Ninguém alertou. Ninguém agiu. Até que o servidor parou. E quando o servidor para, a empresa para. Sem acesso a arquivos, sem sistema, sem operação. E aí vem a correria para resolver às pressas o que poderia ter sido evitado. O custo de uma parada não planejada não é só técnico — é financeiro. Salários pagos sem produção. Clientes sem atendimento. Prazos perdidos. E tudo porque ninguém estava olhando. A WMTi monitora seus servidores 24/7 e age no primeiro sinal de problema — não no último."
    whatsappMessage="Olá! Preciso de monitoramento de servidores corporativos."
    painPoints={[
      "Falhas descobertas só quando o servidor já parou — prejuízo imediato",
      "Sem visibilidade sobre CPU, memória e disco em tempo real — operando no escuro",
      "Discos enchendo sem aviso até causar parada total da operação",
      "Nenhum alerta configurado para situações críticas — surpresa garantida",
      "Custo invisível de paradas que poderiam ter sido evitadas com monitoramento",
    ]}
    solutions={[
      "Monitoramento 24/7 de CPU, memória, disco e rede de cada servidor — antes da falha",
      "Alertas em tempo real quando indicadores atingem níveis críticos — ação imediata",
      "Dashboards de performance para visibilidade completa da infraestrutura",
      "Ações preventivas baseadas em tendências — antes da falha, não depois do prejuízo",
      "Saída do modo reativo para o modo preventivo — monitorar é mais barato do que parar",
    ]}
    benefits={[
      { icon: Activity, title: "Monitoramento 24/7", text: "Seus servidores monitorados o tempo todo — não só em horário comercial. Porque servidor não escolhe hora para falhar." },
      { icon: AlertTriangle, title: "Alertas imediatos", text: "Indicador crítico? Alerta na hora. Ação antes que vire parada. Prevenção, não correria." },
      { icon: Eye, title: "Visibilidade total", text: "Dashboards mostrando a saúde de cada servidor em tempo real. Decisão baseada em dados, não em achismo." },
      { icon: Server, title: "Prevenção de falhas", text: "Tendências identificadas antes que se transformem em problemas reais. Resolver antes é sempre mais barato." },
      { icon: Shield, title: "Segurança", text: "Detecção de atividades anômalas e tentativas de acesso indevido. Se algo estranho acontecer, a gente vê." },
      { icon: Headphones, title: "Ação proativa", text: "Equipe que age quando o alerta toca — não quando você liga desesperado porque já parou tudo." },
    ]}
    faq={[
      { question: "O que é monitorado nos servidores?", answer: "CPU, memória RAM, disco, rede, serviços críticos e logs. Tudo que pode indicar um problema antes dele acontecer. Se o servidor começa a suar, a gente vê antes de travar." },
      { question: "Os alertas são em tempo real?", answer: "Sim. Indicador crítico dispara alerta imediatamente. A equipe age na hora, não no dia seguinte. Porque quando servidor para, cada minuto é prejuízo." },
      { question: "Funciona para servidores em nuvem?", answer: "Sim. Físicos, virtuais, on-premises e nuvem. Se é servidor, a gente monitora. Se está rodando, precisa de alguém olhando." },
      { question: "Qual a diferença de ter ou não ter monitoramento?", answer: "Sem monitoramento, você descobre o problema quando todo mundo para. Com monitoramento, a gente resolve antes de alguém perceber. A diferença é prejuízo ou prevenção." },
    ]}
    relatedLinks={[
      { label: "Administração de servidores", href: "/administracao-de-servidores" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
    ]}
    localContent="Monitoramos servidores de empresas em Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba. NOC próprio 24/7 com equipe certificada."
    showHoursCalculator
  />
);

export default MonitoramentoServidoresPage;

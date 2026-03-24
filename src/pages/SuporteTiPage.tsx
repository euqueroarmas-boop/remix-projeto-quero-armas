import { Headphones, Clock, Shield, Activity, Wrench, Users } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SuporteTiPage = () => (
  <ServicePageTemplate
    title="Suporte de TI em Jacareí"
    metaTitle="Suporte de TI em Jacareí — Sua empresa está perdendo dinheiro com problemas técnicos | WMTi"
    metaDescription="Suporte de TI em Jacareí. Monitoramento contínuo, correção preventiva, atendimento rápido e padronização de ambiente. Pare de perder dinheiro com problemas técnicos todos os dias."
    tag="Suporte de TI"
    headline={<>Sua empresa está perdendo dinheiro com <span className="text-primary">problemas técnicos</span> todos os dias</>}
    description="Computador travando. Sistema lento. Impressora que não funciona. Funcionário esperando alguém resolver. Isso não é um detalhe técnico — é a sua empresa deixando de produzir. Enquanto um funcionário espera o computador voltar, o salário continua sendo pago. Enquanto o sistema trava, o atendimento atrasa. Enquanto ninguém resolve de verdade, o cliente perde a paciência. E isso acontece mais vezes do que deveria. O problema não é o computador, não é o sistema, não é o usuário. É a falta de estrutura. A maioria das empresas funciona assim: espera dar problema para depois tentar resolver. E nisso, vai acumulando pequenas perdas todos os dias. Só que essas pequenas perdas, somadas, viram um prejuízo grande."
    whatsappMessage="Olá! Gostaria de saber mais sobre os planos de suporte de TI da WMTi."
    painPoints={[
      "Computador travando e funcionário parado esperando alguém resolver",
      "Sistema lento atrasando o atendimento ao cliente",
      "Impressora que não funciona e ninguém sabe consertar",
      "Pequenas perdas diárias que somadas viram prejuízo grande",
      "Nenhum monitoramento — problemas só são tratados quando tudo já parou",
    ]}
    solutions={[
      "Monitoramento contínuo da sua estrutura — identificamos problemas antes de virar prejuízo",
      "Correção antes da falha virar parada na operação",
      "Atendimento rápido quando necessário, remoto ou presencial",
      "Padronização de todo o ambiente para uma operação previsível",
      "Saída de um cenário onde tudo depende da sorte para uma operação que funciona como deveria",
    ]}
    benefits={[
      { icon: Activity, title: "Monitoramento contínuo", text: "A gente organiza, monitora e evita que o problema aconteça. Você sai de um cenário onde tudo depende da sorte." },
      { icon: Wrench, title: "Correção preventiva", text: "Correção antes da falha virar prejuízo. Empresa não pode parar — e hoje, a sua para mais do que deveria." },
      { icon: Clock, title: "Atendimento rápido", text: "Quando necessário, suporte remoto ou presencial com tempo de resposta definido por contrato." },
      { icon: Shield, title: "Padronização do ambiente", text: "Todo o ambiente organizado e padronizado para que as coisas funcionem como deveriam." },
      { icon: Headphones, title: "Suporte dedicado", text: "Equipe técnica fixa que conhece seu ambiente. Não aparecemos só quando tudo já parou." },
      { icon: Users, title: "Escalável", text: "Planos que crescem com sua empresa. De 5 a 500+ estações, sem surpresas." },
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

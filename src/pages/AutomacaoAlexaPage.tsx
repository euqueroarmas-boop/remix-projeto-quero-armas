import {
  Wifi, Home, Building2, ShieldCheck, Zap, Clock, Eye, Thermometer,
  Lock, Lightbulb, MonitorSpeaker, CheckCircle2, Network, Headphones,
} from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const AutomacaoAlexaPage = () => (
  <ServicePageTemplate
    title="Automação com Alexa para Casa Inteligente e Empresa Inteligente"
    metaTitle="Automação com Alexa para Casa e Empresa Inteligente em Jacareí | WMTi"
    metaDescription="Projetos de automação com Alexa para residências e empresas em Jacareí. Iluminação, câmeras, fechaduras, climatização e rotinas inteligentes com infraestrutura profissional. Solicite análise técnica."
    tag="Automação com Alexa"
    headline={
      <>
        Automação com Alexa para Casa Inteligente e Empresa Inteligente —{" "}
        <span className="text-primary">
          Pare de gastar com equipamento smart que não funciona direito
        </span>
      </>
    }
    description="Você compra lâmpada inteligente, câmera, tomada smart, Alexa, automação de portão, ar-condicionado com Wi-Fi, fechadura eletrônica… e no fim vira uma bagunça. Um app para cada coisa. Comandos que falham. Internet ruim derrubando tudo. A WMTi entrega automação de verdade — integrada, estável e profissional."
    whatsappMessage="Quero automatizar minha casa ou empresa com Alexa"
    painPoints={[
      "Vários dispositivos smart que não se comunicam entre si",
      "Alexa que não reconhece os dispositivos ou demora para responder",
      "Wi-Fi fraco que derruba automações no meio da rotina",
      "Um aplicativo diferente para cada equipamento — caos total",
      "Rotinas que nunca funcionam na hora certa",
      "Família ou funcionários passando raiva com comandos que falham",
      "Equipamentos caros subutilizados porque ninguém soube configurar",
      "Investimento alto em tecnologia que vira enfeite de prateleira",
    ]}
    solutions={[
      "Análise técnica do local e auditoria completa de conectividade",
      "Planejamento de automação residencial ou empresarial sob medida",
      "Instalação e configuração profissional de todos os dispositivos",
      "Criação de rotinas inteligentes integradas (iluminação, clima, segurança)",
      "Integração entre Alexa, câmeras, fechaduras, sensores e portões",
      "Infraestrutura de rede Wi-Fi estável para suportar todos os devices",
      "Testes completos de funcionamento antes da entrega",
      "Suporte técnico contínuo pós-implantação",
    ]}
    benefits={[
      {
        icon: Home,
        title: "Casa Inteligente Real",
        text: "Iluminação, clima, TV, câmeras, fechaduras e portões controlados por voz ou rotinas automáticas — tudo integrado de verdade.",
      },
      {
        icon: Building2,
        title: "Empresa Inteligente",
        text: "Automatize abertura, fechamento, climatização, recepção e salas de reunião. Sua operação ganha velocidade e profissionalismo.",
      },
      {
        icon: Wifi,
        title: "Rede Estável de Verdade",
        text: "Sem Wi-Fi forte, nenhuma automação funciona. Entregamos a infraestrutura de rede que sustenta todo o ecossistema smart.",
      },
      {
        icon: ShieldCheck,
        title: "Segurança Integrada",
        text: "Câmeras, sensores de presença, fechaduras eletrônicas e alertas automáticos — tudo conectado e funcionando junto.",
      },
      {
        icon: Clock,
        title: "Economia de Tempo",
        text: "Rotinas automáticas eliminam tarefas repetitivas. Luzes, ar-condicionado e equipamentos se ajustam sozinhos.",
      },
      {
        icon: Zap,
        title: "Produtividade Real",
        text: "Ambientes que se preparam automaticamente para reuniões, atendimentos ou descanso — sem ninguém precisar fazer nada.",
      },
    ]}
    faq={[
      {
        question: "Como funciona a automação com Alexa?",
        answer:
          "Fazemos uma análise técnica do ambiente, verificamos a infraestrutura de rede, selecionamos os dispositivos compatíveis e configuramos tudo para funcionar integrado via comandos de voz, rotinas automáticas e aplicativo centralizado.",
      },
      {
        question: "Quais dispositivos podem ser integrados com Alexa?",
        answer:
          "Lâmpadas inteligentes, tomadas smart, câmeras de segurança, fechaduras eletrônicas, sensores de presença, ar-condicionado, TV, portões automáticos, cortinas motorizadas e muito mais — desde que compatíveis com o ecossistema Alexa.",
      },
      {
        question: "A automação com Alexa funciona em empresas?",
        answer:
          "Sim. Automatizamos iluminação, climatização, rotinas de abertura e fechamento, recepção, salas de reunião e ambientes estratégicos. Empresas ganham produtividade, economia e profissionalismo.",
      },
      {
        question: "Preciso melhorar meu Wi-Fi antes de automatizar?",
        answer:
          "Na maioria dos casos, sim. Dispositivos smart dependem de rede estável. Incluímos auditoria de conectividade no projeto e, se necessário, reestruturamos o Wi-Fi antes da automação.",
      },
      {
        question: "Vale a pena automatizar casa ou escritório?",
        answer:
          "Absolutamente. Automação bem feita reduz consumo de energia, aumenta segurança, elimina tarefas repetitivas e transforma a experiência do ambiente. O problema nunca foi a tecnologia — foi a falta de implementação profissional.",
      },
      {
        question: "E se meus dispositivos forem de marcas diferentes?",
        answer:
          "A WMTi trabalha com integração multi-marca. Configuramos dispositivos de diferentes fabricantes para funcionarem juntos no mesmo ecossistema Alexa, com rotinas unificadas.",
      },
    ]}
    relatedLinks={[
      { label: "Infraestrutura de Rede", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { label: "Segurança de Rede", href: "/seguranca-de-rede" },
      { label: "Suporte Técnico", href: "/suporte-ti-jacarei" },
      { label: "Automação de TI com IA", href: "/automacao-de-ti-com-inteligencia-artificial" },
      { label: "Monitoramento de Rede", href: "/monitoramento-de-rede" },
    ]}
    localContent="A WMTi atende Jacareí, São José dos Campos, Taubaté, Caçapava, Pindamonhangaba e toda a região do Vale do Paraíba com projetos de automação residencial e empresarial com Alexa. Realizamos análise técnica presencial, auditoria de rede e implantação completa no local."
    showHoursCalculator
  />
);

export default AutomacaoAlexaPage;

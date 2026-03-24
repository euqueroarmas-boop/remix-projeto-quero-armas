import { Bot, Zap, BarChart3, RefreshCw, MessageCircle, Workflow } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const AutomacaoIaPage = () => (
  <ServicePageTemplate
    title="Automação de TI com Inteligência Artificial"
    metaTitle="Automação de TI com Inteligência Artificial em Jacareí | WMTi"
    metaDescription="Automação de TI com IA para empresas em Jacareí. Elimine tarefas manuais, reduza retrabalho e ganhe velocidade operacional com fluxos inteligentes. Diagnóstico gratuito."
    tag="Automação de TI com IA"
    headline={
      <>
        Sua empresa está travada porque tudo ainda depende de alguém.{" "}
        <span className="text-primary">Isso custa caro todos os dias.</span>
      </>
    }
    description="Responder cliente, montar orçamento, organizar informação, acompanhar processo, cobrar retorno, atualizar planilha, gerar proposta, conferir solicitação. Se tudo isso ainda depende de alguém da sua equipe, sua empresa está mais lenta do que deveria — e isso custa dinheiro todos os dias. A WMTi implementa automação de TI com inteligência artificial para transformar processos manuais em fluxos automáticos, inteligentes e integrados à operação real da sua empresa."
    whatsappMessage="Quero automatizar minha empresa com inteligência artificial"
    painPoints={[
      "Equipe inteira presa em tarefas repetitivas que não geram receita",
      "Cliente esperando resposta porque alguém ainda não viu a solicitação",
      "Orçamentos e propostas montados manualmente, um por um, com risco de erro",
      "Processos que param completamente quando um funcionário falta ou sai",
      "Informações espalhadas em planilhas, e-mails e WhatsApp sem integração",
      "Retrabalho diário porque ninguém sabe o que já foi feito ou respondido",
    ]}
    solutions={[
      "Automação de atendimento inicial e qualificação de leads com IA",
      "Geração automática de orçamentos, propostas e respostas inteligentes",
      "Integração entre site, WhatsApp, formulários e sistemas internos",
      "Fluxos automáticos de acompanhamento, cobrança e notificação",
      "Eliminação de etapas manuais repetitivas que travam a operação",
      "Dashboards e controle em tempo real de toda a operação automatizada",
    ]}
    benefits={[
      { icon: Bot, title: "Atendimento automático", text: "Responda clientes em segundos, 24h por dia, sem depender de alguém disponível na equipe." },
      { icon: Zap, title: "Velocidade operacional", text: "Processos que levavam horas passam a rodar em minutos — sem intervenção humana." },
      { icon: RefreshCw, title: "Fim do retrabalho", text: "Fluxos inteligentes eliminam tarefas duplicadas, esquecimentos e erros manuais." },
      { icon: BarChart3, title: "Escala sem contratar", text: "Ganhe capacidade operacional sem aumentar equipe. Mais resultado com menos esforço." },
      { icon: Workflow, title: "Integração total", text: "Site, WhatsApp, formulários, CRM e sistemas internos conectados em um fluxo único." },
      { icon: MessageCircle, title: "Mais conversão", text: "Quem responde mais rápido vende mais. Automação transforma velocidade em receita." },
    ]}
    faq={[
      { question: "O que exatamente vocês automatizam?", answer: "Atendimento inicial, qualificação de leads, envio de propostas, geração de orçamentos, notificações internas, acompanhamento de processos e integração entre canais como site, WhatsApp e sistemas internos." },
      { question: "Preciso trocar meus sistemas atuais?", answer: "Não. A automação se integra aos sistemas que você já usa. Conectamos ferramentas existentes em fluxos inteligentes sem exigir migração." },
      { question: "Quanto tempo leva para implementar?", answer: "Depende da complexidade da operação. Automações simples ficam prontas em dias. Fluxos mais complexos levam semanas. Tudo começa com um diagnóstico gratuito." },
      { question: "Isso substitui minha equipe?", answer: "Não. Libera sua equipe de tarefas repetitivas para que foquem no que realmente importa: vender, atender e crescer." },
      { question: "E se eu não souber o que automatizar?", answer: "Por isso começamos com um diagnóstico. Mapeamos sua operação, identificamos os gargalos e mostramos exatamente onde a automação vai gerar mais resultado." },
    ]}
    relatedLinks={[
      { label: "Suporte TI Empresarial", href: "/suporte-ti-jacarei" },
      { label: "Infraestrutura Corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
      { label: "Terceirização de TI", href: "/terceirizacao-de-mao-de-obra-ti" },
      { label: "Desenvolvimento Web", href: "/desenvolvimento-de-sites-e-sistemas-web" },
      { label: "Monitoramento de Rede", href: "/monitoramento-de-rede" },
    ]}
    localContent="Atendimento em Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba. Diagnóstico gratuito para empresas que querem parar de depender de processos manuais e ganhar velocidade operacional com automação inteligente."
    showHoursCalculator
  />
);

export default AutomacaoIaPage;

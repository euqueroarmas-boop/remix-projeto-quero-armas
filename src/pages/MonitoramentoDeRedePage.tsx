import { Activity, Network, AlertTriangle, Eye, Shield, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const MonitoramentoDeRedePage = () => (
  <ServicePageTemplate
    title="Monitoramento de Rede Corporativa"
    metaTitle="Monitoramento De Rede Corporativa 24/7 — Você não sabe o que está acontecendo na sua rede agora | WMTi"
    metaDescription="Monitoramento de rede corporativa 24/7 em Jacareí. Alertas em tempo real, análise de tráfego, detecção de falhas e suporte proativo. Você não sabe o que está acontecendo na sua rede agora — e isso vai custar caro."
    tag="Monitoramento de Rede"
    headline={<>Você não sabe o que está acontecendo <span className="text-primary">na sua rede agora</span> — e isso vai custar caro</>}
    description="Quantos dispositivos estão conectados? Qual link está sobrecarregado? Tem alguém acessando o que não deveria? Tem equipamento prestes a falhar? Se você não sabe responder, está operando no escuro. E quando a rede cai, você descobre da pior forma — com todo mundo parado. Salários sendo pagos sem produção. Clientes esperando. Operação travada. E ninguém sabe por quê. Não é porque a rede 'resolveu cair'. É porque ninguém estava olhando. A maioria das empresas só descobre que tinha problema quando o problema já virou prejuízo. A WMTi monitora sua rede 24/7 e age antes que o problema aconteça — não depois."
    whatsappMessage="Olá! Preciso de monitoramento de rede corporativa."
    painPoints={[
      "Rede lenta e ninguém consegue identificar a causa — prejuízo diário invisível",
      "Falhas de conectividade que aparecem sem aviso e param a operação inteira",
      "Sem visibilidade sobre quem usa o quê — vulnerabilidades acumulando",
      "Equipamentos de rede funcionando no piloto automático há meses",
      "Problemas descobertos só quando todo mundo já está parado e reclamando",
    ]}
    solutions={[
      "Monitoramento 24/7 de switches, access points e roteadores — antes da falha, não depois",
      "Análise de tráfego e uso de banda por dispositivo em tempo real",
      "Alertas automáticos para falhas e degradação de performance — ação imediata",
      "Gerenciamento centralizado de todos os equipamentos de rede",
      "Saída do escuro para visibilidade total — você sabe o que está acontecendo antes de virar problema",
    ]}
    benefits={[
      { icon: Activity, title: "Monitoramento 24/7", text: "Sua rede inteira monitorada em tempo real — não só quando alguém reclama. Porque quando você descobre pelo usuário, o prejuízo já começou." },
      { icon: Network, title: "Visibilidade total", text: "Saber exatamente o que está consumindo banda e onde está o gargalo. Chega de operar no escuro." },
      { icon: AlertTriangle, title: "Alertas antes da falha", text: "Notificações automáticas quando algo sai do normal — antes de parar tudo. Prevenção, não correria." },
      { icon: Eye, title: "Dashboards em tempo real", text: "Painéis visuais mostrando a saúde da rede a qualquer momento. Decisão baseada em dados, não em achismo." },
      { icon: Shield, title: "Segurança da rede", text: "Detecção de dispositivos não autorizados conectados na sua rede. Se entrou sem permissão, a gente vê." },
      { icon: Headphones, title: "Suporte proativo", text: "Equipe que age quando o alerta toca — não quando você liga reclamando que já parou tudo." },
    ]}
    faq={[
      { question: "O que é monitorado na rede?", answer: "Tudo: switches, access points, roteadores, links de internet, tráfego e disponibilidade de serviços. Se está na rede, a gente monitora. E se sair do normal, a gente age." },
      { question: "Vocês detectam problemas antes de pararem?", answer: "Sim. O monitoramento identifica tendências e anomalias que indicam falhas futuras. A gente age antes de virar problema — não depois de virar prejuízo." },
      { question: "Funciona com qualquer equipamento?", answer: "Sim. Monitoramos equipamentos de qualquer fabricante que suporte SNMP ou protocolos padrão de rede. Se está na rede, a gente monitora." },
      { question: "Qual a diferença entre monitorar e não monitorar?", answer: "Sem monitoramento, você descobre o problema quando todo mundo para de trabalhar. Com monitoramento, a gente resolve antes de alguém perceber. A diferença é prejuízo." },
    ]}
    relatedLinks={[
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { label: "Segurança de rede", href: "/seguranca-de-rede" },
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
    ]}
    localContent="Monitoramos redes corporativas em Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba. Equipe própria com NOC 24/7 e atendimento presencial na região."
    showHoursCalculator
  />
);

export default MonitoramentoDeRedePage;

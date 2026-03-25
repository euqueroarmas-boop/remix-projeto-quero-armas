import { Network, Wifi, Shield, Activity, Server, Wrench } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const MontagemRedesPage = () => (
  <ServicePageTemplate
    title="Montagem e Monitoramento de Redes em Jacareí"
    metaTitle="Montagem e Monitoramento de Redes em Jacareí — Sua empresa está perdendo produtividade | WMTi"
    metaDescription="Montagem e monitoramento de redes em Jacareí. Estrutura correta, distribuição inteligente, estabilidade real e monitoramento constante. Pare de perder produtividade com rede mal estruturada."
    tag="Redes Corporativas"
    headline={<>Sua empresa está perdendo produtividade com uma <span className="text-primary">rede mal estruturada</span></>}
    description="Internet lenta não é normal. Rede caindo não é normal. Sistema demorando para responder não é normal. Mas muita empresa se acostumou com isso. E esse é o problema. Porque quando a rede não funciona bem, toda a empresa trava: funcionário esperando, sistema demorando, operação lenta, cliente esperando. E isso vai sendo absorvido como rotina. Mas não deveria. Uma rede bem estruturada não oscila o tempo todo."
    whatsappMessage="Olá! Gostaria de um orçamento para montagem de rede na minha empresa."
    painPoints={[
      "Internet lenta que todo mundo já aceitou como normal",
      "Rede caindo e ninguém sabe a causa real",
      "Funcionário esperando, sistema demorando, operação lenta",
      "Problemas de conectividade absorvidos como rotina do dia a dia",
      "Sem monitoramento — problemas só são descobertos quando param tudo",
    ]}
    solutions={[
      "Estrutura correta desde a base — rede projetada para funcionar de verdade",
      "Distribuição inteligente do tráfego para eliminar gargalos",
      "Estabilidade real — sem oscilações, sem quedas constantes",
      "Monitoramento constante para identificar e resolver antes de parar",
      "Ambiente instável vira ambiente confiável — e quando a rede funciona bem, tudo flui melhor",
    ]}
    benefits={[
      { icon: Network, title: "Estrutura correta", text: "A WMTi organiza sua rede desde a base. Cabeamento certificado, projeto correto, resultado confiável." },
      { icon: Wifi, title: "Distribuição inteligente", text: "Tráfego distribuído de forma inteligente para que nenhum ponto da rede seja gargalo." },
      { icon: Shield, title: "Estabilidade real", text: "Rede que não oscila o tempo todo. Ambiente instável vira ambiente confiável." },
      { icon: Activity, title: "Monitoramento constante", text: "Monitoramento 24/7 para identificar problemas antes que impactem a operação." },
      { icon: Server, title: "Switches gerenciáveis", text: "Equipamentos corporativos com QoS, segmentação e gerenciamento centralizado." },
      { icon: Wrench, title: "Manutenção preventiva", text: "Revisão periódica de infraestrutura de rede com relatório técnico." },
    ]}
    faq={[
      { question: "Quanto custa montar uma rede corporativa?", answer: "Depende do número de pontos, distâncias e complexidade. Para escritórios de 10-20 pontos, projetos começam em torno de R$ 5.000 incluindo cabeamento, patch panel, switch e organização do rack." },
      { question: "Qual a diferença entre Cat5e e Cat6A?", answer: "Cat6A suporta velocidades de até 10Gbps em distâncias de até 100m, enquanto Cat5e é limitado a 1Gbps. Para infraestrutura nova, sempre recomendamos Cat6A pela durabilidade e compatibilidade futura." },
      { question: "Vocês fazem manutenção em redes existentes?", answer: "Sim. Fazemos diagnóstico, reorganização de cabeamento, troca de equipamentos, certificação de pontos e otimização de redes já instaladas." },
      { question: "O monitoramento é realmente 24/7?", answer: "Sim. Nosso NOC monitora a rede continuamente. Recebemos alertas automáticos de qualquer anomalia — lentidão, queda de equipamento, utilização excessiva — e atuamos proativamente antes que o problema afete sua operação." },
    ]}
    relatedLinks={[
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Suporte de TI", href: "/suporte-ti-jacarei" },
    ]}
    localContent="Realizamos projetos de rede em empresas, clínicas, escritórios, indústrias e cartórios em Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba. Desde o projeto de cabeamento estruturado até a ativação final com certificação, entregamos uma rede profissional, organizada e documentada."
    showHoursCalculator
  />
);

export default MontagemRedesPage;

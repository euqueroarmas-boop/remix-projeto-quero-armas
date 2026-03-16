import { Network, Wifi, Shield, Activity, Server, Wrench } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const MontagemRedesPage = () => (
  <ServicePageTemplate
    title="Montagem e Monitoramento de Redes em Jacareí"
    metaTitle="Montagem e Monitoramento de Redes em Jacareí e São José dos Campos | WMTi"
    metaDescription="Montagem de redes corporativas com cabeamento estruturado Cat6A, switches Dell gerenciáveis, VLANs e monitoramento 24/7 em Jacareí, São José dos Campos e Vale do Paraíba."
    tag="Redes Corporativas"
    headline={<>Montagem e monitoramento de redes em <span className="text-primary">Jacareí e região.</span></>}
    description="Projeto e implementação de redes corporativas com cabeamento estruturado Cat6A e fibra óptica, switches Dell gerenciáveis, VLANs segmentadas e monitoramento contínuo via Zabbix."
    whatsappMessage="Olá! Gostaria de um orçamento para montagem de rede na minha empresa."
    painPoints={[
      "Rede lenta com cabos desorganizados e sem identificação",
      "Quedas frequentes de conexão afetando produtividade",
      "Sem segmentação de rede — todos os dispositivos na mesma rede",
      "Equipamentos de rede domésticos em ambiente corporativo",
      "Sem monitoramento — problemas só são descobertos quando param tudo",
    ]}
    solutions={[
      "Projeto de rede estruturada com cabeamento Cat6A certificado e organizado",
      "Switches Dell Networking N-Series gerenciáveis com PoE+",
      "Segmentação por VLANs: separar dados, VoIP, câmeras e visitantes",
      "Monitoramento 24/7 via Zabbix com alertas proativos por WhatsApp",
      "Documentação completa com diagramas de rede e identificação de pontos",
    ]}
    benefits={[
      { icon: Network, title: "Cabeamento certificado", text: "Cat6A e fibra óptica com certificação de desempenho e garantia." },
      { icon: Wifi, title: "Wi-Fi corporativo", text: "Access points enterprise com roaming, autenticação 802.1X e cobertura total." },
      { icon: Shield, title: "Segmentação", text: "VLANs para separar redes e reduzir superfície de ataque." },
      { icon: Activity, title: "Monitoramento", text: "Zabbix + Grafana com dashboards em tempo real e alertas automáticos." },
      { icon: Server, title: "Switches gerenciáveis", text: "Dell Networking com QoS, STP, SNMP e gerenciamento centralizado." },
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
      { label: "Servidores Dell", href: "/servidores-dell-poweredge-jacarei" },
      { label: "Suporte de TI", href: "/suporte-ti-empresarial-jacarei" },
    ]}
    localContent="Realizamos projetos de rede em empresas, clínicas, escritórios, indústrias e cartórios em Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba. Desde o projeto de cabeamento estruturado até a ativação final com certificação, entregamos uma rede profissional, organizada e documentada."
    showHoursCalculator
  />
);

export default MontagemRedesPage;

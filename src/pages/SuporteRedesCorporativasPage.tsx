import { Network, Shield, Activity, Wrench, Headphones, Eye } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SuporteRedesCorporativasPage = () => (
  <ServicePageTemplate
    title="Suporte Técnico Para Redes Corporativas"
    metaTitle="Suporte Técnico Para Redes Corporativas | WMTi"
    metaDescription="Suporte técnico especializado para redes corporativas. Diagnóstico, manutenção, otimização e monitoramento de switches, access points e cabeamento estruturado."
    tag="Suporte Técnico Para Redes Corporativas"
    headline={<>Sua rede trava, cai, e <span className="text-primary">ninguém resolve de verdade</span></>}
    description="A internet oscila. O Wi-Fi some. O sistema demora. E todo dia alguém reclama. Você já chamou alguém para 'dar uma olhada'. Trocaram um cabo, reiniciaram o roteador, e disseram que estava funcionando. Até cair de novo. O problema não é o cabo. É que ninguém olhou a rede como um todo — switches, access points, cabeamento, distribuição de tráfego. A WMTi diagnostica, corrige e mantém sua rede funcionando de verdade."
    whatsappMessage="Olá! Preciso de suporte técnico para minha rede corporativa."
    painPoints={[
      "Rede corporativa lenta e ninguém consegue diagnosticar por quê",
      "Switches e access points sem gerenciamento — funcionando no automático",
      "Cabeamento desorganizado, remendado e sem certificação",
      "Problemas de conectividade que aparecem e somem sem explicação",
    ]}
    solutions={[
      "Diagnóstico completo da rede — de verdade, não só 'dar uma olhada'",
      "Switches e access points gerenciados com configuração centralizada",
      "Cabeamento estruturado certificado, organizado e documentado",
      "Suporte contínuo para problemas de conectividade e performance",
    ]}
    benefits={[
      { icon: Network, title: "Diagnóstico real", text: "Análise completa com ferramentas profissionais — não chute. Diagnóstico de verdade." },
      { icon: Shield, title: "Equipamentos gerenciados", text: "Switches e access points configurados e monitorados, não no piloto automático." },
      { icon: Activity, title: "Performance estável", text: "Rede otimizada para parar de oscilar e funcionar como deveria." },
      { icon: Wrench, title: "Cabeamento certificado", text: "Cat6A instalado, testado e certificado. Sem gambiarra." },
      { icon: Eye, title: "Monitoramento contínuo", text: "Visibilidade total da rede — saber o que acontece antes de virar problema." },
      { icon: Headphones, title: "Suporte especializado", text: "Equipe que entende de rede corporativa e resolve na causa, não no sintoma." },
    ]}
    faq={[
      { question: "Vocês diagnosticam problemas de rede?", answer: "Sim. Com ferramentas profissionais, não com 'ping'. Identificamos gargalos, falhas e a causa real do problema." },
      { question: "Atendem qual tipo de rede?", answer: "Cabeada e Wi-Fi corporativa com switches gerenciáveis e access points profissionais. Rede residencial não é nosso foco." },
      { question: "Fazem certificação de cabeamento?", answer: "Sim. Cat6A certificado com relatório de teste. Cabeamento que funciona e está documentado." },
    ]}
    relatedLinks={[
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { label: "Monitoramento de rede", href: "/monitoramento-de-rede" },
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
    ]}
    localContent="Suporte para redes corporativas em Jacareí, Vale do Paraíba e em todo o Brasil."
    showHoursCalculator
  />
);

export default SuporteRedesCorporativasPage;

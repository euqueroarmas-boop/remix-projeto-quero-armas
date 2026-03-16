import { AlertTriangle, Clock, Server, Shield, Headphones, Wrench } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SuporteEmergencialPage = () => (
  <ServicePageTemplate
    title="Suporte Técnico Emergencial"
    metaTitle="Suporte Técnico Emergencial | Atendimento Imediato | WMTi"
    metaDescription="Suporte técnico emergencial para empresas. Atendimento imediato para servidores, redes e sistemas que pararam de funcionar. Pagamento por hora."
    tag="Suporte Técnico Emergencial"
    headline={<>Suporte Técnico <span className="text-primary">Emergencial</span></>}
    description="Problema urgente na sua empresa? Nossa equipe pode prestar atendimento técnico imediato para restaurar servidores, rede, sistemas ou computadores que pararam de funcionar, em servidores Windows Server, Linux ou estações de trabalho."
    whatsappMessage="Olá! Preciso de suporte técnico emergencial para minha empresa."
    painPoints={[
      "Servidor parou e a operação está parada",
      "Rede fora do ar sem conectividade",
      "Ataque ransomware ou vírus comprometendo sistemas",
      "Falha crítica sem equipe de TI disponível",
    ]}
    solutions={[
      "Atendimento emergencial remoto e presencial com SLA prioritário",
      "Restauração de servidores Windows Server e Linux",
      "Recuperação de rede e conectividade corporativa",
      "Resposta a incidentes de segurança e ransomware",
    ]}
    benefits={[
      { icon: AlertTriangle, title: "Atendimento imediato", text: "Prioridade máxima para situações críticas que impactam a operação." },
      { icon: Clock, title: "Sob demanda", text: "Pague por hora e use quando precisar, sem necessidade de contrato mensal." },
      { icon: Server, title: "Servidores", text: "Restauração de servidores Windows Server e Linux com urgência." },
      { icon: Shield, title: "Segurança", text: "Resposta a incidentes de segurança e recuperação de ransomware." },
      { icon: Wrench, title: "Infraestrutura", text: "Restauração de rede, switches, firewalls e conectividade." },
      { icon: Headphones, title: "Equipe especializada", text: "Técnicos certificados Dell e Microsoft para resolução rápida." },
    ]}
    faq={[
      { question: "Como funciona o suporte emergencial?", answer: "Você solicita atendimento e nossa equipe inicia o diagnóstico remoto imediatamente. Se necessário, enviamos um técnico presencial." },
      { question: "Preciso de contrato mensal?", answer: "Não. O suporte emergencial é sob demanda, pago por hora técnica." },
      { question: "Qual o tempo de resposta?", answer: "O atendimento remoto é iniciado imediatamente. Atendimento presencial em até 4 horas na região de Jacareí." },
    ]}
    relatedLinks={[
      { label: "Suporte TI mensal", href: "/suporte-ti-jacarei" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
    ]}
    localContent="Atendimento emergencial em Jacareí, Vale do Paraíba e em todo o estado de São Paulo."
    showHoursCalculator
  />
);

export default SuporteEmergencialPage;

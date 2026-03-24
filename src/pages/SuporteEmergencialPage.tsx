import { AlertTriangle, Clock, Server, Shield, Headphones, Wrench } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SuporteEmergencialPage = () => (
  <ServicePageTemplate
    title="Suporte Técnico Emergencial"
    metaTitle="Suporte Técnico Emergencial | Atendimento Imediato | WMTi"
    metaDescription="Suporte técnico emergencial para empresas. Atendimento imediato para servidores, redes e sistemas que pararam de funcionar. Pagamento por hora."
    tag="Suporte Técnico Emergencial"
    headline={<>Tudo parou. Ninguém sabe o que fazer. <span className="text-primary">O prejuízo já começou.</span></>}
    description="Servidor fora do ar. Rede caiu. Sistema não abre. Equipe inteira parada. E cada minuto que passa é dinheiro perdido — salário sendo pago sem produção, cliente esperando, operação travada. Nessas horas, você não precisa de alguém que vai 'dar uma olhada'. Precisa de alguém que sabe o que está fazendo e resolve agora. A WMTi atende emergências com prioridade máxima — remoto ou presencial, sem enrolação."
    whatsappMessage="Olá! Preciso de suporte técnico emergencial para minha empresa."
    painPoints={[
      "Servidor parou e toda a operação está travada",
      "Rede fora do ar e ninguém consegue trabalhar",
      "Ataque ransomware ou vírus comprometendo sistemas",
      "Falha crítica e sua empresa não tem equipe de TI",
    ]}
    solutions={[
      "Atendimento emergencial imediato — remoto e presencial",
      "Restauração de servidores Windows Server e Linux na hora",
      "Recuperação de rede e conectividade corporativa",
      "Resposta rápida a incidentes de segurança e ransomware",
    ]}
    benefits={[
      { icon: AlertTriangle, title: "Atendimento imediato", text: "Quando tudo para, a gente entra em ação. Prioridade máxima para situações críticas." },
      { icon: Clock, title: "Pague por hora", text: "Sem contrato mensal obrigatório. Você usa quando precisa e paga pelo que usar." },
      { icon: Server, title: "Servidores", text: "Restauração urgente de servidores Windows Server e Linux que pararam." },
      { icon: Shield, title: "Segurança", text: "Resposta a ransomware, vírus e incidentes de segurança com contenção rápida." },
      { icon: Wrench, title: "Infraestrutura", text: "Restauração de rede, switches, firewalls e conectividade que caiu." },
      { icon: Headphones, title: "Equipe pronta", text: "Técnicos certificados Dell e Microsoft prontos para resolver na hora." },
    ]}
    faq={[
      { question: "Como funciona o suporte emergencial?", answer: "Você liga, a gente começa. Diagnóstico remoto imediato. Se precisar presencial, enviamos um técnico. Sem burocracia." },
      { question: "Preciso de contrato mensal?", answer: "Não. Suporte emergencial é sob demanda. Você paga por hora técnica e usa quando precisar." },
      { question: "Qual o tempo de resposta?", answer: "Remoto: imediato. Presencial: até 4 horas na região de Jacareí. Porque quando para, cada minuto conta." },
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

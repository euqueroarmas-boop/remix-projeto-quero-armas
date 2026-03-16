import { Shield, Lock, Eye, Server, Activity, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SegurancaDeRedePage = () => (
  <ServicePageTemplate
    title="Segurança De Rede"
    metaTitle="Segurança De Rede Corporativa | Firewall e Proteção | WMTi"
    metaDescription="Soluções de segurança de rede para empresas. Firewall corporativo, IDS/IPS, segmentação por VLANs, VPN e políticas de segurança da informação."
    tag="Segurança De Rede"
    headline={<>Segurança De <span className="text-primary">Rede Corporativa</span></>}
    description="A segurança da rede corporativa é fundamental para proteger dados sensíveis e garantir a continuidade das operações. A WMTi implementa firewalls, IDS/IPS, segmentação de rede e políticas de segurança."
    whatsappMessage="Olá! Preciso de soluções de segurança de rede para minha empresa."
    painPoints={[
      "Rede sem firewall ou proteção contra invasões",
      "Falta de segmentação de rede entre departamentos",
      "Sem VPN segura para acesso remoto",
      "Vulnerável a ataques ransomware e phishing",
    ]}
    solutions={[
      "Firewall corporativo com IDS/IPS para detecção de intrusões",
      "Segmentação de rede por VLANs para isolamento de tráfego",
      "VPN segura para acesso remoto criptografado",
      "Políticas de segurança e controle de acesso por perfil",
    ]}
    benefits={[
      { icon: Shield, title: "Firewall corporativo", text: "Firewall pfSense com regras personalizadas e IDS/IPS Suricata." },
      { icon: Lock, title: "VPN segura", text: "Acesso remoto criptografado para colaboradores e filiais." },
      { icon: Eye, title: "Detecção de intrusões", text: "IDS/IPS para identificar e bloquear tentativas de invasão." },
      { icon: Server, title: "Segmentação de rede", text: "VLANs para isolamento de tráfego entre departamentos." },
      { icon: Activity, title: "Monitoramento", text: "Monitoramento contínuo de logs e alertas de segurança." },
      { icon: Headphones, title: "Suporte especializado", text: "Equipe técnica em segurança da informação corporativa." },
    ]}
    faq={[
      { question: "Qual firewall vocês utilizam?", answer: "Utilizamos pfSense com Suricata IDS/IPS, solução open-source robusta e confiável." },
      { question: "Vocês fazem segmentação de rede?", answer: "Sim. Implementamos VLANs para segmentação e isolamento de tráfego entre departamentos." },
      { question: "Como funciona a VPN?", answer: "Configuramos VPN OpenVPN ou WireGuard para acesso remoto seguro e criptografado." },
    ]}
    relatedLinks={[
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
    ]}
    localContent="Implementamos segurança de rede em empresas de Jacareí, Vale do Paraíba e em todo o Brasil."
    showHoursCalculator
  />
);

export default SegurancaDeRedePage;

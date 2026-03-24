import { Shield, Lock, Eye, Server, Activity, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SegurancaDeRedePage = () => (
  <ServicePageTemplate
    title="Segurança De Rede"
    metaTitle="Segurança De Rede Corporativa | Firewall e Proteção | WMTi"
    metaDescription="Soluções de segurança de rede para empresas. Firewall corporativo, IDS/IPS, segmentação por VLANs, VPN e políticas de segurança da informação."
    tag="Segurança De Rede"
    headline={<>Sua rede corporativa está exposta — e <span className="text-primary">você pode nem saber disso</span></>}
    description="Sem firewall configurado. Sem segmentação. Sem controle de quem acessa o quê. Sem VPN para acesso remoto. E enquanto isso, qualquer dispositivo conectado pode ser uma porta de entrada. Um clique errado. Um pendrive infectado. Um acesso remoto mal configurado. E pronto — dados vazados, sistema comprometido, operação parada. Segurança de rede não é algo que você nota quando funciona. É algo que você só sente falta quando já deu problema. A WMTi protege sua rede para que esse dia nunca chegue."
    whatsappMessage="Olá! Preciso de soluções de segurança de rede para minha empresa."
    painPoints={[
      "Rede sem firewall real — só o roteador da operadora",
      "Todos na mesma rede, sem separação entre departamentos",
      "Acesso remoto sem VPN — qualquer um pode tentar entrar",
      "Vulnerável a ransomware, phishing e ataques internos",
    ]}
    solutions={[
      "Firewall pfSense com IDS/IPS para bloquear ameaças em tempo real",
      "Segmentação de rede por VLANs — cada departamento isolado",
      "VPN segura para acesso remoto criptografado de verdade",
      "Políticas de segurança e controle de acesso por perfil de usuário",
    ]}
    benefits={[
      { icon: Shield, title: "Firewall de verdade", text: "pfSense com regras personalizadas e IDS/IPS Suricata — não só o roteador da operadora." },
      { icon: Lock, title: "VPN segura", text: "Acesso remoto criptografado para quem precisa, bloqueado para quem não precisa." },
      { icon: Eye, title: "Detecção de intrusões", text: "IDS/IPS identificando e bloqueando tentativas de invasão em tempo real." },
      { icon: Server, title: "Rede segmentada", text: "VLANs separando departamentos — um problema em um setor não derruba tudo." },
      { icon: Activity, title: "Logs e auditoria", text: "Monitoramento contínuo de logs para saber exatamente o que acontece na rede." },
      { icon: Headphones, title: "Equipe de segurança", text: "Profissionais que entendem de segurança da informação, não só de cabos e switches." },
    ]}
    faq={[
      { question: "Qual firewall vocês utilizam?", answer: "pfSense com Suricata IDS/IPS. Solução robusta, confiável e que usamos em produção há anos. Não é roteador de operadora." },
      { question: "Vocês fazem segmentação de rede?", answer: "Sim. VLANs para separar departamentos, visitantes e dispositivos IoT. Um problema em um setor não afeta os outros." },
      { question: "Como funciona a VPN?", answer: "OpenVPN ou WireGuard — acesso remoto criptografado, autenticado e controlado. Só quem deve acessar, acessa." },
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

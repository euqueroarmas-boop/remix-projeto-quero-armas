import { Shield, Lock, Eye, Server, Activity, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const SegurancaDeRedePage = () => (
  <ServicePageTemplate
    title="Segurança de Rede Corporativa"
    metaTitle="Segurança De Rede Corporativa — Sua rede está exposta e você pode nem saber disso | WMTi"
    metaDescription="Segurança de rede corporativa em Jacareí. Firewall pfSense, IDS/IPS, VLANs, VPN e políticas de segurança. Sua rede está exposta e o próximo ataque pode ser o último."
    tag="Segurança de Rede"
    headline={<>Sua rede corporativa está exposta — e <span className="text-primary">você pode nem saber disso</span></>}
    description="Sem firewall configurado. Sem segmentação. Sem controle de quem acessa o quê. Sem VPN para acesso remoto. E enquanto isso, qualquer dispositivo conectado pode ser uma porta de entrada. Um clique errado. Um pendrive infectado. Um acesso remoto mal configurado. E pronto — dados vazados, sistema comprometido, operação parada. E o prejuízo não é só técnico — é financeiro e reputacional. Multas da LGPD. Perda de clientes. Informação confidencial na mão errada. Segurança de rede não é algo que você nota quando funciona. É algo que você só sente falta quando já deu problema. A WMTi protege sua rede para que esse dia nunca chegue."
    whatsappMessage="Olá! Preciso de soluções de segurança de rede para minha empresa."
    painPoints={[
      "Rede sem firewall real — só o roteador da operadora fazendo papel de proteção",
      "Todos na mesma rede, sem separação entre departamentos — um problema derruba tudo",
      "Acesso remoto sem VPN — qualquer um pode tentar entrar na sua rede",
      "Vulnerável a ransomware, phishing e ataques internos — e sem saber disso",
      "Sem visibilidade sobre o que está acontecendo — ataque pode estar rolando agora",
    ]}
    solutions={[
      "Firewall pfSense com IDS/IPS para bloquear ameaças em tempo real — proteção de verdade",
      "Segmentação de rede por VLANs — cada departamento isolado, um problema não derruba tudo",
      "VPN segura para acesso remoto criptografado de verdade — só entra quem deve",
      "Políticas de segurança e controle de acesso por perfil de usuário — sem brechas",
      "Saída de um ambiente exposto para uma rede controlada e protegida",
    ]}
    benefits={[
      { icon: Shield, title: "Firewall de verdade", text: "pfSense com regras personalizadas e IDS/IPS Suricata — não só o roteador da operadora. Proteção real contra ameaças reais." },
      { icon: Lock, title: "VPN segura", text: "Acesso remoto criptografado para quem precisa, bloqueado para quem não precisa. Sem brechas, sem improvisos." },
      { icon: Eye, title: "Detecção de intrusões", text: "IDS/IPS identificando e bloqueando tentativas de invasão em tempo real. Se tentarem entrar, a gente bloqueia." },
      { icon: Server, title: "Rede segmentada", text: "VLANs separando departamentos — um problema em um setor não derruba a empresa inteira." },
      { icon: Activity, title: "Logs e auditoria", text: "Monitoramento contínuo de logs para saber exatamente o que acontece na rede. Visibilidade total." },
      { icon: Headphones, title: "Equipe de segurança", text: "Profissionais que entendem de segurança da informação, não só de cabos e switches. Proteção real." },
    ]}
    faq={[
      { question: "Qual firewall vocês utilizam?", answer: "pfSense com Suricata IDS/IPS. Solução robusta, confiável e que usamos em produção há anos. Não é roteador de operadora — é proteção de verdade." },
      { question: "Vocês fazem segmentação de rede?", answer: "Sim. VLANs para separar departamentos, visitantes e dispositivos IoT. Um problema em um setor não afeta os outros. Isolamento real." },
      { question: "Como funciona a VPN?", answer: "OpenVPN ou WireGuard — acesso remoto criptografado, autenticado e controlado. Só quem deve acessar, acessa. O resto fica de fora." },
      { question: "Minha empresa é pequena, preciso de segurança de rede?", answer: "Sim. Empresas pequenas são os alvos preferidos de ataques porque normalmente não têm proteção. E o prejuízo de um ransomware pode fechar a empresa." },
    ]}
    relatedLinks={[
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
    ]}
    localContent="Implementamos segurança de rede em empresas de Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba. Equipe especializada em segurança da informação com atendimento presencial."
    showHoursCalculator
  />
);

export default SegurancaDeRedePage;

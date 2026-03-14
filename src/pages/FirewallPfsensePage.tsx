import { Shield, Lock, Eye, Wifi, Server, Activity } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const FirewallPfsensePage = () => (
  <ServicePageTemplate
    title="Firewall pfSense em Jacareí"
    metaTitle="Firewall pfSense para Empresas em Jacareí e São José dos Campos | WMTi"
    metaDescription="Implantação de firewall pfSense com VPN, IDS/IPS Suricata e multi-WAN para empresas em Jacareí, São José dos Campos e Vale do Paraíba. Segurança de rede corporativa."
    tag="Firewall pfSense"
    headline={<>Firewall pfSense para empresas em <span className="text-primary">Jacareí e região.</span></>}
    description="Appliances pfSense dedicados com VPN IPsec/OpenVPN, IDS/IPS Suricata, filtro de conteúdo, balanceamento de carga e failover de links. Segurança de perímetro sem licenciamento por usuário."
    whatsappMessage="Olá! Gostaria de um orçamento para firewall pfSense na minha empresa."
    painPoints={[
      "Rede corporativa exposta sem firewall profissional",
      "Ataques de ransomware e malware ameaçando dados da empresa",
      "Funcionários acessando sites improdutivos ou perigosos",
      "Queda de internet quando um dos links falha",
      "Sem VPN segura para trabalho remoto ou conexão entre filiais",
    ]}
    solutions={[
      "Firewall pfSense em appliance dedicado com regras stateful e NAT avançado",
      "IDS/IPS Suricata com detecção e bloqueio de ameaças em tempo real",
      "VPN IPsec e OpenVPN com criptografia AES-256-GCM para acesso remoto seguro",
      "Multi-WAN com failover automático entre links de internet",
      "Filtro de conteúdo por categoria para controle de acesso web",
    ]}
    benefits={[
      { icon: Shield, title: "Segurança avançada", text: "Inspeção profunda de pacotes e bloqueio de ameaças em tempo real." },
      { icon: Lock, title: "VPN corporativa", text: "Conexão segura entre filiais e para trabalho remoto com criptografia forte." },
      { icon: Eye, title: "Monitoramento", text: "Dashboards em tempo real com logs de tráfego e alertas de intrusão." },
      { icon: Wifi, title: "Alta disponibilidade", text: "Multi-WAN com failover automático — zero downtime em falhas de provedor." },
      { icon: Server, title: "Sem licenciamento", text: "pfSense é open source — sem custo por usuário ou renovação anual de licença." },
      { icon: Activity, title: "Gestão WMTi", text: "Monitoramento 24/7 do firewall com atualizações de regras e patches." },
    ]}
    faq={[
      { question: "pfSense é seguro para empresas?", answer: "Sim. pfSense é usado por milhares de empresas e órgãos governamentais em todo o mundo. Baseado em FreeBSD, tem excelente histórico de segurança. Com IDS/IPS Suricata integrado, oferece proteção comparável a firewalls proprietários de alto custo." },
      { question: "Quanto custa implantar pfSense?", answer: "O investimento depende do porte da rede. Para pequenas empresas (até 30 usuários), appliances começam em torno de R$ 3.000 com instalação. Para redes maiores, dimensionamos appliances com múltiplas interfaces e throughput adequado." },
      { question: "Posso usar pfSense com VPN para home office?", answer: "Sim. Configuramos VPN OpenVPN ou IPsec para que seus colaboradores trabalhem de casa com acesso seguro à rede da empresa. Cada usuário recebe credenciais individuais com autenticação de dois fatores." },
      { question: "pfSense substitui roteadores comerciais?", answer: "Sim, e com vantagens significativas. pfSense oferece firewall stateful, VPN, IDS/IPS, balanceamento de carga e monitoramento — funcionalidades que roteadores comerciais não possuem ou cobram licenças extras." },
    ]}
    relatedLinks={[
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
      { label: "Servidores Dell", href: "/servidores-dell-poweredge-jacarei" },
      { label: "Suporte de TI", href: "/suporte-ti-empresarial-jacarei" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa" },
    ]}
    localContent="Instalamos firewalls pfSense em empresas de Jacareí, São José dos Campos, Taubaté e toda a região do Vale do Paraíba. Nossos técnicos realizam a implantação presencial com segmentação de rede (VLANs), configuração de regras personalizadas e integração com a infraestrutura existente."
  />
);

export default FirewallPfsensePage;

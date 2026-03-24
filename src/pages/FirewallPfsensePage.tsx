import { Shield, Lock, Eye, Wifi, Server, Activity } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const FirewallPfsensePage = () => (
  <ServicePageTemplate
    title="Firewall pfSense em Jacareí"
    metaTitle="Firewall PfSense em Jacareí — Sua empresa pode estar vulnerável agora | WMTi"
    metaDescription="Firewall pfSense em Jacareí. Controle total de acessos, bloqueio de conexões suspeitas, monitoramento constante da rede e VPN segura. Sua empresa pode estar vulnerável agora e você nem sabe."
    tag="Firewall pfSense"
    headline={<>Sua empresa pode estar <span className="text-primary">vulnerável agora</span> e você nem sabe</>}
    description="Sua empresa está conectada à internet o tempo todo. Mas você não vê o que está tentando entrar. E esse é exatamente o problema. Hoje, ataques não acontecem só em grandes empresas. Na verdade, pequenas e médias são as mais vulneráveis — porque normalmente não têm controle de acesso, não têm proteção real, não sabem o que está acontecendo na rede. E o risco não começa com um grande ataque. Começa com pequenas brechas: um acesso indevido, um usuário com permissão errada, um clique em um link malicioso, um equipamento exposto. E quando você percebe… já aconteceu. Dados vazados. Sistema comprometido. Informação sensível acessada. E o prejuízo não é só técnico — é financeiro e reputacional."
    whatsappMessage="Olá! Gostaria de um orçamento para firewall pfSense na minha empresa."
    painPoints={[
      "Rede corporativa exposta sem controle de acesso real",
      "Pequenas brechas que se transformam em problemas graves sem aviso",
      "Usuários com permissões erradas acessando o que não deveriam",
      "Equipamentos expostos à internet sem proteção adequada",
      "Sem visibilidade sobre o que está acontecendo na rede",
    ]}
    solutions={[
      "Controle total de acessos — você decide o que entra e o que sai da rede",
      "Bloqueio de conexões suspeitas antes que causem dano",
      "Monitoramento constante da rede com visibilidade completa",
      "VPN segura para acesso externo sem comprometer a segurança",
      "Saída do escuro para visibilidade e controle real da sua rede",
    ]}
    benefits={[
      { icon: Shield, title: "Barreira real", text: "A WMTi implementa uma barreira real entre sua empresa e o risco. Segurança não é algo que você percebe quando está funcionando — é algo que você só sente falta quando já deu problema." },
      { icon: Lock, title: "Controle total de acessos", text: "Você decide quem acessa o quê. Sem brechas, sem permissões erradas, sem equipamentos expostos." },
      { icon: Eye, title: "Visibilidade completa", text: "Você deixa de operar no escuro e passa a ter visibilidade e controle sobre tudo que acontece na rede." },
      { icon: Wifi, title: "VPN segura", text: "Acesso externo seguro para trabalho remoto ou conexão entre filiais, sem comprometer a rede." },
      { icon: Server, title: "Sem licenciamento", text: "pfSense é open source — sem custo por usuário ou renovação anual de licença." },
      { icon: Activity, title: "Monitoramento constante", text: "Monitoramento 24/7 do firewall com atualizações de regras e patches pela equipe WMTi." },
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
    showHoursCalculator
  />
);

export default FirewallPfsensePage;

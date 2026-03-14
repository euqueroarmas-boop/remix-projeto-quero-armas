import { FileCheck, Shield, Server, HardDrive, Lock, Activity } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const TiCartoriosPage = () => (
  <ServicePageTemplate
    title="TI para Cartórios — Provimento 213 CNJ"
    metaTitle="TI para Cartórios | Conformidade Provimento 213 CNJ | WMTi"
    metaDescription="Infraestrutura de TI para cartórios em conformidade com o Provimento 213 do CNJ. Servidores Dell, backup Veeam, firewall pfSense e monitoramento 24/7. Atendimento nacional."
    tag="TI para Cartórios"
    headline={<>Seu cartório em <span className="text-primary">conformidade total</span> com o Provimento 213.</>}
    description="Somos especialistas em infraestrutura de TI para cartórios. Implementamos todos os requisitos do Provimento 213/2026 do CNJ com servidores Dell PowerEdge, backup Veeam, firewall pfSense e monitoramento 24/7."
    whatsappMessage="Olá! Gostaria de um orçamento para adequação do meu cartório ao Provimento 213 do CNJ."
    painPoints={[
      "Cartório fora de conformidade com os requisitos do CNJ",
      "Backup manual ou inexistente — risco de perda total do acervo",
      "Sem firewall profissional protegendo dados sigilosos",
      "Falta de plano de continuidade (PCN) e recuperação de desastres (PRD)",
      "Servidor antigo sem redundância (RAID) ameaçando disponibilidade",
    ]}
    solutions={[
      "Diagnóstico completo de conformidade com o Provimento 213 do CNJ",
      "Servidores Dell PowerEdge com RAID redundante e fontes hot-swap",
      "Backup automatizado 3-2-1: Veeam + Dell PowerVault + Azure Cloud",
      "Firewall pfSense com IDS/IPS Suricata para segurança de perímetro",
      "Elaboração de PCN, PRD e Política de Segurança da Informação",
    ]}
    benefits={[
      { icon: FileCheck, title: "100% conforme", text: "Atendemos todos os requisitos do Provimento 213 para Classes 1, 2 e 3." },
      { icon: Server, title: "Dell PowerEdge", text: "Servidores enterprise com RAID, redundância e clustering Hyper-V." },
      { icon: HardDrive, title: "Backup 3-2-1", text: "Veeam + storage local + nuvem Azure com RPO e RTO definidos." },
      { icon: Shield, title: "pfSense + Suricata", text: "Firewall stateful com IDS/IPS e VPN para acesso remoto seguro." },
      { icon: Lock, title: "Criptografia AES-256", text: "Dados em trânsito e repouso protegidos com criptografia forte." },
      { icon: Activity, title: "NOC 24/7", text: "Monitoramento contínuo com alertas automáticos e resposta a incidentes." },
    ]}
    faq={[
      { question: "O que é o Provimento 213 do CNJ?", answer: "O Provimento 213/2026 substitui o Provimento 74/2018 e estabelece requisitos obrigatórios de TIC para todas as serventias extrajudiciais do Brasil. Define 5 etapas de adequação, 3 classes por faturamento e prazos de 90 dias a 36 meses." },
      { question: "Como saber em qual classe meu cartório se enquadra?", answer: "A classificação é baseada no faturamento semestral: Classe 1 (até R$ 100 mil), Classe 2 (R$ 100 mil a R$ 500 mil) e Classe 3 (acima de R$ 500 mil). Fazemos um diagnóstico gratuito para identificar sua classe e os requisitos aplicáveis." },
      { question: "Vocês atendem cartórios fora de Jacareí?", answer: "Sim. Atendemos serventias em todo o Brasil. Para cartórios na região do Vale do Paraíba, oferecemos atendimento presencial. Para outras localidades, combinamos suporte remoto com visitas técnicas programadas." },
      { question: "Quanto custa adequar meu cartório ao Provimento 213?", answer: "O investimento depende da classe da serventia e da infraestrutura atual. Oferecemos projetos personalizados com possibilidade de pagamento parcelado. Solicite um diagnóstico gratuito para receber uma proposta detalhada." },
    ]}
    relatedLinks={[
      { label: "Provimento 213 completo", href: "/provimento-213" },
      { label: "Servidores Dell", href: "/servidores-dell-poweredge-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa" },
    ]}
    localContent="Somos referência em TI para cartórios no Vale do Paraíba, atendendo serventias em Jacareí, São José dos Campos, Taubaté e região. Também realizamos projetos em cartórios de todo o Brasil, com implantação presencial e suporte remoto contínuo."
  />
);

export default TiCartoriosPage;

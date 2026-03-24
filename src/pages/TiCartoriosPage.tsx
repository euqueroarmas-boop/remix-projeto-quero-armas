import { FileCheck, Shield, Server, HardDrive, Lock, Activity } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const TiCartoriosPage = () => (
  <ServicePageTemplate
    title="TI para Cartórios — Provimento 213 CNJ"
    metaTitle="TI para Cartórios | Conformidade Provimento 213 CNJ | WMTi"
    metaDescription="Infraestrutura de TI para cartórios em conformidade com o Provimento 213 do CNJ. Servidores Dell, backup Veeam, firewall pfSense e monitoramento 24/7. Atendimento nacional."
    tag="TI para Cartórios"
    headline={<>Seu cartório pode estar fora de conformidade — e <span className="text-primary">o prazo está correndo</span></>}
    description="O Provimento 213 não é sugestão. É obrigação. E os prazos já estão correndo. Backup inadequado, servidor sem redundância, sem firewall, sem plano de continuidade — cada item desse é uma não-conformidade que pode gerar sanção. A maioria dos cartórios sabe que precisa se adequar, mas não sabe por onde começar. Ou já tentou, mas ficou no meio do caminho. A WMTi é especialista em TI para cartórios. Fazemos o diagnóstico, implementamos tudo e garantimos a conformidade total."
    whatsappMessage="Olá! Gostaria de um orçamento para adequação do meu cartório ao Provimento 213 do CNJ."
    painPoints={[
      "Cartório fora de conformidade com os requisitos do CNJ",
      "Backup manual ou inexistente — risco de perda total do acervo",
      "Sem firewall protegendo dados sigilosos de clientes",
      "Sem plano de continuidade (PCN) nem recuperação de desastres (PRD)",
      "Servidor antigo sem redundância ameaçando a disponibilidade",
    ]}
    solutions={[
      "Diagnóstico completo de conformidade com o Provimento 213",
      "Servidores Dell PowerEdge com RAID redundante e fontes hot-swap",
      "Backup automatizado 3-2-1: Veeam + Dell PowerVault + Azure Cloud",
      "Firewall pfSense com IDS/IPS Suricata para segurança real",
      "Elaboração de PCN, PRD e Política de Segurança da Informação",
    ]}
    benefits={[
      { icon: FileCheck, title: "100% conforme", text: "Todos os requisitos do Provimento 213 atendidos — Classes 1, 2 e 3. Sem pendência." },
      { icon: Server, title: "Dell PowerEdge", text: "Servidores enterprise com RAID e redundância. Servidor de verdade, não PC adaptado." },
      { icon: HardDrive, title: "Backup 3-2-1", text: "Veeam + storage local + nuvem Azure com RPO e RTO definidos. Backup que funciona." },
      { icon: Shield, title: "pfSense + Suricata", text: "Firewall stateful com IDS/IPS e VPN. Proteção real, não roteador de operadora." },
      { icon: Lock, title: "Criptografia AES-256", text: "Dados em trânsito e repouso protegidos. Conformidade com exigências de segurança." },
      { icon: Activity, title: "NOC 24/7", text: "Monitoramento contínuo com alertas automáticos. Seu cartório funcionando sempre." },
    ]}
    faq={[
      { question: "O que é o Provimento 213 do CNJ?", answer: "Substitui o Provimento 74/2018. Define requisitos obrigatórios de TIC para todas as serventias extrajudiciais do Brasil. São 5 etapas, 3 classes por faturamento e prazos de 90 dias a 36 meses. Não é opcional." },
      { question: "Como saber em qual classe meu cartório se enquadra?", answer: "Classe 1: até R$ 100 mil de faturamento semestral. Classe 2: R$ 100 mil a R$ 500 mil. Classe 3: acima de R$ 500 mil. Fazemos o diagnóstico gratuito para identificar sua classe e tudo que precisa ser feito." },
      { question: "Vocês atendem cartórios fora de Jacareí?", answer: "Sim. Atendemos em todo o Brasil. Vale do Paraíba com presencial. Outras localidades com suporte remoto e visitas técnicas programadas." },
      { question: "Quanto custa adequar meu cartório ao Provimento 213?", answer: "Depende da classe e da infraestrutura atual. Oferecemos projetos personalizados com parcelamento. Solicite um diagnóstico gratuito para receber uma proposta detalhada." },
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

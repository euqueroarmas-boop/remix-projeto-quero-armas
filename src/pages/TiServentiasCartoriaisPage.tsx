import { Server, HardDrive, Shield, Activity, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/serventias-cartoriais.webp";

const TiServentiasCartoriaisPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Serventias Notariais"
    metaTitle="Infraestrutura de TI para Serventias Notariais | Provimento 213 CNJ | WMTi"
    metaDescription="Soluções de infraestrutura de TI para serventias notariais em conformidade com o Provimento 213 do CNJ. Servidores Dell PowerEdge, backup Veeam, firewall pfSense e monitoramento 24/7."
    tag="TI para Serventias Notariais"
    headline={<>Seu cartório em <span className="text-primary">conformidade total</span> com o Provimento 213.</>}
    description="Somos especialistas em infraestrutura de TI para cartórios. Implementamos todos os requisitos do Provimento 213/2026 do CNJ com servidores Dell PowerEdge, backup Veeam, firewall pfSense e monitoramento 24/7."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura de TI da minha serventia notarial."
    heroImage={heroImg}
    heroImageAlt="Fachada de serventia notarial com arquitetura clássica"
    painPoints={[
      "Dificuldade em se adequar ao Provimento 213 do CNJ",
      "Sistemas cartoriais instáveis comprometendo operações jurídicas",
      "Falta de backup corporativo com replicação segura",
      "Ausência de firewall e segmentação de rede",
      "Servidores sem monitoramento contínuo",
      "Suporte técnico reativo sem manutenção preventiva",
    ]}
    solutions={[
      "Diagnóstico completo de conformidade com o Provimento 213 do CNJ",
      "Servidores Windows Server configurados para operação contínua e alta disponibilidade",
      "Backup corporativo com replicação local e em nuvem para recuperação rápida",
      "Firewalls corporativos com segmentação de rede e políticas de segurança",
      "Monitoramento contínuo da infraestrutura para identificar falhas preventivamente",
      "Suporte técnico especializado com manutenção preventiva e resolução rápida",
    ]}
    benefits={[
      { icon: Server, title: "Servidores corporativos", text: "Implantação e gerenciamento de servidores Windows Server para alto desempenho e disponibilidade dos sistemas cartoriais." },
      { icon: HardDrive, title: "Backup corporativo", text: "Soluções de backup com replicação local e em nuvem, garantindo proteção das informações e recuperação rápida." },
      { icon: Shield, title: "Segurança de rede", text: "Firewalls corporativos, segmentação de rede e políticas de segurança para prevenir acessos indevidos." },
      { icon: Activity, title: "Monitoramento contínuo", text: "Monitoramento de servidores e infraestrutura para identificar falhas antes que impactem a operação." },
      { icon: Lock, title: "Proteção de dados", text: "Proteção de informações sensíveis com criptografia e controle de acesso." },
      { icon: Headphones, title: "Suporte especializado", text: "Manutenção preventiva, resolução rápida de problemas e estabilidade operacional." },
    ]}
    faq={[
      { question: "A WMTi atende serventias notariais com adequação ao Provimento 213?", answer: "Sim. Somos especialistas em infraestrutura de TI para cartórios, com soluções homologadas e em conformidade com o Provimento 213 do CNJ." },
      { question: "Qual a importância do backup corporativo para serventias notariais?", answer: "A perda de dados em ambientes cartoriais pode gerar graves impactos operacionais e jurídicos. Implementamos backup com replicação local e em nuvem para garantir recuperação rápida." },
      { question: "Vocês realizam monitoramento contínuo?", answer: "Sim. Realizamos monitoramento contínuo da infraestrutura de TI para identificar falhas antes que impactem a operação da serventia." },
      { question: "Atendem fora da região de Jacareí?", answer: "Sim. Atendemos serventias em todo o Brasil com suporte remoto e visitas técnicas programadas." },
    ]}
    relatedLinks={[
      { label: "TI para Cartórios", href: "/ti-para-cartorios" },
      { label: "Provimento 213", href: "/cartorios/provimento-213" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
    ]}
    localContent="Solicite uma análise da infraestrutura de TI da sua serventia notarial. Atendemos em Jacareí, Vale do Paraíba e em todo o Brasil."
  />
);

export default TiServentiasCartoriaisPage;

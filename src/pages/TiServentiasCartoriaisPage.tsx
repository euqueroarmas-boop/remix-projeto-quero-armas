import { Server, HardDrive, Shield, Activity, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const TiServentiasCartoriaisPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Serventias Cartoriais"
    metaTitle="Infraestrutura de TI para Serventias Cartoriais | Servidores, Backup e Segurança | WMTi"
    metaDescription="Soluções de infraestrutura de TI para serventias cartoriais. Servidores Windows Server, backup corporativo, firewall empresarial e suporte técnico especializado."
    tag="TI para Serventias Cartoriais"
    headline={<>Infraestrutura de TI para <span className="text-primary">Serventias Cartoriais</span></>}
    description="As serventias cartoriais dependem de sistemas altamente confiáveis para garantir a continuidade das operações jurídicas e a segurança das informações. Sistemas de registro, bases documentais e armazenamento de dados exigem infraestrutura tecnológica estável, protegida e constantemente monitorada. A WMTi fornece soluções completas de infraestrutura de TI para serventias cartoriais, incluindo implantação e gerenciamento de servidores corporativos, backup seguro de dados, proteção de rede e suporte técnico especializado."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura de TI da minha serventia cartorial."
    painPoints={[
      "Sistemas cartoriais instáveis comprometendo operações jurídicas",
      "Falta de backup corporativo com replicação segura",
      "Ausência de firewall e segmentação de rede",
      "Servidores sem monitoramento contínuo",
      "Suporte técnico reativo sem manutenção preventiva",
    ]}
    solutions={[
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
      { question: "A WMTi atende serventias cartoriais?", answer: "Sim. Oferecemos soluções completas de infraestrutura de TI para serventias cartoriais, incluindo servidores, backup, firewall e suporte técnico especializado." },
      { question: "Qual a importância do backup corporativo para serventias cartoriais?", answer: "A perda de dados em ambientes cartoriais pode gerar graves impactos operacionais e jurídicos. Implementamos backup com replicação local e em nuvem para garantir recuperação rápida." },
      { question: "Vocês realizam monitoramento contínuo?", answer: "Sim. Realizamos monitoramento contínuo da infraestrutura de TI para identificar falhas antes que impactem a operação da serventia cartorial." },
      { question: "Atendem fora da região de Jacareí?", answer: "Sim. Atendemos serventias em todo o Brasil com suporte remoto e visitas técnicas programadas." },
    ]}
    relatedLinks={[
      { label: "TI para Cartórios", href: "/ti-para-cartorios" },
      { label: "Provimento 213", href: "/cartorios/provimento-213" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
    ]}
    localContent="Solicite uma análise da infraestrutura de TI da sua serventia cartorial. Atendemos em Jacareí, Vale do Paraíba e em todo o Brasil."
  />
);

export default TiServentiasCartoriaisPage;

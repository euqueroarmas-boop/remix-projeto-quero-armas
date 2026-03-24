import { Server, Shield, HardDrive, Activity, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/industrias-petroliferas.webp";

const TiIndustriasPetroliferasPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Indústrias Petrolíferas"
    metaTitle="Infraestrutura de TI para Indústrias Petrolíferas | Segurança e Monitoramento | WMTi"
    metaDescription="Infraestrutura de TI para indústrias petrolíferas e empresas do setor de combustíveis. Servidores corporativos, segurança de rede, backup e monitoramento."
    tag="TI para Indústrias Petrolíferas"
    headline={<>Sua operação crítica depende de uma infraestrutura que <span className="text-primary">não foi projetada para falhar</span> — mas pode</>}
    description="Sistemas operacionais críticos rodando 24 horas. Dados sensíveis de operação trafegando pela rede. E uma infraestrutura de TI que ninguém revisou há meses. No setor petrolífero, uma falha de TI pode significar interrupção de operação crítica, exposição de dados sensíveis ou comprometimento de sistemas de controle. O risco não é teórico — é real e acontece. A WMTi implementa infraestrutura de TI com a robustez e a segurança que operações críticas exigem."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura tecnológica da minha empresa do setor petrolífero."
    heroImage={heroImg}
    heroImageAlt="Refinaria de petróleo com torres de destilação ao pôr do sol"
    painPoints={[
      "Sistemas operacionais críticos sem alta disponibilidade real",
      "Infraestrutura exposta a ataques cibernéticos sem proteção adequada",
      "Dados operacionais sem backup seguro e recuperação garantida",
      "Sem monitoramento 24h de servidores e rede",
      "Suporte técnico que não entende a criticidade do ambiente",
    ]}
    solutions={[
      "Servidores de alta disponibilidade com redundância para operação contínua",
      "Firewall corporativo com políticas avançadas contra ameaças sofisticadas",
      "Backup seguro com criptografia e recuperação garantida",
      "Monitoramento 24h de servidores e rede com alertas em tempo real",
      "Equipe especializada em ambientes de infraestrutura crítica",
    ]}
    benefits={[
      { icon: Server, title: "Alta disponibilidade", text: "Servidores com redundância para operação que não pode parar. Nunca." },
      { icon: Shield, title: "Segurança avançada", text: "Firewall e políticas contra ameaças sofisticadas. Proteção proporcional ao risco." },
      { icon: HardDrive, title: "Backup seguro", text: "Dados operacionais protegidos com criptografia e recuperação garantida." },
      { icon: Activity, title: "Monitoramento 24h", text: "Servidores e rede monitorados o tempo todo. Alerta antes, ação antes." },
      { icon: Lock, title: "Dados protegidos", text: "Criptografia e controle de acesso para informações sensíveis do setor." },
      { icon: Headphones, title: "Equipe especializada", text: "Profissionais que entendem a criticidade e agem com a urgência necessária." },
    ]}
    faq={[
      { question: "A WMTi atende indústrias petrolíferas?", answer: "Sim. Implementamos infraestrutura com a robustez que operações críticas exigem. Sem improviso." },
      { question: "Vocês oferecem monitoramento 24 horas?", answer: "Sim. Monitoramento contínuo com alertas em tempo real. Operação crítica exige vigilância constante." },
      { question: "Como funciona a segurança de rede?", answer: "Firewall corporativo com políticas avançadas, segmentação de rede e controle de acesso. Proteção proporcional ao risco." },
      { question: "Atendem em todo o Brasil?", answer: "Sim. Suporte remoto contínuo e visitas técnicas programadas em qualquer localidade." },
    ]}
    relatedLinks={[
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
    ]}
    localContent="Solicite uma análise da infraestrutura tecnológica da sua empresa. Atendemos em Jacareí, Vale do Paraíba e em todo o Brasil."
  />
);

export default TiIndustriasPetroliferasPage;

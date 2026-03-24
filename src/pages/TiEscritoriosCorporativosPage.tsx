import { Server, HardDrive, Shield, Activity, Headphones, Network } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/empresas-corporativas.webp";

const TiEscritoriosCorporativosPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Empresas Corporativas"
    metaTitle="Infraestrutura de TI para Empresas Corporativas | Servidores e Redes | WMTi"
    metaDescription="Soluções completas de infraestrutura de TI para empresas corporativas. Servidores Dell, redes corporativas, backup, firewall, monitoramento e suporte técnico."
    tag="TI para Empresas Corporativas"
    headline={<>A TI da sua empresa está segurando o crescimento — e <span className="text-primary">o problema não é falta de gente</span></>}
    description="Mais funcionários. Mais demanda. Mais sistemas. E a mesma TI de dois anos atrás. Servidor lento. Rede instável. Backup que ninguém confia. Suporte que só aparece quando já deu problema. A empresa cresce, mas a infraestrutura não acompanha. E o resultado é previsível: lentidão, retrabalho, paradas e frustração. O problema não é falta de investimento — é falta de estrutura. A WMTi monta a TI que sua empresa precisa para crescer sem travar."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura de TI da minha empresa."
    heroImage={heroImg}
    heroImageAlt="Data center corporativo com racks de servidores e infraestrutura de TI"
    painPoints={[
      "Servidores instáveis que comprometem a operação diária",
      "Rede corporativa lenta e sem segmentação — tudo misturado",
      "Backup que ninguém sabe se está funcionando de verdade",
      "Sem firewall — rede exposta a qualquer ameaça",
      "Nenhum monitoramento — problemas descobertos pelo usuário final",
      "Suporte reativo que só aparece depois que já deu problema",
    ]}
    solutions={[
      "Servidores Dell PowerEdge dimensionados para sua operação real",
      "Rede segmentada com switches gerenciáveis e VLANs",
      "Backup automatizado com replicação e testes periódicos",
      "Firewall corporativo com IDS/IPS e políticas de segurança",
      "Monitoramento 24/7 de servidores, rede e dispositivos críticos",
      "Suporte técnico com SLA definido — resposta rápida e previsível",
    ]}
    benefits={[
      { icon: Server, title: "Servidores de verdade", text: "Dell PowerEdge com virtualização e alta disponibilidade. Servidor profissional, não PC adaptado." },
      { icon: Network, title: "Rede profissional", text: "Switches gerenciáveis e VLANs. Rede que funciona e escala com sua empresa." },
      { icon: HardDrive, title: "Backup que funciona", text: "Automatizado, replicado e testado. Não é HD externo no armário." },
      { icon: Shield, title: "Segurança real", text: "Firewall com IDS/IPS e políticas. Proteção de verdade, não apenas antivírus." },
      { icon: Activity, title: "Monitoramento 24/7", text: "Problemas identificados antes de virarem parada. Proativo, não reativo." },
      { icon: Headphones, title: "Suporte com SLA", text: "Tempo de resposta definido por contrato. Previsível, não na base da sorte." },
    ]}
    faq={[
      { question: "A WMTi atende empresas corporativas?", answer: "Sim. Médio e grande porte, qualquer segmento. Se sua empresa precisa de TI que funcione de verdade, a gente resolve." },
      { question: "Vocês fazem projeto de redes corporativas?", answer: "Sim. Projeto completo com switches gerenciáveis, VLANs, cabeamento estruturado e documentação. Rede profissional." },
      { question: "Qual o tempo de resposta do suporte?", answer: "SLA definido por contrato. Tempos adequados à criticidade do seu ambiente. Previsível." },
      { question: "Atendem fora da região de Jacareí?", answer: "Sim. São Paulo inteiro e projetos em todo o Brasil." },
    ]}
    relatedLinks={[
      { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
    ]}
    localContent="Solicite uma análise da infraestrutura de TI da sua empresa. Atendemos em Jacareí, Vale do Paraíba e em todo o Brasil."
  />
);

export default TiEscritoriosCorporativosPage;

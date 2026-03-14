import {
  Server, Shield, Cloud, Network, Monitor, Wrench, Headphones,
  Lock, Activity, Eye, Cpu, HardDrive,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SeoPageData } from "@/data/seoPages";
import { services } from "./services";
import { cities } from "./cities";

/** Icon map per service slug */
const serviceIcons: Record<string, { icon: LucideIcon; title: string; text: string }[]> = {
  "infraestrutura-ti": [
    { icon: Server, title: "Servidores corporativos", text: "Servidores Dell PowerEdge com redundância, RAID e virtualização." },
    { icon: Network, title: "Redes estruturadas", text: "Cabeamento, switches gerenciáveis e Wi-Fi empresarial." },
    { icon: Shield, title: "Segurança digital", text: "Firewall pfSense, antivírus corporativo e monitoramento." },
    { icon: Cloud, title: "Nuvem corporativa", text: "Microsoft 365, backup em nuvem e armazenamento seguro." },
    { icon: Monitor, title: "Estações de trabalho", text: "Computadores Dell OptiPlex com suporte e manutenção." },
    { icon: Headphones, title: "Suporte especializado", text: "Atendimento remoto e presencial com SLA garantido." },
  ],
  "suporte-ti": [
    { icon: Headphones, title: "Suporte remoto e presencial", text: "Atendimento rápido com SLA garantido por contrato." },
    { icon: Activity, title: "Monitoramento proativo", text: "Identificação e resolução de problemas antes que afetem a operação." },
    { icon: Wrench, title: "Manutenção preventiva", text: "Atualizações, limpeza e otimização periódica de sistemas." },
    { icon: Server, title: "Gestão de servidores", text: "Administração completa de servidores e ambientes virtualizados." },
    { icon: Shield, title: "Segurança contínua", text: "Antivírus, firewall e políticas de segurança sempre atualizados." },
    { icon: Monitor, title: "Gestão de estações", text: "Controle de parque tecnológico e inventário de equipamentos." },
  ],
  "monitoramento-rede": [
    { icon: Eye, title: "Monitoramento 24/7", text: "NOC próprio monitorando a rede da sua empresa em tempo real." },
    { icon: Activity, title: "Alertas em tempo real", text: "Notificações instantâneas sobre falhas e degradação de serviços." },
    { icon: Network, title: "Análise de tráfego", text: "Relatórios de uso, gargalos e planejamento de capacidade." },
    { icon: Shield, title: "Detecção de ameaças", text: "Identificação de acessos suspeitos e tentativas de invasão." },
    { icon: Server, title: "Disponibilidade garantida", text: "Uptime monitorado com metas de SLA documentadas." },
    { icon: Headphones, title: "Suporte técnico", text: "Equipe especializada para resolução rápida de incidentes." },
  ],
  "servidores-dell": [
    { icon: Server, title: "Dell PowerEdge", text: "Servidores corporativos dimensionados para cada necessidade." },
    { icon: HardDrive, title: "RAID e redundância", text: "Configuração de discos com tolerância a falhas e alta disponibilidade." },
    { icon: Cpu, title: "Virtualização", text: "Hyper-V e VMware para consolidação de servidores e eficiência." },
    { icon: Shield, title: "Backup corporativo", text: "Políticas de backup automatizado com recuperação garantida." },
    { icon: Activity, title: "Monitoramento de hardware", text: "Alertas proativos sobre temperatura, discos e memória." },
    { icon: Wrench, title: "Manutenção preventiva", text: "Atualizações de firmware, drivers e sistema operacional." },
  ],
  "microsoft-365": [
    { icon: Cloud, title: "Exchange Online", text: "E-mail corporativo profissional com domínio próprio." },
    { icon: Monitor, title: "Microsoft Teams", text: "Comunicação e colaboração integrada para equipes." },
    { icon: HardDrive, title: "OneDrive e SharePoint", text: "Armazenamento em nuvem seguro e compartilhamento de arquivos." },
    { icon: Shield, title: "Segurança Microsoft", text: "Autenticação multifator, políticas de acesso e compliance." },
    { icon: Wrench, title: "Migração completa", text: "Migração de e-mails e dados sem interrupção dos serviços." },
    { icon: Headphones, title: "Gestão contínua", text: "Administração de licenças, usuários e políticas de segurança." },
  ],
  "seguranca-rede": [
    { icon: Shield, title: "Firewall pfSense", text: "Proteção perimetral avançada com regras personalizadas." },
    { icon: Lock, title: "VPN corporativa", text: "Acesso remoto seguro para colaboradores e filiais." },
    { icon: Eye, title: "Monitoramento de ameaças", text: "Detecção e resposta a tentativas de invasão em tempo real." },
    { icon: Server, title: "Antivírus corporativo", text: "ESET Endpoint Security com console de gerenciamento." },
    { icon: Network, title: "Controle de acesso", text: "Políticas de rede segmentadas por perfil de usuário." },
    { icon: Activity, title: "Auditoria de segurança", text: "Análise periódica de vulnerabilidades e relatórios de compliance." },
  ],
  "locacao-computadores": [
    { icon: Monitor, title: "Dell OptiPlex", text: "Estações de trabalho profissionais de alto desempenho." },
    { icon: Wrench, title: "Manutenção inclusa", text: "Suporte técnico e manutenção preventiva sem custo adicional." },
    { icon: Activity, title: "Substituição rápida", text: "Troca de equipamento em caso de falha com SLA garantido." },
    { icon: Shield, title: "Segurança padronizada", text: "Configuração padrão com antivírus e políticas de segurança." },
    { icon: Cloud, title: "Microsoft 365 integrado", text: "Estações pré-configuradas com ambiente Microsoft completo." },
    { icon: Headphones, title: "Suporte dedicado", text: "Atendimento prioritário para equipamentos em locação." },
  ],
};

const defaultPainPoints = [
  "Rede lenta ou instável prejudicando a operação",
  "Servidor antigo ou mal configurado",
  "Sistemas travando constantemente",
  "Falta de segurança contra ataques cibernéticos",
  "Falta de suporte técnico confiável",
  "Equipamentos inadequados para a demanda",
];

const defaultSolutions = [
  "Infraestrutura de TI corporativa planejada e gerenciada",
  "Servidores Dell PowerEdge com alta disponibilidade",
  "Redes empresariais estruturadas e seguras",
  "Firewall pfSense com proteção avançada",
  "Microsoft 365 com gestão completa",
  "Suporte técnico especializado com SLA",
];

function fill(template: string, city: string): string {
  return template.replace(/\{city\}/g, city);
}

export function generateProgrammaticPages(): SeoPageData[] {
  const pages: SeoPageData[] = [];

  for (const service of services) {
    for (const city of cities) {
      const slug = `${service.slug}-${city.slug}`;

      const relatedLinks = service.relatedSlugs.map((rs) => {
        const rel = services.find((s) => s.slug === rs);
        return {
          label: rel?.name ?? rs,
          href: `/${rs}-${city.slug}`,
        };
      });

      // Add city-only page link
      relatedLinks.push({
        label: `Empresa de TI em ${city.name}`,
        href: `/empresa-ti-${city.slug}`,
      });

      pages.push({
        slug,
        metaTitle: fill(service.titleTemplate, city.name),
        metaDescription: fill(service.descriptionTemplate, city.name),
        tag: `${service.name} em ${city.name}`,
        headline: `${service.h1Prefix}`,
        headlineHighlight: `${city.name}`,
        description: fill(service.contentTemplate, city.name),
        whatsappMessage: `Olá! Gostaria de saber mais sobre ${service.name} para minha empresa em ${city.name}.`,
        category: "local-service",
        painPoints: defaultPainPoints,
        solutions: defaultSolutions,
        benefits: serviceIcons[service.slug] ?? serviceIcons["infraestrutura-ti"],
        faq: [
          {
            question: `A WMTi oferece ${service.name.toLowerCase()} em ${city.name}?`,
            answer: `Sim. A WMTi atende empresas em ${city.name} e região com soluções profissionais de ${service.name.toLowerCase()}, suporte técnico e infraestrutura corporativa.`,
          },
          {
            question: `Quanto custa ${service.name.toLowerCase()} para empresas?`,
            answer: `O investimento depende do porte e das necessidades da empresa. Entre em contato para um diagnóstico gratuito e uma proposta personalizada.`,
          },
          {
            question: `A WMTi atende pequenas empresas em ${city.name}?`,
            answer: `Sim. Atendemos empresas de todos os portes em ${city.name}, com planos escaláveis e personalizados.`,
          },
          {
            question: "Como solicitar um orçamento?",
            answer: "Entre em contato pelo WhatsApp ou formulário do site para agendar um diagnóstico gratuito da infraestrutura de TI da sua empresa.",
          },
        ],
        relatedLinks,
        localContent: `A WMTi Tecnologia da Informação atende empresas em ${city.name} (${city.state}) com soluções especializadas de ${service.name.toLowerCase()}. Com sede em Jacareí/SP e mais de 15 anos de experiência, oferecemos atendimento presencial e remoto para garantir que sua empresa opere com segurança, desempenho e confiabilidade.`,
      });
    }
  }

  return pages;
}

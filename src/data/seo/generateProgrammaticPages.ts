import {
  Server, Shield, Cloud, Network, Monitor, Wrench, Headphones,
  Lock, Activity, Eye, Cpu, HardDrive,
  Building2, Scale, Heart, Stethoscope, Landmark, Briefcase,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SeoPageData } from "@/data/seoPages";
import { services } from "./services";
import { cities } from "./cities";
import { segments } from "./segments";
import { intents } from "./intents";
import { problems } from "./problems";

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

/** Segment-specific icons */
const segmentIcons: Record<string, { icon: LucideIcon; title: string; text: string }[]> = {
  cartorios: [
    { icon: Landmark, title: "Conformidade CNJ", text: "Infraestrutura em conformidade com o Provimento 213 do CNJ." },
    { icon: Shield, title: "Segurança de dados", text: "Proteção de dados cartorários com backup criptografado." },
    { icon: Server, title: "Servidores dedicados", text: "Servidores dimensionados para sistemas cartorários." },
  ],
  hospitais: [
    { icon: Heart, title: "Alta disponibilidade", text: "Infraestrutura 24/7 para ambientes críticos de saúde." },
    { icon: Stethoscope, title: "Sistemas HIS/PACS", text: "Integração e suporte para sistemas médicos." },
    { icon: Lock, title: "LGPD Saúde", text: "Conformidade com LGPD para dados de pacientes." },
  ],
  "escritorios-advocacia": [
    { icon: Scale, title: "Sigilo profissional", text: "Infraestrutura segura para proteção de dados de clientes." },
    { icon: Lock, title: "VPN e criptografia", text: "Acesso remoto seguro para advogados." },
    { icon: Shield, title: "Backup jurídico", text: "Backup criptografado de processos e documentos." },
  ],
  contabilidade: [
    { icon: Briefcase, title: "Dados fiscais seguros", text: "Proteção e backup automatizado de dados contábeis." },
    { icon: Server, title: "Performance", text: "Servidores otimizados para sistemas de contabilidade." },
    { icon: Shield, title: "Conformidade fiscal", text: "Infraestrutura alinhada com exigências fiscais." },
  ],
  industrias: [
    { icon: Building2, title: "TI industrial", text: "Redes segmentadas e servidores de alta performance para fábricas." },
    { icon: Activity, title: "Monitoramento 24/7", text: "NOC dedicado para monitoramento da infraestrutura industrial." },
    { icon: Network, title: "Integração ERP", text: "Rede otimizada para sistemas de gestão industrial." },
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

function fill(template: string, replacements: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

export function generateProgrammaticPages(): SeoPageData[] {
  const pages: SeoPageData[] = [];
  const usedSlugs = new Set<string>();

  function addPage(page: SeoPageData) {
    if (!usedSlugs.has(page.slug)) {
      usedSlugs.add(page.slug);
      pages.push(page);
    }
  }

  // ─── 1. Service × City ───
  for (const service of services) {
    for (const city of cities) {
      const slug = `${service.slug}-${city.slug}`;
      const r = { city: city.name, service: service.name };

      const relatedLinks = service.relatedSlugs.map((rs) => {
        const rel = services.find((s) => s.slug === rs);
        return { label: rel?.name ?? rs, href: `/${rs}-${city.slug}` };
      });
      relatedLinks.push({ label: `Empresa de TI em ${city.name}`, href: `/empresa-ti-${city.slug}` });

      addPage({
        slug,
        metaTitle: fill(service.titleTemplate, r),
        metaDescription: fill(service.descriptionTemplate, r),
        tag: `${service.name} em ${city.name}`,
        headline: `${service.h1Prefix}`,
        headlineHighlight: city.name,
        description: fill(service.contentTemplate, r),
        whatsappMessage: `Olá! Gostaria de saber mais sobre ${service.name} para minha empresa em ${city.name}.`,
        category: "local-service",
        painPoints: defaultPainPoints,
        solutions: defaultSolutions,
        benefits: serviceIcons[service.slug] ?? serviceIcons["infraestrutura-ti"],
        faq: [
          { question: `A WMTi oferece ${service.name.toLowerCase()} em ${city.name}?`, answer: `Sim. A WMTi atende empresas em ${city.name} e região com soluções profissionais de ${service.name.toLowerCase()}, suporte técnico e infraestrutura corporativa.` },
          { question: `Quanto custa ${service.name.toLowerCase()} para empresas?`, answer: `O investimento depende do porte e das necessidades da empresa. Entre em contato para um diagnóstico gratuito e uma proposta personalizada.` },
          { question: `A WMTi atende pequenas empresas em ${city.name}?`, answer: `Sim. Atendemos empresas de todos os portes em ${city.name}, com planos escaláveis e personalizados.` },
          { question: "Como solicitar um orçamento?", answer: "Entre em contato pelo WhatsApp ou formulário do site para agendar um diagnóstico gratuito da infraestrutura de TI da sua empresa." },
        ],
        relatedLinks,
        localContent: `A WMTi Tecnologia da Informação atende empresas em ${city.name} (${city.state}) com soluções especializadas de ${service.name.toLowerCase()}. Com sede em Jacareí/SP e mais de 15 anos de experiência, oferecemos atendimento presencial e remoto para garantir que sua empresa opere com segurança, desempenho e confiabilidade.`,
        shouldIndex: true,
        priority: 0.7,
      });
    }
  }

  // ─── 2. Service × City × Segment ───
  for (const service of services) {
    for (const city of cities) {
      for (const segment of segments) {
        const slug = `${service.slug}-${segment.slug}-${city.slug}`;

        const baseBenefits = serviceIcons[service.slug] ?? serviceIcons["infraestrutura-ti"];
        const segBenefits = segmentIcons[segment.slug] ?? [];
        const benefits = [...segBenefits, ...baseBenefits.slice(0, 3)];

        const relatedLinks = [
          { label: `${service.name} em ${city.name}`, href: `/${service.slug}-${city.slug}` },
          { label: `Empresa de TI em ${city.name}`, href: `/empresa-ti-${city.slug}` },
          ...service.relatedSlugs.slice(0, 2).map((rs) => ({
            label: services.find((s) => s.slug === rs)?.name ?? rs,
            href: `/${rs}-${city.slug}`,
          })),
        ];

        addPage({
          slug,
          metaTitle: `${service.name} ${segment.titleSuffix} em ${city.name} | WMTi`,
          metaDescription: `${service.name} ${segment.titleSuffix.toLowerCase()} em ${city.name}. ${segment.descriptionExtra.slice(0, 100)}. WMTi Tecnologia.`,
          tag: `${service.name} ${segment.titleSuffix}`,
          headline: `${service.name} ${segment.titleSuffix} em `,
          headlineHighlight: city.name,
          description: `A WMTi oferece ${service.name.toLowerCase()} especializada ${segment.titleSuffix.toLowerCase()} em ${city.name}. ${segment.descriptionExtra}`,
          whatsappMessage: `Olá! Gostaria de saber mais sobre ${service.name} ${segment.titleSuffix.toLowerCase()} em ${city.name}.`,
          category: "segment",
          painPoints: [...segment.painPoints, ...defaultPainPoints.slice(0, 3)],
          solutions: defaultSolutions,
          benefits,
          faq: [
            segment.faqExtra,
            { question: `Qual o custo de ${service.name.toLowerCase()} ${segment.titleSuffix.toLowerCase()}?`, answer: "O investimento depende do porte e necessidades. Entre em contato para um diagnóstico gratuito." },
            { question: `A WMTi atende ${segment.name.toLowerCase()} em ${city.name}?`, answer: `Sim. Atendemos ${segment.name.toLowerCase()} em ${city.name} e região com soluções especializadas.` },
          ],
          relatedLinks,
          localContent: `A WMTi atende ${segment.name.toLowerCase()} em ${city.name} (${city.state}) com soluções de ${service.name.toLowerCase()}. Mais de 15 anos de experiência em tecnologia da informação.`,
          shouldIndex: true,
          priority: 0.6,
          canonicalSlug: `${service.slug}-${city.slug}`,
        });
      }
    }
  }

  // ─── 3. Service × City × Intent ───
  for (const service of services) {
    for (const city of cities) {
      for (const intent of intents) {
        const slug = `${intent.slug}-${service.slug}-${city.slug}`;

        const relatedLinks = [
          { label: `${service.name} em ${city.name}`, href: `/${service.slug}-${city.slug}` },
          { label: `Empresa de TI em ${city.name}`, href: `/empresa-ti-${city.slug}` },
        ];

        addPage({
          slug,
          metaTitle: `${intent.name} de ${service.name} em ${city.name} | WMTi`,
          metaDescription: `${intent.name} de ${service.name.toLowerCase()} para empresas em ${city.name}. ${intent.descriptionExtra.slice(0, 80)}. WMTi.`,
          tag: `${intent.name} — ${service.name}`,
          headline: fill(intent.h1Template, { service: service.name.toLowerCase(), city: city.name }),
          headlineHighlight: city.name,
          description: `${intent.descriptionExtra} A WMTi oferece ${service.name.toLowerCase()} para empresas em ${city.name} com mais de 15 anos de experiência.`,
          whatsappMessage: `Olá! Gostaria de um ${intent.name.toLowerCase()} de ${service.name.toLowerCase()} em ${city.name}.`,
          category: "intent",
          painPoints: defaultPainPoints.slice(0, 4),
          solutions: defaultSolutions.slice(0, 4),
          benefits: serviceIcons[service.slug]?.slice(0, 4) ?? serviceIcons["infraestrutura-ti"].slice(0, 4),
          faq: [
            { question: `Como solicitar ${intent.name.toLowerCase()} de ${service.name.toLowerCase()} em ${city.name}?`, answer: "Entre em contato pelo WhatsApp ou formulário do site. Realizamos um diagnóstico gratuito e apresentamos uma proposta personalizada." },
            { question: `A WMTi oferece ${intent.name.toLowerCase()} gratuito?`, answer: "Sim. O diagnóstico inicial e a proposta são gratuitos e sem compromisso." },
          ],
          relatedLinks,
          localContent: `Solicite ${intent.name.toLowerCase()} de ${service.name.toLowerCase()} para sua empresa em ${city.name}. Atendimento presencial e remoto com SLA garantido.`,
          shouldIndex: true,
          priority: 0.5,
          canonicalSlug: `${service.slug}-${city.slug}`,
        });
      }
    }
  }

  // ─── 4. Problem × City ───
  for (const problem of problems) {
    for (const city of cities) {
      const slug = `${problem.slug}-${city.slug}`;

      const relatedLinks = [
        { label: `Empresa de TI em ${city.name}`, href: `/empresa-ti-${city.slug}` },
        { label: "Infraestrutura de TI", href: `/infraestrutura-ti-${city.slug}` },
        { label: "Suporte de TI", href: `/suporte-ti-${city.slug}` },
        { label: "Segurança de Rede", href: `/seguranca-rede-${city.slug}` },
      ];

      addPage({
        slug,
        metaTitle: `${problem.name} — Soluções de TI em ${city.name} | WMTi`,
        metaDescription: `${problem.description.slice(0, 130)}. Soluções profissionais em ${city.name}. WMTi.`,
        tag: problem.name,
        headline: fill(problem.h1Template, { city: city.name }),
        headlineHighlight: "",
        description: `${problem.description}\n\n${problem.solutionIntro}`,
        whatsappMessage: `Olá! Minha empresa em ${city.name} está com problema de ${problem.name.toLowerCase()}. Podem ajudar?`,
        category: "problem-page",
        painPoints: problem.painPoints,
        solutions: defaultSolutions.slice(0, 4),
        benefits: serviceIcons["infraestrutura-ti"].slice(0, 4),
        faq: [
          { question: `Como resolver ${problem.name.toLowerCase()} na minha empresa em ${city.name}?`, answer: problem.solutionIntro },
          { question: "A WMTi faz diagnóstico gratuito?", answer: "Sim. Entre em contato para agendar um diagnóstico gratuito da infraestrutura de TI." },
        ],
        relatedLinks,
        localContent: `Se sua empresa em ${city.name} enfrenta ${problem.name.toLowerCase()}, a WMTi pode ajudar. Atendemos ${city.name} e região com soluções profissionais de TI.`,
        shouldIndex: true,
        priority: 0.5,
      });
    }
  }

  return pages;
}

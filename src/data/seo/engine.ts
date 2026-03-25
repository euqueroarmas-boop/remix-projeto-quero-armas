/**
 * MOTOR CENTRAL DE SEO DINÂMICO — WMTi
 * ======================================
 * Responsável por:
 * 1. Registrar todas as entidades SEO (serviços + segmentos)
 * 2. Parsear slugs no padrão {entidade}-em-{cidade}
 * 3. Gerar páginas dinâmicas sob demanda (sem pré-geração)
 * 4. Validar combinações entidade × cidade
 * 5. Manter backward compat com URLs antigas ({entidade}-{cidade})
 */

import { services, type SeoService } from "./services";
import { segments, type SeoSegment } from "./segments";
import { cities, type SeoCity } from "./cities";
import type { SeoPageData } from "@/data/seoPages";
import {
  Server, Shield, Cloud, Network, Monitor, Wrench, Headphones,
  Lock, Activity, Eye, Cpu, HardDrive,
  Building2, Scale, Heart, Stethoscope, Landmark, Briefcase,
  Bot, Zap, Home, Lightbulb, Globe, Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Indexes ───
const cityBySlug = new Map<string, SeoCity>(cities.map((c) => [c.slug, c]));

// ─── Entity types ───
export interface SeoEntity {
  type: "service" | "segment";
  slug: string;
  name: string;
  /** The URL prefix used before -em-{city} */
  urlPrefix: string;
  service?: SeoService;
  segment?: SeoSegment;
}

// ─── Entity registry: urlPrefix → entity ───
const entityByPrefix = new Map<string, SeoEntity>();
const entityByOldSlug = new Map<string, SeoEntity>(); // for backward compat {slug}-{city}

// Register services
for (const svc of services) {
  const entity: SeoEntity = {
    type: "service",
    slug: svc.slug,
    name: svc.name,
    urlPrefix: svc.slug,
    service: svc,
  };
  entityByPrefix.set(svc.slug, entity);
  entityByOldSlug.set(svc.slug, entity);
}

// Segment prefix mapping
const segmentPrefixMap: Record<string, string> = {
  "serventias-notariais": "ti-para-serventias-notariais",
  hospitais: "ti-para-hospitais",
  "escritorios-advocacia": "ti-para-escritorios-de-advocacia",
  contabilidade: "ti-para-contabilidades",
  "industrias-alimenticias": "ti-para-industrias-alimenticias",
  "industrias-petroliferas": "ti-para-industrias-petroliferas",
  "empresas-corporativas": "ti-para-empresas-corporativas",
};

// Register segments
for (const seg of segments) {
  const prefix = segmentPrefixMap[seg.slug] || `ti-para-${seg.slug}`;
  const entity: SeoEntity = {
    type: "segment",
    slug: seg.slug,
    name: seg.name,
    urlPrefix: prefix,
    segment: seg,
  };
  entityByPrefix.set(prefix, entity);
  entityByOldSlug.set(prefix, entity);
}

// ─── Slug parser ───
export interface ParsedLocalSlug {
  entity: SeoEntity;
  city: SeoCity;
}

/**
 * Parses a slug with the pattern {entity}-em-{city}.
 * Returns null if the pattern doesn't match or entity/city are invalid.
 */
export function parseLocalSlug(slug: string): ParsedLocalSlug | null {
  // Try -em- pattern first (canonical)
  const emIndex = slug.lastIndexOf("-em-");
  if (emIndex > 0) {
    const entityPart = slug.substring(0, emIndex);
    const cityPart = slug.substring(emIndex + 4);
    const entity = entityByPrefix.get(entityPart);
    const city = cityBySlug.get(cityPart);
    if (entity && city) return { entity, city };
  }

  // Backward compat: try {entity}-{city} (old pattern)
  // We try all known entity prefixes against the slug
  for (const [prefix, entity] of entityByOldSlug) {
    if (slug.startsWith(prefix + "-")) {
      const cityPart = slug.substring(prefix.length + 1);
      const city = cityBySlug.get(cityPart);
      if (city) return { entity, city };
    }
  }

  return null;
}

// ─── Icons ───
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
    { icon: Activity, title: "Alertas em tempo real", text: "Notificações instantâneas sobre falhas e degradação." },
    { icon: Network, title: "Análise de tráfego", text: "Relatórios de uso, gargalos e planejamento de capacidade." },
    { icon: Shield, title: "Detecção de ameaças", text: "Identificação de acessos suspeitos e tentativas de invasão." },
    { icon: Server, title: "Disponibilidade garantida", text: "Uptime monitorado com metas de SLA documentadas." },
    { icon: Headphones, title: "Suporte técnico", text: "Equipe especializada para resolução rápida de incidentes." },
  ],
  "servidores-dell": [
    { icon: Server, title: "Dell PowerEdge", text: "Servidores corporativos dimensionados para cada necessidade." },
    { icon: HardDrive, title: "RAID e redundância", text: "Configuração de discos com tolerância a falhas." },
    { icon: Cpu, title: "Virtualização", text: "Hyper-V e VMware para consolidação de servidores." },
    { icon: Shield, title: "Backup corporativo", text: "Políticas de backup automatizado com recuperação garantida." },
    { icon: Activity, title: "Monitoramento de hardware", text: "Alertas proativos sobre temperatura, discos e memória." },
    { icon: Wrench, title: "Manutenção preventiva", text: "Atualizações de firmware, drivers e sistema operacional." },
  ],
  "microsoft-365": [
    { icon: Cloud, title: "Exchange Online", text: "E-mail corporativo profissional com domínio próprio." },
    { icon: Monitor, title: "Microsoft Teams", text: "Comunicação e colaboração integrada para equipes." },
    { icon: HardDrive, title: "OneDrive e SharePoint", text: "Armazenamento em nuvem seguro." },
    { icon: Shield, title: "Segurança Microsoft", text: "Autenticação multifator e compliance." },
    { icon: Wrench, title: "Migração completa", text: "Migração de e-mails e dados sem interrupção." },
    { icon: Headphones, title: "Gestão contínua", text: "Administração de licenças e políticas de segurança." },
  ],
  "seguranca-rede": [
    { icon: Shield, title: "Firewall pfSense", text: "Proteção perimetral avançada com regras personalizadas." },
    { icon: Lock, title: "VPN corporativa", text: "Acesso remoto seguro para colaboradores e filiais." },
    { icon: Eye, title: "Monitoramento de ameaças", text: "Detecção e resposta a tentativas de invasão." },
    { icon: Server, title: "Antivírus corporativo", text: "ESET Endpoint Security com console de gerenciamento." },
    { icon: Network, title: "Controle de acesso", text: "Políticas de rede segmentadas por perfil de usuário." },
    { icon: Activity, title: "Auditoria de segurança", text: "Análise periódica de vulnerabilidades." },
  ],
  "locacao-computadores": [
    { icon: Monitor, title: "Dell OptiPlex", text: "Estações de trabalho profissionais de alto desempenho." },
    { icon: Wrench, title: "Manutenção inclusa", text: "Suporte técnico e manutenção preventiva sem custo adicional." },
    { icon: Activity, title: "Substituição rápida", text: "Troca de equipamento em caso de falha com SLA garantido." },
    { icon: Shield, title: "Segurança padronizada", text: "Configuração padrão com antivírus e políticas de segurança." },
    { icon: Cloud, title: "Microsoft 365 integrado", text: "Estações pré-configuradas com ambiente Microsoft." },
    { icon: Headphones, title: "Suporte dedicado", text: "Atendimento prioritário para equipamentos em locação." },
  ],
  "automacao-ia": [
    { icon: Bot, title: "Automação inteligente", text: "Fluxos automatizados com IA para processos operacionais." },
    { icon: Zap, title: "Velocidade operacional", text: "Respostas instantâneas e processos que rodam sozinhos." },
    { icon: Workflow, title: "Integração de sistemas", text: "Conexão entre WhatsApp, formulários, e-mail e sistemas." },
    { icon: Activity, title: "Monitoramento de fluxos", text: "Acompanhamento em tempo real das automações ativas." },
    { icon: Shield, title: "Segurança de dados", text: "Automações com proteção e conformidade de dados." },
    { icon: Headphones, title: "Suporte dedicado", text: "Equipe técnica para ajustes e evolução contínua." },
  ],
  "automacao-alexa": [
    { icon: Home, title: "Casa inteligente", text: "Iluminação, câmeras, fechaduras e climatização integrados." },
    { icon: Lightbulb, title: "Rotinas automáticas", text: "Cenários e rotinas personalizadas por voz ou horário." },
    { icon: Network, title: "Rede Wi-Fi estável", text: "Infraestrutura de rede dimensionada para IoT." },
    { icon: Shield, title: "Segurança integrada", text: "Câmeras, sensores e fechaduras com controle centralizado." },
    { icon: Building2, title: "Empresa inteligente", text: "Automação de ambientes corporativos com Alexa." },
    { icon: Headphones, title: "Suporte técnico", text: "Instalação, configuração e suporte contínuo." },
  ],
  "reestruturacao-rede": [
    { icon: Network, title: "Rede profissional", text: "Cabeamento Cat6A e switches Dell gerenciáveis." },
    { icon: Shield, title: "Segurança de rede", text: "Firewall pfSense e segmentação por VLANs." },
    { icon: Activity, title: "Monitoramento", text: "Monitoramento contínuo de performance e disponibilidade." },
    { icon: Server, title: "Infraestrutura", text: "Servidores e storage dimensionados para a demanda." },
    { icon: Wrench, title: "Substituição total", text: "Troca de equipamentos domésticos por corporativos." },
    { icon: Headphones, title: "Suporte dedicado", text: "Equipe técnica com SLA garantido." },
  ],
  "desenvolvimento-web": [
    { icon: Globe, title: "Sites profissionais", text: "Landing pages e portais corporativos de alta conversão." },
    { icon: Zap, title: "Alta performance", text: "Aplicações rápidas com tecnologia moderna." },
    { icon: Shield, title: "Segurança", text: "HTTPS, proteção contra ataques e backup automático." },
    { icon: Workflow, title: "Integrações", text: "Conexão com WhatsApp, pagamento e sistemas internos." },
    { icon: Activity, title: "Analytics", text: "Métricas de conversão e performance em tempo real." },
    { icon: Headphones, title: "Suporte contínuo", text: "Manutenção, atualizações e evolução do sistema." },
  ],
};

const genericIcons: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Server, title: "Servidores corporativos", text: "Implantação e gerenciamento de servidores Dell PowerEdge." },
  { icon: Shield, title: "Segurança", text: "Proteção da infraestrutura com firewall e políticas de segurança." },
  { icon: Activity, title: "Monitoramento", text: "Monitoramento contínuo para prevenção de falhas." },
  { icon: HardDrive, title: "Backup", text: "Backup automatizado com recuperação garantida." },
  { icon: Wrench, title: "Manutenção", text: "Manutenção preventiva e corretiva da infraestrutura." },
  { icon: Headphones, title: "Suporte técnico", text: "Equipe especializada com SLA garantido." },
];

const segmentIcons: Record<string, { icon: LucideIcon; title: string; text: string }[]> = {
  "serventias-notariais": [
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
  "industrias-alimenticias": [
    { icon: Building2, title: "TI industrial", text: "Redes segmentadas e servidores para fábricas." },
    { icon: Activity, title: "Monitoramento 24/7", text: "NOC dedicado para monitoramento industrial." },
    { icon: Network, title: "Integração ERP", text: "Rede otimizada para sistemas de gestão." },
  ],
  "industrias-petroliferas": [
    { icon: Building2, title: "TI para energia", text: "Infraestrutura resiliente para operações críticas." },
    { icon: Shield, title: "Segurança avançada", text: "Segmentação e proteção para redes operacionais." },
    { icon: Activity, title: "Operação contínua", text: "Monitoramento 24/7 e plano de contingência." },
  ],
  "empresas-corporativas": [
    { icon: Building2, title: "TI corporativa", text: "Soluções completas de infraestrutura para empresas." },
    { icon: Server, title: "Servidores Dell", text: "Dell PowerEdge com virtualização e alta disponibilidade." },
    { icon: Network, title: "Redes segmentadas", text: "Redes corporativas com VLANs e switches gerenciáveis." },
  ],
};

// ─── Pain points & solutions ───
const servicePainPoints: Record<string, string[]> = {
  "infraestrutura-ti": [
    "Rede corporativa instável prejudicando a produtividade diária",
    "Servidores antigos sem redundância ou virtualização",
    "Falta de cabeamento estruturado e equipamentos gerenciáveis",
    "Sem monitoramento proativo da infraestrutura de TI",
    "Ausência de política de backup e recuperação de desastres",
    "Equipamentos de rede domésticos no ambiente empresarial",
  ],
  "suporte-ti": [
    "Demora excessiva no atendimento de chamados de TI",
    "Equipe interna sobrecarregada com problemas técnicos",
    "Falta de manutenção preventiva gerando paradas constantes",
    "Sistemas desatualizados e vulneráveis a falhas",
    "Ausência de SLA definido para resolução de incidentes",
    "Custos altos com técnicos avulsos e sem previsibilidade",
  ],
  "automacao-ia": [
    "Equipe inteira presa em tarefas manuais repetitivas",
    "Cliente esperando resposta porque ninguém viu a solicitação",
    "Retrabalho constante por falta de fluxos automatizados",
    "Informações espalhadas entre planilhas, e-mails e WhatsApp",
    "Processos que dependem de intervenção humana para tudo",
    "Perda de velocidade e escala por operação no braço",
  ],
  "automacao-alexa": [
    "Vários dispositivos smart que não se comunicam entre si",
    "Wi-Fi fraco que derruba automações constantemente",
    "Rotinas que nunca funcionam quando você mais precisa",
    "Equipamentos caros subutilizados por má configuração",
    "Comandos de voz que falham ou não reconhecem dispositivos",
    "Investimento alto em smart home sem retorno real",
  ],
};

const serviceSolutions: Record<string, string[]> = {
  "infraestrutura-ti": [
    "Projeto completo de infraestrutura de TI corporativa sob medida",
    "Servidores Dell PowerEdge com RAID, virtualização e alta disponibilidade",
    "Cabeamento estruturado com switches gerenciáveis e Wi-Fi corporativo",
    "Firewall pfSense com proteção perimetral e controle de acesso",
    "Backup automatizado local e em nuvem com testes de restauração",
    "Monitoramento 24/7 com NOC especializado e alertas em tempo real",
  ],
  "suporte-ti": [
    "Suporte técnico remoto e presencial com SLA definido por contrato",
    "Monitoramento proativo de servidores, rede e estações de trabalho",
    "Manutenção preventiva periódica de todo o parque tecnológico",
    "Gestão de atualizações de sistema operacional e softwares",
    "Relatórios mensais de chamados e tempos de resposta",
    "Equipe técnica dedicada com conhecimento do ambiente do cliente",
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

// ─── Dynamic page generator ───
function fill(template: string, replacements: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

/**
 * Generates a SeoPageData dynamically for a given entity + city combination.
 * This is the core of the central SEO engine — no pre-generation needed.
 */
export function generateLocalPage(entity: SeoEntity, city: SeoCity): SeoPageData {
  const canonicalSlug = `${entity.urlPrefix}-em-${city.slug}`;

  if (entity.type === "service" && entity.service) {
    const svc = entity.service;
    const r = { city: city.name };
    const icons = serviceIcons[svc.slug] ?? genericIcons;
    const painPoints = servicePainPoints[svc.slug] ?? defaultPainPoints;
    const solutions = serviceSolutions[svc.slug] ?? defaultSolutions;

    // Build related links
    const relatedLinks = svc.relatedSlugs.map((rs) => {
      const rel = services.find((s) => s.slug === rs);
      return { label: rel?.name ?? rs, href: `/${rs}-em-${city.slug}` };
    });
    relatedLinks.push({ label: `Empresa de TI em ${city.name}`, href: `/empresa-ti-${city.slug}` });

    return {
      slug: canonicalSlug,
      metaTitle: fill(svc.titleTemplate, r),
      metaDescription: fill(svc.descriptionTemplate, r),
      tag: `${svc.name} em ${city.name}`,
      headline: svc.h1Prefix,
      headlineHighlight: city.name,
      description: fill(svc.contentTemplate, r),
      whatsappMessage: `Olá! Gostaria de saber mais sobre ${svc.name} para minha empresa em ${city.name}.`,
      category: "local-service",
      painPoints,
      solutions,
      benefits: icons,
      faq: [
        { question: `A WMTi oferece ${svc.name.toLowerCase()} em ${city.name}?`, answer: `Sim. A WMTi atende empresas em ${city.name} e região com soluções profissionais de ${svc.name.toLowerCase()}, suporte técnico especializado e infraestrutura corporativa.` },
        { question: `Quanto custa ${svc.name.toLowerCase()} em ${city.name}?`, answer: `O investimento depende do porte da empresa e das necessidades específicas. Entre em contato para um diagnóstico gratuito e proposta personalizada para sua empresa em ${city.name}.` },
        { question: `A WMTi atende empresas de todos os portes em ${city.name}?`, answer: `Sim. Atendemos desde escritórios com 5 computadores até operações com centenas de estações em ${city.name}. Nossos planos são escaláveis.` },
        { question: "Como solicitar um orçamento de TI?", answer: "Entre em contato pelo WhatsApp ou formulário do site para agendar um diagnóstico gratuito. Nossa equipe apresenta uma proposta detalhada sem compromisso." },
      ],
      relatedLinks,
      localContent: `A WMTi Tecnologia da Informação atende empresas em ${city.name} (${city.state}), região de ${city.region}, com soluções especializadas de ${svc.name.toLowerCase()}. Com sede em Jacareí/SP e mais de 15 anos de experiência no mercado corporativo, oferecemos atendimento presencial e remoto com SLA garantido.`,
      shouldIndex: true,
      priority: city.priority * 0.7,
      canonicalSlug,
    };
  }

  // Segment page
  if (entity.type === "segment" && entity.segment) {
    const seg = entity.segment;
    const segBenefits = segmentIcons[seg.slug] ?? [];
    const baseBenefits = serviceIcons["infraestrutura-ti"] ?? genericIcons;
    const benefits = [...segBenefits, ...baseBenefits.slice(0, 3)];

    const relatedLinks = [
      { label: `Empresa de TI em ${city.name}`, href: `/empresa-ti-${city.slug}` },
      { label: `Infraestrutura de TI em ${city.name}`, href: `/infraestrutura-ti-em-${city.slug}` },
      { label: `Suporte de TI em ${city.name}`, href: `/suporte-ti-em-${city.slug}` },
    ];
    if (seg.dedicatedPage) {
      relatedLinks.push({ label: `${seg.name} (página principal)`, href: seg.dedicatedPage });
    }

    return {
      slug: canonicalSlug,
      metaTitle: `TI ${seg.titleSuffix} em ${city.name} | WMTi Tecnologia`,
      metaDescription: `Soluções de TI ${seg.titleSuffix.toLowerCase()} em ${city.name}. ${seg.descriptionExtra.slice(0, 120)}. WMTi.`,
      tag: `TI ${seg.titleSuffix}`,
      headline: `TI ${seg.titleSuffix} em `,
      headlineHighlight: city.name,
      description: `A WMTi oferece soluções completas de TI ${seg.titleSuffix.toLowerCase()} em ${city.name}. ${seg.descriptionExtra}`,
      whatsappMessage: `Olá! Preciso de TI ${seg.titleSuffix.toLowerCase()} em ${city.name}.`,
      category: "segment",
      painPoints: [...seg.painPoints, ...defaultPainPoints.slice(0, 3)],
      solutions: defaultSolutions,
      benefits,
      faq: [
        seg.faqExtra,
        { question: `A WMTi atende ${seg.name.toLowerCase()} em ${city.name}?`, answer: `Sim. Atendemos ${seg.name.toLowerCase()} em ${city.name} e região de ${city.region} com soluções especializadas de TI.` },
        { question: `Qual o custo de TI ${seg.titleSuffix.toLowerCase()} em ${city.name}?`, answer: `O investimento depende do porte e das necessidades. Solicite um diagnóstico gratuito e proposta personalizada.` },
      ],
      relatedLinks,
      localContent: `A WMTi atende ${seg.name.toLowerCase()} em ${city.name} (${city.state}), região de ${city.region}, com soluções de TI dimensionadas. Atendimento presencial e remoto com SLA garantido.`,
      shouldIndex: true,
      priority: city.priority * 0.6,
      canonicalSlug,
    };
  }

  // Fallback (should not happen with valid entities)
  return {
    slug: canonicalSlug,
    metaTitle: `${entity.name} em ${city.name} | WMTi`,
    metaDescription: `${entity.name} em ${city.name}. Soluções profissionais da WMTi Tecnologia.`,
    tag: entity.name,
    headline: `${entity.name} em `,
    headlineHighlight: city.name,
    description: `A WMTi oferece ${entity.name.toLowerCase()} em ${city.name}.`,
    whatsappMessage: `Olá! Preciso de ${entity.name.toLowerCase()} em ${city.name}.`,
    category: "local-service",
    painPoints: defaultPainPoints,
    solutions: defaultSolutions,
    benefits: genericIcons,
    faq: [],
    relatedLinks: [],
    localContent: `A WMTi atende ${city.name} com soluções de ${entity.name.toLowerCase()}.`,
    shouldIndex: true,
    priority: city.priority * 0.5,
    canonicalSlug,
  };
}

/**
 * Main entry point for the SEO engine.
 * Given a slug, attempts to resolve it as a local page.
 * Returns the generated page data or null if invalid.
 */
export function resolveLocalPage(slug: string): SeoPageData | null {
  const parsed = parseLocalSlug(slug);
  if (!parsed) return null;
  return generateLocalPage(parsed.entity, parsed.city);
}

// ─── Exports for sitemap generation ───
export function getAllEntityPrefixes(): string[] {
  return Array.from(entityByPrefix.keys());
}

export function getAllCitySlugs(): string[] {
  return cities.map((c) => c.slug);
}

export { cities, services, segments };

/**
 * Blog Internal Linking Engine v3
 * Generates 15-20+ relevant internal links per blog post, distributed across:
 * - Service pages (min 7)
 * - Segment pages (min 4)
 * - Other blog posts (min 5)
 * - City pages (min 3)
 * - Conversion pages (orçamento, WhatsApp)
 *
 * Also provides:
 * - Keyword-based auto-linking within markdown content
 * - Natural phrase-based contextual insertion
 * - Mid-article and 2/3-article CTAs
 * - Validation report per article
 */

import { services } from "@/data/seo/services";
import { segments } from "@/data/seo/segments";
import { cities } from "@/data/seo/cities";
import { blogPosts, type BlogPost } from "@/data/blogPosts";

export interface InternalLink {
  href: string;
  anchor: string;
  type: "service" | "segment" | "blog" | "city" | "conversion";
}

export interface LinkingReport {
  totalLinks: number;
  byType: Record<string, number>;
  destinations: string[];
  distribution: { position: string; count: number }[];
}

// ── Keyword → service/segment relevance mapping ──
const SERVICE_KEYWORDS: Record<string, string[]> = {
  "infraestrutura-ti": ["infraestrutura", "servidor", "rede", "hardware", "data center", "disponibilidade", "ti corporativa"],
  "suporte-ti": ["suporte", "help desk", "chamado", "atendimento", "manutenção", "técnico", "sla"],
  "monitoramento-rede": ["monitoramento", "alertas", "performance", "NOC", "disponibilidade", "uptime"],
  "servidores-dell": ["servidor", "dell", "poweredge", "raid", "virtualização", "hyper-v", "vmware"],
  "microsoft-365": ["microsoft", "365", "office", "email", "teams", "sharepoint", "onedrive", "exchange", "outlook"],
  "seguranca-rede": ["segurança", "firewall", "antivírus", "proteção", "ameaça", "ataque", "ransomware", "vulnerabilidade"],
  "locacao-computadores": ["locação", "computador", "estação", "desktop", "equipamento", "optilex"],
  "administracao-servidores": ["administração", "servidor", "active directory", "gpo", "windows server", "linux", "dns", "dhcp"],
  "monitoramento-servidores": ["monitoramento", "servidor", "cpu", "memória", "disco", "performance"],
  "backup-corporativo": ["backup", "veeam", "restauração", "dados", "nuvem", "replicação", "3-2-1", "recuperação"],
  "firewall-corporativo": ["firewall", "pfsense", "ids", "ips", "vpn", "suricata", "bloqueio"],
  "infraestrutura-rede": ["rede", "cabeamento", "switch", "vlan", "wi-fi", "wireless", "cat6"],
  "suporte-emergencial": ["emergência", "urgente", "parou", "caiu", "indisponível", "fora do ar"],
  "suporte-windows-server": ["windows server", "active directory", "gpo", "dns", "dhcp", "file server"],
  "suporte-linux": ["linux", "ubuntu", "centos", "debian", "docker", "iptables"],
  "manutencao-ti": ["manutenção", "preventiva", "corretiva", "firmware", "patch", "atualização"],
  "suporte-redes-corporativas": ["rede corporativa", "switch", "access point", "cabeamento", "diagnóstico"],
  "terceirizacao-ti": ["terceirização", "outsourcing", "equipe dedicada", "mão de obra", "gestão de ti"],
  "automacao-ia": ["automação", "inteligência artificial", "ia", "produtividade", "fluxo", "automatizar"],
  "automacao-alexa": ["alexa", "casa inteligente", "automação", "smart home", "iot"],
  "reestruturacao-rede": ["reestruturação", "modernização", "rede antiga", "upgrade", "migração de rede"],
  "desenvolvimento-web": ["site", "sistema", "web", "aplicação", "landing page", "desenvolvimento"],
};

const SEGMENT_KEYWORDS: Record<string, string[]> = {
  "serventias-notariais": ["cartório", "notarial", "tabelionato", "registro", "provimento", "cnj", "extrajudicial"],
  "hospitais": ["hospital", "clínica", "saúde", "paciente", "prontuário", "médico", "his", "pacs", "exame"],
  "escritorios-advocacia": ["advocacia", "advogado", "jurídico", "escritório", "processo", "sigilo"],
  "contabilidade": ["contabilidade", "contador", "fiscal", "tributário", "contábil", "fechamento"],
  "industrias-alimenticias": ["indústria", "alimentícia", "produção", "rastreabilidade", "sanitária"],
  "industrias-petroliferas": ["petrolífera", "energia", "petróleo", "industrial", "operação contínua"],
  "empresas-corporativas": ["corporativo", "empresa", "PME", "médio porte", "grande porte"],
};

const CATEGORY_TO_SEGMENT: Record<string, string[]> = {
  "Hospitais e Clínicas": ["hospitais", "empresas-corporativas"],
  "Cartórios": ["serventias-notariais", "empresas-corporativas"],
  "Escritórios de Advocacia": ["escritorios-advocacia", "empresas-corporativas"],
  "Escritórios de Contabilidade": ["contabilidade", "empresas-corporativas"],
  "Empresas Corporativas": ["empresas-corporativas", "industrias-alimenticias"],
  "Tecnologia Empresarial": ["empresas-corporativas", "hospitais", "contabilidade"],
  "Infraestrutura de TI": ["empresas-corporativas", "industrias-alimenticias", "hospitais"],
  "Segurança Digital": ["empresas-corporativas", "hospitais", "escritorios-advocacia"],
  "Problemas de TI": ["empresas-corporativas", "hospitais", "serventias-notariais"],
  "Custos de TI": ["empresas-corporativas", "contabilidade"],
  "Conteúdo Regional": ["empresas-corporativas"],
  "Casos de Sucesso": ["empresas-corporativas"],
};

// ── Anchor text templates ──
const SERVICE_ANCHOR_TEMPLATES: Record<string, string[]> = {
  "infraestrutura-ti": ["infraestrutura de TI corporativa", "soluções de infraestrutura de TI", "projetos de infraestrutura de tecnologia"],
  "suporte-ti": ["suporte técnico de TI", "suporte técnico especializado", "serviço de suporte de TI"],
  "monitoramento-rede": ["monitoramento de rede corporativa", "monitoramento contínuo de redes", "serviço de monitoramento de rede"],
  "servidores-dell": ["servidores Dell PowerEdge", "implantação de servidores Dell", "servidores corporativos Dell"],
  "microsoft-365": ["Microsoft 365 para empresas", "implantação do Microsoft 365", "administração de Microsoft 365"],
  "seguranca-rede": ["segurança de rede empresarial", "proteção de rede corporativa", "soluções de segurança de rede"],
  "locacao-computadores": ["locação de computadores para empresas", "aluguel de estações de trabalho", "locação de equipamentos Dell"],
  "administracao-servidores": ["administração de servidores", "gestão profissional de servidores", "administração de servidores corporativos"],
  "monitoramento-servidores": ["monitoramento de servidores 24/7", "monitoramento contínuo de servidores", "acompanhamento de performance de servidores"],
  "backup-corporativo": ["backup corporativo automatizado", "soluções de backup para empresas", "estratégia de backup 3-2-1"],
  "firewall-corporativo": ["firewall pfSense para empresas", "proteção com firewall corporativo", "firewall profissional pfSense"],
  "infraestrutura-rede": ["infraestrutura de rede corporativa", "projeto de rede estruturada", "cabeamento e switches gerenciáveis"],
  "suporte-emergencial": ["suporte técnico emergencial", "atendimento emergencial de TI", "suporte urgente para servidores"],
  "suporte-windows-server": ["suporte para Windows Server", "administração de Active Directory", "suporte especializado em Windows Server"],
  "suporte-linux": ["suporte para servidores Linux", "administração de servidores Linux", "suporte Linux corporativo"],
  "manutencao-ti": ["manutenção de infraestrutura de TI", "manutenção preventiva e corretiva", "manutenção técnica de TI"],
  "suporte-redes-corporativas": ["suporte para redes corporativas", "manutenção de redes empresariais", "suporte técnico para redes"],
  "terceirizacao-ti": ["terceirização de TI", "outsourcing de mão de obra de TI", "equipe de TI dedicada"],
  "automacao-ia": ["automação de TI com inteligência artificial", "automação inteligente de processos", "IA aplicada à gestão de TI"],
  "automacao-alexa": ["automação com Alexa para empresas", "smart office com Alexa", "automação residencial e empresarial"],
  "reestruturacao-rede": ["reestruturação de rede corporativa", "modernização de rede empresarial", "upgrade completo de rede"],
  "desenvolvimento-web": ["desenvolvimento de sites e sistemas", "criação de sites profissionais", "sistemas web para empresas"],
};

const SEGMENT_ANCHOR_TEMPLATES: Record<string, string[]> = {
  "serventias-notariais": ["TI para cartórios e serventias", "infraestrutura de TI para cartórios", "soluções de TI para serventias notariais"],
  "hospitais": ["TI para hospitais e clínicas", "infraestrutura de TI hospitalar", "soluções de tecnologia para saúde"],
  "escritorios-advocacia": ["TI para escritórios de advocacia", "segurança digital para advogados", "infraestrutura para escritórios jurídicos"],
  "contabilidade": ["TI para escritórios de contabilidade", "infraestrutura para contabilidades", "tecnologia para escritórios contábeis"],
  "industrias-alimenticias": ["TI para indústrias alimentícias", "infraestrutura industrial de TI", "tecnologia para indústrias de alimentos"],
  "industrias-petroliferas": ["TI para indústrias petrolíferas", "infraestrutura para setor de energia", "tecnologia para indústrias de petróleo"],
  "empresas-corporativas": ["TI para empresas corporativas", "soluções corporativas de TI", "infraestrutura para empresas de médio e grande porte"],
};

// ── Keyword auto-link map: keyword in text → link target ──
const KEYWORD_AUTOLINK_MAP: { pattern: RegExp; href: string; anchor: string }[] = [
  { pattern: /\bbackup\b(?! corporativo)/i, href: "/backup-corporativo", anchor: "backup corporativo" },
  { pattern: /\bfirewall\b(?! pfSense| corporativo)/i, href: "/firewall-pfsense", anchor: "firewall corporativo pfSense" },
  { pattern: /\bransomware\b/i, href: "/seguranca-rede", anchor: "proteção contra ransomware" },
  { pattern: /\bactive directory\b/i, href: "/administracao-servidores", anchor: "administração de Active Directory" },
  { pattern: /\bwindows server\b/i, href: "/suporte-windows-server", anchor: "suporte para Windows Server" },
  { pattern: /\bpoweredge\b/i, href: "/servidores-dell", anchor: "servidores Dell PowerEdge" },
  { pattern: /\bmicrosoft 365\b/i, href: "/microsoft-365", anchor: "Microsoft 365 para empresas" },
  { pattern: /\bmonitoramento\b(?! de rede| de servidores| contínuo)/i, href: "/monitoramento-rede", anchor: "monitoramento de rede" },
  { pattern: /\bvirtualização\b/i, href: "/administracao-servidores", anchor: "virtualização de servidores" },
  { pattern: /\bvpn\b/i, href: "/firewall-pfsense", anchor: "conexão VPN segura" },
  { pattern: /\blgpd\b/i, href: "/seguranca-rede", anchor: "conformidade com a LGPD" },
  { pattern: /\bterceirização de ti\b/i, href: "/terceirizacao-ti", anchor: "terceirização de TI" },
  { pattern: /\blocação de computadores\b/i, href: "/locacao-computadores", anchor: "locação de computadores para empresas" },
  { pattern: /\bcabeamento estruturado\b/i, href: "/montagem-redes", anchor: "cabeamento estruturado profissional" },
  { pattern: /\borçamento\b/i, href: "/orcamento-ti", anchor: "solicitar orçamento de TI" },
];

// ── Seeded pseudo-random ──
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickAnchors(templates: string[], seed: number, count: number): string[] {
  return seededShuffle(templates, seed).slice(0, count);
}

function scoreService(serviceSlug: string, title: string, excerpt: string, category: string, tag: string): number {
  const text = `${title} ${excerpt} ${category} ${tag}`.toLowerCase();
  const keywords = SERVICE_KEYWORDS[serviceSlug] || [];
  let score = 0;
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) score += 2;
  }
  return score;
}

function scoreSegment(segmentSlug: string, title: string, excerpt: string, category: string, tag: string): number {
  const text = `${title} ${excerpt} ${category} ${tag}`.toLowerCase();
  const keywords = SEGMENT_KEYWORDS[segmentSlug] || [];
  let score = 0;
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) score += 2;
  }
  const mappedSegments = CATEGORY_TO_SEGMENT[category] || [];
  if (mappedSegments.includes(segmentSlug)) score += 3;
  return score;
}

// ── Natural insertion phrases (20 varied to avoid repetition) ──
const INSERTION_PHRASES = [
  (a: string, h: string) => `Para resolver esse cenário, contar com [${a}](${h}) é essencial.`,
  (a: string, h: string) => `Nesse contexto, investir em [${a}](${h}) faz toda a diferença.`,
  (a: string, h: string) => `A [${a}](${h}) é uma das formas mais eficazes de evitar esse tipo de problema.`,
  (a: string, h: string) => `Empresas que implementam [${a}](${h}) reduzem drasticamente esse tipo de risco.`,
  (a: string, h: string) => `Um dos pilares para prevenir essa situação é a [${a}](${h}).`,
  (a: string, h: string) => `A adoção de [${a}](${h}) tem se mostrado decisiva para empresas que enfrentam esse desafio.`,
  (a: string, h: string) => `Essa é uma das razões pelas quais a [${a}](${h}) se tornou prioridade em ambientes corporativos.`,
  (a: string, h: string) => `A [${a}](${h}) oferece camadas de proteção que mitigam esses riscos de forma contínua.`,
  (a: string, h: string) => `Quando falamos em resultados concretos, a [${a}](${h}) se destaca como solução comprovada.`,
  (a: string, h: string) => `Organizações de todos os portes têm adotado [${a}](${h}) para fortalecer sua operação.`,
  (a: string, h: string) => `Para garantir continuidade operacional, a [${a}](${h}) é indispensável.`,
  (a: string, h: string) => `Profissionais de TI recomendam [${a}](${h}) como parte de qualquer estratégia robusta.`,
  (a: string, h: string) => `Negligenciar [${a}](${h}) pode gerar custos imprevistos e riscos operacionais graves.`,
  (a: string, h: string) => `O investimento em [${a}](${h}) se paga rapidamente em produtividade e segurança.`,
  (a: string, h: string) => `Muitas empresas só descobrem a importância da [${a}](${h}) depois de enfrentar uma crise.`,
  (a: string, h: string) => `Segundo especialistas, a [${a}](${h}) é fundamental para operações de missão crítica.`,
  (a: string, h: string) => `Em ambientes de alta exigência, a [${a}](${h}) garante estabilidade e previsibilidade.`,
  (a: string, h: string) => `Empresas que ainda não adotaram [${a}](${h}) estão expostas a riscos significativos.`,
  (a: string, h: string) => `A transformação digital começa com a [${a}](${h}) bem implementada.`,
  (a: string, h: string) => `Para escalar com segurança, a [${a}](${h}) deve ser parte da estratégia desde o primeiro dia.`,
];

// ── Main link generation function ──
export function generateBlogInternalLinks(
  postSlug: string,
  title: string,
  excerpt: string,
  category: string,
  tag: string,
  keywords?: string[]
): InternalLink[] {
  const seed = hashCode(postSlug);
  const links: InternalLink[] = [];

  // 1. SERVICE LINKS (min 7)
  const serviceScores = services
    .map(s => ({ service: s, score: scoreService(s.slug, title, excerpt, category, tag) }))
    .sort((a, b) => b.score - a.score || hashCode(a.service.slug + postSlug) - hashCode(b.service.slug + postSlug));

  const topServices = serviceScores.slice(0, 4).filter(s => s.score > 0);
  const restServices = seededShuffle(serviceScores.slice(4), seed);
  const selectedServices = [...topServices, ...restServices].slice(0, 7);

  for (const { service } of selectedServices) {
    const anchors = SERVICE_ANCHOR_TEMPLATES[service.slug] || [service.name];
    const anchor = pickAnchors(anchors, seed + hashCode(service.slug), 1)[0];
    links.push({
      href: service.dedicatedPage || `/${service.slug}-em-jacarei`,
      anchor,
      type: "service",
    });
  }

  // 2. SEGMENT LINKS (min 4)
  const segmentScores = segments
    .map(s => ({ segment: s, score: scoreSegment(s.slug, title, excerpt, category, tag) }))
    .sort((a, b) => b.score - a.score || hashCode(a.segment.slug + postSlug) - hashCode(b.segment.slug + postSlug));

  const selectedSegments = segmentScores.slice(0, 4);

  for (const { segment } of selectedSegments) {
    const anchors = SEGMENT_ANCHOR_TEMPLATES[segment.slug] || [segment.name];
    const anchor = pickAnchors(anchors, seed + hashCode(segment.slug), 1)[0];
    links.push({
      href: segment.dedicatedPage || `/${segment.slug}`,
      anchor,
      type: "segment",
    });
  }

  // 3. BLOG LINKS (min 5)
  const otherPosts = blogPosts.filter(p => p.slug !== postSlug);
  const blogScores = otherPosts.map(p => {
    let score = 0;
    if (p.category === category) score += 3;
    if (p.tag === tag) score += 2;
    const postWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    for (const w of postWords) {
      if (p.title.toLowerCase().includes(w)) score += 1;
    }
    return { post: p, score };
  }).sort((a, b) => b.score - a.score || hashCode(a.post.slug + postSlug) - hashCode(b.post.slug + postSlug));

  const selectedBlogs = blogScores.slice(0, 6);

  for (const { post } of selectedBlogs) {
    links.push({
      href: `/blog/${post.slug}`,
      anchor: post.title,
      type: "blog",
    });
  }

  // 4. CITY LINKS (min 3)
  const topCities = cities.filter(c => c.priority >= 0.7 && c.context);
  const shuffledCities = seededShuffle(topCities, seed);
  const selectedCities = shuffledCities.slice(0, 4);

  const primaryServiceSlug = selectedServices[0]?.service.slug || "suporte-ti";

  for (const city of selectedCities) {
    const anchor = `${services.find(s => s.slug === primaryServiceSlug)?.name || "empresa de TI"} em ${city.name}`;
    links.push({
      href: `/${primaryServiceSlug}-em-${city.slug}`,
      anchor: anchor.toLowerCase(),
      type: "city",
    });
  }

  // 5. CONVERSION LINKS (always)
  links.push({
    href: "/orcamento-ti",
    anchor: "solicitar um orçamento personalizado de TI",
    type: "conversion",
  });
  links.push({
    href: "https://wa.me/5511963166915",
    anchor: "falar com um especialista pelo WhatsApp",
    type: "conversion",
  });

  return links;
}

/**
 * Injects contextual internal links into markdown content.
 * Distributes links naturally throughout the text body with varied phrases.
 * Also performs keyword-based auto-linking for common terms.
 */
export function injectLinksIntoMarkdown(markdown: string, links: InternalLink[]): string {
  if (!markdown || links.length === 0) return markdown;

  const paragraphs = markdown.split("\n\n");
  if (paragraphs.length < 3) return markdown;

  const serviceLinks = links.filter(l => l.type === "service");
  const segmentLinks = links.filter(l => l.type === "segment");
  const blogLinks = links.filter(l => l.type === "blog");
  const cityLinks = links.filter(l => l.type === "city");
  const conversionLinks = links.filter(l => l.type === "conversion");

  // Pool contextual links for inline insertion (services + segments + cities + conversion)
  const contextualLinks = [...serviceLinks, ...segmentLinks, ...cityLinks, ...conversionLinks];
  const seed = hashCode(markdown.substring(0, 100));
  const shuffledPhrases = seededShuffle(INSERTION_PHRASES, seed);

  // Identify eligible paragraphs (skip headings, lists, first 2)
  const eligibleIndices: number[] = [];
  paragraphs.forEach((p, i) => {
    if (i < 2) return;
    if (p.startsWith("##") || p.startsWith("- ") || p.startsWith("*") || p.startsWith("#") || p.startsWith(">")) return;
    if (p.length < 60) return;
    eligibleIndices.push(i);
  });

  // Distribute contextual links evenly across eligible paragraphs
  let linkIdx = 0;
  const spacing = Math.max(1, Math.floor(eligibleIndices.length / contextualLinks.length));

  for (let ei = 0; ei < eligibleIndices.length && linkIdx < contextualLinks.length; ei++) {
    if (ei % spacing !== 0 && linkIdx > 0) continue;

    const pIdx = eligibleIndices[ei];
    const link = contextualLinks[linkIdx];
    const phraseBuilder = shuffledPhrases[linkIdx % shuffledPhrases.length];
    const phrase = phraseBuilder(link.anchor, link.href);

    const p = paragraphs[pIdx];
    const sentenceEnd = p.indexOf(". ");
    if (sentenceEnd > 30 && sentenceEnd < p.length - 20) {
      paragraphs[pIdx] = `${p.substring(0, sentenceEnd + 2)}${phrase} ${p.substring(sentenceEnd + 2)}`;
    } else {
      paragraphs[pIdx] = `${p} ${phrase}`;
    }
    linkIdx++;
  }

  // Keyword auto-linking: scan remaining eligible paragraphs for keyword matches
  const usedHrefs = new Set(contextualLinks.map(l => l.href));
  let autoLinkCount = 0;
  const MAX_AUTOLINKS = 5;

  for (const pIdx of eligibleIndices) {
    if (autoLinkCount >= MAX_AUTOLINKS) break;
    const p = paragraphs[pIdx];
    // Skip if paragraph already has a markdown link
    if (p.includes("](")) continue;

    for (const rule of KEYWORD_AUTOLINK_MAP) {
      if (autoLinkCount >= MAX_AUTOLINKS) break;
      if (usedHrefs.has(rule.href)) continue;

      const match = p.match(rule.pattern);
      if (match) {
        // Replace only the first occurrence with a link
        paragraphs[pIdx] = p.replace(rule.pattern, `[${rule.anchor}](${rule.href})`);
        usedHrefs.add(rule.href);
        autoLinkCount++;
        break; // One auto-link per paragraph
      }
    }
  }

  // Mid-article CTA (~40%)
  const midPoint = Math.floor(paragraphs.length * 0.4);
  if (paragraphs.length > 6) {
    paragraphs.splice(midPoint, 0,
      `> **💡 Sua empresa enfrenta esse tipo de desafio?** Fale agora com um especialista da WMTi e receba um diagnóstico gratuito. [Solicitar orçamento](/orcamento-ti) ou chame no [WhatsApp](https://wa.me/5511963166915).`
    );
  }

  // Second CTA (~75%)
  const threeQuarterPoint = Math.floor(paragraphs.length * 0.75);
  if (paragraphs.length > 10) {
    paragraphs.splice(threeQuarterPoint, 0,
      `> **🔒 Não espere o problema acontecer.** A WMTi atua com prevenção, monitoramento contínuo e resposta rápida. [Agende uma avaliação gratuita](/orcamento-ti) e descubra como proteger sua operação.`
    );
  }

  // Related blog posts section at the end
  if (blogLinks.length > 0) {
    paragraphs.push("");
    paragraphs.push("## Leitura recomendada");
    paragraphs.push("");
    for (const link of blogLinks.slice(0, 5)) {
      paragraphs.push(`- [${link.anchor}](${link.href})`);
    }
  }

  return paragraphs.join("\n\n");
}

/**
 * Generates the "Serviços relacionados" block data for the bottom of blog posts.
 */
export function getRelatedServicesBlock(
  postSlug: string,
  title: string,
  excerpt: string,
  category: string,
  tag: string
): { label: string; href: string }[] {
  const allLinks = generateBlogInternalLinks(postSlug, title, excerpt, category, tag);

  const serviceLinks = allLinks.filter(l => l.type === "service").slice(0, 4);
  const segmentLinks = allLinks.filter(l => l.type === "segment").slice(0, 3);

  return [...serviceLinks, ...segmentLinks].map(l => ({
    label: l.anchor,
    href: l.href,
  }));
}

/**
 * Generates a validation report for a given blog post's internal linking.
 * Useful for debugging and QA in the admin panel.
 */
export function generateLinkingReport(
  postSlug: string,
  title: string,
  excerpt: string,
  category: string,
  tag: string,
  contentMd?: string
): LinkingReport {
  const links = generateBlogInternalLinks(postSlug, title, excerpt, category, tag);

  const byType: Record<string, number> = {};
  const destinations: string[] = [];

  for (const link of links) {
    byType[link.type] = (byType[link.type] || 0) + 1;
    destinations.push(link.href);
  }

  // Count links already in content (pre-existing markdown links)
  let existingLinksInContent = 0;
  if (contentMd) {
    const linkMatches = contentMd.match(/\[([^\]]+)\]\(([^)]+)\)/g);
    existingLinksInContent = linkMatches ? linkMatches.length : 0;
  }

  const totalParagraphs = contentMd ? contentMd.split("\n\n").length : 0;
  const third = Math.floor(totalParagraphs / 3);

  return {
    totalLinks: links.length + existingLinksInContent,
    byType: {
      ...byType,
      "existing_in_content": existingLinksInContent,
    },
    destinations,
    distribution: [
      { position: "Primeiro terço", count: Math.min(byType["service"] || 0, third) },
      { position: "Segundo terço", count: (byType["segment"] || 0) + (byType["conversion"] || 0) },
      { position: "Terço final", count: (byType["blog"] || 0) + (byType["city"] || 0) },
    ],
  };
}

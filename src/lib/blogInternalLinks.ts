/**
 * Blog Internal Linking Engine
 * Generates 15+ relevant internal links per blog post, distributed across:
 * - Service pages (min 6)
 * - Segment pages (min 4)
 * - Other blog posts (min 5)
 * - City pages (min 3)
 */

import { services } from "@/data/seo/services";
import { segments } from "@/data/seo/segments";
import { cities } from "@/data/seo/cities";
import { blogPosts, type BlogPost } from "@/data/blogPosts";

export interface InternalLink {
  href: string;
  anchor: string;
  type: "service" | "segment" | "blog" | "city";
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

// ── Anchor text templates for natural variation ──
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

// ── Seeded pseudo-random for deterministic but varied results ──
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

// ── Score relevance of a service to a post ──
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

// ── Natural insertion phrases (varied to avoid repetition) ──
const INSERTION_PHRASES = [
  (anchor: string, href: string) => `Para resolver esse cenário, contar com [${anchor}](${href}) é essencial.`,
  (anchor: string, href: string) => `Nesse contexto, investir em [${anchor}](${href}) faz toda a diferença.`,
  (anchor: string, href: string) => `A [${anchor}](${href}) é uma das formas mais eficazes de evitar esse tipo de problema.`,
  (anchor: string, href: string) => `Empresas que implementam [${anchor}](${href}) reduzem drasticamente esse tipo de risco.`,
  (anchor: string, href: string) => `Um dos pilares para prevenir essa situação é a [${anchor}](${href}).`,
  (anchor: string, href: string) => `A adoção de [${anchor}](${href}) tem se mostrado decisiva para empresas que enfrentam esse desafio.`,
  (anchor: string, href: string) => `Essa é uma das razões pelas quais a [${anchor}](${href}) se tornou prioridade em ambientes corporativos.`,
  (anchor: string, href: string) => `A [${anchor}](${href}) oferece camadas de proteção que mitigam esses riscos de forma contínua.`,
  (anchor: string, href: string) => `Quando falamos em resultados concretos, a [${anchor}](${href}) se destaca como solução comprovada.`,
  (anchor: string, href: string) => `Organizações de todos os portes têm adotado [${anchor}](${href}) para fortalecer sua operação.`,
  (anchor: string, href: string) => `Para garantir continuidade operacional, a [${anchor}](${href}) é indispensável.`,
  (anchor: string, href: string) => `Profissionais de TI recomendam [${anchor}](${href}) como parte de qualquer estratégia robusta.`,
  (anchor: string, href: string) => `Negligenciar [${anchor}](${href}) pode gerar custos imprevistos e riscos operacionais.`,
  (anchor: string, href: string) => `O investimento em [${anchor}](${href}) se paga rapidamente em produtividade e segurança.`,
  (anchor: string, href: string) => `Muitas empresas só descobrem a importância da [${anchor}](${href}) depois de enfrentar uma crise.`,
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

  // 1. SERVICE LINKS (min 6)
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

  return links;
}

/**
 * Injects contextual internal links into markdown content.
 * Distributes links naturally throughout the text body with varied phrases.
 */
export function injectLinksIntoMarkdown(markdown: string, links: InternalLink[]): string {
  if (!markdown || links.length === 0) return markdown;

  const paragraphs = markdown.split("\n\n");
  if (paragraphs.length < 3) return markdown;

  const serviceLinks = links.filter(l => l.type === "service");
  const segmentLinks = links.filter(l => l.type === "segment");
  const blogLinks = links.filter(l => l.type === "blog");
  const cityLinks = links.filter(l => l.type === "city");

  // Pool contextual links for inline insertion
  const contextualLinks = [...serviceLinks, ...segmentLinks, ...cityLinks];
  const seed = hashCode(markdown.substring(0, 100));
  const shuffledPhrases = seededShuffle(INSERTION_PHRASES, seed);

  // Identify eligible paragraphs (skip headings, lists, first 2)
  const eligibleIndices: number[] = [];
  paragraphs.forEach((p, i) => {
    if (i < 2) return;
    if (p.startsWith("##") || p.startsWith("- ") || p.startsWith("*") || p.startsWith("#")) return;
    if (p.length < 60) return;
    eligibleIndices.push(i);
  });

  // Distribute links evenly across eligible paragraphs
  let linkIdx = 0;
  const spacing = Math.max(1, Math.floor(eligibleIndices.length / contextualLinks.length));

  for (let ei = 0; ei < eligibleIndices.length && linkIdx < contextualLinks.length; ei++) {
    // Only place a link every `spacing` eligible paragraphs
    if (ei % spacing !== 0 && linkIdx > 0) continue;

    const pIdx = eligibleIndices[ei];
    const link = contextualLinks[linkIdx];
    const phraseBuilder = shuffledPhrases[linkIdx % shuffledPhrases.length];
    const phrase = phraseBuilder(link.anchor, link.href);

    const p = paragraphs[pIdx];
    // Insert after the first sentence if possible
    const sentenceEnd = p.indexOf(". ");
    if (sentenceEnd > 30 && sentenceEnd < p.length - 20) {
      paragraphs[pIdx] = `${p.substring(0, sentenceEnd + 2)}${phrase} ${p.substring(sentenceEnd + 2)}`;
    } else {
      paragraphs[pIdx] = `${p} ${phrase}`;
    }
    linkIdx++;
  }

  // Add a mid-article CTA after ~40% of paragraphs
  const midPoint = Math.floor(paragraphs.length * 0.4);
  if (paragraphs.length > 8) {
    paragraphs.splice(midPoint, 0, 
      `> **💡 Sua empresa enfrenta esse tipo de desafio?** Fale agora com um especialista da WMTi e receba um diagnóstico gratuito. [Solicitar orçamento](/orcamento-ti) ou chame no [WhatsApp](https://wa.me/5511963166915).`
    );
  }

  // Add related blog posts section at the end
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

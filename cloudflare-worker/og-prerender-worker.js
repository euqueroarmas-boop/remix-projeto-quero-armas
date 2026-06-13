/**
 * Cloudflare Worker — Quero Armas Open Graph Prerender
 * --------------------------------------------------------------
 * Mantém o site hospedado na Lovable e, somente para crawlers de
 * prévia de link (WhatsApp, Facebook, Telegram, Twitter, LinkedIn,
 * Slack, Discord), reescreve o <head> com Open Graph específico
 * por rota. Usuários humanos recebem a resposta original intacta.
 *
 * ATENÇÃO:
 *   No domínio Lovable atual, NÃO ative proxy/Worker route em @ ou www
 *   sem uma janela de manutenção. Isso pode derrubar a conexão do domínio
 *   e exigir reconectar no Lovable. A solução principal de preview social
 *   está em scripts/prerender-og.mjs + public/_redirects, sem mexer no DNS.
 *
 * INSTALAÇÃO DO WORKER:
 *   Use este Worker apenas como fallback planejado, depois de validar o
 *   comportamento de proxy em ambiente seguro.
 *
 * VALIDAÇÃO:
 *   curl -A "WhatsApp/2.0" https://www.euqueroarmas.com.br/servicos/posse-de-arma-de-fogo \
 *     | grep -E "og:title|og:description|og:url|canonical"
 */

const SITE_URL = "https://www.euqueroarmas.com.br";
const SITE_NAME = "Quero Armas";
const DEFAULT_IMAGE = `${SITE_URL}/og/home.jpg`;

// Cada slug de serviço público em SERVICE_META possui /og/<slug>.jpg materializado
// no repositório. O Worker não pode checar o filesystem; emitimos a URL por slug
// e contamos com o arquivo existir. Se for adicionado um novo slug a SERVICE_META
// sem subir o JPG, o crawler verá um 404 na imagem — por isso a regra: ao incluir
// um serviço em SERVICE_META, sempre subir public/og/<slug>.jpg.
function imageForSlug(slug) {
  if (!slug) return DEFAULT_IMAGE;
  return `${SITE_URL}/og/${slug}.jpg`;
}

// User-Agents de crawlers de prévia de link
const CRAWLER_UA_REGEX = new RegExp(
  [
    "WhatsApp",
    "facebookexternalhit",
    "Facebot",
    "TelegramBot",
    "Twitterbot",
    "LinkedInBot",
    "Slackbot",
    "Slack-ImgProxy",
    "Discordbot",
    "Pinterest",
    "redditbot",
    "Applebot",
    "SkypeUriPreview",
    "vkShare",
    "W3C_Validator",
    "Embedly",
    "Iframely",
  ].join("|"),
  "i",
);

// Prefixos de rota que NUNCA devem ser interceptados (fluxos privados/transacionais)
const EXCLUDED_PREFIXES = [
  "/checkout",
  "/carrinho",
  "/cadastro",
  "/cliente",
  "/portal",
  "/arsenal",
  "/equipe",
  "/admin",
  "/auth",
  "/login",
  "/logout",
  "/api",
  "/supabase",
  "/functions",
  "/assets",
  "/static",
  "/og",
  "/_",
];

// Extensões estáticas que nunca devem ser interceptadas
const STATIC_EXT_REGEX =
  /\.(js|mjs|css|map|png|jpe?g|webp|gif|svg|ico|json|txt|xml|woff2?|ttf|otf|eot|mp4|webm|mp3|pdf|zip)$/i;

// Metadados sitewide (fallback)
const HOME_META = {
  title: "Eu Quero Armas — Despachante de Armas, CAC, CR e Treinamentos",
  description:
    "Assessoria especializada para posse, porte, CAC, CR, CRAF, autorização de compra, guia de tráfego e treinamentos com armas de fogo.",
  image: DEFAULT_IMAGE,
};

// Metadados de páginas estáticas
const PAGE_META = {
  "/": HOME_META,
  "/servicos": {
    title: "Catálogo de Serviços | Quero Armas",
    description:
      "Catálogo completo de assessoria em armas: posse, porte, CR, CRAF, autorização de compra, guia de tráfego e treinamentos.",
    image: DEFAULT_IMAGE,
  },
};

// Slugs reais de /servicos/:slug — sincronizado com src/shared/seo/pageMeta.ts
const SERVICE_META = {
  "posse-de-arma-de-fogo": {
    title: "Posse de Arma de Fogo | Quero Armas",
    description:
      "Estratégia documental e assessoria premium para viabilizar sua posse de arma de fogo com segurança jurídica, previsibilidade e condução técnica junto à Polícia Federal.",
  },
  "aquisicao-registro-posse-de-arma-de-fogo": {
    title: "Aquisição, Registro e Posse de Arma de Fogo | Quero Armas",
    description:
      "Regularize sua aquisição, registro e posse de arma de fogo com apoio especializado. Análise documental, orientação estratégica e condução técnica em cada etapa. Mais segurança para protocolar do jeito certo.",
  },
  "renovacao-posse-de-arma-de-fogo": {
    title: "Renovação de Posse de Arma de Fogo | Quero Armas",
    description:
      "Renovação de posse com revisão técnica completa, organização documental e protocolo estratégico para reduzir exigências e preservar a regularidade do seu registro.",
  },
  "renovacao-de-porte-de-arma-de-fogo": {
    title: "Renovação de Porte de Arma de Fogo | Quero Armas",
    description:
      "Renovação de porte com fundamentação técnica qualificada, organização probatória e acompanhamento premium para sustentar um processo mais robusto perante a Polícia Federal.",
  },
  "porte-de-arma-de-fogo-por-ameaca-grave-ameaca": {
    title: "Porte de Arma por Ameaça / Grave Ameaça | Quero Armas",
    description:
      "Construção estratégica do pedido de porte por ameaça ou grave ameaça, com prova documental, narrativa técnica e acompanhamento especializado na Polícia Federal.",
  },
  "porte-funcional-magistrado-ministerio-publico": {
    title: "Porte Funcional — Magistrado e Ministério Público | Quero Armas",
    description:
      "Assessoria executiva para porte funcional de magistrados e membros do Ministério Público, com condução técnica, discrição e conformidade documental.",
  },
  "concessao-cr": {
    title: "Concessão de CR (Atirador, Colecionador, Caçador) | Quero Armas",
    description:
      "Assessoria premium para concessão de CR, com inteligência documental, alinhamento estratégico do processo e acompanhamento técnico até a emissão regular do certificado.",
  },
  "renovacao-cr": {
    title: "Renovação de CR (Polícia Federal) | Quero Armas",
    description:
      "Renovação de CR com gestão de prazo, revisão técnica do dossiê e condução estratégica para manter sua regularidade sem improviso e sem retrabalho.",
  },
  "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac": {
    title: "Autorização de Compra — Atirador Esportivo (CAC) | Quero Armas",
    description:
      "Autorização de compra para atirador esportivo com análise estratégica de acervo, documentação validada e protocolo técnico voltado à aprovação segura.",
  },
  "autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac": {
    title: "Autorização de Compra — Caçador (CAC) | Quero Armas",
    description:
      "Autorização de compra para caçador com revisão criteriosa do acervo, documentação consistente e condução técnica para um protocolo mais sólido.",
  },
  "guia-de-trafego-especial-cac": {
    title: "Guia de Tráfego Especial (CAC) | Quero Armas",
    description:
      "Emissão estratégica da Guia de Tráfego Especial com organização documental e acompanhamento técnico para ampliar mobilidade e regularidade operacional.",
  },
  "guia-de-transito-gt": {
    title: "Guia de Trânsito (GT) | Quero Armas",
    description:
      "Guia de Trânsito com condução técnica e protocolo correto para assegurar deslocamento regular, rastreabilidade documental e tranquilidade operacional.",
  },
  "registro-arma-fogo": {
    title: "Registro de Arma de Fogo (Defesa Pessoal) | Quero Armas",
    description:
      "Registro para defesa pessoal com assessoria premium, controle documental e acompanhamento técnico para emissão regular perante a Polícia Federal.",
  },
  "registro-e-apostilamento-de-arma-de-fogo-cac": {
    title: "Registro e Apostilamento de Arma (CAC) | Quero Armas",
    description:
      "Registro e apostilamento com revisão estratégica do acervo e condução técnica para manter sua situação regular, atualizada e pronta para fiscalização.",
  },
  "segunda-via-de-craf-digital": {
    title: "Segunda Via de CRAF Digital | Quero Armas",
    description:
      "Segunda via de CRAF digital com atuação ágil e precisa para restabelecer sua documentação e preservar a regularidade do registro.",
  },
  "operador-de-pistola-nivel-i": {
    title: "Curso Operador de Pistola — Nível I | Quero Armas",
    description:
      "Treinamento premium de operador de pistola com foco em segurança, técnica, domínio de fundamentos e experiência prática orientada por especialistas.",
  },
  "vip-operador-de-pistola-nivel-i": {
    title: "VIP — Operador de Pistola Nível I | Quero Armas",
    description:
      "Experiência VIP de operador de pistola com atendimento personalizado, ritmo individualizado e máxima qualidade técnica em cada etapa da instrução.",
  },
  "apostilamento-atualizacao": {
    title: "Apostilamento — Atualização de Acervo (CAC) | Quero Armas",
    description:
      "Atualização de acervo com apostilamento técnico e controle documental rigoroso para manter sua base cadastral íntegra, regular e pronta para conferência.",
  },
  "mandado-de-seguranca": {
    title: "Mandado de Segurança em Matéria de Armas | Quero Armas",
    description:
      "Atuação estratégica em mandado de segurança para enfrentar ilegalidades administrativas e recuperar o andamento do seu processo com força técnica.",
  },
  "recurso-administrativo": {
    title: "Recurso Administrativo (Polícia Federal) | Quero Armas",
    description:
      "Recurso administrativo com tese técnica consistente, revisão do processo e argumentação estratégica para enfrentar indeferimentos com maior solidez.",
  },
  "transferencia-de-propriedade-de-arma-de-fogo": {
    title: "Transferência de Propriedade de Arma de Fogo | Quero Armas",
    description:
      "Transferência de propriedade com segurança documental, condução técnica e protocolo correto para formalizar a operação sem risco de inconsistências.",
  },
  "mudanca-servico": {
    title: "Mudança de Serviço (Posse → CR) | Quero Armas",
    description:
      "Reposicionamento estratégico de posse para CR com planejamento documental e condução técnica para ampliar possibilidades dentro da regularidade.",
  },
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveMeta(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (PAGE_META[path]) return PAGE_META[path];

  const serviceMatch = path.match(/^\/servicos\/([^/]+)$/);
  if (serviceMatch) {
    const meta = SERVICE_META[serviceMatch[1]];
    if (meta) return { ...meta, image: imageForSlug(serviceMatch[1]) };
  }

  return HOME_META;
}

function buildHeadBlock(meta, canonicalUrl) {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = escapeHtml(meta.image || DEFAULT_IMAGE);
  const url = escapeHtml(canonicalUrl);

  return `
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:secure_url" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:locale" content="pt_BR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
`;
}

/**
 * Reescreve apenas as tags relevantes do <head>:
 * remove title/description/canonical/metas og e twitter existentes e injeta as nossas.
 */
function rewriteHead(html, meta, canonicalUrl) {
  const headBlock = buildHeadBlock(meta, canonicalUrl);

  const TAGS_TO_STRIP =
    /<title>[\s\S]*?<\/title>|<meta[^>]+(?:name|property)\s*=\s*["'](?:description|og:[^"']+|twitter:[^"']+)["'][^>]*\/?>|<link[^>]+rel\s*=\s*["']canonical["'][^>]*\/?>/gi;

  let nextHtml = html.replace(/<head([^>]*)>([\s\S]*?)<\/head>/i, (_, attrs, inner) => {
    const cleaned = inner.replace(TAGS_TO_STRIP, "");
    return `<head${attrs}>${headBlock}${cleaned}</head>`;
  });

  // Caso o HTML não tenha <head> (improvável), prepende um.
  if (nextHtml === html) {
    nextHtml = html.replace(
      /<html([^>]*)>/i,
      `<html$1><head>${headBlock}</head>`,
    );
  }

  return nextHtml;
}

function shouldBypass(pathname) {
  if (STATIC_EXT_REGEX.test(pathname)) return true;
  for (const prefix of EXCLUDED_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return true;
  }
  return false;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Sempre canonicalizar para www no canonical/og:url.
    const canonicalUrl = `${SITE_URL}${url.pathname}${url.search}`;

    // Encaminha apenas GET/HEAD pelo Worker; demais métodos passam direto.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return fetch(request);
    }

    const ua = request.headers.get("user-agent") || "";
    const isCrawler = CRAWLER_UA_REGEX.test(ua);

    // Usuários normais ou rotas privadas/estáticas → passa direto.
    if (!isCrawler || shouldBypass(url.pathname)) {
      return fetch(request);
    }

    // Para crawlers, busca o HTML da Lovable e reescreve o <head>.
    const originResponse = await fetch(request, {
      cf: { cacheTtl: 60, cacheEverything: false },
    });

    const contentType = originResponse.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return originResponse;
    }

    const originalHtml = await originResponse.text();
    const meta = resolveMeta(url.pathname);
    const rewritten = rewriteHead(originalHtml, meta, canonicalUrl);

    const headers = new Headers(originResponse.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.set("cache-control", "public, max-age=300, s-maxage=300");
    headers.set("x-quero-armas-og", "rewritten");

    return new Response(rewritten, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers,
    });
  },
};

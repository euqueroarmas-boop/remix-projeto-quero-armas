// Pós-build: gera dist/<rota>/index.html por rota pública com <head> específico.
// O Lovable serve arquivos reais antes do SPA fallback, então crawlers (WhatsApp,
// Facebook, Telegram, etc.) recebem o HTML com OG correto direto do edge.
// O usuário humano também recebe esse HTML e o React hidrata por cima sem mudança
// de comportamento (mesmo bundle, mesmo #root).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SITE = "https://www.euqueroarmas.com.br";
const OG_DEFAULT = `${SITE}/og/home.jpg`;

// Mapa slug → categoria de imagem OG. Sincronizado com cloudflare-worker e pageMeta.ts.
const SLUG_CATEGORY = {
  "posse-de-arma-de-fogo": "posse",
  "aquisicao-registro-posse-de-arma-de-fogo": "posse",
  "renovacao-posse-de-arma-de-fogo": "posse",
  "renovacao-de-porte-de-arma-de-fogo": "porte",
  "porte-de-arma-de-fogo-por-ameaca-grave-ameaca": "porte",
  "porte-funcional-magistrado-ministerio-publico": "porte",
  "concessao-cr": "cr-cac",
  "renovacao-cr": "cr-cac",
  "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac": "cr-cac",
  "autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac": "cr-cac",
  "guia-de-trafego-especial-cac": "cr-cac",
  "guia-de-transito-gt": "cr-cac",
  "registro-e-apostilamento-de-arma-de-fogo-cac": "cr-cac",
  "apostilamento-atualizacao": "cr-cac",
  "mudanca-servico": "cr-cac",
  "registro-arma-fogo": "registro",
  "segunda-via-de-craf-digital": "registro",
  "transferencia-de-propriedade-de-arma-de-fogo": "registro",
  "operador-de-pistola-nivel-i": "cursos",
  "vip-operador-de-pistola-nivel-i": "cursos",
  "mandado-de-seguranca": "recursos",
  "recurso-administrativo": "recursos",
  // Páginas estáticas
  "servicos": "home",
  "cadastro": "home",
  "carrinho": "home",
  "curso-operador-pistola": "cursos",
  "operador-de-pistola-nivel-i": "operador-de-pistola-nivel-i",
  "operador-de-pistola-nivel-ii": "cursos",
  "operador-de-pistola-nivel-iii": "cursos",
  "defesa-pessoal-posse": "posse",
  "cac-cr": "cr-cac",
  "atividades-avulsas": "registro",
};

const DEFAULT_DIST = path.resolve(process.cwd(), "dist");
let activeDist = DEFAULT_DIST;
let templatePath = path.join(activeDist, "index.html");
let template = "";

/** Catálogo público de rotas com metadados específicos.
 *  Os slugs de serviço são EXATAMENTE os ativos em qa_servicos_catalogo.
 *  Quando uma página dinâmica não estiver listada aqui, ela cai no
 *  fallback do Helmet client-side (suficiente para Google, não para WhatsApp). */
const SERVICE_META = {
  "posse-de-arma-de-fogo": {
    title: "Posse de Arma de Fogo | Quero Armas",
    description:
      "Estratégia documental e assessoria premium para viabilizar sua posse de arma de fogo com segurança jurídica, previsibilidade e condução técnica junto à Polícia Federal.",
  },
  "aquisicao-registro-posse-de-arma-de-fogo": {
    title: "Aquisição, Registro e Posse de Arma de Fogo | Quero Armas",
    description:
      "Aquisição, registro e posse de arma de fogo com acompanhamento completo na Polícia Federal. Você entra com o pedido de forma mais organizada, técnica e segura. Analisamos a documentação antes do protocolo para evitar retrabalho. Orientamos cada etapa do processo com base na legislação aplicável. Apoiamos o enquadramento correto do seu pedido no Sinarm Defesa Pessoal. Reduzimos o risco de exigências por falhas documentais ou inconsistências. Acompanhamos o andamento administrativo do início ao fim. Você ganha clareza sobre os requisitos técnicos e psicológicos do processo. O foco é protocolar com precisão, coerência e estratégia. Assessoria especializada para quem quer regularizar tudo do jeito certo.",
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

const STATIC_PAGES = {
  "servicos": {
    title: "Catálogo de Serviços | Quero Armas",
    description:
      "Catálogo completo de assessoria em armas de fogo: posse, porte, CR, CRAF, autorização de compra, guia de tráfego e treinamentos.",
  },
  "cadastro": {
    title: "Começar Meu Cadastro | Quero Armas",
    description:
      "Cadastro guiado para identificar o caminho legal correto para sua posse, porte, CR ou CAC com a Quero Armas.",
  },
  "carrinho": {
    title: "Carrinho de Contratação | Quero Armas",
    description:
      "Revise os serviços selecionados e finalize sua contratação com a Quero Armas.",
  },
  "curso-operador-pistola": {
    title: "Curso de Operador de Pistola | Quero Armas",
    description:
      "Curso de Operador de Pistola Nível I com instrutores credenciados: fundamentos, segurança e tiro real.",
  },
  "cursos/operador-de-pistola-nivel-i": {
    title: "Operador de Pistola Nível I em Jacareí | Curso Quero Armas",
    description:
      "Curso Operador de Pistola Nível I em Jacareí/SP. Treinamento responsável com foco em segurança, fundamentos iniciais e prática supervisionada.",
  },
  "cursos/operador-de-pistola-nivel-ii": {
    title: "Operador de Pistola Nível II — Em breve | Quero Armas",
    description:
      "Curso Operador de Pistola Nível II em breve. Fale com a equipe Quero Armas.",
  },
  "cursos/operador-de-pistola-nivel-iii": {
    title: "Operador de Pistola Nível III — Em breve | Quero Armas",
    description:
      "Curso Operador de Pistola Nível III em breve. Fale com a equipe Quero Armas.",
  },
  "defesa-pessoal-posse": {
    title: "Defesa Pessoal — Posse de Arma | Quero Armas",
    description:
      "Quem tem direito, o que precisa e como funciona a posse de arma de fogo para defesa pessoal dentro de casa.",
  },
  "cac-cr": {
    title: "CAC e CR — Como se tornar CAC | Quero Armas",
    description:
      "Caminho completo para se tornar Atirador, Colecionador ou Caçador com CR emitido pela Polícia Federal/SINARM-CAC.",
  },
  "atividades-avulsas": {
    title: "Atividades Avulsas em Armas | Quero Armas",
    description:
      "Serviços avulsos para regularização rápida: guia de tráfego, transferência, segunda via e recursos administrativos.",
  },
  "lp/defesa-pessoal-posse": {
    title: "Defesa Pessoal — Posse de Arma | Quero Armas",
    description:
      "Quem tem direito, o que precisa e como funciona a posse de arma de fogo para defesa pessoal dentro de casa.",
  },
  "lp/cac-cr": {
    title: "CAC e CR — Como se tornar CAC | Quero Armas",
    description:
      "Caminho completo para se tornar Atirador, Colecionador ou Caçador com CR emitido pela Polícia Federal/SINARM-CAC.",
  },
  "lp/atividades-avulsas": {
    title: "Atividades Avulsas em Armas | Quero Armas",
    description:
      "Serviços avulsos para regularização rápida: guia de tráfego, transferência, segunda via e recursos administrativos.",
  },
  "app-arsenal-gratuito": {
    title: "Arsenal Digital Gratuito | Quero Armas",
    description:
      "Organize armas, documentos, vencimentos e alertas do seu acervo em um painel gratuito da Quero Armas.",
  },
  "arsenal-digital-gratuito": {
    title: "Arsenal Digital Gratuito | Quero Armas",
    description:
      "Organize armas, documentos, vencimentos e alertas do seu acervo em um painel gratuito da Quero Armas.",
  },
};

function ogImageFor(slug) {
  // 1) Imagem específica por slug se existir; 2) categoria mapeada; 3) fallback home.
  const direct = path.join(activeDist, "og", `${slug}.jpg`);
  if (fs.existsSync(direct)) return `${SITE}/og/${slug}.jpg`;
  const category = SLUG_CATEGORY[slug];
  if (category) {
    const catFile = path.join(activeDist, "og", `${category}.jpg`);
    if (fs.existsSync(catFile)) return `${SITE}/og/${category}.jpg`;
  }
  return OG_DEFAULT;
}

/** Substitui (ou injeta) uma meta no <head>. Idempotente. */
function setMeta(html, { name, property, content }) {
  const safe = content.replace(/"/g, "&quot;");
  const attr = name ? `name="${name}"` : `property="${property}"`;
  const regex = name
    ? new RegExp(`<meta\\s+name="${name}"[^>]*>`, "i")
    : new RegExp(`<meta\\s+property="${property}"[^>]*>`, "i");
  const tag = `<meta ${attr} content="${safe}" />`;
  if (regex.test(html)) return html.replace(regex, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function setTitle(html, title) {
  const safe = title.replace(/</g, "&lt;");
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safe}</title>`);
  }
  return html.replace(/<\/head>/i, `    <title>${safe}</title>\n  </head>`);
}

function setCanonical(html, url) {
  const tag = `<link rel="canonical" href="${url}" />`;
  if (/<link\s+rel="canonical"[^>]*>/i.test(html)) {
    return html.replace(/<link\s+rel="canonical"[^>]*>/i, tag);
  }
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function buildHtml({ routePath, title, description, image }) {
  const url = `${SITE}${routePath.startsWith("/") ? routePath : "/" + routePath}`;
  let html = template;
  html = setTitle(html, title);
  html = setMeta(html, { name: "description", content: description });
  html = setCanonical(html, url);
  html = setMeta(html, { property: "og:title", content: title });
  html = setMeta(html, { property: "og:description", content: description });
  html = setMeta(html, { property: "og:url", content: url });
  html = setMeta(html, { property: "og:image", content: image });
  html = setMeta(html, { property: "og:type", content: "website" });
  html = setMeta(html, { property: "og:site_name", content: "Eu Quero Armas" });
  html = setMeta(html, { property: "og:image:width", content: "1200" });
  html = setMeta(html, { property: "og:image:height", content: "630" });
  html = setMeta(html, { name: "twitter:card", content: "summary_large_image" });
  html = setMeta(html, { name: "twitter:title", content: title });
  html = setMeta(html, { name: "twitter:description", content: description });
  html = setMeta(html, { name: "twitter:image", content: image });
  return html;
}

function writeRoute(routePath, meta) {
  const cleanPath = routePath.replace(/^\/+|\/+$/g, "");
  const dir = path.join(activeDist, cleanPath);
  fs.mkdirSync(dir, { recursive: true });
  const slugForImg = cleanPath.split("/").pop();
  const image = ogImageFor(slugForImg);
  const html = buildHtml({
    routePath: "/" + cleanPath,
    title: meta.title,
    description: meta.description,
    image,
  });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
}

export function prerenderOg({ distDir = DEFAULT_DIST } = {}) {
  activeDist = distDir;
  templatePath = path.join(activeDist, "index.html");

  if (!fs.existsSync(templatePath)) {
    console.warn(`[prerender-og] ${templatePath} não encontrado — pulando.`);
    return 0;
  }

  template = fs.readFileSync(templatePath, "utf8");

  let count = 0;
  for (const [page, meta] of Object.entries(STATIC_PAGES)) {
    writeRoute(page, meta);
    count++;
  }
  for (const [slug, meta] of Object.entries(SERVICE_META)) {
    writeRoute(`servicos/${slug}`, meta);
    count++;
  }

  // Atualiza também a home (dist/index.html) com imagem OG correta caso ainda
  // não tenha sido corrigida — defensivo.
  const homeFixed = setMeta(
    setMeta(template, { property: "og:image", content: OG_DEFAULT }),
    { name: "twitter:image", content: OG_DEFAULT },
  );
  fs.writeFileSync(templatePath, homeFixed, "utf8");

  console.log(`[prerender-og] ${count} rotas com <head> específico geradas em ${activeDist}.`);
  return count;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  prerenderOg({ distDir: process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_DIST });
}

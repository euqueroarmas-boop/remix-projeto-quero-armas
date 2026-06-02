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
      "Assessoria para aquisição legal, registro e posse de arma de fogo, com acompanhamento completo do processo.",
  },
  "aquisicao-registro-posse-de-arma-de-fogo": {
    title: "Aquisição, Registro e Posse de Arma de Fogo | Quero Armas",
    description:
      "Processo completo de aquisição, registro e posse de arma de fogo na Polícia Federal com acompanhamento jurídico-administrativo do início ao fim.",
  },
  "renovacao-posse-de-arma-de-fogo": {
    title: "Renovação de Posse de Arma de Fogo | Quero Armas",
    description:
      "Renovação de posse de arma de fogo na Polícia Federal: análise documental, agendamento, exames e protocolo sem retrabalho.",
  },
  "renovacao-de-porte-de-arma-de-fogo": {
    title: "Renovação de Porte de Arma de Fogo | Quero Armas",
    description:
      "Renovação de porte de arma de fogo com fundamentação técnica e jurídica completa, evitando indeferimento e exigências.",
  },
  "porte-de-arma-de-fogo-por-ameaca-grave-ameaca": {
    title: "Porte de Arma por Ameaça / Grave Ameaça | Quero Armas",
    description:
      "Pedido de porte de arma de fogo por ameaça ou grave ameaça: BO, provas, fundamentação jurídica e acompanhamento na Polícia Federal.",
  },
  "porte-funcional-magistrado-ministerio-publico": {
    title: "Porte Funcional — Magistrado e Ministério Público | Quero Armas",
    description:
      "Porte funcional de arma de fogo para magistrados e membros do Ministério Público, com documentação e protocolo conforme a Lei Complementar.",
  },
  "concessao-cr": {
    title: "Concessão de CR (Atirador, Colecionador, Caçador) | Quero Armas",
    description:
      "Assessoria completa para concessão do CR no Exército Brasileiro: documentação, capacitação, vinculação a clube e acompanhamento até a emissão.",
  },
  "renovacao-cr": {
    title: "Renovação de CR (Exército) | Quero Armas",
    description:
      "Renovação do Certificado de Registro de CAC no Exército com gestão do prazo, documentos e protocolo regularizado.",
  },
  "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac": {
    title: "Autorização de Compra — Atirador Esportivo (CAC) | Quero Armas",
    description:
      "Autorização de compra de arma de fogo para atirador esportivo CAC: análise de acervo, documentação e protocolo no Exército.",
  },
  "autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac": {
    title: "Autorização de Compra — Caçador (CAC) | Quero Armas",
    description:
      "Autorização de compra de arma de fogo para caçador CAC com revisão de acervo, documentos exigidos e protocolo correto no Exército.",
  },
  "guia-de-trafego-especial-cac": {
    title: "Guia de Tráfego Especial (CAC) | Quero Armas",
    description:
      "Emissão da Guia de Tráfego Especial para CAC transportar armas e munições com cobertura nacional e validade ampliada.",
  },
  "guia-de-transito-gt": {
    title: "Guia de Trânsito (GT) | Quero Armas",
    description:
      "Guia de Trânsito de arma de fogo para deslocamento legal entre clube, residência e estandes, com emissão rápida e regular.",
  },
  "registro-arma-fogo": {
    title: "Registro de Arma de Fogo (Defesa Pessoal) | Quero Armas",
    description:
      "Registro de arma de fogo para defesa pessoal junto à Polícia Federal, com emissão e renovação do CRAF acompanhada por especialistas.",
  },
  "registro-e-apostilamento-de-arma-de-fogo-cac": {
    title: "Registro e Apostilamento de Arma (CAC) | Quero Armas",
    description:
      "Registro e apostilamento de arma de fogo de CAC no Exército, mantendo o acervo regular e atualizado para portar e transitar.",
  },
  "segunda-via-de-craf-digital": {
    title: "Segunda Via de CRAF Digital | Quero Armas",
    description:
      "Emissão de segunda via do CRAF digital com agilidade, mantendo a regularidade da arma de fogo perante a Polícia Federal.",
  },
  "operador-de-pistola-nivel-i": {
    title: "Curso Operador de Pistola — Nível I | Quero Armas",
    description:
      "Treinamento Operador de Pistola Nível I: fundamentos, segurança, manuseio e tiro real com instrutores credenciados.",
  },
  "vip-operador-de-pistola-nivel-i": {
    title: "VIP — Operador de Pistola Nível I | Quero Armas",
    description:
      "Versão VIP do Operador de Pistola Nível I: turma reduzida, atendimento personalizado e tempo dedicado de instrução.",
  },
  "apostilamento-atualizacao": {
    title: "Apostilamento — Atualização de Acervo (CAC) | Quero Armas",
    description:
      "Atualização e apostilamento do acervo CAC no Exército mantendo o cadastro 100% regular após cada nova aquisição.",
  },
  "mandado-de-seguranca": {
    title: "Mandado de Segurança em Matéria de Armas | Quero Armas",
    description:
      "Impetração de Mandado de Segurança contra atos ilegais ou abusivos da PF/EB em processos relacionados a armas de fogo.",
  },
  "recurso-administrativo": {
    title: "Recurso Administrativo (PF / EB) | Quero Armas",
    description:
      "Recurso administrativo contra indeferimentos da Polícia Federal ou do Exército com fundamentação técnica e jurídica.",
  },
  "transferencia-de-propriedade-de-arma-de-fogo": {
    title: "Transferência de Propriedade de Arma de Fogo | Quero Armas",
    description:
      "Transferência regular da propriedade de arma de fogo entre titulares, com toda a documentação e protocolo correto.",
  },
  "mudanca-servico": {
    title: "Mudança de Serviço (Posse → CR) | Quero Armas",
    description:
      "Migração estratégica de Posse para CR, ampliando seu acervo e direitos como atirador, colecionador ou caçador.",
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
  "lp/defesa-pessoal-posse": {
    title: "Defesa Pessoal — Posse de Arma | Quero Armas",
    description:
      "Quem tem direito, o que precisa e como funciona a posse de arma de fogo para defesa pessoal dentro de casa.",
  },
  "lp/cac-cr": {
    title: "CAC e CR — Como se tornar CAC | Quero Armas",
    description:
      "Caminho completo para se tornar Atirador, Colecionador ou Caçador com CR emitido pelo Exército Brasileiro.",
  },
  "lp/atividades-avulsas": {
    title: "Atividades Avulsas em Armas | Quero Armas",
    description:
      "Serviços avulsos para regularização rápida: guia de tráfego, transferência, segunda via e recursos administrativos.",
  },
};

function ogImageFor(slug) {
  // Imagem específica em /public/og/<slug>.jpg se existir, senão fallback.
  const candidate = path.join(activeDist, "og", `${slug}.jpg`);
  if (fs.existsSync(candidate)) return `${SITE}/og/${slug}.jpg`;
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
  prerenderOg();
}
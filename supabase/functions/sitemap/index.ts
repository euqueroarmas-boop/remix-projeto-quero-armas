import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BASE_URL = "https://www.wmti.com.br";

const services = [
  "infraestrutura-ti", "suporte-ti", "monitoramento-rede",
  "servidores-dell", "microsoft-365", "seguranca-rede", "locacao-computadores",
];

const cities = [
  // Vale do Paraíba
  "jacarei", "sao-jose-dos-campos", "taubate", "cacapava", "pindamonhangaba",
  "guaratingueta", "lorena", "cruzeiro",
  // Grande São Paulo
  "sao-paulo", "guarulhos", "osasco", "santo-andre", "sao-bernardo-do-campo",
  "sao-caetano-do-sul", "diadema", "maua", "mogi-das-cruzes", "suzano",
  "taboao-da-serra", "barueri", "cotia", "itaquaquecetuba",
  // Campinas
  "campinas", "jundiai", "piracicaba", "americana", "limeira",
  "indaiatuba", "sumare", "hortolandia", "valinhos", "vinhedo",
  // Litoral
  "santos", "sao-vicente", "praia-grande",
  // Sorocaba
  "sorocaba", "itu", "salto",
  // Interior Noroeste
  "ribeirao-preto", "sao-jose-do-rio-preto", "barretos", "araraquara", "franca", "sertaozinho",
  // Interior Centro
  "bauru", "marilia", "botucatu", "jau",
  // Interior Oeste
  "presidente-prudente", "aracatuba",
];

const segments = ["cartorios", "hospitais", "escritorios-advocacia", "contabilidade", "industrias"];
const problems = ["rede-lenta", "servidor-travando", "sem-backup", "ataque-ransomware", "computadores-lentos"];

const segmentPrefixes: Record<string, string> = {
  cartorios: "ti-para-cartorios",
  hospitais: "ti-para-hospitais",
  "escritorios-advocacia": "ti-para-escritorios-de-advocacia",
  contabilidade: "ti-para-contabilidades",
  industrias: "ti-para-industrias",
};

// Static/hand-crafted pages
const staticPages = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/orcamento-ti", priority: "0.9", changefreq: "monthly" },
  { loc: "/empresa-de-ti-jacarei", priority: "0.9", changefreq: "monthly" },
  { loc: "/blog", priority: "0.8", changefreq: "weekly" },
  { loc: "/institucional", priority: "0.8", changefreq: "monthly" },
  { loc: "/ti-para-hospitais-e-clinicas", priority: "0.8", changefreq: "monthly" },
  { loc: "/terceirizacao-de-mao-de-obra-ti", priority: "0.8", changefreq: "monthly" },
  { loc: "/cartorios/provimento-213", priority: "0.8", changefreq: "monthly" },
  { loc: "/suporte-ti-jacarei", priority: "0.8", changefreq: "monthly" },
  { loc: "/infraestrutura-ti-corporativa-jacarei", priority: "0.8", changefreq: "monthly" },
  { loc: "/montagem-e-monitoramento-de-redes-jacarei", priority: "0.8", changefreq: "monthly" },
  { loc: "/servidor-dell-poweredge-jacarei", priority: "0.8", changefreq: "monthly" },
  { loc: "/microsoft-365-para-empresas-jacarei", priority: "0.8", changefreq: "monthly" },
  { loc: "/firewall-pfsense-jacarei", priority: "0.8", changefreq: "monthly" },
  { loc: "/backup-empresarial-jacarei", priority: "0.8", changefreq: "monthly" },
  { loc: "/locacao-de-computadores-para-empresas-jacarei", priority: "0.8", changefreq: "monthly" },
  { loc: "/seguranca-informacao-empresarial", priority: "0.8", changefreq: "monthly" },
  { loc: "/empresa-de-ti-sao-jose-dos-campos", priority: "0.8", changefreq: "monthly" },
  { loc: "/empresa-de-ti-taubate", priority: "0.8", changefreq: "monthly" },
  { loc: "/empresa-de-ti-vale-do-paraiba", priority: "0.7", changefreq: "monthly" },
  { loc: "/ti-para-cartorios", priority: "0.8", changefreq: "monthly" },
  { loc: "/ti-para-escritorios-de-advocacia", priority: "0.7", changefreq: "monthly" },
  { loc: "/ti-para-contabilidades", priority: "0.7", changefreq: "monthly" },
  { loc: "/ti-para-escritorios-corporativos", priority: "0.7", changefreq: "monthly" },
  { loc: "/rede-da-empresa-lenta", priority: "0.7", changefreq: "monthly" },
  { loc: "/servidor-da-empresa-travando", priority: "0.7", changefreq: "monthly" },
  { loc: "/empresa-perdeu-dados-o-que-fazer", priority: "0.7", changefreq: "monthly" },
  { loc: "/backup-da-empresa-nao-funciona", priority: "0.7", changefreq: "monthly" },
  { loc: "/como-proteger-a-empresa-contra-ransomware", priority: "0.7", changefreq: "monthly" },
  { loc: "/diagnostico-ti-empresarial", priority: "0.9", changefreq: "monthly" },
  { loc: "/ti-para-serventias-cartoriais", priority: "0.7", changefreq: "monthly" },
  { loc: "/ti-para-industrias-alimenticias", priority: "0.7", changefreq: "monthly" },
  { loc: "/ti-para-industrias-petroliferas", priority: "0.7", changefreq: "monthly" },
];

function urlEntry(loc: string, priority: string, changefreq: string): string {
  return `  <url><loc>${BASE_URL}${loc}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

function buildPagesXml(): string {
  const urls = staticPages.map((p) => urlEntry(p.loc, p.priority, p.changefreq));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}

function buildProgrammaticXml(): string {
  const urls: string[] = [];

  // 1. Service × City
  for (const svc of services) {
    for (const city of cities) {
      urls.push(urlEntry(`/${svc}-${city}`, "0.7", "monthly"));
    }
  }

  // 2. Segment × City
  for (const seg of segments) {
    const prefix = segmentPrefixes[seg] || `ti-para-${seg}`;
    for (const city of cities) {
      urls.push(urlEntry(`/${prefix}-${city}`, "0.6", "monthly"));
    }
  }

  // 3. Problem × City
  for (const prob of problems) {
    for (const city of cities) {
      urls.push(urlEntry(`/${prob}-${city}`, "0.5", "monthly"));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}

function buildBlogXml(): string {
  const blogSlugs = [
    "provimento-213-cnj-desafios-tecnologia-cartorios",
    "vantagens-microsoft-365-para-empresas",
    "quando-trocar-servidor-da-empresa",
    "ransomware-em-hospitais-como-proteger",
    "vazamento-dados-clinicas-medicas-lgpd",
    "backup-para-cartorios-estrategias-seguras",
    "firewall-pfsense-para-empresas-protecao-completa",
    "ataques-ciberneticos-escritorios-advocacia",
    "servidores-dell-poweredge-seguranca-dados",
    "lgpd-para-clinicas-e-hospitais-guia-pratico",
    "como-ransomware-ataca-cartorios",
    "falhas-infraestrutura-ti-hospitais",
    "backup-automatizado-clinicas-medicas",
    "segmentacao-rede-hospitalar-seguranca",
    "phishing-em-escritorios-advocacia-como-evitar",
    "redundancia-internet-clinicas-hospitais",
    "ransomware-wannacry-licoes-para-empresas",
    "vpn-segura-para-escritorios-advocacia",
    "como-proteger-prontuario-eletronico",
    "servidor-dedicado-vs-nuvem-para-empresas",
    "politica-seguranca-informacao-empresas",
    "backup-3-2-1-estrategia-para-empresas",
    "monitoramento-rede-prevencao-ataques",
    "lgpd-para-cartorios-adequacao-necessaria",
    "ataques-ddos-como-proteger-empresa",
    "ransomware-como-servico-ameaca-crescente",
    "recuperacao-desastres-ti-plano-pratico",
    "seguranca-email-corporativo-ameacas-comuns",
    "virtualizacao-servidores-seguranca-performance",
    "ciberseguranca-para-pequenas-empresas",
    "auditoria-seguranca-ti-por-que-fazer",
    "criptografia-dados-empresariais-guia",
    "equipamentos-medicos-conectados-riscos-seguranca",
    "guia-completo-infraestrutura-ti-empresas",
    "firewall-empresarial-empresa-precisa",
    "servidor-caiu-empresa-o-que-fazer",
    "quanto-custa-infraestrutura-ti-empresas",
    "infraestrutura-ti-empresas-jacarei",
    "rede-escritorio-25-computadores",
  ];

  const urls = [urlEntry("/blog", "0.8", "weekly")];

  for (const slug of blogSlugs) {
    urls.push(urlEntry(`/blog/${slug}`, "0.6", "monthly"));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}

function buildSitemapIndex(): string {
  const now = new Date().toISOString().split("T")[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${BASE_URL}/sitemap-pages.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${BASE_URL}/sitemap-blog.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${BASE_URL}/sitemap-programmatic.xml</loc><lastmod>${now}</lastmod></sitemap>
</sitemapindex>`;
}

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.searchParams.get("type") || "index";

  let xml: string;
  switch (path) {
    case "pages":
      xml = buildPagesXml();
      break;
    case "blog":
      xml = buildBlogXml();
      break;
    case "programmatic":
      xml = buildProgrammaticXml();
      break;
    default:
      xml = buildSitemapIndex();
  }

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
});

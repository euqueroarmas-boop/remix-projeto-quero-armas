import {
  serviceSlugs,
  segmentEntries,
  problemSlugs,
  blogSlugs,
  citySlugs,
} from "../_shared/seo-data.ts";

const BASE_URL = "https://www.wmti.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Static / hand-crafted pages ───
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
  { loc: "/administracao-de-servidores", priority: "0.7", changefreq: "monthly" },
  { loc: "/monitoramento-de-servidores", priority: "0.7", changefreq: "monthly" },
  { loc: "/backup-corporativo", priority: "0.7", changefreq: "monthly" },
  { loc: "/seguranca-de-rede", priority: "0.7", changefreq: "monthly" },
  { loc: "/monitoramento-de-rede", priority: "0.7", changefreq: "monthly" },
  { loc: "/suporte-tecnico-emergencial", priority: "0.7", changefreq: "monthly" },
  { loc: "/suporte-windows-server", priority: "0.7", changefreq: "monthly" },
  { loc: "/suporte-linux", priority: "0.7", changefreq: "monthly" },
  { loc: "/manutencao-de-infraestrutura-de-ti", priority: "0.7", changefreq: "monthly" },
  { loc: "/suporte-tecnico-para-redes-corporativas", priority: "0.7", changefreq: "monthly" },
  { loc: "/automacao-de-ti-com-inteligencia-artificial", priority: "0.7", changefreq: "monthly" },
  { loc: "/automacao-alexa-casa-empresa-inteligente", priority: "0.7", changefreq: "monthly" },
  { loc: "/reestruturacao-completa-de-rede-corporativa", priority: "0.7", changefreq: "monthly" },
  { loc: "/desenvolvimento-de-sites-e-sistemas-web", priority: "0.7", changefreq: "monthly" },
];

function urlEntry(loc: string): string {
  return `  <url>\n    <loc>${BASE_URL}${loc}</loc>\n  </url>`;
}

function wrapUrlset(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}

// ─── Sub-sitemap builders ───

function buildPagesXml(): string {
  return wrapUrlset(staticPages.map((p) => urlEntry(p.loc, p.priority, p.changefreq)));
}

function buildBlogXml(): string {
  const urls = [urlEntry("/blog", "0.8", "weekly")];
  for (const slug of blogSlugs) {
    urls.push(urlEntry(`/blog/${slug}`, "0.6", "monthly"));
  }
  return wrapUrlset(urls);
}

/** Service × City with canonical -em- pattern */
function buildServiceCityXml(): string {
  const urls: string[] = [];
  for (const svc of serviceSlugs) {
    for (const city of citySlugs) {
      urls.push(urlEntry(`/${svc}-em-${city}`, "0.7", "monthly"));
    }
  }
  return wrapUrlset(urls);
}

/** Segment × City with canonical -em- pattern */
function buildSegmentCityXml(): string {
  const urls: string[] = [];
  for (const seg of segmentEntries) {
    for (const city of citySlugs) {
      urls.push(urlEntry(`/${seg.prefix}-em-${city}`, "0.6", "monthly"));
    }
  }
  return wrapUrlset(urls);
}

/** Problem × City with -em- pattern */
function buildProblemCityXml(): string {
  const urls: string[] = [];
  for (const prob of problemSlugs) {
    for (const city of citySlugs) {
      urls.push(urlEntry(`/${prob}-em-${city}`, "0.5", "monthly"));
    }
  }
  return wrapUrlset(urls);
}

function buildBlogCityXml(): string {
  const urls: string[] = [];
  for (const slug of blogSlugs) {
    for (const city of citySlugs) {
      urls.push(urlEntry(`/blog-${slug}-${city}`, "0.4", "monthly"));
    }
  }
  return wrapUrlset(urls);
}

function buildServiceSegmentCityXml(): string {
  const urls: string[] = [];
  for (const svc of serviceSlugs) {
    for (const seg of segmentEntries) {
      for (const city of citySlugs) {
        urls.push(urlEntry(`/${svc}-${seg.slug}-${city}`, "0.5", "monthly"));
      }
    }
  }
  return wrapUrlset(urls);
}

function buildSitemapIndex(): string {
  const now = new Date().toISOString().split("T")[0];
  const sitemaps = [
    "sitemap-pages.xml",
    "sitemap-blog.xml",
    "sitemap-programmatic.xml",
    "sitemap-services.xml",
    "sitemap-segments.xml",
    "sitemap-problems.xml",
    "sitemap-blog-cities.xml",
    "sitemap-service-segment-cities.xml",
  ];
  const entries = sitemaps
    .map((s) => `  <sitemap><loc>${BASE_URL}/${s}</loc><lastmod>${now}</lastmod></sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "index";

  let xml: string;
  switch (type) {
    case "pages":
      xml = buildPagesXml();
      break;
    case "blog":
      xml = buildBlogXml();
      break;
    case "services":
      xml = buildServiceCityXml();
      break;
    case "segments":
      xml = buildSegmentCityXml();
      break;
    case "problems":
      xml = buildProblemCityXml();
      break;
    case "blog-cities":
      xml = buildBlogCityXml();
      break;
    case "service-segment-cities":
      xml = buildServiceSegmentCityXml();
      break;
    case "programmatic":
      xml = buildServiceCityXml();
      break;
    default:
      xml = buildSitemapIndex();
  }

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
});

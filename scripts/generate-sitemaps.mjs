import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const publicDir = path.join(projectRoot, "public");
const seoDataPath = path.join(projectRoot, "supabase/functions/_shared/seo-data.ts");
const BASE_URL = "https://www.wmti.com.br";

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

function extractArray(source, exportName) {
  const regex = new RegExp(`export const ${exportName}\\s*=\\s*(\\[[\\s\\S]*?\\]);`);
  const match = source.match(regex);
  if (!match) throw new Error(`Array not found: ${exportName}`);
  return Function(`return (${match[1]});`)();
}

function extractSegmentEntries(source) {
  const regex = /export const segmentEntries:[^=]*=\s*(\[[\s\S]*?\]);/;
  const match = source.match(regex);
  if (!match) throw new Error("Array not found: segmentEntries");
  return Function(`return (${match[1]});`)();
}

function urlEntry(loc, priority, changefreq) {
  return `  <url><loc>${BASE_URL}${loc}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

function wrapUrlset(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}

function buildSitemapIndex() {
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

function writeFile(name, content) {
  fs.writeFileSync(path.join(publicDir, name), content, "utf8");
}

const seoDataSource = fs.readFileSync(seoDataPath, "utf8");
const serviceSlugs = extractArray(seoDataSource, "serviceSlugs");
const problemSlugs = extractArray(seoDataSource, "problemSlugs");
const blogSlugs = extractArray(seoDataSource, "blogSlugs");
const citySlugs = extractArray(seoDataSource, "citySlugs");
const segmentEntries = extractSegmentEntries(seoDataSource);

const pagesXml = wrapUrlset(staticPages.map((p) => urlEntry(p.loc, p.priority, p.changefreq)));
const blogXml = wrapUrlset([
  urlEntry("/blog", "0.8", "weekly"),
  ...blogSlugs.map((slug) => urlEntry(`/blog/${slug}`, "0.6", "monthly")),
]);
const servicesXml = wrapUrlset(
  serviceSlugs.flatMap((svc) => citySlugs.map((city) => urlEntry(`/${svc}-em-${city}`, "0.7", "monthly"))),
);
const segmentsXml = wrapUrlset(
  segmentEntries.flatMap((seg) => citySlugs.map((city) => urlEntry(`/${seg.prefix}-em-${city}`, "0.6", "monthly"))),
);
const problemsXml = wrapUrlset(
  problemSlugs.flatMap((prob) => citySlugs.map((city) => urlEntry(`/${prob}-em-${city}`, "0.5", "monthly"))),
);
const blogCitiesXml = wrapUrlset(
  blogSlugs.flatMap((slug) => citySlugs.map((city) => urlEntry(`/blog-${slug}-${city}`, "0.4", "monthly"))),
);
const serviceSegmentCitiesXml = wrapUrlset(
  serviceSlugs.flatMap((svc) =>
    segmentEntries.flatMap((seg) => citySlugs.map((city) => urlEntry(`/${svc}-${seg.slug}-${city}`, "0.5", "monthly"))),
  ),
);

writeFile("sitemap.xml", buildSitemapIndex());
writeFile("sitemap-pages.xml", pagesXml);
writeFile("sitemap-blog.xml", blogXml);
writeFile("sitemap-programmatic.xml", servicesXml);
writeFile("sitemap-services.xml", servicesXml);
writeFile("sitemap-segments.xml", segmentsXml);
writeFile("sitemap-problems.xml", problemsXml);
writeFile("sitemap-blog-cities.xml", blogCitiesXml);
writeFile("sitemap-service-segment-cities.xml", serviceSegmentCitiesXml);

console.log("Static sitemaps generated in /public");

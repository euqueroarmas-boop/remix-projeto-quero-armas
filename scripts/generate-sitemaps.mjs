import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const publicDir = path.join(projectRoot, "public");
const seoDataPath = path.join(projectRoot, "supabase/functions/_shared/seo-data.ts");
const BASE_URL = "https://www.wmti.com.br";
const MAX_URLS_PER_SITEMAP = 45000;

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
  const regex = new RegExp(`export const ${exportName}(?::[^=]+)?\\s*=\\s*(\\[[\\s\\S]*?\\]);`);
  const match = source.match(regex);
  if (!match) throw new Error(`Array not found: ${exportName}`);
  return Function(`return (${match[1]});`)();
}

function urlEntry(loc) {
  return `  <url>\n    <loc>${BASE_URL}${loc}</loc>\n  </url>`;
}


function wrapUrlset(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}

/** Split an array of URL entries into chunks of MAX_URLS_PER_SITEMAP */
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function writeFile(name, content) {
  fs.writeFileSync(path.join(publicDir, name), content, "utf8");
}

// ─── Read SEO data ───
const seoDataSource = fs.readFileSync(seoDataPath, "utf8");
const serviceSlugs = extractArray(seoDataSource, "serviceSlugs");
const segmentEntries = extractArray(seoDataSource, "segmentEntries");
const problemSlugs = extractArray(seoDataSource, "problemSlugs");
const blogSlugs = extractArray(seoDataSource, "blogSlugs");
const citySlugs = extractArray(seoDataSource, "citySlugs");

// ─── Track all sitemap filenames for the index ───
const sitemapFiles = [];

// 1. Static pages
const pagesXml = wrapUrlset(staticPages.map((page) => urlEntry(page.loc)));
writeFile("sitemap-pages.xml", pagesXml);
sitemapFiles.push("sitemap-pages.xml");

// 2. Blog
const blogXml = wrapUrlset([
  urlEntry("/blog"),
  ...blogSlugs.map((slug) => urlEntry(`/blog/${slug}`)),
]);
writeFile("sitemap-blog.xml", blogXml);
sitemapFiles.push("sitemap-blog.xml");

// 3. Programmatic (service × city) — pattern: /{service}-em-{city}
const programmaticUrls = serviceSlugs.flatMap((svc) =>
  citySlugs.map((city) => urlEntry(`/${svc}-em-${city}`))
);
const programmaticChunks = chunkArray(programmaticUrls, MAX_URLS_PER_SITEMAP);
programmaticChunks.forEach((chunk, i) => {
  const name = programmaticChunks.length === 1
    ? "sitemap-programmatic.xml"
    : `sitemap-programmatic-${i + 1}.xml`;
  writeFile(name, wrapUrlset(chunk));
  sitemapFiles.push(name);
});

// 4. Segments (segment × city) — pattern: /{segment-prefix}-em-{city}
const segmentUrls = segmentEntries.flatMap((seg) =>
  citySlugs.map((city) => urlEntry(`/${seg.prefix}-em-${city}`))
);
const segmentChunks = chunkArray(segmentUrls, MAX_URLS_PER_SITEMAP);
segmentChunks.forEach((chunk, i) => {
  const name = segmentChunks.length === 1
    ? "sitemap-segments.xml"
    : `sitemap-segments-${i + 1}.xml`;
  writeFile(name, wrapUrlset(chunk));
  sitemapFiles.push(name);
});

// 5. Problems (problem × city) — pattern: /{problem}-em-{city}
const problemUrls = problemSlugs.flatMap((prob) =>
  citySlugs.map((city) => urlEntry(`/${prob}-em-${city}`))
);
const problemChunks = chunkArray(problemUrls, MAX_URLS_PER_SITEMAP);
problemChunks.forEach((chunk, i) => {
  const name = problemChunks.length === 1
    ? "sitemap-problems.xml"
    : `sitemap-problems-${i + 1}.xml`;
  writeFile(name, wrapUrlset(chunk));
  sitemapFiles.push(name);
});

// 6. Service × Segment × City — REMOVED
// These URLs used a non-standard pattern (/{svc}-{seg}-{city}) that doesn't match
// the engine's /{entity}-em-{city} pattern, resulting in soft 404s.
// All valid combinations are already covered by programmatic + segment sitemaps.

// ─── Build sitemap index ───
const now = new Date().toISOString().split("T")[0];
const indexEntries = sitemapFiles
  .map((name) => `  <sitemap><loc>${BASE_URL}/${name}</loc><lastmod>${now}</lastmod></sitemap>`)
  .join("\n");
const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexEntries}\n</sitemapindex>`;
writeFile("sitemap.xml", sitemapIndex);

// ─── Summary ───
console.log(`Sitemaps generated: ${sitemapFiles.length + 1} files (including index)`);
sitemapFiles.forEach((f) => {
  const stat = fs.statSync(path.join(publicDir, f));
  const content = fs.readFileSync(path.join(publicDir, f), "utf8");
  const count = (content.match(/<url>/g) || []).length;
  console.log(`  ${f}: ${count} URLs (${(stat.size / 1024).toFixed(0)} KB)`);
});

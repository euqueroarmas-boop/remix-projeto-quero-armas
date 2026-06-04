// Gera sitemap.xml para Eu Quero Armas (rotas públicas apenas)
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const publicDir = path.join(projectRoot, "public");
const BASE_URL = "https://www.euqueroarmas.com.br";

const today = new Date().toISOString().slice(0, 10);

// Apenas rotas públicas (não admin / não portal autenticado)
const publicPages = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/servicos", priority: "0.9", changefreq: "monthly" },
  { loc: "/cadastro", priority: "0.9", changefreq: "monthly" },
  { loc: "/curso-operador-pistola", priority: "0.8", changefreq: "monthly" },
  { loc: "/descobrir-meu-caminho", priority: "0.7", changefreq: "monthly" },
  { loc: "/lp/defesa-pessoal-posse", priority: "0.8", changefreq: "monthly" },
  { loc: "/lp/cac-cr", priority: "0.8", changefreq: "monthly" },
  { loc: "/lp/atividades-avulsas", priority: "0.7", changefreq: "monthly" },
  { loc: "/login", priority: "0.5", changefreq: "monthly" },
  { loc: "/area-do-cliente/login", priority: "0.5", changefreq: "monthly" },
];

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const urls = publicPages
  .map(
    (p) => `  <url>
    <loc>${escape(BASE_URL + p.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
  )
  .join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemap, "utf8");
console.log(`✓ sitemap.xml gerado com ${publicPages.length} URLs (${BASE_URL})`);

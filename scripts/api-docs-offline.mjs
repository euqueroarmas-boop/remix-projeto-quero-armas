#!/usr/bin/env node
/**
 * Deixa a referência HTML da API 100% offline.
 *
 * O `redocly build-docs` gera um HTML que ainda puxa o bundle do Redoc e as
 * fontes do Google por CDN. Isso quebra em dois cenários que a gente usa:
 * abrir o arquivo sem internet e publicar a página com CSP restritiva.
 *
 * O HTML gerado já vem com todo o conteúdo pré-renderizado (SSR), então dá
 * para simplesmente remover o JS e ficar com uma referência estática legível.
 *
 * Uso:
 *   node scripts/api-docs-offline.mjs docs/api/arsenal-inteligente-produtos.html
 */

import { readFile, writeFile } from "node:fs/promises";
import { argv, exit } from "node:process";

const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2" +
  "?family=Inter:wght@400;500;600&family=Oswald:wght@500;600&display=swap";

const arquivo = argv[2];
if (!arquivo) {
  console.error("uso: node scripts/api-docs-offline.mjs <arquivo.html>");
  exit(1);
}

/** Baixa Inter e Oswald (subset latin) e devolve @font-face com data URI. */
async function fontesEmbutidas() {
  const resp = await fetch(GOOGLE_FONTS, {
    // O UA precisa parecer Chrome de verdade: sem os tokens AppleWebKit/Safari
    // o Google devolve TTF (charset inteiro, megabytes) em vez de woff2 latin.
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!resp.ok) throw new Error(`Google Fonts respondeu ${resp.status}`);
  const css = await resp.text();

  const blocos = [...css.matchAll(/\/\*\s*latin\s*\*\/\s*(@font-face\s*\{[\s\S]*?\})/g)];
  // Um arquivo variável por família cobre todos os pesos — não duplicar o base64.
  const porFamilia = new Map();
  for (const [, bloco] of blocos) {
    const familia = bloco.match(/font-family:\s*'([^']+)'/)?.[1];
    const url = bloco.match(/url\((https:\/\/[^)]+)\)/)?.[1];
    const range = bloco.match(/unicode-range:\s*([^;]+);/)?.[1];
    if (familia && url && !porFamilia.has(familia)) porFamilia.set(familia, { url, range });
  }

  if (porFamilia.size === 0) {
    throw new Error("nenhuma @font-face woff2/latin encontrada na resposta");
  }

  const faces = [];
  for (const [familia, { url, range }] of porFamilia) {
    const woff2 = Buffer.from(await (await fetch(url)).arrayBuffer());
    faces.push(
      `@font-face{font-family:'${familia}';font-style:normal;font-weight:100 900;` +
        `font-display:swap;src:url(data:font/woff2;base64,${woff2.toString("base64")}) ` +
        `format('woff2');unicode-range:${range};}`,
    );
    console.log(`  fonte embutida: ${familia} (${Math.round(woff2.length / 1024)} KB)`);
  }
  return faces.join("\n");
}

let html = await readFile(arquivo, "utf8");
const tamanhoOriginal = html.length;

// 1) fora o bundle do Redoc por CDN — o conteúdo já está pré-renderizado
html = html.replace(
  /<script[^>]*src="https:\/\/cdn\.redocly\.com[^"]*"[^>]*>\s*<\/script>/g,
  "",
);
// 2) fora o link das fontes do Google (entram embutidas abaixo)
html = html.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/g, "");
// 3) fora o estado de hidratação — inútil sem o JS e pesa ~120 KB
html = html.replace(/<script>\s*const __redoc_state[\s\S]*?<\/script>/g, "");

let css = "";
try {
  css = await fontesEmbutidas();
} catch (erro) {
  console.warn(`  aviso: fontes não embutidas (${erro.message}); usando as do sistema`);
}

// Sem JS o Redoc não pinta o fundo da página e a caixa de busca fica morta.
// O menu lateral continua valendo: são âncoras (#tag/...), funcionam sem JS.
css +=
  "\nhtml,body{background:#FFFFFF;color:#0A0A0A;}" +
  "\n[role=search]{display:none!important;}";

html = html.replace("</head>", `<style>${css}</style></head>`);

await writeFile(arquivo, html);
console.log(
  `  ${arquivo}: ${Math.round(tamanhoOriginal / 1024)} KB -> ${Math.round(html.length / 1024)} KB`,
);

const externos = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
const recursos = externos.filter((u) => !u.startsWith("https://redocly.com/"));
if (recursos.length) {
  console.error("  ERRO: ainda há recursos externos:", recursos);
  exit(1);
}
console.log("  ok: nenhum recurso externo restante");

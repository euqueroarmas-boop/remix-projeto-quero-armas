const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";
const PHOTO_EXT_RE = /\.(?:jpe?g|png|webp|avif)(?:[?#].*)?$/i;
const BLOCK_RE = /(?:logo|favicon|sprite|placeholder|avatar|truck|caminhao|bombeiro|fire-?truck|banner|\/icon|icons\/|\/flags?\/|country_flag|bandeira|wallpaper|cartoon|toy|loader|spinner|payment|badge|social|youtube|facebook|instagram|linkedin)/i;

type Candidate = { url: string; context: string; source: string; score: number };
type ScrapeResult = { html: string; rawHtml: string; markdown: string; links: string[]; metadata: Record<string, unknown>; images: string[] };

function slugTokens(pathname: string): string[] {
  // Ex.: /en/product/92-fs-inox-P0049 -> ["92","fs","inox","p0049","92fs","92fsinox"]
  const last = pathname.split("/").filter(Boolean).pop() || "";
  const cleaned = last.toLowerCase().replace(/\.(html?|php|aspx?)$/i, "");
  const parts = cleaned.split(/[-_.]+/).filter((p) => p.length >= 2);
  const tokens = new Set<string>(parts);
  if (parts.length > 1) {
    tokens.add(parts.join(""));
    tokens.add(parts.slice(0, 2).join(""));
    tokens.add(parts.slice(0, 3).join(""));
  }
  // Remove tokens genéricos
  for (const t of ["product","produto","item","details","detail","page","en","pt","br","www"]) tokens.delete(t);
  return [...tokens].filter((t) => t.length >= 2);
}

function matchesSlug(candidate: Candidate, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = `${candidate.url} ${candidate.context}`.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return tokens.some((t) => haystack.includes(t));
}

function decodeLoose(value: string): string {
  return value
    .replace(/\\u002[Ff]/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function resolveUrl(src: string, base: URL): string {
  const cleaned = decodeLoose(src).replace(/^url\((['"]?)(.*?)\1\)$/i, "$2").trim();
  if (!cleaned || cleaned.startsWith("data:") || cleaned.startsWith("blob:") || cleaned.startsWith("#")) return "";
  try { return new URL(cleaned, base).href; } catch { return ""; }
}

function imageScore(url: string, context = ""): number {
  const text = `${url} ${context}`.toLowerCase();
  let score = 0;
  if (/product|produto|firearm|weapon|gallery|slide|pdp|sku|modelo|model|arma|gun|pistol|rifle|shotgun|carbine|revolver/.test(text)) score += 60;
  if (/\/content\/dam\/|\/dam\/|\/media\/|\/products?\/|\/catalog\//.test(text)) score += 40;
  if (/web-?1400|1400x|x1400|large|zoom|original|main|hero/.test(text)) score += 35;
  if (/web-?700|700x|x700|medium/.test(text)) score += 22;
  if (/web-?80|80x|x80|thumb|thumbnail|preview/.test(text)) score -= 30;
  if (/\.webp(?:[?#]|$)/.test(text)) score += 8;
  if (/\.png(?:[?#]|$)/.test(text)) score += 4;
  if (BLOCK_RE.test(text)) score -= 120;
  return score;
}

function canonicalKey(url: string): string {
  return url
    .toLowerCase()
    .replace(/([?#]).*$/, "")
    .replace(/\/renditions\/web-\d+\.(?:webp|png|jpe?g|avif)$/i, "")
    .replace(/[-_](?:thumb|thumbnail|preview|small|medium|large|web-?\d+)(?=\.)/i, "")
    .replace(/\.(?:webp|png|jpe?g|avif)$/i, "");
}

function pushCandidate(map: Map<string, Candidate>, raw: string, base: URL, context: string, source: string) {
  const url = resolveUrl(raw, base);
  if (!url || !/^https?:\/\//i.test(url)) return;
  const path = new URL(url).pathname;
  if (!PHOTO_EXT_RE.test(path) && !/\/renditions\//i.test(path)) return;
  const score = imageScore(url, context);
  if (score < -40) return;
  const key = canonicalKey(url);
  const candidate = { url, context, source, score };
  const previous = map.get(key);
  if (!previous || candidate.score > previous.score || candidate.url.length > previous.url.length) map.set(key, candidate);
}

function collectUrlsFromText(text: string, base: URL, map: Map<string, Candidate>, source: string) {
  const normalized = decodeLoose(text);
  const urlRe = /(?:https?:)?\/\/[^\s"'<>\\]+?(?:\.(?:jpe?g|png|webp|avif)|\/renditions\/[^\s"'<>\\]+?)(?:\?[^\s"'<>\\]*)?/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRe.exec(normalized))) {
    pushCandidate(map, match[0], base, normalized.slice(Math.max(0, match.index - 160), match.index + 260), source);
  }
}

function collectFromAttributes(html: string, base: URL, map: Map<string, Candidate>) {
  const tagRe = /<[^>]+>/g;
  const attrRe = /([:@\w-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
  let tag: RegExpExecArray | null;
  while ((tag = tagRe.exec(html))) {
    const tagText = decodeLoose(tag[0]);
    let attr: RegExpExecArray | null;
    while ((attr = attrRe.exec(tagText))) {
      const name = attr[1].toLowerCase();
      const value = attr[2].replace(/^['"]|['"]$/g, "");
      if (!/(src|srcset|image|images|thumb|thumbnail|href|content|data-|poster|background)/i.test(name)) continue;
      for (const part of value.split(",")) {
        const candidate = part.trim().split(/\s+/)[0];
        pushCandidate(map, candidate, base, tagText, `attr:${name}`);
      }
    }
  }
}

function collectCssImages(html: string, base: URL, map: Map<string, Candidate>) {
  const cssRe = /url\((['"]?)(.*?)\1\)/gi;
  let match: RegExpExecArray | null;
  while ((match = cssRe.exec(html))) pushCandidate(map, match[2], base, html.slice(Math.max(0, match.index - 120), match.index + 180), "css");
}

function collectJsonLdImages(html: string, base: URL, map: Map<string, Candidate>) {
  const jsonLdRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonLdRe.exec(html))) collectUrlsFromText(match[1], base, map, "jsonld");
}

function extractImages(documents: string[], pageUrl: string, extras: string[] = []): Candidate[] {
  const base = new URL(pageUrl);
  const map = new Map<string, Candidate>();
  for (const rawDoc of documents) {
    const doc = decodeLoose(rawDoc || "");
    if (!doc) continue;
    collectFromAttributes(doc, base, map);
    collectCssImages(doc, base, map);
    collectJsonLdImages(doc, base, map);
    collectUrlsFromText(doc, base, map, "text");
  }
  for (const extra of extras) pushCandidate(map, extra, base, extra, "metadata");
  return [...map.values()].sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<ScrapeResult | null> {
  try {
    const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["html", "rawHtml", "markdown", "links"],
        onlyMainContent: false,
        waitFor: 5000,
        timeout: 30000,
        mobile: false,
      }),
    });
    const data = await res.json().catch(() => null) as any;
    if (!res.ok || !data) return null;
    const root = data?.data ?? data;
    const metadata = root?.metadata || {};
    const links = Array.isArray(root?.links) ? root.links : [];
    const images: string[] = [];
    for (const key of ["ogImage", "og:image", "twitterImage", "image", "imageUrl"]) {
      const value = metadata?.[key];
      if (typeof value === "string") images.push(value);
      if (Array.isArray(value)) images.push(...value.filter((v) => typeof v === "string"));
    }
    if (Array.isArray(root?.images)) images.push(...root.images.filter((v: unknown) => typeof v === "string"));
    images.push(...links.filter((l: string) => /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)|\/renditions\//i.test(l)));
    return { html: root?.html || "", rawHtml: root?.rawHtml || "", markdown: root?.markdown || "", links, metadata, images };
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

function buildSearchHints(url: string, marca?: string, modelo?: string): string[] {
  const hints = new Set<string>();
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const terms = `${marca || ""} ${modelo || ""}`.replace(/\s+/g, " ").trim();
  if (terms) {
    hints.add(`${terms} official product image`);
    if (host) hints.add(`site:${host} ${terms} image`);
  }
  return [...hints];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { url, marca, modelo } = await req.json().catch(() => ({}));
    if (!url || typeof url !== "string") return json({ error: "url é obrigatória", imagens: [] }, 400);
    let parsed: URL;
    try { parsed = new URL(url); } catch { return json({ error: "URL inválida", imagens: [] }, 400); }
    if (!/^https?:$/.test(parsed.protocol)) return json({ error: "Protocolo não suportado", imagens: [] }, 400);

    const documents: string[] = [];
    const extras: string[] = [];
    const fontes: string[] = [];
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (FIRECRAWL_API_KEY) {
      const fc = await scrapeWithFirecrawl(url, FIRECRAWL_API_KEY);
      if (fc) {
        documents.push(fc.html, fc.rawHtml, fc.markdown, JSON.stringify(fc.metadata || {}), fc.links.join("\n"));
        extras.push(...fc.images);
        fontes.push("renderizacao_js");
      }
    }

    const staticHtml = await fetchHtml(url);
    if (staticHtml) {
      documents.push(staticHtml);
      fontes.push("html_estatico");
    }

    const candidates = extractImages(documents, url, extras);
    const tokens = slugTokens(parsed.pathname);
    const filtrados = candidates.filter((c) => matchesSlug(c, tokens));
    // Se o filtro zerar tudo (slug muito genérico), cai pro conjunto completo
    const finalSet = filtrados.length > 0 ? filtrados : candidates;
    const imagens = finalSet.map((c) => c.url).slice(0, 80);

    return json({
      imagens,
      total: imagens.length,
      fontes,
      slug_tokens: tokens,
      descartadas_fora_da_url: candidates.length - finalSet.length,
      aviso: imagens.length === 0
        ? "Nenhuma imagem rastreável foi encontrada. O site pode bloquear robôs ou exigir uma etapa de país/idade antes do produto."
        : undefined,
      sugestoes_busca: imagens.length === 0 ? buildSearchHints(url, marca, modelo) : undefined,
    });
  } catch (e) {
    return json({ error: (e as Error).message || "Erro desconhecido", imagens: [] }, 200);
  }
});

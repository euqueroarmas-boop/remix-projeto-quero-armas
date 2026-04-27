const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BLOCK_RE = /logo|favicon|sprite|placeholder|avatar|truck|caminhao|bombeiro|fire-?truck|banner|\/icon|\/bg\/|wallpaper|cartoon|toy|flag|bandeira/i;

function resolveUrl(src: string, base: URL): string {
  try { return new URL(src, base).href; } catch { return ""; }
}

function extractImagesFromHtml(html: string, pageUrl: string, marca?: string, modelo?: string): string[] {
  const base = new URL(pageUrl);
  const found: string[] = [];

  // og:image (prioritário)
  const ogRe = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = ogRe.exec(html))) {
    const u = resolveUrl(m[1], base);
    if (u) found.push(u);
  }

  // <img>
  const imgRe = /<img\b[^>]*>/gi;
  const attrRe = /(src|data-src|data-lazy-src|data-original|srcset)=["']([^"']+)["']/gi;
  const altRe = /\balt=["']([^"']*)["']/i;
  const widthRe = /\bwidth=["']?(\d+)/i;

  let tag: RegExpExecArray | null;
  while ((tag = imgRe.exec(html))) {
    const t = tag[0];
    const altMatch = altRe.exec(t);
    const alt = (altMatch?.[1] || "").toLowerCase();
    const wMatch = widthRe.exec(t);
    const width = wMatch ? parseInt(wMatch[1], 10) : 0;

    let attr: RegExpExecArray | null;
    attrRe.lastIndex = 0;
    while ((attr = attrRe.exec(t))) {
      const raw = attr[2];
      // srcset: pega a primeira URL
      const candidate = raw.split(",")[0].trim().split(/\s+/)[0];
      if (!candidate) continue;
      const url = resolveUrl(candidate, base);
      if (!url || !url.startsWith("http")) continue;
      const lower = url.toLowerCase();
      if (BLOCK_RE.test(lower) || BLOCK_RE.test(alt)) continue;
      if (!/\.(jpe?g|png|webp|avif)(\?|#|$)/i.test(lower)) continue;
      // se temos marca/modelo, dá preferência mas não exige
      const tokens = `${marca || ""} ${modelo || ""}`.toLowerCase().split(/\s+/).filter((x) => x.length >= 2);
      const matchesToken = tokens.some((tk) => lower.includes(tk) || alt.includes(tk));
      if (tokens.length > 0 && !matchesToken && width > 0 && width < 200) continue;
      found.push(url);
    }
  }

  return [...new Set(found)];
}

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

/** Tenta scrape via Firecrawl (renderiza JavaScript). */
async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<{ html: string; markdown: string; images: string[] } | null> {
  try {
    const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["rawHtml", "markdown", "links"],
        onlyMainContent: false,
        waitFor: 2500,
      }),
    });
    const data = await res.json().catch(() => null) as any;
    if (!res.ok || !data) return null;
    const root = data?.data ?? data;
    const html: string = root?.rawHtml || root?.html || "";
    const markdown: string = root?.markdown || "";
    // extra: imagens em <links> ou metadata.ogImage
    const ogImage: string | undefined = root?.metadata?.ogImage;
    const links: string[] = Array.isArray(root?.links) ? root.links : [];
    const images = links.filter((l) => /\.(jpe?g|png|webp|avif)(\?|#|$)/i.test(l));
    if (ogImage) images.unshift(ogImage);
    return { html, markdown, images };
  } catch {
    return null;
  }
}

/** Fallback: fetch estático (funciona em sites SSR). */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; QueroArmasBot/1.0; +https://www.euqueroarmas.com.br)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { url, marca, modelo } = await req.json().catch(() => ({}));
    if (!url || typeof url !== "string") return json({ error: "url é obrigatória" }, 400);
    let parsed: URL;
    try { parsed = new URL(url); } catch { return json({ error: "URL inválida" }, 400); }
    if (!/^https?:$/.test(parsed.protocol)) return json({ error: "Protocolo não suportado" }, 400);

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const collected = new Set<string>();

    // 1) Firecrawl (renderiza JavaScript) — caminho preferido
    if (FIRECRAWL_API_KEY) {
      const fc = await scrapeWithFirecrawl(url, FIRECRAWL_API_KEY);
      if (fc) {
        for (const img of extractImagesFromHtml(fc.html, url, marca, modelo)) collected.add(img);
        for (const img of fc.images) collected.add(img);
      }
    }

    // 2) Fallback: fetch estático (sites SSR ainda funcionam)
    if (collected.size === 0) {
      const html = await fetchHtml(url);
      if (html) {
        for (const img of extractImagesFromHtml(html, url, marca, modelo)) collected.add(img);
      }
    }

    const imagens = [...collected];
    if (imagens.length === 0) {
      const motivo = FIRECRAWL_API_KEY
        ? "Nenhuma imagem encontrada (página pode bloquear bots)."
        : "Conector Firecrawl não está ativo — sites com JavaScript não renderizam.";
      return json({ imagens: [], aviso: motivo });
    }
    return json({ imagens });
  } catch (e) {
    return json({ error: (e as Error).message || "Erro desconhecido", imagens: [] }, 200);
  }
});
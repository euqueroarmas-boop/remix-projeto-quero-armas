import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decode as pngDecode, encode as pngEncode } from "https://deno.land/x/pngs@0.1.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

/** Tipo → palavras chave em inglês para refinar a busca */
const TIPO_KEYWORDS: Record<string, string> = {
  pistola: "semi-automatic pistol product photo white background",
  revolver: "revolver firearm product photo white background",
  espingarda: "shotgun firearm product photo white background",
  carabina: "carbine rifle product photo white background",
  fuzil: "rifle firearm product photo white background",
  submetralhadora: "submachine gun product photo white background",
  outra: "firearm product photo white background",
};

/** Mapeia marca normalizada → domínio oficial para tentativa direta. */
const OFFICIAL_SITES: Record<string, string> = {
  taurus: "taurusarmas.com.br",
  glock: "us.glock.com",
  cbc: "cbc.com.br",
  imbel: "imbel.gov.br",
  rossi: "rossiusa.com",
  beretta: "beretta.com",
  "smith & wesson": "smith-wesson.com",
  "smith&wesson": "smith-wesson.com",
  sw: "smith-wesson.com",
  sig: "sigsauer.com",
  "sig sauer": "sigsauer.com",
  hk: "heckler-koch.com",
  "heckler & koch": "heckler-koch.com",
  cz: "czub.cz",
  fn: "fnamerica.com",
  springfield: "springfield-armory.com",
  ruger: "ruger.com",
  colt: "colt.com",
  walther: "waltherarms.com",
  kimber: "kimberamerica.com",
  benelli: "benelli.it",
  mossberg: "mossberg.com",
  remington: "remingtonfirearms.com",
  winchester: "winchesterguns.com",
  arex: "arexdefense.com",
  fireeagle: "fireeagle.com.br",
};

/** Domínios preferidos: e-commerces e sites de fabricantes que normalmente
 *  têm fotos com fundo branco e fiéis ao modelo real. */
const PREFERRED_HOSTS = [
  "taurusarmas.com.br",
  "taurususa.com",
  "us.glock.com",
  "glock.com",
  "cbc.com.br",
  "smith-wesson.com",
  "smith-wesson.com.br",
  "fireeagle.com.br",
  "arexdefense.com",
  "imbel.gov.br",
  "rossiusa.com",
  "rossi.com.br",
  "berettaweb.com",
  "beretta.com",
  "armacenter.com.br",
  "lojadocaador.com.br",
  "nordens.com.br",
  "armariobrasileiro.com.br",
  "magnumshop.com.br",
  "armaria10.com.br",
  "cdn.dooca.store",
  "lojavirtualnuvem.com.br",
  "akamaihd.net",
  "shopify.com",
];

const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function hostScore(url: string): number {
  try {
    const h = new URL(url).hostname.toLowerCase();
    for (let i = 0; i < PREFERRED_HOSTS.length; i++) {
      if (h.includes(PREFERRED_HOSTS[i])) return PREFERRED_HOSTS.length - i;
    }
    return 0;
  } catch {
    return -1;
  }
}

/** ===== 1) WIKIMEDIA COMMONS ===== */
async function wikimediaSearch(query: string): Promise<string[]> {
  try {
    const api =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=${encodeURIComponent(query)}` +
      `&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1200`;
    const res = await fetch(api, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const json = await res.json();
    const pages = json?.query?.pages || {};
    const urls: string[] = [];
    for (const k of Object.keys(pages)) {
      const info = pages[k]?.imageinfo?.[0];
      if (!info) continue;
      const mime = (info.mime || "").toLowerCase();
      if (!mime.startsWith("image/")) continue;
      if (mime.includes("svg")) continue;
      const u = info.thumburl || info.url;
      if (u) urls.push(u);
    }
    return urls;
  } catch (e) {
    console.warn("[wiki] erro", e);
    return [];
  }
}

/** ===== 2) SCRAPE DO SITE OFICIAL ===== */
async function scrapeOfficialSite(
  domain: string,
  marca: string,
  modelo: string,
): Promise<string[]> {
  try {
    const q = `site:${domain} ${marca} ${modelo}`;
    const ddg = await fetch(
      `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": UA } },
    );
    const html = await ddg.text();
    // Extrai resultados que pertencem ao domínio oficial
    const re = new RegExp(
      `https?:\\/\\/[^"'\\s]*${domain.replace(/\./g, "\\.")}[^"'\\s]*`,
      "gi",
    );
    const pages = Array.from(new Set((html.match(re) || []).slice(0, 5)));
    const imgs: string[] = [];
    for (const p of pages) {
      try {
        const r = await fetch(p, { headers: { "User-Agent": UA }, redirect: "follow" });
        if (!r.ok) continue;
        const body = await r.text();
        // og:image / twitter:image
        const og =
          body.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ||
          body.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i)?.[1];
        if (og) imgs.push(og.startsWith("http") ? og : new URL(og, p).toString());
        // imagens grandes inline
        const matches = body.match(/<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp))[^"']*["'][^>]*>/gi) || [];
        for (const m of matches.slice(0, 6)) {
          const src = m.match(/src=["']([^"']+)["']/i)?.[1];
          if (!src) continue;
          const abs = src.startsWith("http") ? src : new URL(src, p).toString();
          if (/logo|icon|sprite|placeholder/i.test(abs)) continue;
          imgs.push(abs);
        }
      } catch (_) { /* ignora página */ }
    }
    return Array.from(new Set(imgs));
  } catch (e) {
    console.warn("[oficial] erro", domain, e);
    return [];
  }
}

async function ddgImageSearch(query: string): Promise<any[]> {
  // Etapa 1: HTML inicial para extrair vqd
  const tokenRes = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
    { headers: { "User-Agent": UA, Accept: "text/html" } },
  );
  const html = await tokenRes.text();
  const m =
    html.match(/vqd=["']([^"']+)["']/) ||
    html.match(/vqd=([0-9-]+)&/) ||
    html.match(/vqd="([^"]+)"/);
  if (!m) {
    console.warn("[ddg] vqd não encontrado");
    return [];
  }
  const vqd = m[1];

  // Etapa 2: API i.js
  const apiRes = await fetch(
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`,
    {
      headers: {
        "User-Agent": UA,
        Referer: "https://duckduckgo.com/",
        Accept: "application/json,text/javascript,*/*;q=0.1",
      },
    },
  );
  if (!apiRes.ok) {
    console.warn("[ddg] api falhou", apiRes.status);
    return [];
  }
  const json = await apiRes.json();
  return json?.results || [];
}

async function downloadImage(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "image/*,*/*;q=0.8" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 4 * 1024) return null; // muito pequeno = ícone
    if (buf.length > 6 * 1024 * 1024) return null; // muito grande, pula
    return { bytes: buf, mime: ct.split(";")[0].trim() };
  } catch (e) {
    console.warn("[download] erro", url, e);
    return null;
  }
}

function removeCheckerAndLightBackground(bytes: Uint8Array): { bytes: Uint8Array; transparent: boolean } | null {
  try {
    const dec = pngDecode(bytes);
    const w = dec.width;
    const h = dec.height;
    const rgba = dec.image.length === w * h * 4 ? new Uint8Array(dec.image) : null;
    if (!rgba) return null;
    let changed = false;
    for (let i = 0; i < rgba.length; i += 4) {
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (a === 0) continue;
      if ((lum > 170 && max - min < 25) || (r > 235 && g > 235 && b > 235)) {
        rgba[i + 3] = 0;
        changed = true;
      }
    }
    return { bytes: pngEncode(rgba, w, h), transparent: true && changed };
  } catch {
    return null;
  }
}

/** Remove fundo branco/claro/xadrez de transparência usando IA (Gemini image edit).
 *  Retorna PNG transparente. Se falhar, devolve os bytes originais. */
async function removeBackgroundAI(bytes: Uint8Array, mime: string): Promise<{ bytes: Uint8Array; mime: string; transparent: boolean }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { bytes, mime, transparent: false };
  try {
    // base64 da imagem
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    const dataUrl = `data:${mime};base64,${b64}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Isolate the firearm from the image. Remove ALL background completely (white, gray, checkerboard pattern, watermarks, logos, text). Return ONLY the firearm with a fully TRANSPARENT background. Keep the firearm pixel-perfect, do not redraw or stylize it. Output as PNG with alpha channel.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) {
      console.warn("[bg-remove] gateway falhou", resp.status);
      return { bytes, mime, transparent: false };
    }
    const json = await resp.json();
    const imgUrl: string | undefined = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imgUrl || !imgUrl.startsWith("data:image/")) {
      console.warn("[bg-remove] sem imagem na resposta");
      return { bytes, mime, transparent: false };
    }
    const m = imgUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!m) return { bytes, mime, transparent: false };
    const outMime = m[1];
    const outBin = atob(m[2]);
    const outBytes = new Uint8Array(outBin.length);
    for (let i = 0; i < outBin.length; i++) outBytes[i] = outBin.charCodeAt(i);
    const scrubbed = outMime.includes("png") ? removeCheckerAndLightBackground(outBytes) : null;
    if (scrubbed) return { bytes: scrubbed.bytes, mime: "image/png", transparent: true };
    return { bytes: outBytes, mime: outMime, transparent: true };
  } catch (e) {
    console.warn("[bg-remove] erro", e);
    return { bytes, mime, transparent: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const id = body?.id as string | undefined;
    if (!id) {
      return new Response(JSON.stringify({ error: "id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: arma, error: armaErr } = await sb
      .from("qa_armamentos_catalogo")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (armaErr || !arma) {
      return new Response(JSON.stringify({ error: "arma não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sb
      .from("qa_armamentos_catalogo")
      .update({ imagem_status: "gerando" })
      .eq("id", id);

    const tipoKw = TIPO_KEYWORDS[arma.tipo] || TIPO_KEYWORDS.outra;

    let chosenUrl: string | null = null;
    let chosenSourceUrl: string | null = null;
    let chosenBytes: Uint8Array | null = null;
    let chosenMime = "image/jpeg";
    let fonte = "ddg";

    const marcaN = norm(arma.marca);
    const officialDomain = OFFICIAL_SITES[marcaN] ||
      OFFICIAL_SITES[marcaN.split(" ")[0]] || null;

    // ===== ETAPA 1: WIKIMEDIA =====
    const wikiQueries = [
      `${arma.marca} ${arma.modelo}`,
      `${arma.marca} ${arma.modelo} pistol`,
      `${arma.marca} ${arma.modelo} firearm`,
    ];
    outerWiki: for (const q of wikiQueries) {
      console.log("[wiki] query:", q);
      const urls = await wikimediaSearch(q);
      for (const u of urls.slice(0, 6)) {
        const dl = await downloadImage(u);
        if (dl) {
          chosenUrl = u;
          chosenSourceUrl = u;
          chosenBytes = dl.bytes;
          chosenMime = dl.mime;
          fonte = "wikimedia";
          break outerWiki;
        }
      }
    }

    // ===== ETAPA 2: SITE OFICIAL =====
    if (!chosenBytes && officialDomain) {
      console.log("[oficial] domínio:", officialDomain);
      const urls = await scrapeOfficialSite(officialDomain, arma.marca, arma.modelo);
      for (const u of urls.slice(0, 8)) {
        const dl = await downloadImage(u);
        if (dl) {
          chosenUrl = u;
          chosenSourceUrl = `https://${officialDomain}`;
          chosenBytes = dl.bytes;
          chosenMime = dl.mime;
          fonte = "oficial";
          break;
        }
      }
    }

    // ===== ETAPA 3: DUCKDUCKGO IMAGES (fallback) =====
    const queries = [
      `${arma.marca} ${arma.modelo} ${arma.calibre || ""} ${tipoKw}`.replace(/\s+/g, " ").trim(),
      `${arma.marca} ${arma.modelo} ${tipoKw}`.replace(/\s+/g, " ").trim(),
      `${arma.marca} ${arma.modelo} firearm`,
    ];

    if (!chosenBytes) outer: for (const q of queries) {
      console.log("[busca] query:", q);
      const results = await ddgImageSearch(q);
      if (!results.length) continue;

      // Ordena por (score do host) DESC, depois por área plausível (não muito pequena, não muito grande)
      const ranked = [...results]
        .filter((r) => r?.image && typeof r.image === "string")
        .map((r) => ({
          r,
          score: hostScore(r.image) * 1000 + (r.height >= 400 && r.height <= 1600 ? 10 : 0),
        }))
        .sort((a, b) => b.score - a.score);

      for (const { r } of ranked.slice(0, 8)) {
        const dl = await downloadImage(r.image);
        if (dl) {
          chosenUrl = r.image;
          chosenSourceUrl = r.url || null;
          chosenBytes = dl.bytes;
          chosenMime = dl.mime;
          fonte = "ddg";
          break outer;
        }
      }
    }

    if (!chosenBytes || !chosenUrl) {
      await sb
        .from("qa_armamentos_catalogo")
        .update({ imagem_status: "erro" })
        .eq("id", id);
      return new Response(
        JSON.stringify({ error: "Nenhuma foto adequada encontrada (wikimedia/oficial/ddg)" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== ETAPA 4: REMOÇÃO DE FUNDO =====
    // Sempre tenta remover o fundo para padronizar PNG transparente — evita o "xadrez"
    // que aparecia quando a imagem original já vinha com tabuleiro de transparência embutido.
    const cleaned = await removeBackgroundAI(chosenBytes, chosenMime);
    const finalBytes = cleaned.bytes;
    const finalMime = cleaned.mime;
    const isTransparent = cleaned.transparent;

    const ext = finalMime.includes("png")
      ? "png"
      : finalMime.includes("webp")
      ? "webp"
      : "jpg";
    const path = `${arma.id}.${ext}`;

    const { error: upErr } = await sb.storage
      .from("qa-armamentos")
      .upload(path, finalBytes, {
        contentType: finalMime,
        upsert: true,
        cacheControl: "31536000",
      });
    if (upErr) {
      await sb
        .from("qa_armamentos_catalogo")
        .update({ imagem_status: "erro" })
        .eq("id", id);
      return new Response(
        JSON.stringify({ error: "upload falhou", detail: upErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { data: pub } = sb.storage.from("qa-armamentos").getPublicUrl(path);
    const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

    await sb
      .from("qa_armamentos_catalogo")
      .update({
        imagem: publicUrl,
        imagem_url: chosenUrl,
        imagem_fonte: chosenUrl,
        tem_fundo_transparente: isTransparent,
        imagem_status: "pronta",
        imagem_gerada_em: new Date().toISOString(),
        fonte_url: chosenSourceUrl || arma.fonte_url,
      })
      .eq("id", id);

    return new Response(
      JSON.stringify({
        ok: true,
        imagem: publicUrl,
        fonte_imagem: chosenUrl,
        fonte_pagina: chosenSourceUrl,
        fonte,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[qa-armamento-buscar-foto-real]", e);
    return new Response(
      JSON.stringify({ error: String((e as any)?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
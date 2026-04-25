import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    // Vamos tentar 3 variações de query do mais específico para o mais genérico.
    const queries = [
      `${arma.marca} ${arma.modelo} ${arma.calibre || ""} ${tipoKw}`.replace(/\s+/g, " ").trim(),
      `${arma.marca} ${arma.modelo} ${tipoKw}`.replace(/\s+/g, " ").trim(),
      `${arma.marca} ${arma.modelo} firearm`,
    ];

    let chosenUrl: string | null = null;
    let chosenSourceUrl: string | null = null;
    let chosenBytes: Uint8Array | null = null;
    let chosenMime = "image/jpeg";

    outer: for (const q of queries) {
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
        JSON.stringify({ error: "Nenhuma foto adequada encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ext = chosenMime.includes("png")
      ? "png"
      : chosenMime.includes("webp")
      ? "webp"
      : "jpg";
    const path = `${arma.id}.${ext}`;

    const { error: upErr } = await sb.storage
      .from("qa-armamentos")
      .upload(path, chosenBytes, {
        contentType: chosenMime,
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
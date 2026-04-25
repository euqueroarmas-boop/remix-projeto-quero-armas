import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decode as pngDecode, encode as pngEncode } from "https://deno.land/x/pngs@0.1.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

/** Aplica chroma-key: converte pixels claros (branco/cinza/xadrez) e quase-claros para alpha=0.
 *  Funciona em PNGs já decodificados (RGBA). */
function chromaKeyToAlpha(rgba: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(rgba.length);
  out.set(rgba);
  // limiar: pixel é "fundo" se for muito claro (cada canal >= 235) OU cinza claro saturação baixa.
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i], g = out[i + 1], b = out[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sat = max === 0 ? 0 : (max - min) / max;
    // branco puro / quase branco
    if (r >= 240 && g >= 240 && b >= 240) { out[i + 3] = 0; continue; }
    // cinza claro de baixa saturação (típico do xadrez/CDN)
    if (lum >= 215 && sat < 0.08) { out[i + 3] = 0; continue; }
    // suaviza borda: pixels intermediários muito claros recebem alpha proporcional
    if (lum >= 225 && sat < 0.15) {
      const a = Math.max(0, Math.min(255, Math.round((255 - lum) * 6)));
      out[i + 3] = a;
    }
  }
  return out;
}

/** Floods do pixel (0,0) e cantos para remover patterns de fundo (xadrez) que não são branco puro. */
function floodBackground(rgba: Uint8Array, w: number, h: number, tol = 40): Uint8Array {
  const out = new Uint8Array(rgba);
  const visited = new Uint8Array(w * h);
  const seeds = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
  const stack: number[] = [];
  for (const [sx, sy] of seeds) {
    const idx = sy * w + sx;
    const r0 = rgba[idx * 4], g0 = rgba[idx * 4 + 1], b0 = rgba[idx * 4 + 2];
    stack.push(sx, sy, r0, g0, b0);
    while (stack.length) {
      const b = stack.pop()!, g = stack.pop()!, r = stack.pop()!, y = stack.pop()!, x = stack.pop()!;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (visited[i]) continue;
      const pi = i * 4;
      const dr = Math.abs(out[pi] - r), dg = Math.abs(out[pi + 1] - g), db = Math.abs(out[pi + 2] - b);
      if (dr > tol || dg > tol || db > tol) continue;
      visited[i] = 1;
      out[pi + 3] = 0;
      stack.push(x + 1, y, r, g, b);
      stack.push(x - 1, y, r, g, b);
      stack.push(x, y + 1, r, g, b);
      stack.push(x, y - 1, r, g, b);
    }
  }
  return out;
}

/** Roda a imagem pelo Gemini image edit removendo qualquer fundo (xadrez, branco, cinza). */
async function removeBg(bytes: Uint8Array, mime: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const dataUrl = `data:${mime};base64,${btoa(bin)}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{
        role: "user",
        content: [
              { type: "text", text: "Isolate the firearm on a PURE WHITE (#FFFFFF) background. Remove ALL original background — any checkerboard pattern, gray, watermarks, logos, text. Output 1024x1024 max, PNG. Do NOT redraw, restyle or recolor the firearm — keep it pixel-perfect identical." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      }],
      modalities: ["image", "text"],
    }),
  });
  if (!resp.ok) {
    console.warn("[bg] gateway", resp.status, await resp.text().catch(()=>""));
    return null;
  }
  const j = await resp.json();
  const url: string | undefined = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  const m = url?.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!m) return null;
  const out = atob(m[2]);
  const u8 = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) u8[i] = out.charCodeAt(i);

  // Pós-processamento garantido: decodifica PNG, força alpha por chroma-key + flood dos cantos, recodifica.
  try {
    const dec = pngDecode(u8);
    const w = dec.width, h = dec.height;
    // garante 4 canais
    let rgba: Uint8Array;
    if (dec.image.length === w * h * 4) rgba = dec.image as Uint8Array;
    else if (dec.image.length === w * h * 3) {
      rgba = new Uint8Array(w * h * 4);
      for (let i = 0, j = 0; i < dec.image.length; i += 3, j += 4) {
        rgba[j] = dec.image[i]; rgba[j + 1] = dec.image[i + 1]; rgba[j + 2] = dec.image[i + 2]; rgba[j + 3] = 255;
      }
    } else {
      return { bytes: u8, mime: m[1] };
    }
    // Para imagens grandes (>1.2MP) pulamos o flood (evita estouro de memória do worker)
    const big = (w * h) > 1_200_000;
    const step1 = big ? rgba : floodBackground(rgba, w, h, 45);
    const chromaed = chromaKeyToAlpha(step1, w, h);
    const enc = pngEncode(chromaed, w, h);
    return { bytes: enc, mime: "image/png" };
  } catch (e) {
    console.warn("[postproc] falhou", e);
    return { bytes: u8, mime: m[1] };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const onlyId: string | undefined = body?.id;
    const force: boolean = body?.force !== false; // default true
    const limit: number = Math.max(1, Math.min(100, body?.limit || 50));

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    let q = sb.from("qa_armamentos_catalogo").select("id, marca, modelo, imagem, tem_fundo_transparente").not("imagem", "is", null);
    if (onlyId) q = q.eq("id", onlyId);
    else if (!force) q = q.eq("tem_fundo_transparente", false);
    q = q.limit(limit);

    const { data: armas, error } = await q;
    if (error) throw error;
    if (!armas || armas.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "nada para processar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    for (const a of armas) {
      try {
        // baixa a imagem atual
        const url = String(a.imagem).split("?")[0];
        const r = await fetch(url);
        if (!r.ok) { results.push({ id: a.id, ok: false, error: `download ${r.status}` }); continue; }
        const mime = r.headers.get("content-type") || "image/png";
        const buf = new Uint8Array(await r.arrayBuffer());

        // limpa fundo
        const cleaned = await removeBg(buf, mime);
        if (!cleaned) { results.push({ id: a.id, ok: false, error: "bg remove falhou" }); continue; }

        // regrava no storage (sempre PNG)
        const path = `${a.id}.png`;
        const { error: upErr } = await sb.storage.from("qa-armamentos").upload(path, cleaned.bytes, {
          contentType: "image/png", upsert: true, cacheControl: "31536000",
        });
        if (upErr) { results.push({ id: a.id, ok: false, error: upErr.message }); continue; }
        const { data: pub } = sb.storage.from("qa-armamentos").getPublicUrl(path);
        const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;
        await sb.from("qa_armamentos_catalogo").update({
          imagem: publicUrl,
          tem_fundo_transparente: true,
          imagem_status: "pronta",
          imagem_gerada_em: new Date().toISOString(),
        }).eq("id", a.id);
        results.push({ id: a.id, marca: a.marca, modelo: a.modelo, ok: true, imagem: publicUrl });
      } catch (e) {
        results.push({ id: a.id, ok: false, error: String((e as any)?.message || e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[limpar-fundo-batch]", e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
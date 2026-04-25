import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

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
          { type: "text", text: "Isolate the firearm. Remove ALL background completely — including any white, gray, or checkerboard transparency pattern visible in the image. Return ONLY the firearm with a fully TRANSPARENT background (real PNG alpha channel). Do NOT redraw, restyle, recolor or modify the firearm itself in any way — keep it pixel-perfect identical. Output PNG with alpha." },
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
  return { bytes: u8, mime: m[1] };
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
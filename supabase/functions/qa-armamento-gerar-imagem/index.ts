import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import UPNG from "https://esm.sh/upng-js@2.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function buildPrompt(it: any): string {
  const tipoMap: Record<string, string> = {
    pistola: "semi-automatic pistol",
    revolver: "double-action revolver",
    fuzil: "assault rifle",
    carabina: "carbine rifle",
    espingarda: "shotgun",
    submetralhadora: "submachine gun",
    outra: "firearm",
  };
  const tipo = tipoMap[it.tipo] || "firearm";
  return [
    `Ultra photorealistic catalog product photograph of the EXACT real-world ${it.marca} ${it.modelo} ${tipo}`,
    it.calibre ? `chambered in ${it.calibre}` : "",
    it.comprimento_cano_mm ? `with ${it.comprimento_cano_mm}mm barrel` : "",
    "Strict left-side profile view, slide/barrel pointing to the RIGHT, factory new condition.",
    `CRITICAL ACCURACY: must match the exact production ${it.marca} ${it.modelo} — correct slide length, slide serrations, frame generation, trigger guard contour, magazine well, beavertail, sights (front + rear), accessory rail, grip texture/stippling, controls placement, and manufacturer engraving authentic to this specific reference model. Do NOT invent a generic firearm.`,
    "OUTPUT FORMAT: square PNG with FULLY TRANSPARENT BACKGROUND (alpha channel). No white, gray, black, colored, studio, paper, canvas, scene, shadow plate, floor, gradient, or rectangular background — only the firearm pixels cut out cleanly with anti-aliased transparent edges.",
    "Soft studio lighting, sharp focus, ultra-high detail, no text overlays, no watermarks, no logos other than authentic manufacturer engraving on the slide.",
    "Centered composition; the weapon fills 96% of the frame width, oversized, with almost no padding while keeping the full firearm visible.",
  ].filter(Boolean).join(" ");
}

function stripBackgroundAndCropPng(input: Uint8Array): Uint8Array {
  const sourceBuffer = new ArrayBuffer(input.byteLength);
  new Uint8Array(sourceBuffer).set(input);
  const decoded = UPNG.decode(sourceBuffer);
  const width = decoded.width;
  const height = decoded.height;
  const rgba = new Uint8Array(UPNG.toRGBA8(decoded)[0]);
  const sample = [0, width - 1, (height - 1) * width, height * width - 1]
    .map((idx) => [rgba[idx * 4], rgba[idx * 4 + 1], rgba[idx * 4 + 2]]);
  const bg = sample.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0]).map((v) => v / sample.length);
  const isLikelyBg = (idx: number) => {
    const i = idx * 4;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3];
    if (a < 8) return true;
    const d = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return d < 62 || (r > 222 && g > 222 && b > 222 && max - min < 34);
  };
  const seen = new Uint8Array(width * height);
  const queue: number[] = [];
  const enqueue = (idx: number) => {
    if (idx < 0 || idx >= seen.length || seen[idx] || !isLikelyBg(idx)) return;
    seen[idx] = 1;
    queue.push(idx);
  };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  for (let p = 0; p < queue.length; p++) {
    const idx = queue[p];
    const x = idx % width;
    if (x > 0) enqueue(idx - 1);
    if (x < width - 1) enqueue(idx + 1);
    enqueue(idx - width);
    enqueue(idx + width);
  }
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let idx = 0; idx < seen.length; idx++) {
    if (seen[idx]) rgba[idx * 4 + 3] = 0;
    if (rgba[idx * 4 + 3] > 12) {
      const x = idx % width, y = Math.floor(idx / width);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return input;
  const pad = Math.max(6, Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * 0.018));
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
  const outW = maxX - minX + 1, outH = maxY - minY + 1;
  const cropped = new Uint8Array(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    const src = ((minY + y) * width + minX) * 4;
    const dst = y * outW * 4;
    cropped.set(rgba.subarray(src, src + outW * 4), dst);
  }
  const croppedBuffer = new ArrayBuffer(cropped.byteLength);
  new Uint8Array(croppedBuffer).set(cropped);
  return new Uint8Array(UPNG.encode([croppedBuffer], outW, outH, 0));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { id } = await req.json();
    if (!id) return new Response(JSON.stringify({ error: "id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: arma, error: armaErr } = await sb.from("qa_armamentos_catalogo").select("*").eq("id", id).maybeSingle();
    if (armaErr || !arma) return new Response(JSON.stringify({ error: "arma não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await sb.from("qa_armamentos_catalogo").update({ imagem_status: "gerando" }).eq("id", id);

    const prompt = buildPrompt(arma);
    console.log("[qa-armamento-gerar-imagem] prompt:", prompt);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      await sb.from("qa_armamentos_catalogo").update({ imagem_status: "erro" }).eq("id", id);
      return new Response(JSON.stringify({ error: "Falha IA", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiRes.json();
    const dataUrl: string | undefined = aiJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl?.startsWith("data:image/")) {
      await sb.from("qa_armamentos_catalogo").update({ imagem_status: "erro" }).eq("id", id);
      return new Response(JSON.stringify({ error: "IA não retornou imagem" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Decodifica base64
    const [header, b64] = dataUrl.split(",");
    const mime = "image/png";
    const ext = "png";
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const finalBin = stripBackgroundAndCropPng(bin);
    const path = `${arma.id}.${ext}`;

    const { error: upErr } = await sb.storage.from("qa-armamentos").upload(path, finalBin, {
      contentType: mime,
      upsert: true,
      cacheControl: "31536000",
    });
    if (upErr) {
      await sb.from("qa_armamentos_catalogo").update({ imagem_status: "erro" }).eq("id", id);
      return new Response(JSON.stringify({ error: "Upload falhou", detail: upErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: pub } = sb.storage.from("qa-armamentos").getPublicUrl(path);
    const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

    await sb.from("qa_armamentos_catalogo").update({
      imagem: publicUrl,
      imagem_status: "pronta",
      imagem_gerada_em: new Date().toISOString(),
    }).eq("id", id);

    return new Response(JSON.stringify({ ok: true, imagem: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[qa-armamento-gerar-imagem]", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
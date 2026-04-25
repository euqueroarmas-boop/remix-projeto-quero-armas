import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    "OUTPUT FORMAT: PNG with FULLY TRANSPARENT BACKGROUND (alpha channel). No background color, no scene, no shadow plate, no floor — only the firearm cut out cleanly with anti-aliased edges.",
    "Soft studio lighting, sharp focus, ultra-high detail, no text overlays, no watermarks, no logos other than authentic manufacturer engraving on the slide.",
    "Centered composition; the weapon fills ~90% of the frame width with small even padding around it.",
  ].filter(Boolean).join(" ");
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
    const mime = header.match(/data:(image\/\w+)/)?.[1] || "image/png";
    const ext = mime.split("/")[1] || "png";
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${arma.id}.${ext}`;

    const { error: upErr } = await sb.storage.from("qa-armamentos").upload(path, bin, {
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
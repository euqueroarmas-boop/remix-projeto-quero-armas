import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80";

interface GenerateRequest {
  topic: string;
  service_slug?: string;
  city_slug?: string;
  category?: string;
  action?: "generate" | "publish" | "delete" | "list" | "update_cover" | "generate_cover";
  post_id?: string;
  image_url?: string;
  image_source?: string;
  image_prompt?: string;
  image_alt_pt?: string;
  image_alt_en?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function generatePost(topic: string, serviceName?: string, cityName?: string, category?: string) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const cityContext = cityName ? ` na cidade de ${cityName}` : "";
  const serviceContext = serviceName ? ` relacionado ao serviço de ${serviceName}` : "";

  const systemPrompt = `Você é um redator técnico especializado em TI corporativa para a empresa WMTi Tecnologia da Informação, localizada em Jacareí-SP. 
Escreva artigos técnicos, informativos e otimizados para SEO, voltados para decisores de empresas (gerentes, diretores, donos).
Use linguagem profissional mas acessível. Inclua dados concretos quando possível.
O artigo deve ter entre 1200-2000 palavras.
IMPORTANTE: Responda APENAS com o JSON válido, sem markdown code blocks.
IMPORTANTE: Inclua versões em inglês dos campos indicados para internacionalização.`;

  const userPrompt = `Gere um artigo completo sobre: "${topic}"${serviceContext}${cityContext}.

Retorne um JSON com esta estrutura exata:
{
  "title": "título do artigo em português (60-70 chars)",
  "title_en": "article title in English (60-70 chars)",
  "slug": "slug-do-artigo-em-portugues",
  "excerpt": "resumo de 2 linhas em português (150-160 chars)",
  "excerpt_en": "2-line summary in English (150-160 chars)",
  "meta_title": "título SEO em português (até 60 chars)",
  "meta_title_en": "SEO title in English (up to 60 chars)",
  "meta_description": "descrição SEO em português (até 155 chars)",
  "meta_description_en": "SEO description in English (up to 155 chars)",
  "tag": "tag curta (ex: Infraestrutura, Segurança, Cloud)",
  "category": "${category || 'Tecnologia Empresarial'}",
  "read_time": "X min",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "content_md": "conteúdo completo em português em markdown com ## headings, parágrafos, listas e **destaques**",
  "content_md_en": "full content in English in markdown with ## headings, paragraphs, lists and **highlights**",
  "faq": [
    {"q": "pergunta frequente?", "a": "resposta detalhada"}
  ],
  "faq_en": [
    {"q": "frequently asked question?", "a": "detailed answer"}
  ],
  "internal_links": [
    {"label": "texto do link", "href": "/rota-interna"}
  ],
  "cta": "texto do call-to-action final em português",
  "cta_en": "final call-to-action text in English",
  "image_alt_pt": "texto alt descritivo da imagem de capa em português",
  "image_alt_en": "descriptive alt text for the cover image in English"
}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new Error("Rate limit exceeded. Try again later.");
    if (status === 402) throw new Error("Credits exhausted. Add funds in workspace settings.");
    throw new Error(`AI gateway error: ${status}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");

  content = content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  const article = JSON.parse(content);
  return article;
}

async function generateCoverImage(prompt: string): Promise<string | null> {
  if (!LOVABLE_API_KEY) return null;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: prompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) throw new Error("Rate limit exceeded. Try again later.");
      if (status === 402) throw new Error("Credits exhausted.");
      throw new Error(`AI image error: ${status}`);
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageData) return null;

    // Decode base64 and upload to storage
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `covers/ai-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

    const { error } = await supabase.storage.from("blog-images").upload(path, binary, {
      contentType: "image/png",
      upsert: false,
    });

    if (error) {
      console.error("Storage upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage.from("blog-images").getPublicUrl(path);
    return urlData.publicUrl;
  } catch (e) {
    console.error("Cover generation error:", e);
    throw e; // Re-throw so caller gets the error message
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminToken = req.headers.get("x-admin-token");
    if (!adminToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: GenerateRequest = await req.json();
    const action = body.action || "generate";

    // ── List ──
    if (action === "list") {
      const { data, error } = await supabase
        .from("blog_posts_ai")
        .select("id, slug, title, status, category, tag, created_at, published_at, image_url, image_source, image_prompt, image_alt_pt")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return new Response(JSON.stringify({ posts: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Publish ──
    if (action === "publish" && body.post_id) {
      const { error } = await supabase
        .from("blog_posts_ai")
        .update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", body.post_id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Delete ──
    if (action === "delete" && body.post_id) {
      const { error } = await supabase
        .from("blog_posts_ai")
        .delete()
        .eq("id", body.post_id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Update Cover ──
    if (action === "update_cover" && body.post_id) {
      const updatePayload: Record<string, unknown> = {
        image_url: body.image_url || DEFAULT_IMAGE,
        image_source: body.image_source || "fallback",
        updated_at: new Date().toISOString(),
      };
      if (body.image_prompt !== undefined) updatePayload.image_prompt = body.image_prompt;
      if (body.image_alt_pt !== undefined) updatePayload.image_alt_pt = body.image_alt_pt;
      if (body.image_alt_en !== undefined) updatePayload.image_alt_en = body.image_alt_en;

      const { error } = await supabase
        .from("blog_posts_ai")
        .update(updatePayload)
        .eq("id", body.post_id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Generate Cover Image via AI ──
    if (action === "generate_cover") {
      const prompt = body.image_prompt || `Generate a professional, modern blog cover image for a corporate IT company. Topic: ${body.topic || "corporate IT technology"}. Style: clean, tech-oriented, professional blue tones, suitable for a business blog header. No text in the image.`;
      
      const imageUrl = await generateCoverImage(prompt);
      if (!imageUrl) {
        return new Response(JSON.stringify({ error: "Failed to generate cover image" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, image_url: imageUrl, prompt_used: prompt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Generate Article ──
    if (!body.topic) {
      return new Response(JSON.stringify({ error: "topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const article = await generatePost(body.topic, body.service_slug, body.city_slug, body.category);
    const slug = article.slug || slugify(article.title);

    const finalImageUrl = body.image_url || DEFAULT_IMAGE;
    const finalImageSource = body.image_source || "fallback";

    const { data: inserted, error: insertErr } = await supabase
      .from("blog_posts_ai")
      .insert({
        slug,
        title: article.title,
        title_en: article.title_en || null,
        excerpt: article.excerpt,
        excerpt_en: article.excerpt_en || null,
        meta_title: article.meta_title,
        meta_title_en: article.meta_title_en || null,
        meta_description: article.meta_description,
        meta_description_en: article.meta_description_en || null,
        content_md: article.content_md,
        content_md_en: article.content_md_en || null,
        category: article.category,
        tag: article.tag,
        read_time: article.read_time || "5 min",
        keywords: article.keywords || [],
        service_slug: body.service_slug || null,
        city_slug: body.city_slug || null,
        faq: article.faq || [],
        faq_en: article.faq_en || [],
        internal_links: article.internal_links || [],
        cta: article.cta || "",
        cta_en: article.cta_en || "",
        status: "draft",
        image_url: finalImageUrl,
        image_source: finalImageSource,
        image_prompt: body.image_prompt || null,
        image_alt_pt: body.image_alt_pt || article.image_alt_pt || null,
        image_alt_en: body.image_alt_en || article.image_alt_en || null,
      })
      .select("id, slug, title")
      .single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true, post: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-blog-post error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

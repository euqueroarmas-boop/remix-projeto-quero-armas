import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { query, limit = 6, audience = null } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: "query inválida" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1a. Embedding da query (mesma técnica usada em qa-kb-embed: array JSON via Gemini, 1536 dim)
    let qemb: number[] | null = null;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const er = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Generate a vector of exactly 1536 floats between -1 and 1 representing the text semantically. Output ONLY the JSON array." },
              { role: "user", content: query.slice(0, 800) },
            ],
            max_tokens: 8000,
          }),
        });
        if (er.ok) {
          const ej = await er.json();
          const content = ej?.choices?.[0]?.message?.content || "";
          const m = content.match(/\[[-\d.,\s]+\]/);
          if (m) {
            const arr = JSON.parse(m[0]);
            if (Array.isArray(arr) && arr.length >= 100) {
              const vec = arr.slice(0, 1536).map((x: any) => Number(x) || 0);
              while (vec.length < 1536) vec.push(0);
              qemb = vec;
            }
          }
        }
      } catch (e) { console.warn("embed query fail", e); }
    }

    // 1b. Busca híbrida (texto + tags + sintomas + similaridade vetorial)
    const { data: hits, error } = await supabase.rpc("qa_kb_search_hybrid", {
      _query: query,
      _qemb: qemb as any,
      _audience: audience,
      _limit: limit,
    });
    if (error) throw error;

    const articles = (hits ?? []) as Array<{
      id: string; title: string; slug: string; category: string;
      module: string | null; audience: string; tags: string[]; symptoms: string[]; body: string; rank: number;
    }>;

    if (articles.length === 0) {
      return new Response(JSON.stringify({
        answer: "Nenhum artigo encontrado na Base de Conhecimento para essa pergunta. Tente reformular ou cadastre um novo artigo.",
        articles: [],
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 2. Síntese com Lovable AI
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({
        answer: "(IA indisponível) Veja os artigos abaixo.",
        articles: articles.map(a => ({ ...a, body: undefined })),
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const context = articles.slice(0, 4).map((a, i) =>
      `### Artigo ${i + 1}: ${a.title}\nCategoria: ${a.category}${a.module ? " | Módulo: " + a.module : ""}\n\n${a.body.substring(0, 4000)}`
    ).join("\n\n---\n\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Você é o assistente da Base de Conhecimento da Equipe Quero Armas. Responda SEMPRE em português, de forma operacional, prática e curta. Use SOMENTE as informações dos artigos fornecidos. Estruture a resposta em: **Resumo da solução** (1-3 frases), **Passo a passo** (lista numerada), **Módulo afetado** (uma linha), **Artigos consultados** (títulos). Se os artigos não responderem a pergunta, diga claramente que a base não cobre o tema. Nunca invente fluxos. Nunca use o termo 'admin' — use 'Equipe Quero Armas'.",
          },
          {
            role: "user",
            content: `Pergunta da equipe: "${query}"\n\nArtigos da base:\n\n${context}`,
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições da IA atingido. Aguarde alguns segundos." }), {
          status: 429, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos em Lovable Cloud." }), {
          status: 402, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway:", status, t);
      return new Response(JSON.stringify({
        answer: "(IA indisponível agora) Veja os artigos abaixo.",
        articles,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const aiJson = await aiResp.json();
    const answer = aiJson?.choices?.[0]?.message?.content ?? "Sem resposta da IA.";

    return new Response(JSON.stringify({
      answer,
      articles: articles.map(a => ({
        id: a.id, title: a.title, slug: a.slug, category: a.category,
        module: a.module, tags: a.tags, rank: a.rank,
      })),
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("qa-kb-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
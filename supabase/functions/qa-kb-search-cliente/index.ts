import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Busca da Base Operacional do CLIENTE.
 * Sempre força audience='cliente' e status='published' via qa_kb_search_hybrid.
 * Nunca expõe artigos internos da Equipe Quero Armas.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { query, limit = 5 } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: "query inválida" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const KEY = Deno.env.get("LOVABLE_API_KEY");
    let qemb: number[] | null = null;
    if (KEY) {
      try {
        const er = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
          body: JSON.stringify({ model: "google/text-embedding-004", input: query.slice(0, 4000) }),
        });
        if (er.ok) qemb = (await er.json())?.data?.[0]?.embedding ?? null;
      } catch (_) { /* ignore */ }
    }

    const { data: hits, error } = await supabase.rpc("qa_kb_search_hybrid", {
      _query: query,
      _qemb: qemb as any,
      _audience: "cliente",
      _limit: limit,
    });
    if (error) throw error;

    const articles = (hits ?? []) as Array<any>;
    if (articles.length === 0) {
      return new Response(JSON.stringify({
        answer: "Não encontrei essa informação na nossa central de ajuda. Se precisar, entre em contato com a equipe Quero Armas pelo WhatsApp.",
        articles: [],
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (!KEY) {
      return new Response(JSON.stringify({
        answer: "Veja os artigos relacionados abaixo.",
        articles: articles.map((a) => ({ id: a.id, title: a.title, category: a.category })),
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const ctx = articles.slice(0, 3).map((a, i) =>
      `### Artigo ${i + 1}: ${a.title}\n${(a.body || "").substring(0, 3500)}`
    ).join("\n\n---\n\n");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é o assistente da Central de Ajuda do Cliente Quero Armas. Responda em português, de forma simples, acolhedora e objetiva. Use SOMENTE as informações dos artigos fornecidos. NUNCA mencione termos internos como 'equipe', 'admin', 'banco de dados', 'edge function'. Se a resposta não estiver nos artigos, diga claramente que aquela informação não está na central de ajuda e oriente entrar em contato com a equipe Quero Armas. Estruture a resposta em: **Resposta** (curta) + **Passo a passo** (numerado quando aplicável)." },
          { role: "user", content: `Dúvida do cliente: "${query}"\n\nArtigos da central de ajuda:\n\n${ctx}` },
        ],
      }),
    });

    if (!r.ok) {
      if (r.status === 429) return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde alguns segundos." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      if (r.status === 402) return new Response(JSON.stringify({ error: "Serviço indisponível no momento." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ answer: "Veja os artigos abaixo.", articles: articles.map((a) => ({ id: a.id, title: a.title, category: a.category })) }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    const j = await r.json();
    const answer = j?.choices?.[0]?.message?.content ?? "Veja os artigos abaixo.";

    return new Response(JSON.stringify({
      answer,
      articles: articles.map((a) => ({ id: a.id, title: a.title, category: a.category })),
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("qa-kb-search-cliente error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
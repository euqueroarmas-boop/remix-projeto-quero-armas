import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth via admin HMAC token ──
    const adminToken = req.headers.get("x-admin-token") || "";
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    if (!ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD not configured");

    const [ts, sig] = adminToken.split(".");
    if (!ts || !sig) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const age = Date.now() - Number(ts);
    if (age > 8 * 3600 * 1000) {
      return new Response(JSON.stringify({ error: "Token expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(ADMIN_PASSWORD),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expected = Array.from(
      new Uint8Array(
        await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`admin:${ts}`))
      )
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (expected !== sig) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse request ──
    const { action, messages, command } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Action: chat (streaming) ──
    if (action === "chat") {
      const systemPrompt = `Você é o DevChat da WMTi — um assistente de engenharia interno do painel administrativo.

CONTEXTO:
- O projeto WMTi é um site corporativo de TI em React/Vite/Tailwind/TypeScript
- Usa Supabase (Lovable Cloud) como backend
- Tem testes Cypress automatizados
- Tem sistema de contratos, leads, pagamentos, blog IA

CAPACIDADES:
Você pode analisar e sugerir:
1. Correções de bugs (fix)
2. Criação de funcionalidades (create)
3. Atualizações de componentes (update)
4. Otimizações de performance/SEO/UX (optimize)
5. Melhorias de conversão (conversion)

FORMATO DE RESPOSTA:
Quando o usuário pedir uma ação no código, responda com:
- **Análise**: o que foi identificado
- **Ação**: o que deve ser feito
- **Arquivos**: quais arquivos seriam afetados
- **Confiança**: alta/média/baixa
- **Tipo**: fix | create | update | optimize

Para perguntas gerais, responda normalmente de forma objetiva.

REGRAS:
- Seja direto e técnico
- Não invente funcionalidades que não existem
- Sugira ações baseadas na arquitetura real do projeto
- Sempre considere impacto em testes existentes`;

      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              ...messages,
            ],
            stream: true,
          }),
        }
      );

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos insuficientes. Adicione fundos no workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const t = await response.text();
        console.error("AI gateway error:", status, t);
        return new Response(
          JSON.stringify({ error: "Erro no gateway de IA" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // ── Action: save (save command to prompt_intelligence) ──
    if (action === "save") {
      const { data, error } = await supabase
        .from("prompt_intelligence")
        .insert({
          analysis_type: "dev_chat",
          status: "pending",
          summary: command?.summary || "Comando via DevChat",
          prompt_type: command?.type || "correction",
          source: "dev_chat",
          confidence: command?.confidence || 0.7,
          impact_score: command?.impact || 0.5,
          auto_applicable: false,
          prompts: command?.prompts || [],
          total_prompts: command?.prompts?.length || 1,
          triggered_by: "dev_chat",
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, record: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dev-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

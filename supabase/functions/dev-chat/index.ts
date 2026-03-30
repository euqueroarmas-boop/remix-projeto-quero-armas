import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyAdminToken(token: string, password: string): Promise<boolean> {
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  const age = Date.now() - Number(ts);
  if (age > 8 * 3600 * 1000) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
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
  return expected === sig;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──
    const adminToken = req.headers.get("x-admin-token") || "";
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    if (!ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "ADMIN_PASSWORD não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const valid = await verifyAdminToken(adminToken, ADMIN_PASSWORD);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Token admin inválido ou expirado. Faça login novamente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse request ──
    const { action, messages, command } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not found in env");
      return new Response(
        JSON.stringify({ error: "Token de IA não configurado. Verifique LOVABLE_API_KEY nas configurações." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Action: chat (streaming) ──
    if (action === "chat") {
      const systemPrompt = `Você é o DevChat da WMTi — um assistente de engenharia que gera CÓDIGO EXECUTÁVEL, não apenas descrições.

CONTEXTO DO PROJETO:
- React/Vite/Tailwind/TypeScript
- Supabase (Lovable Cloud) como backend
- Testes Cypress E2E automatizados (CNPJ teste: 33.814.058/0001-28)
- Sistema de contratos, leads, pagamentos, blog IA
- Edge Functions em Deno (supabase/functions/)
- Componentes em src/components/, páginas em src/pages/

REGRA PRINCIPAL: SEMPRE gere código executável. NUNCA responda apenas com texto descritivo.

FORMATO OBRIGATÓRIO para qualquer pedido de ação:

## 📋 Diagnóstico
(1-2 linhas do problema)

## 📁 Arquivo(s) afetado(s)
\`caminho/do/arquivo.ts\`

## 🔧 Código (copiar e aplicar)
\`\`\`ts
// código completo pronto para colar
\`\`\`

## ⚡ Impacto
- O que muda
- Confiança: alta/média/baixa

---

EXEMPLOS CORRETOS:

❌ ERRADO: "Aumentar timeout do cy.get()"
✅ CERTO:
\`\`\`ts
// cypress/e2e/contratos/contrato-admin-servidores.cy.ts
cy.get('[data-testid="campo-logradouro"]', { timeout: 20000 }).should('be.visible');
\`\`\`

❌ ERRADO: "Corrigir o botão de WhatsApp"
✅ CERTO:
\`\`\`tsx
// src/components/WhatsAppButton.tsx - linha 15
const whatsappUrl = \`https://wa.me/5511999999999?text=\${encodeURIComponent(message)}\`;
\`\`\`

REGRAS:
- SEMPRE inclua o caminho do arquivo como comentário na primeira linha do bloco de código
- SEMPRE gere código COMPLETO da função/componente afetado, não snippets parciais
- Se precisar de múltiplos arquivos, separe em blocos distintos
- Use markdown com blocos de código (\`\`\`ts ou \`\`\`tsx)
- Para perguntas gerais sem ação, responda objetivamente
- Considere impacto em testes existentes`;

      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
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
        const t = await response.text();
        console.error("AI gateway error:", status, t);

        const errorMap: Record<number, string> = {
          429: "Rate limit excedido. Tente novamente em alguns segundos.",
          402: "Créditos insuficientes.",
          401: "Token de IA inválido. Verifique LOVABLE_API_KEY.",
        };

        return new Response(
          JSON.stringify({ error: errorMap[status] || `Erro no gateway de IA (${status})` }),
          { status: status >= 500 ? 502 : status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // ── Action: save ──
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

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dev-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

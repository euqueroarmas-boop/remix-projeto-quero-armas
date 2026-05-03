// qa-kb-audit-plan
// Lê o artigo (title + body) e usa Lovable AI para gerar um PLANO DE NAVEGAÇÃO.
// O plano é JSON estruturado com:
//  - intent: 1 frase
//  - entities: lista de entidades mencionadas (cliente, arma, CRAF, etc.)
//  - candidate_routes: rotas prováveis do sistema (ex: /quero-armas/clientes)
//  - steps: lista de passos { n, route, expected_text[], action?, confidence }
//
// IMPORTANTE: esta função NÃO gera imagem. Não chama imagegen.
// Quem captura screenshot é o Playwright (workflow qa-kb-audit).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KNOWN_ROUTES: { route: string; description: string }[] = [
  { route: "/quero-armas/dashboard", description: "Dashboard / KPIs da equipe" },
  { route: "/quero-armas/clientes", description: "Lista de clientes" },
  { route: "/quero-armas/contratacoes", description: "Contratações / vendas" },
  { route: "/quero-armas/contratacoes-pendentes", description: "Contratações pendentes" },
  { route: "/quero-armas/processos", description: "Processos administrativos" },
  { route: "/quero-armas/financeiro", description: "Financeiro / cobranças" },
  { route: "/quero-armas/documentos", description: "Documentos do cliente / hub" },
  { route: "/quero-armas/armamentos", description: "Arsenal / armamentos cadastrados" },
  { route: "/quero-armas/auditoria", description: "Auditoria interna" },
  { route: "/quero-armas/base-equipe", description: "Base de Conhecimento (equipe)" },
  { route: "/quero-armas/base-conhecimento", description: "Base de Conhecimento (cliente)" },
  { route: "/quero-armas/jurisprudencia", description: "Jurisprudência" },
  { route: "/quero-armas/legislacao", description: "Legislação" },
  { route: "/quero-armas/modelos-docx", description: "Modelos .docx" },
  { route: "/quero-armas/precos-servicos", description: "Preços e serviços" },
  { route: "/quero-armas/casos", description: "Casos jurídicos" },
  { route: "/quero-armas/correcoes-ia", description: "Correções supervisionadas da IA" },
  { route: "/quero-armas/historico", description: "Histórico" },
  { route: "/quero-armas/relatorios", description: "Relatórios" },
  { route: "/quero-armas/clubes", description: "Clubes de tiro" },
  { route: "/quero-armas/configuracoes", description: "Configurações" },
  { route: "/quero-armas/acessos", description: "Acessos / controle" },
];

const SYSTEM_PROMPT = `Você é um auditor que analisa artigos da Base de Conhecimento Quero Armas
e produz um PLANO DE NAVEGAÇÃO para o Playwright capturar screenshots reais.

REGRAS DURAS:
1. Você NÃO gera imagens. Apenas planeja navegação.
2. Use SOMENTE rotas reais da lista fornecida. Nunca invente rota.
3. Se não houver rota plausível, retorne steps=[] e confidence baixo.
4. Cada passo deve listar 1-3 textos esperados (expected_text) que provam que a tela é a correta.
5. confidence ∈ [0,1]. needs_human_review é APENAS um sinalizador informativo
   (telemetria) — NÃO bloqueia a execução do Playwright. Marque true quando
   o overall_confidence < 0.6 para que a equipe veja na auditoria.
6. Não suponha botões/ações que você não tenha certeza que existem.
`;

function buildUserPrompt(article: { title: string; body: string }) {
  const routeList = KNOWN_ROUTES.map((r) => `- ${r.route} — ${r.description}`).join("\n");
  return `Rotas conhecidas do sistema:\n${routeList}\n\n=== ARTIGO ===\nTítulo: ${article.title}\n\n${article.body.slice(0, 6000)}`;
}

const TOOL = {
  type: "function",
  function: {
    name: "emit_audit_plan",
    description: "Emite o plano de navegação estruturado para o Playwright",
    parameters: {
      type: "object",
      properties: {
        intent: { type: "string" },
        entities: { type: "array", items: { type: "string" } },
        candidate_routes: { type: "array", items: { type: "string" } },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              n: { type: "integer", minimum: 1 },
              route: { type: "string" },
              caption: { type: "string" },
              expected_text: { type: "array", items: { type: "string" } },
              click: { type: "string", description: "Seletor opcional a clicar" },
              fill: { type: "string", description: "selector::valor opcional" },
              wait: { type: "string", description: "selector opcional para esperar" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["n", "route", "expected_text", "confidence"],
            additionalProperties: false,
          },
        },
        overall_confidence: { type: "number", minimum: 0, maximum: 1 },
        needs_human_review: { type: "boolean" },
        notes: { type: "string" },
      },
      required: ["intent", "entities", "candidate_routes", "steps", "overall_confidence", "needs_human_review"],
      additionalProperties: false,
    },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { article_id, dry_run = false } = await req.json();
    if (!article_id) {
      return json({ error: "article_id obrigatório" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: article, error } = await supabase
      .from("qa_kb_artigos")
      .select("id,title,body")
      .eq("id", article_id)
      .maybeSingle();
    if (error) throw error;
    if (!article) return json({ error: "artigo não encontrado" }, 404);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const model = "google/gemini-2.5-flash";
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(article) },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "emit_audit_plan" } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      if (aiResp.status === 429) return json({ error: "Rate limit. Tente novamente em instantes." }, 429);
      if (aiResp.status === 402) return json({ error: "Créditos esgotados na Lovable AI." }, 402);
      return json({ error: `AI gateway: ${text}` }, 500);
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return json({ error: "IA não retornou plano estruturado", raw: data }, 500);
    }
    const plan = JSON.parse(call.function.arguments);

    if (!dry_run) {
      await supabase
        .from("qa_kb_artigos")
        .update({
          audit_plan_json: plan,
          audit_plan_generated_at: new Date().toISOString(),
          audit_plan_model: model,
        })
        .eq("id", article_id);
    }

    return json({ ok: true, article_id, plan, model });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
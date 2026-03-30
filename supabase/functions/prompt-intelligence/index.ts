import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ─── Data Gathering ───

async function gatherTestData(supabase: ReturnType<typeof getSupabase>) {
  const { data: recentRuns } = await supabase
    .from("test_runs")
    .select("id, suite, test_type, status, failed_tests, passed_tests, total_tests, error_summary, duration_ms, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const failedRuns = (recentRuns || []).filter((r: any) => r.status === "failed" || (r.failed_tests && r.failed_tests > 0));

  let failureDetails: any[] = [];
  if (failedRuns.length > 0) {
    const failedIds = failedRuns.slice(0, 5).map((r: any) => r.id);
    const { data: events } = await supabase
      .from("test_run_events")
      .select("run_id, event_type, spec_name, test_name, error_message, status")
      .in("run_id", failedIds)
      .eq("status", "failed")
      .limit(30);
    failureDetails = events || [];
  }

  return { recentRuns: recentRuns || [], failedRuns, failureDetails };
}

async function gatherLogData(supabase: ReturnType<typeof getSupabase>) {
  const { data: recentErrors } = await supabase
    .from("logs_sistema")
    .select("tipo, status, mensagem, created_at")
    .eq("status", "error")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: integrationErrors } = await supabase
    .from("integration_logs")
    .select("integration_name, operation_name, status, error_message, created_at")
    .eq("status", "error")
    .order("created_at", { ascending: false })
    .limit(10);

  return { recentErrors: recentErrors || [], integrationErrors: integrationErrors || [] };
}

async function gatherContractData(supabase: ReturnType<typeof getSupabase>) {
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, contract_type, status, signed, monthly_value, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return { contracts: contracts || [] };
}

async function gatherFunnelData(supabase: ReturnType<typeof getSupabase>) {
  const { count: leadsCount } = await supabase.from("leads").select("id", { count: "exact", head: true });
  const { count: quotesCount } = await supabase.from("quotes").select("id", { count: "exact", head: true });
  const { count: contractsCount } = await supabase.from("contracts").select("id", { count: "exact", head: true });
  const { count: paymentsCount } = await supabase.from("payments").select("id", { count: "exact", head: true });
  const { count: signedCount } = await supabase.from("contracts").select("id", { count: "exact", head: true }).eq("signed", true);

  return {
    leads: leadsCount || 0,
    quotes: quotesCount || 0,
    contracts: contractsCount || 0,
    signedContracts: signedCount || 0,
    payments: paymentsCount || 0,
  };
}

// ─── Deduplication ───

async function findExistingPrompt(supabase: ReturnType<typeof getSupabase>, title: string): Promise<any | null> {
  const { data } = await supabase
    .from("prompt_intelligence")
    .select("id, prompts, applied, confidence")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!data) return null;

  for (const record of data) {
    const prompts = record.prompts as any[];
    if (!prompts) continue;
    const match = prompts.find((p: any) =>
      p.title?.toLowerCase().trim() === title.toLowerCase().trim()
    );
    if (match) return { ...match, recordId: record.id, applied: record.applied };
  }
  return null;
}

// ─── Impact Score Calculator ───

function calculateImpactScore(prompt: any, funnel: any): number {
  let score = 0;

  // Priority weight
  if (prompt.priority === "high") score += 40;
  else if (prompt.priority === "medium") score += 20;
  else score += 5;

  // Type weight (revenue-focused)
  if (prompt.type === "conversion") score += 30;
  else if (prompt.type === "fix") score += 25;
  else if (prompt.type === "optimize") score += 15;
  else if (prompt.type === "create") score += 10;
  else score += 5;

  // Impact area weight
  if (prompt.impact === "revenue") score += 25;
  else if (prompt.impact === "stability") score += 20;
  else if (prompt.impact === "ux") score += 15;
  else if (prompt.impact === "seo") score += 10;
  else if (prompt.impact === "performance") score += 10;

  // Funnel drop-off bonus
  if (funnel) {
    const conversionRate = funnel.payments > 0 && funnel.leads > 0
      ? funnel.payments / funnel.leads
      : 0;
    if (conversionRate < 0.05) score += 15; // Very low conversion
    else if (conversionRate < 0.1) score += 8;
  }

  return Math.min(score / 100, 1.0);
}

// ─── Confidence Scorer ───

function calculateConfidence(prompt: any, existingMatch: any | null): number {
  let conf = 0.5;

  // If we've seen this before and it was applied successfully
  if (existingMatch?.applied) conf += 0.3;

  // High priority = higher confidence in relevance
  if (prompt.priority === "high") conf += 0.1;

  // Fix type = usually clear action
  if (prompt.type === "fix") conf += 0.1;

  // Small effort = safer to auto-apply
  if (prompt.estimated_effort === "small") conf += 0.1;

  return Math.min(conf, 1.0);
}

// ─── Auto-applicability Rules ───

function isAutoApplicable(prompt: any, confidence: number): boolean {
  if (confidence < 0.8) return false;

  // Safe auto-apply types
  const safeTypes = ["optimize", "standardize"];
  const safeImpacts = ["seo", "performance"];

  if (safeTypes.includes(prompt.type) && safeImpacts.includes(prompt.impact)) return true;

  // Small effort fixes with high confidence
  if (prompt.estimated_effort === "small" && confidence >= 0.9) return true;

  return false;
}

// ─── Source Detection ───

function detectSource(prompt: any, tests: any, logs: any): string {
  const titleLower = (prompt.title || "").toLowerCase();
  const descLower = (prompt.description || "").toLowerCase();
  const combined = titleLower + " " + descLower;

  if (combined.includes("teste") || combined.includes("cypress") || combined.includes("spec")) return "test";
  if (combined.includes("erro") || combined.includes("log") || combined.includes("falha")) return "log";
  if (combined.includes("funil") || combined.includes("conversão") || combined.includes("lead")) return "funnel";
  if (combined.includes("contrato") || combined.includes("assinatura")) return "contract";

  // Check if related to recent test failures
  if (tests.failedRuns.length > 0) return "test";
  if (logs.recentErrors.length > 0) return "log";

  return "log";
}

// ─── Prompt Type Mapper ───

function mapPromptType(type: string): string {
  const map: Record<string, string> = {
    fix: "correction",
    create: "growth",
    optimize: "ux",
    standardize: "ux",
    conversion: "conversion",
  };
  return map[type] || "correction";
}

// ─── AI Prompt Generation ───

async function generatePromptsWithAI(analysisData: any): Promise<any> {
  const systemPrompt = `Você é um arquiteto de software sênior especializado no projeto WMTi (empresa de TI corporativa).
Sua tarefa é analisar dados reais do sistema e gerar PROMPTS específicos e acionáveis para o Lovable (editor AI).

CONTEXTO DO PROJETO WMTi:
- Site institucional + sistema de orçamento/contrato/pagamento
- Stack: React + Vite + Tailwind + Supabase
- Testes E2E com Cypress via GitHub Actions
- Funil: Lead → Orçamento → Contrato → Pagamento
- Integrações: WhatsApp, Asaas (pagamentos), Brasil API (CNPJ/CEP)
- Multilíngue (pt-BR / en-US)
- Blog com IA
- Painel administrativo completo

REGRAS:
- Gere prompts ESPECÍFICOS ao projeto WMTi, nunca genéricos
- Cada prompt deve ser executável diretamente no Lovable
- Considere o funil completo (lead → pagamento)
- Considere integrações existentes (WhatsApp, contratos, cálculos)
- NÃO sugira mudanças destrutivas
- NÃO sugira SEO se dados indicarem homologação
- Priorize por impacto no faturamento e estabilidade
- Para cada prompt, estime: impact (stability|revenue|ux|performance|seo), estimated_effort (small|medium|large)

FORMATO DE RESPOSTA (JSON):
{
  "summary": "resumo da análise em 2-3 frases",
  "prompts": [
    {
      "type": "fix | create | optimize | standardize | conversion",
      "title": "título curto",
      "description": "descrição do problema/oportunidade",
      "prompt": "prompt completo pronto para colar no Lovable",
      "priority": "high | medium | low",
      "impact": "stability | revenue | ux | performance | seo",
      "estimated_effort": "small | medium | large"
    }
  ]
}`;

  const userPrompt = `Analise os seguintes dados reais do sistema WMTi e gere prompts de melhoria:

## DADOS DE TESTES
${JSON.stringify(analysisData.tests, null, 2)}

## ERROS RECENTES DO SISTEMA
${JSON.stringify(analysisData.logs, null, 2)}

## CONTRATOS
${JSON.stringify(analysisData.contracts, null, 2)}

## FUNIL DE CONVERSÃO
${JSON.stringify(analysisData.funnel, null, 2)}

## ESTRUTURA DO PROJETO
${JSON.stringify(analysisData.structure, null, 2)}

Gere entre 5 e 15 prompts priorizados. Retorne APENAS o JSON, sem markdown.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Gateway error ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "{}";

  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  return JSON.parse(cleaned);
}

// ─── Enrich Prompts with Brain Fields ───

async function enrichPrompts(
  supabase: ReturnType<typeof getSupabase>,
  prompts: any[],
  analysisData: any
): Promise<any[]> {
  const enriched = [];

  for (const p of prompts) {
    const existingMatch = await findExistingPrompt(supabase, p.title);

    const confidence = calculateConfidence(p, existingMatch);
    const impactScore = calculateImpactScore(p, analysisData.funnel);
    const source = detectSource(p, analysisData.tests, analysisData.logs);
    const promptType = mapPromptType(p.type);
    const autoApplicable = isAutoApplicable(p, confidence);

    enriched.push({
      ...p,
      confidence: Math.round(confidence * 100) / 100,
      impact_score: Math.round(impactScore * 100) / 100,
      source,
      prompt_type: promptType,
      auto_applicable: autoApplicable,
      applied: false,
      deduplicated: !!existingMatch,
    });
  }

  // Sort by impact_score descending
  enriched.sort((a, b) => b.impact_score - a.impact_score);

  return enriched;
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabase();

  try {
    const body = await req.json();
    const action = body.action || "analyze";

    // ─── LIST ───
    if (action === "list") {
      const { data, error } = await supabase
        .from("prompt_intelligence")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(body.limit || 10);

      if (error) throw error;
      return new Response(JSON.stringify({ results: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── MARK APPLIED ───
    if (action === "apply") {
      const { id, promptIndex } = body;
      if (!id) throw new Error("id required");

      const { data: record } = await supabase
        .from("prompt_intelligence")
        .select("prompts")
        .eq("id", id)
        .single();

      if (record?.prompts && Array.isArray(record.prompts)) {
        const updatedPrompts = [...record.prompts];
        if (promptIndex !== undefined && updatedPrompts[promptIndex]) {
          (updatedPrompts[promptIndex] as any).applied = true;
        }
        await supabase.from("prompt_intelligence").update({
          prompts: updatedPrompts,
          applied: true,
          applied_at: new Date().toISOString(),
        }).eq("id", id);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── REJECT ───
    if (action === "reject") {
      const { id, promptIndex } = body;
      if (!id) throw new Error("id required");

      const { data: record } = await supabase
        .from("prompt_intelligence")
        .select("prompts")
        .eq("id", id)
        .single();

      if (record?.prompts && Array.isArray(record.prompts)) {
        const updatedPrompts = [...record.prompts];
        if (promptIndex !== undefined && updatedPrompts[promptIndex]) {
          (updatedPrompts[promptIndex] as any).applied = false;
          (updatedPrompts[promptIndex] as any).rejected = true;
        }
        await supabase.from("prompt_intelligence").update({
          prompts: updatedPrompts,
          rejected_at: new Date().toISOString(),
        }).eq("id", id);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ANALYZE ───
    if (action === "analyze") {
      const { data: record, error: insertErr } = await supabase
        .from("prompt_intelligence")
        .insert({ status: "running", analysis_type: body.type || "full" })
        .select("id")
        .single();

      if (insertErr) throw insertErr;
      const recordId = record.id;

      const [tests, logs, contracts, funnel] = await Promise.all([
        gatherTestData(supabase),
        gatherLogData(supabase),
        gatherContractData(supabase),
        gatherFunnelData(supabase),
      ]);

      const structure = {
        pages: [
          "Index", "ServicosPage", "OrcamentoTiPage", "ContratoPage", "BlogPage",
          "AdminPage", "AreaDoClientePage", "CartoriosPage", "LocacaoPage",
          "AdministracaoServidoresPage", "SuporteTiPage", "TerceirizacaoPage",
        ],
        integrations: ["Asaas", "BrasilAPI", "WhatsApp", "Cypress/GitHub Actions", "Resend"],
        testSuites: ["smoke", "contracts", "seo", "checkout", "full"],
        coreFlows: ["lead-capture", "budget-calculator", "contract-generation", "payment", "client-portal"],
      };

      const analysisData = { tests, logs, contracts, funnel, structure };

      let aiResult: any;
      try {
        aiResult = await generatePromptsWithAI(analysisData);
      } catch (aiErr) {
        await supabase.from("prompt_intelligence").update({
          status: "error",
          summary: `Erro na IA: ${String(aiErr)}`,
          finished_at: new Date().toISOString(),
        }).eq("id", recordId);

        return new Response(JSON.stringify({ error: String(aiErr), id: recordId }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Enrich with brain fields
      const rawPrompts = aiResult.prompts || [];
      const enrichedPrompts = await enrichPrompts(supabase, rawPrompts, analysisData);

      const high = enrichedPrompts.filter((p: any) => p.priority === "high").length;
      const medium = enrichedPrompts.filter((p: any) => p.priority === "medium").length;
      const low = enrichedPrompts.filter((p: any) => p.priority === "low").length;

      // Calculate aggregate scores
      const avgConfidence = enrichedPrompts.length > 0
        ? enrichedPrompts.reduce((s: number, p: any) => s + p.confidence, 0) / enrichedPrompts.length
        : 0;
      const avgImpact = enrichedPrompts.length > 0
        ? enrichedPrompts.reduce((s: number, p: any) => s + p.impact_score, 0) / enrichedPrompts.length
        : 0;
      const autoCount = enrichedPrompts.filter((p: any) => p.auto_applicable).length;

      await supabase.from("prompt_intelligence").update({
        status: "completed",
        analysis_data: analysisData,
        prompts: enrichedPrompts,
        summary: aiResult.summary || "",
        total_prompts: enrichedPrompts.length,
        high_priority: high,
        medium_priority: medium,
        low_priority: low,
        confidence: Math.round(avgConfidence * 100) / 100,
        impact_score: Math.round(avgImpact * 100) / 100,
        auto_applicable: autoCount > 0,
        finished_at: new Date().toISOString(),
      }).eq("id", recordId);

      return new Response(JSON.stringify({
        id: recordId,
        summary: aiResult.summary,
        prompts: enrichedPrompts,
        counts: { total: enrichedPrompts.length, high, medium, low, auto: autoCount },
        scores: { avgConfidence: Math.round(avgConfidence * 100) / 100, avgImpact: Math.round(avgImpact * 100) / 100 },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[prompt-intelligence] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

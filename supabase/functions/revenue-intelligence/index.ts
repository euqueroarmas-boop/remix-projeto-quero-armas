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

// ─── Plan pricing table ───
const PLAN_PRICES: Record<string, number> = {
  essencial: 89,
  profissional: 149,
  enterprise: 249,
  premium: 349,
};

// ─── Heuristic Lead Analysis ───

function estimateLeadValue(quote: any, lead: any): number {
  const plan = quote?.selected_plan || "essencial";
  const qty = quote?.computers_qty || 1;
  const basePrice = PLAN_PRICES[plan] || 89;
  // Monthly * 12 months minimum
  return basePrice * qty * 12;
}

function estimateUrgency(lead: any, quote: any): string {
  const msg = (lead?.message || "").toLowerCase();
  const interest = (lead?.service_interest || "").toLowerCase();

  if (msg.includes("urgente") || msg.includes("emergenc") || msg.includes("caiu") || msg.includes("parou")) return "critica";
  if (msg.includes("rapido") || msg.includes("precisamos") || interest.includes("emergenc")) return "alta";
  if (quote?.needs_server_migration || quote?.needs_backup) return "media";
  return "baixa";
}

function estimateConversionProbability(lead: any, quote: any): number {
  let prob = 0.3; // base

  // Has quote = more engaged
  if (quote) prob += 0.2;

  // More machines = more serious
  const qty = quote?.computers_qty || 0;
  if (qty >= 10) prob += 0.15;
  else if (qty >= 5) prob += 0.1;

  // Has phone = contactable
  if (lead?.phone || lead?.whatsapp) prob += 0.1;

  // Has company name = B2B
  if (lead?.company) prob += 0.05;

  // Service interest aligned with core offerings
  const interest = (lead?.service_interest || "").toLowerCase();
  if (interest.includes("suporte") || interest.includes("locacao") || interest.includes("servidor")) prob += 0.1;

  // Urgency signals
  const msg = (lead?.message || "").toLowerCase();
  if (msg.includes("urgente") || msg.includes("emergenc")) prob += 0.1;

  return Math.min(prob, 0.95);
}

function inferSector(lead: any): string {
  const company = (lead?.company || "").toLowerCase();
  const interest = (lead?.service_interest || "").toLowerCase();

  if (company.includes("cartorio") || company.includes("serventia") || interest.includes("cartorio")) return "cartorio";
  if (company.includes("contabil") || company.includes("escritorio")) return "contabilidade";
  if (company.includes("advocacia") || company.includes("jurídico")) return "advocacia";
  if (company.includes("clinica") || company.includes("hospital")) return "saude";
  if (company.includes("industria")) return "industria";
  return "geral";
}

function inferCompanySize(quote: any): string {
  const qty = quote?.computers_qty || 0;
  if (qty >= 50) return "grande";
  if (qty >= 20) return "media";
  if (qty >= 5) return "pequena";
  return "micro";
}

function inferDecisionStage(lead: any, quote: any): string {
  if (!quote) return "awareness";
  if (quote.status === "pending") return "consideration";
  if (quote.status === "approved") return "decision";
  return "consideration";
}

function inferPainPoint(lead: any): string {
  const msg = (lead?.message || "").toLowerCase();
  if (msg.includes("lento") || msg.includes("performance")) return "performance";
  if (msg.includes("segurança") || msg.includes("virus") || msg.includes("hack")) return "seguranca";
  if (msg.includes("backup") || msg.includes("perda")) return "backup";
  if (msg.includes("rede") || msg.includes("internet")) return "rede";
  if (msg.includes("servidor")) return "servidor";
  if (msg.includes("suporte")) return "suporte";
  return "geral";
}

function suggestStrategy(urgency: string, probability: number): string {
  if (urgency === "critica") return "urgencia";
  if (probability >= 0.7) return "autoridade";
  if (probability <= 0.3) return "educacao";
  if (probability >= 0.5) return "pressao";
  return "desconto";
}

// ─── AI Summary ───

async function generateLeadSummary(leads: any[]): Promise<string> {
  if (leads.length === 0) return "Nenhum lead para analisar.";

  const topLeads = leads.slice(0, 10).map(l => ({
    service: l.service_type,
    value: l.lead_value_estimate,
    probability: l.conversion_probability,
    urgency: l.urgency_level,
    strategy: l.strategy,
  }));

  const totalValue = leads.reduce((s, l) => s + (l.lead_value_estimate || 0), 0);
  const avgProb = leads.reduce((s, l) => s + (l.conversion_probability || 0), 0) / leads.length;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Você é um analista de negócios da WMTi. Resuma em 3 frases a situação dos leads analisados, focando em receita potencial e ações prioritárias. Responda em português." },
          { role: "user", content: `Leads: ${JSON.stringify(topLeads)}. Total estimado: R$${totalValue.toFixed(2)}. Probabilidade média: ${(avgProb * 100).toFixed(0)}%.` },
        ],
      }),
    });

    if (!response.ok) return `${leads.length} leads analisados. Receita potencial: R$${totalValue.toFixed(2)}.`;

    const result = await response.json();
    return result.choices?.[0]?.message?.content || `${leads.length} leads analisados.`;
  } catch {
    return `${leads.length} leads analisados. Receita potencial: R$${totalValue.toFixed(2)}.`;
  }
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
        .from("revenue_intelligence")
        .select("*")
        .order("conversion_probability", { ascending: false })
        .limit(body.limit || 20);

      if (error) throw error;
      return new Response(JSON.stringify({ results: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ANALYZE ALL LEADS ───
    if (action === "analyze") {
      // Get leads with their quotes
      const { data: leads } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: budgetLeads } = await supabase
        .from("budget_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: quotes } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      // Build quote map by lead_id
      const quoteMap: Record<string, any> = {};
      for (const q of quotes || []) {
        if (q.lead_id) quoteMap[q.lead_id] = q;
      }

      const analyzed: any[] = [];

      // Analyze leads
      for (const lead of leads || []) {
        const quote = quoteMap[lead.id];
        const convProb = estimateConversionProbability(lead, quote);
        const urgency = estimateUrgency(lead, quote);
        const value = estimateLeadValue(quote, lead);
        const sector = inferSector(lead);
        const size = inferCompanySize(quote);
        const stage = inferDecisionStage(lead, quote);
        const pain = inferPainPoint(lead);
        const strategy = suggestStrategy(urgency, convProb);

        const record = {
          lead_id: lead.id,
          quote_id: quote?.id || null,
          service_type: lead.service_interest || "suporte_ti",
          lead_value_estimate: value,
          conversion_probability: Math.round(convProb * 100) / 100,
          urgency_level: urgency,
          decision_stage: stage,
          strategy,
          company_size: size,
          machines_qty: quote?.computers_qty || 0,
          pain_point: pain,
          sector,
        };

        analyzed.push(record);
      }

      // Analyze budget leads (no quote association)
      for (const bl of budgetLeads || []) {
        const convProb = 0.4; // base for budget leads
        const record = {
          lead_id: null,
          quote_id: null,
          service_type: "orcamento",
          lead_value_estimate: 1068, // 89*12 minimum
          conversion_probability: convProb,
          urgency_level: "media",
          decision_stage: "awareness",
          strategy: "educacao",
          company_size: "micro",
          machines_qty: 0,
          pain_point: (bl.observations || "").includes("urgente") ? "urgente" : "geral",
          sector: "geral",
        };
        analyzed.push(record);
      }

      // Upsert into revenue_intelligence (clear old and insert new)
      if (analyzed.length > 0) {
        // Insert new analysis
        const { error: insertErr } = await supabase
          .from("revenue_intelligence")
          .insert(analyzed);

        if (insertErr) console.error("Insert error:", insertErr);
      }

      // Generate AI summary
      const summary = await generateLeadSummary(analyzed);

      // Stats
      const totalValue = analyzed.reduce((s, l) => s + (l.lead_value_estimate || 0), 0);
      const avgProb = analyzed.length > 0
        ? analyzed.reduce((s, l) => s + l.conversion_probability, 0) / analyzed.length
        : 0;
      const hotLeads = analyzed.filter(l => l.conversion_probability >= 0.6).length;
      const criticalLeads = analyzed.filter(l => l.urgency_level === "critica").length;

      return new Response(JSON.stringify({
        total: analyzed.length,
        summary,
        stats: {
          totalValue: Math.round(totalValue),
          avgProbability: Math.round(avgProb * 100),
          hotLeads,
          criticalLeads,
        },
        leads: analyzed.sort((a, b) => b.conversion_probability - a.conversion_probability),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ANALYZE SINGLE LEAD ───
    if (action === "analyze_single") {
      const { lead_id } = body;
      if (!lead_id) throw new Error("lead_id required");

      const { data: lead } = await supabase
        .from("leads")
        .select("*")
        .eq("id", lead_id)
        .single();

      if (!lead) throw new Error("Lead not found");

      const { data: quotes } = await supabase
        .from("quotes")
        .select("*")
        .eq("lead_id", lead_id)
        .limit(1);

      const quote = quotes?.[0] || null;
      const convProb = estimateConversionProbability(lead, quote);
      const urgency = estimateUrgency(lead, quote);
      const value = estimateLeadValue(quote, lead);

      const record = {
        lead_id: lead.id,
        quote_id: quote?.id || null,
        service_type: lead.service_interest || "suporte_ti",
        lead_value_estimate: value,
        conversion_probability: Math.round(convProb * 100) / 100,
        urgency_level: urgency,
        decision_stage: inferDecisionStage(lead, quote),
        strategy: suggestStrategy(urgency, convProb),
        company_size: inferCompanySize(quote),
        machines_qty: quote?.computers_qty || 0,
        pain_point: inferPainPoint(lead),
        sector: inferSector(lead),
      };

      await supabase.from("revenue_intelligence").insert(record);

      return new Response(JSON.stringify({ lead: record }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[revenue-intelligence] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

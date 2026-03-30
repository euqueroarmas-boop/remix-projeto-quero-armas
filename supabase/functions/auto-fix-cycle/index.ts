import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyAdminToken(token: string, password: string): Promise<boolean> {
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  if (Date.now() - Number(ts) > 8 * 3600 * 1000) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`admin:${ts}`)))).map(b => b.toString(16).padStart(2, "0")).join("");
  return expected === sig;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminToken = req.headers.get("x-admin-token") || "";
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    if (!ADMIN_PASSWORD) return json({ error: "ADMIN_PASSWORD não configurado" }, 500);
    if (!(await verifyAdminToken(adminToken, ADMIN_PASSWORD))) return json({ error: "Token inválido" }, 401);

    const { run_id, attempt = 1, max_attempts = 3 } = await req.json();
    if (!run_id) return json({ error: "run_id obrigatório" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurado" }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Get failed test run
    const { data: run, error: runErr } = await supabase.from("test_runs").select("*").eq("id", run_id).single();
    if (runErr || !run) return json({ error: "Test run não encontrado" }, 404);
    if (run.status !== "failed") return json({ error: "Test run não está em status failed", status: run.status }, 400);

    const errorContext = [
      `Suite: ${run.suite} | Tipo: ${run.test_type}`,
      `Erro: ${run.error_message || run.error_summary || "Sem mensagem de erro"}`,
      run.results ? `Resultados: ${JSON.stringify(
        (run.results as any[]).filter((r: any) => r.status === "failed").map((r: any) => ({
          name: r.name, spec: r.spec, error: r.error_message?.slice(0, 300),
        }))
      )}` : "",
    ].filter(Boolean).join("\n");

    // 2. Call AI for fix suggestion
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um engenheiro Cypress expert. Corrija o teste que falhou.

REGRAS:
1. Responda APENAS com um bloco de código completo do arquivo corrigido
2. Na PRIMEIRA LINHA do código, coloque o caminho do arquivo como comentário: // path/to/file.ts
3. Gere o arquivo COMPLETO, não apenas o trecho alterado
4. Foque na correção do erro específico
5. Use timeout adequado (15000-20000ms) para elementos dinâmicos
6. Use cy.intercept + cy.wait para chamadas de API

FORMATO:
\`\`\`ts
// cypress/e2e/arquivo.cy.ts
<código completo>
\`\`\``,
          },
          {
            role: "user",
            content: `Corrija este teste Cypress que falhou (tentativa ${attempt}/${max_attempts}):\n\n${errorContext}`,
          },
        ],
        stream: false,
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return json({ error: "Falha ao consultar IA", details: t }, 502);
    }

    const aiData = await aiResp.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    // 3. Extract code and file path
    const codeMatch = aiContent.match(/```(?:ts|tsx|js)?\n([\s\S]*?)```/);
    if (!codeMatch) {
      await supabase.from("prompt_intelligence").insert({
        analysis_type: "auto_fix",
        status: "failed",
        summary: `Auto-fix tentativa ${attempt}: IA não gerou código válido`,
        source: "auto_execution",
        confidence: 0,
        triggered_by: "auto_execution",
        prompts: [{ error: errorContext, ai_response: aiContent.slice(0, 500) }],
      });
      return json({ success: false, error: "IA não gerou código executável", attempt, ai_response: aiContent.slice(0, 300) });
    }

    const code = codeMatch[1].trim();
    const filePathMatch = code.split("\n")[0]?.match(/^\/\/\s*(.+\.\w+)/);
    const filePath = filePathMatch?.[1]?.trim();

    if (!filePath) {
      return json({ success: false, error: "Caminho do arquivo não detectado no código gerado", attempt });
    }

    // 4. Apply patch via execute-code-patch (with branch mode)
    const patchUrl = `${supabaseUrl}/functions/v1/execute-code-patch`;
    const patchResp = await fetch(patchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": adminToken,
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}`,
      },
      body: JSON.stringify({
        file_path: filePath,
        content: code,
        commit_message: `fix(auto): auto-fix tentativa ${attempt} — ${filePath}`,
        use_branch: true, // Always use branch for auto-fix
      }),
    });

    if (!patchResp.ok) {
      const errText = await patchResp.text();
      return json({ error: `Patch falhou: ${patchResp.status}`, details: errText }, 502);
    }

    const patchResult = await patchResp.json();

    // 5. Log to prompt_intelligence
    await supabase.from("prompt_intelligence").insert({
      analysis_type: "auto_fix",
      status: "applied",
      summary: `Auto-fix tentativa ${attempt}: patch em branch ${patchResult.branch} — ${filePath}`,
      source: "auto_execution",
      confidence: 0.7,
      impact_score: 0.8,
      auto_applicable: true,
      applied: true,
      applied_at: new Date().toISOString(),
      triggered_by: "auto_execution",
      prompts: [{
        attempt,
        file_path: filePath,
        commit_sha: patchResult.commit_sha,
        branch: patchResult.branch,
        pr_url: patchResult.pr_url,
        pr_number: patchResult.pr_number,
        error_context: errorContext.slice(0, 500),
      }],
    });

    // 6. Audit log
    await supabase.from("admin_audit_logs").insert({
      action: "auto_fix_branch",
      target_type: "test_run",
      target_id: run_id,
      after_state: {
        attempt,
        file_path: filePath,
        commit_sha: patchResult.commit_sha,
        branch: patchResult.branch,
        pr_url: patchResult.pr_url,
        pr_number: patchResult.pr_number,
      },
    });

    return json({
      success: true,
      attempt,
      max_attempts,
      file_path: filePath,
      commit_sha: patchResult.commit_sha,
      branch: patchResult.branch,
      pr_url: patchResult.pr_url,
      pr_number: patchResult.pr_number,
      message: `Patch aplicado na branch ${patchResult.branch} com PR #${patchResult.pr_number}`,
    });
  } catch (e) {
    console.error("auto-fix-cycle error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

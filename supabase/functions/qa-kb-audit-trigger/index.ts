// Edge Function: qa-kb-audit-trigger
//
// Dispara o workflow do GitHub Actions "qa-kb-audit" para 1 artigo,
// arquivando antes as imagens de auditoria atuais (status='archived')
// e marcando reprocessed_by/reprocessed_at/reprocess_reason no artigo.
//
// NÃO gera imagem por IA. Apenas inicia o pipeline Playwright.
//
// Auth: requer usuário autenticado da Equipe Quero Armas.
// Secrets: GITHUB_PAT (repo workflow scope), GITHUB_REPO ("owner/repo"),
//          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GH_PAT = Deno.env.get("GITHUB_PAT");
const GH_REPO = Deno.env.get("GITHUB_REPO"); // ex: "wmti/projeto-quero-armas"
const GH_WORKFLOW = Deno.env.get("GITHUB_WORKFLOW_FILE") ?? "qa-kb-audit.yml";
const GH_REF = Deno.env.get("GITHUB_WORKFLOW_REF") ?? "main";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  if (!GH_PAT || !GH_REPO) {
    return json(500, {
      error: "missing_github_config",
      detail: "Configure os secrets GITHUB_PAT e GITHUB_REPO (formato owner/repo).",
    });
  }

  // Identifica usuário (Equipe)
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "unauthorized" });
  const userId = userData.user.id;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const articleId = String(body.article_id ?? "").trim();
  const reason = body.reason ? String(body.reason).slice(0, 500) : null;
  const onlyErrors = body.only_errors === true;
  const viewport = String(body.viewport ?? "1440x900");

  if (!articleId) return json(400, { error: "missing_article_id" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Garante que o artigo existe
  const { data: art, error: artErr } = await admin
    .from("qa_kb_artigos")
    .select("id,slug,status")
    .eq("id", articleId)
    .maybeSingle();
  if (artErr || !art) return json(404, { error: "article_not_found" });

  // Arquiva imagens atuais (não deleta).
  // Se only_errors=true, arquiva apenas as que estão em erro.
  const archiveQuery = admin
    .from("qa_kb_artigo_imagens")
    .update({ status: "archived" })
    .eq("article_id", articleId)
    .in("status", onlyErrors ? ["error"] : ["approved", "draft", "error"]);
  const { error: archErr, count: archived } = await archiveQuery
    .select("id", { count: "exact", head: true });
  if (archErr) return json(500, { error: "archive_failed", detail: archErr.message });

  // Marca o artigo como needs_real_image enquanto a auditoria não roda;
  // o pipeline irá reabrir como needs_review se capturar evidência real.
  await admin
    .from("qa_kb_artigos")
    .update({
      status: "needs_real_image",
      reprocessed_by: userId,
      reprocessed_at: new Date().toISOString(),
      reprocess_reason: reason,
      last_review_reason: reason
        ? `Reprocesso solicitado: ${reason}`
        : "Reprocesso de auditoria solicitado pela equipe.",
    })
    .eq("id", articleId);

  // Dispara workflow_dispatch no GitHub
  const dispatchUrl = `https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`;
  const ghResp = await fetch(dispatchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_PAT}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: GH_REF,
      inputs: {
        article_ids: articleId,
        max_articles: "1",
        viewport,
      },
    }),
  });

  if (!ghResp.ok) {
    const text = await ghResp.text();
    return json(502, {
      error: "github_dispatch_failed",
      status: ghResp.status,
      detail: text.slice(0, 500),
      archived_images: archived ?? 0,
    });
  }

  return json(202, {
    ok: true,
    article_id: articleId,
    archived_images: archived ?? 0,
    workflow: GH_WORKFLOW,
    ref: GH_REF,
    only_errors: onlyErrors,
    message: "Auditoria Playwright disparada. Acompanhe pelos logs do GitHub Actions.",
  });
});
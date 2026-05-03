/**
 * QA KB Audit — entrypoint.
 *
 * Lê artigos com status='needs_real_image' (ou IDs explícitos),
 * abre o sistema real autenticado, captura screenshots reais e
 * registra em qa_kb_artigo_imagens com image_type='auditoria_real'.
 *
 * NUNCA gera imagem por IA. Se a captura falhar, o artigo permanece
 * needs_real_image e o erro é registrado.
 */
import { chromium, type Browser } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loginAsTeam } from "./login.ts";
import { parseAuditSteps, planToSteps, type AuditStep, type AuditPlan } from "./parseSteps.ts";
import { captureStep } from "./capture.ts";

const SUPABASE_URL = required("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const BASE_URL = required("QA_AUDIT_BASE_URL");
const EMAIL = required("QA_AUDIT_EMAIL");
const PASSWORD = required("QA_AUDIT_PASSWORD");
const ARTICLE_IDS = (process.env.QA_AUDIT_ARTICLE_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const MAX = Number(process.env.QA_AUDIT_MAX ?? "10") || 10;
const VIEWPORT = (process.env.QA_AUDIT_VIEWPORT ?? "1440x900").split("x").map(Number);
const [VW, VH] = [VIEWPORT[0] || 1440, VIEWPORT[1] || 900];
const DEVICE = VW >= 1024 ? "desktop" : VW >= 700 ? "tablet" : "mobile";

const LOG_DIR = join(import.meta.dir ?? ".", "logs");
mkdirSync(LOG_DIR, { recursive: true });

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`MISSING_ENV: ${name}`);
  return v;
}

type Article = {
  id: string;
  title: string;
  slug: string;
  body: string;
  status: string;
  audit_plan_json: AuditPlan | null;
};

async function loadArticles(): Promise<Article[]> {
  let q = sb.from("qa_kb_artigos").select("id,title,slug,body,status,audit_plan_json");
  if (ARTICLE_IDS.length > 0) q = q.in("id", ARTICLE_IDS);
  else q = q.eq("status", "needs_real_image");
  q = q.limit(MAX);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Article[];
}

/**
 * Garante que o artigo tenha um audit_plan_json. Se não tiver, chama a
 * edge function qa-kb-audit-plan (Lovable AI) para gerar.
 * NUNCA gera imagem — só plano de navegação.
 */
async function ensureAuditPlan(article: Article): Promise<AuditPlan | null> {
  if (article.audit_plan_json && Array.isArray(article.audit_plan_json.steps)) {
    return article.audit_plan_json;
  }
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/qa-kb-audit-plan`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ article_id: article.id }),
    });
    if (!r.ok) {
      console.warn(`[qa-kb-audit] plano IA falhou (${r.status}) para ${article.slug}`);
      return null;
    }
    const j = await r.json();
    return (j?.plan ?? null) as AuditPlan | null;
  } catch (e) {
    console.warn(`[qa-kb-audit] erro chamando qa-kb-audit-plan:`, e);
    return null;
  }
}

async function openAuditSession(): Promise<string> {
  const { data, error } = await sb
    .from("qa_kb_audit_sessions")
    .insert({
      title: `Auditoria KB ${new Date().toISOString()}`,
      status: "in_progress",
      notes: `viewport=${VW}x${VH} device=${DEVICE} base=${BASE_URL}`,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function closeAuditSession(id: string, totalShots: number, routes: string[], modules: string[]) {
  await sb
    .from("qa_kb_audit_sessions")
    .update({
      status: "finished",
      finished_at: new Date().toISOString(),
      total_screenshots: totalShots,
      routes_audited: Array.from(new Set(routes)),
      modules_audited: Array.from(new Set(modules)),
    })
    .eq("id", id);
}

async function uploadScreenshot(sessionId: string, articleId: string, step: AuditStep, png: Buffer): Promise<string> {
  const path = `auditoria/${sessionId}/${articleId}/step-${step.n}-${Date.now()}.png`;
  const { error } = await sb.storage
    .from("qa-kb-imagens")
    .upload(path, png, { contentType: "image/png", upsert: false });
  if (error) throw error;
  return path;
}

async function recordSuccess(sessionId: string, article: Article, step: AuditStep, storagePath: string, finalUrl: string) {
  const { data: pub } = sb.storage.from("qa-kb-imagens").getPublicUrl(storagePath);
  await sb.from("qa_kb_artigo_imagens").insert({
    article_id: article.id,
    step_number: step.n,
    step_title: step.caption ?? null,
    caption: step.caption ?? null,
    image_url: pub?.publicUrl ?? null,
    storage_path: storagePath,
    status: "approved",
    image_type: "auditoria_real",
    original_image_type: "auditoria_real",
    is_ai_generated_blocked: false,
    route_path: step.route,
    audit_session_id: sessionId,
    captured_at: new Date().toISOString(),
    viewport: `${VW}x${VH}`,
    device: DEVICE,
    origem: `playwright:${finalUrl}`,
  });
}

async function recordFailure(sessionId: string, article: Article, step: AuditStep | null, error: string, finalUrl: string) {
  await sb.from("qa_kb_artigo_imagens").insert({
    article_id: article.id,
    step_number: step?.n ?? 0,
    step_title: step?.caption ?? null,
    caption: "Não foi possível capturar screenshot real. Revisão humana necessária.",
    status: "error",
    image_type: "auditoria_real",
    original_image_type: "auditoria_real",
    is_ai_generated_blocked: false,
    route_path: step?.route ?? null,
    audit_session_id: sessionId,
    captured_at: new Date().toISOString(),
    viewport: `${VW}x${VH}`,
    device: DEVICE,
    origem: `playwright:${finalUrl}`,
    error_message: error.slice(0, 1000),
  });
}

async function ensureNeedsReviewIfNoSuccess(article: Article, anySuccess: boolean) {
  if (anySuccess) return;
  await sb
    .from("qa_kb_artigos")
    .update({
      status: "needs_real_image",
      last_review_reason: "qa-kb-audit-screenshots: nenhuma captura real obtida.",
    })
    .eq("id", article.id);
}

async function auditArticle(browser: Browser, sessionId: string, article: Article) {
  const log: any = { article_id: article.id, slug: article.slug, steps: [] };

  // 1. Manual audit-step (fallback canônico).
  let steps = parseAuditSteps(article.body);
  let source: "manual" | "ai_plan" = "manual";

  // 2. Se não houver manual, gera/usa plano de IA.
  if (steps.length === 0) {
    const plan = await ensureAuditPlan(article);
    log.audit_plan = plan;
    if (plan?.needs_human_review) {
      log.skipped = "ai_plan: needs_human_review";
      await recordFailure(sessionId, article, null, "AI_PLAN_NEEDS_HUMAN_REVIEW: " + (plan.notes ?? ""), BASE_URL);
      await ensureNeedsReviewIfNoSuccess(article, false);
      return { log, success: 0, routes: [], modules: [] };
    }
    steps = planToSteps(plan, 0.6);
    source = "ai_plan";
  }

  if (steps.length === 0) {
    log.skipped = "no manual audit-step and no confident ai plan";
    await recordFailure(sessionId, article, null, "NO_AUDIT_STEPS_AVAILABLE (manual e IA sem plano confiável)", BASE_URL);
    await ensureNeedsReviewIfNoSuccess(article, false);
    return { log, success: 0, routes: [], modules: [] };
  }
  log.steps_source = source;

  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 1,
    userAgent: `QA-KB-Auditor/1.0 Playwright (${DEVICE})`,
  });
  const page = await ctx.newPage();

  let success = 0;
  const routes: string[] = [];

  try {
    await loginAsTeam(page, BASE_URL, EMAIL, PASSWORD);

    for (const step of steps) {
      routes.push(step.route);
      const r = await captureStep(page, BASE_URL, step);
      if (r.ok) {
        const path = await uploadScreenshot(sessionId, article.id, step, r.buffer);
        await recordSuccess(sessionId, article, step, path, r.finalUrl);
        log.steps.push({ n: step.n, route: step.route, ok: true, path, source: step.source });
        success++;
      } else {
        await recordFailure(sessionId, article, step, r.error, r.finalUrl);
        log.steps.push({ n: step.n, route: step.route, ok: false, error: r.error, source: step.source });
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    log.fatal = err;
    await recordFailure(sessionId, article, null, `FATAL:${err}`, page.url());
  } finally {
    await ctx.close().catch(() => null);
  }

  await ensureNeedsReviewIfNoSuccess(article, success > 0);
  return { log, success, routes, modules: [] as string[] };
}

async function main() {
  const articles = await loadArticles();
  console.log(`[qa-kb-audit] artigos a auditar: ${articles.length}`);
  if (articles.length === 0) {
    writeFileSync(join(LOG_DIR, "summary.json"), JSON.stringify({ articles: 0 }, null, 2));
    return;
  }

  const sessionId = await openAuditSession();
  const browser = await chromium.launch({ args: ["--no-sandbox"] });

  let totalShots = 0;
  const allRoutes: string[] = [];
  const summaries: any[] = [];

  try {
    for (const article of articles) {
      console.log(`[qa-kb-audit] ▶ ${article.slug} (${article.id})`);
      const r = await auditArticle(browser, sessionId, article);
      totalShots += r.success;
      allRoutes.push(...r.routes);
      summaries.push(r.log);
    }
  } finally {
    await browser.close();
    await closeAuditSession(sessionId, totalShots, allRoutes, []);
  }

  writeFileSync(
    join(LOG_DIR, "summary.json"),
    JSON.stringify({ session_id: sessionId, total_screenshots: totalShots, articles: summaries }, null, 2),
  );
  console.log(`[qa-kb-audit] sessão ${sessionId} finalizada — ${totalShots} screenshots reais.`);
}

main().catch((e) => {
  console.error("[qa-kb-audit] ERRO FATAL:", e);
  process.exit(1);
});
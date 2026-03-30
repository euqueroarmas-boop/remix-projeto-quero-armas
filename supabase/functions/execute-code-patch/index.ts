import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OWNER = "euqueroarmas-boop";
const REPO = "dell-shine-solutions";

async function verifyAdminToken(token: string, password: string): Promise<boolean> {
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  if (Date.now() - Number(ts) > 8 * 3600 * 1000) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = Array.from(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`admin:${ts}`)))
  ).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === sig;
}

function b64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // ── Auth ──
    const adminToken = req.headers.get("x-admin-token") || "";
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    if (!ADMIN_PASSWORD) return json({ error: "ADMIN_PASSWORD não configurado" }, 500);
    if (!(await verifyAdminToken(adminToken, ADMIN_PASSWORD))) {
      return json({ error: "Token admin inválido ou expirado" }, 401);
    }

    // ── Input validation ──
    const { file_path, content, commit_message } = await req.json();
    if (!file_path || typeof file_path !== "string" || file_path.includes("..")) {
      return json({ error: "file_path inválido" }, 400);
    }
    if (!content || typeof content !== "string") {
      return json({ error: "content é obrigatório" }, 400);
    }
    if (!commit_message || typeof commit_message !== "string") {
      return json({ error: "commit_message é obrigatório" }, 400);
    }

    // Block dangerous paths
    const blocked = [".env", "supabase/config.toml", "src/integrations/supabase/client.ts", "src/integrations/supabase/types.ts"];
    if (blocked.some((b) => file_path === b || file_path.startsWith(b + "/"))) {
      return json({ error: `Arquivo protegido: ${file_path}` }, 403);
    }

    const GITHUB_PAT = Deno.env.get("GITHUB_PAT");
    if (!GITHUB_PAT) return json({ error: "GITHUB_PAT não configurado" }, 500);

    const ghHeaders = {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(file_path)}`;

    // ── Get current SHA (file may not exist yet) ──
    let sha: string | undefined;
    const getResp = await fetch(apiUrl, { headers: ghHeaders });
    if (getResp.ok) {
      const fileData = await getResp.json();
      sha = fileData.sha;
    } else if (getResp.status !== 404) {
      const errText = await getResp.text();
      console.error("GitHub GET error:", getResp.status, errText);
      return json({ error: `GitHub GET falhou: ${getResp.status}` }, 502);
    }
    // 404 = new file, no sha needed

    // ── Commit ──
    const putBody: Record<string, unknown> = {
      message: commit_message,
      content: b64Encode(content),
    };
    if (sha) putBody.sha = sha;

    const putResp = await fetch(apiUrl, {
      method: "PUT",
      headers: ghHeaders,
      body: JSON.stringify(putBody),
    });

    if (!putResp.ok) {
      const errText = await putResp.text();
      console.error("GitHub PUT error:", putResp.status, errText);
      return json({ error: `GitHub commit falhou: ${putResp.status}`, details: errText }, 502);
    }

    const result = await putResp.json();

    // ── Audit log ──
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("admin_audit_logs").insert({
        action: "code_patch_applied",
        target_type: "file",
        target_id: file_path,
        after_state: { commit_message, sha: result.content?.sha, commit_sha: result.commit?.sha },
      });
    } catch (e) {
      console.error("Audit log failed:", e);
    }

    return json({
      success: true,
      file_path,
      commit_sha: result.commit?.sha,
      commit_url: result.commit?.html_url,
      file_url: result.content?.html_url,
    });
  } catch (e) {
    console.error("execute-code-patch error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

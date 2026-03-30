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

async function ghFetch(path: string, ghHeaders: Record<string, string>, opts?: RequestInit) {
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`, {
    ...opts,
    headers: { ...ghHeaders, ...(opts?.headers || {}) },
  });
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
    const body = await req.json();
    const { action } = body;

    const GITHUB_PAT = Deno.env.get("GITHUB_PAT");
    if (!GITHUB_PAT) return json({ error: "GITHUB_PAT não configurado" }, 500);

    const ghHeaders = {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    // ── Merge PR action ──
    if (action === "merge_pr") {
      const { pr_number } = body;
      if (!pr_number) return json({ error: "pr_number obrigatório" }, 400);

      const mergeResp = await ghFetch(`pulls/${pr_number}/merge`, ghHeaders, {
        method: "PUT",
        body: JSON.stringify({
          commit_title: `🤖 merge: auto-fix PR #${pr_number}`,
          merge_method: "squash",
        }),
      });
      if (!mergeResp.ok) {
        const err = await mergeResp.text();
        return json({ error: `Merge falhou: ${mergeResp.status}`, details: err }, 502);
      }
      const mergeData = await mergeResp.json();

      try {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase.from("admin_audit_logs").insert({
          action: "pr_merged",
          target_type: "pull_request",
          target_id: String(pr_number),
          after_state: { sha: mergeData.sha, merged: mergeData.merged },
        });
      } catch (e) {
        console.error("Audit log failed:", e);
      }

      return json({ success: true, merged: true, sha: mergeData.sha, pr_number });
    }

    // ── Standard patch action ──
    const { file_path, content, commit_message, use_branch } = body;
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



    let targetBranch = "main";
    let branchName: string | null = null;
    let prUrl: string | null = null;
    let prNumber: number | null = null;

    // ── Branch mode: create branch from main ──
    if (use_branch) {
      branchName = `auto-fix/${Date.now()}`;

      // Get main branch SHA
      const mainRef = await ghFetch("git/ref/heads/main", ghHeaders);
      if (!mainRef.ok) return json({ error: "Falha ao buscar ref da main" }, 502);
      const mainData = await mainRef.json();
      const mainSha = mainData.object.sha;

      // Create new branch
      const createRef = await ghFetch("git/refs", ghHeaders, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha }),
      });
      if (!createRef.ok) {
        const err = await createRef.text();
        return json({ error: `Falha ao criar branch: ${createRef.status}`, details: err }, 502);
      }

      targetBranch = branchName;
    }

    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(file_path)}`;

    // ── Get current SHA on target branch ──
    let sha: string | undefined;
    const getResp = await fetch(`${apiUrl}?ref=${targetBranch}`, { headers: ghHeaders });
    if (getResp.ok) {
      const fileData = await getResp.json();
      sha = fileData.sha;
    } else if (getResp.status !== 404) {
      const errText = await getResp.text();
      console.error("GitHub GET error:", getResp.status, errText);
      return json({ error: `GitHub GET falhou: ${getResp.status}` }, 502);
    }

    // ── Commit to target branch ──
    const putBody: Record<string, unknown> = {
      message: commit_message,
      content: b64Encode(content),
      branch: targetBranch,
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

    // ── Create PR if branch mode ──
    if (branchName) {
      const prResp = await ghFetch("pulls", ghHeaders, {
        method: "POST",
        body: JSON.stringify({
          title: `🤖 Auto-fix: ${commit_message}`,
          head: branchName,
          base: "main",
          body: `## Auto-fix patch\n\n**Arquivo:** \`${file_path}\`\n**Commit:** ${result.commit?.sha?.slice(0, 7)}\n\n> Gerado automaticamente pelo sistema WMTi Auto-Fix.\n> Aguardando testes do GitHub Actions antes do merge.`,
        }),
      });

      if (prResp.ok) {
        const prData = await prResp.json();
        prUrl = prData.html_url;
        prNumber = prData.number;
      } else {
        console.error("PR creation failed:", await prResp.text());
      }
    }

    // ── Audit log ──
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("admin_audit_logs").insert({
        action: branchName ? "code_patch_branch" : "code_patch_applied",
        target_type: "file",
        target_id: file_path,
        after_state: {
          commit_message,
          sha: result.content?.sha,
          commit_sha: result.commit?.sha,
          branch: branchName || "main",
          pr_number: prNumber,
          pr_url: prUrl,
        },
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
      branch: branchName || "main",
      pr_url: prUrl,
      pr_number: prNumber,
    });
  } catch (e) {
    console.error("execute-code-patch error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

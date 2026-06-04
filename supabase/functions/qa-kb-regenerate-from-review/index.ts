import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SECTIONS = [
  "Objetivo da tela",
  "Quando usar",
  "Quem usa",
  "Onde acessar",
  "O que aparece na tela",
  "Explicação dos blocos da tela",
  "Explicação dos botões",
  "Explicação dos campos",
  "Passo a passo operacional",
  "Resultado esperado",
  "Erros comuns",
  "Como corrigir",
  "Módulos relacionados",
];

function buildPrompt(opts: {
  title: string;
  module: string | null;
  category: string;
  oldBody: string;
  reason: string;
  notes: string;
  routePath?: string | null;
}) {
  return `Você é o redator técnico do manual operacional do sistema Quero Armas.
REGRA: o artigo precisa descrever o COMPORTAMENTO REAL da tela mostrada na imagem em anexo (print real do sistema). NÃO invente botões, campos ou rótulos que não estejam visíveis. Se o print mostrar um bug visual, descreva o comportamento observado e ao final inclua o aviso "⚠️ Tela apresenta possível inconsistência visual — revisar".
Idioma: PT-BR. Tom: operacional, direto, instrutivo. Sem juridiquês.

Artigo a refazer:
- Título: ${opts.title}
- Módulo: ${opts.module ?? "—"}
- Categoria: ${opts.category}
- Rota auditada: ${opts.routePath ?? "—"}

Motivo da reprovação (equipe): ${opts.reason || "—"}
Observação da equipe: ${opts.notes || "—"}

Versão anterior do corpo (apenas referência, NÃO copiar erros):
"""${(opts.oldBody || "").slice(0, 4000)}"""

Refaça o artigo completo em Markdown com EXATAMENTE estas seções, nesta ordem, cada uma como "## Título":
${SECTIONS.map((s) => `- ${s}`).join("\n")}

Ao final, retorne APENAS um JSON em um bloco \`\`\`json ... \`\`\` com:
{
  "title": "...",
  "body": "markdown completo aqui",
  "tags": ["..."],
  "symptoms": ["..."],
  "module": "...",
  "category": "...",
  "visual_bug_detected": false
}`;
}

function extractJson(text: string): any | null {
  const m = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/\{[\s\S]*\}$/);
  const raw = m ? (m[1] ?? m[0]) : text;
  try { return JSON.parse(raw.trim()); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json();
    const article_id: string | undefined = body.article_id;
    const reason: string = body.reason ?? "";
    const notes: string = body.notes ?? "";
    const screenshot_url: string | undefined = body.screenshot_url;
    const screenshot_id: string | undefined = body.screenshot_id;
    const reviewed_by: string | undefined = body.reviewed_by;
    const audit_confirmed: boolean = body.audit_confirmed === true;

    if (!article_id) {
      return new Response(JSON.stringify({ error: "article_id obrigatório" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!audit_confirmed) {
      return new Response(JSON.stringify({ error: "Auditoria obrigatória pendente. Audite checklist, base de conhecimento e procedimento real antes de refazer o passo a passo.", code: "AUDIT_REQUIRED_BEFORE_REWRITE" }), {
        status: 428, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: art, error: aErr } = await supabase
      .from("qa_kb_artigos")
      .select("id,title,body,module,category,audience,version,status,tags,symptoms,audit_status,checklist_audited_at,knowledge_base_audited_at,procedure_tested_at,audit_ready_at")
      .eq("id", article_id).maybeSingle();
    if (aErr || !art) {
      return new Response(JSON.stringify({ error: "artigo não encontrado" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const dbAuditComplete = ["ready_to_write", "completed"].includes(art.audit_status ?? "") &&
      !!art.checklist_audited_at && !!art.knowledge_base_audited_at && !!art.procedure_tested_at && !!art.audit_ready_at;
    if (!dbAuditComplete) {
      return new Response(JSON.stringify({ error: "Auditoria incompleta no banco. O artigo só pode ser refeito após checklist, base e procedimento testados.", code: "DB_AUDIT_INCOMPLETE" }), {
        status: 428, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Resolve URL do print: se veio screenshot_id, busca image_url
    let imageUrl: string | null = screenshot_url ?? null;
    let routePath: string | null = null;
    if (!imageUrl && screenshot_id) {
      const { data: img } = await supabase
        .from("qa_kb_artigo_imagens")
        .select("image_url,route_path").eq("id", screenshot_id).maybeSingle();
      imageUrl = img?.image_url ?? null;
      routePath = img?.route_path ?? null;
    }

    const prompt = buildPrompt({
      title: art.title, module: art.module, category: art.category,
      oldBody: art.body, reason, notes, routePath,
    });

    const userContent: any[] = [{ type: "text", text: prompt }];
    if (imageUrl) userContent.push({ type: "image_url", image_url: { url: imageUrl } });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você redige manuais operacionais a partir de prints reais do sistema. Não invente elementos não visíveis." },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos em Lovable Cloud." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: `IA: ${t.slice(0, 200)}` }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const j = await aiResp.json();
    const text: string = j?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(text);
    if (!parsed?.body || !parsed?.title) {
      return new Response(JSON.stringify({ error: "IA não retornou JSON válido", raw: text.slice(0, 500) }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Snapshot da versão anterior
    const nextVersion = (art.version ?? 1) + 1;
    const { data: imgsSnap } = await supabase
      .from("qa_kb_artigo_imagens").select("id,image_url,storage_path,image_type,status,step_number,step_title").eq("article_id", article_id);

    await supabase.from("qa_kb_article_versions").insert({
      article_id, version_number: art.version ?? 1,
      title: art.title, body: art.body, status: art.status,
      images_snapshot: imgsSnap ?? [],
      created_by: reviewed_by ?? null,
      reason: `Snapshot pré-regeneração: ${reason || "sem motivo"}`,
    });

    // Atualiza artigo (sempre volta a needs_real_image até imagem real aprovada)
    const upd: Record<string, any> = {
      title: parsed.title,
      body: parsed.body,
      version: nextVersion,
      status: "needs_real_image",
      last_review_reason: reason || null,
      visual_bug_detected: !!parsed.visual_bug_detected,
      embedding_status: "pendente",
    };
    if (Array.isArray(parsed.tags)) upd.tags = parsed.tags;
    if (Array.isArray(parsed.symptoms)) upd.symptoms = parsed.symptoms;
    if (typeof parsed.module === "string") upd.module = parsed.module;
    if (typeof parsed.category === "string") upd.category = parsed.category;

    const { error: updErr } = await supabase.from("qa_kb_artigos").update(upd).eq("id", article_id);
    if (updErr) {
      return new Response(JSON.stringify({ error: `update: ${updErr.message}` }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Registra review
    await supabase.from("qa_kb_article_reviews").insert({
      article_id, action: "regenerated", reason, notes,
      screenshot_id: screenshot_id ?? null,
      screenshot_url: imageUrl,
      old_body: art.body, new_body: parsed.body,
      reviewed_by: reviewed_by ?? null,
    });

    return new Response(JSON.stringify({ ok: true, article_id, version: nextVersion, status: "needs_review", visual_bug_detected: !!parsed.visual_bug_detected }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("qa-kb-regenerate-from-review", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STYLE = `Manual operacional visual estilo CAPTURA DE TELA ILUSTRATIVA do sistema Quero Armas.
Interface web limpa, fundo claro (#f6f5f1 papel) com header escuro tático monocromático e detalhes em ÂMBAR (#d97706).
Tipografia mono/uppercase, botões e campos genéricos. Mostre uma única tela de software por imagem, com layout simples e foco no elemento da etapa.
NUNCA usar dados reais: usar nomes fictícios como "CLIENTE EXEMPLO", CPF mascarado "***.***.***-**", telefone "(11) 9****-****".
NUNCA mostrar armas em detalhe técnico realista — apenas ícones genéricos.
NUNCA escrever a palavra "admin" — usar "EQUIPE QUERO ARMAS" quando precisar de rótulo.
Sem fotos de pessoas reais. Sem documentos oficiais reais. Sem logotipos de terceiros.
Resultado: ilustração tipo screenshot didático, NÃO foto realista.`;

type Step = { number: number; title: string; description: string };

function extractSteps(body: string): Step[] {
  const steps: Step[] = [];
  // Procura seção "Passo a passo" (ou "## Passo a passo")
  const passoMatch = body.match(/##\s*Passo\s*a\s*passo\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  const block = passoMatch ? passoMatch[1] : body;
  // Captura linhas iniciadas por "1.", "2)" etc. com texto até a próxima
  const re = /(?:^|\n)\s*(\d+)[\.\)]\s+([^\n]+(?:\n(?!\s*\d+[\.\)]\s)[^\n]+)*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const number = parseInt(m[1], 10);
    const txt = m[2].trim().replace(/\s+/g, " ");
    const title = txt.split(/[\.\:\—\-]/)[0].slice(0, 80).trim();
    steps.push({ number, title: title || `Etapa ${number}`, description: txt.slice(0, 280) });
  }
  // Limita a 5 etapas para custo
  return steps.slice(0, 5);
}

async function genImage(prompt: string, key: string): Promise<{ b64: string } | { error: string }> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    return { error: `gateway ${r.status}: ${t.slice(0, 200)}` };
  }
  const j = await r.json();
  const url: string | undefined = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url || !url.startsWith("data:image/")) return { error: "sem imagem retornada" };
  const b64 = url.split(",")[1];
  return { b64 };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { article_id, force = false, approve = false } = await req.json();
    if (!article_id) {
      return new Response(JSON.stringify({ error: "article_id obrigatório" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: art, error: aErr } = await supabase
      .from("qa_kb_artigos").select("id,title,body,audience,status,category,module").eq("id", article_id).maybeSingle();
    if (aErr || !art) {
      return new Response(JSON.stringify({ error: "artigo não encontrado" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Se já tem imagens ativas e não forçou, sai
    const { data: existentes } = await supabase
      .from("qa_kb_artigo_imagens").select("id").eq("article_id", article_id).in("status", ["draft", "approved"]);
    if (!force && (existentes ?? []).length > 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "já possui imagens ativas", count: existentes!.length }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (force && (existentes ?? []).length > 0) {
      await supabase.from("qa_kb_artigo_imagens").update({ status: "archived" }).eq("article_id", article_id).in("status", ["draft", "approved"]);
    }

    const steps = extractSteps(art.body);
    // Se não houver passos, gera 1 capa do artigo
    const targets: Step[] = steps.length > 0
      ? steps
      : [{ number: 0, title: art.title, description: `Capa ilustrativa para o artigo "${art.title}".` }];

    const finalStatus = (approve === true || (art.audience === "cliente" && art.status === "published")) ? "approved" : "draft";

    const results: any[] = [];
    for (const step of targets) {
      const prompt = `${STYLE}\n\nContexto do artigo: "${art.title}" (módulo: ${art.module ?? "—"}, categoria: ${art.category}).\nEtapa ${step.number || 1}: ${step.title}\nDescrição da etapa: ${step.description}\n\nGere UMA imagem ilustrativa única e didática representando essa etapa dentro do sistema Quero Armas.`;
      try {
        const g = await genImage(prompt, key);
        if ("error" in g) {
          await supabase.from("qa_kb_artigo_imagens").insert({
            article_id, step_number: step.number, step_title: step.title,
            caption: step.title, prompt_used: prompt, status: "error", error_message: g.error,
          });
          results.push({ step: step.number, error: g.error });
          continue;
        }
        const bytes = b64ToBytes(g.b64);
        const path = `${article_id}/${Date.now()}-step-${step.number}.png`;
        const { error: upErr } = await supabase.storage.from("qa-kb-imagens").upload(path, bytes, {
          contentType: "image/png", upsert: false,
        });
        if (upErr) {
          await supabase.from("qa_kb_artigo_imagens").insert({
            article_id, step_number: step.number, step_title: step.title,
            caption: step.title, prompt_used: prompt, status: "error", error_message: `upload: ${upErr.message}`,
          });
          results.push({ step: step.number, error: upErr.message });
          continue;
        }
        const pub = supabase.storage.from("qa-kb-imagens").getPublicUrl(path).data.publicUrl;
        await supabase.from("qa_kb_artigo_imagens").insert({
          article_id, step_number: step.number, step_title: step.title,
          caption: step.title, prompt_used: prompt, status: finalStatus,
          image_url: pub, storage_path: path,
        });
        results.push({ step: step.number, ok: true, url: pub });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabase.from("qa_kb_artigo_imagens").insert({
          article_id, step_number: step.number, step_title: step.title,
          caption: step.title, prompt_used: prompt, status: "error", error_message: msg,
        });
        results.push({ step: step.number, error: msg });
      }
    }

    return new Response(JSON.stringify({ ok: true, article_id, generated: results.length, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("qa-kb-generate-article-images", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
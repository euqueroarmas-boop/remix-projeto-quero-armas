const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é o redator técnico-operacional da Base de Conhecimento da Equipe Quero Armas.
Gere SEMPRE em português, em Markdown, no formato OPERACIONAL OBRIGATÓRIO abaixo. Nunca use o termo "admin" — use "Equipe Quero Armas".
Nunca invente telas, botões ou regras: se faltar informação, escreva "(A confirmar)". Mantenha tom direto, sem marketing.
REGRA CRÍTICA: só escreva após auditoria concluída do checklist, da base de conhecimento e do procedimento real testado. Nunca gere, peça ou descreva imagem artificial. Se houver necessidade visual, sinalize que exige print real auditável.

## Objetivo
## Quando usar
## Passo a passo
(numerado)
## Como o sistema se comporta
## Erros comuns
## Como corrigir
## Impacto se feito errado
## Módulos relacionados
## Tags
(lista separada por vírgula)
## Sintomas de busca
(frases curtas, uma por linha, em primeira pessoa do usuário)`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { title, module: mod, audience = "equipe", description, audit_confirmed = false } = await req.json();
    if (!title || String(title).trim().length < 3) {
      return new Response(JSON.stringify({ error: "Título obrigatório" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (audit_confirmed !== true) {
      return new Response(JSON.stringify({ error: "Auditoria obrigatória pendente. Audite checklist, base de conhecimento e procedimento real antes de gerar o passo a passo.", code: "AUDIT_REQUIRED_BEFORE_DRAFT" }), {
        status: 428, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "IA indisponível" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const userMsg = `Título: ${title}
Módulo: ${mod || "(não informado)"}
Público-alvo: ${audience === "cliente" ? "CLIENTE FINAL (linguagem simples, sem termos técnicos internos)" : "EQUIPE QUERO ARMAS (linguagem operacional interna)"}
Descrição/sintomas: ${description || "(usar o título como base)"}

Gere o artigo seguindo o formato exigido. NÃO publique — será revisado pela Equipe Quero Armas. Não gere nem sugira imagem IA; quando precisar de visual, escreva que exige print real auditável.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (!r.ok) {
      if (r.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      if (r.status === 402) return new Response(JSON.stringify({ error: "Créditos da IA esgotados." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      const t = await r.text();
      console.error("draft AI error", r.status, t);
      return new Response(JSON.stringify({ error: "Falha ao gerar rascunho" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const j = await r.json();
    const body = j?.choices?.[0]?.message?.content ?? "";

    // tenta extrair tags/sintomas para preencher os campos
    const grab = (label: string) => {
      const m = body.match(new RegExp(`##\\s*${label}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i"));
      return m ? m[1].trim() : "";
    };
    const tags = grab("Tags").split(/[,\n]/).map((s: string) => s.replace(/^[-*\s]+/, "").trim()).filter(Boolean);
    const symptoms = grab("Sintomas de busca").split(/\n/).map((s: string) => s.replace(/^[-*\s]+/, "").trim()).filter(Boolean);

    return new Response(JSON.stringify({ body, tags, symptoms, status: "needs_real_image" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("qa-kb-draft", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STOPWORDS = new Set([
  "para",
  "com",
  "uma",
  "umas",
  "uns",
  "das",
  "dos",
  "por",
  "que",
  "sobre",
  "tema",
  "qual",
  "quais",
  "de",
  "da",
  "do",
  "no",
  "na",
  "nos",
  "nas",
  "e",
  "o",
  "a",
  "os",
  "as",
  "em",
  "ao",
  "aos",
]);

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTokens(query: string): string[] {
  return Array.from(
    new Set(
      normalizeText(query)
        .split(" ")
        .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
    ),
  );
}

function buildNormReference(n: any): string {
  const tipo = String(n.tipo_norma ?? "norma").replace(/_/g, " ");
  const numero = n.numero_norma ? ` nº ${n.numero_norma}` : "";
  const ano = n.ano_norma ? `/${n.ano_norma}` : "";
  return `${tipo}${numero}${ano}`.trim();
}

function scoreNorma(n: any, query: string, tokens: string[]): number {
  const q = normalizeText(query);
  const numeroQuery = q.replace(/\D/g, "");
  const numeroNorma = normalizeText(
    `${n.numero_norma ?? ""}${n.ano_norma ?? ""}`,
  ).replace(/\D/g, "");
  const title = normalizeText(
    `${n.titulo_norma ?? ""} ${buildNormReference(n)}`,
  );
  const ementa = normalizeText(n.ementa);
  const texto = normalizeText(n.texto_integral);
  const keywords = normalizeText(
    Array.isArray(n.palavras_chave)
      ? n.palavras_chave.join(" ")
      : n.palavras_chave,
  );

  let score = 0;
  if (
    numeroQuery.length >= 4 &&
    numeroNorma &&
    numeroQuery.includes(numeroNorma.slice(0, Math.min(numeroNorma.length, 5)))
  )
    score += 8;
  if (title.includes(q)) score += 8;
  if (ementa.includes(q)) score += 6;
  if (texto.includes(q)) score += 4;
  if (keywords.includes(q)) score += 7;

  for (const token of tokens) {
    if (title.includes(token)) score += 4;
    if (keywords.includes(token)) score += 4;
    if (ementa.includes(token)) score += 2;
    if (texto.includes(token)) score += 1;
  }

  if (n.revisada_humanamente) score += 1;
  return score;
}

/**
 * Busca da Base Operacional do CLIENTE.
 * Sempre força audience='cliente' e status='published' via qa_kb_search_hybrid.
 * Nunca expõe artigos internos da Equipe Quero Armas.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { query, limit = 5 } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: "query inválida" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const KEY = Deno.env.get("LOVABLE_API_KEY");
    let qemb: number[] | null = null;
    if (KEY) {
      try {
        const er = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${KEY}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content:
                    "Generate a vector of exactly 1536 floats between -1 and 1 representing the text semantically. Output ONLY the JSON array.",
                },
                { role: "user", content: query.slice(0, 800) },
              ],
              max_tokens: 8000,
            }),
          },
        );
        if (er.ok) {
          const content =
            (await er.json())?.choices?.[0]?.message?.content || "";
          const m = content.match(/\[[-\d.,\s]+\]/);
          if (m) {
            const arr = JSON.parse(m[0]);
            if (Array.isArray(arr) && arr.length >= 100) {
              const vec = arr.slice(0, 1536).map((x: any) => Number(x) || 0);
              while (vec.length < 1536) vec.push(0);
              qemb = vec;
            }
          }
        }
      } catch (_) {
        /* ignore */
      }
    }

    const { data: hits, error } = await supabase.rpc("qa_kb_search_hybrid", {
      _query: query,
      _qemb: qemb as any,
      _audience: "cliente",
      _limit: limit,
    });
    if (error) throw error;

    const articles = (hits ?? []) as Array<any>;

    const tokens = queryTokens(query);
    const { data: normas, error: normasError } = await supabase
      .from("qa_fontes_normativas")
      .select(
        "id,titulo_norma,tipo_norma,numero_norma,ano_norma,orgao_emissor,ementa,texto_integral,palavras_chave,revisada_humanamente",
      )
      .eq("ativa", true)
      .limit(250);
    if (normasError) throw normasError;

    const legalSources = ((normas ?? []) as Array<any>)
      .map((n) => ({ ...n, score: scoreNorma(n, query, tokens) }))
      .filter((n) => n.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(3, Math.min(Number(limit) || 5, 6)));

    // ══════════════════════════════════════════════════════════
    // Busca vetorial em chunks — SOMENTE docs marcados como
    // visíveis ao cliente (visivel_cliente = true).
    // A RPC qa_busca_similar já garante:
    //   papel_documento = 'aprendizado'
    //   ativo_na_ia = true
    //   status_validacao = 'validado'
    //   status_processamento = 'concluido'
    // Filtro adicional visivel_cliente é aplicado em TS pois a RPC
    // não expõe esse campo (defesa em profundidade).
    // ══════════════════════════════════════════════════════════
    let chunkSources: Array<{
      texto: string;
      titulo_doc: string;
      titulo_norma: string | null;
      similarity: number;
    }> = [];
    if (qemb) {
      try {
        const { data: vHits } = await supabase.rpc("qa_busca_similar", {
          query_embedding: `[${qemb.join(",")}]`,
          match_threshold: 0.55,
          match_count: 12,
        });
        const hitList = (vHits ?? []) as Array<any>;
        if (hitList.length > 0) {
          const docIds = Array.from(new Set(hitList.map((h) => h.documento_id).filter(Boolean)));
          const { data: docsMeta } = await supabase
            .from("qa_documentos_conhecimento")
            .select("id, titulo, visivel_cliente, ativo_na_ia, papel_documento, fonte_normativa_id")
            .in("id", docIds);
          const allowed = new Map<string, any>();
          for (const d of (docsMeta ?? []) as Array<any>) {
            if (
              d.visivel_cliente === true &&
              d.ativo_na_ia === true &&
              d.papel_documento === "aprendizado"
            ) {
              allowed.set(d.id, d);
            }
          }
          const normaIds = Array.from(
            new Set(
              Array.from(allowed.values())
                .map((d) => d.fonte_normativa_id)
                .filter(Boolean),
            ),
          );
          const normaTitleById = new Map<string, string>();
          if (normaIds.length > 0) {
            const { data: normasMeta } = await supabase
              .from("qa_fontes_normativas")
              .select("id, titulo_norma")
              .in("id", normaIds);
            for (const n of (normasMeta ?? []) as Array<any>) {
              normaTitleById.set(n.id, n.titulo_norma);
            }
          }
          chunkSources = hitList
            .filter((h) => allowed.has(h.documento_id))
            .slice(0, 6)
            .map((h) => {
              const doc = allowed.get(h.documento_id);
              const normaTitle = doc?.fonte_normativa_id
                ? normaTitleById.get(doc.fonte_normativa_id) ?? null
                : null;
              return {
                texto: (h.texto_chunk || "").substring(0, 4000),
                titulo_doc: doc?.titulo || "Documento",
                titulo_norma: normaTitle,
                similarity: Number(h.similarity) || 0,
              };
            });
        }
      } catch (e) {
        console.warn("chunk vector search skipped:", e);
      }
    }

    if (articles.length === 0 && legalSources.length === 0 && chunkSources.length === 0) {
      return new Response(
        JSON.stringify({
          answer:
            "Não encontrei essa informação na nossa central de ajuda. Se precisar, entre em contato com a equipe Quero Armas pelo WhatsApp.",
          articles: [],
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (!KEY) {
      if (legalSources.length > 0) {
        const answer = [
          "Encontrei referência na base legal cadastrada:",
          ...legalSources
            .slice(0, 3)
            .map(
              (n, i) =>
                `${i + 1}. **${n.titulo_norma}** — ${n.ementa || buildNormReference(n)}`,
            ),
        ].join("\n");
        return new Response(
          JSON.stringify({
            answer,
            articles: [
              ...articles.map((a) => ({
                id: a.id,
                title: a.title,
                category: a.category,
                type: "article",
              })),
              ...legalSources.map((n) => ({
                id: `norma:${n.id}`,
                title: n.titulo_norma,
                category: "Legislação",
                type: "legislation",
                body: `**${buildNormReference(n)}**\n\n${n.ementa || ""}\n\n${(n.texto_integral || "").substring(0, 1000000)}`,
              })),
            ],
          }),
          { headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          answer: "Veja os artigos relacionados abaixo.",
          articles: articles.map((a) => ({
            id: a.id,
            title: a.title,
            category: a.category,
          })),
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const ctxArticles = articles
      .slice(0, 3)
      .map(
        (a, i) =>
          `### Artigo ${i + 1}: ${a.title}\n${(a.body || "").substring(0, 50000)}${(a.body || "").length > 50000 ? "\n[...conteúdo adicional truncado...]" : ""}`,
      )
      .join("\n\n---\n\n");

    const ctxLegislacao = legalSources
      .slice(0, 5)
      .map(
        (n, i) =>
          `### Base legal ${i + 1}: ${n.titulo_norma}\nReferência: ${buildNormReference(n)}\nÓrgão: ${n.orgao_emissor || "não informado"}\nEmenta: ${n.ementa || "não informada"}\nTexto: ${(n.texto_integral || "").substring(0, 1000000)}`,
      )
      .join("\n\n---\n\n");

    const ctxChunks = chunkSources
      .map((c, i) => {
        const origem = c.titulo_norma
          ? `${c.titulo_norma} (via ${c.titulo_doc})`
          : c.titulo_doc;
        return `### Trecho ${i + 1} — ${origem}\n${c.texto}`;
      })
      .join("\n\n---\n\n");

    const ctx = [
      ctxArticles ? `## Artigos da Central de Ajuda\n${ctxArticles}` : "",
      ctxLegislacao
        ? `## Base legal cadastrada em Legislação\n${ctxLegislacao}`
        : "",
      ctxChunks
        ? `## Trechos da legislação anexada (PDFs oficiais)\n${ctxChunks}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n======\n\n");

    const r = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "Você é o assistente da Central de Ajuda do Cliente Quero Armas. Responda em português, de forma simples, acolhedora e objetiva. Use SOMENTE as informações fornecidas nos artigos e na base legal cadastrada. Antes de responder, leia os textos fornecidos POR INTEIRO. Pode citar normas da seção Legislação quando elas responderem ao tema. Ao citar trechos de legislação, SEMPRE nomeie a norma de origem (ex.: 'Lei nº 10.826/2003', 'Portaria COLOG nº ...'). NUNCA mencione termos internos como 'admin', 'banco de dados', 'edge function', 'chunk' ou detalhes técnicos. Se os trechos parecerem insuficientes para responder com segurança, diga claramente o que foi encontrado e oriente o cliente a falar com a equipe Quero Armas. Estruture a resposta em: **Resposta** (curta) + **Base legal encontrada** ou **Passo a passo** quando aplicável. Ao final, inclua a seção **Atenção** listando vedações, restrições, prazos de validade, exceções ou condições presentes nos textos que alterem ou complementem a resposta — mesmo que o cliente não tenha perguntado sobre isso. Se não houver, omita a seção Atenção.",
            },
            {
              role: "user",
              content: `Dúvida do cliente: "${query}"\n\nFontes disponíveis:\n\n${ctx}`,
            },
          ],
        }),
      },
    );

    if (!r.ok) {
      if (r.status === 429)
        return new Response(
          JSON.stringify({
            error: "Muitas requisições. Aguarde alguns segundos.",
          }),
          {
            status: 429,
            headers: { ...cors, "Content-Type": "application/json" },
          },
        );
      if (r.status === 402)
        return new Response(
          JSON.stringify({ error: "Serviço indisponível no momento." }),
          {
            status: 402,
            headers: { ...cors, "Content-Type": "application/json" },
          },
        );
      return new Response(
        JSON.stringify({
          answer: "Veja os artigos abaixo.",
          articles: articles.map((a) => ({
            id: a.id,
            title: a.title,
            category: a.category,
          })),
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    const j = await r.json();
    const answer =
      j?.choices?.[0]?.message?.content ?? "Veja os artigos abaixo.";

    return new Response(
      JSON.stringify({
        answer,
        articles: [
          ...articles.map((a) => ({
            id: a.id,
            title: a.title,
            category: a.category,
            type: "article",
          })),
          ...legalSources.map((n) => ({
            id: `norma:${n.id}`,
            title: n.titulo_norma,
            category: "Legislação",
            type: "legislation",
            body: `**${buildNormReference(n)}**\n\n${n.ementa || ""}\n\n${(n.texto_integral || "").substring(0, 1000000)}`,
          })),
        ],
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("qa-kb-search-cliente error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "erro" }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }
});

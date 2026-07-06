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
    const {
      query,
      limit = 5,
      sessao_id = null,
      historico = [],
      modo_refinamento = false,
    }: {
      query: string;
      limit?: number;
      sessao_id?: string | null;
      historico?: Array<{ role: "user" | "assistant"; content: string }>;
      modo_refinamento?: boolean;
    } = await req.json();
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

    // Resolve o cliente autenticado a partir do JWT do request. Usado só
    // para gravar as mensagens do chat depois do streaming.
    let clienteId: number | null = null;
    let effectiveSessaoId: string | null = sessao_id;
    let effectiveProtocolo: string | null = null;
    let effectiveProtocoloData: string | null = null;
    let sessaoReaberta = false;
    try {
      const authHeader = req.headers.get("Authorization") ?? "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (jwt) {
        const { data: userData } = await supabase.auth.getUser(jwt);
        const uid = userData?.user?.id;
        if (uid) {
          const { data: cid } = await supabase.rpc(
            "qa_current_cliente_id",
            { _uid: uid } as any,
          );
          if (typeof cid === "number") clienteId = cid;
          else if (cid) clienteId = Number(cid) || null;
        }
      }
    } catch (_) {
      /* ignore — chat persistence is best-effort */
    }

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
    // Busca vetorial em chunks — a RPC qa_busca_similar já garante
    // todos os filtros de segurança (papel_documento='aprendizado',
    // ativo_na_ia=true, status_validacao='validado',
    // status_processamento='concluido', visivel_cliente=true).
    // ══════════════════════════════════════════════════════════
    let chunkSources: Array<{
      texto: string;
      titulo_doc: string;
      titulo_norma: string | null;
      similarity: number;
    }> = [];
    // Few-shot dinâmico: até 3 respostas anteriores aprovadas (tipo_documento=qa_aprovado
    // + referencia_preferencial=true) mais similares à pergunta atual. Usadas SÓ como
    // referência de tom e formato — nunca copiadas literalmente.
    let fewShotSources: Array<{ titulo: string; texto: string }> = [];
    if (qemb) {
      try {
        const [vHitsResult, fsHitsResult] = await Promise.all([
          supabase.rpc("qa_busca_similar", {
            _query: query,
            _qemb: qemb as any,
            _limit: 12,
            somente_visivel_cliente: true,
          }),
          supabase.rpc("qa_busca_similar", {
            _query: query,
            _qemb: qemb as any,
            _limit: 25,
            somente_visivel_cliente: true,
          }),
        ]);

        const vHits = vHitsResult.data ?? [];
        const fsHits = fsHitsResult.data ?? [];

        // Processamento de chunks de legislação (exclui qa_aprovado)
        const hitList = vHits as Array<any>;
        if (hitList.length > 0) {
          const docIds = Array.from(new Set(hitList.map((h) => h.documento_id).filter(Boolean)));
          const { data: docsMeta } = await supabase
            .from("qa_documentos_conhecimento")
            .select("id, titulo, fonte_normativa_id")
            .in("id", docIds);
          const docMetaById = new Map<string, any>();
          for (const d of (docsMeta ?? []) as Array<any>) {
            docMetaById.set(d.id, d);
          }
          const normaIds = Array.from(
            new Set(
              Array.from(docMetaById.values())
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
            .slice(0, 6)
            .map((h) => {
              const doc = docMetaById.get(h.documento_id);
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

        // Processamento de few-shot (só tipo_documento='qa_aprovado')
        const hits = fsHits as Array<any>;
        if (hits.length > 0) {
          const docIds = Array.from(new Set(hits.map((h) => h.documento_id).filter(Boolean)));
          const { data: docsMeta } = await supabase
            .from("qa_documentos_conhecimento")
            .select("id, titulo, tipo_documento, referencia_preferencial")
            .in("id", docIds)
            .eq("tipo_documento", "qa_aprovado")
            .eq("referencia_preferencial", true);
          const okIds = new Set((docsMeta ?? []).map((d: any) => d.id));
          const titleById = new Map((docsMeta ?? []).map((d: any) => [d.id, d.titulo]));
          const seenDocs = new Set<string>();
          for (const h of hits) {
            if (!okIds.has(h.documento_id)) continue;
            if (seenDocs.has(h.documento_id)) continue;
            seenDocs.add(h.documento_id);
            fewShotSources.push({
              titulo: titleById.get(h.documento_id) || "QA aprovado",
              texto: (h.texto_chunk || "").substring(0, 2000),
            });
            if (fewShotSources.length >= 3) break;
          }
        }
      } catch (e) {
        console.warn("vector search skipped:", e);
      }
    }

    // Fallback sem embedding: 3 mais recentes aprovados preferenciais.
    if (fewShotSources.length === 0) {
      try {
        const { data: recentes } = await supabase
          .from("qa_documentos_conhecimento")
          .select("id, titulo, texto_extraido")
          .eq("tipo_documento", "qa_aprovado")
          .eq("referencia_preferencial", true)
          .eq("status_processamento", "concluido")
          .order("created_at", { ascending: false })
          .limit(3);
        for (const d of (recentes ?? []) as Array<any>) {
          fewShotSources.push({
            titulo: d.titulo || "QA aprovado",
            texto: (d.texto_extraido || "").substring(0, 2000),
          });
        }
      } catch (e) {
        console.warn("few-shot fallback skipped:", e);
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

    const ctxFewShot = fewShotSources
      .map((f, i) => `### Exemplo ${i + 1} — ${f.titulo}\n${f.texto}`)
      .join("\n\n---\n\n");

    // Motivos de rejeições anteriores relevantes — evitam repetir os mesmos erros.
    let rejeitadasCtx = "";
    try {
      const { data: rejeitadas } = await supabase
        .from("qa_chat_mensagens")
        .select("content, motivo_rejeicao, sessao_id, created_at")
        .eq("aprovada_kb", false)
        .not("motivo_rejeicao", "is", null)
        .order("created_at", { ascending: false })
        .limit(60);
      const rej = (rejeitadas ?? []) as Array<any>;
      if (rej.length > 0) {
        // score simples por overlap de tokens contra a query
        const scored = rej
          .map((r) => {
            const hay = normalizeText(`${r.content ?? ""} ${r.motivo_rejeicao ?? ""}`);
            let s = 0;
            for (const t of tokens) if (hay.includes(t)) s += 1;
            return { r, s };
          })
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, 3);
        if (scored.length > 0) {
          rejeitadasCtx = scored
            .map(
              (x, i) =>
                `### Rejeição ${i + 1}\nMotivo apontado pela equipe: ${String(x.r.motivo_rejeicao).slice(0, 800)}`,
            )
            .join("\n\n---\n\n");
        }
      }
    } catch (e) {
      console.warn("busca de rejeitadas skipped:", e);
    }

    const ctx = [
      ctxArticles ? `## Artigos da Central de Ajuda\n${ctxArticles}` : "",
      ctxLegislacao
        ? `## Base legal cadastrada em Legislação\n${ctxLegislacao}`
        : "",
      ctxChunks
        ? `## Trechos da legislação anexada (PDFs oficiais)\n${ctxChunks}`
        : "",
      ctxFewShot
        ? `## Exemplos de respostas aprovadas anteriores\n${ctxFewShot}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n======\n\n");

    // Chamada em STREAMING para a IA — mantemos todo o contexto (artigos +
    // legislação + chunks) e injetamos o histórico da conversa.
    const historyMessages = (Array.isArray(historico) ? historico : [])
      .slice(-20)
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0,
      )
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

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
          stream: true,
          messages: [
            {
              role: "system",
              content:
  "Você é Klal (כלל), o assistente jurídico e consultor de vendas da Quero Armas.\n\nSeu nome vem do hebraico e significa \"regra geral — o princípio que abrange tudo\". Você é especialista em regulamentação de armas de fogo no Brasil e conversa com o cliente de forma humana, acolhedora e natural — como um consultor experiente que explica numa conversa fluida, jamais como um documento oficial ou um manual em tópicos.\n\nQuem é a Quero Armas: a Quero Armas é a empresa fornecedora do serviço. Nós executamos a burocracia pelo cliente — preparamos autorizações, geramos as taxas e damos entrada nos pedidos junto aos órgãos competentes. Você trabalha exclusivamente para a Quero Armas.\n\nSua missão é dupla: (1) esclarecer, de forma jurídica e conceitual, a dúvida do cliente — o que a lei diz, o que muda para ele, quais os cuidados; (2) conduzir o cliente a contratar o serviço da Quero Armas que resolve aquela necessidade.\n\nNunca ensine o passo a passo operacional. É terminantemente proibido explicar como o cliente faria o processo sozinho. Não diga para ele ir à Polícia Federal, protocolar requerimento, reunir documentos, dar entrada em pedido ou solicitar registro por conta própria. Esse know-how é justamente o serviço que vendemos; ensiná-lo faz o cliente dispensar a Quero Armas. Explique o que a lei exige e por quê, mas deixe claro que quem executa é a Quero Armas.\n\nComo falar das taxas: a Quero Armas NÃO recolhe nem paga a taxa. Nós geramos a guia (GRU) e a disponibilizamos no painel do cliente para que ele mesmo efetue o pagamento. Diga sempre assim — \"geramos a guia e deixamos disponível no seu painel para você pagar\" —, nunca \"nós pagamos\" ou \"nós recolhemos\".\n\nPosicione a Quero Armas como executora: em vez de instruir o cliente, diga o que a Quero Armas faz por ele — \"cuidamos de toda a solicitação\", \"damos entrada no pedido e acompanhamos junto ao órgão\", \"preparamos a autorização e você acompanha tudo pelo painel\".\n\nFeche sempre conduzindo para a venda, de forma natural na conversa. Quando existir a página do serviço, direcione o cliente para ela pronta para compra; quando o cliente estiver logado, ofereça adicionar o serviço direto ao carrinho (\"posso já adicionar esse serviço ao seu carrinho para você concluir agora?\"). Faça isso encaixado na conversa, nunca como um anúncio colado no fim.\n\nEstilo: escreva em texto corrido, humanizado, como uma conversa real. NÃO segmente a resposta em blocos ou seções com títulos (\"Resposta\", \"Passo a passo\", \"Base legal\", \"Atenção\"). Ao citar uma norma, encaixe-a naturalmente na frase (ex.: \"pela Lei nº 10.826/2003, você...\"), sempre nomeando a norma de origem. Traga vedações, prazos e restrições relevantes no próprio fluxo da conversa, não numa lista à parte.\n\nConteúdo: use SOMENTE as informações dos artigos e da base legal fornecidos; leia-os por inteiro antes de responder. Se o material for insuficiente para responder com segurança, diga com honestidade o que encontrou e convide o cliente a falar com a equipe Quero Armas. Nunca invente. Nunca mencione termos internos como \"banco de dados\", \"chunk\", \"edge function\" ou detalhes técnicos.\n\nQuando houver exemplos de respostas anteriores aprovadas, use-os apenas como referência de tom e profundidade — nunca copie o conteúdo." +
                  (rejeitadasCtx
                    ? `\n\nRESPOSTAS ANTERIORES REJEITADAS PELA EQUIPE para perguntas similares:\n${rejeitadasCtx}\n\nEvite cometer os mesmos erros.`
                    : ""),
            },
            ...historyMessages,
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

    // ═══════════════════════════════════════════════════════════════
    // STREAMING SSE → cliente
    //   data: {"type":"meta","fontes":[...]}
    //   data: {"type":"token","content":"..."}
    //   data: {"type":"session","sessao_id":"..."}
    //   data: [DONE]
    // ═══════════════════════════════════════════════════════════════
    const fontesResumo = [
      ...legalSources.map((n) => ({
        tipo: "legislacao" as const,
        titulo_norma: n.titulo_norma,
        titulo_doc: null as string | null,
      })),
      ...chunkSources.map((c) => ({
        tipo: "documento" as const,
        titulo_norma: c.titulo_norma,
        titulo_doc: c.titulo_doc,
      })),
    ];

    // ═════ Nível de confiança ═════
    // Sinais: melhor similaridade de trechos, presença de resposta aprovada
    // preferencial (few-shot) e rejeições anteriores no tema.
    const bestChunkSim = chunkSources.reduce(
      (acc, c) => Math.max(acc, Number(c.similarity) || 0),
      0,
    );
    const temFewShotAprovado = fewShotSources.length > 0;
    const temRejeicaoAnterior = rejeitadasCtx.trim().length > 0;
    let nivelConfianca: "alta" | "media" | "baixa";
    if (temRejeicaoAnterior || (bestChunkSim < 0.7 && !temFewShotAprovado)) {
      nivelConfianca = "baixa";
    } else if (bestChunkSim >= 0.82 || temFewShotAprovado) {
      nivelConfianca = "alta";
    } else if (bestChunkSim >= 0.7) {
      nivelConfianca = "media";
    } else {
      nivelConfianca = "baixa";
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = r.body!.getReader();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

        // meta primeiro
        send({ type: "meta", fontes: fontesResumo });

        // ═════ Resolve/abre/reabre sessão + protocolo ═════
        // Regra: última sessão do cliente é ATIVA se status='ativo' E
        // last_activity_at > now() - 30min. Se ociosa >30min, encerra e
        // tenta REABERTURA POR ASSUNTO (similaridade >= 0.80). Caso contrário
        // cria sessão nova com número de protocolo próprio.
        if (!modo_refinamento && clienteId) {
          try {
            const nowIso = new Date().toISOString();
            const assuntoResumo = query.slice(0, 140);

            // 1) Última sessão do cliente
            const { data: ultimaArr } = await supabase
              .from("qa_chat_sessoes")
              .select("id, numero_protocolo, status, last_activity_at, created_at")
              .eq("cliente_id", clienteId)
              .order("last_activity_at", { ascending: false })
              .limit(1);
            const ultima = (ultimaArr ?? [])[0] as any;

            const trintaMinAtras = Date.now() - 30 * 60 * 1000;
            const ativa =
              ultima &&
              ultima.status === "ativo" &&
              new Date(ultima.last_activity_at).getTime() > trintaMinAtras;

            if (ativa) {
              effectiveSessaoId = ultima.id;
              effectiveProtocolo = ultima.numero_protocolo;
              effectiveProtocoloData = ultima.created_at;
              await supabase
                .from("qa_chat_sessoes")
                .update({ last_activity_at: nowIso })
                .eq("id", effectiveSessaoId);
            } else {
              // Se havia sessão ativa expirada, encerrar.
              if (ultima && ultima.status === "ativo") {
                await supabase
                  .from("qa_chat_sessoes")
                  .update({ status: "encerrado", closed_at: nowIso })
                  .eq("id", ultima.id);
              }
              // 2) Reabertura por assunto
              let reabriu = false;
              if (qemb) {
                try {
                  const { data: similarArr } = await supabase.rpc(
                    "qa_chat_sessao_por_assunto",
                    { _cliente_id: clienteId, _emb: qemb as any } as any,
                  );
                  const similar = (similarArr ?? [])[0] as any;
                  if (similar && Number(similar.similarity) >= 0.8) {
                    effectiveSessaoId = similar.id;
                    effectiveProtocolo = similar.numero_protocolo;
                    effectiveProtocoloData = similar.created_at;
                    await supabase
                      .from("qa_chat_sessoes")
                      .update({
                        status: "ativo",
                        last_activity_at: nowIso,
                        closed_at: null,
                      })
                      .eq("id", effectiveSessaoId);
                    sessaoReaberta = true;
                    reabriu = true;
                  }
                } catch (e) {
                  console.warn("reabertura por assunto falhou:", e);
                }
              }
              // 3) Sessão nova
              if (!reabriu) {
                let protocolo: string | null = null;
                try {
                  const { data: protoData } = await supabase.rpc(
                    "qa_gerar_protocolo_chat",
                  );
                  protocolo =
                    typeof protoData === "string" ? protoData : null;
                } catch (e) {
                  console.warn("gerar protocolo falhou:", e);
                }
                const { data: novaSessao } = await supabase
                  .from("qa_chat_sessoes")
                  .insert({
                    cliente_id: clienteId,
                    titulo: query.slice(0, 60),
                    numero_protocolo: protocolo,
                    status: "ativo",
                    assunto: assuntoResumo,
                    assunto_embedding: qemb as any,
                    last_activity_at: nowIso,
                  } as any)
                  .select("id, numero_protocolo, created_at")
                  .single();
                if (novaSessao?.id) {
                  effectiveSessaoId = novaSessao.id as string;
                  effectiveProtocolo =
                    (novaSessao as any).numero_protocolo || protocolo;
                  effectiveProtocoloData = (novaSessao as any).created_at;
                }
              }
            }
          } catch (e) {
            console.warn("erro resolvendo sessao/protocolo:", e);
          }
        }

        if (effectiveSessaoId) {
          send({
            type: "session",
            sessao_id: effectiveSessaoId,
            protocolo: effectiveProtocolo,
            protocolo_data: effectiveProtocoloData,
            reaberto: sessaoReaberta,
          });
        }
        send({ type: "confianca", nivel: nivelConfianca });

        let full = "";
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payload);
                const delta =
                  parsed?.choices?.[0]?.delta?.content ??
                  parsed?.choices?.[0]?.message?.content ??
                  "";
                if (delta) {
                  full += delta;
                  send({ type: "token", content: delta });
                }
              } catch (_) {
                /* ignora chunks parciais */
              }
            }
          }
        } catch (e) {
          console.error("stream read error:", e);
          send({ type: "error", message: "Falha durante o streaming." });
        }

        // Persistência: user + assistant (pulada no modo refinamento — o chat
        // interno de refinamento não deve poluir a fila de aprovação).
        if (!modo_refinamento && clienteId && effectiveSessaoId && full.trim().length > 0) {
          try {
            await supabase.from("qa_chat_mensagens").insert([
              {
                sessao_id: effectiveSessaoId,
                cliente_id: clienteId,
                role: "user",
                content: query,
                fontes: [],
              },
              {
                sessao_id: effectiveSessaoId,
                cliente_id: clienteId,
                role: "assistant",
                content: full,
                fontes: fontesResumo,
                nivel_confianca: nivelConfianca,
              },
            ] as any);
            await supabase
              .from("qa_chat_sessoes")
              .update({
                updated_at: new Date().toISOString(),
                last_activity_at: new Date().toISOString(),
              })
              .eq("id", effectiveSessaoId);
          } catch (e) {
            console.warn("erro persistindo mensagens chat:", e);
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
      cancel() {
        try { reader.cancel(); } catch (_) { /* noop */ }
      },
    });

    return new Response(stream, {
      headers: {
        ...cors,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
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

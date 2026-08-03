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
      anexos = [],
    }: {
      query: string;
      limit?: number;
      sessao_id?: string | null;
      historico?: Array<{ role: "user" | "assistant"; content: string }>;
      modo_refinamento?: boolean;
      anexos?: Array<{
        id?: string;
        nome_arquivo?: string;
        mime_type?: string;
        texto_extraido?: string | null;
      }>;
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

    // ═════ Catálogo de serviços ativos (para oferta comercial) ═════
    let catalogo: Array<{
      id: string;
      slug: string;
      nome: string;
      categoria: string;
      preco_cents: number;
      descricao_curta: string | null;
    }> = [];
    try {
      const { data: catRows } = await supabase
        .from("qa_servicos_catalogo")
        .select("id, slug, nome, categoria, preco, descricao_curta, ativo, display_order")
        .eq("ativo", true)
        .order("display_order", { ascending: true });
      catalogo = ((catRows ?? []) as Array<any>).map((r) => ({
        id: r.id,
        slug: r.slug,
        nome: r.nome,
        categoria: r.categoria,
        preco_cents: Math.round(Number(r.preco || 0) * 100),
        descricao_curta: r.descricao_curta ?? null,
      }));
    } catch (e) {
      console.warn("catalogo load skipped:", e);
    }
    const catalogoBySlug = new Map(catalogo.map((s) => [s.slug, s]));
    const ctxCatalogo = catalogo
      .map(
        (s) =>
          `- slug: \`${s.slug}\` — ${s.nome} (${s.categoria}) — R$ ${(s.preco_cents / 100).toFixed(2)}${s.descricao_curta ? ` — ${s.descricao_curta}` : ""}`,
      )
      .join("\n");

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
            .slice(0, 10)
            .map((h) => {
              const doc = docMetaById.get(h.documento_id);
              const normaTitle = doc?.fonte_normativa_id
                ? normaTitleById.get(doc.fonte_normativa_id) ?? null
                : null;
              return {
                texto: (h.texto_chunk || "").substring(0, 6000),
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
      ctxLegislacao
        ? `## Base legal cadastrada em Legislação\n${ctxLegislacao}`
        : "",
      ctxChunks
        ? `## Trechos da legislação anexada (PDFs oficiais)\n${ctxChunks}`
        : "",
      ctxArticles ? `## Artigos da Central de Ajuda\n${ctxArticles}` : "",
      ctxFewShot
        ? `## Exemplos de respostas aprovadas anteriores\n${ctxFewShot}`
        : "",
      ctxCatalogo
        ? `## Catálogo de serviços da Quero Armas (para oferta)\n${ctxCatalogo}`
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

    // Lookup determinístico de competência — banco local, sem IA
    // Não depende de qemb; usa apenas tokens de palavras-chave.
    let ctxCompetencia = "";
    try {
      if (tokens.length > 0) {
        console.log("[competencia] tokens:", tokens);
        const { data: comp, error: compErr } = await supabase.rpc("qa_consulta_competencia", {
          _tokens: tokens,
        });
        if (compErr) {
          console.warn("[competencia] rpc error:", JSON.stringify(compErr));
        } else if (comp && comp.length > 0) {
          const c = comp[0];
          console.log("[competencia] match:", c.materia_slug, "count:", c.match_count);
          if (c.match_count > 0) {
            ctxCompetencia =
              `## COMPETÊNCIA DETERMINADA PELA BASE LOCAL (autoritativa)\n` +
              `matéria: ${c.materia_descricao}\n` +
              `órgão: ${c.orgao_competente}\n` +
              `sistema: ${c.sistema_registro}\n` +
              `base legal: ${c.artigo ?? "não especificado"}\n` +
              (c.observacao ? `observação: ${c.observacao}\n` : "");
          }
        } else {
          console.log("[competencia] sem match para tokens:", tokens);
        }
      }
    } catch (e) {
      console.warn("[competencia] exceção:", e);
    }

    // ── Contexto REAL do cliente: o que ele já comprou/contratou ──────
    // O Klal precisa responder qualquer pergunta sobre as compras e os
    // processos contratados (o que foi pago, quanto, como, em quantas
    // vezes e em que pé está cada processo).
    let ctxCliente = "";
    // Serviços que o cliente JÁ contratou — nunca podem ser oferecidos de novo.
    const servicosContratadosNorm = new Set<string>();
    const normalizarNome = (s: string) =>
      String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    if (clienteId) {
      try {
        const [{ data: clienteRow }, { data: vendas }, { data: processos }] = await Promise.all([
          supabase
            .from("qa_clientes")
            .select("id, nome_completo")
            .eq("id", clienteId)
            .maybeSingle(),
          supabase
            .from("qa_vendas")
            .select(
              "id, data_cadastro, status, forma_pagamento, valor_a_pagar, valor_total_pago_cliente, pagamento_parcelas, pagamento_valor_parcela, cobranca_status, cobranca_confirmada_em, numero_processo, data_protocolo, data_deferimento",
            )
            .eq("cliente_id", clienteId)
            .order("data_cadastro", { ascending: false })
            .limit(25),
          supabase
            .from("qa_processos")
            .select(
              "id, servico_nome, status, pagamento_status, data_criacao, modalidade, venda_id",
            )
            .eq("cliente_id", clienteId)
            .order("data_criacao", { ascending: false })
            .limit(40),
        ]);

        const vendaIds = (vendas ?? []).map((v: any) => v.id);
        let itensPorVenda = new Map<number, string[]>();
        if (vendaIds.length) {
          const { data: itens } = await supabase
            .from("qa_itens_venda")
            .select(
              "venda_id, servico_id, valor, status, numero_processo, data_protocolo, data_deferimento",
            )
            .in("venda_id", vendaIds);
          const servIds = [
            ...new Set((itens ?? []).map((i: any) => i.servico_id).filter(Boolean)),
          ];
          const nomes = new Map<number, string>();
          if (servIds.length) {
            const { data: servs } = await supabase
              .from("qa_servicos")
              .select("id, nome_servico")
              .in("id", servIds);
            (servs ?? []).forEach((s: any) => nomes.set(s.id, s.nome_servico));
          }
          (itens ?? []).forEach((i: any) => {
            const arr = itensPorVenda.get(i.venda_id) ?? [];
            arr.push(
              `${nomes.get(i.servico_id) ?? "serviço"}` +
                (i.valor ? ` — R$ ${Number(i.valor).toFixed(2)}` : "") +
                (i.status ? ` — situação: ${i.status}` : "") +
                (i.numero_processo ? ` — processo ${i.numero_processo}` : "") +
                (i.data_protocolo ? ` — protocolado em ${i.data_protocolo}` : "") +
                (i.data_deferimento ? ` — deferido em ${i.data_deferimento}` : ""),
            );
            itensPorVenda.set(i.venda_id, arr);
          });
        }

        const blocosVendas = (vendas ?? []).map((v: any) => {
          const pago = String(v.status ?? "").toUpperCase() === "PAGO" ||
            String(v.cobranca_status ?? "").toLowerCase() === "confirmado";
          const parcelas = Number(v.pagamento_parcelas ?? 0);
          return (
            `• Compra #${v.id}${v.data_cadastro ? ` (${v.data_cadastro})` : ""} — ` +
            `situação do pagamento: ${pago ? "PAGO/CONFIRMADO" : v.status ?? "em aberto"}` +
            (v.forma_pagamento ? ` — forma: ${v.forma_pagamento}` : "") +
            (parcelas > 1
              ? ` — ${parcelas}x de R$ ${Number(v.pagamento_valor_parcela ?? 0).toFixed(2)}`
              : " — à vista") +
            (v.valor_total_pago_cliente || v.valor_a_pagar
              ? ` — total: R$ ${Number(v.valor_total_pago_cliente || v.valor_a_pagar).toFixed(2)}`
              : "") +
            (v.cobranca_confirmada_em
              ? ` — confirmado em ${String(v.cobranca_confirmada_em).slice(0, 10)}`
              : "") +
            (itensPorVenda.get(v.id)?.length
              ? `\n   Serviços desta compra:\n   - ${itensPorVenda.get(v.id)!.join("\n   - ")}`
              : "")
          );
        });

        const blocosProcessos = (processos ?? []).map(
          (p: any) =>
            `• ${p.servico_nome ?? "processo"} — status: ${p.status ?? "—"}` +
            (p.pagamento_status ? ` — pagamento: ${p.pagamento_status}` : "") +
            (p.modalidade ? ` — modalidade: ${p.modalidade}` : "") +
            (p.data_criacao ? ` — aberto em ${String(p.data_criacao).slice(0, 10)}` : ""),
        );

        // Marca todos os serviços já contratados (processos + itens de venda)
        for (const p of (processos ?? []) as Array<any>) {
          if (p?.servico_nome) servicosContratadosNorm.add(normalizarNome(p.servico_nome));
        }
        for (const lista of itensPorVenda.values()) {
          for (const linha of lista) {
            servicosContratadosNorm.add(normalizarNome(String(linha).split("—")[0]));
          }
        }

        // Situação documental de cada processo (o que falta de verdade)
        let blocoDocs = "";
        try {
          const procIds = (processos ?? []).map((p: any) => p.id).filter(Boolean);
          if (procIds.length) {
            const { data: docs } = await supabase
              .from("qa_processo_documentos")
              .select("processo_id, tipo_documento, status")
              .in("processo_id", procIds)
              .limit(400);
            const porProc = new Map<string, Record<string, number>>();
            for (const d of (docs ?? []) as Array<any>) {
              const m = porProc.get(d.processo_id) ?? {};
              const st = String(d.status ?? "pendente").toLowerCase();
              m[st] = (m[st] ?? 0) + 1;
              porProc.set(d.processo_id, m);
            }
            const linhas = (processos ?? [])
              .map((p: any) => {
                const m = porProc.get(p.id);
                if (!m) return `• ${p.servico_nome ?? "processo"} — nenhum documento enviado ainda`;
                const resumo = Object.entries(m)
                  .map(([k, v]) => `${v} ${k}`)
                  .join(", ");
                return `• ${p.servico_nome ?? "processo"} — documentos: ${resumo}`;
              })
              .filter(Boolean);
            if (linhas.length) blocoDocs = `### Situação dos documentos\n${linhas.join("\n")}\n\n`;
          }
        } catch (e) {
          console.warn("[contexto-cliente] docs falhou:", e);
        }

        if (blocosVendas.length || blocosProcessos.length) {
          ctxCliente =
            "## DADOS REAIS DA CONTA DESTE CLIENTE (autoritativos)\n" +
            (blocosVendas.length
              ? `### Compras e pagamentos\n${blocosVendas.join("\n")}\n\n`
              : "") +
            (blocosProcessos.length
              ? `### Processos contratados\n${blocosProcessos.join("\n")}\n\n`
              : "") +
            blocoDocs +
            "REGRAS PARA ESTES DADOS: são a fonte da verdade sobre o que o cliente comprou, " +
            "quanto pagou, como pagou (forma e parcelas) e em que pé está cada processo. " +
            "Responda com base neles quando a pergunta for sobre a conta dele. " +
            "NUNCA invente valores, datas, protocolos ou status que não estejam acima; " +
            "se algo não constar, diga honestamente que confirma com a equipe Quero Armas. " +
            "Nunca exponha IDs internos como número de compra do sistema salvo se o cliente pedir referência.\n" +
            "PROIBIDO ABSOLUTO: oferecer, sugerir ou recomendar qualquer serviço que já apareça acima como " +
            "comprado ou contratado por este cliente. Ele já pagou por isso — repetir a oferta é erro grave.";
        }
      } catch (e) {
        console.warn("[contexto-cliente] falhou:", e);
      }
    }

    const ctxFinal = [ctxCompetencia, ctxCliente, ctx]
      .filter(Boolean)
      .join("\n\n======\n\n");

    // ── Anexos enviados pelo cliente no chat ──────────────────────────
    const anexosLista = (Array.isArray(anexos) ? anexos : []).slice(0, 6);
    const anexosCtx = anexosLista.length
      ? "## ARQUIVOS ENVIADOS PELO CLIENTE NESTA MENSAGEM\n" +
        anexosLista
          .map((a, i) => {
            const texto = (a?.texto_extraido || "").toString().slice(0, 12000).trim();
            return (
              `### Arquivo ${i + 1}: ${a?.nome_arquivo ?? "sem nome"} (${a?.mime_type ?? "tipo desconhecido"})\n` +
              (texto ? texto : "[não foi possível ler o conteúdo deste arquivo]")
            );
          })
          .join("\n\n---\n\n") +
        "\n\nREGRA PARA OS ARQUIVOS: leia e interprete o conteúdo acima EXCLUSIVAMENTE à luz da legislação e das fontes fornecidas neste contexto. " +
        "Nunca ensine o cliente a executar o processo; explique o que a lei exige sobre o que ele enviou e diga que a QUERO ARMAS executa. " +
        "Se o arquivo não puder ser lido ou não tiver relação com a matéria, diga isso com honestidade."
      : "";

    // ── Persona configurável do Klal (Configurações → Klal) ─────────────────
    let personaCfg = {
      humor: 50,
      seriedade: 75,
      preocupacao: 90,
      min_caracteres: 180,
      max_caracteres: 400,
      regras_extras: "" as string | null,
    };
    try {
      const { data: pRow } = await supabase
        .from("qa_klal_persona")
        .select("humor,seriedade,preocupacao,min_caracteres,max_caracteres,regras_extras")
        .eq("id", 1)
        .maybeSingle();
      if (pRow) personaCfg = { ...personaCfg, ...pRow } as typeof personaCfg;
    } catch { /* usa os padrões */ }

    const nivel = (v: number) =>
      v >= 85 ? "muito alto" : v >= 60 ? "alto" : v >= 35 ? "moderado" : v >= 15 ? "baixo" : "praticamente nulo";

    const personaBloco =
      "\n\n═══ PERSONA E TOM (PRIORIDADE MÁXIMA DE ESTILO) ═══\n" +
      "Você NÃO é um robô jurídico. Fala como um consultor humano experiente da Quero Armas, que já atendeu centenas de pessoas e sente o que o cliente sente.\n\n" +
      "Calibragem da personalidade:\n" +
      `• Humor: ${personaCfg.humor}% (${nivel(personaCfg.humor)}) — leveza pontual quando couber. Nunca piada forçada, nunca humor em tema sensível (crime, indeferimento, apreensão, morte).\n` +
      `• Seriedade: ${personaCfg.seriedade}% (${nivel(personaCfg.seriedade)}) — firmeza e segurança sempre; formalidade quase nunca.\n` +
      `• Preocupação genuína: ${personaCfg.preocupacao}% (${nivel(personaCfg.preocupacao)}) — reconheça a dor, a pressa, o medo de errar ou a frustração antes de explicar. Deixe claro que ele não está sozinho nisso.\n\n` +
      "REGRAS DE TAMANHO (obrigatórias):\n" +
      `1. Cada explicação deve ter entre ${personaCfg.min_caracteres} e ${personaCfg.max_caracteres} caracteres, calibrando pelo tipo de pergunta: dúvida simples fica perto do mínimo; tema complexo (competência, vedação, prazo) vai até o máximo. Nunca entregue resposta abaixo do mínimo.\n` +
      "2. No máximo 3 parágrafos curtos.\n" +
      "3. Comece pela resposta. Sem introdução, sem recapitular a pergunta.\n" +
      "4. Uma ideia por frase. Zero juridiquês — se precisar do termo técnico, traduza na mesma frase.\n" +
      "5. Cite a norma só quando muda a decisão do cliente, de forma enxuta. Não empilhe citações.\n" +
      "6. Termine com UMA frase conduzindo o próximo passo com a Quero Armas — convite, nunca anúncio. Se a pergunta for sobre o processo/pedido que o cliente já contratou, esse próximo passo é operacional (o que falta, o que a equipe vai fazer), NUNCA uma oferta de contratação.\n" +
      "7. Fale como gente: \"entendo\", \"pode ficar tranquilo\", \"te explico rápido\". Evite \"informamos que\", \"cumpre esclarecer\", \"conforme supracitado\".\n" +
      "8. Cliente ansioso ou com prazo curto: acolha em uma frase e só depois resolva.\n" +
      "9. Faltando dado, faça UMA pergunta curta em vez de escrever hipóteses longas.\n" +
      "\nANTI-ROBÔ (regras de fala — valem sobre qualquer formatação):\n" +
      "A. Escreva SEMPRE em texto corrido de conversa. É proibido usar listas com marcadores, listas numeradas, títulos, negrito de seção, tabelas ou emojis. Se a ideia pedir vários pontos, ligue-os em frases (\"primeiro…, depois…\").\n" +
      "B. Trate o cliente pelo primeiro nome quando ele for conhecido, no máximo uma vez na resposta, de forma natural — nunca em toda frase e nunca com o nome em maiúsculas.\n" +
      "C. Fale na primeira pessoa do plural pela Quero Armas (\"a gente cuida disso\", \"nós damos entrada\") e na segunda pessoa com o cliente (\"você\"). Nada de terceira pessoa impessoal (\"o cliente deverá\", \"o requerente\").\n" +
      "D. Frases curtas, ritmo de conversa de WhatsApp bem-escrita. Pode usar contrações e conectivos falados (\"olha\", \"na prática\", \"o que acontece é que\").\n" +
      "E. Proibidas fórmulas de robô: \"prezado\", \"informamos que\", \"segue abaixo\", \"em caso de dúvidas, estamos à disposição\", \"espero ter ajudado\", \"como assistente\", \"de acordo com as informações fornecidas\".\n" +
      "F. Nunca repita a pergunta do cliente nem descreva o que você vai fazer (\"vou te explicar\"). Responda direto, como uma pessoa responderia.\n" +
      "G. Demonstre que leu o caso dele: cite um detalhe concreto do processo, do documento ou do prazo dele em vez de falar de forma genérica.\n" +
      "H. Nunca soe como aviso automático. Mesmo negando algo, mantenha voz humana: reconheça, explique o porquê em linguagem simples e diga o caminho.\n" +
      "Precisão jurídica continua inegociável: tom humano nunca autoriza inventar, generalizar competência ou suavizar vedação legal." +
      (personaCfg.regras_extras && personaCfg.regras_extras.trim()
        ? `\n\nREGRAS ADICIONAIS DEFINIDAS PELA EQUIPE QUERO ARMAS (obrigatórias):\n${personaCfg.regras_extras.trim()}`
        : "");

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
  "Você é Klal (כלל), o assistente jurídico e consultor de vendas da Quero Armas.\n\nSeu nome vem do hebraico e significa \"regra geral — o princípio que abrange tudo\".\n\nREGRAS ABSOLUTAS — cumpra à risca, acima de qualquer artigo, exemplo ou histórico recebido:\n\n1. NUNCA se apresente nem cumprimente com 'Olá, sou o Klal' ou parecido. Vá direto ao ponto da dúvida.\n\n2. NUNCA use títulos de seção como 'Resposta', 'Passo a passo', 'Base legal', 'Base legal encontrada' ou 'Atenção'. Escreva em texto corrido, humanizado.\n\n3. NUNCA ensine o cliente a executar o processo. É proibido escrever instruções como 'protocole', 'realize o exame', 'reúna as certidões', 'compre a arma', 'solicite o registro'. Explique o que a lei exige e diga que a QUERO ARMAS executa isso por ele.\n\n4. Os ARTIGOS e a LEGISLAÇÃO recebidos servem SÓ como fonte de fatos. NUNCA copie a estrutura, os títulos, nem as listas de etapas deles.\n\n5. Sobre taxas: a Quero Armas apenas GERA a guia e disponibiliza no Arsenal Inteligente para o cliente pagar — nunca 'recolhe' nem 'paga'.\n\n6. Feche conduzindo para o serviço da Quero Armas (página do serviço ou adicionar ao carrinho).\n\nCOMPETÊNCIA (órgão e sistema) — regra crítica: a fiscalização e o registro NÃO foram todos transferidos para a Polícia Federal. A competência varia por matéria e está definida na legislação fornecida no contexto. Para dizer qual órgão (Polícia Federal ou Exército) e qual sistema (SINARM-CAC, SINARM, SIGMA, SisGCorp) trata de cada assunto, baseie-se ESTRITAMENTE na legislação recebida, matéria por matéria. NUNCA generalize ('tudo passou para a PF' nem 'tudo é do Exército') e NUNCA use seu conhecimento geral prévio sobre isso — só a legislação fornecida vale. Havendo normas de épocas diferentes sobre o mesmo tema (migração em curso), prefira a mais recente e mencione a transição quando fizer diferença. Se a legislação fornecida não deixar claro o órgão/sistema daquela matéria específica, diga que confirma com a equipe Quero Armas — nunca chute.\n\nHIERARQUIA DE FONTES (obrigatória): as fontes PRIMÁRIAS e autoritativas são o TEXTO DAS LEIS — as seções 'Base legal cadastrada em Legislação' e 'Trechos da legislação anexada (PDFs oficiais)'. A seção 'Artigos da Central de Ajuda' é material EXPLICATIVO e PODE ESTAR DESATUALIZADA — NUNCA pode sobrepor o texto da lei. Em qualquer conflito, especialmente sobre qual órgão/sistema é competente, sobre prazos, requisitos ou vedações, vale o TEXTO DA LEI; o artigo é descartado. Se um artigo da Central diz X e a lei diz Y, use Y.\n\nBLOCO 'COMPETÊNCIA DETERMINADA PELA BASE LOCAL': quando o contexto trouxer um bloco intitulado 'COMPETÊNCIA DETERMINADA PELA BASE LOCAL (autoritativa)', os campos órgão, sistema e base legal informados são definitivos e determinísticos — saem do banco de dados curado pela equipe Quero Armas, não de IA. Use-os literalmente ao falar de competência. Se qualquer campo for 'indeterminado', diga honestamente ao cliente que confirma com a equipe Quero Armas.\n\nPROTOCOLO DE ANÁLISE VERTICAL DA LEGISLAÇÃO — execute INTERNAMENTE (não exibir ao cliente) antes de responder qualquer pergunta sobre competência (órgão/sistema), prazo, requisito ou vedação: (1) identifique a matéria exata da pergunta; (2) localize, entre os TRECHOS DE LEI recebidos, o dispositivo específico (norma + artigo) que atribui o órgão/sistema àquela matéria; (3) verifique se há norma MAIS RECENTE que altere ou revogue esse dispositivo — a mais recente prevalece; havendo migração, diga de qual órgão para qual e a partir de quando; (4) só então responda, ancorado no dispositivo e nomeando a norma; (5) se NENHUM trecho de lei recebido resolver a competência daquela matéria, diga honestamente que a base não é conclusiva e que confirma com a equipe Quero Armas — NUNCA preencha a lacuna com conhecimento próprio nem com um Artigo da Central de Ajuda. NUNCA use suposições de conhecimento geral sobre SINARM/SIGMA/SisGCorp. A análise é interna; a resposta ao cliente continua em texto corrido, humanizado, sem seções tituladas nem enumeração das etapas.\n\nVocê é especialista em regulamentação de armas de fogo no Brasil e conversa com o cliente de forma humana, acolhedora e natural — como um consultor experiente que explica numa conversa fluida, jamais como um documento oficial ou um manual em tópicos.\n\nQuem é a Quero Armas: a Quero Armas é a empresa fornecedora do serviço. Nós executamos a burocracia pelo cliente — preparamos autorizações, geramos as taxas e damos entrada nos pedidos junto aos órgãos competentes. Você trabalha exclusivamente para a Quero Armas.\n\nSua missão é dupla: (1) esclarecer, de forma jurídica e conceitual, a dúvida do cliente — o que a lei diz, o que muda para ele, quais os cuidados; (2) conduzir o cliente a contratar o serviço da Quero Armas que resolve aquela necessidade.\n\nNunca ensine o passo a passo operacional. É terminantemente proibido explicar como o cliente faria o processo sozinho. Não diga para ele ir à Polícia Federal, protocolar requerimento, reunir documentos, dar entrada em pedido ou solicitar registro por conta própria. Esse know-how é justamente o serviço que vendemos; ensiná-lo faz o cliente dispensar a Quero Armas. Explique o que a lei exige e por quê, mas deixe claro que quem executa é a Quero Armas.\n\nComo falar das taxas: a Quero Armas NÃO recolhe nem paga a taxa. Nós geramos a guia (GRU) e a disponibilizamos no Arsenal Inteligente para que o cliente mesmo efetue o pagamento. Diga sempre assim — \"geramos a guia e deixamos disponível no seu Arsenal Inteligente para você pagar\" —, nunca \"nós pagamos\" ou \"nós recolhemos\".\n\nPosicione a Quero Armas como executora: em vez de instruir o cliente, diga o que a Quero Armas faz por ele — \"cuidamos de toda a solicitação\", \"damos entrada no pedido e acompanhamos junto ao órgão\", \"preparamos a autorização e você acompanha tudo pelo Arsenal Inteligente\".\n\nARSENAL INTELIGENTE — diferencial exclusivo da Quero Armas: o Arsenal Inteligente é o painel exclusivo onde o cliente acompanha cada etapa do processo em tempo real, recebe notificações, acessa seus documentos, paga as guias e tem acesso ao Klal. É o maior diferencial da Quero Armas frente a qualquer despachante ou escritório tradicional — nada de ligações, nada de papel, nada de ficar no escuro. Em toda resposta, encaixe de forma natural uma menção ao Arsenal Inteligente como parte da experiência da Quero Armas: \"no seu Arsenal Inteligente você acompanha cada passo\", \"assim que iniciado o processo, tudo fica organizado no seu Arsenal Inteligente\", \"as guias ficam disponíveis direto no seu Arsenal Inteligente\". Não force como slogan; integre como benefício concreto da contratação.\n\nFeche sempre conduzindo para a venda, de forma natural na conversa. Quando existir a página do serviço, direcione o cliente para ela pronta para compra; quando o cliente estiver logado, ofereça adicionar o serviço direto ao carrinho (\"posso já adicionar esse serviço ao seu carrinho para você concluir agora?\"). Faça isso encaixado na conversa, nunca como um anúncio colado no fim.\n\nEstilo: escreva em texto corrido, humanizado, como uma conversa real. NÃO segmente a resposta em blocos ou seções com títulos (\"Resposta\", \"Passo a passo\", \"Base legal\", \"Atenção\"). Ao citar uma norma, encaixe-a naturalmente na frase (ex.: \"pela Lei nº 10.826/2003, você...\"), sempre nomeando a norma de origem. Traga vedações, prazos e restrições relevantes no próprio fluxo da conversa, não numa lista à parte.\n\nConteúdo: use SOMENTE as informações dos artigos e da base legal fornecidos; leia-os por inteiro antes de responder. Se o material for insuficiente para responder com segurança, diga com honestidade o que encontrou e convide o cliente a falar com a equipe Quero Armas. Nunca invente. Nunca mencione termos internos como \"banco de dados\", \"chunk\", \"edge function\" ou detalhes técnicos.\n\nQuando houver exemplos de respostas anteriores aprovadas, use-os apenas como referência de tom e profundidade — nunca copie o conteúdo." +
                  personaBloco +
                  "\n\nCONTA DO CLIENTE (obrigatório): quando o contexto trouxer o bloco 'DADOS REAIS DA CONTA DESTE CLIENTE', você DEVE responder qualquer pergunta sobre o que ele comprou e contratou — quais serviços, valores, forma de pagamento, número de parcelas, se está pago ou em aberto, e em que pé está cada processo. Use exclusivamente os valores, datas e status desse bloco; nunca estime nem invente. Se algo não constar ali, diga com honestidade que confirma com a equipe Quero Armas. Fale desses dados em texto corrido e acolhedor, lembrando que tudo também fica visível no Arsenal Inteligente dele." +
                  "\n\nSUPORTE, NÃO VENDA (regra que vence a oferta comercial): se a pergunta for sobre o processo, o pedido, o pagamento, o prazo, o status ou qualquer coisa que o cliente JÁ contratou, você é atendimento — não vendedor. Responda de forma concreta e específica usando os DADOS REAIS DA CONTA: diga quais processos estão abertos, o status de cada um, o que já foi entregue, o que exatamente está faltando (documento por documento) e qual é o próximo movimento da equipe. Nada de resposta genérica. NESSES CASOS É PROIBIDO oferecer serviço e PROIBIDO emitir a marca [[SERVICO: ...]]. Feche perguntando se ele quer ajuda para resolver a pendência, nunca com convite a contratar." +
                  "\n\nOFERTA COMERCIAL (só quando cabe): apenas quando a necessidade do cliente NÃO estiver coberta por nada que ele já comprou, e existir na lista de Catálogo um serviço que a resolve, ofereça-o pelo nome dentro da conversa (sem inventar serviços fora da lista) e, na ÚLTIMA linha, emita a marca oculta [[SERVICO: <slug>]] com o slug exato. Nunca ofereça serviço que já conste como comprado/contratado nos dados da conta. Em dúvida, não ofereça nada. Nunca cite preços de memória — quem exibe o preço é o botão de contratação." +
                  (rejeitadasCtx
                    ? `\n\nRESPOSTAS ANTERIORES REJEITADAS PELA EQUIPE para perguntas similares:\n${rejeitadasCtx}\n\nEvite cometer os mesmos erros.`
                    : ""),
            },
            ...historyMessages,
            {
              role: "user",
              content:
                `Dúvida do cliente: "${query}"\n\n` +
                (anexosCtx ? `${anexosCtx}\n\n======\n\n` : "") +
                `Fontes disponíveis:\n\n${ctxFinal}`,
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

    // ═══════════════════════════════════════════════════════════════
    // EXIBIÇÃO DE FONTES — regra de negócio (Quero Armas):
    //  • Pergunta sobre o processo/pedido/status/pagamento do cliente
    //    (atendimento) → NÃO mostrar legislação nenhuma.
    //  • Recomendação de serviço ou dúvida técnica/jurídica → mostrar
    //    SOMENTE as fontes efetivamente usadas naquela resposta.
    // ═══════════════════════════════════════════════════════════════
    const qNorm = (query || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const PROCESSO_RE =
      /(andamento|status|em que pe|meu processo|meus processos|meu pedido|meus pedidos|protocolo|prazo do meu|quando fica pronto|quanto tempo falta|pendencia|pendencias|falta o que|o que falta|documento que falta|pagamento|paguei|parcela|boleto|fatura|nota fiscal do meu|contrato assinado|minha compra|contratei|ja contratei)/;
    const perguntaSobreProcesso = PROCESSO_RE.test(qNorm);

    const chaveNorma = (t: string | null | undefined) => {
      const s = (t || "").toLowerCase();
      const nums = Array.from(s.matchAll(/(\d{1,3}[.\s]?\d{3}|\d{1,5})\s*[\/,]?\s*(\d{4})?/g))
        .map((m) => m[0].replace(/[^\d]/g, ""))
        .filter((n) => n.length >= 4);
      return nums;
    };
    const fontesUsadas = (texto: string) => {
      const t = (texto || "").toLowerCase().replace(/[^\w\d]/g, "");
      const vistos = new Set<string>();
      const out: typeof fontesResumo = [];
      for (const f of fontesResumo) {
        const chave = `${f.titulo_norma ?? ""}`.trim();
        if (!chave || vistos.has(chave)) continue;
        const nums = chaveNorma(chave);
        const citada = nums.some((n) => t.includes(n));
        if (citada) {
          vistos.add(chave);
          out.push(f);
        }
      }
      return out.slice(0, 4);
    };

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

        // Fontes só são enviadas ao final, já filtradas pelo que foi usado.
        send({ type: "meta", fontes: [] });

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

        // ═════ Auto-conserto: nenhuma sessão sem numero_protocolo ═════
        if (effectiveSessaoId && (!effectiveProtocolo || effectiveProtocolo.trim() === "")) {
          let protocoloGerado: string | null = null;
          try {
            const { data: protoData, error: protoErr } = await supabase.rpc(
              "qa_gerar_protocolo_chat",
            );
            if (protoErr) {
              console.error("[auto-conserto] qa_gerar_protocolo_chat error:", protoErr);
            }
            if (typeof protoData === "string" && protoData.trim().length > 0) {
              protocoloGerado = protoData.trim();
            }
          } catch (e) {
            console.error("[auto-conserto] qa_gerar_protocolo_chat throw:", e);
          }
          if (!protocoloGerado) {
            // Fallback JS: QA-AAAAMMDD-NNNN (São Paulo)
            try {
              const parts = new Intl.DateTimeFormat("en-CA", {
                timeZone: "America/Sao_Paulo",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })
                .format(new Date())
                .split("-");
              const yyyymmdd = `${parts[0]}${parts[1]}${parts[2]}`;
              const startIso = `${parts[0]}-${parts[1]}-${parts[2]}T00:00:00-03:00`;
              const endIso = `${parts[0]}-${parts[1]}-${parts[2]}T23:59:59-03:00`;
              const { count } = await supabase
                .from("qa_chat_sessoes")
                .select("id", { count: "exact", head: true })
                .eq("cliente_id", clienteId as number)
                .gte("created_at", startIso)
                .lte("created_at", endIso);
              const seq = String(((count ?? 0) + 1)).padStart(4, "0");
              protocoloGerado = `QA-${yyyymmdd}-${seq}`;
            } catch (e) {
              console.error("[auto-conserto] fallback JS falhou:", e);
            }
          }
          if (protocoloGerado) {
            try {
              const { data: upd, error: updErr } = await supabase
                .from("qa_chat_sessoes")
                .update({ numero_protocolo: protocoloGerado })
                .eq("id", effectiveSessaoId)
                .select("numero_protocolo, created_at")
                .single();
              if (updErr) {
                console.error("[auto-conserto] update sessão falhou:", updErr);
              } else {
                effectiveProtocolo =
                  (upd as any)?.numero_protocolo || protocoloGerado;
                if (!effectiveProtocoloData) {
                  effectiveProtocoloData = (upd as any)?.created_at ?? null;
                }
              }
            } catch (e) {
              console.error("[auto-conserto] update throw:", e);
            }
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
        // Buffer para segurar tokens até termos certeza de que não fazem parte
        // da marca "[[SERVICO: slug]]" — nunca enviar essa marca ao cliente.
        let holdBuffer = "";
        const flushHold = () => {
          if (holdBuffer) {
            send({ type: "token", content: holdBuffer });
            holdBuffer = "";
          }
        };
        // Regex conservador para casar a marca em qualquer lugar do texto.
        const MARK_RE = /\[\[SERVICO:\s*([a-z0-9-_]+)\s*\]\]/gi;
        // Se qualquer prefixo do buffer combina com o início de "[[SERVICO:", segure.
        const isPartialMark = (s: string) => {
          for (let i = 1; i <= Math.min(s.length, 32); i++) {
            const tail = s.slice(-i);
            if ("[[SERVICO:".startsWith(tail)) return true;
          }
          return false;
        };
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
                  holdBuffer += delta;
                  // Remove marcas completas do holdBuffer antes de enviar.
                  holdBuffer = holdBuffer.replace(MARK_RE, "");
                  // Se o final do buffer parece início de marca, segure até
                  // termos mais tokens; senão envie tudo.
                  if (isPartialMark(holdBuffer)) {
                    // aguarda mais tokens
                  } else {
                    flushHold();
                  }
                }
              } catch (_) {
                /* ignora chunks parciais */
              }
            }
          }
          // Fim do stream: garanta que qualquer marca residual seja removida
          // e envie o restante do buffer.
          holdBuffer = holdBuffer.replace(MARK_RE, "");
          flushHold();
        } catch (e) {
          console.error("stream read error:", e);
          send({ type: "error", message: "Falha durante o streaming." });
        }

        // Resolve serviço sugerido a partir da marca no texto completo.
        let servicoSugerido: { id: string; slug: string; nome: string; preco_cents: number } | null = null;
        let servicoSugeridoSlug: string | null = null;
        const matches = Array.from(full.matchAll(MARK_RE));
        if (matches.length > 0) {
          const slug = matches[matches.length - 1][1].toLowerCase();
          const s = catalogoBySlug.get(slug);
          const nomeNorm = s ? normalizarNome(s.nome) : "";
          const jaContratado =
            !!s &&
            Array.from(servicosContratadosNorm).some(
              (c) => c && nomeNorm && (c === nomeNorm || c.includes(nomeNorm) || nomeNorm.includes(c)),
            );
          if (s && !jaContratado) {
            servicoSugerido = { id: s.id, slug: s.slug, nome: s.nome, preco_cents: s.preco_cents };
            servicoSugeridoSlug = s.slug;
          } else if (jaContratado) {
            console.log("[oferta] suprimida — serviço já contratado:", s?.slug);
          }
        }
        // Limpa marcas do texto salvo/persistido.
        const fullLimpo = full.replace(MARK_RE, "").trim();
        const fontesFinais = perguntaSobreProcesso ? [] : fontesUsadas(fullLimpo);
        send({ type: "meta", fontes: fontesFinais });
        if (servicoSugerido) {
          send({ type: "servico_sugerido", servico: servicoSugerido });
        }

        // Persistência: user + assistant (pulada no modo refinamento — o chat
        // interno de refinamento não deve poluir a fila de aprovação).
        if (!modo_refinamento && clienteId && effectiveSessaoId && fullLimpo.length > 0) {
          try {
            const anexosResumo = anexosLista.map((a) => ({
              id: a?.id ?? null,
              nome_arquivo: a?.nome_arquivo ?? null,
              mime_type: a?.mime_type ?? null,
            }));
            const { data: inseridas } = await supabase.from("qa_chat_mensagens").insert([
              {
                sessao_id: effectiveSessaoId,
                cliente_id: clienteId,
                role: "user",
                content: query,
                fontes: [],
                anexos: anexosResumo,
              },
              {
                sessao_id: effectiveSessaoId,
                cliente_id: clienteId,
                role: "assistant",
                content: fullLimpo,
                fontes: fontesFinais,
                nivel_confianca: nivelConfianca,
                servico_sugerido_slug: servicoSugeridoSlug,
              },
            ] as any).select("id, role");
            // Vincula os anexos à sessão/mensagem (auditoria)
            const idsAnexos = anexosLista
              .map((a) => a?.id)
              .filter((id): id is string => typeof id === "string" && id.length > 0);
            if (idsAnexos.length > 0) {
              const msgUser = (inseridas ?? []).find((m: any) => m.role === "user");
              await supabase
                .from("qa_chat_anexos")
                .update({
                  sessao_id: effectiveSessaoId,
                  cliente_id: clienteId,
                  mensagem_id: msgUser?.id ?? null,
                })
                .in("id", idsAnexos);
            }
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

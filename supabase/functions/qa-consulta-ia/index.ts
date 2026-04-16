import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você atua como assistente de redação jurídica da Quero Armas. Sua função é consultar exclusivamente as fontes recuperadas e validadas no sistema, organizar os fatos narrados, estruturar argumentos jurídicos e redigir minutas técnicas com linguagem profissional, sóbria, precisa e rastreável.

REGRAS ABSOLUTAS E INVIOLÁVEIS:
1. É PROIBIDO inventar fatos, artigos, leis, precedentes, tribunais, processos, datas, trechos normativos ou jurisprudência.
2. Toda afirmação jurídica DEVE estar ancorada em fonte recuperada.
3. Se houver insuficiência de base, declare isso EXPRESSAMENTE — nunca preencha lacunas com suposições.
4. Nunca trate hipótese como fato comprovado.
5. Nunca misture institutos distintos (ex.: posse ≠ porte; SINARM ≠ SIGMA).
6. Nunca produza texto final como verdade absoluta sem base documental ou normativa recuperada.
7. Nunca cite jurisprudência que NÃO conste na lista de fontes recuperadas abaixo.
8. Nunca cite artigo de lei que NÃO conste na lista de fontes recuperadas abaixo.
9. Se não encontrar jurisprudência na base, diga: "Não foram encontradas jurisprudências na base de conhecimento para este tema."
10. Se não encontrar legislação na base, diga: "Não foram encontradas normas na base de conhecimento para este tema."
11. Sempre indique ao final QUAIS FONTES foram efetivamente utilizadas na resposta, com identificação precisa.
12. Use tom jurídico profissional, sóbrio e técnico — sem floreio, sem linguagem coloquial, sem repetições desnecessárias.

ESTRUTURA DESEJADA PARA MINUTAS:
- Contextualização inicial
- Síntese fática
- Enquadramento jurídico
- Desenvolvimento fundamentado (ancorado nas fontes)
- Pedidos ou conclusão
- Fechamento técnico
- Lista de fontes efetivamente utilizadas`;

// Generate embedding via Lovable AI
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return null;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are an embedding generator. Given the user text, output ONLY a JSON array of 1536 floating-point numbers representing a semantic embedding vector. No other text." },
          { role: "user", content: text.substring(0, 2000) },
        ],
        max_tokens: 8000,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) && arr.length === 1536 ? arr : null;
  } catch { return null; }
}

// Fetch and format exam data for AI context
async function buildExamContext(supabase: any, clienteId: number | string | null): Promise<string> {
  if (!clienteId) return "";
  try {
    const { data: exames } = await supabase
      .from("qa_exames_cliente")
      .select("tipo, data_realizacao, data_vencimento, observacoes, created_at")
      .eq("cliente_id", clienteId)
      .order("data_realizacao", { ascending: false })
      .limit(20);
    if (!exames || exames.length === 0) return "";

    const now = new Date();
    const calcStatus = (venc: string) => {
      const d = new Date(venc);
      const dias = Math.ceil((d.getTime() - now.getTime()) / 86400000);
      if (dias < 0) return { status: "VENCIDO", dias };
      if (dias <= 45) return { status: "A VENCER", dias };
      return { status: "VIGENTE", dias };
    };

    let ctx = "\n\n═══ EXAMES DO REQUERENTE ═══\n";
    const tipos = ["psicologico", "tiro"] as const;
    for (const tipo of tipos) {
      const label = tipo === "psicologico" ? "EXAME PSICOLÓGICO" : "EXAME DE TIRO";
      const grupo = exames.filter((e: any) => e.tipo === tipo);
      if (grupo.length === 0) {
        ctx += `\n${label}: Nenhum registro cadastrado.\n`;
        continue;
      }
      ctx += `\n${label} (${grupo.length} registro(s)):\n`;
      grupo.forEach((e: any, i: number) => {
        const { status, dias } = calcStatus(e.data_vencimento);
        ctx += `  [${i === 0 ? "ATUAL" : `Histórico ${i}`}] Realizado: ${e.data_realizacao} | Vencimento: ${e.data_vencimento} | Status: ${status} (${dias} dias)`;
        if (e.observacoes) ctx += ` | Obs: ${e.observacoes}`;
        ctx += "\n";
      });
    }
    return ctx;
  } catch (e) {
    console.warn("buildExamContext error:", e);
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { usuario_id, caso_titulo, entrada_usuario, tipo_peca, profundidade, tom, foco, cliente_id } = await req.json();
    if (!entrada_usuario) throw new Error("entrada_usuario required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 0. Load ranking weights from qa_config ──
    const { data: configRows } = await supabase.from("qa_config").select("chave, valor");
    const w: Record<string, number> = {};
    (configRows || []).forEach((r: any) => { w[r.chave] = parseFloat(r.valor) || 0; });
    const W = {
      vetorial: w.peso_similaridade_vetorial ?? 0.25,
      textual: w.peso_relevancia_textual ?? 0.25,
      validacao: w.peso_validacao_humana ?? 0.20,
      feedbackPos: w.peso_feedback_positivo ?? 0.15,
      feedbackNeg: w.peso_feedback_negativo ?? -0.10,
      refAprovada: w.peso_referencia_aprovada ?? 0.30,
      recencia: w.peso_recencia ?? 0.05,
      manual: w.peso_manual ?? 0.10,
    };

    // ── 1. Hybrid retrieval ──
    const fontesRecuperadas: any[] = [];
    const searchTerms = entrada_usuario.split(" ").slice(0, 5).join(" & ");
    const searchTermIlike = entrada_usuario.split(" ").slice(0, 3).join(" ");

    // 1a. Vector search via embeddings
    const queryEmbedding = await generateEmbedding(entrada_usuario);
    if (queryEmbedding) {
      const { data: vectorHits } = await supabase.rpc("qa_busca_similar", {
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_threshold: 0.5,
        match_count: 10,
      });
      if (vectorHits?.length) {
        for (const hit of vectorHits) {
          fontesRecuperadas.push({
            tipo: "documento_chunk", id: hit.documento_id, chunk_id: hit.chunk_id,
            titulo: hit.resumo_chunk || "Trecho de documento",
            referencia: "chunk vetorial",
            conteudo: hit.texto_chunk?.substring(0, 1500) || "",
            score_semantico: hit.similarity || 0,
            score_textual: 0, score_validacao: 0, score_feedback: 0,
            score_final: (hit.similarity || 0) * W.vetorial,
          });
        }
      }
    }

    // 1b. Search legislation (text search + ilike fallback)
    const { data: normas } = await supabase
      .from("qa_fontes_normativas")
      .select("id, titulo_norma, tipo_norma, numero_norma, ano_norma, ementa, texto_integral, revisada_humanamente")
      .eq("ativa", true)
      .textSearch("ementa", searchTerms, { type: "websearch" })
      .limit(8);

    if (normas?.length) {
      normas.forEach((n: any) => {
        const sv = 0, st = 1.0, svl = n.revisada_humanamente ? 1.0 : 0;
        fontesRecuperadas.push({
          tipo: "norma", id: n.id, titulo: n.titulo_norma,
          referencia: `${n.tipo_norma} ${n.numero_norma || ""}/${n.ano_norma || ""}`.trim(),
          conteudo: n.ementa || n.texto_integral?.substring(0, 2000) || "",
          score_semantico: sv, score_textual: st, score_validacao: svl,
          score_feedback: 0,
          score_final: (st * W.textual) + (svl * W.validacao),
        });
      });
    }

    // 1c. Search jurisprudence
    const { data: jurisps } = await supabase
      .from("qa_jurisprudencias")
      .select("id, tribunal, numero_processo, relator, tema, ementa_resumida, tese_aplicavel, validada_humanamente")
      .textSearch("ementa_resumida", searchTerms, { type: "websearch" })
      .limit(8);

    if (jurisps?.length) {
      jurisps.forEach((j: any) => {
        const svl = j.validada_humanamente ? 1.0 : 0;
        fontesRecuperadas.push({
          tipo: "jurisprudencia", id: j.id,
          titulo: `${j.tribunal} - ${j.numero_processo || ""}`,
          referencia: j.tema || "",
          conteudo: j.ementa_resumida || j.tese_aplicavel || "",
          score_semantico: 0, score_textual: 1.0, score_validacao: svl,
          score_feedback: 0,
          score_final: (1.0 * W.textual) + (svl * W.validacao),
        });
      });
    }

    // 1d. Search knowledge base documents (text) — EXCLUDE case-specific evidence
    const { data: docs } = await supabase
      .from("qa_documentos_conhecimento")
      .select("id, titulo, tipo_documento, resumo_extraido, status_validacao, papel_documento")
      .eq("status_processamento", "concluido")
      .eq("ativo_na_ia", true)
      .neq("papel_documento", "auxiliar_caso")
      .textSearch("resumo_extraido", searchTerms, { type: "websearch" })
      .limit(8);

    if (docs?.length) {
      docs.forEach((d: any) => {
        const svl = d.status_validacao === "validado" ? 1.0 : 0;
        fontesRecuperadas.push({
          tipo: "documento", id: d.id, titulo: d.titulo,
          referencia: d.tipo_documento,
          conteudo: d.resumo_extraido?.substring(0, 1000) || "",
          score_semantico: 0, score_textual: 1.0, score_validacao: svl,
          score_feedback: 0,
          score_final: (1.0 * W.textual) + (svl * W.validacao),
        });
      });
    }

    // 1e. Search approved pieces as reference
    const { data: refs } = await supabase
      .from("qa_referencias_preferenciais")
      .select("id, tipo_referencia, origem_id, peso_manual, motivo_priorizacao")
      .eq("ativo", true)
      .limit(20);

    if (refs?.length) {
      const geracaoIds = refs.filter((r: any) => r.tipo_referencia === "geracao_aprovada").map((r: any) => r.origem_id);
      if (geracaoIds.length > 0) {
        const { data: geracoes } = await supabase
          .from("qa_geracoes_pecas")
          .select("id, titulo_geracao, tipo_peca, minuta_gerada")
          .in("id", geracaoIds)
          .limit(5);

        geracoes?.forEach((g: any) => {
          const ref = refs.find((r: any) => r.origem_id === g.id);
          const pesoM = ref?.peso_manual || 1;
          fontesRecuperadas.push({
            tipo: "referencia_aprovada", id: g.id, titulo: g.titulo_geracao || "Peça aprovada",
            referencia: g.tipo_peca,
            conteudo: g.minuta_gerada?.substring(0, 1500) || "",
            score_semantico: 0, score_textual: 0.5, score_validacao: 1.0,
            score_feedback: pesoM,
            score_final: (0.5 * W.textual) + (1.0 * W.validacao) + (1.0 * W.refAprovada) + (pesoM * W.manual),
          });
        });
      }
    }

    // 1f. ilike fallback if nothing found
    if (fontesRecuperadas.length === 0) {
      const { data: normasFb } = await supabase
        .from("qa_fontes_normativas")
        .select("id, titulo_norma, tipo_norma, numero_norma, ano_norma, ementa, revisada_humanamente")
        .eq("ativa", true).ilike("titulo_norma", `%${searchTermIlike}%`).limit(3);

      normasFb?.forEach((n: any) => fontesRecuperadas.push({
        tipo: "norma", id: n.id, titulo: n.titulo_norma,
        referencia: `${n.tipo_norma} ${n.numero_norma || ""}`, conteudo: n.ementa || "",
        score_semantico: 0, score_textual: 0.3, score_validacao: n.revisada_humanamente ? 1.0 : 0,
        score_feedback: 0,
        score_final: (0.3 * W.textual) + (n.revisada_humanamente ? W.validacao : 0),
      }));

      const { data: jurispFb } = await supabase
        .from("qa_jurisprudencias")
        .select("id, tribunal, numero_processo, tema, ementa_resumida, validada_humanamente")
        .ilike("tema", `%${searchTermIlike}%`).limit(3);

      jurispFb?.forEach((j: any) => fontesRecuperadas.push({
        tipo: "jurisprudencia", id: j.id, titulo: `${j.tribunal} - ${j.numero_processo || ""}`,
        referencia: j.tema || "", conteudo: j.ementa_resumida || "",
        score_semantico: 0, score_textual: 0.3, score_validacao: j.validada_humanamente ? 1.0 : 0,
        score_feedback: 0,
        score_final: (0.3 * W.textual) + (j.validada_humanamente ? W.validacao : 0),
      }));
    }

    // ── 2. Deduplicate by id+tipo and sort by score_final ──
    const seen = new Set<string>();
    const fontesFinal = fontesRecuperadas.filter(f => {
      const key = `${f.tipo}:${f.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    fontesFinal.sort((a, b) => (b.score_final || 0) - (a.score_final || 0));
    const topFontes = fontesFinal.slice(0, 20);

    // ── 3. Build context for AI ──
    let contextoFontes = "";
    if (topFontes.length > 0) {
      contextoFontes = "\n\n--- FONTES DISPONÍVEIS NA BASE (ordenadas por relevância) ---\n";
      topFontes.forEach((f, i) => {
        contextoFontes += `\n[Fonte ${i + 1} - ${f.tipo.toUpperCase()}] ${f.titulo}\nReferência: ${f.referencia}\nScore de confiança: ${(f.score_final || 0).toFixed(2)}\nConteúdo: ${f.conteudo}\n`;
      });
    } else {
      contextoFontes = "\n\n--- ATENÇÃO: Nenhuma fonte foi encontrada na base de conhecimento. NÃO invente fontes. Declare insuficiência. ---\n";
    }

    let parametros = "\n\nPARÂMETROS DE GERAÇÃO:";
    parametros += `\n- Profundidade: ${profundidade || "intermediaria"}`;
    parametros += `\n- Tom: ${tom || "tecnico_padrao"}`;
    parametros += `\n- Foco argumentativo: ${foco || "legalidade"}`;

    // ── 3b. Fetch exam context ──
    const exameContext = await buildExamContext(supabase, cliente_id);

    // ── 4. Call AI ──
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `CASO: ${caso_titulo || "Sem título"}\nTIPO DE PEÇA: ${tipo_peca || "não especificado"}${parametros}${exameContext}\n\nDESCRIÇÃO DO CASO:\n${entrada_usuario}${contextoFontes}\n\nCom base EXCLUSIVAMENTE nas fontes acima (se disponíveis), forneça:\n1. Análise jurídica do caso\n2. Fundamentos legais aplicáveis (apenas os que constam na base)\n3. Jurisprudência relevante (apenas a cadastrada e listada acima)\n4. Sugestão de estrutura argumentativa\n5. Observações sobre lacunas de fonte\n6. Lista final das fontes efetivamente utilizadas na resposta`,
          },
        ],
        max_tokens: 6000,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsH, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsH, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro no gateway de IA");
    }

    const aiData = await aiResp.json();
    const respostaIa = aiData.choices?.[0]?.message?.content || "Não foi possível gerar resposta.";

    // ── 5. Confidence score ──
    const totalFontes = topFontes.length;
    const fontesValidadas = topFontes.filter(f => f.score_validacao > 0).length;
    const fontesVetoriais = topFontes.filter(f => f.score_semantico > 0).length;
    const scoreConfianca = totalFontes === 0 ? 0 : Math.min(1,
      (totalFontes * 0.08) + (fontesValidadas * 0.12) + (fontesVetoriais * 0.05)
    );

    // ── 6. Observations ──
    let observacoesIa = "";
    if (totalFontes === 0) {
      observacoesIa = "ATENÇÃO: Nenhuma fonte foi encontrada na base de conhecimento. A resposta é limitada e deve ser validada manualmente.";
    } else if (topFontes.filter(f => f.tipo === "jurisprudencia").length === 0) {
      observacoesIa = "Nenhuma jurisprudência foi encontrada na base. Considere cadastrar precedentes relevantes.";
    } else if (topFontes.filter(f => f.tipo === "norma").length === 0) {
      observacoesIa = "Nenhuma norma foi encontrada na base. Considere cadastrar legislação aplicável.";
    }
    if (!queryEmbedding) {
      observacoesIa += (observacoesIa ? " " : "") + "Busca vetorial indisponível nesta consulta (embedding não gerado).";
    }

    // ── 7. Save consultation ──
    const { data: consultaData } = await supabase.from("qa_consultas_ia").insert({
      usuario_id,
      caso_titulo: caso_titulo || null,
      caso_resumo: entrada_usuario.substring(0, 500),
      tipo_peca: tipo_peca || null,
      entrada_usuario,
      fontes_recuperadas_json: topFontes,
      resposta_ia: respostaIa,
      observacoes_ia: observacoesIa || null,
      score_confianca: scoreConfianca,
      profundidade: profundidade || null,
      tom: tom || null,
      foco: foco || null,
    }).select("id").single();

    // ── 8. Save retrieval metrics ──
    if (consultaData?.id) {
      const metricas = topFontes.map(f => ({
        consulta_id: consultaData.id,
        fonte_tipo: f.tipo,
        fonte_id: f.id,
        score_semantico: f.score_semantico || 0,
        score_textual: f.score_textual || 0,
        score_feedback: f.score_feedback || 0,
        score_validacao: f.score_validacao || 0,
        score_final: f.score_final || 0,
        foi_utilizada: true,
      }));
      if (metricas.length > 0) {
        await supabase.from("qa_metricas_recuperacao").insert(metricas);
      }
    }

    // ── 9. Audit log ──
    await supabase.from("qa_logs_auditoria").insert({
      usuario_id,
      entidade: "qa_consultas_ia",
      entidade_id: consultaData?.id || null,
      acao: "consulta_ia",
      detalhes_json: {
        tipo_peca, profundidade, tom, foco,
        fontes_count: totalFontes,
        fontes_vetoriais: fontesVetoriais,
        score_confianca: scoreConfianca,
        pesos_utilizados: W,
      },
    });

    return new Response(JSON.stringify({
      consulta_id: consultaData?.id,
      resposta_ia: respostaIa,
      fontes_recuperadas: topFontes,
      observacoes_ia: observacoesIa,
      score_confianca: scoreConfianca,
    }), { headers: { ...corsH, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("qa-consulta-ia error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});

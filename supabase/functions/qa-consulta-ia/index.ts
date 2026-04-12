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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { usuario_id, caso_titulo, entrada_usuario, tipo_peca, profundidade, tom, foco } = await req.json();
    if (!entrada_usuario) throw new Error("entrada_usuario required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Hybrid retrieval with scoring ──
    const fontesRecuperadas: any[] = [];
    const searchTerms = entrada_usuario.split(" ").slice(0, 5).join(" & ");
    const searchTermIlike = entrada_usuario.split(" ").slice(0, 3).join(" ");

    // 1a. Search legislation (text search + ilike fallback)
    const { data: normas } = await supabase
      .from("qa_fontes_normativas")
      .select("id, titulo_norma, tipo_norma, numero_norma, ano_norma, ementa, texto_integral, revisada_humanamente")
      .eq("ativa", true)
      .textSearch("ementa", searchTerms, { type: "websearch" })
      .limit(8);

    if (normas?.length) {
      normas.forEach((n: any) => {
        const scoreValidacao = n.revisada_humanamente ? 0.3 : 0;
        fontesRecuperadas.push({
          tipo: "norma", id: n.id, titulo: n.titulo_norma,
          referencia: `${n.tipo_norma} ${n.numero_norma || ""}/${n.ano_norma || ""}`.trim(),
          conteudo: n.ementa || n.texto_integral?.substring(0, 2000) || "",
          score_textual: 0.7, score_validacao: scoreValidacao,
          score_feedback: 0, score_final: 0.7 + scoreValidacao,
        });
      });
    }

    // 1b. Search jurisprudence
    const { data: jurisps } = await supabase
      .from("qa_jurisprudencias")
      .select("id, tribunal, numero_processo, relator, tema, ementa_resumida, tese_aplicavel, validada_humanamente")
      .textSearch("ementa_resumida", searchTerms, { type: "websearch" })
      .limit(8);

    if (jurisps?.length) {
      jurisps.forEach((j: any) => {
        const scoreValidacao = j.validada_humanamente ? 0.4 : 0;
        fontesRecuperadas.push({
          tipo: "jurisprudencia", id: j.id,
          titulo: `${j.tribunal} - ${j.numero_processo || ""}`,
          referencia: j.tema || "",
          conteudo: j.ementa_resumida || j.tese_aplicavel || "",
          score_textual: 0.6, score_validacao: scoreValidacao,
          score_feedback: 0, score_final: 0.6 + scoreValidacao,
        });
      });
    }

    // 1c. Search knowledge base documents
    const { data: docs } = await supabase
      .from("qa_documentos_conhecimento")
      .select("id, titulo, tipo_documento, resumo_extraido, status_validacao")
      .eq("status_processamento", "concluido")
      .textSearch("resumo_extraido", searchTerms, { type: "websearch" })
      .limit(8);

    if (docs?.length) {
      docs.forEach((d: any) => {
        const scoreValidacao = d.status_validacao === "validado" ? 0.3 : 0;
        fontesRecuperadas.push({
          tipo: "documento", id: d.id, titulo: d.titulo,
          referencia: d.tipo_documento,
          conteudo: d.resumo_extraido?.substring(0, 1000) || "",
          score_textual: 0.5, score_validacao: scoreValidacao,
          score_feedback: 0, score_final: 0.5 + scoreValidacao,
        });
      });
    }

    // 1d. Search approved pieces as reference
    const { data: refs } = await supabase
      .from("qa_referencias_preferenciais")
      .select("id, tipo_referencia, origem_id, peso_manual, motivo_priorizacao")
      .eq("ativo", true)
      .limit(20);

    if (refs?.length) {
      const geracaoIds = refs.filter(r => r.tipo_referencia === "geracao_aprovada").map(r => r.origem_id);
      if (geracaoIds.length > 0) {
        const { data: geracoes } = await supabase
          .from("qa_geracoes_pecas")
          .select("id, titulo_geracao, tipo_peca, minuta_gerada")
          .in("id", geracaoIds)
          .limit(5);

        geracoes?.forEach((g: any) => {
          const ref = refs.find(r => r.origem_id === g.id);
          fontesRecuperadas.push({
            tipo: "referencia_aprovada", id: g.id, titulo: g.titulo_geracao || "Peça aprovada",
            referencia: g.tipo_peca, conteudo: g.minuta_gerada?.substring(0, 1500) || "",
            score_textual: 0.3, score_validacao: 0.5,
            score_feedback: (ref?.peso_manual || 1) * 0.3,
            score_final: 0.3 + 0.5 + (ref?.peso_manual || 1) * 0.3,
          });
        });
      }
    }

    // 1e. ilike fallback if nothing found
    if (fontesRecuperadas.length === 0) {
      const { data: normasFb } = await supabase
        .from("qa_fontes_normativas")
        .select("id, titulo_norma, tipo_norma, numero_norma, ano_norma, ementa, revisada_humanamente")
        .eq("ativa", true).ilike("titulo_norma", `%${searchTermIlike}%`).limit(3);

      normasFb?.forEach((n: any) => fontesRecuperadas.push({
        tipo: "norma", id: n.id, titulo: n.titulo_norma,
        referencia: `${n.tipo_norma} ${n.numero_norma || ""}`, conteudo: n.ementa || "",
        score_textual: 0.3, score_validacao: n.revisada_humanamente ? 0.3 : 0,
        score_feedback: 0, score_final: 0.3 + (n.revisada_humanamente ? 0.3 : 0),
      }));

      const { data: jurispFb } = await supabase
        .from("qa_jurisprudencias")
        .select("id, tribunal, numero_processo, tema, ementa_resumida, validada_humanamente")
        .ilike("tema", `%${searchTermIlike}%`).limit(3);

      jurispFb?.forEach((j: any) => fontesRecuperadas.push({
        tipo: "jurisprudencia", id: j.id, titulo: `${j.tribunal} - ${j.numero_processo || ""}`,
        referencia: j.tema || "", conteudo: j.ementa_resumida || "",
        score_textual: 0.3, score_validacao: j.validada_humanamente ? 0.4 : 0,
        score_feedback: 0, score_final: 0.3 + (j.validada_humanamente ? 0.4 : 0),
      }));
    }

    // ── 2. Sort by score_final descending ──
    fontesRecuperadas.sort((a, b) => (b.score_final || 0) - (a.score_final || 0));

    // ── 3. Build context for AI ──
    let contextoFontes = "";
    if (fontesRecuperadas.length > 0) {
      contextoFontes = "\n\n--- FONTES DISPONÍVEIS NA BASE (ordenadas por relevância) ---\n";
      fontesRecuperadas.forEach((f, i) => {
        contextoFontes += `\n[Fonte ${i + 1} - ${f.tipo.toUpperCase()}] ${f.titulo}\nReferência: ${f.referencia}\nScore de confiança: ${(f.score_final || 0).toFixed(2)}\nConteúdo: ${f.conteudo}\n`;
      });
    } else {
      contextoFontes = "\n\n--- ATENÇÃO: Nenhuma fonte foi encontrada na base de conhecimento. NÃO invente fontes. Declare insuficiência. ---\n";
    }

    // Depth/tone/focus context
    let parametros = "\n\nPARÂMETROS DE GERAÇÃO:";
    parametros += `\n- Profundidade: ${profundidade || "intermediaria"}`;
    parametros += `\n- Tom: ${tom || "tecnico_padrao"}`;
    parametros += `\n- Foco argumentativo: ${foco || "legalidade"}`;

    // ── 4. Call AI ──
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `CASO: ${caso_titulo || "Sem título"}\nTIPO DE PEÇA: ${tipo_peca || "não especificado"}${parametros}\n\nDESCRIÇÃO DO CASO:\n${entrada_usuario}${contextoFontes}\n\nCom base EXCLUSIVAMENTE nas fontes acima (se disponíveis), forneça:\n1. Análise jurídica do caso\n2. Fundamentos legais aplicáveis (apenas os que constam na base)\n3. Jurisprudência relevante (apenas a cadastrada e listada acima)\n4. Sugestão de estrutura argumentativa\n5. Observações sobre lacunas de fonte\n6. Lista final das fontes efetivamente utilizadas na resposta`,
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

    // ── 5. Calculate confidence score ──
    const totalFontes = fontesRecuperadas.length;
    const fontesValidadas = fontesRecuperadas.filter(f => f.score_validacao > 0).length;
    const scoreConfianca = totalFontes === 0 ? 0 : Math.min(1, (totalFontes * 0.1) + (fontesValidadas * 0.15));

    // ── 6. Observations ──
    let observacoesIa = "";
    if (totalFontes === 0) {
      observacoesIa = "ATENÇÃO: Nenhuma fonte foi encontrada na base de conhecimento. A resposta é limitada e deve ser validada manualmente.";
    } else if (fontesRecuperadas.filter(f => f.tipo === "jurisprudencia").length === 0) {
      observacoesIa = "Nenhuma jurisprudência foi encontrada na base. Considere cadastrar precedentes relevantes.";
    } else if (fontesRecuperadas.filter(f => f.tipo === "norma").length === 0) {
      observacoesIa = "Nenhuma norma foi encontrada na base. Considere cadastrar legislação aplicável.";
    }

    // ── 7. Save consultation ──
    const { data: consultaData } = await supabase.from("qa_consultas_ia").insert({
      usuario_id,
      caso_titulo: caso_titulo || null,
      caso_resumo: entrada_usuario.substring(0, 500),
      tipo_peca: tipo_peca || null,
      entrada_usuario,
      fontes_recuperadas_json: fontesRecuperadas,
      resposta_ia: respostaIa,
      observacoes_ia: observacoesIa || null,
      score_confianca: scoreConfianca,
      profundidade: profundidade || null,
      tom: tom || null,
      foco: foco || null,
    }).select("id").single();

    // ── 8. Save retrieval metrics ──
    if (consultaData?.id) {
      const metricas = fontesRecuperadas.map(f => ({
        consulta_id: consultaData.id,
        fonte_tipo: f.tipo,
        fonte_id: f.id,
        score_semantico: 0,
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
      detalhes_json: { tipo_peca, profundidade, tom, foco, fontes_count: totalFontes, score_confianca: scoreConfianca },
    });

    return new Response(JSON.stringify({
      consulta_id: consultaData?.id,
      resposta_ia: respostaIa,
      fontes_recuperadas: fontesRecuperadas,
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

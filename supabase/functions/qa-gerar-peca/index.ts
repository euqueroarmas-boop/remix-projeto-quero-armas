import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIPOS_PECA_PERMITIDOS = ["defesa_posse_arma", "defesa_porte_arma", "recurso_administrativo", "resposta_a_notificacao"];

const TIPO_PECA_INSTRUCOES: Record<string, string> = {
  defesa_posse_arma: "Redija uma DEFESA ADMINISTRATIVA para obtenção ou manutenção de POSSE DE ARMA DE FOGO (registro no SINARM). Fundamente com base no Estatuto do Desarmamento (Lei 10.826/2003) e regulamentações aplicáveis. ATENÇÃO: posse ≠ porte. Não misture os institutos.",
  defesa_porte_arma: "Redija uma DEFESA ADMINISTRATIVA para obtenção ou manutenção de PORTE DE ARMA DE FOGO (autorização no SIGMA/SINARM conforme o caso). Fundamente com base no Estatuto do Desarmamento (Lei 10.826/2003) e regulamentações aplicáveis. ATENÇÃO: porte ≠ posse. Não misture os institutos.",
  recurso_administrativo: "Redija um RECURSO ADMINISTRATIVO contra decisão administrativa desfavorável em matéria de armas de fogo. Estruture com: I. DOS FATOS, II. DA TEMPESTIVIDADE, III. DO DIREITO, IV. DOS PEDIDOS.",
  resposta_a_notificacao: "Redija uma RESPOSTA À NOTIFICAÇÃO administrativa recebida em procedimento de armas de fogo. Atenda pontualmente cada item da notificação, com fundamentação técnica e normativa.",
};

const SYSTEM_PROMPT = `Você atua como redator jurídico sênior da Quero Armas. Sua função é redigir peças jurídicas completas, técnicas, sóbrias e profissionais, baseadas EXCLUSIVAMENTE nas fontes recuperadas e validadas fornecidas.

TIPOS DE PEÇA PERMITIDOS (SOMENTE ESTES 4):
- defesa_posse_arma: Defesa para Posse de Arma
- defesa_porte_arma: Defesa para Porte de Arma  
- recurso_administrativo: Recurso Administrativo
- resposta_a_notificacao: Resposta à Notificação

REGRAS INVIOLÁVEIS:
1. PROIBIDO inventar fatos, artigos, leis, jurisprudência, tribunais, processos, datas ou trechos normativos.
2. Toda afirmação jurídica DEVE estar ancorada em fonte recuperada.
3. Se houver insuficiência de base, declare EXPRESSAMENTE.
4. Nunca misture institutos distintos (posse ≠ porte; SINARM ≠ SIGMA).
5. Nunca trate hipótese como fato.
6. Sempre liste as fontes efetivamente utilizadas ao final.
7. NÃO classifique a peça como tipo diferente dos 4 permitidos acima.
8. NÃO use rótulos genéricos como "defesa — posse de arma" ou "petição inicial". Use APENAS os tipos definidos.

FORMATAÇÃO:
- Use marcadores de seção claros: I. DOS FATOS, II. DO DIREITO, III. DA JURISPRUDÊNCIA, etc.
- Parágrafos bem estruturados, linguagem técnica sem floreio.
- Citações normativas entre aspas com referência precisa.
- Jurisprudência citada com tribunal, número do processo e tese.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const {
      usuario_id, caso_titulo, entrada_caso, tipo_peca,
      profundidade, tom, foco, fontes_selecionadas,
    } = await req.json();
    // Validate tipo_peca
    const tipoPecaValido = TIPOS_PECA_PERMITIDOS.includes(tipo_peca) ? tipo_peca : "defesa_posse_arma";

    if (!entrada_caso) throw new Error("entrada_caso required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Retrieve sources (reuse logic from consulta-ia but simplified)
    const fontesRecuperadas: any[] = [];
    const searchTerms = entrada_caso.split(" ").slice(0, 5).join(" & ");

    const { data: normas } = await supabase.from("qa_fontes_normativas")
      .select("id, titulo_norma, tipo_norma, numero_norma, ano_norma, ementa, texto_integral, revisada_humanamente")
      .eq("ativa", true).textSearch("ementa", searchTerms, { type: "websearch" }).limit(10);

    normas?.forEach((n: any) => fontesRecuperadas.push({
      tipo: "norma", id: n.id, titulo: n.titulo_norma,
      referencia: `${n.tipo_norma} ${n.numero_norma || ""}/${n.ano_norma || ""}`.trim(),
      conteudo: n.ementa || n.texto_integral?.substring(0, 3000) || "",
      validada: n.revisada_humanamente,
    }));

    const { data: jurisps } = await supabase.from("qa_jurisprudencias")
      .select("id, tribunal, numero_processo, relator, tema, ementa_resumida, tese_aplicavel, validada_humanamente")
      .textSearch("ementa_resumida", searchTerms, { type: "websearch" }).limit(10);

    jurisps?.forEach((j: any) => fontesRecuperadas.push({
      tipo: "jurisprudencia", id: j.id,
      titulo: `${j.tribunal} - ${j.numero_processo || ""}`,
      referencia: j.tema || "",
      conteudo: `${j.ementa_resumida || ""}\nTese: ${j.tese_aplicavel || ""}`,
      validada: j.validada_humanamente,
    }));

    const { data: docs } = await supabase.from("qa_documentos_conhecimento")
      .select("id, titulo, tipo_documento, resumo_extraido")
      .eq("status_processamento", "concluido")
      .textSearch("resumo_extraido", searchTerms, { type: "websearch" }).limit(5);

    docs?.forEach((d: any) => fontesRecuperadas.push({
      tipo: "documento", id: d.id, titulo: d.titulo,
      referencia: d.tipo_documento,
      conteudo: d.resumo_extraido?.substring(0, 1500) || "",
    }));

    // Filter by user selection if provided
    let fontesParaUsar = fontesRecuperadas;
    if (fontes_selecionadas?.length > 0) {
      fontesParaUsar = fontesRecuperadas.filter(f => fontes_selecionadas.includes(f.id));
      if (fontesParaUsar.length === 0) fontesParaUsar = fontesRecuperadas;
    }

    // Build context
    let contextoFontes = "";
    if (fontesParaUsar.length > 0) {
      contextoFontes = "\n\n--- FONTES PARA FUNDAMENTAÇÃO ---\n";
      fontesParaUsar.forEach((f, i) => {
        contextoFontes += `\n[Fonte ${i + 1} - ${f.tipo.toUpperCase()}] ${f.titulo}\nReferência: ${f.referencia}\nConteúdo completo: ${f.conteudo}\n`;
      });
    } else {
      contextoFontes = "\n\n--- ATENÇÃO: Nenhuma fonte encontrada. NÃO invente. Declare insuficiência. ---\n";
    }

    const profundidadeMap: any = {
      objetiva: "Redija de forma OBJETIVA e CONCISA, focando nos pontos essenciais sem desenvolvimento extenso.",
      intermediaria: "Redija com profundidade INTERMEDIÁRIA, desenvolvendo os argumentos principais com fundamentação adequada.",
      aprofundada: "Redija com profundidade MÁXIMA, desenvolvendo cada argumento exaustivamente com toda a fundamentação disponível.",
    };

    const tomMap: any = {
      tecnico_padrao: "Use tom técnico padrão, sóbrio e profissional.",
      mais_combativo: "Use tom COMBATIVO e assertivo, enfatizando as violações e irregularidades com firmeza argumentativa.",
      mais_conservador: "Use tom CONSERVADOR e moderado, priorizando a prudência argumentativa.",
    };

    const focoMap: any = {
      legalidade: "Foque na LEGALIDADE — conformidade com as normas vigentes.",
      motivacao: "Foque na MOTIVAÇÃO — deficiências na fundamentação do ato impugnado.",
      efetiva_necessidade: "Foque na EFETIVA NECESSIDADE — comprovação da necessidade real.",
      proporcionalidade: "Foque na PROPORCIONALIDADE — adequação e razoabilidade das medidas.",
      erro_material: "Foque no ERRO MATERIAL — incorreções factuais ou procedimentais.",
      controle_judicial: "Foque no CONTROLE JUDICIAL — limites da atuação administrativa.",
    };

    const instrucaoTipo = TIPO_PECA_INSTRUCOES[tipoPecaValido] || "";
    const parametros = `\n\nINSTRUÇÕES ESPECÍFICAS:\n- TIPO: ${tipoPecaValido}\n- ${instrucaoTipo}\n- ${profundidadeMap[profundidade] || profundidadeMap.intermediaria}\n- ${tomMap[tom] || tomMap.tecnico_padrao}\n- ${focoMap[foco] || focoMap.legalidade}`;

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
            content: `TIPO DE PEÇA (OBRIGATÓRIO): ${tipoPecaValido}\nTÍTULO: ${caso_titulo || "Sem título"}${parametros}\n\nDESCRIÇÃO COMPLETA DO CASO:\n${entrada_caso}${contextoFontes}\n\nRedija a peça jurídica do tipo "${tipoPecaValido}" com base EXCLUSIVAMENTE nas fontes acima. Estruture com seções claras. Liste as fontes utilizadas ao final. NÃO altere o tipo da peça.`,
          },
        ],
        max_tokens: 8000,
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsH, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsH, "Content-Type": "application/json" } });
      throw new Error("Erro no gateway de IA");
    }

    const aiData = await aiResp.json();
    const minutaGerada = aiData.choices?.[0]?.message?.content || "";

    const scoreConfianca = fontesParaUsar.length === 0 ? 0 :
      Math.min(1, (fontesParaUsar.length * 0.08) + (fontesParaUsar.filter(f => f.validada).length * 0.12));

    // Save generation
    const { data: geracaoData } = await supabase.from("qa_geracoes_pecas").insert({
      usuario_id,
      titulo_geracao: caso_titulo || "Peça sem título",
      tipo_peca: tipoPecaValido,
      entrada_caso,
      minuta_gerada: minutaGerada,
      normas_utilizadas_json: fontesParaUsar.filter(f => f.tipo === "norma"),
      jurisprudencias_utilizadas_json: fontesParaUsar.filter(f => f.tipo === "jurisprudencia"),
      documentos_referencia_json: fontesParaUsar.filter(f => f.tipo === "documento" || f.tipo === "referencia_aprovada"),
      fundamentos_utilizados_json: fontesParaUsar,
      status: "gerado",
      status_revisao: "rascunho",
      profundidade: profundidade || "intermediaria",
      tom: tom || "tecnico_padrao",
      foco: foco || "legalidade",
      score_confianca: scoreConfianca,
      versao: 1,
    }).select("id").single();

    // Audit
    await supabase.from("qa_logs_auditoria").insert({
      usuario_id,
      entidade: "qa_geracoes_pecas",
      entidade_id: geracaoData?.id || null,
      acao: "gerar_peca",
      detalhes_json: { tipo_peca, profundidade, tom, foco, fontes_count: fontesParaUsar.length, score_confianca: scoreConfianca },
    });

    return new Response(JSON.stringify({
      geracao_id: geracaoData?.id,
      minuta_gerada: minutaGerada,
      fontes_utilizadas: fontesParaUsar,
      score_confianca: scoreConfianca,
    }), { headers: { ...corsH, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("qa-gerar-peca error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});

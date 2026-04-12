import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você atua como assistente de redação jurídica da Quero Armas. Sua função é consultar exclusivamente as fontes disponibilizadas e validadas no sistema, organizar fatos, estruturar argumentos e redigir minutas jurídicas com linguagem técnica, sóbria, profissional e rastreável.

REGRAS ABSOLUTAS:
- É PROIBIDO inventar fatos, leis, artigos, jurisprudência, processos, tribunais, números, datas, fundamentos ou precedentes.
- Quando não houver base suficiente, informe EXPLICITAMENTE a insuficiência de fonte.
- Toda redação deve se apoiar APENAS nas fontes recuperadas ou expressamente cadastradas.
- Sempre indique ao final quais fontes foram efetivamente utilizadas na resposta.
- Use tom jurídico profissional, sóbrio e técnico.
- Nunca trate resposta com segurança quando faltar fonte.
- Se não encontrar jurisprudência na base, diga "Não foram encontradas jurisprudências na base de conhecimento para este tema."
- Se não encontrar legislação na base, diga "Não foram encontradas normas na base de conhecimento para este tema."`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { usuario_id, caso_titulo, entrada_usuario, tipo_peca } = await req.json();
    if (!entrada_usuario) throw new Error("entrada_usuario required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Retrieve relevant sources
    const fontesRecuperadas: any[] = [];

    // Search legislation
    const { data: normas } = await supabase
      .from("qa_fontes_normativas")
      .select("id, titulo_norma, tipo_norma, numero_norma, ano_norma, ementa, texto_integral")
      .eq("ativa", true)
      .textSearch("ementa", entrada_usuario.split(" ").slice(0, 5).join(" & "), { type: "websearch" })
      .limit(5);

    if (normas?.length) {
      normas.forEach((n: any) => fontesRecuperadas.push({
        tipo: "norma",
        id: n.id,
        titulo: n.titulo_norma,
        referencia: `${n.tipo_norma} ${n.numero_norma || ""}/${n.ano_norma || ""}`.trim(),
        conteudo: n.ementa || n.texto_integral?.substring(0, 2000) || "",
      }));
    }

    // Search jurisprudence
    const { data: jurisps } = await supabase
      .from("qa_jurisprudencias")
      .select("id, tribunal, numero_processo, tema, ementa_resumida, tese_aplicavel")
      .textSearch("ementa_resumida", entrada_usuario.split(" ").slice(0, 5).join(" & "), { type: "websearch" })
      .limit(5);

    if (jurisps?.length) {
      jurisps.forEach((j: any) => fontesRecuperadas.push({
        tipo: "jurisprudencia",
        id: j.id,
        titulo: `${j.tribunal} - ${j.numero_processo || ""}`,
        referencia: j.tema || "",
        conteudo: j.ementa_resumida || j.tese_aplicavel || "",
      }));
    }

    // Search knowledge base documents
    const { data: docs } = await supabase
      .from("qa_documentos_conhecimento")
      .select("id, titulo, tipo_documento, resumo_extraido")
      .eq("status_processamento", "concluido")
      .textSearch("resumo_extraido", entrada_usuario.split(" ").slice(0, 5).join(" & "), { type: "websearch" })
      .limit(5);

    if (docs?.length) {
      docs.forEach((d: any) => fontesRecuperadas.push({
        tipo: "documento",
        id: d.id,
        titulo: d.titulo,
        referencia: d.tipo_documento,
        conteudo: d.resumo_extraido?.substring(0, 1000) || "",
      }));
    }

    // If no text search results, try simple ilike fallback
    if (fontesRecuperadas.length === 0) {
      const searchTerm = entrada_usuario.split(" ").slice(0, 3).join(" ");
      
      const { data: normasFallback } = await supabase
        .from("qa_fontes_normativas")
        .select("id, titulo_norma, tipo_norma, numero_norma, ano_norma, ementa")
        .eq("ativa", true)
        .ilike("titulo_norma", `%${searchTerm}%`)
        .limit(3);

      normasFallback?.forEach((n: any) => fontesRecuperadas.push({
        tipo: "norma", id: n.id, titulo: n.titulo_norma,
        referencia: `${n.tipo_norma} ${n.numero_norma || ""}`, conteudo: n.ementa || "",
      }));

      const { data: jurispFallback } = await supabase
        .from("qa_jurisprudencias")
        .select("id, tribunal, numero_processo, tema, ementa_resumida")
        .ilike("tema", `%${searchTerm}%`)
        .limit(3);

      jurispFallback?.forEach((j: any) => fontesRecuperadas.push({
        tipo: "jurisprudencia", id: j.id, titulo: `${j.tribunal} - ${j.numero_processo || ""}`,
        referencia: j.tema || "", conteudo: j.ementa_resumida || "",
      }));
    }

    // 2. Build context for AI
    let contextoFontes = "";
    if (fontesRecuperadas.length > 0) {
      contextoFontes = "\n\n--- FONTES DISPONÍVEIS NA BASE ---\n";
      fontesRecuperadas.forEach((f, i) => {
        contextoFontes += `\n[Fonte ${i + 1} - ${f.tipo.toUpperCase()}] ${f.titulo}\nReferência: ${f.referencia}\nConteúdo: ${f.conteudo}\n`;
      });
    } else {
      contextoFontes = "\n\n--- ATENÇÃO: Nenhuma fonte foi encontrada na base de conhecimento para este caso. ---\n";
    }

    // 3. Call AI
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
            content: `CASO: ${caso_titulo || "Sem título"}\nTIPO DE PEÇA: ${tipo_peca || "não especificado"}\n\nDESCRIÇÃO DO CASO:\n${entrada_usuario}${contextoFontes}\n\nCom base EXCLUSIVAMENTE nas fontes acima (se disponíveis), forneça:\n1. Análise jurídica do caso\n2. Fundamentos legais aplicáveis (apenas os que constam na base)\n3. Jurisprudência relevante (apenas a cadastrada)\n4. Sugestão de estrutura argumentativa\n5. Observações sobre lacunas de fonte`,
          },
        ],
        max_tokens: 4000,
      }),
    });

    const aiData = await aiResp.json();
    const respostaIa = aiData.choices?.[0]?.message?.content || "Não foi possível gerar resposta.";

    // 4. Determine observations
    let observacoesIa = "";
    if (fontesRecuperadas.length === 0) {
      observacoesIa = "Nenhuma fonte foi encontrada na base de conhecimento. A resposta é limitada e deve ser validada manualmente.";
    } else if (fontesRecuperadas.filter(f => f.tipo === "jurisprudencia").length === 0) {
      observacoesIa = "Nenhuma jurisprudência foi encontrada na base. Considere cadastrar precedentes relevantes.";
    }

    // 5. Save consultation
    await supabase.from("qa_consultas_ia").insert({
      usuario_id,
      caso_titulo: caso_titulo || null,
      caso_resumo: entrada_usuario.substring(0, 500),
      tipo_peca: tipo_peca || null,
      entrada_usuario,
      fontes_recuperadas_json: fontesRecuperadas,
      resposta_ia: respostaIa,
      observacoes_ia: observacoesIa || null,
    });

    // 6. Audit log
    await supabase.from("qa_logs_auditoria").insert({
      usuario_id,
      entidade: "qa_consultas_ia",
      acao: "consulta_ia",
      detalhes_json: { tipo_peca, fontes_count: fontesRecuperadas.length },
    });

    return new Response(JSON.stringify({
      resposta_ia: respostaIa,
      fontes_recuperadas: fontesRecuperadas,
      observacoes_ia: observacoesIa,
    }), { headers: { ...corsH, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});

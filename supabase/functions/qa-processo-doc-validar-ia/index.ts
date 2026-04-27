// qa-processo-doc-validar-ia
// Valida um documento enviado usando Lovable AI Gateway (Gemini Vision):
// 1) Baixa o arquivo do bucket privado qa-processo-docs
// 2) Envia ao modelo google/gemini-2.5-flash com prompt estruturado por tipo_documento
// 3) Compara dados extraídos com o cadastro do cliente (qa_clientes)
// 4) Atualiza qa_processo_documentos com extracao_json, divergencias_json e status
//
// Pode ser chamada:
//  - Internamente (header x-internal-call=1 + service-role)
//  - Por staff QA autenticado (re-validação manual)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-call",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TIPO_DOC_PROMPTS: Record<string, string> = {
  cnh_rg:
    "Documento de identidade (RG ou CNH). Extraia: nome_completo, cpf, rg, data_nascimento (YYYY-MM-DD), nome_mae, orgao_emissor, validade (YYYY-MM-DD se CNH).",
  cpf:
    "Comprovante de CPF. Extraia: nome_completo, cpf (apenas dígitos).",
  comprovante_residencia:
    "Comprovante de residência (conta de luz/água/telefone/internet). Extraia: nome_titular, endereco_completo, cep, cidade, uf, data_emissao (YYYY-MM-DD). Verifique se a emissão é nos últimos 90 dias.",
  comprovante_renda:
    "Comprovante de renda (holerite, decore, declaração IR). Extraia: nome_titular, ocupacao, renda_mensal_aproximada, periodo_referencia.",
  certidao_civel:
    "Certidão Cível Federal. Extraia: nome_titular, cpf, resultado (NADA_CONSTA ou CONSTA), data_emissao (YYYY-MM-DD), validade_dias.",
  certidao_criminal_federal:
    "Certidão Criminal Federal. Extraia: nome_titular, cpf, resultado (NADA_CONSTA ou CONSTA), data_emissao (YYYY-MM-DD).",
  certidao_criminal_estadual:
    "Certidão Criminal Estadual. Extraia: nome_titular, cpf, uf, resultado (NADA_CONSTA ou CONSTA), data_emissao (YYYY-MM-DD).",
  certidao_militar:
    "Certidão da Justiça Militar. Extraia: nome_titular, cpf, resultado (NADA_CONSTA ou CONSTA), data_emissao (YYYY-MM-DD).",
  certidao_eleitoral:
    "Certidão da Justiça Eleitoral / Quitação. Extraia: nome_titular, titulo_eleitor, resultado, data_emissao (YYYY-MM-DD).",
  laudo_psicologico:
    "Laudo Psicológico para porte/posse de arma. Extraia: nome_titular, cpf, psicologo_nome, psicologo_crp, resultado (APTO ou INAPTO), data_emissao (YYYY-MM-DD).",
  laudo_capacidade_tecnica:
    "Atestado de Capacidade Técnica de tiro. Extraia: nome_titular, cpf, instrutor_nome, instrutor_credencial, resultado (APTO/INAPTO), data_emissao (YYYY-MM-DD).",
  cr_cac:
    "Certificado de Registro de CAC. Extraia: nome_titular, cpf, numero_cr, categoria (Caçador/Atirador/Colecionador), validade (YYYY-MM-DD).",
  nota_fiscal_arma:
    "Nota fiscal de arma de fogo. Extraia: comprador_nome, comprador_cpf, modelo, calibre, numero_serie, data_emissao (YYYY-MM-DD), valor.",
  guia_trafego:
    "Guia de Tráfego de Arma de Fogo. Extraia: nome_titular, cpf, numero_guia, validade (YYYY-MM-DD).",
};

function buildSystemPrompt(tipoDoc: string, cadastro: any): string {
  const docHint = TIPO_DOC_PROMPTS[tipoDoc] ||
    "Documento administrativo. Extraia todos os campos relevantes (nome_titular, cpf, datas, números identificadores).";

  return `Você é um auditor de documentos para processos de armamento (Polícia Federal / Exército Brasileiro).

TAREFA: Analise a imagem/PDF do documento, identifique se é o tipo esperado ("${tipoDoc}") e extraia os campos estruturados.

Regras:
1. Responda SEMPRE chamando a função "validar_documento".
2. Se o documento NÃO corresponde ao tipo esperado, marque "tipo_correto"=false e "motivo_rejeicao".
3. Se estiver ilegível, marque "legivel"=false.
4. Compare os campos extraídos com o cadastro do cliente abaixo e liste TODAS divergências (nome, CPF, endereço, etc).
5. Datas sempre no formato YYYY-MM-DD.

Tipo esperado: ${tipoDoc}
Detalhes: ${docHint}

Cadastro do cliente (referência):
${JSON.stringify({
  nome: cadastro?.nome,
  cpf: cadastro?.cpf,
  rg: cadastro?.rg,
  data_nascimento: cadastro?.data_nascimento,
  endereco: cadastro?.endereco,
  cidade: cadastro?.cidade,
  uf: cadastro?.uf,
  cep: cadastro?.cep,
}, null, 2)}`;
}

const VALIDAR_TOOL = {
  type: "function",
  function: {
    name: "validar_documento",
    description: "Retorna a validação estruturada do documento.",
    parameters: {
      type: "object",
      properties: {
        tipo_correto: { type: "boolean", description: "O documento corresponde ao tipo esperado?" },
        legivel: { type: "boolean", description: "O documento está legível?" },
        confianca: { type: "number", description: "0.0 a 1.0" },
        campos_extraidos: {
          type: "object",
          description: "Campos extraídos do documento (nome, cpf, datas, etc).",
          additionalProperties: true,
        },
        divergencias: {
          type: "array",
          description: "Lista de divergências entre o documento e o cadastro do cliente.",
          items: {
            type: "object",
            properties: {
              campo: { type: "string" },
              valor_documento: { type: "string" },
              valor_cadastro: { type: "string" },
              severidade: { type: "string", enum: ["baixa", "media", "alta"] },
            },
            required: ["campo", "severidade"],
            additionalProperties: false,
          },
        },
        validade_ok: { type: "boolean", description: "Documento dentro do prazo de validade (quando aplicável)?" },
        motivo_rejeicao: { type: "string", description: "Se houver problema crítico, descreva." },
        observacoes: { type: "string" },
      },
      required: ["tipo_correto", "legivel", "confianca", "campos_extraidos", "divergencias"],
      additionalProperties: false,
    },
  },
};

async function downloadAsBase64(supabase: any, path: string): Promise<{ b64: string; mime: string }> {
  const { data, error } = await supabase.storage.from("qa-processo-docs").download(path);
  if (error || !data) throw new Error("Falha ao baixar arquivo: " + (error?.message || "vazio"));
  const buf = new Uint8Array(await data.arrayBuffer());
  // base64 chunked
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
  }
  const b64 = btoa(bin);
  const mime = data.type || "application/octet-stream";
  return { b64, mime };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    // Auth: chamada interna OU staff
    const internal = req.headers.get("x-internal-call") === "1";
    if (!internal) {
      const guard = await (await import("../_shared/qaAuth.ts")).requireQAStaff(req);
      if (!guard.ok) return guard.response;
    }

    const { processo_id, documento_id, storage_path } = await req.json();
    if (!processo_id || !documento_id) {
      return json({ error: "processo_id e documento_id obrigatórios" }, 400);
    }

    const supabase = createClient(url, service);

    // Carrega documento e processo+cliente
    const { data: doc, error: docErr } = await supabase
      .from("qa_processo_documentos")
      .select("*")
      .eq("id", documento_id)
      .maybeSingle();
    if (docErr || !doc) return json({ error: "Documento não encontrado" }, 404);

    const path = storage_path || doc.arquivo_storage_key;
    if (!path) return json({ error: "storage_path ausente" }, 400);

    const { data: processo } = await supabase
      .from("qa_processos")
      .select("id, cliente_id, servico_id")
      .eq("id", processo_id)
      .maybeSingle();
    if (!processo) return json({ error: "Processo não encontrado" }, 404);

    const { data: cliente } = await supabase
      .from("qa_clientes")
      .select("id, nome, cpf, rg, data_nascimento, endereco, cidade, uf, cep")
      .eq("id", processo.cliente_id)
      .maybeSingle();

    // Marca como em_analise
    await supabase.from("qa_processo_documentos")
      .update({ status: "em_analise", validacao_ia_status: "processando" })
      .eq("id", documento_id);

    // Download → base64 (Gemini aceita inline image OU PDF)
    const { b64, mime } = await downloadAsBase64(supabase, path);

    const systemPrompt = buildSystemPrompt(doc.tipo_documento, cliente);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analise este documento e chame validar_documento." },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${b64}` },
              },
            ],
          },
        ],
        tools: [VALIDAR_TOOL],
        tool_choice: { type: "function", function: { name: "validar_documento" } },
      }),
    });

    if (!aiResp.ok) {
      const errBody = await aiResp.text();
      const status = aiResp.status === 429 ? 429 : aiResp.status === 402 ? 402 : 500;
      const msg = aiResp.status === 429
        ? "IA temporariamente indisponível (rate limit)"
        : aiResp.status === 402
          ? "Créditos da IA esgotados"
          : `Erro IA: ${errBody}`;
      await supabase.from("qa_processo_documentos")
        .update({ validacao_ia_status: "erro", validacao_ia_erro: msg, status: "enviado" })
        .eq("id", documento_id);
      return json({ error: msg }, status);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      await supabase.from("qa_processo_documentos")
        .update({ validacao_ia_status: "erro", validacao_ia_erro: "IA não retornou tool_call", status: "enviado" })
        .eq("id", documento_id);
      return json({ error: "IA não retornou validação estruturada" }, 500);
    }

    let parsed: any;
    try { parsed = JSON.parse(args); } catch (e) {
      return json({ error: "Falha ao parsear resposta IA" }, 500);
    }

    // Decide status final (alinhado ao check constraint:
    // 'pendente','enviado','em_analise','aprovado','invalido','divergente','revisao_humana')
    let novoStatus: string;
    let motivoRejeicao: string | null = null;

    if (!parsed.tipo_correto) {
      novoStatus = "invalido";
      motivoRejeicao = parsed.motivo_rejeicao || "Documento não corresponde ao tipo esperado.";
    } else if (!parsed.legivel) {
      novoStatus = "invalido";
      motivoRejeicao = "Documento ilegível. Por favor, envie uma foto/scan mais nítido.";
    } else {
      const divergenciasAltas = (parsed.divergencias || []).filter(
        (d: any) => d.severidade === "alta",
      );
      if (divergenciasAltas.length > 0) {
        novoStatus = "divergente";
        motivoRejeicao = "Divergências críticas detectadas: " +
          divergenciasAltas.map((d: any) => d.campo).join(", ");
      } else if ((parsed.divergencias || []).length > 0 || (parsed.confianca ?? 0) < 0.6) {
        novoStatus = "revisao_humana";
      } else {
        novoStatus = "aprovado";
      }
    }

    await supabase.from("qa_processo_documentos")
      .update({
        status: novoStatus,
        motivo_rejeicao: motivoRejeicao,
        dados_extraidos_json: parsed.campos_extraidos || {},
        divergencias_json: parsed.divergencias || [],
        validacao_ia_status: "concluido",
        validacao_ia_erro: null,
        validacao_ia_confianca: parsed.confianca ?? null,
        data_validacao: new Date().toISOString(),
      })
      .eq("id", documento_id);

    // Evento de auditoria
    await supabase.from("qa_processo_eventos").insert({
      processo_id,
      documento_id,
      tipo_evento: "validacao_ia",
      descricao: `IA: ${doc.nome_documento} → ${novoStatus}`,
      dados_json: {
        confianca: parsed.confianca,
        divergencias: parsed.divergencias?.length || 0,
        tipo_correto: parsed.tipo_correto,
        legivel: parsed.legivel,
      },
      ator: "ia",
    });

    // Notifica o cliente (não bloqueia o fluxo em caso de falha SMTP)
    const eventoEmail =
      novoStatus === "aprovado" ? "documento_aprovado" :
      novoStatus === "divergente" ? "documento_divergente" :
      novoStatus === "invalido" ? "documento_invalido" :
      novoStatus === "revisao_humana" ? "revisao_humana" : null;
    if (eventoEmail) {
      try {
        await supabase.functions.invoke("qa-processo-notificar", {
          body: { processo_id, documento_id, evento: eventoEmail, motivo: motivoRejeicao ?? undefined },
        });
      } catch (e) {
        console.warn("[validar-ia] notificação falhou:", e);
      }
    }

    return json({
      success: true,
      status: novoStatus,
      motivo_rejeicao: motivoRejeicao,
      validacao: parsed,
    });
  } catch (err: any) {
    console.error("qa-processo-doc-validar-ia:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});
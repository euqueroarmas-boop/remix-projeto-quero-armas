// Edge Function: qa-classificar-documento-arma
//
// Classifica automaticamente um documento enviado no Arsenal e o compara
// com o tipo escolhido manualmente pelo cliente.
//
// Tipos suportados:
//   CRAF · GT · GTE · GUIA_TRANSITO · NOTA_FISCAL · EXAME_LAUDO · DESCONHECIDO
//
// Entrada (POST JSON):
//   { imageDataUrl: string, tipoSelecionado: string }
//   ou
//   { storage_bucket: string, storage_path: string, tipoSelecionado: string }
//
// Saída:
//   {
//     tipoDetectado, confianca (0..1), camposExtraidos, justificativa,
//     divergenciaComSelecaoManual, recomendacao: "aceitar"|"confirmar"|"revisao_obrigatoria",
//     revisao_obrigatoria: boolean
//   }
//
// Diretrizes:
//  - service_role no servidor; valida JWT do chamador.
//  - Não escreve em tabelas (decisão de salvar fica com o caller).
//  - Modelo: google/gemini-3-flash-preview.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TIPOS = [
  "CRAF",
  "GT",
  "GTE",
  "GUIA_TRANSITO",
  "NOTA_FISCAL",
  "EXAME_LAUDO",
  "DESCONHECIDO",
] as const;
type Tipo = typeof TIPOS[number];

const tool = {
  type: "function",
  function: {
    name: "classificar_documento_arma",
    description:
      "Classifica um documento de cliente CAC/atirador relacionado a armas: CRAF, GT (Guia de Tráfego), GTE (Guia de Tráfego Especial), Guia de Trânsito SINARM/PF, Nota Fiscal, Exame/Laudo, ou Desconhecido.",
    parameters: {
      type: "object",
      properties: {
        tipoDetectado: {
          type: "string",
          enum: TIPOS as unknown as string[],
          description:
            "Tipo identificado. CRAF=Certificado de Registro de Arma de Fogo (PF/Exército). GT=Guia de Tráfego (retirada na loja, transporte inicial). GTE=Guia de Tráfego Especial (Exército, acervo SIGMA/CAC, validade prolongada). GUIA_TRANSITO=Guia de Trânsito SINARM/PF (autorização de movimentação). NOTA_FISCAL=NF-e/DANFE de arma ou munição. EXAME_LAUDO=laudo psicológico/técnico/aptidão. DESCONHECIDO=baixa confiança.",
        },
        confianca: {
          type: "number",
          description: "Confiança 0.0 a 1.0 do tipo detectado.",
        },
        justificativa: {
          type: "string",
          description:
            "Texto curto explicando os indícios encontrados (cabeçalho, órgão, campos, expressões).",
        },
        camposExtraidos: {
          type: "object",
          description: "Campos extraídos relevantes ao tipo detectado.",
          properties: {
            numero_documento: { type: "string" },
            orgao_emissor: { type: "string" },
            data_emissao: { type: "string", description: "DD/MM/AAAA" },
            data_validade: { type: "string", description: "DD/MM/AAAA" },
            arma_marca: { type: "string" },
            arma_modelo: { type: "string" },
            arma_calibre: { type: "string" },
            arma_numero_serie: { type: "string" },
            sigma_ou_sinarm: { type: "string" },
            origem: { type: "string" },
            destino: { type: "string" },
            emitente: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      required: ["tipoDetectado", "confianca", "justificativa"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = [
  "Você é especialista em documentos brasileiros de armas de fogo (Polícia Federal, Exército, SINARM, SIGMA, CAC).",
  "Sua tarefa é identificar o TIPO do documento enviado e extrair os campos principais.",
  "Sinais por tipo:",
  "• CRAF: 'Certificado de Registro de Arma de Fogo', número do CRAF, dados da arma (marca/modelo/série/calibre), SIGMA ou SINARM, validade.",
  "• GT: 'Guia de Tráfego' (retirada da loja / transporte inicial), origem=loja/vendedor, destino=residência/clube, validade curta.",
  "• GTE: 'Guia de Tráfego Especial', Exército, acervo CAC/SIGMA, lista de armas, clubes/locais autorizados, validade prolongada.",
  "• GUIA_TRANSITO: 'Guia de Trânsito' SINARM/Polícia Federal — autorização de transporte/movimentação, origem/destino, validade.",
  "• NOTA_FISCAL: NF-e/DANFE, chave de acesso de 44 dígitos, emitente, produto arma/munição.",
  "• EXAME_LAUDO: laudo psicológico, capacidade técnica, aptidão; profissional/instrutor/psicólogo.",
  "• DESCONHECIDO: quando não houver evidências fortes — use confianca < 0.5.",
  "Responda EXCLUSIVAMENTE chamando a função classificar_documento_arma. Datas em DD/MM/AAAA. Campos não identificados ficam vazios.",
].join("\n");

function normalizeTipoSelecionado(t: string | undefined | null): Tipo | null {
  if (!t) return null;
  const x = String(t).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (x === "CRAF") return "CRAF";
  if (x === "GT" || x === "GUIA_DE_TRAFEGO" || x === "GUIA_TRAFEGO") return "GT";
  if (x === "GTE" || x === "GUIA_DE_TRAFEGO_ESPECIAL" || x === "GUIA_TRAFEGO_ESPECIAL") return "GTE";
  if (x.includes("TRANSITO") || x.includes("TRÂNSITO") || x === "GUIA_TRANSITO") return "GUIA_TRANSITO";
  if (x.includes("NOTA") || x === "NF" || x === "NFE" || x === "DANFE" || x === "NOTA_FISCAL")
    return "NOTA_FISCAL";
  if (x.includes("EXAME") || x.includes("LAUDO") || x === "EXAME_LAUDO") return "EXAME_LAUDO";
  if (x.includes("AUTORIZ")) return null; // autorização de compra: não está no escopo desta classificação
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    let imageDataUrl: string | undefined = body?.imageDataUrl;
    const tipoSelecionado: string | undefined = body?.tipoSelecionado;
    const storage_bucket: string | undefined = body?.storage_bucket;
    const storage_path: string | undefined = body?.storage_path;

    if (!imageDataUrl && storage_path) {
      const bucket = storage_bucket || "qa-documentos";
      const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(storage_path);
      if (dlErr || !blob) return json({ error: "Arquivo não localizado no storage" }, 404);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const b64 = btoa(bin);
      const mime = blob.type || "application/pdf";
      imageDataUrl = `data:${mime};base64,${b64}`;
    }

    if (!imageDataUrl) {
      return json({ error: "imageDataUrl ou storage_path obrigatório" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const aiResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Classifique o documento abaixo e devolva o tipo + confiança + campos extraídos. " +
                  (tipoSelecionado
                    ? `O cliente selecionou manualmente o tipo "${tipoSelecionado}". Avalie de forma INDEPENDENTE.`
                    : "Sem sugestão manual."),
              },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "classificar_documento_arma" } },
      }),
    });

    if (aiResp.status === 429) return json({ error: "Rate limit. Tente novamente em instantes." }, 429);
    if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("[classificar] gateway:", aiResp.status, t);
      return json({ error: "Falha na IA" }, 500);
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return json({ error: "IA não devolveu classificação" }, 500);
    }
    let parsed: any = {};
    try { parsed = JSON.parse(call.function.arguments); } catch (e) {
      return json({ error: "Resposta da IA inválida" }, 500);
    }

    const tipoDetectado = (TIPOS as readonly string[]).includes(parsed.tipoDetectado)
      ? (parsed.tipoDetectado as Tipo)
      : "DESCONHECIDO";
    const confianca = typeof parsed.confianca === "number"
      ? Math.max(0, Math.min(1, parsed.confianca))
      : 0;
    const camposExtraidos = parsed.camposExtraidos && typeof parsed.camposExtraidos === "object"
      ? parsed.camposExtraidos
      : {};
    const justificativa = String(parsed.justificativa || "").slice(0, 500);

    const tipoNorm = normalizeTipoSelecionado(tipoSelecionado);
    const divergencia = !!tipoNorm && tipoDetectado !== "DESCONHECIDO" && tipoNorm !== tipoDetectado;

    // Recomendação:
    //  >= 0.80 e sem divergência → aceitar
    //  0.50–0.79 ou (>=0.80 com divergência) → confirmar (cliente confirma na tela)
    //  < 0.50 ou DESCONHECIDO → revisao_obrigatoria
    let recomendacao: "aceitar" | "confirmar" | "revisao_obrigatoria";
    if (tipoDetectado === "DESCONHECIDO" || confianca < 0.5) {
      recomendacao = "revisao_obrigatoria";
    } else if (confianca >= 0.8 && !divergencia) {
      recomendacao = "aceitar";
    } else {
      recomendacao = "confirmar";
    }

    return json({
      tipoDetectado,
      confianca,
      camposExtraidos,
      justificativa,
      divergenciaComSelecaoManual: divergencia,
      tipoSelecionadoNormalizado: tipoNorm,
      recomendacao,
      revisao_obrigatoria: recomendacao === "revisao_obrigatoria",
    });
  } catch (err) {
    console.error("[qa-classificar-documento-arma]", err);
    return json({ error: (err as any)?.message || "Erro interno" }, 500);
  }
});

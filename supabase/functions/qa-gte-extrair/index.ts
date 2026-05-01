// Edge Function: qa-gte-extrair
// Lê uma GTE (Guia de Tráfego Especial) já enviada para o storage
// (qa-documentos), chama o Lovable AI Gateway (Gemini Vision) para
// extrair TODOS os dados estruturados do documento — armas, endereços,
// clubes, datas, órgão emissor — e atualiza qa_gte_documentos.
//
// IMPORTANTE: opera com service_role (verify_jwt=false em config),
// portanto valida o JWT em código e checa que o requisitante é dono do
// cadastro (cliente_id) ou staff ativo.

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
const MODEL = "google/gemini-2.5-flash";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const tool = {
  type: "function",
  function: {
    name: "extrair_gte",
    description:
      "Extrai TODOS os dados estruturados de uma Guia de Tráfego Especial (GTE) emitida pelo Exército Brasileiro.",
    parameters: {
      type: "object",
      properties: {
        numero_gte: { type: "string", description: "Número/identificador da GTE." },
        orgao_emissor: { type: "string", description: "Órgão emissor (Exército, R-MIL, etc)." },
        requerente_nome: { type: "string", description: "Nome completo do requerente / titular." },
        requerente_cpf: { type: "string", description: "CPF do requerente, somente dígitos ou com máscara." },
        data_emissao: { type: "string", description: "Data de emissão DD/MM/AAAA." },
        data_validade: { type: "string", description: "Data de validade DD/MM/AAAA." },
        endereco_origem: { type: "string", description: "Endereço completo de origem (residência, etc)." },
        endereco_destino: { type: "string", description: "Endereço completo de destino (clube, estande, etc)." },
        armas: {
          type: "array",
          description: "Lista COMPLETA das armas autorizadas na GTE.",
          items: {
            type: "object",
            properties: {
              marca: { type: "string" },
              modelo: { type: "string", description: "Modelo COMERCIAL (ex: G25, TS9). Nunca número." },
              calibre: { type: "string" },
              especie: { type: "string", description: "Pistola, Revólver, Carabina, Espingarda, Fuzil." },
              numero_serie: { type: "string" },
              numero_sigma: { type: "string", description: "Número SIGMA / SINARM se constar." },
            },
          },
        },
        enderecos: {
          type: "array",
          description: "TODOS os endereços citados na GTE (origem, destino, intermediários).",
          items: {
            type: "object",
            properties: {
              tipo: { type: "string", description: "origem, destino, residencia, clube, estande, outro." },
              endereco: { type: "string", description: "Endereço completo como aparece no documento." },
            },
          },
        },
        clubes: {
          type: "array",
          description: "Clubes de tiro mencionados (nome, CNPJ, endereço se disponível).",
          items: {
            type: "object",
            properties: {
              nome: { type: "string" },
              cnpj: { type: "string" },
              endereco: { type: "string" },
            },
          },
        },
        observacoes: { type: "string", description: "Observações relevantes do documento." },
      },
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT =
  "Você é especialista em documentos do Exército Brasileiro. Extraia TODOS os dados estruturados de uma Guia de " +
  "Tráfego Especial (GTE). Liste TODAS as armas autorizadas (não resuma), TODOS os endereços citados " +
  "(origem, destino, residência, clube), e TODOS os clubes mencionados. Datas no formato DD/MM/AAAA. " +
  "Use null/vazio para campos não localizados. Responda exclusivamente chamando a função extrair_gte. " +
  "REGRA CRÍTICA: o campo modelo nunca pode conter número de série/SIGMA — esses têm campos próprios.";

function ddmmaaaaToISO(s?: string | null): string | null {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

async function callVision(dataUrl: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia todos os dados desta Guia de Tráfego Especial." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "extrair_gte" } },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    if (resp.status === 429) throw new Error("Limite de requisições excedido. Tente novamente em segundos.");
    if (resp.status === 402) throw new Error("Sem créditos disponíveis no Lovable AI.");
    throw new Error(`AI gateway error ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) return {};
  try { return JSON.parse(call.function.arguments); } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check (verify_jwt=false → valida em código)
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthenticated" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const gteDocumentoId = String(body?.gte_documento_id || "");
    if (!gteDocumentoId) return json({ error: "gte_documento_id requerido" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const { data: doc, error: docErr } = await admin
      .from("qa_gte_documentos")
      .select("id, cliente_id, storage_path, status_processamento")
      .eq("id", gteDocumentoId)
      .maybeSingle();
    if (docErr || !doc) return json({ error: "GTE não encontrada" }, 404);

    // Autorização: cliente dono OU staff ativo
    const [{ data: isStaff }, { data: ownerClienteId }] = await Promise.all([
      admin.rpc("qa_is_active_staff", { _user_id: userId }) as any,
      admin.rpc("qa_current_cliente_id", { _user_id: userId }) as any,
    ]);
    const allowed = isStaff === true || Number(ownerClienteId) === Number(doc.cliente_id);
    if (!allowed) return json({ error: "forbidden" }, 403);

    // Marcar como processando
    await admin.from("qa_gte_documentos").update({ status_processamento: "processando", erro_mensagem: null })
      .eq("id", gteDocumentoId);

    // Baixa o arquivo
    const { data: fileBlob, error: dlErr } = await admin.storage.from("qa-documentos").download(doc.storage_path);
    if (dlErr || !fileBlob) {
      await admin.from("qa_gte_documentos").update({
        status_processamento: "erro",
        erro_mensagem: dlErr?.message || "falha ao baixar arquivo",
      }).eq("id", gteDocumentoId);
      return json({ error: "falha ao baixar arquivo do storage" }, 500);
    }

    const arrBuf = await fileBlob.arrayBuffer();
    const bytes = new Uint8Array(arrBuf);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const base64 = btoa(bin);
    const mime = (fileBlob as any).type || "application/pdf";
    const dataUrl = `data:${mime};base64,${base64}`;

    let raw: any = {};
    try {
      raw = await callVision(dataUrl);
    } catch (aiErr) {
      const msg = aiErr instanceof Error ? aiErr.message : "erro IA";
      await admin.from("qa_gte_documentos").update({
        status_processamento: "erro",
        erro_mensagem: msg,
      }).eq("id", gteDocumentoId);
      return json({ error: msg }, 500);
    }

    const armas = Array.isArray(raw?.armas) ? raw.armas : [];
    const enderecos = Array.isArray(raw?.enderecos) ? raw.enderecos : [];
    const clubes = Array.isArray(raw?.clubes) ? raw.clubes : [];

    const updates = {
      numero_gte: raw?.numero_gte || null,
      orgao_emissor: raw?.orgao_emissor || null,
      requerente_nome: raw?.requerente_nome || null,
      requerente_cpf: raw?.requerente_cpf || null,
      data_emissao: ddmmaaaaToISO(raw?.data_emissao),
      data_validade: ddmmaaaaToISO(raw?.data_validade),
      endereco_origem: raw?.endereco_origem || null,
      endereco_destino: raw?.endereco_destino || null,
      armas_total: armas.length,
      enderecos_total: enderecos.length,
      armas_json: armas,
      enderecos_json: enderecos,
      clubes_json: clubes,
      observacoes_ia: raw?.observacoes || null,
      dados_extraidos_json: raw || {},
      status_processamento: "concluido",
      erro_mensagem: null,
      processado_em: new Date().toISOString(),
    };

    const { error: upErr } = await admin.from("qa_gte_documentos").update(updates).eq("id", gteDocumentoId);
    if (upErr) {
      await admin.from("qa_gte_documentos").update({
        status_processamento: "erro",
        erro_mensagem: upErr.message,
      }).eq("id", gteDocumentoId);
      return json({ error: upErr.message }, 500);
    }

    return json({ ok: true, gte_documento_id: gteDocumentoId, dados: updates });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro inesperado";
    console.error("[qa-gte-extrair]", msg);
    return json({ error: msg }, 500);
  }
});
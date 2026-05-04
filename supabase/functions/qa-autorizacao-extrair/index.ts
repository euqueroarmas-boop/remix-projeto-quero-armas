// Edge Function: qa-autorizacao-extrair
// Lê uma Autorização de Compra (Polícia Federal / Exército) já enviada
// para o bucket `qa-documentos`, chama o Lovable AI Gateway (Gemini Vision)
// para extrair dados estruturados e atualiza qa_documentos_cliente.
//
// Reutiliza o mesmo padrão de qa-craf-extrair (auth, RPC de permissão,
// service_role para escrita).

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
    name: "extrair_autorizacao",
    description:
      "Extrai TODOS os dados estruturados de uma Autorização de Compra de arma de fogo emitida pela Polícia Federal ou Exército.",
    parameters: {
      type: "object",
      properties: {
        numero_autorizacao: { type: "string", description: "Número da autorização." },
        data_emissao: { type: "string", description: "Data de emissão DD/MM/AAAA." },
        data_validade: { type: "string", description: "Data de validade DD/MM/AAAA." },
        orgao_emissor: { type: "string", description: "Órgão emissor (Polícia Federal, Exército)." },
        finalidade: { type: "string", description: "Finalidade declarada (defesa pessoal, caça, tiro desportivo, colecionador)." },
        especie: { type: "string", description: "Espécie autorizada (pistola, revólver, carabina, espingarda, etc.)." },
        marca: { type: "string", description: "Marca da arma autorizada, se constar." },
        modelo: {
          type: "string",
          description:
            "Modelo COMERCIAL específico, se constar (ex: G2C, TS9, 838). Termos genéricos NÃO contam.",
        },
        calibre: { type: "string", description: "Calibre nominal autorizado (ex: 9mm, .380)." },
        quantidade: { type: "string", description: "Quantidade autorizada (ex: 1, 2)." },
        numero_serie: { type: "string", description: "Número de série, se já constar." },
      },
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT =
  "Você é especialista em documentos da Polícia Federal e do Exército Brasileiro. " +
  "Extraia TODOS os dados estruturados de uma AUTORIZAÇÃO DE COMPRA de arma de fogo. " +
  "Datas DD/MM/AAAA. Vazio se não localizar. Responda exclusivamente chamando extrair_autorizacao.";

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
            { type: "text", text: "Extraia todos os dados desta autorização de compra." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "extrair_autorizacao" } },
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
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthenticated" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const docId = String(body?.documento_id || "");
    if (!docId) return json({ error: "documento_id requerido" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const { data: doc, error: docErr } = await admin
      .from("qa_documentos_cliente")
      .select("id, qa_cliente_id, arquivo_storage_path, arquivo_mime, tipo_documento")
      .eq("id", docId)
      .maybeSingle();
    if (docErr || !doc) return json({ error: "documento não encontrado" }, 404);
    if (!doc.arquivo_storage_path) return json({ error: "documento sem arquivo no storage" }, 400);

    const [{ data: isStaff }, { data: ownerClienteId }] = await Promise.all([
      admin.rpc("qa_is_active_staff", { _user_id: userId }) as any,
      admin.rpc("qa_current_cliente_id", { _user_id: userId }) as any,
    ]);
    const allowed = isStaff === true || Number(ownerClienteId) === Number(doc.qa_cliente_id);
    if (!allowed) return json({ error: "forbidden" }, 403);

    await admin.from("qa_documentos_cliente").update({ ia_status: "processando" }).eq("id", docId);

    const { data: fileBlob, error: dlErr } = await admin.storage
      .from("qa-documentos").download(doc.arquivo_storage_path);
    if (dlErr || !fileBlob) {
      await admin.from("qa_documentos_cliente").update({
        ia_status: "erro",
        ia_dados_extraidos: { erro: dlErr?.message || "falha ao baixar arquivo" },
      }).eq("id", docId);
      return json({ error: "falha ao baixar arquivo do storage" }, 500);
    }

    const arrBuf = await fileBlob.arrayBuffer();
    const bytes = new Uint8Array(arrBuf);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const base64 = btoa(bin);
    const mime = doc.arquivo_mime || (fileBlob as any).type || "application/pdf";
    const dataUrl = `data:${mime};base64,${base64}`;

    let raw: any = {};
    try {
      raw = await callVision(dataUrl);
    } catch (aiErr) {
      const msg = aiErr instanceof Error ? aiErr.message : "erro IA";
      await admin.from("qa_documentos_cliente").update({
        ia_status: "erro",
        ia_dados_extraidos: { erro: msg },
        ia_processado_em: new Date().toISOString(),
      }).eq("id", docId);
      return json({ error: msg }, 500);
    }

    const ia_dados = {
      numero_autorizacao: raw?.numero_autorizacao || null,
      data_emissao: raw?.data_emissao || null,
      data_validade: raw?.data_validade || null,
      orgao_emissor: raw?.orgao_emissor || null,
      finalidade: raw?.finalidade || null,
      especie: raw?.especie || null,
      marca: raw?.marca || null,
      modelo: raw?.modelo || null,
      calibre: raw?.calibre || null,
      quantidade: raw?.quantidade || null,
      numero_serie: raw?.numero_serie || null,
    };

    const updates = {
      numero_documento: raw?.numero_autorizacao || null,
      data_emissao: ddmmaaaaToISO(raw?.data_emissao),
      data_validade: ddmmaaaaToISO(raw?.data_validade),
      orgao_emissor: raw?.orgao_emissor || null,
      arma_marca: raw?.marca || null,
      arma_modelo: raw?.modelo || null,
      arma_calibre: raw?.calibre || null,
      arma_numero_serie: raw?.numero_serie || null,
      arma_especie: raw?.especie || null,
      ia_dados_extraidos: ia_dados,
      ia_status: "pendente_revisao",
      ia_processado_em: new Date().toISOString(),
    };

    const { error: upErr } = await admin.from("qa_documentos_cliente").update(updates).eq("id", docId);
    if (upErr) {
      await admin.from("qa_documentos_cliente").update({
        ia_status: "erro",
        ia_dados_extraidos: { ...ia_dados, erro: upErr.message },
      }).eq("id", docId);
      return json({ error: upErr.message }, 500);
    }

    return json({ ok: true, documento_id: docId, dados: ia_dados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro inesperado";
    console.error("[qa-autorizacao-extrair]", msg);
    return json({ error: msg }, 500);
  }
});
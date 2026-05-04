// Edge Function: qa-craf-extrair
// Lê um CRAF (Certificado de Registro de Arma de Fogo) já enviado para o
// bucket `qa-documentos`, chama o Lovable AI Gateway (Gemini Vision) para
// extrair dados estruturados (número, validade, órgão, marca, modelo,
// calibre, número de série, SIGMA/SINARM) e atualiza
// `qa_documentos_cliente.ia_dados_extraidos` + colunas mapeadas.
//
// IMPORTANTE: opera com service_role (verify_jwt=false em config),
// portanto valida o JWT em código e checa que o requisitante é dono do
// cadastro (qa_cliente_id) ou staff ativo.
//
// REGRA DE NEGÓCIO: se a IA não identificar um modelo válido, marca
// `modelo_invalido=true` em ia_dados_extraidos e mantém ia_status como
// `pendente_revisao` para que a Equipe Quero Armas / cliente preencha
// manualmente antes de vincular à arma da Bancada Tática.

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
    name: "extrair_craf",
    description:
      "Extrai TODOS os dados estruturados de um CRAF (Certificado de Registro de Arma de Fogo).",
    parameters: {
      type: "object",
      properties: {
        numero_craf: { type: "string", description: "Número do CRAF / certificado." },
        data_emissao: { type: "string", description: "Data de emissão DD/MM/AAAA." },
        data_validade: { type: "string", description: "Data de validade DD/MM/AAAA." },
        orgao_emissor: { type: "string", description: "Órgão emissor (PF, Exército, etc)." },
        numero_serie: { type: "string", description: "Número de série da arma." },
        sigma_ou_sinarm: { type: "string", description: "Número SIGMA ou SINARM se constar." },
        marca: { type: "string", description: "Marca da arma (ex: Taurus, Glock, CBC)." },
        modelo: {
          type: "string",
          description:
            "Modelo COMERCIAL específico (ex: G2C, TS9, 838). NUNCA preencher com termos genéricos como 'arma', 'pistola', 'revólver', 'N/A' — se não identificar, deixar vazio.",
        },
        calibre: { type: "string", description: "Calibre nominal (ex: 9mm, .380, .38 SPL)." },
      },
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT =
  "Você é especialista em documentos da Polícia Federal e do Exército Brasileiro. Extraia TODOS os " +
  "dados estruturados de um CRAF (Certificado de Registro de Arma de Fogo). Datas no formato DD/MM/AAAA. " +
  "Use vazio para campos não localizados. Responda exclusivamente chamando a função extrair_craf. " +
  "REGRA CRÍTICA: o campo modelo deve ser o modelo comercial específico (ex: G2C, TS9, 838); NUNCA " +
  "termos genéricos como 'arma', 'pistola', 'revólver', 'N/A'. Se não identificar com certeza, deixe vazio.";

const MODELO_INVALIDOS = new Set([
  "", "arma", "pistola", "revolver", "revólver", "n/a", "na",
  "nao informado", "não informado", "carabina", "espingarda", "fuzil",
]);

function isModeloInvalido(m: unknown): boolean {
  if (!m || typeof m !== "string") return true;
  const norm = m.trim().toLowerCase().replace(/\s+/g, " ");
  if (norm.length < 2) return true;
  return MODELO_INVALIDOS.has(norm);
}

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
            { type: "text", text: "Extraia todos os dados deste CRAF." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "extrair_craf" } },
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

    const modeloInvalido = isModeloInvalido(raw?.modelo);
    const ia_dados = {
      numero_craf: raw?.numero_craf || null,
      data_emissao: raw?.data_emissao || null,
      data_validade: raw?.data_validade || null,
      orgao_emissor: raw?.orgao_emissor || null,
      numero_serie: raw?.numero_serie || null,
      sigma_ou_sinarm: raw?.sigma_ou_sinarm || null,
      marca: raw?.marca || null,
      modelo: raw?.modelo || null,
      calibre: raw?.calibre || null,
      modelo_invalido: modeloInvalido,
    };

    const updates = {
      numero_documento: raw?.numero_craf || null,
      data_emissao: ddmmaaaaToISO(raw?.data_emissao),
      data_validade: ddmmaaaaToISO(raw?.data_validade),
      orgao_emissor: raw?.orgao_emissor || null,
      arma_marca: raw?.marca || null,
      arma_modelo: modeloInvalido ? null : raw?.modelo,
      arma_calibre: raw?.calibre || null,
      arma_numero_serie: raw?.numero_serie || null,
      ia_dados_extraidos: ia_dados,
      ia_status: modeloInvalido ? "pendente_revisao" : "concluido",
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

    return json({ ok: true, documento_id: docId, modelo_invalido: modeloInvalido, dados: ia_dados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro inesperado";
    console.error("[qa-craf-extrair]", msg);
    return json({ error: msg }, 500);
  }
});
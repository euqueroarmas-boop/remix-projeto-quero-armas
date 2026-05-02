// ============================================================================
// qa-extract-doc-dates
// ----------------------------------------------------------------------------
// Extrai DATAS RELEVANTES de um documento enviado pelo cliente:
//   - data_emissao        (qualquer documento)
//   - proxima_leitura     (somente contas de consumo: energia, água, gás)
//   - validade_legal_dias (sugestão da IA, NÃO sobrescreve a tabela)
//
// Disparada AUTOMATICAMENTE pelo cliente após cada upload (waituntil) e
// também pode ser chamada pelo admin para reprocessar.
//
// Salva em qa_processo_documentos:
//   data_emissao, proxima_leitura, extracao_ia_status, extracao_ia_json
//
// O trigger SQL qa_proc_docs_recalc_prazos cuida de recalcular
// data_validade_efetiva e prazo_critico_data do processo automaticamente.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `Você é um extrator de DATAS de documentos brasileiros usados em processos da Polícia Federal (CR / SINARM).

Sua única tarefa é extrair três valores do documento que receber em imagem/PDF:

1. data_emissao  : data em que o documento foi EMITIDO/GERADO. Em contas de consumo (luz, água, gás, telefone, internet),
                   é a data de EMISSÃO da fatura, NUNCA a data de vencimento. Em certidões, é a data de expedição.
                   Em laudos, é a data de assinatura do profissional.

2. proxima_leitura : SOMENTE para contas de consumo (energia, água, gás). É a "próxima leitura" prevista impressa
                     na conta. Se o documento não for conta de consumo, retorne null.

3. tipo_detectado  : uma das opções: comprovante_endereco | conta_consumo | certidao_estadual | certidao_federal |
                     laudo_psicologico | laudo_capacidade_tecnica | declaracao | rg | cnh | contrato | outro.

Devolva SOMENTE um JSON válido neste formato (datas em ISO YYYY-MM-DD), nunca explicações:

{ "data_emissao": "YYYY-MM-DD" | null,
  "proxima_leitura": "YYYY-MM-DD" | null,
  "tipo_detectado": "...",
  "confianca": 0.0-1.0,
  "observacao": "string curta opcional" }

Se não conseguir identificar uma das datas, retorne null para ela. NÃO invente datas.`;

async function callGemini(fileUrl: string, mimeType: string): Promise<any> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Extraia as datas conforme instrução do system. Responda apenas com JSON." },
          { type: "image_url", image_url: { url: fileUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (resp.status === 429) throw new Error("Limite de requisições à IA atingido. Tente novamente em alguns instantes.");
  if (resp.status === 402) throw new Error("Créditos da IA esgotados.");
  if (!resp.ok) throw new Error(`AI gateway erro ${resp.status}: ${await resp.text()}`);

  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("IA não retornou conteúdo");

  try {
    return JSON.parse(content);
  } catch {
    // Tenta extrair JSON de markdown
    const m = content.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("IA retornou JSON inválido");
  }
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${v}T12:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) Auth: aceita cliente (dono do processo) OU staff QA.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7).trim();

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authUserId = userData.user.id;

    const { documento_id } = await req.json();
    if (!documento_id) {
      return new Response(JSON.stringify({ error: "documento_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: doc } = await admin
      .from("qa_processo_documentos")
      .select("id, processo_id, tipo_documento, arquivo_storage_key, validade_dias")
      .eq("id", documento_id)
      .maybeSingle();
    if (!doc) {
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!doc.arquivo_storage_key) {
      return new Response(JSON.stringify({ error: "Documento sem arquivo enviado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Autorização: dono OU staff
    const { data: processo } = await admin
      .from("qa_processos").select("id, cliente_id").eq("id", doc.processo_id).maybeSingle();
    const { data: cliente } = await admin
      .from("qa_clientes").select("id, user_id").eq("id", processo?.cliente_id).maybeSingle();

    const isOwner = cliente?.user_id === authUserId;
    let isStaff = false;
    if (!isOwner) {
      const { data: perfilRow } = await admin
        .from("qa_usuarios_perfis").select("ativo").eq("user_id", authUserId).eq("ativo", true).maybeSingle();
      isStaff = !!perfilRow;
    }
    if (!isOwner && !isStaff) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Marca como em processamento (mesmo se falhar IA depois, fica visível)
    await admin.from("qa_processo_documentos")
      .update({ extracao_ia_status: "pendente" })
      .eq("id", documento_id);

    // 4) Gera signed URL temporária do storage para a IA acessar.
    const { data: signed, error: sErr } = await admin.storage
      .from("qa-processo-docs")
      .createSignedUrl(doc.arquivo_storage_key, 300);
    if (sErr || !signed?.signedUrl) {
      throw new Error("Não foi possível obter URL do arquivo: " + (sErr?.message || ""));
    }

    // 5) Chama Gemini.
    let parsed: any;
    try {
      parsed = await callGemini(signed.signedUrl, "application/octet-stream");
    } catch (aiErr: any) {
      console.error("[qa-extract-doc-dates] IA falhou:", aiErr);
      await admin.from("qa_processo_documentos")
        .update({
          extracao_ia_status: "erro",
          extracao_ia_json: { erro: String(aiErr?.message || aiErr) },
        }).eq("id", documento_id);
      return new Response(JSON.stringify({ error: aiErr?.message || "IA falhou" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataEmissao    = isoOrNull(parsed?.data_emissao);
    const proximaLeitura = isoOrNull(parsed?.proxima_leitura);

    // 6) Salva — o trigger SQL recalcula data_validade_efetiva e prazo_critico_data.
    const update: Record<string, any> = {
      extracao_ia_status: "extraido",
      extracao_ia_json: parsed,
    };
    if (dataEmissao !== null)    update.data_emissao = dataEmissao;
    if (proximaLeitura !== null) update.proxima_leitura = proximaLeitura;

    const { error: upErr } = await admin
      .from("qa_processo_documentos")
      .update(update)
      .eq("id", documento_id);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({
      ok: true,
      data_emissao: dataEmissao,
      proxima_leitura: proximaLeitura,
      tipo_detectado: parsed?.tipo_detectado || null,
      confianca: parsed?.confianca || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("[qa-extract-doc-dates] erro:", err);
    return new Response(JSON.stringify({ error: err?.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
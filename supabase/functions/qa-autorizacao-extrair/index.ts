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
        // ── Seção 1 do formulário SisGCorp: o ADQUIRENTE ──
        adquirente_nome: { type: "string", description: "Nome completo do adquirente (seção 1)." },
        adquirente_cpf: { type: "string", description: "CPF do adquirente, apenas dígitos." },
        adquirente_cr: { type: "string", description: "Número do CR do adquirente (seção 1)." },
        adquirente_endereco: { type: "string", description: "Endereço do adquirente como impresso." },
        acervo_utilizado: { type: "string", description: "Seção 2 — acervo utilizado (ex.: Tiro Desportivo - Atirador Desportivo)." },
        // ── Seção 4: o FORNECEDOR (a loja) ──
        fornecedor_razao_social: { type: "string", description: "Razão social do fornecedor (seção 4)." },
        fornecedor_cnpj: { type: "string", description: "CNPJ do fornecedor, quando o emissor é a Polícia Federal." },
        fornecedor_registro_sigma: { type: "string", description: "Nº de Registro SIGMA do fornecedor, quando o emissor é o Exército." },
        fornecedor_endereco: { type: "string", description: "Endereço do fornecedor como impresso." },
      },
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT =
  "Você é especialista em documentos da Polícia Federal e do Exército Brasileiro. " +
  "Extraia TODOS os dados estruturados de uma AUTORIZAÇÃO DE COMPRA de arma de fogo. " +
  "O formulário do SisGCorp ('AUTORIZAÇÃO PARA AQUISIÇÃO DE PCE NO COMÉRCIO NACIONAL') tem " +
  "5 seções: 1-IDENTIFICAÇÃO DO ADQUIRENTE (nome, CR, CPF, endereço), 2-DO ACERVO UTILIZADO, " +
  "3-PRODUTOS CONTROLADOS (produto, marca, modelo, calibre, quantidade), 4-FORNECEDOR " +
  "(a Polícia Federal identifica a loja por CNPJ; o Exército por Nº Registro SIGMA) e " +
  "5-DECLARAÇÃO. CUIDADO: o CPF do ADQUIRENTE está na seção 1 sob o rótulo 'CPF/CNPJ'; o " +
  "CNPJ do FORNECEDOR está na seção 4 — não troque um pelo outro. " +
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
      admin.rpc("qa_is_active_staff", { _uid: userId }) as any,
      admin.rpc("qa_current_cliente_id", { _uid: userId }) as any,
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

    // ── Conferência: a autorização é MESMO deste cliente? ───────────────────
    // Nos três dossiês deferidos usados como gabarito, o formulário traz nome,
    // CPF e nº do CR do adquirente na seção 1. Comparamos com o cadastro; CPF
    // divergente é o sinal clássico de autorização anexada na pasta errada.
    // A conferência NÃO bloqueia nada sozinha: ela acende `revisao_necessaria`,
    // que o Arsenal já exibe como alerta, e registra o detalhe campo a campo.
    const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
    const normNome = (v: unknown) =>
      String(v ?? "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();

    let conferencia: Record<string, string> = {};
    let temDivergencia = false;
    try {
      const [{ data: cli }, { data: cadCr }] = await Promise.all([
        admin.from("qa_clientes").select("nome_completo, cpf").eq("id", doc.qa_cliente_id).maybeSingle(),
        admin.from("qa_cadastro_cr").select("numero_cr").eq("cliente_id", doc.qa_cliente_id)
             .order("id", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const compara = (docVal: string, cadVal: string): string =>
        !docVal ? "sem_dado_no_documento" : !cadVal ? "sem_dado_no_cadastro"
        : docVal === cadVal ? "confere" : "divergente";
      conferencia = {
        cpf:  compara(soDigitos(raw?.adquirente_cpf), soDigitos(cli?.cpf)),
        nome: compara(normNome(raw?.adquirente_nome), normNome(cli?.nome_completo)),
        cr:   compara(soDigitos(raw?.adquirente_cr), soDigitos(cadCr?.numero_cr)),
      };
      temDivergencia = Object.values(conferencia).includes("divergente");
    } catch (confErr) {
      // Falha na conferência nunca derruba a extração — fica registrado o porquê.
      conferencia = { erro: confErr instanceof Error ? confErr.message : "falha na conferência" };
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
      adquirente_nome: raw?.adquirente_nome || null,
      adquirente_cpf: soDigitos(raw?.adquirente_cpf) || null,
      adquirente_cr: soDigitos(raw?.adquirente_cr) || null,
      adquirente_endereco: raw?.adquirente_endereco || null,
      acervo_utilizado: raw?.acervo_utilizado || null,
      fornecedor_razao_social: raw?.fornecedor_razao_social || null,
      fornecedor_cnpj: soDigitos(raw?.fornecedor_cnpj) || null,
      fornecedor_registro_sigma: soDigitos(raw?.fornecedor_registro_sigma) || null,
      fornecedor_endereco: raw?.fornecedor_endereco || null,
      conferencia,
      ...(temDivergencia ? { revisao_necessaria: true } : {}),
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
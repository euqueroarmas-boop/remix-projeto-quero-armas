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
  "CR",
  "CRAF",
  "SINARM",
  "GT",
  "GTE",
  "GUIA_TRANSITO",
  "AUTORIZACAO_COMPRA",
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
            "Tipo identificado. CR=Certificado de Registro CAC (Exército, sem arma específica). CRAF=Certificado de Registro de Arma de Fogo (Exército/SIGMA, vinculado a uma arma). SINARM=Registro/Posse/Porte da Polícia Federal (SINARM, vinculado a uma arma civil). GT=Guia de Tráfego (retirada na loja, transporte inicial). GTE=Guia de Tráfego Especial (Exército, acervo SIGMA/CAC, validade prolongada). GUIA_TRANSITO=Guia de Trânsito SINARM/PF (autorização de movimentação). AUTORIZACAO_COMPRA=Autorização de Compra de arma/munição emitida pelo Exército ou PF. NOTA_FISCAL=NF-e/DANFE de arma ou munição. EXAME_LAUDO=laudo psicológico/técnico/aptidão. DESCONHECIDO=baixa confiança ou ilegível.",
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
            arma_modelo: {
              type: "string",
              description: "Modelo comercial somente se estiver escrito explicitamente no documento. NÃO preencher com TIPO/espécie (PISTOLA, REVÓLVER, CARABINA etc.), NÃO deduzir por número de série, calibre, marca ou catálogo. Se não houver modelo explícito, devolver vazio.",
            },
            arma_especie: {
              type: "string",
              description: "Tipo/espécie da arma quando existir no documento (ex.: PISTOLA, REVÓLVER, CARABINA). Este campo é separado de arma_modelo.",
            },
            arma_calibre: { type: "string" },
            arma_numero_serie: { type: "string" },
            sigma_ou_sinarm: { type: "string" },
            numero_cad_sinarm: {
              type: "string",
              description: "OBRIGATÓRIO quando o documento contiver o rótulo 'Nº Cad. SINARM' (ou variações 'Nº Cadastro SINARM', 'No. Cad. SINARM', 'Nº CAD SINARM', 'Cadastro SINARM nº'). Copie o conteúdo EXATO ao lado do rótulo, preservando a barra e o hífen (ex.: 2022/905178870-50). NUNCA confunda com 'Nº do Registro', 'Nº da Arma' ou 'Nº de Série'. Vazio APENAS se o rótulo realmente não existir no documento.",
            },
            numero_registro_sigma: {
              type: "string",
              description: "Número de registro SIGMA APENAS quando o documento for do Exército/SIGMA/CAC com indicação explícita. Vazio se for SINARM ou se houver dúvida.",
            },
            sistema_registro: {
              type: "string",
              enum: ["SINARM", "SIGMA", "REVISAR"],
              description: "Regime canônico. SINARM se houver 'Nº Cad. SINARM' ou indicação explícita de Polícia Federal/SINARM. SIGMA somente com indicação explícita de Exército/SIGMA/CAC. REVISAR caso contrário.",
            },
            origem: { type: "string" },
            destino: { type: "string" },
            emitente: { type: "string" },
            nf_chave_acesso: { type: "string", description: "44 dígitos da NF-e" },
            nf_produto: { type: "string" },
            nf_calibre: { type: "string" },
            nf_quantidade: { type: "string" },
            nf_lote: { type: "string" },
            nf_valor: { type: "string" },
            nf_destinatario_documento: { type: "string", description: "CPF/CNPJ destinatário" },
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
  "Sua tarefa é identificar o TIPO do documento enviado e extrair fielmente os campos principais.",
  "Sinais por tipo:",
  "• CR: 'Certificado de Registro' de CAC (Exército), número do CR, sem vínculo a uma arma específica, validade longa.",
  "• CRAF: 'Certificado de Registro de Arma de Fogo', número do CRAF, dados da arma (marca/modelo/série/calibre), SIGMA ou SINARM, validade.",
  "• SINARM: registro/posse/porte da Polícia Federal, número SINARM, dados da arma civil.",
  "• GT: 'Guia de Tráfego' (retirada da loja / transporte inicial), origem=loja/vendedor, destino=residência/clube, validade curta.",
  "• GTE: 'Guia de Tráfego Especial', Exército, acervo CAC/SIGMA, lista de armas, clubes/locais autorizados, validade prolongada.",
  "• GUIA_TRANSITO: 'Guia de Trânsito' SINARM/Polícia Federal — autorização de transporte/movimentação, origem/destino, validade.",
  "• AUTORIZACAO_COMPRA: 'Autorização de Compra' (AC) de arma ou munição, emitida pelo Exército ou PF, com prazo para execução.",
  "• NOTA_FISCAL: NF-e/DANFE, chave de acesso de 44 dígitos, emitente, produto arma/munição.",
  "• EXAME_LAUDO: laudo psicológico, capacidade técnica, aptidão; profissional/instrutor/psicólogo.",
  "• DESCONHECIDO: quando não houver evidências fortes — use confianca < 0.5.",
  "REGRA DE OURO — EXTRAÇÃO FIEL:",
  "• Extraia EXATAMENTE como está escrito no documento. NÃO troque letras por números nem números por letras.",
  "• NÃO transforme 'O' em '0', 'I' em '1', 'S' em '5', 'B' em '8' sem ter certeza visual absoluta.",
  "• NÃO invente, NÃO complete por dedução, NÃO normalize números de série/SIGMA/SINARM/CPF/CNPJ/calibre/validade.",
  "• CAMPO MODELO: só preencha arma_modelo quando o modelo comercial estiver escrito explicitamente no documento. Nunca deduza por nº de série, marca, calibre, catálogo ou parser. TIPO/espécie ('PISTOLA', 'REVÓLVER', 'CARABINA', etc.) NÃO é modelo; nesses casos deixe arma_modelo vazio e use arma_especie se aplicável.",
  "• Se um caractere estiver ilegível, deixe o campo INTEIRO vazio (não substitua por '?', '_' ou aproximação).",
  "• Datas em DD/MM/AAAA exatamente como aparecem (se faltar dia, mês ou ano, deixe vazio).",
  "• Em caso de dúvida, prefira deixar vazio a inventar.",
  "REGRA SINARM × SIGMA (CRÍTICA):",
  "• PROCURE ATIVAMENTE o rótulo 'Nº Cad. SINARM' (também aceito: 'Nº Cadastro SINARM', 'No. Cad. SINARM', 'Nº CAD SINARM', 'Cadastro SINARM nº'). Esse rótulo é o IDENTIFICADOR PRINCIPAL de um CRAF SINARM e quase sempre aparece próximo do cabeçalho 'Departamento de Polícia Federal / SINARM'.",
  "• Se encontrar esse rótulo, é OBRIGATÓRIO preencher numero_cad_sinarm com o valor EXATO (formato típico AAAA/NNNNNNNNN-DD, ex.: 2022/905178870-50, preservando barra e hífen) e marcar sistema_registro = 'SINARM'. NUNCA copie esse valor para numero_registro_sigma nem para numero_documento.",
  "• 'Nº do Registro' é um campo DIFERENTE e GENÉRICO (existe em CRAFs SINARM e SIGMA). Seu valor (ex.: 906786939) vai SEMPRE em numero_documento — NUNCA em numero_cad_sinarm e NUNCA em numero_registro_sigma sem evidência explícita.",
  "• 'Nº da Arma' / 'Nº de Série' vai em arma_numero_serie (ex.: KWD4861871). NUNCA em numero_cad_sinarm.",
  "• Só preencha numero_registro_sigma quando o documento mencionar EXPLICITAMENTE Exército/SIGMA/CAC. Caso contrário deixe vazio.",
  "• Se houver 'Nº Cad. SINARM' OU menção a 'SINARM'/'Polícia Federal' no cabeçalho/órgão emissor → sistema_registro = 'SINARM'.",
  "• Se houver menção explícita a Exército/SIGMA/CAC e NÃO houver 'Nº Cad. SINARM' → sistema_registro = 'SIGMA'.",
  "• Caso contrário → sistema_registro = 'REVISAR'.",
  "EXEMPLO CONCRETO de CRAF SINARM:",
  "  Documento mostra: 'Departamento de Polícia Federal — SINARM', 'Nº Cad. SINARM: 2022/905178870-50', 'Nº do Registro: 906786939', 'Nº da Arma: KWD4861871', 'Calibre: 12', 'Validade: 01/07/2030'.",
  "  Resposta correta: tipoDetectado='CRAF', sistema_registro='SINARM', numero_cad_sinarm='2022/905178870-50', numero_documento='906786939', numero_registro_sigma='', arma_numero_serie='KWD4861871', arma_calibre='12', data_validade='01/07/2030'.",
  "REGRA CRAF SIGMA (CRÍTICA — TABELA INFERIOR):",
  "• Identificadores de CRAF SIGMA: 'Ministério da Defesa', 'Exército Brasileiro', 'Certificado de Registro de Arma de Fogo', 'SFPC', 'SisFPC', 'Nº SIGMA' e/ou 'SFPC de vinculação'. Nesses casos sistema_registro = 'SIGMA' e numero_cad_sinarm DEVE ficar vazio.",
  "• A parte inferior do CRAF SIGMA é uma TABELA. Os cabeçalhos típicos são, em duas linhas: ['REGISTRO','TIPO','MARCA'] e ['CALIBRE','Nº SÉRIE','Nº SIGMA'], seguidos por 'DATA DE EXPEDIÇÃO'. É OBRIGATÓRIO mapear cada célula da tabela ao campo correspondente, alinhando por coluna (mesma posição horizontal do cabeçalho), não por ordem de leitura linear.",
  "• Mapeamento OBRIGATÓRIO da tabela CRAF SIGMA:",
  "  - Coluna REGISTRO → numero_documento (ex.: 'ADT ELET SISFPC NR 219 DE 19/09/2022, CMDO 12ª BDA INF L (AMV)'). Copie o texto INTEIRO da célula, incluindo vírgulas e siglas.",
  "  - Coluna TIPO → arma_especie (ex.: 'PISTOLA'). NUNCA preencher arma_modelo com TIPO. Se não houver coluna/campo MODELO explícito, deixe arma_modelo vazio.",
  "  - Coluna MARCA → arma_marca (ex.: 'FORJAS TAURUS').",
  "  - Coluna CALIBRE → arma_calibre (ex.: '22 Long Rifle', '.40', '9mm'). Preserve grafia original.",
  "  - Coluna Nº SÉRIE → arma_numero_serie (ex.: '1PT397656'). Letras maiúsculas e dígitos exatos.",
  "  - Coluna Nº SIGMA → numero_registro_sigma (ex.: '2093581'). NUNCA copie esse valor para numero_documento nem para numero_cad_sinarm.",
  "  - DATA DE EXPEDIÇÃO → data_emissao (DD/MM/AAAA).",
  "• Validade: procure o rótulo 'Validade' no cabeçalho do CRAF SIGMA (ex.: 'Validade: 19/09/2032') e preencha data_validade.",
  "• Proprietário/CPF/SFPC: 'SFPC de vinculação' (ex.: 'Cmdo 2ª RM') vai em orgao_emissor. Não invente modelos de arma — se a tabela só trouxer TIPO (ex.: 'PISTOLA') e não houver coluna MODELO, deixe arma_modelo vazio.",
  "EXEMPLO CONCRETO de CRAF SIGMA:",
  "  Documento mostra: 'Ministério da Defesa — Exército Brasileiro — Certificado de Registro de Arma de Fogo', 'Validade: 19/09/2032', 'Proprietário: Willian Rodrigues da Silva', 'CPF: 37799538899', 'SFPC de vinculação: Cmdo 2ª RM', tabela com 'REGISTRO=ADT ELET SISFPC NR 219 DE 19/09/2022, CMDO 12ª BDA INF L (AMV)', 'TIPO=PISTOLA', 'MARCA=FORJAS TAURUS', 'CALIBRE=22 Long Rifle', 'Nº SÉRIE=1PT397656', 'Nº SIGMA=2093581', 'DATA DE EXPEDIÇÃO=19/09/2022'.",
  "  Resposta correta: tipoDetectado='CRAF', sistema_registro='SIGMA', numero_cad_sinarm='', numero_registro_sigma='2093581', numero_documento='ADT ELET SISFPC NR 219 DE 19/09/2022, CMDO 12ª BDA INF L (AMV)', arma_especie='PISTOLA', arma_marca='FORJAS TAURUS', arma_modelo='', arma_calibre='22 Long Rifle', arma_numero_serie='1PT397656', data_emissao='19/09/2022', data_validade='19/09/2032', orgao_emissor='Cmdo 2ª RM'.",
  "Responda EXCLUSIVAMENTE chamando a função classificar_documento_arma.",
].join("\n");

function normalizeTipoSelecionado(t: string | undefined | null): Tipo | null {
  if (!t) return null;
  const x = String(t).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (x === "CR") return "CR";
  if (x === "CRAF") return "CRAF";
  if (x === "SINARM" || x.includes("POSSE") || x.includes("PORTE")) return "SINARM";
  if (x === "GT" || x === "GUIA_DE_TRAFEGO" || x === "GUIA_TRAFEGO") return "GT";
  if (x === "GTE" || x === "GUIA_DE_TRAFEGO_ESPECIAL" || x === "GUIA_TRAFEGO_ESPECIAL") return "GTE";
  if (x.includes("TRANSITO") || x.includes("TRÂNSITO") || x === "GUIA_TRANSITO") return "GUIA_TRANSITO";
  if (x.includes("NOTA") || x === "NF" || x === "NFE" || x === "DANFE" || x === "NOTA_FISCAL")
    return "NOTA_FISCAL";
  if (x.includes("EXAME") || x.includes("LAUDO") || x === "EXAME_LAUDO") return "EXAME_LAUDO";
  if (x.includes("AUTORIZ") || x === "AC") return "AUTORIZACAO_COMPRA";
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

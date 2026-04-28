// qa-processo-doc-validar-ia
// Regras endurecidas:
//  - Threshold confiança: >=0.90 aprova / 0.70-0.89 revisao_humana / <0.70 invalido
//  - QUALQUER divergência (independente de severidade) -> divergente
//  - Documento ilegível, tipo errado, sem campos exigidos, sem dados objetivos -> invalido
//  - Validade vencida (data_emissao + validade_dias < hoje) -> invalido
//  - "esperado" da regra_validacao não bate (ex.: resultado != NADA_CONSTA / APTO) -> invalido
//  - NUNCA aprova por presunção.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-call",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const APROVA_AUTO_MIN = 0.90;
const REVISAO_HUMANA_MIN = 0.70;

const TIPO_DOC_PROMPTS: Record<string, string> = {
  rg: "RG. Extraia: nome_completo, rg, data_nascimento (YYYY-MM-DD), nome_mae, orgao_emissor, uf.",
  cnh: "CNH. Extraia: nome_completo, cpf, rg, data_nascimento (YYYY-MM-DD), validade (YYYY-MM-DD), categoria.",
  cpf: "Comprovante de CPF. Extraia: nome_completo, cpf (apenas dígitos).",
  comprovante_residencia: "Conta de luz/água/telefone/internet. Extraia: nome_titular, endereco_completo, cep, cidade, uf, data_emissao (YYYY-MM-DD).",
  comprovante_renda: "Holerite/decore/IR. Extraia: nome_titular, ocupacao, renda_mensal_aproximada, periodo_referencia, data_emissao (YYYY-MM-DD).",
  renda_holerite_mes_atual: "Holerite mais recente. Extraia OBRIGATORIAMENTE: nome_titular, cpf (se houver), empregador, periodo_referencia (mes/ano no formato YYYY-MM), mes_referencia (YYYY-MM), data_emissao (YYYY-MM-DD se houver).",
  certidao_civel: "Certidão Cível Federal. Extraia: nome_titular, cpf, resultado (NADA_CONSTA ou CONSTA), data_emissao (YYYY-MM-DD).",
  certidao_criminal_federal: "Criminal Federal. Extraia: nome_titular, cpf, resultado, data_emissao.",
  certidao_criminal_estadual: "Criminal Estadual. Extraia: nome_titular, cpf, uf, resultado, data_emissao.",
  certidao_militar: "Justiça Militar. Extraia: nome_titular, cpf, resultado, data_emissao.",
  certidao_eleitoral: "Quitação Eleitoral. Extraia: nome_titular, titulo_eleitor, resultado, data_emissao.",
  laudo_psicologico: "Laudo Psicológico. Extraia: nome_titular, cpf, psicologo_nome, psicologo_crp, resultado (APTO/INAPTO), data_emissao.",
  laudo_capacidade_tecnica: "Capacidade Técnica de tiro. Extraia: nome_titular, cpf, instrutor_nome, instrutor_credencial, resultado (APTO/INAPTO), data_emissao.",
  cr_cac: "Certificado de Registro CAC. Extraia: nome_titular, cpf, numero_cr, categoria, validade (YYYY-MM-DD).",
  nota_fiscal_arma: "Nota fiscal de arma. Extraia: comprador_nome, comprador_cpf, modelo, calibre, numero_serie, data_emissao, valor.",
  guia_trafego: "Guia de Tráfego. Extraia: nome_titular, cpf, numero_guia, validade (YYYY-MM-DD).",
  justificativa_porte: "Justificativa fundamentada. Extraia: texto integral (resumo curto), assinatura, data.",
};

function buildSystemPrompt(tipoDoc: string, cadastro: any): string {
  const docHint = TIPO_DOC_PROMPTS[tipoDoc] ||
    "Documento administrativo. Extraia nome_titular, cpf, datas, números identificadores.";
  return `Você é um auditor RIGOROSO de documentos para Polícia Federal / Exército Brasileiro.
TAREFA: Valide a imagem/PDF e responda SEMPRE chamando "validar_documento".
REGRAS CRÍTICAS:
1. Se o documento NÃO corresponde ao tipo "${tipoDoc}", marque tipo_correto=false.
2. Se ilegível, marque legivel=false.
3. Se faltar QUALQUER campo crítico, deixe em branco no campos_extraidos e cite em motivo_rejeicao.
4. Compare CADA campo com o cadastro abaixo. QUALQUER diferença textual relevante (nome, CPF, RG, data nascimento, endereço, CEP) é divergência.
5. NUNCA assuma campos não vistos. Se incerto, baixe a confiança.
6. Datas YYYY-MM-DD.
Tipo esperado: ${tipoDoc}
Detalhes: ${docHint}
Cadastro do cliente:
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
    description: "Validação estruturada do documento.",
    parameters: {
      type: "object",
      properties: {
        tipo_correto: { type: "boolean" },
        legivel: { type: "boolean" },
        confianca: { type: "number" },
        campos_extraidos: { type: "object", additionalProperties: true },
        divergencias: {
          type: "array",
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
        motivo_rejeicao: { type: "string" },
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
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
  }
  return { b64: btoa(bin), mime: data.type || "application/octet-stream" };
}

function checaCamposExigidos(extraidos: Record<string, any>, exige: string[] = []): string[] {
  const faltando: string[] = [];
  for (const k of exige) {
    const v = extraidos?.[k];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) faltando.push(k);
  }
  return faltando;
}

function checaEsperado(extraidos: Record<string, any>, esperado: Record<string, any> = {}): string[] {
  const violacoes: string[] = [];
  for (const [k, vEsp] of Object.entries(esperado)) {
    const v = String(extraidos?.[k] ?? "").toUpperCase();
    if (v !== String(vEsp).toUpperCase()) violacoes.push(`${k} esperado ${vEsp}, encontrado ${v || "vazio"}`);
  }
  return violacoes;
}

function isVencido(dataEmissao: string | undefined, validadeDias: number | null | undefined): boolean {
  if (!dataEmissao || !validadeDias) return false;
  const d = new Date(dataEmissao);
  if (isNaN(d.getTime())) return false;
  const limite = new Date(d.getTime() + validadeDias * 86400000);
  return limite < new Date();
}

// Holerite: precisa corresponder ao mês atual ou mês imediatamente anterior.
// Aceita "periodo_referencia" ou "mes_referencia" no formato YYYY-MM, "MM/YYYY" ou nomes.
const MESES_PT: Record<string, number> = {
  "janeiro":1,"fevereiro":2,"marco":3,"março":3,"abril":4,"maio":5,"junho":6,
  "julho":7,"agosto":8,"setembro":9,"outubro":10,"novembro":11,"dezembro":12,
};
function parseMesAno(raw: any): { y: number; m: number } | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/(\d{4})[-\/](\d{1,2})/))) return { y: +m[1], m: +m[2] };
  if ((m = s.match(/(\d{1,2})[-\/](\d{4})/))) return { y: +m[2], m: +m[1] };
  for (const [nome, idx] of Object.entries(MESES_PT)) {
    if (s.includes(nome)) {
      const ya = s.match(/(\d{4})/);
      if (ya) return { y: +ya[1], m: idx };
    }
  }
  return null;
}
function holeriteForaDoPeriodo(extraidos: Record<string, any>): boolean {
  const ref = parseMesAno(extraidos?.mes_referencia)
           ?? parseMesAno(extraidos?.periodo_referencia)
           ?? parseMesAno(extraidos?.data_emissao);
  if (!ref) return true; // não conseguimos identificar o mês -> trata como inválido
  const now = new Date();
  const cy = now.getFullYear(), cm = now.getMonth() + 1;
  // aceita: mês atual ou mês anterior
  const monthsDiff = (cy - ref.y) * 12 + (cm - ref.m);
  return monthsDiff < 0 || monthsDiff > 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const internal = req.headers.get("x-internal-call") === "1";
    if (!internal) {
      const guard = await (await import("../_shared/qaAuth.ts")).requireQAStaff(req);
      if (!guard.ok) return guard.response;
    }

    const { processo_id, documento_id, storage_path } = await req.json();
    if (!processo_id || !documento_id) return json({ error: "processo_id e documento_id obrigatórios" }, 400);

    const supabase = createClient(url, service);

    const { data: doc } = await supabase
      .from("qa_processo_documentos")
      .select("*")
      .eq("id", documento_id)
      .maybeSingle();
    if (!doc) return json({ error: "Documento não encontrado" }, 404);

    const path = storage_path || doc.arquivo_storage_key;
    if (!path) return json({ error: "storage_path ausente" }, 400);

    const { data: processo } = await supabase
      .from("qa_processos").select("id, cliente_id, servico_id").eq("id", processo_id).maybeSingle();
    if (!processo) return json({ error: "Processo não encontrado" }, 404);

    const { data: cliente } = await supabase
      .from("qa_clientes")
      .select("id, nome, cpf, rg, data_nascimento, endereco, cidade, uf, cep")
      .eq("id", processo.cliente_id).maybeSingle();

    await supabase.from("qa_processo_documentos")
      .update({ status: "em_analise", validacao_ia_status: "processando" })
      .eq("id", documento_id);

    const { b64, mime } = await downloadAsBase64(supabase, path);
    const systemPrompt = buildSystemPrompt(doc.tipo_documento, cliente);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "text", text: "Analise este documento e chame validar_documento." },
            { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
          ]},
        ],
        tools: [VALIDAR_TOOL],
        tool_choice: { type: "function", function: { name: "validar_documento" } },
      }),
    });

    if (!aiResp.ok) {
      const errBody = await aiResp.text();
      const status = aiResp.status === 429 ? 429 : aiResp.status === 402 ? 402 : 500;
      const msg = aiResp.status === 429 ? "IA temporariamente indisponível (rate limit)"
                : aiResp.status === 402 ? "Créditos da IA esgotados"
                : `Erro IA: ${errBody}`;
      // Em falha de IA: marcar para revisão humana, NUNCA aprovar
      await supabase.from("qa_processo_documentos")
        .update({ validacao_ia_status: "erro", validacao_ia_erro: msg, status: "revisao_humana" })
        .eq("id", documento_id);
      return json({ error: msg }, status);
    }

    const aiJson = await aiResp.json();
    const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      await supabase.from("qa_processo_documentos")
        .update({ validacao_ia_status: "erro", validacao_ia_erro: "IA não retornou tool_call", status: "revisao_humana" })
        .eq("id", documento_id);
      return json({ error: "IA não retornou validação estruturada" }, 500);
    }

    let parsed: any;
    try { parsed = JSON.parse(args); }
    catch { return json({ error: "Falha ao parsear resposta IA" }, 500); }

    // ===== Reconciliação de "divergências falsas" =====
    // Se a IA marcou algo como divergência mas o cadastro do cliente está vazio
    // (campo não pôde ser comparado), NÃO é divergência: é um dado novo extraído.
    // Move para campos_extraidos e remove da lista de divergências.
    {
      const camposIA: Record<string, any> = parsed.campos_extraidos || {};
      const divsIn: any[] = Array.isArray(parsed.divergencias) ? parsed.divergencias : [];
      const divsKeep: any[] = [];
      for (const d of divsIn) {
        const _cv = d?.valor_cadastro;
        const cadVazio =
          _cv == null ||
          (typeof _cv === "string" &&
            ["", "none", "null", "undefined", "n/a", "na", "-"].includes(_cv.trim().toLowerCase()));
        const docVal = d?.valor_documento;
        const temDocVal =
          docVal != null && !(typeof docVal === "string" && docVal.trim() === "");
        if (cadVazio && temDocVal) {
          // promove para campo extraído (sem sobrescrever campo já presente)
          if (camposIA[d.campo] == null || (typeof camposIA[d.campo] === "string" && camposIA[d.campo].trim() === "")) {
            camposIA[d.campo] = docVal;
          }
          continue; // descarta a divergência falsa
        }
        divsKeep.push(d);
      }
      parsed.campos_extraidos = camposIA;
      parsed.divergencias = divsKeep;
    }

    // ========== LÓGICA DE DECISÃO ENDURECIDA ==========
    const regra = (doc.regra_validacao ?? {}) as any;
    const exige: string[] = Array.isArray(regra.exige) ? regra.exige : [];
    const esperado: Record<string, any> = regra.esperado || {};
    const camposFaltando = checaCamposExigidos(parsed.campos_extraidos || {}, exige);
    const esperadoViolado = checaEsperado(parsed.campos_extraidos || {}, esperado);
    const dataEmissao = parsed.campos_extraidos?.data_emissao || parsed.campos_extraidos?.validade;
    const vencido = isVencido(dataEmissao, doc.validade_dias);
    const divergencias = parsed.divergencias || [];
    const conf = parsed.confianca ?? 0;
    let novoStatus: string;
    let motivoRejeicao: string | null = null;

    if (!parsed.tipo_correto) {
      novoStatus = "invalido";
      motivoRejeicao = parsed.motivo_rejeicao || "Documento não corresponde ao tipo esperado.";
    } else if (!parsed.legivel) {
      novoStatus = "invalido";
      motivoRejeicao = "Documento ilegível. Envie um arquivo mais nítido.";
    } else if (camposFaltando.length > 0) {
      novoStatus = "invalido";
      motivoRejeicao = "Campos obrigatórios não identificados: " + camposFaltando.join(", ");
    } else if (esperadoViolado.length > 0) {
      novoStatus = "invalido";
      motivoRejeicao = "Conteúdo esperado não confirmado: " + esperadoViolado.join("; ");
    } else if (
      doc.tipo_documento === "renda_holerite_mes_atual" &&
      holeriteForaDoPeriodo(parsed.campos_extraidos || {})
    ) {
      novoStatus = "invalido";
      motivoRejeicao = "O holerite enviado não corresponde ao período atual ou mais recente aceitável.";
    } else if (vencido) {
      novoStatus = "invalido";
      motivoRejeicao = `Documento fora do prazo de validade (${doc.validade_dias} dias).`;
    } else if (divergencias.length > 0) {
      // QUALQUER divergência (não só "alta") trava o avanço e exige decisão do cliente
      novoStatus = "divergente";
      motivoRejeicao = "Divergência entre o documento e seu cadastro: " +
        divergencias.map((d: any) => d.campo).join(", ");
    } else if (conf < REVISAO_HUMANA_MIN) {
      novoStatus = "invalido";
      motivoRejeicao = `Confiança da IA insuficiente (${conf.toFixed(2)}). Reenvie ou aguarde revisão manual.`;
    } else if (conf < APROVA_AUTO_MIN) {
      novoStatus = "revisao_humana";
    } else {
      novoStatus = "aprovado";
    }

    // calcula data_validade quando aplicável
    let dataValidade: string | null = null;
    if (dataEmissao && doc.validade_dias) {
      const d = new Date(dataEmissao);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + doc.validade_dias);
        dataValidade = d.toISOString().slice(0, 10);
      }
    }

    await supabase.from("qa_processo_documentos")
      .update({
        status: novoStatus,
        motivo_rejeicao: motivoRejeicao,
        dados_extraidos_json: parsed.campos_extraidos || {},
        divergencias_json: divergencias,
        validacao_ia_status: "concluido",
        validacao_ia_erro: null,
        validacao_ia_confianca: conf,
        validacao_ia_modelo: "google/gemini-2.5-flash",
        data_validacao: new Date().toISOString(),
        data_validade: dataValidade,
      })
      .eq("id", documento_id);

    await supabase.from("qa_processo_eventos").insert({
      processo_id, documento_id,
      tipo_evento: "validacao_ia",
      descricao: `IA: ${doc.nome_documento} → ${novoStatus}`,
      dados_json: { confianca: conf, divergencias: divergencias.length, vencido, campos_faltando: camposFaltando, esperado_violado: esperadoViolado },
      ator: "ia",
    });

    // ===== GRUPO ALTERNATIVO: se aprovado, dispensa demais itens do mesmo grupo =====
    if (novoStatus === "aprovado") {
      const grupo = (regra?.grupo_alternativo as string | undefined) ?? null;
      if (grupo) {
        const { data: irmaos } = await supabase
          .from("qa_processo_documentos")
          .select("id, status, regra_validacao, nome_documento")
          .eq("processo_id", processo_id);
        const dispensar = (irmaos ?? []).filter((it: any) =>
          it.id !== documento_id &&
          it?.regra_validacao?.grupo_alternativo === grupo &&
          !["aprovado", "dispensado_grupo"].includes(String(it.status))
        );
        if (dispensar.length > 0) {
          const ids = dispensar.map((d: any) => d.id);
          await supabase.from("qa_processo_documentos")
            .update({
              status: "dispensado_grupo",
              motivo_rejeicao: null,
              observacoes: `dispensado:grupo=${grupo}`,
            })
            .in("id", ids);
          await supabase.from("qa_processo_eventos").insert(
            dispensar.map((d: any) => ({
              processo_id, documento_id: d.id,
              tipo_evento: "grupo_alternativo_satisfeito",
              descricao: `${d.nome_documento} dispensado: grupo "${grupo}" satisfeito por ${doc.nome_documento}.`,
              dados_json: { grupo, satisfeito_por: documento_id },
              ator: "sistema",
            }))
          );
        }
      }
    }

    // Notifica granular (cobra SOMENTE este item)
    const eventoEmail =
      novoStatus === "aprovado" ? "documento_aprovado" :
      novoStatus === "divergente" ? "divergencia_dados" :
      novoStatus === "invalido" && doc.tipo_documento.startsWith("certidao_") ? "certidao_invalida" :
      novoStatus === "invalido" ? "documento_invalido" :
      novoStatus === "revisao_humana" ? "revisao_humana" : null;
    if (eventoEmail) {
      try {
        await supabase.functions.invoke("qa-processo-notificar", {
          body: { processo_id, documento_id, evento: eventoEmail, motivo: motivoRejeicao ?? undefined },
        });
      } catch (e) { console.warn("[validar-ia] notificação falhou:", e); }
    }

    return json({ success: true, status: novoStatus, motivo_rejeicao: motivoRejeicao, validacao: parsed });
  } catch (err: any) {
    console.error("qa-processo-doc-validar-ia:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});

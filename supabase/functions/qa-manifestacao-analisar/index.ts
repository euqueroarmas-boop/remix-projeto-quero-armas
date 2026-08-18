// ============================================================================
// qa-manifestacao-analisar — a IA lê o delegado e diz o que ainda falta
// ----------------------------------------------------------------------------
// A equipe cola no admin o texto que a Polícia Federal publicou no SINARM.
// Este endpoint lê esse texto e faz três coisas:
//
//   1. traduz para o cliente — o que aconteceu, em português de gente;
//   2. lista o que a PF exigiu, e o RISCO de não cumprir;
//   3. cria as exigências no checklist, já abertas para upload.
//
// ── A REGRA QUE ORGANIZA TUDO ───────────────────────────────────────────────
// O recurso que só repete o que já foi dito é NEGADO. A autoridade já leu
// aquilo e já decidiu contra. Portanto a IA não está aqui para resumir a
// decisão: está para dizer o que de NOVO precisa entrar no processo. Documento
// que já está no dossiê aprovado não vira exigência — por isso o prompt recebe
// a lista do que o cliente já entregou.
//
// ── POR QUE UM CARDÁPIO FECHADO ─────────────────────────────────────────────
// A IA escolhe o tipo do documento de uma lista (`exigenciasPFTipos`), nunca
// escrevendo texto livre. O Hub tem vocabulário fechado por CHECK; um tipo
// inventado faria o upload do cliente morrer com erro de constraint — e agora
// com prazo de 10 dias correndo. Quando o pedido do delegado não cabe em tipo
// nenhum, existe o escape `documento_complementar_caso`, com o título escrito
// pela IA.
//
// ── O QUE ESTE ENDPOINT NUNCA FAZ ───────────────────────────────────────────
// Não reescreve o texto da PF (é prova), não apaga exigência que o cliente já
// cumpriu, e não sobrescreve metadado que a equipe digitou à mão. A pessoa que
// leu o documento inteiro sabe mais que o extrator.
//
// Reexecutável: rodar de novo na mesma manifestação atualiza a análise e não
// duplica exigência (a chave é processo + tipo + manifestação).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";
import {
  cardapioParaPrompt,
  normalizarTipoExigenciaPF,
  rotuloTipoExigenciaPF,
} from "../_shared/exigenciasPFTipos.ts";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...qaAuthCors, "Content-Type": "application/json" },
  });
}

/** Status em que o documento já está resolvido — não vira exigência de novo. */
const JA_CUMPRIDO = new Set([
  "aprovado", "validado", "concluido", "entregue_pelo_hub",
  "dispensado", "dispensado_grupo", "dispensado_por_reaproveitamento",
  "hub_reaproveitado", "nao_aplicavel",
]);

const SYSTEM_PROMPT = `Você trabalha num despachante especializado em processos de arma de fogo e lê,
todos os dias, o que a Polícia Federal escreve nos processos dos clientes.

Sua tarefa é ler um documento REAL da Polícia Federal (notificação, parecer ou decisão) e produzir
duas coisas: uma explicação para o CLIENTE LEIGO e uma lista do que precisa ser juntado.

REGRAS DURAS:

1. TRABALHE SÓ COM O TEXTO. Não invente fato, norma, prazo, nome ou número que não esteja escrito.
   Campo que o texto não traz fica vazio. Chutar nome de delegado é pior que deixar em branco.

2. O QUE VOCÊ PEDE TEM QUE SER NOVO. Um recurso que apenas repete o que já foi apresentado é
   negado — a autoridade já leu aquilo e já decidiu contra. Você vai receber a lista do que o
   cliente JÁ entregou e que já foi aprovado. NÃO peça esses documentos de novo. Peça o que muda
   a análise: prova nova, fato novo, documento que ainda não existe no processo.
   Se o texto da PF não pede nada de concreto, devolva a lista VAZIA. Lista vazia é uma resposta
   legítima e honesta; encher de item genérico para "parecer útil" faz o cliente perder tempo e
   dinheiro com documento que não muda nada.

3. FALE COM O CLIENTE, NÃO COM O ADVOGADO. O resumo e os riscos são lidos por uma pessoa comum,
   assustada, que acabou de saber que o pedido dela pode ser negado. Frases curtas. Sem "outrossim",
   sem "por conseguinte", sem citar artigo no meio da frase. O nome do delegado, quando o texto
   traz, deve aparecer — o cliente entende melhor "o delegado Fulano pediu" do que "a autoridade
   determinou".

4. O RISCO É CONCRETO E VERDADEIRO. Diga o que acontece de fato se ele não cumprir: perder o prazo
   faz o requerimento ser arquivado e a taxa paga não volta. Não ameace com o que o texto não diz,
   e não amenize o que ele diz.

5. CADA EXIGÊNCIA TEM UM TIPO DO CARDÁPIO. Escolha o tipo da lista fornecida. Quando o que a PF
   pediu não couber em nenhum, use documento_complementar_caso e escreva no título exatamente o
   que ela pediu.

Responda SEMPRE via tool call estruturado.`;

interface ElementoNovo {
  titulo?: string;
  tipo_documento?: string;
  por_que?: string;
  como_conseguir?: string;
  obrigatorio?: boolean;
}

interface AnaliseIA {
  natureza?: string;
  delegado_nome?: string;
  delegado_cargo?: string;
  unidade_pf?: string;
  data_documento?: string;
  prazo_dias?: number;
  resumo_para_cliente?: string;
  o_que_a_pf_disse?: string[];
  riscos?: string[];
  elementos_novos?: ElementoNovo[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: qaAuthCors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);

  try {
    // Interna (chamada pela própria tela ao salvar) ou staff logado.
    const internalToken = req.headers.get("x-internal-token") || "";
    const isInternal = !!internalToken && internalToken === Deno.env.get("INTERNAL_FUNCTION_TOKEN");
    if (!isInternal) {
      const guard = await requireQAStaff(req);
      if (!guard.ok) return guard.response;
    }

    const body = await req.json().catch(() => ({}));
    const manifestacaoId = String((body as { manifestacao_id?: string })?.manifestacao_id ?? "").trim();
    if (!manifestacaoId) return json({ error: "manifestacao_id_obrigatorio" }, 400);

    const { data: manifestacao } = await admin
      .from("qa_processo_manifestacoes_pf")
      .select("id, processo_id, tipo, status_processo, texto, delegado_nome, delegado_cargo, unidade_pf, data_documento, prazo_dias")
      .eq("id", manifestacaoId)
      .maybeSingle();
    if (!manifestacao) return json({ error: "manifestacao_not_found" }, 404);

    const texto = String((manifestacao as { texto?: string }).texto ?? "").trim();
    if (texto.length < 100) {
      return json({ error: "texto_curto_demais", minimo: 100, tamanho: texto.length }, 400);
    }
    if (texto.length > 60000) {
      return json({ error: "texto_longo_demais", maximo: 60000, tamanho: texto.length }, 400);
    }

    const processoId = String((manifestacao as { processo_id: string }).processo_id);
    const { data: processo } = await admin
      .from("qa_processos")
      .select("id, cliente_id, servico_nome")
      .eq("id", processoId)
      .maybeSingle();
    if (!processo) return json({ error: "processo_not_found" }, 404);

    // O QUE O CLIENTE JÁ ENTREGOU. É esta lista que impede a IA de pedir de
    // novo o que já está no dossiê — e é pedir de novo que faz o recurso ser
    // negado por repetição.
    const { data: docs } = await admin
      .from("qa_processo_documentos")
      .select("id, tipo_documento, nome_documento, status, regra_validacao")
      .eq("processo_id", processoId);
    const lista = (docs ?? []) as Array<{
      id: string;
      tipo_documento: string;
      nome_documento?: string;
      status?: string;
      regra_validacao?: Record<string, unknown> | null;
    }>;
    const jaEntregues = lista
      .filter((d) => JA_CUMPRIDO.has(String(d.status ?? "").toLowerCase()))
      .map((d) => `${d.tipo_documento}${d.nome_documento ? ` (${d.nome_documento})` : ""}`);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `SERVIÇO DO CLIENTE: ${(processo as { servico_nome?: string }).servico_nome ?? "processo administrativo"}\n\n` +
              `DOCUMENTOS QUE O CLIENTE JÁ ENTREGOU E QUE JÁ FORAM APROVADOS (não peça estes de novo):\n` +
              (jaEntregues.length ? jaEntregues.map((t) => `- ${t}`).join("\n") : "- (nenhum ainda)") +
              `\n\nTIPOS DE DOCUMENTO QUE VOCÊ PODE PEDIR — escolha SEMPRE um destes:\n${cardapioParaPrompt()}` +
              `\n\n────── DOCUMENTO DA POLÍCIA FEDERAL ──────\n${texto}\n────── FIM DO DOCUMENTO ──────`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "registrar_analise_manifestacao",
            description: "Estrutura o que a Polícia Federal escreveu e o que ainda precisa ser juntado.",
            parameters: {
              type: "object",
              properties: {
                natureza: {
                  type: "string",
                  enum: ["notificacao", "parecer", "decisao_deferimento", "decisao_indeferimento", "outro"],
                  description: "O que este documento é.",
                },
                delegado_nome: { type: "string", description: "Nome de quem assina, EXATAMENTE como está no texto. Vazio se não houver." },
                delegado_cargo: { type: "string", description: "Cargo de quem assina. Vazio se não houver." },
                unidade_pf: { type: "string", description: "Unidade/delegacia (ex: DELEARM/DREX/SR/PF/SP). Vazio se não houver." },
                data_documento: { type: "string", description: "Data do documento em AAAA-MM-DD. Vazio se não houver." },
                prazo_dias: { type: "number", description: "Prazo em dias que o texto concede. 0 se não houver prazo escrito." },
                resumo_para_cliente: {
                  type: "string",
                  description: "2 a 4 frases curtas, para leigo, dizendo o que aconteceu e o que se espera dele agora.",
                },
                o_que_a_pf_disse: {
                  type: "array",
                  items: { type: "string" },
                  description: "Cada ponto que a PF levantou, em linguagem simples. Um item por ponto.",
                },
                riscos: {
                  type: "array",
                  items: { type: "string" },
                  description: "O que acontece de concreto se ele não cumprir. Verdadeiro e específico.",
                },
                elementos_novos: {
                  type: "array",
                  description: "O que precisa ser juntado. VAZIO quando o texto não pede nada concreto.",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string", description: "O que enviar, como o cliente entende. Curto." },
                      tipo_documento: { type: "string", description: "Um tipo do cardápio fornecido." },
                      por_que: { type: "string", description: "Por que a PF quer isto, em uma frase." },
                      como_conseguir: { type: "string", description: "Onde/como o cliente obtém. Vazio se for óbvio." },
                      obrigatorio: { type: "boolean", description: "true quando a PF exigiu; false quando só ajuda." },
                    },
                    required: ["titulo", "tipo_documento", "por_que", "obrigatorio"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["natureza", "resumo_para_cliente", "o_que_a_pf_disse", "riscos", "elementos_novos"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "registrar_analise_manifestacao" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("[manifestacao-analisar] IA falhou", aiResp.status, t);
      if (aiResp.status === 429) return json({ error: "limite_de_requisicoes" }, 429);
      if (aiResp.status === 402) return json({ error: "creditos_ia_esgotados" }, 402);
      return json({ error: "falha_na_ia" }, 500);
    }

    const ai = await aiResp.json();
    const argumentos = ai?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argumentos) return json({ error: "resposta_sem_estrutura" }, 500);

    let analise: AnaliseIA;
    try {
      analise = JSON.parse(argumentos) as AnaliseIA;
    } catch {
      return json({ error: "resposta_ilegivel" }, 500);
    }

    // Normaliza os tipos ANTES de gravar. Um tipo inventado que chegasse ao
    // checklist viraria upload rejeitado pelo CHECK do Hub na cara do cliente.
    const elementos = (analise.elementos_novos ?? []).map((e) => ({
      titulo: String(e.titulo ?? "").trim() || "Documento pedido pela Polícia Federal",
      tipo_documento: normalizarTipoExigenciaPF(e.tipo_documento),
      por_que: String(e.por_que ?? "").trim(),
      como_conseguir: String(e.como_conseguir ?? "").trim(),
      obrigatorio: e.obrigatorio !== false,
    }));

    // METADADO SÓ PREENCHE BURACO. Quem digitou leu o documento inteiro; o
    // extrator leu o mesmo texto com menos contexto. Na dúvida, vence a pessoa.
    const preencher: Record<string, unknown> = {
      analise_ia_json: { ...analise, elementos_novos: elementos, gerado_em: new Date().toISOString() },
      exigencias_json: elementos,
      updated_at: new Date().toISOString(),
    };
    const m = manifestacao as Record<string, unknown>;
    if (!m.delegado_nome && analise.delegado_nome) preencher.delegado_nome = analise.delegado_nome;
    if (!m.delegado_cargo && analise.delegado_cargo) preencher.delegado_cargo = analise.delegado_cargo;
    if (!m.unidade_pf && analise.unidade_pf) preencher.unidade_pf = analise.unidade_pf;
    if (!m.data_documento && /^\d{4}-\d{2}-\d{2}$/.test(String(analise.data_documento ?? ""))) {
      preencher.data_documento = analise.data_documento;
    }
    if (!m.prazo_dias && Number(analise.prazo_dias) > 0) preencher.prazo_dias = Number(analise.prazo_dias);

    const { error: upErr } = await admin
      .from("qa_processo_manifestacoes_pf")
      .update(preencher)
      .eq("id", manifestacaoId);
    if (upErr) {
      console.error("[manifestacao-analisar] gravação da análise falhou", upErr);
      return json({ error: upErr.message }, 500);
    }

    // ── EXIGÊNCIAS NO CHECKLIST ───────────────────────────────────────────
    //
    // ATÉ 18/08/2026 ISTO ERA UM SUMIDOURO. A regra era "só entram as que ainda
    // não existem no processo" — e a PF pede de novo o tempo todo: o
    // comprovante de residência venceu, a certidão saiu com nome divergente, o
    // laudo é de outro ano. Quando já havia uma linha daquele tipo, a exigência
    // era descartada em silêncio, contada como `ja_existentes`. O cliente nunca
    // era cobrado, e os 10 dias corriam até o requerimento ser arquivado.
    //
    // Agora há três destinos:
    //   • não existe linha do tipo            → cria
    //   • existe, mas cumprida ou de outro
    //     ciclo                               → REABRE como pendência da PF
    //   • já está pendente por causa DESTA
    //     mesma manifestação                  → não mexe (idempotência)
    const primeiraPorTipo = new Map<string, typeof lista[number]>();
    for (const d of lista) {
      const t = String(d.tipo_documento);
      if (!primeiraPorTipo.has(t)) primeiraPorTipo.set(t, d);
    }

    const aCriar: typeof elementos = [];
    const aReabrir: Array<{ elemento: typeof elementos[number]; linha: typeof lista[number] }> = [];

    for (const e of elementos) {
      const existente = primeiraPorTipo.get(e.tipo_documento);
      if (!existente) { aCriar.push(e); continue; }
      const regraAtual = (existente.regra_validacao ?? {}) as Record<string, unknown>;
      const jaDestaManifestacao = String(regraAtual.manifestacao_id ?? "") === manifestacaoId;
      const cumprida = JA_CUMPRIDO.has(String(existente.status ?? "").toLowerCase());
      if (jaDestaManifestacao && !cumprida) continue;
      aReabrir.push({ elemento: e, linha: existente });
    }

    let reabertas = 0;
    for (const { elemento: e, linha } of aReabrir) {
      const regraAtual = (linha.regra_validacao ?? {}) as Record<string, unknown>;
      // As condicionais saem: o que a PF exige é incondicional. Uma linha com
      // `exige_quando` insatisfeito voltaria invisível para o cliente — o mesmo
      // silêncio, por outra porta.
      const {
        exige_quando: _eq,
        dispensa_quando: _dq,
        depende_de: _dd,
        ...regraPreservada
      } = regraAtual;

      const { error: reErr } = await admin
        .from("qa_processo_documentos")
        .update({
          status: "pendente",
          obrigatorio: e.obrigatorio,
          nome_documento: e.titulo,
          data_validacao: null,
          motivo_rejeicao:
            "A Polícia Federal pediu este documento novamente. Envie a versão atual.",
          instrucoes: [e.por_que, e.como_conseguir].filter(Boolean).join(" "),
          observacoes_cliente: e.por_que || null,
          etapa: "complementar",
          ordem: 1,
          regra_validacao: {
            ...regraPreservada,
            grupo_checklist: "exigencias_pf",
            ordem_grupo_checklist: 1,
            origem: "manifestacao_pf",
            manifestacao_id: manifestacaoId,
            delegado_nome: preencher.delegado_nome ?? m.delegado_nome ?? null,
            rotulo_tipo: rotuloTipoExigenciaPF(e.tipo_documento),
            reaberta_em: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", linha.id);
      if (reErr) {
        console.error("[manifestacao-analisar] exigência não reaberta", linha.id, reErr.message);
        continue;
      }
      reabertas++;
      await admin.from("qa_processo_eventos").insert({
        processo_id: processoId,
        documento_id: linha.id,
        tipo_evento: "exigencia_pf_reaberta",
        descricao:
          `A PF PEDIU NOVAMENTE: ${String(e.titulo).toUpperCase()} ` +
          `(estava "${linha.status ?? "sem status"}")`,
        ator: "sistema_ia",
        dados_json: {
          manifestacao_id: manifestacaoId,
          tipo_documento: e.tipo_documento,
          status_anterior: linha.status ?? null,
        },
      });
    }

    let criadas = 0;
    if (aCriar.length > 0) {
      const rows = aCriar.map((e, i) => ({
        processo_id: processoId,
        cliente_id: (processo as { cliente_id: number }).cliente_id,
        tipo_documento: e.tipo_documento,
        nome_documento: e.titulo,
        etapa: "complementar",
        // Ordem baixa de propósito: exigência da PF tem prazo fatal e passa na
        // frente de tudo o que estiver pendente no checklist.
        ordem: 1 + i,
        obrigatorio: e.obrigatorio,
        status: "pendente",
        formato_aceito: ["pdf", "jpg", "jpeg", "png"],
        instrucoes: [e.por_que, e.como_conseguir].filter(Boolean).join(" "),
        observacoes_cliente: e.por_que || null,
        regra_validacao: {
          grupo_checklist: "exigencias_pf",
          ordem_grupo_checklist: 1 + i,
          origem: "manifestacao_pf",
          manifestacao_id: manifestacaoId,
          delegado_nome: preencher.delegado_nome ?? m.delegado_nome ?? null,
          rotulo_tipo: rotuloTipoExigenciaPF(e.tipo_documento),
        },
      }));
      const { error: insErr } = await admin.from("qa_processo_documentos").insert(rows);
      if (insErr) {
        console.error("[manifestacao-analisar] exigências não criadas", insErr);
        return json({ error: insErr.message, analise_gravada: true }, 500);
      }
      criadas = rows.length;

      // O Hub pode já ter algo aprovado que satisfaz a exigência nova. Sem este
      // disparo o cliente é mandado buscar um documento que ele já nos deu.
      try {
        await admin.rpc("qa_reaproveitar_documentos_hub_processo", {
          p_processo_id: processoId,
          p_origem: "manifestacao_pf",
        });
      } catch (_) { /* best-effort */ }
    }

    await admin.from("qa_processo_eventos").insert({
      processo_id: processoId,
      tipo_evento: "manifestacao_pf_analisada",
      descricao:
        `IA leu a manifestação da PF: ${elementos.length} elemento(s) apontado(s), ` +
        `${criadas} exigência(s) criada(s), ${reabertas} reaberta(s).`,
      ator: "sistema_ia",
      dados_json: {
        manifestacao_id: manifestacaoId,
        natureza: analise.natureza ?? null,
        tipos: elementos.map((e) => e.tipo_documento),
        criadas,
        reabertas,
        // O que sobra aqui já estava pendente por causa desta mesma
        // manifestação — nada a fazer, e é o único caso legítimo de "ignorar".
        ja_pendentes: elementos.length - criadas - reabertas,
      },
    });

    return json({
      ok: true,
      natureza: analise.natureza ?? null,
      resumo_para_cliente: analise.resumo_para_cliente ?? "",
      elementos_novos: elementos,
      exigencias_criadas: criadas,
      exigencias_reabertas: reabertas,
      exigencias_ja_pendentes: elementos.length - criadas - reabertas,
    });
  } catch (err) {
    console.error("qa-manifestacao-analisar:", err);
    return json({ error: err instanceof Error ? err.message : "erro_interno" }, 500);
  }
});

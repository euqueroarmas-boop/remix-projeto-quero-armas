// ============================================================================
// qa-recurso-gerar — o relato do recurso, na voz do próprio cliente
// ----------------------------------------------------------------------------
// A PF negou, apontou o que faltou, e o cliente enviou o que ela pediu. Falta
// a peça — e a peça é escrita pela equipe. Mas os FATOS são dele, e é ele quem
// tem de confirmar que são os fatos dele antes de aquilo entrar na delegacia.
// Recurso protocolado com fato errado não se conserta: vira parte do processo
// e a próxima autoridade lê aquilo.
//
// ── POR QUE PRIMEIRA PESSOA ─────────────────────────────────────────────────
// Texto na terceira pessoa ("o requerente registrou") o cliente lê como
// documento de escritório e aprova no automático, sem conferir. Na voz dele
// ("eu registrei o boletim no dia X"), ele lê como se fosse dele e corrige o
// que está errado. A voz não é enfeite; é o que faz a conferência acontecer.
//
// ── A REGRA QUE MANDA ───────────────────────────────────────────────────────
// Recurso que só repete o que já foi apresentado é negado. A autoridade já leu
// aquilo e já decidiu contra. Então o relato tem de girar em torno do que MUDOU
// desde a decisão: a prova nova, o fato novo, o documento que não existia. O
// que já estava no processo entra só como contexto, nunca como argumento
// principal.
//
// ── O QUE ESTE ENDPOINT NÃO FAZ ─────────────────────────────────────────────
// Não escreve petição. Sem "Excelentíssimo", sem tópicos em romanos, sem tese
// jurídica, sem pedido de deferimento — isso é trabalho da equipe, sobre esta
// base factual. E não inventa: fato que não está nos dados não entra no texto.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...qaAuthCors, "Content-Type": "application/json" },
  });
}

const CUMPRIDO = new Set([
  "aprovado", "validado", "concluido", "entregue_pelo_hub",
  "hub_reaproveitado", "dispensado_por_reaproveitamento",
]);

const SYSTEM_PROMPT = `Você redige RELATOS DE FATOS em primeira pessoa, no português do Brasil, para instruir
RECURSO ADMINISTRATIVO contra decisão da Polícia Federal em processo de arma de fogo.

REGRAS ABSOLUTAS:

- PRIMEIRA PESSOA, sempre ("eu", "minha residência", "o meu pedido"). Quem narra é o próprio
  requerente. Nunca "o requerente", nunca "o cliente".

- NÃO É PETIÇÃO. Proibido: endereçamento, "Excelentíssimo", "venho por meio deste", tópicos em
  algarismos romanos, citação de artigo como fundamento, jurisprudência, pedido de deferimento,
  fecho de advogado. A tese jurídica é escrita depois pela equipe, em cima deste relato.

- O EIXO É O QUE MUDOU. Um recurso que apenas repete o que já foi apresentado é negado — a
  autoridade já leu aquilo e já decidiu contra. Organize o texto assim: (1) eu digo o que a
  decisão apontou como faltando; (2) eu digo o que fiz depois dela e o que estou juntando agora;
  (3) eu digo por que isso responde exatamente ao que foi apontado. O que já estava no processo
  entra como contexto curto, nunca como argumento principal.

- SÓ FATOS FORNECIDOS. É PROIBIDO inventar data, número de boletim, nome, órgão ou episódio. Dado
  que não existe simplesmente não é mencionado. Não escreva "conforme documento anexo" para
  documento que não está na lista.

- CITE AS PROVAS COMO PROVA, sem transcrevê-las ("registrei o boletim de ocorrência nº X, em
  DD/MM/AAAA, na Y delegacia").

- SEM RANCOR. Nada de acusar a autoridade de má-fé, preguiça ou perseguição. O tom é de quem
  esclarece, não de quem revida. Recurso ofensivo prejudica quem o assina.

- Entre 1.500 e 4.500 caracteres. Parágrafos curtos. Sem títulos, sem marcadores, sem markdown,
  sem assinatura.

- Termine com um parágrafo curto em que eu, com as minhas palavras, digo por que entendo que o
  pedido deve ser reexaminado à luz do que estou juntando agora.

Devolva APENAS o relato, sem nenhum comentário antes ou depois.`;

const dataBR = (iso: string | null | undefined) => {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: qaAuthCors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const internalToken = req.headers.get("x-internal-token") || "";
    const isInternal = !!internalToken && internalToken === Deno.env.get("INTERNAL_FUNCTION_TOKEN");
    if (!isInternal) {
      const guard = await requireQAStaff(req);
      if (!guard.ok) return guard.response;
    }

    const body = await req.json().catch(() => ({}));
    const processoId = String((body as { processo_id?: string })?.processo_id ?? "").trim();
    if (!processoId) return json({ error: "processo_id_obrigatorio" }, 400);

    const { data: processo } = await admin
      .from("qa_processos")
      .select("id, cliente_id, servico_nome, status")
      .eq("id", processoId)
      .maybeSingle();
    if (!processo) return json({ error: "processo_not_found" }, 404);

    // A manifestação MAIS RECENTE que negou ou exigiu algo — é ela que o
    // recurso responde. Sem ela não há o que recorrer.
    const { data: manifestacoes } = await admin
      .from("qa_processo_manifestacoes_pf")
      .select("id, tipo, status_processo, texto, delegado_nome, delegado_cargo, unidade_pf, data_documento, prazo_limite, analise_ia_json, exigencias_json")
      .eq("processo_id", processoId)
      .order("created_at", { ascending: false })
      .limit(5);
    const lista = (manifestacoes ?? []) as Array<Record<string, unknown>>;
    const alvo = lista.find((m) =>
      String(m.status_processo ?? "").toLowerCase().includes("indeferido") ||
      String(m.status_processo ?? "").toLowerCase() === "notificado"
    );
    if (!alvo) return json({ error: "sem_manifestacao_para_recorrer" }, 400);

    // AS PROVAS NOVAS. São as exigências abertas a partir daquela manifestação
    // e que o cliente já cumpriu — o que mudou desde a decisão. É disso que o
    // recurso vive; sem nada novo, ele nasce condenado.
    const { data: docs } = await admin
      .from("qa_processo_documentos")
      .select("tipo_documento, nome_documento, status, data_emissao, data_envio, dados_extraidos_json, regra_validacao")
      .eq("processo_id", processoId);
    const todos = (docs ?? []) as Array<Record<string, unknown>>;
    const provasNovas = todos.filter((d) => {
      const regra = (d.regra_validacao ?? {}) as Record<string, unknown>;
      return regra.origem === "manifestacao_pf" && CUMPRIDO.has(String(d.status ?? "").toLowerCase());
    });

    const { data: cliente } = await admin
      .from("qa_clientes")
      .select("nome_completo, profissao, cidade, estado, bairro")
      .eq("id", (processo as { cliente_id: number }).cliente_id)
      .maybeSingle();

    const analise = (alvo.analise_ia_json ?? {}) as {
      resumo_para_cliente?: string;
      o_que_a_pf_disse?: string[];
    };

    const contexto = [
      "QUEM SOU EU (do meu cadastro):",
      `Nome: ${(cliente as { nome_completo?: string } | null)?.nome_completo ?? "—"}`,
      `Profissão: ${(cliente as { profissao?: string } | null)?.profissao ?? "não informada"}`,
      `Moro em: ${[
        (cliente as { bairro?: string } | null)?.bairro,
        (cliente as { cidade?: string } | null)?.cidade,
        (cliente as { estado?: string } | null)?.estado,
      ].filter(Boolean).join(" — ") || "—"}`,
      `Pedido: ${(processo as { servico_nome?: string }).servico_nome ?? "processo administrativo"}`,
      "",
      `O QUE A POLÍCIA FEDERAL DECIDIU (documento de ${dataBR(String(alvo.data_documento ?? "")) || "data não informada"}${
        alvo.delegado_nome ? `, assinado por ${alvo.delegado_nome}` : ""
      }):`,
      String(alvo.texto ?? "").slice(0, 20000),
      "",
      ...(analise.o_que_a_pf_disse?.length
        ? ["PONTOS QUE A DECISÃO APONTOU:", ...analise.o_que_a_pf_disse.map((x) => `- ${x}`), ""]
        : []),
      "PROVAS NOVAS QUE ESTOU JUNTANDO AGORA (juntadas DEPOIS da decisão, em resposta a ela):",
      provasNovas.length
        ? provasNovas.map((p, i) => {
          const extra = (p.dados_extraidos_json ?? {}) as Record<string, unknown>;
          const partes = [
            `${i + 1}. ${p.nome_documento ?? p.tipo_documento}`,
            extra.numero ? `nº ${extra.numero}` : "",
            extra.orgao ? `órgão: ${extra.orgao}` : "",
            p.data_emissao ? `emitido em ${dataBR(String(p.data_emissao))}` : "",
            p.data_envio ? `enviado em ${dataBR(String(p.data_envio))}` : "",
          ].filter(Boolean);
          return partes.join(" — ");
        }).join("\n")
        : "(nenhuma prova nova registrada — diga isso com honestidade no relato, sem inventar documento)",
      "",
      "Escreva agora o meu relato, em primeira pessoa, seguindo as regras.",
    ].join("\n");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "ia_indisponivel" }, 500);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        stream: false,
        max_tokens: 6000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contexto },
        ],
      }),
    });
    if (resp.status === 429) return json({ error: "limite_de_requisicoes" }, 429);
    if (resp.status === 402) return json({ error: "creditos_ia_esgotados" }, 402);
    if (!resp.ok) {
      console.error("[recurso-gerar] gateway", resp.status, (await resp.text()).slice(0, 400));
      return json({ error: "falha_na_ia" }, 502);
    }

    const payload = await resp.json();
    const narrativa = String(payload?.choices?.[0]?.message?.content ?? "").trim();
    if (!narrativa) return json({ error: "ia_sem_texto" }, 502);

    const agora = new Date().toISOString();
    const provasResumo = provasNovas.map((p) => ({
      tipo: p.tipo_documento,
      nome: p.nome_documento,
      enviado_em: p.data_envio ?? null,
    }));

    // Uma linha por RODADA de recurso. Se já existe uma para esta mesma
    // manifestação e ela ainda não foi aprovada, o texto é substituído — é a
    // mesma rodada sendo refeita. Depois de aprovada, nunca: o cliente aprovou
    // aquele texto, e sobrescrevê-lo apagaria o que ele de fato leu.
    const { data: existente } = await admin
      .from("qa_processo_recursos")
      .select("id, status")
      .eq("processo_id", processoId)
      .eq("manifestacao_id", String(alvo.id))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const reaproveitavel = existente &&
      ["rascunho", "aguardando_aprovacao"].includes(String((existente as { status: string }).status));

    let recursoId: string;
    if (reaproveitavel) {
      recursoId = String((existente as { id: string }).id);
      const { error } = await admin
        .from("qa_processo_recursos")
        .update({
          narrativa_gerada: narrativa,
          narrativa_gerada_em: agora,
          // Texto novo, aprovação zerada: o cliente precisa ler e aprovar ESTE.
          narrativa_final: null,
          editada_pelo_cliente: false,
          aprovado_em: null,
          aprovado_por: null,
          provas_json: provasResumo,
          exigencias_json: alvo.exigencias_json ?? [],
          status: "aguardando_aprovacao",
          updated_at: agora,
        })
        .eq("id", recursoId);
      if (error) return json({ error: error.message }, 500);
    } else {
      const { data: criado, error } = await admin
        .from("qa_processo_recursos")
        .insert({
          processo_id: processoId,
          manifestacao_id: String(alvo.id),
          narrativa_gerada: narrativa,
          narrativa_gerada_em: agora,
          provas_json: provasResumo,
          exigencias_json: alvo.exigencias_json ?? [],
          status: "aguardando_aprovacao",
        })
        .select("id")
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      recursoId = String((criado as { id: string }).id);
    }

    await admin.from("qa_processo_eventos").insert({
      processo_id: processoId,
      tipo_evento: "recurso_relato_gerado",
      descricao: `Relato do recurso gerado em primeira pessoa (${provasNovas.length} prova(s) nova(s)). Aguardando aprovação do cliente.`,
      ator: "sistema_ia",
      dados_json: { recurso_id: recursoId, manifestacao_id: alvo.id, provas: provasResumo.length },
    });

    return json({
      ok: true,
      recurso_id: recursoId,
      narrativa,
      provas_novas: provasResumo.length,
      status: "aguardando_aprovacao",
    });
  } catch (e) {
    console.error("[qa-recurso-gerar]", e);
    return json({ error: e instanceof Error ? e.message : "erro_interno" }, 500);
  }
});

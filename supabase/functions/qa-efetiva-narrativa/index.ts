/**
 * qa-efetiva-narrativa — Parte B da efetiva necessidade.
 *
 * Reúne o que o cliente já entregou (respostas, provas lidas, relato) e o que
 * o cadastro já sabe dele (profissão, ocupação lícita, endereço) e pede à IA
 * um RELATO EM PRIMEIRA PESSOA, cronológico e pormenorizado — no tom de quem
 * narra os fatos numa delegacia, NÃO uma petição. Esse texto é a base factual
 * de onde a equipe extrai depois a defesa.
 *
 * A IA cruza a profissão com a legislação de porte/posse apenas para APONTAR
 * o risco concreto vivido — jamais para pedir, argumentar ou concluir por
 * deferimento.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você redige RELATOS DE FATOS em primeira pessoa, no português do Brasil, para instruir pedido de aquisição/posse de arma de fogo perante a Polícia Federal.

REGRAS ABSOLUTAS:
- Escreva SEMPRE em primeira pessoa ("eu", "minha residência"), como se o próprio requerente narrasse em uma delegacia.
- NÃO é petição: proibido endereçamento, "Excelentíssimo", tópicos em algarismos romanos, citação de artigos como fundamento de pedido, jurisprudência, pedidos finais e fecho de advogado.
- Ordem CRONOLÓGICA dos fatos. Cada fato com data, local, quem estava envolvido, o que foi dito ou feito e a consequência.
- Só use fatos fornecidos. É PROIBIDO inventar datas, números de boletim, nomes ou episódios. Se um dado não existir, simplesmente não o mencione.
- Cite os documentos como prova ("registrei o boletim de ocorrência nº X, em DD/MM/AAAA, na Y"), sem transcrever o documento inteiro.
- Descreva a rotina de risco: profissão, se ela é reconhecidamente exposta (transporte de valores, atendimento noturno, zona rural isolada, manuseio de dinheiro, atividade em local ermo), horários, deslocamentos e vulnerabilidade da residência.
- Pode mencionar de forma descritiva que a atividade é considerada de risco na prática cotidiana, mas sem construir tese jurídica.
- Termine com um parágrafo em que eu explico, com os meus próprios fatos, por que continuo em risco hoje.
- Entre 2.500 e 6.000 caracteres. Parágrafos curtos. Sem títulos, sem marcadores, sem markdown.
- Se houver FATOS ACRESCENTADOS DEPOIS, incorpore-os ao relato no lugar cronológico correto. NUNCA descarte fatos já narrados: o relato novo contém tudo o que havia antes MAIS o que foi acrescentado.
- BOLETINS ANTIGOS = REITERAÇÃO. Amarre-os no relato como sequência ("desde DD/MM/AAAA venho registrando ocorrências..."), demonstrando que o problema se repete há tempo. Destaque o FATO MAIS RECENTE narrado pelo cliente e correlacione-o expressamente aos boletins anteriores. NUNCA afirme que um boletim antigo, sozinho, comprova ameaça atual.

VOCÊ PRODUZ DOIS TEXTOS, nesta ordem exata e com estes marcadores literais em linha própria:

===RELATO===
(o relato completo descrito acima)

===BO===
(o texto para o requerente registrar boletim de ocorrência)

REGRAS DO TEXTO ===BO=== (completamente diferentes das acima):
- MÁXIMO 500 CARACTERES, contados. Se passar, corte fatos secundários até caber.
- Primeira pessoa, frases curtas, palavras do dia a dia. Tem de parecer escrito à mão pelo próprio cidadão, com naturalidade — jamais parecer texto de IA, de advogado ou de formulário.
- PROIBIDO: "outrossim", "venho por meio deste", "supracitado", "consoante", citação de lei ou artigo, pedido de deferimento, menção a arma de fogo, a porte, a posse, a processo na Polícia Federal ou a este sistema.
- Conteúdo, nesta ordem: quem eu sou e o que faço; o que está acontecendo agora ou acabou de acontecer (o fato NOVO, o mais recente e concreto); por que temo pela minha vida, pela minha integridade ou pela da minha família; e que estou comunicando à delegacia para que sejam tomadas as providências cabíveis.
- Deve transmitir situação de risco atual e prestes a se consumar — medo, pânico, temor real — sem exagero teatral e sem inventar fato nenhum.
- Um único bloco de texto corrido, sem títulos, sem marcadores, sem markdown, sem assinatura.`;

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const dataBR = (iso: string | null | undefined) => {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

const LABEL: Record<string, string> = {
  boletim_ocorrencia: "Boletim de Ocorrência",
  inquerito_policial: "Inquérito policial",
  acao_criminal: "Ação criminal",
  outro: "Documento complementar",
};

/** Limite duro do texto de BO. Corta na última frase inteira que couber. */
const LIMITE_BO = 500;
function limitarBo(texto: string): string {
  const limpo = texto.replace(/\s+\n/g, "\n").trim();
  if (limpo.length <= LIMITE_BO) return limpo;
  const corte = limpo.slice(0, LIMITE_BO);
  const ultimoPonto = Math.max(corte.lastIndexOf("."), corte.lastIndexOf("!"), corte.lastIndexOf("?"));
  return (ultimoPonto > 200 ? corte.slice(0, ultimoPonto + 1) : corte).trim();
}

/** A IA devolve os dois textos separados por marcadores literais. */
function separarBlocos(bruto: string): { narrativa: string; textoBo: string } {
  const m = bruto.match(/===\s*RELATO\s*===([\s\S]*?)===\s*BO\s*===([\s\S]*)$/i);
  if (m) {
    return { narrativa: m[1].trim(), textoBo: limitarBo(m[2]) };
  }
  // Sem marcadores: tudo vira relato e o texto de BO fica para a próxima rodada.
  return { narrativa: bruto.replace(/^===\s*RELATO\s*===/i, "").trim(), textoBo: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { registro_id } = await req.json();
    if (!registro_id) return json({ error: "registro_id obrigatório" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: reg } = await sb
      .from("qa_efetiva_necessidade")
      .select("*")
      .eq("id", registro_id)
      .maybeSingle();
    if (!reg) return json({ error: "Registro não encontrado" }, 404);

    const { data: provas } = await sb
      .from("qa_efetiva_necessidade_provas")
      .select("tipo, numero, orgao, data_fato, local_fato, naturezas, vitima_nome, relato, arquivo_nome")
      .eq("efetiva_necessidade_id", registro_id)
      .order("data_fato", { ascending: true, nullsFirst: false });

    const { data: acrescimos } = await sb
      .from("qa_efetiva_necessidade_acrescimos")
      .select("texto, ordem, created_at")
      .eq("efetiva_necessidade_id", registro_id)
      .order("ordem", { ascending: true });

    const { data: cliente } = await sb
      .from("qa_clientes")
      .select(
        "nome_completo, profissao, cidade, estado, bairro, data_nascimento, " +
          "ocupacao_licita_razao_social, ocupacao_licita_atividade, ocupacao_licita_cidade, ocupacao_licita_estado",
      )
      .eq("id", reg.cliente_id)
      .maybeSingle();

    const linhasProvas = (provas ?? []).map((p: any, i: number) => {
      const partes = [
        `${i + 1}. ${LABEL[p.tipo] ?? p.tipo}`,
        p.numero ? `nº ${p.numero}` : "",
        p.orgao ? `órgão: ${p.orgao}` : "",
        p.data_fato ? `fato em ${dataBR(p.data_fato)}` : "",
        p.local_fato ? `local: ${p.local_fato}` : "",
        p.naturezas?.length ? `natureza: ${p.naturezas.join(", ")}` : "",
        p.vitima_nome ? `vítima: ${p.vitima_nome}` : "",
      ].filter(Boolean);
      const base = partes.join(" — ");
      return p.relato ? `${base}\nTrecho lido do documento: ${String(p.relato).slice(0, 1200)}` : base;
    });

    const contextoUsuario = [
      "DADOS DO REQUERENTE (do cadastro):",
      `Nome: ${cliente?.nome_completo ?? "—"}`,
      `Profissão declarada: ${cliente?.profissao ?? "não informada"}`,
      cliente?.ocupacao_licita_atividade
        ? `Atividade/ocupação lícita: ${cliente.ocupacao_licita_atividade}${
          cliente.ocupacao_licita_razao_social ? ` (${cliente.ocupacao_licita_razao_social})` : ""
        }`
        : "",
      `Reside em: ${[cliente?.bairro, cliente?.cidade, cliente?.estado].filter(Boolean).join(" — ") || "—"}`,
      cliente?.ocupacao_licita_cidade
        ? `Trabalha em: ${[cliente.ocupacao_licita_cidade, cliente.ocupacao_licita_estado].filter(Boolean).join(" — ")}`
        : "",
      "",
      "RESPOSTAS DO QUESTIONÁRIO:",
      `Registrou boletim de ocorrência: ${reg.tem_bo === true ? "sim" : reg.tem_bo === false ? "não" : "não respondeu"}`,
      `Houve inquérito policial: ${reg.tem_inquerito === true ? "sim" : reg.tem_inquerito === false ? "não" : "não respondeu"}`,
      `Moveu ação criminal: ${reg.tem_acao_criminal === true ? "sim" : reg.tem_acao_criminal === false ? "não" : "não respondeu"}`,
      `Sofre ou se sente ameaçado: ${reg.sofre_ameaca === true ? "sim" : reg.sofre_ameaca === false ? "não" : "não respondeu"}`,
      "",
      "PROVAS ANEXADAS E LIDAS:",
      linhasProvas.length ? linhasProvas.join("\n") : "Nenhuma prova documental anexada.",
      "",
      "RELATO ESCRITO PELO PRÓPRIO CLIENTE:",
      reg.relato_cliente || "(não escreveu)",
      "",
      "CONTEXTO DE RISCO INFORMADO:",
      reg.contexto_risco || "(não informado)",
      "",
      ...((acrescimos ?? []).length
        ? [
          "FATOS ACRESCENTADOS DEPOIS PELO CLIENTE (em ordem de envio — todos devem entrar no relato):",
          ...(acrescimos ?? []).map((a: any, i: number) =>
            `(${i + 1}) em ${dataBR(String(a.created_at).slice(0, 10))}: ${a.texto}`
          ),
          "",
        ]
        : []),
      "Produza agora os DOIS textos, com os marcadores ===RELATO=== e ===BO===.",
    ].filter((l) => l !== "").join("\n");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "IA indisponível no momento." }, 500);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contextoUsuario },
        ],
      }),
    });

    if (aiResp.status === 429) return json({ error: "Muitas solicitações agora. Tente em instantes." }, 429);
    if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("[qa-efetiva-narrativa] gateway:", aiResp.status, t.slice(0, 400));
      return json({ error: "Não foi possível montar o relato agora." }, 502);
    }

    const payload = await aiResp.json();
    const bruto = String(payload?.choices?.[0]?.message?.content ?? "").trim();
    if (!bruto) return json({ error: "A IA não devolveu texto. Tente novamente." }, 502);

    const { narrativa, textoBo } = separarBlocos(bruto);
    if (!narrativa) return json({ error: "A IA não devolveu texto. Tente novamente." }, 502);

    const { error: erroUpdate } = await sb
      .from("qa_efetiva_necessidade")
      .update({
        narrativa_gerada: narrativa,
        narrativa_gerada_em: new Date().toISOString(),
        texto_bo: textoBo || null,
        texto_bo_gerado_em: textoBo ? new Date().toISOString() : null,
        texto_bo_editado_pelo_cliente: false,
        bo_pendente_registro: Boolean(textoBo),
        versao: Number(reg.versao ?? 1) + ((acrescimos ?? []).length ? 1 : 0),
        status: "aguardando_aprovacao",
        updated_at: new Date().toISOString(),
      })
      .eq("id", registro_id);
    if (erroUpdate) {
      console.error("[qa-efetiva-narrativa] update:", erroUpdate.message);
      return json({ error: "Não foi possível salvar o relato gerado." }, 500);
    }

    return json({ ok: true, narrativa, texto_bo: textoBo });
  } catch (e) {
    console.error("[qa-efetiva-narrativa]", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
// qa-modelo-aprovado-criar
// Promove um documento de processo aprovado a "modelo aprovado" para
// alimentar o aprendizado supervisionado da IA de validação.
//
// Fluxo:
//  1. Recebe { documento_id }.
//  2. Verifica que o documento existe e está aprovado.
//  3. Reusa texto_ocr_extraido (gravado pelo validador). Se vazio, tenta
//     extrair do PDF agora.
//  4. Gera embedding do texto via Lovable AI (text-embedding-004 = 768 dim).
//  5. Extrai palavras-chave dominantes (top tokens >= 4 chars).
//  6. Insere em qa_documentos_modelos_aprovados.
//  7. Marca qa_processo_documentos.usado_como_modelo = true.

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { gerarEmbedding, explicarFalhaEmbedding } from "../_shared/embedding.ts";
// @ts-ignore esm.sh fornece tipos mínimos
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function extractPdfText(supabase: any, path: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage.from("qa-processo-docs").download(path);
    if (error || !data) return "";
    const arr = new Uint8Array(await data.arrayBuffer());
    const pdf = await getDocumentProxy(arr);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n").trim() : String(text ?? "").trim();
  } catch {
    return "";
  }
}

function normalizar(s: string): string {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "DE","DA","DO","DAS","DOS","E","O","A","OS","AS","UM","UMA","NA","NO","NAS","NOS",
  "EM","COM","POR","PARA","SEM","SOB","SOBRE","ATE","ENTRE","COMO","SE","OU","SER",
  "QUE","QUAL","QUAIS","ESTE","ESTA","ESSE","ESSA","ESSES","ESSAS","TODOS","CADA",
  "PELO","PELA","PELOS","PELAS","SUA","SEU","SUAS","SEUS","DESTA","DESTE","NESSE",
  "MAIS","MENOS","MUITO","POUCO","ANO","ANOS","DIA","DIAS","MES","MESES",
  "HORA","HORAS","JA","NAO","SIM","TAMBEM","ATRAVES","CONFORME","REFERENTE",
]);

function topKeywords(texto: string, max = 30): string[] {
  const tokens = normalizar(texto).split(" ").filter((t) => t.length >= 4 && !STOP.has(t));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const guard = await (await import("../_shared/qaAuth.ts")).requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const { documento_id, nome_modelo, observacoes, backfill, limite, excluir } = await req.json();

    const supabase = createClient(url, service);

    // ─── MODO BACKFILL ──────────────────────────────────────────────────
    // Preenche o embedding dos modelos que ficaram sem ele enquanto a geracao
    // falhava em silencio (20 de 20 ate 14/08/2026).
    //
    // Mora AQUI, e nao numa funcao propria, de proposito: uma funcao nova nao
    // sobe junto com o site no fluxo do Lovable, e a chamada morre com "Failed
    // to send a request to the Edge Function". Esta funcao ja esta publicada ha
    // meses, entao o modo novo viaja junto com o codigo dela.
    if (backfill === true) {
      // LOTE PEQUENO, DE PROPOSITO. O modelo gte-small carrega na memoria da
      // funcao; processar 20 documentos numa invocacao estoura o limite de
      // recursos do worker (WORKER_RESOURCE_LIMIT, medido em 14/08/2026 —
      // morreu depois de 2). Quem repete ate o fim e o cliente, chamando em
      // sequencia; aqui o teto e baixo por seguranca.
      const max = Math.min(Number(limite) || 3, 5);

      // IDs que ja falharam de forma definitiva (texto curto demais, por ex.).
      // Sem isto a mesma leva voltaria a cada chamada e o processo nunca
      // avancaria: era o motivo de eu ter de parar o laco quando um lote
      // inteiro falhava.
      const ignorar: string[] = Array.isArray(excluir)
        ? excluir.filter((x: unknown) => typeof x === "string").slice(0, 500)
        : [];
      const listaIgnorar = ignorar.length
        ? `(${ignorar.map((id) => `"${id}"`).join(",")})`
        : null;

      // `ativo = true` para bater com o que a comparacao realmente usa
      // (match_qa_modelos_aprovados filtra ativo) e com a contagem da tela.
      let consulta = supabase
        .from("qa_documentos_modelos_aprovados")
        .select("id, nome_modelo, texto_ocr_normalizado")
        .is("embedding_texto", null)
        .eq("ativo", true);
      if (listaIgnorar) consulta = consulta.not("id", "in", listaIgnorar);
      const { data: pendentes, error: selErr } = await consulta.limit(max);
      if (selErr) return json({ error: selErr.message }, 500);

      const alvos = pendentes ?? [];
      let gerados = 0;
      const falhas: Array<{ id: string; nome: string | null; motivo: string }> = [];

      for (const m of alvos) {
        const emb = await gerarEmbedding(String(m.texto_ocr_normalizado ?? ""));
        if (!emb.ok) {
          falhas.push({ id: m.id, nome: m.nome_modelo, motivo: explicarFalhaEmbedding(emb.motivo) });
          continue;
        }
        const { error: updErr } = await supabase
          .from("qa_documentos_modelos_aprovados")
          .update({ embedding_texto: emb.vetor as unknown as string })
          .eq("id", m.id);
        if (updErr) {
          falhas.push({ id: m.id, nome: m.nome_modelo, motivo: updErr.message });
          continue;
        }
        gerados++;
      }

      let contagem = supabase
        .from("qa_documentos_modelos_aprovados")
        .select("id", { count: "exact", head: true })
        .is("embedding_texto", null)
        .eq("ativo", true);
      if (listaIgnorar) contagem = contagem.not("id", "in", listaIgnorar);
      const { count: restantes } = await contagem;

      return json({
        ok: true,
        backfill: true,
        pendentes: alvos.length,
        gerados,
        falhas,
        restantes: restantes ?? 0,
      });
    }

    if (!documento_id) return json({ error: "documento_id obrigatório" }, 400);

    const { data: doc, error: docErr } = await supabase
      .from("qa_processo_documentos")
      .select("id, tipo_documento, nome_documento, status, arquivo_storage_key, dados_extraidos_json, texto_ocr_extraido, orgao_emissor, usado_como_modelo")
      .eq("id", documento_id)
      .maybeSingle();
    if (docErr || !doc) return json({ error: "Documento não encontrado" }, 404);
    if (doc.status !== "aprovado") {
      return json({ error: "Apenas documentos APROVADOS podem virar modelo." }, 400);
    }

    // Proteção dura contra duplicidade: se já existe modelo para este documento_origem_id,
    // devolve 409 com mensagem amigável (UI continua mostrando "MODELO APROVADO").
    if (doc.usado_como_modelo) {
      return json({ error: "Este documento já foi usado como modelo aprovado." }, 409);
    }
    {
      const { data: existente } = await supabase
        .from("qa_documentos_modelos_aprovados")
        .select("id")
        .eq("documento_origem_id", doc.id)
        .maybeSingle();
      if (existente) {
        // Garante a flag e retorna OK silencioso
        await supabase.from("qa_processo_documentos")
          .update({ usado_como_modelo: true })
          .eq("id", doc.id);
        return json({ error: "Este documento já foi usado como modelo aprovado." }, 409);
      }
    }

    // 1) Texto OCR — usa o salvo, ou re-extrai
    let texto = String(doc.texto_ocr_extraido ?? "").trim();
    if (!texto && doc.arquivo_storage_key) {
      texto = await extractPdfText(supabase, doc.arquivo_storage_key);
    }
    if (!texto || texto.length < 30) {
      return json({ error: "Não foi possível extrair texto do documento para gerar modelo." }, 422);
    }

    const textoNorm = normalizar(texto).slice(0, 12000);
    const palavrasChave = topKeywords(textoNorm, 40);
    // Embedding LOCAL. Se falhar, o modelo AINDA e gravado (o trabalho de
    // aprovacao nao se perde), mas a falha volta para a tela em vez de sumir.
    const emb = await gerarEmbedding(textoNorm);
    const embedding = emb.ok ? emb.vetor : null;
    const embeddingAviso = emb.ok ? null : explicarFalhaEmbedding(emb.motivo);
    if (!emb.ok) console.warn("[modelo-aprovado] embedding falhou:", emb.motivo);

    // 2) Insere modelo
    const { data: novo, error: insErr } = await supabase
      .from("qa_documentos_modelos_aprovados")
      .insert({
        tipo_documento: doc.tipo_documento,
        nome_modelo: nome_modelo || doc.nome_documento || doc.tipo_documento,
        origem_emissora: doc.orgao_emissor ?? null,
        documento_origem_id: doc.id,
        texto_ocr_normalizado: textoNorm,
        palavras_chave_json: palavrasChave,
        campos_esperados_json: doc.dados_extraidos_json ?? {},
        embedding_texto: embedding as any,
        aprovado_por: guard.userId,
        observacoes: observacoes ?? null,
      })
      .select("id")
      .single();
    if (insErr) {
      // 23505 = unique_violation (índice único parcial sobre documento_origem_id)
      if ((insErr as any).code === "23505") {
        await supabase.from("qa_processo_documentos")
          .update({ usado_como_modelo: true })
          .eq("id", doc.id);
        return json({ error: "Este documento já foi usado como modelo aprovado." }, 409);
      }
      return json({ error: insErr.message }, 500);
    }

    await supabase.from("qa_processo_documentos")
      .update({ usado_como_modelo: true, texto_ocr_extraido: texto })
      .eq("id", doc.id);

    await supabase.from("qa_processo_eventos").insert({
      processo_id: null,
      documento_id: doc.id,
      tipo_evento: "modelo_aprovado_criado",
      descricao: `Documento "${doc.nome_documento}" promovido a modelo aprovado.`,
      dados_json: { modelo_id: novo.id, tipo: doc.tipo_documento, com_embedding: !!embedding },
      ator: "equipe",
    }).then(() => {}, () => {}); // não bloqueia se evento falhar

    return json({ ok: true, modelo_id: novo.id, com_embedding: !!embedding, embedding_aviso: embeddingAviso, palavras_chave: palavrasChave.length });
  } catch (e) {
    console.error("[modelo-aprovado] erro:", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});

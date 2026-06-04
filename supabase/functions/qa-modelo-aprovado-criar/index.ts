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

async function gerarEmbedding(texto: string, lovableKey: string): Promise<number[] | null> {
  try {
    const trimmed = (texto || "").slice(0, 8000);
    if (trimmed.length < 20) return null;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableKey}` },
      body: JSON.stringify({ model: "google/text-embedding-004", input: trimmed }),
    });
    if (!resp.ok) {
      console.warn("[modelo-aprovado] embedding falhou:", resp.status, await resp.text());
      return null;
    }
    const j = await resp.json();
    const v = j?.data?.[0]?.embedding;
    return Array.isArray(v) ? v : null;
  } catch (e) {
    console.warn("[modelo-aprovado] embedding erro:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const guard = await (await import("../_shared/qaAuth.ts")).requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const { documento_id, nome_modelo, observacoes } = await req.json();
    if (!documento_id) return json({ error: "documento_id obrigatório" }, 400);

    const supabase = createClient(url, service);

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
    const embedding = await gerarEmbedding(textoNorm, lovableKey);

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

    return json({ ok: true, modelo_id: novo.id, com_embedding: !!embedding, palavras_chave: palavrasChave.length });
  } catch (e) {
    console.error("[modelo-aprovado] erro:", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});

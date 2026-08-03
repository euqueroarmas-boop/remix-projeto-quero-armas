// qa-modelo-biblioteca-treinar
// Treina um MODELO DE REFERÊNCIA do parser a partir de um arquivo enviado
// direto na Biblioteca de Documentos (não vem de processo de cliente).
//
// Fluxo:
//  1. Recebe { codigo, nome_modelo, storage_path, origem_emissora?, observacoes? }
//  2. Baixa o arquivo de qa-processo-docs
//  3. ANÁLISE DETERMINÍSTICA: extrai texto (unpdf p/ PDF, OCR Gemini p/ imagem),
//     normaliza e calcula palavras-chave dominantes
//  4. ANÁLISE IA: gera embedding do texto normalizado
//  5. Grava em qa_documentos_modelos_aprovados (tipo_documento = codigo)

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

function topKeywords(texto: string, max = 40): string[] {
  const tokens = normalizar(texto).split(" ").filter((t) => t.length >= 4 && !STOP.has(t));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([k]) => k);
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function ocrImagem(bytes: Uint8Array, mime: string, key: string): Promise<string> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Transcreva TODO o texto visível deste documento, sem comentários." },
            { type: "image_url", image_url: { url: `data:${mime};base64,${toBase64(bytes)}` } },
          ],
        }],
      }),
    });
    if (!resp.ok) return "";
    const j = await resp.json();
    return String(j?.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return "";
  }
}

async function gerarEmbedding(texto: string, key: string): Promise<number[] | null> {
  try {
    const trimmed = (texto || "").slice(0, 8000);
    if (trimmed.length < 20) return null;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "google/text-embedding-004", input: trimmed }),
    });
    if (!resp.ok) return null;
    const j = await resp.json();
    const v = j?.data?.[0]?.embedding;
    return Array.isArray(v) ? v : null;
  } catch {
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

    const { codigo, nome_modelo, storage_path, origem_emissora, observacoes } = await req.json();
    if (!codigo || !storage_path) return json({ error: "codigo e storage_path são obrigatórios" }, 400);

    const supabase = createClient(url, service);

    const { data: blob, error: dlErr } = await supabase.storage.from("qa-processo-docs").download(storage_path);
    if (dlErr || !blob) return json({ error: "Arquivo não encontrado no storage" }, 404);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const isPdf = String(storage_path).toLowerCase().endsWith(".pdf");

    let texto = "";
    if (isPdf) {
      try {
        const pdf = await getDocumentProxy(bytes);
        const { text } = await extractText(pdf, { mergePages: true });
        texto = Array.isArray(text) ? text.join("\n").trim() : String(text ?? "").trim();
      } catch { texto = ""; }
    }
    if (texto.length < 30) {
      const mime = isPdf ? "application/pdf" : (blob.type || "image/jpeg");
      texto = await ocrImagem(bytes, mime, lovableKey);
    }
    if (!texto || texto.length < 30) {
      return json({ error: "Não foi possível extrair texto suficiente deste arquivo." }, 422);
    }

    const textoNorm = normalizar(texto).slice(0, 12000);
    const palavrasChave = topKeywords(textoNorm, 40);
    const embedding = await gerarEmbedding(textoNorm, lovableKey);

    const { data: novo, error: insErr } = await supabase
      .from("qa_documentos_modelos_aprovados")
      .insert({
        tipo_documento: String(codigo),
        nome_modelo: nome_modelo || String(codigo),
        origem_emissora: origem_emissora ?? null,
        texto_ocr_normalizado: textoNorm,
        palavras_chave_json: palavrasChave,
        campos_esperados_json: {},
        layout_fingerprint_json: { origem: "biblioteca", storage_path, bytes: bytes.length },
        embedding_texto: embedding as any,
        aprovado_por: guard.userId,
        observacoes: observacoes ?? "MODELO ENVIADO PELA BIBLIOTECA DE DOCUMENTOS",
      })
      .select("id")
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    return json({
      ok: true,
      modelo_id: novo.id,
      deterministico: palavrasChave.length > 0,
      ia: !!embedding,
      palavras_chave: palavrasChave.length,
    });
  } catch (e) {
    console.error("[modelo-biblioteca] erro:", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});

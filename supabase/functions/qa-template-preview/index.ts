// ============================================================================
// qa-template-preview — leitura segura do conteúdo de um .docx armazenado em
// qa-templates/declaracoes/. Apenas Equipe Quero Armas (perfil ativo em
// qa_usuarios_perfis) pode chamar. Nunca expõe URL direta do Storage.
// ----------------------------------------------------------------------------
// Entrada (JSON): { template_key: string }
// Saída (JSON):  { template_key, filename, size, updated_at, text, paragraphs,
//                  placeholders_found, unknown_placeholders, official_placeholders,
//                  missing_placeholders, usage_count, usage }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore — JSZip ships .d.ts for browser; runtime works fine on Deno.
import JSZip from "https://esm.sh/jszip@3.10.1";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";

const BUCKET = "qa-templates";
const PREFIX = "declaracoes";

// Lista oficial — espelho do front (QAModelosDeclaracaoPage.tsx) acrescida
// dos marcadores extras solicitados.
const OFFICIAL_PLACEHOLDERS = [
  "[NOME COMPLETO]",
  "[NACIONALIDADE]",
  "[NATURALIDADE]",
  "[DATA NASCIMENTO]",
  "[PROFISSÃO]",
  "[ESTADO CIVIL]",
  "[CPF]",
  "[RG]",
  "[EMISSOR]",
  "[ENDEREÇO 1]",
  "[ENDEREÇO 2]",
  "[CIDADE]",
  "[DIA]",
  "[MÊS]",
  "[ANO]",
  "[EXPEDIÇÃO RG]",
  "[DATA EXPEDIÇÃO RG]",
  "[UF EMISSOR RG]",
];

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...qaAuthCors, "Content-Type": "application/json" },
  });
}

function sanitizeTemplateKey(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const t = input.trim().replace(/\.docx$/i, "");
  if (!t) return null;
  // só letras, números, underscore e hífen — impede path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return null;
  return t;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

/**
 * Extrai parágrafos do word/document.xml. Para cada `<w:p>`, concatena o texto
 * de todos os `<w:t>` filhos e trata `<w:tab/>` / `<w:br/>` como separadores.
 */
function extractParagraphs(xml: string): string[] {
  const paras: string[] = [];
  const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(xml)) !== null) {
    const inner = m[1];
    // junta o texto de cada <w:t>...</w:t>
    let buf = "";
    const tRe = /<w:(t|tab|br)\b[^>]*\/?>(?:([\s\S]*?)<\/w:\1>)?/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(inner)) !== null) {
      const tag = tm[1];
      if (tag === "tab") buf += "\t";
      else if (tag === "br") buf += "\n";
      else buf += tm[2] ?? "";
    }
    const text = decodeEntities(buf).replace(/\s+/g, " ").trim();
    paras.push(text);
  }
  return paras;
}

const PLACEHOLDER_RE = /\[[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 ]+?\]/g;

function classifyPlaceholders(text: string) {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_RE.exec(text)) !== null) found.add(m[0]);
  const foundArr = Array.from(found);
  const placeholders_found = foundArr.filter((p) => OFFICIAL_PLACEHOLDERS.includes(p));
  const unknown_placeholders = foundArr.filter((p) => !OFFICIAL_PLACEHOLDERS.includes(p));
  const missing_placeholders = OFFICIAL_PLACEHOLDERS.filter((p) => !found.has(p));
  return { placeholders_found, unknown_placeholders, missing_placeholders };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: qaAuthCors });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const guard = await requireQAStaff(req);
  if (!guard.ok) return guard.response;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const tplKey = sanitizeTemplateKey(body?.template_key);
  if (!tplKey) {
    return json({ error: "template_key inválido" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);

  const filename = `${tplKey}.docx`;
  const objectPath = `${PREFIX}/${filename}`;

  // Metadata via list (size, updated_at).
  const { data: listing, error: listErr } = await admin.storage
    .from(BUCKET)
    .list(PREFIX, { limit: 1000, search: filename });
  if (listErr) {
    return json({ error: "Falha ao consultar Storage", detail: listErr.message }, 500);
  }
  const meta = (listing || []).find((f: any) => f.name === filename);
  if (!meta) {
    return json({ error: "Template não encontrado" }, 404);
  }

  // Download do arquivo.
  const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(objectPath);
  if (dlErr || !blob) {
    return json({ error: "Não foi possível baixar o template", detail: dlErr?.message }, 500);
  }

  let paragraphs: string[] = [];
  let text = "";
  try {
    const buf = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const docFile = zip.file("word/document.xml");
    if (!docFile) {
      return json({ error: "DOCX inválido: word/document.xml ausente" }, 422);
    }
    const xml = await docFile.async("string");
    paragraphs = extractParagraphs(xml).filter((p) => p.length > 0);
    text = paragraphs.join("\n");
  } catch (e: any) {
    return json({ error: "Falha ao extrair conteúdo do DOCX", detail: e?.message }, 500);
  }

  const { placeholders_found, unknown_placeholders, missing_placeholders } =
    classifyPlaceholders(text);

  // Contagem de uso a partir de qa_servicos_documentos.
  let usage: Array<{ id: string; servico_id: string | null; tipo_documento: string | null; nome_servico: string | null }> = [];
  try {
    const [{ data: exigencias }, { data: servicos }] = await Promise.all([
      admin
        .from("qa_servicos_documentos")
        .select("id, servico_id, tipo_documento, regra_validacao, ativo")
        .eq("ativo", true),
      admin.from("qa_servicos").select("id, nome"),
    ]);
    const sm = new Map<string, string>();
    (servicos || []).forEach((s: any) => sm.set(s.id, s.nome));
    const matches = (exigencias || []).filter((e: any) => {
      const rv = e.regra_validacao || {};
      if (rv.template_key === tplKey) return true;
      if (Array.isArray(rv.template_quando)) {
        return rv.template_quando.some((t: any) => t?.template_key === tplKey);
      }
      return false;
    });
    usage = matches.map((e: any) => ({
      id: e.id,
      servico_id: e.servico_id,
      tipo_documento: e.tipo_documento,
      nome_servico: sm.get(e.servico_id) ?? null,
    }));
  } catch {
    /* uso é informativo — falhar aqui não deve quebrar o preview */
  }

  return json({
    template_key: tplKey,
    filename,
    size: (meta as any)?.metadata?.size ?? null,
    updated_at: (meta as any)?.updated_at ?? (meta as any)?.created_at ?? null,
    text,
    paragraphs,
    official_placeholders: OFFICIAL_PLACEHOLDERS,
    placeholders_found,
    unknown_placeholders,
    missing_placeholders,
    usage_count: usage.length,
    usage,
  });
});
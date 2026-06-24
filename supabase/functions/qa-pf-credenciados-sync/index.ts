// Sincroniza listas oficiais da PF: psicólogos e instrutores de tiro credenciados.
// Faz scrape das 54 páginas (27 UFs × 2 tipos), parseia e upserta em qa_pf_credenciados.
// Geocodificação é feita sob demanda no qa-pf-credenciados-buscar (lazy).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UFS: Array<[string, string]> = [
  ["AC", "acre"], ["AL", "alagoas"], ["AP", "amapa"], ["AM", "amazonas"],
  ["BA", "bahia"], ["CE", "ceara"], ["DF", "distrito-federal"], ["ES", "espirito-santo"],
  ["GO", "goias"], ["MA", "maranhao"], ["MT", "mato-grosso"], ["MS", "mato-grosso-do-sul"],
  ["MG", "minas-gerais"], ["PA", "para"], ["PB", "paraiba"], ["PR", "parana"],
  ["PE", "pernambuco"], ["PI", "piaui"], ["RJ", "rio-de-janeiro"], ["RN", "rio-grande-do-norte"],
  ["RS", "rio-grande-do-sul"], ["RO", "rondonia"], ["RR", "roraima"], ["SC", "santa-catarina"],
  ["SP", "sao-paulo"], ["SE", "sergipe"], ["TO", "tocantins"],
];

const BASE: Record<string, (slug: string) => string> = {
  psicologo: (slug) => `https://www.gov.br/pf/pt-br/assuntos/armas/psicologos/psicologos-crediciados/${slug}`,
  instrutor_tiro: (slug) => `https://www.gov.br/pf/pt-br/assuntos/armas/instrutores-de-armamento-e-tiro/credenciados/${slug}`,
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é").replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó").replace(/&uacute;/gi, "ú").replace(/&atilde;/gi, "ã")
    .replace(/&otilde;/gi, "õ").replace(/&ccedil;/gi, "ç").replace(/&Aacute;/gi, "Á")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// Extrai o miolo do conteúdo Plone (gov.br) — bloco entre os marcadores de cabeçalho/footer
function extractContent(html: string): string {
  const m = html.match(/<div[^>]+id=["']parent-fieldname-text["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]+id=["']viewlet|<\/article|<footer)/i)
    || html.match(/<div[^>]+id=["']content-core["'][^>]*>([\s\S]*?)<\/article>/i)
    || html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  return m ? m[1] : html;
}

// Identifica linhas que são apenas cabeçalho de bairro/cidade (uma linha em negrito sozinha)
// Estratégia: dentro do bloco, percorremos <p> e <strong>. Linhas curtas em CAIXA ALTA sem ":" e sem dígitos longos viram heading.
function isHeadingLine(line: string, isBoldOnly: boolean): boolean {
  const t = line.trim();
  if (!t) return false;
  if (!isBoldOnly) return false;
  if (t.length > 80) return false;
  if (/CRP|CR\s*\d|Validade|End\.|Tel\.|E-?mail|@/i.test(t)) return false;
  // tipicamente em CAIXA ALTA
  const letters = t.replace(/[^A-ZÁÉÍÓÚÂÊÔÃÕÇ]/g, "");
  return letters.length >= Math.max(3, Math.floor(t.replace(/\s/g, "").length * 0.6));
}

// Quebra o HTML em "linhas" preservando marcação de bold via prefixo \u0001
function htmlToMarkedLines(html: string): Array<{ text: string; bold: boolean }> {
  // Substitui <strong>...</strong> e <b>...</b> por marcadores
  const marked = html
    .replace(/<\/(strong|b)>/gi, "\u0002")
    .replace(/<(strong|b)[^>]*>/gi, "\u0001");
  const text = stripTags(marked);
  const lines: Array<{ text: string; bold: boolean }> = [];
  text.split(/\n+/).forEach((raw) => {
    const trimmed = raw.replace(/\s+/g, " ").trim();
    if (!trimmed) return;
    // Bold se todo o conteúdo está dentro de \u0001...\u0002
    const stripped = trimmed.replace(/[\u0001\u0002]/g, "").trim();
    const boldRanges = trimmed.match(/\u0001([^\u0002]*)\u0002/g) || [];
    const boldChars = boldRanges.join("").replace(/[\u0001\u0002]/g, "").trim();
    const isBold = boldChars.length > 0 && boldChars.length >= stripped.length * 0.8;
    if (stripped) lines.push({ text: stripped, bold: isBold });
  });
  return lines;
}

type Entry = {
  uf: string;
  cidade: string | null;
  bairro: string | null;
  nome: string;
  registro: string | null;
  endereco: string | null;
  telefones: string[];
  emails: string[];
  validade: string | null;
  validade_label: string | null;
  source_url: string;
  raw_block: string;
  hash_conteudo: string;
};

function normalizePhone(s: string): string[] {
  const re = /\(?(\d{2})\)?\s*(\d{4,5})[-\s]?(\d{4})/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out.push(`(${m[1]}) ${m[2]}-${m[3]}`);
  }
  return Array.from(new Set(out));
}

function extractEmails(s: string): string[] {
  const re = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  return Array.from(new Set((s.match(re) || []).map((e) => e.toLowerCase())));
}

function parseValidade(s: string): { date: string | null; label: string | null } {
  const m = s.match(/Validade[^:]*:\s*(.+)$/i);
  if (!m) return { date: null, label: null };
  const label = m[1].trim();
  const d = label.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (d) return { date: `${d[3]}-${d[2]}-${d[1]}`, label };
  return { date: null, label };
}

async function parseEntries(html: string, uf: string, sourceUrl: string): Promise<Entry[]> {
  const content = extractContent(html);
  const lines = htmlToMarkedLines(content);
  const entries: Entry[] = [];
  let cidade: string | null = null;
  let bairro: string | null = null;
  let currentBlock: string[] = [];

  const flush = async () => {
    if (currentBlock.length === 0) return;
    const block = currentBlock.join("\n");
    currentBlock = [];
    const first = block.split("\n")[0].trim();
    // Espera "NOME - CRP XX/XXXX" ou "NOME - CR XXX"
    const nameMatch = first.match(/^(.+?)\s*[-–—]\s*(CRP|CR)\s*([\w./-]+)$/i);
    let nome = first;
    let registro: string | null = null;
    if (nameMatch) {
      nome = nameMatch[1].trim();
      registro = `${nameMatch[2].toUpperCase()} ${nameMatch[3]}`;
    }
    if (!nome || nome.length < 3) return;
    if (/^psic[óo]logos/i.test(nome) || /credenciados/i.test(nome)) return;

    const endMatch = block.match(/End\.?\s*:\s*(.+?)(?:\n|$)/i);
    const endereco = endMatch ? endMatch[1].trim() : null;
    const telefones = normalizePhone(block);
    const emails = extractEmails(block);
    const { date, label } = parseValidade(block);

    const hash = await sha256(`${uf}|${nome}|${registro || ""}|${endereco || ""}`);
    entries.push({
      uf, cidade, bairro,
      nome, registro, endereco, telefones, emails,
      validade: date, validade_label: label,
      source_url: sourceUrl, raw_block: block, hash_conteudo: hash,
    });
  };

  for (const line of lines) {
    if (isHeadingLine(line.text, line.bold)) {
      await flush();
      // Cidade = primeira heading; bairros subsequentes substituem bairro
      if (!cidade) cidade = line.text;
      else bairro = line.text;
      continue;
    }
    // Início de nova entrada: linha com "- CRP" ou "- CR"
    if (/[-–—]\s*(CRP|CR)\b/i.test(line.text) && currentBlock.length > 0) {
      await flush();
    }
    currentBlock.push(line.text);
  }
  await flush();
  return entries;
}

async function fetchPage(url: string): Promise<string> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html" }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(to); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase: any = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const onlyTipo: string | null = body?.tipo || null;
  const onlyUf: string | null = body?.uf?.toUpperCase?.() || null;

  const { data: logRow } = await supabase
    .from("qa_pf_credenciados_sync_log")
    .insert({ status: "running", detalhes: { onlyTipo, onlyUf } })
    .select("id").single();
  const logId = logRow?.id;

  const errors: Array<{ uf: string; tipo: string; error: string }> = [];
  let totalPages = 0, totalInserted = 0, totalUpdated = 0, totalDeactivated = 0;

  const tipos = onlyTipo ? [onlyTipo] : ["psicologo", "instrutor_tiro"];
  const ufs = onlyUf ? UFS.filter(([u]) => u === onlyUf) : UFS;

  for (const tipo of tipos) {
    for (const [uf, slug] of ufs) {
      const url = BASE[tipo](slug);
      totalPages++;
      try {
        const html = await fetchPage(url);
        const entries = await parseEntries(html, uf, url);
        const hashes = entries.map((e) => e.hash_conteudo);

        // Upsert por (tipo, uf, hash_conteudo)
        if (entries.length > 0) {
          const rows = entries.map((e) => ({ ...e, tipo, ativo: true, fetched_at: new Date().toISOString() }));
          const { error } = await supabase
            .from("qa_pf_credenciados")
            .upsert(rows, { onConflict: "tipo,uf,hash_conteudo" });
          if (error) throw error;
          totalInserted += rows.length;
        }

        // Desativa hashes ausentes
        const { data: existentes } = await supabase
          .from("qa_pf_credenciados")
          .select("id, hash_conteudo")
          .eq("tipo", tipo).eq("uf", uf).eq("ativo", true);
        const toDeactivate = (existentes || []).filter((r: any) => !hashes.includes(r.hash_conteudo));
        if (toDeactivate.length > 0) {
          await supabase.from("qa_pf_credenciados")
            .update({ ativo: false })
            .in("id", toDeactivate.map((r: any) => r.id));
          totalDeactivated += toDeactivate.length;
        }
        console.log(`[sync] ${tipo}/${uf}: ${entries.length} entries`);
        await new Promise((r) => setTimeout(r, 600));
      } catch (err: any) {
        console.error(`[sync] ${tipo}/${uf} erro:`, err.message);
        errors.push({ uf, tipo, error: err.message });
      }
    }
  }

  if (logId) {
    await supabase.from("qa_pf_credenciados_sync_log").update({
      finished_at: new Date().toISOString(),
      status: errors.length === 0 ? "success" : (totalInserted > 0 ? "partial" : "failed"),
      total_paginas: totalPages,
      total_inseridos: totalInserted,
      total_atualizados: totalUpdated,
      total_desativados: totalDeactivated,
      erros: errors,
    }).eq("id", logId);
  }

  return new Response(JSON.stringify({
    ok: true, totalPages, totalInserted, totalDeactivated, errors: errors.length,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
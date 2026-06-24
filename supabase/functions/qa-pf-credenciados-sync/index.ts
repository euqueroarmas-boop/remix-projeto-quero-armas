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

// Coleta cabeçalhos de bairro (strong sozinho em CAIXA ALTA) e suas posições no texto plano,
// para podermos associar cada entrada ao bairro mais próximo acima dela.
function collectBairros(html: string): Array<{ pos: number; nome: string }> {
  // Texto plano sem qualquer tag (para alinhar com o que parseEntries usará)
  const plain = stripTags(html.replace(/<(strong|b)[^>]*>/gi, "\u0001").replace(/<\/(strong|b)>/gi, "\u0002"));
  const result: Array<{ pos: number; nome: string }> = [];
  const re = /\u0001([^\u0002]{1,80})\u0002/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plain)) !== null) {
    const raw = m[1].replace(/[\u0001\u0002]/g, "").replace(/\s+/g, " ").trim();
    if (!raw) continue;
    if (raw.length > 80) continue;
    if (/CRP|CR\s*\d|Validade|End\.|Tel\.|E-?mail|@/i.test(raw)) continue;
    const letters = raw.replace(/[^A-ZÁÉÍÓÚÂÊÔÃÕÇ]/g, "");
    const total = raw.replace(/\s/g, "").length;
    if (letters.length < Math.max(3, Math.floor(total * 0.6))) continue;
    // Posição no texto SEM os marcadores
    const beforeMarkers = plain.slice(0, m.index).replace(/[\u0001\u0002]/g, "").length;
    result.push({ pos: beforeMarkers, nome: raw });
  }
  return result;
}

function plainText(html: string): string {
  return stripTags(html).replace(/\u0001|\u0002/g, "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n");
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
  const bairros = collectBairros(content);
  let text = plainText(content);
  // Insere quebras de linha onde bairros aparecem para que não vazem para o nome da próxima entrada.
  // Faz isto preservando o título do bairro como marcador (será limpo abaixo).
  for (const b of bairros) {
    const safe = b.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\s*${safe}\\s*`, "g"), `\n${b.nome}\n`);
  }
  const bairrosSet = new Set(bairros.map((b) => b.nome));
  const entries: Entry[] = [];

  // Cidade = nome da UF (heading principal da página) — para SP/RJ o "bairro" será o bairro real,
  // para interior o "bairro" tende a ser o município. O frontend mostra ambos.
  const cidade: string | null = null;

  // Cada entrada termina em "Validade do (Credenciamento|Certificado): DD/MM/AAAA".
  // Usamos isso como delimitador para isolar cada registro.
  const reEntry = /([\s\S]*?Validade d[oa]\s+(?:Credenciamento|Certificado)[^:]*:\s*(\d{2})\/(\d{2})\/(\d{4}))/gi;
  let m: RegExpExecArray | null;
  let cursor = 0;
  while ((m = reEntry.exec(text)) !== null) {
    const startPos = cursor;
    const endPos = m.index + m[0].length;
    cursor = endPos;
    let block = m[0];

    // Localiza nome+registro DENTRO do bloco — pegamos a ÚLTIMA ocorrência de "<nome> - CRP XX/XXXX"
    // (a última, porque restos do registro anterior podem aparecer no início)
    const reName = /([A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç'.\s-]{2,80}?)\s*[-–—]\s*(CRP|CR)\s*([\w./-]+)/g;
    let nameMatch: RegExpExecArray | null = null;
    let last: RegExpExecArray | null = null;
    while ((nameMatch = reName.exec(block)) !== null) last = nameMatch;
    if (!last) continue;
    const nome = last[1].replace(/\s+/g, " ").trim();
    const registro = `${last[2].toUpperCase()} ${last[3]}`.trim();
    if (!nome || nome.length < 3) continue;
    if (/^psic[óo]logos|credenciados$/i.test(nome)) continue;
    // Pega só do nome em diante (descarta restos do registro anterior)
    block = block.slice(last.index);

    // Endereço: após "End." até próximo separador Tel./Tels./E-mail/Validade
    let endereco: string | null = null;
    const endMatch = block.match(/End\.?\s*:\s*([\s\S]+?)(?=\s*Tel\.?s?\s*:|\s*E-?mail\s*:|\s*Validade|$)/i);
    if (endMatch) endereco = endMatch[1].replace(/\s+/g, " ").trim();

    const telefones = normalizePhone(block);
    // Email: para no primeiro espaço, "Validade", ou caractere maiúsculo após .com
    const emails = Array.from(new Set(
      (block.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}(?:\.[a-z]{2,4})?/g) || []).map((e) => e.toLowerCase())
    ));
    const validade_label = m[0].match(/Validade d[oa][^:]*:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[0]?.trim() || null;
    const validade = `${m[4]}-${m[3]}-${m[2]}`;

    // Bairro: a heading mais recente antes do início do bloco
    let bairro: string | null = null;
    for (let i = bairros.length - 1; i >= 0; i--) {
      if (bairros[i].pos <= m.index) { bairro = bairros[i].nome; break; }
    }

    const hash = await sha256(`${uf}|${nome.toLowerCase()}|${registro}|${endereco || ""}`);
    entries.push({
      uf, cidade, bairro,
      nome, registro, endereco, telefones, emails,
      validade, validade_label,
      source_url: sourceUrl, raw_block: block.slice(0, 1000), hash_conteudo: hash,
    });
    void startPos;
  }
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
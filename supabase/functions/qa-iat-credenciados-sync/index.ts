// Sincroniza instrutores de armamento e tiro (IAT) credenciados pela PF.
// Processa UMA UF por invocação ({"uf":"SP"}) ou enfileira as 27 ({"uf":"ALL"}).
// Parse-first com pdfjs-dist; fallback Gemini Flash em UFs irregulares.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// pdfjs-serverless: build do pdfjs preparado para Deno/Edge (sem canvas).
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE =
  "https://www.gov.br/pf/pt-br/assuntos/armas/instrutores-de-armamento-e-tiro/credenciados";
const PDF: Record<string, string> = {
  AC: "ac-lista-atualizada-de-iat-credenciados-org.pdf",
  AP: "ap-lista-atualizada-de-iat-credenciado.pdf",
  AM: "am-lista-atualizada-de-iat-credenciado.pdf",
  PA: "pa-lista-atualizada-de-iat-credenciado.pdf",
  RO: "ro-lista-atualizada-de-iat-credenciado.pdf",
  RR: "rr-lista-atualizada-de-iat-credenciado.pdf",
  TO: "to-lista-atualizada-de-iat-credenciado.pdf",
  DF: "df-lista-atualizada-de-iat-credenciado.pdf",
  GO: "go-lista-atualizada-de-iat-credenciado.pdf",
  MT: "mt-lista-atualizada-de-iat-credenciado.pdf",
  MS: "ms-lista-atualizada-de-iat-credenciado.pdf",
  AL: "al-lista-atualizada-de-iat-credenciado.pdf",
  BA: "BAlistaatualizadadeIATcredenciadoJANEIRO2021.pdf",
  CE: "ce-lista-atualizada-de-iat-credenciado.pdf",
  MA: "ma-lista-atualizada-de-iat-credenciado.pdf",
  PB: "pb-lista-atualizada-de-iat-credenciado.pdf",
  PE: "pe-lista-atualizada-de-iat-credenciado.pdf",
  PI: "PI%20-%20listaatualizadadeIATcredenciado.pdf",
  RN: "rn-lista-atualizada-de-iat-credenciado.pdf",
  SE: "se-lista-atualizada-de-iat-credenciado.pdf",
  ES: "es-lista-atualizada-de-iat-credenciado.pdf",
  MG: "mg-lista-atualizada-de-iat-credenciado.pdf",
  RJ: "rj-lista-atualizada-de-iat-credenciado.pdf",
  SP: "SP%20-%20lista%20atualizada%20de%20IAT%20credenciado.pdf",
  PR: "pr-lista-atualizada-de-iat-credenciado.pdf",
  SC: "sc-lista-atualizada-de-iat-credenciado.pdf",
  RS: "rs-lista-atualizada-de-iat-credenciado.pdf",
};

type Item = { str: string; x: number; y: number };
const RE = {
  emailFull: /[\w.+-]+@[\w-]+\.[\w.-]+/i,
  arroba: /@/,
  data: /\b\d{2}\/\d{2}\/\d{4}\b/,
  portaria: /^\d{1,4}\/\d{4}$/,
};
const HEADER_LABELS: [RegExp, string][] = [
  [/INSTRUTOR|CREDENCIAD|NOME/i, "nome"],
  [/TELEFONE|FONE|CONTATO/i, "telefone"],
  [/MAIL/i, "email"],
  [/ENDERE|CLUBE|LOCAL/i, "endereco"],
  [/PORTARIA/i, "portaria"],
  [/VALIDADE|VENCIMENTO/i, "validade"],
];
const Y_TOL = 3;

function agruparLinhas(items: Item[]) {
  const linhas: { y: number; items: Item[] }[] = [];
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (!it.str.trim()) continue;
    const l = linhas.find((l) => Math.abs(l.y - it.y) <= Y_TOL);
    if (l) l.items.push(it);
    else linhas.push({ y: it.y, items: [it] });
  }
  for (const l of linhas) l.items.sort((a, b) => a.x - b.x);
  return linhas;
}
const mediana = (xs: number[]) =>
  xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null;

function ehLinhaDeDados(l: { items: Item[] }) {
  const txt = l.items.map((i) => i.str).join(" ");
  return RE.arroba.test(txt) || (txt.match(/\d/g) || []).length >= 10;
}
function colunasDoCabecalho(linhas: { items: Item[] }[]) {
  for (const l of linhas) {
    const txt = l.items.map((i) => i.str).join(" ");
    if (/TELEFONE/i.test(txt) && /MAIL/i.test(txt)) {
      const keys = new Set<string>();
      for (const it of l.items)
        for (const [re, key] of HEADER_LABELS) if (re.test(it.str)) keys.add(key);
      return keys;
    }
  }
  return new Set(["nome", "telefone", "email", "portaria", "validade"]);
}
function calibrar(dataLinhas: { items: Item[] }[], temEndereco: boolean) {
  const xs: Record<string, number[]> = {
    nome: [], telefone: [], email: [], endereco: [], portaria: [], validade: [],
  };
  for (const l of dataLinhas) {
    xs.nome.push(Math.min(...l.items.map((i) => i.x)));
    let emailX: number | null = null, portX: number | null = null, telX: number | null = null;
    for (const it of l.items) {
      const s = it.str.trim();
      if (RE.arroba.test(s) && emailX === null) { xs.email.push(it.x); emailX = it.x; }
      if (RE.data.test(s)) xs.validade.push(it.x);
      if (RE.portaria.test(s)) { xs.portaria.push(it.x); portX = it.x; }
      if (telX === null && /^\(?\d{2}\)?([\s.\-]?\d|$)/.test(s) && !RE.portaria.test(s) && !RE.data.test(s)) {
        xs.telefone.push(it.x); telX = it.x;
      }
    }
    if (temEndereco && emailX !== null && portX !== null) {
      const cand = l.items.filter((i) => i.x > emailX! + 20 && i.x < portX! - 20 && !RE.arroba.test(i.str));
      if (cand.length) xs.endereco.push(Math.min(...cand.map((i) => i.x)));
    }
  }
  const cols: { key: string; x: number }[] = [];
  const push = (k: string) => { const m = mediana(xs[k]); if (m !== null) cols.push({ key: k, x: m }); };
  push("nome"); push("telefone"); push("email");
  if (temEndereco) push("endereco");
  push("portaria"); push("validade");
  return cols.sort((a, b) => a.x - b.x);
}
function montar(linha: { items: Item[] }, cols: { key: string; x: number }[], uf: string) {
  const buckets: Record<string, string[]> = Object.fromEntries(cols.map((c) => [c.key, []]));
  for (const it of linha.items) {
    let col = cols[0];
    for (const c of cols) if (it.x + 10 >= c.x) col = c;
    buckets[col.key].push(it.str.trim());
  }
  const join = (k: string) => {
    const b = buckets[k] || [];
    return k === "email" || k === "telefone" ? b.join("") : b.join(" ");
  };
  const nome = join("nome").replace(/\s+/g, " ").trim();
  const email = (join("email").match(RE.emailFull) || [])[0] || "";
  const tel = (join("telefone").match(/\d{8,}/) || [])[0] || join("telefone").replace(/\D/g, "");
  const port = (join("portaria").match(/\d{1,4}\/\d{4}/) || [])[0] || "";
  return {
    uf, nome, telefone: tel, email: email.toLowerCase(),
    endereco: cols.some((c) => c.key === "endereco") ? join("endereco").replace(/\s+/g, " ").trim() : "",
    portaria: port, validade: join("validade").replace(/\s+/g, " ").trim(),
  };
}
function parseIat(paginas: Item[][], uf: string) {
  const linhas = paginas.flatMap((items) => agruparLinhas(items));
  const temEndereco = colunasDoCabecalho(linhas).has("endereco");
  const dataLinhas = linhas.filter(ehLinhaDeDados);
  const cols = calibrar(dataLinhas, temEndereco);
  const registros = cols.length
    ? dataLinhas.map((l) => montar(l, cols, uf)).filter((r) => r.nome && (r.telefone || r.email))
    : [];
  return { uf, temEndereco, registros };
}

async function extrairPaginas(bytes: Uint8Array): Promise<Item[][]> {
  const doc = await getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise;
  const paginas: Item[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    paginas.push(
      tc.items
        .filter((i: any) => "str" in i)
        .map((i: any) => ({ str: i.str, x: i.transform[4], y: i.transform[5] })),
    );
  }
  return paginas;
}

type Registro = ReturnType<typeof montar>;

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function extrairComGemini(bytes: Uint8Array, uf: string): Promise<Registro[]> {
  const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY ausente — fallback indisponível");
  const model = "gemini-2.0-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const prompt =
    `Este PDF é a lista oficial da Polícia Federal de instrutores de armamento e tiro (IAT) ` +
    `credenciados no estado ${uf}. Extraia TODOS os instrutores. Para cada um retorne: ` +
    `nome, telefone (só dígitos, com DDD), email, endereco (endereço/clube completo se houver, ` +
    `senão string vazia), portaria (formato nnn/aaaa) e validade (texto como aparece). ` +
    `Quando o mesmo instrutor aparecer em vários clubes, gere uma linha por clube. ` +
    `Ignore cabeçalhos de seção. Não invente dados.`;

  const schema = {
    type: "OBJECT",
    properties: {
      instrutores: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            nome: { type: "STRING" }, telefone: { type: "STRING" }, email: { type: "STRING" },
            endereco: { type: "STRING" }, portaria: { type: "STRING" }, validade: { type: "STRING" },
          },
          required: ["nome"],
        },
      },
    },
    required: ["instrutores"],
  };

  const body = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inline_data: { mime_type: "application/pdf", data: bytesParaBase64(bytes) } },
      ],
    }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 },
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(txt);
  return (parsed.instrutores ?? []).map((r: any) => ({
    uf,
    nome: String(r.nome ?? "").trim(),
    telefone: String(r.telefone ?? "").replace(/\D/g, ""),
    email: String(r.email ?? "").toLowerCase().trim(),
    endereco: String(r.endereco ?? "").trim(),
    portaria: String(r.portaria ?? "").trim(),
    validade: String(r.validade ?? "").trim(),
  })).filter((r: Registro) => r.nome && (r.telefone || r.email));
}

const LIMIAR_MINIMO = 3;

async function sincronizarUF(supabase: any, uf: string) {
  const url = `${BASE}/${PDF[uf]}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download ${uf} HTTP ${resp.status}`);
  const bytes = new Uint8Array(await resp.arrayBuffer());

  let { temEndereco, registros } = parseIat(await extrairPaginas(bytes), uf);
  let status = "ok";
  let mensagem: string | null = null;

  if (registros.length < LIMIAR_MINIMO) {
    try {
      const viaGemini = await extrairComGemini(bytes, uf);
      if (viaGemini.length >= registros.length) {
        registros = viaGemini;
        temEndereco = registros.some((r) => r.endereco);
        status = "fallback_gemini";
        mensagem = `parse fraco -> Gemini (${registros.length})`;
      }
    } catch (e) {
      mensagem = `parse fraco e Gemini falhou: ${String((e as Error)?.message ?? e)}`;
      status = "erro";
    }
  }

  // Snapshot diário: apaga a UF e reinsere preservando lat/lng já geocodados.
  const { data: existentes } = await supabase
    .from("qa_iat_credenciados")
    .select("nome,portaria,lat,lng")
    .eq("uf", uf);
  const geoCache = new Map<string, { lat: number | null; lng: number | null }>();
  for (const e of existentes || []) {
    geoCache.set(`${e.nome}||${e.portaria || ""}`, { lat: e.lat, lng: e.lng });
  }

  await supabase.from("qa_iat_credenciados").delete().eq("uf", uf);
  if (registros.length) {
    const rows = registros.map((r) => {
      const prev = geoCache.get(`${r.nome}||${r.portaria || ""}`);
      return {
        ...r,
        lat: prev?.lat ?? null,
        lng: prev?.lng ?? null,
        fonte_url: url,
        atualizado_em: new Date().toISOString(),
      };
    });
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("qa_iat_credenciados").insert(rows.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
  } else if (status === "ok") {
    status = "erro";
    mensagem = "0 registros (parse e/ou Gemini)";
  }

  await supabase.from("qa_iat_credenciados_sync_log").insert({
    uf, total: registros.length, com_endereco: temEndereco, status, mensagem,
  });
  return { uf, total: registros.length, temEndereco, status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { uf = "ALL" } = await req.json().catch(() => ({}));

    if (uf === "ALL") {
      const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/qa-iat-credenciados-sync`;
      const auth = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
      for (const u of Object.keys(PDF)) {
        fetch(fnUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth },
          body: JSON.stringify({ uf: u }),
        }).catch(() => {});
      }
      return new Response(JSON.stringify({ enfileiradas: Object.keys(PDF).length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!PDF[uf]) {
      return new Response(JSON.stringify({ erro: `UF inválida: ${uf}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const res = await sincronizarUF(supabase, uf);
    return new Response(JSON.stringify(res), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ erro: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
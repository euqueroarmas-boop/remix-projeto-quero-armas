/**
 * qa-contrato-view-public — PÚBLICA (anon)
 *
 * Retorna o HTML renderizado de um contrato pelo UUID.
 * O UUID de 128 bits é o próprio token de acesso — impossível adivinhar.
 * Usado pela página /area-do-cliente/contratos/:id enviada ao cliente por e-mail.
 * Registra evento contrato_visualizado_cliente em qa_contract_events.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { jsPDF } from "npm:jspdf@2.5.1";

const responseCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent",
  "Access-Control-Expose-Headers": "content-disposition, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SessionStamp = {
  ip: string;
  so: string;
  browser: string;
  user_agent: string;
  accept_language: string | null;
  referer: string | null;
  country: string | null;
  registrado_em: string;
  action: string;
};

type Block =
  | { kind: "h1" | "h2" | "h3" | "p" | "li"; text: string }
  | { kind: "hr" };

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é").replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó").replace(/&uacute;/gi, "ú")
    .replace(/&Aacute;/g, "Á").replace(/&Eacute;/g, "É").replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó").replace(/&Uacute;/g, "Ú")
    .replace(/&atilde;/gi, "ã").replace(/&otilde;/gi, "õ")
    .replace(/&Atilde;/g, "Ã").replace(/&Otilde;/g, "Õ")
    .replace(/&acirc;/gi, "â").replace(/&ecirc;/gi, "ê").replace(/&ocirc;/gi, "ô")
    .replace(/&ccedil;/gi, "ç").replace(/&Ccedil;/g, "Ç")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  let src = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<button[\s\S]*?<\/button>/gi, "");
  const bodyMatch = src.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) src = bodyMatch[1];

  const tagRe = /<(h1|h2|h3|p|li|hr)[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src)) !== null) {
    if (m[0].startsWith("<hr")) {
      blocks.push({ kind: "hr" });
      continue;
    }
    const tag = m[1].toLowerCase() as "h1" | "h2" | "h3" | "p" | "li";
    const raw = m[2] || "";
    const text = decodeHtmlEntities(raw.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .trim();
    if (text) blocks.push({ kind: tag, text });
  }

  if (!blocks.length) {
    const text = decodeHtmlEntities(src.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (text) blocks.push({ kind: "p", text });
  }
  return blocks;
}

function sanitizeFilename(name: string): string {
  return String(name || "contrato")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || "contrato";
}

// Mesma l\u00f3gica de qa-serve-contract-pdf \u2014 motor \u00fanico: o nome do arquivo
// baixado (aqui ou no popup do portal) deve sempre incluir o nome do cliente.
function titleCaseName(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      ["da", "de", "do", "das", "dos", "e"].includes(part)
        ? part
        : part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1)
    )
    .join(" ");
}
function shortPersonName(value: string | null | undefined): string {
  const parts = String(value || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length <= 2) return titleCaseName(parts.join(" "));
  return titleCaseName(`${parts[0]} ${parts[parts.length - 1]}`);
}
function contractDownloadFilename(contractNumber: string | null, clienteNome: string): string {
  const numero = String(contractNumber || "CONTRATO").replace(/[\\/:*?"<>|]+/g, " ").trim();
  const cliente = shortPersonName(clienteNome);
  return cliente
    ? `${numero} - Contrato de Adesao Quero Armas - ${cliente}.pdf`
    : `${numero} - Contrato de Adesao Quero Armas.pdf`;
}

function buildSessionStampedPdf(contract: any, html: string, sessao: SessionStamp): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  doc.setProperties({
    title: `${contract.contract_number || "Contrato"} - Contrato de Adesão`,
    subject: `Contrato ${contract.contract_number || contract.id}`,
    author: "Arsenal Inteligente",
    creator: "Arsenal Inteligente",
    keywords: `contrato,${contract.contract_number || ""}`,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginLeft = 104;   // margem esquerda para o carimbo (com respiro até o texto)
  const marginRight = 48;
  const marginTop = 56;
  const marginBottom = 56;
  const marginX = marginLeft; // usado pelas rotinas de escrita
  const contentW = pageW - marginLeft - marginRight;
  let y = marginTop;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  const write = (
    text: string,
    opts: { size: number; bold?: boolean; align?: "left" | "center" | "justify"; upper?: boolean; lineGap?: number; indent?: number; bullet?: string },
  ) => {
    doc.setFont("times", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size);
    const value = opts.upper ? text.toUpperCase() : text;
    const indent = opts.indent || 0;
    const bulletText = opts.bullet ? `${opts.bullet}  ` : "";
    const bulletW = bulletText ? doc.getTextWidth(bulletText) : 0;
    const width = contentW - indent - bulletW;
    const lines = doc.splitTextToSize(value, width) as string[];
    const lineH = opts.size * 1.35;
    ensureSpace(lineH * lines.length + (opts.lineGap ?? 6));
    if (bulletText) doc.text(bulletText, marginX + indent, y + opts.size);
    lines.forEach((line, i) => {
      const textOpts: any = {};
      if (opts.align === "center") textOpts.align = "center";
      if (opts.align === "justify" && i < lines.length - 1 && line.trim().split(/\s+/).length > 1) {
        textOpts.align = "justify";
        textOpts.maxWidth = width;
      }
      doc.text(line, opts.align === "center" ? pageW / 2 : marginX + indent + bulletW, y + opts.size, textOpts);
      y += lineH;
    });
    y += opts.lineGap ?? 6;
  };

  write(`${contract.contract_number || "CONTRATO"} - CONTRATO DE ADESÃO`, { size: 13, bold: true, align: "center", upper: true, lineGap: 22 });

  // Espaço extra antes de cada tópico (h1/h2/h3) — "3 enters" de separação
  // visual entre seções; os artigos (parágrafos) mantêm espaçamento simples.
  const TOPIC_GAP_H1 = 40;
  const TOPIC_GAP_H2 = 36;
  const TOPIC_GAP_H3 = 28;

  let firstBlock = true;
  for (const block of htmlToBlocks(html)) {
    if (block.kind === "hr") {
      ensureSpace(18);
      y += 6;
      doc.setDrawColor(190);
      doc.line(marginX, y, pageW - marginRight, y);
      y += 14;
      firstBlock = false;
      continue;
    }
    if (block.kind === "h1") {
      if (!firstBlock) { ensureSpace(TOPIC_GAP_H1); y += TOPIC_GAP_H1; }
      write(block.text, { size: 13, bold: true, align: "center", upper: true, lineGap: 12 });
    }
    if (block.kind === "h2") {
      if (!firstBlock) { ensureSpace(TOPIC_GAP_H2); y += TOPIC_GAP_H2; }
      write(block.text, { size: 11, bold: true, upper: true, lineGap: 10 });
    }
    if (block.kind === "h3") {
      if (!firstBlock) { ensureSpace(TOPIC_GAP_H3); y += TOPIC_GAP_H3; }
      write(block.text, { size: 10, bold: true, upper: true, lineGap: 8 });
    }
    if (block.kind === "p") write(block.text, { size: 10, align: "justify", lineGap: 8 });
    if (block.kind === "li") write(block.text, { size: 10, align: "justify", indent: 14, bullet: "•", lineGap: 5 });
    firstBlock = false;
  }

  // === Carimbo lateral esquerdo em TODAS as páginas ===
  const registradoBR = sessao.registrado_em
    ? new Date(sessao.registrado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" })
    : "—";
  const stampRows: [string, string][] = [
    ["CONTRATO", String(contract.contract_number || contract.id || "—")],
    ["DATA/HORA (BRT)", registradoBR],
    ["IP", sessao.ip || "—"],
    ["SO", sessao.so || "—"],
    ["NAVEGADOR", sessao.browser || "—"],
    ["PAÍS", sessao.country || "—"],
    ["IDIOMA", sessao.accept_language || "—"],
    ["REFERER", sessao.referer || "—"],
    ["USER-AGENT", sessao.user_agent || "—"],
    ["AÇÃO", sessao.action || "download"],
  ];

  const totalPages = doc.getNumberOfPages();
  const stampRuleX = 24;                          // linha vertical delimitadora
  const stampTop = marginTop;
  const stampBottom = pageH - marginBottom;
  const availH = stampBottom - stampTop;

  // Colunas rotacionadas dentro da margem esquerda.
  const titleX = 32;
  const fieldStartX = 44;
  const columnGap = 9;                            // espaço horizontal entre colunas rotacionadas
  const textGutter = 16;                          // respiro entre o carimbo e o texto do contrato
  const maxColumns = Math.max(1, Math.floor((marginLeft - fieldStartX - textGutter) / columnGap));

  // Quebra a linha única de campos em N colunas verticais, cortando em vírgulas.
  const fieldsLine = stampRows.map(([l, v]) => `${l}: ${v}`).join(", ");
  const fontSize = 6.8;
  const charAdvance = 3.1;                        // aproximação da altura visual da linha rotacionada
  const maxCharsPerCol = Math.max(20, Math.floor(availH / charAdvance));
  const parts = fieldsLine.split(/(, )/); // mantém separadores
  const columns: string[] = [];
  let current = "";
  for (const part of parts) {
    if ((current + part).length > maxCharsPerCol && current.length > 0) {
      columns.push(current.replace(/,\s*$/, ""));
      current = part.replace(/^,\s*/, "");
    } else {
      current += part;
    }
    if (columns.length >= maxColumns - 1) break;
  }
  // resto (respeitando o limite total de colunas)
  const consumed = columns.join(", ").length + (columns.length ? 2 : 0);
  const remaining = fieldsLine.slice(consumed);
  if (remaining) {
    if (columns.length < maxColumns) columns.push(remaining);
    else {
      const last = columns[columns.length - 1];
      const truncated = (last + ", " + remaining).slice(0, maxCharsPerCol - 1) + "…";
      columns[columns.length - 1] = truncated;
    }
  } else if (current) {
    columns.push(current);
  }

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Linha vertical delimitadora do carimbo
    doc.setDrawColor(190);
    doc.setLineWidth(0.4);
    doc.line(stampRuleX, stampTop, stampRuleX, stampBottom);

    // Título do carimbo (rotacionado, lê de baixo para cima, começando no topo)
    doc.setFont("times", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(90);
    doc.text(
      "REGISTRO DE SESSÃO — DOWNLOAD DO INSTRUMENTO · MP 2.200-2/2001",
      titleX,
      stampBottom,
      { angle: 90, baseline: "alphabetic" } as any,
    );

    // Campos rotacionados, quebrando em múltiplas colunas verticais quando não couber em uma só.
    doc.setFont("times", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(70);
    for (let c = 0; c < columns.length; c++) {
      const x = fieldStartX + c * columnGap;
      doc.text(columns[c], x, stampBottom, { angle: 90, baseline: "alphabetic" } as any);
    }

    // Paginação discreta no pé da lateral
    doc.setFontSize(6.5);
    doc.setTextColor(140);
    doc.text(`PÁG. ${p}/${totalPages}`, titleX, stampTop + 26, {
      angle: 90,
      baseline: "alphabetic",
    } as any);

    doc.setTextColor(0);
  }

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: responseCorsHeaders });

  let contract_id: string | undefined;
  let action: string | undefined;
  let format: string | undefined;
  if (req.method === "GET") {
    const url = new URL(req.url);
    contract_id = String(url.searchParams.get("contract_id") ?? url.searchParams.get("id") ?? "").trim();
    action = url.searchParams.get("action") ?? undefined;
    format = url.searchParams.get("format") ?? undefined;
  } else {
    try {
      const body = await req.json();
      contract_id = String(body.contract_id ?? "").trim();
      action = typeof body.action === "string" ? body.action : undefined;
      format = typeof body.format === "string" ? body.format : undefined;
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }
  }

  if (!contract_id || !UUID_RE.test(contract_id)) {
    return json({ error: "contract_id inválido" }, 400);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "desconhecido";
  const userAgent = req.headers.get("user-agent") ?? "desconhecido";
  const acceptLanguage = req.headers.get("accept-language") ?? null;
  const referer = req.headers.get("referer") ?? null;
  const secChUa = req.headers.get("sec-ch-ua") ?? null;
  const secChUaPlatform = req.headers.get("sec-ch-ua-platform") ?? null;
  const secChUaMobile = req.headers.get("sec-ch-ua-mobile") ?? null;
  const cfCountry = req.headers.get("cf-ipcountry") ?? null;
  // Deriva SO/navegador do user-agent quando client hints não vierem
  const uaLc = userAgent.toLowerCase();
  const so = /windows nt/.test(uaLc) ? "Windows"
    : /mac os x|macintosh/.test(uaLc) ? "macOS"
    : /android/.test(uaLc) ? "Android"
    : /iphone|ipad|ipod/.test(uaLc) ? "iOS"
    : /linux/.test(uaLc) ? "Linux"
    : "desconhecido";
  const browser = /edg\//.test(uaLc) ? "Edge"
    : /chrome\//.test(uaLc) && !/edg\//.test(uaLc) ? "Chrome"
    : /firefox\//.test(uaLc) ? "Firefox"
    : /safari\//.test(uaLc) && !/chrome\//.test(uaLc) ? "Safari"
    : "desconhecido";

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await sb
    .from("qa_contracts")
    .select("id, contract_number, status, conteudo_renderizado, issued_at, servico_slug, venda_id, template_versao, cliente_id")
    .eq("id", contract_id)
    .maybeSingle();

  if (error || !data) {
    return json({ error: "Contrato não encontrado" }, 404);
  }

  let nomeCliente = "";
  try {
    const { data: cli } = await sb
      .from("qa_clientes")
      .select("nome_completo")
      .or(`id.eq.${data.cliente_id},id_legado.eq.${data.cliente_id}`)
      .limit(1)
      .maybeSingle();
    nomeCliente = cli?.nome_completo || "";
  } catch { /* segue sem nome — filename cai no fallback genérico */ }

  const STATUS_BLOQUEADOS = new Set(["rejected", "arquivado_template_legado"]);
  if (STATUS_BLOQUEADOS.has(data.status)) {
    return json({ error: "Este link foi cancelado e não está mais disponível." }, 410);
  }

  // Registra evento com dados de sessão (visualização OU download direto)
  const isPdfDownload = action === "download" || format === "pdf";
  const eventType = isPdfDownload
    ? "contrato_baixado_cliente"
    : "contrato_visualizado_cliente";
  const registradoEm = new Date().toISOString();
  const sessao: SessionStamp = {
    ip,
    so,
    browser,
    user_agent: userAgent,
    accept_language: acceptLanguage,
    referer,
    country: cfCountry,
    registrado_em: registradoEm,
    action: isPdfDownload ? "download" : action ?? "view",
  };
  try {
    await sb.from("qa_contract_events").insert({
      contract_id: data.id,
      event_type: eventType,
      event_payload: {
        ip,
        user_agent: userAgent,
        so,
        browser,
        platform: secChUaPlatform,
        mobile: secChUaMobile,
        client_hints: secChUa,
        accept_language: acceptLanguage,
        country: cfCountry,
        referer,
        contract_number: data.contract_number,
        template_versao: data.template_versao,
        status: data.status,
        venda_id: data.venda_id,
        action: sessao.action,
        recorded_at: registradoEm,
      },
    });
  } catch (e) {
    console.error("[qa-contrato-view-public] evento falhou:", e);
  }

  if (isPdfDownload || format === "pdf") {
    const bytes = buildSessionStampedPdf(data, data.conteudo_renderizado ?? "", sessao);
    const filename = sanitizeFilename(`${data.contract_number || "CONTRATO"} - Contrato de Adesão.pdf`);
    return new Response(bytes, {
      status: 200,
      headers: {
        ...responseCorsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  }

  return json({
    ok: true,
    contract_number: data.contract_number,
    status: data.status,
    issued_at: data.issued_at,
    servico_slug: data.servico_slug,
    venda_id: data.venda_id,
    nome_cliente: "",
    conteudo_html: data.conteudo_renderizado ?? "",
    sessao,
  });
});

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
  const marginLeft = 132;   // margem esquerda larga para o carimbo
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

  for (const block of htmlToBlocks(html)) {
    if (block.kind === "hr") {
      ensureSpace(18);
      y += 6;
      doc.setDrawColor(190);
      doc.line(marginX, y, pageW - marginRight, y);
      y += 14;
      continue;
    }
    if (block.kind === "h1") write(block.text, { size: 13, bold: true, align: "center", upper: true, lineGap: 12 });
    if (block.kind === "h2") write(block.text, { size: 11, bold: true, upper: true, lineGap: 10 });
    if (block.kind === "h3") write(block.text, { size: 10, bold: true, upper: true, lineGap: 8 });
    if (block.kind === "p") write(block.text, { size: 10, align: "justify", lineGap: 8 });
    if (block.kind === "li") write(block.text, { size: 10, align: "justify", indent: 14, bullet: "•", lineGap: 5 });
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
  const stampRuleX = 30;                          // linha vertical delimitadora
  const stampTop = marginTop;
  const stampBottom = pageH - marginBottom;
  const availH = stampBottom - stampTop;

  // Cada "coluna" rotacionada ocupa uma faixa horizontal dentro da margem esquerda.
  // Colunas (da linha p/ dentro do texto do contrato):
  //  x=40 → título / paginação
  //  x=54 → LABEL: valor  (uma linha por campo)
  const titleX = 40;
  const fieldX = 60;
  const fieldGap = 8; // distância horizontal entre colunas de campos

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Linha vertical delimitadora do carimbo
    doc.setDrawColor(190);
    doc.setLineWidth(0.4);
    doc.line(stampRuleX, stampTop, stampRuleX, stampBottom);

    // Título do carimbo (rotacionado, lê de baixo para cima)
    doc.setFont("times", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(90);
    doc.text(
      "REGISTRO DE SESSÃO — DOWNLOAD DO INSTRUMENTO · MP 2.200-2/2001",
      titleX,
      stampBottom,
      { angle: 90, baseline: "alphabetic" } as any,
    );

    // Paginação (topo da lateral)
    doc.setFont("times", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(130);
    doc.text(`PÁG. ${p}/${totalPages}`, titleX, stampTop + 30, {
      angle: 90,
      baseline: "alphabetic",
    } as any);

    // Campos: cada um é uma coluna vertical própria (label + valor concatenados)
    // Isso evita sobreposição — cada string ocupa sua própria faixa horizontal.
    doc.setFontSize(6.8);
    doc.setTextColor(70);
    stampRows.forEach(([label, value], i) => {
      const x = fieldX + i * fieldGap;
      // trunca strings enormes (user-agent) para caber na altura útil
      const maxChars = Math.floor(availH / 3.6);
      const composed = `${label}: ${value}`;
      const shown = composed.length > maxChars ? composed.slice(0, maxChars - 1) + "…" : composed;
      doc.setFont("times", "normal");
      doc.text(shown, x, stampBottom, { angle: 90, baseline: "alphabetic" } as any);
    });

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
    .select("id, contract_number, status, conteudo_renderizado, issued_at, servico_slug, venda_id, template_versao")
    .eq("id", contract_id)
    .maybeSingle();

  if (error || !data) {
    return json({ error: "Contrato não encontrado" }, 404);
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

/**
 * qa-serve-procuracao-pdf
 *
 * Procuração com carimbo de SERVIDOR e golden record — o mesmo tratamento que
 * o contrato de adesão já recebe em `qa-serve-contract-pdf`.
 *
 * ── Por que esta função existe ──────────────────────────────────────────────
 *
 * Até aqui a procuração era montada no NAVEGADOR do cliente
 * (QAProcuracaoViewPage.tsx → html2canvas + jsPDF). Isso trazia dois
 * problemas que impedem qualquer validação automática:
 *
 *   1. O carimbo lateral saía de `navigator.userAgent` / `document.referrer` /
 *      `new Date()`. É o próprio cliente declarando a própria conexão — não
 *      serve como prova, e o dado pode ser trocado no console.
 *   2. Cada download gerava bytes diferentes (imagem rasterizada, timestamp
 *      novo). Não existia UM arquivo canônico contra o qual comparar o PDF
 *      assinado que volta do Gov.br.
 *
 * Aqui o PDF é gerado UMA vez, no servidor, em TEXTO (não imagem — imagem não
 * tem texto extraível, e sem texto não há comparação). Os bytes ficam no
 * storage e toda leitura posterior devolve exatamente os mesmos. O carimbo sai
 * dos headers da requisição, do lado do servidor.
 *
 * ── O que NÃO foi tocado ────────────────────────────────────────────────────
 *
 * Nada. `qa-procuracao-view-public`, `qa-gerar-procuracao` e
 * `qa-upload-signed-procuracao` seguem exatamente como estão. Esta função é
 * aditiva: enquanto o frontend não apontar para cá, o fluxo atual continua
 * funcionando igual.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { jsPDF } from "npm:jspdf@2.5.1";
import { extrairTextoPdf, normalizarParaComparacao } from "../_shared/compararTextoPdf.ts";
import { desenharCarimbo } from "../_shared/carimboConexao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Expose-Headers": "Content-Disposition, Content-Type, x-original-sha256",
};

const BUCKET = "paid-contracts";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// SESSÃO DE GERAÇÃO (carimbo de conexão)
// ============================================================================

type Sessao = {
  ip: string | null;
  so: string | null;
  browser: string | null;
  country: string | null;
  accept_language: string | null;
  referer: string | null;
  user_agent: string | null;
  registrado_em: string;
};

function detectarSO(ua: string): string | null {
  if (!ua) return null;
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows NT/.test(ua)) return "Windows";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

function detectarNavegador(ua: string): string | null {
  if (!ua) return null;
  // Ordem importa: Edge e Opera também dizem "Chrome" no UA.
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}

function lerSessao(req: Request): Sessao {
  const h = req.headers;
  const ua = h.get("user-agent") ?? "";
  const fwd = h.get("x-forwarded-for") ?? "";
  return {
    ip: (fwd.split(",")[0] || h.get("cf-connecting-ip") || "").trim() || null,
    so: detectarSO(ua),
    browser: detectarNavegador(ua),
    country: h.get("cf-ipcountry"),
    accept_language: h.get("accept-language"),
    referer: h.get("referer"),
    user_agent: ua || null,
    registrado_em: new Date().toISOString(),
  };
}

// ============================================================================
// PDF CANÔNICO — texto, não imagem
// ============================================================================

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
    .replace(/&atilde;/gi, "ã").replace(/&otilde;/gi, "õ")
    .replace(/&acirc;/gi, "â").replace(/&ecirc;/gi, "ê").replace(/&ocirc;/gi, "ô")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

type Block =
  | { kind: "h1" | "h2" | "h3" | "p" | "li"; text: string }
  | { kind: "hr" };

function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  let src = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<button[\s\S]*?<\/button>/gi, "");
  const bodyMatch = src.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) src = bodyMatch[1];

  const tagRe = /<(h1|h2|h3|p|li)[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src)) !== null) {
    if (m[0].startsWith("<hr")) {
      blocks.push({ kind: "hr" });
      continue;
    }
    const tag = m[1].toLowerCase() as "h1" | "h2" | "h3" | "p" | "li";
    const txt = decodeHtmlEntities((m[2] || "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (!txt) continue;
    blocks.push({ kind: tag, text: txt });
  }

  // Procurações antigas podem vir sem tags de bloco (texto corrido com <br>).
  // Sem este fallback o PDF sairia vazio.
  if (blocks.length === 0) {
    const plano = decodeHtmlEntities(
      src.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "),
    );
    for (const linha of plano.split(/\n+/)) {
      const t = linha.replace(/\s+/g, " ").trim();
      if (t) blocks.push({ kind: "p", text: t });
    }
  }
  return blocks;
}

function buildCanonicalPdf(
  proc: any,
  html: string,
  numero: string,
  nomeCliente: string,
  sessao: Sessao,
): Uint8Array {
  const blocks = htmlToBlocks(html);
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: false });

  // Metadados determinísticos: se a geração for reexecutada em recuperação de
  // desastre, os bytes têm de sair iguais. Nada de "agora" aqui.
  const fixa = new Date(String(proc.generated_at || "2020-01-01T00:00:00Z"));
  const d2 = (n: number) => String(n).padStart(2, "0");
  const stampPdf =
    `D:${fixa.getUTCFullYear()}${d2(fixa.getUTCMonth() + 1)}${d2(fixa.getUTCDate())}` +
    `${d2(fixa.getUTCHours())}${d2(fixa.getUTCMinutes())}${d2(fixa.getUTCSeconds())}Z`;
  try {
    (doc as any).setCreationDate(stampPdf);
    (doc as any).setFileId(
      String(proc.id).replace(/-/g, "").toUpperCase().slice(0, 32).padEnd(32, "0"),
    );
  } catch { /* ignore */ }

  doc.setProperties({
    title: `Procuração Quero Armas${nomeCliente ? ` - ${nomeCliente}` : ""}`,
    subject: `Procuração ${numero}`,
    author: "Quero Armas",
    creator: "Quero Armas Sistema",
    keywords: `procuracao,${numero}`,
  });

  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN_X_L = 76; // faixa do carimbo mora aqui
  const MARGIN_X_R = 48;
  const MARGIN_TOP = 56;
  const MARGIN_BOTTOM = 56;
  const CONTENT_W = PAGE_W - MARGIN_X_L - MARGIN_X_R;
  let y = MARGIN_TOP;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  };

  const writeParagraph = (
    text: string,
    opts: {
      size: number;
      bold?: boolean;
      align?: "left" | "center" | "justify";
      upper?: boolean;
      indent?: number;
      lineGap?: number;
      bullet?: string;
    },
  ) => {
    doc.setFont("times", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size);
    const t = opts.upper ? text.toUpperCase() : text;
    const indent = opts.indent || 0;
    const bulletText = opts.bullet ? `${opts.bullet}  ` : "";
    const bulletW = bulletText ? doc.getTextWidth(bulletText) : 0;
    const width = CONTENT_W - indent - bulletW;
    const lines = doc.splitTextToSize(t, width) as string[];
    const lineHeight = opts.size * 1.35;
    ensureSpace(lineHeight * lines.length + (opts.lineGap || 6));
    if (bulletText) doc.text(bulletText, MARGIN_X_L + indent, y + opts.size);
    lines.forEach((ln, i) => {
      const isCenter = opts.align === "center";
      const isJustify =
        opts.align === "justify" && i < lines.length - 1 && ln.trim().split(/\s+/).length > 1;
      const textOpt: any = {};
      if (isCenter) textOpt.align = "center";
      if (isJustify) {
        textOpt.align = "justify";
        textOpt.maxWidth = width;
      }
      const x = isCenter ? MARGIN_X_L + CONTENT_W / 2 : MARGIN_X_L + indent + bulletW;
      doc.text(ln, x, y + opts.size, textOpt);
      y += lineHeight;
    });
    y += (opts.lineGap ?? 6);
  };

  let primeiro = true;
  for (const b of blocks) {
    if (b.kind === "h1") {
      if (!primeiro) { ensureSpace(40); y += 40; }
      writeParagraph(b.text, { size: 13, bold: true, align: "center", upper: true, lineGap: 12 });
    } else if (b.kind === "h2") {
      if (!primeiro) { ensureSpace(36); y += 36; }
      writeParagraph(b.text, { size: 11, bold: true, upper: true, lineGap: 10 });
    } else if (b.kind === "h3") {
      if (!primeiro) { ensureSpace(28); y += 28; }
      writeParagraph(b.text, { size: 10, bold: true, upper: true, lineGap: 8 });
    } else if (b.kind === "p") {
      writeParagraph(b.text, { size: 10, align: "justify", lineGap: 8 });
    } else if (b.kind === "li") {
      writeParagraph(b.text, { size: 10, align: "justify", indent: 14, bullet: "•", lineGap: 5 });
    } else {
      ensureSpace(18);
      y += 6;
      doc.setDrawColor(180);
      doc.line(MARGIN_X_L, y, PAGE_W - MARGIN_X_R, y);
      y += 14;
    }
    primeiro = false;
  }

  // MESMO carimbo do contrato — código compartilhado, não cópia. Os dois
  // nasceram separados e divergiram; agora o layout é um só.
  desenharCarimbo(doc, {
    sessao: {
      rotuloNumero: "PROCURAÇÃO",
      numero,
      registrado_em: sessao.registrado_em,
      ip: sessao.ip,
      user_agent: sessao.user_agent,
      accept_language: sessao.accept_language,
      referer: sessao.referer,
      acao: "emissão do instrumento",
    },
    margemEsquerda: MARGIN_X_L,
  });
  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

function filename(partes: Array<string | null | undefined>): string {
  return (
    partes
      .filter(Boolean)
      .join(" - ")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() + ".pdf"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Method not allowed" }, 405);

  try {
    let procuracaoId = "";
    if (req.method === "GET") {
      const url = new URL(req.url);
      procuracaoId = String(url.searchParams.get("procuracao_id") ?? url.searchParams.get("id") ?? "").trim();
    } else {
      const body = await req.json().catch(() => ({}));
      procuracaoId = String(body.procuracao_id ?? body.id ?? "").trim();
    }
    if (!procuracaoId || !UUID_RE.test(procuracaoId)) {
      return json({ error: "procuracao_id inválido" }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: proc, error } = await sb
      .from("qa_procuracoes")
      .select(
        "id, cliente_id, venda_id, status, conteudo_renderizado, generated_at, original_pdf_path, original_sha256, sessao_geracao",
      )
      .eq("id", procuracaoId)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!proc) return json({ error: "Procuração não encontrada" }, 404);

    const conteudo = String((proc as any).conteudo_renderizado ?? "").trim();
    if (!conteudo) return json({ error: "Procuração sem conteúdo publicado" }, 422);

    const { data: cliente } = await sb
      .from("qa_clientes")
      .select("nome_completo, cpf")
      .or(`id.eq.${(proc as any).cliente_id},id_legado.eq.${(proc as any).cliente_id}`)
      .maybeSingle();

    const nomeCliente = (cliente as any)?.nome_completo ?? "";
    const numero = (proc as any).venda_id ? `VENDA ${(proc as any).venda_id}` : "PROCURAÇÃO";
    const fname = filename([numero, "Procuração Quero Armas", nomeCliente]);

    const responder = (bytes: Uint8Array, sha: string) =>
      new Response(bytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition":
            `attachment; filename="${fname}"; filename*=UTF-8''${encodeURIComponent(fname)}`,
          "x-original-sha256": sha,
          "Cache-Control": "no-store",
        },
      });

    // ── Já existe canônico? Devolve os MESMOS bytes ─────────────────────────
    // É isto que torna a assinatura PAdES do Gov.br uma atualização
    // incremental sobre um prefixo que conhecemos.
    const pathSalvo = (proc as any).original_pdf_path as string | null;
    const shaSalvo = String((proc as any).original_sha256 ?? "").toLowerCase();
    if (pathSalvo) {
      const { data: baixado, error: dlErr } = await sb.storage.from(BUCKET).download(pathSalvo);
      if (!dlErr && baixado) {
        const bytes = new Uint8Array(await baixado.arrayBuffer());
        const sha = await sha256Bytes(bytes);
        if (!shaSalvo || sha === shaSalvo) return responder(bytes, sha);
        console.warn("[qa-serve-procuracao-pdf] hash divergente do original salvo, regenerando");
      }
    }

    // ── Primeira geração ────────────────────────────────────────────────────
    const sessao = lerSessao(req);
    const bytes = buildCanonicalPdf(proc, conteudo, numero, nomeCliente, sessao);
    const sha = await sha256Bytes(bytes);
    const path = `qa/procuracoes/original-${(proc as any).id}.pdf`;

    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) return json({ error: `upload_original_failed:${upErr.message}` }, 500);

    await sb
      .from("qa_procuracoes")
      .update({ original_pdf_path: path, original_sha256: sha, sessao_geracao: sessao })
      .eq("id", (proc as any).id);

    // ── GOLDEN RECORD ───────────────────────────────────────────────────────
    // Grava o que a re-linearização do assinador do Gov.br NÃO muda: o texto
    // normalizado e os campos do carimbo como colunas. A validação da
    // procuração assinada compara contra isto, não contra o arquivo.
    //
    // Best-effort de propósito: falha aqui NÃO pode impedir o cliente de
    // baixar a procuração.
    try {
      const texto = normalizarParaComparacao(await extrairTextoPdf(bytes));
      const textoSha = await sha256Bytes(new TextEncoder().encode(texto));
      await sb.from("qa_documentos_golden").upsert(
        {
          documento_tipo: "procuracao",
          documento_id: (proc as any).id,
          cliente_id: (proc as any).cliente_id ?? null,
          numero,
          sha256: sha,
          storage_path: path,
          tamanho_bytes: bytes.byteLength,
          texto_normalizado: texto,
          texto_sha256: textoSha,
          carimbo_ip: sessao.ip,
          carimbo_so: sessao.so,
          carimbo_navegador: sessao.browser,
          carimbo_pais: sessao.country,
          carimbo_idioma: sessao.accept_language,
          carimbo_referer: sessao.referer,
          carimbo_registrado_em: sessao.registrado_em,
          titular_nome: nomeCliente || null,
          titular_cpf: (cliente as any)?.cpf ?? null,
          gerado_em: new Date().toISOString(),
        },
        { onConflict: "documento_tipo,documento_id" },
      );
    } catch (e) {
      console.error("[golden] procuração — falha ao gravar (nao bloqueia a geracao):", e);
    }

    return responder(bytes, sha);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

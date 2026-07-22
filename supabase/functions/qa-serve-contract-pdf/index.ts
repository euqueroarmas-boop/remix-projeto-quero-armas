/**
 * qa-serve-contract-pdf — BLOCO 10 / Pass B
 *
 * Stream autenticado de contratos Quero Armas.
 *
 * Minuta_Contrato_Quero_Armas_v1.md é o único contrato canônico de
 * contratação de serviços da Quero Armas. Para contratos pós-pagamento, o
 * documento correto é o snapshot HTML renderizado do template canônico. PDF
 * físico legado em `original_pdf_path` ou `company_signed_pdf_path` pode ter
 * sido gerado pelo renderizador antigo e não pode ser servido como contrato
 * de adesão.
 *
 * Bucket NÃO é público.
 *
 * Acesso:
 *  - Equipe Quero Armas (qa_usuarios_perfis ativo) → qualquer contrato.
 *  - Cliente (JWT auth) → apenas contratos cujo cliente_id corresponde a ele.
 *
 * Variantes (?variant=):
 *  - "company_signed" (padrão p/ cliente): exige status >= pending_customer_signature.
 *  - "customer_signed": exige customer_signed_pdf_path.
 *  - "original": apenas staff.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import { constantTimeEqual, sha256Hex } from "../_shared/qaAsaas.ts";
import { jsPDF } from "npm:jspdf@2.5.1";
import { montarAnexosI, aplicarAnexosDinamicos } from "../_shared/qaAnexos.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "content-disposition, content-type, x-original-sha256",
};
const BUCKET = "paid-contracts";

// ============================================================================
// PDF CANÔNICO (binding byte-a-byte)
// ---------------------------------------------------------------------------
// O PDF servido ao cliente PRECISA ser byte-idêntico ao PDF que ele assina no
// GOV.BR/ICP-Brasil, para que a assinatura PAdES seja uma atualização
// incremental (prefixo binário do original). Geramos UMA vez por contrato e
// persistimos em storage; toda leitura posterior devolve exatamente esses
// mesmos bytes.
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
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "li"; text: string }
  | { kind: "hr" };

function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  // Normaliza: remove <script>, <style>, <button> (não pertence ao contrato)
  let src = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<button[\s\S]*?<\/button>/gi, "");
  // Extrai body se existir
  const bodyMatch = src.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) src = bodyMatch[1];

  const tagRe = /<(h1|h2|h3|p|li|hr)[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src)) !== null) {
    if (m[0].startsWith("<hr")) {
      blocks.push({ kind: "hr" });
      continue;
    }
    const tag = m[1].toLowerCase() as Block["kind"];
    const raw = m[2] || "";
    // Remove tags internas (b, i, strong, span, a) mantendo texto.
    const txt = decodeHtmlEntities(raw.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (!txt) continue;
    blocks.push({ kind: tag, text: txt });
  }
  return blocks;
}

function buildCanonicalPdf(contract: any, html: string): Uint8Array {
  const blocks = htmlToBlocks(sanitizeTechnicalJargon(html));
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: false });

  // Metadados fixos garantem determinismo caso a geração seja reexecutada
  // em recuperação de desastre. Não usamos timestamp de "agora".
  const fixedDate = new Date(String(contract.aceite_eletronico_data || contract.created_at || "2020-01-01T00:00:00Z"));
  const yyyymmdd = `D:${fixedDate.getUTCFullYear()}${String(fixedDate.getUTCMonth() + 1).padStart(2, "0")}${String(fixedDate.getUTCDate()).padStart(2, "0")}${String(fixedDate.getUTCHours()).padStart(2, "0")}${String(fixedDate.getUTCMinutes()).padStart(2, "0")}${String(fixedDate.getUTCSeconds()).padStart(2, "0")}Z`;
  try {
    (doc as any).setCreationDate(yyyymmdd);
    (doc as any).setFileId(String(contract.id).replace(/-/g, "").toUpperCase().slice(0, 32).padEnd(32, "0"));
  } catch { /* ignore */ }

  doc.setProperties({
    title: contractDownloadBaseName(contract),
    subject: `Contrato ${contract.contract_number || contract.id}`,
    author: "Quero Armas",
    creator: "Quero Armas Sistema",
    keywords: `contrato,${contract.contract_number || ""}`,
  });

  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN_X = 48;
  const MARGIN_TOP = 56;
  const MARGIN_BOTTOM = 56;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;
  let y = MARGIN_TOP;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  };

  const writeParagraph = (text: string, opts: { size: number; bold?: boolean; align?: "left" | "center" | "justify"; upper?: boolean; indent?: number; lineGap?: number; bullet?: string; }) => {
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
    if (bulletText) {
      doc.text(bulletText, MARGIN_X + indent, y + opts.size);
    }
    lines.forEach((ln, i) => {
      const isCenter = opts.align === "center";
      const isJustify = opts.align === "justify" && i < lines.length - 1 && ln.trim().split(/\s+/).length > 1;
      const textOpt: any = {};
      if (isCenter) textOpt.align = "center";
      if (isJustify) {
        textOpt.align = "justify";
        textOpt.maxWidth = width;
      }
      const x = isCenter ? PAGE_W / 2 : MARGIN_X + indent + bulletW;
      doc.text(ln, x, y + opts.size, textOpt);
      y += lineHeight;
    });
    y += (opts.lineGap ?? 6);
  };

  // Título (contrato) sempre no topo
  writeParagraph(contractDownloadBaseName(contract), { size: 13, bold: true, align: "center", upper: true, lineGap: 6 });
  writeParagraph(`Nº ${contract.contract_number || contract.id} · Pedido ${contract.venda_id ?? "—"}`, { size: 9, align: "center", lineGap: 24 });

  // Espaço extra antes de novos tópicos (h1/h2/h3) — "3 enters" de separação
  // visual entre seções; os artigos (parágrafos) mantêm espaçamento simples.
  const TOPIC_GAP_H1 = 40;
  const TOPIC_GAP_H2 = 36;
  const TOPIC_GAP_H3 = 28;

  let firstBlock = true;
  for (const b of blocks) {
    if (b.kind === "h1") {
      if (!firstBlock) { ensureSpace(TOPIC_GAP_H1); y += TOPIC_GAP_H1; }
      writeParagraph(b.text, { size: 13, bold: true, align: "center", upper: true, lineGap: 12 });
    } else if (b.kind === "h2") {
      if (!firstBlock) { ensureSpace(TOPIC_GAP_H2); y += TOPIC_GAP_H2; }
      writeParagraph(b.text, { size: 11, bold: true, upper: true, lineGap: 10 });
    } else if (b.kind === "h3") {
      if (!firstBlock) { ensureSpace(TOPIC_GAP_H3); y += TOPIC_GAP_H3; }
      writeParagraph(b.text, { size: 10, bold: true, upper: true, lineGap: 8 });
    } else if (b.kind === "p") {
      writeParagraph(b.text, { size: 10, align: "justify", lineGap: 8 });
    } else if (b.kind === "li") {
      writeParagraph(b.text, { size: 10, align: "justify", indent: 14, bullet: "•", lineGap: 5 });
    } else if (b.kind === "hr") {
      ensureSpace(18); y += 6; doc.setDrawColor(180); doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y); y += 14;
    }
    firstBlock = false;
  }

  // Rodapé probatório (aceite eletrônico)
  const rodape =
    `Aceite eletrônico: ${contract.aceite_eletronico_data || "—"} · ` +
    `IP ${contract.aceite_ip || "—"} · ` +
    `Hash ${contract.aceite_hash || "—"}`;
  ensureSpace(30);
  y += 8;
  doc.setDrawColor(200);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 10;
  writeParagraph(rodape, { size: 8, align: "left", lineGap: 0 });

  const ab = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(ab);
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureCanonicalPdf(
  sb: ReturnType<typeof svc>,
  contract: any,
  html: string,
): Promise<{ bytes: Uint8Array; path: string; sha256: string }> {
  // Já existe? Devolve do storage (byte-idêntico).
  const existingPath = (contract as any).original_pdf_path as string | null;
  const existingSha = ((contract as any).original_sha256 || "").toString().toLowerCase();
  if (existingPath) {
    const { data, error } = await sb.storage.from(BUCKET).download(existingPath);
    if (!error && data) {
      const bytes = new Uint8Array(await data.arrayBuffer());
      const sha = await sha256Bytes(bytes);
      if (!existingSha || sha === existingSha) {
        return { bytes, path: existingPath, sha256: sha };
      }
      // hash divergente: registra e regenera (não deveria acontecer)
      console.warn("[qa-serve-contract-pdf] hash divergente do original salvo, regenerando");
    }
  }

  const bytes = buildCanonicalPdf(contract, html);
  const sha = await sha256Bytes(bytes);
  const path = `qa/${contract.venda_id ?? "sem-venda"}/original-${contract.id}.pdf`;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) throw new Error(`upload_original_failed:${upErr.message}`);
  await sb.from("qa_contracts").update({
    original_pdf_path: path,
    original_sha256: sha,
  }).eq("id", contract.id);
  await sb.from("qa_contract_events").insert({
    contract_id: contract.id,
    event_type: "original_pdf_gerado",
    event_payload: { path, sha256: sha, size: bytes.byteLength },
  });
  return { bytes, path, sha256: sha };
}

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function authUser(req: Request): Promise<{ userId: string; email: string | null } | null> {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  try {
    const u = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data, error } = await u.auth.getUser(token);
    if (error || !data?.user) return null;
    return { userId: data.user.id, email: data.user.email ?? null };
  } catch { return null; }
}

function jsonResp(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function failContractDownload(
  req: Request,
  user: { userId: string; email: string | null } | null,
  contract: Record<string, unknown> | null,
  variant: string,
  reason: string,
  status = 409,
) {
  const payload = {
    reason,
    variant,
    contract_id: contract?.id ?? null,
    contract_number: contract?.contract_number ?? null,
    venda_id: contract?.venda_id ?? null,
    cliente_id: contract?.cliente_id ?? null,
    user_email: user?.email ?? null,
    request_ip: requestIp(req),
    user_agent: req.headers.get("user-agent"),
    canonical_contract: "Minuta_Contrato_Quero_Armas_v1.md",
  };

  await logSistemaBackend({
    tipo: "contrato",
    status: "error",
    mensagem: "qa-serve-contract-pdf: download bloqueado por fallback ou contrato canonico indisponivel",
    payload,
    user_id: user?.userId,
  });

  console.error("[qa-serve-contract-pdf] blocked contract download", payload);

  return jsonResp({
    error: "contrato_canonico_indisponivel",
    reason,
    message:
      "Contrato canonico indisponivel. O download foi bloqueado e o administrador foi notificado para analise.",
  }, status);
}

function escapeHtml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function substitute(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

async function sha256Text(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function requestIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    null
  );
}

function fileSafeName(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function fullPersonName(value: string | null | undefined): string {
  return titleCaseName(fileSafeName(value || ""));
}

function contractDownloadBaseName(contract: any): string {
  const numero = fileSafeName(contract.contract_number || contract.id || "Contrato");
  const cliente = fullPersonName(contract.cliente_nome || "");
  return cliente
    ? `${numero} - Contrato de Adesao Quero Armas - ${cliente}`
    : `${numero} - Contrato de Adesao Quero Armas`;
}

function contractDownloadFilename(contract: any, ext: "html" | "pdf"): string {
  return `${contractDownloadBaseName(contract)}.${ext}`;
}

function sanitizeTechnicalJargon(html: string): string {
  if (!html) return html;
  return html
    .replace(/Identificador\s*\(\s*slug\s*\)\s*:?/gi, "Identificador:")
    .replace(/\(\s*slug\s*\)/gi, "")
    .replace(/<li[^>]*>\s*slug[^<]*<\/li>/gi, "")
    .replace(/\bslug\s*:\s*[a-z0-9_-]+/gi, "");
}

const AVISO_SEM_ANEXO_HTML =
  '<section data-anexo-slug="__aviso__" class="qa-anexo-aviso">' +
  '<strong>Anexo específico do serviço não disponível neste contrato.</strong> ' +
  "Os termos detalhados do serviço contratado serão entregues junto ao contrato final assinado." +
  "</section>";

function normalizeContractSlug(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function filterContractAnexosBySlugs(html: string, slugsContratados: string[]): string {
  const slugSet = new Set(slugsContratados.map(normalizeContractSlug).filter(Boolean));
  const sectionRegex =
    /<section\s+[^>]*data-anexo-slug="([^"]+)"[^>]*>[\s\S]*?<\/section>\s*/g;
  let foundAny = false;
  let kept = 0;
  const filtered = html.replace(sectionRegex, (full, slug) => {
    foundAny = true;
    if (slugSet.has(normalizeContractSlug(slug))) {
      kept++;
      return full;
    }
    return "";
  });
  if (foundAny && kept === 0) return filtered + AVISO_SEM_ANEXO_HTML;
  return filtered;
}

function printableContractHtml(contract: any, html: string): string {
  // O <title> da página é o que o navegador sugere como nome de arquivo no
  // diálogo "Salvar como PDF" (Content-Disposition não se aplica nesse fluxo
  // de impressão) — por isso usa o mesmo padrão de contractDownloadFilename.
  const title = contractDownloadBaseName(contract);
  const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const aceiteData = contract.aceite_eletronico_data
    ? new Date(contract.aceite_eletronico_data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";
  const rodape =
    `Documento gerado em ${escapeHtml(generatedAt)} · ` +
    `Contrato ${escapeHtml(contract.contract_number || contract.id)} · ` +
    `Pedido ${escapeHtml(String(contract.venda_id || "—"))} · ` +
    `Aceite eletrônico ${escapeHtml(aceiteData)} · ` +
    `IP ${escapeHtml(contract.aceite_ip || "—")} · ` +
    `Dispositivo ${escapeHtml(contract.aceite_user_agent || "—")} · ` +
    `Hash ${escapeHtml(contract.aceite_hash || "—")}.`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  @page{size:A4;margin:18mm 16mm;}
  *{box-sizing:border-box;}
  body{font-family:Georgia,'Times New Roman',serif;color:#0a0a0a;max-width:780px;margin:32px auto;padding:0 24px;line-height:1.65;font-size:13px;background:#fff;}
  h1{font-size:18px;text-align:center;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 22px;}
  h2,h3{font-size:13px;text-transform:uppercase;letter-spacing:0.04em;margin-top:24px;}
  p{margin:10px 0;text-align:justify;}
  ul,ol{padding-left:22px;} li{margin:6px 0;}
  section[data-anexo-slug]{break-inside:avoid;}
  .qa-ref-contract-anexo,.qa-anexo-aviso{background:#fdecee;border-left:3px solid #7a1f2b;padding:8px 12px;}
  .qa-print-actions{position:sticky;top:0;display:flex;gap:10px;justify-content:flex-end;margin:-8px 0 22px;padding:10px 0;background:rgba(255,255,255,.95);border-bottom:1px solid #eee;}
  .qa-print-actions button{border:1px solid #7a1f2b;background:#7a1f2b;color:#fff;border-radius:4px;padding:9px 14px;font:700 12px system-ui;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;}
  .qa-print-note{font:12px system-ui;color:#555;margin:0 auto 18px;max-width:780px;}
  .qa-rodape-probatorio{margin-top:36px;padding-top:14px;border-top:0.5px solid rgba(0,0,0,0.2);font-size:10.5px;color:#4a4a4a;text-align:left;}
  @media print{
    body{max-width:none;margin:0;padding:0;}
    .qa-print-actions,.qa-print-note{display:none!important;}
  }
</style></head><body>
<div class="qa-print-actions"><button type="button" onclick="window.print()">Salvar/assinar em PDF</button></div>
<p class="qa-print-note">Este é o contrato completo. Para assinar pelo GOV.BR ou certificado ICP-Brasil, use "Salvar/assinar em PDF".</p>
${sanitizeTechnicalJargon(html)}
<div class="qa-rodape-probatorio">${rodape}</div>
</body></html>`;
}

async function loadCliente(sb: ReturnType<typeof svc>, clienteId: number | string | null | undefined) {
  if (clienteId == null) return null;
  const { data } = await sb
    .from("qa_clientes")
    .select("nome_completo, cpf, email, celular, endereco, numero, complemento, bairro, cidade, estado, cep")
    .or(`id_legado.eq.${clienteId},id.eq.${clienteId}`)
    .limit(1)
    .maybeSingle();
  return data as any | null;
}

async function loadClienteNome(sb: ReturnType<typeof svc>, clienteId: number | string | null | undefined) {
  if (clienteId == null) return null;
  const { data } = await sb
    .from("qa_clientes")
    .select("nome_completo")
    .or(`id_legado.eq.${clienteId},id.eq.${clienteId}`)
    .limit(1)
    .maybeSingle();
  return (data as any)?.nome_completo || null;
}

async function loadClienteNomeByContractVenda(sb: ReturnType<typeof svc>, contractVendaId: number | string | null | undefined) {
  if (contractVendaId == null) return null;
  const { data: venda } = await sb
    .from("qa_vendas")
    .select("cliente_id")
    .or(`id.eq.${contractVendaId},id_legado.eq.${contractVendaId}`)
    .limit(1)
    .maybeSingle();
  return loadClienteNome(sb, (venda as any)?.cliente_id);
}

function formatEnderecoCliente(cliente: any): string {
  if (!cliente) return "";
  return [
    cliente.endereco,
    cliente.numero ? `nº ${cliente.numero}` : null,
    cliente.complemento,
    cliente.bairro,
    cliente.cidade && cliente.estado ? `${cliente.cidade}/${cliente.estado}` : cliente.cidade,
    cliente.cep ? `CEP ${cliente.cep}` : null,
  ].filter(Boolean).join(", ");
}

async function rebuildRenderedContractHtml(sb: ReturnType<typeof svc>, contract: any) {
  const [{ data: template }, { data: items }, cliente] = await Promise.all([
    sb
      .from("qa_contract_templates")
      .select("id, codigo, versao, corpo_html")
      .eq("codigo", "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS")
      .eq("vigente", true)
      .maybeSingle(),
    sb
      .from("qa_contract_items")
      .select("service_slug_snapshot, service_name_snapshot, total_price_cents")
      .eq("contract_id", contract.id),
    loadCliente(sb, contract.cliente_id),
  ]);

  if (!(template as any)?.corpo_html) return { html: "", cliente };

  const rows = ((items as any[]) || []);
  const slugs = rows
    .map((item) => String(item.service_slug_snapshot || "").trim())
    .filter(Boolean);
  const servicoNome =
    rows.length > 1
      ? `${rows.length} serviços contratados em conjunto: ${rows.map((item) => item.service_name_snapshot || "Serviço").join("; ")}`
      : rows[0]?.service_name_snapshot || "Serviço contratado";
  const totalCents = rows.reduce((sum, item) => sum + Number(item.total_price_cents || 0), 0);
  const valorContrato = contract.valor != null
    ? Number(contract.valor)
    : totalCents / 100;
  const templateHtml = String((template as any).corpo_html || "");
  const corpoFiltrado = templateHtml.includes("{{anexos_i_dinamicos}}")
    ? aplicarAnexosDinamicos(templateHtml, await montarAnexosI(sb, slugs))
    : filterContractAnexosBySlugs(templateHtml, slugs);
  const html = substitute(corpoFiltrado, {
    cliente_nome: escapeHtml(cliente?.nome_completo || ""),
    cliente_cpf_cnpj: escapeHtml(cliente?.cpf || ""),
    cliente_endereco: escapeHtml(formatEnderecoCliente(cliente)),
    cliente_email: escapeHtml(cliente?.email || ""),
    cliente_telefone: escapeHtml(cliente?.celular || ""),
    servico_slug: escapeHtml(slugs.join(",")),
    servico_nome: escapeHtml(servicoNome),
    servico_preco: Number.isFinite(valorContrato)
      ? `R$ ${valorContrato.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "",
    aceite_data: contract.aceite_eletronico_data || "",
    aceite_ip: escapeHtml(contract.aceite_ip || ""),
    aceite_user_agent: escapeHtml(contract.aceite_user_agent || ""),
    aceite_hash: escapeHtml(contract.aceite_hash || ""),
  });

  return {
    html,
    cliente,
    template_id: (template as any).id,
    template_codigo: (template as any).codigo,
    template_versao: (template as any).versao,
    servico_slug: slugs.join(",") || contract.servico_slug || null,
    valor: Number.isFinite(valorContrato) ? valorContrato : contract.valor,
  };
}

async function ensureRenderedContractAudit(sb: ReturnType<typeof svc>, req: Request, contract: any) {
  let html = String(contract.conteudo_renderizado || "");
  let rebuilt: Awaited<ReturnType<typeof rebuildRenderedContractHtml>> | null = null;

  if (!html.trim()) {
    rebuilt = await rebuildRenderedContractHtml(sb, contract);
    html = rebuilt.html;
    if (rebuilt.cliente?.nome_completo) contract.cliente_nome = rebuilt.cliente.nome_completo;
    if (rebuilt.template_codigo) {
      contract.template_id = rebuilt.template_id;
      contract.template_codigo = rebuilt.template_codigo;
      contract.template_versao = rebuilt.template_versao;
      contract.servico_slug = rebuilt.servico_slug;
      contract.valor = rebuilt.valor;
    }
  }

  if (html.includes("{{")) {
    const cliente = rebuilt?.cliente || await loadCliente(sb, contract.cliente_id);
    const enderecoCliente = formatEnderecoCliente(cliente);
    html = substitute(html, {
      cliente_nome: escapeHtml((cliente as any)?.nome_completo || ""),
      cliente_cpf_cnpj: escapeHtml((cliente as any)?.cpf || ""),
      cliente_endereco: escapeHtml(enderecoCliente),
      cliente_email: escapeHtml((cliente as any)?.email || ""),
      cliente_telefone: escapeHtml((cliente as any)?.celular || ""),
      servico_slug: escapeHtml(contract.servico_slug || ""),
      servico_nome: "",
      servico_preco: contract.valor != null
        ? `R$ ${Number(contract.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "",
      aceite_data: contract.aceite_eletronico_data || "",
      aceite_ip: escapeHtml(contract.aceite_ip || ""),
      aceite_user_agent: escapeHtml(contract.aceite_user_agent || ""),
      aceite_hash: escapeHtml(contract.aceite_hash || ""),
    });

    if (cliente?.nome_completo) {
      contract.cliente_nome = cliente.nome_completo;
    }
  }

  if (!contract.cliente_nome) {
    contract.cliente_nome =
      await loadClienteNome(sb, contract.cliente_id) ||
      await loadClienteNomeByContractVenda(sb, contract.venda_id);
  }

  const missingAudit =
    !contract.aceite_eletronico_data ||
    !contract.aceite_ip ||
    !contract.aceite_user_agent ||
    !contract.aceite_hash ||
    html !== contract.conteudo_renderizado ||
    !!rebuilt?.template_codigo;

  if (!missingAudit) return { ...contract, conteudo_renderizado: html };

  const aceiteData = contract.aceite_eletronico_data || new Date().toISOString();
  const aceiteIp = contract.aceite_ip || requestIp(req);
  const aceiteUserAgent = contract.aceite_user_agent || req.headers.get("user-agent") || null;
  const aceiteHash = contract.aceite_hash || await sha256Text(`${html}|${aceiteData}|${contract.cliente_id}`);
  const patch = {
    conteudo_renderizado: html,
    template_id: rebuilt?.template_id ?? contract.template_id,
    template_codigo: rebuilt?.template_codigo ?? contract.template_codigo,
    template_versao: rebuilt?.template_versao ?? contract.template_versao,
    servico_slug: rebuilt?.servico_slug ?? contract.servico_slug,
    valor: rebuilt?.valor ?? contract.valor,
    aceite_eletronico_data: aceiteData,
    aceite_ip: aceiteIp,
    aceite_user_agent: aceiteUserAgent,
    aceite_hash: aceiteHash,
  };
  Object.keys(patch).forEach((key) => (patch as any)[key] === undefined && delete (patch as any)[key]);

  await sb.from("qa_contracts").update(patch).eq("id", contract.id);
  await sb.from("qa_contract_events").insert({
    contract_id: contract.id,
    event_type: "aceite_eletronico_registrado_download_portal",
    event_payload: {
      aceite_eletronico_data: aceiteData,
      aceite_ip: aceiteIp,
      user_agent_present: !!aceiteUserAgent,
      aceite_hash: aceiteHash,
    },
  });

  return { ...contract, ...patch };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const user = await authUser(req);
  const sb = svc();

  let contractId: string | null = null;
  let vendaId: number | null = null;
  let variant = "company_signed";
  let checkoutToken = "";

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      contractId = body.contract_id ?? null;
      vendaId = body.venda_id ? Number(body.venda_id) : null;
      variant = body.variant || variant;
      checkoutToken = String(body.checkout_token || "");
    } else {
      const u = new URL(req.url);
      contractId = u.searchParams.get("contract_id");
      const v = u.searchParams.get("venda_id");
      vendaId = v ? Number(v) : null;
      variant = u.searchParams.get("variant") || variant;
      checkoutToken = String(u.searchParams.get("checkout_token") || "");
    }
  } catch { /* ignore */ }

  if (!contractId && !vendaId) return jsonResp({ error: "contract_id ou venda_id obrigatório" }, 400);

  let vendaLookup: any | null = null;
  if (vendaId) {
    const { data } = await sb
      .from("qa_vendas")
      .select("id, id_legado, status, cobranca_status, cobranca_origem, checkout_token_hash, checkout_token_expires_at, cliente_id")
      .eq("id", vendaId)
      .maybeSingle();
    vendaLookup = data as any | null;
  }

  let q = sb.from("qa_contracts").select(
    "id, venda_id, cliente_id, status, original_pdf_path, company_signed_pdf_path, customer_signed_pdf_path, contract_number, conteudo_renderizado, template_id, template_codigo, template_versao, servico_slug, valor, aceite_eletronico_data, aceite_ip, aceite_user_agent, aceite_hash, created_at"
  );
  if (contractId) q = q.eq("id", contractId);
  else {
    const idsLookup = [vendaId!, ...((vendaLookup as any)?.id_legado ? [Number((vendaLookup as any).id_legado)] : [])];
    q = q.in("venda_id", idsLookup).order("created_at", { ascending: false }).limit(1);
  }
  const { data: contract } = await q.maybeSingle();
  if (!contract) return jsonResp({ error: "Contrato não encontrado" }, 404);

  // Resolve perfil + cliente (espelha cobranca-inline: tenta user_id direto, fallback via cliente_auth_links)
  const { data: perfil } = user
    ? await sb.from("qa_usuarios_perfis").select("perfil, ativo").eq("user_id", user.userId).eq("ativo", true).maybeSingle()
    : { data: null } as any;
  const isStaff = !!perfil;

  let publicCheckoutAccess = false;
  if (!user) {
    if (
      !vendaLookup ||
      !checkoutToken ||
      checkoutToken.length < 24 ||
      checkoutToken.length > 256 ||
      !/^[A-Za-z0-9_\-]+$/.test(checkoutToken)
    ) {
      return jsonResp({ error: "acesso_negado" }, 401);
    }
    const contractVendaMatches =
      Number((contract as any).venda_id) === Number((vendaLookup as any).id) ||
      Number((contract as any).venda_id) === Number((vendaLookup as any).id_legado);
    const submittedHash = await sha256Hex(checkoutToken);
    const storedHash = (vendaLookup as any).checkout_token_hash || "0".repeat(64);
    const tokenOk = constantTimeEqual(submittedHash, storedHash) && !!(vendaLookup as any).checkout_token_hash;
    const tokenValid =
      !!(vendaLookup as any).checkout_token_expires_at &&
      new Date((vendaLookup as any).checkout_token_expires_at).getTime() >= Date.now();
    publicCheckoutAccess =
      contractVendaMatches &&
      tokenOk &&
      tokenValid &&
      String((vendaLookup as any).cobranca_origem || "") === "checkout_site";
    if (!publicCheckoutAccess) {
      await logSistemaBackend({
        tipo: "contrato",
        status: "warning",
        mensagem: "qa-serve-contract-pdf: acesso publico negado",
        payload: {
          venda_id: vendaId,
          contract_id: (contract as any).id,
          contract_venda_id: (contract as any).venda_id,
          token_present: !!checkoutToken,
          token_valid: tokenValid,
          origem: (vendaLookup as any).cobranca_origem || null,
          ip: requestIp(req),
          user_agent: req.headers.get("user-agent"),
        },
      });
      return jsonResp({ error: "acesso_negado" }, 401);
    }
  }

  // Ownership — compara id_legado (inteiro) com id_legado do cliente autenticado
  if (user && !isStaff) {
    let cli: { id: unknown; id_legado: unknown } | null = null;
    const { data: cliDireto } = await sb.from("qa_clientes").select("id, id_legado").eq("user_id", user.userId).maybeSingle();
    cli = cliDireto;
    if (!cli) {
      const { data: link } = await sb.from("cliente_auth_links").select("qa_cliente_id").eq("user_id", user.userId).eq("status", "active").maybeSingle();
      if ((link as any)?.qa_cliente_id) {
        const { data: cliLink } = await sb.from("qa_clientes").select("id, id_legado").eq("id", (link as any).qa_cliente_id).maybeSingle();
        cli = cliLink;
      }
    }
    if (!cli || Number((contract as any).cliente_id) !== Number((cli as any).id_legado)) {
      return jsonResp({ error: "Acesso negado" }, 403);
    }
    if (variant === "original") variant = "company_signed";
  }

  const auditedContract = await ensureRenderedContractAudit(sb, req, contract as any);
  const html = auditedContract.conteudo_renderizado as string | null;

  // Preview HTML — disponível para staff e para o próprio cliente (após ownership check acima)
  if (variant === "html_preview" && html && html.trim()) {
    const fname = contractDownloadFilename(auditedContract, "html");
    return new Response(printableContractHtml(auditedContract as any, html), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${fname}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  // PDF canônico (bytes idênticos que serão comparados com o PDF assinado)
  if (variant === "company_signed" || variant === "original" || variant === "download_url") {
    if (!html || !html.trim()) {
      return await failContractDownload(req, user, auditedContract as any, variant, "contrato_renderizado_indisponivel", 409);
    }
    try {
      const canon = await ensureCanonicalPdf(sb, auditedContract as any, html);
      const fname = contractDownloadFilename(auditedContract, "pdf");

      if (variant === "download_url") {
        const { data: signed, error: signedErr } = await sb.storage
          .from(BUCKET)
          .createSignedUrl(canon.path, 600, { download: fname });

        if (signedErr || !signed?.signedUrl) {
          return await failContractDownload(
            req,
            user,
            auditedContract as any,
            variant,
            `signed_url_failed:${signedErr?.message ?? "url_ausente"}`,
            500,
          );
        }

        return jsonResp({
          url: signed.signedUrl,
          filename: fname,
          sha256: canon.sha256,
          expires_in: 600,
        });
      }

      return new Response(canon.bytes as BodyInit, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fname}"`,
          "Cache-Control": "private, max-age=60",
          "X-Original-Sha256": canon.sha256,
        },
      });
    } catch (e: any) {
      return await failContractDownload(req, user, auditedContract as any, variant, `pdf_generation_failed:${e?.message ?? "erro"}`, 500);
    }
  }

  let path: string | null = null;
  if (variant === "customer_signed") path = (auditedContract as any).customer_signed_pdf_path ?? null;
  else {
    return await failContractDownload(
      req,
      user,
      auditedContract as any,
      variant,
      "variant_desconhecida",
      400,
    );
  }

  if (!path) {
    return await failContractDownload(
      req,
      user,
      auditedContract as any,
      variant,
      `${variant}_path_indisponivel`,
      404,
    );
  }

  const { data: file, error: dlErr } = await sb.storage.from(BUCKET).download(path);
  if (dlErr || !file) {
    return await failContractDownload(
      req,
      user,
      auditedContract as any,
      variant,
      `storage_download_failed:${dlErr?.message ?? "arquivo_ausente"}`,
      500,
    );
  }

  const bytes = await file.arrayBuffer();
  const fname = contractDownloadFilename(auditedContract, "pdf");
  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
});

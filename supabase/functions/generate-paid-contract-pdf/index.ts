import { Buffer } from "node:buffer";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import {
  buildServiceName,
  corsHeaders,
  createServiceClient,
  ensureClientAccess,
  getPostPurchaseContext,
  isPaymentConfirmed,
} from "../_shared/post-purchase.ts";

const BUCKET = "paid-contracts";

function formatCurrency(value: number | null | undefined) {
  return `R$ ${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function paymentLabel(method: string | null | undefined) {
  if (method === "CREDIT_CARD") return "Cartão de Crédito";
  if (method === "BOLETO") return "Boleto Bancário";
  if (method === "PIX") return "PIX";
  return method || "Não informado";
}

function stripHtml(html?: string | null) {
  return (html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s+\n/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

async function loadLetterhead(pdfDoc: InstanceType<typeof PDFDocument>) {
  const LETTERHEAD_URL = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/contract-assets/timbrado-wmti.pdf`;
  try {
    const resp = await fetch(LETTERHEAD_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const letterheadDoc = await PDFDocument.load(bytes);
    const [embeddedPage] = await pdfDoc.embedPdf(letterheadDoc, [0]);
    return embeddedPage;
  } catch (err) {
    console.warn("[generate-paid-contract-pdf] Letterhead not available, using plain layout:", err);
    return null;
  }
}

async function buildPdfBytes(context: Awaited<ReturnType<typeof getPostPurchaseContext>>, access: Awaited<ReturnType<typeof ensureClientAccess>>) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginLeft = 50;
  const marginRight = 50;
  const topMargin = 120; // space for letterhead header
  const bottomMargin = 60; // space for letterhead footer

  const letterhead = await loadLetterhead(pdfDoc);

  const pages: ReturnType<typeof pdfDoc.addPage>[] = [];

  const addNewPage = () => {
    const p = pdfDoc.addPage([pageWidth, pageHeight]);
    if (letterhead) {
      p.drawPage(letterhead, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    }
    pages.push(p);
    return p;
  };

  let page = addNewPage();
  let y = pageHeight - topMargin;

  const ensureSpace = (height: number) => {
    if (y - height < bottomMargin) {
      page = addNewPage();
      y = pageHeight - topMargin;
    }
  };

  const wrapText = (text: string, fontRef: typeof font, size: number, maxWidth: number) => {
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (fontRef.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const drawTextBlock = (text: string, options: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; justify?: boolean } = {}) => {
    const size = options.size || 10;
    const fontRef = options.bold ? bold : font;
    const xStart = marginLeft + (options.indent || 0);
    const maxWidth = pageWidth - marginLeft - marginRight - (options.indent || 0);
    const lines = wrapText(text, fontRef, size, maxWidth);
    const lineHeight = size + 3;
    const shouldJustify = options.justify === true;

    ensureSpace(lines.length * lineHeight + 6);
    lines.forEach((current, idx) => {
      const isLastLine = idx === lines.length - 1;
      const lineWidth = fontRef.widthOfTextAtSize(current, size);
      const isShortLine = lineWidth < maxWidth * 0.75;

      if (shouldJustify && !isLastLine && !isShortLine && lines.length > 1) {
        // Justified: distribute extra space between words
        const words = current.split(/\s+/);
        if (words.length > 1) {
          const totalWordWidth = words.reduce((sum, w) => sum + fontRef.widthOfTextAtSize(w, size), 0);
          const extraSpace = (maxWidth - totalWordWidth) / (words.length - 1);
          let cx = xStart;
          words.forEach((word, wi) => {
            page.drawText(word, { x: cx, y, size, font: fontRef, color: options.color || rgb(0.2, 0.2, 0.2) });
            cx += fontRef.widthOfTextAtSize(word, size) + extraSpace;
          });
        } else {
          page.drawText(current, { x: xStart, y, size, font: fontRef, color: options.color || rgb(0.2, 0.2, 0.2) });
        }
      } else {
        page.drawText(current, { x: xStart, y, size, font: fontRef, color: options.color || rgb(0.2, 0.2, 0.2) });
      }
      y -= lineHeight;
    });
    y -= 4;
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(28);
    page.drawRectangle({
      x: marginLeft,
      y: y - 8,
      width: pageWidth - marginLeft - marginRight,
      height: 22,
      color: rgb(1, 0.95, 0.91),
    });
    page.drawText(title, {
      x: marginLeft + 10,
      y,
      size: 11,
      font: bold,
      color: rgb(0.9, 0.34, 0.12),
    });
    y -= 28;
  };

  // Title line (no more manual dark header — letterhead handles branding)
  drawTextBlock("Contrato final liberado após pagamento confirmado", {
    size: 12,
    bold: true,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 6;

  drawTextBlock(`Pedido ${context.quote.id.slice(0, 8).toUpperCase()} • Contrato ${context.contract.id.slice(0, 8).toUpperCase()} • ${new Date(context.payment.created_at).toLocaleDateString("pt-BR")}`, {
    size: 10,
    color: rgb(0.45, 0.45, 0.48),
  });

  drawSectionTitle("Dados do contratante");
  drawTextBlock(`Razão social: ${context.customer.razao_social}`, { bold: true });
  drawTextBlock(`CNPJ/CPF: ${context.customer.cnpj_ou_cpf}`);
  drawTextBlock(`Responsável: ${context.customer.responsavel}`);
  drawTextBlock(`E-mail: ${context.customer.email}`);

  drawSectionTitle("Dados da contratada");
  drawTextBlock("WMTI TECNOLOGIA DA INFORMAÇÃO LTDA", { bold: true });
  drawTextBlock("CNPJ: 13.366.668/0001-07");

  // === Premium contract data table ===
  y -= 8;
  ensureSpace(140);
  const tableX = marginLeft;
  const tableWidth = pageWidth - marginLeft - marginRight;
  const labelColWidth = 160;
  const valueColWidth = tableWidth - labelColWidth;
  const rowHeight = 22;
  const tableFontSize = 9;
  const tableData = [
    { label: "Serviço / Plano", value: buildServiceName(context), highlight: true },
    { label: "Tipo de contrato", value: context.contract.contract_type || "Não informado" },
    { label: "Quantidade", value: `${context.quote.computers_qty || 0} equipamento(s)` },
    { label: "Valor contratado", value: formatCurrency(context.contract.monthly_value ?? context.quote.monthly_value ?? context.payment.amount), highlight: true },
    { label: "Forma de pagamento", value: paymentLabel(context.payment.billing_type || context.payment.payment_method) },
    { label: "Status do pagamento", value: "Confirmado", highlight: true },
  ];

  for (let i = 0; i < tableData.length; i++) {
    const row = tableData[i];
    const rowY = y - rowHeight;
    ensureSpace(rowHeight + 2);

    // Row background (alternating)
    const bgColor = i % 2 === 0 ? rgb(0.98, 0.98, 0.99) : rgb(1, 1, 1);
    page.drawRectangle({ x: tableX, y: rowY, width: tableWidth, height: rowHeight, color: bgColor });
    // Borders
    page.drawLine({ start: { x: tableX, y: rowY }, end: { x: tableX + tableWidth, y: rowY }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });
    page.drawLine({ start: { x: tableX, y: rowY + rowHeight }, end: { x: tableX + tableWidth, y: rowY + rowHeight }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });
    // Label cell
    page.drawRectangle({ x: tableX, y: rowY, width: labelColWidth, height: rowHeight, color: rgb(0.95, 0.95, 0.96) });
    page.drawText(row.label, { x: tableX + 8, y: rowY + 7, size: tableFontSize, font: bold, color: rgb(0.2, 0.2, 0.2) });
    // Value cell
    const valueFont = row.highlight ? bold : font;
    const valueColor = row.label === "Status do pagamento" ? rgb(0.13, 0.47, 0.24) : rgb(0.15, 0.15, 0.15);
    page.drawText(row.value, { x: tableX + labelColWidth + 8, y: rowY + 7, size: tableFontSize, font: valueFont, color: valueColor });

    y = rowY;
  }
  // Bottom border
  page.drawLine({ start: { x: tableX, y }, end: { x: tableX + tableWidth, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  y -= 12;

  drawSectionTitle("Acesso ao portal do cliente");
  drawTextBlock(`Login: ${access.email}`, { bold: true });
  drawTextBlock(`Senha temporária: ${access.temp_password}`, { bold: true, color: rgb(0.9, 0.34, 0.12) });
  drawTextBlock("Aviso: a troca de senha é obrigatória no primeiro acesso ao portal do cliente.", {
    color: rgb(0.62, 0.35, 0.02),
  });

  const contractBody = stripHtml(context.contract.contract_text);
  if (contractBody) {
    // Remove old generic header - contract title comes from the clauses themselves
    y -= 8;
    const clauseRegex = /^CL[ÁA]USULA\s/i;
    const paragraphs = contractBody.split(/\n+/).filter((p) => p.trim());

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      const isClause = clauseRegex.test(trimmed);

      if (isClause) {
        // Add spacing before clause (blank line)
        y -= 14;
        // Draw clause title: BOLD, uppercase, left-aligned (no justify)
        drawTextBlock(trimmed.toUpperCase(), {
          size: 10,
          bold: true,
          color: rgb(0.15, 0.15, 0.15),
        });
      } else {
        // Body paragraph: justified text
        drawTextBlock(trimmed, { size: 9, justify: true });
      }
    }
  }

  // === FOOTER: Date, Signatures, Traceability ===
  y -= 30;

  // Date line (bold)
  const contractDate = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  drawTextBlock(`Jacareí/SP, ${contractDate}`, { size: 10, bold: true });

  // 3 blank lines
  y -= 36;

  // CONTRATANTE signature block (centered)
  const lineWidth = 250;
  const centerX = (pageWidth - lineWidth) / 2;

  ensureSpace(130);

  // CONTRATANTE line
  page.drawLine({ start: { x: centerX, y }, end: { x: centerX + lineWidth, y }, thickness: 0.8, color: rgb(0.3, 0.3, 0.3) });
  y -= 14;

  const contratanteNome = (context.customer.razao_social || "").toUpperCase();
  const contratanteCnpj = context.customer.cnpj_ou_cpf || "00.000.000/0000-00";
  const cnpjType = contratanteCnpj.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF";

  // Contratante name centered
  const contratanteNameWidth = bold.widthOfTextAtSize(contratanteNome, 8);
  page.drawText(contratanteNome, { x: centerX + (lineWidth - contratanteNameWidth) / 2, y, size: 8, font: bold, color: rgb(0.15, 0.15, 0.15) });
  y -= 12;
  // CNPJ line
  const cnpjLabel = `${cnpjType}: `;
  const cnpjFullWidth = bold.widthOfTextAtSize(cnpjLabel, 8) + font.widthOfTextAtSize(contratanteCnpj, 8);
  const cnpjStartX = centerX + (lineWidth - cnpjFullWidth) / 2;
  page.drawText(cnpjLabel, { x: cnpjStartX, y, size: 8, font: bold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(contratanteCnpj, { x: cnpjStartX + bold.widthOfTextAtSize(cnpjLabel, 8), y, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 12;
  const contratanteLabel = "CONTRATANTE";
  const contratanteLabelWidth = bold.widthOfTextAtSize(contratanteLabel, 7);
  page.drawText(contratanteLabel, { x: centerX + (lineWidth - contratanteLabelWidth) / 2, y, size: 7, font: bold, color: rgb(0.4, 0.4, 0.4) });

  // Visual break between blocks
  y -= 30;

  // CONTRATADA signature block (centered)
  ensureSpace(60);
  page.drawLine({ start: { x: centerX, y }, end: { x: centerX + lineWidth, y }, thickness: 0.8, color: rgb(0.3, 0.3, 0.3) });
  y -= 14;

  const wmtiName = "WMTI TECNOLOGIA DA INFORMAÇÃO LTDA";
  const wmtiNameWidth = bold.widthOfTextAtSize(wmtiName, 8);
  page.drawText(wmtiName, { x: centerX + (lineWidth - wmtiNameWidth) / 2, y, size: 8, font: bold, color: rgb(0.15, 0.15, 0.15) });
  y -= 12;
  const wmtiCnpjLabel = "CNPJ: ";
  const wmtiCnpjValue = "13.366.668/0001-07";
  const wmtiCnpjFullWidth = bold.widthOfTextAtSize(wmtiCnpjLabel, 8) + font.widthOfTextAtSize(wmtiCnpjValue, 8);
  const wmtiCnpjStartX = centerX + (lineWidth - wmtiCnpjFullWidth) / 2;
  page.drawText(wmtiCnpjLabel, { x: wmtiCnpjStartX, y, size: 8, font: bold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(wmtiCnpjValue, { x: wmtiCnpjStartX + bold.widthOfTextAtSize(wmtiCnpjLabel, 8), y, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 12;
  const contratadaLabel = "CONTRATADA";
  const contratadaLabelWidth = bold.widthOfTextAtSize(contratadaLabel, 7);
  page.drawText(contratadaLabel, { x: centerX + (lineWidth - contratadaLabelWidth) / 2, y, size: 7, font: bold, color: rgb(0.4, 0.4, 0.4) });

  y -= 30;

  // Traceability block
  ensureSpace(90);
  drawTextBlock("DADOS DE RASTREABILIDADE DA ASSINATURA ELETRÔNICA", { size: 9, bold: true, color: rgb(0.15, 0.15, 0.15) });
  y -= 4;

  // Fetch real signature data from contract_signatures table
  let signIp = context.contract.client_ip || "Não disponível";
  let signAgent = "Não disponível";
  let signDateRaw = context.contract.signed_at ? new Date(context.contract.signed_at) : new Date();

  try {
    const supabaseForSig = createServiceClient();
    const { data: sigData } = await supabaseForSig
      .from("contract_signatures")
      .select("ip_address, user_agent, signed_at")
      .eq("contract_id", context.contract.id)
      .order("signed_at", { ascending: false })
      .limit(1)
      .single();
    if (sigData) {
      signIp = sigData.ip_address || signIp;
      signAgent = sigData.user_agent || signAgent;
      if (sigData.signed_at) signDateRaw = new Date(sigData.signed_at);
    }
  } catch {}

  const signDate = signDateRaw.toLocaleDateString("pt-BR");
  const signTime = signDateRaw.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });

  // Each traceability line: label bold, value normal
  const traceItems = [
    { label: "IP de origem: ", value: signIp },
    { label: "Data da confirmação: ", value: signDate },
    { label: "Hora da confirmação: ", value: signTime },
    { label: "Dispositivo/Navegador: ", value: signAgent },
  ];
  for (const item of traceItems) {
    ensureSpace(14);
    page.drawText(item.label, { x: marginLeft, y, size: 8, font: bold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(item.value, { x: marginLeft + bold.widthOfTextAtSize(item.label, 8), y, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
    y -= 12;
  }

  // 3 blank lines then closing text
  y -= 36;
  ensureSpace(30);
  drawTextBlock("Este documento foi assinado eletronicamente conforme a Medida Provisória 2.200-2/2001 e tem validade jurídica entre as partes.", {
    size: 7.5,
    color: rgb(0.45, 0.45, 0.45),
    justify: true,
  });

  return await pdfDoc.save();
}

async function resolveSignedUrl(supabase: ReturnType<typeof createServiceClient>, pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pathOrUrl, 60 * 60);
  if (error || !data?.signedUrl) {
    throw new Error(`Não foi possível gerar o link do PDF: ${error?.message || "sem URL"}`);
  }
  return data.signedUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const quoteId = body.quote_id as string | undefined;
    const contractId = body.contract_id as string | undefined;
    const sendEmail = body.send_email === true;
    const generateIfMissing = sendEmail ? true : body.generate_if_missing !== false;

    if (!quoteId && !contractId) {
      return new Response(JSON.stringify({ success: false, error: "quote_id ou contract_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createServiceClient();
    const context = await getPostPurchaseContext(supabase, { quoteId, contractId });

    if (!isPaymentConfirmed(context.payment.payment_status)) {
      return new Response(JSON.stringify({ success: false, error: "Pagamento não confirmado", status: "pending" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const access = await ensureClientAccess(supabase, context.quote.id, body.access_source === "payment_webhook" ? "payment_webhook" : "access_recovery");
    if (!access.success || !access.email || !access.temp_password) {
      return new Response(JSON.stringify({ success: false, error: access.error || "Credenciais indisponíveis" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let pdfPath = context.contract.contract_pdf_path;
    let pdfBytes: Uint8Array | null = null;
    let generated = false;
    let reusedExisting = false;

    if (pdfPath) {
      reusedExisting = true;
    } else if (!generateIfMissing) {
      return new Response(JSON.stringify({
        success: true,
        generated: false,
        reused_existing: false,
        pdf_url: null,
        file_name: `contrato-wmti-${context.contract.id.slice(0, 8).toUpperCase()}.pdf`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pdfPath) {
      pdfBytes = await buildPdfBytes(context, access);
      pdfPath = `${access.user_id}/${context.contract.id}/contrato-pago-${context.contract.id.slice(0, 8).toLowerCase()}.pdf`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

      if (uploadError) {
        throw new Error(`Falha ao salvar PDF: ${uploadError.message}`);
      }

      await supabase.from("contracts").update({ contract_pdf_path: pdfPath }).eq("id", context.contract.id);
      generated = true;
      reusedExisting = false;

      // Auto-sign with A1 certificate if enabled
      try {
        const signUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sign-contract-pdf`;
        const signResp = await fetch(signUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
          },
          body: JSON.stringify({
            contract_id: context.contract.id,
            pdf_path: pdfPath,
            ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
            user_agent: req.headers.get("user-agent") || null,
          }),
        });
        const signResult = await signResp.json();
        if (signResult.success && signResult.signed_pdf_path) {
          pdfPath = signResult.signed_pdf_path;
          console.log("[generate-paid-contract-pdf] Contract signed successfully:", signResult.signed_pdf_path);
        } else if (signResult.blocked) {
          // Signature failed and blocked - do not proceed
          return new Response(JSON.stringify({
            success: false,
            error: "Assinatura digital falhou. Contrato bloqueado para proteção.",
            details: signResult.error,
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else if (signResult.skipped) {
          console.log("[generate-paid-contract-pdf] Auto-signing skipped (not enabled)");
        }
      } catch (signErr) {
        console.warn("[generate-paid-contract-pdf] Auto-sign call failed (non-blocking):", signErr);
      }
    }

    const pdfUrl = await resolveSignedUrl(supabase, pdfPath);
    const fileName = `contrato-wmti-${context.contract.id.slice(0, 8).toUpperCase()}.pdf`;

    if (sendEmail) {
      if (!pdfBytes && pdfPath && !pdfPath.startsWith("http")) {
        const { data: downloaded, error: downloadError } = await supabase.storage.from(BUCKET).download(pdfPath);
        if (downloadError) throw new Error(`Falha ao ler PDF salvo: ${downloadError.message}`);
        pdfBytes = new Uint8Array(await downloaded.arrayBuffer());
      }

      const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-purchase-confirmation`;
      await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
        },
        body: JSON.stringify({
          customer_name: context.customer.razao_social,
          customer_email: access.email,
          service_name: buildServiceName(context),
          computers_qty: context.quote.computers_qty,
          value: context.contract.monthly_value ?? context.quote.monthly_value ?? context.payment.amount,
          payment_method: context.payment.billing_type || context.payment.payment_method,
          contract_ref: context.contract.id.slice(0, 8).toUpperCase(),
          purchase_date: new Date(context.quote.created_at).toLocaleDateString("pt-BR"),
          is_recurring: context.contract.contract_type === "locacao",
          login_email: access.email,
          temp_password: access.temp_password,
          download_url: pdfUrl,
          attachment_filename: fileName,
          attachment_base64: pdfBytes ? Buffer.from(pdfBytes).toString("base64") : null,
        }),
      });
    }

    await logSistemaBackend({
      tipo: "contrato",
      status: "success",
      mensagem: generated ? "PDF final do contrato gerado" : "PDF final do contrato reutilizado",
      payload: { quote_id: context.quote.id, contract_id: context.contract.id, pdf_path: pdfPath, send_email: sendEmail },
    });

    return new Response(JSON.stringify({
      success: true,
      pdf_url: pdfUrl,
      file_name: fileName,
      generated,
      reused_existing: reusedExisting,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    await logSistemaBackend({
      tipo: "erro",
      status: "error",
      mensagem: "Erro ao gerar PDF final do contrato",
      payload: { error: message },
    });
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
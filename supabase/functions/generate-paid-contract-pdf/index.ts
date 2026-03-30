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

async function buildPdfBytes(context: Awaited<ReturnType<typeof getPostPurchaseContext>>, access: Awaited<ReturnType<typeof ensureClientAccess>>) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;
  const lineHeight = 15;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (height: number) => {
    if (y - height < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const drawTextBlock = (text: string, options: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number } = {}) => {
    const size = options.size || 10;
    const fontRef = options.bold ? bold : font;
    const maxWidth = pageWidth - margin * 2 - (options.indent || 0);
    const words = text.split(/\s+/);
    let line = "";
    const lines: string[] = [];

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const width = fontRef.widthOfTextAtSize(candidate, size);
      if (width <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);

    ensureSpace(lines.length * (size + 3) + 6);
    lines.forEach((current) => {
      page.drawText(current, {
        x: margin + (options.indent || 0),
        y,
        size,
        font: fontRef,
        color: options.color || rgb(0.2, 0.2, 0.2),
      });
      y -= size + 3;
    });
    y -= 4;
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(28);
    page.drawRectangle({
      x: margin,
      y: y - 8,
      width: pageWidth - margin * 2,
      height: 22,
      color: rgb(1, 0.95, 0.91),
    });
    page.drawText(title, {
      x: margin + 10,
      y,
      size: 11,
      font: bold,
      color: rgb(0.9, 0.34, 0.12),
    });
    y -= 28;
  };

  page.drawRectangle({ x: 0, y: pageHeight - 90, width: pageWidth, height: 90, color: rgb(0.08, 0.09, 0.12) });
  page.drawText("WMTi Tecnologia da Informação", {
    x: margin,
    y: pageHeight - 44,
    size: 20,
    font: bold,
    color: rgb(1, 0.35, 0.12),
  });
  page.drawText("Contrato final liberado após pagamento confirmado", {
    x: margin,
    y: pageHeight - 64,
    size: 10,
    font,
    color: rgb(0.86, 0.86, 0.88),
  });
  y = pageHeight - 118;

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

  drawSectionTitle("Dados da contratação");
  drawTextBlock(`Serviço/plano: ${buildServiceName(context)}`, { bold: true });
  drawTextBlock(`Tipo de contrato: ${context.contract.contract_type || "Não informado"}`);
  drawTextBlock(`Quantidade: ${context.quote.computers_qty || 0} equipamento(s)`);
  drawTextBlock(`Valor contratado: ${formatCurrency(context.contract.monthly_value ?? context.quote.monthly_value ?? context.payment.amount)}`);
  drawTextBlock(`Forma de pagamento: ${paymentLabel(context.payment.billing_type || context.payment.payment_method)}`);
  drawTextBlock(`Status do pagamento: Confirmado`, { bold: true, color: rgb(0.13, 0.47, 0.24) });

  drawSectionTitle("Acesso ao portal do cliente");
  drawTextBlock(`Login: ${access.email}`, { bold: true });
  drawTextBlock(`Senha temporária: ${access.temp_password}`, { bold: true, color: rgb(0.9, 0.34, 0.12) });
  drawTextBlock("Aviso: a troca de senha é obrigatória no primeiro acesso ao portal do cliente.", {
    color: rgb(0.62, 0.35, 0.02),
  });

  const contractBody = stripHtml(context.contract.contract_text);
  if (contractBody) {
    drawSectionTitle("Texto contratual");
    contractBody.split(/\n+/).forEach((paragraph) => {
      if (paragraph.trim()) drawTextBlock(paragraph.trim(), { size: 9 });
    });
  }

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
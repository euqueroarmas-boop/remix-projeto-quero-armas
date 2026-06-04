/**
 * qa-generate-contract
 * BLOCO 10 — gera contrato pós-pagamento da Quero Armas a partir de uma venda.
 *
 *  - Idempotente (UNIQUE em qa_contracts.venda_id).
 *  - Congela snapshot dos itens (qa_contract_items) — depois disso o catálogo
 *    NUNCA mais é consultado para este contrato.
 *  - Renderiza PDF com pdf-lib e salva em storage `paid-contracts/qa/<venda>/original.pdf`.
 *  - Calcula SHA-256 e registra qa_contract_events('generated').
 *  - status inicial: generated_pending_company_signature.
 *  - NÃO libera processo/checklist.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { requireAdminOrInternal } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
};

const BUCKET = "paid-contracts";

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function nowYearSeq() {
  const d = new Date();
  return `QA-${d.getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
}

function strip(html: string | null | undefined) {
  return (html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>(?!\s)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function buildPdf(opts: {
  contractNumber: string;
  cliente: { nome_completo: string; cpf?: string | null; cidade?: string | null; estado?: string | null };
  venda: { id_legado: number; data_cadastro?: string | null; valor_aprovado?: number | null };
  items: Array<{
    name: string;
    description: string | null;
    quantity: number;
    unit_price_cents: number;
    total_price_cents: number;
  }>;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  const black = rgb(0.06, 0.06, 0.06);
  const bordo = rgb(0.478, 0.122, 0.169); // #7A1F2B
  const muted = rgb(0.35, 0.35, 0.35);

  const newPageIfNeeded = (need = 60) => {
    if (y - need < margin) {
      page = pdf.addPage([595.28, 841.89]);
      y = page.getSize().height - margin;
    }
  };

  const drawText = (
    text: string,
    opts: { size?: number; font?: typeof helv; color?: ReturnType<typeof rgb>; x?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    const font = opts.font ?? helv;
    const color = opts.color ?? black;
    const x = opts.x ?? margin;
    const maxWidth = width - margin * 2 - (x - margin);
    // wrap
    const words = text.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        newPageIfNeeded(size + 4);
        page.drawText(line, { x, y, size, font, color });
        y -= size + 3;
        line = w;
      } else {
        line = test;
      }
    }
    if (line) {
      newPageIfNeeded(size + 4);
      page.drawText(line, { x, y, size, font, color });
      y -= size + 3;
    }
  };

  // Header
  page.drawRectangle({ x: 0, y: height - 64, width, height: 64, color: bordo });
  page.drawText("QUERO ARMAS", { x: margin, y: height - 36, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", { x: margin, y: height - 54, size: 9, font: helv, color: rgb(0.95, 0.92, 0.92) });
  y = height - 90;

  drawText(`CONTRATO Nº ${opts.contractNumber}`, { size: 12, font: bold });
  drawText(`Venda nº ${opts.venda.id_legado} · Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, { size: 9, color: muted });
  y -= 8;

  // Partes
  drawText("CONTRATANTE", { size: 11, font: bold, color: bordo });
  drawText(`${opts.cliente.nome_completo.toUpperCase()}${opts.cliente.cpf ? ` — CPF ${opts.cliente.cpf}` : ""}`, { size: 10 });
  if (opts.cliente.cidade) {
    drawText(`${opts.cliente.cidade}${opts.cliente.estado ? "/" + opts.cliente.estado : ""}`, { size: 9, color: muted });
  }
  y -= 6;

  drawText("CONTRATADA", { size: 11, font: bold, color: bordo });
  drawText("QUERO ARMAS — Equipe Quero Armas, prestadora de serviços jurídicos e administrativos.", { size: 10 });
  y -= 10;

  // Itens
  drawText("OBJETO — SERVIÇOS CONTRATADOS", { size: 11, font: bold, color: bordo });
  y -= 4;

  let totalCents = 0;
  opts.items.forEach((it, i) => {
    newPageIfNeeded(72);
    drawText(`${String(i + 1).padStart(2, "0")}. ${it.name.toUpperCase()}`, { size: 10, font: bold });
    if (it.description) drawText(strip(it.description), { size: 9, color: muted });
    drawText(
      `Qtd: ${it.quantity}    Unit.: ${brl(it.unit_price_cents)}    Total: ${brl(it.total_price_cents)}`,
      { size: 9 },
    );
    totalCents += it.total_price_cents;
    y -= 4;
  });

  // Total
  newPageIfNeeded(40);
  page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: width - margin, y: y - 2 }, color: muted, thickness: 0.5 });
  y -= 12;
  drawText(`VALOR TOTAL DO CONTRATO: ${brl(totalCents)}`, { size: 12, font: bold });
  y -= 12;

  // Cláusulas mínimas
  drawText("CLÁUSULAS GERAIS", { size: 11, font: bold, color: bordo });
  drawText(
    "1. O presente contrato refere-se exclusivamente aos serviços listados acima, contratados na venda referenciada.",
    { size: 9 },
  );
  drawText(
    "2. A execução dos serviços inicia-se após validação criptográfica da assinatura do CONTRATANTE neste instrumento.",
    { size: 9 },
  );
  drawText(
    "3. Os valores aqui descritos correspondem ao acordado no checkout e refletem o snapshot imutável da contratação.",
    { size: 9 },
  );
  drawText(
    "4. A CONTRATADA assina o presente instrumento por meio de certificado digital ICP-Brasil ou representação legal Gov.br.",
    { size: 9 },
  );
  drawText(
    "5. O CONTRATANTE deverá assinar este contrato com Gov.br ou certificado ICP-Brasil próprio, e enviá-lo pelo Portal do Cliente.",
    { size: 9 },
  );
  drawText(
    "6. Aceite no checkout NÃO substitui a assinatura formal exigida nesta cláusula.",
    { size: 9 },
  );

  // Footer
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Página ${i + 1} de ${pages.length} — Contrato ${opts.contractNumber}`, {
      x: margin,
      y: 24,
      size: 7,
      font: helv,
      color: muted,
    });
  });

  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: aceita admin/internal OU bearer service-role (usado pelo trigger pg_net).
  const authHeader = req.headers.get("Authorization") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isServiceRole =
    authHeader.startsWith("Bearer ") && authHeader.slice(7).trim() === serviceRole;
  // FASE 2C-4: aceita também invocação da trigger Postgres `qa_vendas_after_pago_invoke_contract`
  // (anon key + header `x-trigger-source: qa_vendas_pago_contract`). É seguro porque a função
  // só age sobre vendas com status='PAGO' já gravado em DB e é idempotente (UNIQUE venda_id).
  const triggerSource = req.headers.get("x-trigger-source") || "";
  const isTriggerCall = triggerSource === "qa_vendas_pago_contract";
  if (!isServiceRole && !isTriggerCall) {
    const guard = await requireAdminOrInternal(req);
    if (!guard.ok) return guard.response;
  }

  let body: { venda_id?: number };
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "JSON inválido" }, 400);
  }
  const vendaId = Number(body.venda_id);
  if (!vendaId || Number.isNaN(vendaId)) return jsonResp({ error: "venda_id obrigatório" }, 400);

  const sb = svc();

  // Idempotência
  const { data: existing } = await sb
    .from("qa_contracts")
    .select("id, status, contract_number, original_pdf_path")
    .eq("venda_id", vendaId)
    .maybeSingle();
  if (existing) return jsonResp({ ok: true, idempotent: true, contract: existing });

  // Carrega venda
  const { data: venda, error: vErr } = await sb
    .from("qa_vendas")
    .select("id, id_legado, cliente_id, status, valor_aprovado, valor_a_pagar, data_cadastro")
    .eq("id_legado", vendaId)
    .maybeSingle();
  if (vErr || !venda) return jsonResp({ error: "Venda não encontrada" }, 404);

  const statusUp = (venda.status || "").toUpperCase().trim();
  if (statusUp !== "PAGO") {
    return jsonResp({ error: `Venda ainda não está PAGO (status atual: ${venda.status})` }, 409);
  }

  // Cliente
  const { data: cliente } = await sb
    .from("qa_clientes")
    .select("id_legado, nome_completo, cpf, cidade, estado")
    .eq("id_legado", venda.cliente_id)
    .maybeSingle();
  if (!cliente) return jsonResp({ error: "Cliente não encontrado" }, 404);

  // Itens da venda
  const { data: itens, error: iErr } = await sb
    .from("qa_itens_venda")
    .select("id, servico_id, valor")
    .eq("venda_id", vendaId);
  if (iErr) return jsonResp({ error: "Falha ao ler itens", details: iErr.message }, 500);

  // Catálogo (apenas para snapshot)
  const servicoIds = (itens || []).map((i) => i.servico_id).filter(Boolean) as number[];
  const catalogMap: Record<number, { slug: string | null; nome: string; descricao: string | null }> = {};
  if (servicoIds.length) {
    const { data: catalog } = await sb
      .from("qa_servicos_catalogo")
      .select("servico_id, slug, nome, descricao_curta")
      .in("servico_id", servicoIds);
    (catalog || []).forEach((c: any) => {
      catalogMap[c.servico_id] = { slug: c.slug, nome: c.nome, descricao: c.descricao_curta };
    });
  }

  const snapshot = (itens || []).map((it: any) => {
    const cat = it.servico_id ? catalogMap[it.servico_id] : undefined;
    const unit = Math.round(Number(it.valor || 0) * 100);
    return {
      item_venda_id: it.id,
      service_id_snapshot: it.servico_id ?? null,
      service_slug_snapshot: cat?.slug ?? null,
      service_name_snapshot: cat?.nome ?? `Serviço #${it.servico_id ?? "?"}`,
      service_description_snapshot: cat?.descricao ?? null,
      quantity: 1,
      unit_price_cents: unit,
      total_price_cents: unit,
    };
  });

  if (!snapshot.length) {
    return jsonResp({ error: "Venda sem itens — não é possível gerar contrato" }, 422);
  }

  // PDF
  const contractNumber = nowYearSeq();
  const pdfBytes = await buildPdf({
    contractNumber,
    cliente: {
      nome_completo: cliente.nome_completo,
      cpf: cliente.cpf,
      cidade: cliente.cidade,
      estado: cliente.estado,
    },
    venda: {
      id_legado: venda.id_legado,
      data_cadastro: venda.data_cadastro,
      valor_aprovado: venda.valor_aprovado,
    },
    items: snapshot.map((s) => ({
      name: s.service_name_snapshot,
      description: s.service_description_snapshot,
      quantity: s.quantity,
      unit_price_cents: s.unit_price_cents,
      total_price_cents: s.total_price_cents,
    })),
  });

  const originalSha = await sha256(pdfBytes);
  const path = `qa/${vendaId}/original.pdf`;

  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (upErr) return jsonResp({ error: "Falha ao gravar PDF", details: upErr.message }, 500);

  // Insert contract
  const { data: contract, error: cErr } = await sb
    .from("qa_contracts")
    .insert({
      venda_id: vendaId,
      cliente_id: venda.cliente_id,
      contract_number: contractNumber,
      status: "generated_pending_company_signature",
      original_pdf_path: path,
      original_sha256: originalSha,
      issued_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (cErr || !contract) {
    // tentar limpar arquivo se falhou linha
    await sb.storage.from(BUCKET).remove([path]).catch(() => {});
    return jsonResp({ error: "Falha ao criar contrato", details: cErr?.message }, 500);
  }

  // Insert items snapshot
  const itemsRows = snapshot.map((s) => ({
    contract_id: contract.id,
    venda_id: vendaId,
    item_venda_id: s.item_venda_id ?? null,
    service_id_snapshot: s.service_id_snapshot,
    service_slug_snapshot: s.service_slug_snapshot,
    service_name_snapshot: s.service_name_snapshot,
    service_description_snapshot: s.service_description_snapshot,
    quantity: s.quantity,
    unit_price_cents: s.unit_price_cents,
    total_price_cents: s.total_price_cents,
  }));
  await sb.from("qa_contract_items").insert(itemsRows);

  await sb.from("qa_contract_events").insert({
    contract_id: contract.id,
    event_type: "generated",
    event_payload: { contract_number: contractNumber, sha256: originalSha, items: snapshot.length },
  });

  // FASE 2C-4: evento de auditoria semântico do fluxo pós-pagamento
  await sb.from("qa_contract_events").insert({
    contract_id: contract.id,
    event_type: "contrato_gerado_pos_pagamento",
    event_payload: {
      venda_id: vendaId,
      cliente_id: venda.cliente_id,
      contract_number: contractNumber,
      trigger_source: isTriggerCall ? triggerSource : (isServiceRole ? "service_role" : "admin"),
    },
  });

  return jsonResp({
    ok: true,
    contract: {
      id: contract.id,
      contract_number: contractNumber,
      original_pdf_path: path,
      original_sha256: originalSha,
      items: snapshot.length,
    },
  });
});
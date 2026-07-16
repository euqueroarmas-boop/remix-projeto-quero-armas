// qa-cliente-cobranca-inline
// Central de dados de cobrança Asaas para a Central Financeira do cliente.
//
// Actions:
//   gerar_por_forma  — cria ou reutiliza payment Asaas no billing type solicitado.
//                      PIX → QR code. BOLETO → linha digitável. CREDIT_CARD → invoiceUrl.
//                      O cliente pode trocar de forma livremente; a cobrança original
//                      não é cancelada — qualquer payment pago ativa a venda via webhook.
//   reemitir_boleto  — atualiza vencimento para hoje+3d, aguarda Asaas regenerar barcode.
//   pix              — (legado) busca QR do payment principal.
//   boleto           — (legado) busca linha digitável do payment principal.
//   both             — (legado) busca PIX + boleto do payment principal.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executarPipelinePosPagamento } from "../_shared/qaPosPagamento.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function addDias(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function digitsOnly(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const firstForwarded = forwarded.split(",")[0]?.trim();
  return firstForwarded
    || req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "127.0.0.1";
}

function safeAsaasDescription(payload: unknown, fallback: string): string {
  const p = payload as any;
  return String(
    p?.errors?.[0]?.description
    || p?.description
    || p?.message
    || fallback,
  ).slice(0, 300);
}

// ── Gross-up Asaas (espelha checkoutPricing.ts) ──────────────────────────────
// Taxas reais da conta (MDR + antecipação automática + taxa fixa).
const ASAAS_MDR_1X    = 0.0299;
const ASAAS_MDR_2A6   = 0.0349;
const ASAAS_MDR_7A12  = 0.0399;
const ASAAS_TAXA_FIXA = 0.49;
const ASAAS_ANT_AVISTA    = 0.0115; // 1,15% a.m.
const ASAAS_ANT_PARC      = 0.016;  // 1,6% a.m.
const ASAAS_TAXA_BOLETO   = 1.99;

function mdrCC(n: number): number {
  if (n === 1) return ASAAS_MDR_1X;
  if (n <= 6)  return ASAAS_MDR_2A6;
  return ASAAS_MDR_7A12;
}

function grossUpCC(precoBase: number, n: number): { valorTotal: number; valorParcela: number } {
  const mdr = mdrCC(n);
  const i   = n === 1 ? ASAAS_ANT_AVISTA : ASAAS_ANT_PARC;
  const s   = i === 0 ? n : ((1 - i) * (1 - Math.pow(1 - i, n))) / i;
  const pmt = (precoBase + ASAAS_TAXA_FIXA) / ((1 - mdr) * s);
  const valorParcela = Math.round(pmt * 100) / 100;
  const valorTotal   = Math.round(valorParcela * n * 100) / 100;
  return { valorTotal, valorParcela };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.slice("Bearer ".length).trim();

  const url     = Deno.env.get("SUPABASE_URL")!;
  const anon    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ASAAS_API_KEY  = Deno.env.get("ASAAS_API_KEY");
  const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL");

  // 1) Valida JWT
  let userId = "";
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    });
    if (!r.ok) return json({ error: "invalid_token" }, 401);
    const u = await r.json();
    userId = u?.id || "";
    if (!userId) return json({ error: "invalid_token" }, 401);
  } catch {
    return json({ error: "invalid_token" }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const vendaId = Number(body?.venda_id);
  const action  = String(body?.action || "both");
  if (!Number.isFinite(vendaId) || vendaId <= 0) return json({ error: "venda_id_required" }, 400);

  const admin = createClient(url, service);

  // 2) Resolve qa_clientes do usuário
  let cli: { id: unknown; id_legado: unknown; cpf?: string | null } | null = null;
  {
    const { data } = await admin
      .from("qa_clientes")
      .select("id, id_legado, cpf, nome_completo, email, celular, cep, numero, endereco")
      .eq("user_id", userId)
      .maybeSingle();
    cli = data;
  }
  if (!cli) {
    const { data: link } = await admin
      .from("cliente_auth_links")
      .select("qa_cliente_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (link?.qa_cliente_id) {
      const { data } = await admin
        .from("qa_clientes")
        .select("id, id_legado, cpf, nome_completo, email, celular, cep, numero, endereco")
        .eq("id", link.qa_cliente_id)
        .maybeSingle();
      cli = data;
    }
  }
  if (!cli) return json({ error: "cliente_not_found" }, 403);

  // 3) Localiza venda e valida ownership
  const { data: venda } = await admin
    .from("qa_vendas")
    .select("id, id_legado, cliente_id, asaas_payment_id, asaas_invoice_url, asaas_bank_slip_url, asaas_due_date, status, cobranca_status, valor_a_pagar")
    .eq("id_legado", vendaId)
    .maybeSingle();
  if (!venda) return json({ error: "venda_not_found" }, 404);
  if (Number(venda.cliente_id) !== Number(cli.id_legado)) return json({ error: "forbidden" }, 403);
  if (!venda.asaas_payment_id) return json({ error: "sem_cobranca_asaas" }, 409);

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) return json({ error: "asaas_not_configured" }, 500);

  const headers = { access_token: ASAAS_API_KEY, "User-Agent": "WMTi-Integration/1.0" };
  const paymentId = venda.asaas_payment_id;

  const out: Record<string, unknown> = {
    venda_id: venda.id_legado,
    asaas_payment_id: paymentId,
    asaas_invoice_url: venda.asaas_invoice_url,
    asaas_bank_slip_url: venda.asaas_bank_slip_url,
    asaas_due_date: venda.asaas_due_date,
  };

  try {
    // ── NOVA ACTION: gerar_por_forma ──────────────────────────────────────────
    if (action === "gerar_por_forma") {
      const forma = String(body?.forma || "").toUpperCase();
      if (!["PIX", "BOLETO", "CREDIT_CARD"].includes(forma)) {
        return json({ error: "forma_invalida" }, 400);
      }
      const parcelas = Math.max(1, Math.min(12, Math.round(Number(body?.parcelas) || 1)));
      const valor    = Number(venda.valor_a_pagar || 0);
      if (valor <= 0) return json({ error: "valor_invalido" }, 400);

      // Busca o payment principal para obter customer ID e billing type atual
      let existingCustomerId:   string | null = null;
      let existingBillingType:  string | null = null;
      let existingStatus:       string | null = null;

      try {
        const r = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, { headers });
        if (r.ok) {
          const pd = await r.json();
          existingCustomerId  = pd?.customer    ?? null;
          existingBillingType = pd?.billingType ?? null;
          existingStatus      = pd?.status      ?? null;
          out.asaas_invoice_url     = pd?.invoiceUrl   ?? out.asaas_invoice_url;
          out.asaas_bank_slip_url   = pd?.bankSlipUrl  ?? out.asaas_bank_slip_url;
        }
      } catch { /* ignora */ }

      let targetPaymentId:    string | null = null;
      let targetInvoiceUrl:   string | null = null;
      let targetBankSlipUrl:  string | null = null;

      // Tenta reutilizar o payment principal se o billing type bater
      if (
        existingBillingType === forma &&
        ["PENDING", "OVERDUE"].includes(existingStatus || "") &&
        forma !== "CREDIT_CARD"  // CC: sempre cria novo para refletir installmentCount escolhido
      ) {
        targetPaymentId   = paymentId;
        targetInvoiceUrl  = String(out.asaas_invoice_url  || "");
        targetBankSlipUrl = String(out.asaas_bank_slip_url || "");
      }

      // Busca payment alternativo já criado para este billing type (exceto CC)
      if (!targetPaymentId && forma !== "CREDIT_CARD") {
        const extRef = `qa_alt:${venda.id_legado}:${forma}`;
        try {
          const r = await fetch(
            `${ASAAS_BASE_URL}/payments?externalReference=${encodeURIComponent(extRef)}`,
            { headers },
          );
          if (r.ok) {
            const d = await r.json();
            const found = (d?.data || []).find((p: any) =>
              ["PENDING", "OVERDUE"].includes(p.status),
            );
            if (found?.id) {
              targetPaymentId   = found.id;
              targetInvoiceUrl  = found.invoiceUrl  ?? null;
              targetBankSlipUrl = found.bankSlipUrl ?? null;
            }
          }
        } catch { /* ignora */ }
      }

      // Cria novo payment se ainda não encontrado
      if (!targetPaymentId && existingCustomerId) {
        const createPayload: Record<string, unknown> = {
          customer:          existingCustomerId,
          billingType:       forma,
          dueDate:           addDias(3),
          externalReference: `qa_alt:${venda.id_legado}:${forma}`,
          description:       `Cobrança QA #${venda.id_legado}`,
        };

        if (forma === "CREDIT_CARD") {
          // Gross-up: cliente paga MDR + antecipação Asaas
          const gu = grossUpCC(valor, parcelas);
          createPayload.value = gu.valorTotal; // sempre necessário; Asaas usa como total
          if (parcelas > 1) {
            createPayload.installmentCount = parcelas;
            createPayload.installmentValue = gu.valorParcela;
          }
        } else if (forma === "BOLETO") {
          // Taxa bancária de R$1,99 repassada ao cliente
          createPayload.value = Math.round((valor + ASAAS_TAXA_BOLETO) * 100) / 100;
        } else {
          // PIX: sem acréscimo
          createPayload.value = valor;
        }

        const rCreate = await fetch(`${ASAAS_BASE_URL}/payments`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });
        const created = await rCreate.json().catch(() => ({}));
        if (!rCreate.ok || !created?.id) {
          const errMsg = (created?.errors?.[0]?.description) || (created?.description) || rCreate.status;
          return json({ error: "criacao_cobranca_falhou", detail: String(errMsg).slice(0, 300) }, 502);
        }
        targetPaymentId   = created.id;
        targetInvoiceUrl  = created.invoiceUrl  ?? null;
        targetBankSlipUrl = created.bankSlipUrl ?? null;
      }

      if (!targetPaymentId) {
        return json({ error: "nao_foi_possivel_gerar_cobranca" }, 502);
      }

      out.target_payment_id   = targetPaymentId;
      out.asaas_invoice_url   = targetInvoiceUrl  || out.asaas_invoice_url;
      out.asaas_bank_slip_url = targetBankSlipUrl || out.asaas_bank_slip_url;

      // Busca dados específicos da forma
      if (forma === "PIX") {
        const r = await fetch(`${ASAAS_BASE_URL}/payments/${targetPaymentId}/pixQrCode`, { headers });
        if (r.ok) {
          const d = await r.json();
          out.pix_payload       = d?.payload      ?? null;
          out.pix_encoded_image = d?.encodedImage ?? null;
          out.pix_expiration    = d?.expirationDate ?? null;
        } else {
          out.pix_error = `status_${r.status}`;
        }
      } else if (forma === "BOLETO") {
        // Boleto recém-criado pode precisar de alguns segundos
        if (targetPaymentId !== paymentId) {
          await new Promise(r => setTimeout(r, 1500));
        }
        const r = await fetch(`${ASAAS_BASE_URL}/payments/${targetPaymentId}/identificationField`, { headers });
        if (r.ok) {
          const d = await r.json();
          out.boleto_identification_field = d?.identificationField ?? null;
          out.boleto_barCode              = d?.barCode             ?? null;
          out.boleto_nossoNumero          = d?.nossoNumero         ?? null;
        } else {
          out.boleto_error = `status_${r.status}`;
        }
        // Busca bank_slip_url se não veio na criação
        if (!out.asaas_bank_slip_url) {
          const rp = await fetch(`${ASAAS_BASE_URL}/payments/${targetPaymentId}`, { headers });
          if (rp.ok) {
            const pd = await rp.json();
            out.asaas_bank_slip_url = pd?.bankSlipUrl ?? null;
            out.asaas_invoice_url   = pd?.invoiceUrl  ?? out.asaas_invoice_url;
          }
        }
      }
      // CREDIT_CARD: invoice_url já está em out.asaas_invoice_url — frontend abre direto

      return json({ success: true, ...out });
    }

    // ── ACTION: cobrar_cartao ────────────────────────────────────────────────
    // Cobra diretamente via token (sem redirect p/ Asaas).
    // Body: { venda_id, parcelas, usar_arsenal_cartao?: true }
    //    OU { venda_id, parcelas, holderName, number, expiryMonth, expiryYear, ccv }
    if (action === "cobrar_cartao") {
      const parcelas = Math.max(1, Math.min(12, Math.round(Number(body?.parcelas) || 1)));
      const valor    = Number(venda.valor_a_pagar || 0);
      if (valor <= 0) return json({ error: "valor_invalido" }, 400);

      // Resolve customer ID a partir do payment principal
      let customerId: string | null = null;
      try {
        const r = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, { headers });
        if (r.ok) { const pd = await r.json(); customerId = pd?.customer ?? null; }
      } catch { /* ignora */ }
      if (!customerId) return json({ error: "customer_nao_encontrado" }, 500);
      const remoteIp = clientIpFromRequest(req);

      // Monta holderInfo mesclando Asaas + qa_clientes (fallback) e usa defaults seguros p/ sandbox.
      let asaasCust: any = {};
      try {
        const rc = await fetch(`${ASAAS_BASE_URL}/customers/${customerId}`, { headers });
        if (rc.ok) asaasCust = await rc.json();
      } catch { /* ignora */ }
      const c: any = cli as any;
      const holderInfo: Record<string, string> = {
        name:          String(asaasCust?.name || c?.nome_completo || "Titular do Cartão").trim(),
        email:         String(asaasCust?.email || c?.email || "").trim(),
        cpfCnpj:       digitsOnly(asaasCust?.cpfCnpj || c?.cpf),
        postalCode:    digitsOnly(asaasCust?.postalCode || c?.cep) || "01310100",
        addressNumber: String(asaasCust?.addressNumber || c?.numero || "S/N").trim() || "S/N",
        phone:         digitsOnly(asaasCust?.phone || asaasCust?.mobilePhone || c?.celular) || "11999999999",
      };
      if (!holderInfo.name || !holderInfo.email || !holderInfo.cpfCnpj) {
        return json({
          error: "dados_titular_incompletos",
          detalhe: "Faltam nome, email ou CPF no cadastro do cliente.",
        }, 422);
      }
      // Atualiza customer na Asaas se estava faltando algum campo (best-effort).
      const custPatch: Record<string, string> = {};
      if (!asaasCust?.postalCode && holderInfo.postalCode) custPatch.postalCode = holderInfo.postalCode;
      if (!asaasCust?.addressNumber && holderInfo.addressNumber) custPatch.addressNumber = holderInfo.addressNumber;
      if (!asaasCust?.mobilePhone && !asaasCust?.phone && holderInfo.phone) custPatch.mobilePhone = holderInfo.phone;
      if (Object.keys(custPatch).length > 0) {
        try {
          await fetch(`${ASAAS_BASE_URL}/customers/${customerId}`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify(custPatch),
          });
        } catch { /* ignora */ }
      }

      // Resolve token
      let creditCardToken: string | null = null;

      if (body?.usar_arsenal_cartao === true) {
        const cpf = String(cli.cpf || "").replace(/\D/g, "");
        if (!cpf) return json({ error: "cpf_ausente" }, 422);
        const { data: ass } = await admin
          .from("qa_arsenal_assinaturas")
          .select("asaas_credit_card_token")
          .eq("cpf", cpf)
          .in("status", ["gratuidade", "ativa", "aguardando_pagamento"])
          .not("asaas_credit_card_token", "is", null)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle();
        creditCardToken = (ass as any)?.asaas_credit_card_token ?? null;
        if (!creditCardToken) return json({ error: "token_arsenal_nao_encontrado" }, 404);
      } else {
        // Tokeniza cartão fornecido pelo cliente
        const holderName  = String(body?.holderName  || "").trim();
        const number      = String(body?.number      || "").replace(/\D/g, "");
        const expiryMonth = String(body?.expiryMonth || "").padStart(2, "0");
        const expiryYear  = String(body?.expiryYear  || "");
        const ccv         = String(body?.ccv         || "").trim();
        if (!holderName || number.length < 13 || !expiryMonth || expiryYear.length < 2 || !ccv) {
          return json({ error: "dados_cartao_incompletos" }, 400);
        }
        const tokenizePayload = {
          customer: customerId,
          creditCard: { holderName, number, expiryMonth, expiryYear, ccv },
          creditCardHolderInfo: holderInfo,
          // Campo obrigatório na API atual da Asaas; deve ser o IP do comprador, não do servidor.
          remoteIp,
        };

        let tokReq = await fetch(`${ASAAS_BASE_URL}/creditCard/tokenizeCreditCard`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(tokenizePayload),
        });
        let tokData = await tokReq.json().catch(() => ({}));
        if (!tokReq.ok && [404, 405].includes(tokReq.status)) {
          tokReq = await fetch(`${ASAAS_BASE_URL}/creditCards/tokenize`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify(tokenizePayload),
          });
          tokData = await tokReq.json().catch(() => ({}));
        }
        if (!tokReq.ok || !tokData?.creditCardToken) {
          const sandbox = String(ASAAS_BASE_URL).includes("sandbox");
          const refused = safeAsaasDescription(tokData, "Cartão recusado");
          const detalhe = sandbox && number !== "4444444444444444"
            ? "Cartão recusado no sandbox. Para simular aprovação na Asaas, use o cartão teste 4444 4444 4444 4444, validade futura e CVV 123."
            : refused;
          return json({ error: "tokenizacao_falhou", detalhe }, 422);
        }
        creditCardToken = tokData.creditCardToken;
        // Token usado apenas para esta cobrança — não é armazenado no servidor.
      }

      // Cria cobrança direta com token (sem invoiceUrl)
      const gu = grossUpCC(valor, parcelas);
      const chargePayload: Record<string, unknown> = {
        customer:          customerId,
        billingType:       "CREDIT_CARD",
        value:             gu.valorTotal,
        dueDate:           addDias(1),
        description:       `Serviço QA #${venda.id_legado}`,
        externalReference: `qa_alt:${venda.id_legado}:CREDIT_CARD`,
        creditCardToken,
        remoteIp,
      };
      if (parcelas > 1) {
        chargePayload.installmentCount = parcelas;
        chargePayload.installmentValue = gu.valorParcela;
      }

      const chargeReq = await fetch(`${ASAAS_BASE_URL}/payments`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(chargePayload),
      });
      const charged = await chargeReq.json().catch(() => ({}));
      if (!chargeReq.ok || !(charged as any)?.id) {
        const msg = (charged as any)?.errors?.[0]?.description
          || (charged as any)?.description
          || chargeReq.status;
        return json({ error: "cobranca_falhou", detalhe: String(msg).slice(0, 300) }, 502);
      }

      const pago = ["RECEIVED", "CONFIRMED"].includes((charged as any)?.status);
      if (pago) {
        await admin.from("qa_vendas").update({
          cobranca_status: "confirmada",
          status: "PAGO",
          cobranca_confirmada_em: new Date().toISOString(),
        }).eq("id_legado", vendaId);

        // Ativação síncrona: gerar contrato → validar → liberar serviços.
        // Falhas não cancelam o pagamento já confirmado — apenas logadas.
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || "";

          // 1. Gera contrato (idempotente)
          const genRes = await fetch(`${supabaseUrl}/functions/v1/qa-generate-contract`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
            body: JSON.stringify({ venda_id: venda.id_legado }),
          });
          const genData = await genRes.json().catch(() => ({}));
          const contractId = genData?.contract?.id ?? genData?.contract_id ?? null;

          // Contrato gerado aguarda assinatura do cliente no Arsenal Inteligente.
          // NÃO auto-validar: a validação ocorre após o cliente assinar e a QA aprovar,
          // e é nesse momento que qa-liberar-servicos-contrato cria os processos.
        } catch (e) {
          console.error("[cobrar_cartao] falha na ativação síncrona (pagamento ok):", e);
        }
      }

      return json({
        success: true,
        pago,
        status:      (charged as any).status,
        payment_id:  (charged as any).id,
        invoice_url: (charged as any).invoiceUrl ?? null,
        valor_total: gu.valorTotal,
        valor_parcela: gu.valorParcela,
        parcelas,
      });
    }

    // ── ACTION: verificar_pagamento ──────────────────────────────────────────
    if (action === "verificar_pagamento") {
      const PAID = ["RECEIVED", "CONFIRMED"];
      let pagoId: string | null = null;
      let pagoStatus: string | null = null;
      let pagoBillingType: string | null = null;

      // 1. Verifica payment principal
      try {
        const r = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, { headers });
        if (r.ok) {
          const pd = await r.json();
          if (PAID.includes(pd?.status)) {
            pagoId = pd.id; pagoStatus = pd.status; pagoBillingType = pd.billingType;
          }
        }
      } catch { /* ignora */ }

      // 2. Verifica payments alternativos (gerados via gerar_por_forma)
      if (!pagoId) {
        for (const forma of ["CREDIT_CARD", "PIX", "BOLETO"]) {
          try {
            const extRef = `qa_alt:${venda.id_legado}:${forma}`;
            const r = await fetch(
              `${ASAAS_BASE_URL}/payments?externalReference=${encodeURIComponent(extRef)}&limit=10`,
              { headers },
            );
            if (r.ok) {
              const d = await r.json();
              const found = (d?.data || []).find((p: any) => PAID.includes(p.status));
              if (found) {
                pagoId = found.id; pagoStatus = found.status; pagoBillingType = found.billingType;
                break;
              }
            }
          } catch { /* ignora */ }
        }
      }

      if (pagoId) {
        // Atualiza venda como paga
        await admin.from("qa_vendas").update({
          cobranca_status: "confirmada",
          status: "PAGO",
          cobranca_confirmada_em: new Date().toISOString(),
        }).eq("id_legado", vendaId);
        return json({
          success: true,
          pago: true,
          payment_id: pagoId,
          payment_status: pagoStatus,
          billing_type: pagoBillingType,
        });
      }

      return json({ success: true, pago: false });
    }

    // ── ACTION: reemitir_boleto ───────────────────────────────────────────────
    if (action === "reemitir_boleto") {
      const novaDueDate = addDias(3);

      const rUpd = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: novaDueDate, billingType: "BOLETO" }),
      });
      if (!rUpd.ok) {
        const detail = await rUpd.text().catch(() => "");
        return json({ ...out, error: "reemissao_falhou", detail }, 422);
      }

      // Aguarda Asaas regenerar o código de barras
      await new Promise(r => setTimeout(r, 2500));

      const rBol = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}/identificationField`, { headers });
      out.asaas_due_date = novaDueDate;
      if (rBol.ok) {
        const d = await rBol.json();
        out.boleto_identification_field = d?.identificationField ?? null;
        out.boleto_nossoNumero          = d?.nossoNumero         ?? null;
        out.boleto_barCode              = d?.barCode             ?? null;
      } else {
        const detail = await rBol.text().catch(() => "");
        out.boleto_error        = `status_${rBol.status}`;
        out.boleto_error_detail = detail?.slice(0, 300) ?? null;
      }

      await admin
        .from("qa_vendas")
        .update({ asaas_due_date: novaDueDate, cobranca_status: "PENDING" })
        .eq("id_legado", vendaId);

      return json({ success: true, reemitido: true, ...out });
    }

    // ── ACTIONS LEGADAS ───────────────────────────────────────────────────────
    if (action === "pix" || action === "both") {
      const r = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}/pixQrCode`, { headers });
      if (r.ok) {
        const d = await r.json();
        out.pix_payload       = d?.payload      ?? null;
        out.pix_encoded_image = d?.encodedImage ?? null;
        out.pix_expiration    = d?.expirationDate ?? null;
      } else {
        out.pix_error = `status_${r.status}`;
      }
    }
    if (action === "boleto" || action === "both") {
      const r = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}/identificationField`, { headers });
      if (r.ok) {
        const d = await r.json();
        out.boleto_identification_field = d?.identificationField ?? null;
        out.boleto_nossoNumero          = d?.nossoNumero         ?? null;
        out.boleto_barCode              = d?.barCode             ?? null;
      } else {
        let billing: string | null = null;
        try {
          const p = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, { headers });
          if (p.ok) { const pd = await p.json(); billing = pd?.billingType ?? null; }
        } catch { /* ignore */ }
        out.boleto_error  = billing && billing !== "BOLETO"
          ? `nao_e_boleto_${billing.toLowerCase()}`
          : `status_${r.status}`;
        out.billing_type = billing;
      }
    }
  } catch (e) {
    return json({ ...out, network_error: e instanceof Error ? e.message : "unknown" }, 502);
  }

  return json({ success: true, ...out });
});

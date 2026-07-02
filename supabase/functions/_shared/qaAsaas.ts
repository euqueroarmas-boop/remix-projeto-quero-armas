/**
 * Helpers compartilhados de Asaas para o domínio Quero Armas.
 *
 * 🆕 ATUALIZADO (2026-05) — createQaVendaPayment agora aceita
 * installmentCount e installmentValue opcionais, para suportar
 * parcelamento com juros embutidos no cartão de crédito.
 *
 * REGRA: este módulo NÃO pode importar nada do legado WMTi
 * (post-purchase, ensureClientAccess, payments/contracts/quotes/customers).
 * Trabalha exclusivamente com qa_clientes / qa_vendas.
 */

export const ASAAS_USER_AGENT = "QueroArmas-Integration/1.0";

export function getAsaasEnv(): { key: string; baseUrl: string } | { error: string } {
  const key = Deno.env.get("ASAAS_API_KEY");
  const baseUrl = Deno.env.get("ASAAS_BASE_URL");
  if (!key) return { error: "asaas_key_missing" };
  if (!baseUrl) return { error: "asaas_base_url_missing" };
  return { key, baseUrl };
}

export function asaasHeaders(key: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    access_token: key,
    "User-Agent": ASAAS_USER_AGENT,
  };
}

export function digitsOnly(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

export function safeAsaasErr(payload: unknown): Record<string, unknown> {
  try {
    const p = payload as any;
    if (p && Array.isArray(p.errors)) {
      return {
        errors: p.errors.map((e: any) => ({
          code: e?.code,
          description: e?.description,
        })),
      };
    }
    return { message: String((p && (p.message || p.error)) || "asaas_error") };
  } catch {
    return { message: "asaas_error" };
  }
}

export interface QaClienteAsaas {
  id: number;
  nome_completo: string;
  cpf: string;
  email: string;
  celular?: string | null;
}

export async function createOrReuseQaAsaasCustomer(
  cliente: QaClienteAsaas,
  env: { key: string; baseUrl: string },
): Promise<{ ok: true; customerId: string } | { ok: false; status: number; body: Record<string, unknown> }> {
  const cpf = digitsOnly(cliente.cpf);
  try {
    const searchRes = await fetch(`${env.baseUrl}/customers?cpfCnpj=${cpf}`, {
      headers: { access_token: env.key, "User-Agent": ASAAS_USER_AGENT },
    });
    const searchData = await searchRes.json().catch(() => ({}));
    if (searchRes.ok && searchData?.data?.[0]?.id) {
      return { ok: true, customerId: searchData.data[0].id };
    }

    const customerPayload: Record<string, unknown> = {
      name: cliente.nome_completo,
      email: cliente.email,
      cpfCnpj: cpf,
      externalReference: `qa_cliente:${cliente.id}`,
    };
    const tel = digitsOnly(cliente.celular);
    if (tel) customerPayload.mobilePhone = tel;

    async function submitCustomer(payload: Record<string, unknown>) {
      const res = await fetch(`${env.baseUrl}/customers`, {
        method: "POST",
        headers: asaasHeaders(env.key),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    }

    let { res: createRes, data: createData } = await submitCustomer(customerPayload);

    /* Celular é OPCIONAL para o Asaas, mas quando enviado inválido derruba a
     * criação inteira do customer (invalid_mobilePhone) e trava o checkout.
     * Se for esse o caso, recria sem o telefone — nome/CPF/e-mail bastam. */
    if (!createRes.ok && customerPayload.mobilePhone) {
      const errs = Array.isArray((createData as any)?.errors) ? (createData as any).errors : [];
      const phoneRejected = errs.some((e: any) =>
        String(e?.code || "").toLowerCase().includes("mobilephone")
        || String(e?.code || "").toLowerCase().includes("phone")
        || String(e?.description || "").toLowerCase().includes("celular")
        || String(e?.description || "").toLowerCase().includes("telefone"),
      );
      if (phoneRejected) {
        console.warn("[qaAsaas] Asaas recusou mobilePhone — retry sem telefone");
        delete customerPayload.mobilePhone;
        const retry = await submitCustomer(customerPayload);
        createRes = retry.res;
        createData = retry.data;
      }
    }

    if (!createRes.ok || !createData?.id) {
      return {
        ok: false,
        status: 502,
        body: { error: "asaas_customer_failed", details: safeAsaasErr(createData) },
      };
    }
    return { ok: true, customerId: createData.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return { ok: false, status: 502, body: { error: "asaas_network_customer", detail: msg } };
  }
}

export interface QaVendaPaymentInput {
  vendaId: number;
  customerId: string;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD";
  value: number;
  dueDate: string; // YYYY-MM-DD
  description: string;
  /**
   * 🆕 Número de parcelas. Só faz sentido para CREDIT_CARD.
   * Default = 1 (cobrança única).
   */
  installmentCount?: number;
  /**
   * 🆕 Valor de cada parcela. Obrigatório quando installmentCount >= 2.
   * Para 1x, ignorado (Asaas usa `value`).
   */
  installmentValue?: number;
  /**
   * 🆕 URL de retorno após o pagamento no checkout hospedado do Asaas.
   * Quando informado, o Asaas devolve o cliente automaticamente para essa
   * URL logo após a confirmação (autoRedirect=true).
   */
  callbackSuccessUrl?: string | null;
}

export interface QaVendaPaymentResult {
  paymentId: string;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixPayload: string | null;
}

/**
 * Cria a cobrança Asaas. Para CREDIT_CARD com installmentCount >= 2,
 * envia installmentCount + installmentValue (conforme docs Asaas).
 * Para PIX/BOLETO/CREDIT_CARD 1x, envia apenas `value`.
 */
export async function createQaVendaPayment(
  input: QaVendaPaymentInput,
  env: { key: string; baseUrl: string },
): Promise<{ ok: true; data: QaVendaPaymentResult } | { ok: false; status: number; body: Record<string, unknown> }> {
  let paymentData: any;
  try {
    const installments =
      input.billingType === "CREDIT_CARD" && (input.installmentCount ?? 1) >= 2
        ? {
            installmentCount: input.installmentCount,
            installmentValue: input.installmentValue,
          }
        : {};

    const callback = input.callbackSuccessUrl
      ? { callback: { successUrl: input.callbackSuccessUrl, autoRedirect: true } }
      : {};

    const basePayload: Record<string, unknown> = {
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      dueDate: input.dueDate,
      description: input.description,
      externalReference: `qa_venda:${input.vendaId}`,
      ...installments,
    };

    async function submit(payload: Record<string, unknown>) {
      const res = await fetch(`${env.baseUrl}/payments`, {
        method: "POST",
        headers: asaasHeaders(env.key),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    }

    let { res: payRes, data } = await submit({ ...basePayload, ...callback });
    paymentData = data;

    /* Se o Asaas rejeitar por falta de domínio configurado na conta,
     * refaz o pagamento sem o callback (sem redirecionamento automático). */
    if (!payRes.ok && callback.callback) {
      const errs = Array.isArray((paymentData as any)?.errors) ? (paymentData as any).errors : [];
      const needsDomain = errs.some((e: any) =>
        String(e?.description || "").toLowerCase().includes("domínio")
        || String(e?.description || "").toLowerCase().includes("dominio"),
      );
      if (needsDomain) {
        console.warn("[qaAsaas] Asaas sem domínio configurado — retry sem callback.successUrl");
        const retry = await submit(basePayload);
        payRes = retry.res;
        paymentData = retry.data;
      }
    }

    if (!payRes.ok || !paymentData?.id) {
      return {
        ok: false,
        status: 502,
        body: { error: "asaas_payment_failed", details: safeAsaasErr(paymentData) },
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return { ok: false, status: 502, body: { error: "asaas_network_payment", detail: msg } };
  }

  let pixPayload: string | null = null;
  if (input.billingType === "PIX") {
    try {
      const pixRes = await fetch(`${env.baseUrl}/payments/${paymentData.id}/pixQrCode`, {
        headers: { access_token: env.key, "User-Agent": ASAAS_USER_AGENT },
      });
      const pixData = await pixRes.json().catch(() => ({}));
      if (pixRes.ok) pixPayload = pixData?.payload || null;
    } catch {
      /* ignore */
    }
  }

  return {
    ok: true,
    data: {
      paymentId: paymentData.id,
      invoiceUrl: paymentData.invoiceUrl || null,
      bankSlipUrl: paymentData.bankSlipUrl || null,
      pixPayload,
    },
  };
}

export async function generateCheckoutToken(): Promise<{ token: string; hash: string }> {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  const token = base64url(buf);
  const hash = await sha256Hex(token);
  return { token, hash };
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

function base64url(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function defaultDueDate(daysAhead = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

export function isValidDueDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

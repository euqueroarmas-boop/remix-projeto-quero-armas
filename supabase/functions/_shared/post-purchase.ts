import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export type AccessSource = "payment_webhook" | "access_recovery";

export interface PostPurchaseContext {
  payment: {
    id: string;
    payment_status: string | null;
    billing_type: string | null;
    payment_method: string | null;
    amount: number | null;
    created_at: string;
  };
  contract: {
    id: string;
    customer_id: string | null;
    contract_type: string | null;
    monthly_value: number | null;
    created_at: string;
    contract_text: string | null;
    contract_pdf_path: string | null;
    status: string | null;
    quote_id: string | null;
  };
  customer: {
    id: string;
    user_id: string | null;
    email: string;
    razao_social: string;
    cnpj_ou_cpf: string;
    responsavel: string;
  };
  quote: {
    id: string;
    selected_plan: string | null;
    computers_qty: number | null;
    monthly_value: number | null;
    created_at: string;
    status: string | null;
  };
}

export interface EnsureAccessResult {
  success: boolean;
  email?: string;
  temp_password?: string;
  password_change_required?: boolean;
  user_created?: boolean;
  user_recovered?: boolean;
  user_id?: string;
  customer_id?: string;
  quote_id?: string;
  error?: string;
  status?: string;
}

export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function isPaymentConfirmed(status?: string | null) {
  const normalized = (status || "").toUpperCase();
  return normalized === "CONFIRMED" || normalized === "RECEIVED";
}

export function generateTempPassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

export function buildServiceName(context: PostPurchaseContext) {
  const contractType = context.contract.contract_type || "";
  const isLocacao = contractType === "locacao";
  const isHoras = contractType === "horas-tecnicas" || contractType === "horas";

  if (isLocacao) return "Locação de Equipamentos";
  if (isHoras) return `Pacote de ${context.quote.computers_qty || 1} hora(s) técnicas`;
  return context.quote.selected_plan || "Serviços de TI";
}

async function listAllUsersByEmail(supabase: SupabaseClient, email: string) {
  let page = 1;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;

    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;

    if (!data.users.length || data.users.length < 200) break;
    page += 1;
  }

  return null;
}

export async function getPostPurchaseContext(
  supabase: SupabaseClient,
  args: { quoteId?: string; contractId?: string },
): Promise<PostPurchaseContext> {
  let contract = null;

  if (args.contractId) {
    const { data, error } = await supabase
      .from("contracts")
      .select("id, customer_id, contract_type, monthly_value, created_at, contract_text, contract_pdf_path, status, quote_id")
      .eq("id", args.contractId)
      .single();

    if (error || !data) throw new Error("Contrato não encontrado");
    contract = data;
  } else if (args.quoteId) {
    const { data, error } = await supabase
      .from("contracts")
      .select("id, customer_id, contract_type, monthly_value, created_at, contract_text, contract_pdf_path, status, quote_id")
      .eq("quote_id", args.quoteId)
      .order("signed", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data?.length) throw new Error("Contrato não encontrado");
    contract = data[0];
  } else {
    throw new Error("quote_id ou contract_id é obrigatório");
  }

  const quoteId = args.quoteId || contract.quote_id;
  if (!quoteId) throw new Error("Pedido não encontrado");

  const [{ data: payment, error: paymentError }, { data: customer, error: customerError }, { data: quote, error: quoteError }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, payment_status, billing_type, payment_method, amount, created_at")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("customers")
      .select("id, user_id, email, razao_social, cnpj_ou_cpf, responsavel")
      .eq("id", contract.customer_id)
      .single(),
    supabase
      .from("quotes")
      .select("id, selected_plan, computers_qty, monthly_value, created_at, status")
      .eq("id", quoteId)
      .single(),
  ]);

  if (paymentError || !payment) throw new Error("Pagamento não encontrado");
  if (customerError || !customer) throw new Error("Cliente não encontrado");
  if (quoteError || !quote) throw new Error("Orçamento não encontrado");

  return {
    payment,
    contract,
    customer,
    quote,
  };
}

export async function ensureClientAccess(
  supabase: SupabaseClient,
  quoteId: string,
  source: AccessSource = "access_recovery",
): Promise<EnsureAccessResult> {
  const context = await getPostPurchaseContext(supabase, { quoteId });

  if (!isPaymentConfirmed(context.payment.payment_status)) {
    return {
      success: false,
      error: "Pagamento não confirmado",
      status: "pending",
      quote_id: quoteId,
    };
  }

  const customer = context.customer;
  if (!customer.email) {
    return {
      success: false,
      error: "Cliente sem e-mail cadastrado",
      status: "missing_email",
      quote_id: quoteId,
      customer_id: customer.id,
    };
  }

  let authUser = null;
  let userCreated = false;
  let userRecovered = false;

  if (customer.user_id) {
    const { data, error } = await supabase.auth.admin.getUserById(customer.user_id);
    if (!error && data?.user) {
      authUser = data.user;
    }
  }

  if (!authUser) {
    authUser = await listAllUsersByEmail(supabase, customer.email);
    if (authUser && customer.user_id !== authUser.id) {
      await supabase.from("customers").update({ user_id: authUser.id }).eq("id", customer.id);
      userRecovered = true;
    }
  }

  let tempPassword = typeof authUser?.user_metadata?.temp_password === "string"
    ? authUser.user_metadata.temp_password
    : null;

  const existingMetadata = authUser?.user_metadata && typeof authUser.user_metadata === "object"
    ? authUser.user_metadata as Record<string, unknown>
    : {};

  const mustUpdateMetadata = !authUser
    || !tempPassword
    || existingMetadata.password_change_required !== true
    || existingMetadata.auto_created !== true
    || !existingMetadata.created_via;

  if (!authUser) {
    tempPassword = generateTempPassword();
    const { data, error } = await supabase.auth.admin.createUser({
      email: customer.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: customer.razao_social || customer.email,
        temp_password: tempPassword,
        password_change_required: true,
        auto_created: true,
        created_via: source,
      },
    });

    if (error || !data.user) {
      throw new Error(`Falha ao criar acesso do cliente: ${error?.message || "desconhecido"}`);
    }

    authUser = data.user;
    userCreated = true;

    await supabase.from("customers").update({ user_id: authUser.id }).eq("id", customer.id);
    await supabase.from("client_events").insert({
      customer_id: customer.id,
      event_type: "cadastro",
      title: "Acesso ao portal liberado",
      description: `Acesso criado automaticamente para ${customer.email}.`,
    });
  } else if (mustUpdateMetadata) {
    tempPassword = tempPassword || generateTempPassword();
    const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
      password: tempPassword,
      user_metadata: {
        ...existingMetadata,
        name: existingMetadata.name || customer.razao_social || customer.email,
        temp_password: tempPassword,
        password_change_required: true,
        auto_created: true,
        created_via: source,
      },
    });

    if (error || !data.user) {
      throw new Error(`Falha ao recuperar acesso do cliente: ${error?.message || "desconhecido"}`);
    }

    authUser = data.user;
    userRecovered = true;
  }

  if (customer.user_id !== authUser.id) {
    await supabase.from("customers").update({ user_id: authUser.id }).eq("id", customer.id);
  }

  return {
    success: true,
    email: customer.email,
    temp_password: tempPassword || undefined,
    password_change_required: true,
    user_created: userCreated,
    user_recovered: userRecovered,
    user_id: authUser.id,
    customer_id: customer.id,
    quote_id: quoteId,
  };
}
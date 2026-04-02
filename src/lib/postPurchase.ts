import { supabase } from "@/integrations/supabase/client";

export interface PurchaseInfo {
  serviceName: string;
  hours?: number;
  computersQty?: number;
  monthlyValue: number;
  isRecurring: boolean;
  customerName: string;
  customerCpfCnpj: string;
  customerEmail: string;
  paymentMethod: string;
  contractId: string | null;
  purchaseDate: string;
}

export interface ClientCredentials {
  email: string;
  temp_password: string;
  password_change_required: boolean;
  user_created?: boolean;
  user_recovered?: boolean;
}

export interface PdfGenerationResult {
  success: boolean;
  /** Whether a PDF exists for this contract (use serve-contract-pdf to fetch it) */
  has_pdf?: boolean;
  file_name?: string;
  generated?: boolean;
  reused_existing?: boolean;
  error?: string;
  status?: string;
}

export async function fetchPurchaseInfo(quoteId: string): Promise<PurchaseInfo> {
  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .single();
  if (qErr || !quote) throw new Error("Quote not found");

  const { data: contractRows } = await supabase
    .from("contracts")
    .select("id, contract_type, customer_id")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: false })
    .limit(1);
  const contract = contractRows?.[0] ?? null;

  let customer: { razao_social?: string; cnpj_ou_cpf?: string; email?: string } | null = null;
  if (contract?.customer_id) {
    const { data: cust } = await supabase
      .from("customers")
      .select("razao_social, cnpj_ou_cpf, email")
      .eq("id", contract.customer_id)
      .single();
    customer = cust;
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("billing_type, payment_method")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const contractType = contract?.contract_type || "";
  const isLocacao = contractType === "locacao";
  const isHoras = contractType === "horas-tecnicas" || contractType === "horas";

  const serviceName = isLocacao
    ? "Locação de Equipamentos"
    : isHoras
      ? `Pacote de ${quote.computers_qty || 1} hora(s) técnicas`
      : quote.selected_plan || "Serviços de TI";

  return {
    serviceName,
    hours: isHoras ? quote.computers_qty || undefined : undefined,
    computersQty: isLocacao ? quote.computers_qty || undefined : undefined,
    monthlyValue: Number(quote.monthly_value || 0),
    isRecurring: isLocacao,
    customerName: customer?.razao_social || "Cliente",
    customerCpfCnpj: customer?.cnpj_ou_cpf || "",
    customerEmail: customer?.email || "",
    paymentMethod: payment?.billing_type || payment?.payment_method || "CREDIT_CARD",
    contractId: contract?.id || null,
    purchaseDate: new Date(quote.created_at).toLocaleDateString("pt-BR"),
  };
}

export async function ensurePortalAccess(quoteId: string) {
  const { data, error } = await supabase.functions.invoke("ensure-client-access", {
    body: { quote_id: quoteId },
  });

  if (error) throw error;
  return data as ClientCredentials & { success: boolean; error?: string; status?: string };
}

export async function resolvePaidContractPdf(
  quoteId: string,
  options?: { generateIfMissing?: boolean; sendEmail?: boolean },
) {
  const { data, error } = await supabase.functions.invoke("generate-paid-contract-pdf", {
    body: {
      quote_id: quoteId,
      generate_if_missing: options?.generateIfMissing ?? false,
      send_email: options?.sendEmail ?? false,
    },
  });

  if (error) throw error;

  const raw = data as any;

  // Map response: never expose pdf_url to frontend
  const result: PdfGenerationResult = {
    success: raw.success,
    has_pdf: Boolean(raw.pdf_url || raw.has_pdf),
    file_name: raw.file_name,
    generated: raw.generated,
    reused_existing: raw.reused_existing,
    error: raw.error,
    status: raw.status,
  };

  return result;
}

export function readPurchaseInfoFromSession() {
  const sessionRaw = sessionStorage.getItem("wmti_purchase_data");
  if (!sessionRaw) return null;

  try {
    const parsed = JSON.parse(sessionRaw) as PurchaseInfo;
    sessionStorage.removeItem("wmti_purchase_data");
    return parsed;
  } catch {
    return null;
  }
}

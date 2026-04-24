// Shared helpers for portal client lookup (email / CPF / CNPJ)

export function normalizeEmail(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

export function normalizeDocument(value?: string | null): string {
  return String(value || "").replace(/\D/g, "");
}

export function buildDocumentVariants(value?: string | null): string[] {
  const digits = normalizeDocument(value);
  if (!digits) return [];
  const variants = new Set<string>([digits]);
  if (digits.length === 11) {
    variants.add(`${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`);
  }
  if (digits.length === 14) {
    variants.add(`${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`);
  }
  return Array.from(variants);
}

export function maskIdentifier(value: string): string {
  const v = String(value || "");
  if (v.includes("@")) {
    const [user, domain] = v.split("@");
    if (!domain) return v;
    const head = user.slice(0, 2);
    return `${head}***@${domain}`;
  }
  const digits = v.replace(/\D/g, "");
  if (digits.length >= 6) {
    return `${digits.slice(0, 3)}****${digits.slice(-2)}`;
  }
  return "****";
}

export function maskEmail(email: string): string {
  return maskIdentifier(email);
}

export type ClientLookupResult = {
  qa_cliente: { id: number; nome_completo: string; email: string | null; cpf: string | null; user_id: string | null; customer_id: string | null } | null;
  customer: { id: string; email: string; razao_social: string; cnpj_ou_cpf: string; user_id: string | null } | null;
  email_cadastrado: string | null;
};

export async function lookupClienteByIdentifier(
  supabase: any,
  identifier: string,
): Promise<ClientLookupResult> {
  const raw = String(identifier || "").trim();
  const looksLikeEmail = raw.includes("@");
  const email = looksLikeEmail ? normalizeEmail(raw) : "";
  const docVariants = !looksLikeEmail ? buildDocumentVariants(raw) : [];

  let qaCliente: ClientLookupResult["qa_cliente"] = null;
  let customer: ClientLookupResult["customer"] = null;

  if (email) {
    const { data: qa } = await supabase
      .from("qa_clientes")
      .select("id, nome_completo, email, cpf, user_id, customer_id")
      .ilike("email", email)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (qa && qa.length) qaCliente = qa[0];

    const { data: cu } = await supabase
      .from("customers")
      .select("id, email, razao_social, cnpj_ou_cpf, user_id")
      .ilike("email", email)
      .limit(1);
    if (cu && cu.length) customer = cu[0];
  }

  if (docVariants.length) {
    if (!qaCliente) {
      const { data: qa } = await supabase
        .from("qa_clientes")
        .select("id, nome_completo, email, cpf, user_id, customer_id")
        .in("cpf", docVariants)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (qa && qa.length) qaCliente = qa[0];
    }
    if (!customer) {
      const { data: cu } = await supabase
        .from("customers")
        .select("id, email, razao_social, cnpj_ou_cpf, user_id")
        .in("cnpj_ou_cpf", docVariants)
        .limit(1);
      if (cu && cu.length) customer = cu[0];
    }
  }

  const emailCadastrado = normalizeEmail(qaCliente?.email || customer?.email || "");
  return { qa_cliente: qaCliente, customer, email_cadastrado: emailCadastrado || null };
}

export async function logAcesso(
  supabase: any,
  params: {
    evento: string;
    identificador?: string | null;
    email?: string | null;
    qa_cliente_id?: number | null;
    customer_id?: string | null;
    user_id?: string | null;
    status?: string | null;
    detalhes?: Record<string, unknown>;
    ip?: string | null;
    user_agent?: string | null;
  },
) {
  try {
    await supabase.from("cliente_acesso_logs").insert({
      evento: params.evento,
      identificador_mascarado: params.identificador ? maskIdentifier(params.identificador) : null,
      email: params.email ? normalizeEmail(params.email) : null,
      qa_cliente_id: params.qa_cliente_id || null,
      customer_id: params.customer_id || null,
      user_id: params.user_id || null,
      status: params.status || null,
      detalhes: params.detalhes || {},
      ip: params.ip || null,
      user_agent: params.user_agent || null,
    });
  } catch (e) {
    console.error("[logAcesso] failed", e);
  }
}

export async function hashOtpCode(code: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${code}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateOtpCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1000000).padStart(6, "0");
}
import { supabase } from "@/integrations/supabase/client";

export interface ResolvedCustomer {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj_ou_cpf: string;
  email: string;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  cep: string | null;
  responsavel: string;
  user_id: string | null;
  created_at: string;
  status_cliente: string | null;
}

function buildDocumentVariants(input: string): string[] {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 11 || digits.length > 14) {
    return [];
  }

  const variants = new Set<string>([trimmed, digits]);

  if (digits.length === 11) {
    variants.add(`${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`);
  }

  if (digits.length === 14) {
    variants.add(`${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`);
  }

  return Array.from(variants).filter(Boolean);
}

function pickPreferredCustomer<T extends { created_at?: string | null; user_id?: string | null }>(
  customers: T[],
  preferredUserId?: string,
): T | null {
  if (!customers.length) {
    return null;
  }

  return [...customers].sort((a, b) => {
    const aScore = (preferredUserId && a.user_id === preferredUserId ? 4 : 0) + (a.user_id ? 2 : 0);
    const bScore = (preferredUserId && b.user_id === preferredUserId ? 4 : 0) + (b.user_id ? 2 : 0);

    if (bScore !== aScore) {
      return bScore - aScore;
    }

    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  })[0] ?? null;
}

export async function resolveCustomerLoginEmail(input: string): Promise<string | null> {
  const normalizedInput = input.trim();

  if (!normalizedInput) {
    return null;
  }

  if (normalizedInput.includes("@")) {
    return normalizedInput.toLowerCase();
  }

  const variants = buildDocumentVariants(normalizedInput);
  if (!variants.length) {
    return null;
  }

  const { data, error } = await supabase
    .from("customers")
    .select("email, user_id, created_at")
    .in("cnpj_ou_cpf", variants)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[customerResolver] Erro ao localizar e-mail por documento:", error.message);
    return null;
  }

  return pickPreferredCustomer(data ?? [])?.email?.toLowerCase() ?? null;
}

export async function resolvePortalCustomer(userId: string, email?: string | null): Promise<ResolvedCustomer | null> {
  const { data: linkedCustomers, error: linkedError } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (linkedError) {
    throw linkedError;
  }

  const preferredLinked = pickPreferredCustomer(linkedCustomers ?? [], userId);
  if (preferredLinked) {
    return preferredLinked as ResolvedCustomer;
  }

  if (!email) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { data: emailCustomers, error: emailError } = await supabase
    .from("customers")
    .select("*")
    .ilike("email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(20);

  if (emailError) {
    throw emailError;
  }

  const preferredEmail = pickPreferredCustomer(emailCustomers ?? [], userId);
  if (!preferredEmail) {
    return null;
  }

  if (!preferredEmail.user_id) {
    const { error: updateError } = await supabase
      .from("customers")
      .update({ user_id: userId })
      .eq("id", preferredEmail.id)
      .is("user_id", null);

    if (!updateError) {
      preferredEmail.user_id = userId;
    }
  }

  return preferredEmail as ResolvedCustomer;
}

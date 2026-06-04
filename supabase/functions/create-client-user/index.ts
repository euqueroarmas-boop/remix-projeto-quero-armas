import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SupabaseClient = any;
type AuthUser = any;

type QaClient = {
  id: number;
  nome_completo: string;
  email: string | null;
  cpf: string | null;
  status: string | null;
  user_id?: string | null;
  customer_id?: string | null;
  updated_at?: string | null;
};

type Customer = {
  id: string;
  email: string;
  razao_social: string;
  responsavel: string;
  cnpj_ou_cpf: string;
  status_cliente: string;
  user_id: string | null;
  created_at?: string;
};

async function hmacVerify(secret: string, message: string, signature: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDocument(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function buildDocumentVariants(value?: string | null) {
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

function pickNewest<T extends { updated_at?: string | null; created_at?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  })[0] || null;
}

async function listAllUsersByEmail(supabase: SupabaseClient, email: string): Promise<AuthUser | null> {
  const target = normalizeEmail(email);
  if (!target) return null;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;

    const users = data?.users || [];
    const found = users.find((user: any) => normalizeEmail(user.email) === target) || null;
    if (found) return found;
    if (users.length < 200) break;
  }

  return null;
}

async function getAuthUserByIdSafe(supabase: SupabaseClient, userId?: string | null) {
  if (!userId) return null;
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return data.user;
}

async function resolveQaClient(
  supabase: SupabaseClient,
  params: { qaClientId?: number | null; email?: string | null; document?: string | null },
): Promise<QaClient | null> {
  const { qaClientId } = params;
  const email = normalizeEmail(params.email);
  const docVariants = buildDocumentVariants(params.document);

  if (qaClientId) {
    const { data } = await supabase
      .from("qa_clientes")
      .select("id, nome_completo, email, cpf, status, user_id, customer_id, updated_at")
      .eq("id", qaClientId)
      .maybeSingle();
    if (data) return data as QaClient;
  }

  const matches: QaClient[] = [];

  if (email) {
    const { data } = await supabase
      .from("qa_clientes")
      .select("id, nome_completo, email, cpf, status, user_id, customer_id, updated_at")
      .ilike("email", email)
      .limit(20);
    matches.push(...((data as QaClient[] | null) || []));
  }

  if (docVariants.length) {
    const { data } = await supabase
      .from("qa_clientes")
      .select("id, nome_completo, email, cpf, status, user_id, customer_id, updated_at")
      .in("cpf", docVariants)
      .limit(20);
    matches.push(...((data as QaClient[] | null) || []));
  }

  const deduped = Array.from(new Map(matches.map((row) => [row.id, row])).values());
  return pickNewest(deduped);
}

async function resolveCustomer(
  supabase: SupabaseClient,
  params: { customerId?: string | null; email?: string | null; document?: string | null },
): Promise<Customer | null> {
  const { customerId } = params;
  const email = normalizeEmail(params.email);
  const docVariants = buildDocumentVariants(params.document);

  if (customerId) {
    const { data } = await supabase
      .from("customers")
      .select("id, email, razao_social, responsavel, cnpj_ou_cpf, status_cliente, user_id, created_at")
      .eq("id", customerId)
      .maybeSingle();
    if (data) return data as Customer;
  }

  const matches: Customer[] = [];

  if (email) {
    const { data } = await supabase
      .from("customers")
      .select("id, email, razao_social, responsavel, cnpj_ou_cpf, status_cliente, user_id, created_at")
      .ilike("email", email)
      .limit(20);
    matches.push(...((data as Customer[] | null) || []));
  }

  if (docVariants.length) {
    const { data } = await supabase
      .from("customers")
      .select("id, email, razao_social, responsavel, cnpj_ou_cpf, status_cliente, user_id, created_at")
      .in("cnpj_ou_cpf", docVariants)
      .limit(20);
    matches.push(...((data as Customer[] | null) || []));
  }

  const deduped = Array.from(new Map(matches.map((row) => [row.id, row])).values());
  return pickNewest(deduped);
}

async function upsertCanonicalCustomer(
  supabase: SupabaseClient,
  params: {
    customerId?: string | null;
    email?: string | null;
    document?: string | null;
    name?: string | null;
    qaClient?: QaClient | null;
    customerData?: Record<string, unknown> | null;
  },
): Promise<Customer | null> {
  const qaClient = params.qaClient || null;
  const normalizedEmail = normalizeEmail(
    params.email || String(params.customerData?.email || qaClient?.email || ""),
  );
  const normalizedDocument = normalizeDocument(
    params.document || String(params.customerData?.cnpj_ou_cpf || qaClient?.cpf || ""),
  );
  const resolvedName = String(
    params.customerData?.razao_social
      || params.customerData?.nome_completo
      || qaClient?.nome_completo
      || params.name
      || normalizedEmail,
  );
  const resolvedResponsible = String(
    params.customerData?.responsavel
      || params.customerData?.nome_completo
      || qaClient?.nome_completo
      || params.name
      || normalizedEmail,
  );
  const resolvedStatus = String(params.customerData?.status_cliente || "ativo");

  if (!normalizedEmail) {
    return null;
  }

  const existing = await resolveCustomer(supabase, {
    customerId: params.customerId,
    email: normalizedEmail,
    document: normalizedDocument,
  });

  const payload = {
    email: normalizedEmail,
    razao_social: resolvedName,
    responsavel: resolvedResponsible,
    cnpj_ou_cpf: normalizedDocument || existing?.cnpj_ou_cpf || "",
    status_cliente: resolvedStatus,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", existing.id)
      .select("id, email, razao_social, responsavel, cnpj_ou_cpf, status_cliente, user_id, created_at")
      .single();

    if (error) throw error;
    return data as Customer;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("id, email, razao_social, responsavel, cnpj_ou_cpf, status_cliente, user_id, created_at")
    .single();

  if (error) throw error;
  return data as Customer;
}

async function syncCustomerLinks(
  supabase: SupabaseClient,
  params: { customerId?: string | null; userId?: string | null; email?: string | null; document?: string | null },
) {
  const email = normalizeEmail(params.email);
  const docVariants = buildDocumentVariants(params.document);
  const targets = new Map<string, Partial<Customer>>();

  if (params.customerId) {
    targets.set(params.customerId, { user_id: params.userId || null });
  }

  if (email) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .ilike("email", email)
      .limit(50);
    for (const row of data || []) {
      targets.set(row.id, { user_id: params.userId || null });
    }
  }

  if (docVariants.length) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .in("cnpj_ou_cpf", docVariants)
      .limit(50);
    for (const row of data || []) {
      targets.set(row.id, { user_id: params.userId || null });
    }
  }

  for (const [id, update] of targets) {
    await supabase.from("customers").update(update).eq("id", id);
  }
}

async function syncQaClientLinks(
  supabase: SupabaseClient,
  params: {
    qaClientId?: number | null;
    customerId?: string | null;
    userId?: string | null;
    email?: string | null;
    document?: string | null;
  },
) {
  const email = normalizeEmail(params.email);
  const docVariants = buildDocumentVariants(params.document);
  const targetIds = new Set<number>();

  if (params.qaClientId) {
    targetIds.add(params.qaClientId);
  }

  if (email) {
    const { data } = await supabase.from("qa_clientes").select("id").ilike("email", email).limit(50);
    for (const row of data || []) targetIds.add(row.id);
  }

  if (docVariants.length) {
    const { data } = await supabase.from("qa_clientes").select("id").in("cpf", docVariants).limit(50);
    for (const row of data || []) targetIds.add(row.id);
  }

  for (const id of targetIds) {
    await supabase.from("qa_clientes").update({ user_id: params.userId || null, customer_id: params.customerId || null }).eq("id", id);
  }
}

async function syncAllLinks(
  supabase: SupabaseClient,
  params: {
    qaClientId?: number | null;
    customerId?: string | null;
    userId?: string | null;
    email?: string | null;
    document?: string | null;
  },
) {
  await Promise.all([
    syncCustomerLinks(supabase, params),
    syncQaClientLinks(supabase, params),
  ]);
}

async function resolveAuthUser(
  supabase: SupabaseClient,
  params: { userId?: string | null; fallbackUserId?: string | null; email?: string | null },
) {
  const byPrimaryId = await getAuthUserByIdSafe(supabase, params.userId);
  if (byPrimaryId) return byPrimaryId;

  const byFallbackId = await getAuthUserByIdSafe(supabase, params.fallbackUserId);
  if (byFallbackId) return byFallbackId;

  const email = normalizeEmail(params.email);
  if (!email) return null;
  return await listAllUsersByEmail(supabase, email);
}

async function sendInviteEmail(
  supabase: SupabaseClient,
  req: Request,
  email: string,
  name: string,
  password: string,
) {
  try {
    const portalOrigin = req.headers.get("origin") || "https://wmti.com.br";
    await supabase.functions.invoke("notify-user-invite", {
      body: {
        customer_email: email,
        customer_name: name,
        temp_password: password,
        portal_url: `${portalOrigin.replace(/\/$/, "")}/area-do-cliente`,
      },
    });
  } catch (emailErr) {
    console.error("[create-client-user] Erro ao enviar email de convite:", emailErr);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      password: adminPwd,
      customer_id,
      qa_client_id,
      email,
      document,
      user_password,
      name,
      action,
      customer_data,
    } = body as {
      password?: string;
      customer_id?: string;
      qa_client_id?: number;
      email?: string;
      document?: string;
      user_password?: string;
      name?: string;
      action?: string;
      customer_data?: Record<string, unknown>;
    };

    const normalizedEmail = normalizeEmail(email || String(customer_data?.email || ""));
    const normalizedDocument = normalizeDocument(document || String(customer_data?.cnpj_ou_cpf || ""));
    const password = String(user_password || "");

    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    if (!ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "ADMIN_PASSWORD not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const adminToken = req.headers.get("x-admin-token");
    let authorized = false;

    if (adminToken) {
      try {
        const [ts, sig] = adminToken.split(".");
        const timestamp = parseInt(ts, 10);
        if (Date.now() - timestamp <= 8 * 60 * 60 * 1000) {
          authorized = await hmacVerify(ADMIN_PASSWORD, `admin:${ts}`, sig);
        }
      } catch {
        authorized = false;
      }
    }

    if (!authorized && adminPwd) {
      authorized = adminPwd === ADMIN_PASSWORD;
    }

    if (!authorized) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const jwt = authHeader.replace("Bearer ", "");
        const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
        if (!authErr && userData?.user) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qaClient = await resolveQaClient(supabase, {
      qaClientId: qa_client_id,
      email: normalizedEmail,
      document: normalizedDocument,
    });

    let customer = await resolveCustomer(supabase, {
      customerId: customer_id,
      email: normalizedEmail || qaClient?.email,
      document: normalizedDocument || qaClient?.cpf,
    });

    if (action === "get_credentials") {
      if (!qa_client_id && !customer_id && !normalizedEmail && !normalizedDocument) {
        return new Response(JSON.stringify({ error: "Informe ao menos um identificador do cliente" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authUser = await resolveAuthUser(supabase, {
        userId: customer?.user_id,
        fallbackUserId: qaClient?.user_id,
        email: normalizedEmail || customer?.email || qaClient?.email,
      });

      if ((authUser || qaClient || customer) && !customer) {
        customer = await upsertCanonicalCustomer(supabase, {
          customerId: customer_id,
          email: normalizedEmail || qaClient?.email,
          document: normalizedDocument || qaClient?.cpf,
          name: name || qaClient?.nome_completo,
          qaClient,
          customerData: customer_data,
        });
      }

      await syncAllLinks(supabase, {
        qaClientId: qaClient?.id || qa_client_id,
        customerId: customer?.id || customer_id,
        userId: authUser?.id || customer?.user_id || qaClient?.user_id || null,
        email: authUser?.email || customer?.email || qaClient?.email || normalizedEmail,
        document: normalizedDocument || customer?.cnpj_ou_cpf || qaClient?.cpf,
      });

      return new Response(JSON.stringify({
        success: true,
        has_account: !!authUser,
        user_id: authUser?.id || customer?.user_id || qaClient?.user_id || null,
        customer_id: customer?.id || customer_id || null,
        qa_client_id: qaClient?.id || qa_client_id || null,
        email: normalizeEmail(authUser?.email || customer?.email || qaClient?.email || normalizedEmail) || null,
        temp_password: typeof authUser?.user_metadata?.temp_password === "string" ? authUser.user_metadata.temp_password : null,
        password_change_required: authUser?.user_metadata?.password_change_required === true,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const authUser = await resolveAuthUser(supabase, {
        userId: customer?.user_id,
        fallbackUserId: qaClient?.user_id,
        email: normalizedEmail || customer?.email || qaClient?.email,
      });

      if (!authUser) {
        return new Response(JSON.stringify({ error: "Usuário não possui conta no portal. Crie o acesso primeiro." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const canonicalCustomer = customer || await upsertCanonicalCustomer(supabase, {
        customerId: customer_id,
        email: normalizedEmail || authUser.email || qaClient?.email,
        document: normalizedDocument || qaClient?.cpf,
        name: name || qaClient?.nome_completo,
        qaClient,
        customerData: customer_data,
      });

      const newPassword = password || generateTempPassword();
      const existingMetadata = authUser.user_metadata && typeof authUser.user_metadata === "object"
        ? authUser.user_metadata as Record<string, unknown>
        : {};

      const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: newPassword,
        user_metadata: {
          ...existingMetadata,
          name: existingMetadata.name || name || qaClient?.nome_completo || canonicalCustomer?.razao_social || authUser.email,
          temp_password: newPassword,
          password_change_required: true,
          auto_created: true,
          created_via: existingMetadata.created_via || "qa_admin_portal",
        },
      });

      if (error || !data.user) {
        return new Response(JSON.stringify({ error: error?.message || "Erro ao redefinir senha" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await syncAllLinks(supabase, {
        qaClientId: qaClient?.id || qa_client_id,
        customerId: canonicalCustomer?.id || customer_id,
        userId: data.user.id,
        email: data.user.email || canonicalCustomer?.email || qaClient?.email,
        document: normalizedDocument || canonicalCustomer?.cnpj_ou_cpf || qaClient?.cpf,
      });

      await logSistemaBackend({
        tipo: "admin",
        status: "success",
        mensagem: "Senha do cliente redefinida pelo admin",
        payload: { email: data.user.email, customer_id: canonicalCustomer?.id || customer_id, qa_client_id: qaClient?.id || qa_client_id },
      });

      return new Response(JSON.stringify({
        success: true,
        email: normalizeEmail(data.user.email),
        temp_password: newPassword,
        user_id: data.user.id,
        customer_id: canonicalCustomer?.id || customer_id || null,
        qa_client_id: qaClient?.id || qa_client_id || null,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!normalizedEmail || !password) {
      return new Response(JSON.stringify({ error: "E-mail e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const canonicalCustomer = await upsertCanonicalCustomer(supabase, {
      customerId: customer_id,
      email: normalizedEmail,
      document: normalizedDocument || qaClient?.cpf,
      name: name || qaClient?.nome_completo,
      qaClient,
      customerData: customer_data,
    });

    if (!canonicalCustomer) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado no sistema" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let authUser = await resolveAuthUser(supabase, {
      userId: canonicalCustomer.user_id,
      fallbackUserId: qaClient?.user_id,
      email: normalizedEmail,
    });

    let reused = false;

    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name: name || qaClient?.nome_completo || canonicalCustomer.razao_social || normalizedEmail,
          temp_password: password,
          password_change_required: true,
          auto_created: true,
          created_via: "qa_admin_portal",
        },
      });

      if (error || !data.user) {
        await logSistemaBackend({
          tipo: "admin",
          status: "error",
          mensagem: "Erro ao criar usuário do cliente",
          payload: { email: normalizedEmail, error: error?.message || "desconhecido" },
        });
        return new Response(JSON.stringify({ error: error?.message || "Erro ao criar usuário" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      authUser = data.user;
    } else {
      reused = true;
      const existingMetadata = authUser.user_metadata && typeof authUser.user_metadata === "object"
        ? authUser.user_metadata as Record<string, unknown>
        : {};

      const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
        email: normalizedEmail,
        password,
        user_metadata: {
          ...existingMetadata,
          name: existingMetadata.name || name || qaClient?.nome_completo || canonicalCustomer.razao_social || normalizedEmail,
          temp_password: password,
          password_change_required: true,
          auto_created: true,
          created_via: existingMetadata.created_via || "qa_admin_portal",
        },
      });

      if (error || !data.user) {
        return new Response(JSON.stringify({ error: error?.message || "Erro ao atualizar usuário" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      authUser = data.user;
    }

    await syncAllLinks(supabase, {
      qaClientId: qaClient?.id || qa_client_id,
      customerId: canonicalCustomer.id,
      userId: authUser.id,
      email: authUser.email || normalizedEmail,
      document: normalizedDocument || canonicalCustomer.cnpj_ou_cpf || qaClient?.cpf,
    });

    await supabase.from("client_events").insert({
      customer_id: canonicalCustomer.id,
      event_type: "cadastro",
      title: reused ? "Acesso ao portal atualizado" : "Acesso ao portal criado",
      description: `Credenciais ${reused ? "atualizadas" : "criadas"} para ${normalizedEmail}`,
    });

    await logSistemaBackend({
      tipo: "admin",
      status: "success",
      mensagem: reused ? "Usuário do cliente atualizado com sucesso" : "Usuário do cliente criado com sucesso",
      payload: {
        email: normalizedEmail,
        user_id: authUser.id,
        customer_id: canonicalCustomer.id,
        qa_client_id: qaClient?.id || qa_client_id,
        reused,
      },
    });

    await sendInviteEmail(
      supabase,
      req,
      normalizedEmail,
      name || qaClient?.nome_completo || canonicalCustomer.razao_social || normalizedEmail,
      password,
    );

    return new Response(JSON.stringify({
      success: true,
      reused,
      user_id: authUser.id,
      email: normalizedEmail,
      temp_password: password,
      customer_id: canonicalCustomer.id,
      qa_client_id: qaClient?.id || qa_client_id || null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    await logSistemaBackend({
      tipo: "admin",
      status: "error",
      mensagem: "Erro inesperado ao criar usuário",
      payload: { error: message },
    });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 10; i++) {
    pwd += chars[arr[i] % chars.length];
  }
  return pwd + "!1";
}

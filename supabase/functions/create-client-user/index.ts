import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hmacVerify(secret: string, message: string, signature: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

async function linkMatchingCustomers(supabase: ReturnType<typeof createClient>, userId: string, email: string, document: string) {
  const normalizedDocument = String(document || "").replace(/\D/g, "");
  const { data: matches } = await supabase
    .from("customers")
    .select("id, email, cnpj_ou_cpf")
    .or(`email.ilike.${email},cnpj_ou_cpf.eq.${normalizedDocument}`);

  if (!matches?.length) return;

  for (const match of matches) {
    const sameEmail = (match.email || "").trim().toLowerCase() === email.trim().toLowerCase();
    const sameDoc = String(match.cnpj_ou_cpf || "").replace(/\D/g, "") === normalizedDocument;
    if (sameEmail || (normalizedDocument && sameDoc)) {
      await supabase.from("customers").update({ user_id: userId }).eq("id", match.id);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { password: adminPwd, customer_id, email, user_password, name, action, customer_data } = body;
    const password = user_password || "";

    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    if (!ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "ADMIN_PASSWORD not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth check: admin token, password, or valid Supabase JWT
    const adminToken = req.headers.get("x-admin-token");
    let authorized = false;

    if (adminToken) {
      try {
        const [ts, sig] = adminToken.split(".");
        const timestamp = parseInt(ts, 10);
        if (Date.now() - timestamp <= 8 * 60 * 60 * 1000) {
          authorized = await hmacVerify(ADMIN_PASSWORD, `admin:${ts}`, sig);
        }
      } catch { /* invalid token format */ }
    }

    if (!authorized && adminPwd) {
      authorized = adminPwd === ADMIN_PASSWORD;
    }

    // Also accept valid Supabase JWT (for QA admin module)
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

    // ── GET CREDENTIALS ACTION ──
    if (action === "get_credentials") {
      if (!email && !customer_id) {
        return new Response(JSON.stringify({ error: "E-mail ou customer_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let targetEmail = email;
      let targetUserId: string | null = null;

      let targetDocument = "";

      if (customer_id) {
        const { data: cust } = await supabase
          .from("customers")
          .select("email, user_id, cnpj_ou_cpf")
          .eq("id", customer_id)
          .single();

        if (!cust) {
          return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        targetEmail = targetEmail || cust.email;
        targetUserId = cust.user_id;
        targetDocument = cust.cnpj_ou_cpf || "";
      }

      let authUser = null;
      if (targetUserId) {
        const { data } = await supabase.auth.admin.getUserById(targetUserId);
        authUser = data?.user || null;
      }

      if (!authUser && targetEmail) {
        const { data: userList } = await supabase.auth.admin.listUsers();
        authUser = userList?.users?.find((u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase()) || null;
      }

      if (!authUser) {
        return new Response(JSON.stringify({ success: false, has_account: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (targetEmail) {
        await linkMatchingCustomers(supabase, authUser.id, targetEmail, targetDocument);
      }

      return new Response(JSON.stringify({
        success: true,
        has_account: true,
        user_id: authUser.id,
        email: authUser.email,
        temp_password: typeof authUser.user_metadata?.temp_password === "string" ? authUser.user_metadata.temp_password : null,
        password_change_required: authUser.user_metadata?.password_change_required === true,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RESET PASSWORD ACTION ──
    if (action === "reset_password") {
      if (!email && !customer_id) {
        return new Response(JSON.stringify({ error: "E-mail ou customer_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let targetEmail = email;

      // If customer_id provided, look up email
      if (!targetEmail && customer_id) {
        const { data: cust } = await supabase
          .from("customers")
          .select("email, user_id")
          .eq("id", customer_id)
          .single();
        if (!cust) {
          return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        targetEmail = cust.email;
      }

      const newPassword = password || generateTempPassword();

      // Find user by email
      const { data: userList } = await supabase.auth.admin.listUsers();
      const existingUser = userList?.users?.find(
        (u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase()
      );

      if (!existingUser) {
        return new Response(JSON.stringify({ error: "Usuário não possui conta no portal. Crie o acesso primeiro." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update password
      const { error: updateErr } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: newPassword,
        user_metadata: {
          ...existingUser.user_metadata,
          password_change_required: true,
          temp_password: newPassword,
          created_via: existingUser.user_metadata?.created_via || "admin_portal",
        },
      });

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await logSistemaBackend({
        tipo: "admin",
        status: "success",
        mensagem: "Senha do cliente redefinida pelo admin",
        payload: { email: targetEmail, customer_id },
      });

      return new Response(
        JSON.stringify({ success: true, email: targetEmail, temp_password: newPassword }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CREATE USER ACTION (default) ──
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "E-mail e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resolvedCustomerId = customer_id as string | undefined;
    let customerCheck: { id: string; razao_social: string; email: string } | null = null;

    if (resolvedCustomerId) {
      const { data: existing } = await supabase
        .from("customers")
        .select("id, razao_social, email")
        .eq("id", resolvedCustomerId)
        .maybeSingle();
      customerCheck = existing;
    }

    // Auto-create customer if not found and customer_data provided
    if (!customerCheck && customer_data) {
      const cnpjCpf = String(customer_data.cnpj_ou_cpf || "").replace(/\D/g, "");
      // Try lookup by email or cpf to avoid duplicates
      if (customer_data.email) {
        const { data: byEmail } = await supabase
          .from("customers")
          .select("id, razao_social, email")
          .ilike("email", customer_data.email)
          .limit(1)
          .maybeSingle();
        if (byEmail) customerCheck = byEmail;
      }
      if (!customerCheck && cnpjCpf) {
        const { data: byDoc } = await supabase
          .from("customers")
          .select("id, razao_social, email")
          .eq("cnpj_ou_cpf", cnpjCpf)
          .limit(1)
          .maybeSingle();
        if (byDoc) customerCheck = byDoc;
      }
      if (!customerCheck) {
        const { data: created, error: createErr } = await supabase
          .from("customers")
          .insert({
            email: customer_data.email || email,
            razao_social: customer_data.razao_social || customer_data.nome_completo || name || email,
            responsavel: customer_data.responsavel || customer_data.nome_completo || name || email,
            cnpj_ou_cpf: cnpjCpf,
            status_cliente: customer_data.status_cliente || "ativo",
          })
          .select("id, razao_social, email")
          .single();
        if (createErr) {
          return new Response(JSON.stringify({ error: "Erro ao criar registro de cliente: " + createErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        customerCheck = created;
      }
      resolvedCustomerId = customerCheck.id;
    }

    if (!customerCheck || !resolvedCustomerId) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado no sistema" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name || email,
        temp_password: password,
        password_change_required: true,
        auto_created: true,
        created_via: "admin_portal",
      },
    });

    if (authError) {
      // Idempotent: if user already exists, link to customer and return success
      const msg = (authError.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        const { data: userList } = await supabase.auth.admin.listUsers();
        const existing = userList?.users?.find(
          (u: any) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (existing) {
          // Update password to the new temp password
          await supabase.auth.admin.updateUserById(existing.id, {
            password,
            user_metadata: {
              ...existing.user_metadata,
              name: name || email,
              temp_password: password,
              password_change_required: true,
              auto_created: true,
              created_via: existing.user_metadata?.created_via || "admin_portal",
            },
          });
          if (resolvedCustomerId) {
            await supabase.from("customers").update({ user_id: existing.id }).eq("id", resolvedCustomerId);
          }
          await linkMatchingCustomers(supabase, existing.id, email, customer_data?.cnpj_ou_cpf || "");
          return new Response(
            JSON.stringify({ success: true, user_id: existing.id, email, temp_password: password, reused: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      await logSistemaBackend({
        tipo: "admin",
        status: "error",
        mensagem: "Erro ao criar usuário do cliente",
        payload: { email, error: authError.message },
      });
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    if (resolvedCustomerId) {
      await supabase
        .from("customers")
        .update({ user_id: userId })
        .eq("id", resolvedCustomerId);

      await linkMatchingCustomers(supabase, userId, email, customer_data?.cnpj_ou_cpf || "");

      await supabase.from("client_events").insert({
        customer_id: resolvedCustomerId,
        event_type: "cadastro",
        title: "Acesso ao portal criado",
        description: `Credenciais criadas para ${email}`,
      });
    }

    await logSistemaBackend({
      tipo: "admin",
      status: "success",
      mensagem: "Usuário do cliente criado com sucesso",
      payload: { email, user_id: userId, customer_id: resolvedCustomerId },
    });

    // ── EMAIL: Send invite with credentials via SMTP ──
    try {
      const customerName = customerCheck.razao_social || name || email;
      const portalOrigin = req.headers.get("origin") || "https://wmti.com.br";
      await supabase.functions.invoke("notify-user-invite", {
        body: {
          customer_email: email,
          customer_name: customerName,
          temp_password: password,
          portal_url: `${portalOrigin.replace(/\/$/, "")}/area-do-cliente`,
        },
      });
      console.log("[create-client-user] Email de convite enviado para:", email);
    } catch (emailErr) {
      console.error("[create-client-user] Erro ao enviar email de convite:", emailErr);
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId, email, temp_password: password }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    await logSistemaBackend({
      tipo: "admin",
      status: "error",
      mensagem: "Erro inesperado ao criar usuário",
      payload: { error: error.message },
    });
    return new Response(JSON.stringify({ error: "Erro interno" }), {
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

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { password: adminPwd, customer_id, email, user_password, name, action } = body;
    const password = user_password || "";

    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    if (!ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "ADMIN_PASSWORD not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth check
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

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
          temp_password: null,
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

    if (!customer_id) {
      await logSistemaBackend({
        tipo: "admin",
        status: "error",
        mensagem: "Tentativa de criar usuário sem vínculo com cliente",
        payload: { email },
      });
      return new Response(JSON.stringify({ error: "É obrigatório vincular o usuário a um cliente cadastrado (customer_id)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify customer exists
    const { data: customerCheck } = await supabase
      .from("customers")
      .select("id, razao_social, email")
      .eq("id", customer_id)
      .single();

    if (!customerCheck) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado no sistema" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || email },
    });

    if (authError) {
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

    if (customer_id) {
      await supabase
        .from("customers")
        .update({ user_id: userId })
        .eq("id", customer_id);

      await supabase.from("client_events").insert({
        customer_id,
        event_type: "cadastro",
        title: "Acesso ao portal criado",
        description: `Credenciais criadas para ${email}`,
      });
    }

    await logSistemaBackend({
      tipo: "admin",
      status: "success",
      mensagem: "Usuário do cliente criado com sucesso",
      payload: { email, user_id: userId, customer_id },
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
      JSON.stringify({ success: true, user_id: userId, email }),
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

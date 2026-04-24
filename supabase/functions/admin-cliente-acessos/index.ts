import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Validar admin via JWT do chamador
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return json({ error: "missing_token" }, 401);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthenticated" }, 401);

  const admin = createClient(url, serviceKey);
  const { data: roleData } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleData) return json({ error: "forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const action = body.action as string;

  try {
    if (action === "list") {
      const { data, error } = await admin
        .from("cliente_auth_links")
        .select("*, qa_clientes(id,nome,cpf,email), customers(id,nome,cnpj_ou_cpf,email)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return json({ items: data || [] });
    }

    if (action === "logs") {
      const { data, error } = await admin
        .from("cliente_acesso_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return json({ items: data || [] });
    }

    if (action === "approve") {
      const id = body.id as string;
      if (!id) return json({ error: "id_required" }, 400);
      const { data: link, error: lerr } = await admin
        .from("cliente_auth_links").select("*").eq("id", id).maybeSingle();
      if (lerr || !link) return json({ error: "not_found" }, 404);

      const newEmail = (link.email_pendente || link.email || "").toLowerCase().trim();
      if (!newEmail) return json({ error: "email_missing" }, 400);

      // Atualiza email no Auth se já existe user
      if (link.user_id) {
        await admin.auth.admin.updateUserById(link.user_id, {
          email: newEmail, email_confirm: true,
        });
      }

      const { error: uerr } = await admin
        .from("cliente_auth_links")
        .update({
          status: "active",
          email: newEmail,
          email_pendente: null,
          activated_at: new Date().toISOString(),
          motivo: null,
        })
        .eq("id", id);
      if (uerr) throw uerr;

      // Sincroniza qa_clientes / customers
      if (link.qa_cliente_id) {
        await admin.from("qa_clientes")
          .update({ email: newEmail, user_id: link.user_id })
          .eq("id", link.qa_cliente_id);
      }
      if (link.customer_id) {
        await admin.from("customers")
          .update({ email: newEmail, user_id: link.user_id })
          .eq("id", link.customer_id);
      }

      await admin.from("cliente_acesso_logs").insert({
        evento: "admin_approve",
        email: newEmail,
        qa_cliente_id: link.qa_cliente_id,
        customer_id: link.customer_id,
        user_id: link.user_id,
        status: "active",
        detalhes: { admin_id: userData.user.id },
      });

      return json({ ok: true });
    }

    if (action === "block") {
      const id = body.id as string;
      const motivo = (body.motivo as string) || "Bloqueado pelo administrador";
      if (!id) return json({ error: "id_required" }, 400);
      const { data: link } = await admin
        .from("cliente_auth_links").select("user_id,email").eq("id", id).maybeSingle();
      const { error } = await admin
        .from("cliente_auth_links")
        .update({ status: "blocked", motivo })
        .eq("id", id);
      if (error) throw error;

      if (link?.user_id) {
        // Bane o usuário no Auth (24h * 365 anos basicamente)
        await admin.auth.admin.updateUserById(link.user_id, {
          ban_duration: "876000h",
        }).catch(() => {});
      }

      await admin.from("cliente_acesso_logs").insert({
        evento: "admin_block",
        email: link?.email || null,
        user_id: link?.user_id || null,
        status: "blocked",
        detalhes: { admin_id: userData.user.id, motivo },
      });
      return json({ ok: true });
    }

    if (action === "unblock") {
      const id = body.id as string;
      if (!id) return json({ error: "id_required" }, 400);
      const { data: link } = await admin
        .from("cliente_auth_links").select("user_id,email").eq("id", id).maybeSingle();
      const { error } = await admin
        .from("cliente_auth_links")
        .update({ status: "active", motivo: null })
        .eq("id", id);
      if (error) throw error;
      if (link?.user_id) {
        await admin.auth.admin.updateUserById(link.user_id, {
          ban_duration: "none",
        }).catch(() => {});
      }
      await admin.from("cliente_acesso_logs").insert({
        evento: "admin_unblock",
        email: link?.email || null,
        user_id: link?.user_id || null,
        status: "active",
        detalhes: { admin_id: userData.user.id },
      });
      return json({ ok: true });
    }

    if (action === "resend_otp") {
      const id = body.id as string;
      if (!id) return json({ error: "id_required" }, 400);
      const { data: link } = await admin
        .from("cliente_auth_links").select("*").eq("id", id).maybeSingle();
      if (!link) return json({ error: "not_found" }, 404);
      const targetEmail = link.email_pendente || link.email;
      if (!targetEmail) return json({ error: "email_missing" }, 400);

      // Invoca a function pública de OTP usando o próprio email como identificador
      const resp = await fetch(`${url}/functions/v1/cliente-portal-request-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ identificador: targetEmail }),
      });
      const out = await resp.json().catch(() => ({}));

      await admin.from("cliente_acesso_logs").insert({
        evento: "admin_resend_otp",
        email: targetEmail,
        user_id: link.user_id,
        status: resp.ok ? "sent" : "error",
        detalhes: { admin_id: userData.user.id, response: out },
      });
      return json({ ok: resp.ok, response: out });
    }

    if (action === "delete") {
      const id = body.id as string;
      if (!id) return json({ error: "id_required" }, 400);
      const { data: link } = await admin
        .from("cliente_auth_links").select("email,user_id").eq("id", id).maybeSingle();
      const { error } = await admin.from("cliente_auth_links").delete().eq("id", id);
      if (error) throw error;
      await admin.from("cliente_acesso_logs").insert({
        evento: "admin_delete_link",
        email: link?.email || null,
        user_id: link?.user_id || null,
        status: "deleted",
        detalhes: { admin_id: userData.user.id },
      });
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("admin-cliente-acessos error", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
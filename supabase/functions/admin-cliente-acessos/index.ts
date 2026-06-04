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
        .select("*, qa_clientes!cliente_auth_links_qa_cliente_id_fkey(id,nome_completo,cpf,email), customers(id,nome_fantasia,cnpj_ou_cpf,email)")
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

    // ─────────────────────────────────────────────────────────────
    // DIAGNÓSTICO REAL DO PORTAL DE UM CLIENTE (qa_cliente_id)
    // Usado pela aba "Portal" para mostrar o estado real do vínculo.
    // Retorna passos individuais sem falhar — apenas reporta.
    // ─────────────────────────────────────────────────────────────
    if (action === "diagnose") {
      const qaClienteId = Number(body.qa_cliente_id);
      if (!Number.isFinite(qaClienteId) || qaClienteId <= 0) {
        return json({ error: "qa_cliente_id_required" }, 400);
      }

      // 1) Cliente
      const { data: cliente } = await admin
        .from("qa_clientes")
        .select("id, nome_completo, email, status, excluido, user_id, customer_id")
        .eq("id", qaClienteId)
        .maybeSingle();

      if (!cliente) return json({ ok: false, error: "cliente_nao_encontrado" }, 404);

      const emailNorm = (cliente.email || "").trim().toLowerCase();
      const clienteAtivo = !cliente.excluido && (cliente.status || "ATIVO").toUpperCase() === "ATIVO";

      // 2) Auth user pelo e-mail normalizado
      let authUser: any = null;
      if (emailNorm) {
        const found: any[] = [];
        for (let page = 1; page <= 10; page++) {
          const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          if (error) break;
          for (const u of data.users) {
            if ((u.email || "").trim().toLowerCase() === emailNorm) found.push(u);
          }
          if (data.users.length < 200) break;
        }
        // Prefere o user_id já registrado em qa_clientes, se bater
        if (cliente.user_id) {
          authUser = found.find((u) => u.id === cliente.user_id) || found[0] || null;
        } else {
          authUser = found[0] || null;
        }
      }

      // 3) Vínculos por user_id e por email
      const { data: linksByUser } = authUser
        ? await admin
            .from("cliente_auth_links")
            .select("id, qa_cliente_id, customer_id, user_id, email, status, activated_at, last_login_at")
            .eq("user_id", authUser.id)
        : { data: [] as any[] };

      const { data: linksByEmail } = emailNorm
        ? await admin
            .from("cliente_auth_links")
            .select("id, qa_cliente_id, customer_id, user_id, email, status, activated_at, last_login_at")
            .ilike("email", emailNorm)
        : { data: [] as any[] };

      const linkParaEsteCliente = (linksByUser || []).find((l: any) => l.qa_cliente_id === qaClienteId) || null;
      const linkAtivoParaEsteCliente = linkParaEsteCliente && linkParaEsteCliente.status === "active";
      const linkParaOutroCliente =
        (linksByUser || []).find((l: any) => l.qa_cliente_id && l.qa_cliente_id !== qaClienteId) || null;

      // 4) Estado final consolidado
      const acessoLiberado =
        clienteAtivo &&
        !!authUser &&
        !!linkParaEsteCliente &&
        linkParaEsteCliente.status === "active";

      const motivos: string[] = [];
      if (!clienteAtivo) motivos.push("cliente_inativo");
      if (!authUser) motivos.push("auth_user_nao_encontrado");
      if (authUser && !linkParaEsteCliente && linkParaOutroCliente) motivos.push("vinculo_aponta_outro_cliente");
      if (authUser && !linkParaEsteCliente && !linkParaOutroCliente) motivos.push("vinculo_ausente");
      if (linkParaEsteCliente && linkParaEsteCliente.status !== "active") motivos.push("vinculo_inativo");

      return json({
        ok: true,
        cliente_id: cliente.id,
        cliente_nome: cliente.nome_completo,
        cliente_ativo: clienteAtivo,
        email_original: cliente.email,
        email_normalizado: emailNorm,
        auth_user_encontrado: !!authUser,
        auth_user_id: authUser?.id || null,
        auth_user_email: authUser?.email || null,
        auth_last_sign_in_at: authUser?.last_sign_in_at || null,
        vinculo_existe: !!linkParaEsteCliente,
        vinculo_ativo: linkAtivoParaEsteCliente,
        vinculo_status: linkParaEsteCliente?.status || null,
        vinculo_id: linkParaEsteCliente?.id || null,
        vinculo_aponta_outro_cliente: !!linkParaOutroCliente,
        outro_cliente_id: linkParaOutroCliente?.qa_cliente_id || null,
        last_login_at: linkParaEsteCliente?.last_login_at || null,
        links_total_user: (linksByUser || []).length,
        links_total_email: (linksByEmail || []).length,
        acesso_liberado: acessoLiberado,
        motivos,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // REPARO IDEMPOTENTE DO VÍNCULO PORTAL ↔ CLIENTE
    // Não cria Auth User, não troca senha, não cria cliente.
    // ─────────────────────────────────────────────────────────────
    if (action === "repair_link") {
      const qaClienteId = Number(body.qa_cliente_id);
      if (!Number.isFinite(qaClienteId) || qaClienteId <= 0) {
        return json({ error: "qa_cliente_id_required" }, 400);
      }

      const { data: cliente } = await admin
        .from("qa_clientes")
        .select("id, nome_completo, email, status, excluido, customer_id, user_id, cpf")
        .eq("id", qaClienteId)
        .maybeSingle();

      if (!cliente) return json({ error: "cliente_nao_encontrado" }, 404);
      if (cliente.excluido) return json({ error: "cliente_excluido" }, 400);
      if ((cliente.status || "ATIVO").toUpperCase() !== "ATIVO") {
        return json({ error: "cliente_inativo" }, 400);
      }

      const emailNorm = (cliente.email || "").trim().toLowerCase();
      if (!emailNorm) return json({ error: "cliente_sem_email" }, 400);

      // Localiza Auth User por e-mail normalizado
      let authUser: any = null;
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        for (const u of data.users) {
          if ((u.email || "").trim().toLowerCase() === emailNorm) {
            if (cliente.user_id && u.id === cliente.user_id) { authUser = u; break; }
            if (!authUser) authUser = u;
          }
        }
        if (authUser && (!cliente.user_id || authUser.id === cliente.user_id)) break;
        if (data.users.length < 200) break;
      }

      if (!authUser) {
        return json({
          ok: false,
          error: "auth_user_nao_encontrado",
          message: "Usuário Auth não encontrado. Gere nova credencial.",
        }, 404);
      }

      // Vínculos atuais deste auth user
      const { data: linksByUser } = await admin
        .from("cliente_auth_links")
        .select("id, qa_cliente_id, customer_id, user_id, email, status")
        .eq("user_id", authUser.id);

      const linkOutro = (linksByUser || []).find(
        (l: any) => l.qa_cliente_id && l.qa_cliente_id !== qaClienteId,
      );

      // Conflito: Auth User já vinculado a outro cliente — NÃO sobrescreve
      if (linkOutro && !body.force_reassign) {
        return json({
          ok: false,
          error: "vinculo_aponta_outro_cliente",
          message: "Vínculo aponta para outro cliente. Revisão manual necessária.",
          conflito_qa_cliente_id: linkOutro.qa_cliente_id,
          conflito_link_id: linkOutro.id,
        }, 409);
      }

      const linkAtual = (linksByUser || []).find((l: any) => l.qa_cliente_id === qaClienteId) || null;
      const documentoNorm = (cliente.cpf || "").replace(/\D/g, "") || null;

      const payload = {
        qa_cliente_id: qaClienteId,
        customer_id: cliente.customer_id || linkAtual?.customer_id || null,
        email: emailNorm,
        documento_normalizado: documentoNorm,
        status: "active",
        activated_at: new Date().toISOString(),
        motivo: null,
        email_pendente: null,
      };

      let acao = "";
      if (linkAtual) {
        await admin.from("cliente_auth_links").update(payload).eq("id", linkAtual.id);
        acao = linkAtual.status === "active" ? "vinculo_revalidado" : "vinculo_reativado";
      } else {
        await admin.from("cliente_auth_links").insert({ user_id: authUser.id, ...payload });
        acao = "vinculo_criado";
      }

      // Mantém qa_clientes.user_id e customers.user_id sincronizados
      await admin.from("qa_clientes")
        .update({ user_id: authUser.id, email: cliente.email || emailNorm })
        .eq("id", qaClienteId);
      if (cliente.customer_id) {
        await admin.from("customers")
          .update({ user_id: authUser.id, email: emailNorm })
          .eq("id", cliente.customer_id);
      }

      await admin.from("cliente_acesso_logs").insert({
        evento: "admin_repair_link",
        email: emailNorm,
        qa_cliente_id: qaClienteId,
        customer_id: cliente.customer_id || null,
        user_id: authUser.id,
        status: "active",
        detalhes: { admin_id: userData.user.id, acao, force_reassign: !!body.force_reassign },
      });

      return json({
        ok: true,
        acao,
        auth_user_id: authUser.id,
        email: emailNorm,
        qa_cliente_id: qaClienteId,
      });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("admin-cliente-acessos error", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
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

  // Auth admin
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
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
  const action = String(body.action || "");
  const clienteId = Number(body.cliente_id);
  const motivo = String(body.motivo || "").trim();

  if (!Number.isFinite(clienteId) || clienteId <= 0) {
    return json({ error: "cliente_id_required" }, 400);
  }

  const { data: cliente } = await admin
    .from("qa_clientes")
    .select("id, nome_completo, cpf, email, user_id, customer_id")
    .eq("id", clienteId)
    .maybeSingle();
  if (!cliente) return json({ error: "cliente_nao_encontrado" }, 404);

  try {
    // ── DIAGNOSE ────────────────────────────────────────────────
    if (action === "diagnose") {
      const [{ data: vendas }, { data: contratos }, { data: link }, { data: cadastroPub }] = await Promise.all([
        admin.from("qa_vendas")
          .select("id, status, cobranca_status, cobranca_confirmada_em, valor_a_pagar, asaas_payment_id, created_at")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false }),
        admin.from("qa_contracts")
          .select("id, status, signed_at, venda_id, created_at")
          .eq("client_id", clienteId)
          .order("created_at", { ascending: false }),
        admin.from("cliente_auth_links")
          .select("id, user_id, status, email, activated_at")
          .eq("qa_cliente_id", clienteId)
          .maybeSingle(),
        admin.from("qa_cadastros_publicos")
          .select("id, status, created_at")
          .or(`cpf.eq.${cliente.cpf || "__none__"},email.ilike.${cliente.email || "__none__"}`),
      ]);

      const vendaPaga = (vendas || []).find((v: any) => !!v.cobranca_confirmada_em);
      const vendaPendente = (vendas || []).find((v: any) => !v.cobranca_confirmada_em);
      const contratoAssinado = (contratos || []).find((c: any) => !!c.signed_at);

      let authUser: any = null;
      if (cliente.user_id) {
        const { data } = await admin.auth.admin.getUserById(cliente.user_id);
        authUser = data?.user || null;
      }

      return json({
        ok: true,
        cliente: {
          id: cliente.id,
          nome: cliente.nome_completo,
          cpf: cliente.cpf,
          email: cliente.email,
          user_id: cliente.user_id,
        },
        vendas: vendas || [],
        contratos: contratos || [],
        link,
        cadastros_publicos: cadastroPub || [],
        auth_user_existe: !!authUser,
        auth_user_email: authUser?.email || null,
        venda_paga: !!vendaPaga,
        venda_pendente: !!vendaPendente,
        contrato_assinado: !!contratoAssinado,
        reset_total_bloqueado: !!vendaPaga || !!contratoAssinado,
        bloqueio_motivo: vendaPaga ? "venda_paga" : contratoAssinado ? "contrato_assinado" : null,
      });
    }

    // Comum para ações destrutivas: motivo obrigatório
    if (!motivo || motivo.length < 6) {
      return json({ error: "motivo_obrigatorio", message: "Motivo obrigatório (mín. 6 caracteres)." }, 400);
    }

    const audit = async (acao: string, detalhes: any) => {
      await admin.from("qa_logs_auditoria").insert({
        tipo: "admin_destravar_cadastro",
        acao,
        ator_id: userData.user.id,
        ator_email: userData.user.email,
        cliente_id: clienteId,
        detalhes: { motivo, ...detalhes },
      } as any).catch(() => {});
    };

    // ── CANCELAR VENDA PENDENTE ─────────────────────────────────
    if (action === "cancel_pending_sale") {
      const { data: vendas } = await admin.from("qa_vendas")
        .select("id, cobranca_confirmada_em")
        .eq("cliente_id", clienteId);
      const pendingIds = (vendas || []).filter((v: any) => !v.cobranca_confirmada_em).map((v: any) => v.id);
      if (pendingIds.length === 0) return json({ ok: true, message: "Nenhuma venda pendente." });

      await admin.rpc("set_config" as any, { setting_name: "app.allow_venda_evento_delete", new_value: "on", is_local: false });
      await admin.rpc("set_config" as any, { setting_name: "qa.allow_total_client_delete", new_value: "1", is_local: false });

      await admin.from("qa_contract_aceites_log").delete().in("venda_id", pendingIds);
      await admin.from("qa_contracts").delete().in("venda_id", pendingIds);
      await admin.from("qa_venda_eventos").delete().in("venda_id", pendingIds);
      await admin.from("qa_itens_venda").delete().in("venda_id", pendingIds);
      const { error } = await admin.from("qa_vendas").delete().in("id", pendingIds);
      if (error) throw error;

      await audit("cancel_pending_sale", { vendas_canceladas: pendingIds });
      return json({ ok: true, vendas_canceladas: pendingIds.length });
    }

    // ── RESETAR AUTH USER (mantém cliente) ──────────────────────
    if (action === "reset_auth") {
      const uid = cliente.user_id;
      if (!uid) return json({ ok: true, message: "Cliente sem auth user." });
      await admin.from("qa_usuarios_perfis").delete().eq("user_id", uid);
      await admin.from("cliente_auth_links").delete().eq("user_id", uid);
      await admin.auth.admin.deleteUser(uid).catch(() => {});
      await admin.from("qa_clientes").update({ user_id: null }).eq("id", clienteId);
      await audit("reset_auth", { user_id: uid });
      return json({ ok: true, message: "Auth user removido." });
    }

    // ── RESETAR VÍNCULO PORTAL ──────────────────────────────────
    if (action === "reset_link") {
      const { error } = await admin.from("cliente_auth_links").delete().eq("qa_cliente_id", clienteId);
      if (error) throw error;
      await audit("reset_link", {});
      return json({ ok: true, message: "Vínculo removido." });
    }

    // ── RESET TOTAL (bloqueado se pago / contrato assinado) ─────
    if (action === "reset_total") {
      const { data: vendas } = await admin.from("qa_vendas")
        .select("id, cobranca_confirmada_em")
        .eq("cliente_id", clienteId);
      const vendaPaga = (vendas || []).find((v: any) => !!v.cobranca_confirmada_em);
      if (vendaPaga) {
        return json({ error: "venda_paga", message: "Cliente possui venda paga. Reset total bloqueado." }, 409);
      }
      const { data: contratos } = await admin.from("qa_contracts")
        .select("id, signed_at")
        .eq("client_id", clienteId);
      const contratoAssinado = (contratos || []).find((c: any) => !!c.signed_at);
      if (contratoAssinado) {
        return json({ error: "contrato_assinado", message: "Cliente possui contrato assinado. Reset total bloqueado." }, 409);
      }

      const confirmCpf = String(body.confirm_cpf || "").replace(/\D/g, "");
      const clienteCpf = String(cliente.cpf || "").replace(/\D/g, "");
      if (!clienteCpf || confirmCpf !== clienteCpf) {
        return json({ error: "cpf_confirmacao_invalida" }, 400);
      }

      const vendaIds = (vendas || []).map((v: any) => v.id);
      const uid = cliente.user_id;
      const emailNorm = (cliente.email || "").trim().toLowerCase();

      await admin.rpc("set_config" as any, { setting_name: "app.allow_venda_evento_delete", new_value: "on", is_local: false });
      await admin.rpc("set_config" as any, { setting_name: "qa.allow_total_client_delete", new_value: "1", is_local: false });

      if (vendaIds.length) {
        await admin.from("qa_contract_aceites_log").delete().in("venda_id", vendaIds);
        await admin.from("qa_contracts").delete().in("venda_id", vendaIds);
        await admin.from("qa_venda_eventos").delete().in("venda_id", vendaIds);
        await admin.from("qa_itens_venda").delete().in("venda_id", vendaIds);
        await admin.from("qa_vendas").delete().in("id", vendaIds);
      }
      await admin.from("cliente_auth_links").delete().eq("qa_cliente_id", clienteId);
      if (uid) {
        await admin.from("qa_usuarios_perfis").delete().eq("user_id", uid);
        await admin.from("cliente_auth_links").delete().eq("user_id", uid);
        await admin.auth.admin.deleteUser(uid).catch(() => {});
      }
      if (emailNorm || clienteCpf) {
        await admin.from("qa_cadastros_publicos").delete()
          .or(`cpf.eq.${clienteCpf || "__none__"},email.ilike.${emailNorm || "__none__"}`);
      }
      const { error } = await admin.from("qa_clientes").delete().eq("id", clienteId);
      if (error) throw error;

      await audit("reset_total", { vendas: vendaIds, user_id: uid, email: emailNorm });
      return json({ ok: true, message: "Cadastro destravado por completo." });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("qa-admin-destravar-cadastro error", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
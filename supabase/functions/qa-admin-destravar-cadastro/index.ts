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

// Espelha o CHECK de qa_documentos_cliente. Validar aqui evita que um tipo
// inválido chegue ao banco e derrube o UPDATE com erro de constraint.
const TIPOS_DOC_VALIDOS = new Set([
  "cr", "craf", "sinarm", "gt", "gte", "autorizacao_compra", "nota_fiscal_arma",
  "rg_com_cpf", "cin", "cnh", "cpf",
  "comprovante_residencia", "declaracao_responsavel_imovel",
  "ctps", "renda_holerite_mes_atual", "renda_holerite_funcionario_publico",
  "renda_cartao_cnpj", "renda_cnpj_autonomo", "renda_contrato_social",
  "renda_nf_recente", "renda_comprovante_beneficio", "renda_extrato_inss", "renda_qsa",
  "antecedentes_criminais", "antecedentes_federal",
  "antecedentes_federal_trf3_regional", "antecedentes_federal_sjsp_jef",
  "antecedentes_estadual", "antecedentes_estadual_distribuicao",
  "antecedentes_estadual_execucoes", "antecedentes_militar", "antecedentes_eleitoral",
  "declaracao_sem_inquerito_processo_criminal", "declaracao_guarda_responsavel",
  "declaracao_correlata", "declaracao_guarda_acervo_1endereco",
  "laudo_psicologico", "laudo_capacidade_tecnica",
  "comprovante_efetiva_necessidade", "documento_complementar_caso",
  "comprovante_habitualidade", "comprovante_clube_tiro", "comprovante_competicao",
  "comprovante_pagamento",
  "protocolo_processo", "oficio", "despacho", "exigencia", "indeferimento",
  "procuracao", "procuracao_assinada", "contrato_assinado",
  "recurso_administrativo_doc", "mandado_seguranca_doc",
  "certidao_alteracao_nome",
  "outro",
]);

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
    // ── RECLASSIFICAR DOCUMENTO DO HUB ──────────────────────────
    // Corrige o tipo de um documento já salvo. Necessário porque a Central de
    // Adesão gravou documentos com slug divergente (ou como "outro"), e a
    // exigência do processo casa por tipo_documento — sem isso o sistema pede
    // ao cliente um documento que ele já enviou.
    // Não exige `motivo`: é correção de classificação, não ação destrutiva.
    // A auditoria registra tipo anterior e novo, que é o que importa revisar.
    if (action === "reclassificar_documento") {
      const documentoId = String(body.documento_id || "").trim();
      const novoTipo = String(body.novo_tipo || "").trim();
      if (!documentoId) return json({ error: "documento_id_required" }, 400);
      if (!TIPOS_DOC_VALIDOS.has(novoTipo)) {
        return json({ error: "tipo_invalido", message: `Tipo "${novoTipo}" não existe no catálogo do Hub Documental.` }, 400);
      }

      const { data: doc, error: docErr } = await admin
        .from("qa_documentos_cliente")
        .select("id, qa_cliente_id, tipo_documento, status, arquivo_nome")
        .eq("id", documentoId)
        .maybeSingle();
      if (docErr) return json({ error: "db_error", message: docErr.message }, 500);
      if (!doc) return json({ error: "documento_nao_encontrado" }, 404);
      if (Number(doc.qa_cliente_id) !== clienteId) {
        return json({ error: "documento_de_outro_cliente" }, 403);
      }
      if (doc.tipo_documento === novoTipo) {
        return json({ ok: true, inalterado: true, tipo_documento: novoTipo });
      }

      const tipoAnterior = doc.tipo_documento;
      // Só o tipo muda. O status (aprovado/pendente/etc.) é preservado de
      // propósito: reclassificar corrige a etiqueta, não revalida o documento.
      const { error: updErr } = await admin
        .from("qa_documentos_cliente")
        .update({ tipo_documento: novoTipo, updated_at: new Date().toISOString() })
        .eq("id", documentoId);
      if (updErr) return json({ error: "update_falhou", message: updErr.message }, 500);

      await admin.from("qa_logs_auditoria").insert({
        tipo: "admin_reclassificar_documento",
        acao: "reclassificar_documento",
        ator_id: userData.user.id,
        ator_email: userData.user.email,
        cliente_id: clienteId,
        detalhes: {
          documento_id: documentoId,
          arquivo_nome: doc.arquivo_nome,
          tipo_anterior: tipoAnterior,
          tipo_novo: novoTipo,
          status_preservado: doc.status,
          motivo: motivo || null,
        },
      } as any).catch(() => {});

      return json({
        ok: true,
        documento_id: documentoId,
        tipo_anterior: tipoAnterior,
        tipo_documento: novoTipo,
        status: doc.status,
      });
    }

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
      // RPC roda como service_role (admin) — checa has_role internamente via auth.uid()
      // Para preservar identidade do admin, criamos um client com o JWT do usuário e usamos RPC.
      const userScoped = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error } = await userScoped.rpc("qa_admin_destravar_cancel_pending_sale", { p_cliente_id: clienteId });
      if (error) throw error;
      await audit("cancel_pending_sale", { resultado: data });
      return json({ ok: true, resultado: data });
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
      const confirmCpf = String(body.confirm_cpf || "");
      const uid = cliente.user_id;

      // Deleta auth user ANTES da RPC (rpc apaga linhas, mas auth.users só via admin API)
      const userScoped = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error } = await userScoped.rpc("qa_admin_destravar_reset_total", {
        p_cliente_id: clienteId,
        p_confirm_cpf: confirmCpf,
      });
      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("venda_paga")) return json({ error: "venda_paga", message: "Cliente possui venda paga. Reset total bloqueado." }, 409);
        if (msg.includes("contrato_assinado")) return json({ error: "contrato_assinado", message: "Cliente possui contrato assinado. Reset total bloqueado." }, 409);
        if (msg.includes("cpf_confirmacao_invalida")) return json({ error: "cpf_confirmacao_invalida" }, 400);
        if (msg.includes("forbidden")) return json({ error: "forbidden" }, 403);
        throw error;
      }
      if (uid) {
        await admin.auth.admin.deleteUser(uid).catch(() => {});
      }
      await audit("reset_total", { resultado: data });
      return json({ ok: true, resultado: data });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("qa-admin-destravar-cadastro error", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
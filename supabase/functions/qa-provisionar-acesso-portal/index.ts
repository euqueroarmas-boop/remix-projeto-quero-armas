// =====================================================================
// qa-provisionar-acesso-portal — FASE 2C-5 (QA puro)
// ---------------------------------------------------------------------
// Provisiona acesso GRATUITO ao Portal/Arsenal após pagamento confirmado.
// Fonte de verdade: public.qa_clientes (NUNCA toca customers/payments/
// quotes/contracts/post-purchase/ensureClientAccess).
//
// Idempotente:
//   - Se qa_clientes.portal_provisionado_em já preenchido => no-op.
//   - Se auth user já existir para o email => apenas vincula em qa_clientes.
//   - Sem reenvio infinito de convite.
//
// Auth aceita:
//   - x-internal-token = INTERNAL_FUNCTION_TOKEN, OU
//   - x-trigger-source = qa_vendas_pago_acesso (chamada pela trigger
//     qa_vendas_provisionar_portal_on_pago via pg_net + anon key).
//
// NÃO cria processo. NÃO cria checklist. NÃO bloqueia Arsenal.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { qaArsenalWelcomeHtml, qaArsenalWelcomeText } from "../_shared/qaEmailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-trigger-source",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRIGGER_SOURCE = "qa_vendas_pago_acesso";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorize(req: Request): { ok: true } | { ok: false; reason: string } {
  const triggerSource = req.headers.get("x-trigger-source") || "";
  if (triggerSource === TRIGGER_SOURCE) return { ok: true };

  const internalToken = req.headers.get("x-internal-token") || "";
  const expected = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || "";
  if (internalToken && expected && timingSafeEqual(internalToken, expected)) {
    return { ok: true };
  }
  return { ok: false, reason: "unauthorized" };
}

async function logEvento(
  admin: any,
  clienteId: number,
  tipo: string,
  descricao: string,
) {
  try {
    const { data: proc } = await admin
      .from("qa_processos")
      .select("id")
      .eq("cliente_id", clienteId)
      .limit(1)
      .maybeSingle();
    if (!proc?.id) return;
    await admin.from("qa_processo_eventos").insert({
      processo_id: proc.id,
      tipo_evento: tipo,
      descricao,
      ator: "sistema",
    });
  } catch (_) {
    /* eventos são best-effort */
  }
}

function genStrongPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/[+/=]/g, "")
    .slice(0, 28);
  // Garante complexidade mínima
  return `Qa!${b64}9X`;
}

async function findAuthUserByEmail(admin: any, email: string): Promise<any | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((u: any) => String(u.email || "").trim().toLowerCase() === target);
    if (found) return found;
    if (users.length < 200) break;
  }
  return null;
}

async function sendWelcomeEmail(admin: any, opts: {
  email: string;
  nome: string;
  isNewUser: boolean;
}) {
  try {
    const { sendTransactional } = await import("../_shared/sendTransactional.ts");
    const res = await sendTransactional({
      templateName: "acesso-liberado-portal",
      recipientEmail: opts.email,
      idempotencyKey: `acesso-liberado-${opts.email}-${opts.isNewUser ? "new" : "existing"}`,
      templateData: {
        nome: opts.nome,
        isNewUser: opts.isNewUser,
        portalUrl: "https://www.euqueroarmas.com.br/area-do-cliente",
      },
    });
    return res.ok ? { ok: true } : { ok: false, reason: "send_failed", message: res.error };
  } catch (e) {
    console.error("[qa-provisionar-acesso-portal] acesso-liberado-portal error:", (e as Error)?.message);
    return { ok: false, reason: "send_threw", message: (e as Error)?.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = authorize(req);
  if (!guard.ok) return json({ error: guard.reason }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const qaClientId = Number(body?.qa_client_id);
  const vendaId = body?.venda_id ?? null;
  if (!Number.isFinite(qaClientId) || qaClientId <= 0) {
    return json({ error: "qa_client_id obrigatório" }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Carrega cliente (única fonte de verdade)
  const { data: cliente, error: cliErr } = await admin
    .from("qa_clientes")
    .select("id, nome_completo, email, cpf, status, user_id, portal_provisionado_em, senha_temporaria, senha_temporaria_expira_em")
    .eq("id", qaClientId)
    .maybeSingle();

  if (cliErr) return json({ error: "qa_clientes_query_failed", message: cliErr.message }, 500);
  if (!cliente) return json({ error: "cliente_nao_encontrado" }, 404);

  // 2) LGPD lock
  if (cliente.status === "excluido_lgpd") {
    return json({ ok: true, skipped: "lgpd", venda_id: vendaId });
  }

  // 3) Sem e-mail => não há como convidar
  const email = String(cliente.email || "").trim().toLowerCase();
  if (!email) {
    await logEvento(admin, cliente.id, "falha_envio_email",
      `Acesso pós-pagamento (venda ${vendaId ?? "?"}) pulado: cliente sem e-mail.`);
    return json({ ok: false, reason: "no_email" }, 200);
  }

  // 4) Idempotência: só pulamos se já existe senha temporária ATIVA (TTL válido).
  //    Para usuários Auth já existentes, NUNCA resetamos a senha automaticamente:
  //    o pós-pagamento só garante vínculo e portal. Credenciais temporárias são
  //    geradas apenas quando a função cria um Auth User novo.
  const senhaAtiva =
    !!cliente.senha_temporaria &&
    !!cliente.senha_temporaria_expira_em &&
    new Date(cliente.senha_temporaria_expira_em as string).getTime() > Date.now();
  if (cliente.portal_provisionado_em && senhaAtiva) {
    await logEvento(admin, cliente.id, "convite_acesso_reutilizado",
      `Acesso já provisionado em ${cliente.portal_provisionado_em}; senha temporária ativa reaproveitada para venda ${vendaId ?? "?"}.`);
    return json({
      ok: true,
      reused: true,
      reason: "already_provisioned",
      venda_id: vendaId,
    });
  }

  // 5) Procura usuário existente em auth.users
  let authUser: any = null;
  try {
    if (cliente.user_id) {
      const { data } = await admin.auth.admin.getUserById(cliente.user_id);
      authUser = data?.user || null;
    }
    if (!authUser) {
      authUser = await findAuthUserByEmail(admin, email);
    }
  } catch (e: any) {
    return json({ error: "auth_lookup_failed", message: e?.message || String(e) }, 500);
  }

  let isNewUser = false;

  // 6) Cria usuário se inexistente
  if (!authUser) {
    const tempPwd = genStrongPassword();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPwd,
      email_confirm: true,
      user_metadata: {
        origem: "qa_vendas_pago",
        qa_cliente_id: cliente.id,
        nome: cliente.nome_completo,
      },
    });
    if (createErr || !created?.user) {
      // Pode ter race condition (criado entre listUsers e createUser) — tenta de novo
      authUser = await findAuthUserByEmail(admin, email);
      if (!authUser) {
        return json({
          error: "auth_create_failed",
          message: createErr?.message || "unknown",
        }, 500);
      }
    } else {
      authUser = created.user;
      isNewUser = true;
      // Persiste senha temporária (TTL 24h) para a UI de conclusão exibir.
      // Limpa-se sozinha após expirar ou após o cliente trocar a senha.
      try {
        const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await admin
          .from("qa_clientes")
          .update({
            senha_temporaria: tempPwd,
            senha_temporaria_expira_em: expira,
          })
          .eq("id", cliente.id);
      } catch (e) {
        console.warn("[qa-provisionar-acesso-portal] falha persistir senha temp:", e);
      }
    }
  }

  // 7) Vincula auth.users → qa_clientes (idempotente)
  const updates: Record<string, unknown> = {
    portal_provisionado_em: new Date().toISOString(),
  };
  if (cliente.user_id !== authUser.id) updates.user_id = authUser.id;

  const { error: updErr } = await admin
    .from("qa_clientes")
    .update(updates)
    .eq("id", cliente.id);
  if (updErr) {
    return json({ error: "qa_clientes_link_failed", message: updErr.message }, 500);
  }

  // 7.1) Garante vínculo em cliente_auth_links (idempotente).
  // Sem isso o login do portal nega acesso ("Conta sem vínculo de cliente ativo").
  try {
    const { data: existingLink } = await admin
      .from("cliente_auth_links")
      .select("id, status, qa_cliente_id")
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (!existingLink) {
      await admin.from("cliente_auth_links").insert({
        qa_cliente_id: cliente.id,
        user_id: authUser.id,
        email,
        status: "active",
        activated_at: new Date().toISOString(),
      });
    } else if (
      existingLink.status !== "active" ||
      existingLink.qa_cliente_id !== cliente.id
    ) {
      await admin
        .from("cliente_auth_links")
        .update({
          qa_cliente_id: cliente.id,
          email,
          status: "active",
          activated_at: new Date().toISOString(),
          motivo: null,
          email_pendente: null,
        })
        .eq("id", existingLink.id);
    }
  } catch (e) {
    console.warn("[qa-provisionar-acesso-portal] falha ao garantir cliente_auth_links:", e);
  }

  // 8) Envia e-mail (boas-vindas / aviso de pagamento+contrato)
  const mail = await sendWelcomeEmail(admin, {
    email,
    nome: cliente.nome_completo || email.split("@")[0],
    isNewUser,
  });

  // Lovable Emails: dispara template credenciais-portal com senha provisória.
  try {
    const { sendTransactional } = await import("../_shared/sendTransactional.ts");
    const { data: clienteAtualizado } = await admin
      .from("qa_clientes")
      .select("senha_temporaria")
      .eq("id", cliente.id)
      .maybeSingle();
    await sendTransactional({
      templateName: "credenciais-portal",
      recipientEmail: email,
      idempotencyKey: `credenciais-${authUser.id}-${vendaId ?? "x"}`,
      templateData: {
        nome: cliente.nome_completo || email.split("@")[0],
        loginEmail: email,
        senhaProvisoria: clienteAtualizado?.senha_temporaria || "(use Esqueci minha senha)",
        portalUrl: "https://www.euqueroarmas.com.br/area-do-cliente",
      },
    });
  } catch (e) {
    console.error("[qa-provisionar-acesso-portal] credenciais-portal error:", (e as Error)?.message);
  }

  // 9) Auditoria
  await logEvento(admin, cliente.id, "acesso_portal_preparado_pos_pagamento",
    `Acesso ao portal preparado após pagamento (venda ${vendaId ?? "?"}). Novo usuário: ${isNewUser ? "sim" : "não"}.`);
  await logEvento(admin, cliente.id,
    isNewUser ? "convite_acesso_enviado" : "convite_acesso_reutilizado",
    `E-mail ${mail.ok ? "enviado" : "FALHOU"} para ${email} (venda ${vendaId ?? "?"}).`);

  return json({
    ok: true,
    user_id: authUser.id,
    new_user: isNewUser,
    email_sent: mail.ok,
    venda_id: vendaId,
  });
});

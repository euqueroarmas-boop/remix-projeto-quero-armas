// FASE 17-A: Conta pública gratuita do app de arsenal (Quero Armas)
// Cria auth.users + vincula a qa_clientes via RPC qa_cliente_criar_conta_publica.
// NÃO cria venda, processo, pagamento, checklist ou Asaas.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  qaArsenalWelcomeHtml,
  qaArsenalWelcomeText,
  qaCadastroExistenteHtml,
  qaCadastroExistenteText,
} from "../_shared/qaEmailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  cpf: z.string().min(11).max(20),
  nome: z.string().trim().min(2).max(160),
  email: z.string().trim().max(255),
  telefone: z.string().trim().max(40).optional().nullable(),
  senha: z.string().min(8).max(72),
  servico_interesse: z.string().trim().max(200).optional().nullable(),
  // FASE 17-B: criar venda pendente automaticamente quando o usuário escolheu um serviço.
  // Aceita o slug do servico_principal (ex.: "concessao_cr") OU o slug do catálogo direto (ex.: "concessao-cr").
  servico_principal: z.string().trim().max(80).optional().nullable(),
  catalogo_slug: z.string().trim().max(120).optional().nullable(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmailCompativelComQaClientes(email: string): boolean {
  return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email.trim().toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "invalid_payload", details: parsed.error.flatten() }, 400);
  }

  const { cpf, nome, email, telefone, senha, servico_interesse, servico_principal, catalogo_slug } = parsed.data;
  const cpfNorm = cpf.replace(/\D/g, "");
  if (cpfNorm.length !== 11) {
    return json({ error: "cpf_invalido" }, 400);
  }
  const emailNorm = email.toLowerCase().trim();
  if (!isEmailCompativelComQaClientes(emailNorm)) {
    return json({ error: "email_invalido", message: "E-mail inválido." }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Bloqueia se CPF já tem login ativo
  const { data: linkExistente } = await admin
    .from("cliente_auth_links")
    .select("id, status")
    .eq("documento_normalizado", cpfNorm)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (linkExistente) {
    // BUG 2 fix — disparos best-effort (não bloqueantes) antes do early-return:
    // 1) e-mail "você já tem Arsenal" para o cliente
    // 2) notificação interna ao admin para visibilidade da tentativa
    // 3) registro em qa_arsenal_notificacoes (best-effort, ignorado se schema não existir)
    try {
      const { sendTransactional } = await import("../_shared/sendTransactional.ts");
      await sendTransactional({
        templateName: "cliente-ja-tem-conta",
        recipientEmail: emailNorm,
        idempotencyKey: `cliente-ja-tem-conta-${emailNorm}`,
        templateData: {
          nome,
          loginUrl: "https://www.euqueroarmas.com.br/area-do-cliente/login",
          email: emailNorm,
        },
      });
    } catch (e) {
      console.warn("[cadastro_existente] e-mail falhou:", (e as Error)?.message);
    }
    try {
      admin.functions
        .invoke("qa-notificar-admin-contratacao", {
          body: {
            motivo: "tentativa_novo_cadastro_cliente_existente",
            cpf: cpfNorm,
            email: emailNorm,
            nome,
            telefone: telefone ?? null,
            servico_interesse: servico_interesse ?? null,
            servico_principal: servico_principal ?? null,
            catalogo_slug: catalogo_slug ?? null,
          },
        })
        .catch((e) => console.warn("[cadastro_existente] notif admin falhou:", (e as Error)?.message));
    } catch (e) {
      console.warn("[cadastro_existente] notif threw:", (e as Error)?.message);
    }
    try {
      await admin.from("qa_arsenal_notificacoes" as any).insert({
        tipo: "tentativa_recadastro",
        email: emailNorm,
        cpf: cpfNorm,
        payload: {
          motivo: "cpf_ja_possui_login",
          nome,
          telefone: telefone ?? null,
          servico_interesse: servico_interesse ?? null,
          servico_principal: servico_principal ?? null,
          catalogo_slug: catalogo_slug ?? null,
        },
      } as any);
    } catch (e) {
      console.warn("[cadastro_existente] insert notif falhou:", (e as Error)?.message);
    }

    return json(
      {
        ok: false,
        reason: "cpf_ja_possui_login",
        message: "Este CPF já possui acesso. Faça login.",
      },
      200,
    );
  }

  // 1.b) Hardening idempotência: CPF já existe em qa_clientes (cadastro legado,
  // possivelmente sem link Arsenal ativo). Não criar Auth duplicado — orientar
  // o cliente a recuperar acesso. A criação/vínculo definitivo só acontece via
  // login autenticado + qa_ensure_cliente_from_auth.
  try {
    const cpfMasked = `${cpfNorm.slice(0, 3)}.${cpfNorm.slice(3, 6)}.${cpfNorm.slice(6, 9)}-${cpfNorm.slice(9)}`;
    const { data: qaClienteLegado } = await admin
      .from("qa_clientes")
      .select("id, status_cliente, email")
      .or(`cpf.eq.${cpfNorm},cpf.eq.${cpfMasked}`)
      .limit(1)
      .maybeSingle();
    if (qaClienteLegado && qaClienteLegado.status_cliente !== "excluido_lgpd") {
      return json(
        {
          ok: false,
          reason: "cpf_ja_possui_cadastro_sem_login",
          message:
            "Este CPF já tem cadastro em nosso sistema. Faça login ou recupere sua senha para continuar.",
        },
        200,
      );
    }
  } catch (e) {
    // Falha de leitura não pode bloquear cadastro novo — apenas log.
    console.warn("[cpf_legado_check] falhou:", (e as Error)?.message);
  }

  // 2) Cria usuário em auth.users (email_confirm true autorizado nesta fase)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: emailNorm,
    password: senha,
    email_confirm: true,
    user_metadata: {
      full_name: nome.trim(),
      origem: "app_arsenal_publico",
    },
  });

  if (createErr || !created?.user) {
    const msg = (createErr?.message || "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return json(
        {
          ok: false,
          reason: "email_ja_cadastrado",
          message: "Este e-mail já tem cadastro. Faça login.",
        },
        200,
      );
    }
    return json({ ok: false, reason: "auth_create_failed", message: createErr?.message }, 400);
  }

  const userId = created.user.id;

  // 3) Cria/vincula cliente via RPC
  const { data: rpcData, error: rpcErr } = await admin.rpc(
    "qa_cliente_criar_conta_publica" as any,
    {
      p_user_id: userId,
      p_cpf: cpfNorm,
      p_nome: nome,
      p_email: emailNorm,
      p_telefone: telefone ?? null,
    },
  );

  if (rpcErr) {
    // rollback do auth user para não deixar órfão
    await admin.auth.admin.deleteUser(userId).catch(() => null);
    return json(
      { ok: false, reason: "rpc_failed", message: rpcErr.message },
      400,
    );
  }

  const result = (rpcData ?? {}) as Record<string, unknown>;
  if (result.ok === false) {
    await admin.auth.admin.deleteUser(userId).catch(() => null);
    return json(result, 409);
  }

  // 4) Marca cadastro público como concluído e vincula cliente_id (best-effort)
  const qaClienteId = (result.qa_cliente_id as string | null) ?? null;
  try {
    const updatePayload: Record<string, unknown> = {
      status: "concluido",
      processado_em: new Date().toISOString(),
      processado_por: "qa-cliente-criar-conta-publica",
    };
    if (qaClienteId) updatePayload.cliente_id_vinculado = qaClienteId;

    const { error: updErr } = await admin
      .from("qa_cadastro_publico")
      .update(updatePayload)
      .eq("email", emailNorm);
    if (updErr) {
      console.error("[qa_cadastro_publico] update failed:", updErr.message);
    }
  } catch (e) {
    console.error("[qa_cadastro_publico] update threw:", (e as Error)?.message);
  }

  // 4.5) FASE 17-B: cria venda PENDENTE automaticamente quando usuário escolheu serviço.
  // A equipe valida o valor/serviço e aprova manualmente. NÃO gera processo nem checklist.
  let vendaCriadaId: number | null = null;
  try {
    let slugCatalogo: string | null = (catalogo_slug || "").trim() || null;
    if (!slugCatalogo && servico_principal) {
      const sp = servico_principal.trim();
      const { data: cat } = await admin
        .from("qa_servicos_catalogo")
        .select("slug, preco")
        .eq("ativo", true)
        .or(`slug.eq.${sp},servico_principal_slug.eq.${sp}`)
        .order("display_order", { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (cat?.slug) slugCatalogo = cat.slug;
    }

    if (slugCatalogo) {
      const { data: catRow } = await admin
        .from("qa_servicos_catalogo")
        .select("slug, preco, servico_id")
        .eq("slug", slugCatalogo)
        .eq("ativo", true)
        .maybeSingle();

      const qaClienteIdNum = qaClienteId ? Number(qaClienteId) : null;
      if (!catRow) {
        console.warn("[venda_pendente] catálogo não encontrado:", slugCatalogo);
      } else if (catRow.servico_id == null) {
        console.warn("[venda_pendente] catálogo sem servico_id (não pronto online):", slugCatalogo);
      } else if (!qaClienteIdNum) {
        console.warn("[venda_pendente] qa_cliente_id ausente, não é possível criar venda");
      } else {
        const valor = Number(catRow.preco ?? 0) || 1;
        const { data: rpcRes, error: rpcErr } = await admin.rpc(
          "qa_arsenal_criar_venda_pendente" as any,
          {
            p_qa_cliente_id: qaClienteIdNum,
            p_catalogo_slug: catRow.slug,
            p_valor: valor,
            p_observacoes:
              "Contratação iniciada no cadastro Arsenal — aguardando validação da equipe.",
          } as any,
        );
        if (rpcErr) {
          console.error("[venda_pendente] RPC erro:", rpcErr.message);
        } else {
          const r = (rpcRes ?? {}) as Record<string, unknown>;
          vendaCriadaId = (r.venda_id as number | null) ?? null;
          console.info("[venda_pendente] criada:", JSON.stringify(r));
          if (vendaCriadaId && r.ja_existia !== true) {
            admin.functions
              .invoke("qa-notificar-admin-contratacao", { body: { venda_id: vendaCriadaId } })
              .catch((e) => console.warn("[venda_pendente] notif admin falhou:", e));
          }
        }
      }
    }
  } catch (e) {
    console.error("[venda_pendente] threw:", (e as Error)?.message);
  }

  // Lovable Emails: template dedicado boas-vindas (Arsenal Inteligente) com queue/log/unsubscribe.
  try {
    const { sendTransactional } = await import("../_shared/sendTransactional.ts");
    await sendTransactional({
      templateName: "boas-vindas",
      recipientEmail: emailNorm,
      idempotencyKey: `boas-vindas-${emailNorm}`,
      templateData: {
        nome,
        servicoInteresse: servico_interesse ?? null,
        portalUrl: "https://www.euqueroarmas.com.br/area-do-cliente",
      },
    });
  } catch (e) {
    console.error("[boas-vindas] envio falhou:", (e as Error)?.message);
  }

  return json({
    ok: true,
    qa_cliente_id: result.qa_cliente_id ?? null,
    user_id: userId,
    email: emailNorm,
    tipo_cliente: result.tipo_cliente ?? null,
    cliente_created: result.cliente_created ?? false,
    venda_pendente_id: vendaCriadaId,
  });
});
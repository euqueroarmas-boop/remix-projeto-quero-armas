// FASE 17-A: Conta pública gratuita do app de arsenal (Quero Armas)
// Cria auth.users + vincula a qa_clientes via RPC qa_cliente_criar_conta_publica.
// NÃO cria venda, processo, pagamento, checklist ou Asaas.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { qaArsenalWelcomeHtml, qaArsenalWelcomeText } from "../_shared/qaEmailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  cpf: z.string().min(11).max(20),
  nome: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255),
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
    return json(
      {
        ok: false,
        reason: "cpf_ja_possui_login",
        message: "Este CPF já possui acesso. Faça login.",
      },
      200,
    );
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

      if (!catRow) {
        console.warn("[venda_pendente] catálogo não encontrado:", slugCatalogo);
      } else if (catRow.servico_id == null) {
        console.warn("[venda_pendente] catálogo sem servico_id (não pronto online):", slugCatalogo);
      } else {
        const valor = Number(catRow.preco ?? 0) || 1; // RPC exige > 0
        const { data: rpcRes, error: rpcErr } = await admin.rpc(
          "qa_cliente_criar_contratacao_publico" as any,
          {
            p_cpf: cpfNorm,
            p_nome: nome,
            p_email: emailNorm,
            p_telefone: telefone ?? "",
            p_catalogo_slug: catRow.slug,
            p_valor_informado: valor,
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

          // Notifica admin (best-effort)
          if (vendaCriadaId) {
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

  // 5) Dispara e-mail de boas-vindas via send-smtp-email (gateway central existente)
  try {
    const html = qaArsenalWelcomeHtml({
      name: nome,
      email: emailNorm,
      servicoInteresse: servico_interesse ?? null,
    });
    const text = qaArsenalWelcomeText({
      name: nome,
      email: emailNorm,
      servicoInteresse: servico_interesse ?? null,
    });

    const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || "";
    if (!internalToken) {
      console.error("[arsenal_welcome] INTERNAL_FUNCTION_TOKEN ausente — e-mail não será enviado");
    } else {
      const { data: smtpData, error: smtpErr } = await admin.functions.invoke(
        "send-smtp-email",
        {
          headers: { "x-internal-token": internalToken },
          body: {
            to: emailNorm,
            subject: "Bem-vindo ao Arsenal — Quero Armas",
            html,
            text,
            from_name: "Quero Armas",
          },
        },
      );
      if (smtpErr) {
        console.error("[arsenal_welcome] send-smtp-email error:", smtpErr.message);
      } else {
        console.info("[arsenal_welcome] enviado:", JSON.stringify(smtpData));
      }
    }
  } catch (e) {
    console.error("[arsenal_welcome] envio falhou:", (e as Error)?.message);
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
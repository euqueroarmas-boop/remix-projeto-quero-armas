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

  const { cpf, nome, email, telefone, senha, servico_interesse } = parsed.data;
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
      concluido_em: new Date().toISOString(),
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
  });
});
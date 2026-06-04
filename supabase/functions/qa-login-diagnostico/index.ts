// Diagnóstico seguro de login do portal Quero Armas.
// Entrada: { email?: string, cpf?: string }
// Saída: { reason: string, hint: string }
// NUNCA retorna senhas, tokens, ids de auth, e-mails alheios ou dados PII
// de outros clientes. Apenas o motivo agregado para a UI orientar o usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Reason =
  | "auth_user_nao_existe"
  | "senha_incorreta"
  | "cliente_sem_acesso_ativado"
  | "vinculo_cliente_auth_quebrado"
  | "email_diferente_do_cadastro"
  | "ambiente_auth_inconsistente"
  | "indefinido";

const HINTS: Record<Reason, string> = {
  auth_user_nao_existe:
    "Conta ainda não ativada. Use 'Primeiro acesso' para ativar.",
  senha_incorreta:
    "Senha não confere. Use 'Esqueci minha senha' para redefinir.",
  cliente_sem_acesso_ativado:
    "Encontramos seu cadastro, mas o acesso ainda não foi ativado. Use 'Primeiro acesso'.",
  vinculo_cliente_auth_quebrado:
    "Encontramos seu cadastro, mas o vínculo de acesso está pendente. Solicite reparo ou refaça o 'Primeiro acesso'.",
  email_diferente_do_cadastro:
    "Este e-mail é diferente do registrado no seu cadastro. Tente com o e-mail original ou solicite atualização.",
  ambiente_auth_inconsistente:
    "Não foi possível confirmar o estado da sua conta agora. Tente novamente em instantes.",
  indefinido:
    "Não foi possível autenticar. Verifique e-mail/senha ou use 'Primeiro acesso'.",
};

function onlyDigits(s: string) {
  return (s || "").replace(/\D+/g, "");
}

function respond(reason: Reason) {
  return new Response(
    JSON.stringify({ reason, hint: HINTS[reason] }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const emailNorm = String(body?.email || "").trim().toLowerCase();
    const cpfDigits = onlyDigits(String(body?.cpf || ""));

    if (!emailNorm && !cpfDigits) return respond("indefinido");

    // 1) Auth user existe para o e-mail?
    let authUserId: string | null = null;
    if (emailNorm) {
      try {
        // listUsers permite filtrar por email substring; restringimos depois.
        const { data: page } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        const match = (page?.users || []).find(
          (u: any) => String(u.email || "").toLowerCase() === emailNorm,
        );
        if (match) authUserId = match.id;
      } catch (_) {
        return respond("ambiente_auth_inconsistente");
      }
    }

    // 2) Existe cliente por e-mail ou CPF?
    let qaCliente: any = null;
    if (cpfDigits) {
      const { data } = await admin
        .from("qa_clientes")
        .select("id, cpf, email, user_id, status")
        .eq("cpf", cpfDigits)
        .maybeSingle();
      qaCliente = data;
    }
    if (!qaCliente && emailNorm) {
      const { data } = await admin
        .from("qa_clientes")
        .select("id, cpf, email, user_id, status")
        .ilike("email", emailNorm)
        .limit(1)
        .maybeSingle();
      qaCliente = data;
    }

    // 3) Existe cliente_auth_links?
    let link: any = null;
    if (qaCliente?.id) {
      const { data } = await admin
        .from("cliente_auth_links")
        .select("id, status, user_id, qa_cliente_id, email")
        .eq("qa_cliente_id", qaCliente.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      link = data;
    }
    if (!link && emailNorm) {
      const { data } = await admin
        .from("cliente_auth_links")
        .select("id, status, user_id, qa_cliente_id, email")
        .ilike("email", emailNorm)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      link = data;
    }

    // 4) Classificação
    if (authUserId) {
      // Auth existe — então erro de login é senha incorreta.
      // Se também não há vínculo, sinaliza vínculo quebrado.
      if (link && link.user_id && link.user_id !== authUserId) {
        return respond("vinculo_cliente_auth_quebrado");
      }
      if (!link && qaCliente) {
        return respond("vinculo_cliente_auth_quebrado");
      }
      return respond("senha_incorreta");
    }

    // Sem auth user para o e-mail digitado.
    if (qaCliente) {
      const cadEmail = String(qaCliente.email || "").toLowerCase().trim();
      if (emailNorm && cadEmail && cadEmail !== emailNorm) {
        return respond("email_diferente_do_cadastro");
      }
      if (link?.status === "active" || qaCliente.user_id) {
        return respond("vinculo_cliente_auth_quebrado");
      }
      return respond("cliente_sem_acesso_ativado");
    }

    return respond("auth_user_nao_existe");
  } catch (e) {
    console.error("[qa-login-diagnostico] erro", e);
    return respond("indefinido");
  }
});
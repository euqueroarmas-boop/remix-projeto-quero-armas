// Checagem proativa: verifica se CPF e/ou email já têm acesso Arsenal.
// Usado na Etapa 3 (Revisão) do cadastro público para avisar o usuário
// ANTES de criar a senha. Não cria, não modifica nada.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  cpf: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().max(255).optional().nullable(),
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

  const cpfNorm = (parsed.data.cpf || "").replace(/\D/g, "");
  const emailNorm = (parsed.data.email || "").toLowerCase().trim();

  if (cpfNorm.length !== 11 && !emailNorm) {
    return json({ ok: true, cpf_existe: false, email_existe: false });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let cpfExiste = false;
  let emailExiste = false;

  // CPF: checa em cliente_auth_links (acesso ativo)
  if (cpfNorm.length === 11) {
    const { data } = await admin
      .from("cliente_auth_links")
      .select("id")
      .eq("documento_normalizado", cpfNorm)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    cpfExiste = !!data;
  }

  // Email: checa via Admin API (paginado simples — busca exata)
  if (emailNorm) {
    try {
      // listUsers aceita filtro por email parcial em algumas versões; aqui
      // usamos busca por email exato via getUserByEmail-like fallback.
      const { data, error } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (!error && data?.users?.length) {
        emailExiste = data.users.some(
          (u) => (u.email || "").toLowerCase() === emailNorm,
        );
      }
    } catch {
      // silencioso — em pior caso o usuário cai no bloqueio da Etapa 4
    }
  }

  return json({
    ok: true,
    cpf_existe: cpfExiste,
    email_existe: emailExiste,
  });
});
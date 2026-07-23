import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CAMPOS_PERMITIDOS = new Set([
  "nome_completo", "email", "celular", "data_nascimento", "nome_mae", "nome_pai",
  "sexo", "rg", "emissor_rg", "uf_emissor_rg", "expedicao_rg",
  "naturalidade_municipio", "naturalidade_uf", "naturalidade_pais",
  "estado_civil", "escolaridade", "titulo_eleitor", "cnh", "ctps", "profissao",
  "cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado", "pais",
  "observacao", "ocupacao_licita_cnpj", "ocupacao_licita_razao_social",
  "ocupacao_licita_nome_fantasia", "ocupacao_licita_atividade",
  "ocupacao_licita_logradouro", "ocupacao_licita_numero",
  "ocupacao_licita_complemento", "ocupacao_licita_bairro",
  "ocupacao_licita_cidade", "ocupacao_licita_estado", "ocupacao_licita_cep",
  "ocupacao_licita_telefone", "arquivado",
]);

function sanitize(value: unknown): string | boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  const text = String(value).trim();
  return text || undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) return json({ error: "unauthenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: isStaff, error: staffError } = await admin.rpc(
      "qa_is_active_staff",
      { _user_id: userData.user.id },
    );
    if (staffError || isStaff !== true) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const clienteId = Number(body?.cliente_id);
    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      return json({ error: "cliente_id_invalido" }, 400);
    }

    const incoming = body?.campos && typeof body.campos === "object" ? body.campos : {};
    const campos: Record<string, string | boolean> = {};
    for (const [key, value] of Object.entries(incoming)) {
      if (!CAMPOS_PERMITIDOS.has(key)) continue;
      const sanitized = sanitize(value);
      if (sanitized !== undefined) campos[key] = sanitized;
    }
    if (!Object.keys(campos).length) return json({ error: "nenhum_campo_valido" }, 400);

    const { data: atual, error: atualError } = await admin
      .from("qa_clientes")
      .select("id, campo_origens")
      .eq("id", clienteId)
      .maybeSingle();
    if (atualError) return json({ error: atualError.message }, 500);
    if (!atual) return json({ error: "cliente_nao_encontrado" }, 404);

    const campoOrigens = {
      ...((atual.campo_origens && typeof atual.campo_origens === "object")
        ? atual.campo_origens
        : {}),
    } as Record<string, unknown>;
    const agora = new Date().toISOString();
    for (const key of Object.keys(campos)) {
      if (key !== "arquivado") {
        campoOrigens[key] = { source: "manual_override_ai", updated_at: agora };
      }
    }

    const { data: salvo, error: saveError } = await admin
      .from("qa_clientes")
      .update({ ...campos, campo_origens: campoOrigens })
      .eq("id", clienteId)
      .select("id, nome_completo, cpf, email, celular, endereco, numero, complemento, bairro, cidade, estado, cep, pais")
      .single();
    if (saveError || !salvo) return json({ error: saveError?.message || "falha_ao_salvar" }, 500);

    return json({ ok: true, cliente: salvo });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "erro_interno" }, 500);
  }
});

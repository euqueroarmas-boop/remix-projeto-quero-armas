// ============================================================================
// qa-cliente-atualizar-cadastro
// ----------------------------------------------------------------------------
// Permite que o CLIENTE LOGADO (portal) atualize SEU PRÓPRIO registro em
// qa_clientes, somente para campos cadastrais não-sensíveis. Usado pelo
// fluxo "Completar cadastro progressivo" (manual + revisão de extração IA).
//
// REGRAS DE SEGURANÇA:
// - Exige Bearer token de usuário autenticado.
// - O cliente alvo é SEMPRE resolvido por qa_clientes.user_id = auth.uid().
//   O `cliente_id` enviado pelo front é IGNORADO — esta função nunca aceita
//   "atualizar outro cliente". Equipe Quero Armas usa funções próprias.
// - CPF e e-mail NUNCA são atualizados por esta função (campos sensíveis).
// - Apenas um conjunto branco-listado de campos é gravado.
// - Service role é usado apenas para bypass de RLS após validação manual.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

// Campos brancos-listados. Qualquer outro é descartado.
const CAMPOS_PERMITIDOS = new Set<string>([
  // Pessoais
  "data_nascimento",
  "sexo",
  "estado_civil",
  "nacionalidade",
  "naturalidade_municipio",
  "naturalidade_uf",
  "naturalidade",
  "nome_mae",
  "nome_pai",
  // Contato
  "celular",
  // Endereço principal
  "cep",
  "endereco",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "estado",
  // Profissional
  "profissao",
  "escolaridade",
  // Identidade (não sensíveis estruturalmente)
  "rg",
  "emissor_rg",
  "uf_emissor_rg",
  "expedicao_rg",
  "tipo_documento_identidade",
]);

// Campos explicitamente proibidos (mesmo se chegarem).
const CAMPOS_PROIBIDOS = new Set<string>([
  "id",
  "id_legado",
  "user_id",
  "cpf",
  "email",
  "status",
  "excluido",
  "homologacao_status",
  "arsenal_plano",
  "customer_id",
  "categoria_titular",
  "subcategoria",
]);

function sanitize(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t.length === 0 ? null : t;
  }
  return String(value).trim() || null;
}

function parseBrDateToIso(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.slice(7).trim();

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "invalid_token" }, 401);
    const authUserId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const rawFields = body?.fields;
    if (!rawFields || typeof rawFields !== "object" || Array.isArray(rawFields)) {
      return json({ error: "fields_required" }, 400);
    }

    // Sanitiza + filtra para apenas campos permitidos.
    const updates: Record<string, string | null> = {};
    const ignorados: string[] = [];
    for (const [k, v] of Object.entries(rawFields as Record<string, unknown>)) {
      if (CAMPOS_PROIBIDOS.has(k)) {
        ignorados.push(k);
        continue;
      }
      if (!CAMPOS_PERMITIDOS.has(k)) {
        ignorados.push(k);
        continue;
      }
      let cleaned = sanitize(v);
      if (cleaned == null) {
        // Não apagamos valores existentes via string vazia — pulamos.
        continue;
      }
      // Normalizações leves
      if (k === "estado" || k === "naturalidade_uf" || k === "uf_emissor_rg") {
        cleaned = cleaned.toUpperCase().slice(0, 2);
      } else if (k === "cep") {
        cleaned = cleaned.replace(/\D/g, "").slice(0, 8);
        if (cleaned.length !== 8) continue;
      } else if (k === "celular") {
        cleaned = cleaned.replace(/\D/g, "").slice(0, 13);
        if (cleaned.length < 10) continue;
      } else if (k === "data_nascimento" || k === "expedicao_rg") {
        const iso = parseBrDateToIso(cleaned);
        if (!iso) continue;
        cleaned = iso;
      }
      updates[k] = cleaned;
    }

    if (Object.keys(updates).length === 0) {
      return json({ success: true, atualizados: [], ignorados, mensagem: "Nada para atualizar" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Resolve cliente do usuário autenticado.
    const { data: cliente, error: cErr } = await admin
      .from("qa_clientes")
      .select("id, user_id, excluido")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (cErr) return json({ error: cErr.message }, 500);
    if (!cliente) return json({ error: "cliente_nao_vinculado" }, 404);
    if (cliente.excluido) return json({ error: "cliente_excluido" }, 403);

    const { data: updated, error: upErr } = await admin
      .from("qa_clientes")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", cliente.id)
      .select("id")
      .maybeSingle();
    if (upErr) return json({ error: upErr.message }, 500);

    // Auditoria best-effort (não bloqueia se a tabela não existir).
    try {
      await admin.from("qa_processo_eventos").insert({
        processo_id: null,
        tipo_evento: "cliente_atualizou_cadastro",
        descricao: `Cliente atualizou ${Object.keys(updates).length} campo(s) pelo portal.`,
        ator: "cliente",
        dados_json: { cliente_id: cliente.id, campos: Object.keys(updates) },
      } as any);
    } catch { /* opcional */ }

    return json({
      success: true,
      cliente_id: (updated as any)?.id ?? cliente.id,
      atualizados: Object.keys(updates),
      ignorados,
    });
  } catch (e: any) {
    console.error("[qa-cliente-atualizar-cadastro]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
// ============================================================================
// qa-cliente-atualizar-cadastro
// ----------------------------------------------------------------------------
// Permite que o CLIENTE LOGADO (portal) atualize SEU PRÓPRIO registro em
// qa_clientes, somente para campos cadastrais não-sensíveis. Usado pelo
// fluxo "Completar cadastro progressivo" (manual + revisão de extração IA).
//
// REGRAS DE SEGURANÇA:
// - Exige Bearer token de usuário autenticado.
// - O cliente alvo é resolvido pelo vínculo autenticado do portal
//   (qa_clientes.user_id OU cliente_auth_links.user_id). Se `cliente_id` vier
//   do front, ele só é usado depois de validar esse vínculo.
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
/**
 * Rótulos legíveis dos campos, para o cliente entender o aviso.
 *
 * Sem isso o e-mail diria "naturalidade_uf" — nome de coluna, não de
 * informação. Campo sem rótulo aqui cai no próprio nome, que é feio mas
 * honesto; nunca é omitido do aviso.
 */
const ROTULO_CAMPO: Record<string, string> = {
  nome: "Nome",
  nome_completo: "Nome completo",
  data_nascimento: "Data de nascimento",
  sexo: "Sexo",
  estado_civil: "Estado civil",
  nacionalidade: "Nacionalidade",
  naturalidade_municipio: "Naturalidade — município",
  naturalidade_uf: "Naturalidade — UF",
  naturalidade: "Naturalidade",
  nome_mae: "Nome da mãe",
  nome_pai: "Nome do pai",
  celular: "Celular",
  cep: "CEP",
  endereco: "Logradouro",
  numero: "Número",
  complemento: "Complemento",
  bairro: "Bairro",
  cidade: "Cidade",
  estado: "Estado (UF)",
  profissao: "Profissão",
  escolaridade: "Escolaridade",
  rg: "RG / CIN",
  emissor_rg: "Órgão emissor do RG",
  uf_emissor_rg: "UF do emissor do RG",
  expedicao_rg: "Data de expedição do RG",
  tipo_documento_identidade: "Tipo do documento de identidade",
  titulo_eleitor: "Título de eleitor",
};

const CAMPOS_PERMITIDOS = new Set<string>([
  // Pessoais
  "nome",
  "nome_completo",
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
  "titulo_eleitor",
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
    const requestedClienteId = Number(body?.cliente_id || 0) || null;
    // Mapa opcional { campo: 'manual' | 'ai' | 'manual_override_ai' } enviado
    // pelo front para registrar a ORIGEM de cada campo atualizado. Sem ele,
    // assumimos 'manual' (cliente digitou).
    const rawOrigins = (body?.field_origins && typeof body.field_origins === "object")
      ? (body.field_origins as Record<string, string>)
      : {};
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
      // A coluna real em qa_clientes é `nome_completo`. Aceitamos a chave
      // legada `nome` (vinda de versões anteriores do front) e gravamos no
      // campo correto, evitando erro de coluna inexistente.
      const targetCol = k === "nome" ? "nome_completo" : k;
      updates[targetCol] = cleaned;
    }

    if (Object.keys(updates).length === 0) {
      return json({ success: true, atualizados: [], ignorados, mensagem: "Nada para atualizar" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Resolve cliente do usuário autenticado. Alguns acessos do portal usam
    // `cliente_auth_links` em vez de gravar `qa_clientes.user_id` diretamente.
    let cliente: any = null;
    if (requestedClienteId) {
      const { data: direto, error: diretoErr } = await admin
        .from("qa_clientes")
        .select("id, user_id, excluido")
        .eq("id", requestedClienteId)
        .maybeSingle();
      if (diretoErr) return json({ error: diretoErr.message }, 500);
      if (direto) {
        const isDirectOwner = direto.user_id === authUserId;
        let isLinkedOwner = false;
        if (!isDirectOwner) {
          const { data: link } = await admin
            .from("cliente_auth_links")
            .select("qa_cliente_id")
            .eq("user_id", authUserId)
            .eq("qa_cliente_id", requestedClienteId)
            .maybeSingle();
          isLinkedOwner = !!link;
        }
        if (!isDirectOwner && !isLinkedOwner) return json({ error: "forbidden" }, 403);
        cliente = direto;
      }
    }

    if (!cliente) {
      const { data: direto, error: cErr } = await admin
        .from("qa_clientes")
        .select("id, user_id, excluido")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (cErr) return json({ error: cErr.message }, 500);
      cliente = direto;
    }

    if (!cliente) {
      const { data: link } = await admin
        .from("cliente_auth_links")
        .select("qa_cliente_id")
        .eq("user_id", authUserId)
        .limit(2);
      if ((link || []).length === 1) {
        const { data: vinculado, error: vErr } = await admin
          .from("qa_clientes")
          .select("id, user_id, excluido")
          .eq("id", (link as any[])[0].qa_cliente_id)
          .maybeSingle();
        if (vErr) return json({ error: vErr.message }, 500);
        cliente = vinculado;
      } else if ((link || []).length > 1) {
        return json({ error: "cliente_id_required" }, 400);
      }
    }

    if (!cliente) return json({ error: "cliente_nao_vinculado" }, 404);
    if (cliente.excluido) return json({ error: "cliente_excluido" }, 403);

    // Carrega o registro atual: campo_origens (para mesclar) e os valores
    // ANTIGOS dos campos alterados — sem isso a notificação só diz qual campo
    // mudou, e a equipe não consegue conferir o que o cliente escreveu.
    const { data: clienteFull } = await admin
      .from("qa_clientes")
      .select("*")
      .eq("id", cliente.id)
      .maybeSingle();
    const anteriores: Record<string, unknown> = (clienteFull as any) || {};
    const origens = ((clienteFull as any)?.campo_origens || {}) as Record<string, { source: string; at?: string }>;
    const agora = new Date().toISOString();
    for (const col of Object.keys(updates)) {
      const requested = String(rawOrigins[col] || "manual").toLowerCase();
      const allowed = new Set(["manual", "ai", "manual_override_ai"]);
      const source = allowed.has(requested) ? requested : "manual";
      origens[col] = { source, at: agora };
    }

    const { data: updated, error: upErr } = await admin
      .from("qa_clientes")
      .update({ ...updates, campo_origens: origens, updated_at: agora })
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

    // Avisa o cliente, campo a campo. Regra do usuário: qualquer mudança no
    // cadastro tem de ser informada. Best-effort — se o e-mail falhar, a
    // gravação já aconteceu e não pode ser desfeita por causa do aviso.
    try {
      await admin.functions.invoke("qa-notify-event", {
        body: {
          evento: "cadastro_atualizado",
          cliente_id: cliente.id,
          alterado_por: "Você, pelo portal do cliente",
          campos_alterados: Object.entries(updates).map(([k, v]) => ({
            label: ROTULO_CAMPO[k] ?? k,
            valor: String(v ?? ""),
          })),
        },
      });
    } catch (err) {
      console.error("[qa-cliente-atualizar-cadastro] aviso ao cliente falhou:", err);
    }

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
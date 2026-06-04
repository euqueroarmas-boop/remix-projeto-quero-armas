// ============================================================================
// qa-processo-template-data-salvar
// ----------------------------------------------------------------------------
// Permite que o CLIENTE LOGADO atualize `qa_processos.respostas_questionario_json
// .template_data` de um processo do qual ele é o dono. Faz MERGE (não substitui)
// e ignora chaves vazias. Registra evento de auditoria em qa_processo_eventos.
//
// Segurança:
//  - Exige Bearer token válido.
//  - O processo deve pertencer (via qa_clientes.user_id) ao usuário autenticado
//    OU o usuário deve ser staff QA ativo.
//  - Apenas chaves brancos-listadas em ALLOWED_KEYS são aceitas.
//  - Não altera RLS. Service-role apenas para bypass após validação manual.
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

// Chaves aceitas em template_data (devem casar com keys do catálogo de
// placeholders `source: "processo"`).
const ALLOWED_KEYS = new Set<string>([
  "nome_clube",
  "cnpj_clube",
  "numero_cr_clube",
  "data_cr_clube",
  "endereco_clube",
  "numero_filiacao",
  "validade_filiacao",
]);

function sanitize(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (!t) return null;
  return t;
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
    const processoId = sanitize(body?.processo_id);
    const rawPatch = body?.template_data ?? body?.patch;
    if (!processoId) return json({ error: "processo_id_required" }, 400);
    if (!rawPatch || typeof rawPatch !== "object" || Array.isArray(rawPatch)) {
      return json({ error: "template_data_required" }, 400);
    }

    // Normaliza patch
    const cleanedPatch: Record<string, string> = {};
    const ignorados: string[] = [];
    for (const [k, v] of Object.entries(rawPatch as Record<string, unknown>)) {
      if (!ALLOWED_KEYS.has(k)) { ignorados.push(k); continue; }
      let val = sanitize(v);
      if (!val) continue;
      if (k === "cnpj_clube") {
        val = val.replace(/\D/g, "").slice(0, 14);
        if (val.length !== 14) continue;
      } else if (k === "data_cr_clube" || k === "validade_filiacao") {
        const iso = parseBrDateToIso(val);
        if (!iso) continue;
        val = iso;
      } else {
        val = val.toUpperCase();
      }
      cleanedPatch[k] = val;
    }

    if (Object.keys(cleanedPatch).length === 0) {
      return json({ success: true, atualizados: [], ignorados, mensagem: "Nada para atualizar" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Carrega processo + dono
    const { data: processo, error: pErr } = await admin
      .from("qa_processos")
      .select("id, cliente_id, respostas_questionario_json")
      .eq("id", processoId)
      .maybeSingle();
    if (pErr) return json({ error: pErr.message }, 500);
    if (!processo) return json({ error: "processo_nao_encontrado" }, 404);

    const { data: cliente, error: cErr } = await admin
      .from("qa_clientes")
      .select("id, user_id, excluido")
      .eq("id", (processo as any).cliente_id)
      .maybeSingle();
    if (cErr) return json({ error: cErr.message }, 500);
    if (!cliente) return json({ error: "cliente_nao_encontrado" }, 404);

    const isOwner = (cliente as any).user_id === authUserId;
    let isStaff = false;
    if (!isOwner) {
      const { data: perfilRow } = await admin
        .from("qa_usuarios_perfis")
        .select("perfil, ativo")
        .eq("user_id", authUserId)
        .eq("ativo", true)
        .maybeSingle();
      isStaff = !!perfilRow;
    }
    if (!isOwner && !isStaff) return json({ error: "forbidden" }, 403);

    // Merge no JSON existente
    const respostas = (processo as any).respostas_questionario_json;
    const base: Record<string, any> = respostas && typeof respostas === "object" && !Array.isArray(respostas) ? { ...respostas } : {};
    const prevTD = base.template_data && typeof base.template_data === "object" && !Array.isArray(base.template_data)
      ? { ...base.template_data }
      : {};
    const mergedTD = { ...prevTD, ...cleanedPatch };
    const merged = { ...base, template_data: mergedTD };

    const { error: upErr } = await admin
      .from("qa_processos")
      .update({ respostas_questionario_json: merged, updated_at: new Date().toISOString() })
      .eq("id", processoId);
    if (upErr) return json({ error: upErr.message }, 500);

    // Auditoria
    try {
      await admin.from("qa_processo_eventos").insert({
        processo_id: processoId,
        tipo_evento: "template_data_atualizado",
        descricao: `Cliente atualizou ${Object.keys(cleanedPatch).length} campo(s) de template_data via Assistente.`,
        ator: isOwner ? "cliente" : "staff",
        user_id: authUserId,
        dados_json: { campos: Object.keys(cleanedPatch) },
      } as any);
    } catch (_) { /* opcional */ }

    return json({ success: true, atualizados: Object.keys(cleanedPatch), ignorados, template_data: mergedTD });
  } catch (e: any) {
    console.error("[qa-processo-template-data-salvar]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
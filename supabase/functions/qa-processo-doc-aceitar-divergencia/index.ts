// ============================================================================
// qa-processo-doc-aceitar-divergencia
// ----------------------------------------------------------------------------
// Permite que o CLIENTE LOGADO declare que o cadastro está correto e o
// documento, mesmo divergente em um grupo de campos (ex.: endereço), deve
// ser aceito como comprovação. A função:
//   1. Valida que o usuário autenticado é o dono do processo do documento.
//   2. Remove de `divergencias_json` apenas itens do grupo solicitado
//      (endereço por enquanto). Outros grupos permanecem como divergência.
//   3. Se não sobrar divergência, move o documento para `revisao_humana`
//      para conferência final pela equipe (nunca aprovamos automaticamente).
//   4. Registra evento auditável em qa_processo_eventos.
// Não altera qa_clientes nem outros documentos.
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

const CAMPOS_POR_GRUPO: Record<string, string[]> = {
  endereco: [
    "endereco", "logradouro", "rua", "avenida", "travessa",
    "numero", "complemento", "bairro", "cidade", "municipio",
    "uf", "estado", "cep",
    "endereco_logradouro", "endereco_numero", "endereco_complemento",
    "endereco_bairro", "endereco_cidade", "endereco_uf", "endereco_estado",
    "endereco_cep",
  ],
  estado_civil: [
    "estado_civil", "estadocivil", "estado_civil_titular", "civil_status",
  ],
};

function ehCampoDoGrupo(campo: any, grupo: string): boolean {
  const k = String(campo || "").toLowerCase().trim();
  if (!k) return false;
  const lista = CAMPOS_POR_GRUPO[grupo] || [];
  if (lista.includes(k)) return true;
  if (grupo === "estado_civil") {
    return /estado[_\s-]?civil|civil[_\s-]?status/.test(k);
  }
  if (grupo === "endereco") {
    // Não classificar `estado_civil` como endereço.
    if (/estado[_\s-]?civil|civil[_\s-]?status/.test(k)) return false;
    return /endereco|logradouro|^rua$|^avenida$|^travessa$|numero|complemento|bairro|cidade|municipio|^uf$|(^|_)estado(_|$)|cep/i.test(k);
  }
  return false;
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
    const documentoId = String(body?.documento_id ?? "").trim();
    const grupo = String(body?.grupo ?? "").trim().toLowerCase();
    if (!documentoId) return json({ error: "documento_id_required" }, 400);
    if (!CAMPOS_POR_GRUPO[grupo]) return json({ error: "grupo_invalido" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: doc, error: dErr } = await admin
      .from("qa_processo_documentos")
      .select("id, processo_id, cliente_id, status, divergencias_json, motivo_rejeicao, campos_complementares_json")
      .eq("id", documentoId)
      .maybeSingle();
    if (dErr) return json({ error: dErr.message }, 500);
    if (!doc) return json({ error: "documento_not_found" }, 404);

    // Confirma dono do processo. O `doc.cliente_id` é frágil: documentos
    // antigos ou criados em fluxos auxiliares podem ter o campo nulo ou
    // divergente do processo real. Fonte de verdade = `qa_processos.cliente_id`.
    if (!doc.processo_id) return json({ error: "documento_sem_processo" }, 400);
    const { data: processo } = await admin
      .from("qa_processos")
      .select("id, cliente_id")
      .eq("id", doc.processo_id)
      .maybeSingle();
    if (!processo) return json({ error: "processo_not_found" }, 404);
    const targetClienteId = processo.cliente_id ?? doc.cliente_id ?? null;
    if (!targetClienteId) return json({ error: "cliente_indefinido" }, 400);
    const { data: cliente } = await admin
      .from("qa_clientes")
      .select("id, user_id, excluido")
      .eq("id", targetClienteId)
      .maybeSingle();
    if (!cliente) return json({ error: "cliente_not_found" }, 404);
    if (cliente.excluido) return json({ error: "cliente_excluido" }, 403);

    // Permite dono direto, vínculo do portal OU staff/equipe QA.
    const isDirectOwner = cliente.user_id === authUserId;
    let isLinkedOwner = false;
    if (!isDirectOwner) {
      const { data: link } = await admin
        .from("cliente_auth_links")
        .select("qa_cliente_id")
        .eq("user_id", authUserId)
        .eq("qa_cliente_id", targetClienteId)
        .maybeSingle();
      isLinkedOwner = !!link;
    }
    const isOwner = isDirectOwner || isLinkedOwner;
    let isStaff = false;
    if (!isOwner) {
      const { data: perfil } = await admin
        .from("qa_usuarios_perfis")
        .select("id, ativo")
        .eq("user_id", authUserId)
        .eq("ativo", true)
        .maybeSingle();
      isStaff = !!perfil;
    }
    if (!isOwner && !isStaff) return json({ error: "forbidden" }, 403);

    const divs = Array.isArray(doc.divergencias_json) ? (doc.divergencias_json as any[]) : [];
    const restantes = divs.filter((d) => !ehCampoDoGrupo((d as any)?.campo, grupo));
    const removidos = divs.length - restantes.length;

    const compl = (doc.campos_complementares_json && typeof doc.campos_complementares_json === "object")
      ? { ...(doc.campos_complementares_json as Record<string, any>) }
      : {};
    compl[`${grupo}_dispensado_por_cliente`] = true;
    compl[`${grupo}_dispensado_em`] = new Date().toISOString();

    const update: Record<string, any> = {
      divergencias_json: restantes,
      campos_complementares_json: compl,
    };
    if (restantes.length === 0 && String(doc.status || "").toLowerCase() === "divergente") {
      update.status = "revisao_humana";
      update.motivo_rejeicao = null;
      update.validacao_ia_status = "revisao_humana";
    } else if (restantes.length > 0) {
      update.motivo_rejeicao = "Divergência entre o documento e seu cadastro: " +
        restantes.map((x: any) => x.campo).filter(Boolean).join(", ");
    }

    const { error: upErr } = await admin
      .from("qa_processo_documentos")
      .update(update)
      .eq("id", documentoId);
    if (upErr) return json({ error: upErr.message }, 500);

    await admin.from("qa_processo_eventos").insert({
      processo_id: doc.processo_id,
      documento_id: documentoId,
      tipo_evento: `divergencia_${grupo}_dispensada_pelo_cliente`,
      descricao:
        grupo === "endereco"
          ? "Cliente declarou que o endereço do cadastro está correto. Documento aceito como comprovação."
          : `Cliente dispensou divergência do grupo ${grupo}.`,
      ator: "cliente",
      dados_json: { removidos, restantes: restantes.map((x: any) => x.campo) },
    } as any);

    // Checa se o processo virou pronto_para_protocolar (idempotente, fire-and-forget).
    try {
      const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN") ?? "";
      await admin.functions.invoke("qa-processo-checar-conclusao-checklist", {
        headers: { "x-internal-token": internalToken },
        body: { processo_id: doc.processo_id, origem: "aceitar_divergencia" },
      });
    } catch (e) { console.warn("[aceitar-divergencia] checar-conclusao falhou", e); }

    return json({
      success: true,
      status: update.status ?? doc.status,
      removidos,
      restantes: restantes.length,
    });
  } catch (e: any) {
    console.error("[qa-processo-doc-aceitar-divergencia]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
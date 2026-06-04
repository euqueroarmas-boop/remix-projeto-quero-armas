// ============================================================================
// qa-processo-doc-reaproveitar  (Bloco 12)
// ----------------------------------------------------------------------------
// Marca um documento de DESTINO como `dispensado_por_reaproveitamento`
// quando o cliente confirma reuso de um documento de ORIGEM já aprovado/
// validado do mesmo cliente. Validações:
//   1) Usuário autenticado é dono do cliente.
//   2) Origem e destino pertencem ao mesmo cliente.
//   3) Origem está em status `aprovado` ou `validado`.
//   4) `tipo_documento` igual (case-insensitive) e não vazio.
//   5) Escopo igual (espelho de getDocumentoEscopo do front).
//   6) Escopo "processo" NUNCA reaproveita.
//   7) Escopo "arma" exige `arma_id` igual em ambos.
//   8) Origem não vencida (data_validade_efetiva || data_validade).
// Em sucesso: atualiza destino e registra evento auditável.
// Não altera RLS, nem outros documentos, nem qa_clientes.
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

/* --------------------- ESPELHO de documentoEscopo.ts ---------------------- */
const TIPOS_CLIENTE = new Set<string>([
  "rg", "cnh", "cin", "cpf", "foto", "foto_3x4",
  "comprovante_endereco",
  "certidao_antecedentes", "antecedentes_criminais",
  "antecedentes_federal", "antecedentes_estadual",
  "antecedentes_militar", "antecedentes_eleitoral",
  "certidao_casamento", "certidao_nascimento", "certidao_alteracao_nome",
]);
const ETAPAS_PERMANENTES = new Set<string>([
  "identificacao", "endereco", "antecedentes", "declaracoes_gerais",
]);
function isDocDeArma(tipo: string): boolean {
  const t = String(tipo || "").toLowerCase();
  if (!t) return false;
  if (["craf", "craf_renovacao", "nota_fiscal_arma", "autorizacao_compra_arma",
    "gte", "gte_transporte", "registro_arma"].includes(t)) return true;
  return /^(craf|gte|nota_fiscal_arma|registro_arma|autorizacao_compra_arma)(_|$)/.test(t);
}
type Escopo = "cliente" | "arma" | "processo";
function getEscopo(doc: { tipo_documento?: string | null; etapa?: string | null; arma_id?: string | null }): Escopo {
  const tipo = String(doc?.tipo_documento ?? "").trim().toLowerCase();
  const armaId = doc?.arma_id ? String(doc.arma_id).trim() : "";
  if (armaId || isDocDeArma(tipo)) return "arma";
  if (tipo && TIPOS_CLIENTE.has(tipo)) return "cliente";
  if (doc?.etapa && ETAPAS_PERMANENTES.has(String(doc.etapa))) return "cliente";
  return "processo";
}

function vencido(data?: string | null): boolean {
  if (!data) return false;
  const t = new Date(data).getTime();
  return !isNaN(t) && t < Date.now();
}

const STATUS_ORIGEM_OK = new Set(["aprovado", "validado"]);
const STATUS_DESTINO_BLOQUEIA = new Set([
  "aprovado", "validado", "dispensado_por_reaproveitamento",
  "dispensado_grupo", "em_revisao_humana", "revisao_humana",
]);

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
    const destinoId = String(body?.destino_documento_id ?? "").trim();
    const origemId = String(body?.origem_documento_id ?? "").trim();
    if (!destinoId || !origemId) return json({ error: "documento_id_required" }, 400);
    if (destinoId === origemId) return json({ error: "mesmo_documento" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [{ data: destino, error: dErr }, { data: origem, error: oErr }] = await Promise.all([
      admin.from("qa_processo_documentos")
        .select("id, processo_id, cliente_id, tipo_documento, nome_documento, etapa, status, arma_id, metadados_documento_json")
        .eq("id", destinoId).maybeSingle(),
      admin.from("qa_processo_documentos")
        .select("id, processo_id, cliente_id, tipo_documento, etapa, status, arma_id, arquivo_storage_key, data_validade, data_validade_efetiva")
        .eq("id", origemId).maybeSingle(),
    ]);
    if (dErr) return json({ error: dErr.message }, 500);
    if (oErr) return json({ error: oErr.message }, 500);
    if (!destino) return json({ error: "destino_not_found" }, 404);
    if (!origem) return json({ error: "origem_not_found" }, 404);

    if (destino.cliente_id !== origem.cliente_id) {
      return json({ error: "cliente_diferente" }, 403);
    }

    // Dono
    const { data: cliente } = await admin
      .from("qa_clientes")
      .select("id, user_id, excluido")
      .eq("id", destino.cliente_id)
      .maybeSingle();
    if (!cliente || cliente.user_id !== authUserId) return json({ error: "forbidden" }, 403);
    if (cliente.excluido) return json({ error: "cliente_excluido" }, 403);

    // Estado do destino — não sobrescreve aprovação/análise humana.
    const stDestino = String(destino.status || "").toLowerCase();
    if (STATUS_DESTINO_BLOQUEIA.has(stDestino)) {
      return json({ error: "destino_nao_acionavel", status: stDestino }, 409);
    }

    // Origem aprovada/validada e não vencida.
    const stOrigem = String(origem.status || "").toLowerCase();
    if (!STATUS_ORIGEM_OK.has(stOrigem)) {
      return json({ error: "origem_invalida", status: stOrigem }, 409);
    }
    if (vencido(origem.data_validade_efetiva ?? origem.data_validade)) {
      return json({ error: "origem_vencida" }, 409);
    }

    // Compatibilidade canônica.
    const tipoO = String(origem.tipo_documento ?? "").trim().toLowerCase();
    const tipoD = String(destino.tipo_documento ?? "").trim().toLowerCase();
    if (!tipoO || !tipoD || tipoO !== tipoD) {
      return json({ error: "tipo_incompativel", origem: tipoO, destino: tipoD }, 409);
    }
    const escopoO = getEscopo(origem);
    const escopoD = getEscopo(destino);
    if (escopoO !== escopoD) return json({ error: "escopo_incompativel" }, 409);
    if (escopoD === "processo") return json({ error: "escopo_processo_nao_reaproveita" }, 409);
    if (escopoD === "arma") {
      const aO = origem.arma_id ? String(origem.arma_id).trim() : "";
      const aD = destino.arma_id ? String(destino.arma_id).trim() : "";
      if (!aO || !aD || aO !== aD) return json({ error: "arma_diferente" }, 409);
    }

    const nowIso = new Date().toISOString();
    const meta = (destino.metadados_documento_json && typeof destino.metadados_documento_json === "object")
      ? { ...(destino.metadados_documento_json as Record<string, any>) }
      : {};
    meta.reaproveitamento = {
      documento_reaproveitado_id: origem.id,
      processo_origem_id: origem.processo_id,
      reaproveitado_em: nowIso,
      escopo: escopoD,
    };

    const update: Record<string, any> = {
      status: "dispensado_por_reaproveitamento",
      motivo_rejeicao: null,
      validacao_ia_status: "dispensado_por_reaproveitamento",
      metadados_documento_json: meta,
      data_validacao: nowIso,
    };

    const { error: upErr } = await admin
      .from("qa_processo_documentos")
      .update(update)
      .eq("id", destino.id);
    if (upErr) return json({ error: upErr.message }, 500);

    await admin.from("qa_processo_eventos").insert({
      processo_id: destino.processo_id,
      documento_id: destino.id,
      tipo_evento: "documento_reaproveitado",
      descricao:
        `Documento "${destino.nome_documento ?? tipoD}" reaproveitado de outro documento aprovado do mesmo cliente.`,
      ator: "cliente",
      dados_json: {
        origem_documento_id: origem.id,
        origem_processo_id: origem.processo_id,
        escopo: escopoD,
        tipo_documento: tipoD,
        arma_id: destino.arma_id ?? null,
      },
    } as any);

    return json({ success: true, status: update.status });
  } catch (e: any) {
    console.error("[qa-processo-doc-reaproveitar]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
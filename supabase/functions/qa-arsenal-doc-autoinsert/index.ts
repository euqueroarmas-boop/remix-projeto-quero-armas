// Edge: qa-arsenal-doc-autoinsert
//
// Cadastra automaticamente um documento do Arsenal quando a IA classificou e
// extraiu campos obrigatórios com segurança.
//
// Regras (espelham o pedido do produto):
//  - tipoDetectado != DESCONHECIDO
//  - confianca >= 0.85
//  - Campos obrigatórios do tipo legíveis (não vazios, sem placeholders)
//  - Não inventar nada: se faltou campo obrigatório, devolve safe=false e
//    o frontend pede reenvio do documento.
//
// Quando aprovado, grava em qa_documentos_cliente com:
//   status='aprovado', origem='sistema', validado_admin=true,
//   ia_status='auto_aprovado', ia_dados_extraidos = payload completo da IA.
// O recálculo de KPI/status do serviço continua disparado pelas triggers
// existentes (qa_doc_cliente_recalcular).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TIPO_DB = ["cr", "craf", "sinarm", "gt", "gte", "autorizacao_compra", "outro"] as const;
type TipoDb = typeof TIPO_DB[number];

const IA_TO_DB: Record<string, TipoDb> = {
  CR: "cr",
  CRAF: "craf",
  SINARM: "sinarm",
  GT: "gt",
  GTE: "gte",
  GUIA_TRANSITO: "gt",
  AUTORIZACAO_COMPRA: "autorizacao_compra",
  NOTA_FISCAL: "outro",
  EXAME_LAUDO: "outro",
  DESCONHECIDO: "outro",
};

function isLegivel(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  if (!s) return false;
  // bloqueia placeholders típicos de OCR inseguro
  if (/^[?_\-.\s]+$/.test(s)) return false;
  if (/[?]/.test(s)) return false; // qualquer "?" indica caractere ilegível
  return true;
}

function dataIsoFromBr(v?: string | null): string | null {
  if (!v) return null;
  const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Retorna lista de campos obrigatórios faltando (vazia = OK). */
function camposFaltando(tipoIA: string, c: Record<string, unknown>): string[] {
  const need = (k: string) => (isLegivel(c[k]) ? null : k);
  switch (tipoIA) {
    case "CRAF":
      return [
        need("numero_documento"),
        need("data_validade"),
        need("arma_numero_serie"),
        need("arma_calibre"),
        need("arma_modelo") || need("arma_marca"), // pelo menos um
      ].filter(Boolean) as string[];
    case "GTE":
      return [
        need("numero_documento"),
        need("data_validade"),
        need("arma_numero_serie"),
      ].filter(Boolean) as string[];
    case "GT":
    case "GUIA_TRANSITO":
      return [need("numero_documento")].filter(Boolean) as string[];
    case "CR":
      return [need("numero_documento"), need("data_validade")].filter(Boolean) as string[];
    case "SINARM":
      return [need("numero_documento"), need("data_validade")].filter(Boolean) as string[];
    case "AUTORIZACAO_COMPRA":
      return [need("numero_documento")].filter(Boolean) as string[];
    case "NOTA_FISCAL":
      return [
        need("nf_chave_acesso"),
        need("emitente"),
        need("nf_produto"),
        need("nf_quantidade"),
      ].filter(Boolean) as string[];
    default:
      return ["tipo_desconhecido"];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const customer_id: string | null = body?.customer_id ?? null;
    const qa_cliente_id: number | null = body?.qa_cliente_id ?? null;
    const arquivo_storage_path: string | null = body?.arquivo_storage_path ?? null;
    const arquivo_nome: string | null = body?.arquivo_nome ?? null;
    const arquivo_mime: string | null = body?.arquivo_mime ?? null;
    const classificacao = body?.classificacao || {};

    if (!customer_id && !qa_cliente_id) {
      return json({ error: "customer_id ou qa_cliente_id obrigatório" }, 400);
    }

    const tipoIA = String(classificacao?.tipoDetectado || "DESCONHECIDO");
    const conf = Number(classificacao?.confianca || 0);
    const campos = (classificacao?.camposExtraidos || {}) as Record<string, string | undefined>;

    // Auditoria mínima sempre devolvida ao caller
    const auditoria = {
      tipoDetectado: tipoIA,
      confianca: conf,
      camposExtraidos: campos,
      avaliado_em: new Date().toISOString(),
    };

    if (tipoIA === "DESCONHECIDO") {
      return json({
        safe: false,
        motivo: "documento_nao_identificado",
        auditoria,
      });
    }
    if (conf < 0.85) {
      return json({
        safe: false,
        motivo: "confianca_insuficiente",
        confianca: conf,
        auditoria,
      });
    }
    const faltando = camposFaltando(tipoIA, campos as Record<string, unknown>);
    if (faltando.length) {
      return json({
        safe: false,
        motivo: "campos_ilegiveis",
        campos_faltando: faltando,
        auditoria,
      });
    }

    const tipoDb = IA_TO_DB[tipoIA] || "outro";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Bloqueio de duplicidade por (cliente, tipo, número)
    const numeroNorm = String(campos.numero_documento || "").replace(/\s+/g, "").toUpperCase();
    if (numeroNorm) {
      let q = supabase
        .from("qa_documentos_cliente")
        .select("id, numero_documento")
        .eq("tipo_documento", tipoDb)
        .neq("status", "excluido");
      q = customer_id
        ? q.eq("customer_id", customer_id)
        : q.eq("qa_cliente_id", qa_cliente_id as number);
      const { data: dups } = await q;
      const dup = (dups || []).find(
        (d: any) => String(d.numero_documento || "").replace(/\s+/g, "").toUpperCase() === numeroNorm,
      );
      if (dup) {
        return json({
          safe: false,
          motivo: "duplicado",
          documento_existente_id: dup.id,
          auditoria,
        });
      }
    }

    const showArma = tipoDb !== "cr";

    const payload: Record<string, unknown> = {
      customer_id,
      qa_cliente_id,
      tipo_documento: tipoDb,
      numero_documento: campos.numero_documento || null,
      orgao_emissor: campos.orgao_emissor || null,
      data_emissao: dataIsoFromBr(campos.data_emissao),
      data_validade: dataIsoFromBr(campos.data_validade),
      arma_marca: showArma ? campos.arma_marca || null : null,
      arma_modelo: showArma ? campos.arma_modelo || null : null,
      arma_calibre: showArma ? campos.arma_calibre || null : null,
      arma_numero_serie: showArma ? campos.arma_numero_serie || null : null,
      arquivo_storage_path,
      arquivo_nome,
      arquivo_mime,
      ia_status: "auto_aprovado",
      ia_dados_extraidos: {
        ...auditoria,
        origem_fluxo: "arsenal_hub_documental",
        auto_cadastro: true,
      },
      ia_processado_em: new Date().toISOString(),
      status: "aprovado",
      origem: "sistema",
      validado_admin: true,
      validado_por: "ia_auto",
      validado_em: new Date().toISOString(),
      aprovado_em: new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await supabase
      .from("qa_documentos_cliente")
      .insert(payload)
      .select("id")
      .single();

    if (insErr) {
      console.error("[qa-arsenal-doc-autoinsert] insert error:", insErr);
      return json({ safe: false, motivo: "erro_insercao", erro: insErr.message, auditoria }, 500);
    }

    return json({
      safe: true,
      auto_cadastrado: true,
      documento_id: inserted?.id || null,
      tipo_documento: tipoDb,
      auditoria,
    });
  } catch (err) {
    console.error("[qa-arsenal-doc-autoinsert] erro:", err);
    return json({ error: (err as any)?.message || "Erro interno" }, 500);
  }
});
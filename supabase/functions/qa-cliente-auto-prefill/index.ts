// ============================================================================
// qa-cliente-auto-prefill
// ----------------------------------------------------------------------------
// Auto-preenche o cadastro do cliente logado a partir dos documentos que ele
// JÁ enviou (qa_documentos_cliente). Reaproveita `ia_dados_extraidos` que o
// pipeline de ingestão produz; não chama IA novamente — custo zero.
//
// REGRA DE SOBRESCRITA (definida pelo produto):
//   • Se o campo no cadastro está vazio                  → preenche.
//   • Se está preenchido com origem "manual" (digitado)  → SOBRESCREVE com o
//     valor do documento. Documento oficial é a fonte da verdade.
//   • Se está preenchido com origem "ai" (extração anterior) → atualiza com o
//     valor mais recente.
//   • Se origem é "manual_override_ai" (cliente CORRIGIU uma sugestão da IA)
//     → NÃO toca. A correção humana prevalece.
//
// Marca cada documento processado em `prefill_consumed_at` para não repetir.
// ============================================================================

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

type Origem = "manual" | "ai" | "manual_override_ai";

// Tipos de documento que carregam dados cadastrais úteis.
const TIPOS_RELEVANTES = new Set<string>([
  "rg", "cin", "identidade", "cnh",
  "comprovante_residencia", "comprovante_endereco", "endereco",
  "cr", "certificado_registro",
]);

// Mapeia chaves de `ia_dados_extraidos.camposExtraidos` → colunas qa_clientes.
// Algumas chaves dependem do tipo de documento.
function mapearCampos(tipoDoc: string, extraidos: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  const t = (tipoDoc || "").toLowerCase();

  const set = (k: string, v: any) => {
    if (v == null) return;
    const s = String(v).trim();
    if (s) out[k] = s;
  };

  // Comuns
  set("nome_completo", extraidos.nome_completo);
  set("data_nascimento", extraidos.data_nascimento);
  set("sexo", extraidos.sexo);
  set("nacionalidade", extraidos.nacionalidade);
  set("nome_mae", extraidos.filiacao_mae ?? extraidos.nome_mae);
  set("nome_pai", extraidos.filiacao_pai ?? extraidos.nome_pai);

  // Naturalidade vem como "CIDADE/UF" ou separada
  if (extraidos.naturalidade && typeof extraidos.naturalidade === "string") {
    const m = extraidos.naturalidade.match(/^(.+?)\s*\/\s*([A-Z]{2})\s*$/);
    if (m) {
      set("naturalidade_municipio", m[1]);
      set("naturalidade_uf", m[2]);
    } else {
      set("naturalidade_municipio", extraidos.naturalidade);
    }
  }
  set("naturalidade_municipio", extraidos.naturalidade_municipio);
  set("naturalidade_uf", extraidos.naturalidade_uf);

  // RG / CIN / CNH
  if (t === "rg" || t === "cin" || t === "identidade") {
    set("rg", extraidos.numero_documento ?? extraidos.rg);
    set("emissor_rg", extraidos.orgao_emissor ?? extraidos.emissor_rg);
    set("expedicao_rg", extraidos.data_emissao ?? extraidos.data_expedicao_rg);
    set("tipo_documento_identidade", t === "cin" ? "CIN" : "RG");
  }

  // Comprovante de residência
  if (t === "comprovante_residencia" || t === "comprovante_endereco" || t === "endereco") {
    set("cep", extraidos.cep);
    // endereco_completo: "RUA X 35 BAIRRO / CIDADE - UF"
    if (typeof extraidos.endereco_completo === "string") {
      const full = extraidos.endereco_completo;
      const partsUf = full.match(/-\s*([A-Z]{2})\s*$/);
      if (partsUf) set("estado", partsUf[1]);
      const partsCidade = full.match(/\/\s*([^-\/]+?)\s*(-|$)/);
      if (partsCidade) set("cidade", partsCidade[1].trim());
    }
    set("endereco", extraidos.endereco ?? extraidos.logradouro);
    set("numero", extraidos.numero);
    set("complemento", extraidos.complemento);
    set("bairro", extraidos.bairro);
  }

  // Celular eventualmente
  set("celular", extraidos.celular ?? extraidos.telefone);

  return out;
}

function normalizar(col: string, valor: string): string | null {
  let v = valor.trim();
  if (!v) return null;
  if (col === "estado" || col === "naturalidade_uf" || col === "uf_emissor_rg") {
    v = v.toUpperCase().slice(0, 2);
    return /^[A-Z]{2}$/.test(v) ? v : null;
  }
  if (col === "cep") {
    v = v.replace(/\D/g, "").slice(0, 8);
    return v.length === 8 ? v : null;
  }
  if (col === "celular") {
    v = v.replace(/\D/g, "").slice(0, 13);
    return v.length >= 10 ? v : null;
  }
  if (col === "data_nascimento" || col === "expedicao_rg") {
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    return null;
  }
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = auth.slice(7).trim();

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !u?.user?.id) return json({ error: "invalid_token" }, 401);
    const userId = u.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Resolve cliente
    let cliente: any = null;
    const { data: direto } = await admin
      .from("qa_clientes")
      .select("id, user_id, campo_origens, excluido")
      .eq("user_id", userId)
      .maybeSingle();
    if (direto) cliente = direto;
    if (!cliente) {
      const { data: link } = await admin
        .from("cliente_auth_links")
        .select("qa_cliente_id")
        .eq("user_id", userId)
        .limit(2);
      if ((link || []).length === 1) {
        const { data: vinc } = await admin
          .from("qa_clientes")
          .select("id, user_id, campo_origens, excluido")
          .eq("id", (link as any[])[0].qa_cliente_id)
          .maybeSingle();
        cliente = vinc;
      }
    }
    if (!cliente) return json({ error: "cliente_nao_vinculado" }, 404);
    if (cliente.excluido) return json({ error: "cliente_excluido" }, 403);

    // Busca documentos do cliente ainda não consumidos para prefill
    const { data: docs, error: docsErr } = await admin
      .from("qa_documentos_cliente")
      .select("id, tipo_documento, ia_dados_extraidos, created_at")
      .eq("qa_cliente_id", cliente.id)
      .is("prefill_consumed_at", null)
      .not("ia_dados_extraidos", "is", null)
      .order("created_at", { ascending: true })
      .limit(50);
    if (docsErr) return json({ error: docsErr.message }, 500);

    const relevantes = (docs || []).filter((d: any) =>
      TIPOS_RELEVANTES.has(String(d.tipo_documento || "").toLowerCase()),
    );

    if (relevantes.length === 0) {
      return json({ success: true, applied: {}, skipped: [], docs_processed: 0 });
    }

    // Carrega cliente atual para conhecer valores e origens
    const { data: clienteAtual } = await admin
      .from("qa_clientes")
      .select("*")
      .eq("id", cliente.id)
      .maybeSingle();
    const origens = (clienteAtual?.campo_origens || {}) as Record<string, { source: Origem; doc_id?: string; at?: string }>;

    // Consolida: docs mais recentes prevalecem sobre antigos.
    const consolidado: Record<string, { value: string; doc_id: string }> = {};
    for (const d of relevantes) {
      const extraidos = (d as any).ia_dados_extraidos?.camposExtraidos;
      if (!extraidos || typeof extraidos !== "object") continue;
      const mapped = mapearCampos((d as any).tipo_documento, extraidos);
      for (const [k, v] of Object.entries(mapped)) {
        consolidado[k] = { value: v, doc_id: (d as any).id };
      }
    }

    const applied: Record<string, string> = {};
    const skippedLocked: string[] = [];
    const updates: Record<string, string | null> = {};
    const novaOrigens = { ...origens };
    const agora = new Date().toISOString();

    for (const [col, info] of Object.entries(consolidado)) {
      const origem = origens[col]?.source;
      if (origem === "manual_override_ai") {
        skippedLocked.push(col);
        continue;
      }
      const normalizado = normalizar(col, info.value);
      if (!normalizado) continue;
      // Não regrava se valor é idêntico ao que já está no cliente.
      const atual = clienteAtual?.[col];
      if (atual != null && String(atual) === String(normalizado)) {
        novaOrigens[col] = { source: "ai", doc_id: info.doc_id, at: agora };
        continue;
      }
      updates[col] = normalizado;
      applied[col] = normalizado;
      novaOrigens[col] = { source: "ai", doc_id: info.doc_id, at: agora };
    }

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await admin
        .from("qa_clientes")
        .update({ ...updates, campo_origens: novaOrigens, updated_at: agora })
        .eq("id", cliente.id);
      if (upErr) return json({ error: upErr.message }, 500);
    } else {
      // Mesmo sem updates, persiste novaOrigens (marcações ai sobre valores idênticos).
      await admin
        .from("qa_clientes")
        .update({ campo_origens: novaOrigens })
        .eq("id", cliente.id);
    }

    // Marca docs como consumidos.
    const docIds = relevantes.map((d: any) => d.id);
    if (docIds.length > 0) {
      await admin
        .from("qa_documentos_cliente")
        .update({ prefill_consumed_at: agora })
        .in("id", docIds);
    }

    return json({
      success: true,
      applied,
      skipped_locked: skippedLocked,
      docs_processed: relevantes.length,
    });
  } catch (e: any) {
    console.error("[qa-cliente-auto-prefill]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
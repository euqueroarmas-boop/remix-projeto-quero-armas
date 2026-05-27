// ============================================================================
// qa-processo-alteracao-nome-iniciar
// ----------------------------------------------------------------------------
// Cliente declara que teve o nome alterado em cartório e quer comprovar com
// certidão averbada. Esta função:
//   1. Verifica se já existe `certidao_alteracao_nome` no processo (idempotente).
//   2. Se NÃO existe, verifica se o MESMO cliente tem certidão averbada já
//      aprovada em outro processo — neste caso, reaproveita o registro:
//      copia respostas_questionario_json.alteracao_nome para o processo atual
//      e cria a pendência já como `aprovado` (sem exigir reenvio).
//   3. Se nada existe, cria a pendência `pendente` para o cliente anexar
//      a certidão no Assistente.
// Registro auditável em qa_processo_eventos. NÃO altera RLS. NÃO sobrescreve
// qa_clientes.nome_completo — o nome oficial continua sendo o do cadastro.
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
    const processoId = String(body?.processo_id ?? "").trim();
    if (!processoId) return json({ error: "processo_id_required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Valida que o cliente autenticado é o dono do processo.
    const { data: processo, error: pErr } = await admin
      .from("qa_processos")
      .select("id, cliente_id, respostas_questionario_json")
      .eq("id", processoId)
      .maybeSingle();
    if (pErr) return json({ error: pErr.message }, 500);
    if (!processo) return json({ error: "processo_not_found" }, 404);

    const { data: cliente } = await admin
      .from("qa_clientes")
      .select("id, user_id, excluido")
      .eq("id", processo.cliente_id)
      .maybeSingle();
    if (!cliente || cliente.user_id !== authUserId) {
      return json({ error: "forbidden" }, 403);
    }
    if (cliente.excluido) return json({ error: "cliente_excluido" }, 403);

    const TIPO = "certidao_alteracao_nome";
    const NOME = "Certidão averbada de alteração de nome";

    // 1) Já existe pendência neste processo? → idempotente.
    const { data: existente } = await admin
      .from("qa_processo_documentos")
      .select("id, status")
      .eq("processo_id", processoId)
      .eq("tipo_documento", TIPO)
      .maybeSingle();
    if (existente?.id) {
      return json({
        success: true,
        document_id: existente.id,
        status: existente.status,
        reaproveitado: false,
        ja_existia: true,
      });
    }

    // 2) Existe certidão averbada já APROVADA em outro processo do MESMO cliente?
    //    Se sim, reaproveita: copia respostas_questionario_json.alteracao_nome
    //    e cria a pendência já aprovada com referência ao documento original.
    const { data: aprovadasOutros } = await admin
      .from("qa_processo_documentos")
      .select("id, processo_id, dados_extraidos_json, arquivo_storage_key, data_validacao")
      .eq("cliente_id", processo.cliente_id)
      .eq("tipo_documento", TIPO)
      .eq("status", "aprovado")
      .neq("processo_id", processoId)
      .order("data_validacao", { ascending: false })
      .limit(1);

    const reaproveitar = (aprovadasOutros ?? [])[0] ?? null;

    const baseRow: Record<string, unknown> = {
      processo_id: processoId,
      cliente_id: processo.cliente_id,
      tipo_documento: TIPO,
      nome_documento: NOME,
      etapa: "complementar",
      obrigatorio: true,
      formato_aceito: ["pdf", "jpg", "jpeg", "png"],
      regra_validacao: {
        descricao:
          "Certidão de casamento ou nascimento AVERBADA, ou outro documento oficial com averbação de alteração de nome em cartório.",
        exige: ["nome_anterior", "nome_atual"],
      },
      instrucoes:
        "Envie a certidão averbada (casamento ou nascimento) que comprova a alteração do seu nome. Aceitamos também outros documentos oficiais com averbação de alteração de nome.",
    };

    if (reaproveitar) {
      // Cria a pendência já como APROVADO referenciando o documento original.
      const { data: ins, error: insErr } = await admin
        .from("qa_processo_documentos")
        .insert({
          ...baseRow,
          status: "aprovado",
          arquivo_storage_key: reaproveitar.arquivo_storage_key ?? null,
          dados_extraidos_json: reaproveitar.dados_extraidos_json ?? null,
          data_validacao: new Date().toISOString(),
          observacoes:
            "Reaproveitado de certidão averbada já aprovada em outro processo deste cliente.",
          decisao_ia: "aprovado_auto",
        })
        .select("id")
        .maybeSingle();
      if (insErr) return json({ error: insErr.message }, 500);

      // Espelha o registro de alteração no processo atual.
      const dx: Record<string, any> = (reaproveitar.dados_extraidos_json as any) ?? {};
      const respostas =
        (processo.respostas_questionario_json as Record<string, any> | null) ?? {};
      respostas.alteracao_nome = {
        aprovada: true,
        nome_anterior: dx.nome_anterior ?? null,
        nome_atual: dx.nome_atual ?? null,
        tipo_documento_comprobatorio: TIPO,
        documento_comprobatorio_id: ins?.id ?? null,
        documento_origem_id: reaproveitar.id,
        processo_origem_id: reaproveitar.processo_id,
        data_validacao: new Date().toISOString(),
        origem: "reaproveitamento",
      };
      await admin
        .from("qa_processos")
        .update({ respostas_questionario_json: respostas })
        .eq("id", processoId);

      await admin.from("qa_processo_eventos").insert({
        processo_id: processoId,
        documento_id: ins?.id ?? null,
        tipo_evento: "alteracao_nome_reaproveitada",
        descricao:
          "Certidão averbada de alteração de nome reaproveitada de outro processo deste cliente.",
        ator: "sistema",
        dados_json: {
          documento_origem_id: reaproveitar.id,
          processo_origem_id: reaproveitar.processo_id,
          nome_anterior: dx.nome_anterior ?? null,
          nome_atual: dx.nome_atual ?? null,
        },
      } as any);

      return json({
        success: true,
        document_id: ins?.id ?? null,
        status: "aprovado",
        reaproveitado: true,
        ja_existia: false,
      });
    }

    // 3) Cria pendência nova.
    const { data: ins, error: insErr } = await admin
      .from("qa_processo_documentos")
      .insert({ ...baseRow, status: "pendente" })
      .select("id")
      .maybeSingle();
    if (insErr) return json({ error: insErr.message }, 500);

    await admin.from("qa_processo_eventos").insert({
      processo_id: processoId,
      documento_id: ins?.id ?? null,
      tipo_evento: "alteracao_nome_pendencia_criada",
      descricao:
        "Cliente declarou alteração de nome em cartório. Pendência criada para envio da certidão averbada.",
      ator: "cliente",
      dados_json: { tipo_documento: TIPO },
    } as any);

    return json({
      success: true,
      document_id: ins?.id ?? null,
      status: "pendente",
      reaproveitado: false,
      ja_existia: false,
    });
  } catch (e: any) {
    console.error("[qa-processo-alteracao-nome-iniciar]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
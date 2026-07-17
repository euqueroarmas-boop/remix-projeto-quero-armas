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

    // Nome oficial atual do cadastro — usado para comparar com identidades no Hub.
    const { data: clienteNome } = await admin
      .from("qa_clientes")
      .select("nome_completo")
      .eq("id", processo.cliente_id)
      .maybeSingle();
    const nomeCadastro = String(clienteNome?.nome_completo ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

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

    const baseRow: Record<string, unknown> = {
      processo_id: processoId,
      cliente_id: processo.cliente_id,
      tipo_documento: TIPO,
      nome_documento: NOME,
      etapa: "complementar",
      obrigatorio: true,
      formato_aceito: ["pdf", "jpg", "jpeg", "png"],
      campos_complementares_json: { incluir_no_dossie: true },
      regra_validacao: {
        descricao:
          "Comprovação de alteração de nome: aceita certidão averbada OU documento oficial de identidade emitido por órgão competente com o nome atualizado.",
        exige: ["nome_atual"],
      },
      instrucoes:
        "Envie sua certidão averbada OU um documento oficial de identidade (CIN, RG, CNH, Passaporte) com o nome já atualizado. Qualquer um comprova a alteração.",
    };

    // 2a) Existe DOCUMENTO OFICIAL DE IDENTIDADE (CIN/RG/CNH/Passaporte/CTPS)
    //     aprovado no Hub cujo nome bate com o cadastro atual? Juridicamente,
    //     um documento de identidade emitido por órgão competente já comprova
    //     a alteração de nome — a certidão averbada não é obrigatória para
    //     este fim. Neste caso, aprovamos a pendência automaticamente.
    const TIPOS_IDENTIDADE = [
      "cin",
      "rg",
      "cnh",
      "passaporte",
      "ctps",
      "identidade_militar",
    ];
    const { data: identidades } = await admin
      .from("qa_documentos_cliente")
      .select("id, tipo_documento, orgao_emissor, data_emissao, ia_dados_extraidos, arquivo_storage_path")
      .eq("qa_cliente_id", processo.cliente_id)
      .eq("status", "aprovado")
      .in("tipo_documento", TIPOS_IDENTIDADE)
      .order("data_emissao", { ascending: false, nullsFirst: false })
      .limit(10);

    const normaliza = (s: string | null | undefined) =>
      String(s ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    const identidadeMatch = (identidades ?? []).find((doc) => {
      const campos = (doc.ia_dados_extraidos as any)?.camposExtraidos ?? {};
      const nomeDoc = normaliza(campos.nome_completo || campos.nome);
      return nomeDoc && nomeCadastro && nomeDoc === nomeCadastro;
    });

    if (identidadeMatch) {
      const campos = (identidadeMatch.ia_dados_extraidos as any)?.camposExtraidos ?? {};
      const { data: ins, error: insErr } = await admin
        .from("qa_processo_documentos")
        .insert({
          ...baseRow,
          status: "aprovado",
          arquivo_storage_key: identidadeMatch.arquivo_storage_path ?? null,
          dados_extraidos_json: {
            nome_atual: campos.nome_completo || campos.nome || clienteNome?.nome_completo,
            tipo_certidao: "documento_identidade_oficial",
            documento_origem_tipo: identidadeMatch.tipo_documento,
            orgao_emissor: identidadeMatch.orgao_emissor ?? null,
            data_emissao: identidadeMatch.data_emissao ?? null,
            justificativa:
              "Documento oficial de identidade emitido por órgão competente comprova a alteração de nome; certidão averbada dispensada.",
          },
          data_validacao: new Date().toISOString(),
          observacoes:
            "Comprovação de alteração de nome feita por documento oficial de identidade (Hub). Certidão averbada dispensada.",
          decisao_ia: "aprovado_auto",
        })
        .select("id")
        .maybeSingle();
      if (insErr) return json({ error: insErr.message }, 500);

      const respostas =
        (processo.respostas_questionario_json as Record<string, any> | null) ?? {};
      respostas.alteracao_nome = {
        aprovada: true,
        nome_anterior: null,
        nome_atual: clienteNome?.nome_completo ?? null,
        tipo_documento_comprobatorio: identidadeMatch.tipo_documento,
        documento_comprobatorio_id: ins?.id ?? null,
        documento_origem_id: identidadeMatch.id,
        data_validacao: new Date().toISOString(),
        origem: "documento_identidade_oficial",
      };
      await admin
        .from("qa_processos")
        .update({ respostas_questionario_json: respostas })
        .eq("id", processoId);

      await admin.from("qa_processo_eventos").insert({
        processo_id: processoId,
        documento_id: ins?.id ?? null,
        tipo_evento: "alteracao_nome_dispensada_por_identidade",
        descricao:
          "Alteração de nome comprovada por documento oficial de identidade aprovado no Hub. Certidão averbada dispensada.",
        ator: "sistema",
        dados_json: {
          documento_origem_id: identidadeMatch.id,
          tipo_documento: identidadeMatch.tipo_documento,
          orgao_emissor: identidadeMatch.orgao_emissor ?? null,
        },
      } as any);

      return json({
        success: true,
        document_id: ins?.id ?? null,
        status: "aprovado",
        reaproveitado: true,
        ja_existia: false,
        origem: "documento_identidade_oficial",
      });
    }

    // 2b) Existe certidão averbada já APROVADA em outro processo do MESMO cliente?
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
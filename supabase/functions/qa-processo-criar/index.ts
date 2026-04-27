// qa-processo-criar
// Cria um novo processo (qa_processos) vinculando cliente, serviço e venda/item.
// Gera automaticamente o checklist de documentos com base no tipo de serviço.
// Acesso: somente staff Quero Armas autenticado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireQAStaff } from "../_shared/qaAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Mapa de checklist mínimo por servico_id.
 * Cada item: { tipo_documento, etapa, obrigatorio, ordem, nome_documento }.
 * Os links/exemplos virão das tabelas qa_document_external_links e qa_document_examples
 * (resolvidos posteriormente pelo frontend).
 */
const CHECKLISTS: Record<number, Array<{
  tipo_documento: string;
  nome_documento: string;
  etapa: string;
  obrigatorio: boolean;
  ordem: number;
}>> = {
  // Posse PF (id 2)
  2: [
    { tipo_documento: "cnh_rg", nome_documento: "RG ou CNH", etapa: "cadastro", obrigatorio: true, ordem: 1 },
    { tipo_documento: "cpf", nome_documento: "CPF", etapa: "cadastro", obrigatorio: true, ordem: 2 },
    { tipo_documento: "comprovante_residencia", nome_documento: "Comprovante de residência (até 90 dias)", etapa: "cadastro", obrigatorio: true, ordem: 3 },
    { tipo_documento: "comprovante_renda", nome_documento: "Comprovante de renda / ocupação lícita", etapa: "documentos", obrigatorio: true, ordem: 4 },
    { tipo_documento: "certidao_civel", nome_documento: "Certidão Cível Federal", etapa: "certidoes", obrigatorio: true, ordem: 5 },
    { tipo_documento: "certidao_criminal_federal", nome_documento: "Certidão Criminal Federal", etapa: "certidoes", obrigatorio: true, ordem: 6 },
    { tipo_documento: "certidao_criminal_estadual", nome_documento: "Certidão Criminal Estadual", etapa: "certidoes", obrigatorio: true, ordem: 7 },
    { tipo_documento: "certidao_militar", nome_documento: "Certidão da Justiça Militar", etapa: "certidoes", obrigatorio: true, ordem: 8 },
    { tipo_documento: "certidao_eleitoral", nome_documento: "Certidão da Justiça Eleitoral", etapa: "certidoes", obrigatorio: true, ordem: 9 },
    { tipo_documento: "laudo_psicologico", nome_documento: "Laudo Psicológico (psicólogo credenciado PF)", etapa: "exames", obrigatorio: true, ordem: 10 },
    { tipo_documento: "laudo_capacidade_tecnica", nome_documento: "Atestado de Capacidade Técnica (instrutor credenciado)", etapa: "exames", obrigatorio: true, ordem: 11 },
  ],
  // Porte PF (id 3)
  3: [
    { tipo_documento: "cnh_rg", nome_documento: "RG ou CNH", etapa: "cadastro", obrigatorio: true, ordem: 1 },
    { tipo_documento: "cpf", nome_documento: "CPF", etapa: "cadastro", obrigatorio: true, ordem: 2 },
    { tipo_documento: "comprovante_residencia", nome_documento: "Comprovante de residência (até 90 dias)", etapa: "cadastro", obrigatorio: true, ordem: 3 },
    { tipo_documento: "justificativa_porte", nome_documento: "Justificativa fundamentada de efetiva necessidade", etapa: "documentos", obrigatorio: true, ordem: 4 },
    { tipo_documento: "certidao_civel", nome_documento: "Certidão Cível Federal", etapa: "certidoes", obrigatorio: true, ordem: 5 },
    { tipo_documento: "certidao_criminal_federal", nome_documento: "Certidão Criminal Federal", etapa: "certidoes", obrigatorio: true, ordem: 6 },
    { tipo_documento: "certidao_criminal_estadual", nome_documento: "Certidão Criminal Estadual", etapa: "certidoes", obrigatorio: true, ordem: 7 },
    { tipo_documento: "certidao_militar", nome_documento: "Certidão da Justiça Militar", etapa: "certidoes", obrigatorio: true, ordem: 8 },
    { tipo_documento: "certidao_eleitoral", nome_documento: "Certidão da Justiça Eleitoral", etapa: "certidoes", obrigatorio: true, ordem: 9 },
    { tipo_documento: "laudo_psicologico", nome_documento: "Laudo Psicológico", etapa: "exames", obrigatorio: true, ordem: 10 },
    { tipo_documento: "laudo_capacidade_tecnica", nome_documento: "Atestado de Capacidade Técnica", etapa: "exames", obrigatorio: true, ordem: 11 },
  ],
  // CRAF/SIGMA (id 26)
  26: [
    { tipo_documento: "cnh_rg", nome_documento: "RG ou CNH", etapa: "cadastro", obrigatorio: true, ordem: 1 },
    { tipo_documento: "cr_cac", nome_documento: "Certificado de Registro CAC vigente", etapa: "documentos", obrigatorio: true, ordem: 2 },
    { tipo_documento: "nota_fiscal_arma", nome_documento: "Nota Fiscal da arma", etapa: "documentos", obrigatorio: true, ordem: 3 },
    { tipo_documento: "guia_trafego", nome_documento: "Guia de Tráfego (se houver)", etapa: "documentos", obrigatorio: false, ordem: 4 },
  ],
};

// Checklist genérico/default (autorização compra/posse defesa pessoal)
const CHECKLIST_DEFAULT = [
  { tipo_documento: "cnh_rg", nome_documento: "RG ou CNH", etapa: "cadastro", obrigatorio: true, ordem: 1 },
  { tipo_documento: "cpf", nome_documento: "CPF", etapa: "cadastro", obrigatorio: true, ordem: 2 },
  { tipo_documento: "comprovante_residencia", nome_documento: "Comprovante de residência (até 90 dias)", etapa: "cadastro", obrigatorio: true, ordem: 3 },
  { tipo_documento: "comprovante_renda", nome_documento: "Comprovante de renda", etapa: "documentos", obrigatorio: true, ordem: 4 },
  { tipo_documento: "certidoes_negativas", nome_documento: "Certidões negativas (Cível, Criminal Fed/Est, Militar, Eleitoral)", etapa: "certidoes", obrigatorio: true, ordem: 5 },
  { tipo_documento: "laudo_psicologico", nome_documento: "Laudo Psicológico", etapa: "exames", obrigatorio: true, ordem: 6 },
  { tipo_documento: "laudo_capacidade_tecnica", nome_documento: "Atestado de Capacidade Técnica", etapa: "exames", obrigatorio: true, ordem: 7 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { cliente_id, servico_id, item_venda_id, venda_id, observacoes } = body || {};

    if (!cliente_id || !servico_id) {
      return json({ error: "cliente_id e servico_id são obrigatórios" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca dados do serviço para snapshot
    const { data: servico } = await supabase
      .from("qa_servicos")
      .select("id, nome")
      .eq("id", servico_id)
      .maybeSingle();

    if (!servico) return json({ error: "Serviço não encontrado" }, 404);

    // Cria processo
    const { data: processo, error: pErr } = await supabase
      .from("qa_processos")
      .insert({
        cliente_id,
        servico_id,
        item_venda_id: item_venda_id ?? null,
        venda_id: venda_id ?? null,
        servico_nome_snapshot: servico.nome,
        status: "aguardando_pagamento",
        observacoes: observacoes ?? null,
        criado_por: guard.userId,
      })
      .select()
      .single();

    if (pErr) return json({ error: pErr.message }, 400);

    // Gera checklist
    const checklist = CHECKLISTS[servico_id] || CHECKLIST_DEFAULT;
    const docsRows = checklist.map((d) => ({
      processo_id: processo.id,
      tipo_documento: d.tipo_documento,
      nome_documento: d.nome_documento,
      etapa: d.etapa,
      obrigatorio: d.obrigatorio,
      ordem: d.ordem,
      status: "pendente",
    }));

    const { error: dErr } = await supabase
      .from("qa_processo_documentos")
      .insert(docsRows);

    if (dErr) {
      console.error("Erro ao criar checklist:", dErr.message);
      // Rollback do processo? Mantemos com erro registrado em eventos.
      await supabase.from("qa_processo_eventos").insert({
        processo_id: processo.id,
        tipo_evento: "erro_checklist",
        descricao: "Falha ao gerar checklist: " + dErr.message,
        ator: "sistema",
      });
    }

    return json({
      success: true,
      processo,
      total_documentos: docsRows.length,
    });
  } catch (err: any) {
    console.error("qa-processo-criar:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});
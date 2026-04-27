// qa-processo-criar
// Cria processo + checklist GRANULAR (1 documento = 1 item).
// Cada item carrega: tipo_documento, validade_dias, formato_aceito, regra_validacao,
// link_emissao (botão amigável), etapa, obrigatorio, status independente.
//
// Regras de validade (definidas pelo cliente/produto):
//  - Documentos de identificação (RG, CPF, CNH): SEM validade  -> validade_dias = NULL
//  - Demais documentos: 30 dias
//  - Certidões: cada uma com seu prazo próprio (definido por item)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireQAStaff } from "../_shared/qaAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ChecklistItem = {
  tipo_documento: string;
  nome_documento: string;
  etapa: "base" | "complementar" | "tecnico" | "final";
  obrigatorio: boolean;
  validade_dias: number | null;
  formato_aceito: string[];
  regra_validacao: Record<string, unknown>;
  link_emissao: string | null;
};

// Itens reutilizáveis ----------------------------------------------------------
const ID_RG: ChecklistItem = {
  tipo_documento: "rg",
  nome_documento: "RG (Carteira de Identidade)",
  etapa: "base",
  obrigatorio: true,
  validade_dias: null,
  formato_aceito: ["pdf", "jpg", "jpeg", "png"],
  regra_validacao: { exige: ["nome_completo", "rg", "data_nascimento", "orgao_emissor"] },
  link_emissao: null,
};
const ID_CNH: ChecklistItem = {
  tipo_documento: "cnh",
  nome_documento: "CNH (Carteira Nacional de Habilitação)",
  etapa: "base",
  obrigatorio: false,
  validade_dias: null, // a CNH carrega sua própria validade impressa
  formato_aceito: ["pdf", "jpg", "jpeg", "png"],
  regra_validacao: { exige: ["nome_completo", "cpf", "data_nascimento", "validade"] },
  link_emissao: null,
};
const ID_CPF: ChecklistItem = {
  tipo_documento: "cpf",
  nome_documento: "Comprovante de CPF",
  etapa: "base",
  obrigatorio: true,
  validade_dias: null,
  formato_aceito: ["pdf", "jpg", "jpeg", "png"],
  regra_validacao: { exige: ["nome_completo", "cpf"] },
  link_emissao: "https://servicos.receita.fazenda.gov.br/Servicos/CPF/ImpressaoComprovante/ConsultaImpressao.asp",
};
const COMPROV_RES: ChecklistItem = {
  tipo_documento: "comprovante_residencia",
  nome_documento: "Comprovante de residência (até 30 dias)",
  etapa: "base",
  obrigatorio: true,
  validade_dias: 30,
  formato_aceito: ["pdf", "jpg", "jpeg", "png"],
  regra_validacao: { exige: ["nome_titular", "endereco_completo", "data_emissao"] },
  link_emissao: null,
};
const COMPROV_RENDA: ChecklistItem = {
  tipo_documento: "comprovante_renda",
  nome_documento: "Comprovante de renda / ocupação lícita",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 30,
  formato_aceito: ["pdf", "jpg", "jpeg", "png"],
  regra_validacao: { exige: ["nome_titular", "ocupacao"] },
  link_emissao: null,
};

// CERTIDÕES — cada uma com prazo próprio
const CERT_CIVEL: ChecklistItem = {
  tipo_documento: "certidao_civel",
  nome_documento: "Certidão Cível Federal (Justiça Federal)",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 90,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["nome_titular", "cpf", "resultado", "data_emissao"], esperado: { resultado: "NADA_CONSTA" } },
  link_emissao: "https://www2.trf2.jus.br/certidao/jfrj/index.php",
};
const CERT_CRIM_FED: ChecklistItem = {
  tipo_documento: "certidao_criminal_federal",
  nome_documento: "Certidão Criminal Federal",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 90,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["nome_titular", "cpf", "resultado", "data_emissao"], esperado: { resultado: "NADA_CONSTA" } },
  link_emissao: "https://sistemas.trf3.jus.br/certidao/certidaonegativa",
};
const CERT_CRIM_EST: ChecklistItem = {
  tipo_documento: "certidao_criminal_estadual",
  nome_documento: "Certidão Criminal Estadual (do estado de residência)",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 60,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["nome_titular", "cpf", "uf", "resultado", "data_emissao"], esperado: { resultado: "NADA_CONSTA" } },
  link_emissao: "https://www.tjmg.jus.br/portal-tjmg/servicos/certidoes-judiciais.htm",
};
const CERT_MILITAR: ChecklistItem = {
  tipo_documento: "certidao_militar",
  nome_documento: "Certidão da Justiça Militar",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 90,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["nome_titular", "cpf", "resultado", "data_emissao"], esperado: { resultado: "NADA_CONSTA" } },
  link_emissao: "https://www.stm.jus.br/servicos-stm/certidao-negativa",
};
const CERT_ELEITORAL: ChecklistItem = {
  tipo_documento: "certidao_eleitoral",
  nome_documento: "Certidão de Quitação Eleitoral",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 90,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["nome_titular", "titulo_eleitor", "resultado", "data_emissao"] },
  link_emissao: "https://www.tse.jus.br/eleitor/certidoes/certidao-de-quitacao-eleitoral",
};

// EXAMES
const LAUDO_PSI: ChecklistItem = {
  tipo_documento: "laudo_psicologico",
  nome_documento: "Laudo Psicológico (psicólogo credenciado PF)",
  etapa: "tecnico",
  obrigatorio: true,
  validade_dias: 365,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["nome_titular", "psicologo_crp", "resultado", "data_emissao"], esperado: { resultado: "APTO" } },
  link_emissao: null,
};
const LAUDO_TEC: ChecklistItem = {
  tipo_documento: "laudo_capacidade_tecnica",
  nome_documento: "Atestado de Capacidade Técnica (instrutor credenciado)",
  etapa: "tecnico",
  obrigatorio: true,
  validade_dias: 365,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["nome_titular", "instrutor_credencial", "resultado", "data_emissao"], esperado: { resultado: "APTO" } },
  link_emissao: null,
};

// ESPECÍFICOS
const JUSTIFICATIVA_PORTE: ChecklistItem = {
  tipo_documento: "justificativa_porte",
  nome_documento: "Justificativa fundamentada de efetiva necessidade",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 30,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["texto"] },
  link_emissao: null,
};
const CR_CAC: ChecklistItem = {
  tipo_documento: "cr_cac",
  nome_documento: "Certificado de Registro CAC vigente",
  etapa: "base",
  obrigatorio: true,
  validade_dias: null,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["numero_cr", "categoria", "validade"] },
  link_emissao: "https://www.gov.br/defesa/pt-br/assuntos/sfpc",
};
const NF_ARMA: ChecklistItem = {
  tipo_documento: "nota_fiscal_arma",
  nome_documento: "Nota Fiscal da arma",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: null,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["comprador_cpf", "modelo", "numero_serie", "data_emissao"] },
  link_emissao: null,
};
const GUIA_TRAFEGO: ChecklistItem = {
  tipo_documento: "guia_trafego",
  nome_documento: "Guia de Tráfego (se houver)",
  etapa: "complementar",
  obrigatorio: false,
  validade_dias: null,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["numero_guia", "validade"] },
  link_emissao: null,
};

// CHECKLISTS por servico_id ---------------------------------------------------
const CHECKLISTS: Record<number, ChecklistItem[]> = {
  // 2 = Posse PF
  2: [ID_RG, ID_CNH, ID_CPF, COMPROV_RES, COMPROV_RENDA,
      CERT_CIVEL, CERT_CRIM_FED, CERT_CRIM_EST, CERT_MILITAR, CERT_ELEITORAL,
      LAUDO_PSI, LAUDO_TEC],
  // 3 = Porte PF
  3: [ID_RG, ID_CNH, ID_CPF, COMPROV_RES, JUSTIFICATIVA_PORTE,
      CERT_CIVEL, CERT_CRIM_FED, CERT_CRIM_EST, CERT_MILITAR, CERT_ELEITORAL,
      LAUDO_PSI, LAUDO_TEC],
  // 26 = CRAF / SIGMA
  26: [ID_RG, CR_CAC, NF_ARMA, GUIA_TRAFEGO],
};

// Default = compra/posse defesa pessoal (granular, sem agregador)
const CHECKLIST_DEFAULT: ChecklistItem[] = [
  ID_RG, ID_CNH, ID_CPF, COMPROV_RES, COMPROV_RENDA,
  CERT_CIVEL, CERT_CRIM_FED, CERT_CRIM_EST, CERT_MILITAR, CERT_ELEITORAL,
  LAUDO_PSI, LAUDO_TEC,
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

    const { data: servico } = await supabase
      .from("qa_servicos")
      .select("id, nome_servico")
      .eq("id", servico_id)
      .maybeSingle();
    if (!servico) return json({ error: "Serviço não encontrado" }, 404);

    const { data: processo, error: pErr } = await supabase
      .from("qa_processos")
      .insert({
        cliente_id,
        servico_id,
        venda_id: venda_id ?? null,
        servico_nome: servico.nome_servico,
        status: "aguardando_pagamento",
        observacoes_admin: observacoes ?? null,
      })
      .select()
      .single();
    if (pErr) return json({ error: pErr.message }, 400);

    const checklist = CHECKLISTS[servico_id] || CHECKLIST_DEFAULT;
    const docsRows = checklist.map((d) => ({
      processo_id: processo.id,
      cliente_id,
      tipo_documento: d.tipo_documento,
      nome_documento: d.nome_documento,
      etapa: d.etapa,
      obrigatorio: d.obrigatorio,
      status: "pendente",
      validade_dias: d.validade_dias,
      formato_aceito: d.formato_aceito,
      regra_validacao: d.regra_validacao,
      link_emissao: d.link_emissao,
    }));

    const { error: dErr } = await supabase.from("qa_processo_documentos").insert(docsRows);
    if (dErr) {
      console.error("Erro ao criar checklist:", dErr.message);
      await supabase.from("qa_processo_eventos").insert({
        processo_id: processo.id,
        tipo_evento: "erro_checklist",
        descricao: "Falha ao gerar checklist: " + dErr.message,
        ator: "sistema",
      });
    }

    // Notificação de criação (não bloqueia)
    try {
      await supabase.functions.invoke("qa-processo-notificar", {
        body: { processo_id: processo.id, evento: "processo_criado" },
      });
    } catch (e) { console.warn("[criar] notificação falhou:", e); }

    return json({ success: true, processo, total_documentos: docsRows.length });
  } catch (err: any) {
    console.error("qa-processo-criar:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});

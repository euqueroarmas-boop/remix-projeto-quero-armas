// qa-processo-criar
// FASE 10:
// - Cria processo SEM checklist por padrão (checklist só após pagamento).
// - Aceita parâmetro opcional criarChecklistAgora=true para fluxo administrativo.
// - Lê checklist da tabela qa_servicos_documentos (fonte única de verdade).
// - SEM fallback silencioso para Posse: serviço desconhecido → erro.

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

type CondicaoProf = "clt" | "autonomo" | "empresario" | "aposentado" | "indefinido";

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

// ============================================================================
// IDENTIFICAÇÃO — alternativas aceitas (pelo menos 1 deve ser aprovada)
// Marcadas como obrigatorio=false individualmente; "grupo_alternativo" agrupa.
// ============================================================================
const ID_RG_CPF: ChecklistItem = {
  tipo_documento: "rg_com_cpf",
  nome_documento: "RG com CPF",
  etapa: "base",
  obrigatorio: false,
  validade_dias: null,
  formato_aceito: ["pdf", "jpg", "jpeg", "png"],
  regra_validacao: {
    grupo_alternativo: "identificacao",
    minimo_grupo: 1,
    exige: ["nome_completo", "rg", "cpf", "data_nascimento", "orgao_emissor"],
    label_botao: "Enviar RG com CPF",
  },
  link_emissao: null,
};
const ID_CNH: ChecklistItem = {
  tipo_documento: "cnh",
  nome_documento: "CNH (Carteira Nacional de Habilitação)",
  etapa: "base",
  obrigatorio: false,
  validade_dias: null, // a CNH carrega validade impressa, validada pela IA
  formato_aceito: ["pdf", "jpg", "jpeg", "png"],
  regra_validacao: {
    grupo_alternativo: "identificacao",
    minimo_grupo: 1,
    exige: ["nome_completo", "cpf", "data_nascimento", "validade"],
    label_botao: "Enviar CNH",
  },
  link_emissao: null,
};
const ID_CTPS: ChecklistItem = {
  tipo_documento: "ctps",
  nome_documento: "Carteira de Trabalho",
  etapa: "base",
  obrigatorio: false,
  validade_dias: null,
  formato_aceito: ["pdf", "jpg", "jpeg", "png"],
  regra_validacao: {
    grupo_alternativo: "identificacao",
    minimo_grupo: 1,
    exige: ["nome_completo", "cpf", "data_nascimento"],
    label_botao: "Enviar Carteira de Trabalho",
  },
  link_emissao: null,
};

// ============================================================================
// RESIDÊNCIA
// ============================================================================
const COMPROV_RES: ChecklistItem = {
  tipo_documento: "comprovante_residencia",
  nome_documento: "Comprovante de residência (até 30 dias)",
  etapa: "base",
  obrigatorio: true,
  validade_dias: 30,
  formato_aceito: ["pdf", "jpg", "jpeg", "png"],
  regra_validacao: {
    exige: ["nome_titular", "endereco_completo", "data_emissao"],
    label_botao: "Enviar Comprovante de Residência",
  },
  link_emissao: null,
};

// ============================================================================
// 8 CERTIDÕES GRANULARES — uma linha por certidão
// ============================================================================
const C_TSE: ChecklistItem = {
  tipo_documento: "certidao_crimes_eleitorais_tse",
  nome_documento: "Certidão Negativa de Crimes Eleitorais (TSE)",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 90,
  formato_aceito: ["pdf"],
  regra_validacao: {
    exige: ["nome_titular", "cpf", "resultado", "data_emissao"],
    esperado: { resultado: "NADA_CONSTA" },
    label_botao: "Emitir Certidão de Crimes Eleitorais",
  },
  link_emissao: "https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/",
};
const C_STM: ChecklistItem = {
  tipo_documento: "certidao_crimes_militares_stm",
  nome_documento: "Certidão Negativa de Crimes Militares (STM)",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 90,
  formato_aceito: ["pdf"],
  regra_validacao: {
    exige: ["nome_titular", "cpf", "resultado", "data_emissao"],
    esperado: { resultado: "NADA_CONSTA" },
    label_botao: "Emitir Certidão de Crimes Militares",
  },
  link_emissao: "https://www.stm.jus.br/servicos-ao-cidadao/atendimentoaocidadao/certidao-negativa?view=default",
};
const C_TRF3_REGIONAL: ChecklistItem = {
  tipo_documento: "certidao_federal_trf3_regional",
  nome_documento: "Certidão Federal TRF3 - Abrangência Regional",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 90,
  formato_aceito: ["pdf"],
  regra_validacao: {
    exige: ["nome_titular", "cpf", "resultado", "data_emissao"],
    esperado: { resultado: "NADA_CONSTA" },
    label_botao: "Emitir Certidão Federal Regional",
  },
  link_emissao: "https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao",
};
const C_TRF3_SJSP: ChecklistItem = {
  tipo_documento: "certidao_federal_trf3_sjsp_jef",
  nome_documento: "Certidão Federal TRF3 - Seção Judiciária e JEF de São Paulo",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 90,
  formato_aceito: ["pdf"],
  regra_validacao: {
    exige: ["nome_titular", "cpf", "resultado", "data_emissao"],
    esperado: { resultado: "NADA_CONSTA" },
    label_botao: "Emitir Certidão Federal da Seção Judiciária de São Paulo",
  },
  link_emissao: "https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao",
};
const C_TJSP_EXEC: ChecklistItem = {
  tipo_documento: "certidao_tjsp_execucoes_criminais",
  nome_documento: "Certidão Estadual TJSP - Execuções Criminais",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 60,
  formato_aceito: ["pdf"],
  regra_validacao: {
    exige: ["nome_titular", "cpf", "resultado", "data_emissao"],
    esperado: { resultado: "NADA_CONSTA" },
    label_botao: "Emitir Certidão de Execuções Criminais",
  },
  link_emissao: "https://esaj.tjsp.jus.br/sco/abrirCadastro.do",
};
const C_TJSP_DIST: ChecklistItem = {
  tipo_documento: "certidao_tjsp_distribuicao_criminal",
  nome_documento: "Certidão Estadual TJSP - Distribuição de Ações Criminais",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 60,
  formato_aceito: ["pdf"],
  regra_validacao: {
    exige: ["nome_titular", "cpf", "resultado", "data_emissao"],
    esperado: { resultado: "NADA_CONSTA" },
    label_botao: "Emitir Certidão de Distribuição Criminal",
  },
  link_emissao: "https://esaj.tjsp.jus.br/sco/abrirCadastro.do",
};
const C_PC_SP: ChecklistItem = {
  tipo_documento: "certidao_antecedentes_policia_civil_sp",
  nome_documento: "Certidão de Antecedentes da Polícia Civil",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 90,
  formato_aceito: ["pdf"],
  regra_validacao: {
    exige: ["nome_titular", "cpf", "resultado", "data_emissao"],
    esperado: { resultado: "NADA_CONSTA" },
    label_botao: "Emitir Certidão de Antecedentes da Polícia Civil",
  },
  link_emissao: "https://servicos.sp.gov.br/fcarta/259d189e-dc87-4308-9812-7abed7494412",
};
const C_TJMSP: ChecklistItem = {
  tipo_documento: "certidao_criminal_tjmsp",
  nome_documento: "Certidão Criminal do TJM-SP",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 90,
  formato_aceito: ["pdf"],
  regra_validacao: {
    exige: ["nome_titular", "cpf", "resultado", "data_emissao"],
    esperado: { resultado: "NADA_CONSTA" },
    label_botao: "Emitir Certidão da Justiça Militar Estadual",
  },
  link_emissao: "https://certidaocriminal.tjmsp.jus.br",
};

const CERTIDOES_8: ChecklistItem[] = [
  C_TSE, C_STM, C_TRF3_REGIONAL, C_TRF3_SJSP, C_TJSP_EXEC, C_TJSP_DIST, C_PC_SP, C_TJMSP,
];

// ============================================================================
// RENDA / OCUPAÇÃO — CONDICIONAL
// ============================================================================
function checklistRenda(condicao: CondicaoProf): ChecklistItem[] {
  const base = (extra: Partial<ChecklistItem> & { tipo_documento: string; nome_documento: string; label_botao: string; }): ChecklistItem => ({
    etapa: "complementar",
    obrigatorio: true,
    validade_dias: 30,
    formato_aceito: ["pdf", "jpg", "jpeg", "png"],
    link_emissao: null,
    ...extra,
    regra_validacao: { exige: ["nome_titular"], label_botao: extra.label_botao, ...(extra.regra_validacao ?? {}) },
  });

  switch (condicao) {
    case "clt":
      return [
        base({ tipo_documento: "renda_holerite_mes_atual", nome_documento: "Holerite mais recente (mês atual)", label_botao: "Enviar Holerite" }),
        base({ tipo_documento: "renda_ctps_digital", nome_documento: "Carteira de Trabalho Digital (PDF gov.br)", label_botao: "Enviar CTPS Digital",
               link_emissao: "https://servicos.mte.gov.br/" }),
        base({ tipo_documento: "renda_extrato_inss", nome_documento: "Extrato completo de contribuições do INSS", label_botao: "Enviar Extrato INSS",
               link_emissao: "https://meu.inss.gov.br/" }),
      ];
    case "autonomo":
      return [
        base({ tipo_documento: "renda_cnpj_autonomo", nome_documento: "Cartão CNPJ (autônomo / MEI)", label_botao: "Enviar Cartão CNPJ",
               link_emissao: "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp" }),
        base({ tipo_documento: "renda_nf_recente", nome_documento: "Nota fiscal recente emitida", label_botao: "Enviar Nota Fiscal" }),
      ];
    case "empresario":
      return [
        base({ tipo_documento: "renda_cartao_cnpj", nome_documento: "Cartão CNPJ da empresa", label_botao: "Enviar Cartão CNPJ",
               link_emissao: "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp" }),
        base({ tipo_documento: "renda_qsa", nome_documento: "QSA (Quadro de Sócios e Administradores)", label_botao: "Enviar QSA" }),
        base({ tipo_documento: "renda_contrato_social", nome_documento: "Contrato Social", label_botao: "Enviar Contrato Social" }),
        base({ tipo_documento: "renda_nf_empresa", nome_documento: "Nota fiscal recente da empresa (se aplicável)", label_botao: "Enviar Nota Fiscal", obrigatorio: false }),
      ];
    case "aposentado":
      return [
        base({ tipo_documento: "renda_comprovante_beneficio", nome_documento: "Comprovante de benefício (aposentadoria)", label_botao: "Enviar Comprovante de Benefício",
               link_emissao: "https://meu.inss.gov.br/" }),
        base({ tipo_documento: "renda_extrato_inss", nome_documento: "Extrato completo de contribuições do INSS (se aplicável)", label_botao: "Enviar Extrato INSS",
               obrigatorio: false, link_emissao: "https://meu.inss.gov.br/" }),
      ];
    default:
      // Indefinido: pede ao cliente declarar a condição no portal antes de subir renda.
      return [
        base({
          tipo_documento: "renda_definir_condicao",
          nome_documento: "Defina sua condição profissional para liberar os comprovantes corretos",
          label_botao: "Informar Condição Profissional",
          obrigatorio: true,
          validade_dias: null,
          regra_validacao: { acao: "selecionar_condicao_profissional", label_botao: "Informar Condição Profissional" },
        }),
      ];
  }
}

// ============================================================================
// EXAMES e específicos
// ============================================================================
const LAUDO_PSI: ChecklistItem = {
  tipo_documento: "laudo_psicologico",
  nome_documento: "Laudo Psicológico (psicólogo credenciado PF)",
  etapa: "tecnico",
  obrigatorio: true,
  validade_dias: 365,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["nome_titular", "psicologo_crp", "resultado", "data_emissao"], esperado: { resultado: "APTO" }, label_botao: "Enviar Laudo Psicológico" },
  link_emissao: null,
};
const LAUDO_TEC: ChecklistItem = {
  tipo_documento: "laudo_capacidade_tecnica",
  nome_documento: "Atestado de Capacidade Técnica (instrutor credenciado)",
  etapa: "tecnico",
  obrigatorio: true,
  validade_dias: 365,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["nome_titular", "instrutor_credencial", "resultado", "data_emissao"], esperado: { resultado: "APTO" }, label_botao: "Enviar Atestado Técnico" },
  link_emissao: null,
};
const JUSTIFICATIVA_PORTE: ChecklistItem = {
  tipo_documento: "justificativa_porte",
  nome_documento: "Justificativa fundamentada de efetiva necessidade",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: 30,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["texto"], label_botao: "Enviar Justificativa" },
  link_emissao: null,
};
const CR_CAC: ChecklistItem = {
  tipo_documento: "cr_cac",
  nome_documento: "Certificado de Registro CAC vigente",
  etapa: "base",
  obrigatorio: true,
  validade_dias: null,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["numero_cr", "categoria", "validade"], label_botao: "Enviar CR" },
  link_emissao: "https://www.gov.br/defesa/pt-br/assuntos/sfpc",
};
const NF_ARMA: ChecklistItem = {
  tipo_documento: "nota_fiscal_arma",
  nome_documento: "Nota Fiscal da arma",
  etapa: "complementar",
  obrigatorio: true,
  validade_dias: null,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["comprador_cpf", "modelo", "numero_serie", "data_emissao"], label_botao: "Enviar Nota Fiscal" },
  link_emissao: null,
};
const GUIA_TRAFEGO: ChecklistItem = {
  tipo_documento: "guia_trafego",
  nome_documento: "Guia de Tráfego (se houver)",
  etapa: "complementar",
  obrigatorio: false,
  validade_dias: null,
  formato_aceito: ["pdf"],
  regra_validacao: { exige: ["numero_guia", "validade"], label_botao: "Enviar Guia de Tráfego" },
  link_emissao: null,
};

// ============================================================================
// MONTADOR DE CHECKLIST
// ============================================================================
function montarChecklist(servico_id: number, condicao: CondicaoProf): ChecklistItem[] {
  const ID_BLOCO = [ID_RG_CPF, ID_CNH, ID_CTPS]; // alternativas
  const RENDA = checklistRenda(condicao);
  switch (servico_id) {
    case 2: // Posse PF
      return [...ID_BLOCO, COMPROV_RES, ...RENDA, ...CERTIDOES_8, LAUDO_PSI, LAUDO_TEC];
    case 3: // Porte PF
      return [...ID_BLOCO, COMPROV_RES, JUSTIFICATIVA_PORTE, ...RENDA, ...CERTIDOES_8, LAUDO_PSI, LAUDO_TEC];
    case 26: // CRAF / SIGMA
      return [...ID_BLOCO, CR_CAC, NF_ARMA, GUIA_TRAFEGO];
    default:
      return [...ID_BLOCO, COMPROV_RES, ...RENDA, ...CERTIDOES_8, LAUDO_PSI, LAUDO_TEC];
  }
}

function inferirCondicao(profissao: string | null): CondicaoProf {
  if (!profissao) return "indefinido";
  const p = profissao.toLowerCase();
  if (/aposent/.test(p)) return "aposentado";
  if (/(empres[áa]r|s[óo]cio|cnpj|empreendedor|diretor|administrador)/.test(p)) return "empresario";
  if (/(aut[ôo]nomo|mei|profissional liberal|freelance|prestador)/.test(p)) return "autonomo";
  if (/(clt|assalariado|empregado|funcion[áa]rio)/.test(p)) return "clt";
  return "indefinido";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { cliente_id, servico_id, venda_id, observacoes, condicao_profissional } = body || {};
    if (!cliente_id || !servico_id) {
      return json({ error: "cliente_id e servico_id são obrigatórios" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: servico } = await supabase
      .from("qa_servicos").select("id, nome_servico").eq("id", servico_id).maybeSingle();
    if (!servico) return json({ error: "Serviço não encontrado" }, 404);

    // Resolver condição profissional: payload > cadastro > indefinido
    let condicao: CondicaoProf = (condicao_profissional as CondicaoProf) || "indefinido";
    if (condicao === "indefinido") {
      const { data: cli } = await supabase
        .from("qa_clientes").select("profissao").eq("id", cliente_id).maybeSingle();
      condicao = inferirCondicao(cli?.profissao ?? null);
    }

    const { data: processo, error: pErr } = await supabase
      .from("qa_processos")
      .insert({
        cliente_id,
        servico_id,
        venda_id: venda_id ?? null,
        servico_nome: servico.nome_servico,
        status: "aguardando_pagamento",
        observacoes_admin: observacoes ?? null,
        condicao_profissional: condicao,
      })
      .select().single();
    if (pErr) return json({ error: pErr.message }, 400);

    const checklist = montarChecklist(servico_id, condicao);
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

    try {
      await supabase.functions.invoke("qa-processo-notificar", {
        body: { processo_id: processo.id, evento: "processo_criado" },
      });
    } catch (e) { console.warn("[criar] notificação falhou:", e); }

    return json({
      success: true,
      processo,
      condicao_profissional: condicao,
      total_documentos: docsRows.length,
      total_certidoes: docsRows.filter((d) => d.tipo_documento.startsWith("certidao_")).length,
    });
  } catch (err: any) {
    console.error("qa-processo-criar:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});

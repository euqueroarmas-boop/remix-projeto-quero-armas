// qa-processo-set-condicao
// Permite ao cliente (ou staff) definir/alterar a condição profissional do PROCESSO.
// - Atualiza qa_processos.condicao_profissional
// - Remove itens antigos de renda (status pendente / dispensado_grupo / em_analise) e o placeholder renda_definir_condicao
// - Insere os itens de renda corretos (CLT / autônomo / empresário / aposentado)
// - Itens de renda já APROVADOS são preservados; não são recriados nem cobrados de novo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Cond = "clt" | "autonomo" | "empresario" | "aposentado" | "funcionario_publico";

type Item = {
  tipo_documento: string;
  nome_documento: string;
  obrigatorio: boolean;
  link_emissao: string | null;
  label_botao: string;
  instrucoes?: string;
  observacoes_cliente?: string;
  orgao_emissor?: string;
  prazo_recomendado_dias?: number;
  checklist_operador?: string[];
};

function rendaPara(c: Cond): Item[] {
  switch (c) {
    case "clt": return [
      {
        tipo_documento: "renda_holerite_mes_atual",
        nome_documento: "Holerite mais recente (mês atual)",
        obrigatorio: true,
        link_emissao: null,
        label_botao: "Enviar Holerite",
        instrucoes: "1) Solicite ao RH o holerite do mês atual (ou último mês fechado).\n2) Confirme que o documento mostra: nome completo, CPF, cargo, data de emissão e empresa.\n3) Envie em PDF preferencialmente — fotos só se totalmente legíveis.",
        observacoes_cliente: "ATENÇÃO: o holerite deve ser dos últimos 30 dias. Documentos antigos podem ser recusados.",
        prazo_recomendado_dias: 30,
        checklist_operador: [
          "Conferir nome completo e CPF do titular",
          "Conferir CNPJ do empregador",
          "Conferir data de emissão (até 30 dias)",
          "Verificar se o salário/competência está visível",
        ],
      },
      {
        tipo_documento: "renda_ctps_digital",
        nome_documento: "Carteira de Trabalho Digital (PDF gov.br)",
        obrigatorio: true,
        link_emissao: "https://servicos.mte.gov.br/",
        label_botao: "Emitir CTPS Digital",
        instrucoes: "1) Acesse o app/portal CTPS Digital com login gov.br.\n2) Vá em \"Contratos\" e gere o PDF completo do histórico.\n3) Envie o PDF original gerado pelo gov.br (não tire foto da tela).",
        orgao_emissor: "Ministério do Trabalho",
        checklist_operador: [
          "Verificar se é o PDF oficial gov.br (não print)",
          "Conferir nome e CPF",
          "Conferir vínculo ativo mais recente",
        ],
      },
      {
        tipo_documento: "renda_extrato_inss",
        nome_documento: "Extrato completo de contribuições do INSS (CNIS)",
        obrigatorio: true,
        link_emissao: "https://meu.inss.gov.br/",
        label_botao: "Emitir Extrato INSS",
        instrucoes: "1) Acesse Meu INSS com login gov.br.\n2) Menu \"Extrato de Contribuição (CNIS)\" > Baixar PDF.\n3) Envie o PDF completo, sem cortar páginas.",
        orgao_emissor: "INSS",
        checklist_operador: [
          "Verificar se é o CNIS oficial",
          "Conferir CPF e nome completo",
          "Confirmar vínculo ativo recente",
        ],
      },
    ];
    case "autonomo": return [
      {
        tipo_documento: "renda_cnpj_autonomo",
        nome_documento: "Cartão CNPJ (Autônomo / MEI)",
        obrigatorio: true,
        link_emissao: "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp",
        label_botao: "Emitir Cartão CNPJ",
        instrucoes: "1) Acesse o link \"Consulta CNPJ\" da Receita Federal.\n2) Digite seu CNPJ e resolva o captcha.\n3) Clique em \"Consultar\" e depois em \"Imprimir\" — salve como PDF.",
        orgao_emissor: "Receita Federal",
        checklist_operador: [
          "Verificar situação ATIVA",
          "Conferir CPF do titular = sócio único / MEI",
          "Verificar CNAE compatível com a atividade declarada",
        ],
      },
      {
        tipo_documento: "renda_nf_recente",
        nome_documento: "Nota fiscal recente emitida",
        obrigatorio: true,
        link_emissao: null,
        label_botao: "Enviar Nota Fiscal",
        instrucoes: "1) Localize uma NFS-e ou NF-e emitida pelo seu CNPJ nos últimos 30 dias.\n2) Baixe o DANFE/PDF oficial.\n3) Envie a NF (não enviar apenas comprovante de pagamento).",
        observacoes_cliente: "Se você não emite notas, informe ao operador para definir documento alternativo.",
        prazo_recomendado_dias: 30,
        checklist_operador: [
          "Conferir CNPJ emissor = CNPJ do titular",
          "Conferir data (até 30 dias)",
          "Verificar valor compatível com renda declarada",
        ],
      },
    ];
    case "empresario": return [
      {
        tipo_documento: "renda_cartao_cnpj",
        nome_documento: "Cartão CNPJ da empresa",
        obrigatorio: true,
        link_emissao: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp",
        label_botao: "Emitir Cartão CNPJ",
        instrucoes: "1) Acesse o link da Receita Federal (Consulta CNPJ).\n2) Digite o CNPJ da empresa e resolva o captcha.\n3) Clique em \"Consultar\" e baixe/imprima o Cartão CNPJ em PDF.\n4) Na MESMA tela, role até \"QSA – Quadro de Sócios e Administradores\" e baixe também (envie no item ao lado).",
        observacoes_cliente: "ATENÇÃO: o QSA é gerado dentro da MESMA consulta. Não envie apenas o cartão CNPJ.",
        orgao_emissor: "Receita Federal",
        checklist_operador: [
          "Verificar situação cadastral ATIVA",
          "Conferir razão social, CNPJ e endereço",
          "Conferir CNAE principal",
        ],
      },
      {
        tipo_documento: "renda_qsa",
        nome_documento: "QSA (Quadro de Sócios e Administradores)",
        obrigatorio: true,
        link_emissao: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp",
        label_botao: "Emitir QSA",
        instrucoes: "1) Use a MESMA consulta do Cartão CNPJ.\n2) Clique em \"QSA – Quadro de Sócios e Administradores\".\n3) Clique em \"Imprimir\" e salve como PDF.\n4) Envie aqui o PDF do QSA.",
        observacoes_cliente: "O QSA mostra os sócios da empresa. Sem ele, não é possível validar sua condição de sócio.",
        orgao_emissor: "Receita Federal",
        checklist_operador: [
          "Conferir se o titular consta como sócio/administrador",
          "Verificar percentual de participação",
          "Cruzar com o Contrato Social",
        ],
      },
      {
        tipo_documento: "renda_contrato_social",
        nome_documento: "Contrato Social (ou última alteração)",
        obrigatorio: true,
        link_emissao: "https://www.jucesponline.sp.gov.br/",
        label_botao: "Emitir Contrato Social",
        instrucoes: "1) Acesse o portal da Junta Comercial do seu estado (ex.: JUCESP em SP).\n2) Vá em \"Pesquisa de Empresas\".\n3) Busque por nome ou CNPJ e baixe o Contrato Social ou a última alteração consolidada.",
        observacoes_cliente: "Se a empresa for de outro estado, use a Junta Comercial correspondente.",
        orgao_emissor: "Junta Comercial",
        checklist_operador: [
          "Documento completo (todas as páginas)",
          "Conferir dados com o QSA",
          "Verificar última alteração registrada",
        ],
      },
      {
        tipo_documento: "renda_nf_empresa",
        nome_documento: "Nota fiscal recente da empresa",
        obrigatorio: true,
        link_emissao: null,
        label_botao: "Enviar Nota Fiscal",
        instrucoes: "1) Localize uma NF emitida pela empresa nos últimos 30 dias.\n2) Baixe o DANFE/PDF oficial.\n3) Envie aqui.\n\nSe a empresa não emite notas, fale com o operador para definir documento alternativo (ex.: Pró-labore, IRPJ, DAS).",
        observacoes_cliente: "OBRIGATÓRIO. A NF comprova movimentação real da empresa — exigência da PF/EB para CR de empresário/sócio. Se não emite NF, contate o operador para substituição formal.",
        prazo_recomendado_dias: 30,
        checklist_operador: [
          "Conferir data (até 30 dias)",
          "Conferir CNPJ emissor",
          "Validar atividade compatível",
          "Se empresa não emite NF, exigir Pró-labore / IRPJ / DAS substituto",
        ],
      },
    ];
    case "aposentado": return [
      {
        tipo_documento: "renda_comprovante_beneficio",
        nome_documento: "Comprovante de benefício (aposentadoria)",
        obrigatorio: true,
        link_emissao: "https://meu.inss.gov.br/",
        label_botao: "Emitir Comprovante",
        instrucoes: "1) Acesse Meu INSS com login gov.br.\n2) Menu \"Extrato de Pagamento de Benefício\" > baixar PDF do mês atual.\n3) Envie o PDF completo.",
        orgao_emissor: "INSS",
        prazo_recomendado_dias: 30,
        checklist_operador: [
          "Conferir nome e CPF",
          "Conferir número do benefício",
          "Verificar data do extrato",
        ],
      },
      {
        tipo_documento: "renda_extrato_inss",
        nome_documento: "Extrato completo de contribuições do INSS (CNIS — se aplicável)",
        obrigatorio: false,
        link_emissao: "https://meu.inss.gov.br/",
        label_botao: "Emitir CNIS",
        instrucoes: "1) Acesse Meu INSS.\n2) Menu \"Extrato de Contribuição (CNIS)\" > baixar PDF.\n3) Envie o PDF completo.",
        orgao_emissor: "INSS",
        checklist_operador: [
          "Conferir histórico contributivo",
          "Validar identidade (CPF/nome)",
        ],
      },
    ];
    case "funcionario_publico": return [
      {
        tipo_documento: "renda_carteira_funcional",
        nome_documento: "Carteira Funcional / Documento Funcional",
        obrigatorio: true,
        link_emissao: null,
        label_botao: "Enviar Funcional",
        instrucoes: "1) Localize sua carteira funcional ou documento oficial emitido pelo órgão público em que trabalha.\n2) Fotografe frente e verso ou escaneie em PDF.\n3) Envie o arquivo aqui.",
        observacoes_cliente: "A funcional comprova que você é servidor público ATIVO. Sem ela, não é possível validar seu vínculo.",
        checklist_operador: [
          "Conferir órgão emissor",
          "Conferir nome e CPF",
          "Verificar se está dentro da validade (se aplicável)",
          "Confirmar status ATIVO (não aposentado)",
        ],
      },
      {
        tipo_documento: "renda_holerite_funcionario_publico",
        nome_documento: "Holerite recente (servidor público)",
        obrigatorio: true,
        link_emissao: null,
        label_botao: "Enviar Holerite",
        instrucoes: "1) Acesse o portal do servidor do seu órgão (ex.: SIGRH, SIAPE, SEI etc.).\n2) Baixe o contracheque/holerite mais recente (últimos 30 dias).\n3) Envie em PDF preferencialmente.",
        observacoes_cliente: "ATENÇÃO: o holerite deve ter sido emitido nos últimos 30 dias. Documentos antigos serão recusados.",
        prazo_recomendado_dias: 30,
        checklist_operador: [
          "Conferir nome completo e CPF",
          "Conferir órgão pagador",
          "Conferir data do holerite (até 30 dias)",
          "Confirmar vínculo ATIVO",
        ],
      },
    ];
  }
}

const VALID_CONDS: Cond[] = ["clt", "autonomo", "empresario", "aposentado", "funcionario_publico"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = auth.slice(7);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await userClient.auth.getUser(token);
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const userId = u.user.id;

    const supabase = createClient(url, service);

    const body = await req.json();
    const processo_id: string | undefined = body?.processo_id;
    const condicao = String(body?.condicao_profissional || "").toLowerCase() as Cond;
    if (!processo_id || !VALID_CONDS.includes(condicao)) {
      return json({ error: "processo_id e condicao_profissional (clt|autonomo|empresario|aposentado|funcionario_publico) obrigatórios" }, 400);
    }

    const { data: processo } = await supabase
      .from("qa_processos")
      .select("id, cliente_id, condicao_profissional, status")
      .eq("id", processo_id)
      .maybeSingle();
    if (!processo) return json({ error: "Processo não encontrado" }, 404);

    // Permissão: staff QA OU cliente dono
    const { data: staffRow } = await supabase
      .from("qa_usuarios_perfis").select("perfil")
      .eq("user_id", userId).eq("ativo", true).maybeSingle();
    if (!staffRow) {
      const { data: link } = await supabase
        .from("cliente_auth_links").select("qa_cliente_id")
        .eq("user_id", userId).eq("qa_cliente_id", processo.cliente_id).maybeSingle();
      if (!link) return json({ error: "Sem permissão para este processo" }, 403);
    }

    // 1) Atualiza condicao no processo
    await supabase.from("qa_processos")
      .update({ condicao_profissional: condicao })
      .eq("id", processo_id);

    // 2) Remove placeholder renda_definir_condicao (sempre)
    await supabase.from("qa_processo_documentos")
      .delete()
      .eq("processo_id", processo_id)
      .eq("tipo_documento", "renda_definir_condicao");

    // 3) Carrega itens de renda existentes
    const { data: existentes, error: errExist } = await supabase
      .from("qa_processo_documentos")
      .select("id, tipo_documento, status")
      .eq("processo_id", processo_id)
      .like("tipo_documento", "renda_%");
    console.log("[set-condicao] existentes renda_*:", JSON.stringify(existentes), "err:", errExist);

    const aprovados = new Set((existentes ?? []).filter((d: any) => d.status === "aprovado").map((d: any) => d.tipo_documento));
    const aRemover = (existentes ?? []).filter((d: any) =>
      d.tipo_documento !== "renda_definir_condicao" &&
      d.status !== "aprovado"
    ).map((d: any) => d.id);

    let removidosReais = 0;
    if (aRemover.length > 0) {
      const { data: delData, error: delErr, count } = await supabase
        .from("qa_processo_documentos")
        .delete({ count: "exact" })
        .in("id", aRemover)
        .select("id");
      removidosReais = (delData?.length ?? count ?? 0);
      console.log("[set-condicao] DELETE ids=", aRemover, "removidosReais=", removidosReais, "err=", delErr);
    }

    // 4) Recarrega a lista REAL após o delete para evitar duplicatas (anti-corrida)
    const { data: aindaPresentes } = await supabase
      .from("qa_processo_documentos")
      .select("tipo_documento")
      .eq("processo_id", processo_id)
      .like("tipo_documento", "renda_%");
    const presentesSet = new Set((aindaPresentes ?? []).map((d: any) => d.tipo_documento));
    const novos = rendaPara(condicao).filter((it) => !presentesSet.has(it.tipo_documento));
    console.log("[set-condicao] presentes pós-delete:", Array.from(presentesSet), "novos a inserir:", novos.map(n => n.tipo_documento));
    if (novos.length > 0) {
      const rows = novos.map((d) => ({
        processo_id,
        cliente_id: processo.cliente_id,
        tipo_documento: d.tipo_documento,
        nome_documento: d.nome_documento,
        etapa: "complementar",
        obrigatorio: d.obrigatorio,
        status: "pendente",
        validade_dias: d.prazo_recomendado_dias ?? 30,
        formato_aceito: ["pdf", "jpg", "jpeg", "png"],
        regra_validacao: {
          // Documentos de PESSOA JURÍDICA não têm "nome_titular" único —
          // listam SÓCIOS / dados da EMPRESA ou NF emitida pela empresa.
          // Exigimos identificação empresarial ao invés de nome_titular,
          // evitando bloqueio indevido na validação IA.
          exige:
            ["renda_qsa", "renda_contrato_social", "renda_nf_empresa", "renda_cartao_cnpj"].includes(d.tipo_documento)
              ? ["razao_social"]
              : ["nome_titular"],
          label_botao: d.label_botao,
          checklist_operador: d.checklist_operador ?? [],
        },
        link_emissao: d.link_emissao,
        instrucoes: d.instrucoes ?? null,
        observacoes_cliente: d.observacoes_cliente ?? null,
        orgao_emissor: d.orgao_emissor ?? null,
        prazo_recomendado_dias: d.prazo_recomendado_dias ?? null,
      }));
      await supabase.from("qa_processo_documentos").insert(rows);
    }

    // 5) Evento
    await supabase.from("qa_processo_eventos").insert({
      processo_id,
      tipo_evento: "condicao_profissional_definida",
      descricao: `Condição profissional definida: ${condicao.toUpperCase()}.`,
      dados_json: { condicao, removidos_solicitados: aRemover.length, removidos_reais: removidosReais, criados: novos.length, preservados_aprovados: Array.from(aprovados) },
      ator: staffRow ? "staff" : "cliente",
      user_id: userId,
    });

    return json({ success: true, condicao_profissional: condicao, removidos: removidosReais, criados: novos.length });
  } catch (e: any) {
    console.error("qa-processo-set-condicao:", e);
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});

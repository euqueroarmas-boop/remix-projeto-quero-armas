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

type Cond = "clt" | "autonomo" | "empresario" | "aposentado";

type Item = {
  tipo_documento: string;
  nome_documento: string;
  obrigatorio: boolean;
  link_emissao: string | null;
  label_botao: string;
};

function rendaPara(c: Cond): Item[] {
  switch (c) {
    case "clt": return [
      { tipo_documento: "renda_holerite_mes_atual", nome_documento: "Holerite mais recente (mês atual)", obrigatorio: true, link_emissao: null, label_botao: "Enviar Holerite" },
      { tipo_documento: "renda_ctps_digital", nome_documento: "Carteira de Trabalho Digital (PDF gov.br)", obrigatorio: true, link_emissao: "https://servicos.mte.gov.br/", label_botao: "Enviar CTPS Digital" },
      { tipo_documento: "renda_extrato_inss", nome_documento: "Extrato completo de contribuições do INSS", obrigatorio: true, link_emissao: "https://meu.inss.gov.br/", label_botao: "Enviar Extrato INSS" },
    ];
    case "autonomo": return [
      { tipo_documento: "renda_cnpj_autonomo", nome_documento: "Cartão CNPJ (autônomo / MEI)", obrigatorio: true, link_emissao: "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp", label_botao: "Enviar Cartão CNPJ" },
      { tipo_documento: "renda_nf_recente", nome_documento: "Nota fiscal recente emitida", obrigatorio: true, link_emissao: null, label_botao: "Enviar Nota Fiscal" },
    ];
    case "empresario": return [
      { tipo_documento: "renda_cartao_cnpj", nome_documento: "Cartão CNPJ da empresa", obrigatorio: true, link_emissao: "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp", label_botao: "Enviar Cartão CNPJ" },
      { tipo_documento: "renda_qsa", nome_documento: "QSA (Quadro de Sócios e Administradores)", obrigatorio: true, link_emissao: null, label_botao: "Enviar QSA" },
      { tipo_documento: "renda_contrato_social", nome_documento: "Contrato Social", obrigatorio: true, link_emissao: null, label_botao: "Enviar Contrato Social" },
      { tipo_documento: "renda_nf_empresa", nome_documento: "Nota fiscal recente da empresa (se aplicável)", obrigatorio: false, link_emissao: null, label_botao: "Enviar Nota Fiscal" },
    ];
    case "aposentado": return [
      { tipo_documento: "renda_comprovante_beneficio", nome_documento: "Comprovante de benefício (aposentadoria)", obrigatorio: true, link_emissao: "https://meu.inss.gov.br/", label_botao: "Enviar Comprovante de Benefício" },
      { tipo_documento: "renda_extrato_inss", nome_documento: "Extrato completo de contribuições do INSS (se aplicável)", obrigatorio: false, link_emissao: "https://meu.inss.gov.br/", label_botao: "Enviar Extrato INSS" },
    ];
  }
}

const VALID_CONDS: Cond[] = ["clt", "autonomo", "empresario", "aposentado"];

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
      return json({ error: "processo_id e condicao_profissional (clt|autonomo|empresario|aposentado) obrigatórios" }, 400);
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
    const { data: existentes } = await supabase
      .from("qa_processo_documentos")
      .select("id, tipo_documento, status")
      .eq("processo_id", processo_id)
      .like("tipo_documento", "renda_%");

    const aprovados = new Set((existentes ?? []).filter((d: any) => d.status === "aprovado").map((d: any) => d.tipo_documento));
    const aRemover = (existentes ?? []).filter((d: any) =>
      d.tipo_documento !== "renda_definir_condicao" &&
      d.status !== "aprovado"
    ).map((d: any) => d.id);

    if (aRemover.length > 0) {
      await supabase.from("qa_processo_documentos").delete().in("id", aRemover);
    }

    // 4) Insere os itens corretos para a condição (preservando aprovados)
    const novos = rendaPara(condicao).filter((it) => !aprovados.has(it.tipo_documento));
    if (novos.length > 0) {
      const rows = novos.map((d) => ({
        processo_id,
        cliente_id: processo.cliente_id,
        tipo_documento: d.tipo_documento,
        nome_documento: d.nome_documento,
        etapa: "complementar",
        obrigatorio: d.obrigatorio,
        status: "pendente",
        validade_dias: 30,
        formato_aceito: ["pdf", "jpg", "jpeg", "png"],
        regra_validacao: { exige: ["nome_titular"], label_botao: d.label_botao },
        link_emissao: d.link_emissao,
      }));
      await supabase.from("qa_processo_documentos").insert(rows);
    }

    // 5) Evento
    await supabase.from("qa_processo_eventos").insert({
      processo_id,
      tipo_evento: "condicao_profissional_definida",
      descricao: `Condição profissional definida: ${condicao.toUpperCase()}.`,
      dados_json: { condicao, removidos: aRemover.length, criados: novos.length, preservados_aprovados: Array.from(aprovados) },
      ator: staffRow ? "staff" : "cliente",
      user_id: userId,
    });

    return json({ success: true, condicao_profissional: condicao, removidos: aRemover.length, criados: novos.length });
  } catch (e: any) {
    console.error("qa-processo-set-condicao:", e);
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});

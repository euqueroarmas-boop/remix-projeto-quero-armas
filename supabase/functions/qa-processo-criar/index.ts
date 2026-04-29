// qa-processo-criar
// FASE 10:
// - Cria processo SEM checklist por padrão (checklist só após pagamento).
// - Aceita criarChecklistAgora=true para fluxo administrativo gratuito/manual.
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
    const {
      cliente_id,
      servico_id,
      venda_id,
      observacoes,
      condicao_profissional,
      criarChecklistAgora,
    } = body || {};

    if (!cliente_id || !servico_id) {
      return json({ error: "cliente_id e servico_id são obrigatórios" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Serviço deve existir — sem fallback Posse
    const { data: servico } = await supabase
      .from("qa_servicos")
      .select("id, nome_servico")
      .eq("id", servico_id)
      .maybeSingle();
    if (!servico) {
      return json(
        { error: `Serviço ${servico_id} não encontrado. Fallback Posse proibido (Fase 10).` },
        404,
      );
    }

    // Resolver condição profissional: payload > cadastro > indefinido
    let condicao: CondicaoProf = (condicao_profissional as CondicaoProf) || "indefinido";
    if (condicao === "indefinido") {
      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("profissao")
        .eq("id", cliente_id)
        .maybeSingle();
      condicao = inferirCondicao(cli?.profissao ?? null);
    }

    // Cria processo nascendo aguardando pagamento, SEM checklist
    const { data: processo, error: pErr } = await supabase
      .from("qa_processos")
      .insert({
        cliente_id,
        servico_id,
        venda_id: venda_id ?? null,
        servico_nome: servico.nome_servico,
        status: "aguardando_pagamento",
        pagamento_status: "aguardando",
        observacoes_admin: observacoes ?? null,
        condicao_profissional: condicao,
      })
      .select()
      .single();
    if (pErr) return json({ error: pErr.message }, 400);

    // Por padrão NÃO explode checklist (Fase 10).
    // FASE 10.1: criarChecklistAgora só é aceito de perfil 'administrador' da Equipe Operacional,
    // e quando aceito, passa pela RPC central (mesma regra do webhook/confirmação manual).
    let checklistResult: { inseridos: number; ja_existentes: number } | null = null;
    if (criarChecklistAgora === true) {
      if (guard.perfil !== "administrador") {
        console.warn("[criar] criarChecklistAgora ignorado: perfil não-administrador (", guard.perfil, ")");
      } else {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc(
          "qa_confirmar_pagamento_processo",
          { p_processo_id: processo.id, p_origem: "manual_admin" },
        );
        if (rpcErr) {
          console.error("[criar] erro ao confirmar pagamento (admin):", rpcErr.message);
          await supabase.from("qa_processo_eventos").insert({
            processo_id: processo.id,
            tipo_evento: "erro_checklist",
            descricao: "Falha ao gerar checklist (admin): " + rpcErr.message,
            ator: "equipe_operacional",
          });
        } else if (rpcRes && typeof rpcRes === "object") {
          checklistResult = {
            inseridos: Number((rpcRes as any).checklist_inseridos ?? 0),
            ja_existentes: Number((rpcRes as any).checklist_ja_existentes ?? 0),
          };
        }
      }
    }

    try {
      await supabase.functions.invoke("qa-processo-notificar", {
        body: { processo_id: processo.id, evento: "processo_criado" },
      });
    } catch (e) {
      console.warn("[criar] notificação falhou:", e);
    }

    return json({
      success: true,
      processo,
      condicao_profissional: condicao,
      checklist_criado: criarChecklistAgora === true,
      checklist_result: checklistResult,
    });
  } catch (err: any) {
    console.error("qa-processo-criar:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});

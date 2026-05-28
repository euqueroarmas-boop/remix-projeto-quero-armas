// ============================================================================
// qa-processo-etapa-auto-liberar
// ----------------------------------------------------------------------------
// Libera AUTOMATICAMENTE a próxima etapa do checklist quando a etapa atual
// estiver 100% cumprida (todos os documentos obrigatórios em status cumprido,
// zero pendência, zero em análise, e todas as perguntas-pivot respondidas).
//
// Idempotente: se a etapa já está liberada além do necessário, retorna ok sem
// efeito. Pode ser chamado por cliente autenticado (dono do processo via
// cliente_auth_links / qa_clientes.user_id) ou por staff QA ativo.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CUMPRIDO = new Set([
  "aprovado", "validado", "concluido", "concluído",
  "dispensado", "dispensado_grupo", "dispensado_por_reaproveitamento", "nao_aplicavel",
]);
const EM_ANALISE = new Set([
  "em_analise", "enviado", "fila", "processando",
  "revisao_humana", "em_revisao_humana", "pendente_aprovacao", "aguardando_equipe",
]);

function etapaDoTipo(tipo: string | null, etapaRaw: string | null): number {
  const raw = String(etapaRaw ?? "").trim().toLowerCase();
  if (/^[1-5]$/.test(raw)) return Number(raw);
  if (raw === "endereco" || raw === "endereço" || raw === "comprovacao_endereco") return 1;
  if (raw === "renda" || raw === "condicao_profissional" || raw === "condicao") return 2;
  if (raw === "antecedentes" || raw === "criminal") return 3;
  if (raw === "declaracoes" || raw === "declaracao" || raw === "compromissos") return 4;
  if (raw === "tecnico" || raw === "exames" || raw === "laudo" || raw === "psicologico") return 5;
  const t = String(tipo || "").toLowerCase();
  if (t === "renda_definir_condicao" || t.startsWith("renda_")) return 2;
  if (t.startsWith("certidao") || t.includes("antecedentes")) return 3;
  if (t.includes("laudo") || t.includes("psicologic") || t.includes("capacidade_tecnica") || t.includes("tiro") || t.includes("aptidao")) return 5;
  if (
    t === "pergunta_comprovante_em_nome" ||
    t === "pergunta_ainda_reside_imovel" ||
    t === "pergunta_responde_inquerito_criminal" ||
    t === "declaracao_responsavel_imovel" ||
    t === "declaracao_sem_inquerito_processo_criminal"
  ) return 1;
  if (t.includes("endereco") || t.includes("residenc")) return 1;
  if (t.startsWith("declaracao") || t.startsWith("dsa_") || t.includes("compromisso")) return 4;
  return 1;
}

function isPergunta(d: any): boolean {
  const tipoRegra = d?.regra_validacao?.tipo;
  if (tipoRegra === "pergunta") return true;
  return String(d?.tipo_documento || "").toLowerCase().startsWith("pergunta_");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.slice(7).trim();
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "invalid_token" }, 401);
    const authUserId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const processoId = String(body?.processo_id || "").trim();
    if (!processoId) return json({ error: "processo_id_obrigatorio" }, 400);

    const admin = createClient(url, service);

    const { data: processo } = await admin
      .from("qa_processos")
      .select("id, cliente_id, etapa_liberada_ate, respostas_questionario_json, status")
      .eq("id", processoId)
      .maybeSingle();
    if (!processo) return json({ error: "processo_not_found" }, 404);

    // Autorização: staff ativo OU dono do processo (direto ou via auth links).
    const { data: staffRow } = await admin
      .from("qa_usuarios_perfis").select("perfil, ativo")
      .eq("user_id", authUserId).eq("ativo", true).maybeSingle();
    const isStaff = !!staffRow;

    if (!isStaff) {
      const { data: cliente } = await admin
        .from("qa_clientes").select("id, user_id")
        .eq("id", processo.cliente_id).maybeSingle();
      let owns = !!(cliente && (cliente as any).user_id === authUserId);
      if (!owns) {
        const { data: link } = await admin
          .from("cliente_auth_links")
          .select("qa_cliente_id")
          .eq("user_id", authUserId)
          .eq("qa_cliente_id", processo.cliente_id)
          .eq("status", "active")
          .maybeSingle();
        owns = !!link;
      }
      if (!owns) return json({ error: "forbidden" }, 403);
    }

    const etapaAtual = Math.max(1, Math.min(5, (processo as any).etapa_liberada_ate ?? 1));
    if (etapaAtual >= 5) {
      return json({ liberada: false, motivo: "etapa_final", etapa_atual: etapaAtual });
    }

    const { data: docs } = await admin
      .from("qa_processo_documentos")
      .select("id, status, obrigatorio, tipo_documento, etapa, regra_validacao")
      .eq("processo_id", processoId);

    const lista = (docs || []) as any[];
    const respostas = (processo as any).respostas_questionario_json || {};

    const docsEtapa = lista.filter(
      (d) => etapaDoTipo(d.tipo_documento, d.etapa) === etapaAtual && d.obrigatorio !== false,
    );

    if (docsEtapa.length > 0) {
      for (const d of docsEtapa) {
        if (isPergunta(d)) {
          const chave = d?.regra_validacao?.chave;
          const v = chave ? respostas[chave] : undefined;
          if (v === undefined || v === null || v === "") {
            return json({ liberada: false, motivo: "pergunta_pendente", etapa_atual: etapaAtual });
          }
          continue;
        }
        const st = String(d.status || "").toLowerCase();
        if (EM_ANALISE.has(st)) return json({ liberada: false, motivo: "documento_em_analise", etapa_atual: etapaAtual });
        if (!CUMPRIDO.has(st)) return json({ liberada: false, motivo: "documento_pendente", etapa_atual: etapaAtual });
      }
    }

    const proximaEtapa = etapaAtual + 1;

    const { error: upErr } = await admin
      .from("qa_processos")
      .update({ etapa_liberada_ate: proximaEtapa, updated_at: new Date().toISOString() })
      .eq("id", processoId)
      .eq("etapa_liberada_ate", etapaAtual); // guard idempotente
    if (upErr) return json({ error: upErr.message }, 500);

    await admin.from("qa_processo_eventos").insert({
      processo_id: processoId,
      tipo_evento: "etapa_liberada_automaticamente",
      descricao: `ETAPA ${proximaEtapa} LIBERADA AUTOMATICAMENTE (checklist da etapa ${etapaAtual} cumprido)`,
      ator: isStaff ? "sistema_auto" : "sistema_auto_cliente",
      dados_json: { etapa_anterior: etapaAtual, etapa_nova: proximaEtapa, modo: "automatico", origem: body?.origem || null },
    });

    return json({ liberada: true, etapa_anterior: etapaAtual, etapa_nova: proximaEtapa });
  } catch (err: any) {
    console.error("qa-processo-etapa-auto-liberar:", err);
    return json({ error: err?.message || "erro_interno" }, 500);
  }
});
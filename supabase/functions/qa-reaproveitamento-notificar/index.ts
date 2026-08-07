// qa-reaproveitamento-notificar
//
// Cardinalidade documental: UM documento válido na Central de Documentos pode
// atender exigências de VÁRIOS processos. Quando o motor de reaproveitamento
// (trigger `_fn_reaproveitar_apos_hub_aprovado` → `qa_reaproveitar_documentos_hub_processo`)
// preenche uma exigência, ela fica com status `dispensado_por_reaproveitamento`
// — que É cumprimento, não pendência. Só que essa transição nunca passa por
// `aprovado`, então nenhum dos notificadores existentes disparava, e o cliente
// ficava sem saber que o processo andou.
//
// Esta função fecha essa lacuna: varre as exigências reaproveitadas que ainda
// não foram comunicadas, agrupa POR PROCESSO e manda UM único e-mail-resumo
// (em vez de um por certidão), marcando cada linha como notificada para nunca
// repetir.
//
// Entrada: { cliente_id: number, processo_id?: uuid }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTransactional } from "../_shared/sendTransactional.ts";
import { logSistemaBackend } from "../_shared/logSistema.ts";

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

const PORTAL_URL = "https://www.euqueroarmas.com.br/area-do-cliente";

/** Estados que significam "cumprido sem novo upload". */
const STATUS_REAPROVEITADOS = [
  "dispensado_por_reaproveitamento",
  "hub_reaproveitado",
  "reaproveitado",
];

/** Estados que ainda dependem do cliente. */
const STATUS_PENDENTES = ["pendente", "rejeitado", "invalido", "revisao_humana"];

function brDate(iso?: string | null): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  return s.includes("-") ? s.split("-").reverse().join("/") : s;
}

function firstName(nome?: string | null): string {
  return (nome || "Cliente").split(" ")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const traceId = `qa-reap-notif-${crypto.randomUUID()}`;

  try {
    const body = await req.json().catch(() => ({}));
    const clienteId = Number(body?.cliente_id);
    const processoFiltro = String(body?.processo_id || "").trim();
    if (!clienteId || Number.isNaN(clienteId)) {
      return json({ error: "cliente_id é obrigatório", traceId }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = supabase
      .from("qa_processo_documentos")
      .select("id, processo_id, tipo_documento, nome_documento, status, data_validade, metadados_documento_json")
      .eq("cliente_id", clienteId)
      .in("status", STATUS_REAPROVEITADOS)
      .order("data_validacao", { ascending: false })
      .limit(200);
    if (processoFiltro) q = q.eq("processo_id", processoFiltro);

    const { data: docs, error: docsErr } = await q;
    if (docsErr) return json({ error: docsErr.message, traceId }, 500);

    const naoNotificados = (docs ?? []).filter((d) => {
      const meta = (d.metadados_documento_json ?? {}) as Record<string, unknown>;
      return meta.notificado_reaproveitamento !== true;
    });

    if (naoNotificados.length === 0) {
      return json({ ok: true, notificados: 0, reason: "nada_novo", traceId });
    }

    const { data: cli } = await supabase
      .from("qa_clientes")
      .select("nome_completo, email")
      .eq("id", clienteId)
      .maybeSingle();

    if (!cli?.email) {
      return json({ skipped: true, reason: "cliente_sem_email", traceId });
    }

    // Agrupa por processo — um e-mail por processo, nunca um por certidão.
    const porProcesso = new Map<string, typeof naoNotificados>();
    for (const d of naoNotificados) {
      const arr = porProcesso.get(d.processo_id) ?? [];
      arr.push(d);
      porProcesso.set(d.processo_id, arr);
    }

    let enviados = 0;
    const marcados: string[] = [];

    for (const [processoId, itens] of porProcesso) {
      const { data: proc } = await supabase
        .from("qa_processos")
        .select("id, servico_nome")
        .eq("id", processoId)
        .maybeSingle();

      const { count: pendentes } = await supabase
        .from("qa_processo_documentos")
        .select("id", { count: "exact", head: true })
        .eq("processo_id", processoId)
        .in("status", STATUS_PENDENTES);

      const itensEmail = itens.map((d) => {
        const meta = (d.metadados_documento_json ?? {}) as Record<string, unknown>;
        return {
          exigencia: String(d.nome_documento || d.tipo_documento || "Exigência"),
          documento: String(meta.arquivo_nome_origem || "") || undefined,
          validade: brDate(d.data_validade) || undefined,
        };
      });

      const send = await sendTransactional({
        templateName: "documentos-reaproveitados",
        recipientEmail: cli.email,
        idempotencyKey: `qa-reap-${processoId}-${itens.map((i) => i.id).sort().join("-").slice(0, 80)}`,
        templateData: {
          nome: firstName(cli.nome_completo),
          processo: proc?.servico_nome || "Seu processo",
          itens: itensEmail,
          pendentes: pendentes ?? 0,
          portalUrl: PORTAL_URL,
        },
      });

      if (send.ok) enviados += 1;

      // Marca como notificado mesmo se o e-mail falhar por indisponibilidade:
      // a marcação evita rajada de reenvio a cada abertura do portal. Falha de
      // envio fica registrada no log de sistema para reprocesso manual.
      for (const d of itens) {
        const meta = (d.metadados_documento_json ?? {}) as Record<string, unknown>;
        await supabase
          .from("qa_processo_documentos")
          .update({
            metadados_documento_json: {
              ...meta,
              notificado_reaproveitamento: true,
              notificado_reaproveitamento_em: new Date().toISOString(),
              notificado_reaproveitamento_ok: send.ok,
            },
          })
          .eq("id", d.id);
        marcados.push(d.id);
      }

      // Popup/lista do portal — o cliente vê o avanço mesmo sem abrir o e-mail.
      await supabase
        .from("qa_notificacoes_cliente")
        .insert({
          cliente_id: clienteId,
          categoria: "exigencia_cumprida",
          urgencia: "normal",
          titulo:
            itens.length === 1
              ? "Exigência atendida com documento que você já enviou"
              : `${itens.length} exigências atendidas com documentos que você já enviou`,
          mensagem:
            `${itensEmail.map((i) => i.exigencia).join(" · ")}. ` +
            ((pendentes ?? 0) > 0
              ? `Ainda ${pendentes === 1 ? "falta 1 exigência" : `faltam ${pendentes} exigências`} nesta etapa.`
              : "Nada mais pendente da sua parte nesta etapa."),
          link: "/area-do-cliente",
          referencia_tabela: "qa_processo_documentos",
          referencia_id: processoId,
        })
        .then(() => {}, () => {});

      await supabase
        .from("qa_processo_eventos")
        .insert({
          processo_id: processoId,
          tipo_evento: "email_documentos_reaproveitados",
          descricao: `Cliente notificado sobre ${itens.length} exigência(s) atendida(s) por reaproveitamento.`,
          dados_json: { trace_id: traceId, itens: itensEmail, pendentes: pendentes ?? 0, enviado: send.ok },
          ator: "sistema",
        })
        .then(() => {}, () => {});

      await logSistemaBackend({
        tipo: "email",
        status: send.ok ? "success" : "error",
        mensagem: `Reaproveitamento notificado (${itens.length} exigências): ${cli.email}`,
        payload: { trace_id: traceId, processo_id: processoId, error: send.error ?? null },
      }).catch(() => {});
    }

    return json({ ok: true, processos: porProcesso.size, emails: enviados, exigencias: marcados.length, traceId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado", traceId }, 500);
  }
});

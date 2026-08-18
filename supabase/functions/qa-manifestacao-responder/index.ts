// ============================================================================
// qa-manifestacao-responder — a resposta entregue à PF fecha o prazo
// ----------------------------------------------------------------------------
// Achado da TERCEIRA auditoria (18/08/2026).
//
// O motor de prazos tinha UM fechador: `data_recurso_administrativo`. Só que
// responder a uma notificação NÃO é recorrer — e responder é o caminho mais
// comum de todos. A PF pede um documento, o cliente entrega, a equipe protocola
// a resposta dentro do prazo… e nada no sistema registrava esse ato. O contador
// de 10 dias seguia correndo, e o cron mandava "prazo VENCIDO há N dias" para o
// cliente e para a equipe, todo dia, para sempre.
//
// É o mesmo alarme falso que a primeira auditoria encontrou no caso do Edmar,
// no outro ramo: lá o gatilho era o indeferimento e o fechador era o recurso;
// aqui o gatilho é a notificação e não havia fechador nenhum.
//
// ── O QUE ESTA FUNÇÃO FAZ, EM UM ATO ────────────────────────────────────────
//   1. marca a manifestação como respondida (data, protocolo, quem);
//   2. grava `qa_itens_venda.data_resposta_notificacao` — é isso que desliga
//      o alarme;
//   3. devolve o processo de `notificado` para `em_analise_orgao`: a bola está
//      com a PF de novo;
//   4. registra o evento no histórico e avisa o cliente.
//
// ── O QUE ELA NÃO FAZ ───────────────────────────────────────────────────────
// Não fecha prazo de INDEFERIMENTO. De indeferimento só se sai recorrendo
// (`qa-recurso-protocolar`), e marcá-lo como respondido esconderia um prazo que
// ainda corre — erro mais caro que o alarme falso.
//
// Também não exige que todas as exigências estejam cumpridas. Quem decide o que
// entregar à delegacia é a equipe: há caso em que se responde explicando por
// que um documento não existe. A função avisa quantas ficaram pendentes, e a
// equipe decide com o dado na mão.
//
// Entrada (POST, staff): { processo_id, manifestacao_id?, protocolo?, data_resposta? }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";
import { gravarPrazoNoItem } from "../_shared/prazoItemVenda.ts";

const corsHeaders = qaAuthCors;
const PORTAL_URL = "https://www.euqueroarmas.com.br/area-do-cliente";

/**
 * Tipos que NÃO se resolvem respondendo.
 *
 * A lista é do que se recusa, e não do que se aceita, de propósito: os tipos
 * de manifestação crescem com o tempo (parecer, diligência, restituição) e uma
 * lista de permitidos rejeitaria em silêncio o tipo novo, deixando o alarme
 * ligado justamente no caso que ninguém previu. Aqui, tipo desconhecido é
 * respondível — e o único que precisa mesmo ser barrado é a decisão final, de
 * onde só se sai recorrendo.
 */
const NAO_RESPONDIVEIS = new Set(["decisao", "indeferimento", "deferimento"]);

/** Status em que o processo pode estar para uma resposta fazer sentido. */
const STATUS_RESPONDIVEIS = new Set(["notificado", "protocolado", "em_analise_orgao"]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hojeISOBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const processoId = String((body as { processo_id?: string })?.processo_id ?? "").trim();
    const manifestacaoId = String((body as { manifestacao_id?: string })?.manifestacao_id ?? "").trim();
    const protocolo = String((body as { protocolo?: string })?.protocolo ?? "").trim().toUpperCase();
    const dataInformada = String((body as { data_resposta?: string })?.data_resposta ?? "").trim();
    if (!processoId) return json({ error: "processo_id_obrigatorio" }, 400);

    // A data é a da ENTREGA na PF, não a de hoje. Registrar três dias depois
    // não pode empurrar o marco três dias para a frente: a comparação com a
    // data da notificação é o que decide se foi tempestivo.
    const dataResposta = /^\d{4}-\d{2}-\d{2}$/.test(dataInformada) ? dataInformada : hojeISOBRT();

    const { data: processo } = await admin
      .from("qa_processos")
      .select("id, cliente_id, servico_nome, status")
      .eq("id", processoId)
      .maybeSingle();
    if (!processo) return json({ error: "processo_not_found" }, 404);

    const statusAtual = String((processo as { status?: string }).status ?? "");
    if (!STATUS_RESPONDIVEIS.has(statusAtual)) {
      return json(
        { error: "processo_nao_esta_aguardando_resposta", status: statusAtual },
        409,
      );
    }

    // ── A MANIFESTAÇÃO ──────────────────────────────────────────────────
    // Sem id explícito, pega a mais recente ainda não respondida. É o caso
    // normal: a equipe está olhando a notificação que acabou de responder.
    let manifestacao: { id: string; tipo: string; data_documento: string | null } | null = null;
    if (manifestacaoId) {
      const { data } = await admin
        .from("qa_processo_manifestacoes_pf")
        .select("id, tipo, data_documento, processo_id, respondida_em")
        .eq("id", manifestacaoId)
        .maybeSingle();
      if (!data) return json({ error: "manifestacao_not_found" }, 404);
      if (String((data as { processo_id: string }).processo_id) !== processoId) {
        return json({ error: "manifestacao_de_outro_processo" }, 409);
      }
      manifestacao = data as typeof manifestacao;
    } else {
      const { data } = await admin
        .from("qa_processo_manifestacoes_pf")
        .select("id, tipo, data_documento")
        .eq("processo_id", processoId)
        .is("respondida_em", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      manifestacao = (data as typeof manifestacao) ?? null;
    }

    if (manifestacao) {
      const tipo = String(manifestacao.tipo ?? "").toLowerCase();
      // Indeferimento não se responde: recorre-se. Aceitar aqui fecharia um
      // prazo que continua correndo contra o cliente.
      if (NAO_RESPONDIVEIS.has(tipo)) {
        return json(
          { error: "manifestacao_nao_e_respondivel", tipo, dica: "indeferimento se resolve por recurso" },
          409,
        );
      }
    }

    // ── QUANTAS EXIGÊNCIAS AINDA ESTÃO ABERTAS ──────────────────────────
    // Informativo, não trava. A equipe pode responder explicando por que um
    // documento não existe — mas tem que saber o que está deixando para trás.
    let exigenciasAbertas = 0;
    try {
      const { data: pendentes } = await admin
        .from("qa_processo_documentos")
        .select("id, status, regra_validacao")
        .eq("processo_id", processoId)
        .not("status", "in", '("aprovado","entregue_pelo_hub","dispensado_por_reaproveitamento","dispensado_grupo")');
      exigenciasAbertas = (pendentes ?? []).filter((d) => {
        const regra = (d as { regra_validacao?: { origem?: string } }).regra_validacao;
        return regra?.origem === "manifestacao_pf";
      }).length;
    } catch (_) { /* informativo */ }

    const agora = new Date().toISOString();

    if (manifestacao) {
      const { error } = await admin
        .from("qa_processo_manifestacoes_pf")
        .update({
          respondida_em: agora,
          respondida_protocolo: protocolo || null,
          respondida_por: guard.userId,
          updated_at: agora,
        })
        .eq("id", manifestacao.id);
      if (error) return json({ error: error.message }, 500);
    }

    // ── O QUE DESLIGA O ALARME ──────────────────────────────────────────
    const prazo = await gravarPrazoNoItem(admin, {
      processoId,
      coluna: "data_resposta_notificacao",
      data: dataResposta,
    });
    if (prazo.aviso) console.warn("[manifestacao-responder]", prazo.aviso);

    // A bola volta para a PF. Só mexe se estava em `notificado`: processo já
    // em análise não precisa de mudança, e forçar geraria evento à toa.
    if (statusAtual === "notificado") {
      const { error: stErr } = await admin
        .from("qa_processos")
        .update({ status: "em_analise_orgao", updated_at: agora })
        .eq("id", processoId);
      if (stErr) console.warn("[manifestacao-responder] status não mudou", stErr.message);
    }

    await admin.from("qa_processo_eventos").insert({
      processo_id: processoId,
      tipo_evento: "manifestacao_pf_respondida",
      descricao:
        `RESPOSTA ENTREGUE À POLÍCIA FEDERAL${protocolo ? ` — Nº ${protocolo}` : ""}` +
        ` · EM ${dataResposta.split("-").reverse().join("/")}` +
        (exigenciasAbertas > 0 ? ` · ${exigenciasAbertas} EXIGÊNCIA(S) AINDA ABERTA(S)` : ""),
      ator: "equipe_operacional",
      dados_json: {
        manifestacao_id: manifestacao?.id ?? null,
        protocolo: protocolo || null,
        data_resposta: dataResposta,
        prazo_fechado: prazo.ok,
        prazo_aviso: prazo.aviso,
        exigencias_abertas: exigenciasAbertas,
      },
    });

    // ── AVISO AO CLIENTE ────────────────────────────────────────────────
    let emailOk: boolean | null = null;
    try {
      const clienteId = Number((processo as { cliente_id: number }).cliente_id);
      const { data: cliente } = await admin
        .from("qa_clientes").select("nome_completo, email").eq("id", clienteId).maybeSingle();
      const email = (cliente as { email?: string } | null)?.email;
      if (email) {
        const { sendTransactional } = await import("../_shared/sendTransactional.ts");
        const r = await sendTransactional({
          templateName: "manifestacao-respondida",
          recipientEmail: email,
          idempotencyKey: `manifestacao-respondida-${manifestacao?.id ?? processoId}-${dataResposta}`,
          templateData: {
            nome: (cliente as { nome_completo?: string } | null)?.nome_completo ?? "cliente",
            servico: (processo as { servico_nome?: string }).servico_nome ?? "",
            dataResposta: dataResposta.split("-").reverse().join("/"),
            protocolo: protocolo || "",
            portalUrl: PORTAL_URL,
          },
        });
        emailOk = r.ok;
      }
    } catch (e) {
      console.warn("[manifestacao-responder] e-mail ao cliente falhou", e);
      emailOk = false;
    }

    return json({
      ok: true,
      manifestacao_id: manifestacao?.id ?? null,
      data_resposta: dataResposta,
      prazo_fechado: prazo.ok,
      prazo_aviso: prazo.aviso,
      exigencias_abertas: exigenciasAbertas,
      email_cliente_ok: emailOk,
    });
  } catch (e) {
    console.error("[qa-manifestacao-responder]", e);
    return json({ error: e instanceof Error ? e.message : "erro_interno" }, 500);
  }
});

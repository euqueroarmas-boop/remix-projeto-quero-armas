// ============================================================================
// qa-recurso-protocolar — o recurso ganha número, data e fim
// ----------------------------------------------------------------------------
// Achado da auditoria, 18/08/2026: `qa_processo_recursos` tem as colunas
// `numero_protocolo` e `protocolado_em` desde que nasceu, e NENHUM código do
// sistema jamais escreveu nelas. O ciclo do recurso terminava em
// `enviado_equipe`: o cliente aprovava o relato, a equipe protocolava na
// delegacia — e para ele a tela dizia "aprovado" para sempre, sem número, sem
// data, sem nada que ele pudesse conferir no site da PF.
//
// ── O QUE ESTA FUNÇÃO FECHA, ALÉM DO ÓBVIO ──────────────────────────────────
// Ela também grava `qa_itens_venda.data_recurso_administrativo`, que é a coluna
// que FECHA o prazo de 10 dias no motor de alertas. Até aqui esse campo só era
// preenchido quando alguém lembrava de colar uma manifestação com status
// "recurso protocolado" — passo manual, fácil de esquecer numa semana cheia, e
// o preço do esquecimento era o cliente recebendo "prazo VENCIDO" num processo
// em que a equipe já tinha recorrido no prazo.
//
// Agora protocolar o recurso fecha o prazo no mesmo ato.
//
// ── A TRADUÇÃO DE VENDA NO MEIO ─────────────────────────────────────────────
// `qa_processos.venda_id` aponta para `qa_vendas.id` (o id real), enquanto
// `qa_itens_venda.venda_id` aponta para `qa_vendas.id_legado`. Comparar os dois
// direto casa na maioria dos clientes — os que nasceram sem legado, onde os
// números são iguais — e falha em silêncio justo nos vindos do sistema antigo.
//
// Falhar nessa ponte NÃO derruba o protocolo: o número do recurso é o que não
// pode se perder. O prazo vira um aviso para a equipe conferir.
//
// Entrada (POST, staff): { recurso_id, numero_protocolo, data_protocolo? }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";

const corsHeaders = qaAuthCors;
const PORTAL_URL = "https://www.euqueroarmas.com.br/area-do-cliente";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Hoje em BRT, no formato ISO de data. */
function hojeISOBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => ({}));
    const recursoId = String((body as { recurso_id?: string })?.recurso_id ?? "").trim();
    const numero = String((body as { numero_protocolo?: string })?.numero_protocolo ?? "")
      .trim().toUpperCase();
    const dataInformada = String((body as { data_protocolo?: string })?.data_protocolo ?? "").trim();

    if (!recursoId) return json({ error: "recurso_id_obrigatorio" }, 400);
    // Número é obrigatório aqui, e de propósito: é por ele que o cliente
    // acompanha o recurso no site da PF, e sem ele a tela dele volta a não ter
    // o que mostrar — que é exatamente o furo que esta função existe para fechar.
    if (!numero) return json({ error: "numero_protocolo_obrigatorio" }, 400);

    const dataProtocolo = /^\d{4}-\d{2}-\d{2}$/.test(dataInformada) ? dataInformada : hojeISOBRT();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: recurso } = await admin
      .from("qa_processo_recursos")
      .select("id, processo_id, status, numero_protocolo, protocolado_em")
      .eq("id", recursoId)
      .maybeSingle();
    if (!recurso) return json({ error: "recurso_not_found" }, 404);

    const statusAtual = String((recurso as { status: string }).status);
    if (statusAtual === "protocolado") {
      return json({
        ok: true,
        ja_protocolado: true,
        numero_protocolo: (recurso as { numero_protocolo?: string }).numero_protocolo ?? null,
      });
    }
    // O cliente precisa ter aprovado o relato. Protocolar antes disso entrega à
    // delegacia um texto que ele nunca leu — e recurso protocolado com fato
    // errado não se conserta.
    if (!["aprovado", "enviado_equipe"].includes(statusAtual)) {
      return json({ error: "recurso_nao_aprovado_pelo_cliente", status: statusAtual }, 409);
    }

    const processoId = String((recurso as { processo_id: string }).processo_id);
    const agora = new Date().toISOString();

    const { error: upErr } = await admin
      .from("qa_processo_recursos")
      .update({
        status: "protocolado",
        numero_protocolo: numero,
        protocolado_em: agora,
        updated_at: agora,
      })
      .eq("id", recursoId);
    if (upErr) return json({ error: upErr.message }, 500);

    // O processo volta para a análise da PF — é isso que ele é agora.
    await admin
      .from("qa_processos")
      .update({ status: "recurso_administrativo", updated_at: agora })
      .eq("id", processoId);

    // ── PONTE COM O MOTOR DE PRAZOS ────────────────────────────────────
    let prazoFechado = false;
    let prazoAviso: string | null = null;
    try {
      const { data: processo } = await admin
        .from("qa_processos")
        .select("venda_id, servico_id, cliente_id, servico_nome")
        .eq("id", processoId)
        .maybeSingle();
      const vendaId = (processo as { venda_id?: number | null } | null)?.venda_id ?? null;
      const servicoId = (processo as { servico_id?: number | null } | null)?.servico_id ?? null;

      if (!vendaId || !servicoId) {
        prazoAviso = "Processo sem venda/serviço: o prazo não foi lançado.";
      } else {
        const { data: venda } = await admin
          .from("qa_vendas")
          .select("id, id_legado")
          .eq("id", vendaId)
          .maybeSingle();
        const v = venda as { id: number; id_legado?: number | null } | null;
        const fkVenda = v
          ? (typeof v.id_legado === "number" && Number.isFinite(v.id_legado) ? v.id_legado : v.id)
          : null;
        if (!fkVenda) {
          prazoAviso = "Venda do processo não encontrada: o prazo não foi lançado.";
        } else {
          const { data: atualizados, error: prazoErr } = await admin
            .from("qa_itens_venda")
            .update({ data_recurso_administrativo: dataProtocolo })
            .eq("venda_id", fkVenda)
            .eq("servico_id", servicoId)
            .select("id");
          if (prazoErr) {
            prazoAviso = `Prazo não lançado: ${prazoErr.message}`;
          } else if (!atualizados || atualizados.length === 0) {
            prazoAviso = "Nenhum item desta venda corresponde ao serviço: o prazo não foi lançado.";
          } else {
            prazoFechado = true;
          }
        }
      }
    } catch (e) {
      prazoAviso = `Prazo não lançado: ${e instanceof Error ? e.message : "erro"}`;
    }
    if (prazoAviso) console.warn("[recurso-protocolar]", prazoAviso);

    await admin.from("qa_processo_eventos").insert({
      processo_id: processoId,
      tipo_evento: "recurso_protocolado",
      descricao: `RECURSO ADMINISTRATIVO PROTOCOLADO — Nº ${numero}`,
      ator: "equipe_operacional",
      dados_json: {
        recurso_id: recursoId,
        numero_protocolo: numero,
        data_protocolo: dataProtocolo,
        prazo_fechado: prazoFechado,
        prazo_aviso: prazoAviso,
      },
    });

    // ── AVISO AO CLIENTE ───────────────────────────────────────────────
    let emailOk: boolean | null = null;
    try {
      const { data: processo } = await admin
        .from("qa_processos")
        .select("cliente_id, servico_nome")
        .eq("id", processoId)
        .maybeSingle();
      const { data: cliente } = await admin
        .from("qa_clientes")
        .select("nome_completo, email")
        .eq("id", (processo as { cliente_id: number }).cliente_id)
        .maybeSingle();
      const email = (cliente as { email?: string } | null)?.email;
      if (email) {
        const { sendTransactional } = await import("../_shared/sendTransactional.ts");
        const r = await sendTransactional({
          templateName: "recurso-protocolado",
          recipientEmail: email,
          idempotencyKey: `recurso-protocolado-${recursoId}`,
          templateData: {
            nome: (cliente as { nome_completo?: string } | null)?.nome_completo ?? "cliente",
            servico: (processo as { servico_nome?: string } | null)?.servico_nome ?? "",
            numeroProtocolo: numero,
            dataProtocolo: dataProtocolo.split("-").reverse().join("/"),
            portalUrl: PORTAL_URL,
          },
        });
        emailOk = r.ok;
      }
    } catch (e) {
      console.warn("[recurso-protocolar] e-mail ao cliente falhou", e);
      emailOk = false;
    }

    return json({
      ok: true,
      numero_protocolo: numero,
      data_protocolo: dataProtocolo,
      prazo_fechado: prazoFechado,
      prazo_aviso: prazoAviso,
      email_cliente_ok: emailOk,
    });
  } catch (e) {
    console.error("[qa-recurso-protocolar]", e);
    return json({ error: e instanceof Error ? e.message : "erro_interno" }, 500);
  }
});

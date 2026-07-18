// qa-piloto-reprocessar-financeiro
// -----------------------------------------------------------------------------
// Reprocessa (corrige) o "valor financeiro" de uma venda piloto já criada
// quando a composição do valor final está errada ou faltando. Fluxo:
//   1. Só staff (administrador/staff/financeiro).
//   2. Recebe { venda_id, composicao_valor_final, motivo, pagamento? }.
//   3. Recalcula valor_total_pago_cliente = soma(composição).
//   4. Snapshot do "antes" e "depois" em qa_piloto_reprocessamentos.
//   5. UPDATE qa_vendas + evento qa_venda_eventos "piloto_financeiro_reprocessado".
// -----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireQAStaff } from "../_shared/qaAuth.ts";
import { aplicarPolicyNotificacao, extractPolicy } from "../_shared/notificacaoPolicy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIPOS = new Set([
  "servico_qa",
  "gru_taxa_gov",
  "exame_laudo",
  "clube_estande",
  "despesa_operacional",
  "deslocamento_logistica",
  "custo_financeiro_adquirente",
  "taxa_admin_intermediacao",
  "outro",
]);
const NATUREZAS = new Set([
  "receita_propria",
  "repasse_despesa_externa",
  "custo_financeiro",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireQAStaff(req, ["administrador", "staff", "financeiro"]);
  if (!guard.ok) return guard.response;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const vendaId = Number(body?.venda_id);
  const motivo = String(body?.motivo || "").trim();
  // Reprocessamento financeiro é ajuste interno — default é NÃO notificar.
  const notifPolicy = extractPolicy(body, {
    notificar_cliente: false,
    canais: { email: false, whatsapp: false, portal: false },
  });
  if (!notifPolicy.notificar_cliente && !(notifPolicy.motivo_nao_notificar || "").trim()) {
    notifPolicy.motivo_nao_notificar = `AJUSTE FINANCEIRO INTERNO: ${motivo}`;
  }
  const composicao = Array.isArray(body?.composicao_valor_final)
    ? body.composicao_valor_final
    : [];
  if (!Number.isFinite(vendaId) || vendaId <= 0) {
    return json({ error: "venda_id_invalido" }, 400);
  }
  if (motivo.length < 20) {
    return json({ error: "motivo_min_20_chars" }, 400);
  }
  const compSanit = composicao
    .filter(
      (c: any) =>
        c &&
        typeof c === "object" &&
        TIPOS.has(String(c.tipo)) &&
        NATUREZAS.has(String(c.natureza)) &&
        typeof c.descricao === "string" &&
        c.descricao.trim().length > 0 &&
        Number.isFinite(Number(c.valor)) &&
        Number(c.valor) > 0
    )
    .map((c: any) => ({
      tipo: String(c.tipo),
      descricao: String(c.descricao).trim().slice(0, 200),
      valor: Number(Number(c.valor).toFixed(2)),
      natureza: String(c.natureza),
      aparece_no_contrato: !!c.aparece_no_contrato,
      observacao: c.observacao ? String(c.observacao).trim().slice(0, 300) : null,
    }));
  if (compSanit.length === 0) {
    return json({ error: "composicao_vazia_ou_invalida" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: venda, error: errV } = await admin
    .from("qa_vendas")
    .select(
      "id, id_legado, cliente_id, valor_a_pagar, valor_aberto, valor_total_pago_cliente, composicao_valor_final, valor_servicos_catalogo, valor_servicos_aplicado, valor_despesas_extras, valor_custo_financeiro, pagamento_parcelas, pagamento_adquirente, pagamento_valor_parcela, pagamento_valor_total_parcelado, pagamento_diferenca_arredondamento",
    )
    .eq("id", vendaId)
    .maybeSingle();
  if (errV || !venda) return json({ error: "venda_nao_encontrada", detail: errV?.message }, 404);

  const soma = (tipos: string[]) =>
    compSanit.filter((c) => tipos.includes(c.tipo)).reduce((s, c) => s + c.valor, 0);
  const total = compSanit.reduce((s, c) => s + c.valor, 0);
  const servicos = soma(["servico_qa"]);
  const despesas = soma([
    "gru_taxa_gov",
    "exame_laudo",
    "clube_estande",
    "despesa_operacional",
    "deslocamento_logistica",
    "taxa_admin_intermediacao",
    "outro",
  ]);
  const custoFin = soma(["custo_financeiro_adquirente"]);

  const pag = body?.pagamento || {};
  const parcelas = Number(pag?.parcelas);
  const valorParcela = Number(pag?.valor_parcela);
  const adquirente = pag?.adquirente ? String(pag.adquirente).trim().toUpperCase() : null;
  const valorTotalParcelado = Number(pag?.valor_total_parcelado);
  const diferencaArred = Number(pag?.diferenca_arredondamento);

  const depois: any = {
    composicao_valor_final: compSanit,
    valor_total_pago_cliente: Number(total.toFixed(2)),
    valor_servicos_aplicado: Number(servicos.toFixed(2)),
    valor_despesas_extras: Number(despesas.toFixed(2)),
    valor_custo_financeiro: Number(custoFin.toFixed(2)),
    valor_a_pagar: Number(total.toFixed(2)),
    valor_aberto: Number(total.toFixed(2)),
  };
  if (Number.isFinite(parcelas) && parcelas > 0) depois.pagamento_parcelas = parcelas;
  if (adquirente) depois.pagamento_adquirente = adquirente;
  if (Number.isFinite(valorParcela) && valorParcela > 0)
    depois.pagamento_valor_parcela = Number(valorParcela.toFixed(2));
  if (Number.isFinite(valorTotalParcelado) && valorTotalParcelado > 0)
    depois.pagamento_valor_total_parcelado = Number(valorTotalParcelado.toFixed(2));
  if (Number.isFinite(diferencaArred))
    depois.pagamento_diferenca_arredondamento = Number(diferencaArred.toFixed(2));

  const antes = {
    valor_a_pagar: venda.valor_a_pagar,
    valor_aberto: venda.valor_aberto,
    valor_total_pago_cliente: venda.valor_total_pago_cliente,
    composicao_valor_final: venda.composicao_valor_final,
    valor_servicos_catalogo: venda.valor_servicos_catalogo,
    valor_servicos_aplicado: venda.valor_servicos_aplicado,
    valor_despesas_extras: venda.valor_despesas_extras,
    valor_custo_financeiro: venda.valor_custo_financeiro,
    pagamento_parcelas: venda.pagamento_parcelas,
    pagamento_adquirente: venda.pagamento_adquirente,
    pagamento_valor_parcela: venda.pagamento_valor_parcela,
    pagamento_valor_total_parcelado: venda.pagamento_valor_total_parcelado,
    pagamento_diferenca_arredondamento: venda.pagamento_diferenca_arredondamento,
  };

  const { error: errUpd } = await admin.from("qa_vendas").update(depois).eq("id", vendaId);
  if (errUpd) return json({ error: "update_falhou", detail: errUpd.message }, 500);

  await admin.from("qa_piloto_reprocessamentos").insert({
    venda_id: vendaId,
    venda_id_legado: (venda as any).id_legado ?? null,
    motivo,
    antes,
    depois,
    staff_user_id: guard.userId,
    staff_email: guard.email,
  });

  await admin.from("qa_venda_eventos").insert({
    venda_id: vendaId,
    cliente_id: (venda as any).cliente_id,
    tipo_evento: "piloto_financeiro_reprocessado",
    descricao: `Financeiro do piloto reprocessado por ${guard.email || guard.userId}: R$ ${Number(total).toFixed(2)}`,
    ator: `staff:${guard.email || guard.userId}`,
    user_id: guard.userId,
    dados_json: { antes, depois, motivo, tags: ["piloto", "reprocessamento_financeiro"] },
  });

  try {
    await aplicarPolicyNotificacao(notifPolicy, {
      acao: "piloto_financeiro_reprocessado",
      cliente_id: (venda as any).cliente_id ?? null,
      venda_id: vendaId,
      staff_user_id: guard.userId,
      staff_email: guard.email,
      origem: "piloto_real",
      titulo_portal: "Financeiro atualizado",
      mensagem_portal: "Atualizamos a composição financeira do seu serviço. Consulte a área financeira.",
      link_portal: "/area-do-cliente/financeiro",
      payload_resumo: { motivo, valor_total: depois.valor_total_pago_cliente },
    });
  } catch (e) {
    console.warn("[piloto-reprocessar-financeiro] policy falhou:", (e as Error).message);
  }

  return json({
    ok: true,
    venda_id: vendaId,
    valor_total_pago_cliente: depois.valor_total_pago_cliente,
    composicao: compSanit,
    notificacao_policy: notifPolicy,
  });
});
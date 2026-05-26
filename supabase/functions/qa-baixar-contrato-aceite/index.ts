/**
 * qa-baixar-contrato-aceite — PÚBLICA (anon)
 *
 * Permite que o cliente — logado OU deslogado — baixe o contrato
 * eletronicamente aceito após o pagamento confirmado, sem expor a
 * tabela qa_contracts (RLS-locked) ao cliente anônimo.
 *
 * Autorização: pares (venda_id + checkout_token) emitidos por
 * qa-checkout-criar-venda. NÃO exige JWT.
 *
 * NÃO refatora pipeline: apenas LÊ qa_contracts (snapshot já gravado
 * por qa-contract-aceite-registrar na Etapa 04) e monta um documento
 * HTML imprimível (com rodapé probatório). O navegador converte em
 * PDF via diálogo de impressão — mesma estratégia já usada antes,
 * agora servida com service_role.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { constantTimeEqual, sha256Hex } from "../_shared/qaAsaas.ts";
import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function escapeHtml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrintableDocument(args: {
  conteudo_renderizado: string;
  contract_number: string | null;
  aceite_data: string | null;
  aceite_ip: string | null;
  aceite_user_agent: string | null;
  aceite_hash: string | null;
  status: string | null;
  template_codigo: string | null;
  template_versao: number | null;
  servico_slug: string | null;
  venda_id: number;
  cliente_id: number | null;
  valor: number | null;
  pagamento_status: string | null;
}): string {
  const hoje = new Date().toLocaleString("pt-BR");
  const aceiteFmt = args.aceite_data
    ? new Date(args.aceite_data).toLocaleString("pt-BR")
    : "—";
  const valorFmt =
    args.valor != null
      ? `R$ ${Number(args.valor).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "—";
  const rodape =
    `Documento gerado em ${escapeHtml(hoje)}. ` +
    `Aceite eletrônico registrado em ${escapeHtml(aceiteFmt)}, ` +
    `IP ${escapeHtml(args.aceite_ip || "—")}, ` +
    `dispositivo ${escapeHtml(args.aceite_user_agent || "—")}, ` +
    `hash de integridade ${escapeHtml(args.aceite_hash || "—")}. ` +
    `Pedido nº ${escapeHtml(String(args.venda_id))}` +
    (args.cliente_id != null ? ` · Cliente ${escapeHtml(String(args.cliente_id))}` : "") +
    (args.servico_slug ? ` · Serviço ${escapeHtml(args.servico_slug)}` : "") +
    ` · Valor ${escapeHtml(valorFmt)}` +
    ` · Template ${escapeHtml(args.template_codigo || "—")} v${escapeHtml(String(args.template_versao ?? "—"))}` +
    (args.contract_number ? ` · Nº ${escapeHtml(args.contract_number)}` : "") +
    (args.pagamento_status ? ` · Pagamento ${escapeHtml(args.pagamento_status)}` : "") +
    (args.status ? ` · Status contrato ${escapeHtml(args.status)}` : "") +
    `.`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Contrato aceito${args.contract_number ? ` — ${escapeHtml(args.contract_number)}` : ""} — Quero Armas</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#0a0a0a;max-width:780px;margin:32px auto;padding:0 24px;line-height:1.65;font-size:13px;}
  h1{font-size:18px;text-align:center;text-transform:uppercase;letter-spacing:0.04em;}
  h2,h3{font-size:13px;text-transform:uppercase;letter-spacing:0.04em;margin-top:24px;}
  p{margin:10px 0;text-align:justify;} ul,ol{padding-left:22px;} li{margin:6px 0;}
  .qa-rodape-probatorio{margin-top:36px;padding-top:14px;border-top:0.5px solid rgba(0,0,0,0.2);font-size:10.5px;color:#4a4a4a;text-align:left;}
  @media print { body{margin:0;} }
</style></head><body>${args.conteudo_renderizado}
<div class="qa-rodape-probatorio">${rodape}</div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const venda_id = Number(body?.venda_id);
  const checkout_token = String(body?.checkout_token || "");
  if (!Number.isFinite(venda_id) || venda_id <= 0) return json({ error: "venda_id_required" }, 400);
  if (!checkout_token || checkout_token.length < 16 || checkout_token.length > 256) {
    return json({ error: "checkout_token_required" }, 400);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 1) Autorização via checkout_token (mesma regra de qa-checkout-status)
  const { data: venda, error: vErr } = await sb
    .from("qa_vendas")
    .select(
      "id, status, cobranca_status, cobranca_origem, checkout_token_hash, checkout_token_expires_at, valor_a_pagar, valor_cobrado",
    )
    .eq("id", venda_id)
    .maybeSingle();
  if (vErr) {
    await logSistemaBackend({
      tipo: "erro", status: "error",
      mensagem: "qa-baixar-contrato-aceite: falha ao ler qa_vendas",
      payload: { venda_id, detail: vErr.message },
    });
    return json({ error: "db_error" }, 500);
  }
  if (!venda) return json({ error: "venda_not_found" }, 404);
  if ((venda.cobranca_origem || "") !== "checkout_site") {
    return json({ error: "venda_nao_eh_checkout_publico" }, 403);
  }

  const submittedHash = await sha256Hex(checkout_token);
  if (!venda.checkout_token_hash || !constantTimeEqual(submittedHash, venda.checkout_token_hash)) {
    return json({ error: "checkout_token_invalido" }, 401);
  }
  if (!venda.checkout_token_expires_at || new Date(venda.checkout_token_expires_at).getTime() < Date.now()) {
    return json({ error: "checkout_token_expirado" }, 401);
  }

  const statusUpper = String(venda.status || "").toUpperCase().trim();
  const cobStatus = String(venda.cobranca_status || "").toLowerCase();
  const pago = statusUpper === "PAGO" || cobStatus === "confirmada";

  // 2) Carrega snapshot do contrato (mais recente para a venda)
  const { data: contract, error: cErr } = await sb
    .from("qa_contracts")
    .select(
      "id, contract_number, status, conteudo_renderizado, template_codigo, template_versao, servico_slug, valor, cliente_id, aceite_eletronico_data, aceite_ip, aceite_user_agent, aceite_hash, created_at",
    )
    .eq("venda_id", venda_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cErr) {
    await logSistemaBackend({
      tipo: "erro", status: "error",
      mensagem: "qa-baixar-contrato-aceite: falha ao ler qa_contracts",
      payload: { venda_id, detail: cErr.message },
    });
    return json({ error: "db_error" }, 500);
  }

  if (!contract) {
    await logSistemaBackend({
      tipo: "contrato", status: "warning",
      mensagem: "Contrato aceito ainda não disponível para download",
      payload: { venda_id, pago },
    });
    return json({
      error: "contrato_em_processamento",
      processing: true,
      pago,
      message: "Contrato sendo gerado. Tente novamente em instantes.",
    }, 202);
  }

  if (!contract.conteudo_renderizado) {
    await logSistemaBackend({
      tipo: "erro", status: "error",
      mensagem: "qa-baixar-contrato-aceite: snapshot vazio",
      payload: { venda_id, contract_id: contract.id },
    });
    return json({
      error: "snapshot_vazio",
      message: "Contrato ainda não disponível. Tente novamente em instantes.",
    }, 500);
  }

  const valorFinal =
    Number(contract.valor) ||
    Number((venda as any).valor_cobrado) ||
    Number((venda as any).valor_a_pagar) ||
    null;

  const html = buildPrintableDocument({
    conteudo_renderizado: contract.conteudo_renderizado,
    contract_number: contract.contract_number,
    aceite_data: contract.aceite_eletronico_data,
    aceite_ip: contract.aceite_ip,
    aceite_user_agent: contract.aceite_user_agent,
    aceite_hash: contract.aceite_hash,
    status: contract.status,
    template_codigo: contract.template_codigo,
    template_versao: contract.template_versao,
    servico_slug: contract.servico_slug,
    venda_id,
    cliente_id: contract.cliente_id,
    valor: Number.isFinite(valorFinal as any) ? (valorFinal as number) : null,
    pagamento_status: pago ? "confirmado" : (venda.cobranca_status || venda.status || null),
  });

  return json({
    ok: true,
    pago,
    contract: {
      id: contract.id,
      contract_number: contract.contract_number,
      status: contract.status,
      template_codigo: contract.template_codigo,
      template_versao: contract.template_versao,
      aceite_eletronico_data: contract.aceite_eletronico_data,
      aceite_hash: contract.aceite_hash,
      servico_slug: contract.servico_slug,
      valor: Number.isFinite(valorFinal as any) ? valorFinal : null,
      cliente_id: contract.cliente_id,
      venda_id,
    },
    html_doc: html,
    file_name: `contrato-aceito-${contract.contract_number || venda_id}.html`,
  });
});
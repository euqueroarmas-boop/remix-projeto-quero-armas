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

/**
 * Remove jargão técnico ("slug", "Identificador (slug)") do conteúdo do
 * contrato/anexo antes de servir ao cliente. O snapshot (conteudo_renderizado)
 * permanece intacto na base — apenas a apresentação é higienizada.
 */
function sanitizeTechnicalJargon(html: string): string {
  if (!html) return html;
  return html
    // "Identificador (slug): xxx"  ->  "Identificador: xxx"
    .replace(/Identificador\s*\(\s*slug\s*\)\s*:?/gi, "Identificador:")
    // "(slug)" residual em qualquer outro contexto visível
    .replace(/\(\s*slug\s*\)/gi, "")
    // linhas/itens cuja única função era expor o slug
    .replace(/<li[^>]*>\s*slug[^<]*<\/li>/gi, "")
    .replace(/\bslug\s*:\s*[a-z0-9_-]+/gi, "");
}

function fileSafeName(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseName(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      ["da", "de", "do", "das", "dos", "e"].includes(part)
        ? part
        : part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1)
    )
    .join(" ");
}

function shortPersonName(value: string | null | undefined): string {
  const parts = fileSafeName(value).split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return titleCaseName(parts.join(" "));
  return titleCaseName(`${parts[0]} ${parts[parts.length - 1]}`);
}

/** Mesmo padrão usado em qa-serve-contract-pdf: "{numero} - Contrato de
 * Adesao Quero Armas - {Cliente}". É o nome usado tanto no <title> (default
 * do "Salvar como PDF" do navegador) quanto no file_name retornado. */
function contractDownloadBaseName(contractNumber: string | null, vendaId: number, clienteNome: string | null): string {
  const numero = fileSafeName(contractNumber || `Venda${vendaId}`);
  const cliente = shortPersonName(clienteNome || "");
  return cliente
    ? `${numero} - Contrato de Adesao Quero Armas - ${cliente}`
    : `${numero} - Contrato de Adesao Quero Armas`;
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
  cliente_nome: string | null;
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
    ` · Valor ${escapeHtml(valorFmt)}` +
    (args.contract_number ? ` · Nº ${escapeHtml(args.contract_number)}` : "") +
    (args.pagamento_status ? ` · Pagamento ${escapeHtml(args.pagamento_status)}` : "") +
    (args.status ? ` · Status contrato ${escapeHtml(args.status)}` : "") +
    `.`;

  const title = contractDownloadBaseName(args.contract_number, args.venda_id, args.cliente_nome);

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#0a0a0a;max-width:780px;margin:32px auto;padding:0 24px;line-height:1.65;font-size:13px;}
  h1{font-size:18px;text-align:center;text-transform:uppercase;letter-spacing:0.04em;}
  h2,h3{font-size:13px;text-transform:uppercase;letter-spacing:0.04em;margin-top:24px;}
  p{margin:10px 0;text-align:justify;} ul,ol{padding-left:22px;} li{margin:6px 0;}
  .qa-rodape-probatorio{margin-top:36px;padding-top:14px;border-top:0.5px solid rgba(0,0,0,0.2);font-size:10.5px;color:#4a4a4a;text-align:left;}
  @media print { body{margin:0;} }
</style></head><body>${sanitizeTechnicalJargon(args.conteudo_renderizado)}
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

  // Resposta genérica para QUALQUER falha de autorização — nunca revela
  // se o problema foi venda inexistente, token errado, expirado, origem
  // incompatível ou status inválido. Detalhes ficam apenas em logs_sistema.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;
  const denyGeneric = async (motivo: string, extra: Record<string, unknown> = {}) => {
    await logSistemaBackend({
      tipo: "contrato",
      status: "warning",
      mensagem: "qa-baixar-contrato-aceite: acesso negado",
      payload: {
        venda_id: Number.isFinite(venda_id) ? venda_id : null,
        motivo, // nunca contém token
        ip,
        user_agent: userAgent,
        ...extra,
      },
    });
    return json({ error: "acesso_negado" }, 401);
  };

  // Formato: token cripto-aleatório base64url/hex/alfanum, 24–256 chars.
  // Validações puramente sintáticas — não revelam ao cliente.
  if (!Number.isFinite(venda_id) || venda_id <= 0) {
    return denyGeneric("venda_id_invalido");
  }
  if (
    !checkout_token ||
    checkout_token.length < 24 ||
    checkout_token.length > 256 ||
    !/^[A-Za-z0-9_\-]+$/.test(checkout_token)
  ) {
    return denyGeneric("token_formato_invalido");
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
      "id, id_legado, status, cobranca_status, cobranca_origem, checkout_token_hash, checkout_token_expires_at, valor_a_pagar, valor_cobrado",
    )
    .eq("id", venda_id)
    .maybeSingle();
  if (vErr) {
    await logSistemaBackend({
      tipo: "erro", status: "error",
      mensagem: "qa-baixar-contrato-aceite: falha ao ler qa_vendas",
      payload: { venda_id, detail: vErr.message, ip, user_agent: userAgent },
    });
    return json({ error: "db_error" }, 500);
  }
  if (!venda) return denyGeneric("venda_inexistente");
  if ((venda.cobranca_origem || "") !== "checkout_site") {
    return denyGeneric("origem_incompativel");
  }

  // Sempre executa hash + compare em tempo constante, mesmo quando o
  // hash da venda está vazio — evita timing oracle entre "sem token na
  // venda" e "token errado".
  const submittedHash = await sha256Hex(checkout_token);
  const storedHash = venda.checkout_token_hash || "0".repeat(64);
  const hashOk = constantTimeEqual(submittedHash, storedHash) && !!venda.checkout_token_hash;
  if (!hashOk) {
    return denyGeneric("token_nao_confere");
  }
  if (
    !venda.checkout_token_expires_at ||
    new Date(venda.checkout_token_expires_at).getTime() < Date.now()
  ) {
    // Após expirar, exigir login no Arsenal — mensagem amigável mas
    // sem confirmar que o token estava certo.
    await logSistemaBackend({
      tipo: "contrato",
      status: "warning",
      mensagem: "qa-baixar-contrato-aceite: token expirado",
      payload: { venda_id, ip, user_agent: userAgent },
    });
    return json(
      {
        error: "acesso_expirado",
        message:
          "Este link público expirou. Acesse o Arsenal com sua conta para baixar o contrato.",
      },
      401,
    );
  }

  const statusUpper = String(venda.status || "").toUpperCase().trim();
  const cobStatus = String(venda.cobranca_status || "").toLowerCase();
  const pago = statusUpper === "PAGO" || cobStatus === "confirmada";

  // 2) Carrega snapshot do contrato (mais recente para a venda)
  // qa_contracts.venda_id pode referenciar o id NOVO ou o id_legado
  // (schema legado). Buscamos por ambos para não devolver "em processamento"
  // quando o contrato existe sob o id antigo.
  const idLegado = (venda as any).id_legado as number | null;
  const idsLookup = [venda_id, ...(idLegado ? [Number(idLegado)] : [])];
  const { data: contract, error: cErr } = await sb
    .from("qa_contracts")
    .select(
      "id, contract_number, status, conteudo_renderizado, template_codigo, template_versao, servico_slug, valor, cliente_id, aceite_eletronico_data, aceite_ip, aceite_user_agent, aceite_hash, created_at",
    )
    .in("venda_id", idsLookup)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cErr) {
    await logSistemaBackend({
      tipo: "erro", status: "error",
      mensagem: "qa-baixar-contrato-aceite: falha ao ler qa_contracts",
      payload: { venda_id, detail: cErr.message, ip, user_agent: userAgent },
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

  let clienteNome: string | null = null;
  if (contract.cliente_id != null) {
    const { data: clienteRow } = await sb
      .from("qa_clientes")
      .select("nome_completo")
      .eq("id_legado", contract.cliente_id)
      .maybeSingle();
    clienteNome = (clienteRow as any)?.nome_completo || null;
  }

  // Substitui sentinelas de aceite pelo valores reais capturados na assinatura.
  // O snapshot canônico (conteudo_renderizado) usa __QA_ACEITE_*__ para que
  // o hash de integridade não precise incluir dados ainda desconhecidos no momento
  // da geração. Os valores reais são injetados apenas na hora do download.
  const aceiteFmtInline = contract.aceite_eletronico_data
    ? new Date(contract.aceite_eletronico_data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";
  const snapshotComAceite = (contract.conteudo_renderizado || "")
    .replaceAll("__QA_ACEITE_DATA__", escapeHtml(aceiteFmtInline))
    .replaceAll("__QA_ACEITE_IP__", escapeHtml(contract.aceite_ip || "—"))
    .replaceAll("__QA_ACEITE_UA__", escapeHtml(contract.aceite_user_agent || "—"))
    .replaceAll("__QA_ACEITE_HASH__", escapeHtml(contract.aceite_hash || "—"));

  const html = buildPrintableDocument({
    conteudo_renderizado: snapshotComAceite,
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
    cliente_nome: clienteNome,
    valor: Number.isFinite(valorFinal as any) ? (valorFinal as number) : null,
    pagamento_status: pago ? "confirmado" : (venda.cobranca_status || venda.status || null),
  });

  // Registra o evento de download para fins probatórios.
  // best-effort: falha silenciosa para não bloquear a entrega do HTML.
  try {
    await sb.from("qa_contract_events").insert({
      contract_id: contract.id,
      event_type: "contrato_baixado_cliente",
      event_payload: {
        venda_id,
        cliente_id: contract.cliente_id,
        contract_number: contract.contract_number,
        template_versao: contract.template_versao,
        download_ip: ip,
        download_user_agent: userAgent,
        pago,
      },
    });
  } catch { /* best effort */ }

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
    file_name: `${contractDownloadBaseName(contract.contract_number, venda_id, clienteNome)}.html`,
  });
});
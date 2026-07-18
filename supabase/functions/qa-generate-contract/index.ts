/**
 * qa-generate-contract
 * BLOCO 10 — gera contrato pós-pagamento da Quero Armas a partir de uma venda.
 *
 *  - Idempotente (UNIQUE em qa_contracts.venda_id).
 *  - Congela snapshot dos itens (qa_contract_items) — depois disso o catálogo
 *    NUNCA mais é consultado para este contrato.
 *  - Renderiza o template vigente `CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS`
 *    com Anexo I filtrado pelos slugs dos serviços contratados.
 *  - Grava apenas o snapshot HTML canônico em qa_contracts.conteudo_renderizado.
 *    O download do cliente renderiza esse snapshot; esta função NÃO gera PDF
 *    simplificado.
 *  - Calcula hash do snapshot e registra qa_contract_events('generated').
 *  - status inicial: generated_pending_company_signature.
 *  - NÃO libera processo/checklist.
 *
 *  Reprocessamento de contratos já existentes: se o template vigente tiver
 *  uma versão (template_versao) diferente da gravada no contrato, o
 *  conteudo_renderizado é automaticamente reconstruído a partir do template
 *  atual nesta mesma chamada (idempotência por versão, não só por código).
 *  Envie { force: true } para reprocessar mesmo sem mudança de versão. Em
 *  ambos os casos a data/IP/user-agent do aceite eletrônico original são
 *  preservados (prova de quando o cliente realmente aceitou); apenas o hash
 *  é recalculado para corresponder ao conteúdo corrigido.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { requireAdminOrInternal } from "../_shared/internalAuth.ts";
import { extractPolicy, aplicarPolicyNotificacao } from "../_shared/notificacaoPolicy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
};

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function sha256Text(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function substitute(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? "" : String(v);
  });
}

const AVISO_SEM_ANEXO_HTML =
  '<section data-anexo-slug="__aviso__" class="qa-anexo-aviso" ' +
  'style="border:1px solid #c9a84c;background:#fdf6e3;color:#5a4a1a;' +
  'padding:12px 14px;margin:18px 0;font-size:12.5px;line-height:1.5;">' +
  '<strong>Anexo específico do serviço não disponível neste contrato.</strong> ' +
  "Os termos detalhados do serviço contratado serão entregues junto ao " +
  "contrato final assinado." +
  "</section>";

function normalizeContractSlug(value: string | null | undefined): string {
  if (!value) return "";
  let s = String(value);
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.toLowerCase();
  s = s.replace(/[_\s]+/g, "-");
  s = s.replace(/[^a-z0-9-]+/g, "");
  s = s.replace(/-+/g, "-");
  s = s.replace(/^-+|-+$/g, "");
  return s;
}

function normalizeSlugs(slugs: string[] | null | undefined): string[] {
  if (!Array.isArray(slugs)) return [];
  return slugs
    .filter((s): s is string => typeof s === "string")
    .map((s) => normalizeContractSlug(s))
    .filter(Boolean);
}

function extractSlugFromAnexoBlock(segment: string): string | null {
  const rawRegexes: RegExp[] = [
    /Identificador[\s\S]{0,40}?\(\s*slug\s*\)[^A-Za-z0-9<]{0,20}(?:<[^>]+>\s*)*([^<\n\r.;]+)/i,
    /\(\s*slug\s*\)[\s\S]{0,20}?:[\s\S]{0,40}?([a-z0-9][\w\s\-]{1,80})/i,
  ];
  for (const r of rawRegexes) {
    const m = segment.match(r);
    if (m && m[1]) {
      const slug = normalizeContractSlug(m[1]);
      if (slug) return slug;
    }
  }
  const text = segment
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");
  const tm = text.match(
    /Identificador\s*\(\s*slug\s*\)\s*:?\s*([^.;<\n\r]+?)(?:\s|\.|;|<|$)/i,
  );
  if (tm && tm[1]) {
    const slug = normalizeContractSlug(tm[1]);
    if (slug) return slug;
  }
  return null;
}

function inferSlugFromAnexoTitle(titulo: string): string | null {
  if (!titulo) return null;
  const t = normalizeContractSlug(titulo);
  const semPrefixo = t.replace(/^i-\d+-/, "");
  const map: Array<{ test: RegExp; slug: string }> = [
    { test: /concessao-de-cr|concessao-cr/, slug: "concessao-cr" },
    { test: /renovacao-de-cr|renovacao-cr/, slug: "renovacao-cr" },
    { test: /autorizacao-de-compra|autorizacao-compra/, slug: "autorizacao-compra" },
    { test: /craf/, slug: "craf" },
    { test: /gte|guia-de-trafego/, slug: "gte" },
    { test: /porte/, slug: "porte" },
    { test: /posse/, slug: "posse" },
    { test: /apostilamento/, slug: "apostilamento" },
    { test: /registro/, slug: "registro" },
  ];
  for (const m of map) {
    if (m.test.test(semPrefixo) || m.test.test(t)) return m.slug;
  }
  return null;
}

function filterAnexoIByHeadings(html: string, slugSet: Set<string>): string {
  const headingRegex = /<h3[^>]*>\s*I\.\d+\.[^<]*<\/h3>/g;
  const heads: { start: number; titulo: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRegex.exec(html)) !== null) {
    heads.push({ start: m.index, titulo: m[0].replace(/<[^>]+>/g, "").trim() });
  }
  if (heads.length === 0) return html;

  const tailH2 = html.slice(heads[heads.length - 1].start).search(/<h2[^>]*>/);
  const lastEnd =
    tailH2 >= 0 ? heads[heads.length - 1].start + tailH2 : html.length;

  type Block = { start: number; end: number; slug: string | null };
  const blocks: Block[] = heads.map((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].start : lastEnd;
    const segment = html.slice(h.start, end);
    const slugExtraido = extractSlugFromAnexoBlock(segment);
    const slugInferido = slugExtraido ? null : inferSlugFromAnexoTitle(h.titulo);
    return { start: h.start, end, slug: slugExtraido || slugInferido };
  });

  const kept = blocks.filter((b) => b.slug && slugSet.has(b.slug));
  const head = html.slice(0, blocks[0].start);
  const tail = html.slice(lastEnd);
  const middle =
    kept.length === 0
      ? AVISO_SEM_ANEXO_HTML
      : kept.map((b) => html.slice(b.start, b.end)).join("");
  return head + middle + tail;
}

function filterContractAnexosBySlugs(
  html: string,
  slugsContratados: string[] | null | undefined,
): string {
  if (!html) return html;
  const slugSet = new Set(normalizeSlugs(slugsContratados));
  const sectionRegex =
    /<section\s+[^>]*data-anexo-slug="([^"]+)"[^>]*>[\s\S]*?<\/section>\s*/g;
  let foundAny = false;
  let kept = 0;
  const filtered = html.replace(sectionRegex, (full, s: string) => {
    foundAny = true;
    const sslug = normalizeContractSlug(s);
    if (slugSet.has(sslug)) {
      kept++;
      return full;
    }
    return "";
  });
  const bySections = foundAny
    ? kept === 0
      ? filtered + AVISO_SEM_ANEXO_HTML
      : filtered
    : html;
  return filterAnexoIByHeadings(bySections, slugSet);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: aceita admin/internal OU bearer service-role (usado pelo trigger pg_net).
  const authHeader = req.headers.get("Authorization") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isServiceRole =
    authHeader.startsWith("Bearer ") && authHeader.slice(7).trim() === serviceRole;
  // FASE 2C-4: aceita também invocação da trigger Postgres `qa_vendas_after_pago_invoke_contract`
  // (anon key + header `x-trigger-source: qa_vendas_pago_contract`). É seguro porque a função
  // só age sobre vendas com status='PAGO' já gravado em DB e é idempotente (UNIQUE venda_id).
  const triggerSource = req.headers.get("x-trigger-source") || "";
  const isTriggerCall = triggerSource === "qa_vendas_pago_contract";
  if (!isServiceRole && !isTriggerCall) {
    const guard = await requireAdminOrInternal(req);
    if (!guard.ok) return guard.response;
  }

  let body: { venda_id?: number; force?: boolean; notificacao_policy?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "JSON inválido" }, 400);
  }
  const vendaId = Number(body.venda_id);
  const force = body.force === true;
  if (!vendaId || Number.isNaN(vendaId)) return jsonResp({ error: "venda_id obrigatório" }, 400);
  const notifPolicy = extractPolicy(body, {
    notificar_cliente: true,
    canais: { email: true, whatsapp: false, portal: false },
  });

  const sb = svc();

  // Carrega venda
  const { data: venda, error: vErr } = await sb
    .from("qa_vendas")
    .select("id, id_legado, cliente_id, status, valor_aprovado, valor_a_pagar, data_cadastro, valor_total_pago_cliente, composicao_valor_final, pagamento_parcelas, pagamento_adquirente, pagamento_valor_parcela, pagamento_valor_total_parcelado")
    .eq("id_legado", vendaId)
    .maybeSingle();
  if (vErr || !venda) return jsonResp({ error: "Venda não encontrada" }, 404);

  const statusUp = (venda.status || "").toUpperCase().trim();
  if (statusUp !== "PAGO") {
    return jsonResp({ error: `Venda ainda não está PAGO (status atual: ${venda.status})` }, 409);
  }

  const { data: protocolNumber, error: protoErr } = await sb.rpc("qa_gerar_protocolo", {
    p_venda_id: venda.id,
  });
  if (protoErr || !protocolNumber) {
    return jsonResp({ error: "Falha ao gerar protocolo canônico", details: protoErr?.message }, 500);
  }
  const contractNumber = String(protocolNumber);

  // Idempotência com autocorreção: contratos antigos usavam QA-ANO-CODIGOALEATORIO.
  // O número aprovado é o protocolo canônico, ex.: QACR20260001.
  const { data: existing } = await sb
    .from("qa_contracts")
    .select(
      "id, status, contract_number, customer_uploaded_at, customer_signed_pdf_path, template_codigo, template_versao, conteudo_renderizado, aceite_eletronico_data, aceite_ip, aceite_user_agent",
    )
    .eq("venda_id", vendaId)
    .maybeSingle();

  // Cliente
  const { data: cliente } = await sb
    .from("qa_clientes")
    .select("id_legado, nome_completo, cpf, email, celular, endereco, numero, complemento, bairro, cidade, estado, cep")
    .eq("id_legado", venda.cliente_id)
    .maybeSingle();
  if (!cliente) return jsonResp({ error: "Cliente não encontrado" }, 404);

  // Itens da venda
  const { data: itens, error: iErr } = await sb
    .from("qa_itens_venda")
    .select("id, servico_id, valor")
    .eq("venda_id", vendaId);
  if (iErr) return jsonResp({ error: "Falha ao ler itens", details: iErr.message }, 500);

  // Catálogo (apenas para snapshot)
  const servicoIds = (itens || []).map((i) => i.servico_id).filter(Boolean) as number[];
  const catalogMap: Record<number, { slug: string | null; nome: string; descricao: string | null }> = {};
  if (servicoIds.length) {
    const { data: catalog } = await sb
      .from("qa_servicos_catalogo")
      .select("servico_id, slug, nome, descricao_curta")
      .in("servico_id", servicoIds);
    (catalog || []).forEach((c: any) => {
      catalogMap[c.servico_id] = { slug: c.slug, nome: c.nome, descricao: c.descricao_curta };
    });
  }

  const snapshot = (itens || []).map((it: any) => {
    const cat = it.servico_id ? catalogMap[it.servico_id] : undefined;
    const unit = Math.round(Number(it.valor || 0) * 100);
    return {
      item_venda_id: it.id,
      service_id_snapshot: it.servico_id ?? null,
      service_slug_snapshot: cat?.slug ?? null,
      service_name_snapshot: cat?.nome ?? `Serviço #${it.servico_id ?? "?"}`,
      service_description_snapshot: cat?.descricao ?? null,
      quantity: 1,
      unit_price_cents: unit,
      total_price_cents: unit,
    };
  });

  if (!snapshot.length) {
    return jsonResp({ error: "Venda sem itens — não é possível gerar contrato" }, 422);
  }

  const { data: template, error: tplErr } = await sb
    .from("qa_contract_templates")
    .select("id, codigo, versao, titulo, corpo_html")
    .eq("codigo", "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS")
    .eq("vigente", true)
    .maybeSingle();
  if (tplErr || !template) {
    return jsonResp({ error: "Template vigente do contrato não encontrado", details: tplErr?.message }, 500);
  }

  const slugsContratados = Array.from(
    new Set(snapshot.map((s) => s.service_slug_snapshot).filter((s): s is string => !!s)),
  );
  const servicoNomeFinal =
    snapshot.length > 1
      ? `${snapshot.length} serviços contratados em conjunto: ${snapshot.map((s) => s.service_name_snapshot).join("; ")}`
      : snapshot[0]?.service_name_snapshot || "Serviço contratado";
  const servicoSlugFinal = slugsContratados.length > 0 ? slugsContratados.join(",") : "";
  const totalCents = snapshot.reduce((sum, s) => sum + Number(s.total_price_cents || 0), 0);

  // ---------------------------------------------------------------------------
  // Bloco "itens contratados" — renderizado apenas quando há 2+ itens.
  // Torna explícito no corpo do contrato o pacote adquirido e o total efetivo,
  // além do que já aparece nos Anexos filtrados por slug.
  // ---------------------------------------------------------------------------
  let itensContratadosBloco = "";
  // Lê o modo de exibição escolhido no wizard/checkout.
  let modoExibicaoContrato: "itens_separados" | "pacote_fechado" = "itens_separados";
  let valorFinalPacoteEvento: number | null = null;
  let custosEmbutidosEvento: Array<{ descricao: string; valor: number }> = [];
  let custosEmbutidosTotalEvento = 0;
  try {
    const { data: exibEv } = await sb
      .from("qa_venda_eventos")
      .select("dados_json")
      .eq("venda_id", venda.id)
      .eq("tipo_evento", "venda_exibicao_contrato_definida")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const dj = (exibEv as any)?.dados_json ?? null;
    if (dj?.modo_exibicao_valor_contrato === "pacote_fechado") {
      modoExibicaoContrato = "pacote_fechado";
      const vf = Number(dj.valor_final_pacote);
      valorFinalPacoteEvento = Number.isFinite(vf) && vf > 0 ? vf : null;
      if (Array.isArray(dj.custos_embutidos)) {
        custosEmbutidosEvento = dj.custos_embutidos
          .filter((c: any) => c && typeof c.descricao === "string" && Number.isFinite(Number(c.valor)) && Number(c.valor) > 0)
          .map((c: any) => ({
            descricao: String(c.descricao).trim(),
            valor: Number(Number(c.valor).toFixed(2)),
          }));
        custosEmbutidosTotalEvento = custosEmbutidosEvento.reduce((s, c) => s + c.valor, 0);
      }
    }
  } catch (e) {
    console.warn("[qa-generate-contract] falha ao ler modo de exibição:", (e as any)?.message || e);
  }
  const totalContratoCents =
    modoExibicaoContrato === "pacote_fechado" && valorFinalPacoteEvento != null
      ? Math.round(valorFinalPacoteEvento * 100)
      : totalCents;

  // -------------------------------------------------------------------------
  // Piloto Real 2026-07-18 — se a venda tem `valor_total_pago_cliente` gravado
  // (composição estruturada), ele é a autoridade sobre o total do contrato em
  // modo pacote fechado. Evita divergência entre financeiro e contrato.
  // -------------------------------------------------------------------------
  const valorTotalPagoClienteDB = Number((venda as any)?.valor_total_pago_cliente);
  const composicaoDB: Array<{
    tipo: string;
    descricao: string;
    valor: number;
    natureza: string;
    aparece_no_contrato: boolean;
  }> = Array.isArray((venda as any)?.composicao_valor_final)
    ? (venda as any).composicao_valor_final
    : [];
  const totalContratoCentsFinal =
    modoExibicaoContrato === "pacote_fechado" &&
    Number.isFinite(valorTotalPagoClienteDB) &&
    valorTotalPagoClienteDB > 0
      ? Math.round(valorTotalPagoClienteDB * 100)
      : totalContratoCents;

  if (snapshot.length > 1) {
    if (modoExibicaoContrato === "pacote_fechado") {
      const linhas = snapshot
        .map((s) => `<li><strong>${esc(s.service_name_snapshot || "")}</strong></li>`)
        .join("");
      const embutidosBloco = custosEmbutidosEvento.length > 0
        ? (() => {
            const li = custosEmbutidosEvento
              .map((c) => `<li><strong>${esc(c.descricao)}</strong> — ${brl(Math.round(c.valor * 100))}</li>`)
              .join("");
            return (
              `<p>1.A.3. Integram ainda o pacote, a título de custos operacionais de terceiros ` +
              `repassados à CONTRATANTE (sem margem para a CONTRATADA), os seguintes itens:</p>` +
              `<ul>${li}</ul>` +
              `<p>1.A.3.1. O total desses custos operacionais é de ` +
              `<strong>${brl(Math.round(custosEmbutidosTotalEvento * 100))}</strong> e compõe o valor ` +
              `contratado indicado em 1.A.2.</p>`
            );
          })()
        : "";
      itensContratadosBloco =
        `<h2>CLÁUSULA PRIMEIRA-A --- DO PACOTE CONTRATADO</h2>` +
        `<p>1.A.1. A CONTRATANTE contratou, em condição comercial única de pacote fechado, ` +
        `os serviços listados abaixo, cada qual regido pelo respectivo Anexo I:</p>` +
        `<ul>${linhas}</ul>` +
        `<p>1.A.2. O valor total contratado do pacote é <strong>${brl(totalContratoCentsFinal)}</strong>. ` +
        `Por se tratar de condição comercial de pacote, não há discriminação de preço por serviço ` +
        `neste instrumento — a condição de pagamento (parcelamento e adquirente, quando houver) é ` +
        `detalhada na CLÁUSULA TERCEIRA.</p>` +
        embutidosBloco;
    } else {
      const linhas = snapshot
        .map((s) => {
          const nome = esc(s.service_name_snapshot || "");
          const preco = brl(Number(s.total_price_cents || 0));
          return `<li><strong>${nome}</strong> — ${preco}</li>`;
        })
        .join("");
      itensContratadosBloco =
        `<h2>CLÁUSULA PRIMEIRA-A --- DOS ITENS CONTRATADOS EM CONJUNTO</h2>` +
        `<p>1.A.1. A CONTRATANTE contratou, em condição única de pacote, os serviços abaixo, ` +
        `cada qual regido pelo respectivo Anexo I:</p>` +
        `<ul>${linhas}</ul>` +
        `<p>1.A.2. O valor total contratado do pacote é <strong>${brl(totalContratoCentsFinal)}</strong>, ` +
        `equivalente à soma dos itens acima na condição comercial acordada no momento do aceite eletrônico.</p>`;
    }
  }

  // Piloto Real B — resumo da composição do valor final (somente itens marcados
  // com aparece_no_contrato=true e que NÃO sejam serviços do catálogo já listados
  // e nem juros da adquirente — que já aparecem na Cláusula Terceira).
  let composicaoResumoBloco = "";
  try {
    const linhasComp = composicaoDB
      .filter((c) => c && c.aparece_no_contrato === true)
      .filter((c) => c.tipo !== "servico_qa" && c.tipo !== "custo_financeiro_adquirente")
      .map((c) => `<li><strong>${esc(String(c.descricao || ""))}</strong> — ${brl(Math.round(Number(c.valor) * 100))}</li>`);
    if (linhasComp.length > 0) {
      composicaoResumoBloco =
        `<h2>CLÁUSULA PRIMEIRA-B --- COMPOSIÇÃO OPERACIONAL DO VALOR CONTRATADO</h2>` +
        `<p>1.B.1. Compõem ainda o valor contratado, a título de custos operacionais e ` +
        `repasses de terceiros, os seguintes itens (sem margem para a CONTRATADA):</p>` +
        `<ul>${linhasComp.join("")}</ul>`;
    }
  } catch { /* best effort */ }

  // ---------------------------------------------------------------------------
  // Bloco "cláusula de pagamento" — só renderizado quando houve parcelamento
  // com juros/tarifa da adquirente (informado pela Equipe no fluxo manual).
  // Fonte: último evento pagamento_manual_confirmado da venda.
  // ---------------------------------------------------------------------------
  let clausulaPagamentoBloco = "";
  try {
    const { data: pagEv } = await sb
      .from("qa_venda_eventos")
      .select("dados_json, created_at")
      .eq("venda_id", venda.id)
      .eq("tipo_evento", "pagamento_manual_confirmado")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const dj = (pagEv as any)?.dados_json ?? null;
    if (dj) {
      const parcelas = Number(dj.parcelas || 1);
      const adquirente = dj.adquirente ? String(dj.adquirente).trim() : "";
      const valorBruto = Number(dj.valor_bruto_parcelado);
      const forma = dj.forma_pagamento ? String(dj.forma_pagamento) : "";
      const totalReais = totalContratoCentsFinal / 100;
      const temJuros =
        Number.isFinite(valorBruto) && valorBruto > 0 && valorBruto - totalReais > 0.01;
      if (parcelas > 1 && (temJuros || adquirente)) {
        const efetivoBruto = temJuros ? valorBruto : totalReais;
        const valorParcela = efetivoBruto / parcelas;
        const parcelaFmt = brl(Math.round(valorParcela * 100));
        const brutoFmt = brl(Math.round(efetivoBruto * 100));
        const totalFmt = brl(totalContratoCentsFinal);
        const partes: string[] = [];
        partes.push(
          `3.2.1. Foi acordado o pagamento em <strong>${parcelas}x</strong> de ` +
            `<strong>${parcelaFmt}</strong>` +
            (forma ? ` na modalidade <strong>${esc(forma)}</strong>` : "") +
            (adquirente ? `, processado pela adquirente <strong>${esc(adquirente)}</strong>` : "") +
            `, totalizando <strong>${brutoFmt}</strong> debitados junto à instituição financeira ` +
            `da CONTRATANTE.`
        );
        if (temJuros) {
          partes.push(
            `3.2.2. O valor contratado dos serviços é de <strong>${totalFmt}</strong>. ` +
              `A diferença entre este valor e o total efetivamente debitado no cartão ` +
              `(<strong>${brutoFmt}</strong>) corresponde a juros e/ou tarifas cobradas pela adquirente ` +
              (adquirente ? `<strong>${esc(adquirente)}</strong>` : "instituição financeira") +
              `, integralmente de responsabilidade da CONTRATANTE, sem qualquer participação da ` +
              `CONTRATADA sobre esses acréscimos.`
          );
        } else {
          partes.push(
            `3.2.2. O valor contratado dos serviços de <strong>${totalFmt}</strong> corresponde ao total ` +
              `debitado pela adquirente, sem incidência de juros ou tarifas adicionais nesta operação.`
          );
        }
        clausulaPagamentoBloco = partes.map((p) => `<p>${p}</p>`).join("");
      }
    }
  } catch (e) {
    console.warn("[qa-generate-contract] falha ao ler evento de pagamento:", (e as any)?.message || e);
  }

  const enderecoCliente = [
    cliente.endereco,
    cliente.numero ? `nº ${cliente.numero}` : null,
    cliente.complemento,
    cliente.bairro,
    cliente.cidade && cliente.estado ? `${cliente.cidade}/${cliente.estado}` : cliente.cidade,
    cliente.cep ? `CEP ${cliente.cep}` : null,
  ].filter(Boolean).join(", ");
  const aceiteDataIso = new Date().toISOString();
  const corpoFiltrado = filterContractAnexosBySlugs((template as any).corpo_html, slugsContratados);
  const conteudoRenderizado = substitute(corpoFiltrado, {
    cliente_nome: esc(cliente.nome_completo || ""),
    cliente_cpf_cnpj: esc(cliente.cpf || ""),
    cliente_endereco: esc(enderecoCliente || ""),
    cliente_email: esc(cliente.email || ""),
    cliente_telefone: esc(cliente.celular || ""),
    servico_slug: esc(servicoSlugFinal),
    servico_nome: esc(servicoNomeFinal),
    servico_preco: brl(totalContratoCentsFinal),
    aceite_data: aceiteDataIso,
    aceite_ip: "",
    aceite_user_agent: "",
    aceite_hash: "",
    itens_contratados_bloco: itensContratadosBloco + composicaoResumoBloco,
    clausula_pagamento_bloco: clausulaPagamentoBloco,
  });
  const aceiteHash = await sha256Text(`${conteudoRenderizado}|${aceiteDataIso}|${venda.cliente_id}`);
  const conteudoSha = await sha256Text(conteudoRenderizado);

  if (existing) {
    const templateDesatualizado = existing.template_versao !== (template as any).versao;
    const hasCanonicalTemplate =
      !force &&
      !templateDesatualizado &&
      existing.contract_number === contractNumber &&
      existing.template_codigo === "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS" &&
      typeof existing.conteudo_renderizado === "string" &&
      existing.conteudo_renderizado.trim().length > 0;
    if (hasCanonicalTemplate) {
      return jsonResp({ ok: true, idempotent: true, contract: existing });
    }

    // Reprocessamento: preserva a prova de aceite original (data/IP/user-agent
    // do clique do cliente na Etapa 04) e recalcula o hash sobre o conteúdo
    // corrigido — o hash deve sempre corresponder ao que está sendo servido.
    const aceiteDataParaHash = existing.aceite_eletronico_data || aceiteDataIso;
    const aceiteHashReprocessado = await sha256Text(
      `${conteudoRenderizado}|${aceiteDataParaHash}|${venda.cliente_id}`,
    );

    const patch: Record<string, unknown> = {
      contract_number: contractNumber,
      template_id: (template as any).id,
      template_codigo: (template as any).codigo,
      template_versao: (template as any).versao,
      conteudo_renderizado: conteudoRenderizado,
      servico_slug: servicoSlugFinal || null,
      valor: totalCents / 100,
      aceite_hash: aceiteHashReprocessado,
    };
    Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

    const { data: repaired, error: repairErr } = await sb
      .from("qa_contracts")
      .update(patch)
      .eq("id", existing.id)
      .select("id, status, contract_number")
      .single();
    if (repairErr) {
      return jsonResp({ error: "Falha ao reprocessar contrato", details: repairErr.message }, 500);
    }

    await sb.from("qa_contract_events").insert({
      contract_id: existing.id,
      event_type: force ? "contrato_reprocessado_manual" : "contrato_reprocessado_template_desatualizado",
      event_payload: {
        old_contract_number: existing.contract_number,
        contract_number: contractNumber,
        old_template_versao: existing.template_versao,
        new_template_versao: (template as any).versao,
        new_aceite_hash: aceiteHashReprocessado,
        template_codigo: (template as any).codigo,
        slugs: slugsContratados,
        forced: force,
      },
    });

    return jsonResp({ ok: true, repaired: true, contract: repaired });
  }

  // Insert contract
  const { data: contract, error: cErr } = await sb
    .from("qa_contracts")
    .insert({
      venda_id: vendaId,
      cliente_id: venda.cliente_id,
      contract_number: contractNumber,
      status: "pending_customer_signature",
      template_id: (template as any).id,
      template_codigo: (template as any).codigo,
      template_versao: (template as any).versao,
      conteudo_renderizado: conteudoRenderizado,
      servico_slug: servicoSlugFinal || null,
      valor: totalCents / 100,
      aceite_hash: aceiteHash,
      issued_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (cErr || !contract) {
    return jsonResp({ error: "Falha ao criar contrato", details: cErr?.message }, 500);
  }

  // Insert items snapshot
  const itemsRows = snapshot.map((s) => ({
    contract_id: contract.id,
    venda_id: vendaId,
    item_venda_id: s.item_venda_id ?? null,
    service_id_snapshot: s.service_id_snapshot,
    service_slug_snapshot: s.service_slug_snapshot,
    service_name_snapshot: s.service_name_snapshot,
    service_description_snapshot: s.service_description_snapshot,
    quantity: s.quantity,
    unit_price_cents: s.unit_price_cents,
    total_price_cents: s.total_price_cents,
  }));
  await sb.from("qa_contract_items").insert(itemsRows);

  await sb.from("qa_contract_events").insert({
    contract_id: contract.id,
    event_type: "generated",
    event_payload: {
      contract_number: contractNumber,
      conteudo_sha256: conteudoSha,
      items: snapshot.length,
      template_codigo: (template as any).codigo,
      template_versao: (template as any).versao,
      slugs: slugsContratados,
    },
  });

  // FASE 2C-4: evento de auditoria semântico do fluxo pós-pagamento
  await sb.from("qa_contract_events").insert({
    contract_id: contract.id,
    event_type: "contrato_gerado_pos_pagamento",
    event_payload: {
      venda_id: vendaId,
      cliente_id: venda.cliente_id,
      contract_number: contractNumber,
      trigger_source: isTriggerCall ? triggerSource : (isServiceRole ? "service_role" : "admin"),
    },
  });

  // Lovable Emails: avisa cliente que o contrato está pronto para assinatura.
  // Gated pela política de notificação (notificacao_policy). Se o operador
  // marcou "não notificar", registramos a decisão em qa_notificacao_eventos
  // e pulamos o envio de e-mail (mesmo comportamento para portal/WhatsApp).
  try {
    const { data: cliEmail } = await sb
      .from("qa_clientes")
      .select("email, nome_completo")
      .or(`id_legado.eq.${venda.cliente_id},id.eq.${venda.cliente_id}`)
      .limit(1)
      .maybeSingle();
    const podeEnviarEmail =
      notifPolicy.notificar_cliente && (notifPolicy.canais?.email ?? true);
    if (podeEnviarEmail && cliEmail?.email && /^\S+@\S+\.\S+$/.test(String(cliEmail.email))) {
      const { sendTransactional } = await import("../_shared/sendTransactional.ts");
      await sendTransactional({
        templateName: "contrato-pronto-assinatura",
        recipientEmail: String(cliEmail.email).toLowerCase(),
        idempotencyKey: `contrato-pronto-${contract.id}`,
        templateData: {
          nome: cliEmail.nome_completo || undefined,
          contrato: contractNumber,
          linkAssinatura: `https://www.euqueroarmas.com.br/area-do-cliente/contratos/${contract.id}`,
        },
      });
    }
    // Registra a decisão (portal + auditoria). Não reenvia e-mail: aqui só
    // fecha a trilha, para que quem consultar qa_notificacao_eventos veja
    // o motivo de "não notificar" ou o canal usado.
    try {
      await aplicarPolicyNotificacao(notifPolicy, {
        acao: "contrato_pronto_assinatura",
        cliente_id: venda.cliente_id ?? null,
        venda_id: vendaId,
        contrato_id: contract.id,
        origem: "qa-generate-contract",
        titulo_portal: "Contrato pronto para assinatura",
        mensagem_portal: `Seu contrato ${contractNumber} está disponível para assinatura na área do cliente.`,
        link_portal: `/area-do-cliente/contratos/${contract.id}`,
        payload_resumo: { contract_number: contractNumber, email_ja_enviado: !!podeEnviarEmail },
      });
    } catch (_) { /* best effort */ }
  } catch (e) {
    console.error("[qa-generate-contract] contrato-pronto-assinatura email error:", (e as Error)?.message);
  }

  return jsonResp({
    ok: true,
    contract: {
      id: contract.id,
      contract_number: contractNumber,
      conteudo_sha256: conteudoSha,
      items: snapshot.length,
    },
  });
});

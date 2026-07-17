// FASE 2C-1 — Checkout público Quero Armas (cria venda + itens a partir do carrinho).
// Não gera cobrança Asaas. Não cria contrato/processo/checklist. Não libera Arsenal.
// Isolado: NÃO usa payments/contracts/quotes/customers/post-purchase/ensureClientAccess.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateCheckoutToken } from "../_shared/qaAsaas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CartItemInput {
  servico_id: string; // catalogo uuid
  slug: string;
  quantidade: number;
  /**
   * Piloto Real / Venda Assistida: preço efetivo negociado (em reais) para
   * este item. Se ausente ou igual ao catálogo, usa preço do catálogo.
   * Só é aceito quando o chamador é staff ativo (qa_usuarios_perfis) e
   * `negociacao` está preenchido.
   */
  preco_negociado?: number | null;
}

interface IdentificacaoInput {
  nome_completo: string;
  cpf: string;
  email: string;
  celular: string;
}

interface NegociacaoInput {
  motivo: string;
  tipo_ajuste:
    | "promocao"
    | "negociacao_individual"
    | "cortesia_parcial"
    | "complemento"
    | "correcao"
    | "outro";
  evidencia_path?: string | null;
  confirmado: boolean;
  origem?: string | null; // ex.: "piloto_real_preco_negociado"
}

interface ExibicaoContratoInput {
  modo: "itens_separados" | "pacote_fechado";
  valor_final_pacote?: number | null;
  ocultar_precos_individuais_no_contrato?: boolean;
  motivo?: string | null;
}

interface Body {
  cart: CartItemInput[];
  identificacao?: IdentificacaoInput | null;
  negociacao?: NegociacaoInput | null;
  exibicao_contrato?: ExibicaoContratoInput | null;
}

const TIPOS_AJUSTE = new Set([
  "promocao",
  "negociacao_individual",
  "cortesia_parcial",
  "complemento",
  "correcao",
  "outro",
]);

function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}
function isValidCPF(cpf: string): boolean {
  const c = onlyDigits(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  return true;
}
function isValidEmail(e: string): boolean {
  return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test((e || "").trim().toLowerCase());
}
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function isLegacyNumericId(value: string): boolean {
  return /^\d+$/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Resolve user from JWT, se houver.
  let userId: string | null = null;
  let userEmail: string | null = null;
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      userId = data?.user?.id ?? null;
      userEmail = data?.user?.email ?? null;
    } catch {
      userId = null;
      userEmail = null;
    }
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Valida cart
  if (!Array.isArray(body.cart) || body.cart.length === 0) {
    return new Response(JSON.stringify({ error: "cart_empty" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  for (const it of body.cart) {
    if (!it?.servico_id || !it?.slug || !it?.quantidade || it.quantidade < 1) {
      return new Response(JSON.stringify({ error: "cart_item_invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Resolve preço SERVER-SIDE — fonte canônica do snapshot.
  // Compatibilidade: carrinhos antigos podem trazer servico_id legado numérico
  // ou até "null"; nestes casos, resolvemos por servico_id ou slug.
  const cartIds = Array.from(new Set(body.cart.map((c) => String(c.servico_id))));
  const uuidIds = cartIds.filter(isUuid);
  const legacyIds = cartIds.filter(isLegacyNumericId).map((id) => Number(id));
  const slugs = Array.from(new Set(body.cart.map((c) => c.slug).filter(Boolean)));
  const catRows: any[] = [];

  async function appendCatalogRows(query: PromiseLike<{ data: any[] | null; error: any }>) {
    const { data, error } = await query;
    if (error) throw error;
    for (const row of data ?? []) catRows.push(row);
  }

  try {
    if (uuidIds.length > 0) {
      await appendCatalogRows(
        admin
          .from("qa_servicos_catalogo")
          .select("id, slug, nome, preco, ativo, servico_id")
          .in("id", uuidIds),
      );
    }
    if (legacyIds.length > 0) {
      await appendCatalogRows(
        admin
          .from("qa_servicos_catalogo")
          .select("id, slug, nome, preco, ativo, servico_id")
          .in("servico_id", legacyIds),
      );
    }
    if (slugs.length > 0) {
      await appendCatalogRows(
        admin
          .from("qa_servicos_catalogo")
          .select("id, slug, nome, preco, ativo, servico_id")
          .in("slug", slugs),
      );
    }
  } catch (catErr: any) {
    return new Response(JSON.stringify({ error: "catalog_query_failed", detail: catErr?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const byCartId = new Map<string, any>();
  const bySlug = new Map<string, any>();
  for (const r of catRows) {
    byCartId.set(String(r.id), r);
    if (r.servico_id != null) byCartId.set(String(r.servico_id), r);
    bySlug.set(String(r.slug), r);
  }
  for (const it of body.cart) {
    const r = byCartId.get(String(it.servico_id)) ?? bySlug.get(it.slug);
    if (!r || !r.ativo) {
      return new Response(JSON.stringify({ error: "service_unavailable", slug: it.slug, servico_id: it.servico_id }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Resolve cliente.
  let qaClienteId: number | null = null;

  if (userId) {
    // 1) Tenta via cliente_auth_links (caminho normal)
    const { data: link } = await admin
      .from("cliente_auth_links")
      .select("qa_cliente_id")
      .eq("user_id", userId)
      .not("qa_cliente_id", "is", null)
      .order("activated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    qaClienteId = (link as any)?.qa_cliente_id ?? null;

    // 2) Fallback: qa_clientes.user_id (mesmo que qa-cadastro-carregar-cliente usa)
    if (!qaClienteId) {
      const { data: cli } = await admin
        .from("qa_clientes")
        .select("id")
        .eq("user_id", userId)
        .neq("status", "excluido_lgpd")
        .limit(1)
        .maybeSingle();
      qaClienteId = (cli as any)?.id ?? null;
    }
  }

  if (userId && !qaClienteId) {
    const { data: clienteDireto } = await admin
      .from("qa_clientes")
      .select("id, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (clienteDireto && (clienteDireto as any).status !== "excluido_lgpd") {
      qaClienteId = (clienteDireto as any).id;
      await admin.from("cliente_auth_links").insert({
        qa_cliente_id: qaClienteId,
        user_id: userId,
        email: userEmail,
        status: "active",
        activated_at: new Date().toISOString(),
      });
    }
  }

  if (!qaClienteId) {
    const ident = body.identificacao;
    if (!ident) {
      return new Response(JSON.stringify({ error: "identification_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const nome = (ident.nome_completo || "").trim();
    const cpf = onlyDigits(ident.cpf);
    const email = (ident.email || "").trim().toLowerCase();
    const celular = onlyDigits(ident.celular);
    if (!nome || !isValidCPF(cpf) || !isValidEmail(email) || celular.length < 10) {
      return new Response(JSON.stringify({ error: "identification_invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reaproveita por CPF
    const { data: byCpf } = await admin
      .from("qa_clientes")
      .select("id")
      .eq("cpf", cpf)
      .neq("status", "excluido_lgpd")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (byCpf) {
      qaClienteId = (byCpf as any).id;
    } else {
      // Reaproveita por e-mail (fallback) — mas só se não tiver CPF cadastrado, evita bater em cliente já com CPF distinto.
      const { data: byEmail } = await admin
        .from("qa_clientes")
        .select("id, cpf")
        .eq("email", email)
        .neq("status", "excluido_lgpd")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (byEmail && (!(byEmail as any).cpf || onlyDigits((byEmail as any).cpf) === cpf)) {
        qaClienteId = (byEmail as any).id;
        // Atualiza CPF caso ausente
        if (!(byEmail as any).cpf) {
          await admin.from("qa_clientes").update({ cpf }).eq("id", qaClienteId!);
        }
      } else {
        const { data: novo, error: errNovo } = await admin
          .from("qa_clientes")
          .insert({
            nome_completo: nome.toUpperCase(),
            cpf,
            email,
            celular,
            status: "ativo",
          })
          .select("id")
          .single();
        if (errNovo || !novo) {
          return new Response(
            JSON.stringify({ error: "client_create_failed", detail: errNovo?.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        qaClienteId = (novo as any).id;
      }
    }
  }

  // Lê id_legado do cliente (usado por qa_vendas.cliente_id).
  const { data: cliRow } = await admin
    .from("qa_clientes")
    .select("id, id_legado")
    .eq("id", qaClienteId!)
    .maybeSingle();
  if (!cliRow) {
    return new Response(JSON.stringify({ error: "client_not_found" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const cliLegado = (cliRow as any).id_legado ?? (cliRow as any).id;

  // Calcula total snapshot.
  let totalCents = 0;
  // Detecta se há itens com preço negociado diferente do catálogo.
  const negociacaoRecebida = body.negociacao ?? null;
  const itensNegociadosAudit: Array<{
    slug: string;
    nome: string;
    quantidade: number;
    preco_catalogo: number;
    preco_aplicado: number;
    diferenca: number;
    percentual: number;
  }> = [];
  const cartAvaliado = body.cart.map((it) => {
    const r: any = byCartId.get(String(it.servico_id)) ?? bySlug.get(it.slug);
    const precoCatalogo = Number(r.preco ?? 0);
    const rawNeg = it.preco_negociado;
    const precoAplicado =
      rawNeg != null && Number.isFinite(Number(rawNeg)) && Number(rawNeg) >= 0
        ? Number(rawNeg)
        : precoCatalogo;
    const diferente = Math.abs(precoAplicado - precoCatalogo) > 0.0049;
    return { it, r, precoCatalogo, precoAplicado, diferente };
  });
  const temNegociacao = cartAvaliado.some((c) => c.diferente);

  if (temNegociacao) {
    // Precisa de staff ativo (mesma regra de qa_usuarios_perfis).
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "staff_required_for_negotiated_price" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { data: perfilRow } = await admin
      .from("qa_usuarios_perfis")
      .select("perfil, ativo")
      .eq("user_id", userId)
      .eq("ativo", true)
      .maybeSingle();
    if (!perfilRow) {
      return new Response(
        JSON.stringify({ error: "staff_profile_required_for_negotiated_price" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!negociacaoRecebida) {
      return new Response(
        JSON.stringify({ error: "negociacao_obrigatoria" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const motivo = String(negociacaoRecebida.motivo || "").trim();
    if (motivo.length < 20) {
      return new Response(
        JSON.stringify({ error: "motivo_minimo_20_chars" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!TIPOS_AJUSTE.has(String(negociacaoRecebida.tipo_ajuste))) {
      return new Response(
        JSON.stringify({ error: "tipo_ajuste_invalido", allowed: [...TIPOS_AJUSTE] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (negociacaoRecebida.confirmado !== true) {
      return new Response(
        JSON.stringify({ error: "confirmacao_obrigatoria" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  const itensSnapshot = body.cart.map((it) => {
    const av = cartAvaliado.find((c) => c.it === it)!;
    const r = av.r;
    const precoNum = av.precoAplicado;
    const valorUnit = Math.round(precoNum * 100);
    const sub = valorUnit * it.quantidade;
    totalCents += sub;
    if (av.diferente) {
      const diff = av.precoAplicado - av.precoCatalogo;
      const pct = av.precoCatalogo > 0 ? (diff / av.precoCatalogo) * 100 : 0;
      itensNegociadosAudit.push({
        slug: r.slug,
        nome: r.nome,
        quantidade: it.quantidade,
        preco_catalogo: av.precoCatalogo,
        preco_aplicado: av.precoAplicado,
        diferenca: Number(diff.toFixed(2)),
        percentual: Number(pct.toFixed(2)),
      });
    }
    return {
      servico_id_legado: r.servico_id ?? null,
      catalogo_uuid: r.id,
      slug: r.slug,
      nome: r.nome,
      valor_unitario: precoNum,
      quantidade: it.quantidade,
      valor_total: precoNum * it.quantidade,
      preco_catalogo_no_momento: av.precoCatalogo,
      preco_aplicado: av.precoAplicado,
      preco_negociado_flag: av.diferente,
    };
  });

  // Cria qa_vendas.
  const token = await generateCheckoutToken();
  const tokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data: vendaIns, error: errVenda } = await admin
    .from("qa_vendas")
    .insert({
      cliente_id: cliLegado,
      data_cadastro: new Date().toISOString().slice(0, 10),
      status: "À INICIAR",
      valor_a_pagar: totalCents / 100,
      valor_aberto: totalCents / 100,
      cobranca_status: "nao_gerada",
      cobranca_origem: "checkout_site",
      origem_proposta: "checkout_site",
      checkout_token_hash: token.hash,
      checkout_token_expires_at: tokenExpiresAt,
    })
    .select("id, id_legado")
    .single();
  if (errVenda || !vendaIns) {
    return new Response(JSON.stringify({ error: "venda_create_failed", detail: errVenda?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const vendaId = (vendaIns as any).id;
  const vendaIdLegado = (vendaIns as any).id_legado;

  // Cria qa_itens_venda — venda_id usa id_legado (FK textual no schema atual).
  const itensRows = itensSnapshot.map((s, idx) => ({
    venda_id: vendaIdLegado,
    servico_id: s.servico_id_legado,
    valor: s.valor_total,
    status: "À INICIAR",
    sort_order: idx,
    tipo_venda: "checkout_site",
  }));
  const { error: errItens } = await admin.from("qa_itens_venda").insert(itensRows);
  if (errItens) {
    // rollback best-effort
    await admin.from("qa_vendas").delete().eq("id", vendaId);
    return new Response(JSON.stringify({ error: "itens_create_failed", detail: errItens.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auditoria — venda_criada_checkout (snapshot completo).
  await admin.from("qa_venda_eventos").insert({
    venda_id: vendaId,
    qa_cliente_id: qaClienteId,
    cliente_id: cliLegado,
    tipo_evento: "venda_criada_checkout",
    descricao: "Venda criada a partir do carrinho do site Quero Armas",
    ator: userId ? "cliente_logado" : "cliente_publico",
    user_id: userId,
    dados_json: {
      origem: "checkout_site",
      total: totalCents / 100,
      itens: itensSnapshot,
      cobranca_status: "nao_gerada",
      exibicao_contrato: body.exibicao_contrato ?? null,
    },
  });

  // Auditoria dedicada — modo de exibição do contrato (usada por qa-generate-contract).
  // Sempre grava o evento quando o modo foi explicitamente enviado (mesmo itens_separados,
  // para deixar rastro do que a Equipe escolheu no wizard).
  if (body.exibicao_contrato && body.exibicao_contrato.modo) {
    const exib = body.exibicao_contrato;
    await admin.from("qa_venda_eventos").insert({
      venda_id: vendaId,
      qa_cliente_id: qaClienteId,
      cliente_id: cliLegado,
      tipo_evento: "venda_exibicao_contrato_definida",
      descricao:
        exib.modo === "pacote_fechado"
          ? "Pacote fechado — contrato deve ocultar preços individuais e exibir valor final único"
          : "Itens separados — contrato deve listar preços individuais + total",
      ator: userEmail ? `staff:${userEmail}` : (userId ? "cliente_logado" : "cliente_publico"),
      user_id: userId,
      dados_json: {
        modo_exibicao_valor_contrato: exib.modo,
        valor_final_pacote:
          exib.modo === "pacote_fechado" && exib.valor_final_pacote != null
            ? Number(exib.valor_final_pacote)
            : null,
        ocultar_precos_individuais_no_contrato: exib.modo === "pacote_fechado",
        motivo: exib.motivo ? String(exib.motivo).trim() : null,
        total_snapshot: totalCents / 100,
      },
    });
  }

  // Auditoria — preço negociado (obrigatório sempre que houver diferença).
  if (itensNegociadosAudit.length > 0 && negociacaoRecebida) {
    const totalCatalogo = cartAvaliado.reduce(
      (s, c) => s + c.precoCatalogo * c.it.quantidade,
      0,
    );
    const totalAplicado = totalCents / 100;
    const diffTotal = Number((totalAplicado - totalCatalogo).toFixed(2));
    const pctTotal =
      totalCatalogo > 0 ? Number(((diffTotal / totalCatalogo) * 100).toFixed(2)) : 0;

    await admin.from("qa_venda_eventos").insert({
      venda_id: vendaId,
      qa_cliente_id: qaClienteId,
      cliente_id: cliLegado,
      tipo_evento: "preco_negociado_aplicado",
      descricao: `Preço negociado aplicado (${negociacaoRecebida.tipo_ajuste}) — catálogo ${totalCatalogo.toFixed(2)} → aplicado ${totalAplicado.toFixed(2)}`,
      ator: userEmail ? `staff:${userEmail}` : "staff",
      user_id: userId,
      dados_json: {
        origem: negociacaoRecebida.origem || "piloto_real_preco_negociado",
        tipo_ajuste_preco: negociacaoRecebida.tipo_ajuste,
        motivo_preco_negociado: String(negociacaoRecebida.motivo).trim(),
        staff_user_id: userId,
        staff_email: userEmail,
        evidencia_path: negociacaoRecebida.evidencia_path || null,
        preco_catalogo_no_momento: totalCatalogo,
        preco_aplicado: totalAplicado,
        diferenca_valor: diffTotal,
        percentual_desconto_ou_acrescimo: pctTotal,
        itens: itensNegociadosAudit,
      },
    });

    try {
      await admin.from("qa_pagamento_auditoria").insert({
        venda_id: vendaId,
        cliente_id: cliLegado,
        campo: "preco_negociado_aplicado",
        valor_anterior: totalCatalogo,
        valor_novo: totalAplicado,
        origem: negociacaoRecebida.origem || "piloto_real_preco_negociado",
        ator: userEmail ? `staff:${userEmail}` : "staff",
        contexto: {
          tipo_ajuste_preco: negociacaoRecebida.tipo_ajuste,
          motivo_preco_negociado: String(negociacaoRecebida.motivo).trim(),
          staff_user_id: userId,
          staff_email: userEmail,
          evidencia_path: negociacaoRecebida.evidencia_path || null,
          diferenca_valor: diffTotal,
          percentual_desconto_ou_acrescimo: pctTotal,
          itens: itensNegociadosAudit,
        },
      });
    } catch { /* best effort */ }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      venda_id: vendaId,
      id_legado: vendaIdLegado,
      qa_cliente_id: qaClienteId,
      total: totalCents / 100,
      itens: itensSnapshot.length,
      status: "À INICIAR",
      cobranca_status: "nao_gerada",
      checkout_token: token.token,
      checkout_token_expires_at: tokenExpiresAt,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

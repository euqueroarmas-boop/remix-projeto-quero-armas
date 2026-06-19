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
}

interface IdentificacaoInput {
  nome_completo: string;
  cpf: string;
  email: string;
  celular: string;
}

interface Body {
  cart: CartItemInput[];
  identificacao?: IdentificacaoInput | null;
}

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
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      userId = data?.user?.id ?? null;
    } catch {
      userId = null;
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
  // Suporta tanto UUID (service_id novo) quanto ID numérico legado (fallback).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cartIds = Array.from(new Set(body.cart.map((c) => c.servico_id)));
  const uuidIds = cartIds.filter((id) => UUID_RE.test(id));
  const legacyIds = cartIds.filter((id) => !UUID_RE.test(id) && /^\d+$/.test(id)).map(Number);

  // Keyed by whatever the cart sent (uuid ou numeric string) → catálogo row.
  const byCartId = new Map<string, any>();

  if (uuidIds.length > 0) {
    const { data, error } = await admin
      .from("qa_servicos_catalogo")
      .select("id, slug, nome, preco, ativo, servico_id")
      .in("id", uuidIds);
    if (error) {
      return new Response(JSON.stringify({ error: "catalog_query_failed", detail: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    (data ?? []).forEach((r: any) => byCartId.set(r.id, r));
  }

  if (legacyIds.length > 0) {
    const { data, error } = await admin
      .from("qa_servicos_catalogo")
      .select("id, slug, nome, preco, ativo, servico_id")
      .in("servico_id", legacyIds);
    if (error) {
      return new Response(JSON.stringify({ error: "catalog_query_failed", detail: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    (data ?? []).forEach((r: any) => {
      if (r.servico_id != null) byCartId.set(String(r.servico_id), r);
    });
  }

  for (const it of body.cart) {
    const r = byCartId.get(it.servico_id);
    if (!r || !r.ativo) {
      return new Response(JSON.stringify({ error: "service_unavailable", slug: it.slug }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Resolve cliente.
  let qaClienteId: number | null = null;

  if (userId) {
    const { data: link } = await admin
      .from("cliente_auth_links")
      .select("qa_cliente_id")
      .eq("user_id", userId)
      .not("qa_cliente_id", "is", null)
      .order("activated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    qaClienteId = (link as any)?.qa_cliente_id ?? null;
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
  const itensSnapshot = body.cart.map((it) => {
    const r: any = byCartId.get(it.servico_id);
    const precoNum = Number(r.preco ?? 0);
    const valorUnit = Math.round(precoNum * 100);
    const sub = valorUnit * it.quantidade;
    totalCents += sub;
    return {
      servico_id_legado: r.servico_id ?? null,
      catalogo_uuid: r.id,
      slug: r.slug,
      nome: r.nome,
      valor_unitario: precoNum,
      quantidade: it.quantidade,
      valor_total: precoNum * it.quantidade,
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
    },
  });

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
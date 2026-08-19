// FASE 2C-1 — Checkout público Quero Armas (cria venda + itens a partir do carrinho).
// Não gera cobrança Asaas. Não cria contrato/processo/checklist. Não libera Arsenal.
// Isolado: NÃO usa payments/contracts/quotes/customers/post-purchase/ensureClientAccess.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateCheckoutToken } from "../_shared/qaAsaas.ts";
import { chamadorEmEspelho, respostaEmEspelho } from "../_shared/emuGuard.ts";

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
  // Auditoria estendida do modo "pacote_fechado".
  tipo_diferenca?: "ajuste_comercial" | "custo_financeiro_adquirente" | null;
  total_catalogo_servicos?: number | null;
  valor_total_pago_cliente?: number | null;
  diferenca_valor?: number | null;
  custo_financeiro_adquirente?: number | null;
  adquirente?: string | null;
  parcelas?: number | null;
  valor_parcela?: number | null;
  custos_embutidos?: Array<{ descricao: string; valor: number }> | null;
  custos_embutidos_total?: number | null;
  /**
   * Composição estruturada do valor final (piloto pacote fechado). Substitui,
   * a partir de 2026-07-18, a distribuição implícita "catálogo + custos_embutidos
   * + custo_financeiro". Cada item declara o tipo, natureza e se aparece no
   * contrato. Fonte de verdade para o financeiro do cliente.
   */
  composicao_valor_final?: Array<{
    tipo:
      | "servico_qa"
      | "gru_taxa_gov"
      | "exame_laudo"
      | "clube_estande"
      | "despesa_operacional"
      | "deslocamento_logistica"
      | "custo_financeiro_adquirente"
      | "taxa_admin_intermediacao"
      | "outro";
    descricao: string;
    valor: number;
    natureza: "receita_propria" | "repasse_despesa_externa" | "custo_financeiro";
    aparece_no_contrato: boolean;
    observacao?: string | null;
  }> | null;
}

interface Body {
  cart: CartItemInput[];
  identificacao?: IdentificacaoInput | null;
  negociacao?: NegociacaoInput | null;
  exibicao_contrato?: ExibicaoContratoInput | null;
  /**
   * Piloto Real / Venda Assistida: força vincular a venda ao qa_cliente indicado
   * em vez do qa_cliente do usuário autenticado que está chamando a função.
   * Só é honrado quando o chamador tem perfil ativo em `qa_usuarios_perfis`.
   * Sem essa checagem, o admin que dispara o wizard vira dono da venda.
   */
  target_qa_cliente_id?: number | null;
  /**
   * Libera a criação da venda mesmo quando o cliente já tem uma venda viva
   * com o mesmo serviço. Sem isso, a segunda compra idêntica é recusada —
   * ver TRAVA DE COMPRA DUPLICADA abaixo. A decisão fica registrada no
   * evento `venda_recompra_confirmada`.
   */
  recompra_confirmada?: boolean;
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

  // MODO ESPELHO: a equipe navega o portal inteiro, menos comprar.
  if (await chamadorEmEspelho(req)) return respostaEmEspelho(corsHeaders);

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

  // Piloto Real / venda assistida: staff pode fixar o cliente-alvo explicitamente.
  // Isso substitui a resolução baseada no user autenticado (que apontaria para
  // o próprio staff), mantendo a auditoria correta no portal do cliente real.
  if (userId && body.target_qa_cliente_id != null && Number.isFinite(Number(body.target_qa_cliente_id))) {
    const { data: perfilRow } = await admin
      .from("qa_usuarios_perfis")
      .select("perfil, ativo")
      .eq("user_id", userId)
      .eq("ativo", true)
      .maybeSingle();
    if (perfilRow) {
      const alvoId = Number(body.target_qa_cliente_id);
      const { data: alvo } = await admin
        .from("qa_clientes")
        .select("id, status")
        .eq("id", alvoId)
        .maybeSingle();
      if (!alvo || (alvo as any).status === "excluido_lgpd") {
        return new Response(
          JSON.stringify({ error: "target_qa_cliente_invalido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      qaClienteId = (alvo as any).id;
    } else {
      return new Response(
        JSON.stringify({ error: "target_qa_cliente_requires_staff" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  if (userId && !qaClienteId) {
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
    // categoria_titular decide o limite de compras do serviço (ver TRAVA DE
    // COMPRA REPETIDA): posse admite 2 armas para cidadão comum e 4 para
    // segurança pública.
    .select("id, id_legado, categoria_titular")
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

  // ── TRAVA DE COMPRA REPETIDA ──────────────────────────────────────────────
  // Auditoria de 19/08/2026: um cliente fechou o MESMO carrinho duas vezes com
  // quatro minutos de diferença (não viu a confirmação do PIX e refez). Saíram
  // duas vendas, dois contratos assinados e seis processos no lugar de três.
  // Todas as travas a jusante são por VENDA (`uq_qa_processos_venda_servico`),
  // então nenhuma delas enxerga a segunda compra: a recusa tem que acontecer
  // aqui, antes de a venda nascer.
  //
  // Comprar de novo o mesmo serviço é legítimo — a posse admite mais de uma
  // arma. Por isso a trava é estreita, com dois motivos e nada além deles:
  //
  //   repeticao_em_minutos → mesma compra há menos de 30 minutos. Ninguém
  //                          contrata duas vezes o mesmo serviço em meia hora
  //                          de propósito; isso é o acidente que aconteceu.
  //   limite_do_servico    → estourou o limite cadastrado em
  //                          `qa_servicos_limite_compra` para a categoria do
  //                          titular (posse: 2 para cidadão comum, 4 para
  //                          segurança pública). Serviço SEM limite cadastrado
  //                          não trava nunca.
  //
  // Nos dois casos `recompra_confirmada: true` libera, e a liberação fica
  // registrada no evento `venda_recompra_confirmada`.
  const JANELA_COMPRA_REPETIDA_MIN = 30;
  const STATUS_VENDA_ENCERRADA = new Set([
    "CANCELADO", "DESISTIU", "RESTITUÍDO", "RESTITUIDO",
    "CONCLUÍDO", "CONCLUIDO", "DEFERIDO", "INDEFERIDO",
  ]);

  interface CompraExistente {
    unidades: number;
    venda_id: number;
    minutos_desde_a_ultima: number;
  }
  interface RecusaCompra {
    motivo: "repeticao_em_minutos" | "limite_do_servico";
    servico_id: number;
    servico_slug: string;
    servico_nome: string;
    ja_tem: number;
    no_carrinho: number;
    limite: number | null;
    venda_id: number;
    minutos_desde_a_ultima: number;
  }

  const servicosDoCarrinho = new Map<number, { slug: string; nome: string; quantidade: number }>();
  for (const c of cartAvaliado) {
    const servicoId = Number(c.r?.servico_id);
    if (!Number.isFinite(servicoId) || servicoId <= 0) continue;
    const atual = servicosDoCarrinho.get(servicoId);
    const quantidade = Math.max(1, Number(c.it.quantidade) || 1);
    if (atual) atual.quantidade += quantidade;
    else servicosDoCarrinho.set(servicoId, {
      slug: String(c.r?.slug ?? ""),
      nome: String(c.r?.nome ?? `serviço ${servicoId}`),
      quantidade,
    });
  }

  const recusas: RecusaCompra[] = [];

  if (servicosDoCarrinho.size > 0) {
    // 1) O que o cliente já tem, por serviço, nas vendas que não foram encerradas.
    const jaComprado = new Map<number, CompraExistente>();
    const { data: vendasDoCliente } = await admin
      .from("qa_vendas")
      .select("id, id_legado, status, created_at")
      .eq("cliente_id", cliLegado);
    const vivas = (vendasDoCliente ?? []).filter(
      (v: any) => !STATUS_VENDA_ENCERRADA.has(String(v.status ?? "").trim().toUpperCase()),
    );
    if (vivas.length > 0) {
      // qa_itens_venda referencia a venda pelo id LEGADO.
      const porLegado = new Map<number, any>();
      for (const v of vivas) porLegado.set(Number((v as any).id_legado ?? (v as any).id), v);
      const { data: itensVivos } = await admin
        .from("qa_itens_venda")
        .select("venda_id, servico_id, status")
        .in("venda_id", Array.from(porLegado.keys()))
        .in("servico_id", Array.from(servicosDoCarrinho.keys()));
      const agora = Date.now();
      for (const item of itensVivos ?? []) {
        if (String((item as any).status ?? "").trim().toUpperCase() === "CANCELADO") continue;
        const venda = porLegado.get(Number((item as any).venda_id));
        if (!venda) continue;
        const servicoId = Number((item as any).servico_id);
        const criadaEm = venda.created_at ? Date.parse(venda.created_at) : NaN;
        const minutos = Number.isFinite(criadaEm)
          ? Math.floor((agora - criadaEm) / 60000)
          : Number.MAX_SAFE_INTEGER;
        const atual = jaComprado.get(servicoId);
        // Cada linha de qa_itens_venda é uma unidade do serviço.
        if (!atual) {
          jaComprado.set(servicoId, { unidades: 1, venda_id: Number(venda.id), minutos_desde_a_ultima: minutos });
        } else {
          atual.unidades += 1;
          if (minutos < atual.minutos_desde_a_ultima) {
            atual.minutos_desde_a_ultima = minutos;
            atual.venda_id = Number(venda.id);
          }
        }
      }
    }

    // 2) Limites cadastrados. Tabela ausente ou serviço sem linha = sem limite.
    const slugs = Array.from(servicosDoCarrinho.values()).map((s) => s.slug).filter(Boolean);
    const { data: limitesRows } = slugs.length > 0
      ? await admin
          .from("qa_servicos_limite_compra")
          .select("servico_slug, categoria_titular, limite")
          .in("servico_slug", slugs)
      : { data: [] as any[] };
    const categoriaTitular = (cliRow as any).categoria_titular ?? null;
    const limiteDoServico = (slug: string): number | null => {
      const doServico = (limitesRows ?? []).filter((l: any) => l.servico_slug === slug);
      const daCategoria = doServico.find((l: any) => l.categoria_titular === categoriaTitular);
      const geral = doServico.find((l: any) => l.categoria_titular == null);
      const escolhido = daCategoria ?? geral;
      return escolhido ? Number((escolhido as any).limite) : null;
    };

    // 3) Decide serviço a serviço.
    for (const [servicoId, doCarrinho] of servicosDoCarrinho) {
      const existente = jaComprado.get(servicoId);
      if (!existente) continue;
      const limite = limiteDoServico(doCarrinho.slug);
      const base = {
        servico_id: servicoId,
        servico_slug: doCarrinho.slug,
        servico_nome: doCarrinho.nome,
        ja_tem: existente.unidades,
        no_carrinho: doCarrinho.quantidade,
        limite,
        venda_id: existente.venda_id,
        minutos_desde_a_ultima: existente.minutos_desde_a_ultima,
      };
      if (existente.minutos_desde_a_ultima < JANELA_COMPRA_REPETIDA_MIN) {
        recusas.push({ motivo: "repeticao_em_minutos", ...base });
      } else if (limite != null && existente.unidades + doCarrinho.quantidade > limite) {
        recusas.push({ motivo: "limite_do_servico", ...base });
      }
    }
  }

  if (recusas.length > 0 && body.recompra_confirmada !== true) {
    return new Response(
      JSON.stringify({
        error: "servico_ja_contratado",
        code: "SERVICO_JA_CONTRATADO",
        motivo: recusas[0].motivo,
        detalhe:
          "Compra recusada por repetição recente ou por limite do serviço. Se for mesmo uma nova solicitação, reenvie com recompra_confirmada.",
        servicos: recusas,
      }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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

  // -------------------------------------------------------------------------
  // Piloto Real — Composição do valor final (pacote fechado)
  // Quando a Equipe informa uma composição estruturada, ela é a fonte de
  // verdade do "valor total pago pelo cliente" (financeiro + contrato).
  // Categorias: servico_qa | gru_taxa_gov | exame_laudo | clube_estande |
  // despesa_operacional | deslocamento_logistica | custo_financeiro_adquirente
  // | taxa_admin_intermediacao | outro.
  // -------------------------------------------------------------------------
  const TIPOS_COMPOSICAO = new Set([
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
  const NATUREZAS_COMPOSICAO = new Set([
    "receita_propria",
    "repasse_despesa_externa",
    "custo_financeiro",
  ]);
  const composicaoRaw = Array.isArray(body.exibicao_contrato?.composicao_valor_final)
    ? body.exibicao_contrato!.composicao_valor_final!
    : [];
  const composicaoSanit = composicaoRaw
    .filter(
      (c) =>
        c &&
        typeof c === "object" &&
        TIPOS_COMPOSICAO.has(String((c as any).tipo)) &&
        NATUREZAS_COMPOSICAO.has(String((c as any).natureza)) &&
        typeof (c as any).descricao === "string" &&
        (c as any).descricao.trim().length > 0 &&
        Number.isFinite(Number((c as any).valor)) &&
        Number((c as any).valor) > 0
    )
    .map((c: any) => ({
      tipo: String(c.tipo),
      descricao: String(c.descricao).trim().slice(0, 200),
      valor: Number(Number(c.valor).toFixed(2)),
      natureza: String(c.natureza),
      aparece_no_contrato: !!c.aparece_no_contrato,
      observacao: c.observacao ? String(c.observacao).trim().slice(0, 300) : null,
    }));
  const somaPorTipo = (tipos: string[]) =>
    composicaoSanit
      .filter((c) => tipos.includes(c.tipo))
      .reduce((s, c) => s + c.valor, 0);
  const somaPorNatureza = (nats: string[]) =>
    composicaoSanit.filter((c) => nats.includes(c.natureza)).reduce((s, c) => s + c.valor, 0);
  const isPacote = body.exibicao_contrato?.modo === "pacote_fechado";
  const totalComposicao = composicaoSanit.reduce((s, c) => s + c.valor, 0);
  const valorServicosCatalogo = Number((totalCents / 100).toFixed(2));
  const valorServicosAplicadoComp =
    composicaoSanit.length > 0 ? somaPorTipo(["servico_qa"]) : valorServicosCatalogo;
  const valorDespesasExtras = somaPorTipo([
    "gru_taxa_gov",
    "exame_laudo",
    "clube_estande",
    "despesa_operacional",
    "deslocamento_logistica",
    "taxa_admin_intermediacao",
    "outro",
  ]);
  const valorCustoFinanceiro = somaPorTipo(["custo_financeiro_adquirente"]);
  const valorTotalPagoCliente = composicaoSanit.length > 0
    ? Number(totalComposicao.toFixed(2))
    : (isPacote && Number.isFinite(Number(body.exibicao_contrato?.valor_total_pago_cliente))
        ? Number(body.exibicao_contrato!.valor_total_pago_cliente)
        : valorServicosCatalogo);

  // valor_a_pagar = valor efetivamente cobrado do cliente (pacote) ou
  // soma dos itens (itens separados / sem composição).
  const valorAPagarFinal = isPacote ? valorTotalPagoCliente : valorServicosCatalogo;

  // Cria qa_vendas.
  const token = await generateCheckoutToken();
  const tokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data: vendaIns, error: errVenda } = await admin
    .from("qa_vendas")
    .insert({
      cliente_id: cliLegado,
      data_cadastro: new Date().toISOString().slice(0, 10),
      status: "À INICIAR",
      valor_a_pagar: valorAPagarFinal,
      valor_aberto: valorAPagarFinal,
      cobranca_status: "nao_gerada",
      cobranca_origem: "checkout_site",
      origem_proposta: "checkout_site",
      checkout_token_hash: token.hash,
      checkout_token_expires_at: tokenExpiresAt,
      composicao_valor_final: composicaoSanit,
      valor_servicos_catalogo: valorServicosCatalogo,
      valor_servicos_aplicado: Number(valorServicosAplicadoComp.toFixed(2)),
      valor_despesas_extras: Number(valorDespesasExtras.toFixed(2)),
      valor_custo_financeiro: Number(valorCustoFinanceiro.toFixed(2)),
      valor_total_pago_cliente: Number(valorTotalPagoCliente.toFixed(2)),
      pagamento_parcelas: body.exibicao_contrato?.parcelas ?? null,
      pagamento_adquirente: body.exibicao_contrato?.adquirente
        ? String(body.exibicao_contrato.adquirente).trim().toUpperCase()
        : null,
      pagamento_valor_parcela:
        body.exibicao_contrato?.valor_parcela != null
          ? Number(body.exibicao_contrato.valor_parcela)
          : null,
      pagamento_valor_total_parcelado: isPacote ? valorTotalPagoCliente : null,
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

  // Auditoria — recompra do mesmo serviço liberada por confirmação explícita.
  // O registro é o que permite distinguir depois "segunda arma" de "clicou duas vezes".
  if (recusas.length > 0) {
    await admin.from("qa_venda_eventos").insert({
      venda_id: vendaId,
      qa_cliente_id: qaClienteId,
      cliente_id: cliLegado,
      tipo_evento: "venda_recompra_confirmada",
      descricao: "Venda criada mesmo com serviço já contratado — recompra confirmada por quem fechou o carrinho.",
      ator: userId ? "cliente_logado" : "cliente_publico",
      user_id: userId,
      dados_json: { servicos_ja_contratados: recusas },
    });
  }

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
        tipo_diferenca: exib.tipo_diferenca ?? null,
        total_catalogo_servicos:
          exib.total_catalogo_servicos != null ? Number(exib.total_catalogo_servicos) : null,
        valor_total_pago_cliente:
          exib.valor_total_pago_cliente != null ? Number(exib.valor_total_pago_cliente) : null,
        diferenca_valor:
          exib.diferenca_valor != null ? Number(exib.diferenca_valor) : null,
        custo_financeiro_adquirente:
          exib.custo_financeiro_adquirente != null
            ? Number(exib.custo_financeiro_adquirente)
            : null,
        adquirente: exib.adquirente ? String(exib.adquirente).trim().toUpperCase() : null,
        parcelas: exib.parcelas != null ? Number(exib.parcelas) : null,
        valor_parcela: exib.valor_parcela != null ? Number(exib.valor_parcela) : null,
        custos_embutidos: Array.isArray(exib.custos_embutidos)
          ? exib.custos_embutidos
              .filter((c) => c && typeof c.descricao === "string" && Number.isFinite(Number(c.valor)) && Number(c.valor) > 0)
              .map((c) => ({
                descricao: String(c.descricao).trim().toUpperCase().slice(0, 120),
                valor: Number(Number(c.valor).toFixed(2)),
              }))
          : null,
        custos_embutidos_total:
          exib.custos_embutidos_total != null ? Number(exib.custos_embutidos_total) : null,
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

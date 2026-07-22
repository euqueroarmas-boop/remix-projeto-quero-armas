/**
 * qa-gerar-procuracao
 *
 * Chamada pelo trigger trg_qa_contract_dispatch_procuracao (após o contrato
 * entrar em pending_customer_signature). Antes de gerar, consulta o HUB
 * DOCUMENTAL:
 *   1) qa_procuracoes validada e ainda vigente do mesmo cliente
 *   2) qa_documentos_cliente tipo='procuracao' aprovado e ainda vigente
 * Se achar, cria registro com status='reaproveitada' (sem pendência).
 * Senão, renderiza template vigente (codigo='PROCURACAO_PADRAO_QUERO_ARMAS')
 * resolvendo placeholders com dados do cliente + empresa.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const TEMPLATE_CODIGO = "PROCURACAO_PADRAO_QUERO_ARMAS";
const VIGENCIA_ANOS = 2;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function brDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function addYears(d: Date, n: number): Date {
  const r = new Date(d); r.setFullYear(r.getFullYear() + n); return r;
}

function renderPlaceholders(html: string, ctx: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => ctx[k.toLowerCase()] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const cliente_id: number | null = body?.cliente_id ?? null;
    const venda_id: number | null = body?.venda_id ?? null;
    if (!cliente_id) return json({ error: "cliente_id obrigatório" }, 400);

    // Já existe procuração pendente/válida para esta venda? idempotência
    const { data: jaExiste } = await sb
      .from("qa_procuracoes")
      .select("id, status")
      .eq("cliente_id", cliente_id)
      .eq("venda_id", venda_id ?? -1)
      .maybeSingle();
    if (jaExiste) return json({ ok: true, reused: false, existing: jaExiste });

    // 1) Reaproveitamento — procuração validada vigente do mesmo cliente
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: reapVal } = await sb
      .from("qa_procuracoes")
      .select("id, outorgado_ate")
      .eq("cliente_id", cliente_id)
      .eq("status", "validated")
      .or(`outorgado_ate.is.null,outorgado_ate.gte.${hoje}`)
      .order("validated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2) Reaproveitamento — hub documental (qa_documentos_cliente)
    const { data: hubDoc } = await sb
      .from("qa_documentos_cliente")
      .select("id, data_validade, arquivo_storage_path")
      .eq("qa_cliente_id", cliente_id)
      .ilike("tipo_documento", "procuracao%")
      .in("ia_status", ["sugerido", "processado"])
      .eq("validado_admin", true)
      .or(`data_validade.is.null,data_validade.gte.${hoje}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reapVal || hubDoc) {
      const { data: novo, error } = await sb
        .from("qa_procuracoes")
        .insert({
          cliente_id, venda_id,
          status: "reaproveitada",
          reaproveitada_de: reapVal?.id ?? null,
          reaproveitada_de_hub_id: hubDoc?.id ?? null,
          arquivo_assinado_path: hubDoc?.arquivo_storage_path ?? null,
          outorgado_ate: reapVal?.outorgado_ate ?? hubDoc?.data_validade ?? null,
          validated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, reused: true, id: (novo as any).id });
    }

    // 3) Gera a partir do template vigente
    const { data: tpl } = await sb
      .from("qa_contract_templates")
      .select("id, versao, corpo_html")
      .eq("codigo", TEMPLATE_CODIGO)
      .eq("vigente", true)
      .maybeSingle();
    if (!tpl) return json({ error: `Nenhum template ${TEMPLATE_CODIGO} vigente publicado` }, 422);

    // Dados do cliente
    const { data: cli } = await sb
      .from("qa_clientes")
      .select("nome_completo, cpf, rg, endereco, cidade, estado, cep")
      .eq("id", cliente_id)
      .maybeSingle();

    // Dados da empresa (fallbacks estáticos — admin configura em Preferências)
    const { data: cfg } = await sb
      .from("qa_config_geral" as any)
      .select("chave, valor")
      .in("chave", [
        "empresa_razao_social", "empresa_cnpj_completo", "empresa_representante",
        "empresa_representante_cpf", "empresa_endereco",
      ]);
    const cfgMap: Record<string, string> = {};
    for (const r of (cfg ?? []) as any[]) cfgMap[r.chave] = r.valor ?? "";

    const hojeExtenso = brDate(new Date());
    const outorgadoAte = addYears(new Date(), VIGENCIA_ANOS);

    const ctx: Record<string, string> = {
      empresa_razao_social:       cfgMap.empresa_razao_social       || "QUERO ARMAS LTDA",
      empresa_cnpj_completo:      cfgMap.empresa_cnpj_completo      || "",
      empresa_representante:      cfgMap.empresa_representante      || "Representante Legal",
      empresa_representante_cpf:  cfgMap.empresa_representante_cpf  || "",
      empresa_endereco:           cfgMap.empresa_endereco           || "",
      cliente_nome_completo:      (cli as any)?.nome_completo       || "",
      cliente_cpf:                (cli as any)?.cpf                 || "",
      cliente_rg:                 (cli as any)?.rg                  || "",
      cliente_endereco:           [(cli as any)?.endereco, (cli as any)?.cidade, (cli as any)?.estado, (cli as any)?.cep].filter(Boolean).join(", "),
      data_hoje_extenso:          hojeExtenso,
      orgaos_delegados:           "Polícia Federal, Exército Brasileiro (SIGMA), Polícia Civil e demais órgãos correlatos",
    };

    const conteudo = renderPlaceholders(tpl.corpo_html, ctx);

    const { data: novo, error } = await sb
      .from("qa_procuracoes")
      .insert({
        cliente_id, venda_id,
        template_id: (tpl as any).id,
        template_versao: (tpl as any).versao,
        status: "generated_pending_customer_signature",
        conteudo_renderizado: conteudo,
        outorgado_ate: outorgadoAte.toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, reused: false, id: (novo as any).id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

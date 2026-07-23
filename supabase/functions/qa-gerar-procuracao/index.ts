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

// Preposições minúsculas em nomes de cidades e logradouros brasileiros
const PREPS = new Set(["da", "das", "de", "do", "dos", "e", "a", "ao", "em", "na", "no"]);
function toTitleCity(s: string): string {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && PREPS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function brDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function addYears(d: Date, n: number): Date {
  const r = new Date(d); r.setFullYear(r.getFullYear() + n); return r;
}

function escHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPlaceholders(html: string, ctx: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => escHtml(ctx[k.toLowerCase()] ?? ""));
}

function first(...values: Array<unknown>): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function hasCurrentClientData(html: string, ctx: Record<string, string>): boolean {
  const plain = normalize(html.replace(/<[^>]+>/g, " "));
  const nome = normalize(ctx.cliente_nome_completo);
  const cpf = onlyDigits(ctx.cliente_cpf);
  const htmlDigits = onlyDigits(html);
  return Boolean(nome && cpf && plain.includes(nome) && htmlDigits.includes(cpf));
}

function enderecoCliente(cli: Record<string, unknown>): string {
  const linha = [
    toTitleCity(first(cli.endereco)),
    first(cli.numero) ? `nº ${first(cli.numero)}` : "",
    toTitleCity(first(cli.complemento)),
    toTitleCity(first(cli.bairro)),
    toTitleCity(first(cli.cidade)),
    first(cli.estado) ? String(cli.estado).toUpperCase() : "",
    first(cli.cep) ? `CEP ${first(cli.cep)}` : "",
    toTitleCity(first(cli.pais) || "Brasil"),
  ].filter(Boolean);
  return linha.join(", ");
}

function buildProcuracaoPadrao(ctx: Record<string, string>): string {
  const h = (key: string) => escHtml(ctx[key] ?? "");
  return `
<article class="qa-doc qa-procuracao-template">
  <header class="qa-procuracao__letterhead">
    <strong>${h("empresa_razao_social")}</strong><br />
    CNPJ: ${h("empresa_cnpj_completo")}<br />
    ${h("empresa_endereco")}
  </header>

  <h1>PROCURAÇÃO DESTINADA À POLÍCIA FEDERAL, FORÇAS ARMADAS E DELEGACIAS DE POLÍCIA</h1>

  <h2>OUTORGANTE</h2>
  <p><strong>OUTORGANTE:</strong> ${h("cliente_nome_completo")}, ${h("cliente_estado_civil") || "estado civil não informado"}, ${h("cliente_profissao") || "profissão não informada"}, portador(a) do CPF nº ${h("cliente_cpf")}, RG/CIN nº ${h("cliente_rg")}${ctx.cliente_emissor_rg ? `, expedido por ${h("cliente_emissor_rg")}` : ""}${ctx.cliente_uf_emissor_rg ? `/${h("cliente_uf_emissor_rg")}` : ""}, residente e domiciliado(a) em ${h("cliente_endereco")}, e-mail ${h("cliente_email") || "não informado"}${ctx.cliente_telefone ? `, telefone ${h("cliente_telefone")}` : ""}.</p>

  <h2>OUTORGADO(S)</h2>
  <p><strong>OUTORGADO:</strong> ${h("empresa_razao_social")}, pessoa jurídica inscrita no CNPJ sob nº ${h("empresa_cnpj_completo")}, com sede em ${h("empresa_endereco")}, neste ato representada por ${h("empresa_representante")}${ctx.empresa_representante_cpf ? `, CPF nº ${h("empresa_representante_cpf")}` : ""}.</p>

  <h2>PODERES</h2>
  <p><strong>PODERES:</strong> Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui como seu bastante procurador o OUTORGADO, a quem confere amplos, gerais e ilimitados poderes para, em seu nome, praticar os seguintes atos:</p>

  <ol class="qa-procuracao__powers">
    <li><strong>PERANTE AS DELEGACIAS DE POLÍCIA NO BRASIL:</strong> Requerer, junto a qualquer delegacia de polícia do Brasil, cópias de boletins de ocorrência e/ou quaisquer outros documentos relacionados, podendo, para tanto, assinar documentos, formular requerimentos e praticar todos os atos necessários para o fiel cumprimento deste mandato. Incluem-se, mas não se limitam a, as seguintes delegacias:
      <ul>
        <li>Delegacia de Polícia Civil</li><li>Delegacia de Polícia Federal</li><li>Delegacia de Polícia Rodoviária Federal</li><li>Delegacia de Polícia Militar</li><li>Delegacia de Crimes Cibernéticos</li><li>Delegacia de Crimes contra o Patrimônio</li><li>Delegacia de Crimes Ambientais</li><li>Delegacia de Narcóticos</li><li>Delegacia de Homicídios</li><li>Delegacia de Repressão ao Tráfico de Entorpecentes</li>
      </ul>
    </li>
    <li><strong>PERANTE O EXÉRCITO BRASILEIRO:</strong> Requerer ou responder ao Serviço de Fiscalização de Produtos Controlados do Comando de todas as Regiões Militares do Brasil (SFPCs), assinar requerimentos, termos e declarações, protocolar e retirar processos para:
      <ul>
        <li>Concessão de Certificado de Registro Pessoa Física</li><li>Primeira via de CRAF</li><li>Segunda via de CRAF</li><li>Exclusão de arma do SIGMA por distrato com fornecedor</li><li>Transferência de arma de CAC para um acervo SINARM - mesmo proprietário</li><li>Transferência de arma de militar das Forças Armadas para CAC - mesmo proprietário</li><li>Transferência de arma de militar das Forças Armadas para CAC - mudança de proprietário</li><li>Transferência de arma de militar da PM/CBM para CAC - mesmo proprietário</li><li>Transferência de arma em acervo SINARM para CAC - mudança de proprietário</li><li>Transferência de arma em acervo SINARM para CAC - mesmo proprietário</li><li>Transferência de arma de entidade de tiro para CAC</li><li>Exclusão de arma do SIGMA por entrega para destruição na campanha do desarmamento</li><li>Exclusão de arma do SIGMA por duplicidade de registro em acervo SIGMA</li><li>Exclusão de arma do SIGMA por já constar em acervo SINARM ou SIGMA</li><li>Emissão de mapa de armas em acervo SIGMA</li><li>Mudança de acervo de arma para um mesmo CAC</li><li>Transferência de arma de CAC para CAC</li><li>Correção de dados da arma de fogo</li><li>Emissão de 2ª via do CRAF</li><li>Renovação do CRAF</li><li>Inclusão de registro de arma por migração do banco antigo</li><li>Inclusão de registro de arma por autorização de anistia</li><li>Transferência de arma de CAC para um acervo SINARM - mudança de proprietário</li><li>Exclusão de arma do SIGMA por transferência para outro acervo SIGMA de militar da PM/CBM</li>
      </ul>
    </li>
    <li><strong>PERANTE A POLÍCIA FEDERAL:</strong> Requerer ao Núcleo de Controle de Armas - NUARM e Sistema Nacional de Armas para Caçadores, Atiradores Desportivos e Colecionares - SINARM CAC, em todo território nacional, requerimentos, termos e declarações, protocolar e retirar processos para autorização de compra de arma de fogo, registro e apostilamento de arma de fogo, guia de trânsito e tráfego especial, posse, porte e renovação de armas de fogo, entre outros serviços relacionados e correlacionados a arma de fogo de pessoa física ou jurídica, respondendo solidariamente pelos documentos apresentados.</li>
  </ol>

  <p>Este mandato é válido por prazo indeterminado, ou até que seja expressamente revogado pelo(a) OUTORGANTE.</p>

  <p class="qa-doc__date">Jacareí, ${h("data_hoje_extenso")}.</p>

  <div class="qa-doc__signature">
    <span>${h("cliente_nome_completo")}</span>
    <small>CPF nº ${h("cliente_cpf")}</small>
  </div>
</article>`.trim();
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
    const force_regenerate = body?.force_regenerate === true;
    if (!cliente_id) return json({ error: "cliente_id obrigatório" }, 400);

    // O template vigente precisa ser conhecido antes da idempotência. Assim,
    // procurações ainda pendentes podem acompanhar uma nova versão publicada,
    // sem alterar documentos já enviados, validados ou reaproveitados.
    const { data: tpl } = await sb
      .from("qa_contract_templates")
      .select("id, versao, corpo_html")
      .eq("codigo", TEMPLATE_CODIGO)
      .eq("vigente", true)
      .maybeSingle();
    if (!tpl) return json({ error: `Nenhum template ${TEMPLATE_CODIGO} vigente publicado` }, 422);

    // Já existe procuração para esta venda?
    let procuraExistenteQuery = sb
      .from("qa_procuracoes")
      .select("id, status, template_versao")
      .eq("cliente_id", cliente_id);
    procuraExistenteQuery = venda_id == null
      ? procuraExistenteQuery.is("venda_id", null)
      : procuraExistenteQuery.eq("venda_id", venda_id);
    const { data: jaExiste } = await procuraExistenteQuery.maybeSingle();
    const podeAtualizarPendente = Boolean(
      jaExiste
      && ["generated_pending_customer_signature", "rejected"].includes(jaExiste.status)
      && (
        force_regenerate
        || Number(jaExiste.template_versao ?? 0) < Number((tpl as any).versao ?? 0)
      ),
    );
    if (jaExiste && !podeAtualizarPendente) {
      return json({ ok: true, reused: false, existing: jaExiste });
    }

    // 1) Reaproveitamento — procuração validada vigente do mesmo cliente
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: reapVal } = jaExiste
      ? { data: null }
      : await sb
        .from("qa_procuracoes")
        .select("id, outorgado_ate")
        .eq("cliente_id", cliente_id)
        .eq("status", "validated")
        .or(`outorgado_ate.is.null,outorgado_ate.gte.${hoje}`)
        .order("validated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    // 2) Reaproveitamento — hub documental (qa_documentos_cliente)
    const { data: hubDoc } = jaExiste
      ? { data: null }
      : await sb
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

    // Dados do cliente
    const { data: cli } = await sb
      .from("qa_clientes")
      .select("id, id_legado, nome_completo, cpf, rg, emissor_rg, uf_emissor_rg, endereco, numero, complemento, bairro, cidade, estado, cep, pais, estado_civil, nacionalidade, profissao, email, celular")
      .or(`id.eq.${cliente_id},id_legado.eq.${cliente_id}`)
      .maybeSingle();
    if (!cli) return json({ error: `Cliente ${cliente_id} não encontrado para gerar procuração` }, 404);

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
      // Aliases para emissor/UF do RG (placeholders usados no template)
      cliente_rg_orgao_emissor:   toTitleCity((cli as any)?.emissor_rg    || ""),
      cliente_rg_uf_emissor:      ((cli as any)?.uf_emissor_rg            || "").toUpperCase(),
      cliente_emissor_rg:         toTitleCity((cli as any)?.emissor_rg    || ""),
      cliente_uf_emissor_rg:      ((cli as any)?.uf_emissor_rg            || "").toUpperCase(),
      cliente_estado_civil:       toTitleCity((cli as any)?.estado_civil   || ""),
      cliente_nacionalidade:      toTitleCity((cli as any)?.nacionalidade  || ""),
      cliente_profissao:          toTitleCity((cli as any)?.profissao      || ""),
      cliente_email:              ((cli as any)?.email                     || "").toLowerCase(),
      cliente_telefone:           (cli as any)?.celular             || "",
      cliente_endereco:           enderecoCliente((cli as any) ?? {}),
      cliente_endereco_completo:  enderecoCliente((cli as any) ?? {}),
      cliente_logradouro:         toTitleCity((cli as any)?.endereco       || ""),
      cliente_numero:             (cli as any)?.numero               || "",
      cliente_complemento:        toTitleCity((cli as any)?.complemento    || ""),
      cliente_bairro:             toTitleCity((cli as any)?.bairro         || ""),
      cliente_cidade:             toTitleCity((cli as any)?.cidade         || ""),
      cliente_estado:             ((cli as any)?.estado              || "").toUpperCase(),
      cliente_uf:                 ((cli as any)?.estado              || "").toUpperCase(),
      cliente_cep:                (cli as any)?.cep                  || "",
      cliente_pais:               toTitleCity((cli as any)?.pais          || ""),
      data_hoje_extenso:          hojeExtenso,
      orgaos_delegados:           "Polícia Federal, Exército Brasileiro (SIGMA), Polícia Civil e demais órgãos correlatos",
    };

    const renderizado = renderPlaceholders(tpl.corpo_html, ctx);
    const conteudo = hasCurrentClientData(renderizado, ctx)
      ? renderizado
      : buildProcuracaoPadrao(ctx);

    const payload = {
        cliente_id, venda_id,
        template_id: (tpl as any).id,
        template_versao: (tpl as any).versao,
        status: "generated_pending_customer_signature",
        conteudo_renderizado: conteudo,
        outorgado_ate: outorgadoAte.toISOString().slice(0, 10),
        arquivo_assinado_path: null,
        customer_signature_uploaded_at: null,
        validated_at: null,
        validated_by: null,
        rejection_reason: null,
        generated_at: new Date().toISOString(),
      };

    const query = jaExiste
      ? sb.from("qa_procuracoes").update(payload).eq("id", jaExiste.id)
      : sb.from("qa_procuracoes").insert(payload);
    const { data: novo, error } = await query
      .select("id")
      .single();
    if (error) return json({ error: error.message }, 500);

    return json({
      ok: true,
      reused: false,
      upgraded: Boolean(jaExiste),
      template_versao: (tpl as any).versao,
      id: (novo as any).id,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

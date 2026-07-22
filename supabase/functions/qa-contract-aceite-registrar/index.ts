// qa-contract-aceite-registrar
// Service-role: cria snapshot do contrato (qa_contracts) + log imutável
// (qa_contract_aceites_log) no momento do aceite eletrônico na Etapa 04
// do /cadastro refinado.
//
// Pipeline canônico PDF+ICP-Brasil em qa_contracts permanece INTACTO.
// Esta função apenas POPULA as colunas aditivas (template_*, conteudo_renderizado,
// aceite_*) sem alterar o status canônico do registro.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtBRL(n: number): string {
  return `R$ ${Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function substitute(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? "" : String(v);
  });
}

/**
 * Filtra <section data-anexo-slug="..."> mantendo apenas os anexos dos
 * serviços contratados. Aceita SOMENTE array de slugs (nunca string com
 * vírgula). Sem fail-open: se não houver match, substitui por aviso
 * controlado para nunca expor anexos não contratados ao cliente.
 */
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

function toRoman(value: number): string {
  const map: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let n = Math.max(1, Math.floor(value || 1));
  let out = "";
  for (const [num, roman] of map) {
    while (n >= num) {
      out += roman;
      n -= num;
    }
  }
  return out;
}

function renumberContractAnexoHeading(html: string, index: number): string {
  if (!html) return html;
  const roman = toRoman(index);
  return html.replace(
    /(<h[1-6]\b[^>]*>\s*)ANEXO\s+[IVXLCDM]+(\s*(?:&mdash;|&ndash;|---|--|—|-)\s*)/i,
    `$1ANEXO ${roman}$2`,
  );
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

function filterContractAnexosBySlugs(
  html: string,
  slugsContratados: string[],
): string {
  if (!html) return html;
  const slugs = (slugsContratados || [])
    .filter((s): s is string => typeof s === "string")
    .map((s) => normalizeContractSlug(s))
    .filter(Boolean);
  const slugSet = new Set(slugs);
  const sectionRegex =
    /<section\s+[^>]*data-anexo-slug="([^"]+)"[^>]*>[\s\S]*?<\/section>\s*/g;
  let foundAny = false;
  let kept = 0;
  let result = html.replace(sectionRegex, (full, s) => {
    foundAny = true;
    const sslug = normalizeContractSlug(String(s));
    if (slugSet.has(sslug)) {
      kept++;
      return renumberContractAnexoHeading(full, kept);
    }
    return "";
  });
  if (foundAny && kept === 0) result = result + AVISO_SEM_ANEXO_HTML;
  // Segundo passe: filtro heading-based do ANEXO I (template legado).
  // Identifica subseções <h3>I.N. ...</h3> com "Identificador (slug): xxx"
  // e remove as que NÃO foram contratadas. Sem isso, o template oficial
  // mostra TODOS os serviços, mesmo os não contratados.
  result = filterAnexoIByHeadings(result, slugSet);
  return result;
}

function filterAnexoIByHeadings(html: string, slugSet: Set<string>): string {
  const headingRegex = /<h3[^>]*>\s*I\.\d+\.[^<]*<\/h3>/g;
  const heads: { start: number; titulo: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRegex.exec(html)) !== null) {
    heads.push({
      start: m.index,
      titulo: m[0].replace(/<[^>]+>/g, "").trim(),
    });
  }
  if (heads.length === 0) return html;
  const tailRel = html.slice(heads[heads.length - 1].start).search(/<h2[^>]*>/);
  const lastEnd =
    tailRel >= 0 ? heads[heads.length - 1].start + tailRel : html.length;
  type Block = { start: number; end: number; slug: string | null };
  const blocks: Block[] = heads.map((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].start : lastEnd;
    const seg = html.slice(h.start, end);
    const slugExtraido = extractSlugFromAnexoBlock(seg);
    const slugInferido = slugExtraido ? null : inferSlugFromAnexoTitle(h.titulo);
    return {
      start: h.start,
      end,
      slug: slugExtraido || slugInferido,
    };
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

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function genContractNumber(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}${String(d.getUTCDate()).padStart(2, "0")}`;
  const rand = crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(rand).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `QA-ACEITE-${ymd}-${hex.toUpperCase()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      cliente_id,
      venda_id,
      template_codigo = "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS",
      servico_slug,
      servico_slugs,
      servico_nome,
      servico_preco,
      cliente_nome,
      cliente_cpf_cnpj,
      cliente_endereco,
      cliente_email,
      aceite_ip: aceite_ip_body,
      aceite_user_agent: aceite_ua_body,
      aceite_dispositivo,
      aceite_inicio_imediato = false,
    } = body || {};

    if (!cliente_id || !venda_id) {
      return new Response(
        JSON.stringify({ error: "cliente_id e venda_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // IP: prefer header (server side), fallback to body
    const xff = req.headers.get("x-forwarded-for") || "";
    const aceite_ip = (xff.split(",")[0]?.trim() || aceite_ip_body || null);
    const aceite_user_agent =
      req.headers.get("user-agent") || aceite_ua_body || null;

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve cliente_id para id_legado (FK fk_qa_contracts_cliente referencia qa_clientes.id_legado).
    // Aceita id real OU id_legado vindos do front; sempre persiste id_legado.
    let clienteIdLegado: number | null = null;
    {
      const cidNum = Number(cliente_id);
      if (Number.isFinite(cidNum)) {
        const { data: cliRow } = await sb
          .from("qa_clientes")
          .select("id, id_legado")
          .or(`id.eq.${cidNum},id_legado.eq.${cidNum}`)
          .maybeSingle();
        if (cliRow) {
          clienteIdLegado = (cliRow as any).id_legado ?? (cliRow as any).id;
        }
      }
      if (clienteIdLegado == null) {
        return new Response(
          JSON.stringify({ error: "cliente_id não encontrado em qa_clientes", detail: String(cliente_id) }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 1) Carrega template vigente
    const { data: tpl, error: tplErr } = await sb
      .from("qa_contract_templates")
      .select("id, codigo, versao, titulo, corpo_html")
      .eq("codigo", template_codigo)
      .eq("vigente", true)
      .maybeSingle();
    if (tplErr || !tpl) {
      return new Response(
        JSON.stringify({ error: "Template vigente não encontrado", detail: tplErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const aceite_data_iso = now.toISOString();

    // 2) Renderiza substituições
    const vars: Record<string, string> = {
      cliente_nome: esc(cliente_nome || ""),
      cliente_cpf_cnpj: esc(cliente_cpf_cnpj || ""),
      cliente_endereco: esc(cliente_endereco || ""),
      cliente_email: esc(cliente_email || ""),
      servico_slug: esc(servico_slug || ""),
      servico_nome: esc(servico_nome || ""),
      servico_preco: typeof servico_preco === "number" ? fmtBRL(servico_preco) : esc(servico_preco || ""),
      aceite_data: aceite_data_iso,
      aceite_ip: esc(aceite_ip || ""),
      aceite_user_agent: esc(aceite_user_agent || ""),
      aceite_hash: "", // hash não é embutido no corpo (autorreferente)
    };
    // Normaliza para array: prioriza servico_slugs[]; aceita servico_slug
    // único como fallback. NUNCA usa string com vírgula.
    const slugsParaFiltrar: string[] = Array.isArray(servico_slugs)
      ? servico_slugs.filter((s: unknown): s is string => typeof s === "string" && !!s.trim())
      : typeof servico_slug === "string" && servico_slug.trim()
        ? [servico_slug.trim()]
        : [];
    if (slugsParaFiltrar.length === 0) {
      console.warn(
        "[qa-contract-aceite-registrar] aceite sem servico_slug(s) — snapshot conterá aviso controlado",
      );
    }
    // Filtra o Anexo I para conter APENAS os serviços contratados (snapshot imutável)
    const corpoFiltrado = filterContractAnexosBySlugs(tpl.corpo_html, slugsParaFiltrar);
    const conteudo_renderizado = substitute(corpoFiltrado, vars);

    // 3) Hash probatório
    const aceite_hash = await sha256Hex(
      `${conteudo_renderizado}|${aceite_data_iso}|${cliente_id}`
    );

    // 4) Insere qa_contracts (status canônico padrão preservado)
    const valorNumeric =
      typeof servico_preco === "number"
        ? servico_preco
        : Number(String(servico_preco || "0").replace(/[^\d.,-]/g, "").replace(",", "."));

    const contract_number = genContractNumber();
    const { data: contract, error: cErr } = await sb
      .from("qa_contracts")
      .insert({
        venda_id,
        cliente_id: clienteIdLegado,
        contract_number,
        // status canônico fica no default da tabela ('generated_pending_company_signature')
        template_id: tpl.id,
        template_codigo: tpl.codigo,
        template_versao: tpl.versao,
        conteudo_renderizado,
        servico_slug: servico_slug || null,
        valor: Number.isFinite(valorNumeric) ? valorNumeric : null,
        aceite_eletronico_data: aceite_data_iso,
        aceite_ip,
        aceite_user_agent,
        aceite_hash,
        aceite_inicio_imediato: !!aceite_inicio_imediato,
      })
      .select("id, contract_number, status, aceite_eletronico_data, aceite_hash")
      .single();
    if (cErr || !contract) {
      return new Response(
        JSON.stringify({ error: "Falha ao registrar qa_contracts", detail: cErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5) Insere log imutável paralelo
    const { error: lErr } = await sb.from("qa_contract_aceites_log").insert({
      contract_id: contract.id,
      cliente_id,
      template_codigo: tpl.codigo,
      template_versao: tpl.versao,
      conteudo_hash: aceite_hash,
      aceite_data: aceite_data_iso,
      aceite_ip,
      aceite_user_agent,
      aceite_dispositivo: aceite_dispositivo ?? null,
      aceite_inicio_imediato: !!aceite_inicio_imediato,
    });
    // Log failure should not block contract creation (já registrado em qa_contracts).
    if (lErr) console.error("[qa-contract-aceite-registrar] log insert failed:", lErr.message);

    // Lovable Emails: notifica cliente que o contrato foi assinado.
    try {
      if (cliente_email && /^\S+@\S+\.\S+$/.test(cliente_email)) {
        const { sendTransactional } = await import("../_shared/sendTransactional.ts");
        const pdfUrl = `https://www.euqueroarmas.com.br/area-do-cliente/contratos/${contract.id}`;
        await sendTransactional({
          templateName: "contrato-assinado",
          recipientEmail: String(cliente_email).toLowerCase(),
          idempotencyKey: `contrato-assinado-${contract.id}`,
          templateData: {
            nome: undefined,
            contrato: contract.contract_number,
            pdfUrl,
          },
        });
      }
    } catch (e) {
      console.error("[qa-contract-aceite-registrar] contrato-assinado email error:", (e as Error)?.message);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        contract_id: contract.id,
        contract_number: contract.contract_number,
        aceite_hash,
        aceite_data: aceite_data_iso,
        template_codigo: tpl.codigo,
        template_versao: tpl.versao,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[qa-contract-aceite-registrar] error:", e?.message);
    return new Response(
      JSON.stringify({ error: "internal_error", detail: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

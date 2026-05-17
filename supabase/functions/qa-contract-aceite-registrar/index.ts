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
 * Filtra <section data-anexo-slug="..."> mantendo apenas o do serviço contratado.
 * Fail-open: se não houver match, devolve o HTML integral.
 */
function filterAnexoBySlug(html: string, slug: string | null | undefined): string {
  if (!html || !slug) return html;
  const sectionRegex = /<section\s+data-anexo-slug="([^"]+)">[\s\S]*?<\/section>\s*/g;
  let foundAny = false;
  let kept = 0;
  const filtered = html.replace(sectionRegex, (full, s) => {
    foundAny = true;
    if (s === slug) { kept++; return full; }
    return "";
  });
  if (!foundAny || kept === 0) return html;
  return filtered;
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
    // Filtra o Anexo I para conter APENAS o serviço contratado (snapshot imutável)
    const corpoFiltrado = filterAnexoBySlug(tpl.corpo_html, servico_slug);
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
        cliente_id,
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
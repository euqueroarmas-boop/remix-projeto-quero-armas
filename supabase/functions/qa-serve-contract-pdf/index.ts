/**
 * qa-serve-contract-pdf — BLOCO 10 / Pass B
 *
 * Stream autenticado de contratos Quero Armas.
 *
 * Para contratos pós-pagamento com `conteudo_renderizado`, o documento
 * correto é o snapshot HTML do template canônico. O PDF físico legado em
 * `original_pdf_path` ou `company_signed_pdf_path` pode ter sido gerado pelo
 * renderizador antigo e ficar com cara de recibo; por isso ele não deve ser a
 * primeira opção para o cliente.
 *
 * Bucket NÃO é público.
 *
 * Acesso:
 *  - Equipe Quero Armas (qa_usuarios_perfis ativo) → qualquer contrato.
 *  - Cliente (JWT auth) → apenas contratos cujo cliente_id corresponde a ele.
 *
 * Variantes (?variant=):
 *  - "company_signed" (padrão p/ cliente): exige status >= pending_customer_signature.
 *  - "customer_signed": exige customer_signed_pdf_path.
 *  - "original": apenas staff.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "paid-contracts";

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function authUser(req: Request): Promise<{ userId: string; email: string | null } | null> {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  try {
    const u = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data, error } = await u.auth.getUser(token);
    if (error || !data?.user) return null;
    return { userId: data.user.id, email: data.user.email ?? null };
  } catch { return null; }
}

function jsonResp(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function substitute(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

async function sha256Text(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function requestIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    null
  );
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

function contractDownloadFilename(contract: any, ext: "html" | "pdf"): string {
  const numero = fileSafeName(contract.contract_number || contract.id || "Contrato");
  const cliente = shortPersonName(contract.cliente_nome || "");
  const base = cliente
    ? `${numero} - Contrato de Adesao Quero Armas - ${cliente}`
    : `${numero} - Contrato de Adesao Quero Armas`;
  return `${base}.${ext}`;
}

function sanitizeTechnicalJargon(html: string): string {
  if (!html) return html;
  return html
    .replace(/Identificador\s*\(\s*slug\s*\)\s*:?/gi, "Identificador:")
    .replace(/\(\s*slug\s*\)/gi, "")
    .replace(/<li[^>]*>\s*slug[^<]*<\/li>/gi, "")
    .replace(/\bslug\s*:\s*[a-z0-9_-]+/gi, "");
}

function printableContractHtml(contract: any, html: string): string {
  const title = `Contrato ${contract.contract_number || contract.id} — Quero Armas`;
  const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const aceiteData = contract.aceite_eletronico_data
    ? new Date(contract.aceite_eletronico_data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";
  const rodape =
    `Documento gerado em ${escapeHtml(generatedAt)} · ` +
    `Contrato ${escapeHtml(contract.contract_number || contract.id)} · ` +
    `Pedido ${escapeHtml(String(contract.venda_id || "—"))} · ` +
    `Aceite eletrônico ${escapeHtml(aceiteData)} · ` +
    `IP ${escapeHtml(contract.aceite_ip || "—")} · ` +
    `Dispositivo ${escapeHtml(contract.aceite_user_agent || "—")} · ` +
    `Hash ${escapeHtml(contract.aceite_hash || "—")} · ` +
    `Template ${escapeHtml(contract.template_codigo || "—")} v${escapeHtml(String(contract.template_versao ?? "—"))}.`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  @page{size:A4;margin:18mm 16mm;}
  *{box-sizing:border-box;}
  body{font-family:Georgia,'Times New Roman',serif;color:#0a0a0a;max-width:780px;margin:32px auto;padding:0 24px;line-height:1.65;font-size:13px;background:#fff;}
  h1{font-size:18px;text-align:center;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 22px;}
  h2,h3{font-size:13px;text-transform:uppercase;letter-spacing:0.04em;margin-top:24px;}
  p{margin:10px 0;text-align:justify;}
  ul,ol{padding-left:22px;} li{margin:6px 0;}
  section[data-anexo-slug]{break-inside:avoid;}
  .qa-ref-contract-anexo,.qa-anexo-aviso{background:#fdecee;border-left:3px solid #7a1f2b;padding:8px 12px;}
  .qa-print-actions{position:sticky;top:0;display:flex;gap:10px;justify-content:flex-end;margin:-8px 0 22px;padding:10px 0;background:rgba(255,255,255,.95);border-bottom:1px solid #eee;}
  .qa-print-actions button{border:1px solid #7a1f2b;background:#7a1f2b;color:#fff;border-radius:4px;padding:9px 14px;font:700 12px system-ui;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;}
  .qa-print-note{font:12px system-ui;color:#555;margin:0 auto 18px;max-width:780px;}
  .qa-rodape-probatorio{margin-top:36px;padding-top:14px;border-top:0.5px solid rgba(0,0,0,0.2);font-size:10.5px;color:#4a4a4a;text-align:left;}
  @media print{
    body{max-width:none;margin:0;padding:0;}
    .qa-print-actions,.qa-print-note{display:none!important;}
  }
</style></head><body>
<div class="qa-print-actions"><button type="button" onclick="window.print()">Salvar/assinar em PDF</button></div>
<p class="qa-print-note">Este é o contrato completo. Para assinar pelo GOV.BR ou certificado ICP-Brasil, use "Salvar/assinar em PDF".</p>
${sanitizeTechnicalJargon(html)}
<div class="qa-rodape-probatorio">${rodape}</div>
</body></html>`;
}

async function ensureRenderedContractAudit(sb: ReturnType<typeof svc>, req: Request, contract: any) {
  let html = String(contract.conteudo_renderizado || "");

  if (html.includes("{{")) {
    const { data: cliente } = await sb
      .from("qa_clientes")
      .select("nome_completo, cpf, email, celular, endereco, numero, complemento, bairro, cidade, estado, cep")
      .eq("id_legado", contract.cliente_id)
      .maybeSingle();
    const enderecoCliente = cliente
      ? [
          (cliente as any).endereco,
          (cliente as any).numero ? `nº ${(cliente as any).numero}` : null,
          (cliente as any).complemento,
          (cliente as any).bairro,
          (cliente as any).cidade && (cliente as any).estado ? `${(cliente as any).cidade}/${(cliente as any).estado}` : (cliente as any).cidade,
          (cliente as any).cep ? `CEP ${(cliente as any).cep}` : null,
        ].filter(Boolean).join(", ")
      : "";
    html = substitute(html, {
      cliente_nome: escapeHtml((cliente as any)?.nome_completo || ""),
      cliente_cpf_cnpj: escapeHtml((cliente as any)?.cpf || ""),
      cliente_endereco: escapeHtml(enderecoCliente),
      cliente_email: escapeHtml((cliente as any)?.email || ""),
      cliente_telefone: escapeHtml((cliente as any)?.celular || ""),
      servico_slug: escapeHtml(contract.servico_slug || ""),
      servico_nome: "",
      servico_preco: contract.valor != null
        ? `R$ ${Number(contract.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "",
      aceite_data: contract.aceite_eletronico_data || "",
      aceite_ip: escapeHtml(contract.aceite_ip || ""),
      aceite_user_agent: escapeHtml(contract.aceite_user_agent || ""),
      aceite_hash: escapeHtml(contract.aceite_hash || ""),
    });

    if ((cliente as any)?.nome_completo) {
      contract.cliente_nome = (cliente as any).nome_completo;
    }
  }

  if (!contract.cliente_nome) {
    const { data: clienteNome } = await sb
      .from("qa_clientes")
      .select("nome_completo")
      .eq("id_legado", contract.cliente_id)
      .maybeSingle();
    contract.cliente_nome = (clienteNome as any)?.nome_completo || null;
  }

  const missingAudit =
    !contract.aceite_eletronico_data ||
    !contract.aceite_ip ||
    !contract.aceite_user_agent ||
    !contract.aceite_hash ||
    html !== contract.conteudo_renderizado;

  if (!missingAudit) return { ...contract, conteudo_renderizado: html };

  const aceiteData = contract.aceite_eletronico_data || new Date().toISOString();
  const aceiteIp = contract.aceite_ip || requestIp(req);
  const aceiteUserAgent = contract.aceite_user_agent || req.headers.get("user-agent") || null;
  const aceiteHash = contract.aceite_hash || await sha256Text(`${html}|${aceiteData}|${contract.cliente_id}`);
  const patch = {
    conteudo_renderizado: html,
    aceite_eletronico_data: aceiteData,
    aceite_ip: aceiteIp,
    aceite_user_agent: aceiteUserAgent,
    aceite_hash: aceiteHash,
  };

  await sb.from("qa_contracts").update(patch).eq("id", contract.id);
  await sb.from("qa_contract_events").insert({
    contract_id: contract.id,
    event_type: "aceite_eletronico_registrado_download_portal",
    event_payload: {
      aceite_eletronico_data: aceiteData,
      aceite_ip: aceiteIp,
      user_agent_present: !!aceiteUserAgent,
      aceite_hash: aceiteHash,
    },
  });

  return { ...contract, ...patch };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const user = await authUser(req);
  if (!user) return jsonResp({ error: "Unauthorized" }, 401);

  const sb = svc();

  // Resolve perfil + cliente
  const [{ data: perfil }, { data: link }] = await Promise.all([
    sb.from("qa_usuarios_perfis").select("perfil, ativo").eq("user_id", user.userId).eq("ativo", true).maybeSingle(),
    sb.from("cliente_auth_links").select("qa_cliente_id, status").eq("user_id", user.userId).eq("status", "active").maybeSingle(),
  ]);
  const isStaff = !!perfil;
  const clienteId = (link as any)?.qa_cliente_id ?? null;

  let contractId: string | null = null;
  let vendaId: number | null = null;
  let variant = "company_signed";

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      contractId = body.contract_id ?? null;
      vendaId = body.venda_id ? Number(body.venda_id) : null;
      variant = body.variant || variant;
    } else {
      const u = new URL(req.url);
      contractId = u.searchParams.get("contract_id");
      const v = u.searchParams.get("venda_id");
      vendaId = v ? Number(v) : null;
      variant = u.searchParams.get("variant") || variant;
    }
  } catch { /* ignore */ }

  if (!contractId && !vendaId) return jsonResp({ error: "contract_id ou venda_id obrigatório" }, 400);

  let q = sb.from("qa_contracts").select(
    "id, venda_id, cliente_id, status, original_pdf_path, company_signed_pdf_path, customer_signed_pdf_path, contract_number, conteudo_renderizado, template_codigo, template_versao, servico_slug, valor, aceite_eletronico_data, aceite_ip, aceite_user_agent, aceite_hash"
  );
  if (contractId) q = q.eq("id", contractId);
  else q = q.eq("venda_id", vendaId!);
  const { data: contract } = await q.maybeSingle();
  if (!contract) return jsonResp({ error: "Contrato não encontrado" }, 404);

  // Ownership
  if (!isStaff) {
    if (!clienteId || (contract as any).cliente_id !== clienteId) {
      return jsonResp({ error: "Acesso negado" }, 403);
    }
    if (variant === "original") variant = "company_signed";
  }

  const auditedContract = await ensureRenderedContractAudit(sb, req, contract as any);
  const html = auditedContract.conteudo_renderizado as string | null;
  const canServeRenderedHtml =
    variant !== "customer_signed" &&
    html &&
    html.trim();

  if (canServeRenderedHtml) {
    const fname = contractDownloadFilename(auditedContract, "html");
    return new Response(printableContractHtml(auditedContract as any, html), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${fname}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  let path: string | null = null;
  if (variant === "original") path = (auditedContract as any).original_pdf_path ?? null;
  else if (variant === "customer_signed") path = (auditedContract as any).customer_signed_pdf_path ?? null;
  else {
    // Contrato de adesão: cliente pode baixar assim que o contrato é emitido.
    // Este caminho só é usado quando não há snapshot HTML canônico.
    path = (auditedContract as any).company_signed_pdf_path ?? (auditedContract as any).original_pdf_path ?? null;
  }

  if (!path) {
    // Fallback contrato de adesão: sem PDF físico, devolve o snapshot HTML
    // renderizado (conteudo_renderizado) como documento baixável.
    if (variant !== "customer_signed" && html && html.trim()) {
      const fname = contractDownloadFilename(auditedContract, "html");
      const body = printableContractHtml(auditedContract as any, html);
      return new Response(body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="${fname}"`,
          "Cache-Control": "private, max-age=60",
        },
      });
    }
    return jsonResp({ error: "PDF indisponível para esta variante" }, 404);
  }

  const { data: file, error: dlErr } = await sb.storage.from(BUCKET).download(path);
  if (dlErr || !file) return jsonResp({ error: "Falha ao baixar arquivo", detail: dlErr?.message }, 500);

  const bytes = await file.arrayBuffer();
  const fname = contractDownloadFilename(auditedContract, "pdf");
  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fname}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
});

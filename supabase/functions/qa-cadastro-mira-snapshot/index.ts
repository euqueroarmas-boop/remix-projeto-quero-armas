// qa-cadastro-mira-snapshot
// ----------------------------------------------------------------------------
// Cria/atualiza um snapshot operacional do fluxo /cadastro Mira em
// public.qa_cadastro_publico com origem_cadastro = 'cadastro_mira', para que o
// novo fluxo apareça na fila "Novos Cadastros Recebidos" da Equipe Quero Armas,
// igual ao cadastro público legado (caso Leonardo Madruga).
//
// IMPORTANTE — esta função:
//  - NÃO toca em qa-checkout-*, qa-asaas-webhook, qa-generate-contract,
//    qa-provisionar-acesso-portal nem post-purchase.ts;
//  - NÃO cria nem altera qa_clientes (apenas grava cliente_id_vinculado
//    quando já existir);
//  - NÃO toca WMTi (customers/payments/contracts/quotes);
//  - NÃO bloqueia Arsenal — Arsenal continua gratuito;
//  - NÃO altera substituição documental não-destrutiva.
// ----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const STATUS_PERMITIDOS = [
  "em_preenchimento",
  "documentos_enviados",
  "revisao_cliente",
  "aguardando_pagamento",
  "concluido",
  "abandonado",
] as const;

const STATUS_EM_ANDAMENTO = new Set<string>([
  "em_preenchimento",
  "documentos_enviados",
  "revisao_cliente",
  "aguardando_pagamento",
]);

const Schema = z.object({
  snapshot_id: z.string().uuid().optional().nullable(),
  status: z.enum(STATUS_PERMITIDOS),

  // Dados pessoais
  nome_completo: z.string().min(1).max(200),
  cpf: z.string().min(1).max(20),
  email: z.string().email().max(255),
  telefone_principal: z.string().min(1).max(20),
  data_nascimento: z.string().max(20).optional().nullable(),

  // Endereço
  end1_cep: z.string().max(15).optional().nullable(),
  end1_logradouro: z.string().max(300).optional().nullable(),
  end1_numero: z.string().max(20).optional().nullable(),
  end1_complemento: z.string().max(200).optional().nullable(),
  end1_bairro: z.string().max(120).optional().nullable(),
  end1_cidade: z.string().max(120).optional().nullable(),
  end1_estado: z.string().max(2).optional().nullable(),

  // Intenção / serviço
  objetivo_principal: z.string().max(120).optional().nullable(),
  servico_interesse: z.string().max(200).optional().nullable(),
  servico_principal: z.string().max(200).optional().nullable(),
  catalogo_slug: z.string().max(200).optional().nullable(),

  // Documentos (paths já enviados ao storage no fluxo real — sem reupload)
  documento_identidade_path: z.string().max(500).optional().nullable(),
  comprovante_endereco_path: z.string().max(500).optional().nullable(),
  selfie_path: z.string().max(500).optional().nullable(),

  // Vínculos
  cliente_id_vinculado: z.string().uuid().optional().nullable(),
  venda_id: z.union([z.string(), z.number()]).optional().nullable(),

  // Contexto livre (vai para observacoes — não há coluna JSON livre na tabela)
  contexto: z.record(z.unknown()).optional().nullable(),
});

function cpfDigits(v: string) { return (v || "").replace(/\D/g, ""); }
function emailNorm(v: string) { return (v || "").trim().toLowerCase(); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "invalid_payload", details: parsed.error.flatten() }, 400);
  }
  const p = parsed.data;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "server_misconfigured" }, 500);
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const cpf = cpfDigits(p.cpf);
  const email = emailNorm(p.email);

  // Monta contexto textual curto p/ observacoes (não existe coluna JSON livre)
  const obsLines: string[] = ["[cadastro_mira]"];
  if (p.objetivo_principal) obsLines.push(`objetivo=${p.objetivo_principal}`);
  if (p.catalogo_slug) obsLines.push(`slug=${p.catalogo_slug}`);
  if (p.venda_id != null) obsLines.push(`venda_id=${p.venda_id}`);
  if (p.contexto) {
    try { obsLines.push(`ctx=${JSON.stringify(p.contexto).slice(0, 1500)}`); } catch { /* noop */ }
  }
  const observacoes = obsLines.join(" | ").slice(0, 1900);

  const row: Record<string, unknown> = {
    nome_completo: p.nome_completo,
    cpf,
    email,
    telefone_principal: p.telefone_principal,
    data_nascimento: p.data_nascimento ?? null,
    end1_cep: p.end1_cep ?? null,
    end1_logradouro: p.end1_logradouro ?? null,
    end1_numero: p.end1_numero ?? null,
    end1_complemento: p.end1_complemento ?? null,
    end1_bairro: p.end1_bairro ?? null,
    end1_cidade: p.end1_cidade ?? null,
    end1_estado: p.end1_estado ? p.end1_estado.toUpperCase().slice(0, 2) : null,
    objetivo_principal: p.objetivo_principal ?? null,
    servico_interesse: p.servico_interesse ?? null,
    servico_principal: p.servico_principal ?? null,
    documento_identidade_path: p.documento_identidade_path ?? null,
    comprovante_endereco_path: p.comprovante_endereco_path ?? null,
    selfie_path: p.selfie_path ?? null,
    cliente_id_vinculado: p.cliente_id_vinculado ?? null,
    origem_cadastro: "cadastro_mira",
    status: p.status,
    observacoes,
  };

  // Remove chaves null para não sobrescrever valores anteriores num UPDATE
  // (preserva paths/cidade/etc. já gravados em chamadas anteriores).
  const rowForUpdate: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && v !== undefined && v !== "") rowForUpdate[k] = v;
  }
  // status e origem_cadastro são sempre persistidos
  rowForUpdate.status = p.status;
  rowForUpdate.origem_cadastro = "cadastro_mira";

  try {
    // 1) Se snapshot_id veio do cliente, atualiza essa linha (idempotente).
    if (p.snapshot_id) {
      const { data, error } = await supabase
        .from("qa_cadastro_publico")
        .update(rowForUpdate)
        .eq("id", p.snapshot_id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (data?.id) return json({ ok: true, snapshot_id: data.id, action: "updated" });
      // se id inválido, cai para fluxo de busca por CPF
    }

    // 2) Dedupe: já existe snapshot Mira em andamento para esse CPF/email?
    const inAndamento = Array.from(STATUS_EM_ANDAMENTO);
    const { data: existing, error: findErr } = await supabase
      .from("qa_cadastro_publico")
      .select("id, status, created_at")
      .eq("origem_cadastro", "cadastro_mira")
      .or(`cpf.eq.${cpf},email.eq.${email}`)
      .in("status", inAndamento)
      .order("created_at", { ascending: false })
      .limit(1);
    if (findErr) throw findErr;
    const candidate = existing?.[0];
    if (candidate?.id) {
      const { error: updErr } = await supabase
        .from("qa_cadastro_publico")
        .update(rowForUpdate)
        .eq("id", candidate.id);
      if (updErr) throw updErr;
      return json({ ok: true, snapshot_id: candidate.id, action: "updated_existing" });
    }

    // 3) Insere novo snapshot
    const insertRow: Record<string, unknown> = { ...row };
    // tipo_documento_identidade tem default 'RG' e CHECK — não setamos aqui
    const { data: inserted, error: insErr } = await supabase
      .from("qa_cadastro_publico")
      .insert(insertRow)
      .select("id")
      .single();
    if (insErr) throw insErr;

    // 4) Pós-insert: arquiva qualquer duplicata em andamento gerada em corrida
    //     (mesmo CPF + origem_cadastro), mantendo apenas a linha recém-criada.
    try {
      await supabase
        .from("qa_cadastro_publico")
        .update({
          arquivado: true,
          arquivado_em: new Date().toISOString(),
          motivo_arquivamento: "duplicado_auto_dedupe",
        })
        .eq("cpf", cpf)
        .eq("origem_cadastro", "cadastro_mira")
        .neq("id", inserted.id)
        .in("status", Array.from(STATUS_EM_ANDAMENTO))
        .eq("arquivado", false);
    } catch (e) {
      console.warn("[qa-cadastro-mira-snapshot] pos-dedupe falhou (best-effort):", (e as Error)?.message);
    }

    return json({ ok: true, snapshot_id: inserted.id, action: "inserted" });
  } catch (e: any) {
    console.error("[qa-cadastro-mira-snapshot] erro:", e?.message || e);
    return json({ error: "snapshot_failed", message: String(e?.message || e) }, 500);
  }
});
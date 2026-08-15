// qa-sofer-dossie
//
// Ponte entre o banco e o SOFER — o agente local de protocolo que roda na
// máquina do operador (Playwright + LLM local, fora do Lovable).
//
// Por que esta função existe:
//   O SOFER precisa dos dados do cliente e dos documentos para protocolar no
//   SINARM/SisGCorp, mas NÃO pode ter a SUPABASE_SERVICE_ROLE_KEY na máquina
//   local (ela não é extraível do Lovable, e não deveria sair de lá de todo
//   jeito). Esta função roda no Supabase, usa o service role INTERNAMENTE e
//   devolve:
//     1. JSON estruturado com os campos do formulário da PF
//     2. Signed URLs de curta duração para baixar os documentos
//
// Autenticação: `requireAdminOrInternal` — mesmo padrão de
// qa-processo-doc-validar-ia e outras. O SOFER manda o header
// `x-internal-token`.
//
// IMPORTANTE — precedência de endereço NÃO é decidida aqui.
// Quando `endereco_em_nome_de_terceiro` é true, existem dois endereços
// possíveis (o do cliente e o do responsável). A função devolve OS DOIS e
// marca `requer_decisao_humana: true`. Escolher qual vai para a PF é regra
// de negócio e cabe ao operador, não ao código.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrInternal, internalCorsHeaders } from "../_shared/internalAuth.ts";

const BUCKET_PADRAO = "qa-processo-docs";
const BUCKET_FALLBACK = "qa-documentos";
const SIGNED_URL_TTL_S = 600; // 10 min — tempo de baixar, não de guardar.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...internalCorsHeaders, "Content-Type": "application/json" },
  });
}

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Monta o bloco de endereço a partir de um prefixo de colunas. */
function blocoEndereco(c: Record<string, unknown>, p: "" | "2" | "responsavel_endereco_") {
  if (p === "responsavel_endereco_") {
    return {
      logradouro: c.responsavel_endereco_logradouro ?? null,
      numero: c.responsavel_endereco_numero ?? null,
      complemento: c.responsavel_endereco_complemento ?? null,
      bairro: c.responsavel_endereco_bairro ?? null,
      cidade: c.responsavel_endereco_cidade ?? null,
      estado: c.responsavel_endereco_estado ?? null,
      cep: soDigitos(c.responsavel_endereco_cep) || null,
      titular_nome: c.responsavel_endereco_nome ?? null,
      titular_cpf: soDigitos(c.responsavel_endereco_cpf) || null,
      titular_vinculo: c.responsavel_endereco_vinculo ?? null,
    };
  }
  return {
    logradouro: c[`endereco${p}`] ?? null,
    numero: c[`numero${p}`] ?? null,
    complemento: c[`complemento${p}`] ?? null,
    bairro: c[`bairro${p}`] ?? null,
    cidade: c[`cidade${p}`] ?? null,
    estado: c[`estado${p}`] ?? null,
    cep: soDigitos(c[`cep${p}`]) || null,
    pais: c[`pais${p}`] ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: internalCorsHeaders });

  const guard = await requireAdminOrInternal(req);
  if (!guard.ok) return guard.response;

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return json({ error: "Corpo JSON inválido." }, 400);
  }

  const { cpf, cliente_id, processo_id } = corpo as {
    cpf?: string; cliente_id?: number; processo_id?: string;
  };
  if (!cpf && !cliente_id && !processo_id) {
    return json({ error: "Informe cpf, cliente_id ou processo_id." }, 400);
  }

  const db = svc();

  // ── 1. Cliente ─────────────────────────────────────────────────────────
  let q = db.from("qa_clientes").select("*").eq("excluido", false).limit(2);
  if (cliente_id) q = q.eq("id", cliente_id);
  else if (cpf) q = q.eq("cpf", soDigitos(cpf));
  else {
    const { data: proc } = await db
      .from("qa_processos").select("customer_id").eq("id", processo_id!).maybeSingle();
    if (!proc?.customer_id) return json({ error: "Processo não encontrado." }, 404);
    q = q.eq("customer_id", proc.customer_id);
  }

  const { data: clientes, error: errCli } = await q;
  if (errCli) return json({ error: `Falha ao buscar cliente: ${errCli.message}` }, 500);
  if (!clientes?.length) return json({ error: "Cliente não encontrado." }, 404);
  if (clientes.length > 1) {
    return json({ error: "Mais de um cliente para o mesmo critério.", ids: clientes.map((c) => c.id) }, 409);
  }
  const c = clientes[0] as Record<string, unknown>;

  // ── 2. Documentos + signed URLs ────────────────────────────────────────
  const { data: docs } = await db
    .from("qa_documentos_cliente")
    .select(
      "id, nome_documento, tipo_documento, arquivo_storage_path, arquivo_nome, arquivo_mime, " +
        "data_emissao, data_validade, numero_documento, numero_cad_sinarm, numero_registro_sigma, " +
        "orgao_emissor, ia_status, ia_dados_extraidos, aprovado_em, motivo_reprovacao",
    )
    .eq("customer_id", c.customer_id)
    .not("arquivo_storage_path", "is", null);

  const documentos = [];
  for (const d of docs ?? []) {
    let url: string | null = null;
    let bucket = BUCKET_PADRAO;
    for (const b of [BUCKET_PADRAO, BUCKET_FALLBACK]) {
      const { data: s } = await db.storage.from(b).createSignedUrl(d.arquivo_storage_path!, SIGNED_URL_TTL_S);
      if (s?.signedUrl) { url = s.signedUrl; bucket = b; break; }
    }
    documentos.push({
      id: d.id,
      tipo: d.tipo_documento,
      nome: d.nome_documento,
      arquivo_nome: d.arquivo_nome,
      mime: d.arquivo_mime,
      data_emissao: d.data_emissao,
      data_validade: d.data_validade,
      numero_documento: d.numero_documento,
      numero_cad_sinarm: d.numero_cad_sinarm,
      numero_registro_sigma: d.numero_registro_sigma,
      orgao_emissor: d.orgao_emissor,
      ia_status: d.ia_status,
      ia_dados_extraidos: d.ia_dados_extraidos,
      aprovado: !!d.aprovado_em,
      motivo_reprovacao: d.motivo_reprovacao,
      bucket,
      signed_url: url,
      signed_url_expira_em: new Date(Date.now() + SIGNED_URL_TTL_S * 1000).toISOString(),
    });
  }

  // ── 3. Endereço: expõe as opções, NÃO escolhe ──────────────────────────
  const terceiro = c.endereco_em_nome_de_terceiro === true;
  const enderecos: Record<string, unknown> = { principal: blocoEndereco(c, "") };
  if (c.endereco2) enderecos.secundario = blocoEndereco(c, "2");
  if (terceiro || c.responsavel_endereco_nome) {
    enderecos.responsavel = blocoEndereco(c, "responsavel_endereco_");
  }

  // ── 4. Dossiê ──────────────────────────────────────────────────────────
  return json({
    gerado_em: new Date().toISOString(),
    via: guard.via,

    cliente: {
      id: c.id,
      customer_id: c.customer_id,
      nome_completo: c.nome_completo,
      cpf: soDigitos(c.cpf),
      rg: c.rg,
      numero_documento_identidade: c.numero_documento_identidade,
      emissor_rg: c.emissor_rg,
      expedicao_rg: c.expedicao_rg,
      data_nascimento: c.data_nascimento,
      sexo: c.sexo,
      estado_civil: c.estado_civil,
      escolaridade: c.escolaridade,
      profissao: c.profissao,
      nome_mae: c.nome_mae,
      nome_pai: c.nome_pai,
      nacionalidade: c.nacionalidade,
      naturalidade_municipio: c.naturalidade_municipio ?? c.naturalidade,
      naturalidade_uf: c.naturalidade_uf,
      naturalidade_pais: c.naturalidade_pais,
      email: c.email,
      celular: soDigitos(c.celular) || null,
      cnh: c.cnh,
      pis_pasep: c.pis_pasep,
      ctps: c.ctps,
      categoria_titular: c.categoria_titular,
      subcategoria: c.subcategoria,
    },

    enderecos,

    ocupacao_licita: {
      atividade: c.ocupacao_licita_atividade,
      razao_social: c.ocupacao_licita_razao_social,
      nome_fantasia: c.ocupacao_licita_nome_fantasia,
      cnpj: soDigitos(c.ocupacao_licita_cnpj) || null,
      telefone: soDigitos(c.ocupacao_licita_telefone) || null,
      logradouro: c.ocupacao_licita_logradouro,
      numero: c.ocupacao_licita_numero,
      complemento: c.ocupacao_licita_complemento,
      bairro: c.ocupacao_licita_bairro,
      cidade: c.ocupacao_licita_cidade,
      estado: c.ocupacao_licita_estado,
      cep: soDigitos(c.ocupacao_licita_cep) || null,
    },

    documentos,

    // Sinalizadores para o SOFER parar e perguntar em vez de assumir.
    alertas: {
      endereco_em_nome_de_terceiro: terceiro,
      requer_decisao_humana: terceiro,
      homologacao_status: c.homologacao_status,
      recadastramento_obrigatorio: c.recadastramento_obrigatorio,
      documentos_sem_url: documentos.filter((d) => !d.signed_url).map((d) => d.id),
      documentos_nao_aprovados: documentos.filter((d) => !d.aprovado).map((d) => d.id),
    },
  });
});

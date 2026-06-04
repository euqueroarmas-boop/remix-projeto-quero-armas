// ============================================================================
// qa-clube-sugerir
// ----------------------------------------------------------------------------
// Recebe os dados de clube + filiação JÁ REVISADOS pelo cliente (origem:
// catálogo interno, declaração extraída ou preenchimento manual) e persiste:
//
//   1. qa_processos.respostas_questionario_json.template_data
//      (preenchimento do template para o motor de geração .docx)
//
//   2. qa_clientes.numero_filiacao / validade_filiacao / clube_atual_id
//      (apenas se ainda estiverem vazios — não sobrescreve)
//
//   3. qa_clubes (apenas via service role, NUNCA por RLS direto do cliente)
//      - se já existe clube com mesmo CNPJ e status_verificacao = verificado:
//        não sobrescreve; registra divergência em template_data.clube_divergencia.
//      - se existe e está pendente_revisao: atualiza apenas campos vazios.
//      - se não existe: cria novo como origem='declaracao_filiacao_cliente'
//        + status_verificacao='pendente_revisao'.
//
// Segurança:
//   - valida que o processo pertence ao cliente autenticado.
//   - cliente NUNCA marca clube como verificado.
//   - cliente NUNCA escreve direto em qa_clubes — só por esta edge.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function s(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function parseDateAny(v: string): string | null {
  const t = s(v);
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // DDMMYYYY puro (ex: 27052030)
  const d8 = t.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (d8) return `${d8[3]}-${d8[2]}-${d8[1]}`;
  // YYYYMMDD puro
  const y8 = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (y8) return `${y8[1]}-${y8[2]}-${y8[3]}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.slice(7).trim();
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !u?.user?.id) return json({ error: "invalid_token" }, 401);
    const authUserId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const processoId = s(body?.processo_id);
    const clube = (body?.clube ?? {}) as Record<string, unknown>;
    const filiacao = (body?.filiacao ?? {}) as Record<string, unknown>;
    const clubeIdSelecionado = body?.clube_id_selecionado != null
      ? Number(body.clube_id_selecionado)
      : null;
    const documentoIdOrigem = s(body?.documento_id_origem) || null;
    const origem = (s(body?.origem) || "manual") as
      | "manual"
      | "declaracao_filiacao_cliente"
      | "catalogo_interno";

    if (!processoId) return json({ error: "processo_id_required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Resolve cliente do usuário autenticado.
    const { data: cliente, error: cErr } = await admin
      .from("qa_clientes")
      .select("id, user_id, excluido, numero_filiacao, validade_filiacao, clube_atual_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (cErr) return json({ error: cErr.message }, 500);
    if (!cliente) return json({ error: "cliente_nao_vinculado" }, 404);
    if (cliente.excluido) return json({ error: "cliente_excluido" }, 403);

    // Valida ownership do processo.
    const { data: processo, error: pErr } = await admin
      .from("qa_processos")
      .select("id, cliente_id, respostas_questionario_json")
      .eq("id", processoId)
      .maybeSingle();
    if (pErr) return json({ error: pErr.message }, 500);
    if (!processo) return json({ error: "processo_nao_encontrado" }, 404);
    if (Number(processo.cliente_id) !== Number(cliente.id)) {
      return json({ error: "processo_nao_pertence_ao_cliente" }, 403);
    }

    // Normaliza dados do clube.
    const cnpjDig = onlyDigits(s(clube.cnpj));
    const clubeNorm = {
      nome_clube: s(clube.nome) || s(clube.nome_clube),
      cnpj: cnpjDig || null,
      numero_cr: s(clube.numero_cr) || null,
      data_validade: parseDateAny(s(clube.data_cr) || s(clube.data_validade) || s(clube.validade_cr)),
      endereco: s(clube.endereco) || null,
      cidade: s(clube.cidade) || null,
      estado: (s(clube.uf) || s(clube.estado)).toUpperCase().slice(0, 2) || null,
    };

    let clubeId: number | null = clubeIdSelecionado || null;
    let divergencia: Record<string, unknown> | null = null;
    let clubeStatus: "verificado" | "pendente_revisao" | null = null;

    if (clubeId) {
      // Cliente selecionou clube do catálogo — não cria nem altera.
      const { data: existente } = await admin
        .from("qa_clubes")
        .select("id, nome_clube, cnpj, numero_cr, status_verificacao")
        .eq("id", clubeId)
        .maybeSingle();
      if (!existente) return json({ error: "clube_selecionado_invalido" }, 404);
      clubeStatus = (existente.status_verificacao as any) || "verificado";

      // Se a declaração trouxe dados divergentes, registra divergência.
      if (cnpjDig && existente.cnpj && onlyDigits(existente.cnpj) !== cnpjDig) {
        divergencia = {
          tipo: "cnpj_divergente",
          clube_selecionado: { id: existente.id, cnpj: existente.cnpj, nome: existente.nome_clube },
          declaracao: clubeNorm,
          registrado_em: new Date().toISOString(),
        };
      }
    } else if (cnpjDig) {
      // Procura por CNPJ.
      const { data: existente } = await admin
        .from("qa_clubes")
        .select("id, nome_clube, cnpj, numero_cr, data_validade, endereco, cidade, estado, status_verificacao")
        .eq("cnpj", cnpjDig)
        .maybeSingle();

      if (existente) {
        clubeId = existente.id as number;
        clubeStatus = (existente.status_verificacao as any) || "verificado";

        if (existente.status_verificacao === "pendente_revisao") {
          // Atualiza apenas campos vazios.
          const patch: Record<string, unknown> = {};
          if (!existente.numero_cr && clubeNorm.numero_cr) patch.numero_cr = clubeNorm.numero_cr;
          if (!existente.data_validade && clubeNorm.data_validade) patch.data_validade = clubeNorm.data_validade;
          if (!existente.endereco && clubeNorm.endereco) patch.endereco = clubeNorm.endereco;
          if (!existente.cidade && clubeNorm.cidade) patch.cidade = clubeNorm.cidade;
          if (!existente.estado && clubeNorm.estado) patch.estado = clubeNorm.estado;
          if (Object.keys(patch).length > 0) {
            await admin.from("qa_clubes").update(patch).eq("id", existente.id);
          }
        }
        // Se verificado: NÃO sobrescreve. Sempre que houver divergência, registra.
        if (existente.status_verificacao === "verificado") {
          const diffs: string[] = [];
          if (clubeNorm.nome_clube && existente.nome_clube !== clubeNorm.nome_clube) diffs.push("nome");
          if (clubeNorm.numero_cr && existente.numero_cr && existente.numero_cr !== clubeNorm.numero_cr) diffs.push("numero_cr");
          if (clubeNorm.endereco && existente.endereco && existente.endereco !== clubeNorm.endereco) diffs.push("endereco");
          if (diffs.length > 0) {
            divergencia = {
              tipo: "dados_divergentes_clube_verificado",
              campos: diffs,
              clube_atual: existente,
              declaracao: clubeNorm,
              registrado_em: new Date().toISOString(),
            };
          }
        }
      } else if (clubeNorm.nome_clube) {
        // Cria novo clube como pendente de revisão.
        const { data: criado, error: insErr } = await admin
          .from("qa_clubes")
          .insert({
            nome_clube: clubeNorm.nome_clube,
            cnpj: cnpjDig,
            numero_cr: clubeNorm.numero_cr,
            data_validade: clubeNorm.data_validade,
            endereco: clubeNorm.endereco,
            cidade: clubeNorm.cidade,
            estado: clubeNorm.estado,
            origem: origem === "declaracao_filiacao_cliente" ? "declaracao_filiacao_cliente" : "manual",
            status_verificacao: "pendente_revisao",
            processo_id_origem: processoId,
            cliente_id_origem: cliente.id,
            documento_id_origem: documentoIdOrigem,
          })
          .select("id")
          .maybeSingle();
        if (insErr) {
          console.error("[qa-clube-sugerir] insert clube", insErr);
        } else {
          clubeId = (criado as any)?.id ?? null;
          clubeStatus = "pendente_revisao";
        }
      }
    } else if (clubeNorm.nome_clube) {
      // Sem CNPJ mas com nome — cria como pendente para revisão da equipe.
      const { data: criado, error: insErr } = await admin
        .from("qa_clubes")
        .insert({
          nome_clube: clubeNorm.nome_clube,
          cnpj: null,
          numero_cr: clubeNorm.numero_cr,
          data_validade: clubeNorm.data_validade,
          endereco: clubeNorm.endereco,
          cidade: clubeNorm.cidade,
          estado: clubeNorm.estado,
          origem: origem === "declaracao_filiacao_cliente" ? "declaracao_filiacao_cliente" : "manual",
          status_verificacao: "pendente_revisao",
          processo_id_origem: processoId,
          cliente_id_origem: cliente.id,
          documento_id_origem: documentoIdOrigem,
        })
        .select("id")
        .maybeSingle();
      if (insErr) {
        console.error("[qa-clube-sugerir] insert clube sem CNPJ", insErr);
      } else {
        clubeId = (criado as any)?.id ?? null;
        clubeStatus = "pendente_revisao";
      }
    }

    // Monta template_data para o gerador.
    const filiacaoNumero = s(filiacao.numero) || s(filiacao.numero_filiacao);
    const filiacaoValidade = parseDateAny(s(filiacao.validade) || s(filiacao.validade_filiacao));

    const templateDataPatch: Record<string, string> = {};
    if (clubeNorm.nome_clube) templateDataPatch.nome_clube = clubeNorm.nome_clube;
    if (cnpjDig) {
      templateDataPatch.cnpj_clube = cnpjDig
        .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }
    if (clubeNorm.numero_cr) templateDataPatch.numero_cr_clube = clubeNorm.numero_cr;
    if (clubeNorm.data_validade) {
      const [y, m, d] = clubeNorm.data_validade.split("-");
      templateDataPatch.data_cr_clube = `${d}/${m}/${y}`;
    }
    if (clubeNorm.endereco) {
      const cidUf = [clubeNorm.cidade, clubeNorm.estado].filter(Boolean).join("/");
      templateDataPatch.endereco_clube = cidUf ? `${clubeNorm.endereco}, ${cidUf}` : clubeNorm.endereco;
    }
    if (filiacaoNumero) templateDataPatch.numero_filiacao = filiacaoNumero;
    if (filiacaoValidade) {
      const [y, m, d] = filiacaoValidade.split("-");
      templateDataPatch.validade_filiacao = `${d}/${m}/${y}`;
    }

    const respostasAtuais = (processo.respostas_questionario_json && typeof processo.respostas_questionario_json === "object" && !Array.isArray(processo.respostas_questionario_json))
      ? (processo.respostas_questionario_json as Record<string, any>)
      : {};
    const tdAtual = (respostasAtuais.template_data && typeof respostasAtuais.template_data === "object")
      ? respostasAtuais.template_data as Record<string, any>
      : {};

    const novaResposta: Record<string, any> = {
      ...respostasAtuais,
      template_data: { ...tdAtual, ...templateDataPatch },
    };
    if (clubeId) novaResposta.clube_id_associado = clubeId;
    if (divergencia) novaResposta.clube_divergencia = divergencia;

    // ---------------------------------------------------------------------
    // wizard_pre_documento.clube_filiacao — fonte de verdade por PROCESSO.
    // Permite que o checklist trate clube/filiação por GTE/processo, sem
    // depender de campos consolidados em qa_clientes (que valem por cliente).
    // ---------------------------------------------------------------------
    const wizardPreAtual = (respostasAtuais.wizard_pre_documento && typeof respostasAtuais.wizard_pre_documento === "object" && !Array.isArray(respostasAtuais.wizard_pre_documento))
      ? respostasAtuais.wizard_pre_documento as Record<string, any>
      : {};
    const origemSimples =
      origem === "declaracao_filiacao_cliente" ? "declaracao"
      : origem === "catalogo_interno" ? "catalogo"
      : "manual";
    const wizardClubeFiliacao: Record<string, unknown> = {
      completed: !!(clubeNorm.nome_clube && (filiacaoNumero || filiacaoValidade)),
      completed_at: new Date().toISOString(),
      documento_id: documentoIdOrigem,
      clube_id: clubeId,
      nome_clube: clubeNorm.nome_clube || null,
      cnpj_clube: templateDataPatch.cnpj_clube || (cnpjDig || null),
      numero_cr_clube: clubeNorm.numero_cr,
      data_cr_clube: templateDataPatch.data_cr_clube || clubeNorm.data_validade,
      endereco_clube: templateDataPatch.endereco_clube || clubeNorm.endereco,
      cidade_clube: clubeNorm.cidade,
      uf_clube: clubeNorm.estado,
      numero_filiacao: filiacaoNumero || null,
      validade_filiacao: templateDataPatch.validade_filiacao || filiacaoValidade,
      origem: origemSimples,
    };
    novaResposta.wizard_pre_documento = {
      ...wizardPreAtual,
      clube_filiacao: wizardClubeFiliacao,
    };

    const { error: upErr } = await admin
      .from("qa_processos")
      .update({ respostas_questionario_json: novaResposta })
      .eq("id", processoId);
    if (upErr) {
      console.error("[qa-clube-sugerir] update processo", upErr);
      return json({ error: upErr.message }, 500);
    }

    // Atualiza qa_clientes APENAS se campos estiverem vazios.
    const clientePatch: Record<string, unknown> = {};
    if (!cliente.numero_filiacao && filiacaoNumero) clientePatch.numero_filiacao = filiacaoNumero;
    if (!cliente.validade_filiacao && filiacaoValidade) clientePatch.validade_filiacao = filiacaoValidade;
    if (!cliente.clube_atual_id && clubeId) clientePatch.clube_atual_id = clubeId;
    if (Object.keys(clientePatch).length > 0) {
      clientePatch.updated_at = new Date().toISOString();
      await admin.from("qa_clientes").update(clientePatch).eq("id", cliente.id);
    }

    // Auditoria best-effort.
    try {
      await admin.from("qa_processo_eventos").insert({
        processo_id: processoId,
        tipo_evento: "cliente_informou_clube_filiacao",
        descricao: `Cliente informou dados de clube/filiação (origem: ${origem}).`,
        ator: "cliente",
        dados_json: {
          clube_id: clubeId,
          clube_status: clubeStatus,
          origem,
          divergencia: !!divergencia,
        },
      } as any);
    } catch { /* opcional */ }

    return json({
      success: true,
      clube_id: clubeId,
      clube_status: clubeStatus,
      divergencia,
      template_data_atualizado: templateDataPatch,
    });
  } catch (e: any) {
    console.error("[qa-clube-sugerir]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
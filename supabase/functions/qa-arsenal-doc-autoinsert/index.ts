// Edge: qa-arsenal-doc-autoinsert
//
// Cadastra automaticamente um documento do Arsenal quando a IA classificou e
// extraiu campos obrigatórios com segurança.
//
// Regras:
//  - tipoDetectado != DESCONHECIDO
//  - confianca >= 0.85
//  - Campos obrigatórios do tipo legíveis (não vazios, sem placeholders)
//  - Não inventar nada.
//
// Quando aprovado, grava em qa_documentos_cliente (auditoria + histórico) e
// PROMOVE para as tabelas canônicas que alimentam o Arsenal operacional:
//   CRAF           -> qa_crafs              (Bancada Tática / cards de arma / KPI ARMAS)
//   GTE            -> qa_gte_documentos     (KPI GTE)
//   NOTA_FISCAL    -> qa_municoes_movimentacoes (entrada de estoque, KPI MUNIÇÕES)
//   CR / GT /
//   GUIA_TRANSITO /
//   AUTORIZACAO_COMPRA -> apenas qa_documentos_cliente (já alimenta KPIs/alertas)
//
// Deduplicação física:
//   - CRAF: procura arma por numero_arma OU numero_sigma; se existir, anexa.
//   - GTE:  procura GTE por numero_gte; se existir, ignora promoção.
//   - NF:   procura por chave de acesso; se existir, ignora promoção.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TIPO_DB = ["cr", "craf", "sinarm", "gt", "gte", "autorizacao_compra", "outro"] as const;
type TipoDb = typeof TIPO_DB[number];

const IA_TO_DB: Record<string, TipoDb> = {
  CR: "cr",
  CRAF: "craf",
  SINARM: "sinarm",
  GT: "gt",
  GTE: "gte",
  GUIA_TRANSITO: "gt",
  AUTORIZACAO_COMPRA: "autorizacao_compra",
  NOTA_FISCAL: "outro",
  EXAME_LAUDO: "outro",
  DESCONHECIDO: "outro",
};

function isLegivel(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  if (!s) return false;
  // bloqueia placeholders típicos de OCR inseguro
  if (/^[?_\-.\s]+$/.test(s)) return false;
  if (/[?]/.test(s)) return false; // qualquer "?" indica caractere ilegível
  return true;
}

function dataIsoFromBr(v?: string | null): string | null {
  if (!v) return null;
  const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function up(v?: string | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return s ? s.toUpperCase() : null;
}

function inferirTecnicaArmamento(marca?: string | null, modelo?: string | null, calibre?: string | null) {
  const busca = [marca, modelo, calibre].filter(Boolean).join(" ").toUpperCase().replace(/[^A-Z0-9]+/g, "");
  if (busca.includes("TAURUS") && busca.includes("TX22")) {
    return {
      funcionamento: "Blowback",
      gatilho: "SAO (ação simples apenas)",
    };
  }
  return { funcionamento: null, gatilho: null };
}

function normSerie(v?: string | null): string | null {
  if (!v) return null;
  const s = String(v).replace(/\s+/g, "").toUpperCase();
  return s || null;
}

/** Empacota cada campo sensível com a estrutura de auditoria pedida. */
function packCampo(valor: string | undefined | null, fonte: "vision" | "ocr" | "texto_pdf" | "sistema", confianca: number) {
  const legivel = isLegivel(valor);
  return {
    valor_original: valor ?? null,
    valor_normalizado: legivel ? up(String(valor).trim()) : null,
    confianca: legivel ? confianca : 0,
    fonte,
    legivel,
    observacao: legivel ? null : "ilegivel_ou_vazio",
  };
}

/** Retorna lista de campos obrigatórios faltando (vazia = OK). */
function camposFaltando(tipoIA: string, c: Record<string, unknown>): string[] {
  const need = (k: string) => (isLegivel(c[k]) ? null : k);
  switch (tipoIA) {
    case "CRAF":
      return [
        need("numero_documento"),
        need("data_validade"),
        need("arma_numero_serie"),
        need("arma_calibre"),
        need("arma_modelo") || need("arma_marca"), // pelo menos um
      ].filter(Boolean) as string[];
    case "GTE":
      return [
        need("numero_documento"),
        need("data_validade"),
        need("arma_numero_serie"),
      ].filter(Boolean) as string[];
    case "GT":
    case "GUIA_TRANSITO":
      return [need("numero_documento")].filter(Boolean) as string[];
    case "CR":
      return [need("numero_documento"), need("data_validade")].filter(Boolean) as string[];
    case "SINARM":
      return [need("numero_documento"), need("data_validade")].filter(Boolean) as string[];
    case "AUTORIZACAO_COMPRA":
      return [need("numero_documento")].filter(Boolean) as string[];
    case "NOTA_FISCAL":
      return [
        need("nf_chave_acesso"),
        need("emitente"),
        need("nf_produto"),
        need("nf_quantidade"),
      ].filter(Boolean) as string[];
    default:
      return ["tipo_desconhecido"];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const customer_id: string | null = body?.customer_id ?? null;
    let qa_cliente_id: number | null = body?.qa_cliente_id ?? null;
    const arquivo_storage_path: string | null = body?.arquivo_storage_path ?? null;
    const arquivo_nome: string | null = body?.arquivo_nome ?? null;
    const arquivo_mime: string | null = body?.arquivo_mime ?? null;
    const classificacao = body?.classificacao || {};

    if (!customer_id && !qa_cliente_id) {
      return json({ error: "customer_id ou qa_cliente_id obrigatório" }, 400);
    }

    const tipoIA = String(classificacao?.tipoDetectado || "DESCONHECIDO");
    const conf = Number(classificacao?.confianca || 0);
    const campos = (classificacao?.camposExtraidos || {}) as Record<string, string | undefined>;

    // Auditoria mínima sempre devolvida ao caller
    const auditoria = {
      tipoDetectado: tipoIA,
      confianca: conf,
      camposExtraidos: campos,
      avaliado_em: new Date().toISOString(),
    };

    // -------------------------------------------------------------------
    // POLÍTICA DE SEGURANÇA — AUTOAPROVAÇÃO OPERACIONAL SUSPENSA
    // -------------------------------------------------------------------
    // A IA pode IDENTIFICAR e SUGERIR campos, mas não pode mais cadastrar
    // automaticamente CRAF/GTE/NF/etc. nas tabelas canônicas. Risco crítico:
    // OCR pode trocar 0/O, 1/I, completar números, ou misturar campos.
    // O cadastro só acontece após confirmação humana campo a campo no modal.
    //
    // Esta edge agora apenas devolve a auditoria da extração para o frontend
    // pré-preencher os campos como SUGESTÃO, marcados como NÃO-CONFIRMADOS.
    // -------------------------------------------------------------------
    const faltandoPreCheck = tipoIA === "DESCONHECIDO"
      ? ["tipo_desconhecido"]
      : camposFaltando(tipoIA, campos as Record<string, unknown>);
    return json({
      safe: false,
      motivo: "revisao_humana_obrigatoria",
      confianca: conf,
      campos_faltando: faltandoPreCheck,
      auditoria,
    });

    // eslint-disable-next-line no-unreachable
    if (tipoIA === "DESCONHECIDO") {
      return json({
        safe: false,
        motivo: "documento_nao_identificado",
        auditoria,
      });
    }
    if (conf < 0.85) {
      return json({
        safe: false,
        motivo: "confianca_insuficiente",
        confianca: conf,
        auditoria,
      });
    }
    const faltando = camposFaltando(tipoIA, campos as Record<string, unknown>);
    if (faltando.length) {
      return json({
        safe: false,
        motivo: "campos_ilegiveis",
        campos_faltando: faltando,
        auditoria,
      });
    }

    const tipoDb = IA_TO_DB[tipoIA] || "outro";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Resolve qa_cliente_id (integer) — necessário para promover às canônicas
    if (!qa_cliente_id && customer_id) {
      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("id")
        .eq("customer_id", customer_id)
        .maybeSingle();
      if (cli?.id) qa_cliente_id = cli.id as number;
    }

    // Bloqueio de duplicidade por (cliente, tipo, número)
    const numeroNorm = String(campos.numero_documento || "").replace(/\s+/g, "").toUpperCase();
    if (numeroNorm) {
      let q = supabase
        .from("qa_documentos_cliente")
        .select("id, numero_documento")
        .eq("tipo_documento", tipoDb)
        .neq("status", "excluido");
      q = customer_id
        ? q.eq("customer_id", customer_id)
        : q.eq("qa_cliente_id", qa_cliente_id as number);
      const { data: dups } = await q;
      const dup = (dups || []).find(
        (d: any) => String(d.numero_documento || "").replace(/\s+/g, "").toUpperCase() === numeroNorm,
      );
      if (dup) {
        return json({
          safe: false,
          motivo: "duplicado",
          documento_existente_id: dup.id,
          auditoria,
        });
      }
    }

    const showArma = tipoDb !== "cr";

    // Campos sensíveis empacotados (auditoria fiel)
    const campos_sensiveis = {
      numero_documento: packCampo(campos.numero_documento, "vision", conf),
      data_validade:    packCampo(campos.data_validade, "vision", conf),
      arma_marca:       packCampo(campos.arma_marca, "vision", conf),
      arma_modelo:      packCampo(campos.arma_modelo, "vision", conf),
      arma_calibre:     packCampo(campos.arma_calibre, "vision", conf),
      arma_numero_serie:packCampo(campos.arma_numero_serie, "vision", conf),
      sigma_ou_sinarm:  packCampo(campos.sigma_ou_sinarm, "vision", conf),
      numero_cad_sinarm:    packCampo((campos as any).numero_cad_sinarm, "vision", conf),
      numero_registro_sigma:packCampo((campos as any).numero_registro_sigma, "vision", conf),
      nf_chave_acesso:  packCampo(campos.nf_chave_acesso, "vision", conf),
      nf_produto:       packCampo(campos.nf_produto, "vision", conf),
      nf_calibre:       packCampo(campos.nf_calibre, "vision", conf),
      nf_quantidade:    packCampo(campos.nf_quantidade, "vision", conf),
      emitente:         packCampo(campos.emitente, "vision", conf),
    };

    // Regime canônico (SINARM × SIGMA × REVISAR)
    // Regra de ouro: "Nº Cad. SINARM" presente => SINARM. SIGMA só com indicação explícita.
    const cadSinarmRaw = String((campos as any).numero_cad_sinarm || "").trim();
    const sigmaExplicitoRaw = String((campos as any).numero_registro_sigma || "").trim();
    const sistemaIARaw = String((campos as any).sistema_registro || "").toUpperCase().trim();
    const sistema_registro_final: "SINARM" | "SIGMA" | "REVISAR" =
      cadSinarmRaw ? "SINARM" :
      (sistemaIARaw === "SIGMA" && sigmaExplicitoRaw) ? "SIGMA" :
      sistemaIARaw === "SINARM" ? "SINARM" :
      sistemaIARaw === "SIGMA" ? "SIGMA" :
      "REVISAR";

    const payload: Record<string, unknown> = {
      customer_id,
      qa_cliente_id,
      tipo_documento: tipoDb,
      numero_documento: campos.numero_documento || null,
      orgao_emissor: campos.orgao_emissor || null,
      data_emissao: dataIsoFromBr(campos.data_emissao),
      data_validade: dataIsoFromBr(campos.data_validade),
      arma_marca: showArma ? campos.arma_marca || null : null,
      arma_modelo: showArma ? campos.arma_modelo || null : null,
      arma_calibre: showArma ? campos.arma_calibre || null : null,
      arma_numero_serie: showArma ? campos.arma_numero_serie || null : null,
      numero_cad_sinarm: showArma ? (cadSinarmRaw || null) : null,
      numero_registro_sigma: showArma ? (sigmaExplicitoRaw || null) : null,
      sistema_registro: showArma ? sistema_registro_final : null,
      arquivo_storage_path,
      arquivo_nome,
      arquivo_mime,
      ia_status: "auto_aprovado",
      ia_dados_extraidos: {
        ...auditoria,
        origem_fluxo: "arsenal_hub_documental",
        auto_cadastro: true,
        campos_sensiveis,
      },
      ia_processado_em: new Date().toISOString(),
      status: "aprovado",
      origem: "sistema",
      validado_admin: true,
      validado_por: "ia_auto",
      validado_em: new Date().toISOString(),
      aprovado_em: new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await supabase
      .from("qa_documentos_cliente")
      .insert(payload)
      .select("id")
      .single();

    if (insErr) {
      console.error("[qa-arsenal-doc-autoinsert] insert error:", insErr);
      return json({ safe: false, motivo: "erro_insercao", erro: insErr.message, auditoria }, 500);
    }

    // ------------------------------------------------------------------
    // PROMOÇÃO PARA TABELAS CANÔNICAS DO ARSENAL OPERACIONAL
    // ------------------------------------------------------------------
    const promocao: Record<string, unknown> = { tabela: null, criado: false, motivo: null };
    try {
      if (!qa_cliente_id) {
        promocao.motivo = "sem_qa_cliente_id";
      } else if (tipoIA === "CRAF") {
        const numeroSerie = normSerie(campos.arma_numero_serie);
        // numero_documento é "Nº do Registro" — campo genérico, NÃO é SIGMA por si só.
        // Só consideramos numero_sigma quando há indicação SIGMA explícita.
        const numeroSigma = sistema_registro_final === "SIGMA"
          ? (normSerie(sigmaExplicitoRaw) || normSerie(campos.sigma_ou_sinarm) || normSerie(campos.numero_documento))
          : null;
        const numeroCadSinarm = sistema_registro_final === "SINARM" ? normSerie(cadSinarmRaw) : null;
        if (!numeroSerie && !numeroSigma) {
          promocao.motivo = "sem_identificador_fisico";
        } else {
          const tecnica = inferirTecnicaArmamento(campos.arma_marca, campos.arma_modelo, campos.arma_calibre);
          // Procura arma já cadastrada (mesma série OU mesmo SIGMA) para evitar duplicidade
          const { data: existentes } = await supabase
            .from("qa_crafs")
            .select("id, numero_arma, numero_sigma")
            .eq("cliente_id", qa_cliente_id);
          const dup = (existentes || []).find((e: any) => {
            const s = normSerie(e.numero_arma);
            const g = normSerie(e.numero_sigma);
            return (numeroSerie && s === numeroSerie) || (numeroSigma && g === numeroSigma);
          });
          if (dup) {
            // Atualiza só campos vazios (não sobrescreve dados validados anteriores)
            const patch: Record<string, unknown> = {};
            if (!dup) {/* noop */}
            const { data: full } = await supabase
              .from("qa_crafs")
              .select("data_validade, nome_craf, numero_arma, numero_sigma, nome_arma, funcionamento, gatilho")
              .eq("id", (dup as any).id)
              .maybeSingle();
            if (full && !full.data_validade && dataIsoFromBr(campos.data_validade)) {
              patch.data_validade = dataIsoFromBr(campos.data_validade);
            }
            if (full && !full.nome_craf && campos.numero_documento) patch.nome_craf = up(campos.numero_documento);
            if (full && !full.numero_arma && numeroSerie) patch.numero_arma = numeroSerie;
            if (full && !full.numero_sigma && numeroSigma) patch.numero_sigma = numeroSigma;
            // Regime + cad SINARM: sempre persistir quando vierem do documento.
            if (numeroCadSinarm) patch.numero_cad_sinarm = numeroCadSinarm;
            if (numeroSigma && sistema_registro_final === "SIGMA") patch.numero_registro_sigma = numeroSigma;
            patch.sistema_registro = sistema_registro_final;
            if (full && !full.funcionamento && tecnica.funcionamento) patch.funcionamento = tecnica.funcionamento;
            if (full && !full.gatilho && tecnica.gatilho) patch.gatilho = tecnica.gatilho;
            // Espécie/tipo do documento (ESPINGARDA, REVÓLVER, PISTOLA, etc.)
            // — prova canônica para classificação do card.
            if (campos.arma_especie) patch.arma_especie = up(campos.arma_especie);
            // Sempre garante o vínculo do arquivo original (mesmo em update)
            if (arquivo_storage_path) {
              patch.arquivo_storage_path = arquivo_storage_path;
              patch.arquivo_nome = arquivo_nome;
              patch.arquivo_mime = arquivo_mime;
              patch.documento_origem_id = (inserted as any).id;
            }
            if (Object.keys(patch).length) {
              await supabase.from("qa_crafs").update(patch).eq("id", (dup as any).id);
            }
            promocao.tabela = "qa_crafs";
            promocao.criado = false;
            promocao.craf_id = (dup as any).id;
            promocao.motivo = "vinculado_arma_existente";
          } else {
            const nomeArma = [up(campos.arma_marca), up(campos.arma_modelo), up(campos.arma_calibre)]
              .filter(Boolean).join(" ").trim() || up(campos.arma_modelo) || "ARMA";
            const { data: novoCraf, error: crafErr } = await supabase
              .from("qa_crafs")
              .insert({
                cliente_id: qa_cliente_id,
                nome_arma: nomeArma,
                nome_craf: up(campos.numero_documento),
                numero_arma: numeroSerie,
                numero_sigma: numeroSigma,
                numero_cad_sinarm: numeroCadSinarm,
                numero_registro_sigma: sistema_registro_final === "SIGMA" ? numeroSigma : null,
                sistema_registro: sistema_registro_final,
                funcionamento: tecnica.funcionamento,
                gatilho: tecnica.gatilho,
                arma_especie: campos.arma_especie ? up(campos.arma_especie) : null,
                data_validade: dataIsoFromBr(campos.data_validade),
                arquivo_storage_path: arquivo_storage_path,
                arquivo_nome: arquivo_nome,
                arquivo_mime: arquivo_mime,
                documento_origem_id: (inserted as any).id,
              })
              .select("id")
              .single();
            if (crafErr) {
              promocao.motivo = `erro_qa_crafs:${crafErr.message}`;
            } else {
              promocao.tabela = "qa_crafs";
              promocao.criado = true;
              promocao.craf_id = (novoCraf as any).id;
            }
          }
        }
      } else if (tipoIA === "GTE") {
        const numeroGte = up(campos.numero_documento);
        // dedup por número
        if (numeroGte) {
          const { data: existing } = await supabase
            .from("qa_gte_documentos")
            .select("id, numero_gte")
            .eq("cliente_id", qa_cliente_id);
          const dup = (existing || []).find(
            (e: any) => up(e.numero_gte) === numeroGte,
          );
          if (dup) {
            promocao.tabela = "qa_gte_documentos";
            promocao.criado = false;
            promocao.gte_documento_id = (dup as any).id;
            promocao.motivo = "gte_ja_existente";
          }
        }
        if (!promocao.tabela) {
          const { data: novoGte, error: gteErr } = await supabase
            .from("qa_gte_documentos")
            .insert({
              cliente_id: qa_cliente_id,
              storage_path: arquivo_storage_path || "auto-cadastro/sem-arquivo",
              nome_original: arquivo_nome,
              mime_type: arquivo_mime,
              origem_envio: "sistema",
              documento_origem_id: (inserted as any).id,
              numero_gte: numeroGte,
              orgao_emissor: up(campos.orgao_emissor),
              data_emissao: dataIsoFromBr(campos.data_emissao),
              data_validade: dataIsoFromBr(campos.data_validade),
              endereco_origem: up(campos.origem),
              endereco_destino: up(campos.destino),
              status_processamento: "concluido",
              processado_em: new Date().toISOString(),
              dados_extraidos_json: { auto_cadastro: true, ...auditoria, campos_sensiveis },
              armas_json: [],
              enderecos_json: [],
              clubes_json: [],
              armas_vinculadas_json: [],
              matching_status: "pendente",
              matching_resumo_json: {},
              armas_total: 0,
              enderecos_total: 0,
            })
            .select("id")
            .single();
          if (gteErr) {
            promocao.motivo = `erro_qa_gte_documentos:${gteErr.message}`;
          } else {
            promocao.tabela = "qa_gte_documentos";
            promocao.criado = true;
            promocao.gte_documento_id = (novoGte as any).id;
          }
        }
      } else if (tipoIA === "NOTA_FISCAL") {
        const calibre = up(campos.nf_calibre) || up(campos.arma_calibre);
        const qtdRaw = String(campos.nf_quantidade || "").replace(/\D+/g, "");
        const qtd = qtdRaw ? parseInt(qtdRaw, 10) : 0;
        const chave = normSerie(campos.nf_chave_acesso);
        if (!calibre || !qtd || qtd <= 0) {
          promocao.motivo = "nf_sem_estoque_seguro";
        } else {
          // dedup por chave de acesso
          let dupId: string | null = null;
          if (chave) {
            const { data: existing } = await supabase
              .from("qa_municoes_movimentacoes")
              .select("id, ia_dados_extraidos")
              .eq("cliente_id", qa_cliente_id)
              .eq("tipo", "ENTRADA");
            for (const e of (existing || []) as any[]) {
              const ck = normSerie(e?.ia_dados_extraidos?.campos_sensiveis?.nf_chave_acesso?.valor_normalizado)
                || normSerie(e?.ia_dados_extraidos?.camposExtraidos?.nf_chave_acesso);
              if (ck && ck === chave) { dupId = e.id; break; }
            }
          }
          if (dupId) {
            promocao.tabela = "qa_municoes_movimentacoes";
            promocao.criado = false;
            promocao.movimentacao_id = dupId;
            promocao.motivo = "nf_ja_lancada";
          } else {
            const { data: novoMov, error: movErr } = await supabase
              .from("qa_municoes_movimentacoes")
              .insert({
                cliente_id: qa_cliente_id,
                tipo: "ENTRADA",
                calibre,
                marca: up(campos.nf_produto),
                lote: up(campos.nf_lote),
                quantidade: qtd,
                data_movimentacao: new Date().toISOString().slice(0, 10),
                data_validade: dataIsoFromBr(campos.data_validade),
                observacao: `AUTO-CADASTRO NF · emitente ${up(campos.emitente) || "—"}`,
                documento_url: arquivo_storage_path,
                documento_nome: arquivo_nome,
                documento_origem_id: (inserted as any).id,
                ia_status: "auto_aprovado",
                revisao_obrigatoria: false,
                ia_dados_extraidos: {
                  ...auditoria,
                  origem_fluxo: "arsenal_hub_documental",
                  auto_cadastro: true,
                  campos_sensiveis,
                },
              })
              .select("id")
              .single();
            if (movErr) {
              promocao.motivo = `erro_qa_municoes_movimentacoes:${movErr.message}`;
            } else {
              promocao.tabela = "qa_municoes_movimentacoes";
              promocao.criado = true;
              promocao.movimentacao_id = (novoMov as any).id;
            }
          }
        }
      } else {
        // CR / GT / GUIA_TRANSITO / AUTORIZACAO_COMPRA: já basta qa_documentos_cliente
        promocao.motivo = "tipo_nao_requer_promocao";
      }

      // Persiste resultado da promoção dentro do próprio documento (auditoria)
      await supabase
        .from("qa_documentos_cliente")
        .update({
          ia_dados_extraidos: {
            ...(payload.ia_dados_extraidos as object),
            promocao_canonica: promocao,
          },
        })
        .eq("id", (inserted as any).id);
    } catch (promErr) {
      console.error("[qa-arsenal-doc-autoinsert] promocao erro:", promErr);
      promocao.motivo = `excecao:${(promErr as any)?.message || "desconhecida"}`;
    }

    return json({
      safe: true,
      auto_cadastrado: true,
      documento_id: inserted?.id || null,
      tipo_documento: tipoDb,
      promocao_canonica: promocao,
      auditoria,
    });
  } catch (err) {
    console.error("[qa-arsenal-doc-autoinsert] erro:", err);
    return json({ error: (err as any)?.message || "Erro interno" }, 500);
  }
});

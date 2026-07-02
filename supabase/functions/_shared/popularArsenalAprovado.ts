// Auto-popular o acervo do cliente (qa_cliente_armas_manual) quando um
// documento de arma é aprovado (IA ou equipe). Camada ADITIVA e colateral:
// uma falha aqui NUNCA pode derrubar a aprovação do documento.
//
// Espelha src/lib/quero-armas/documentosDeArma.ts (Bloco 10). Se ajustar
// lá, ajustar aqui (constante duplicada por isolamento client/server).

const TIPOS_DOC_DE_ARMA = new Set<string>([
  "craf",
  "craf_renovacao",
  "nota_fiscal_arma",
  "autorizacao_compra_arma",
  "gte",
  "gte_transporte",
  "registro_arma",
]);

function isDocDeArma(tipo: string | null | undefined): boolean {
  if (!tipo) return false;
  const t = String(tipo).toLowerCase();
  return TIPOS_DOC_DE_ARMA.has(t)
    || /^(craf|gte|nota_fiscal_arma|registro_arma|autorizacao_compra_arma)(_|$)/.test(t);
}

function extrairDadosArma(cx: Record<string, any>): {
  tipo_arma: string | null;
  marca: string | null;
  modelo: string | null;
  calibre: string | null;
  numero_serie: string | null;
  numero_craf: string | null;
  numero_sinarm: string | null;
  numero_sigma: string | null;
  numero_autorizacao_compra: string | null;
  funcionamento: string | null;
  gatilho: string | null;
} {
  const pick = (k: string) => {
    const v = cx?.[k];
    if (v == null) return null;
    const s = String(v).trim();
    return s.length === 0 ? null : s;
  };
  const dados = {
    tipo_arma: pick("tipo_arma"),
    marca: pick("marca"),
    modelo: pick("modelo"),
    calibre: pick("calibre"),
    numero_serie: pick("numero_serie"),
    numero_craf: pick("numero_craf"),
    numero_sinarm: pick("numero_sinarm"),
    numero_sigma: pick("numero_sigma"),
    numero_autorizacao_compra: pick("numero_autorizacao_compra"),
    funcionamento: pick("funcionamento"),
    gatilho: pick("gatilho"),
  };
  const tecnica = inferirTecnicaArmamento(dados.marca, dados.modelo, dados.calibre);
  return {
    ...dados,
    funcionamento: dados.funcionamento || tecnica.funcionamento,
    gatilho: dados.gatilho || tecnica.gatilho,
  };
}

const normCmp = (v: string | null) =>
  v ? String(v).replace(/\s+/g, "").toUpperCase() : null;

function inferirTecnicaArmamento(marca: string | null, modelo: string | null, calibre: string | null) {
  const busca = [marca, modelo, calibre].filter(Boolean).join(" ").toUpperCase().replace(/[^A-Z0-9]+/g, "");
  if (busca.includes("TAURUS") && busca.includes("TX22")) {
    return {
      funcionamento: "Blowback",
      gatilho: "SAO (ação simples apenas)",
    };
  }
  return { funcionamento: null, gatilho: null };
}

/**
 * Retornos:
 *  - 'populado'              → UPSERT executado com sucesso
 *  - 'pulado_nao_doc_arma'   → tipo de documento não é de arma (ou status != aprovado)
 *  - 'sem_identificador'     → faltam série/CRAF/SINARM/SIGMA — não cria registro
 *  - 'divergencia'           → doc tem arma_id vinculada e dados extraídos batem com OUTRA arma
 *  - 'erro'                  → exceção/erro de RPC
 */
export async function popularArsenalAposAprovacao(
  supabase: any,
  documentoId: string,
): Promise<{ resultado: string; arma_id?: string | null; detalhe?: string }> {
  try {
    const { data: doc, error: errDoc } = await supabase
      .from("qa_processo_documentos")
      .select("id, processo_id, tipo_documento, arma_id, campos_complementares_json, status")
      .eq("id", documentoId)
      .single();
    if (errDoc || !doc) return { resultado: "erro", detalhe: errDoc?.message ?? "doc not found" };

    if (!isDocDeArma(doc.tipo_documento)) return { resultado: "pulado_nao_doc_arma" };
    if (doc.status !== "aprovado") {
      return { resultado: "pulado_nao_doc_arma", detalhe: "status not aprovado" };
    }

    const { data: proc } = await supabase
      .from("qa_processos")
      .select("cliente_id")
      .eq("id", doc.processo_id)
      .single();
    if (!proc?.cliente_id) return { resultado: "erro", detalhe: "processo sem cliente" };

    const { data: cli } = await supabase
      .from("qa_clientes")
      .select("user_id")
      .eq("id", proc.cliente_id)
      .single();

    const cx = (doc.campos_complementares_json && typeof doc.campos_complementares_json === "object")
      ? doc.campos_complementares_json as Record<string, any>
      : {};
    const dados = extrairDadosArma(cx);

    const identificadores = [
      dados.numero_serie, dados.numero_craf, dados.numero_sinarm, dados.numero_sigma,
    ].filter(Boolean);

    if (identificadores.length === 0) {
      await supabase.from("qa_processo_eventos").insert({
        processo_id: doc.processo_id,
        documento_id: doc.id,
        tipo_evento: "arsenal_auto_populate_pulado",
        descricao: "Documento de arma aprovado sem identificador único — acervo não populado, requer revisão manual.",
        dados_json: { motivo: "sem_identificador", campos_complementares: cx },
        ator: "sistema",
      });
      await supabase.from("qa_processo_eventos").insert({
        processo_id: doc.processo_id,
        documento_id: doc.id,
        tipo_evento: "reaberto_para_revisao_arsenal",
        descricao: "Documento reaberto para revisão humana: IA não extraiu identificador da arma.",
        dados_json: { motivo: "sem_identificador", suprimir_notificacao_cliente: true },
        ator: "sistema",
      });
      await supabase.from("qa_processo_documentos")
        .update({
          status: "revisao_humana",
          motivo_rejeicao: "Documento aprovado, mas a IA não extraiu identificador da arma (série/CRAF/SINARM/SIGMA). Cadastre manualmente no Meu Arsenal ou verifique a qualidade do documento.",
        })
        .eq("id", doc.id);
      return { resultado: "sem_identificador" };
    }

    // Divergência: doc já vinculado a uma arma cujos dados conflitam com o extraído.
    if (doc.arma_id) {
      const armaIdNum = Number(doc.arma_id);
      if (Number.isFinite(armaIdNum)) {
        const { data: armaVinculada } = await supabase
          .from("qa_cliente_armas_manual")
          .select("id, numero_serie, numero_craf, numero_sinarm, numero_sigma")
          .eq("id", armaIdNum)
          .maybeSingle();

        if (armaVinculada) {
          const cmp = (a: string | null, b: string | null) => {
            const na = normCmp(a); const nb = normCmp(b);
            if (!na || !nb) return null;
            return na === nb;
          };
          const checks = [
            cmp(armaVinculada.numero_serie, dados.numero_serie),
            cmp(armaVinculada.numero_craf, dados.numero_craf),
            cmp(armaVinculada.numero_sinarm, dados.numero_sinarm),
            cmp(armaVinculada.numero_sigma, dados.numero_sigma),
          ].filter((x) => x !== null);

          if (checks.length > 0 && checks.some((x) => x === false)) {
            await supabase.from("qa_processo_eventos").insert({
              processo_id: doc.processo_id,
              documento_id: doc.id,
              tipo_evento: "arsenal_auto_populate_divergencia",
              descricao: "Dados extraídos pela IA divergem da arma já vinculada ao documento — acervo não alterado.",
              dados_json: {
                motivo: "dados_extraidos_divergem_da_arma_selecionada",
                arma_vinculada: armaVinculada,
                dados_extraidos: dados,
              },
              ator: "sistema",
            });
            await supabase.from("qa_processo_eventos").insert({
              processo_id: doc.processo_id,
              documento_id: doc.id,
              tipo_evento: "reaberto_para_revisao_arsenal",
              descricao: "Documento reaberto para revisão humana: dados extraídos divergem da arma vinculada.",
              dados_json: { motivo: "divergencia", suprimir_notificacao_cliente: true },
              ator: "sistema",
            });
            await supabase.from("qa_processo_documentos")
              .update({
                status: "revisao_humana",
                motivo_rejeicao: "Os dados extraídos do documento (série/CRAF) não batem com a arma selecionada no upload. Confira se o documento foi anexado à arma certa.",
              })
              .eq("id", doc.id);
            return { resultado: "divergencia", detalhe: "divergencia com arma vinculada" };
          }
        }
      }
    }

    const { data: rpcOut, error: errRpc } = await supabase.rpc("qa_arma_manual_upsert", {
      p_cliente_id: proc.cliente_id,
      p_user_id: cli?.user_id ?? null,
      p_origem: "documento_aprovado",
      p_sistema: null,
      p_tipo_arma: dados.tipo_arma,
      p_marca: dados.marca,
      p_modelo: dados.modelo,
      p_calibre: dados.calibre,
      p_numero_serie: dados.numero_serie,
      p_numero_craf: dados.numero_craf,
      p_numero_sinarm: dados.numero_sinarm,
      p_numero_sigma: dados.numero_sigma,
      p_numero_autorizacao_compra: dados.numero_autorizacao_compra,
      p_dados_extraidos_json: {
        documento_id: doc.id,
        tipo_documento: doc.tipo_documento,
        campos_complementares: cx,
      },
      p_funcionamento: dados.funcionamento,
      p_gatilho: dados.gatilho,
    });

    if (errRpc) {
      await supabase.from("qa_processo_eventos").insert({
        processo_id: doc.processo_id,
        documento_id: doc.id,
        tipo_evento: "arsenal_auto_populate_erro",
        descricao: `Falha ao popular acervo via RPC: ${errRpc.message}`,
        dados_json: { erro: errRpc.message, dados },
        ator: "sistema",
      }).then(() => {}, () => {});
      return { resultado: "erro", detalhe: errRpc.message };
    }

    // Função retorna { id: bigint, created: bool, message: text }.
    const armaIdResult = rpcOut && (rpcOut as any).id != null ? String((rpcOut as any).id) : null;

    if (armaIdResult && !doc.arma_id) {
      await supabase.from("qa_processo_documentos")
        .update({ arma_id: armaIdResult })
        .eq("id", doc.id);
    }

    await supabase.from("qa_processo_eventos").insert({
      processo_id: doc.processo_id,
      documento_id: doc.id,
      tipo_evento: "arsenal_auto_populated",
      descricao: `Acervo populado a partir de documento aprovado (${doc.tipo_documento}).`,
      dados_json: {
        arma_id: armaIdResult,
        created: (rpcOut as any)?.created ?? null,
        origem: "documento_aprovado",
        dados,
      },
      ator: "sistema",
    });

    return { resultado: "populado", arma_id: armaIdResult };
  } catch (e: any) {
    return { resultado: "erro", detalhe: e?.message ?? String(e) };
  }
}

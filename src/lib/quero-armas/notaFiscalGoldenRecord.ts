// ============================================================================
// Golden Record da Nota Fiscal — grupo de ocupação lícita
// ----------------------------------------------------------------------------
// Tabela dedicada `qa_nf_golden_records`: guarda TUDO o que o parser lê do
// cabeçalho da nota (identificação, prestador, tomador) e da descrição do
// serviço prestado (texto + itens). É a fonte de verdade para conferir CNPJ e
// razão social do prestador contra os demais documentos empresariais.
//
// Chave natural: `chave_acesso` — reenvio da mesma nota atualiza a linha,
// nunca duplica.
//
// DOIS MODELOS NA MESMA TABELA (19/08/2026). A tabela nasceu só para a NFS-e
// do padrão nacional, e as colunas específicas dela continuam existindo (DPS,
// ISSQN, tributação municipal). Desde que o Hub passou a aceitar o XML, entra
// aqui também a NF-e modelo 55, de mercadoria. Sem a coluna `modelo` as duas
// ficariam indistinguíveis, e quem consultasse a tabela leria uma venda de
// sucata como prestação de serviço, com ISSQN que não existe.
//
// Quando o modelo não é informado, ele é deduzido da chave (`modeloPelaChave`)
// — a mesma regra que a migration aplicou nas linhas antigas.
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import { modeloPelaChave, type ModeloNotaFiscalXml } from "./notaFiscalXml";
import type { CamposCertidao } from "./parsersCertidoes";

const numeroBr = (v?: string): number | null => {
  if (!v) return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export interface SalvarNfGoldenRecordInput {
  campos: CamposCertidao;
  /** Id numérico do cliente em `qa_clientes`. */
  clienteId?: number | string | null;
  documentoId?: string | null;
  processoDocumentoId?: string | null;
  textoBruto?: string | null;
  /**
   * Modelo da nota, quando a origem sabe dizer (importação de XML).
   * Omitido, é deduzido da chave.
   */
  modelo?: ModeloNotaFiscalXml | null;
  /** Campos que só a NF-e tem e a NFS-e não preenche. */
  naturezaOperacao?: string | null;
  protocoloAutorizacao?: string | null;
  serie?: string | null;
  valorProdutos?: number | null;
}

/**
 * Grava (ou atualiza) o Golden Record da nota fiscal. Silencioso por design:
 * falha aqui nunca pode derrubar o salvamento do documento no Hub.
 */
export async function salvarNotaFiscalGoldenRecord({
  campos,
  clienteId,
  documentoId,
  processoDocumentoId,
  textoBruto,
  modelo,
  naturezaOperacao,
  protocoloAutorizacao,
  serie,
  valorProdutos,
}: SalvarNfGoldenRecordInput): Promise<string | null> {
  if (campos?.orgao !== "nota_fiscal" || !campos.chave_acesso) return null;

  const modeloEfetivo = modelo ?? modeloPelaChave(campos.chave_acesso);
  const ehServico = modeloEfetivo === "nfse";

  const row = {
    cliente_id: clienteId != null && clienteId !== "" ? Number(clienteId) : null,
    documento_id: documentoId ?? null,
    processo_documento_id: processoDocumentoId ?? null,

    chave_acesso: campos.chave_acesso,
    modelo: modeloEfetivo,
    numero_documento: campos.numero_nf ?? null,
    serie: serie ?? campos.serie_dps ?? null,
    natureza_operacao: naturezaOperacao ?? null,
    protocolo_autorizacao: protocoloAutorizacao ?? null,
    valor_produtos: valorProdutos ?? null,
    // `numero_nfse` é coluna de NFS-e. Escrever ali o número de uma NF-e de
    // mercadoria faria a nota de venda ser lida como nota de serviço.
    numero_nfse: ehServico ? campos.numero_nf ?? null : null,
    // ── COLUNAS QUE SÓ EXISTEM NA NFS-e ───────────────────────────────────
    // Competência, DPS e e-mail da prefeitura são do padrão nacional de
    // SERVIÇO. Uma NF-e de mercadoria não tem nenhum deles — preencher aqui
    // seria inventar dado fiscal.
    competencia: ehServico ? campos.competencia ?? null : null,
    numero_dps: ehServico ? campos.numero_dps ?? null : null,
    serie_dps: ehServico ? campos.serie_dps ?? null : null,
    email_municipio: ehServico ? campos.email_municipio ?? null : null,

    data_emissao_nfse: campos.data_emissao ? `${campos.data_emissao}T00:00:00-03:00` : null,
    municipio_emissor: campos.municipio_emissor ?? null,

    prestador_cnpj: campos.cnpj ?? null,
    prestador_nome: campos.razao_social ?? null,
    prestador_inscricao_municipal: campos.prestador_inscricao_municipal ?? null,
    prestador_telefone: campos.prestador_telefone ?? null,
    prestador_email: campos.prestador_email ?? null,
    prestador_endereco: campos.prestador_endereco ?? null,
    prestador_municipio: campos.prestador_municipio ?? null,
    prestador_cep: campos.prestador_cep ?? null,
    prestador_simples_nacional: campos.prestador_simples_nacional ?? null,
    prestador_regime_apuracao: campos.prestador_regime_apuracao ?? null,

    tomador_documento: campos.tomador_documento ?? null,
    tomador_nome: campos.tomador_nome ?? null,
    tomador_inscricao_municipal: campos.tomador_inscricao_municipal ?? null,
    tomador_telefone: campos.tomador_telefone ?? null,
    tomador_email: campos.tomador_email ?? null,
    tomador_endereco: campos.tomador_endereco ?? null,
    tomador_municipio: campos.tomador_municipio ?? null,
    tomador_cep: campos.tomador_cep ?? null,

    codigo_tributacao_nacional: campos.codigo_tributacao_nacional ?? null,
    codigo_tributacao_municipal: campos.codigo_tributacao_municipal ?? null,
    local_prestacao: campos.local_prestacao ?? null,
    pais_prestacao: campos.pais_prestacao ?? null,
    descricao_servico: campos.descricao_servico ?? null,
    itens_servico: campos.itens_servico ?? [],

    tributacao_issqn: campos.tributacao_issqn ?? null,
    municipio_incidencia_issqn: campos.municipio_incidencia_issqn ?? null,
    retencao_issqn: campos.retencao_issqn ?? null,
    valor_servico: numeroBr(campos.valor_nf),
    valor_liquido: numeroBr(campos.valor_liquido ?? campos.valor_nf),

    texto_bruto: textoBruto ?? null,
  };

  try {
    const { data, error } = await supabase
      .from("qa_nf_golden_records" as any)
      .upsert(row as any, { onConflict: "chave_acesso" })
      .select("id")
      .single();
    if (error) throw error;
    return (data as any)?.id ?? null;
  } catch (e) {
    console.warn("[nf-golden-record] falha ao gravar", e);
    return null;
  }
}

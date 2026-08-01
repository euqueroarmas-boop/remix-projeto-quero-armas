// ============================================================================
// Golden Record da Nota Fiscal (NFS-e) — grupo de ocupação lícita
// ----------------------------------------------------------------------------
// Tabela dedicada `qa_nf_golden_records`: guarda TUDO o que o parser lê do
// cabeçalho da DANFSe (identificação, prestador, tomador) e da descrição do
// serviço prestado (texto + itens). É a fonte de verdade para conferir CNPJ e
// razão social do prestador contra os demais documentos empresariais.
//
// Chave natural: `chave_acesso` (44 dígitos) — reenvio da mesma nota atualiza
// a linha, nunca duplica.
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import type { CamposCertidao } from "./parsersCertidoes";

const numeroBr = (v?: string): number | null => {
  if (!v) return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export interface SalvarNfGoldenRecordInput {
  campos: CamposCertidao;
  clienteId?: string | null;
  documentoId?: string | null;
  processoDocumentoId?: string | null;
  textoBruto?: string | null;
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
}: SalvarNfGoldenRecordInput): Promise<string | null> {
  if (campos?.orgao !== "nota_fiscal" || !campos.chave_acesso) return null;

  const row = {
    cliente_id: clienteId ?? null,
    documento_id: documentoId ?? null,
    processo_documento_id: processoDocumentoId ?? null,

    chave_acesso: campos.chave_acesso,
    numero_nfse: campos.numero_nf ?? null,
    competencia: campos.competencia ?? null,
    data_emissao_nfse: campos.data_emissao ? `${campos.data_emissao}T00:00:00-03:00` : null,
    numero_dps: campos.numero_dps ?? null,
    serie_dps: campos.serie_dps ?? null,
    municipio_emissor: campos.municipio_emissor ?? null,
    email_municipio: campos.email_municipio ?? null,

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

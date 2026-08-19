// ============================================================================
// notaFiscalXmlImport.ts — a ponte entre o XML anexado e o Hub Documental
// ----------------------------------------------------------------------------
// Junta as três peças em uma chamada só, para o modal não precisar orquestrar
// nada: lê o XML (`notaFiscalXml`), gera o DANFE com texto (`danfePdfDoXml`) e
// devolve os campos já no formato que a conferência do Hub consome.
//
// Toda decisão aqui é por IGUALDADE DE DOCUMENTO (CNPJ/CPF em dígitos). Nada
// de nome parecido, nada de IA. Se o número não bate, o sistema não decide —
// avisa e deixa o slot como estava.
// ============================================================================
import { lerTextoDoArquivo } from "./assinaturaArquivo";
import { arquivoDanfeDoXml } from "./danfePdfDoXml";
import {
  camposCertidaoDaNotaXml,
  ehArquivoXml,
  enderecoEmLinha,
  lerNotaFiscalXml,
  moedaBr,
  municipioUf,
  type NotaFiscalXml,
} from "./notaFiscalXml";
import { isNotaFiscalOcupacao } from "./ocupacaoLicitaConferencia";
import type { CamposCertidao } from "./parsersCertidoes";

export { ehArquivoXml };

/** Qual das duas pontas da nota é o cliente. */
export type PapelDoClienteNaNota = "emitente" | "destinatario" | "nenhum";

export interface ReferenciaClienteNota {
  /** CPF do cliente, como está no cadastro. */
  cpf?: string | null;
  /** CNPJ da empresa do cliente (ocupação lícita), como está no cadastro. */
  cnpj?: string | null;
  /** Slug do slot que o cliente abriu no Hub. */
  tipoSlot?: string | null;
}

export interface NotaFiscalImportada {
  nota: NotaFiscalXml;
  /** PDF com camada de texto, pronto para seguir o fluxo normal do Hub. */
  pdf: File;
  /** Campos no contrato que a conferência e o Golden Record já consomem. */
  campos: CamposCertidao;
  /** Versão plana dos campos, para `calcularConformidade`. */
  camposPlanos: Record<string, string | undefined>;
  /** Slug de documento decidido pelo confronto de CNPJ/CPF. */
  tipoDocumento: string;
  papelDoCliente: PapelDoClienteNaNota;
  /** Texto integral do DANFE gerado — serve de "texto do documento". */
  texto: string;
}

export type ResultadoImportacaoXml =
  | { ok: true; importada: NotaFiscalImportada }
  | { ok: false; motivo: string };

const digitos = (v?: string | null): string => String(v ?? "").replace(/\D/g, "");

/**
 * Descobre de que lado da nota o cliente está, comparando SÓ número de
 * documento. O CPF do cliente e o CNPJ da empresa dele valem para os dois
 * lados — MEI emite com CNPJ, autônomo pode aparecer com CPF.
 */
export function papelDoClienteNaNota(
  nota: NotaFiscalXml,
  ref: ReferenciaClienteNota,
): PapelDoClienteNaNota {
  const meus = new Set([digitos(ref.cpf), digitos(ref.cnpj)].filter((d) => d.length >= 11));
  if (!meus.size) return "nenhum";
  const emitente = digitos(nota.emitente.documento);
  const destinatario = digitos(nota.destinatario.documento);
  if (emitente && meus.has(emitente)) return "emitente";
  if (destinatario && meus.has(destinatario)) return "destinatario";
  return "nenhum";
}

/**
 * Slug do documento.
 *
 * 1. Slot de nota fiscal aberto pelo cliente manda — ele sabe o que veio
 *    buscar, e o slot já traz o escopo (arma x ocupação lícita).
 * 2. Sem slot de nota fiscal: quem emitiu a nota é o cliente → comprova
 *    ATIVIDADE ECONÔMICA (renda_nf_empresa). Quem recebeu a nota é o cliente
 *    → é a nota de COMPRA (nota_fiscal_arma).
 * 3. Se o cliente não aparece em nenhuma das pontas, não há o que decidir:
 *    mantém o slot e o Hub cobra a divergência na tela.
 */
export function tipoDocumentoDaNotaXml(
  papel: PapelDoClienteNaNota,
  tipoSlot?: string | null,
): string {
  const slot = String(tipoSlot ?? "").trim();
  if (slot && isNotaFiscalOcupacao(slot)) return slot;
  if (papel === "emitente") return "renda_nf_empresa";
  if (papel === "destinatario") return "nota_fiscal_arma";
  return slot || "renda_nf_empresa";
}

/**
 * Texto integral do documento, na mesma ordem em que o PDF o imprime. É este
 * texto que vai para `conferirCertidao` e para o Golden Record — não uma
 * releitura do PDF, que reintroduziria adivinhação onde já há dado exato.
 */
export function textoDaNotaXml(nota: NotaFiscalXml): string {
  const l: string[] = [];
  l.push("DANFE — DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA");
  l.push(`${nota.rotulo} — representação gerada a partir do arquivo XML autorizado pela SEFAZ.`);
  l.push(`Chave de acesso: ${nota.chave}`);
  if (nota.numero) l.push(`Número da nota: ${nota.numero}`);
  if (nota.serie) l.push(`Série: ${nota.serie}`);
  if (nota.dataEmissao) l.push(`Data de emissão: ${nota.dataEmissao}`);
  if (nota.naturezaOperacao) l.push(`Natureza da operação: ${nota.naturezaOperacao}`);
  if (nota.protocolo) l.push(`Protocolo de autorização de uso: ${nota.protocolo}`);
  if (nota.situacao) l.push(`Situação na SEFAZ: ${nota.situacao}`);

  l.push("EMITENTE (PRESTADOR)");
  if (nota.emitente.nome) l.push(`Nome / Razão social: ${nota.emitente.nome}`);
  if (nota.emitente.documento) l.push(`CNPJ / CPF: ${nota.emitente.documento}`);
  if (nota.emitente.inscricaoEstadual) l.push(`Inscrição estadual: ${nota.emitente.inscricaoEstadual}`);
  const endEmit = enderecoEmLinha(nota.emitente);
  if (endEmit) l.push(`Endereço: ${endEmit}`);
  if (nota.emitente.cep) l.push(`CEP: ${nota.emitente.cep}`);

  l.push("DESTINATÁRIO (TOMADOR)");
  if (nota.destinatario.nome) l.push(`Nome / Razão social: ${nota.destinatario.nome}`);
  if (nota.destinatario.documento) l.push(`CNPJ / CPF: ${nota.destinatario.documento}`);
  const endDest = enderecoEmLinha(nota.destinatario);
  if (endDest) l.push(`Endereço: ${endDest}`);
  if (nota.destinatario.cep) l.push(`CEP: ${nota.destinatario.cep}`);

  l.push(nota.modelo === "nfse" ? "SERVIÇO PRESTADO" : "PRODUTOS / SERVIÇOS");
  for (const item of nota.itens) {
    l.push(
      [
        `${item.numero}`,
        item.descricao,
        item.ncm ? `NCM ${item.ncm}` : "",
        item.cfop ? `CFOP ${item.cfop}` : "",
        item.unidade ?? "",
        item.quantidade != null ? moedaBr(item.quantidade) : "",
        item.valorUnitario != null ? moedaBr(item.valorUnitario) : "",
        item.valorTotal != null ? moedaBr(item.valorTotal) : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  l.push("TOTAIS");
  if (nota.valorTotal != null) l.push(`VALOR TOTAL DA NOTA: R$ ${moedaBr(nota.valorTotal)}`);
  if (nota.informacoesComplementares) {
    l.push("INFORMAÇÕES COMPLEMENTARES");
    l.push(nota.informacoesComplementares);
  }
  return l.join("\n");
}

/**
 * Campos planos para `calcularConformidade`.
 *
 * Nome e CPF pessoais só entram quando o CLIENTE é o destinatário (nota de
 * compra): aí o confronto "este documento é do titular?" faz sentido. Na nota
 * que o cliente EMITIU, o destinatário é um terceiro legítimo e escrever o
 * nome dele em `nome_completo` faria o Hub acusar documento de outra pessoa.
 */
export function camposPlanosDaNotaXml(
  nota: NotaFiscalXml,
  papel: PapelDoClienteNaNota,
): Record<string, string | undefined> {
  const campos: Record<string, string | undefined> = {
    cnpj: nota.emitente.documento,
    razao_social: nota.emitente.nome?.toUpperCase(),
    nome_empresarial: nota.emitente.nome?.toUpperCase(),
    numero_nf: nota.numero,
    valor_nf: moedaBr(nota.valorTotal) || undefined,
    chave_acesso: nota.chave,
    data_emissao: nota.dataEmissao,
    prestador_endereco: enderecoEmLinha(nota.emitente)?.toUpperCase(),
    prestador_municipio: municipioUf(nota.emitente)?.toUpperCase(),
    prestador_cep: nota.emitente.cep,
    tomador_documento: nota.destinatario.documento,
    tomador_nome: nota.destinatario.nome?.toUpperCase(),
    tomador_endereco: enderecoEmLinha(nota.destinatario)?.toUpperCase(),
    tomador_municipio: municipioUf(nota.destinatario)?.toUpperCase(),
    tomador_cep: nota.destinatario.cep,
  };
  if (papel === "destinatario") {
    campos.nome_completo = nota.destinatario.nome?.toUpperCase();
    const doc = String(nota.destinatario.documento ?? "");
    if (doc.length === 11) campos.cpf = doc;
    // A nota de compra é do titular: aqui o "tomador" É o cliente, e a trava
    // de emissão entre parentes não se aplica. Sem isso o próprio cliente
    // seria acusado de ser parente de si mesmo.
    delete campos.tomador_nome;
    delete campos.tomador_endereco;
    delete campos.tomador_cep;
  }
  return campos;
}

/**
 * Ponto de entrada do Hub: recebe o arquivo XML anexado e devolve tudo pronto.
 */
export async function importarNotaFiscalXml(
  arquivo: File,
  ref: ReferenciaClienteNota = {},
): Promise<ResultadoImportacaoXml> {
  let bruto = "";
  try {
    // Leitura com reserva: `Blob.text()` não existe em WebView Android antigo,
    // e é nele que o cliente mais apanha.
    bruto = await lerTextoDoArquivo(arquivo);
  } catch {
    return { ok: false, motivo: "Não conseguimos abrir o arquivo XML. Anexe o arquivo de novo." };
  }

  const leitura = lerNotaFiscalXml(bruto);
  if (leitura.ok === false) return { ok: false, motivo: leitura.motivo };

  const nota = leitura.nota;
  const papel = papelDoClienteNaNota(nota, ref);
  const tipoDocumento = tipoDocumentoDaNotaXml(papel, ref.tipoSlot);
  const campos = { ...camposCertidaoDaNotaXml(nota), tipoDocumento };

  let pdf: File;
  try {
    pdf = arquivoDanfeDoXml(nota);
  } catch (e) {
    console.error("[nota-fiscal-xml] falha ao gerar o DANFE", e);
    return {
      ok: false,
      motivo: "A nota foi lida, mas não conseguimos gerar o PDF aqui no navegador. Tente de novo.",
    };
  }

  return {
    ok: true,
    importada: {
      nota,
      pdf,
      campos,
      camposPlanos: camposPlanosDaNotaXml(nota, papel),
      tipoDocumento,
      papelDoCliente: papel,
      texto: textoDaNotaXml(nota),
    },
  };
}

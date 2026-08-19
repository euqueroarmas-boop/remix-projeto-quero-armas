// ============================================================================
// danfePdfDoXml.ts — gera o DANFE em PDF a partir do XML autorizado
// ----------------------------------------------------------------------------
// O PDF gerado aqui existe para resolver UM problema: o cliente tem a nota
// fiscal legítima, mas o PDF que o celular salvou não tem camada de texto e
// nenhum leitor consegue abrir o conteúdo (ver `notaFiscalXml.ts`).
//
// Este arquivo NÃO substitui o DANFE oficial e não se apresenta como tal. Ele
// imprime, com texto de verdade (`jsPDF.text`, fonte padrão — extraível pelo
// pdf.js), exatamente o que está no XML assinado, mais o cabeçalho que permite
// a qualquer um conferir a nota no portal da SEFAZ: chave de acesso completa,
// protocolo de autorização e data/hora do protocolo.
//
// REGRA: nada é escrito no PDF que não esteja no XML. Sem cálculo próprio, sem
// completar campo faltante, sem "aproximadamente". Campo ausente sai vazio.
// ============================================================================
import { jsPDF } from "jspdf";
import {
  chaveFormatada,
  dataBr,
  enderecoEmLinha,
  moedaBr,
  municipioUf,
  type NotaFiscalXml,
  type ParteNotaFiscalXml,
} from "./notaFiscalXml";

const MARGEM = 12;
const LARGURA = 210; // A4 retrato, mm
const ALTURA = 297;
const UTIL = LARGURA - MARGEM * 2;

/** CNPJ/CPF com máscara, para leitura humana. Documento vazio sai vazio. */
function documentoFormatado(doc?: string): string {
  const d = String(doc ?? "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d;
}

function cepFormatado(cep?: string): string {
  const d = String(cep ?? "").replace(/\D/g, "");
  return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, "$1-$2") : d;
}

/** Data e hora do XML (`2026-08-17T14:40:35-03:00`) → `17/08/2026 14:40:35`. */
function dataHoraBr(v?: string): string {
  const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}(?::\d{2})?)/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : dataBr(v);
}

/**
 * Linhas de uma das partes da nota. Rotuladas com os DOIS vocabulários
 * (EMITENTE/PRESTADOR, DESTINATÁRIO/TOMADOR) porque é assim que o documento
 * é lido depois — e porque o cliente reconhece o rótulo do seu emissor.
 */
function linhasDaParte(p: ParteNotaFiscalXml, rotuloDocumento: string): string[] {
  const linhas: string[] = [];
  if (p.nome) linhas.push(`Nome / Razão social: ${p.nome}`);
  if (p.fantasia) linhas.push(`Nome fantasia: ${p.fantasia}`);
  if (p.documento) linhas.push(`${rotuloDocumento}: ${documentoFormatado(p.documento)}`);
  if (p.inscricaoEstadual) linhas.push(`Inscrição estadual: ${p.inscricaoEstadual}`);
  if (p.inscricaoMunicipal) linhas.push(`Inscrição municipal: ${p.inscricaoMunicipal}`);
  const endereco = enderecoEmLinha(p);
  if (endereco) linhas.push(`Endereço: ${endereco}`);
  const cidade = municipioUf(p);
  if (cidade) linhas.push(`Município: ${cidade}`);
  if (p.cep) linhas.push(`CEP: ${cepFormatado(p.cep)}`);
  if (p.telefone) linhas.push(`Telefone: ${p.telefone}`);
  if (p.email) linhas.push(`E-mail: ${p.email}`);
  return linhas;
}

/**
 * Monta o PDF. Devolve o `jsPDF` para que o chamador decida o formato de saída
 * (blob, arquivo, data-uri) — quem escreve o arquivo é `arquivoDanfeDoXml`.
 */
export function gerarDanfePdfDoXml(nota: NotaFiscalXml): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  let y = MARGEM;

  const quebraPagina = (altura: number) => {
    if (y + altura <= ALTURA - MARGEM - 10) return;
    pdf.addPage();
    y = MARGEM;
  };

  const escrever = (
    texto: string,
    opts: { tamanho?: number; negrito?: boolean; x?: number; larguraMax?: number } = {},
  ) => {
    const { tamanho = 9, negrito = false, x = MARGEM, larguraMax = UTIL } = opts;
    pdf.setFont("helvetica", negrito ? "bold" : "normal");
    pdf.setFontSize(tamanho);
    const linhas = pdf.splitTextToSize(texto, larguraMax) as string[];
    for (const linha of linhas) {
      quebraPagina(tamanho * 0.42 + 1.2);
      pdf.text(linha, x, y);
      y += tamanho * 0.42 + 1.2;
    }
  };

  const titulo = (texto: string) => {
    y += 2.5;
    quebraPagina(9);
    pdf.setDrawColor(120);
    pdf.line(MARGEM, y - 3.2, LARGURA - MARGEM, y - 3.2);
    escrever(texto, { tamanho: 9.5, negrito: true });
    y += 0.8;
  };

  /* ── Cabeçalho ─────────────────────────────────────────────────────────
   * A primeira linha diz, sem rodeio, o que este arquivo é: representação do
   * XML autorizado. Quem receber o documento precisa saber disso e precisa do
   * caminho para conferir a nota na fonte. */
  escrever("DANFE — DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA", {
    tamanho: 13,
    negrito: true,
  });
  escrever(`${nota.rotulo} — representação gerada a partir do arquivo XML autorizado pela SEFAZ.`, {
    tamanho: 8.5,
  });
  escrever(
    "Confira a autenticidade pela chave de acesso em www.nfe.fazenda.gov.br/portal (Consultar NF-e).",
    { tamanho: 8.5 },
  );

  /* ── Identificação ── */
  titulo("IDENTIFICAÇÃO DA NOTA FISCAL");
  escrever(`Chave de acesso: ${chaveFormatada(nota.chave)}`, { tamanho: 10, negrito: true });
  const identificacao = [
    nota.numero ? `Número da nota: ${nota.numero}` : "",
    nota.serie ? `Série: ${nota.serie}` : "",
    nota.dataEmissao ? `Data de emissão: ${dataHoraBr(nota.dataHoraEmissao) || dataBr(nota.dataEmissao)}` : "",
    nota.competencia ? `Competência: ${dataBr(nota.competencia)}` : "",
  ].filter(Boolean);
  if (identificacao.length) escrever(identificacao.join("   |   "));
  if (nota.naturezaOperacao) escrever(`Natureza da operação: ${nota.naturezaOperacao}`);
  if (nota.protocolo) {
    escrever(
      `Protocolo de autorização de uso: ${nota.protocolo}${
        nota.dataHoraProtocolo ? ` — ${dataHoraBr(nota.dataHoraProtocolo)}` : ""
      }`,
    );
  }
  if (nota.situacao) escrever(`Situação na SEFAZ: ${nota.situacao}`);

  /* ── Partes ── */
  titulo("EMITENTE (PRESTADOR)");
  for (const linha of linhasDaParte(nota.emitente, "CNPJ / CPF")) escrever(linha);

  titulo("DESTINATÁRIO (TOMADOR)");
  const linhasDestinatario = linhasDaParte(nota.destinatario, "CNPJ / CPF");
  if (linhasDestinatario.length) {
    for (const linha of linhasDestinatario) escrever(linha);
  } else {
    escrever("Não informado no XML.");
  }

  /* ── Itens ──────────────────────────────────────────────────────────────
   * Uma coluna por campo do XML. Sem totalizar nada por conta própria: o total
   * de cada item e o total da nota vêm prontos do arquivo. */
  titulo(nota.modelo === "nfse" ? "SERVIÇO PRESTADO" : "PRODUTOS / SERVIÇOS");
  if (!nota.itens.length) {
    escrever("O XML não traz itens discriminados.");
  } else if (nota.modelo === "nfse") {
    for (const item of nota.itens) escrever(`Descrição do serviço: ${item.descricao}`);
  } else {
    const colunas: Array<{ titulo: string; x: number; alinhaDireita?: boolean }> = [
      { titulo: "Item", x: MARGEM },
      { titulo: "Descrição", x: MARGEM + 11 },
      { titulo: "NCM", x: MARGEM + 82 },
      { titulo: "CFOP", x: MARGEM + 98 },
      { titulo: "Un", x: MARGEM + 111 },
      { titulo: "Qtd", x: MARGEM + 133, alinhaDireita: true },
      { titulo: "Vl. unit.", x: MARGEM + 158, alinhaDireita: true },
      { titulo: "Vl. total", x: UTIL + MARGEM, alinhaDireita: true },
    ];
    quebraPagina(6);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    for (const c of colunas) {
      pdf.text(c.titulo, c.x, y, c.alinhaDireita ? { align: "right" } : undefined);
    }
    y += 4;
    pdf.setFont("helvetica", "normal");
    for (const item of nota.itens) {
      const descricao = (pdf.splitTextToSize(item.descricao || "", 68) as string[]).slice(0, 3);
      quebraPagina(descricao.length * 3.6 + 1.5);
      const valores = [
        String(item.numero),
        "",
        item.ncm ?? "",
        item.cfop ?? "",
        item.unidade ?? "",
        item.quantidade != null ? moedaBr(item.quantidade) : "",
        item.valorUnitario != null ? moedaBr(item.valorUnitario) : "",
        item.valorTotal != null ? moedaBr(item.valorTotal) : "",
      ];
      pdf.setFontSize(8);
      // Desenha na ordem das colunas — inclusive a descrição, no lugar dela.
      // O pdf.js extrai o texto na ordem de DESENHO: se a descrição saísse por
      // último, a linha lida viraria "1 73066100 5102 UN 26,80 35,00 938,00
      // METAL", com o nome do produto solto no fim.
      colunas.forEach((c, i) => {
        if (i === 1) {
          descricao.forEach((linha, k) => pdf.text(linha, c.x, y + k * 3.6));
          return;
        }
        if (!valores[i]) return;
        pdf.text(valores[i], c.x, y, c.alinhaDireita ? { align: "right" } : undefined);
      });
      y += Math.max(descricao.length, 1) * 3.6 + 1.5;
    }
  }

  /* ── Totais ── */
  titulo("TOTAIS");
  if (nota.valorProdutos != null) {
    escrever(
      `${nota.modelo === "nfse" ? "Valor do serviço" : "Valor total dos produtos"}: R$ ${moedaBr(nota.valorProdutos)}`,
    );
  }
  if (nota.valorDesconto != null) escrever(`Desconto: R$ ${moedaBr(nota.valorDesconto)}`);
  escrever(
    `VALOR TOTAL DA NOTA: R$ ${nota.valorTotal != null ? moedaBr(nota.valorTotal) : "—"}`,
    { tamanho: 10.5, negrito: true },
  );

  if (nota.informacoesComplementares) {
    titulo("INFORMAÇÕES COMPLEMENTARES");
    escrever(nota.informacoesComplementares, { tamanho: 8 });
  }

  /* ── Rodapé em todas as páginas: a chave é a prova, tem que estar sempre. */
  const paginas = pdf.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    pdf.setPage(p);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(
      `Chave de acesso ${chaveFormatada(nota.chave)}  —  gerado pelo Hub Documental a partir do XML autorizado`,
      MARGEM,
      ALTURA - 8,
    );
    pdf.text(`Página ${p} de ${paginas}`, LARGURA - MARGEM, ALTURA - 8, { align: "right" });
  }

  return pdf;
}

/** Nome do arquivo: chave completa, para nunca colidir com outra nota. */
export function nomeArquivoDanfe(nota: NotaFiscalXml): string {
  const prefixo = nota.modelo === "nfse" ? "NFSe" : "DANFE";
  return `${prefixo}-${String(nota.chave).replace(/\D/g, "")}.pdf`;
}

/** O PDF pronto para entrar no Hub como se o cliente o tivesse anexado. */
export function arquivoDanfeDoXml(nota: NotaFiscalXml): File {
  const blob = gerarDanfePdfDoXml(nota).output("blob");
  return new File([blob], nomeArquivoDanfe(nota), { type: "application/pdf" });
}

// ============================================================================
// danfePdfDoXml.ts — imprime o DANFE oficial a partir do XML autorizado
// ----------------------------------------------------------------------------
// O PDF gerado aqui existe para resolver UM problema: o cliente tem a nota
// fiscal legítima, mas o PDF que o celular salvou não tem camada de texto e
// nenhum leitor consegue abrir o conteúdo (ver `notaFiscalXml.ts`).
//
// A primeira versão imprimia os dados em lista, e o resultado parecia uma nota
// montada no Word — ninguém do outro lado do balcão reconhece aquilo como uma
// nota fiscal. Esta versão reproduz o LAYOUT OFICIAL do DANFE (Manual de
// Orientação do Contribuinte, Anexo II): canhoto de recebimento, quadro do
// emitente, código de barras CODE 128C da chave, quadros de destinatário,
// cálculo do imposto, transportador, tabela de produtos e dados adicionais.
//
// Duas exigências que valem mais que a estética:
//
//  1. TEXTO DE VERDADE. Tudo é escrito com `jsPDF.text` em fonte padrão, e o
//     código de barras é desenhado com retângulos vetoriais — nada de imagem
//     rasterizada. O pdf.js extrai cada campo, que é o que destravou o caso.
//
//  2. NADA É INVENTADO. Só se imprime o que está no XML assinado. Sem cálculo
//     próprio, sem completar campo faltante, sem "aproximadamente". Campo de
//     texto ausente sai em branco.
//
//     ÚNICA exceção, e ela não é invenção: as colunas monetárias de ICMS e IPI
//     de cada item. A nota do Simples Nacional (CSOSN 102) não informa esses
//     valores porque eles são zero por definição — e todo emissor oficial
//     imprime "0,00" ali. Deixar em branco faria a nota parecer incompleta
//     para quem a recebe, sem nenhum ganho de fidelidade.
// ============================================================================
import { jsPDF } from "jspdf";
import { code128cBarras, code128cModulos } from "./code128";
import {
  chaveFormatada,
  dataBr,
  moedaBr,
  municipioUf,
  type ItemNotaFiscalXml,
  type NotaFiscalXml,
  type ParteNotaFiscalXml,
} from "./notaFiscalXml";

/* ── Medidas da folha (A4 retrato, milímetros) ──────────────────────────── */
const MARGEM = 6;
const LARGURA = 210;
const ALTURA = 297;
const UTIL = LARGURA - MARGEM * 2; // 198
const FIM = ALTURA - MARGEM;

/** Alturas dos elementos, em mm. */
const H_TITULO = 3.4; // faixa "DESTINATÁRIO / REMETENTE" etc.
const H_CAMPO = 7.6; // linha comum de campos rotulados
const H_ITEM = 3.5; // uma linha da tabela de produtos

/** Corpos de texto, em pontos. */
const PT_ROTULO = 4.6;
const PT_VALOR = 7.4;
const PT_ITEM = 5.6;

/* ── Formatação ─────────────────────────────────────────────────────────── */

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

/** `2026-08-17T14:40:35-03:00` → `17/08/2026`. Nunca reinterpreta o fuso. */
function soData(v?: string): string {
  return dataBr(String(v ?? "").slice(0, 10));
}

function soHora(v?: string): string {
  return String(v ?? "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? "";
}

function dataHoraBr(v?: string): string {
  const data = soData(v);
  const hora = soHora(v);
  return [data, hora].filter(Boolean).join(" ");
}

/** Número da nota como o DANFE imprime: 000.000.001. */
function numeroFormatado(numero?: string): string {
  const d = String(numero ?? "").replace(/\D/g, "");
  if (!d) return "";
  return d.padStart(9, "0").replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
}

function serieFormatada(serie?: string): string {
  const d = String(serie ?? "").replace(/\D/g, "");
  return d ? d.padStart(3, "0") : "";
}

/** Rótulo da modalidade do frete, na forma abreviada que o DANFE usa. */
function rotuloFrete(codigo?: string): string {
  const mapa: Record<string, string> = {
    "0": "0-Por conta do Emit",
    "1": "1-Por conta do Dest",
    "2": "2-Por conta de Terceiros",
    "3": "3-Transp. Próprio Emit",
    "4": "4-Transp. Próprio Dest",
    "9": "9-Sem Frete",
  };
  return mapa[String(codigo ?? "")] ?? "";
}

/** Endereço do emitente / destinatário na forma "Logradouro, nº - complemento". */
function ruaNumero(p: ParteNotaFiscalXml): string {
  return [[p.logradouro, p.numero].filter(Boolean).join(", "), p.complemento]
    .filter(Boolean)
    .join(" - ");
}

/* ── Primitivas de desenho ──────────────────────────────────────────────── */

type Alinhamento = "left" | "center" | "right";

interface Campo {
  rotulo?: string;
  valor?: string;
  /** Fração da largura da linha (as frações de uma linha somam 1). */
  fr: number;
  alinhar?: Alinhamento;
  /** Corpo do valor, em pontos. Padrão `PT_VALOR`. */
  pt?: number;
}

class Folha {
  readonly pdf: jsPDF;
  y = MARGEM;

  constructor(pdf: jsPDF) {
    this.pdf = pdf;
    pdf.setLineWidth(0.14);
    pdf.setDrawColor(0);
  }

  moldura(x: number, y: number, w: number, h: number) {
    this.pdf.rect(x, y, w, h);
  }

  /** Rótulo miúdo no canto superior esquerdo da célula. */
  rotulo(texto: string, x: number, y: number) {
    if (!texto) return;
    this.pdf.setFont("times", "normal");
    this.pdf.setFontSize(PT_ROTULO);
    this.pdf.text(texto, x + 0.7, y + 2);
  }

  /**
   * Valor da célula, em negrito, encostado na base — como no DANFE oficial.
   * Encolhe a fonte quando o texto não cabe, em vez de transbordar por cima da
   * célula vizinha.
   */
  valor(texto: string, x: number, y: number, w: number, h: number, alinhar: Alinhamento = "left", pt = PT_VALOR) {
    if (!texto) return;
    this.pdf.setFont("times", "bold");
    let corpo = pt;
    this.pdf.setFontSize(corpo);
    const disponivel = w - 1.6;
    while (corpo > 3.6 && this.pdf.getTextWidth(texto) > disponivel) {
      corpo -= 0.3;
      this.pdf.setFontSize(corpo);
    }
    const base = y + h - 1.5;
    if (alinhar === "center") this.pdf.text(texto, x + w / 2, base, { align: "center" });
    else if (alinhar === "right") this.pdf.text(texto, x + w - 0.9, base, { align: "right" });
    else this.pdf.text(texto, x + 0.9, base);
  }

  /** Uma linha de células rotuladas, ocupando a largura útil. */
  linha(campos: Campo[], altura = H_CAMPO, x0 = MARGEM, largura = UTIL) {
    let x = x0;
    for (const campo of campos) {
      const w = largura * campo.fr;
      this.moldura(x, this.y, w, altura);
      this.rotulo(campo.rotulo ?? "", x, this.y);
      this.valor(campo.valor ?? "", x, this.y, w, altura, campo.alinhar, campo.pt);
      x += w;
    }
    this.y += altura;
  }

  /** Faixa de título de quadro ("DESTINATÁRIO / REMETENTE"). */
  titulo(texto: string) {
    this.pdf.setFont("times", "bold");
    this.pdf.setFontSize(5.6);
    this.pdf.text(texto, MARGEM + 0.4, this.y + 2.6);
    this.y += H_TITULO;
  }
}

/**
 * Código de barras CODE 128C da chave, desenhado em vetor.
 *
 * Retângulo por faixa de barras — o resultado é nítido em qualquer zoom e o
 * arquivo continua com poucos KB, ao contrário de um PNG embutido.
 */
function codigoDeBarras(pdf: jsPDF, chave: string, x: number, y: number, w: number, h: number) {
  const modulos = code128cModulos(String(chave ?? "").replace(/\D/g, ""));
  if (!modulos) return;
  const larguraModulo = w / modulos.length;
  pdf.setFillColor(0, 0, 0);
  for (const [inicio, largura] of code128cBarras(modulos)) {
    pdf.rect(x + inicio * larguraModulo, y, largura * larguraModulo, h, "F");
  }
}

/* ── Quadros do DANFE ───────────────────────────────────────────────────── */

/** Canhoto de recebimento — só na primeira folha, como manda o modelo. */
function canhoto(f: Folha, nota: NotaFiscalXml) {
  const larguraNf = 32;
  const larguraRecibo = UTIL - larguraNf;
  const alturaRecibo = 10;
  const alturaAssinatura = 7;
  const alturaTotal = alturaRecibo + alturaAssinatura;
  const y0 = f.y;

  const destino = [
    nota.destinatario.nome,
    ruaNumero(nota.destinatario),
    nota.destinatario.bairro,
    municipioUf(nota.destinatario),
  ]
    .filter(Boolean)
    .join(" - ");
  const texto =
    `RECEBEMOS DE ${nota.emitente.nome ?? ""} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ` +
    `ELETRÔNICA INDICADA ABAIXO. EMISSÃO: ${soData(nota.dataHoraEmissao ?? nota.dataEmissao)} ` +
    `VALOR TOTAL: R$ ${moedaBr(nota.valorTotal)} DESTINATÁRIO: ${destino}`;

  f.moldura(MARGEM, y0, larguraRecibo, alturaRecibo);
  f.pdf.setFont("times", "normal");
  f.pdf.setFontSize(5);
  const linhas = (f.pdf.splitTextToSize(texto, larguraRecibo - 2) as string[]).slice(0, 4);
  linhas.forEach((linha, i) => f.pdf.text(linha, MARGEM + 1, y0 + 2.4 + i * 2.1));

  // Segunda faixa do canhoto: data e assinatura de quem recebeu.
  const yAssinatura = y0 + alturaRecibo;
  f.moldura(MARGEM, yAssinatura, larguraRecibo * 0.28, alturaAssinatura);
  f.rotulo("DATA DE RECEBIMENTO", MARGEM, yAssinatura);
  f.moldura(MARGEM + larguraRecibo * 0.28, yAssinatura, larguraRecibo * 0.72, alturaAssinatura);
  f.rotulo("IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR", MARGEM + larguraRecibo * 0.28, yAssinatura);

  // Caixa da direita: NF-e, número e série.
  const xNf = MARGEM + larguraRecibo;
  f.moldura(xNf, y0, larguraNf, alturaTotal);
  f.pdf.setFont("times", "bold");
  f.pdf.setFontSize(11);
  f.pdf.text("NF-e", xNf + larguraNf / 2, y0 + 6, { align: "center" });
  f.pdf.setFontSize(7);
  f.pdf.text(`Nº. ${numeroFormatado(nota.numero)}`, xNf + larguraNf / 2, y0 + 11, { align: "center" });
  f.pdf.text(`Série ${serieFormatada(nota.serie)}`, xNf + larguraNf / 2, y0 + 15, { align: "center" });

  f.y = y0 + alturaTotal + 1;

  // Linha tracejada de recorte.
  f.pdf.setLineDashPattern([1, 1], 0);
  f.pdf.line(MARGEM, f.y, LARGURA - MARGEM, f.y);
  f.pdf.setLineDashPattern([], 0);
  f.y += 1.6;
}

/** Cabeçalho: emitente, bloco DANFE e código de barras. Repete a cada folha. */
function cabecalho(f: Folha, nota: NotaFiscalXml, folha: number, folhas: number) {
  const altura = 26;
  const y0 = f.y;
  const wEmit = UTIL * 0.42;
  const wDanfe = UTIL * 0.23;
  const wChave = UTIL - wEmit - wDanfe;

  /* Emitente */
  f.moldura(MARGEM, y0, wEmit, altura);
  f.pdf.setFont("times", "italic");
  f.pdf.setFontSize(5);
  f.pdf.text("IDENTIFICAÇÃO DO EMITENTE", MARGEM + 2, y0 + 3);
  const centroEmit = MARGEM + wEmit / 2;
  f.pdf.setFont("times", "bold");
  f.pdf.setFontSize(8.5);
  const nomeLinhas = (f.pdf.splitTextToSize(nota.emitente.nome ?? "", wEmit - 4) as string[]).slice(0, 2);
  nomeLinhas.forEach((linha, i) => f.pdf.text(linha, centroEmit, y0 + 9 + i * 4, { align: "center" }));
  f.pdf.setFont("times", "normal");
  f.pdf.setFontSize(6.4);
  const enderecoLinhas = [
    ruaNumero(nota.emitente),
    [nota.emitente.bairro, cepFormatado(nota.emitente.cep)].filter(Boolean).join(" - "),
    [
      municipioUf(nota.emitente),
      nota.emitente.telefone ? `Fone/Fax: ${nota.emitente.telefone}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  ].filter(Boolean);
  const yEndereco = y0 + 9 + nomeLinhas.length * 4 + 1;
  enderecoLinhas.forEach((linha, i) =>
    f.pdf.text(linha, centroEmit, yEndereco + i * 3, { align: "center", maxWidth: wEmit - 4 }),
  );

  /* Bloco DANFE */
  const xDanfe = MARGEM + wEmit;
  const centroDanfe = xDanfe + wDanfe / 2;
  f.moldura(xDanfe, y0, wDanfe, altura);
  f.pdf.setFont("times", "bold");
  f.pdf.setFontSize(12);
  f.pdf.text("DANFE", centroDanfe, y0 + 5.5, { align: "center" });
  f.pdf.setFont("times", "normal");
  f.pdf.setFontSize(5.4);
  f.pdf.text("Documento Auxiliar da Nota", centroDanfe, y0 + 8.6, { align: "center" });
  f.pdf.text("Fiscal Eletrônica", centroDanfe, y0 + 11, { align: "center" });
  f.pdf.setFontSize(5.8);
  f.pdf.text("0 - ENTRADA", xDanfe + 2, y0 + 15);
  f.pdf.text("1 - SAÍDA", xDanfe + 2, y0 + 18);
  // Quadradinho com o tipo da operação, lido de `tpNF`.
  f.moldura(xDanfe + wDanfe - 8, y0 + 13.4, 5.5, 5.5);
  f.pdf.setFont("times", "bold");
  f.pdf.setFontSize(8);
  f.pdf.text(String(nota.tipoOperacao ?? ""), xDanfe + wDanfe - 5.25, y0 + 17.4, { align: "center" });
  f.pdf.setFontSize(7);
  f.pdf.text(`Nº. ${numeroFormatado(nota.numero)}`, centroDanfe, y0 + 21.4, { align: "center" });
  f.pdf.text(`Série ${serieFormatada(nota.serie)}`, centroDanfe, y0 + 24, { align: "center" });
  f.pdf.setFont("times", "italic");
  f.pdf.setFontSize(5.4);
  f.pdf.text(`Folha ${folha}/${folhas}`, xDanfe + wDanfe - 1.5, y0 + 24, { align: "right" });

  /* Código de barras e chave */
  const xChave = xDanfe + wDanfe;
  f.moldura(xChave, y0, wChave, 12);
  codigoDeBarras(f.pdf, nota.chave, xChave + 3, y0 + 1.6, wChave - 6, 9);
  f.moldura(xChave, y0 + 12, wChave, 7.4);
  f.rotulo("CHAVE DE ACESSO", xChave, y0 + 12);
  f.pdf.setFont("times", "bold");
  f.pdf.setFontSize(6.6);
  f.pdf.text(chaveFormatada(nota.chave), xChave + wChave / 2, y0 + 17.6, { align: "center" });
  f.moldura(xChave, y0 + 19.4, wChave, altura - 19.4);
  f.pdf.setFont("times", "normal");
  f.pdf.setFontSize(5.6);
  f.pdf.text("Consulta de autenticidade no portal nacional da NF-e", xChave + wChave / 2, y0 + 22.4, {
    align: "center",
  });
  f.pdf.text("www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora", xChave + wChave / 2, y0 + 25, {
    align: "center",
  });

  f.y = y0 + altura;

  /* Natureza da operação e protocolo */
  f.linha([
    { rotulo: "NATUREZA DA OPERAÇÃO", valor: nota.naturezaOperacao ?? "", fr: 0.62 },
    {
      rotulo: "PROTOCOLO DE AUTORIZAÇÃO DE USO",
      valor: [nota.protocolo, dataHoraBr(nota.dataHoraProtocolo)].filter(Boolean).join(" - "),
      fr: 0.38,
      alinhar: "center",
    },
  ]);

  /* Inscrições e CNPJ do emitente */
  f.linha([
    { rotulo: "INSCRIÇÃO ESTADUAL", valor: nota.emitente.inscricaoEstadual ?? "", fr: 0.34, alinhar: "center" },
    {
      rotulo: "INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.",
      valor: nota.inscricaoEstadualSubstituto ?? "",
      fr: 0.33,
      alinhar: "center",
    },
    {
      rotulo: "CNPJ / CPF",
      valor: documentoFormatado(nota.emitente.documento),
      fr: 0.33,
      alinhar: "center",
    },
  ]);
}

function quadroDestinatario(f: Folha, nota: NotaFiscalXml) {
  const d = nota.destinatario;
  f.titulo("DESTINATÁRIO / REMETENTE");
  f.linha([
    { rotulo: "NOME / RAZÃO SOCIAL", valor: d.nome ?? "", fr: 0.6 },
    { rotulo: "CNPJ / CPF", valor: documentoFormatado(d.documento), fr: 0.23, alinhar: "center" },
    { rotulo: "DATA DA EMISSÃO", valor: soData(nota.dataHoraEmissao ?? nota.dataEmissao), fr: 0.17, alinhar: "center" },
  ]);
  f.linha([
    { rotulo: "ENDEREÇO", valor: ruaNumero(d), fr: 0.42 },
    { rotulo: "BAIRRO / DISTRITO", valor: d.bairro ?? "", fr: 0.22, alinhar: "center" },
    { rotulo: "CEP", valor: cepFormatado(d.cep), fr: 0.19, alinhar: "center" },
    { rotulo: "DATA DA SAÍDA/ENTRADA", valor: soData(nota.dataHoraSaida), fr: 0.17, alinhar: "center" },
  ]);
  f.linha([
    { rotulo: "MUNICÍPIO", valor: d.municipio ?? "", fr: 0.34 },
    { rotulo: "UF", valor: d.uf ?? "", fr: 0.06, alinhar: "center" },
    { rotulo: "FONE / FAX", valor: d.telefone ?? "", fr: 0.19, alinhar: "center" },
    { rotulo: "INSCRIÇÃO ESTADUAL", valor: d.inscricaoEstadual ?? "", fr: 0.24, alinhar: "center" },
    { rotulo: "HORA DA SAÍDA/ENTRADA", valor: soHora(nota.dataHoraSaida), fr: 0.17, alinhar: "center" },
  ]);
}

function quadroImposto(f: Folha, nota: NotaFiscalXml) {
  const t = nota.totais ?? {};
  const real = (v?: number) => (v == null ? "" : moedaBr(v));
  f.titulo("CÁLCULO DO IMPOSTO");
  const fr = 1 / 9;
  f.linha([
    { rotulo: "BASE DE CÁLC. DO ICMS", valor: real(t.baseIcms), fr, alinhar: "right" },
    { rotulo: "VALOR DO ICMS", valor: real(t.valorIcms), fr, alinhar: "right" },
    { rotulo: "BASE DE CÁLC. ICMS S.T.", valor: real(t.baseIcmsSt), fr, alinhar: "right" },
    { rotulo: "VALOR DO ICMS SUBST.", valor: real(t.valorIcmsSt), fr, alinhar: "right" },
    { rotulo: "V. IMP. IMPORTAÇÃO", valor: real(t.valorImportacao), fr, alinhar: "right" },
    { rotulo: "V. ICMS UF REMET.", valor: real(t.valorIcmsUfRemetente), fr, alinhar: "right" },
    { rotulo: "V. FCP UF DEST.", valor: real(t.valorFcpUfDestino), fr, alinhar: "right" },
    { rotulo: "VALOR DO PIS", valor: real(t.valorPis), fr, alinhar: "right" },
    { rotulo: "V. TOTAL PRODUTOS", valor: real(t.valorProdutos), fr, alinhar: "right" },
  ]);
  f.linha([
    { rotulo: "VALOR DO FRETE", valor: real(t.valorFrete), fr, alinhar: "right" },
    { rotulo: "VALOR DO SEGURO", valor: real(t.valorSeguro), fr, alinhar: "right" },
    { rotulo: "DESCONTO", valor: real(t.valorDesconto), fr, alinhar: "right" },
    { rotulo: "OUTRAS DESPESAS", valor: real(t.outrasDespesas), fr, alinhar: "right" },
    { rotulo: "VALOR TOTAL IPI", valor: real(t.valorIpi), fr, alinhar: "right" },
    { rotulo: "V. ICMS UF DEST.", valor: real(t.valorIcmsUfDestino), fr, alinhar: "right" },
    { rotulo: "V. TOT. TRIB.", valor: real(t.valorTributos), fr, alinhar: "right" },
    { rotulo: "VALOR DA COFINS", valor: real(t.valorCofins), fr, alinhar: "right" },
    { rotulo: "V. TOTAL DA NOTA", valor: real(t.valorTotal ?? nota.valorTotal), fr, alinhar: "right" },
  ]);
}

function quadroTransporte(f: Folha, nota: NotaFiscalXml) {
  const tr = nota.transporte ?? {};
  const t = tr.transportador ?? {};
  const v = tr.volumes ?? {};
  f.titulo("TRANSPORTADOR / VOLUMES TRANSPORTADOS");
  f.linha([
    { rotulo: "NOME / RAZÃO SOCIAL", valor: t.nome ?? "", fr: 0.37 },
    { rotulo: "FRETE", valor: rotuloFrete(tr.modalidadeFrete), fr: 0.16, alinhar: "center", pt: 6.4 },
    { rotulo: "CÓDIGO ANTT", valor: tr.rntc ?? "", fr: 0.13, alinhar: "center" },
    { rotulo: "PLACA DO VEÍCULO", valor: tr.placa ?? "", fr: 0.13, alinhar: "center" },
    { rotulo: "UF", valor: tr.ufPlaca ?? "", fr: 0.06, alinhar: "center" },
    { rotulo: "CNPJ / CPF", valor: documentoFormatado(t.documento), fr: 0.15, alinhar: "center" },
  ]);
  f.linha([
    { rotulo: "ENDEREÇO", valor: t.logradouro ?? "", fr: 0.45 },
    { rotulo: "MUNICÍPIO", valor: t.municipio ?? "", fr: 0.28 },
    { rotulo: "UF", valor: t.uf ?? "", fr: 0.06, alinhar: "center" },
    { rotulo: "INSCRIÇÃO ESTADUAL", valor: t.inscricaoEstadual ?? "", fr: 0.21, alinhar: "center" },
  ]);
  f.linha([
    { rotulo: "QUANTIDADE", valor: v.quantidade ?? "", fr: 0.15, alinhar: "center" },
    { rotulo: "ESPÉCIE", valor: v.especie ?? "", fr: 0.19 },
    { rotulo: "MARCA", valor: v.marca ?? "", fr: 0.19 },
    { rotulo: "NUMERAÇÃO", valor: v.numeracao ?? "", fr: 0.15 },
    { rotulo: "PESO BRUTO", valor: v.pesoBruto ?? "", fr: 0.16, alinhar: "right" },
    { rotulo: "PESO LÍQUIDO", valor: v.pesoLiquido ?? "", fr: 0.16, alinhar: "right" },
  ]);
}

/* ── Tabela de produtos ─────────────────────────────────────────────────── */

interface Coluna {
  titulo: string;
  fr: number;
  alinhar: Alinhamento;
  /** Valor da célula para um item. */
  ler: (i: ItemNotaFiscalXml) => string;
}

/** Quantidade e valor unitário saem com 4 casas, como no DANFE oficial. */
const quatroCasas = (v?: number): string =>
  v == null ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

/** Coluna monetária de imposto do item: ausente no XML significa zero. */
const impostoDoItem = (v?: number): string => moedaBr(v ?? 0);

const COLUNAS: Coluna[] = [
  { titulo: "CÓDIGO PRODUTO", fr: 0.115, alinhar: "left", ler: (i) => i.codigo ?? "" },
  { titulo: "DESCRIÇÃO DO PRODUTO / SERVIÇO", fr: 0.245, alinhar: "left", ler: (i) => i.descricao },
  { titulo: "NCM/SH", fr: 0.062, alinhar: "center", ler: (i) => i.ncm ?? "" },
  { titulo: "O/CSOSN", fr: 0.05, alinhar: "center", ler: (i) => i.origemCst ?? "" },
  { titulo: "CFOP", fr: 0.042, alinhar: "center", ler: (i) => i.cfop ?? "" },
  { titulo: "UN", fr: 0.03, alinhar: "center", ler: (i) => i.unidade ?? "" },
  { titulo: "QUANT", fr: 0.062, alinhar: "right", ler: (i) => quatroCasas(i.quantidade) },
  { titulo: "VALOR UNIT", fr: 0.062, alinhar: "right", ler: (i) => quatroCasas(i.valorUnitario) },
  { titulo: "VALOR TOTAL", fr: 0.065, alinhar: "right", ler: (i) => (i.valorTotal == null ? "" : moedaBr(i.valorTotal)) },
  { titulo: "B.CALC ICMS", fr: 0.06, alinhar: "right", ler: (i) => impostoDoItem(i.baseIcms) },
  { titulo: "VALOR ICMS", fr: 0.055, alinhar: "right", ler: (i) => impostoDoItem(i.valorIcms) },
  { titulo: "VALOR IPI", fr: 0.05, alinhar: "right", ler: (i) => impostoDoItem(i.valorIpi) },
  { titulo: "ALIQ. ICMS", fr: 0.055, alinhar: "right", ler: (i) => impostoDoItem(i.aliquotaIcms) },
  { titulo: "ALIQ. IPI", fr: 0.045, alinhar: "right", ler: (i) => impostoDoItem(i.aliquotaIpi) },
];

/** Quantas linhas a descrição de um item ocupa (máximo de 3). */
function linhasDoItem(pdf: jsPDF, item: ItemNotaFiscalXml): string[] {
  pdf.setFont("times", "normal");
  pdf.setFontSize(PT_ITEM);
  const largura = UTIL * COLUNAS[1].fr - 1.6;
  return (pdf.splitTextToSize(item.descricao || "", largura) as string[]).slice(0, 3);
}

function cabecalhoProdutos(f: Folha) {
  f.titulo("DADOS DOS PRODUTOS / SERVIÇOS");
  const altura = 5.4;
  let x = MARGEM;
  f.pdf.setFont("times", "normal");
  f.pdf.setFontSize(PT_ROTULO);
  for (const coluna of COLUNAS) {
    const w = UTIL * coluna.fr;
    f.moldura(x, f.y, w, altura);
    const linhas = f.pdf.splitTextToSize(coluna.titulo, w - 1) as string[];
    linhas.slice(0, 2).forEach((linha, i) => f.pdf.text(linha, x + w / 2, f.y + 2.2 + i * 2, { align: "center" }));
    x += w;
  }
  f.y += altura;
}

/**
 * Corpo da tabela. Desenha as linhas recebidas e fecha a moldura na altura
 * `alturaCaixa`, para o quadro ocupar a folha inteira como no modelo oficial.
 */
function corpoProdutos(f: Folha, itens: ItemNotaFiscalXml[], alturaCaixa: number) {
  const y0 = f.y;
  let y = y0;
  for (const item of itens) {
    const descricao = linhasDoItem(f.pdf, item);
    const altura = Math.max(descricao.length, 1) * H_ITEM;
    let x = MARGEM;
    COLUNAS.forEach((coluna, indice) => {
      const w = UTIL * coluna.fr;
      f.pdf.setFont("times", "normal");
      f.pdf.setFontSize(PT_ITEM);
      if (indice === 1) {
        descricao.forEach((linha, i) => f.pdf.text(linha, x + 0.8, y + 2.5 + i * H_ITEM));
      } else {
        const texto = coluna.ler(item);
        if (texto) {
          if (coluna.alinhar === "right") f.pdf.text(texto, x + w - 0.8, y + 2.5, { align: "right" });
          else if (coluna.alinhar === "center") f.pdf.text(texto, x + w / 2, y + 2.5, { align: "center" });
          else f.pdf.text(texto, x + 0.8, y + 2.5);
        }
      }
      x += w;
    });
    y += altura;
    // Separador tracejado entre itens, como no DANFE oficial.
    f.pdf.setLineDashPattern([0.4, 0.4], 0);
    f.pdf.setDrawColor(140);
    f.pdf.line(MARGEM, y, LARGURA - MARGEM, y);
    f.pdf.setLineDashPattern([], 0);
    f.pdf.setDrawColor(0);
  }

  // Moldura do quadro e as divisórias verticais até o fim da caixa.
  f.moldura(MARGEM, y0, UTIL, alturaCaixa);
  let xDiv = MARGEM;
  for (const coluna of COLUNAS.slice(0, -1)) {
    xDiv += UTIL * coluna.fr;
    f.pdf.line(xDiv, y0, xDiv, y0 + alturaCaixa);
  }
  f.y = y0 + alturaCaixa;
}

function quadroAdicionais(f: Folha, nota: NotaFiscalXml, altura: number) {
  f.titulo("DADOS ADICIONAIS");
  const wInfo = UTIL * 0.66;
  f.moldura(MARGEM, f.y, wInfo, altura);
  f.rotulo("INFORMAÇÕES COMPLEMENTARES", MARGEM, f.y);
  f.moldura(MARGEM + wInfo, f.y, UTIL - wInfo, altura);
  f.rotulo("RESERVADO AO FISCO", MARGEM + wInfo, f.y);

  const partes = [
    nota.informacoesComplementares ? `Inf. Contribuinte: ${nota.informacoesComplementares}` : "",
    nota.informacoesFisco ? `Inf. Fisco: ${nota.informacoesFisco}` : "",
    nota.totais?.valorTributos != null
      ? `Valor Aproximado dos Tributos: R$ ${moedaBr(nota.totais.valorTributos)}`
      : "",
  ].filter(Boolean);
  f.pdf.setFont("times", "normal");
  f.pdf.setFontSize(5.4);
  let y = f.y + 4.4;
  for (const parte of partes) {
    for (const linha of f.pdf.splitTextToSize(parte, wInfo - 2) as string[]) {
      if (y > f.y + altura - 1) break;
      f.pdf.text(linha, MARGEM + 1, y);
      y += 2.3;
    }
  }
  f.y += altura;
}

/* ── NFS-e (serviço) ────────────────────────────────────────────────────── */

/**
 * A nota de SERVIÇO não cabe no grid da NF-e: não tem ICMS, não tem IPI, não
 * tem transportador nem volumes. Imprimir uma DANFSe dentro do quadro de
 * mercadoria produziria um documento com colunas vazias que não existem nesse
 * tipo de nota — parece erro de emissão para quem recebe.
 *
 * Por isso a NFS-e tem folha própria, com os quadros que ela de fato possui:
 * prestador, tomador, discriminação do serviço e valores.
 */
function folhaNfse(f: Folha, nota: NotaFiscalXml) {
  const p = nota.emitente;
  const t = nota.destinatario;
  const altura = 22;
  const y0 = f.y;
  const wPrest = UTIL * 0.44;
  const wNfse = UTIL * 0.22;
  const wChave = UTIL - wPrest - wNfse;

  f.moldura(MARGEM, y0, wPrest, altura);
  f.pdf.setFont("times", "italic");
  f.pdf.setFontSize(5);
  f.pdf.text("IDENTIFICAÇÃO DO PRESTADOR", MARGEM + 2, y0 + 3);
  const centro = MARGEM + wPrest / 2;
  f.pdf.setFont("times", "bold");
  f.pdf.setFontSize(8);
  (f.pdf.splitTextToSize(p.nome ?? "", wPrest - 4) as string[])
    .slice(0, 2)
    .forEach((linha, i) => f.pdf.text(linha, centro, y0 + 8.5 + i * 3.8, { align: "center" }));
  f.pdf.setFont("times", "normal");
  f.pdf.setFontSize(6.2);
  [ruaNumero(p), [p.bairro, cepFormatado(p.cep)].filter(Boolean).join(" - "), municipioUf(p)]
    .filter(Boolean)
    .forEach((linha, i) =>
      f.pdf.text(linha, centro, y0 + 14.6 + i * 2.6, { align: "center", maxWidth: wPrest - 4 }),
    );

  const xNfse = MARGEM + wPrest;
  const centroNfse = xNfse + wNfse / 2;
  f.moldura(xNfse, y0, wNfse, altura);
  f.pdf.setFont("times", "bold");
  f.pdf.setFontSize(11);
  f.pdf.text("NFS-e", centroNfse, y0 + 6, { align: "center" });
  f.pdf.setFont("times", "normal");
  f.pdf.setFontSize(5.4);
  f.pdf.text("Documento Auxiliar da Nota Fiscal", centroNfse, y0 + 9.4, { align: "center" });
  f.pdf.text("de Serviço eletrônica", centroNfse, y0 + 11.8, { align: "center" });
  f.pdf.setFont("times", "bold");
  f.pdf.setFontSize(7);
  f.pdf.text(`Nº. ${numeroFormatado(nota.numero)}`, centroNfse, y0 + 16, { align: "center" });
  if (nota.competencia) {
    f.pdf.setFontSize(6);
    f.pdf.text(`Competência ${dataBr(nota.competencia)}`, centroNfse, y0 + 19.4, { align: "center" });
  }

  const xChave = xNfse + wNfse;
  f.moldura(xChave, y0, wChave, 11);
  codigoDeBarras(f.pdf, nota.chave, xChave + 3, y0 + 1.4, wChave - 6, 8);
  f.moldura(xChave, y0 + 11, wChave, 6.6);
  f.rotulo("CHAVE DE ACESSO", xChave, y0 + 11);
  f.pdf.setFont("times", "bold");
  f.pdf.setFontSize(6);
  f.pdf.text(chaveFormatada(nota.chave), xChave + wChave / 2, y0 + 16, { align: "center" });
  f.moldura(xChave, y0 + 17.6, wChave, altura - 17.6);
  f.pdf.setFont("times", "normal");
  f.pdf.setFontSize(5.4);
  f.pdf.text("Consulte a autenticidade no portal da NFS-e nacional", xChave + wChave / 2, y0 + 21, {
    align: "center",
  });
  f.y = y0 + altura;

  f.linha([
    { rotulo: "DATA DE EMISSÃO", valor: soData(nota.dataHoraEmissao ?? nota.dataEmissao), fr: 0.3, alinhar: "center" },
    { rotulo: "MUNICÍPIO EMISSOR", valor: nota.municipioEmissor ?? "", fr: 0.4, alinhar: "center" },
    { rotulo: "PROTOCOLO / Nº DFS-e", valor: nota.protocolo ?? "", fr: 0.3, alinhar: "center" },
  ]);

  f.titulo("PRESTADOR DE SERVIÇOS");
  f.linha([
    { rotulo: "NOME / RAZÃO SOCIAL", valor: p.nome ?? "", fr: 0.55 },
    { rotulo: "CNPJ / CPF", valor: documentoFormatado(p.documento), fr: 0.25, alinhar: "center" },
    { rotulo: "INSCRIÇÃO MUNICIPAL", valor: p.inscricaoMunicipal ?? "", fr: 0.2, alinhar: "center" },
  ]);
  f.linha([
    { rotulo: "ENDEREÇO", valor: ruaNumero(p), fr: 0.45 },
    { rotulo: "MUNICÍPIO", valor: municipioUf(p) ?? "", fr: 0.3 },
    { rotulo: "CEP", valor: cepFormatado(p.cep), fr: 0.25, alinhar: "center" },
  ]);

  f.titulo("TOMADOR DE SERVIÇOS");
  f.linha([
    { rotulo: "NOME / RAZÃO SOCIAL", valor: t.nome ?? "", fr: 0.55 },
    { rotulo: "CNPJ / CPF", valor: documentoFormatado(t.documento), fr: 0.25, alinhar: "center" },
    { rotulo: "INSCRIÇÃO MUNICIPAL", valor: t.inscricaoMunicipal ?? "", fr: 0.2, alinhar: "center" },
  ]);
  f.linha([
    { rotulo: "ENDEREÇO", valor: ruaNumero(t), fr: 0.45 },
    { rotulo: "MUNICÍPIO", valor: municipioUf(t) ?? "", fr: 0.3 },
    { rotulo: "CEP", valor: cepFormatado(t.cep), fr: 0.25, alinhar: "center" },
  ]);

  // Discriminação: ocupa a folha até sobrar espaço para valores e adicionais.
  f.titulo("DISCRIMINAÇÃO DOS SERVIÇOS");
  const alturaValores = H_CAMPO;
  const alturaAdicionais = H_TITULO + 20;
  const alturaDiscriminacao = FIM - MARGEM - f.y - alturaValores - alturaAdicionais - H_RODAPE_NFSE;
  f.moldura(MARGEM, f.y, UTIL, alturaDiscriminacao);
  f.pdf.setFont("times", "normal");
  f.pdf.setFontSize(6.6);
  const descricao = nota.itens.map((i) => i.descricao).filter(Boolean).join("\n");
  let yTexto = f.y + 4;
  for (const linha of f.pdf.splitTextToSize(descricao, UTIL - 4) as string[]) {
    if (yTexto > f.y + alturaDiscriminacao - 2) break;
    f.pdf.text(linha, MARGEM + 2, yTexto);
    yTexto += 3;
  }
  f.y += alturaDiscriminacao;

  f.linha([
    { rotulo: "VALOR DOS SERVIÇOS", valor: moedaBr(nota.valorProdutos), fr: 0.5, alinhar: "right", pt: 9 },
    { rotulo: "VALOR LÍQUIDO DA NFS-e", valor: moedaBr(nota.valorTotal), fr: 0.5, alinhar: "right", pt: 9 },
  ]);

  quadroAdicionais(f, nota, 20);
}

const H_RODAPE_NFSE = 4;

/**
 * Rodapé: de onde veio este papel.
 *
 * Sem esta linha ninguém sabe que o DANFE foi reimpresso a partir do XML, e o
 * documento passaria por via original do emissor. Dizer a origem é honestidade
 * básica — e é o que permite a quem recebe conferir a nota pelo protocolo.
 */
function rodape(pdf: jsPDF, nota: NotaFiscalXml, folha: number, folhas: number) {
  pdf.setFont("times", "italic");
  pdf.setFontSize(5);
  pdf.setTextColor(0, 0, 0);
  pdf.text(
    `Gerado pelo Hub Documental a partir do XML autorizado pela SEFAZ — protocolo ${nota.protocolo ?? "—"}`,
    MARGEM,
    FIM - 1,
  );
  pdf.text(`Folha ${folha} de ${folhas}`, LARGURA - MARGEM, FIM - 1, { align: "right" });
}

/* ── Montagem ───────────────────────────────────────────────────────────── */

/** Distribui os itens pelas folhas, respeitando a altura de cada linha. */
function paginarItens(pdf: jsPDF, itens: ItemNotaFiscalXml[], alturaPrimeira: number, alturaDemais: number) {
  const paginas: ItemNotaFiscalXml[][] = [];
  let atual: ItemNotaFiscalXml[] = [];
  let usado = 0;
  let limite = alturaPrimeira;
  for (const item of itens) {
    const altura = Math.max(linhasDoItem(pdf, item).length, 1) * H_ITEM;
    if (usado + altura > limite && atual.length) {
      paginas.push(atual);
      atual = [];
      usado = 0;
      limite = alturaDemais;
    }
    atual.push(item);
    usado += altura;
  }
  paginas.push(atual);
  return paginas;
}

/**
 * Monta o PDF. Devolve o `jsPDF` para o chamador decidir o formato de saída —
 * quem escreve o arquivo é `arquivoDanfeDoXml`.
 */
export function gerarDanfePdfDoXml(nota: NotaFiscalXml): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });

  if (nota.modelo === "nfse") {
    const f = new Folha(pdf);
    folhaNfse(f, nota);
    rodape(pdf, nota, 1, 1);
    return pdf;
  }

  // Alturas fixas dos quadros, para saber quanto sobra à tabela de produtos.
  const H_CANHOTO = 17 + 2.6;
  const H_CABECALHO = 26 + H_CAMPO * 2;
  const H_DESTINATARIO = H_TITULO + H_CAMPO * 3;
  const H_IMPOSTO = H_TITULO + H_CAMPO * 2;
  const H_TRANSPORTE = H_TITULO + H_CAMPO * 3;
  const H_PRODUTOS_CABECALHO = H_TITULO + 5.4;
  const H_ADICIONAIS = H_TITULO + 20;
  const H_RODAPE = 4;

  const alturaCaixaPrimeira =
    FIM -
    MARGEM -
    (H_CANHOTO + H_CABECALHO + H_DESTINATARIO + H_IMPOSTO + H_TRANSPORTE + H_PRODUTOS_CABECALHO + H_ADICIONAIS + H_RODAPE);
  const alturaCaixaDemais =
    FIM - MARGEM - (H_CABECALHO + H_PRODUTOS_CABECALHO + H_ADICIONAIS + H_RODAPE);

  const paginas = paginarItens(pdf, nota.itens, alturaCaixaPrimeira, alturaCaixaDemais);
  const folhas = paginas.length;

  paginas.forEach((itensDaFolha, indice) => {
    if (indice > 0) pdf.addPage();
    const f = new Folha(pdf);
    const primeira = indice === 0;
    if (primeira) canhoto(f, nota);
    cabecalho(f, nota, indice + 1, folhas);
    if (primeira) {
      quadroDestinatario(f, nota);
      quadroImposto(f, nota);
      quadroTransporte(f, nota);
    }
    cabecalhoProdutos(f);
    corpoProdutos(f, itensDaFolha, primeira ? alturaCaixaPrimeira : alturaCaixaDemais);
    quadroAdicionais(f, nota, 20);
    rodape(pdf, nota, indice + 1, folhas);
  });

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

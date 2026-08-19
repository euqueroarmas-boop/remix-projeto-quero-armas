import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  camposCertidaoDaNotaXml,
  chaveNfeValida,
  ehArquivoXml,
  enderecoEmLinha,
  lerNotaFiscalXml,
  modeloPelaChave,
} from "../notaFiscalXml";
import {
  camposPlanosDaNotaXml,
  papelDoClienteNaNota,
  textoDaNotaXml,
  tipoDocumentoDaNotaXml,
} from "../notaFiscalXmlImport";
import { identificarOrgao } from "../parsersCertidoes";

/**
 * CASO REAL — 18/08/2026.
 *
 * O cliente emitiu a NF-e no Emissor do Sebrae e salvou o DANFE pelo botão
 * "Compartilhar" do celular. O PDF chegou ao Hub com ZERO caracteres de texto
 * (só traço vetorial), o Hub carimbou "Salve de novo" e o cliente ficou
 * travado — com a nota autorizada na mão, sem ter errado nada.
 *
 * A saída foi aceitar o XML, que é a nota fiscal de verdade. Estes testes
 * fixam o contrato dessa leitura: o que ela lê, e sobretudo o que ela RECUSA.
 */

const XML_NFE = readFileSync(
  resolve(__dirname, "fixtures/nfe-mod55-autorizada.xml"),
  "utf8",
);

const CHAVE = "35260811222333000181550010000000011300000020";
const CNPJ_EMITENTE = "11222333000181";
const CNPJ_DESTINATARIO = "44555666000177";

function nota() {
  const r = lerNotaFiscalXml(XML_NFE);
  if (r.ok === false) throw new Error(`fixture deveria ser lida: ${r.motivo}`);
  return r.nota;
}

describe("chave de acesso — dígito verificador (módulo 11)", () => {
  it("aprova a chave da nota autorizada", () => {
    expect(chaveNfeValida(CHAVE)).toBe(true);
  });

  it("recusa chave com um dígito trocado", () => {
    const adulterada = `${CHAVE.slice(0, 20)}9${CHAVE.slice(21)}`;
    expect(chaveNfeValida(adulterada)).toBe(false);
  });

  it("recusa chave com tamanho errado", () => {
    expect(chaveNfeValida(CHAVE.slice(0, 43))).toBe(false);
    expect(chaveNfeValida("")).toBe(false);
  });
});

describe("lerNotaFiscalXml — NF-e modelo 55 autorizada", () => {
  it("lê identificação, protocolo e situação", () => {
    const n = nota();
    expect(n.modelo).toBe("nfe");
    expect(n.rotulo).toBe("NF-e");
    expect(n.chave).toBe(CHAVE);
    expect(n.numero).toBe("1");
    expect(n.serie).toBe("1");
    expect(n.dataEmissao).toBe("2026-08-17");
    expect(n.naturezaOperacao).toBe("Venda Dentro do Estado");
    expect(n.protocolo).toBe("135263375224149");
    expect(n.situacao).toBe("Autorizado o uso da NF-e");
  });

  it("separa emitente e destinatário sem misturar endereço", () => {
    const n = nota();
    expect(n.emitente.documento).toBe(CNPJ_EMITENTE);
    expect(n.emitente.nome).toBe("METALURGICA EXEMPLO LTDA ME");
    expect(n.emitente.inscricaoEstadual).toBe("111222333444");
    expect(n.emitente.cep).toBe("08545090");
    expect(enderecoEmLinha(n.emitente)).toBe(
      "Rua Exemplo Um, 117 - Casa Casa - Bairro Exemplo - Ferraz de Vasconcelos/SP",
    );

    expect(n.destinatario.documento).toBe(CNPJ_DESTINATARIO);
    expect(n.destinatario.nome).toBe("COMERCIO DE METAIS EXEMPLO LTDA");
    expect(n.destinatario.cep).toBe("08151000");
    expect(enderecoEmLinha(n.destinatario)).toBe(
      "Avenida Exemplo Dois, 3444 - Bairro Modelo - Sao Paulo/SP",
    );
  });

  it("lê os oito itens com quantidade, valor unitário e total", () => {
    const n = nota();
    expect(n.itens).toHaveLength(8);
    expect(n.itens[0]).toMatchObject({
      numero: 1,
      descricao: "METAL",
      ncm: "73066100",
      cfop: "5102",
      unidade: "UN",
      quantidade: 26.8,
      valorUnitario: 35,
      valorTotal: 938,
    });
    expect(n.itens[7].descricao).toBe("ALUMINIO PANELA");
  });

  it("usa os totais do XML, sem recalcular por conta própria", () => {
    const n = nota();
    expect(n.valorProdutos).toBe(2961.05);
    expect(n.valorTotal).toBe(2961.05);
    expect(n.valorDesconto).toBe(0);
  });

  it("guarda as informações complementares", () => {
    expect(nota().informacoesComplementares).toContain("SIMPLES NACIONAL");
  });
});

describe("travas de autenticidade", () => {
  it("recusa nota emitida em ambiente de homologação (teste)", () => {
    const homologacao = XML_NFE.replace("<tpAmb>1</tpAmb>", "<tpAmb>2</tpAmb>");
    const r = lerNotaFiscalXml(homologacao);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toMatch(/HOMOLOGA/i);
  });

  it("recusa nota sem protocolo de autorização (XML de pré-envio)", () => {
    const semProtocolo = XML_NFE.replace(/<protNFe[\s\S]*<\/protNFe>/, "");
    const r = lerNotaFiscalXml(semProtocolo);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toMatch(/protocolo/i);
  });

  it("recusa nota denegada ou cancelada pela SEFAZ", () => {
    const denegada = XML_NFE.replace("<cStat>100</cStat>", "<cStat>110</cStat>").replace(
      "Autorizado o uso da NF-e",
      "Uso Denegado",
    );
    const r = lerNotaFiscalXml(denegada);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toMatch(/Uso Denegado/);
  });

  it("recusa quando a chave do protocolo não é a chave da nota", () => {
    const trocada = XML_NFE.replace(
      `<chNFe>${CHAVE}</chNFe>`,
      "<chNFe>35260811222333000181550010000000021300000029</chNFe>",
    );
    const r = lerNotaFiscalXml(trocada);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toMatch(/chave do protocolo/i);
  });

  it("recusa chave adulterada (dígito verificador quebra)", () => {
    const adulterada = XML_NFE.replace(new RegExp(CHAVE, "g"), `${CHAVE.slice(0, 43)}9`);
    const r = lerNotaFiscalXml(adulterada);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toMatch(/dígito/i);
  });

  it("recusa XML que não é nota fiscal", () => {
    const r = lerNotaFiscalXml("<qualquerCoisa><a>1</a></qualquerCoisa>");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toMatch(/não é de nota fiscal/i);
  });

  it("recusa arquivo vazio ou quebrado", () => {
    expect(lerNotaFiscalXml("").ok).toBe(false);
    expect(lerNotaFiscalXml("<nfeProc><infNFe").ok).toBe(false);
  });
});

describe("ehArquivoXml", () => {
  it("reconhece por extensão e por MIME", () => {
    expect(ehArquivoXml({ name: "nota.xml", type: "" })).toBe(true);
    expect(ehArquivoXml({ name: "NOTA.XML", type: "" })).toBe(true);
    expect(ehArquivoXml({ name: "nota", type: "text/xml" })).toBe(true);
    expect(ehArquivoXml({ name: "nota", type: "application/xml" })).toBe(true);
    expect(ehArquivoXml({ name: "danfe.pdf", type: "application/pdf" })).toBe(false);
    expect(ehArquivoXml(null)).toBe(false);
  });
});

describe("ponte com o Hub", () => {
  it("mapeia emitente→prestador e destinatário→tomador", () => {
    const campos = camposCertidaoDaNotaXml(nota());
    expect(campos.orgao).toBe("nota_fiscal");
    expect(campos.cnpj).toBe(CNPJ_EMITENTE);
    expect(campos.razao_social).toBe("METALURGICA EXEMPLO LTDA ME");
    expect(campos.chave_acesso).toBe(CHAVE);
    expect(campos.numero_nf).toBe("1");
    expect(campos.valor_nf).toBe("2.961,05");
    expect(campos.data_emissao).toBe("2026-08-17");
    expect(campos.tomador_documento).toBe(CNPJ_DESTINATARIO);
    expect(campos.tomador_nome).toBe("COMERCIO DE METAIS EXEMPLO LTDA");
    expect(campos.itens_servico).toHaveLength(8);
  });

  it("descobre de que lado da nota o cliente está, só por número de documento", () => {
    const n = nota();
    expect(papelDoClienteNaNota(n, { cnpj: "11.222.333/0001-81" })).toBe("emitente");
    expect(papelDoClienteNaNota(n, { cnpj: CNPJ_DESTINATARIO })).toBe("destinatario");
    expect(papelDoClienteNaNota(n, { cnpj: "99999999000199" })).toBe("nenhum");
    expect(papelDoClienteNaNota(n, {})).toBe("nenhum");
  });

  it("o slot aberto pelo cliente manda no slug do documento", () => {
    expect(tipoDocumentoDaNotaXml("emitente", "nota_fiscal_arma")).toBe("nota_fiscal_arma");
    expect(tipoDocumentoDaNotaXml("destinatario", "renda_nf_empresa")).toBe("renda_nf_empresa");
  });

  it("sem slot de nota fiscal, quem emitiu comprova atividade e quem recebeu comprova compra", () => {
    expect(tipoDocumentoDaNotaXml("emitente", "outros")).toBe("renda_nf_empresa");
    expect(tipoDocumentoDaNotaXml("destinatario", null)).toBe("nota_fiscal_arma");
    expect(tipoDocumentoDaNotaXml("nenhum", "cr")).toBe("cr");
  });

  it("na nota que o cliente EMITIU, o destinatário não vira nome do titular", () => {
    const campos = camposPlanosDaNotaXml(nota(), "emitente");
    expect(campos.nome_completo).toBeUndefined();
    expect(campos.tomador_nome).toBe("COMERCIO DE METAIS EXEMPLO LTDA");
    expect(campos.cnpj).toBe(CNPJ_EMITENTE);
  });

  it("na nota de COMPRA, o cliente é o destinatário e a trava de parentesco sai de cena", () => {
    const campos = camposPlanosDaNotaXml(nota(), "destinatario");
    expect(campos.nome_completo).toBe("COMERCIO DE METAIS EXEMPLO LTDA");
    expect(campos.tomador_nome).toBeUndefined();
    expect(campos.tomador_endereco).toBeUndefined();
  });

  /**
   * NF-e e NFS-e dividem `qa_nf_golden_records`, que nasceu só para a nota de
   * SERVIÇO do padrão nacional. Sem separação, uma venda de sucata entraria na
   * tabela como prestação de serviço, com competência e DPS que não existem.
   */
  it("não inventa competência nem DPS a partir de uma NF-e de mercadoria", () => {
    const campos = camposCertidaoDaNotaXml(nota());
    expect(campos.competencia).toBeUndefined();
    expect(campos.serie_dps).toBeUndefined();
    expect(campos.numero_dps).toBeUndefined();
  });

  it("a NFS-e continua trazendo competência e série da DPS", () => {
    const servico = { ...nota(), modelo: "nfse" as const, competencia: "2026-08-01", serie: "1" };
    const campos = camposCertidaoDaNotaXml(servico);
    expect(campos.competencia).toBe("2026-08-01");
    expect(campos.serie_dps).toBe("1");
  });

  it("modeloPelaChave separa os dois padrões pelo tamanho da chave", () => {
    // 44 dígitos = NF-e/NFC-e da SEFAZ; a chave do padrão nacional de serviço
    // tem 50. É a mesma regra aplicada em SQL na migration do Golden Record.
    expect(modeloPelaChave(CHAVE)).toBe("nfe");
    expect(modeloPelaChave("3526 0811 2223 3300 0181 5500 1000 0000 0113 0000 0020")).toBe("nfe");
    expect(modeloPelaChave("3".repeat(50))).toBe("nfse");
    expect(modeloPelaChave("")).toBe("nfse");
    expect(modeloPelaChave(null)).toBe("nfse");
  });

  it("o texto do documento é classificado como nota fiscal, não como conta de consumo", () => {
    const texto = textoDaNotaXml(nota());
    expect(identificarOrgao(texto)).toBe("nota_fiscal");
    expect(texto).toContain(CHAVE);
    expect(texto).toContain("METALURGICA EXEMPLO LTDA ME");
    expect(texto).toContain("ALUMINIO PANELA");
  });
});

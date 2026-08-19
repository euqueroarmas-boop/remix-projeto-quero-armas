import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  camposCertidaoDaNotaXml,
  enderecoEmLinha,
  lerNotaFiscalXml,
  modeloPelaChave,
  ufPeloCodigoMunicipio,
  type NotaFiscalXml,
} from "../notaFiscalXml";
import { camposPlanosDaNotaXml, papelDoClienteNaNota } from "../notaFiscalXmlImport";

/**
 * NFS-e DO PADRÃO NACIONAL.
 *
 * O grupo de ocupação lícita recebe os dois tipos de nota: a NF-e de
 * mercadoria (SEFAZ) e a NFS-e de serviço (padrão nacional). Elas não têm o
 * mesmo XML, não têm os mesmos campos e dividem a mesma tabela de Golden
 * Record — então o que este arquivo fixa é sobretudo ONDE cada dado mora e o
 * que NÃO pode vazar de um modelo para o outro.
 *
 * A fixture foi montada a partir do leiaute, não copiada de uma nota real.
 * Substituir por um XML real (anonimizado) assim que houver um em mãos.
 */

const XML_NFSE = readFileSync(resolve(__dirname, "fixtures/nfse-nacional.xml"), "utf8");

const CHAVE = "35157071211222333000181000000000000120260800000123";
const CNPJ_PRESTADOR = "11222333000181";
const CNPJ_TOMADOR = "44555666000177";

function nota(): NotaFiscalXml {
  const r = lerNotaFiscalXml(XML_NFSE);
  if (r.ok === false) throw new Error(`fixture deveria ser lida: ${r.motivo}`);
  return r.nota;
}

describe("NFS-e nacional — identificação", () => {
  it("é reconhecida como nota de serviço, não de mercadoria", () => {
    const n = nota();
    expect(n.modelo).toBe("nfse");
    expect(n.rotulo).toBe("NFS-e");
  });

  it("lê chave, número, série e competência", () => {
    const n = nota();
    expect(n.chave).toBe(CHAVE);
    expect(n.chave).toHaveLength(50);
    expect(n.numero).toBe("12");
    expect(n.serie).toBe("00001");
    expect(n.competencia).toBe("2026-08-01");
    expect(n.dataEmissao).toBe("2026-08-14");
    expect(n.protocolo).toBe("987654");
  });

  it("a chave de 50 dígitos não é confundida com a de NF-e", () => {
    // A trava de dígito verificador do módulo 11 vale para os 44 dígitos da
    // NF-e. Aplicá-la aqui reprovaria toda NFS-e válida.
    expect(modeloPelaChave(CHAVE)).toBe("nfse");
  });
});

describe("NFS-e nacional — prestador vem de emit, não da DPS", () => {
  /**
   * Este é o defeito que o teste existe para impedir. No padrão nacional a DPS
   * declara apenas CNPJ e inscrição municipal de quem emite; nome, endereço e
   * CEP são publicados em `infNFSe/emit`. Lendo `prest` primeiro, o prestador
   * saía sem nome — e a conferência de ocupação lícita, que confronta
   * justamente CNPJ e razão social do prestador, ficava sem o que comparar.
   */
  it("traz nome, documento e inscrição municipal do prestador", () => {
    const p = nota().emitente;
    expect(p.nome).toBe("METALURGICA EXEMPLO LTDA ME");
    expect(p.documento).toBe(CNPJ_PRESTADOR);
    expect(p.inscricaoMunicipal).toBe("123456");
    expect(p.telefone).toBe("1140028922");
    expect(p.email).toBe("contato@exemplo.com.br");
  });

  it("traz o endereço completo do prestador", () => {
    const p = nota().emitente;
    expect(p.cep).toBe("08545090");
    expect(p.uf).toBe("SP");
    expect(enderecoEmLinha(p)).toContain("Rua Exemplo Um, 117");
    expect(enderecoEmLinha(p)).toContain("Bairro Exemplo");
  });
});

describe("NFS-e nacional — tomador", () => {
  it("lê nome e documento", () => {
    const t = nota().destinatario;
    expect(t.nome).toBe("COMERCIO DE METAIS EXEMPLO LTDA");
    expect(t.documento).toBe(CNPJ_TOMADOR);
    expect(t.inscricaoMunicipal).toBe("654321");
  });

  it("lê logradouro e bairro, que ficam FORA do bloco endNac", () => {
    const t = nota().destinatario;
    expect(t.logradouro).toBe("Avenida Exemplo Dois");
    expect(t.numero).toBe("3444");
    expect(t.bairro).toBe("Bairro Modelo");
    expect(t.cep).toBe("08151000");
  });

  it("município vem como CÓDIGO IBGE — a UF é derivada, o nome não é inventado", () => {
    const t = nota().destinatario;
    expect(t.municipio).toBe("3550308");
    expect(t.uf).toBe("SP");
  });
});

describe("NFS-e nacional — nome do município", () => {
  /**
   * Os blocos de endereço do padrão nacional só trazem o CÓDIGO IBGE. O nome
   * aparece uma vez, no topo, em `xLocEmi` / `xLocPrestacao`. Sem lê-los, a
   * DANFSe saía com "PREFEITURA MUNICIPAL DE 3515707".
   */
  it("o emitente e a prefeitura saem com o nome da cidade, não com o código", () => {
    const n = nota();
    expect(n.municipioEmissor).toBe("Ferraz de Vasconcelos");
    expect(n.emitente.municipio).toBe("Ferraz de Vasconcelos");
    expect(n.emitente.uf).toBe("SP");
  });

  it("o local da prestação sai pelo nome, como a DANFSe imprime", () => {
    expect(nota().servico?.localPrestacao).toBe("Ferraz de Vasconcelos");
  });

  it("sem xLocEmi, fica o código — nunca um nome inventado", () => {
    const r = lerNotaFiscalXml(
      XML_NFSE.replace("<xLocEmi>Ferraz de Vasconcelos</xLocEmi>", ""),
    );
    if (r.ok === false) throw new Error(r.motivo);
    expect(r.nota.emitente.municipio).toBe("3515707");
    expect(r.nota.emitente.uf).toBe("SP");
  });
});

describe("ufPeloCodigoMunicipio", () => {
  it("resolve a UF pelo prefixo do código IBGE", () => {
    expect(ufPeloCodigoMunicipio("3550308")).toBe("SP");
    expect(ufPeloCodigoMunicipio("3304557")).toBe("RJ");
    expect(ufPeloCodigoMunicipio("5300108")).toBe("DF");
    expect(ufPeloCodigoMunicipio("2927408")).toBe("BA");
  });

  it("não chuta quando o código não tem o tamanho de um código IBGE", () => {
    expect(ufPeloCodigoMunicipio("35")).toBeUndefined();
    expect(ufPeloCodigoMunicipio("")).toBeUndefined();
    expect(ufPeloCodigoMunicipio(null)).toBeUndefined();
    // Prefixo que não corresponde a nenhuma UF.
    expect(ufPeloCodigoMunicipio("9999999")).toBeUndefined();
  });
});

describe("NFS-e nacional — serviço e tributação municipal", () => {
  it("lê os códigos de tributação e o local da prestação", () => {
    const s = nota().servico!;
    expect(s.codigoTributacaoNacional).toBe("140601");
    expect(s.codigoTributacaoMunicipal).toBe("1406");
    expect(s.localPrestacao).toBe("Ferraz de Vasconcelos");
    expect(s.paisPrestacao).toBe("BR");
    expect(s.municipioIncidenciaIssqn).toBe("3515707");
  });

  it("traduz os códigos do leiaute para o que a DANFSe imprime", () => {
    const s = nota().servico!;
    expect(s.tributacaoIssqn).toBe("Operação tributável");
    expect(s.retencaoIssqn).toBe("Não retido");
    expect(s.simplesNacional).toBe("Optante — ME/EPP");
  });

  it("código fora da tabela conhecida sai cru, em vez de rotulado errado", () => {
    const r = lerNotaFiscalXml(XML_NFSE.replace("<tribISSQN>1</tribISSQN>", "<tribISSQN>9</tribISSQN>"));
    if (r.ok === false) throw new Error(r.motivo);
    expect(r.nota.servico?.tributacaoIssqn).toBe("9");
  });

  it("lê a descrição e os valores", () => {
    const n = nota();
    expect(n.itens).toHaveLength(1);
    expect(n.itens[0].descricao).toContain("Manutencao e reparacao de maquinas");
    expect(n.valorTotal).toBe(1500);
    expect(n.servico?.valorLiquido).toBe(1500);
  });
});

describe("NFS-e nacional — travas", () => {
  it("recusa nota de homologação", () => {
    const r = lerNotaFiscalXml(XML_NFSE.replace("<tpAmb>1</tpAmb>", "<tpAmb>2</tpAmb>"));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toMatch(/HOMOLOGA/i);
  });

  it("recusa XML sem chave de acesso", () => {
    const r = lerNotaFiscalXml(XML_NFSE.replace(/ Id="NFS\d+"/, ""));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toMatch(/chave/i);
  });
});

describe("NFS-e nacional — ponte com o Golden Record", () => {
  it("preenche as colunas que só existem na nota de serviço", () => {
    const campos = camposCertidaoDaNotaXml(nota());
    expect(campos.orgao).toBe("nota_fiscal");
    expect(campos.competencia).toBe("2026-08-01");
    expect(campos.serie_dps).toBe("00001");
    expect(campos.codigo_tributacao_nacional).toBe("140601");
    expect(campos.codigo_tributacao_municipal).toBe("1406");
    expect(campos.tributacao_issqn).toBe("Operação tributável");
    expect(campos.retencao_issqn).toBe("Não retido");
    expect(campos.prestador_simples_nacional).toBe("Optante — ME/EPP");
    expect(campos.local_prestacao).toBe("Ferraz de Vasconcelos");
  });

  it("o prestador conferido é o emitente, com CNPJ e razão social", () => {
    const campos = camposCertidaoDaNotaXml(nota());
    expect(campos.cnpj).toBe(CNPJ_PRESTADOR);
    expect(campos.razao_social).toBe("METALURGICA EXEMPLO LTDA ME");
    expect(campos.prestador_inscricao_municipal).toBe("123456");
    expect(campos.tomador_documento).toBe(CNPJ_TOMADOR);
  });

  it("o cliente que EMITIU a nota de serviço comprova atividade econômica", () => {
    const n = nota();
    expect(papelDoClienteNaNota(n, { cnpj: CNPJ_PRESTADOR })).toBe("emitente");
    const planos = camposPlanosDaNotaXml(n, "emitente");
    expect(planos.cnpj).toBe(CNPJ_PRESTADOR);
    expect(planos.nome_completo).toBeUndefined();
    expect(planos.tomador_nome).toBe("COMERCIO DE METAIS EXEMPLO LTDA");
  });
});

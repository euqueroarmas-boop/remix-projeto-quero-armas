import { describe, it, expect } from "vitest";
import { identificarOrgao, parseCertidao } from "../parsersCertidoes";
import { conferirCertidao } from "../conferenciaCertidao";

/* Arquivos-ouro sintéticos: reproduzem o TEXTO extraído de cada layout, sem
 * dados reais de cliente. Servem para que corrigir um parser não quebre outro. */

describe("identificação de órgão — cobertura nacional", () => {
  it("reconhece a certidão eleitoral emitida por TRE, não só pelo TSE", () => {
    expect(identificarOrgao("TRIBUNAL SUPERIOR ELEITORAL\nCERTIDÃO DE CRIMES ELEITORAIS")).toBe("tse");
    expect(identificarOrgao("TRIBUNAL REGIONAL ELEITORAL DA BAHIA\nCERTIDÃO DE CRIMES ELEITORAIS")).toBe("tse");
  });

  it("reconhece antecedentes da Polícia Civil de outros estados", () => {
    expect(identificarOrgao("IIRGD\nAtestado de Antecedentes")).toBe("iirgd");
    expect(
      identificarOrgao(
        "SECRETARIA DE ESTADO DA SEGURANÇA PÚBLICA DO PARANÁ\nCERTIDÃO DE ANTECEDENTES CRIMINAIS",
      ),
    ).toBe("iirgd");
    expect(
      identificarOrgao("POLÍCIA CIVIL DO ESTADO DE MINAS GERAIS\nATESTADO DE ANTECEDENTES"),
    ).toBe("iirgd");
  });

  it("reconhece e-SAJ de outros tribunais e separa execuções de distribuições", () => {
    expect(identificarOrgao("CERTIDÃO ESTADUAL DE DISTRIBUIÇÕES CRIMINAIS\ndistribuições de AÇÕES CRIMINAIS")).toBe(
      "tjsp_distribuicao",
    );
    expect(identificarOrgao("CERTIDÃO ESTADUAL DE DISTRIBUIÇÕES CRIMINAIS\ndistribuições de EXECUÇÕES CRIMINAIS")).toBe(
      "tjsp_execucoes",
    );
    expect(
      identificarOrgao("TRIBUNAL DE JUSTIÇA DO ESTADO DE GOIÁS\nCERTIDÃO DE DISTRIBUIÇÃO CRIMINAL"),
    ).toBe("tjsp_distribuicao");
    expect(
      identificarOrgao("TRIBUNAL DE JUSTIÇA DO ESTADO DO PARÁ\nCERTIDÃO JUDICIAL CRIMINAL NEGATIVA"),
    ).toBe("tjsp_distribuicao");
  });

  it("mantém militares e federal separados", () => {
    expect(identificarOrgao("JUSTIÇA MILITAR DA UNIÃO\nCERTIDÃO DE AÇÕES CRIMINAIS")).toBe("stm");
    expect(identificarOrgao("TRIBUNAL DE JUSTIÇA MILITAR DO ESTADO DE SÃO PAULO")).toBe("tjm_sp");
    expect(identificarOrgao("TRIBUNAL REGIONAL FEDERAL DA 3ª REGIÃO")).toBe("trf_regional");
  });
});

const CADASTRO = {
  nome_completo: "JOAO DA SILVA SANTOS",
  cpf: "12345678909",
  data_nascimento: "1980-05-12",
  nome_mae: "MARIA DA SILVA",
  rg: "123456789",
  naturalidade_municipio: "SANTOS",
  naturalidade_uf: "SP",
};

describe("política de falha segura na leitura", () => {
  it("não rejeita quando o layout é novo e o parser não acha os rótulos", () => {
    const texto = [
      "TRIBUNAL DE JUSTIÇA DO ESTADO DE GOIÁS",
      "CERTIDÃO DE DISTRIBUIÇÃO CRIMINAL",
      "Certificamos que nada consta em nome do requerente.",
    ].join("\n");
    const doc = parseCertidao(texto);
    expect(doc?.orgao).toBe("tjsp_distribuicao");
    const conf = conferirCertidao(doc!, CADASTRO, texto);
    expect(conf.veredicto).toBe("revisao_humana");
  });

  it("aproveita o nome impresso no texto mesmo sem rótulo reconhecido", () => {
    const texto = [
      "TRIBUNAL REGIONAL ELEITORAL DA BAHIA",
      "CERTIDÃO DE CRIMES ELEITORAIS",
      "JOAO DA SILVA SANTOS",
      "Inscrição: 1234 5678 9012",
      "NADA CONSTA",
    ].join("\n");
    const doc = parseCertidao(texto);
    const conf = conferirCertidao(doc!, CADASTRO, texto);
    expect(conf.veredicto).toBe("aprovado");
  });

  it("continua rejeitando divergência real de titular", () => {
    const texto = [
      "JUSTIÇA MILITAR DA UNIÃO",
      "CERTIDÃO DE AÇÕES CRIMINAIS",
      "Nome: PEDRO ALVES LIMA",
      "CPF: 987.654.321-00",
      "NADA CONSTA",
    ].join("\n");
    const doc = parseCertidao(texto);
    const conf = conferirCertidao(doc!, CADASTRO, texto);
    expect(conf.veredicto).toBe("rejeitado");
    expect(conf.achados.some((a) => a.campo === "nome_titular")).toBe(true);
  });

  it("continua rejeitando certidão POSITIVA", () => {
    const texto = [
      "JUSTIÇA MILITAR DA UNIÃO",
      "CERTIDÃO DE AÇÕES CRIMINAIS",
      "Nome: JOAO DA SILVA SANTOS",
      "CONSTA ação penal em andamento",
    ].join("\n");
    const doc = parseCertidao(texto);
    const conf = conferirCertidao(doc!, CADASTRO, texto);
    expect(conf.veredicto).toBe("rejeitado");
  });
});
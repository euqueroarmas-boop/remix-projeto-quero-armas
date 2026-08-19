import { describe, expect, it } from "vitest";
import { lerCamposRequerimentoPorGeometria } from "@/lib/quero-armas/parserRequerimentoSinarm";
import {
  conferirRequerimentoContraCadastro,
  requerimentoConfere,
  type CadastroParaRequerimento,
} from "@/lib/quero-armas/conferenciaRequerimento";
import type { ItemTextoPdf } from "@/lib/quero-armas/leituraCamposPdf";
import itensReais from "./fixtures/requerimentoSinarmItens.json";

// ============================================================================
// Itens de texto REAIS (com posição) das páginas 1 e 2 do requerimento que o
// cliente enviou — página 1 é o bloco IDENTIFICAÇÃO, página 2 traz a EMPRESA e
// os DADOS DA ARMA. Fixture gerada do PDF original com o mesmo pdf.js que roda
// no navegador: o que passa aqui é o que o Hub vê.
// ============================================================================
const PAGINAS = itensReais as unknown as ItemTextoPdf[][];

const CADASTRO_CERTO: CadastroParaRequerimento = {
  nome_completo: "ANTHONY NELSON FERREIRA DE SOUZA",
  cpf: "303.727.088-89",
  nome_mae: "SILVIA CRISTINA FERREIRA DE SOUZA",
  nome_pai: "NELSON FERREIRA DE SOUZA",
  data_nascimento: "1981-08-04",
  sexo: "M",
  estado_civil: "CASADO",
  naturalidade_pais: "Brasil",
  naturalidade_uf: "SP",
  naturalidade_municipio: "Mogi das Cruzes",
  rg: "34.110.404-8",
  emissor_rg: "SSP",
  uf_emissor_rg: "SP",
  expedicao_rg: "2019-04-09",
  titulo_eleitor: "288771780183",
  profissao: "CABO DA POLICIA MILITAR",
  email: "thony1.3.an@gmail.com",
  celular: "11985625177",
  cep: "08775-395",
  endereco: "RUA SEBASTIAO VASCONCELOS FILHO",
  numero: "180",
  complemento: "APTO 32 BLOCO C",
  bairro: "JARDIM MARICA",
  cidade: "MOGI DAS CRUZES",
  estado: "SP",
};

describe("lerCamposRequerimentoPorGeometria — o que o cliente digitou na PF", () => {
  const campos = lerCamposRequerimentoPorGeometria(PAGINAS);

  it("lê identificação, filiação e nascimento", () => {
    expect(campos.nome_completo).toBe("ANTHONY NELSON FERREIRA DE SOUZA");
    expect(campos.cpf).toBe("303.727.088-89");
    expect(campos.nome_mae).toBe("SILVIA CRISTINA FERREIRA DE SOUZA");
    expect(campos.nome_pai).toBe("NELSON FERREIRA DE SOUZA");
    expect(campos.data_nascimento).toBe("1981-08-04");
    expect(campos.sexo).toBe("Masculino");
    expect(campos.estado_civil).toBe("Casado");
  });

  it("lê a naturalidade sem confundir com o município do endereço", () => {
    expect(campos.naturalidade_pais).toBe("Brasil");
    expect(campos.naturalidade_uf).toBe("SP");
    expect(campos.naturalidade_municipio).toBe("Mogi das Cruzes");
  });

  it("lê o RG inteiro: número, órgão, UF e expedição", () => {
    expect(campos.rg).toBe("34.110.404-8");
    expect(campos.rg_orgao).toBe("ssp");
    expect(campos.rg_uf).toBe("SP");
    expect(campos.rg_expedicao).toBe("2019-04-09");
  });

  it("lê título de eleitor, profissão e contato", () => {
    expect(campos.titulo_eleitor).toBe("288771780183");
    expect(campos.profissao).toBe("CABO DA POLICIA MILITAR");
    expect(campos.email).toBe("thony1.3.an@gmail.com");
    expect(campos.celular).toBe("(11) 985625177");
    // Campo em branco no formulário volta vazio — não é inventado.
    expect(campos.telefone_fixo).toBe("");
  });

  it("lê o endereço RESIDENCIAL, não o da empresa", () => {
    expect(campos.cep).toBe("08775395");
    expect(campos.logradouro).toBe("Rua Sebastião Vasconcelos Filho");
    expect(campos.numero).toBe("180");
    expect(campos.complemento).toBe("Apto 32 Bloco C");
    expect(campos.bairro).toBe("Jardim Marica");
    expect(campos.cidade).toBe("Mogi das Cruzes");
    expect(campos.uf).toBe("SP");
  });

  it("NÃO traz nada da empresa em que o cliente trabalha", () => {
    // A página 2 traz CEP 02377000, "Rua do Horto", 931, "Horto Florestal",
    // São Paulo — o endereço da Polícia Militar. Nenhum deles pode vazar para
    // os campos pessoais, que têm exatamente os mesmos rótulos.
    const valores = Object.values(campos).join(" | ");
    expect(valores).not.toContain("02377000");
    expect(valores).not.toContain("Rua do Horto");
    expect(valores).not.toContain("Horto Florestal");
    expect(valores).not.toContain("POLÍCIA MILITAR DO ESTADO DE SÃO PAULO");
    expect(valores).not.toContain("04.198.514/0041-41");
  });

  it("lê a arma pretendida", () => {
    expect(campos.especie_arma).toBe("Pistola");
    expect(campos.calibre).toBe(".38 TPC");
  });
});

describe("conferirRequerimentoContraCadastro", () => {
  const campos = lerCamposRequerimentoPorGeometria(PAGINAS);

  it("aprova quando tudo que foi digitado bate com o banco", () => {
    const itens = conferirRequerimentoContraCadastro(campos, CADASTRO_CERTO);
    const divergentes = itens.filter((i) => i.status === "divergente");
    expect(divergentes).toEqual([]);
    expect(requerimentoConfere(itens)).toBe(true);
  });

  it("confere o formulário inteiro, e não só nome e CPF", () => {
    const itens = conferirRequerimentoContraCadastro(campos, CADASTRO_CERTO);
    const conferidos = itens.filter((i) => i.status === "conforme").map((i) => i.campo);
    expect(conferidos).toEqual(
      expect.arrayContaining([
        "nome_completo", "cpf", "nome_mae", "nome_pai", "data_nascimento", "sexo",
        "estado_civil", "naturalidade_pais", "naturalidade_uf", "naturalidade_municipio",
        "rg", "rg_orgao", "rg_uf", "rg_expedicao", "titulo_eleitor",
        "email", "celular", "cep", "logradouro", "numero", "complemento", "bairro",
        "cidade", "uf",
      ]),
    );
  });

  it("ignora acento, caixa, máscara e abreviação — isso não é divergência", () => {
    const itens = conferirRequerimentoContraCadastro(campos, {
      ...CADASTRO_CERTO,
      estado_civil: "casada",                       // gênero do estado civil
      emissor_rg: "SSP",                            // caixa
      cep: "08775395",                              // sem máscara
      endereco: "R. SEBASTIÃO VASCONCELOS FILHO",   // abreviação + acento
      celular: "5511985625177",                     // com DDI
      estado: "São Paulo",                          // nome da UF por extenso
      naturalidade_municipio: "MOGI DAS CRUZES",
    });
    expect(itens.filter((i) => i.status === "divergente")).toEqual([]);
  });

  it("acusa o dígito trocado — é o erro que faz a PF indeferir", () => {
    const itens = conferirRequerimentoContraCadastro(campos, {
      ...CADASTRO_CERTO,
      rg: "34.110.404-9",
      titulo_eleitor: "288771780184",
      numero: "108",
    });
    const divergentes = itens.filter((i) => i.status === "divergente").map((i) => i.campo);
    expect(divergentes.sort()).toEqual(["numero", "rg", "titulo_eleitor"]);
  });

  it("cadastro sem o dado não reprova ninguém — fica sem referência", () => {
    const itens = conferirRequerimentoContraCadastro(campos, {
      ...CADASTRO_CERTO,
      nome_pai: null,
      titulo_eleitor: "",
    });
    const semRef = itens.filter((i) => i.status === "sem_referencia").map((i) => i.campo);
    expect(semRef).toContain("nome_pai");
    expect(semRef).toContain("titulo_eleitor");
    expect(itens.filter((i) => i.status === "divergente")).toEqual([]);
  });

  it("não confere a empresa do cliente — nem entra na lista", () => {
    const itens = conferirRequerimentoContraCadastro(campos, CADASTRO_CERTO);
    const campos_conferidos = itens.map((i) => i.campo);
    expect(campos_conferidos).not.toContain("cnpj");
    expect(campos_conferidos).not.toContain("razao_social");
    expect(campos_conferidos).not.toContain("empresa");
  });
});

describe("profissão — cadastro guarda categoria, PF guarda cargo", () => {
  const campos = lerCamposRequerimentoPorGeometria(PAGINAS);

  // Caso REAL do cadastro do cliente: ele escolheu a categoria na lista do
  // cadastro e digitou o cargo no site da PF. Os dois estão certos. Comparar
  // reprovaria todo policial, bombeiro e guarda do sistema.
  it("mostra os dois valores mas nunca acusa divergência", () => {
    const itens = conferirRequerimentoContraCadastro(campos, {
      ...CADASTRO_CERTO,
      profissao: "SERVIDOR DE SEGURANÇA PÚBLICA (PM, PC, PF, PRF, GUARDA, BOMBEIRO, AGENTE PENITENCIÁRIO)",
    });
    const profissao = itens.find((i) => i.campo === "profissao");
    expect(profissao?.valorCertidao).toBe("CABO DA POLICIA MILITAR");
    expect(profissao?.valorReferencia).toBe(
      "SERVIDOR DE SEGURANÇA PÚBLICA (PM, PC, PF, PRF, GUARDA, BOMBEIRO, AGENTE PENITENCIÁRIO)",
    );
    expect(profissao?.status).toBe("sem_referencia");
    expect(itens.filter((i) => i.status === "divergente")).toEqual([]);
  });
});

describe("cadastro REAL do cliente — o que a tela vai mostrar", () => {
  const campos = lerCamposRequerimentoPorGeometria(PAGINAS);

  // Linha do banco exportada em 18/08/2026. O requerimento e o cadastro batem
  // em tudo, menos no bairro: o cliente digitou "Jardim Marica" na PF e o
  // cadastro diz "JARDIM RODEIO", mesma rua, mesmo número, mesma cidade.
  // É exatamente o tipo de diferença que faz a PF indeferir.
  it("acusa o bairro e nada mais", () => {
    const itens = conferirRequerimentoContraCadastro(campos, {
      ...CADASTRO_CERTO,
      bairro: "JARDIM RODEIO",
      profissao: "SERVIDOR DE SEGURANÇA PÚBLICA (PM, PC, PF, PRF, GUARDA, BOMBEIRO, AGENTE PENITENCIÁRIO)",
      celular: "(11) 98562-5177",
      cep: "08.775-395",
      complemento: "APTO 32 bloco c",
      naturalidade_pais: "BRASIL",
      sexo: "Masculino",
      emissor_rg: "SSP",
    });
    const divergentes = itens.filter((i) => i.status === "divergente");
    expect(divergentes.map((i) => i.campo)).toEqual(["bairro"]);
    expect(divergentes[0].valorCertidao).toBe("Jardim Marica");
    expect(divergentes[0].valorReferencia).toBe("JARDIM RODEIO");
  });
});

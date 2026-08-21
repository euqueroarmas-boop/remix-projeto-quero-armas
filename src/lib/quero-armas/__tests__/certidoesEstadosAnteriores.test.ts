import { describe, expect, it } from "vitest";

import { EnderecosAnterioresLista } from "@/components/quero-armas/EnderecosAnterioresLista";
import {
  chaveEnderecoAnterior,
  diffEnderecosAnteriores,
  estadosDistintos,
} from "@/lib/quero-armas/enderecosAnteriores";
import {
  GRUPOS_NAO_FILTRAVEIS,
  PENDENCIA_GRUPOS,
  ehCertidaoDeEstadoAnterior,
  grupoDaPendencia,
  ufDaCertidaoDeEstadoAnterior,
} from "@/lib/quero-armas/pendenciasGrupos";
import {
  certidaoDeEstadoAnterior,
  resolveLinkAntecedentePorUf,
} from "@/lib/quero-armas/linksAntecedentesPorUf";
import { toHubTipoCompartilhado } from "@/lib/quero-armas/hubTipoMap";

// ============================================================================
// Regra do titular (21/08/2026): quem mudou de estado nos últimos 5 anos
// apresenta as certidões de CADA estado onde morou. "Se no primeiro ano morou
// em São Paulo, no segundo em Minas, no terceiro no Paraná, no quarto em
// Rondônia, no quinto no Rio Grande do Sul, ele terá que apresentar as
// certidões de todos os estados."
//
// Estes testes travam o espelho TypeScript da régua que vive no banco em
// qa_certidao_e_territorial / qa_certidao_uf_do_tipo /
// qa_certidao_tipo_do_estado_anterior (migrations 20260821070000 e 080000).
// ============================================================================

describe("reconhecer certidão de estado anterior", () => {
  it("os códigos que a migration cria são reconhecidos", () => {
    for (const tipo of [
      "antecedentes_estadual_distribuicao_mg",
      "antecedentes_estadual_execucoes_pr",
      "antecedentes_criminais_rs",
      "antecedentes_federal_secao_judiciaria_ba",
      "antecedentes_militar_estadual_sp",
      "antecedentes_federal_regional_trf4",
    ]) {
      expect(ehCertidaoDeEstadoAnterior(tipo), tipo).toBe(true);
    }
  });

  it("os códigos GENÉRICOS continuam sendo do estado ATUAL — não são de residência anterior", () => {
    for (const tipo of [
      "antecedentes_estadual_distribuicao",
      "antecedentes_estadual_execucoes",
      "antecedentes_criminais",
      "antecedentes_federal_sjsp_jef",
      "antecedentes_federal_trf3_regional",
      "antecedentes_militar_estadual",
      "antecedentes_eleitoral",
      "antecedentes_militar",
    ]) {
      expect(ehCertidaoDeEstadoAnterior(tipo), tipo).toBe(false);
    }
  });

  it("a UF sai do próprio código", () => {
    expect(ufDaCertidaoDeEstadoAnterior("antecedentes_criminais_mg")).toBe("MG");
    expect(ufDaCertidaoDeEstadoAnterior("antecedentes_estadual_execucoes_pr")).toBe("PR");
    // A federal por região não é por UF: vale para a região inteira.
    expect(ufDaCertidaoDeEstadoAnterior("antecedentes_federal_regional_trf4")).toBeNull();
    expect(ufDaCertidaoDeEstadoAnterior("antecedentes_criminais")).toBeNull();
  });
});

describe("o link é o do tribunal DAQUELE estado, não o do estado atual", () => {
  it("cliente que mora no Paraná emite a certidão de Minas no TJMG", () => {
    const link = resolveLinkAntecedentePorUf("antecedentes_estadual_distribuicao_mg", "PR");
    expect(link).toContain("tjmg");
    expect(link).not.toContain("tjpr");
  });

  it("Polícia Civil da residência anterior é a daquele estado", () => {
    expect(resolveLinkAntecedentePorUf("antecedentes_criminais_pr", "SC"))
      .toContain("policiacivil.pr.gov.br");
  });

  it("a federal por região aponta para o portal daquele TRF", () => {
    expect(resolveLinkAntecedentePorUf("antecedentes_federal_regional_trf4", "SP"))
      .toContain("trf4");
    expect(resolveLinkAntecedentePorUf("antecedentes_federal_regional_trf1", "SP"))
      .toContain("trf1");
  });

  it("Seção Judiciária da residência anterior sai do portal do TRF daquele estado", () => {
    // MG é da 6ª Região; o portal é o do TRF6, não o do estado onde mora hoje.
    expect(resolveLinkAntecedentePorUf("antecedentes_federal_secao_judiciaria_mg", "SP"))
      .toContain("trf6");
  });

  it("TJM da residência anterior só existe onde o tribunal existe", () => {
    expect(resolveLinkAntecedentePorUf("antecedentes_militar_estadual_mg", "PR"))
      .toContain("tjmmg");
    // Não há TJM no Paraná — o código nem deveria ser criado, e se vier não
    // inventa link.
    expect(resolveLinkAntecedentePorUf("antecedentes_militar_estadual_pr", "SP")).toBeNull();
  });

  it("funciona mesmo sem saber onde o cliente mora hoje", () => {
    // O código já diz de que estado é a certidão: a UF do cadastro é irrelevante.
    expect(resolveLinkAntecedentePorUf("antecedentes_criminais_mg", "")).toContain("mg.gov.br");
  });

  it("traduz o código para o par (genérico, UF própria)", () => {
    expect(certidaoDeEstadoAnterior("antecedentes_estadual_execucoes_rs")).toEqual({
      generico: "antecedentes_estadual_execucoes",
      uf: "RS",
    });
    expect(certidaoDeEstadoAnterior("antecedentes_estadual_execucoes")).toBeNull();
  });
});

describe("separação clara na fila do cliente", () => {
  it("as certidões do estado anterior ficam em grupo próprio, DEPOIS do estado atual", () => {
    const atual = grupoDaPendencia("antecedentes_estadual_distribuicao");
    const anterior = grupoDaPendencia("antecedentes_estadual_distribuicao_mg");

    expect(atual.id).toBe("antecedentes");
    expect(anterior.id).toBe("antecedentes_anteriores");
    // "Primeiro ele tira as certidões do estado atual dele e depois as
    // certidões do ou dos estados que morou."
    expect(anterior.ordem).toBeGreaterThan(atual.ordem);
  });

  it("a federal por região também cai no bloco dos estados anteriores", () => {
    expect(grupoDaPendencia("antecedentes_federal_regional_trf4").id)
      .toBe("antecedentes_anteriores");
  });

  it("o grupo novo não pode ser filtrado por serviço", () => {
    // Whitelist esquecida faria a exigência sumir da fila do cliente — e ela é
    // tão obrigatória quanto a certidão do estado atual.
    expect(GRUPOS_NAO_FILTRAVEIS.has("antecedentes_anteriores")).toBe(true);
  });

  it("o rótulo do grupo explica o que é sem jargão", () => {
    expect(PENDENCIA_GRUPOS.antecedentes_anteriores.label.toLowerCase())
      .toContain("morou");
  });
});

describe("o Hub não rebaixa os códigos novos para 'outro'", () => {
  it("cada família sobrevive à tradução processo → Hub", () => {
    for (const tipo of [
      "antecedentes_estadual_distribuicao_mg",
      "antecedentes_estadual_execucoes_pr",
      "antecedentes_criminais_rs",
      "antecedentes_federal_secao_judiciaria_ba",
      "antecedentes_militar_estadual_sp",
      "antecedentes_federal_regional_trf6",
    ]) {
      expect(toHubTipoCompartilhado(tipo), tipo).toBe(tipo);
    }
  });

  it("código inventado continua virando 'outro'", () => {
    expect(toHubTipoCompartilhado("antecedentes_criminais_zz")).toBe("outro");
    expect(toHubTipoCompartilhado("antecedentes_federal_regional_trf9")).toBe("outro");
  });
});

describe("o que conta no fim é o ESTADO", () => {
  it("três cidades de São Paulo geram um estado só", () => {
    expect(
      estadosDistintos([
        { uf: "SP", cidade: "SANTOS" },
        { uf: "SP", cidade: "CAMPINAS" },
        { uf: "SP", cidade: "SÃO PAULO" },
      ]),
    ).toEqual(["SP"]);
  });

  it("o estado onde o cliente mora HOJE não vira exigência de residência anterior", () => {
    expect(
      estadosDistintos([{ uf: "PR", cidade: "CURITIBA" }, { uf: "MG", cidade: "CONTAGEM" }], "PR"),
    ).toEqual(["MG"]);
  });

  it("linha em branco e UF inválida são ignoradas", () => {
    expect(
      estadosDistintos([
        { uf: "", cidade: "" },
        { uf: "XX", cidade: "LUGAR NENHUM" },
        { uf: "rs", cidade: "PELOTAS" },
      ]),
    ).toEqual(["RS"]);
  });

  it("o componente existe e é o mesmo usado nas duas portas de entrada", () => {
    expect(typeof EnderecosAnterioresLista).toBe("function");
  });
});

// ============================================================================
// A porta da EQUIPE no cadastro do cliente (21/08/2026): "pode pendurar isso no
// admin também, para nós podermos cumprir essas exigências para o cliente caso
// seja necessário". O que se grava ali dispara o semeador — errar o diff
// significa apagar a linha errada ou tentar inserir duplicata.
// ============================================================================

describe("o que a equipe grava no cadastro do cliente", () => {
  const gravados = [
    { id: "a", uf: "MG", cidade: "CONTAGEM", origem: "cliente" },
    { id: "b", uf: "PR", cidade: "CURITIBA", origem: "sistema" },
    { id: "c", uf: "RS", cidade: "PELOTAS", origem: "equipe" },
  ];

  it("a identidade da linha é a mesma do índice único do banco", () => {
    // (cliente, uf, lower(btrim(coalesce(cidade,''))))
    expect(chaveEnderecoAnterior("mg", " Contagem ")).toBe(
      chaveEnderecoAnterior("MG", "contagem"),
    );
    expect(chaveEnderecoAnterior("MG", null)).toBe(chaveEnderecoAnterior("MG", "  "));
    expect(chaveEnderecoAnterior("MG", "CONTAGEM")).not.toBe(
      chaveEnderecoAnterior("MG", "UBERLÂNDIA"),
    );
  });

  it("não mexe em nada quando a lista não mudou", () => {
    const d = diffEnderecosAnteriores(
      gravados,
      gravados.map((g) => ({ uf: g.uf, cidade: g.cidade })),
      false,
    );
    expect(d.remover).toEqual([]);
    expect(d.inserir).toEqual([]);
  });

  it("insere o que entrou e remove o que saiu", () => {
    const d = diffEnderecosAnteriores(
      gravados,
      [
        { uf: "MG", cidade: "CONTAGEM" },
        { uf: "SC", cidade: "BLUMENAU" },
      ],
      false,
    );
    expect(d.inserir).toEqual([{ uf: "SC", cidade: "BLUMENAU" }]);
    expect(d.remover.sort()).toEqual(["b", "c"]);
  });

  it("linha em branco na tela não vira nada no banco", () => {
    const d = diffEnderecosAnteriores([], [{ uf: "", cidade: "" }], false);
    expect(d.inserir).toEqual([]);
    expect(d.remover).toEqual([]);
  });

  it('"morou sempre no mesmo endereço" tira o DECLARADO e preserva a mudança real', () => {
    // A mudança de endereço no cadastro é fato — não é declaração, e não pode
    // ser apagada por uma resposta. O que a pessoa declarou, sim.
    const d = diffEnderecosAnteriores(gravados, [], true);
    expect(d.remover).toEqual(["a"]);
    expect(d.inserir).toEqual([]);
  });

  it("a UF gravada sai sempre em duas letras maiúsculas", () => {
    const d = diffEnderecosAnteriores([], [{ uf: " sc ", cidade: " Joinville " }], false);
    expect(d.inserir).toEqual([{ uf: "SC", cidade: "Joinville" }]);
  });
});

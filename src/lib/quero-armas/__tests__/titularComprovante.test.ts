/**
 * CASO REAL (20/08/2026): comprovante de endereço NO NOME do cliente foi
 * apontado como "de outra pessoa" e só passou depois de ~10 reenvios.
 * Dois defeitos alimentavam isso:
 *
 *  1. Conta sem CPF impresso → o confronto de CPF (CPF-01) devolvia erro
 *     SEMPRE ("não foi possível ler o CPF do comprovante"), sem saída — o
 *     cliente digitava o próprio CPF e ficava preso no loop.
 *  2. O caminho da IA nem avaliava titularidade, então o mesmo arquivo ora
 *     era barrado (parser leu), ora entrava sem conferência (parser falhou),
 *     premiando a insistência.
 *
 * Estes testes travam a regra do confronto; a paridade parser/IA vive no
 * modal do Hub.
 */
import { describe, expect, it } from "vitest";
import {
  avaliarTitularidadeComprovante,
  confrontarCpfParcial,
  lerCpfDocumento,
} from "../titularComprovante";

// CPF sintético com dígitos verificadores corretos.
const CPF_CLIENTE = "52998224725";

describe("confrontarCpfParcial", () => {
  it("CPF AUSENTE na conta: aceita o CPF declarado (nada legível contradiz)", () => {
    const cpf = lerCpfDocumento(null);
    expect(cpf.estado).toBe("ausente");
    const res = confrontarCpfParcial(cpf, CPF_CLIENTE);
    expect(res.ok).toBe(true);
  });

  it("CPF mascarado com dígitos batendo: aceita", () => {
    const cpf = lerCpfDocumento("***.982.247-**");
    expect(cpf.estado).toBe("mascarado");
    expect(confrontarCpfParcial(cpf, CPF_CLIENTE).ok).toBe(true);
  });

  it("CPF mascarado com dígito visível divergente: recusa", () => {
    const cpf = lerCpfDocumento("***.111.247-**");
    expect(cpf.estado).toBe("mascarado");
    expect(confrontarCpfParcial(cpf, CPF_CLIENTE).ok).toBe(false);
  });

  it("CPF completo divergente: recusa", () => {
    const cpf = lerCpfDocumento("390.533.447-05");
    expect(cpf.estado).toBe("valido");
    expect(confrontarCpfParcial(cpf, CPF_CLIENTE).ok).toBe(false);
  });

  it("CPF informado inválido continua recusado mesmo sem CPF na conta", () => {
    const cpf = lerCpfDocumento(null);
    expect(confrontarCpfParcial(cpf, "12345678900").ok).toBe(false);
  });
});

describe("avaliarTitularidadeComprovante", () => {
  it("nome do cliente na conta (abreviado) → própria, sem perguntar nada", () => {
    const r = avaliarTitularidadeComprovante({
      nomeDoc: "MARCIO G F DE ALMEIDA",
      cpfDoc: null,
      nomeRef: "MARCIO GERALDO FREIRE DE ALMEIDA",
      cpfRef: CPF_CLIENTE,
    });
    expect(r.resultado).toBe("propria");
  });

  it("sem nome e sem CPF legíveis → indeterminada (pergunta, nunca acusa)", () => {
    const r = avaliarTitularidadeComprovante({
      nomeDoc: null,
      cpfDoc: null,
      nomeRef: "MARCIO GERALDO FREIRE DE ALMEIDA",
      cpfRef: CPF_CLIENTE,
    });
    expect(r.resultado).toBe("indeterminada");
    expect(r.pedirConfrontoCpf).toBe(true);
  });

  it("nome claramente de outra pessoa → terceiro (fluxo da declaração)", () => {
    const r = avaliarTitularidadeComprovante({
      nomeDoc: "JOSE FREIRE DE ALMEIDA NETO",
      cpfDoc: null,
      nomeRef: "MARCIO GERALDO FREIRE DE ALMEIDA",
      cpfRef: CPF_CLIENTE,
    });
    expect(r.resultado).toBe("terceiro");
  });

  // CASO REAL (20/08/2026): a tela dizia "a conta está em nome de MARCIO
  // GERALDO FREIRE DE ALMEIDA e não de MARCIO GERALDO FREIRE DE ALMEIDA" —
  // nome IDÊNTICO, veredito "terceiro". Causa: o CPF era checado ANTES do
  // nome, e uma leitura errada de CPF (dígito trocado, número da fatura)
  // acusava o próprio titular.
  it("NOME IDÊNTICO + CPF lido divergente → indeterminada (pergunta), NUNCA terceiro", () => {
    const r = avaliarTitularidadeComprovante({
      nomeDoc: "MARCIO GERALDO FREIRE DE ALMEIDA",
      cpfDoc: "390.533.447-05", // leitura errada, DV válido
      nomeRef: "MARCIO GERALDO FREIRE DE ALMEIDA",
      cpfRef: CPF_CLIENTE,
    });
    expect(r.resultado).toBe("indeterminada");
    expect(r.pedirConfrontoCpf).toBe(true);
    // O confronto vale como DECLARAÇÃO (não compara contra a leitura errada):
    expect(confrontarCpfParcial(r.cpf, CPF_CLIENTE).ok).toBe(true);
  });

  // CASO REAL (20/08/2026, segunda ocorrência): "Titular da conta: OUTRA
  // PESSOA" — o nome nem tinha sido lido e o CPF divergente sozinho acusou.
  it("nome NÃO LIDO + CPF divergente → indeterminada (pergunta), nunca terceiro", () => {
    const r = avaliarTitularidadeComprovante({
      nomeDoc: null,
      cpfDoc: "390.533.447-05",
      nomeRef: "MARCIO GERALDO FREIRE DE ALMEIDA",
      cpfRef: CPF_CLIENTE,
    });
    expect(r.resultado).toBe("indeterminada");
    expect(r.pedirConfrontoCpf).toBe(true);
    expect(confrontarCpfParcial(r.cpf, CPF_CLIENTE).ok).toBe(true);
  });

  it("nome de OUTRA pessoa + CPF divergente → terceiro continua terceiro", () => {
    const r = avaliarTitularidadeComprovante({
      nomeDoc: "JOSE FREIRE DE ALMEIDA NETO",
      cpfDoc: "390.533.447-05",
      nomeRef: "MARCIO GERALDO FREIRE DE ALMEIDA",
      cpfRef: CPF_CLIENTE,
    });
    expect(r.resultado).toBe("terceiro");
  });

  it("CPF do comprovante igual ao do cadastro segue aprovando direto", () => {
    const r = avaliarTitularidadeComprovante({
      nomeDoc: "MARCIO GERALDO FREIRE DE ALMEIDA",
      cpfDoc: "529.982.247-25",
      nomeRef: "MARCIO GERALDO FREIRE DE ALMEIDA",
      cpfRef: CPF_CLIENTE,
    });
    expect(r.resultado).toBe("propria");
  });
});

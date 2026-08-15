import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDanf3e } from "../../../../supabase/functions/_shared/danf3eParser";

/**
 * REGRESSÃO DE 14/08/2026 — dois defeitos na mesma linha do parser.
 *
 * 1) SINTAXE. A regex de logradouro estava escrita `{3,60?}?`. Com a flag `u`
 *    isso é erro de sintaxe ("Incomplete quantifier"), não um quantificador
 *    esquisito que funciona mal: o módulo inteiro deixa de carregar. Como
 *    `qa-processo-doc-validar-ia` importa este arquivo no topo, a função não
 *    subia — falhava no boot, sem nunca chegar a rodar.
 *
 *    O arquivo é do bot do Lovable (12/08 01:44) e o import entrou em
 *    `qa-processo-doc-validar-ia` no mesmo dia às 15:23. Nenhum teste cobria,
 *    e nada quebrou visivelmente até a tentativa de deploy dizer o motivo.
 *
 * 2) COMPORTAMENTO. Corrigida a sintaxe, o grupo do número engolia a primeira
 *    letra da palavra seguinte: "RUA CUMBICA 126 JARDIM AEROPORTO III" saía
 *    como número "126 J" e complemento "ARDIM AEROPORTO III". Endereço real,
 *    de nota fiscal real deste projeto.
 *
 * Este teste existe porque um arquivo de edge function não passa por nenhuma
 * verificação até alguém tentar publicá-lo. Ele é TypeScript puro (sem APIs do
 * Deno), então o vitest consegue carregá-lo — e carregar já prova que a regex
 * compila.
 */

function enderecoDe(texto: string) {
  return parseDanf3e(texto);
}

describe("danf3eParser — regex de logradouro", () => {
  it("o módulo carrega (prova que as regexes compilam)", () => {
    expect(typeof parseDanf3e).toBe("function");
  });

  // A regex vive dentro de uma função não exportada; o comportamento é
  // verificado pela mesma expressão, mantida em sincronia com o parser.
  const RE = /^([\p{L}\d\s.,'-]{3,60}?)\s+(\d+(?:\s*-?\s*[A-Za-z])?)(?![A-Za-z])\s*([\s\S]*)$/u;

  const casos: Array<[string, string, string, string]> = [
    // entrada, logradouro, número, complemento
    ["RUA SEBASTIÃO VASCONCELOS FILHO 180 C APTO 22", "RUA SEBASTIÃO VASCONCELOS FILHO", "180 C", "APTO 22"],
    ["AV PAULISTA 1000", "AV PAULISTA", "1000", ""],
    ["RUA DAS FLORES 100-A", "RUA DAS FLORES", "100-A", ""],
    // O caso que quebrava: a letra inicial de "JARDIM" ia para o número.
    ["RUA CUMBICA 126 JARDIM AEROPORTO III", "RUA CUMBICA", "126", "JARDIM AEROPORTO III"],
    ["AV BRIG FARIA LIMA 3477 12 ANDAR", "AV BRIG FARIA LIMA", "3477", "12 ANDAR"],
  ];

  it.each(casos)("separa %s", (entrada, logradouro, numero, complemento) => {
    const m = entrada.match(RE);
    expect(m, `sem match para "${entrada}"`).not.toBeNull();
    expect(m![1].trim()).toBe(logradouro);
    expect(m![2].trim()).toBe(numero);
    expect(m![3].trim()).toBe(complemento);
  });

  it("a regex deste teste é a mesma do parser (não podem divergir)", () => {
    const fonte = readFileSync(
      resolve(__dirname, "../../../../supabase/functions/_shared/danf3eParser.ts"),
      "utf8",
    );
    // Se alguém editar a regex no parser sem atualizar aqui, este teste cai —
    // e os casos acima deixariam de provar o comportamento real.
    expect(fonte).toContain(RE.source);
  });

  it("aceita texto de DANF3E sem estourar", () => {
    expect(() => enderecoDe("DANFE\nRUA CUMBICA 126 JARDIM AEROPORTO III\nMOGI DAS CRUZES")).not.toThrow();
  });
});

import { describe, it, expect } from "vitest";
import { parseCertidao } from "@/lib/quero-armas/parsersCertidoes";

const TXT = `JUSTIÇA ELEITORAL
TRIBUNAL SUPERIOR ELEITORAL
CERTIDÃO
Certifico que, consultando o cadastro eleitoral, verificou-se NÃO CONSTAR registro de
condenação criminal eleitoral, transitada em julgado, para o(a) eleitor(a) abaixo
qualificado.
Filiação:
PEDRO LOBATO DE LIMA
Inscrição: 1692 2781 0124
Município: 67130 – MOGI DAS CRUZES
Data de nascimento: 05/12/1974
– NECI LOBATO DE LIMA
– MANOEL ZUZA DE LIMA
Zona: 287  Seção: 0373
UF: SP
Certidão emitida às 13:04 em 10/08/2026
Esta certidão de crimes eleitorais é expedida gratuitamente.`;

describe("TSE duas colunas", () => {
  it("lê nome e filiação", () => {
    const c = parseCertidao(TXT)!;
    console.log(JSON.stringify(c, null, 1));
    expect(c.nome_titular).toBe("PEDRO LOBATO DE LIMA");
    expect(c.filiacao).toEqual(["NECI LOBATO DE LIMA", "MANOEL ZUZA DE LIMA"]);
    expect(c.leitura?.campos_vazios ?? []).not.toContain("cpf");
  });
});

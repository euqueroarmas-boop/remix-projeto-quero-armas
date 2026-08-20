/**
 * CASO REAL (20/08/2026): o cliente enviou a certidão federal de ABRANGÊNCIA
 * REGIONAL (TRF3) para o slot da Regional e recebeu o carimbo
 * "Distribuição SJSP/JEF já consta no Hub, mas não atende a este item do
 * checklist" — porque o classificador a leu como a certidão LOCAL (SJSP/JEF),
 * que ele de fato já tinha aprovada no Hub.
 *
 * Motivo: a Regional descreve a própria cobertura citando "Seção Judiciária de
 * São Paulo", e havia um atalho que, ao encontrar "Seção Judiciária" em
 * QUALQUER lugar do texto, decidia SJSP/JEF — exatamente o falso "duplicidade"
 * que o comentário do código já proibia.
 *
 * Discriminador: a 3ª Região é SP + MS. Só a certidão REGIONAL cobre a Seção
 * Judiciária de Mato Grosso do Sul; a local cobre apenas São Paulo.
 */
import { describe, expect, it, vi } from "vitest";

// O modal arrasta o react-pdf (pré-visualização do anexo), que exige APIs de
// canvas inexistentes no ambiente de teste. Só o classificador interessa aqui.
vi.mock("react-pdf", () => ({
  Document: () => null,
  Page: () => null,
  pdfjs: { GlobalWorkerOptions: { workerSrc: "" } },
}));

import {
  detectaSubtipoCertidaoFederal,
  normalizeStr,
} from "@/components/quero-armas/clientes/ClienteDocsHubModal";

/** Texto da certidão REGIONAL do TRF3 — cláusula de cobertura real. */
const REGIONAL = `PODER JUDICIÁRIO
JUSTIÇA FEDERAL
TRIBUNAL REGIONAL FEDERAL DA 3ª REGIÃO
CERTIDÃO JUDICIAL CRIMINAL NEGATIVA
Certidão nº 2026/000005818543
CERTIFICAMOS que, consultados os registros de distribuição, NÃO CONSTAM os
processos abaixo indicados em nome de MARCIO GERALDO FREIRE DE ALMEIDA.
e) Certidão emitida em consulta ao Sistema de Acompanhamento e Informações
Processuais do 1º Grau e do 2º Grau e ao PJe - Sistema Processual Eletrônico;
f) A pesquisa abrange registros desde 25/06/1967 até a presente data, na
Justiça Federal de 1º Grau, Seção Judiciária de São Paulo, desde 22/09/1920 na
Seção Judiciária de Mato Grosso do Sul e desde 20/03/1989 no Tribunal Regional
Federal da 3ª Região (2º Grau);
g) Foram pesquisados processos de Execução Criminal - SEEU.
Tribunal Regional Federal da 3ª Região / Secretaria Judiciária
sejur@trf3.jus.br - Av. Paulista, n. 1842, Torre Sul, 14º andar, São Paulo/SP`;

/** Texto da certidão LOCAL (Seção Judiciária de SP + JEF), mesmo timbre. */
const LOCAL_SJSP_JEF = `PODER JUDICIÁRIO
JUSTIÇA FEDERAL
TRIBUNAL REGIONAL FEDERAL DA 3ª REGIÃO
CERTIDÃO JUDICIAL CRIMINAL NEGATIVA
Abrangência - Seção Judiciária de São Paulo e Juizados Especiais Federais
CERTIFICAMOS que NÃO CONSTAM processos em nome de MARCIO GERALDO FREIRE DE ALMEIDA.
A pesquisa abrange registros da Justiça Federal de 1º Grau, Seção Judiciária de
São Paulo, e dos Juizados Especiais Federais.
Tribunal Regional Federal da 3ª Região / Secretaria Judiciária
sejur@trf3.jus.br - Av. Paulista, n. 1842, Torre Sul, 14º andar, São Paulo/SP`;

const classificar = (texto: string) => detectaSubtipoCertidaoFederal(normalizeStr(texto));

describe("certidão federal — Regional x Seção Judiciária/JEF", () => {
  it("a REGIONAL (cita cobertura de MS) é classificada como Regional", () => {
    expect(classificar(REGIONAL)).toBe("antecedentes_federal_trf3_regional");
  });

  it("a LOCAL (Abrangência - Seção Judiciária) continua sendo SJSP/JEF", () => {
    expect(classificar(LOCAL_SJSP_JEF)).toBe("antecedentes_federal_sjsp_jef");
  });

  it("o campo Abrangência impresso tem precedência sobre a cobertura citada", () => {
    const declaraRegional = REGIONAL.replace(
      "CERTIDÃO JUDICIAL CRIMINAL NEGATIVA",
      "CERTIDÃO JUDICIAL CRIMINAL NEGATIVA\nAbrangência - Regional",
    );
    expect(classificar(declaraRegional)).toBe("antecedentes_federal_trf3_regional");
  });

  it("certidão local sem o campo Abrangência segue caindo em SJSP/JEF", () => {
    const semCampo = LOCAL_SJSP_JEF.replace(
      "Abrangência - Seção Judiciária de São Paulo e Juizados Especiais Federais\n",
      "",
    );
    expect(classificar(semCampo)).toBe("antecedentes_federal_sjsp_jef");
  });
});

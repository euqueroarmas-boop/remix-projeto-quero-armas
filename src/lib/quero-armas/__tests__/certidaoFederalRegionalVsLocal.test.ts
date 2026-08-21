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
 *
 * REINCIDÊNCIA (21/08/2026, caso Igor): a MESMA regressão voltou pelo parser
 * local (`parseTrfRegional` em parsersCertidoes.ts), que é outra CÓPIA da
 * regra e ainda usava o atalho antigo — a Regional impressa pelo celular, com
 * o rodapé do site citando as Seções Judiciárias, virava SJSP/JEF de novo.
 *
 * PAPEL DESTE ARQUIVO — TRAVA CANÔNICA (pedido do usuário, 21/08/2026):
 * quem decide é o CABEÇALHO ("Abrangência"), e este teste prende as TRÊS
 * cópias da regra à mesma decisão:
 *   1. detector do Hub  (detectaSubtipoCertidaoFederal, ClienteDocsHubModal)
 *   2. parser local     (parseCertidao → parseTrfRegional, parsersCertidoes)
 *   3. edge de IA       (qa-classificar-documento-arma — sentinela de fonte)
 * Qualquer mudança em qualquer cópia sem passar por aqui DEVE falhar o teste.
 * Não "ajuste" o teste para o código passar: ajuste o código para a regra.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import { parseCertidao } from "@/lib/quero-armas/parsersCertidoes";

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

/**
 * Certidão REGIONAL impressa pelo CELULAR (caso Igor, 21/08/2026): o site do
 * TRF3 não tem botão de download — o PDF nasce do "Salvar como PDF" do Chrome,
 * que imprime a página inteira, INCLUINDO o rodapé de contatos do site com
 * "Seção Judiciária de São Paulo" e "Seção Judiciária de Mato Grosso do Sul".
 * Estrutura fiel ao arquivo real (dados anonimizados), com o cabeçalho
 * "Abrangência - Regional" e o titular em formato de NOME SOCIAL.
 */
const REGIONAL_IMPRESSA_CELULAR = `PODER JUDICIÁRIO
JUSTIÇA FEDERAL
TRIBUNAL REGIONAL FEDERAL DA 3ª REGIÃO
CERTIDÃO JUDICIAL CRIMINAL NEGATIVA
Abrangência - Regional
N. 2026/000005833730
CERTIFICAMOS, na forma da lei, que, consultando os sistemas processuais abaixo
indicados, NÃO CONSTAM, até a presente data e hora, PROCESSOS de classes
CRIMINAIS contra: MARCIO GERALDO (nome da mãe TEREZA FREIRE e data de
nascimento 01/01/1990) (registrado civilmente como MARCIO GERALDO FREIRE DE
ALMEIDA) ou CPF nº 111.444.777-35.
Certidão emitida em: 21/08/2026, às 10:00:03 (data e hora de Brasília).
Observações:
a) A autenticidade desta certidão poderá ser verificada, no prazo de 90
(noventa) dias, por qualquer interessado no site do TRIBUNAL REGIONAL FEDERAL
DA 3ª REGIÃO, com base no código de segurança AAAABBBBCCCCDDDD.
f) A pesquisa abrange registros desde 25/04/1967 até a presente data, na
Justiça Federal de 1º Grau, Seção Judiciária de São Paulo, desde 22/09/1980 na
Seção Judiciária de Mato Grosso do Sul e desde 30/03/1989 no Tribunal Regional
Federal da 3ª Região (2º Grau).
g) Foram pesquisados processos de Execução Criminal - SEEU.
Tribunal Regional Federal da 3ª Região / Secretaria Judiciária
seju@trf3.jus.br - Av. Paulista, n. 1842, Torre Sul, 14º andar, São Paulo/SP
Seção Judiciária de São Paulo / Divisão de Apoio Judiciário
Dúvidas e sugestões: admsp-suec@trf3.jus.br
Seção Judiciária de Mato Grosso do Sul / Núcleo de Apoio Judiciário
admms-nuaj@trf3.jus.br - Campo Grande - MS`;

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

  it("a Regional impressa pelo celular (rodapé cita as Seções) é Regional no detector do Hub", () => {
    expect(classificar(REGIONAL_IMPRESSA_CELULAR)).toBe("antecedentes_federal_trf3_regional");
  });
});

describe("parser local (parseCertidao) — mesma regra do cabeçalho, mesma trava", () => {
  it("caso Igor 21/08/2026: a Regional impressa pelo celular é Regional, não SJSP/JEF", () => {
    const doc = parseCertidao(REGIONAL_IMPRESSA_CELULAR);
    expect(doc?.orgao).toBe("trf_regional");
    expect(doc?.tipoDocumento).toBe("antecedentes_federal_trf3_regional");
  });

  it("a Regional SEM o campo Abrangência (cobre MS) também é Regional no parser", () => {
    expect(parseCertidao(REGIONAL)?.tipoDocumento).toBe("antecedentes_federal_trf3_regional");
  });

  it("a LOCAL (Abrangência - Seção Judiciária) continua SJSP/JEF no parser", () => {
    expect(parseCertidao(LOCAL_SJSP_JEF)?.tipoDocumento).toBe("antecedentes_federal_sjsp_jef");
  });
});

describe("edge qa-classificar-documento-arma — sentinela da regra do cabeçalho", () => {
  // A edge roda em Deno e não é importável aqui; a trava é sobre o FONTE.
  // Se este teste falhar, alguém mexeu na decisão pelo campo "Abrangência"
  // dentro da edge — reponha a regra (ou atualize as TRÊS cópias juntas,
  // com o aval explícito do usuário, que já corrigiu esta regressão 7 vezes).
  const FONTE_EDGE = readFileSync(
    join(process.cwd(), "supabase/functions/qa-classificar-documento-arma/index.ts"),
    "utf8",
  );

  it("a decisão pelo campo Abrangência permanece intacta na edge", () => {
    expect(FONTE_EDGE).toContain(
      String.raw`norm.match(/ABRANGENCIA\s*[-:]?\s*([^\n]{0,80})/)`,
    );
    expect(FONTE_EDGE).toContain(`? "ANTECEDENTES_FEDERAL_SJSP_JEF"`);
    expect(FONTE_EDGE).toContain(`: "ANTECEDENTES_FEDERAL_TRF3_REGIONAL"`);
  });
});

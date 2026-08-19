/* =============================================================================
 * Regressão — atestado do IIRGD/SSP-SP recusado por "a filiação não contém o
 * nome da mãe: na certidão consta 42357200".
 *
 * O 42357200 é o NÚMERO DO RG. A certidão trazia pai e mãe corretos; o que
 * falhou foi a leitura.
 *
 * O PDF do IIRGD desenha a página FORA DA ORDEM em que ela é lida: primeiro a
 * coluna inteira dos rótulos ("Nº RG de SP:", "Filiação:", "Data de
 * Nascimento:"), depois a coluna inteira dos valores, e por último o "NÃO" de
 * "NÃO existe registro". Agrupando os fragmentos na ordem do desenho, cada
 * rótulo virava uma linha sozinho, o parser lia "as duas linhas seguintes a
 * Filiação:" e devolvia o número do RG como se fosse nome de pai.
 *
 * Os fragmentos abaixo repetem as coordenadas e a ordem de desenho reais do
 * documento — os dados pessoais é que são fictícios.
 * ============================================================================= */
import { describe, it, expect } from "vitest";
import { reconstruirLinhasPdf, type ItemTextoPdf } from "../leituraCamposPdf";
import { parseCertidao } from "../parsersCertidoes";
import { conferirCertidao } from "../conferenciaCertidao";

const frag = (str: string, x: number, y: number, width: number): ItemTextoPdf =>
  ({ str, width, hasEOL: false, transform: [1, 0, 0, 1, x, y] });

/** Ordem de desenho do PDF real: rótulos, valores, e o "NÃO" no fim. */
const paginaIirgd = (negativo: boolean): ItemTextoPdf[] => [
  frag("IIRGD - Instituto de Identificação Ricardo Gumbleton Daunt", 113.9, 782.6, 288.8),
  frag("Secretaria da Segurança Pública", 194.7, 799.7, 146.0),
  // Coluna dos rótulos, desenhada inteira antes de qualquer valor.
  frag("Nº RG de SP:", 50.9, 690.9, 50.0),
  frag("Filiação:", 50.9, 670.9, 32.4),
  frag("Data de Nascimento:", 50.9, 630.9, 79.0),
  // Coluna dos valores.
  frag("12345678", 176.8, 690.9, 35.5),
  frag("MANOEL ZUZA DE LIMA", 176.8, 670.9, 120.8),
  frag("NECI LOBATO DE LIMA", 176.8, 651.9, 104.8),
  frag("05/12/1974", 176.8, 630.9, 40.0),
  // Dígito verificador do RG, desenhado depois e em dois pedaços.
  frag("9", 223.7, 690.9, 4.4),
  frag("-", 216.9, 690.9, 2.7),
  frag("PEDRO LOBATO DE LIMA", 178.8, 708.9, 100.8),
  frag("Nome:", 50.9, 710.9, 24.9),
  frag("Documento Informado:", 50.9, 729.8, 87.9),
  frag("RG", 176.8, 729.8, 12.0),
  frag("Atestado de Antecedentes Criminais", 143.8, 759.6, 243.2),
  frag("Atesto que, para a combinação de dados de qualificação acima informada,", 50.9, 526.1, 264.7),
  frag("existe registro de antecedentes", 337.6, 526.1, 111.0),
  frag("judiciário-criminais, até a presente data, no instituto de Identificação Ricardo Gumbleton Daunt.", 50.9, 516.1, 337.1),
  // O "NÃO" só é desenhado depois do bloco "IMPORTANTE".
  frag("IMPORTANTE:", 51.9, 497.1, 55.5),
  ...(negativo ? [frag("NÃO", 317.6, 526.1, 17.8)] : []),
  frag("Este atestado foi emitido em", 50.9, 356.3, 100.8),
  frag(", às", 194.8, 356.3, 12.9),
  frag("horas e está disponível para consulta no endereço da internet:", 232.7, 356.3, 221.2),
  frag("14:08", 209.8, 356.3, 20.4),
  frag("19/08/2026", 153.8, 356.3, 40.0),
];

const cadastro = {
  nome_completo: "Pedro Lobato de Lima",
  data_nascimento: "1974-12-05",
  nome_mae: "Neci Lobato de Lima",
  nome_pai: "Manoel Zuza de Lima",
  // Cadastro guarda o RG SEM o dígito verificador; o documento imprime com.
  rg: "12345678",
};

describe("IIRGD — página desenhada fora de ordem", () => {
  const texto = reconstruirLinhasPdf(paginaIirgd(true));

  it("junta rótulo e valor na mesma linha, apesar da ordem do desenho", () => {
    expect(texto).toMatch(/Nº RG de SP:\s+12345678\s*-\s*9/);
    expect(texto).toMatch(/Filiação:\s+MANOEL ZUZA DE LIMA/);
    expect(texto).toMatch(/Data de Nascimento:\s+05\/12\/1974/);
    expect(texto).toMatch(/Nome:\s+PEDRO LOBATO DE LIMA/);
    expect(texto).toMatch(/emitido em\s+19\/08\/2026/);
  });

  it("devolve o 'NÃO' desenhado por último para dentro da frase", () => {
    expect(texto).toMatch(/informada,\s+NÃO existe registro de antecedentes/);
  });

  it("lê pai e mãe — nunca o número do RG — como filiação", () => {
    const c = parseCertidao(texto);
    expect(c?.filiacao).toEqual(["MANOEL ZUZA DE LIMA", "NECI LOBATO DE LIMA"]);
    expect(c?.rg).toBe("123456789");
    expect(c?.data_nascimento).toBe("1974-12-05");
    expect(c?.data_emissao).toBe("2026-08-19");
    expect(c?.resultado).toBe("NADA_CONSTA");
  });

  it("aprova o atestado correto, com o RG do cadastro sem dígito verificador", () => {
    const r = conferirCertidao(parseCertidao(texto)!, cadastro, texto);
    expect(r.veredicto).toBe("aprovado");
  });

  it("continua acusando o atestado POSITIVO", () => {
    const positivo = reconstruirLinhasPdf(paginaIirgd(false));
    const c = parseCertidao(positivo);
    expect(c?.resultado).toBe("CONSTA");
    expect(conferirCertidao(c!, cadastro, positivo).veredicto).toBe("rejeitado");
  });

  it("não aprova certidão de outra pessoa", () => {
    const r = conferirCertidao(parseCertidao(texto)!, { ...cadastro, nome_mae: "Maria da Silva" }, texto);
    expect(r.veredicto).toBe("rejeitado");
    expect(r.achados.some((a) => a.campo === "filiacao")).toBe(true);
  });

  it("não aceita RG diferente por mais de um dígito", () => {
    const r = conferirCertidao(parseCertidao(texto)!, { ...cadastro, rg: "1234567" }, texto);
    expect(r.achados.some((a) => a.campo === "rg" && a.problema === "divergente")).toBe(true);
  });
});

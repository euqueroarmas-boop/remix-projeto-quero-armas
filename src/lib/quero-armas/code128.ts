// ============================================================================
// code128.ts — código de barras CODE 128C, em módulos
// ----------------------------------------------------------------------------
// O DANFE exige, por norma (MOC, Anexo II), o código de barras CODE 128C da
// chave de acesso de 44 dígitos. É o que o conferente bipa no posto fiscal.
//
// Aqui só se calcula o PADRÃO — a sequência de barras e espaços. Quem desenha
// é o gerador do PDF, com retângulos vetoriais: nada de canvas, nada de imagem
// rasterizada, nada de dependência nova. Assim o código sai nítido em qualquer
// zoom e o PDF continua leve.
//
// A tabela abaixo é a tabela canônica do CODE 128 (107 símbolos). O teste
// `code128.test.ts` confere, símbolo a símbolo, contra o encoder do jsbarcode
// — que já é dependência do projeto. Se algum dígito da tabela for digitado
// errado um dia, o teste acusa na hora, em vez de gerar uma etiqueta que o
// leitor do fisco recusa.
// ============================================================================

/** Padrões de barras dos 107 símbolos do CODE 128 (0-102, Start A/B/C, Stop). */
const BARRAS = [
  "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
  "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
  "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
  "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
  "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
  "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
  "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
  "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
  "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
  "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
  "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
  "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
  "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
  "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
  "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
  "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
  "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
  "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
  "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
  "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
  "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
  "11010011100", "1100011101011",
];

/** Símbolo que inicia a leitura no modo C (pares de dígitos). */
const START_C = 105;
/** Símbolo de parada. */
const STOP = 106;

/**
 * Codifica dígitos em CODE 128C e devolve os módulos como string de "0" e "1"
 * ("1" = barra, "0" = espaço). Cada caractere vale UM módulo de largura.
 *
 * Devolve string vazia quando a entrada não serve — o modo C só codifica
 * dígitos, e sempre aos pares. Chave de NF-e tem 44 dígitos, número par.
 */
export function code128cModulos(digitos: string): string {
  const d = String(digitos ?? "").trim();
  if (!/^\d+$/.test(d) || d.length % 2 !== 0) return "";

  // Start C, seguido de um símbolo por par de dígitos.
  const simbolos: number[] = [START_C];
  for (let i = 0; i < d.length; i += 2) simbolos.push(Number(d.slice(i, i + 2)));

  // Dígito verificador: soma ponderada pela POSIÇÃO (o Start pesa 1), mód 103.
  let soma = START_C;
  for (let i = 1; i < simbolos.length; i++) soma += simbolos[i] * i;
  simbolos.push(soma % 103);

  simbolos.push(STOP);
  return simbolos.map((s) => BARRAS[s]).join("");
}

/** Faixas contíguas de barras: [início em módulos, largura em módulos]. */
export function code128cBarras(modulos: string): Array<[number, number]> {
  const faixas: Array<[number, number]> = [];
  let i = 0;
  while (i < modulos.length) {
    if (modulos[i] !== "1") {
      i++;
      continue;
    }
    let j = i;
    while (j < modulos.length && modulos[j] === "1") j++;
    faixas.push([i, j - i]);
    i = j;
  }
  return faixas;
}

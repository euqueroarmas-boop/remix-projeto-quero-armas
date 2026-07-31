/**
 * Comparação de conteúdo entre o PDF que NÓS geramos e o PDF assinado que o
 * cliente devolve.
 *
 * Por que existe
 * -------------
 * O vínculo forte é byte a byte: o PDF assinado deve começar com os bytes do
 * original (atualização incremental PAdES). Só que o assinador do Gov.br
 * frequentemente RE-LINEARIZA o arquivo — reescreve a estrutura interna — e o
 * byte a byte quebra mesmo com assinatura legítima e conteúdo intacto.
 *
 * Quando isso acontecia, a única verificação de conteúdo que sobrava era
 * "o número do contrato aparece no texto". Quem baixasse o contrato, alterasse
 * uma cláusula, mantivesse o número e assinasse passaria — e o caso caía em
 * revisão manual, dependendo de um humano ler o contrato inteiro.
 *
 * Esta camada fecha isso: a re-linearização muda os BYTES, mas não muda o
 * TEXTO. Se todo o texto do original continua presente no assinado, nada foi
 * removido nem alterado — nem cláusula, nem qualificação do contratante, nem o
 * CARIMBO DE CONEXÃO.
 *
 * O carimbo de conexão são as informações impressas na lateral esquerda do
 * documento (IP, dispositivo e data/hora do aceite do cliente). Ele é texto
 * como qualquer outro, e por isso não precisa de verificação própria: quem
 * apagar a lateral apaga texto, e a comparação acusa na hora, apontando o
 * trecho que sumiu.
 *
 * Por que "contém" e não "igual"
 * ------------------------------
 * O assinado é o original MAIS o bloco de assinatura. Exigir igualdade
 * reprovaria todo documento assinado. O que se exige é que nada tenha SUMIDO:
 * cada trecho do original tem de estar no assinado. Acréscimo é esperado;
 * subtração e substituição, não.
 */

/**
 * Extrai o texto visível de um PDF.
 *
 * O texto de um PDF vive dentro de streams, quase sempre COMPRIMIDOS com
 * Flate (zlib). Ler os bytes crus e catar o que está entre parênteses parece
 * funcionar — e é uma armadilha: pega lixo binário do stream comprimido, que
 * varia a cada recompressão. Um PDF re-linearizado pelo Gov.br teria o mesmo
 * texto e "conteúdo" completamente diferente, e a comparação reprovaria
 * documento legítimo.
 *
 * Por isso descomprimimos cada stream antes de extrair.
 */
async function inflar(bytes: Uint8Array): Promise<string> {
  // `deflate` cobre zlib com cabeçalho; `deflate-raw` cobre sem. PDFs usam os
  // dois, dependendo de quem gerou.
  for (const formato of ["deflate", "deflate-raw"] as const) {
    try {
      const ds = new DecompressionStream(formato);
      const stream = new Blob([bytes as BufferSource]).stream().pipeThrough(ds);
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      return new TextDecoder("latin1").decode(buf);
    } catch {
      // Formato errado: tenta o próximo.
    }
  }
  return "";
}

/** Junta o texto de todos os operadores Tj/TJ de um conteúdo já legível. */
function textoDeConteudo(conteudo: string): string {
  const pedacos: string[] = [];
  const re = /\(((?:\\.|[^()\\])*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(conteudo)) !== null) {
    pedacos.push(
      m[1]
        .replace(/\\(\d{1,3})/g, (_s, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\([()\\])/g, "$1"),
    );
  }
  return pedacos.join(" ");
}

export async function extrairTextoPdf(bytes: Uint8Array): Promise<string> {
  const latin = new TextDecoder("latin1").decode(bytes);
  const partes: string[] = [];

  // Percorre cada `stream ... endstream` e tenta descomprimir. O que não
  // descomprimir é tratado como texto puro (PDF sem compressão existe).
  const re = /stream\r?\n?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin)) !== null) {
    const ini = m.index + m[0].length;
    const fim = latin.indexOf("endstream", ini);
    if (fim < 0) continue;
    // Corta o \r\n que separa os dados do `endstream`. `DecompressionStream`
    // é estrito e aborta com "trailing junk" por causa desses bytes — ao
    // contrário do zlib de linha de comando, que os tolera.
    let corte = fim;
    while (corte > ini) {
      const b = bytes[corte - 1];
      if (b === 0x0a || b === 0x0d || b === 0x20 || b === 0x09) corte--;
      else break;
    }
    const inflado = await inflar(bytes.subarray(ini, corte));
    // Sem fallback para os bytes crus: stream comprimido lido como texto vira
    // lixo binário, e lixo binário muda a cada recompressão. Seria a receita
    // para reprovar documento legítimo re-linearizado pelo Gov.br.
    if (inflado) partes.push(textoDeConteudo(inflado));
    else if (!/[\x00-\x08\x0e-\x1f]/.test(latin.slice(ini, Math.min(ini + 200, corte)))) {
      // PDF sem compressão: o conteúdo já é legível.
      partes.push(textoDeConteudo(latin.slice(ini, corte)));
    }
  }
  return partes.join(" ");
}

/**
 * Normaliza para comparação.
 *
 * Tira acento, pontuação e espaço múltiplo — variações que a re-linearização
 * pode introduzir sem que o conteúdo mude. Mantém letras e números, que é onde
 * uma adulteração real apareceria (nome trocado, valor alterado, cláusula
 * suprimida).
 */
export function normalizarParaComparacao(texto: string): string {
  return texto
    .normalize("NFD")
    // Acento sai: a codificação da fonte pode representá-lo de formas
    // diferentes sem que o texto mude.
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    // PONTUAÇÃO FICA. Antes eu a removia junto com o espaço, e isso abria um
    // furo real: trocar vírgula por ponto num valor ("1.000,00" → "1,000.00")
    // passava batido, porque os dígitos eram os mesmos. Em contrato, pontuação
    // muda sentido — e a re-linearização do Gov.br não mexe em pontuação, só
    // em quebras de linha. Por isso só o ESPAÇO é normalizado.
    .replace(/\s+/g, " ")
    .trim();
}

export interface ResultadoComparacao {
  /** Todo o conteúdo do original sobreviveu no assinado. */
  integro: boolean;
  /** Quanto do original foi encontrado (0..1). */
  cobertura: number;
  /** Trechos do original que NÃO aparecem no assinado. */
  trechosFaltantes: string[];
  /** Diagnóstico para log e para a mensagem ao cliente. */
  detalhe: string;
  /** Sinaliza quando não houve texto suficiente para concluir nada. */
  inconclusivo: boolean;
}

/**
 * Compara em blocos de palavras, não caractere a caractere.
 *
 * Bloco pequeno demais gera falso positivo (palavras soltas aparecem em
 * qualquer lugar); grande demais quebra por uma quebra de linha diferente.
 * Doze palavras é uma frase de contrato — grande o bastante para ser única,
 * pequena o bastante para tolerar reflow.
 */
const PALAVRAS_POR_BLOCO = 12;

/** Abaixo disto não há texto suficiente para afirmar coisa alguma. */
const MINIMO_PALAVRAS = 40;

export async function compararConteudoPdf(
  bytesOriginal: Uint8Array,
  bytesAssinado: Uint8Array,
): Promise<ResultadoComparacao> {
  const original = normalizarParaComparacao(await extrairTextoPdf(bytesOriginal));
  const assinado = normalizarParaComparacao(await extrairTextoPdf(bytesAssinado));
  return compararTextos(original, assinado);
}

/**
 * O mesmo confronto, a partir de textos JÁ normalizados.
 *
 * Existe para o golden record: o texto do original é gravado na geração, então
 * na validação não há PDF original para reprocessar — só o texto guardado.
 * Evita depender de o arquivo ainda estar no storage e de os bytes serem os
 * mesmos, que é justamente o que a re-linearização quebra.
 */
export function compararTextos(original: string, assinado: string): ResultadoComparacao {
  const palavras = original.split(" ").filter(Boolean);

  if (palavras.length < MINIMO_PALAVRAS || assinado.length < 40) {
    return {
      integro: false,
      cobertura: 0,
      trechosFaltantes: [],
      inconclusivo: true,
      detalhe:
        "Não foi possível ler texto suficiente de um dos arquivos para comparar o conteúdo. " +
        "Isso acontece quando o PDF é imagem digitalizada.",
    };
  }

  const faltantes: string[] = [];
  let blocos = 0;
  let encontrados = 0;

  for (let i = 0; i + PALAVRAS_POR_BLOCO <= palavras.length; i += PALAVRAS_POR_BLOCO) {
    const bloco = palavras.slice(i, i + PALAVRAS_POR_BLOCO).join(" ");
    blocos++;
    if (assinado.includes(bloco)) {
      encontrados++;
    } else if (faltantes.length < 5) {
      // Guarda só os primeiros: a mensagem serve para apontar ONDE mudou, não
      // para listar o documento inteiro.
      faltantes.push(bloco);
    }
  }

  const cobertura = blocos > 0 ? encontrados / blocos : 0;
  const integro = blocos > 0 && encontrados === blocos;

  return {
    integro,
    cobertura,
    trechosFaltantes: faltantes,
    inconclusivo: false,
    detalhe: integro
      ? "Conteúdo idêntico ao documento original: nada foi removido nem alterado."
      : `${blocos - encontrados} de ${blocos} trechos do documento original não foram encontrados no arquivo assinado.`,
  };
}

/* ── Golden record: o documento fala do cliente certo? ───────────────────── */

/**
 * Confronta a qualificação impressa no documento com o cadastro do cliente.
 *
 * A comparação de conteúdo acima responde "o documento é o que geramos?".
 * Esta responde outra pergunta, igualmente necessária: "ele é do cliente
 * certo?". São falhas diferentes — um contrato íntegro pode ter sido gerado
 * com o cadastro errado, e a integridade não acusaria nada.
 *
 * Mesma regra da conferência de certidões: SEM TOLERÂNCIA. Normaliza só o que
 * o próprio órgão ignora (acento, pontuação, caixa) e compara o resto
 * caractere a caractere. A PF indefere por uma letra.
 */
export interface CadastroGolden {
  nome_completo?: string | null;
  cpf?: string | null;
}

export interface ResultadoGolden {
  confere: boolean;
  nomeEncontrado: boolean;
  cpfEncontrado: boolean;
  divergencias: string[];
}

/**
 * Normalização para IDENTIDADE, diferente da de integridade.
 *
 * Na integridade a pontuação importa — trocar vírgula por ponto num valor muda
 * o contrato. Na identidade ela é ruído: o CPF aparece como 377.995.388-99 no
 * documento e pode estar 37799538899 no cadastro, e é a mesma pessoa. Por isso
 * aqui, e SÓ aqui, a pontuação sai.
 */
function chaveIdentidade(v: string): string {
  return normalizarParaComparacao(v).replace(/[^A-Z0-9]+/g, " ").trim();
}

export function conferirGoldenRecord(
  textoDocumento: string,
  cadastro: CadastroGolden,
): ResultadoGolden {
  const texto = chaveIdentidade(textoDocumento);
  const divergencias: string[] = [];

  const nome = chaveIdentidade(String(cadastro.nome_completo ?? ""));
  const cpfDigitos = String(cadastro.cpf ?? "").replace(/\D/g, "");

  // O nome tem de aparecer inteiro. Nome parcial não vale: "WILLIAN" bate com
  // qualquer Willian, e o que a PF confere é o nome completo.
  const nomeEncontrado = nome.length > 5 && texto.includes(nome);
  if (nome.length > 5 && !nomeEncontrado) {
    divergencias.push(
      `O nome do cadastro ("${cadastro.nome_completo}") não aparece no documento.`,
    );
  }

  // O CPF é procurado só em dígitos: no PDF ele pode estar como 123.456.789-00
  // ou 12345678900, e a normalização já removeu a pontuação.
  const cpfEncontrado = cpfDigitos.length === 11 && texto.replace(/ /g, "").includes(cpfDigitos);
  if (cpfDigitos.length === 11 && !cpfEncontrado) {
    divergencias.push(`O CPF do cadastro (${cadastro.cpf}) não aparece no documento.`);
  }

  return {
    // Exige os dois quando os dois existem no cadastro. Cadastro incompleto
    // não reprova documento — é falha nossa, não do cliente.
    confere: divergencias.length === 0,
    nomeEncontrado,
    cpfEncontrado,
    divergencias,
  };
}

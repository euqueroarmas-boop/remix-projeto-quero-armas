// ============================================================================
// parserRequerimentoSinarm — leitura determinística do requerimento da PF
// ----------------------------------------------------------------------------
// PROBLEMA QUE ESTE ARQUIVO RESOLVE
//
// O formulário que o cliente gera no SINARM para o processo de POSSE tem, no
// papel, o título "REQUERIMENTO DE AQUISIÇÃO DE ARMA DE FOGO" — é assim que a
// Polícia Federal o nomeia. No catálogo do Hub o mesmo documento se chama
// "Requerimento de Posse de Arma de Fogo (Polícia Federal)".
//
// Enquanto a leitura desse PDF dependeu da IA, o resultado era sempre o mesmo:
// o modelo via um formulário oficial com número de protocolo, não achava o tipo
// "requerimento" na lista de tipos possíveis e devolvia PROTOCOLO_DO_PROCESSO
// com 98% de confiança. O slot pedia requerimento, a classificação dizia
// protocolo, e o documento CERTO era carimbado REPROVADO na cara do cliente.
//
// Documento com camada de texto não é palpite: é leitura. Este parser lê o
// requerimento byte a byte e devolve tipo e campos sem consultar IA nenhuma.
//
// ESPELHO: a mesma detecção roda na edge `qa-classificar-documento-arma`
// (função `aplicarClassificacaoDeterministica`). Front e edge não compartilham
// módulo (Deno x Vite), então as duas cópias precisam mudar juntas — mesma
// convenção já usada em `requerimentoSinarm` e `pendenciasGrupos`.
// ============================================================================

import {
  dataEmissaoDoNumero,
  extrairNumeroRequerimento,
  vencimentoRequerimentoImpresso,
} from "./requerimentoSinarm";

export interface RequerimentoSinarmLido {
  /** "aquisicao" e "posse" instruem o processo de posse; "porte" é outra via. */
  finalidade: "aquisicao" | "posse";
  numero_requerimento: string;
  /** ISO — vem dos 8 primeiros dígitos do número, não de OCR de rótulo. */
  data_emissao: string | null;
  /** ISO — validade impressa pela própria PF (~30 dias da emissão). */
  data_vencimento: string | null;
  nome_completo: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  especie_arma: string | null;
  calibre: string | null;
}

/** Uppercase sem acento, espaços colapsados — para casar rótulo de formulário. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Rótulos do próprio formulário que a ordem de leitura do PDF cola na frente do
 * nome do requerente. Nenhum nome de pessoa começa por eles.
 */
const RUIDO_ANTES_DO_NOME = new Set([
  "MJ", "POLICIA", "FEDERAL", "SERVICO", "PUBLICO", "DIVISAO", "NACIONAL",
  "CONTROLE", "ARMAS", "ARMA", "FOGO", "REQUERIMENTO", "NUMERO", "DATA",
  "VENCIMENTO", "IDENTIFICACAO", "VIA", "REQUERENTE", "TIPO", "FORMULARIO",
  "CATEGORIA", "CIDADAO", "DE", "DO", "DA", "DOS", "DAS", "E",
]);

/**
 * O nome sai da frase-modelo do requerimento ("FULANO, RG: …, CPF: …, vem por
 * meio deste, REQUERER…"). Como o PDF entrega os itens fora de ordem visual, a
 * captura pode vir grudada em rótulos — que são removidos token a token.
 * Preferimos devolver `null` a devolver um nome sujo: nome errado no Hub vira
 * acusação de "documento de outro titular".
 */
function limparNomeRequerente(bruto: string): string | null {
  const tokens = normalizar(bruto).split(" ").filter(Boolean);
  while (tokens.length && RUIDO_ANTES_DO_NOME.has(tokens[0])) tokens.shift();
  const nome = tokens.join(" ");
  if (tokens.length < 2 || nome.length < 6 || nome.length > 120) return null;
  if (!/^[A-Z][A-Z' ]+$/.test(nome)) return null;
  return nome;
}

function dataBrParaIso(br: string | null | undefined): string | null {
  if (!br || !/^\d{2}\/\d{2}\/\d{4}$/.test(br)) return null;
  const [dd, mm, aaaa] = br.split("/");
  const iso = `${aaaa}-${mm}-${dd}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * Dados da arma pretendida. Ficam numa faixa própria do formulário; procurar no
 * documento inteiro pegaria a "Espécie" da GRU ("1 - Registro de arma de fogo"),
 * que é outra coisa.
 */
function lerDadosDaArma(texto: string): { especie: string | null; calibre: string | null } {
  const norm = normalizar(texto);
  const idx = norm.indexOf("DADOS DA ARMA");
  if (idx < 0) return { especie: null, calibre: null };
  const janela = norm.slice(Math.max(0, idx - 400), idx + 200);
  const especie = janela.match(/ESPECIE\s*:?\s*([A-Z]{3,20})\b/)?.[1] ?? null;
  // O rótulo "Calibre:" costuma sair DEPOIS do valor na ordem de leitura.
  const calibreBruto =
    janela.match(/CALIBRE\s*:?\s*(\.?\d{1,3}(?:\.\d{1,2})?(?:\s?MM)?)\b/)?.[1] ??
    janela.match(/(\.?\d{1,3}(?:\.\d{1,2})?(?:\s?MM)?)\s+(?:[A-Z]{2,4}\s+)?CALIBRE\s*:/)?.[1] ??
    null;
  const calibre = calibreBruto && /^\.?\d/.test(calibreBruto) ? calibreBruto.trim() : null;
  return { especie: especie && especie !== "DOCUM" ? especie : null, calibre };
}

/**
 * Reconhece o requerimento SINARM e devolve os campos lidos.
 * `null` quando o texto não é (ou não dá para afirmar que é) um requerimento —
 * nesse caso o fluxo antigo segue e a IA assume, como sempre fez.
 *
 * REQUERIMENTO DE PORTE é deliberadamente recusado aqui: é outra exigência,
 * com outro slot, e classificá-lo como o requerimento de posse trocaria um
 * falso negativo por um falso positivo.
 */
export function parseRequerimentoSinarm(texto: unknown): RequerimentoSinarmLido | null {
  const bruto = String(texto ?? "");
  if (bruto.trim().length < 80) return null;
  const norm = normalizar(bruto);

  const titulo = norm.match(/REQUERIMENTO DE (AQUISICAO|POSSE|PORTE) DE ARMA DE FOGO/);
  if (!titulo) return null;
  if (titulo[1] === "PORTE") return null;

  const ehDaPf =
    /POLICIA FEDERAL/.test(norm) ||
    /SINARM/.test(norm) ||
    /DIVISAO NACIONAL DE CONTROLE DE ARMAS DE FOGO/.test(norm);
  if (!ehDaPf) return null;

  // Sem o número de 18 dígitos não há requerimento: é dele que saem a emissão,
  // o prazo de entrega e a reabertura do processo no site da PF.
  const numero = extrairNumeroRequerimento(bruto);
  if (!numero) return null;

  const emissao = dataEmissaoDoNumero(numero);
  const vencimento = vencimentoRequerimentoImpresso(bruto);

  const frase = bruto.match(
    /([A-Za-zÀ-ÿ'\s]{6,160}?)\s*,\s*RG\s*:?\s*([\dA-Za-z.\-/]{5,20})\s*,\s*CPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\s*,\s*vem\s+por\s+meio\s+deste/i,
  );
  const nome = frase ? limparNomeRequerente(frase[1]) : null;
  const rg = frase ? frase[2].trim() : null;
  const cpf = frase
    ? frase[3]
    : (bruto.match(/CPF\s*:?\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i)?.[1] ?? null);

  // Na ordem de leitura do formulário, o sexo vem logo depois da data de
  // nascimento — âncora estável para não pegar outra data qualquer do bloco.
  const nascimento = dataBrParaIso(
    bruto.match(/(\d{2}\/\d{2}\/\d{4})\s+(?:Masculino|Feminino)/i)?.[1] ?? null,
  );

  const { especie, calibre } = lerDadosDaArma(bruto);

  return {
    finalidade: titulo[1] === "POSSE" ? "posse" : "aquisicao",
    numero_requerimento: numero,
    data_emissao: emissao,
    data_vencimento: vencimento,
    nome_completo: nome,
    cpf,
    rg,
    data_nascimento: nascimento,
    especie_arma: especie,
    calibre,
  };
}

/**
 * Sinal de texto para reclassificar o que a IA já chutou. Serve o caminho em
 * que o PDF não tem camada de texto (digitalizado) e a leitura veio da visão:
 * a justificativa do modelo cita o título impresso, e o título é suficiente
 * para saber que aquilo é o requerimento — não um protocolo.
 */
export function textoIndicaRequerimentoSinarm(hayNormalizado: string): boolean {
  return (
    /REQUERIMENTO DE (AQUISICAO|POSSE) DE ARMA DE FOGO/.test(hayNormalizado) &&
    // O haystack do Hub troca pontuação por espaço ("10.826" vira "10 826"),
    // então a referência à lei precisa aceitar as duas formas.
    /POLICIA FEDERAL|SINARM|DIVISAO NACIONAL DE CONTROLE DE ARMAS DE FOGO|10[\s.]?826/.test(
      hayNormalizado,
    )
  );
}

/* =============================================================================
 * CAMPOS DIGITADOS PELO CLIENTE NO SITE DA PF
 *
 * Tudo que está no bloco IDENTIFICAÇÃO foi DIGITADO à mão pelo cliente no
 * portal da Polícia Federal. É o único documento do processo em que isso
 * acontece — todos os outros são emitidos por órgão. Um dígito trocado aqui não
 * é detalhe de cadastro: é o processo inteiro andando com o dado errado.
 *
 * Por isso a leitura é campo a campo, pela POSIÇÃO na página (o formulário
 * desenha todos os rótulos e depois todos os valores; ver
 * `parearRotulosPorGeometria`), e nada é inferido: rótulo sem valor à direita
 * volta vazio.
 *
 * O BLOCO DA EMPRESA FICA DE FORA, DE PROPÓSITO. Ele fica em outra página, com
 * os MESMOS rótulos do endereço pessoal (CEP, Logradouro, Numero, Bairro, UF,
 * Município). Ler as duas páginas juntas sobrescreveria a casa do cliente pelo
 * endereço do trabalho — e a decisão do produto é não conferir o vínculo
 * empregatício contra o cadastro.
 * ============================================================================= */

import {
  parearRotulosPorGeometria,
  type ItemTextoPdf,
  type ParRotuloValor,
} from "./leituraCamposPdf";

export interface CamposRequerimentoPF {
  // Identificação pessoal
  nome_completo: string;
  cpf: string;
  nome_mae: string;
  nome_pai: string;
  data_nascimento: string; // ISO
  sexo: string;
  estado_civil: string;
  // Naturalidade
  naturalidade_pais: string;
  naturalidade_uf: string;
  naturalidade_municipio: string;
  // Documento de identidade
  rg: string;
  rg_orgao: string;
  rg_uf: string;
  rg_expedicao: string; // ISO
  titulo_eleitor: string;
  // Contato e ocupação
  profissao: string;
  email: string;
  celular: string;
  telefone_fixo: string;
  // Endereço residencial
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  // Informativos (não se comparam com o cadastro)
  tipo_formulario: string;
  categoria: string;
  aposentado: string;
  tipo_endereco: string;
  especie_arma: string;
  calibre: string;
}

const VAZIO: CamposRequerimentoPF = {
  nome_completo: "", cpf: "", nome_mae: "", nome_pai: "", data_nascimento: "",
  sexo: "", estado_civil: "", naturalidade_pais: "", naturalidade_uf: "",
  naturalidade_municipio: "", rg: "", rg_orgao: "", rg_uf: "", rg_expedicao: "",
  titulo_eleitor: "", profissao: "", email: "", celular: "", telefone_fixo: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "",
  uf: "", tipo_formulario: "", categoria: "", aposentado: "", tipo_endereco: "",
  especie_arma: "", calibre: "",
};

/** Rótulos que o gerador do PDF imprime quebrados, sem os dois-pontos. */
const ROTULOS_SEM_DOIS_PONTOS = ["País de", "Pais de", "País de Nascimento"];

/** Rótulo → campo. Um para um; os ambíguos são resolvidos logo abaixo. */
const ROTULO_PARA_CAMPO: Record<string, keyof CamposRequerimentoPF> = {
  "NOME": "nome_completo",
  "CPF": "cpf",
  "NOME DA MAE": "nome_mae",
  "NOME DO PAI": "nome_pai",
  "DATA DE NASCIMENTO": "data_nascimento",
  "SEXO": "sexo",
  "ESTADO CIVIL": "estado_civil",
  "PAIS DE": "naturalidade_pais",
  "PAIS DE NASCIMENTO": "naturalidade_pais",
  "UF DE NASCIMENTO": "naturalidade_uf",
  "NUMERO DO RG": "rg",
  "ORGAO EXP. RG": "rg_orgao",
  "ORGAO EXP RG": "rg_orgao",
  "UF DE EXP. RG": "rg_uf",
  "UF DE EXP RG": "rg_uf",
  "DATA DE EXPEDICAO": "rg_expedicao",
  "TITULO DE ELEITOR": "titulo_eleitor",
  "PROFISSAO": "profissao",
  "EMAIL": "email",
  "TELEFONE CELULAR": "celular",
  "TELEFONE FIXO": "telefone_fixo",
  "CEP": "cep",
  "LOGRADOURO": "logradouro",
  "NUMERO": "numero",
  "COMPLEMENTO": "complemento",
  "BAIRRO": "bairro",
  "UF": "uf",
  "TIPO DE FORMULARIO": "tipo_formulario",
  "CATEGORIA": "categoria",
  "APOSENTADO": "aposentado",
  "TIPO": "tipo_endereco",
};

/**
 * "Município:" aparece DUAS vezes na mesma página: uma na linha da
 * naturalidade, outra na do endereço. Quem desempata é o rótulo vizinho
 * impresso na mesma linha — "País de" na primeira, "UF:" na segunda.
 */
function campoDoMunicipio(par: ParRotuloValor): keyof CamposRequerimentoPF | null {
  if (par.vizinhos.some((v) => v.startsWith("PAIS") || v === "UF DE NASCIMENTO")) {
    return "naturalidade_municipio";
  }
  if (par.vizinhos.includes("UF")) return "cidade";
  return null;
}

function textoDaPagina(itens: ItemTextoPdf[]): string {
  return normalizar(itens.map((i) => String(i?.str ?? "")).join(" "));
}

/**
 * Lê os campos digitados a partir das páginas do PDF (itens do pdf.js).
 *
 * Só a página do bloco IDENTIFICAÇÃO alimenta os dados pessoais; só a do bloco
 * DADOS DA ARMA alimenta espécie e calibre. A página da empresa nunca é lida.
 */
export function lerCamposRequerimentoPorGeometria(
  paginas: ItemTextoPdf[][],
): CamposRequerimentoPF {
  const campos: CamposRequerimentoPF = { ...VAZIO };

  const identificacao = paginas.find((p) => textoDaPagina(p).includes("IDENTIFICACAO"));
  if (identificacao) {
    for (const par of parearRotulosPorGeometria(identificacao, {
      rotulosSemDoisPontos: ROTULOS_SEM_DOIS_PONTOS,
    })) {
      const campo = par.rotulo === "MUNICIPIO"
        ? campoDoMunicipio(par)
        : ROTULO_PARA_CAMPO[par.rotulo] ?? null;
      // Primeiro valor vence: o formulário repete a identificação na via do
      // requerente, e a via da PF vem antes.
      if (campo && par.valor && !campos[campo]) campos[campo] = par.valor;
    }
  }

  const paginaArma = paginas.find((p) => textoDaPagina(p).includes("DADOS DA ARMA"));
  if (paginaArma) {
    for (const par of parearRotulosPorGeometria(paginaArma)) {
      // SÓ espécie e calibre. Todo o resto desta página é da EMPRESA e, por
      // decisão do produto, não é conferido contra o cadastro.
      if (par.rotulo === "ESPECIE" && par.valor && !campos.especie_arma) campos.especie_arma = par.valor;
      if (par.rotulo === "CALIBRE" && par.valor && !campos.calibre) campos.calibre = par.valor;
    }
  }

  // Datas saem em ISO para comparar com as colunas `date` do cadastro.
  campos.data_nascimento = dataBrParaIso(campos.data_nascimento) ?? "";
  campos.rg_expedicao = dataBrParaIso(campos.rg_expedicao) ?? "";

  return campos;
}

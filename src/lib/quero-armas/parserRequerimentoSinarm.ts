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

/* =============================================================================
 * Protocolo de PEDIDO de certidão ≠ CERTIDÃO (regra global, 15/08/2026)
 *
 * O portal do tribunal (e-SAJ/TJSP, e correlatos) devolve DOIS papéis com o
 * mesmo nome no título:
 *
 *   1) "Cadastro de Pedido de Certidão"  → comprovante de que o pedido entrou
 *      na fila. Traz "Modelo: CERTIDÃO DE EXECUÇÃO CRIMINAL", nome, CPF, RG,
 *      filiação e nascimento — tudo o que uma certidão traz, MENOS o que ela
 *      é: a declaração do cartório. Não certifica nada.
 *   2) a CERTIDÃO em si, liberada dias depois, que diz "CERTIFICO", "NADA
 *      CONSTAR", traz número de certidão e código de autenticidade.
 *
 * O caso Mizael (15/08/2026): o cliente enviou (1) no slot de Execuções
 * Criminais. Nenhum parser reconhecia o layout do pedido, então a decisão caiu
 * na leitura probabilística, que viu "TJSP + CERTIDÃO DE EXECUÇÃO CRIMINAL +
 * qualificação completa" e classificou como a certidão — com confiança alta.
 * A exigência do checklist foi dada por cumprida com um protocolo.
 *
 * A regra aqui é deliberadamente conservadora, para NUNCA reprovar certidão
 * boa:
 *   - marcador de PEDIDO  E  nenhum marcador de CERTIDÃO EMITIDA → protocolo
 *   - qualquer marcador de certidão emitida                      → segue o fluxo
 *
 * A segunda condição é o que protege as certidões reais: a do TJSP fecha com
 * "conforme indicação constante do pedido de certidão" — cita o pedido, mas
 * também diz "CERTIFICO" e "NADA CONSTAR".
 * ============================================================================= */

export interface ProtocoloCertidao {
  /** true só quando o arquivo é comprovadamente o PEDIDO, não a certidão. */
  ehProtocolo: boolean;
  /** Marcadores encontrados, em português, para a auditoria de leitura. */
  marcadores: string[];
  /** Número do pedido/protocolo, como impresso. */
  numero_pedido?: string;
  /** Data do pedido (DD/MM/AAAA, como impressa). */
  data_pedido?: string;
  /** Modelo de certidão pedido ("CERTIDÃO DE EXECUÇÃO CRIMINAL"). */
  modelo_solicitado?: string;
}

/**
 * Higieniza antes de detectar: URL, e-mail e acentuação não podem influenciar
 * o veredicto. Mesmo tratamento de `escopoCertidao.ts`.
 */
function achatar(texto: string): string {
  return String(texto || "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/\S+@\S+\.\S+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** O arquivo é o COMPROVANTE DO PEDIDO quando qualquer um destes aparece. */
const MARCADORES_PEDIDO: { re: RegExp; nome: string }[] = [
  { re: /CADASTRO DE PEDIDO DE CERTIDAO/, nome: "cadastro de pedido de certidão" },
  { re: /RESUMO DO PEDIDO/, nome: "resumo do pedido" },
  { re: /N(?:UMERO|[º°.])?\s*DO PEDIDO/, nome: "número do pedido" },
  { re: /DATA DO PEDIDO/, nome: "data do pedido" },
  { re: /DADOS PARA (?:A )?EMISSAO DA CERTIDAO/, nome: "dados para emissão da certidão" },
  { re: /PEDIDO FOI (?:CADASTRAD|REGISTRAD|RECEBID|EFETUAD)[AO]/, nome: "pedido cadastrado com sucesso" },
  { re: /PARA (?:A )?(?:POSTERIOR )?EMISSAO DA CERTIDAO/, nome: "emissão da certidão ainda por fazer" },
  { re: /PRAZO (?:MAXIMO )?PARA (?:A )?LIBERACAO DA CERTIDAO/, nome: "prazo para liberação da certidão" },
  { re: /(?:COMPROVANTE|PROTOCOLO|RECIBO) DE (?:SOLICITACAO|PEDIDO|REQUERIMENTO)/, nome: "comprovante de solicitação" },
  { re: /SOLICITACAO DE CERTIDAO (?:REGISTRAD|RECEBID|EFETUAD)[AO]/, nome: "solicitação de certidão registrada" },
  { re: /CERTIDAO (?:SERA|ESTARA) (?:DISPONIBILIZADA|DISPONIVEL|ENVIADA|LIBERADA|EMITIDA)/, nome: "certidão ainda será liberada" },
  { re: /(?:SERAO|SERA) ENCAMINHAD[AO]S? INSTRUCOES/, nome: "instruções serão enviadas por e-mail" },
  { re: /AGUARDE[^.]{0,60}(?:LIBERACAO|PROCESSAMENTO|EMISSAO)/, nome: "aviso para aguardar o processamento" },
];

/**
 * O arquivo é a CERTIDÃO EMITIDA quando qualquer um destes aparece.
 *
 * Basta UM para desligar a trava: certidão de verdade sempre declara algo —
 * certifica, informa o resultado da busca, ou traz número/código de
 * autenticidade. Protocolo nenhum traz isso.
 */
const MARCADORES_CERTIDAO_EMITIDA: RegExp[] = [
  /CERTIFIC(?:O|A|AM|AMOS|OU)\b/,
  /\bDA FE\b/,
  /CERTIDAO N[º°.:]/,
  /NADA CONSTA(?:R|M)?/,
  /NAO CONSTA(?:M|R)?/,
  /CONSTAR CONTRA/,
  /NAO (?:FOI |FORAM )?(?:LOCALIZAD|ENCONTRAD)[AO]S?/,
  /NEGATIV[AO] DE ANTECEDENTES/,
  /CODIGO DE (?:SEGURANCA|AUTENTICACAO|AUTENTICIDADE|VALIDACAO)/,
  /AUTENTICIDADE DEST[AE]/,
  /ASSINAD[AO] (?:DIGITAL|ELETRONICA)MENTE/,
  /CERTIDAO EMITIDA EM/,
  /VALIDA POR \d{1,3} DIAS/,
];

const g = (t: string, re: RegExp): string | undefined => t.match(re)?.[1]?.trim() || undefined;

/**
 * Leitura determinística do comprovante de pedido.
 *
 * Nada é inferido: campo que o papel não imprime volta `undefined`.
 */
export function detectarProtocoloCertidao(texto: string): ProtocoloCertidao {
  const t = achatar(texto);
  if (!t) return { ehProtocolo: false, marcadores: [] };

  const marcadores = MARCADORES_PEDIDO.filter(({ re }) => re.test(t)).map(({ nome }) => nome);
  if (marcadores.length === 0) return { ehProtocolo: false, marcadores: [] };

  // A certidão emitida tem precedência absoluta: o pedido pode ser citado
  // dentro dela ("conforme indicação constante do pedido de certidão").
  const ehCertidaoEmitida = MARCADORES_CERTIDAO_EMITIDA.some((re) => re.test(t));
  if (ehCertidaoEmitida) return { ehProtocolo: false, marcadores };

  return {
    ehProtocolo: true,
    marcadores,
    numero_pedido: g(t, /N(?:UMERO|[º°.])?\s*DO PEDIDO\s*:?\s*([0-9.\-\/]{4,30})/),
    data_pedido: g(t, /DATA DO PEDIDO\s*:?\s*(\d{2}\/\d{2}\/\d{4})/),
    modelo_solicitado: g(t, /MODELO\s*:?\s*([A-Z0-9ºª\s\-\/]{4,80}?)\s*(?:NOME COMPLETO|PESSOA|DOCUMENTOS|$)/),
  };
}

/** Atalho para os gates: verdadeiro só quando o arquivo é o pedido. */
export function ehProtocoloDeCertidao(texto: string): boolean {
  return detectarProtocoloCertidao(texto).ehProtocolo;
}

/**
 * Mensagem de recusa no vocabulário do cliente: diz o que ele mandou, por que
 * não serve e qual é o próximo passo concreto.
 */
export function mensagemProtocoloCertidao(texto: string): string {
  const p = detectarProtocoloCertidao(texto);
  const identificacao = [
    p.numero_pedido ? `nº ${p.numero_pedido}` : "",
    p.data_pedido ? `de ${p.data_pedido}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const modelo = p.modelo_solicitado ? ` (${p.modelo_solicitado.trim()})` : "";
  return (
    `Você enviou o COMPROVANTE DO PEDIDO da certidão${identificacao ? ` ${identificacao}` : ""}${modelo}, ` +
    `não a certidão. O protocolo apenas registra que o pedido entrou na fila do tribunal — ` +
    `ele não certifica nada e a Polícia Federal não o aceita. ` +
    `Aguarde o e-mail de liberação do tribunal (até 5 dias), baixe a CERTIDÃO emitida ` +
    `— a que traz "CERTIFICO", o resultado da busca e o código de autenticidade — e envie esse PDF aqui.`
  );
}

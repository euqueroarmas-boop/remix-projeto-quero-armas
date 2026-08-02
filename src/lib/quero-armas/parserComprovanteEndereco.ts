/* =============================================================================
 * Parser do comprovante de endereço — UF a partir do documento, sem IA
 *
 * Por que existe: a UF do comprovante de endereço é a que manda (regra do
 * usuário, 31/07/2026). É ela que decide qual TRF e qual tribunal estadual
 * cobrem o cliente. Até aqui essa UF vinha do CADASTRO (`qa_clientes.estado`)
 * ou de um campo de texto livre lido por IA — nenhum dos dois é o documento.
 *
 * Como a UF é determinada, em ordem:
 *
 *   1. FAIXA DE CEP. É tabela fixa dos Correios, não interpretação. O CEP
 *      aparece impresso em toda fatura de concessionária.
 *   2. UF ESCRITA no documento ("SÃO PAULO - SP", "/SP"), usada como
 *      CONFERÊNCIA CRUZADA.
 *
 * Se as duas existem e DIVERGEM, o resultado é `null` com o motivo — não se
 * escolhe uma. Divergência entre CEP e UF impressa significa documento
 * adulterado, endereço remontado ou leitura ruim, e qualquer uma das três
 * derruba o processo na PF.
 *
 * Princípio herdado de `parsersCertidoes.ts`: nada é inferido. Não achou,
 * volta `undefined` — nunca um palpite.
 * ============================================================================= */

const norm = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

/**
 * Faixas de CEP por UF (Correios).
 *
 * Estados com faixa descontínua aparecem mais de uma vez de propósito: o
 * Distrito Federal e Goiás se intercalam, e o Amazonas é cortado ao meio por
 * Roraima. Achatar isso num intervalo único trocaria as UFs na fronteira.
 *
 * A faixa 78900–78999 ficou de FORA porque foi renumerada (era Rondônia,
 * hoje 768xx) e as fontes divergem sobre o uso atual. CEP que caia ali volta
 * `undefined` — preferimos não determinar a determinar errado.
 */
const FAIXAS_CEP: Array<{ de: number; ate: number; uf: string }> = [
  { de: 1000,  ate: 19999, uf: "SP" },
  { de: 20000, ate: 28999, uf: "RJ" },
  { de: 29000, ate: 29999, uf: "ES" },
  { de: 30000, ate: 39999, uf: "MG" },
  { de: 40000, ate: 48999, uf: "BA" },
  { de: 49000, ate: 49999, uf: "SE" },
  { de: 50000, ate: 56999, uf: "PE" },
  { de: 57000, ate: 57999, uf: "AL" },
  { de: 58000, ate: 58999, uf: "PB" },
  { de: 59000, ate: 59999, uf: "RN" },
  { de: 60000, ate: 63999, uf: "CE" },
  { de: 64000, ate: 64999, uf: "PI" },
  { de: 65000, ate: 65999, uf: "MA" },
  { de: 66000, ate: 68899, uf: "PA" },
  { de: 68900, ate: 68999, uf: "AP" },
  { de: 69000, ate: 69299, uf: "AM" },
  { de: 69300, ate: 69399, uf: "RR" },
  { de: 69400, ate: 69899, uf: "AM" },
  { de: 69900, ate: 69999, uf: "AC" },
  { de: 70000, ate: 72799, uf: "DF" },
  { de: 72800, ate: 72999, uf: "GO" },
  { de: 73000, ate: 73699, uf: "DF" },
  { de: 73700, ate: 76799, uf: "GO" },
  { de: 76800, ate: 76999, uf: "RO" },
  { de: 77000, ate: 77999, uf: "TO" },
  { de: 78000, ate: 78899, uf: "MT" },
  { de: 79000, ate: 79999, uf: "MS" },
  { de: 80000, ate: 87999, uf: "PR" },
  { de: 88000, ate: 89999, uf: "SC" },
  { de: 90000, ate: 99999, uf: "RS" },
];

const UFS = new Set([
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
]);

/** UF correspondente à faixa do CEP, ou `undefined` se fora das faixas. */
export function ufPorCep(cep: string | undefined): string | undefined {
  const d = String(cep ?? "").replace(/\D/g, "");
  if (d.length !== 8) return undefined;
  const prefixo = Number(d.slice(0, 5));
  return FAIXAS_CEP.find((f) => prefixo >= f.de && prefixo <= f.ate)?.uf;
}

/**
 * CEP impresso no documento, com 8 dígitos.
 *
 * Exige o separador (`00000-000` ou `00000.000`) ou o rótulo "CEP". Uma
 * sequência solta de 8 dígitos numa fatura é quase sempre outra coisa —
 * instalação, código de barras, matrícula.
 */
export function extrairCep(texto: string): string | undefined {
  const t = norm(texto);
  const comSeparador = t.match(/\b(\d{5})[-.\s](\d{3})\b/);
  if (comSeparador) return `${comSeparador[1]}${comSeparador[2]}`;
  const rotulado = t.match(/CEP[:\s]*(\d{5})[-.\s]?(\d{3})\b/i);
  if (rotulado) return `${rotulado[1]}${rotulado[2]}`;
  return undefined;
}

/**
 * UF escrita no documento.
 *
 * Só aceita as formas em que a sigla está inequivocamente ligada ao endereço:
 * depois de hífen, de barra ou de vírgula. Buscar "SP" solto acharia a sigla
 * dentro de qualquer palavra ou razão social.
 */
export function extrairUfEscrita(texto: string): string | undefined {
  const t = norm(texto).toUpperCase();
  const candidatos = [
    ...t.matchAll(/[-–/,]\s*([A-Z]{2})\b/g),
    ...t.matchAll(/\bUF[:\s]+([A-Z]{2})\b/g),
  ].map((m) => m[1]);
  const validos = candidatos.filter((u) => UFS.has(u));
  if (!validos.length) return undefined;
  // Vários candidatos válidos e discordantes: não escolhe. Quem decide é o CEP.
  return new Set(validos).size === 1 ? validos[0] : undefined;
}

export interface EnderecoComprovante {
  cep?: string;
  /** UF derivada da faixa de CEP. É esta que vale. */
  uf?: string;
  /** UF impressa no documento, quando encontrada. Serve de conferência. */
  uf_escrita?: string;
  /** `true` quando CEP e UF impressa concordam. */
  uf_confirmada: boolean;
}

export type ResultadoEndereco =
  | { ok: true; dados: EnderecoComprovante }
  | { ok: false; motivo: string; dados: EnderecoComprovante };

export interface ContaConsumoExtraida {
  tipo: "energia" | "agua" | "gas" | "internet" | "telefone_fixo";
  empresa_emissora: string;
  codigo_instalacao: string;
  data_emissao?: string;
}

/**
 * Reconhece contas de consumo diretamente na camada textual do PDF.
 *
 * Concessionárias de energia imprimem "Nota Fiscal/Conta de Energia Elétrica"
 * por exigência fiscal. Isso NÃO transforma a fatura em comprovante de renda:
 * no Hub ela continua sendo comprovante de residência. O parser local também
 * evita uma chamada de visão e mantém a UC como número estável do documento.
 */
export function parseContaConsumo(texto: string): ContaConsumoExtraida | null {
  const original = String(texto || "");
  const t = norm(original).toUpperCase();
  if (!t) return null;

  const tipo: ContaConsumoExtraida["tipo"] | null =
    /ENERGIA ELETRICA|CONTA DE ENERGIA|DISTRIBUICAO DE ENERGIA|CONSUMO KWH/.test(t) ? "energia"
    : /CONTA DE AGUA|SERVICO DE AGUA|CONSUMO M3/.test(t) ? "agua"
    : /CONTA DE GAS|DISTRIBUICAO DE GAS|CONSUMO DE GAS/.test(t) ? "gas"
    : /INTERNET FIXA|BANDA LARGA/.test(t) ? "internet"
    : /TELEFONE FIXO|TELEFONIA FIXA/.test(t) ? "telefone_fixo"
    : null;
  if (!tipo) return null;

  const empresa_emissora =
    /\bEDP\b|EDP SAO PAULO/.test(t) ? "EDP São Paulo Distribuição de Energia S.A."
    : /\bENEL\b/.test(t) ? "Enel Distribuição"
    : /\bCPFL\b/.test(t) ? "CPFL Energia"
    : /\bSABESP\b/.test(t) ? "Sabesp"
    : /\bLIGHT\b/.test(t) ? "Light"
    : /\bCEMIG\b/.test(t) ? "Cemig"
    : "Concessionária de serviço público";

  const rotulosUc = [
    /(?:N[ºO°.]?\s*(?:DA\s*)?)?(?:INSTALACAO|INSTALAÇÃO|UNIDADE\s+CONSUMIDORA|UC|MATRICULA|MATRÍCULA)\s*[:#-]?\s*(0[\d.\s-]{10,24})/i,
    /(?:CODIGO|CÓDIGO)\s+(?:DA\s+)?(?:INSTALACAO|INSTALAÇÃO|UC)\s*[:#-]?\s*(0?[\d.\s-]{8,24})/i,
    /\b(0\.\s*\d{3}\.\s*\d{3}\.\s*\d{3}\.\s*\d{3}-\s*\d{2})\b/,
  ];
  let codigo_instalacao = "";
  for (const rx of rotulosUc) {
    const candidato = rx.exec(original)?.[1]?.replace(/\D/g, "") || "";
    if (candidato.length >= 8 && candidato.length <= 18) {
      codigo_instalacao = candidato;
      break;
    }
  }

  const emissao = /(?:DATA\s+DE\s+)?EMISS[ÃA]O\s*[:\s-]*(\d{2}\/\d{2}\/\d{4})/i.exec(original)?.[1]
    || /EMITID[AO]\s+EM\s*[:\s-]*(\d{2}\/\d{2}\/\d{4})/i.exec(original)?.[1]
    || undefined;

  return { tipo, empresa_emissora, codigo_instalacao, data_emissao: emissao };
}

/**
 * Lê a UF do comprovante de endereço.
 *
 * Rejeita — e diz por quê — quando não dá para afirmar a UF com segurança.
 * Rejeitar aqui custa um reenvio; deixar passar custa o processo.
 */
export function parseComprovanteEndereco(texto: string): ResultadoEndereco {
  const cep = extrairCep(texto);
  const ufEscrita = extrairUfEscrita(texto);
  const uf = ufPorCep(cep);

  const dados: EnderecoComprovante = {
    cep,
    uf,
    uf_escrita: ufEscrita,
    uf_confirmada: !!uf && !!ufEscrita && uf === ufEscrita,
  };

  if (!cep) {
    return { ok: false, motivo: "Não foi possível localizar o CEP no comprovante.", dados };
  }
  if (!uf) {
    return {
      ok: false,
      motivo: `O CEP ${cep} não corresponde a nenhuma faixa conhecida dos Correios.`,
      dados,
    };
  }
  if (ufEscrita && ufEscrita !== uf) {
    return {
      ok: false,
      motivo:
        `Divergência no comprovante: o CEP ${cep} é de ${uf}, mas o documento diz ${ufEscrita}.`,
      dados,
    };
  }
  return { ok: true, dados };
}

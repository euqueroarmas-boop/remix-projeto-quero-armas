// ============================================================================
// notaFiscalXml.ts — leitura DETERMINÍSTICA do XML da nota fiscal
// ----------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO EXISTE (18/08/2026 — caso Gilson).
//
// O cliente emitiu a NF-e no Emissor do Sebrae, salvou o DANFE pelo botão
// "Compartilhar" do celular e o PDF chegou aqui SEM CAMADA DE TEXTO: cada letra
// virou traço vetorial. O arquivo é perfeito aos olhos e vazio para a máquina —
// nem o parser nem a IA conseguem ler uma única palavra, e o Hub devolvia
// "Salve de novo". O cliente ficou travado sem ter feito nada errado.
//
// A saída não é ensinar o cliente a imprimir de novo: é aceitar o XML.
//
// O XML **é** a nota fiscal. O DANFE é só o "Documento Auxiliar" — uma
// representação impressa. Quem tem valor fiscal é o XML assinado e autorizado
// pela SEFAZ. Recebendo o XML nós temos MAIS certeza do que teríamos lendo
// qualquer PDF: os campos vêm etiquetados pelo layout oficial, sem OCR, sem
// regex adivinhando coluna, sem IA. Daí a regra deste módulo:
//
//   NENHUM CAMPO É INFERIDO. Ou o valor está na tag do layout oficial, ou o
//   campo fica vazio. Nada aqui chuta.
//
// Travas de autenticidade, todas checadas antes de devolver a nota:
//   1. Chave de acesso com 44 dígitos e dígito verificador (módulo 11) válido.
//   2. Ambiente de PRODUÇÃO (tpAmb = 1). Nota de homologação é teste e traz
//      "SEM VALOR FISCAL" impresso — nunca pode comprovar ocupação lícita.
//   3. Protocolo de autorização de uso da SEFAZ (cStat 100 ou 150). Nota sem
//      protocolo, denegada ou cancelada é recusada com o motivo na tela.
//
// Suporta os dois documentos que chegam ao Hub:
//   - NF-e / NFC-e (modelo 55 / 65, SEFAZ estadual) — `nfeProc` / `NFe`;
//   - NFS-e padrão nacional (municipal) — `NFSe` / `DPS`.
// ============================================================================
import type { CamposCertidao } from "./parsersCertidoes";

export type ModeloNotaFiscalXml = "nfe" | "nfce" | "nfse";

export interface ItemNotaFiscalXml {
  numero: number;
  codigo?: string;
  descricao: string;
  ncm?: string;
  cfop?: string;
  unidade?: string;
  quantidade?: number;
  valorUnitario?: number;
  valorTotal?: number;
  /* ── Colunas fiscais que o DANFE imprime por item ── */
  /** Origem + CST/CSOSN, concatenados como o DANFE imprime (ex.: "0102"). */
  origemCst?: string;
  baseIcms?: number;
  valorIcms?: number;
  valorIpi?: number;
  aliquotaIcms?: number;
  aliquotaIpi?: number;
}

/**
 * Quadro CÁLCULO DO IMPOSTO do DANFE. Todos os valores vêm prontos de
 * `ICMSTot` — nenhum é somado por nós.
 */
export interface TotaisNotaFiscalXml {
  baseIcms?: number;
  valorIcms?: number;
  baseIcmsSt?: number;
  valorIcmsSt?: number;
  valorImportacao?: number;
  valorIcmsUfRemetente?: number;
  valorIcmsUfDestino?: number;
  valorFcpUfDestino?: number;
  valorPis?: number;
  valorCofins?: number;
  valorProdutos?: number;
  valorFrete?: number;
  valorSeguro?: number;
  valorDesconto?: number;
  outrasDespesas?: number;
  valorIpi?: number;
  /** Valor aproximado dos tributos (Lei da Transparência). */
  valorTributos?: number;
  valorTotal?: number;
}

export interface VolumesNotaFiscalXml {
  quantidade?: string;
  especie?: string;
  marca?: string;
  numeracao?: string;
  pesoBruto?: string;
  pesoLiquido?: string;
}

/** Quadro TRANSPORTADOR / VOLUMES TRANSPORTADOS. */
export interface TransporteNotaFiscalXml {
  /** Código do `modFrete`, cru. O rótulo é montado na impressão. */
  modalidadeFrete?: string;
  transportador?: ParteNotaFiscalXml;
  placa?: string;
  ufPlaca?: string;
  rntc?: string;
  volumes?: VolumesNotaFiscalXml;
}

export interface ParteNotaFiscalXml {
  /** CNPJ ou CPF, somente dígitos. */
  documento?: string;
  nome?: string;
  fantasia?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
}

export interface NotaFiscalXml {
  modelo: ModeloNotaFiscalXml;
  /** Rótulo humano do documento ("NF-e", "NFC-e", "NFS-e"). */
  rotulo: string;
  /** Chave de acesso, 44 dígitos (NF-e/NFC-e) ou 50 (NFS-e nacional). */
  chave: string;
  numero?: string;
  serie?: string;
  /** Emissão em ISO (YYYY-MM-DD). */
  dataEmissao?: string;
  /** Emissão completa, como veio no XML (com hora e fuso). */
  dataHoraEmissao?: string;
  competencia?: string;
  naturezaOperacao?: string;
  emitente: ParteNotaFiscalXml;
  destinatario: ParteNotaFiscalXml;
  itens: ItemNotaFiscalXml[];
  /** Soma dos produtos/serviços. */
  valorProdutos?: number;
  valorDesconto?: number;
  /** Valor total da nota (o que vale como faturamento). */
  valorTotal?: number;
  protocolo?: string;
  dataHoraProtocolo?: string;
  situacao?: string;
  informacoesComplementares?: string;
  municipioEmissor?: string;

  /* ── Só na NF-e / NFC-e, para imprimir o DANFE conforme o MOC ── */
  /** `tpNF`: "0" = entrada, "1" = saída. */
  tipoOperacao?: string;
  /** Data e hora de saída/entrada, como veio no XML. */
  dataHoraSaida?: string;
  /** Inscrição estadual do substituto tributário do emitente. */
  inscricaoEstadualSubstituto?: string;
  totais?: TotaisNotaFiscalXml;
  transporte?: TransporteNotaFiscalXml;
  /** Informações de interesse do Fisco (`infAdFisco`). */
  informacoesFisco?: string;
}

export type LeituraNotaFiscalXml =
  | { ok: true; nota: NotaFiscalXml }
  | { ok: false; motivo: string };

/* ── Utilidades ─────────────────────────────────────────────────────────── */

const digitos = (v?: string | null): string => String(v ?? "").replace(/\D/g, "");

const limpo = (v?: string | null): string | undefined => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s || undefined;
};

/**
 * O layout fiscal sempre escreve número com ponto decimal ("938.00"). O ramo
 * da vírgula existe só para XML de emissor que fugiu do padrão — nesse caso o
 * ponto é separador de milhar e a vírgula é o decimal.
 */
const numero = (v?: string | null): number | undefined => {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const normalizado = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : undefined;
};

/** `2026-08-17T14:40:35-03:00` → `2026-08-17`. Nunca reinterpreta o fuso. */
const isoData = (v?: string | null): string | undefined => {
  const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
};

/**
 * Dígito verificador da chave de acesso (módulo 11, pesos 2..9 da direita para
 * a esquerda). Vale para NF-e, NFC-e e NF3e — é o mesmo cálculo.
 */
export function chaveNfeValida(chave: string): boolean {
  const c = digitos(chave);
  if (c.length !== 44) return false;
  let peso = 2;
  let soma = 0;
  for (let i = 42; i >= 0; i--) {
    soma += Number(c[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
  return dv === Number(c[43]);
}

/**
 * Modelo da nota deduzido da CHAVE, e só dela.
 *
 * Existe porque o Golden Record guarda NFS-e e NF-e na mesma tabela e precisa
 * saber qual é qual — inclusive nas linhas antigas, gravadas antes de haver
 * coluna de modelo, onde a chave é a única evidência disponível.
 *
 * Regra: 44 dígitos é chave de NF-e / NFC-e (SEFAZ estadual); a chave da NFS-e
 * do padrão nacional tem 50. A migration
 * `20260819010000_nf_golden_record_modelo.sql` aplica ESTA MESMA regra em SQL —
 * as duas não podem divergir.
 */
export function modeloPelaChave(chave?: string | null): ModeloNotaFiscalXml {
  return digitos(chave).length === 44 ? "nfe" : "nfse";
}

/** O arquivo escolhido é um XML? (extensão ou MIME — celular varia). */
export function ehArquivoXml(f: { name?: string; type?: string } | null | undefined): boolean {
  if (!f) return false;
  if (/\.xml$/i.test(String(f.name ?? ""))) return true;
  return /(^|\/|\+)xml$/i.test(String(f.type ?? ""));
}

/* ── Navegação no DOM, ignorando o namespace ────────────────────────────── */

/** Filhos diretos com o nome local pedido. */
function filhos(el: Element | null | undefined, nome: string): Element[] {
  if (!el) return [];
  return Array.from(el.children).filter((c) => localName(c) === nome);
}

function localName(el: Element): string {
  return el.localName || el.tagName.replace(/^.*:/, "");
}

/** Primeiro descendente com o nome local pedido (busca em profundidade). */
function acha(el: Element | Document | null | undefined, nome: string): Element | null {
  if (!el) return null;
  const raiz = (el as Document).documentElement ?? (el as Element);
  if (!raiz) return null;
  if (raiz instanceof Element && localName(raiz) === nome) return raiz;
  const fila: Element[] = Array.from(raiz.children ?? []);
  while (fila.length) {
    const atual = fila.shift()!;
    if (localName(atual) === nome) return atual;
    fila.push(...Array.from(atual.children));
  }
  return null;
}

/** Texto do primeiro descendente com o nome local pedido. */
function txt(el: Element | null | undefined, nome: string): string | undefined {
  return limpo(acha(el, nome)?.textContent);
}

/** Texto do primeiro nome local encontrado, na ordem informada. */
function txtQualquer(el: Element | null | undefined, ...nomes: string[]): string | undefined {
  for (const n of nomes) {
    const v = txt(el, n);
    if (v) return v;
  }
  return undefined;
}

/** CNPJ ou CPF de um bloco (emitente, destinatário, prestador, tomador). */
function documentoDaParte(el: Element | null | undefined): string | undefined {
  const d = digitos(txt(el, "CNPJ") ?? txt(el, "CPF") ?? txt(el, "NIF"));
  return d || undefined;
}

/** Monta "Rua X, 117 - Complemento - Bairro" a partir do bloco de endereço. */
function logradouroCompleto(p: ParteNotaFiscalXml): string | undefined {
  const linha = [
    [p.logradouro, p.numero].filter(Boolean).join(", "),
    p.complemento,
    p.bairro,
  ]
    .filter(Boolean)
    .join(" - ");
  return limpo(linha);
}

/** Cidade/UF em uma linha só. */
export function municipioUf(p: ParteNotaFiscalXml): string | undefined {
  return limpo([p.municipio, p.uf].filter(Boolean).join("/"));
}

/** Endereço em uma linha, do jeito que vai para a conferência e para o PDF. */
export function enderecoEmLinha(p: ParteNotaFiscalXml): string | undefined {
  return limpo([logradouroCompleto(p), municipioUf(p)].filter(Boolean).join(" - "));
}

/* ── NF-e / NFC-e (modelo 55 / 65) ──────────────────────────────────────── */

function leParteNfe(el: Element | null): ParteNotaFiscalXml {
  const ender = acha(el, "enderEmit") ?? acha(el, "enderDest");
  return {
    documento: documentoDaParte(el),
    nome: txt(el, "xNome"),
    fantasia: txt(el, "xFant"),
    inscricaoEstadual: txt(el, "IE"),
    inscricaoMunicipal: txt(el, "IM"),
    logradouro: txt(ender, "xLgr"),
    numero: txt(ender, "nro"),
    complemento: txt(ender, "xCpl"),
    bairro: txt(ender, "xBairro"),
    municipio: txt(ender, "xMun"),
    uf: txt(ender, "UF"),
    cep: digitos(txt(ender, "CEP")) || undefined,
    telefone: digitos(txt(ender, "fone")) || undefined,
    email: txt(el, "email"),
  };
}

function leNfe(doc: Document): LeituraNotaFiscalXml {
  const infNFe = acha(doc, "infNFe");
  if (!infNFe) return { ok: false, motivo: "XML sem o bloco infNFe da nota fiscal eletrônica." };

  const ide = acha(infNFe, "ide");
  const mod = txt(ide, "mod") ?? "55";
  const modelo: ModeloNotaFiscalXml = mod === "65" ? "nfce" : "nfe";
  const rotulo = modelo === "nfce" ? "NFC-e" : "NF-e";

  // A chave está no atributo Id do infNFe ("NFe" + 44 dígitos). O protocolo
  // repete a mesma chave em chNFe — se as duas divergirem, o arquivo foi
  // montado à mão e não é a nota que a SEFAZ autorizou.
  const chaveId = digitos(infNFe.getAttribute("Id"));
  const infProt = acha(doc, "infProt");
  const chaveProt = digitos(txt(infProt, "chNFe"));
  const chave = chaveId || chaveProt;
  if (chave.length !== 44) {
    return { ok: false, motivo: "A chave de acesso da nota não tem os 44 dígitos exigidos." };
  }
  if (chaveProt && chaveProt !== chave) {
    return {
      ok: false,
      motivo: "A chave do protocolo não é a mesma chave da nota. Baixe o XML de novo no emissor.",
    };
  }
  if (!chaveNfeValida(chave)) {
    return { ok: false, motivo: "A chave de acesso da nota não passou na verificação de dígito." };
  }

  // Ambiente: 1 = produção, 2 = homologação. Nota de homologação é TESTE.
  const tpAmb = txt(ide, "tpAmb");
  if (tpAmb === "2") {
    return {
      ok: false,
      motivo:
        "Esta nota foi emitida em ambiente de HOMOLOGAÇÃO (teste) e não tem valor fiscal. Emita a nota em produção e envie o XML dela.",
    };
  }

  // Autorização de uso: 100 = autorizado, 150 = autorizado fora de prazo.
  const cStat = txt(infProt, "cStat");
  const xMotivo = txt(infProt, "xMotivo");
  if (!infProt) {
    return {
      ok: false,
      motivo:
        "Este XML é a nota antes do envio à SEFAZ: não tem protocolo de autorização. Baixe no emissor o XML da nota já autorizada (o arquivo que traz o protocolo).",
    };
  }
  if (cStat !== "100" && cStat !== "150") {
    return {
      ok: false,
      motivo: `A SEFAZ não autorizou o uso desta nota${
        xMotivo ? ` — situação: ${xMotivo}` : ""
      }. Só aceitamos nota autorizada.`,
    };
  }

  const total = acha(infNFe, "ICMSTot");
  const itens: ItemNotaFiscalXml[] = filhos(infNFe, "det").map((det, i) => {
    const prod = acha(det, "prod");
    // ICMS e IPI ficam cada um dentro do seu próprio bloco. O recorte importa:
    // PIS e COFINS também têm uma tag `CST`, e buscar solto traria o CST do
    // PIS para a coluna do ICMS.
    const icms = acha(det, "ICMS");
    const ipi = acha(det, "IPI");
    const origem = txt(icms, "orig");
    const cst = txtQualquer(icms, "CSOSN", "CST");
    return {
      numero: Number(det.getAttribute("nItem")) || i + 1,
      codigo: txt(prod, "cProd"),
      descricao: txt(prod, "xProd") ?? "",
      ncm: txt(prod, "NCM"),
      cfop: txt(prod, "CFOP"),
      unidade: txt(prod, "uCom"),
      quantidade: numero(txt(prod, "qCom")),
      valorUnitario: numero(txt(prod, "vUnCom")),
      valorTotal: numero(txt(prod, "vProd")),
      origemCst: [origem, cst].filter(Boolean).join("") || undefined,
      baseIcms: numero(txt(icms, "vBC")),
      valorIcms: numero(txt(icms, "vICMS")),
      aliquotaIcms: numero(txt(icms, "pICMS")),
      valorIpi: numero(txt(ipi, "vIPI")),
      aliquotaIpi: numero(txt(ipi, "pIPI")),
    };
  });

  const transp = acha(infNFe, "transp");
  const veiculo = acha(transp, "veicTransp");
  const volume = acha(transp, "vol");
  const transportadora = acha(transp, "transporta");

  const emitente = leParteNfe(acha(infNFe, "emit"));
  const destinatario = leParteNfe(acha(infNFe, "dest"));
  const dhEmi = txt(ide, "dhEmi") ?? txt(ide, "dEmi");

  return {
    ok: true,
    nota: {
      modelo,
      rotulo,
      chave,
      numero: txt(ide, "nNF"),
      serie: txt(ide, "serie"),
      dataEmissao: isoData(dhEmi),
      dataHoraEmissao: dhEmi,
      naturezaOperacao: txt(ide, "natOp"),
      emitente,
      destinatario,
      itens,
      valorProdutos: numero(txt(total, "vProd")),
      valorDesconto: numero(txt(total, "vDesc")),
      valorTotal: numero(txt(total, "vNF")) ?? numero(txt(total, "vProd")),
      protocolo: txt(infProt, "nProt"),
      dataHoraProtocolo: txt(infProt, "dhRecbto"),
      situacao: xMotivo,
      informacoesComplementares: txt(acha(infNFe, "infAdic"), "infCpl"),
      municipioEmissor: emitente.municipio,

      tipoOperacao: txt(ide, "tpNF"),
      dataHoraSaida: txt(ide, "dhSaiEnt") ?? txt(ide, "dSaiEnt"),
      inscricaoEstadualSubstituto: txt(acha(infNFe, "emit"), "IEST"),
      informacoesFisco: txt(acha(infNFe, "infAdic"), "infAdFisco"),
      totais: {
        baseIcms: numero(txt(total, "vBC")),
        valorIcms: numero(txt(total, "vICMS")),
        baseIcmsSt: numero(txt(total, "vBCST")),
        valorIcmsSt: numero(txt(total, "vST")),
        valorImportacao: numero(txt(total, "vII")),
        valorIcmsUfRemetente: numero(txt(total, "vICMSUFRemet")),
        valorIcmsUfDestino: numero(txt(total, "vICMSUFDest")),
        valorFcpUfDestino: numero(txt(total, "vFCPUFDest")),
        valorPis: numero(txt(total, "vPIS")),
        valorCofins: numero(txt(total, "vCOFINS")),
        valorProdutos: numero(txt(total, "vProd")),
        valorFrete: numero(txt(total, "vFrete")),
        valorSeguro: numero(txt(total, "vSeg")),
        valorDesconto: numero(txt(total, "vDesc")),
        outrasDespesas: numero(txt(total, "vOutro")),
        valorIpi: numero(txt(total, "vIPI")),
        valorTributos: numero(txt(total, "vTotTrib")),
        valorTotal: numero(txt(total, "vNF")),
      },
      transporte: {
        modalidadeFrete: txt(transp, "modFrete"),
        // A transportadora não usa bloco de endereço: o layout traz `xEnder`,
        // `xMun` e `UF` soltos dentro de `transporta`.
        transportador: transportadora
          ? {
              documento: documentoDaParte(transportadora),
              nome: txt(transportadora, "xNome"),
              inscricaoEstadual: txt(transportadora, "IE"),
              logradouro: txt(transportadora, "xEnder"),
              municipio: txt(transportadora, "xMun"),
              uf: txt(transportadora, "UF"),
            }
          : undefined,
        placa: txt(veiculo, "placa"),
        ufPlaca: txt(veiculo, "UF"),
        rntc: txt(veiculo, "RNTC"),
        volumes: volume
          ? {
              quantidade: txt(volume, "qVol"),
              especie: txt(volume, "esp"),
              marca: txt(volume, "marca"),
              numeracao: txt(volume, "nVol"),
              pesoBruto: txt(volume, "pesoB"),
              pesoLiquido: txt(volume, "pesoL"),
            }
          : undefined,
      },
    },
  };
}

/* ── NFS-e padrão nacional (municipal) ──────────────────────────────────── */

function leParteNfse(el: Element | null): ParteNotaFiscalXml {
  const ender = acha(el, "enderNac") ?? acha(el, "endNac") ?? acha(el, "end") ?? el;
  return {
    documento: documentoDaParte(el),
    nome: txtQualquer(el, "xNome", "xFant"),
    inscricaoMunicipal: txt(el, "IM"),
    logradouro: txt(ender, "xLgr"),
    numero: txt(ender, "nro"),
    complemento: txt(ender, "xCpl"),
    bairro: txt(ender, "xBairro"),
    municipio: txtQualquer(ender, "xMun", "xLocalidade"),
    uf: txt(ender, "UF"),
    cep: digitos(txt(ender, "CEP")) || undefined,
    telefone: digitos(txt(el, "fone")) || undefined,
    email: txt(el, "email"),
  };
}

function leNfse(doc: Document): LeituraNotaFiscalXml {
  const infNFSe = acha(doc, "infNFSe");
  const infDPS = acha(doc, "infDPS");
  const base = infNFSe ?? infDPS;
  if (!base) return { ok: false, motivo: "XML sem o bloco infNFSe da nota fiscal de serviços." };

  const chave = digitos(infNFSe?.getAttribute("Id") ?? txt(infNFSe, "chNFSe") ?? "");
  if (!chave) {
    return { ok: false, motivo: "A NFS-e do XML não traz chave de acesso." };
  }

  const tpAmb = txtQualquer(base, "tpAmb");
  if (tpAmb === "2") {
    return {
      ok: false,
      motivo:
        "Esta NFS-e foi emitida em ambiente de HOMOLOGAÇÃO (teste) e não tem valor fiscal. Envie o XML da nota emitida em produção.",
    };
  }

  // ── PRESTADOR: `emit` PRIMEIRO, `prest` como reserva ────────────────────
  // No padrão nacional a DPS (`infDPS/prest`) declara apenas o CNPJ e a
  // inscrição municipal de quem emite — nome, endereço e CEP são publicados
  // pelo sistema nacional em `infNFSe/emit`. Lendo `prest` primeiro, o
  // prestador saía sem nome e sem endereço, e a conferência de ocupação lícita
  // ficava sem o que confrontar.
  const prest = acha(infNFSe, "emit") ?? acha(infDPS, "prest");
  const toma = acha(infDPS, "toma") ?? acha(infNFSe, "toma");
  const serv = acha(base, "serv");
  const descricao = txtQualquer(serv, "xDescServ", "xDescricao");
  const dhEmi = txtQualquer(infDPS, "dhEmi") ?? txtQualquer(infNFSe, "dhProc");

  const valorLiquido =
    numero(txt(acha(infNFSe, "valores"), "vLiq")) ??
    numero(txt(acha(infDPS, "vServPrest"), "vServ")) ??
    numero(txtQualquer(base, "vServ"));

  return {
    ok: true,
    nota: {
      modelo: "nfse",
      rotulo: "NFS-e",
      chave,
      numero: txtQualquer(infNFSe, "nNFSe") ?? txtQualquer(infDPS, "nDPS"),
      serie: txtQualquer(infDPS, "serie"),
      dataEmissao: isoData(dhEmi),
      dataHoraEmissao: dhEmi,
      competencia: isoData(txtQualquer(infDPS, "dCompet")),
      naturezaOperacao: "Prestação de serviço",
      emitente: leParteNfse(prest),
      destinatario: leParteNfse(toma),
      itens: descricao
        ? [{ numero: 1, descricao, valorTotal: valorLiquido }]
        : [],
      valorProdutos: valorLiquido,
      valorTotal: valorLiquido,
      protocolo: txtQualquer(infNFSe, "nProt", "nDFSe"),
      dataHoraProtocolo: txtQualquer(infNFSe, "dhProc"),
      situacao: undefined,
      informacoesComplementares: descricao,
      municipioEmissor: txtQualquer(acha(infNFSe, "emit"), "xMun"),
    },
  };
}

/* ── Entrada pública ────────────────────────────────────────────────────── */

/**
 * Lê o XML de uma nota fiscal autorizada. Devolve o motivo em português quando
 * o arquivo não serve — a mensagem vai direto para a tela do cliente.
 */
export function lerNotaFiscalXml(xml: string): LeituraNotaFiscalXml {
  const bruto = String(xml ?? "").trim();
  if (!bruto) return { ok: false, motivo: "O arquivo XML está vazio." };

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(bruto, "application/xml");
  } catch {
    return { ok: false, motivo: "Não foi possível ler este arquivo XML." };
  }
  if (acha(doc, "parsererror")) {
    return { ok: false, motivo: "O arquivo XML está corrompido ou incompleto." };
  }

  if (acha(doc, "infNFe")) return leNfe(doc);
  if (acha(doc, "infNFSe") || acha(doc, "infDPS")) return leNfse(doc);

  return {
    ok: false,
    motivo:
      "Este XML não é de nota fiscal (NF-e ou NFS-e). Anexe o XML que o emissor gera junto com o DANFE.",
  };
}

/* ── Ponte com o restante do sistema ────────────────────────────────────── */

/** Formata a chave em blocos de 4, do jeito que o DANFE imprime. */
export function chaveFormatada(chave: string): string {
  return digitos(chave).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function moedaBr(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dataBr(iso?: string | null): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * Converte a nota lida no XML para o formato `CamposCertidao` que o Hub já
 * consome (conferência, Golden Record, painel de conformidade).
 *
 * O vocabulário do Hub nasceu na NFS-e, onde as partes se chamam PRESTADOR e
 * TOMADOR. Na NF-e de mercadoria elas se chamam EMITENTE e DESTINATÁRIO. É o
 * mesmo papel — quem emitiu a nota e quem a recebeu — e o mapeamento abaixo é
 * literalmente esse, sem nenhuma inferência.
 */
export function camposCertidaoDaNotaXml(nota: NotaFiscalXml): CamposCertidao {
  const itens = nota.itens.map((i) => ({
    descricao: i.descricao,
    quantidade: i.quantidade,
    preco: i.valorUnitario,
    total: i.valorTotal,
  }));
  const descricao =
    nota.itens
      .map((i) =>
        [
          i.descricao,
          i.quantidade != null ? `bruto: ${moedaBr(i.quantidade)}` : "",
          i.valorUnitario != null ? `preço: ${moedaBr(i.valorUnitario)}` : "",
          i.valorTotal != null ? `total: ${moedaBr(i.valorTotal)}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      )
      .join("; ") || undefined;

  return {
    orgao: "nota_fiscal",
    tipoDocumento: "renda_nf_empresa",
    numero_nf: nota.numero,
    cnpj: nota.emitente.documento,
    razao_social: nota.emitente.nome?.toUpperCase(),
    valor_nf: moedaBr(nota.valorTotal) || undefined,
    valor_liquido: moedaBr(nota.valorTotal) || undefined,
    chave_acesso: nota.chave,
    data_emissao: nota.dataEmissao,
    // Competência e DPS existem SÓ na NFS-e do padrão nacional. Preenchê-las a
    // partir de uma NF-e de mercadoria — usando a data de emissão como se
    // fosse competência, ou a série da nota como se fosse série da DPS —
    // fabricaria dado fiscal que a nota não tem.
    competencia: nota.modelo === "nfse" ? nota.competencia : undefined,
    serie_dps: nota.modelo === "nfse" ? nota.serie : undefined,
    municipio_emissor: nota.municipioEmissor?.toUpperCase(),

    prestador_inscricao_municipal: nota.emitente.inscricaoMunicipal,
    prestador_telefone: nota.emitente.telefone,
    prestador_email: nota.emitente.email?.toLowerCase(),
    prestador_endereco: enderecoEmLinha(nota.emitente)?.toUpperCase(),
    prestador_municipio: municipioUf(nota.emitente)?.toUpperCase(),
    prestador_cep: nota.emitente.cep,

    tomador_documento: nota.destinatario.documento,
    tomador_nome: nota.destinatario.nome?.toUpperCase(),
    tomador_inscricao_municipal: nota.destinatario.inscricaoMunicipal,
    tomador_telefone: nota.destinatario.telefone,
    tomador_email: nota.destinatario.email?.toLowerCase(),
    tomador_endereco: enderecoEmLinha(nota.destinatario)?.toUpperCase(),
    tomador_municipio: municipioUf(nota.destinatario)?.toUpperCase(),
    tomador_cep: nota.destinatario.cep,

    descricao_servico: descricao,
    itens_servico: itens.length ? itens : undefined,
    local_prestacao: municipioUf(nota.emitente)?.toUpperCase(),
  };
}

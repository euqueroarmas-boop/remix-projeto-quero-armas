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
    };
  });

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

  const prest = acha(infDPS, "prest") ?? acha(infNFSe, "emit");
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
    competencia: nota.competencia ?? nota.dataEmissao,
    serie_dps: nota.serie,
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

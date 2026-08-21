// ============================================================================
// AUTORIZAÇÃO DE COMPRA (SisGCorp) — parser local, conferência e amarrações
// ----------------------------------------------------------------------------
// Gabarito: os três dossiês DEFERIDOS entregues pelo titular em 20/08/2026
// (Eduardo Rizek 99234025002588, Rivelino Pereira 99234025002548 e Édson
// Campos 99181025026558). O formulário é o mesmo nos dois órgãos —
// "AUTORIZAÇÃO PARA AQUISIÇÃO DE PCE NO COMÉRCIO NACIONAL" — mudando só o
// cabeçalho e como a loja é identificada: a Polícia Federal usa CNPJ, o
// Exército usa Nº de Registro SIGMA. O prefixo do número acompanha o órgão
// (9918 = PF, 9923 = Exército).
//
// Este módulo NÃO usa IA: lê o texto embutido no PDF (os três deferidos têm
// texto de boa qualidade) e aplica o mesmo credo do motor de certidões —
// nada é inferido; campo ilegível fica vazio.
//
// Três amarrações que os dossiês ensinaram:
//   1. a autorização tem DONO — nome, CPF e CR do adquirente saem impressos,
//      então dá para conferir contra o cadastro antes de aceitar;
//   2. a GRU é FILHA da autorização — o número de referência da guia é o
//      próprio número da autorização (confirmado no código de barras dos
//      três dossiês); comprovante com referência de outro número é de outro
//      processo;
//   3. a validade é a JANELA DA COMPRA — 180 dias, e é dentro dela que a
//      nota fiscal e o registro precisam acontecer.
// ============================================================================

export type OrgaoAutorizacao = "policia_federal" | "exercito";

export interface CamposAutorizacaoCompra {
  numero_autorizacao: string;
  orgao: OrgaoAutorizacao | null;
  data_emissao: string | null;   // ISO aaaa-mm-dd
  data_validade: string | null;  // ISO aaaa-mm-dd
  adquirente_nome: string | null;
  adquirente_cpf: string | null; // só dígitos
  adquirente_cr: string | null;  // só dígitos
  acervo_utilizado: string | null;
  arma_produto: string | null;
  arma_marca: string | null;
  arma_modelo: string | null;
  arma_calibre: string | null;
  fornecedor_razao_social: string | null;
  fornecedor_cnpj: string | null;          // só dígitos (PF)
  fornecedor_registro_sigma: string | null; // só dígitos (Exército)
}

const soDigitos = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

const normNome = (v: unknown): string =>
  String(v ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();

const ddmmaaaaToISO = (s?: string | null): string | null => {
  const m = String(s ?? "").trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** O órgão pelo prefixo do número — 9918 = PF, 9923 = Exército. */
export function orgaoPeloNumero(numero: string): OrgaoAutorizacao | null {
  const d = soDigitos(numero);
  if (d.startsWith("9918")) return "policia_federal";
  if (d.startsWith("9923")) return "exercito";
  return null;
}

/** É o formulário do SisGCorp? Sem o título, este parser não opina. */
export function ehAutorizacaoCompra(texto: string): boolean {
  return /AUTORIZA[ÇC][ÃA]O\s+PARA\s+AQUISI[ÇC][ÃA]O\s+DE\s+PCE/i.test(texto);
}

/**
 * Lê o texto embutido do PDF da autorização. Devolve null quando o documento
 * não é o formulário do SisGCorp ou quando nem o número dá para ler — sem
 * número não há âncora, e âncora inventada é pior que nenhuma.
 */
export function parseAutorizacaoCompra(texto: string): CamposAutorizacaoCompra | null {
  if (!ehAutorizacaoCompra(texto)) return null;
  const t = texto.replace(/\r/g, "");

  const numero = t.match(/Autoriza[çc][ãa]o\s+N[ºo°]?\s*:?\s*(\d{10,16})/i)?.[1] ?? "";
  if (!numero) return null;

  // O órgão: primeiro o cabeçalho, depois o prefixo do número como reserva.
  let orgao: OrgaoAutorizacao | null = null;
  if (/POL[ÍI]CIA\s+FEDERAL/i.test(t) && !/EX[ÉE]RCITO\s+BRASILEIRO/i.test(t)) orgao = "policia_federal";
  else if (/EX[ÉE]RCITO\s+BRASILEIRO/i.test(t)) orgao = "exercito";
  if (!orgao) orgao = orgaoPeloNumero(numero);

  // Seções: o fornecedor tem rótulos parecidos com os do adquirente (CNPJ x
  // CPF/CNPJ), então o texto é fatiado na seção 4 antes de qualquer regex.
  const iFornecedor = t.search(/4\.\s*FORNECEDOR/i);
  const cabeca = iFornecedor > -1 ? t.slice(0, iFornecedor) : t;
  const cauda  = iFornecedor > -1 ? t.slice(iFornecedor) : "";

  const nome = cabeca.match(/Nome\/Raz[ãa]o Social:\s*\n?\s*([^\n]+)/i)?.[1]?.trim() ?? null;
  const cpf  = soDigitos(cabeca.match(/CPF\/CNPJ:\s*\n?\s*([\d.\-/\s]{11,20})/i)?.[1]) || null;
  const cr   = soDigitos(cabeca.match(/\bCR:\s*\n?\s*([\d.\-\s]{6,15})/i)?.[1]) || null;
  const acervo = cabeca.match(/\(X\)\s*([^\n]+)/)?.[1]?.trim() ?? null;

  const emissao  = ddmmaaaaToISO(cabeca.match(/Data de Emiss[ãa]o:\s*\n?\s*([\d/]+)/i)?.[1]);
  const validade = ddmmaaaaToISO(cabeca.match(/Data de Validade:\s*\n?\s*([\d/]+)/i)?.[1]);

  // A arma. Alguns PDFs embaralham a ordem das colunas da tabela; marca e
  // modelo são pescados por vocabulário conhecido, sem inventar.
  // Sem \b de propósito: o PDF da PF cola as colunas da tabela
  // ("1380 AutomaticG25GLOCKPISTOLA"), e entre dígito e letra não há borda
  // de palavra. O vocabulário é específico o bastante para dispensar a borda.
  const marca  = cabeca.match(/(GLOCK|TAURUS|CBC|IMBEL|SIG\s*SAUER|BERETTA|SPRINGFIELD|SMITH\s*&?\s*WESSON)/i)?.[1]?.toUpperCase().replace(/\s+/g, " ") ?? null;
  const produto = cabeca.match(/(PISTOLA|REVOLVER|REV[ÓO]LVER|CARABINA|ESPINGARDA|FUZIL|RIFLE)/i)?.[1]?.toUpperCase() ?? null;
  const modelo  = cabeca.match(/(G\d{2}X?|G2C|G3C?|TS9|TH\d{2}|PT\d{2,3}|RT\s?\d{3})/)?.[1]?.replace(/\s+/g, "") ?? null;
  const calibre = cabeca.match(/(\.?\d{1,2}[.,]?\d{0,3}\s*(?:Automatic|ACP|AUTO)|9\s*mm|\.38\b|\.40\b|\.45\b|380|556|762)/i)?.[1]?.trim() ?? null;

  const razao = cauda.match(/Raz[ãa]o social:\s*\n?\s*([^\n]+)/i)?.[1]?.trim() ?? null;
  const cnpjFornecedor = soDigitos(cauda.match(/(?:^|\n|\s)CNPJ:\s*\n?\s*([\d.\-/\s]{14,22})/i)?.[1]) || null;
  const sigma = soDigitos(cauda.match(/Registro SIGMA:\s*\n?\s*(\d{4,12})/i)?.[1]) || null;

  return {
    numero_autorizacao: numero,
    orgao,
    data_emissao: emissao,
    data_validade: validade,
    adquirente_nome: nome,
    adquirente_cpf: cpf && cpf.length === 11 ? cpf : null,
    adquirente_cr: cr,
    acervo_utilizado: acervo,
    arma_produto: produto,
    arma_marca: marca,
    arma_modelo: modelo,
    arma_calibre: calibre,
    fornecedor_razao_social: razao,
    fornecedor_cnpj: cnpjFornecedor && cnpjFornecedor.length === 14 ? cnpjFornecedor : null,
    fornecedor_registro_sigma: sigma,
  };
}

// ── Conferência: a autorização é deste cliente? ─────────────────────────────

export type VeredictoAutorizacao = "aprovado" | "rejeitado" | "cadastro_pendente";

export interface ResultadoConferenciaAutorizacao {
  veredicto: VeredictoAutorizacao;
  motivos: string[];
}

export interface CadastroParaConferencia {
  nome_completo?: string | null;
  cpf?: string | null;
  numero_cr?: string | null;
}

/**
 * Binária, no mesmo credo do motor de certidões: divergiu, rejeita e diz
 * onde; falta dado NO CADASTRO, a ação é preencher o cadastro — não se
 * rejeita documento por falha nossa.
 */
export function conferirAutorizacaoCompra(
  campos: CamposAutorizacaoCompra,
  cadastro: CadastroParaConferencia,
): ResultadoConferenciaAutorizacao {
  const motivos: string[] = [];
  let pendencias = 0;

  const cpfDoc = campos.adquirente_cpf ?? "";
  const cpfCad = soDigitos(cadastro.cpf);
  if (cpfDoc && cpfCad) {
    if (cpfDoc !== cpfCad) {
      motivos.push(
        `O CPF impresso na autorização (${cpfDoc}) não é o CPF deste cliente — ` +
        "isto costuma ser autorização anexada na pasta errada.",
      );
    }
  } else if (cpfDoc && !cpfCad) {
    motivos.push("Falta o CPF no cadastro para conferir com a autorização.");
    pendencias++;
  }

  const nomeDoc = normNome(campos.adquirente_nome);
  const nomeCad = normNome(cadastro.nome_completo);
  if (nomeDoc && nomeCad && nomeDoc !== nomeCad) {
    motivos.push(
      `O nome impresso na autorização ("${campos.adquirente_nome}") não confere ` +
      "com o nome do cadastro.",
    );
  }

  const crDoc = campos.adquirente_cr ?? "";
  const crCad = soDigitos(cadastro.numero_cr);
  if (crDoc && crCad && crDoc !== crCad) {
    motivos.push(
      `O nº de CR impresso na autorização (${crDoc}) não é o CR deste cliente (${crCad}).`,
    );
  } else if (crDoc && !crCad) {
    motivos.push("Falta o nº do CR no cadastro para conferir com a autorização.");
    pendencias++;
  }

  const rejeicoes = motivos.length - pendencias;
  if (rejeicoes > 0) return { veredicto: "rejeitado", motivos };
  if (pendencias > 0) return { veredicto: "cadastro_pendente", motivos };
  return { veredicto: "aprovado", motivos: [] };
}

// ── GRU: a guia é filha da autorização ──────────────────────────────────────

/**
 * `true` se o texto da GRU (ou do comprovante de pagamento) referencia esta
 * autorização. O número de referência da guia É o número da autorização; no
 * código de barras ele aparece sem os três primeiros dígitos — os dois
 * formatos reais dos dossiês deferidos são aceitos.
 */
export function gruPertenceAAutorizacao(textoGru: string, numeroAutorizacao: string): boolean {
  const num = soDigitos(numeroAutorizacao);
  if (num.length < 10) return false;
  const alvo = soDigitos(textoGru);
  return alvo.includes(num) || alvo.includes(num.slice(3));
}

// ── A janela dos 180 dias ───────────────────────────────────────────────────

export interface JanelaAutorizacao {
  dias_restantes: number;
  vencida: boolean;
}

/** Quantos dias restam para comprar e registrar dentro da validade. */
export function janelaAutorizacao(
  dataValidadeISO: string | null | undefined,
  hoje: Date = new Date(),
): JanelaAutorizacao | null {
  if (!dataValidadeISO || !/^\d{4}-\d{2}-\d{2}$/.test(dataValidadeISO)) return null;
  const validade = new Date(`${dataValidadeISO}T23:59:59`);
  const dias = Math.floor((validade.getTime() - hoje.getTime()) / 86_400_000);
  return { dias_restantes: dias, vencida: dias < 0 };
}

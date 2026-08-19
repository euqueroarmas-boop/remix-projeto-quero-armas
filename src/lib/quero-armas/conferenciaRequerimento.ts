/* =============================================================================
 * Conferência do requerimento da PF contra o cadastro
 *
 * Por que este documento tem conferência PRÓPRIA
 * ----------------------------------------------
 * Todo o resto do dossiê é emitido por órgão: a certidão, o laudo, o cartão
 * CNPJ. O requerimento não — cada campo dele foi DIGITADO à mão pelo cliente no
 * portal da Polícia Federal. É o único ponto do processo onde o erro humano
 * entra sem passar por nenhum órgão emissor.
 *
 * E é o documento que a PF usa como espelho: ela confere o que foi digitado
 * contra os documentos anexados e indefere na divergência. Por isso aqui a
 * comparação é CAMPO A CAMPO, contra o cadastro, e não só nome e CPF.
 *
 * O que NÃO é conferido, por decisão do produto
 * --------------------------------------------
 * Os dados da EMPRESA em que o cliente trabalha (CNPJ, razão social e endereço
 * do empregador). Vínculo empregatício muda sem que o cadastro acompanhe, e
 * acusar divergência nisso reprovaria requerimento correto. Esses campos nem
 * chegam a ser lidos — ver `lerCamposRequerimentoPorGeometria`.
 *
 * A normalização aplicada é só a que o próprio órgão ignora: acento, caixa,
 * pontuação e máscara. Diferença de conteúdo é divergência, e aparece.
 * ============================================================================= */

import type { CamposRequerimentoPF } from "./parserRequerimentoSinarm";

export type StatusConferenciaRequerimento = "conforme" | "divergente" | "sem_referencia";

/** Mesmo formato dos itens de conformidade do Hub — renderiza no mesmo painel. */
export interface ItemConferenciaRequerimento {
  campo: string;
  label: string;
  valorCertidao: string;
  valorReferencia: string | null;
  fonteReferencia: string | null;
  status: StatusConferenciaRequerimento;
}

/** Colunas de `qa_clientes` que espelham o formulário da PF. */
export interface CadastroParaRequerimento {
  nome_completo?: string | null;
  cpf?: string | null;
  nome_mae?: string | null;
  nome_pai?: string | null;
  data_nascimento?: string | null;
  sexo?: string | null;
  estado_civil?: string | null;
  naturalidade_pais?: string | null;
  naturalidade_uf?: string | null;
  naturalidade_municipio?: string | null;
  rg?: string | null;
  emissor_rg?: string | null;
  uf_emissor_rg?: string | null;
  expedicao_rg?: string | null;
  titulo_eleitor?: string | null;
  profissao?: string | null;
  email?: string | null;
  celular?: string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

const FONTE = "Cadastro do cliente";

function texto(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function alfanumerico(v: unknown): string {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function digitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

function iso(v: unknown): string {
  const s = String(v ?? "").trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return s.slice(0, 10);
}

/** Celular do cadastro pode vir com DDI; comparamos pelos 11 dígitos finais. */
function telefone(v: unknown): string {
  const d = digitos(v);
  return d.length > 11 ? d.slice(-11) : d;
}

const UFS: Record<string, string> = {
  ACRE: "AC", ALAGOAS: "AL", AMAPA: "AP", AMAZONAS: "AM", BAHIA: "BA",
  CEARA: "CE", "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES", GOIAS: "GO",
  MARANHAO: "MA", "MATO GROSSO": "MT", "MATO GROSSO DO SUL": "MS",
  "MINAS GERAIS": "MG", PARA: "PA", PARAIBA: "PB", PARANA: "PR",
  PERNAMBUCO: "PE", PIAUI: "PI", "RIO DE JANEIRO": "RJ",
  "RIO GRANDE DO NORTE": "RN", "RIO GRANDE DO SUL": "RS", RONDONIA: "RO",
  RORAIMA: "RR", "SANTA CATARINA": "SC", "SAO PAULO": "SP", SERGIPE: "SE",
  TOCANTINS: "TO",
};

/** "São Paulo" e "SP" são a mesma unidade federativa. */
function uf(v: unknown): string {
  const t = texto(v);
  if (/^[A-Z]{2}$/.test(t)) return t;
  return UFS[t] ?? t;
}

/**
 * Estado civil sem o gênero: o formulário da PF imprime "Casado" e o cadastro
 * pode guardar "CASADA". É o mesmo estado civil — não é divergência.
 */
function estadoCivil(v: unknown): string {
  const t = texto(v);
  for (const raiz of ["SOLTEIR", "CASAD", "DIVORCIAD", "VIUV", "SEPARAD", "DESQUITAD"]) {
    if (t.startsWith(raiz)) return raiz;
  }
  if (t.startsWith("UNIAO")) return "UNIAO ESTAVEL";
  return t;
}

const ABREVIACOES_LOGRADOURO: Array<[RegExp, string]> = [
  [/^R\b/, "RUA"], [/^AV\b/, "AVENIDA"], [/^AL\b/, "ALAMEDA"], [/^TV\b/, "TRAVESSA"],
  [/^PC\b/, "PRACA"], [/^ROD\b/, "RODOVIA"], [/^EST\b/, "ESTRADA"], [/^JD\b/, "JARDIM"],
];

/** "R. do Horto" e "RUA DO HORTO" são o mesmo logradouro. */
function logradouro(v: unknown): string {
  let t = texto(v);
  for (const [re, cheio] of ABREVIACOES_LOGRADOURO) t = t.replace(re, cheio);
  return t;
}

/** Sexo: só a inicial importa ("Masculino" x "M"). */
function sexo(v: unknown): string {
  return texto(v).charAt(0);
}

type Comparador = (documento: string, cadastro: string) => boolean;

interface DefinicaoCampo {
  campo: keyof CamposRequerimentoPF;
  label: string;
  coluna?: keyof CadastroParaRequerimento;
  normalizar: (v: unknown) => string;
  /**
   * Mostra os dois valores lado a lado, mas NUNCA acusa divergência. Serve para
   * campo em que os dois lados guardam coisas de naturezas diferentes: comparar
   * seria acusar todo mundo de errado.
   */
  apenasInformativo?: boolean;
}

/**
 * A ordem é a mesma do formulário impresso — quem confere na tela lê de cima
 * para baixo com o papel do lado.
 */
const CAMPOS: DefinicaoCampo[] = [
  { campo: "nome_completo",          label: "Nome completo",           coluna: "nome_completo",          normalizar: texto },
  { campo: "cpf",                    label: "CPF",                     coluna: "cpf",                    normalizar: digitos },
  { campo: "nome_mae",               label: "Nome da mãe",             coluna: "nome_mae",               normalizar: texto },
  { campo: "nome_pai",               label: "Nome do pai",             coluna: "nome_pai",               normalizar: texto },
  { campo: "data_nascimento",        label: "Data de nascimento",      coluna: "data_nascimento",        normalizar: iso },
  { campo: "sexo",                   label: "Sexo",                    coluna: "sexo",                   normalizar: sexo },
  { campo: "estado_civil",           label: "Estado civil",            coluna: "estado_civil",           normalizar: estadoCivil },
  { campo: "naturalidade_pais",      label: "País de nascimento",      coluna: "naturalidade_pais",      normalizar: texto },
  { campo: "naturalidade_uf",        label: "UF de nascimento",        coluna: "naturalidade_uf",        normalizar: uf },
  { campo: "naturalidade_municipio", label: "Município de nascimento", coluna: "naturalidade_municipio", normalizar: texto },
  { campo: "rg",                     label: "Número do RG",            coluna: "rg",                     normalizar: alfanumerico },
  { campo: "rg_orgao",               label: "Órgão expedidor do RG",   coluna: "emissor_rg",             normalizar: texto },
  { campo: "rg_uf",                  label: "UF expedidora do RG",     coluna: "uf_emissor_rg",          normalizar: uf },
  { campo: "rg_expedicao",           label: "Data de expedição do RG", coluna: "expedicao_rg",           normalizar: iso },
  { campo: "titulo_eleitor",         label: "Título de eleitor",       coluna: "titulo_eleitor",         normalizar: digitos },
  // PROFISSÃO NÃO SE COMPARA — e a razão é estrutural, não preguiça.
  // No cadastro a profissão vem de uma LISTA FECHADA, com o nome da categoria
  // ("SERVIDOR DE SEGURANÇA PÚBLICA (PM, PC, PF, PRF, GUARDA, BOMBEIRO,
  // AGENTE PENITENCIÁRIO)"). No formulário da PF o cliente digita o CARGO
  // ("CABO DA POLICIA MILITAR"). Os dois estão certos e nunca vão bater —
  // comparar reprovaria todo policial, todo bombeiro e todo guarda do sistema.
  // Fica na tela, lado a lado, para a equipe olhar; não reprova ninguém.
  { campo: "profissao",              label: "Profissão",               coluna: "profissao",              normalizar: texto, apenasInformativo: true },
  { campo: "email",                  label: "E-mail",                  coluna: "email",                  normalizar: texto },
  { campo: "celular",                label: "Telefone celular",        coluna: "celular",                normalizar: telefone },
  { campo: "cep",                    label: "CEP",                     coluna: "cep",                    normalizar: digitos },
  { campo: "logradouro",             label: "Logradouro",              coluna: "endereco",               normalizar: logradouro },
  { campo: "numero",                 label: "Número",                  coluna: "numero",                 normalizar: texto },
  { campo: "complemento",            label: "Complemento",             coluna: "complemento",            normalizar: texto },
  { campo: "bairro",                 label: "Bairro",                  coluna: "bairro",                 normalizar: texto },
  { campo: "cidade",                 label: "Município",               coluna: "cidade",                 normalizar: texto },
  { campo: "uf",                     label: "UF",                      coluna: "estado",                 normalizar: uf },
  // Sem coluna no cadastro: entram como informação lida, nunca como divergência.
  { campo: "tipo_endereco",          label: "Tipo de endereço",        normalizar: texto },
  { campo: "aposentado",             label: "Aposentado",              normalizar: texto },
  { campo: "especie_arma",           label: "Espécie da arma",         normalizar: texto },
  { campo: "calibre",                label: "Calibre",                 normalizar: texto },
];

/**
 * Confronta o requerimento com o cadastro, campo a campo.
 *
 * Campo em branco no documento não entra: o cliente pode não ter preenchido um
 * opcional, e ausência não é divergência. Campo sem dado no cadastro entra como
 * "sem referência" — o dado aparece na tela, mas não reprova ninguém.
 */
export function conferirRequerimentoContraCadastro(
  campos: CamposRequerimentoPF,
  cadastro: CadastroParaRequerimento,
): ItemConferenciaRequerimento[] {
  const itens: ItemConferenciaRequerimento[] = [];

  for (const def of CAMPOS) {
    const valorDoc = String(campos[def.campo] ?? "").trim();
    if (!valorDoc) continue;

    const valorRef = def.coluna ? String(cadastro[def.coluna] ?? "").trim() : "";
    if (!valorRef) {
      itens.push({
        campo: def.campo,
        label: def.label,
        valorCertidao: valorDoc,
        valorReferencia: null,
        fonteReferencia: null,
        status: "sem_referencia",
      });
      continue;
    }

    if (def.apenasInformativo) {
      itens.push({
        campo: def.campo,
        label: def.label,
        valorCertidao: valorDoc,
        valorReferencia: valorRef,
        fonteReferencia: FONTE,
        status: "sem_referencia",
      });
      continue;
    }

    const confere = def.normalizar(valorDoc) === def.normalizar(valorRef);
    itens.push({
      campo: def.campo,
      label: def.label,
      valorCertidao: valorDoc,
      valorReferencia: valorRef,
      fonteReferencia: FONTE,
      status: confere ? "conforme" : "divergente",
    });
  }

  return itens;
}

/** Campos que, divergindo, indicam documento de OUTRA pessoa. */
export const CAMPOS_DE_TITULARIDADE = new Set(["nome_completo", "cpf"]);

export function requerimentoConfere(itens: ItemConferenciaRequerimento[]): boolean {
  return !itens.some((i) => i.status === "divergente");
}

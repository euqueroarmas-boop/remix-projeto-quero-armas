/* =============================================================================
 * Conferência de certidão contra o cadastro — aceita ou REJEITA
 *
 * Regra do usuário (30/07/2026):
 *
 *   "Errou, não tem o dado que precisa ou não é coerente ao que precisa,
 *    deve ser rejeitado."
 *
 * O porquê importa para entender a severidade: em vários desses portais é o
 * PRÓPRIO CLIENTE que digita nome, nascimento e naturalidade para emitir a
 * certidão. Se o documento sai com o dado errado, não é erro do órgão — é
 * erro de digitação dele, e a certidão simplesmente não serve. Aceitar
 * "porque está quase certo" é entregar à PF um documento que ela vai
 * indeferir, depois de o cliente já ter pago e esperado.
 *
 * Por isso a conferência é BINÁRIA e sem tolerância. A única normalização é a
 * que o próprio órgão ignora: acento, pontuação, caixa e espaço.
 *
 * Três veredictos, e a diferença entre eles é de quem é a ação:
 *
 *   - "aprovado"          → confere. Segue.
 *   - "rejeitado"         → o DOCUMENTO está errado ou incompleto. O cliente
 *                           reemite. A mensagem diz exatamente onde.
 *   - "cadastro_pendente" → o documento está bom, mas falta o dado NO CADASTRO
 *                           para comparar. Não se rejeita documento por falha
 *                           nossa: aqui a ação é preencher o cadastro.
 * ============================================================================= */

import type { CamposCertidao, OrgaoCertidao } from "./parsersCertidoes";
import { SIGLAS_UF } from "./localidadesBr";

export type VeredictoCertidao = "aprovado" | "rejeitado" | "cadastro_pendente";

export interface CadastroConferencia {
  nome_completo?: string | null;
  cpf?: string | null;
  data_nascimento?: string | null;
  nome_mae?: string | null;
  nome_pai?: string | null;
  naturalidade_municipio?: string | null;
  naturalidade_uf?: string | null;
  rg?: string | null;
}

export interface AchadoConferencia {
  campo: string;
  label: string;
  noDocumento: string;
  noCadastro: string;
  problema: "divergente" | "ausente_no_documento" | "ausente_no_cadastro";
  mensagem: string;
}

export interface ResultadoConferencia {
  veredicto: VeredictoCertidao;
  achados: AchadoConferencia[];
  /** Texto pronto para o cliente, dizendo o que fazer. */
  mensagemCliente: string;
}

const semAcento = (v: unknown) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const chaveNome = (v: unknown) =>
  semAcento(v).replace(/[^A-Za-z\s]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();

const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** "Ferraz de Vasconcelos - SP" e "FERRAZ DE VASCONCELOS/SP" viram a mesma coisa. */
const chaveCidade = (v: unknown) =>
  semAcento(v)
    .replace(/[^A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

/**
 * Nome do estado por extenso → sigla. O documento pode trazer "SAO PAULO - SP",
 * "Faxinal ( PR )" ou "JACAREI / SAO PAULO"; o cadastro guarda município e UF
 * em campos separados. Só se compara sigla com sigla.
 */
const ESTADO_PARA_UF: Record<string, string> = {
  ACRE: "AC", ALAGOAS: "AL", AMAPA: "AP", AMAZONAS: "AM", BAHIA: "BA",
  CEARA: "CE", "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES", GOIAS: "GO",
  MARANHAO: "MA", "MATO GROSSO DO SUL": "MS", "MATO GROSSO": "MT",
  "MINAS GERAIS": "MG", PARA: "PA", PARAIBA: "PB", PARANA: "PR",
  PERNAMBUCO: "PE", PIAUI: "PI", "RIO DE JANEIRO": "RJ",
  "RIO GRANDE DO NORTE": "RN", "RIO GRANDE DO SUL": "RS", RONDONIA: "RO",
  RORAIMA: "RR", "SANTA CATARINA": "SC", "SAO PAULO": "SP", SERGIPE: "SE",
  TOCANTINS: "TO",
};

/**
 * REGRA CANÔNICA — separa município e UF de um texto livre de naturalidade.
 * Vale para TODOS os clientes e para todos os pontos do sistema: existe UM
 * comparador de naturalidade, e é este.
 */
export function separarMunicipioUf(v: unknown): { municipio: string; uf: string | null } {
  let t = chaveCidade(v);
  if (!t) return { municipio: "", uf: null };
  // Estado por extenso no fim ("JACAREI SAO PAULO") vira sigla.
  for (const nome of Object.keys(ESTADO_PARA_UF).sort((a, b) => b.length - a.length)) {
    if (t.endsWith(` ${nome}`)) {
      t = `${t.slice(0, -nome.length).trim()} ${ESTADO_PARA_UF[nome]}`;
      break;
    }
  }
  const partes = t.split(" ");
  const ultima = partes[partes.length - 1];
  if (partes.length > 1 && SIGLAS_UF.includes(ultima)) {
    return { municipio: partes.slice(0, -1).join(" ").trim(), uf: ultima };
  }
  return { municipio: t, uf: null };
}

/**
 * Compara a naturalidade do documento com a do cadastro. UF só reprova quando
 * os DOIS lados a trazem — ausência não é divergência.
 */
export function naturalidadeConfere(
  valorDocumento: unknown,
  cadastroMunicipio: unknown,
  cadastroUf?: unknown,
): boolean {
  const doc = separarMunicipioUf(valorDocumento);
  const cad = separarMunicipioUf(cadastroMunicipio);
  const ufCad = cad.uf ?? (chaveCidade(cadastroUf) || null);
  if (!doc.municipio || !cad.municipio) return true; // sem base para comparar
  if (doc.municipio !== cad.municipio) return false;
  if (doc.uf && ufCad && doc.uf !== ufCad) return false;
  return true;
}

/**
 * Campos EXIGIDOS para a certidão ser aceita.
 *
 * Regra do usuário (30/07/2026, corrigindo a versão anterior): exigir SOMENTE
 * o que o formulário do órgão marca com asterisco. Campo opcional em branco
 * não reprova o documento — mas, se o cliente preencheu, o valor TEM de bater
 * com o cadastro, porque a PF indefere por qualquer divergência.
 *
 * Isso está implementado em duas camadas:
 *   - esta lista → o que, faltando, REPROVA
 *   - `comparar()` e os blocos de naturalidade/filiação → só agem quando o
 *     campo veio preenchido. Ausente e opcional, passa batido.
 *
 * TJSP (e-SAJ), conferido no formulário: os campos com asterisco são
 * Nome Completo*, CPF*, RG*, Gênero*, Nome da mãe* e Data de nascimento*.
 * Nome do pai e Naturalidade NÃO têm asterisco — são opcionais.
 *
 * Para os demais órgãos ainda não vi o formulário de emissão. Até o usuário
 * enviar, exijo apenas o mínimo que prova identidade e validade: quem é o
 * titular, o identificador que aquele documento carrega, a data de emissão e o
 * resultado. Tudo o mais é comparado quando presente, nunca exigido no escuro.
 */
const OBRIGATORIOS: Record<OrgaoCertidao, Array<keyof CamposCertidao>> = {
  stm: ["nome_titular", "cpf", "data_nascimento", "data_emissao", "resultado"],
  // TSE e IIRGD não trazem CPF: identificam por título de eleitor e por RG.
  tse: ["nome_titular", "titulo_eleitor", "data_nascimento", "data_emissao", "resultado"],
  iirgd: ["nome_titular", "rg", "data_nascimento", "data_emissao", "resultado"],
  tjsp_distribuicao: ["nome_titular", "cpf", "rg", "data_nascimento", "nome_mae", "data_emissao", "resultado"],
  tjsp_execucoes: ["nome_titular", "cpf", "rg", "data_nascimento", "nome_mae", "data_emissao", "resultado"],
  trf_regional: ["nome_titular", "cpf", "data_nascimento", "data_emissao", "resultado"],
  tjm_sp: ["nome_titular", "cpf", "data_nascimento", "data_emissao", "resultado"],

  // CR — não é certidão de antecedentes, mas passa pelo mesmo parser. Exige o
  // mínimo que prova de quem é e até quando vale.
  cr_exercito: ["nome_titular", "cpf", "data_validade"],

  // Boletim de Ocorrência: NADA é obrigatório aqui, e é de propósito. O BO é
  // prova de fato, não prova de identidade — e pode legitimamente estar em nome
  // de terceiro, quando o fato atingiu o cliente (regra do usuário, 31/07).
  // Reprovar um BO por divergência de nome seria descartar prova válida.
  boletim_ocorrencia: [],

  /* ── Ocupação lícita e renda ──────────────────────────────────────────
   * Exigido só o que PROVA o vínculo do documento com o cliente e com a
   * empresa. O cartão CNPJ e o QSA não trazem CPF nem nome do titular no
   * corpo — cobrar isso reprovaria documento correto.
   */
  ccmei: ["nome_titular", "cpf", "cnpj", "situacao_cadastral"],
  cartao_cnpj: ["cnpj", "razao_social", "situacao_cadastral"],
  qsa: ["cnpj", "socios"],
  // Nota fiscal: emitida pela empresa, não pela pessoa. Nada obrigatório.
  nota_fiscal: [],
};

/**
 * Como o campo se chama NO FORMULÁRIO de emissão. É isso que o cliente vê na
 * tela do órgão — dizer "preencha Naturalidade" só ajuda se for o mesmo rótulo.
 */
const CAMPO_NO_FORMULARIO: Partial<Record<OrgaoCertidao, Record<string, string>>> = {
  tjsp_distribuicao: {
    nome_titular: "Nome Completo", cpf: "CPF", rg: "RG", nome_mae: "Nome da mãe",
    nome_pai: "Nome do pai", data_nascimento: "Data de nascimento", naturalidade: "Naturalidade",
  },
  tjsp_execucoes: {
    nome_titular: "Nome Completo", cpf: "CPF", rg: "RG", nome_mae: "Nome da mãe",
    nome_pai: "Nome do pai", data_nascimento: "Data de nascimento", naturalidade: "Naturalidade",
  },
};

/*
 * NOTA — por que não existe "quem digitou" aqui.
 *
 * Cheguei a separar os órgãos entre "o cliente digita" e "vem do registro
 * oficial", para não mandar reemitir uma certidão que sairia idêntica. O
 * usuário derrubou a distinção, e com razão: quem julga é a Polícia Federal,
 * e ela compara o que está IMPRESSO na certidão com o que foi declarado no
 * requerimento. Se diverge, indefere — não importa de onde o dado veio.
 *
 * Então a regra é uma só: está no documento, tem de bater com o cadastro.
 */

const LABEL: Record<string, string> = {
  nome_titular: "Nome",
  cpf: "CPF",
  data_nascimento: "Data de nascimento",
  nome_mae: "Nome da mãe",
  nome_pai: "Nome do pai",
  naturalidade: "Naturalidade",
  rg: "RG",
  data_emissao: "Data de emissão",
  resultado: "Resultado da consulta",
  filiacao: "Filiação",
  titulo_eleitor: "Título de eleitor",
  cnpj: "CNPJ",
  razao_social: "Nome empresarial",
  situacao_cadastral: "Situação cadastral",
  socios: "Quadro de sócios",
  numero_nf: "Número da nota fiscal",
};

/**
 * Campos que o formulário exige mas a certidão NÃO imprime — logo, não há como
 * conferir. Ficam registrados para não parecerem esquecimento.
 *
 * "Gênero" é obrigatório no e-SAJ (asterisco), mas não sai no documento
 * emitido. Preenchido errado, não deixa rastro que eu possa checar.
 */
export const CAMPOS_NAO_VERIFICAVEIS: Partial<Record<OrgaoCertidao, string[]>> = {
  tjsp_distribuicao: ["Gênero"],
  tjsp_execucoes: ["Gênero"],
};

export function conferirCertidao(
  doc: CamposCertidao,
  cadastro: CadastroConferencia,
): ResultadoConferencia {
  const achados: AchadoConferencia[] = [];

  // ── 1) O documento trouxe tudo o que precisa? ──────────────────────────
  for (const campo of OBRIGATORIOS[doc.orgao]) {
    const v = doc[campo];
    if (v === undefined || v === null || v === "") {
      achados.push({
        campo: String(campo),
        label: LABEL[String(campo)] ?? String(campo),
        noDocumento: "",
        noCadastro: "",
        problema: "ausente_no_documento",
        mensagem:
          campo === "data_emissao"
            ? "A certidão enviada não mostra a data de emissão. Sem ela não é possível comprovar que está dentro da validade. Baixe o PDF original pelo site do órgão, sem recortar cabeçalho ou rodapé."
            : (() => {
                const noForm = CAMPO_NO_FORMULARIO[doc.orgao]?.[String(campo)];
                return noForm
                  ? `O campo "${noForm}" ficou em branco no pedido da certidão, e por isso não aparece no documento. Refaça a emissão preenchendo "${noForm}" — a qualificação precisa estar completa.`
                  : `A certidão não traz "${LABEL[String(campo)] ?? String(campo)}", que é obrigatório para conferir se o documento é seu.`;
              })(),
      });
    }
  }

  // "CONSTA" não serve para instruir o processo.
  if (doc.resultado === "CONSTA") {
    achados.push({
      campo: "resultado",
      label: LABEL.resultado,
      noDocumento: "CONSTA",
      noCadastro: "NADA CONSTA",
      problema: "divergente",
      mensagem:
        "A certidão veio POSITIVA (consta registro). Ela não pode instruir o processo assim — fale com a equipe antes de enviar.",
    });
  }

  // ── 2) O que está no documento bate com o cadastro? ────────────────────
  // Empresa fora de atividade não comprova ocupação lícita hoje.
  if (doc.situacao_cadastral && doc.situacao_cadastral !== "ATIVA") {
    achados.push({
      campo: "situacao_cadastral",
      label: LABEL.situacao_cadastral,
      noDocumento: doc.situacao_cadastral,
      noCadastro: "ATIVA",
      problema: "divergente",
      mensagem:
        `O CNPJ está com situação "${doc.situacao_cadastral}" na Receita Federal. ` +
        `Para comprovar ocupação lícita a inscrição precisa estar ATIVA — regularize e emita o documento novamente.`,
    });
  }

  // QSA: o cliente precisa aparecer no quadro. Sem papel inferido — basta
  // estar entre os nomes listados, igual à regra de filiação.
  if (doc.socios?.length && cadastro.nome_completo) {
    const eu = chaveNome(cadastro.nome_completo);
    if (!doc.socios.some((s) => chaveNome(s) === eu)) {
      achados.push({
        campo: "socios",
        label: LABEL.socios,
        noDocumento: doc.socios.join(" / "),
        noCadastro: String(cadastro.nome_completo),
        problema: "divergente",
        mensagem:
          `Seu nome não aparece no quadro de sócios deste documento. ` +
          `Envie o QSA da empresa em que você consta como sócio ou administrador.`,
      });
    }
  }

  const comparar = (
    campo: string,
    doDoc: string,
    doCad: string,
    comoCorrigir: string,
  ) => {
    if (!doDoc) return; // ausência já foi tratada acima, quando obrigatória
    if (!doCad) {
      achados.push({
        campo,
        label: LABEL[campo] ?? campo,
        noDocumento: doDoc,
        noCadastro: "",
        problema: "ausente_no_cadastro",
        mensagem: `O cadastro ainda não tem "${LABEL[campo] ?? campo}" para comparar.`,
      });
      return;
    }
    if (doDoc !== doCad) {
      achados.push({
        campo,
        label: LABEL[campo] ?? campo,
        noDocumento: doDoc,
        noCadastro: doCad,
        problema: "divergente",
        mensagem: comoCorrigir,
      });
    }
  };

  comparar(
    "nome_titular",
    chaveNome(doc.nome_titular),
    chaveNome(cadastro.nome_completo),
    `O nome na certidão está diferente do cadastro. Na certidão: "${doc.nome_titular}". No cadastro: "${cadastro.nome_completo}". Emita a certidão novamente digitando o nome exatamente como no seu documento de identidade.`,
  );

  comparar(
    "cpf",
    digitos(doc.cpf),
    digitos(cadastro.cpf),
    `O CPF na certidão não é o seu. Na certidão: ${doc.cpf}. No cadastro: ${cadastro.cpf}. Emita novamente com o CPF correto.`,
  );

  comparar(
    "rg",
    String(doc.rg ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase(),
    String(cadastro.rg ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase(),
    `O RG na certidão está diferente do cadastro. Na certidão: ${doc.rg}. No cadastro: ${cadastro.rg}. Emita novamente com o RG correto.`,
  );

  comparar(
    "data_nascimento",
    String(doc.data_nascimento ?? "").slice(0, 10),
    String(cadastro.data_nascimento ?? "").slice(0, 10),
    `A data de nascimento na certidão está diferente do cadastro. Emita novamente com a data correta.`,
  );

  // Naturalidade: quando o documento traz, TEM de bater. Foi o próprio cliente
  // quem digitou no portal do órgão — divergência aqui é erro de digitação
  // dele, e a PF não aceita.
  if (doc.naturalidade && cadastro.naturalidade_municipio) {
    // REGRA CANÔNICA — comparador único (`naturalidadeConfere`), usado também
    // pelo motor de conformidade do Hub. Município com município, UF com UF.
    if (!naturalidadeConfere(doc.naturalidade, cadastro.naturalidade_municipio, cadastro.naturalidade_uf)) {
      achados.push({
        campo: "naturalidade",
        label: LABEL.naturalidade,
        noDocumento: doc.naturalidade,
        noCadastro: String(cadastro.naturalidade_municipio),
        problema: "divergente",
        mensagem:
          `A naturalidade na certidão está diferente do seu cadastro. Na certidão: "${doc.naturalidade}". ` +
          `No cadastro: "${cadastro.naturalidade_municipio}". Esse campo é preenchido por quem emite — ` +
          `refaça a emissão informando a cidade de nascimento correta.`,
      });
    }
  }

  // Mãe: se o documento rotula, compara direto. Se traz filiação sem papel
  // definido, exige apenas que o nome do cadastro esteja ENTRE os nomes —
  // nunca supõe qual dos dois é a mãe.
  const maeCad = chaveNome(cadastro.nome_mae);
  if (maeCad) {
    if (doc.nome_mae) {
      comparar(
        "nome_mae",
        chaveNome(doc.nome_mae),
        maeCad,
        `O nome da mãe na certidão está diferente do cadastro. Na certidão: "${doc.nome_mae}". No cadastro: "${cadastro.nome_mae}". Emita novamente com o nome exatamente como no seu documento.`,
      );
    } else if (doc.filiacao?.length) {
      const bate = doc.filiacao.some((f) => chaveNome(f) === maeCad);
      if (!bate) {
        achados.push({
          campo: "filiacao",
          label: LABEL.filiacao,
          noDocumento: doc.filiacao.join(" / "),
          noCadastro: String(cadastro.nome_mae),
          problema: "divergente",
          mensagem:
            `A filiação da certidão não contém o nome da mãe do cadastro ("${cadastro.nome_mae}"). ` +
            `Na certidão consta: ${doc.filiacao.join(" e ")}. Confira e emita novamente.`,
        });
      }
    }
  }

  // ── 3) Veredicto ───────────────────────────────────────────────────────
  const bloqueia = achados.filter(
    (a) => a.problema === "divergente" || a.problema === "ausente_no_documento",
  );
  const soCadastro = achados.length > 0 && bloqueia.length === 0;
  const veredicto: VeredictoCertidao = bloqueia.length
    ? "rejeitado"
    : soCadastro
      ? "cadastro_pendente"
      : "aprovado";

  const listaAchados = bloqueia.map((a) => `• ${a.label}: ${a.mensagem}`).join("\n\n");

  const mensagemCliente =
    veredicto === "aprovado"
      ? "Certidão conferida: todos os dados batem com o seu cadastro."
      : veredicto === "cadastro_pendente"
        ? "A certidão está correta, mas faltam dados no seu cadastro para a conferência completa. Complete o cadastro para seguir."
        : `Esta certidão não pode ser aceita:\n\n${listaAchados}`;

  return { veredicto, achados, mensagemCliente };
}

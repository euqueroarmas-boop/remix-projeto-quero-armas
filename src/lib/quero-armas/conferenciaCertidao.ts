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
 * Campos que CADA órgão é obrigado a trazer.
 *
 * Certidão sem isso não cumpre a exigência — é rejeitada mesmo que nada
 * divirja, porque não dá para provar que é do cliente nem calcular validade.
 */
const OBRIGATORIOS: Record<OrgaoCertidao, Array<keyof CamposCertidao>> = {
  stm: ["nome_titular", "cpf", "data_nascimento", "data_emissao", "resultado"],
  // TSE e IIRGD não trazem CPF por natureza — identificam por título e RG.
  tse: ["nome_titular", "data_nascimento", "data_emissao", "resultado"],
  iirgd: ["nome_titular", "data_nascimento", "data_emissao", "resultado"],
  tjsp_distribuicao: ["nome_titular", "cpf", "data_nascimento", "data_emissao", "resultado"],
  tjsp_execucoes: ["nome_titular", "cpf", "data_nascimento", "data_emissao", "resultado"],
  trf_regional: ["nome_titular", "cpf", "data_nascimento", "data_emissao", "resultado"],
  tjm_sp: ["nome_titular", "cpf", "data_nascimento", "data_emissao", "resultado"],
};

const LABEL: Record<string, string> = {
  nome_titular: "Nome",
  cpf: "CPF",
  data_nascimento: "Data de nascimento",
  nome_mae: "Nome da mãe",
  nome_pai: "Nome do pai",
  naturalidade: "Naturalidade",
  data_emissao: "Data de emissão",
  resultado: "Resultado da consulta",
  filiacao: "Filiação",
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
            : `A certidão não traz "${LABEL[String(campo)] ?? String(campo)}", que é obrigatório para conferir se o documento é seu.`,
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
    "data_nascimento",
    String(doc.data_nascimento ?? "").slice(0, 10),
    String(cadastro.data_nascimento ?? "").slice(0, 10),
    `A data de nascimento na certidão está diferente do cadastro. Emita novamente com a data correta.`,
  );

  // Naturalidade: quando o documento traz, TEM de bater. Foi o próprio cliente
  // quem digitou no portal do órgão — divergência aqui é erro de digitação
  // dele, e a PF não aceita.
  if (doc.naturalidade && cadastro.naturalidade_municipio) {
    const noDoc = chaveCidade(doc.naturalidade).replace(/\s+SP$/, "").trim();
    const noCad = chaveCidade(cadastro.naturalidade_municipio);
    if (noDoc !== noCad) {
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

  const mensagemCliente =
    veredicto === "aprovado"
      ? "Certidão conferida: todos os dados batem com o seu cadastro."
      : veredicto === "cadastro_pendente"
        ? "A certidão está correta, mas faltam dados no seu cadastro para a conferência completa. Complete o cadastro para seguir."
        : `Esta certidão não pode ser aceita:\n\n${bloqueia.map((a) => `• ${a.label}: ${a.mensagem}`).join("\n\n")}`;

  return { veredicto, achados, mensagemCliente };
}

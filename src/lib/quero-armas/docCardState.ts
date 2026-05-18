/**
 * docCardState — separa claramente o estado de UPLOAD do estado de EXTRAÇÃO
 * de cada documento na Etapa02Documentos do /cadastro Mira.
 *
 * Upload bem-sucedido + extração falha NÃO deve ser apresentado como sucesso
 * total (card verde). Quando a IA falha, marcamos a extração como
 * `revisao_manual` e o card fica âmbar — usuário consegue avançar e revisa/
 * preenche manualmente na Etapa 03.
 */
export type UploadStatus = "pendente" | "enviado" | "erro";

export type ExtractionStatus =
  | "pendente"
  | "extraindo"
  | "extraido"
  | "falhou"
  | "revisao_manual"
  | "dispensado_por_reaproveitamento";

export type DocCardTone = "neutral" | "success" | "warn" | "error";

export interface DocCardState {
  tone: DocCardTone;
  /** Texto curto (badge) com o que aconteceu. */
  badge: string | null;
  /** Mensagem curta auxiliar exibida abaixo do nome do arquivo. */
  hint: string;
  /** Permite avançar para a Etapa 03 (com revisão manual quando preciso). */
  podeAvancar: boolean;
}

export interface DocCardInput {
  uploadStatus: UploadStatus;
  extractionStatus: ExtractionStatus;
  fileName?: string | null;
  errorMsg?: string | null;
  extractionError?: string | null;
  /** Indica que este documento exige extração IA nesta etapa. */
  exigeExtracaoIA: boolean;
  /** Documento foi resolvido por reaproveitamento do Arsenal. */
  reaproveitado?: boolean;
}

export function computeDocCardState(input: DocCardInput): DocCardState {
  const {
    uploadStatus,
    extractionStatus,
    fileName,
    errorMsg,
    extractionError,
    exigeExtracaoIA,
    reaproveitado,
  } = input;

  if (reaproveitado) {
    return {
      tone: "success",
      badge: "JÁ RECEBIDO",
      hint: "Documento já existente no Arsenal",
      podeAvancar: true,
    };
  }

  if (uploadStatus === "erro") {
    return {
      tone: "error",
      badge: "FALHA NO ENVIO",
      hint: errorMsg || "Erro ao enviar arquivo",
      podeAvancar: false,
    };
  }

  if (uploadStatus === "pendente") {
    return {
      tone: "neutral",
      badge: null,
      hint: "PDF, JPG ou PNG — até 20MB",
      podeAvancar: false,
    };
  }

  // uploadStatus === "enviado"
  if (!exigeExtracaoIA) {
    return {
      tone: "success",
      badge: "ARQUIVO RECEBIDO",
      hint: fileName || "Arquivo recebido",
      podeAvancar: true,
    };
  }

  switch (extractionStatus) {
    case "extraindo":
      return {
        tone: "neutral",
        badge: "ANALISANDO",
        hint: "Analisando com IA…",
        podeAvancar: true,
      };
    case "extraido":
      return {
        tone: "success",
        badge: "DADOS EXTRAÍDOS",
        hint: fileName ? `${fileName} — dados extraídos` : "Dados extraídos",
        podeAvancar: true,
      };
    case "dispensado_por_reaproveitamento":
      return {
        tone: "success",
        badge: "JÁ RECEBIDO",
        hint: "Documento já existente no Arsenal",
        podeAvancar: true,
      };
    case "falhou":
    case "revisao_manual":
      return {
        tone: "warn",
        badge: "REVISÃO MANUAL",
        hint:
          "Arquivo recebido, mas a IA não conseguiu ler automaticamente — você revisa na próxima etapa." +
          (extractionError ? ` (${extractionError})` : ""),
        podeAvancar: true,
      };
    case "pendente":
    default:
      return {
        tone: "neutral",
        badge: "ARQUIVO RECEBIDO",
        hint: fileName || "Arquivo recebido — aguardando análise",
        podeAvancar: true,
      };
  }
}
import type { ConferenciaStatus, StatusKind } from "./ConferenciaHeader";

/**
 * Computa os 4 chips de status (cadastro, financeiro, serviço, documentos)
 * + a "Próxima Ação" recomendada para a tela de conferência do
 * Cadastro Público em /clientes.
 *
 * Pure function — fácil de testar, sem efeitos colaterais.
 */

export type CadastroPublicoLite = {
  status?: string | null;
  pago?: boolean | null;
  cliente_id_vinculado?: number | null;
  servico_interesse?: string | null;
  servico_principal?: string | null;
  servico_fechado_final?: string | null;
  selfie_path?: string | null;
  documento_identidade_path?: string | null;
  comprovante_endereco_path?: string | null;
  consentimento_tratamento_dados?: boolean | null;
  cpf?: string | null;
  email?: string | null;
  telefone_principal?: string | null;
  end1_cep?: string | null;
  end1_logradouro?: string | null;
  end1_cidade?: string | null;
  end1_estado?: string | null;
  nome_completo?: string | null;
};

const filled = (v: any) => v != null && String(v).trim() !== "";
const norm = (v?: string | null) => (v || "").replace(/\D/g, "");

export function isCadastroAprovado(status?: string | null) {
  return ["aprovado", "conferido", "validado", "formulario_conferido"].includes(
    String(status || "").toLowerCase(),
  );
}

export function listarPendenciasCadastro(c: CadastroPublicoLite): string[] {
  const p: string[] = [];
  if (!filled(c.nome_completo)) p.push("Nome do cliente ausente.");
  if (norm(c.cpf).length !== 11) p.push("CPF inválido ou ausente.");
  if (!filled(c.telefone_principal)) p.push("Telefone/WhatsApp ausente.");
  if (!filled(c.email)) p.push("E-mail ausente.");
  if (!filled(c.end1_cep) || !filled(c.end1_logradouro) || !filled(c.end1_cidade) || !filled(c.end1_estado))
    p.push("Endereço incompleto.");
  if (!filled(c.servico_interesse) && !filled(c.servico_principal))
    p.push("Serviço de interesse não classificado.");
  if (!c.consentimento_tratamento_dados) p.push("Consentimento LGPD não registrado.");
  if (!filled(c.documento_identidade_path)) p.push("Documento de identidade não enviado.");
  if (!filled(c.comprovante_endereco_path)) p.push("Comprovante de endereço não enviado.");
  if (!filled(c.selfie_path)) p.push("Selfie do titular não enviada.");
  return p;
}

function chip(label: string, kind: StatusKind) {
  return { label, kind };
}

export function computeConferenciaStatus(c: CadastroPublicoLite): ConferenciaStatus {
  const aprovado = isCadastroAprovado(c.status);
  const rejeitado = String(c.status || "").toLowerCase() === "rejeitado";
  const pendencias = listarPendenciasCadastro(c);

  // Cadastro
  let cadastro = chip("PENDENTE", "warn");
  if (rejeitado) cadastro = chip("REJEITADO", "danger");
  else if (aprovado && pendencias.length === 0) cadastro = chip("VALIDADO", "ok");
  else if (aprovado && pendencias.length > 0) cadastro = chip("VALIDADO C/ PENDÊNCIAS", "warn");
  else if (pendencias.length > 0) cadastro = chip("EM CONFERÊNCIA", "warn");

  // Financeiro
  let financeiro = chip("SEM COBRANÇA", "neutral");
  if (c.pago) financeiro = chip("PAGO", "ok");
  else if (aprovado) financeiro = chip("AGUARDANDO PAGAMENTO", "warn");

  // Serviço
  const servicoNome =
    c.servico_fechado_final || c.servico_principal || c.servico_interesse || null;
  let servico = chip("NÃO CLASSIFICADO", "warn");
  if (servicoNome) servico = chip("INTERESSE IDENTIFICADO", "info");
  if (servicoNome && c.servico_fechado_final) servico = chip("CONTRATADO", "ok");

  // Documentos
  const totalDocs =
    (c.documento_identidade_path ? 1 : 0) +
    (c.comprovante_endereco_path ? 1 : 0) +
    (c.selfie_path ? 1 : 0);
  let documentos = chip("SEM DOCUMENTOS", "danger");
  if (totalDocs === 3) documentos = chip("COMPLETOS", "ok");
  else if (totalDocs > 0) documentos = chip(`PARCIAIS (${totalDocs}/3)`, "warn");

  return { cadastro, financeiro, servico, documentos };
}

export type ProximaAcaoTone = "primary" | "warn" | "danger" | "ok" | "neutral";

export interface ProximaAcaoDecisao {
  titulo: string;
  descricao?: string;
  tone: ProximaAcaoTone;
  ctaLabel?: string;
  ctaAction?: "validar" | "solicitar_correcao" | "gerar_cobranca" | "abrir_processo" | "abrir_cliente";
  pendencias: { label: string; tone?: "warn" | "danger" | "info" }[];
}

export function decidirProximaAcao(c: CadastroPublicoLite): ProximaAcaoDecisao {
  const aprovado = isCadastroAprovado(c.status);
  const rejeitado = String(c.status || "").toLowerCase() === "rejeitado";
  const pendencias = listarPendenciasCadastro(c);

  if (rejeitado) {
    return {
      titulo: "Cadastro rejeitado.",
      descricao: "Reverter para pendente caso seja necessário reabrir.",
      tone: "danger",
      pendencias: [],
    };
  }

  if (!aprovado && pendencias.length > 0) {
    return {
      titulo: "Solicitar correção ao cliente.",
      descricao:
        "Faltam dados obrigatórios para validar o cadastro. Envie WhatsApp/e-mail com a lista de pendências.",
      tone: "warn",
      ctaLabel: "Solicitar correção",
      ctaAction: "solicitar_correcao",
      pendencias: pendencias.map((p) => ({ label: p, tone: "warn" })),
    };
  }

  if (!aprovado && pendencias.length === 0) {
    return {
      titulo: "Conferir e validar cadastro.",
      descricao:
        "Todos os dados básicos estão presentes. Confirme com a equipe e clique em Validar para vincular ao cliente canônico.",
      tone: "primary",
      ctaLabel: "Validar cadastro",
      ctaAction: "validar",
      pendencias: [],
    };
  }

  // aprovado
  if (aprovado && !c.pago) {
    return {
      titulo: "Gerar cobrança ou aguardar pagamento.",
      descricao:
        "Cadastro validado. Próximo passo é cobrar o cliente para iniciar o serviço.",
      tone: "primary",
      ctaLabel: "Marcar como pago",
      ctaAction: "gerar_cobranca",
      pendencias: pendencias.length
        ? pendencias.map((p) => ({ label: p, tone: "warn" as const }))
        : [],
    };
  }

  if (aprovado && c.pago) {
    return {
      titulo: "Abrir processo e gerar checklist.",
      descricao:
        "Pagamento confirmado. Hora de abrir o processo operacional na ficha do cliente vinculado.",
      tone: "ok",
      ctaLabel: c.cliente_id_vinculado ? "Abrir cliente" : undefined,
      ctaAction: c.cliente_id_vinculado ? "abrir_cliente" : undefined,
      pendencias: [],
    };
  }

  return {
    titulo: "Sem ação imediata.",
    tone: "neutral",
    pendencias: [],
  };
}
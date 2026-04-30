/**
 * Mapa canônico entre rótulos de "serviço de interesse" vindos do formulário público
 * e o catálogo interno (qa_servicos). Não inventa valores: quando não reconhecer,
 * marca como "pendente_classificacao" para o admin classificar manualmente.
 *
 * Mantém a regra global da plataforma (`mem://lib/quero-armas/serviceDisplay.ts`):
 * slug é a fonte canônica de exibição.
 */

export type ServicoCanonico = {
  slug: string;
  nome: string;
  /** id em qa_servicos quando o slug bate com um serviço existente. */
  servico_id: number | null;
  /** true quando o rótulo do formulário não bate em nenhum serviço conhecido. */
  pendente_classificacao: boolean;
};

const PENDENTE: Omit<ServicoCanonico, "nome"> = {
  slug: "servico_pendente_classificacao",
  servico_id: null,
  pendente_classificacao: true,
};

/**
 * Normaliza o texto livre do formulário e devolve o serviço canônico.
 * Caller jamais deve usar nomes que ele inventou; usar sempre o `nome` retornado.
 */
export function resolveServicoFromInteresse(rawInteresse: string | null | undefined): ServicoCanonico {
  const raw = (rawInteresse || "").trim();
  if (!raw) {
    return { ...PENDENTE, nome: "Serviço não informado" };
  }

  const norm = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Concessão de CR (Exército)
  if (norm.includes("concessao de cr") || norm.includes("concessao cr") || norm === "cr eb") {
    return {
      slug: "concessao-de-cr",
      nome: "Concessão de CR no Exército Brasileiro",
      servico_id: 27, // qa_servicos.id "Concessão de CR no Exército Brasileiro (Sem Clube)"
      pendente_classificacao: false,
    };
  }

  // Posse na Polícia Federal
  if (
    norm.includes("posse na policia federal") ||
    norm === "posse pf" ||
    norm.includes("posse de arma") ||
    norm === "aquisicao / posse de arma de fogo" ||
    norm.includes("aquisicao") && norm.includes("posse")
  ) {
    return {
      slug: "posse-arma-fogo",
      nome: "Posse de arma de fogo",
      servico_id: 2,
      pendente_classificacao: false,
    };
  }

  // Porte de arma de fogo
  if (norm.includes("porte de arma") || norm.includes("porte na policia federal") || norm === "porte pf") {
    return {
      slug: "porte-arma-fogo",
      nome: "Porte de arma de fogo",
      servico_id: 3,
      pendente_classificacao: false,
    };
  }

  // Renovação de arma de fogo (mapeia para CRAF na Polícia Federal)
  if (norm.includes("renovacao") && (norm.includes("arma") || norm.includes("registro"))) {
    return {
      slug: "renovacao-arma-fogo",
      nome: "Renovação de Arma de Fogo (CRAF)",
      servico_id: 26, // CRAF na Polícia Federal
      pendente_classificacao: false,
    };
  }

  // Segurança pública / vínculos especiais — não há serviço único; deixa pendente
  if (norm.includes("seguranca publica")) {
    return {
      ...PENDENTE,
      nome: `Solicitação de orientação — ${raw} (a classificar)`,
    };
  }

  return { ...PENDENTE, nome: `${raw} (a classificar)` };
}
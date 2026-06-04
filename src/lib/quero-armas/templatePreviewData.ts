// ============================================================================
// buildTemplatePreviewData — espelho dos campos que as edges
// `qa-fill-template-cliente` e `qa-fill-template` usam para preencher o .docx.
// Mantenha sincronizado: qualquer placeholder novo nas edges deve aparecer
// aqui também, senão o cliente confere uma coisa e baixa outra.
// ============================================================================

export interface TemplatePreviewField {
  /** chave estável (uso interno) */
  key: string;
  /** rótulo amigável (PT-BR) */
  label: string;
  /** valor formatado para exibição */
  value: string;
  /** quando true, indica que o cliente NÃO pode editar pelo portal */
  locked?: boolean;
  /** quando true, o documento NÃO pode ser gerado se este campo estiver vazio */
  required?: boolean;
  /** grupo lógico para agrupar campos no modal */
  group: "identificacao" | "civil" | "endereco" | "contato";
}

const safe = (v: any): string => {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s;
};

/**
 * Monta a lista de campos que entrarão no documento, exatamente como as edges
 * de preenchimento leem `qa_clientes`. Campos vazios continuam na lista para
 * que o cliente perceba lacunas antes de gerar o arquivo.
 */
export function buildTemplatePreviewData(cliente: any): TemplatePreviewField[] {
  const c = cliente || {};
  const enderecoLinha = [
    safe(c.endereco),
    c.numero ? `nº ${safe(c.numero)}` : "",
    safe(c.complemento),
    safe(c.bairro),
  ]
    .filter(Boolean)
    .join(", ");
  const cidadeUf = [safe(c.cidade), safe(c.estado)].filter(Boolean).join(" / ");

  return [
    { key: "nome_completo", label: "Nome completo", value: safe(c.nome_completo), group: "identificacao", required: true },
    { key: "cpf", label: "CPF", value: safe(c.cpf), group: "identificacao", locked: true, required: true },
    { key: "rg", label: "RG", value: safe(c.rg), group: "identificacao", required: true },
    { key: "emissor_rg", label: "Órgão emissor", value: safe(c.emissor_rg), group: "identificacao", required: true },
    { key: "data_nascimento", label: "Data de nascimento", value: safe(c.data_nascimento), group: "identificacao", required: true },
    { key: "nacionalidade", label: "Nacionalidade", value: safe(c.nacionalidade) || "brasileiro(a)", group: "civil", required: true },
    { key: "naturalidade", label: "Naturalidade", value: safe(c.naturalidade), group: "civil" },
    { key: "profissao", label: "Profissão", value: safe(c.profissao), group: "civil", required: true },
    { key: "estado_civil", label: "Estado civil", value: safe(c.estado_civil), group: "civil", required: true },
    { key: "endereco", label: "Endereço", value: enderecoLinha, group: "endereco", required: true },
    { key: "cidade_uf", label: "Cidade / UF", value: cidadeUf, group: "endereco", required: true },
    { key: "cep", label: "CEP", value: safe(c.cep), group: "endereco", required: true },
    { key: "email", label: "E-mail", value: safe(c.email), group: "contato", locked: true },
    { key: "celular", label: "Celular", value: safe(c.celular), group: "contato", required: true },
  ];
}

export const TEMPLATE_PREVIEW_GROUP_LABEL: Record<TemplatePreviewField["group"], string> = {
  identificacao: "Identificação",
  civil: "Dados civis",
  endereco: "Endereço",
  contato: "Contato",
};
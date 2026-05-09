/**
 * Cadastro completeness — calcula preenchimento por seção da aba Dados.
 * Não altera dados; apenas inspeciona o objeto cliente carregado em
 * QAClientesPage. Listas devem refletir o que está visível na UI da aba.
 */

export const CAMPOS_OBRIGATORIOS = {
  identificacao: [
    "nome_completo", "cpf", "rg", "emissor_rg", "data_nascimento",
    "naturalidade", "nacionalidade", "estado_civil", "profissao",
    "escolaridade", "titulo_eleitor",
  ],
  filiacao: ["nome_mae", "nome_pai"],
  contato: ["celular", "email"],
  endereco: ["endereco", "numero", "complemento", "bairro", "cep", "cidade"],
  complementares: [
    "origem_cadastro", "created_at",
    "cadastro_publico_aplicado_em", "updated_at",
  ],
} as const;

/** Seções condicionais (entram só quando aplicáveis). */
export const CAMPOS_CONDICIONAIS = {
  responsavelEndereco: [
    "responsavel_endereco_nome",
    "responsavel_endereco_cpf",
    "responsavel_endereco_rg_cin",
    "responsavel_endereco_telefone",
    "responsavel_endereco_vinculo",
    "responsavel_endereco_declaracao_path",
    "responsavel_endereco_comprovante_path",
  ],
  segundoEndereco: [
    "endereco2", "numero2", "bairro2", "cep2", "cidade2", "estado2",
  ],
} as const;

export type SecaoCadastro =
  | keyof typeof CAMPOS_OBRIGATORIOS
  | keyof typeof CAMPOS_CONDICIONAIS;

const filled = (v: any) => v != null && String(v).trim() !== "";

export interface SecaoStats { preenchidos: number; total: number; pendentes: string[]; }

export interface CadastroCompleteness {
  total: number;
  preenchidos: number;
  pendentes: number;
  status: "completo" | "incompleto";
  secoes: Record<SecaoCadastro, SecaoStats>;
}

export function computeCadastroCompleteness(c: Record<string, any> | null | undefined): CadastroCompleteness {
  const secoes = {} as Record<SecaoCadastro, SecaoStats>;
  let total = 0, preenchidos = 0;
  const compute = (fields: readonly string[]): SecaoStats => {
    const stats: SecaoStats = { preenchidos: 0, total: fields.length, pendentes: [] };
    fields.forEach((f) => {
      if (filled((c as any)?.[f])) stats.preenchidos++;
      else stats.pendentes.push(f);
    });
    return stats;
  };

  (Object.keys(CAMPOS_OBRIGATORIOS) as Array<keyof typeof CAMPOS_OBRIGATORIOS>).forEach((sec) => {
    const stats = compute(CAMPOS_OBRIGATORIOS[sec]);
    secoes[sec] = stats;
    total += stats.total;
    preenchidos += stats.preenchidos;
  });

  // Condicional A — responsável terceiro pelo comprovante de endereço.
  // Entra na completude APENAS quando o titular declarou explicitamente "nao".
  if (String((c as any)?.comprovante_endereco_em_nome_proprio || "").toLowerCase() === "nao") {
    const stats = compute(CAMPOS_CONDICIONAIS.responsavelEndereco);
    secoes.responsavelEndereco = stats;
    total += stats.total;
    preenchidos += stats.preenchidos;
  }

  // Condicional B — segundo endereço do imóvel.
  // Entra apenas quando há ao menos um dado preenchido (ou seja, há imóvel
  // adicional declarado).
  const tem2 = CAMPOS_CONDICIONAIS.segundoEndereco.some((f) => filled((c as any)?.[f]));
  if (tem2) {
    const stats = compute(CAMPOS_CONDICIONAIS.segundoEndereco);
    secoes.segundoEndereco = stats;
    total += stats.total;
    preenchidos += stats.preenchidos;
  }

  return {
    total,
    preenchidos,
    pendentes: total - preenchidos,
    status: preenchidos >= total ? "completo" : "incompleto",
    secoes,
  };
}

export function isCampoObrigatorio(secao: SecaoCadastro, campo: string): boolean {
  const all = (CAMPOS_OBRIGATORIOS as any)[secao] || (CAMPOS_CONDICIONAIS as any)[secao];
  return Array.isArray(all) && all.includes(campo);
}
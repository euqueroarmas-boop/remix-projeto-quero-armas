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

export type SecaoCadastro = keyof typeof CAMPOS_OBRIGATORIOS;

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
  (Object.keys(CAMPOS_OBRIGATORIOS) as SecaoCadastro[]).forEach((sec) => {
    const fields = CAMPOS_OBRIGATORIOS[sec];
    const stats: SecaoStats = { preenchidos: 0, total: fields.length, pendentes: [] };
    fields.forEach((f) => {
      if (filled((c as any)?.[f])) stats.preenchidos++;
      else stats.pendentes.push(f);
    });
    secoes[sec] = stats;
    total += stats.total;
    preenchidos += stats.preenchidos;
  });
  return {
    total,
    preenchidos,
    pendentes: total - preenchidos,
    status: preenchidos >= total ? "completo" : "incompleto",
    secoes,
  };
}

export function isCampoObrigatorio(secao: SecaoCadastro, campo: string): boolean {
  return (CAMPOS_OBRIGATORIOS[secao] as readonly string[]).includes(campo);
}
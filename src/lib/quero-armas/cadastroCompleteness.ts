// ============================================================================
// cadastroCompleteness — detecta campos faltantes do qa_clientes para o
// fluxo "Completar cadastro progressivo" do portal.
// ============================================================================

export type CadastroGrupo = "pessoais" | "contato" | "endereco" | "profissional" | "identidade";

export interface CampoCadastro {
  key: string;
  label: string;
  grupo: CadastroGrupo;
  /** Se true, considerado crucial para o cadastro estar "completo". */
  crucial: boolean;
  /**
   * Pergunta direta ao cliente, usada no checklist cadastral (uma por tela).
   * Sem ela o wizard cai no `label`, que é rótulo de formulário e soa seco.
   */
  pergunta?: string;
  /** Explicação curta de por que o dado é pedido. */
  ajuda?: string;
  /**
   * Links oficiais para o cliente obter o dado sem sair procurando.
   *
   * Só entram URLs de órgão oficial que eu confirmei existir. Link quebrado
   * ou inventado é pior do que link nenhum: o cliente perde a viagem e volta
   * achando que o sistema está errado.
   */
  links?: Array<{ label: string; url: string }>;
  /** Tipo de input para a UI. */
  tipo?: "text" | "date" | "select" | "tel" | "cep" | "uf";
  /** Opções para select. */
  opcoes?: Array<{ value: string; label: string }>;
  /** Placeholder/exemplo. */
  placeholder?: string;
  /** Largura sugerida no grid (1/2 = metade). */
  colSpan?: 1 | 2;
}

export const CAMPOS_CADASTRO: CampoCadastro[] = [
  // Pessoais
  { key: "data_nascimento", label: "Data de nascimento", grupo: "pessoais", crucial: true, pergunta: "Qual é a sua data de nascimento?", ajuda: "Como está no seu documento de identidade.", tipo: "date", placeholder: "DD/MM/AAAA", colSpan: 1 },
  { key: "sexo", label: "Sexo", grupo: "pessoais", crucial: true, pergunta: "Qual é o seu sexo?", ajuda: "Conforme consta no documento oficial.", tipo: "select", opcoes: [
    { value: "M", label: "Masculino" }, { value: "F", label: "Feminino" }, { value: "Outro", label: "Outro" },
  ], colSpan: 1 },
  { key: "estado_civil", label: "Estado civil", grupo: "pessoais", crucial: true, pergunta: "Qual é o seu estado civil?", tipo: "select", opcoes: [
    { value: "Solteiro(a)", label: "Solteiro(a)" }, { value: "Casado(a)", label: "Casado(a)" },
    { value: "Divorciado(a)", label: "Divorciado(a)" }, { value: "Viúvo(a)", label: "Viúvo(a)" },
    { value: "União estável", label: "União estável" },
  ], colSpan: 1 },
  { key: "nacionalidade", label: "Nacionalidade", grupo: "pessoais", crucial: true, pergunta: "Qual é a sua nacionalidade?", ajuda: "Normalmente Brasileiro(a).", tipo: "text", placeholder: "Brasileiro(a)", colSpan: 1 },
  { key: "naturalidade_municipio", label: "Naturalidade — município", grupo: "pessoais", crucial: true, pergunta: "Em qual cidade você nasceu?", ajuda: "Só o município — a UF vem na próxima.", tipo: "text", colSpan: 1 },
  { key: "naturalidade_uf", label: "Naturalidade — UF", grupo: "pessoais", crucial: true, pergunta: "Em qual estado você nasceu?", tipo: "uf", colSpan: 1 },
  { key: "nome_mae", label: "Nome da mãe", grupo: "pessoais", crucial: true, pergunta: "Qual é o nome completo da sua mãe?", ajuda: "Exatamente como está no seu documento — a Polícia Federal confere letra por letra.", tipo: "text", colSpan: 2 },
  { key: "nome_pai", label: "Nome do pai", grupo: "pessoais", crucial: true, pergunta: "Qual é o nome completo do seu pai?", ajuda: "Se não constar no seu documento, escreva como você souber.", tipo: "text", colSpan: 2 },

  // Identidade
  { key: "rg", label: "RG / CIN", grupo: "identidade", crucial: true, pergunta: "Qual é o número do seu RG ou CIN?", tipo: "text", colSpan: 1 },
  { key: "emissor_rg", label: "Órgão emissor", grupo: "identidade", crucial: true, pergunta: "Qual órgão emitiu o seu RG?", ajuda: "Costuma aparecer como SSP, DETRAN ou IIRGD.", tipo: "text", placeholder: "SSP", colSpan: 1 },
  { key: "uf_emissor_rg", label: "UF do emissor", grupo: "identidade", crucial: true, pergunta: "Em qual estado o seu RG foi emitido?", tipo: "uf", colSpan: 1 },
  { key: "expedicao_rg", label: "Data de expedição", grupo: "identidade", crucial: true, pergunta: "Qual a data de expedição do seu RG?", ajuda: "É a data de emissão impressa no documento.", tipo: "date", placeholder: "DD/MM/AAAA", colSpan: 1 },

  // Contato
  { key: "celular", label: "Celular (com DDD)", grupo: "contato", crucial: true, pergunta: "Qual é o seu celular com WhatsApp?", ajuda: "É por onde vamos te avisar do andamento.", tipo: "tel", placeholder: "(11) 99999-9999", colSpan: 2 },

  { key: "email", label: "E-mail", grupo: "contato", crucial: true, tipo: "text", placeholder: "voce@email.com", colSpan: 2, pergunta: "Qual é o seu e-mail?", ajuda: "Usamos para enviar contrato, procuração e avisos do processo." },
  { key: "titulo_eleitor", label: "Título de eleitor", grupo: "identidade", crucial: true, tipo: "text", colSpan: 1, pergunta: "Qual é o número do seu título de eleitor?", ajuda: "Está no seu título, no app e-Título ou na Certidão de Crimes Eleitorais emitida pelo TSE — nela o número do título vem impresso.", links: [
    { label: "Consultar título no autoatendimento do TSE", url: "https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral" },
    { label: "Emitir Certidão de Crimes Eleitorais (TSE)", url: "https://www.tse.jus.br/servicos-eleitorais/certidoes/certidao-de-crimes-eleitorais" },
  ] },

  // Endereço
  { key: "cep", label: "CEP", grupo: "endereco", crucial: true, pergunta: "Qual é o CEP do seu endereço?", ajuda: "O resto do endereço é preenchido automaticamente.", links: [
    { label: "Buscar meu CEP nos Correios", url: "https://buscacepinter.correios.com.br/app/endereco/index.php" },
  ], tipo: "cep", placeholder: "00000-000", colSpan: 1 },
  { key: "endereco", label: "Logradouro", grupo: "endereco", crucial: true, pergunta: "Qual é o nome da sua rua ou avenida?", tipo: "text", colSpan: 2 },
  { key: "numero", label: "Número", grupo: "endereco", crucial: true, pergunta: "Qual é o número do seu imóvel?", tipo: "text", colSpan: 1 },
  { key: "complemento", label: "Complemento", grupo: "endereco", crucial: false, pergunta: "Tem complemento? (apartamento, bloco, casa)", ajuda: "Pode deixar em branco se não tiver.", tipo: "text", colSpan: 1 },
  { key: "bairro", label: "Bairro", grupo: "endereco", crucial: true, pergunta: "Qual é o seu bairro?", tipo: "text", colSpan: 1 },
  { key: "cidade", label: "Cidade", grupo: "endereco", crucial: true, pergunta: "Em qual cidade você mora?", tipo: "text", colSpan: 1 },
  { key: "estado", label: "Estado (UF)", grupo: "endereco", crucial: true, pergunta: "Em qual estado você mora?", tipo: "uf", colSpan: 1 },

  // Profissional
  { key: "profissao", label: "Profissão", grupo: "profissional", crucial: true, pergunta: "Qual é a sua profissão?", ajuda: "A mesma que comprova sua ocupação lícita.", tipo: "text", colSpan: 1 },
  { key: "escolaridade", label: "Escolaridade", grupo: "profissional", crucial: true, pergunta: "Qual é a sua escolaridade?", tipo: "text", colSpan: 1 },
];

export const GRUPO_LABELS: Record<CadastroGrupo, string> = {
  pessoais: "Dados pessoais",
  identidade: "Documento de identidade",
  contato: "Contato",
  endereco: "Endereço",
  profissional: "Dados profissionais",
};

function isVazio(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim().length === 0;
  return false;
}

/** Retorna apenas os campos faltantes (incluindo opcionais). */
export function getCamposFaltantesCadastro(cliente: any): CampoCadastro[] {
  if (!cliente) return CAMPOS_CADASTRO;
  return CAMPOS_CADASTRO.filter((c) => isVazio(cliente?.[c.key]));
}

/** Apenas campos cruciais faltando (define se cadastro está "incompleto"). */
export function getCamposCruciaisFaltantes(cliente: any): CampoCadastro[] {
  return getCamposFaltantesCadastro(cliente).filter((c) => c.crucial);
}

export function cadastroEstaIncompleto(cliente: any): boolean {
  return getCamposCruciaisFaltantes(cliente).length > 0;
}

/** Percentual 0-100 de campos preenchidos (todos os campos, não só cruciais). */
export function calcularProgressoCadastro(cliente: any): number {
  const total = CAMPOS_CADASTRO.length;
  const faltando = getCamposFaltantesCadastro(cliente).length;
  return Math.max(0, Math.min(100, Math.round(((total - faltando) / total) * 100)));
}

/** Descrição curta dos itens faltantes para mostrar em CTAs. */
export function resumoFaltantesCadastro(cliente: any): string {
  const faltam = getCamposCruciaisFaltantes(cliente);
  if (faltam.length === 0) return "Cadastro completo.";
  const nomes = faltam.slice(0, 3).map((c) => c.label.toLowerCase());
  const sobra = faltam.length - nomes.length;
  const base = nomes.join(", ");
  return sobra > 0 ? `${base} e mais ${sobra} item(ns).` : `${base}.`;
}

// ---------------------------------------------------------------------------
// computeCadastroCompleteness — usado pelo painel admin (QAClientesPage) para
// exibir contadores por seção da aba "Dados". Mantém a contract estável.
// ---------------------------------------------------------------------------
export interface SecaoCount {
  preenchidos: number;
  total: number;
}

export interface CadastroCompleteness {
  preenchidos: number;
  total: number;
  secoes: {
    identificacao: SecaoCount;
    filiacao: SecaoCount;
    contato: SecaoCount;
    endereco: SecaoCount;
    responsavelEndereco?: SecaoCount;
    segundoEndereco?: SecaoCount;
    complementares: SecaoCount;
  };
}

function countFilled(cliente: any, keys: string[]): SecaoCount {
  const total = keys.length;
  const preenchidos = keys.reduce((acc, k) => (isVazio(cliente?.[k]) ? acc : acc + 1), 0);
  return { preenchidos, total };
}

const SECOES_KEYS = {
  identificacao: [
    "nome_completo", "cpf",
    "rg", "emissor_rg", "uf_emissor_rg", "expedicao_rg",
    "data_nascimento", "sexo",
    "naturalidade_municipio", "naturalidade_uf",
    "nacionalidade", "estado_civil", "profissao", "escolaridade", "titulo_eleitor",
  ],
  filiacao: ["nome_mae", "nome_pai"],
  contato: ["celular", "email"],
  endereco: ["endereco", "numero", "complemento", "bairro", "cep", "cidade", "estado"],
  segundoEndereco: ["endereco2", "numero2", "bairro2", "cep2", "cidade2", "estado2"],
  responsavelEndereco: [
    "responsavel_endereco_nome", "responsavel_endereco_cpf", "responsavel_endereco_rg_cin",
    "responsavel_endereco_telefone", "responsavel_endereco_vinculo",
    "responsavel_endereco_cep", "responsavel_endereco_logradouro", "responsavel_endereco_numero",
    "responsavel_endereco_bairro", "responsavel_endereco_cidade", "responsavel_endereco_estado",
    "responsavel_endereco_declaracao_path", "responsavel_endereco_comprovante_path",
  ],
  complementares: [
    "origem_cadastro", "created_at", "cadastro_publico_aplicado_em", "updated_at",
  ],
};

export function computeCadastroCompleteness(cliente: any): CadastroCompleteness {
  const identificacao = countFilled(cliente, SECOES_KEYS.identificacao);
  const filiacao = countFilled(cliente, SECOES_KEYS.filiacao);
  const contato = countFilled(cliente, SECOES_KEYS.contato);
  const endereco = countFilled(cliente, SECOES_KEYS.endereco);
  const complementares = countFilled(cliente, SECOES_KEYS.complementares);

  const temSegundoEndereco = !!(
    cliente?.endereco2 || cliente?.cidade2 || cliente?.cep2 || cliente?.end2_tipo
  );
  const segundoEndereco = temSegundoEndereco
    ? countFilled(cliente, SECOES_KEYS.segundoEndereco)
    : undefined;

  const exigeResponsavel =
    String(cliente?.comprovante_endereco_em_nome_proprio || "").toLowerCase() === "nao";
  const temDadosResponsavel = SECOES_KEYS.responsavelEndereco.some((k) => !isVazio(cliente?.[k]));
  const responsavelEndereco = exigeResponsavel || temDadosResponsavel
    ? countFilled(cliente, SECOES_KEYS.responsavelEndereco)
    : undefined;

  const sec = { identificacao, filiacao, contato, endereco, segundoEndereco, responsavelEndereco, complementares };
  let preenchidos = 0;
  let total = 0;
  for (const s of Object.values(sec)) {
    if (!s) continue;
    preenchidos += s.preenchidos;
    total += s.total;
  }
  return { preenchidos, total, secoes: sec as CadastroCompleteness["secoes"] };
}
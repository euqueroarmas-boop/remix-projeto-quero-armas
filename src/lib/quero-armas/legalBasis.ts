export const QA_BASE_LEGAL_NUCLEO = [
  "Lei nº 10.826/2003 (Estatuto do Desarmamento)",
  "Decreto nº 11.615/2023",
  "Decreto nº 12.345/2024",
] as const;

export const QA_BASE_LEGAL_SINARM_DEFESA_PESSOAL = [
  ...QA_BASE_LEGAL_NUCLEO,
  "Instrução Normativa nº 201/2021-DG/PF",
  "Ofício Circular nº 08/DELEARM",
] as const;

export const QA_BASE_LEGAL_SINARM_CAC = [
  ...QA_BASE_LEGAL_NUCLEO,
  "Instrução Normativa DG/PF nº 311/2025",
  "Instrução Normativa DG/PF nº 322/2025",
  "Portaria DG/PF nº 19.040/2025",
  "Portarias COLOG nº 166, 167 e 260",
  "Ofício Circular nº 08/DELEARM",
] as const;

export const QA_BASE_LEGAL_CURSO_E_MANUSEIO = [
  "Lei nº 10.826/2003 (referência ao manuseio responsável de arma de fogo)",
  "Instrução Normativa nº 111/2017-DG/DPF",
] as const;

export const QA_BASE_LEGAL_HOME_CARDS = [
  {
    code: "Lei 10.826/2003",
    name: "Estatuto do Desarmamento",
    desc:
      "Marco civil do armamento: registro, posse, comercialização, Sinarm, porte e crimes relacionados.",
  },
  {
    code: "Decreto 11.615/2023 + Decreto 12.345/2024",
    name: "Regulamento vigente",
    desc:
      "Regras e procedimentos de aquisição, registro, posse, porte, cadastro, munições, acessórios, caça excepcional, tiro desportivo, colecionamento e estruturação do Sinarm.",
  },
  {
    code: "IN DG/PF 201/2021",
    name: "Defesa pessoal · Sinarm",
    desc:
      "Procedimento operacional da Polícia Federal para aquisição, registro, posse, porte, cadastro e comercialização de armas de fogo e munições.",
  },
  {
    code: "IN DG/PF 311/2025 + IN 322/2025",
    name: "CAC · Sinarm-CAC",
    desc:
      "Disciplina as atividades de colecionamento, tiro desportivo e caça, com alteração posterior pela IN DG/PF 322/2025.",
  },
  {
    code: "Portarias COLOG 166, 167 e 260",
    name: "Atos COLOG",
    desc:
      "Base operacional complementar para tratamento de acervo, PCE e transições regulatórias relacionadas ao universo CAC.",
  },
  {
    code: "Ofício Circular 08/DELEARM",
    name: "Orientação DELEARM",
    desc:
      "Referência administrativa complementar para leitura operacional de exigências e procedimentos em defesa pessoal e CAC.",
  },
] as const;

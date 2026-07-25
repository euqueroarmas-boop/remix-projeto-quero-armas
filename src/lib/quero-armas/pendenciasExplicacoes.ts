// ============================================================================
// pendenciasExplicacoes.ts
// ----------------------------------------------------------------------------
// Copy curto por tipo de pendência, exibido no PendenciasGuiadasPopup.
// Substitui, na Fase 1, o texto instrucional do wizard antigo para cada
// exigência documental. Mantém a linguagem do assistente: título objetivo +
// 1 parágrafo explicando o que enviar. Fallback genérico cobre tipos sem
// entrada explícita.
// ============================================================================

export interface ExplicacaoPendencia {
  titulo: string;
  passos: string[];
  observacao?: string;
}

const REGISTRO: Record<string, ExplicacaoPendencia> = {
  // ────────────────────────────────────────────────────────────────────────
  // Requerimento / formulários do processo
  // ────────────────────────────────────────────────────────────────────────
  requerimento_de_posse_de_arma_de_fogo: {
    titulo: "Requerimento de Posse de Arma de Fogo",
    passos: [
      "Baixe o modelo do requerimento no Hub Documental (aba \"Baixar modelo\").",
      "Preencha com sua letra ou digite, assine e escaneie em PDF.",
      "Envie o PDF assinado — a IA confere se os dados batem com seu cadastro.",
    ],
    observacao: "Este é o formulário oficial que instrui o processo perante a Polícia Federal.",
  },
  declaracao_necessidade_efetiva: {
    titulo: "Declaração de efetiva necessidade",
    passos: [
      "Baixe o modelo no Hub Documental e preencha com o motivo real da posse.",
      "Assine (à mão ou via Gov.br) e envie o PDF.",
    ],
    observacao: "A justificativa precisa ser coerente com o serviço contratado.",
  },
  declaracao_compromisso_treino: {
    titulo: "Declaração de compromisso de treino",
    passos: [
      "Baixe o modelo padrão do sistema no Hub Documental.",
      "Assine e envie o PDF — não altere o texto do modelo.",
    ],
  },
  declaracao_compromisso_habitualidade: {
    titulo: "Declaração de compromisso de habitualidade",
    passos: [
      "Baixe o modelo no Hub Documental, assine e envie o PDF.",
      "Se ainda não é filiado a clube, faça isso antes de assinar.",
    ],
  },
  declaracao_habitualidade_clube: {
    titulo: "Declaração de habitualidade emitida pelo clube",
    passos: [
      "Solicite a declaração ao seu clube de tiro atestando frequência mínima de treinos.",
      "Envie o PDF assinado pelo clube (carimbo/assinatura do responsável).",
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Perguntas condicionais (o cliente responde no Hub, não é upload)
  // ────────────────────────────────────────────────────────────────────────
  pergunta_ainda_reside_imovel: {
    titulo: "Confirmação: você ainda reside neste imóvel?",
    passos: [
      "Responda Sim ou Não direto neste passo, nos botões abaixo.",
      "Se Sim, seguimos com o comprovante em nome de terceiro + documento do titular.",
      "Se Não, você será orientado a enviar um comprovante em seu nome.",
    ],
  },
  pergunta_comprovante_em_nome: {
    titulo: "Confirmação: o comprovante está no seu nome?",
    passos: [
      "Responda Sim ou Não direto neste passo.",
      "Se Não, seguimos com um pequeno questionário sobre o titular (estado civil e profissão) e o documento de identidade dele.",
    ],
  },
  pergunta_titular_estado_civil: {
    titulo: "Estado civil do titular do comprovante",
    passos: [
      "Escolha o estado civil da pessoa em cujo nome está o comprovante de residência.",
      "O sistema usa essa informação para emitir a declaração de residência que ele(a) vai assinar.",
    ],
    observacao: "Nós geramos a declaração pronta — o titular só assina. Você não precisa redigir nada.",
  },
  pergunta_titular_profissao: {
    titulo: "Profissão do titular do comprovante",
    passos: [
      "Escolha a categoria profissional que mais se aproxima da ocupação do titular.",
      "Essa informação entra na declaração de residência que emitiremos para ele(a) assinar.",
    ],
  },
  pergunta_responde_inquerito_criminal: {
    titulo: "Confirmação: você responde a inquérito/processo criminal?",
    passos: [
      "Responda Sim ou Não direto neste passo, nos botões abaixo.",
      "Se Não, o sistema gera a declaração automaticamente para você assinar.",
    ],
  },
  renda_definir_condicao: {
    titulo: "Defina sua condição profissional",
    passos: [
      "Escolha aqui mesmo uma das opções: CLT, servidor público (área geral), servidor de segurança pública (PM, PC, PF, PRF, Guarda, Bombeiro, agente penitenciário), autônomo/MEI, empresário/sócio ou aposentado/pensionista.",
      "Se já preencheu sua profissão no cadastro, a opção correta vem pré-selecionada — só confirme.",
      "A partir da escolha, o sistema pede automaticamente os comprovantes certos (holerite, funcional, cartão CNPJ, extrato INSS etc.).",
      "Em dúvida entre duas opções? Escolha a que mais se aproxima — a equipe revisa e ajusta se necessário.",
    ],
    observacao: "Servidor de segurança pública é uma categoria própria e substitui o holerite pela cópia da carteira funcional. Aposentado envia o extrato do benefício no lugar do holerite.",
  },

  // ────────────────────────────────────────────────────────────────────────
  // Terceiros / imóvel
  // ────────────────────────────────────────────────────────────────────────
  documento_identificacao_terceiro: {
    titulo: "Documento de identidade do titular do comprovante",
    passos: [
      "Se o comprovante de residência está em nome de outra pessoa, envie um documento oficial dela (RG/CNH/CIN).",
      "Frente e verso, legível, dentro da validade.",
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Empresa / renda (variantes específicas do checklist)
  // ────────────────────────────────────────────────────────────────────────
  renda_nf_empresa: {
    titulo: "Nota fiscal emitida pela sua empresa",
    passos: [
      "Acesse o emissor de NFe da prefeitura (NFS-e) ou da SEFAZ do estado (NF-e), com login da empresa.",
      "Selecione uma nota emitida nos últimos 90 dias para qualquer cliente.",
      "Baixe o DANFE ou o PDF da NFS-e — os dois formatos servem.",
      "Confira que aparecem: razão social + CNPJ da sua empresa, valor da nota e data de emissão.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF.",
    ],
    observacao: "Serve como comprovação de atividade e faturamento. Se a empresa não emitiu nota nos últimos 90 dias, envie também o QSA para reforçar a comprovação.",
  },
  renda_qsa: {
    titulo: "QSA — Quadro de Sócios e Administradores",
    passos: [
      "Abra o site da Receita Federal no botão abaixo, digite o CNPJ (só números) e marque \"Não sou robô\".",
      "Clique em \"Emitir Comprovante de Inscrição e de Situação Cadastral\" (mesma página do Cartão CNPJ).",
      "Role a página até a seção \"QUADRO DE SÓCIOS E ADMINISTRADORES (QSA)\", que fica depois dos dados cadastrais.",
      "Clique em \"Imprimir\" (canto superior direito) e escolha \"Salvar como PDF\".",
      "Confira que o seu nome aparece listado como sócio/administrador e envie aqui em \"Entregar documento\".",
    ],
    observacao: "É a mesma página do Cartão CNPJ, mas o que a PF exige aqui é o bloco QSA com o seu nome como sócio. Emissão dos últimos 30 dias.",
  },

  // ────────────────────────────────────────────────────────────────────────
  // Certidões — variantes do catálogo do checklist
  // ────────────────────────────────────────────────────────────────────────
  certidao_antecedentes_criminais_eleitoral: {
    titulo: "Antecedentes criminais — Justiça Eleitoral (TSE)",
    passos: [
      "Abra o site do TSE no botão \"Acessar site de emissão\" logo abaixo.",
      "No formulário, escolha \"Pessoa Física\" e informe seu CPF, nome completo, nome da mãe e data de nascimento — exatamente como estão no título de eleitor.",
      "Marque \"Não sou robô\" e clique em \"Emitir Certidão\".",
      "A certidão abre em nova aba em PDF — clique no ícone de download (seta pra baixo) e salve o arquivo original, sem imprimir e escanear.",
      "Confira que aparece seu nome completo, CPF e o resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Validade de 90 dias a partir da emissão. Não altere o PDF — a IA valida a assinatura digital do TSE e reprova arquivos escaneados ou reimpressos.",
  },
  certidao_antecedentes_criminais_estadual: {
    titulo: "Antecedentes criminais — Justiça Estadual",
    passos: [
      "Abra o portal do Tribunal de Justiça do seu estado (em SP, é o e-SAJ do TJSP) pelo botão \"Acessar site de emissão\".",
      "Procure \"Certidões\" → \"Certidão de Antecedentes Criminais\" (ou \"Distribuição Criminal\", conforme o estado).",
      "Preencha CPF, nome completo, nome da mãe, data de nascimento e RG. Selecione a comarca/foro da sua cidade.",
      "Confirme a emissão. A certidão abre em PDF em nova aba — baixe pelo ícone de download.",
      "Confira que aparece seu nome, CPF, comarca e o resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Validade de 90 dias. Envie o PDF original — não imprima e escaneie, senão a assinatura digital do TJ quebra.",
  },
  certidao_antecedentes_criminais_federal: {
    titulo: "Antecedentes criminais — Justiça Federal",
    passos: [
      "Abra o portal da Justiça Federal da sua região (em SP, é o TRF3) pelo botão \"Acessar site de emissão\".",
      "Clique em \"Serviços\" → \"Certidões\" → \"Certidão de Distribuição Criminal\".",
      "Preencha CPF, nome completo, nome da mãe e data de nascimento — exatamente como no RG/CPF.",
      "Escolha a abrangência conforme solicitado (Regional ou Seção Judiciária) e confirme.",
      "A certidão abre em PDF — baixe pelo ícone de download e salve o arquivo original.",
      "Confira que aparece seu nome, CPF, abrangência e o resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF sem alterações.",
    ],
    observacao: "Validade de 90 dias. Envie o PDF assinado digitalmente — reimpressões escaneadas são reprovadas pela IA.",
  },
  certidao_antecedentes_criminais_militar: {
    titulo: "Antecedentes criminais — Justiça Militar",
    passos: [
      "Abra o portal do STM (federal) ou TJM-SP (estadual) pelo botão \"Acessar site de emissão\", conforme o que a PF solicitou.",
      "Clique em \"Certidão Negativa\" no menu do topo.",
      "Preencha CPF, nome completo, nome da mãe e data de nascimento exatamente como no RG.",
      "Marque \"Não sou robô\" e clique em \"Emitir Certidão\".",
      "A certidão abre em PDF em nova aba — baixe pelo ícone de download.",
      "Confira que aparece seu nome, CPF e o resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Validade de 90 dias. Não imprima e escaneie — envie o PDF original com a assinatura digital.",
  },
  certidao_antecedentes_policia_civil_sp: {
    titulo: "Antecedentes — Polícia Civil/SP",
    passos: [
      "Abra o site da Polícia Civil de SP no botão \"Acessar site de emissão\" logo abaixo.",
      "Clique em \"Solicitar Atestado de Antecedentes Criminais\" no bloco central da página.",
      "Faça login com sua conta Gov.br (a mesma do INSS/Receita). Se não tiver, crie na hora com CPF.",
      "Confira nome, CPF e RG que aparecem preenchidos e clique em \"Solicitar\".",
      "O atestado abre em nova aba em PDF — clique no ícone de download (seta pra baixo) e salve o arquivo.",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Validade de 90 dias a partir da emissão. Não imprima e escaneie — envie o PDF original, senão a assinatura digital quebra e a IA reprova.",
  },
  certidao_crimes_eleitorais_tse: {
    titulo: "Crimes eleitorais — TSE",
    passos: [
      "Abra o site do TSE no botão \"Acessar site de emissão\" logo abaixo.",
      "No campo \"Nome\", digite seu nome completo exatamente como está no título de eleitor.",
      "Preencha data de nascimento, nome da mãe e clique em \"Emitir Certidão\".",
      "A certidão abre em PDF em nova aba — clique no ícone de download e salve o arquivo.",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF sem alterações.",
    ],
    observacao: "Validade de 90 dias. O TSE às vezes fica fora do ar à noite — se der erro, tente pela manhã.",
  },
  certidao_crimes_militares_stm: {
    titulo: "Crimes militares — STM",
    passos: [
      "Abra o portal do STM no botão \"Acessar site de emissão\" logo abaixo.",
      "Clique em \"Certidão Negativa\" no menu do topo.",
      "Preencha CPF, nome completo, nome da mãe e data de nascimento exatamente como no RG.",
      "Marque \"Não sou robô\" e clique em \"Emitir Certidão\".",
      "A certidão abre em PDF — baixe pelo ícone de download e salve no seu dispositivo.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF.",
    ],
    observacao: "Validade de 90 dias. Cuidado: qualquer letra errada no nome da mãe reprova a emissão — copie do RG.",
  },
  certidao_criminal_tjmsp: {
    titulo: "Certidão criminal — TJM-SP",
    passos: [
      "Abra o portal do TJM-SP no botão \"Acessar site de emissão\" logo abaixo.",
      "Clique em \"Certidões\" no menu lateral e depois em \"Certidão de Objeto e Pé / Nada Consta\".",
      "Preencha CPF, nome completo e RG. Marque \"Não sou robô\".",
      "Clique em \"Emitir\" — a certidão abre em PDF em nova aba.",
      "Baixe o PDF pelo ícone de download (não use \"Imprimir → Salvar como PDF\", quebra a assinatura).",
      "Volte aqui e clique em \"Entregar documento\" para enviar.",
    ],
    observacao: "Validade de 90 dias. Só é exigida para clientes em SP — se não é seu caso, avise seu consultor.",
  },
  certidao_estadual_distribuicao_acoes_criminais: {
    titulo: "Estadual — Distribuição de ações criminais",
    passos: [
      "Emita no portal do Tribunal de Justiça a certidão de distribuição criminal.",
      "Não envie a de execuções — são certidões distintas.",
    ],
  },
  certidao_estadual_execucoes_criminais: {
    titulo: "Estadual — Execuções criminais",
    passos: [
      "Emita no portal do Tribunal de Justiça a certidão de execuções criminais.",
      "Não envie a de distribuição — são certidões distintas.",
    ],
  },
  certidao_estadual_segundo_grau_acoes_criminais: {
    titulo: "Estadual — Segundo grau, ações criminais",
    passos: [
      "Emita a certidão de segundo grau (Tribunal) para ações criminais.",
    ],
  },
  certidao_estadual_segundo_grau_execucoes_criminais: {
    titulo: "Estadual — Segundo grau, execuções criminais",
    passos: [
      "Emita a certidão de segundo grau (Tribunal) para execuções criminais.",
    ],
  },
  certidao_federal_trf3_regional: {
    titulo: "TRF3 — Regional",
    passos: [
      "Abra o portal do TRF3 no botão \"Acessar site de emissão\" logo abaixo.",
      "Em \"Tipo de Certidão\" selecione \"Regional\" (cobre SP + MS).",
      "Em \"Abrangência\" marque \"Criminal\" (não marque cível).",
      "Preencha CPF, nome completo e nome da mãe exatamente como no RG e clique em \"Emitir\".",
      "A certidão abre em PDF — baixe pelo ícone de download (seta pra baixo) e salve o arquivo.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF original.",
    ],
    observacao: "Validade de 90 dias. É uma certidão diferente da SJSP/JEF — as duas são exigidas separadamente pela PF.",
  },
  certidao_federal_trf3_sjsp_jef: {
    titulo: "TRF3 — SJSP / JEF",
    passos: [
      "Abra o portal do TRF3 no botão \"Acessar site de emissão\" logo abaixo.",
      "Em \"Tipo de Certidão\" selecione \"Seção Judiciária de São Paulo (SJSP)\" — inclui o JEF.",
      "Em \"Abrangência\" marque \"Criminal\".",
      "Preencha CPF, nome completo e nome da mãe e clique em \"Emitir\".",
      "A certidão abre em PDF — baixe pelo ícone de download e salve no seu dispositivo.",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF original.",
    ],
    observacao: "Validade de 90 dias. É COMPLEMENTAR à certidão Regional do TRF3 — não substitui, a PF exige as duas.",
  },
  certidao_tjsp_distribuicao_criminal: {
    titulo: "TJSP — Distribuição criminal",
    passos: [
      "Abra o portal do TJSP no botão \"Acessar site de emissão\" logo abaixo.",
      "Clique em \"Certidões\" no menu superior e escolha \"Certidão de Distribuição\" (Estadual 1º Grau).",
      "Em \"Foro\" marque \"Todos\", em \"Modelo de Certidão\" escolha \"Ações Criminais, Execuções Criminais...\" e em \"Tipo\" marque \"Distribuições — Ações\".",
      "Preencha CPF, nome completo e RG exatamente como no documento oficial.",
      "Clique em \"Pesquisar\" — a certidão abre em PDF em nova aba.",
      "Baixe pelo ícone de download (não use imprimir) e envie aqui em \"Entregar documento\".",
    ],
    observacao: "Validade de 90 dias. É a certidão de DISTRIBUIÇÃO — não confunda com a de Execuções, que é pedida separadamente e reprova se enviada aqui.",
  },
  certidao_tjsp_execucoes_criminais: {
    titulo: "TJSP — Execuções criminais",
    passos: [
      "Abra o portal do TJSP no botão \"Acessar site de emissão\" logo abaixo.",
      "Clique em \"Certidões\" no menu superior e escolha \"Certidão de Distribuição\" (Estadual 1º Grau).",
      "Em \"Foro\" marque \"Todos\", em \"Modelo\" escolha \"Ações Criminais, Execuções Criminais...\" e em \"Tipo\" marque \"Execuções Criminais\".",
      "Preencha CPF, nome completo e RG e clique em \"Pesquisar\".",
      "A certidão abre em PDF — baixe pelo ícone de download e salve no dispositivo.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF original.",
    ],
    observacao: "Validade de 90 dias. É a certidão de EXECUÇÕES — diferente da de Distribuição. Se trocar, a IA reprova automaticamente.",
  },

  // ────────────────────────────────────────────────────────────────────────
  // Endereço por ano (comprovante_endereco_ano_XXXX)
  // ────────────────────────────────────────────────────────────────────────
  comprovante_endereco_ano_2022: {
    titulo: "Comprovante de endereço — Ano 2022",
    passos: [
      "Envie uma conta (luz, água, gás, internet, telefone) emitida em 2022.",
      "O documento comprova o histórico de residência exigido pela PF.",
    ],
  },
  comprovante_endereco_ano_2023: {
    titulo: "Comprovante de endereço — Ano 2023",
    passos: [
      "Envie uma conta (luz, água, gás, internet, telefone) emitida em 2023.",
    ],
  },
  comprovante_endereco_ano_2024: {
    titulo: "Comprovante de endereço — Ano 2024",
    passos: [
      "Envie uma conta (luz, água, gás, internet, telefone) emitida em 2024.",
    ],
  },
  comprovante_endereco_ano_2025: {
    titulo: "Comprovante de endereço — Ano 2025",
    passos: [
      "Envie uma conta (luz, água, gás, internet, telefone) emitida em 2025.",
    ],
  },
  comprovante_endereco_ano_2026: {
    titulo: "Comprovante de endereço — Ano 2026",
    passos: [
      "Envie uma conta (luz, água, gás, internet, telefone) emitida em 2026.",
      "Deve ser recente — preferencialmente do mês atual.",
    ],
  },
  comprovante_endereco_ano_2027: {
    titulo: "Comprovante de endereço — Ano 2027",
    passos: [
      "Envie uma conta recente (luz, água, gás, internet, telefone) emitida em 2027.",
    ],
  },
  comprovante_filiacao_entidade_tiro: {
    titulo: "Comprovante de filiação ativa ao clube/entidade de tiro",
    passos: [
      "Envie a carteirinha, contrato ou declaração do clube atestando filiação vigente.",
      "Deve estar dentro do prazo de validade.",
    ],
  },

  // Identidade
  cin: {
    titulo: "Documento oficial de identidade",
    passos: [
      "Envie um documento oficial com foto, CPF e data de nascimento (CIN, RG com CPF ou CNH).",
      "O arquivo deve estar legível, colorido e mostrar frente e verso.",
    ],
    observacao: "Aceita-se PDF ou foto nítida do documento original.",
  },
  rg_com_cpf: {
    titulo: "RG com CPF (ou CIN)",
    passos: [
      "Envie o RG com CPF impresso (frente e verso) ou a nova CIN.",
      "O documento deve estar dentro da validade e sem cortes.",
    ],
  },
  cnh: {
    titulo: "CNH válida",
    passos: [
      "Envie a CNH dentro do prazo de validade, frente e verso.",
      "Aceita-se a CNH digital exportada em PDF pelo aplicativo oficial.",
    ],
  },
  cpf: {
    titulo: "Comprovante de CPF",
    passos: [
      "Envie o comprovante de situação cadastral emitido no site da Receita Federal.",
    ],
  },

  // Endereço
  comprovante_residencia: {
    titulo: "Comprovante de residência atual",
    passos: [
      "Envie conta de luz, água, gás, internet ou telefone em seu nome.",
      "A emissão deve ser recente — o sistema aceita contas emitidas há até 30 dias.",
    ],
    observacao: "Se a conta não estiver no seu nome, envie também uma declaração do titular.",
  },
  declaracao_responsavel_imovel: {
    titulo: "Declaração do titular do imóvel",
    passos: [
      "Se a conta de residência não está no seu nome, o titular precisa assinar uma declaração.",
      "Envie o modelo assinado (fisicamente ou via Gov.br) junto com o documento do titular.",
    ],
  },

  // Antecedentes
  antecedentes_criminais: {
    titulo: "Antecedentes criminais — Polícia Civil",
    passos: [
      "Abra o site da Polícia Civil do seu estado pelo botão \"Acessar site de emissão\" logo abaixo.",
      "Procure por \"Atestado de Antecedentes Criminais\" e clique em \"Solicitar\".",
      "Faça login com sua conta Gov.br (a mesma do INSS/Receita). Se não tiver, crie na hora com CPF.",
      "Confira nome, CPF e RG preenchidos automaticamente e clique em \"Emitir\".",
      "O atestado abre em PDF em nova aba — clique no ícone de download (seta pra baixo) e salve o arquivo.",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Validade de 90 dias. Não imprima e escaneie — envie o PDF original, senão a assinatura digital quebra e a IA reprova.",
  },
  antecedentes_federal: {
    titulo: "Antecedentes federais — Justiça Federal",
    passos: [
      "Abra o portal da Justiça Federal da sua região (em SP, é o TRF3) pelo botão \"Acessar site de emissão\".",
      "Clique em \"Serviços\" → \"Certidões\" → \"Certidão de Distribuição Criminal\".",
      "Preencha CPF, nome completo, nome da mãe e data de nascimento — exatamente como no RG/CPF.",
      "Confirme a emissão. A certidão abre em PDF em nova aba — baixe pelo ícone de download.",
      "Confira que aparece seu nome, CPF, abrangência e o resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF sem alterações.",
    ],
    observacao: "Validade de 90 dias. Envie o PDF original com assinatura digital — reimpressões escaneadas são reprovadas.",
  },
  antecedentes_federal_trf3_regional: {
    titulo: "Certidão TRF3 — Regional",
    passos: [
      "Abra o portal do TRF3 pelo botão \"Acessar site de emissão\" logo abaixo.",
      "Vá em \"Serviços\" → \"Certidões\" → \"Certidão de Distribuição\".",
      "Selecione a abrangência \"Regional\" (cobre todos os estados do TRF3: SP e MS).",
      "Preencha CPF, nome completo, nome da mãe e data de nascimento.",
      "Confirme e baixe o PDF pelo ícone de download.",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF original.",
    ],
    observacao: "Validade de 90 dias. Não confundir com SJSP/JEF — a Regional cobre toda a região; a SJSP cobre só a Seção Judiciária de SP.",
  },
  antecedentes_federal_sjsp_jef: {
    titulo: "Certidão SJSP / JEF",
    passos: [
      "Abra o portal do TRF3 pelo botão \"Acessar site de emissão\" logo abaixo.",
      "Vá em \"Serviços\" → \"Certidões\" → \"Certidão de Distribuição\".",
      "Selecione a abrangência \"Seção Judiciária de São Paulo (SJSP)\" e marque também o \"Juizado Especial Federal (JEF)\".",
      "Preencha CPF, nome completo, nome da mãe e data de nascimento.",
      "Confirme e baixe o PDF pelo ícone de download.",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF original.",
    ],
    observacao: "Validade de 90 dias. É diferente da certidão Regional — esta cobre apenas a SJSP + JEF.",
  },
  antecedentes_estadual: {
    titulo: "Antecedentes estaduais",
    passos: [
      "Abra o portal do TJ do seu estado (em SP é o e-SAJ do TJSP) pelo botão \"Acessar site de emissão\".",
      "Vá em \"Certidões\" → \"Certidão de Distribuição Criminal\".",
      "Preencha CPF, nome completo, nome da mãe, data de nascimento e RG. Selecione a comarca da sua cidade.",
      "Confirme a emissão e baixe o PDF pelo ícone de download.",
      "Confira que aparece seu nome, CPF, comarca e o resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Validade de 90 dias. Envie o PDF original — não imprima e escaneie.",
  },
  antecedentes_estadual_distribuicao: {
    titulo: "TJSP — Distribuição criminal",
    passos: [
      "Abra o portal e-SAJ do TJSP pelo botão \"Acessar site de emissão\".",
      "Vá em \"Certidões\" → \"Certidão de Distribuição Criminal\".",
      "Preencha CPF, nome completo, nome da mãe, data de nascimento e RG. Selecione a comarca da sua cidade.",
      "Confirme e baixe o PDF pelo ícone de download.",
      "Confira que o cabeçalho diz \"DISTRIBUIÇÃO CRIMINAL\" (não \"EXECUÇÕES\") e resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF original.",
    ],
    observacao: "Cuidado: no TJSP existem duas certidões parecidas — esta é a de DISTRIBUIÇÃO. Não envie a de EXECUÇÕES aqui, é outro passo.",
  },
  antecedentes_estadual_execucoes: {
    titulo: "TJSP — Execuções criminais",
    passos: [
      "Abra o portal e-SAJ do TJSP pelo botão \"Acessar site de emissão\".",
      "Vá em \"Certidões\" → \"Certidão de Execuções Criminais\".",
      "Preencha CPF, nome completo, nome da mãe, data de nascimento e RG. Selecione a comarca da sua cidade.",
      "Confirme e baixe o PDF pelo ícone de download.",
      "Confira que o cabeçalho diz \"EXECUÇÕES CRIMINAIS\" (não \"DISTRIBUIÇÃO\") e resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF original.",
    ],
    observacao: "Cuidado: esta é a certidão de EXECUÇÕES. A de DISTRIBUIÇÃO é emitida no mesmo portal, mas é outro passo do checklist.",
  },
  antecedentes_militar: {
    titulo: "Justiça Militar",
    passos: [
      "Abra o portal do STM (federal) ou TJM-SP (estadual) pelo botão \"Acessar site de emissão\", conforme o que a PF solicitou.",
      "Clique em \"Certidão Negativa\" no menu do topo.",
      "Preencha CPF, nome completo, nome da mãe e data de nascimento exatamente como no RG.",
      "Marque \"Não sou robô\" e clique em \"Emitir Certidão\".",
      "Baixe o PDF pelo ícone de download e confira o resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Validade de 90 dias. Envie o PDF original com assinatura digital.",
  },
  antecedentes_eleitoral: {
    titulo: "Crimes eleitorais — TSE",
    passos: [
      "Abra o site do TSE pelo botão \"Acessar site de emissão\" logo abaixo.",
      "Escolha \"Pessoa Física\" e preencha CPF, nome completo, nome da mãe e data de nascimento — exatamente como no título de eleitor.",
      "Marque \"Não sou robô\" e clique em \"Emitir Certidão\".",
      "A certidão abre em PDF em nova aba — baixe pelo ícone de download.",
      "Confira que aparece seu nome, CPF e o resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Validade de 90 dias. O TSE às vezes fica fora do ar à noite — se der erro, tente pela manhã.",
  },

  // Renda
  renda_holerite_mes_atual: {
    titulo: "Holerite atual",
    passos: [
      "Acesse o portal/app do RH da sua empresa (Portal do Colaborador, Senior, TOTVS, ADP etc.) usando seu login corporativo.",
      "Vá em \"Holerite\", \"Contracheque\" ou \"Recibo de Pagamento\" e selecione o mês vigente (ou o anterior, se o do mês ainda não saiu).",
      "Clique em \"Baixar PDF\" ou no ícone de download — não use \"Imprimir → Salvar como PDF\" (pode remover a assinatura).",
      "Confira que aparece seu nome completo, CPF, nome da empresa, competência (mês/ano) e o valor líquido recebido.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF original.",
    ],
    observacao: "Aceitamos apenas holerite do mês atual ou do mês anterior. Prints de tela e fotos do holerite físico são reprovados — precisa ser o PDF baixado do sistema do RH.",
  },
  renda_holerite_funcionario_publico: {
    titulo: "Contracheque — servidor público",
    passos: [
      "Acesse o sistema de RH do seu órgão: SIGEPE (federal), SIGRH (estadual) ou o portal do servidor do seu município/estado.",
      "Faça login com sua matrícula e senha (ou Gov.br, dependendo do órgão).",
      "Vá em \"Contracheque\", \"Ficha Financeira\" ou \"Recibo de Pagamento\" e selecione o mês vigente.",
      "Clique em \"Baixar PDF\" ou no ícone de download — o arquivo já vem assinado digitalmente pelo órgão.",
      "Confira nome, CPF, matrícula, órgão/lotação e valor líquido antes de enviar.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF original.",
    ],
    observacao: "Se você é servidor de segurança pública (PM, PC, PF, PRF, Guarda, Bombeiro, agente penitenciário), envie TAMBÉM a cópia da carteira funcional no item específico — o contracheque sozinho não substitui.",
  },
  renda_funcional_seguranca_publica: {
    titulo: "Carteira funcional — servidor de segurança pública",
    passos: [
      "Separe sua carteira funcional oficial (PM, PC, PF, PRF, Guarda Municipal, Bombeiro Militar, Polícia Penal etc.).",
      "Tire foto NÍTIDA da frente e do verso, com boa iluminação e sem cortes nas bordas.",
      "Se tiver a versão digital no app oficial do seu órgão, exporte em PDF direto pelo app (dá pra encontrar em \"Compartilhar\" ou \"Exportar\").",
      "Confira que aparece o nome completo, matrícula, cargo/patente, órgão e data de validade legíveis.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o arquivo (PDF ou foto).",
    ],
    observacao: "Substitui o holerite comum para servidores de segurança pública. Se a funcional estiver vencida, envie também o contracheque do mês atual até renovar. Documentos borrados ou com dados cortados são reprovados automaticamente.",
  },
  renda_aposentado_extrato_beneficio: {
    titulo: "Aposentado ou pensionista — extrato do benefício",
    passos: [
      "Se é aposentado/pensionista do INSS: entre no Meu INSS (app ou meu.inss.gov.br) com Gov.br, vá em \"Extrato de Pagamento de Benefício\" e baixe o PDF do mês atual.",
      "Se é aposentado do serviço público: entre no SIGEPE (federal) ou no portal do servidor do seu estado/município e baixe o contracheque de aposentadoria do mês atual.",
      "Se é militar da reserva/reformado: acesse o portal do órgão (Exército, PM, Marinha, Aeronáutica) e baixe o contracheque do mês atual.",
      "Confira que aparece seu nome, CPF, número do benefício/matrícula e o valor líquido recebido.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF original.",
    ],
    observacao: "Não envie prints do app nem fotos do canhoto do banco. Precisa ser o PDF oficial baixado direto do sistema do INSS ou do órgão pagador, do mês vigente ou do anterior.",
  },
  renda_cartao_cnpj: {
    titulo: "Cartão CNPJ",
    passos: [
      "Abra o site da Receita Federal no botão abaixo, digite o CNPJ (só números) e marque \"Não sou robô\".",
      "Clique em \"Emitir Comprovante de Inscrição e de Situação Cadastral\".",
      "Na página aberta, use \"Imprimir\" → \"Salvar como PDF\".",
      "Envie o PDF aqui em \"Entregar documento\".",
    ],
    observacao: "Emissão dos últimos 30 dias. Se o site der erro, tente novamente em alguns minutos.",
  },
  renda_cnpj_autonomo: {
    titulo: "Comprovante de atividade autônoma",
    passos: [
      "Se você é MEI: abra o Portal do Empreendedor no botão \"Acessar site de emissão\" logo abaixo.",
      "Clique em \"Já sou MEI\" → \"Emitir CCMEI\" (Certificado da Condição de Microempreendedor Individual).",
      "Faça login com sua conta Gov.br e clique em \"Emitir Certificado\" — o CCMEI abre em PDF em nova aba.",
      "Baixe pelo ícone de download e salve o arquivo.",
      "Se você é autônomo sem MEI: envie um contrato de prestação de serviço vigente (assinado pelas duas partes) ou 3 RPAs (recibos de profissional autônomo) dos últimos meses.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF.",
    ],
    observacao: "CCMEI tem validade de 90 dias — emita novo se o anterior está vencido. Sem MEI e sem contrato/RPA, use a opção \"autônomo\" no cadastro para o sistema orientar alternativas.",
  },
  renda_contrato_social: {
    titulo: "Contrato social",
    passos: [
      "Peça ao seu contador o Contrato Social CONSOLIDADO (versão mais recente, já com todas as alterações) ou o Requerimento de Empresário, se for EIRELI/empresário individual — ele consegue baixar direto na Junta Comercial em minutos.",
      "Se preferir emitir você mesmo, acesse o site da Junta Comercial do seu estado no botão abaixo (JUCESP em SP, JUCERJA no RJ, JUCEMG em MG etc.) e faça login com Gov.br.",
      "Procure por \"Requerimento Eletrônico\" ou \"Solicitar Documento\" → escolha \"Contrato/Estatuto Consolidado\" (ou \"Requerimento de Empresário\" para individual/EIRELI).",
      "Informe o NIRE ou o CNPJ, pague a taxa quando houver e baixe o PDF já com a capa/certidão emitida pela Junta.",
      "Confira que aparecem: razão social, CNPJ, sócios, capital social e a última alteração registrada. Envie aqui em \"Entregar documento\".",
      "Se a empresa é MEI, use a opção \"CCMEI\" no lugar — MEI não tem contrato social.",
    ],
    observacao: "Contratos antigos sem as últimas alterações são reprovados. Envie sempre a versão consolidada mais recente registrada na Junta Comercial — em dúvida, peça ao contador.",
  },
  renda_nf_recente: {
    titulo: "Notas fiscais recentes",
    passos: [
      "Acesse o emissor de NFe da sua prefeitura (para NFS-e) ou da SEFAZ do seu estado (para NF-e de produto), com login da empresa.",
      "Baixe as 3 últimas notas fiscais emitidas nos últimos 90 dias em PDF.",
      "Se são muitas notas, junte tudo em um único PDF (use ilovepdf.com → \"Juntar PDF\") antes de enviar.",
      "As notas devem comprovar faturamento recorrente da empresa.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF.",
    ],
    observacao: "Enviar apenas 1 nota antiga é reprovado — a ideia é comprovar atividade constante. Mínimo de 3 notas dos últimos 90 dias.",
  },
  renda_comprovante_beneficio: {
    titulo: "Comprovante de benefício",
    passos: [
      "Se é benefício do INSS (auxílio, pensão, BPC): entre no Meu INSS (app ou meu.inss.gov.br) com Gov.br e baixe o \"Extrato de Pagamento de Benefício\" do mês atual.",
      "Se é pensão militar ou funcional: acesse o portal do órgão pagador (Exército, SIGEPE, portal do servidor) e baixe o contracheque do mês atual.",
      "Confira que aparece: nome completo, CPF, número do benefício e valor líquido.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF original.",
    ],
    observacao: "Precisa ser do mês vigente ou do anterior. Prints do app ou canhoto do banco não são aceitos — só o PDF oficial baixado do sistema.",
  },
  renda_extrato_inss: {
    titulo: "Extrato do INSS",
    passos: [
      "Abra o site Meu INSS no botão \"Acessar site de emissão\" logo abaixo (ou baixe o app \"Meu INSS\").",
      "Faça login com sua conta Gov.br (mesma do TSE/Receita).",
      "No menu, clique em \"Extrato de Pagamento de Benefício\" ou em \"Extrato Previdenciário CNIS\", conforme solicitado.",
      "Selecione o benefício ativo e o mês vigente, clique em \"Baixar PDF\" ou no ícone de download.",
      "Confira nome, CPF, número do benefício e valor recebido antes de enviar.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF original.",
    ],
    observacao: "Aceito apenas o PDF baixado direto do Meu INSS, do mês vigente ou anterior. Prints de tela do app são reprovados.",
  },

  // Laudos
  laudo_psicologico: {
    titulo: "Laudo psicológico — profissional credenciado PF",
    passos: [
      "Agende o exame com um psicólogo credenciado pela Polícia Federal.",
      "O laudo deve conter QR Code ou assinatura digital do credenciado.",
    ],
    observacao: "Se ainda não escolheu um credenciado, use o botão de busca para ver profissionais próximos.",
  },
  laudo_capacidade_tecnica: {
    titulo: "Laudo de capacidade técnica — instrutor credenciado PF",
    passos: [
      "Agende o teste com um instrutor de tiro credenciado pela Polícia Federal.",
      "O laudo deve estar assinado digitalmente pelo instrutor.",
    ],
  },

  // Clube / habitualidade
  comprovante_clube_tiro: {
    titulo: "Comprovante de filiação a clube de tiro",
    passos: [
      "Envie o comprovante da sua filiação vigente ao clube de tiro (carteirinha, contrato ou declaração).",
    ],
  },
  comprovante_habitualidade: {
    titulo: "Comprovante de habitualidade",
    passos: [
      "Envie a declaração do clube atestando frequência mínima de treinos no período exigido.",
    ],
  },
  comprovante_competicao: {
    titulo: "Comprovante de competição",
    passos: [
      "Envie o boletim/resultado oficial da competição em que participou.",
    ],
  },

  // Efetiva necessidade / correlatos
  comprovante_efetiva_necessidade: {
    titulo: "Comprovante de efetiva necessidade",
    passos: [
      "Envie os documentos que comprovam a exposição ao risco justificando a posse/porte.",
    ],
  },
  documento_complementar_caso: {
    titulo: "Documento complementar do caso",
    passos: [
      "Envie o documento adicional solicitado pela equipe para este processo específico.",
    ],
  },
  declaracao_correlata: {
    titulo: "Declaração correlata",
    passos: [
      "Envie o modelo assinado da declaração correlata solicitada.",
    ],
  },
  declaracao_guarda_responsavel: {
    titulo: "Declaração de guarda responsável",
    passos: [
      "Envie a declaração assinada de que a arma será guardada em local seguro, longe de menores e incapazes.",
    ],
  },
  declaracao_guarda_acervo_1endereco: {
    titulo: "Declaração — acervo em um único endereço",
    passos: [
      "Envie a declaração assinada informando que todo o acervo está guardado no endereço cadastrado.",
    ],
  },
  declaracao_sem_inquerito_processo_criminal: {
    titulo: "Declaração — sem inquérito/processo criminal",
    passos: [
      "Envie a declaração assinada de que não responde a inquérito nem processo criminal.",
    ],
  },

  // Processo administrativo
  protocolo_processo: {
    titulo: "Protocolo do processo",
    passos: [
      "Envie o comprovante de protocolo gerado pelo órgão (PF ou Exército).",
    ],
  },
  oficio: {
    titulo: "Ofício",
    passos: [
      "Envie o ofício recebido do órgão para registrarmos e continuar a análise.",
    ],
  },
  despacho: {
    titulo: "Despacho",
    passos: [
      "Envie o despacho recebido do órgão para registrarmos e continuar a análise.",
    ],
  },
  exigencia: {
    titulo: "Exigência do órgão",
    passos: [
      "Envie o documento de exigência recebido do órgão para respondermos dentro do prazo.",
    ],
  },

  // Armas
  cr: {
    titulo: "Certificado de Registro (CR) — CAC",
    passos: [
      "Envie o CR atual emitido pelo Exército, dentro da validade.",
    ],
  },
  craf: {
    titulo: "CRAF / SIGMA",
    passos: [
      "Envie o CRAF/SIGMA emitido pelo Exército referente à arma.",
    ],
  },
  sinarm: {
    titulo: "SINARM",
    passos: [
      "Envie o registro SINARM emitido pela Polícia Federal referente à arma.",
    ],
  },
  gt: {
    titulo: "Guia de Tráfego (GT)",
    passos: [
      "Envie a GT emitida pelo Exército.",
    ],
  },
  gte: {
    titulo: "Guia de Tráfego Eventual (GTE)",
    passos: [
      "Envie a GTE emitida pelo Exército.",
    ],
  },
  autorizacao_compra: {
    titulo: "Autorização de compra",
    passos: [
      "Envie a autorização de compra deferida pela Polícia Federal ou pelo Exército.",
    ],
  },
  nota_fiscal_arma: {
    titulo: "Nota fiscal da arma",
    passos: [
      "Envie a nota fiscal emitida pela loja/importadora da arma.",
    ],
  },

  // Jurídicos assinados
  contrato_assinado: {
    titulo: "Contrato de adesão assinado (Gov.br)",
    passos: [
      "Baixe o contrato, assine com sua conta Gov.br (ou certificado ICP-Brasil) e envie o PDF assinado aqui.",
      "A IA valida a assinatura antes de liberar a próxima etapa.",
    ],
  },
  procuracao_assinada: {
    titulo: "Procuração assinada (Gov.br)",
    passos: [
      "Baixe a procuração, assine com Gov.br (ou ICP-Brasil) e envie o PDF assinado.",
      "A IA confere a assinatura antes de destravar o processo.",
    ],
  },
  procuracao: {
    titulo: "Procuração",
    passos: [
      "Envie a procuração assinada digitalmente (Gov.br ou ICP-Brasil).",
    ],
  },

  outro: {
    titulo: "Documento adicional",
    passos: [
      "Envie o documento solicitado no formato original (PDF ou foto legível).",
    ],
  },
};

export function getExplicacaoPendencia(
  rawTipo: string,
  fallbackNome?: string | null,
  hubTipoFallback?: string | null,
): ExplicacaoPendencia {
  const primary = String(rawTipo || "").trim().toLowerCase();
  const secondary = String(hubTipoFallback || "").trim().toLowerCase();
  const hit = REGISTRO[primary] || (secondary ? REGISTRO[secondary] : undefined);
  if (hit) return hit;
  const titulo = fallbackNome && fallbackNome.trim()
    ? fallbackNome.trim()
    : "Documento solicitado";
  return {
    titulo,
    passos: [
      "Envie o documento solicitado no formato original (PDF ou foto legível).",
      "A IA valida integridade e assinatura antes de aprovar.",
    ],
    observacao: "Se ficar em dúvida, abra o Hub Documental — a IA orienta o formato correto antes do envio.",
  };
}
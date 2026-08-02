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
  siteUrl?: string;
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
  /**
   * Efetiva necessidade — regra do usuário (31/07/2026): PRIMEIRO as provas,
   * DEPOIS a narrativa.
   *
   * O texto anterior mandava "baixe o modelo e escreva o motivo". Pedir a
   * justificativa no vazio é o que travava o cliente: ele não sabe o que
   * escrever, e o que ele escreveria sozinho raramente sustenta o pedido.
   *
   * As perguntas puxam o que ele JÁ TEM — boletim de ocorrência, inquérito,
   * ação criminal. Quem não tem prova nenhuma é que cai no relato detalhado.
   */
  declaracao_necessidade_efetiva: {
    titulo: "Declaração de efetiva necessidade",
    passos: [
      "Esta é a parte que mais reprova pedido de arma na Polícia Federal. E quase nunca é por falta de documento: é por justificativa vaga. \"Quero para defesa pessoal\" não sustenta um pedido — e é o que a maioria escreve.",
      "Você não vai escrever nada sozinho, nem baixar modelo. São perguntas, aqui mesmo, e nós redigimos a declaração com as suas respostas.",
      "Começamos pelo que você já tem: boletim de ocorrência, inquérito, ação criminal. Documento em nome de outra pessoa também vale — se ameaçaram sua esposa, seu filho ou um funcionário seu, a necessidade é sua também.",
      "Depois vêm os detalhes que constroem o caso: se você já foi ameaçado ou abordado, se alguém da família foi, o que você faz, se transporta dinheiro ou mercadoria, o horário em que costuma chegar em casa, a região onde mora ou trabalha.",
      "Quanto mais concreto, melhor. Data, lugar, o que aconteceu, quem estava com você. A Polícia Federal avalia risco REAL, não sensação de risco — e é o detalhe que separa os dois.",
      "No fim você lê a declaração pronta, aprova, e só então ela vai para o processo. Nada é enviado sem a sua confirmação.",
    ],
    observacao: "Prova vale mais que texto. Um boletim de ocorrência sustenta o pedido muito melhor do que qualquer justificativa bem escrita — por isso começamos por eles. Mas se você não tem nenhum, o relato ainda sustenta, desde que seja específico. Vago é o que reprova.",
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
  /**
   * Foto 3x4 — regra do usuário (31/07/2026), já registrada na biblioteca de
   * documentos: o cliente NÃO precisa ir a um fotógrafo. O documento digital
   * que ele já tem serve, e o recorte é feito no próprio celular.
   *
   * Sem estes passos o cliente lê "Foto 3x4 do requerente", pensa em estúdio
   * fotográfico e trava numa exigência que ele resolve em dois minutos.
   */
  foto_3x4: {
    titulo: "Foto 3x4 do requerente",
    passos: [
      "Você NÃO precisa ir a um fotógrafo — a foto do seu documento digital serve.",
      "Abra seu documento digital pelo site ou aplicativo do órgão: RG Digital, CIN ou CNH Digital (aplicativo Carteira de Documentos do gov.br).",
      "Com o documento aberto na tela, tire um print (no iPhone, botão lateral + aumentar volume; no Android, ligar + diminuir volume).",
      "Abra o print na galeria e use a ferramenta de recorte do próprio celular para deixar SÓ o rosto, no formato de retrato — cabeça e um pouco dos ombros.",
      "Confira que o rosto está nítido, de frente, sem óculos escuros, boné ou filtro.",
      "Volte aqui, clique em \"Entregar documento\" e envie a imagem recortada.",
    ],
    observacao: "Aceita JPG, PNG ou PDF. A foto vai na instrução do requerimento junto à Polícia Federal — se estiver borrada ou cortada demais, a equipe vai pedir outra.",
  },
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
      "Selecione qualquer nota já emitida pela empresa — pode ser de qualquer período, não precisa ser recente.",
      "Baixe o DANFE ou o PDF da NFS-e — os dois formatos servem.",
      "Confira que aparecem: razão social + CNPJ da sua empresa, valor da nota e data de emissão.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF.",
      "Em caso de dúvida, fale com o seu contador e peça uma nota fiscal emitida pela empresa em qualquer período — ele consegue baixar o PDF em minutos. Aviso ao contador: apenas Cartão CNPJ e QSA precisam ter no máximo 30 dias de emissão; nota fiscal, CCMEI, contrato social e requerimento de empresário não têm prazo.",
    ],
    observacao: "Serve como comprovação de atividade e faturamento e NÃO tem prazo de validade: qualquer nota fiscal já emitida pela empresa é aceita, mesmo antiga. Só não vale nota cancelada ou ilegível.",
  },
  renda_qsa: {
    titulo: "QSA — Quadro de Sócios e Administradores",
    siteUrl: "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp",
    passos: [
      "É EXATAMENTE O MESMO SITE onde você baixou o Cartão CNPJ (Receita Federal). Você não precisa de outro portal, nem de senha, nem do contador para acessar.",
      "Abra o site da Receita Federal no link logo acima, digite o CNPJ (só números), marque \"Não sou robô\" e clique em \"Consultar\".",
      "Vai abrir a mesma tela do \"COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL\" — a mesma que você já imprimiu para o Cartão CNPJ.",
      "Role essa tela até o FINAL. Logo abaixo da frase \"Emitido no dia ... (data e hora de Brasília)\" aparecem três botões azuis: CONSULTAR QSA · VOLTAR · IMPRIMIR.",
      "Clique no primeiro botão, \"CONSULTAR QSA\" (o do ícone de duas pessoinhas). A página muda e passa a mostrar o \"QUADRO DE SÓCIOS E ADMINISTRADORES (QSA)\" com os nomes dos sócios.",
      "Só depois de o QSA aparecer na tela, clique em \"IMPRIMIR\" e escolha \"Salvar como PDF\" (no Mac: \"PDF → Salvar como PDF\"; no Windows: destino \"Microsoft Print to PDF\" / \"Salvar como PDF\").",
      "Antes de enviar, confira no PDF: o CNPJ da empresa E o seu nome listado como sócio/administrador. Se o PDF só tiver os dados cadastrais e nenhum nome de sócio, você salvou o Cartão CNPJ de novo — volte e clique em CONSULTAR QSA.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF do QSA.",
      "Se seguiu todos os passos e ainda não conseguiu visualizar ou salvar o QSA (erro de captcha, CNPJ inativo, site fora do ar ou exigindo certificado digital), entre em contato com o seu contador. Ele pode acessar o mesmo site da Receita com o certificado digital da empresa e emitir o PDF para você enviar aqui. Aviso ao contador: apenas Cartão CNPJ e QSA precisam ter no máximo 30 dias de emissão; nota fiscal, CCMEI, contrato social e requerimento de empresário não têm prazo.",
    ],
    observacao: "Cartão CNPJ e QSA saem do mesmo site e da mesma consulta — mudam apenas com um clique no botão CONSULTAR QSA no rodapé da página. São dois PDFs diferentes e a PF exige os dois: sem o QSA com o seu nome como sócio, o processo é indeferido. Emissão dos últimos 30 dias. Empresa MEI não tem QSA — nesse caso envie o CCMEI.",
  },

  // ────────────────────────────────────────────────────────────────────────
  // Certidões — variantes do catálogo do checklist
  // ────────────────────────────────────────────────────────────────────────
  certidao_antecedentes_criminais_eleitoral: {
    titulo: "Superior Tribunal Eleitoral — TSE",
    passos: [
      "Abra o site do TSE no botão \"Acessar site de emissão\" logo abaixo.",
      "No formulário, escolha \"Pessoa Física\" e informe seu CPF, nome completo, nome da mãe e data de nascimento — exatamente como estão no título de eleitor.",
      "Marque \"Não sou robô\" e clique em \"Emitir Certidão\".",
      "A certidão abre em nova aba em PDF — clique no ícone de download (seta pra baixo) e salve o arquivo original, sem imprimir e escanear.",
      "Confira que aparece seu nome completo, CPF e o resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Validade de 30 dias a partir da emissão (o próprio documento não declara prazo — regra Quero Armas). Não altere o PDF — a IA valida a assinatura digital do TSE e reprova arquivos escaneados ou reimpressos.",
  },
  certidao_antecedentes_criminais_estadual: {
    titulo: "TJSP — Ações Criminais",
    passos: [
      "Clique em \"Acessar site de emissão\" — abre a página \"Certidões\" do TJSP.",
      "Na seção \"Primeira Instância\", clique em \"Certidões SAJ\".",
      "Na próxima tela, escolha a PRIMEIRA opção: \"Cadastro de Pedido de Certidão\".",
      "Em \"Modelo\", selecione \"CERTIDÃO DE DISTRIBUIÇÃO DE AÇÕES CRIMINAIS\" (é o modelo criminal completo, cobre 1º grau em TODOS os foros do estado — o e-SAJ não pergunta foro nesse fluxo).",
      "Em \"Pessoa\", marque \"Física\".",
      "Preencha NOME COMPLETO em MAIÚSCULAS (igualzinho ao RG), CPF e RG. Se você só tem a CIN (não tem RG), escreva no campo RG: DECLARA NÃO POSSUIR RG — sem isso o pedido é rejeitado.",
      "Marque \"Gênero\", preencha nome da mãe (obrigatório), nome do pai (se tiver) e data de nascimento (formato DD/MM/AAAA).",
      "Em \"Naturalidade\", clique na lupa e selecione a cidade/UF de nascimento.",
      "Informe seu e-mail — o e-SAJ envia o link do PDF pra ele em alguns minutos.",
      "Marque \"Confirmo que as informações acima estão corretamente preenchidas\" e clique em \"Enviar\".",
      "Aguarde o e-mail do TJSP (chega em até 15 minutos) com o link para baixar o PDF assinado digitalmente.",
      "Baixe o PDF pelo link do e-mail. Não use \"Imprimir → Salvar como PDF\" — quebra a assinatura digital.",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Validade de 30 dias a partir da emissão (o próprio documento não declara prazo — regra Quero Armas). O e-SAJ TJSP não pergunta foro nesse fluxo — o modelo \"Distribuição de Ações Criminais\" já cobre todos os foros do estado. Se aparecer o campo Foro, você entrou no fluxo antigo/errado — volte e escolha o Modelo correto. Não escaneie o PDF: envie o original com a assinatura digital.",
  },
  certidao_antecedentes_criminais_federal: {
    titulo: "Tribunal Regional Federal — TRF 3ª Região",
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
    titulo: "Justiça Militar Estadual — TJM",
    passos: [
      "Abra o portal do Tribunal de Justiça Militar do seu estado pelo botão \"Acessar site de emissão\". Esta NÃO é a certidão do STM — são documentos diferentes e a PF exige os dois.",
      "Clique em \"Certidão Negativa\" no menu do topo.",
      "Preencha CPF, nome completo, nome da mãe e data de nascimento exatamente como no RG.",
      "Marque \"Não sou robô\" e clique em \"Emitir Certidão\".",
      "A certidão abre em PDF em nova aba — baixe pelo ícone de download.",
      "Confira que aparece seu nome, CPF e o resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Validade de 90 dias. Não imprima e escaneie — envie o PDF original com a assinatura digital.",
  },
  // Mesmo documento, dois códigos: o catálogo de serviços usa
  // `certidao_estadual_policia_civil` e o Hub usa
  // `certidao_antecedentes_policia_civil_sp`. Sem esta entrada o item cai no
  // texto genérico "Documento adicional" e o cliente não sabe o que emitir.
  certidao_estadual_policia_civil: {
    titulo: "Antecedentes Criminais — Polícia Civil (SSP)",
    passos: [
      "Clique em \"Acessar site de emissão\" logo abaixo — abre o serviço \"Atestado de Antecedentes Criminais\" no portal servicos.sp.gov.br.",
      "Clique no botão \"Iniciar\" (ou \"Solicitar\") no bloco central da página.",
      "Faça login com a sua conta Gov.br (mesma do INSS/Receita/e-CAC). Se ainda não tem, crie na hora com CPF, e-mail e celular.",
      "Autorize o compartilhamento dos seus dados com o Governo de SP quando o Gov.br pedir.",
      "Confira nome completo, CPF, RG e filiação já preenchidos automaticamente — se algum estiver errado, corrija pelo próprio Gov.br antes de continuar.",
      "Selecione a finalidade \"Porte/Posse de arma de fogo\" (ou \"Outros\", se não aparecer) e clique em \"Solicitar Atestado\".",
      "O atestado abre em PDF assinado digitalmente pela SSP em nova aba.",
      "Baixe pelo ícone de download. NÃO use \"Imprimir → Salvar como PDF\" — quebra a assinatura ICP-Brasil.",
      "Confira no PDF: seu nome, CPF, a frase \"NADA CONSTA\" e o código de autenticidade no rodapé.",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Emitido pela SSP-SP via login Gov.br. Como os dados vêm do seu cadastro no Gov.br, não há campo para digitar errado. Envie o PDF original — nunca imprima e escaneie.",
  },
  certidao_antecedentes_policia_civil_sp: {
    titulo: "Secretaria de Segurança Pública — SSP",
    passos: [
      "Clique em \"Acessar site de emissão\" logo abaixo — abre o serviço \"Atestado de Antecedentes Criminais\" no portal servicos.sp.gov.br.",
      "Clique no botão \"Iniciar\" (ou \"Solicitar\") no bloco central da página.",
      "Faça login com a sua conta Gov.br (mesma do INSS/Receita/e-CAC). Se ainda não tem, crie na hora com CPF, e-mail e celular.",
      "Autorize o compartilhamento dos seus dados com o Governo de SP quando o Gov.br pedir (tela \"Autorização de uso de dados pessoais\").",
      "Confira nome completo, CPF, RG e filiação já preenchidos automaticamente — se algum campo estiver errado, corrija pelo próprio Gov.br antes de continuar.",
      "Selecione a finalidade \"Porte/Posse de arma de fogo\" (ou \"Outros\" se não aparecer) e clique em \"Solicitar Atestado\".",
      "Aguarde alguns segundos — o atestado abre em PDF assinado digitalmente pela SSP em uma nova aba.",
      "Baixe pelo ícone de download (seta pra baixo) do visualizador do navegador. NÃO use \"Imprimir → Salvar como PDF\" — quebra a assinatura ICP-Brasil e a IA reprova.",
      "Confira no PDF: seu nome, CPF, a frase \"NADA CONSTA\" e o QR Code / código de autenticidade no rodapé.",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como baixado.",
    ],
    observacao: "Emitido pela SSP-SP (Secretaria de Segurança Pública) via login Gov.br. Validade de 30 dias a partir da emissão (o próprio documento não declara prazo — regra Quero Armas). Envie o PDF original — nunca imprima e escaneie.",
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
    observacao: "Validade de 30 dias a partir da emissão (o próprio documento não declara prazo — regra Quero Armas). O TSE às vezes fica fora do ar à noite — se der erro, tente pela manhã.",
  },
  certidao_crimes_militares_stm: {
    titulo: "Superior Tribunal Militar — STM",
    passos: [
      // URL removida: dava 404 (usuário, 01/08/2026). O passo aponta para o link
      // do cabeçalho, que vem do banco e é o único ponto a manter atualizado.
      "Clique em \"Acessar site de emissão\" no link acima.",
      "Na página do STM, clique em \"Emitir Certidão Negativa\".",
      "Selecione \"Pessoa Física\".",
      "Preencha CPF, NOME COMPLETO em MAIÚSCULAS (igualzinho ao RG), nome da mãe e data de nascimento (DD/MM/AAAA).",
      "Marque \"Não sou robô\" e clique em \"Emitir Certidão\".",
      "A certidão abre em PDF assinado — baixe pelo ícone de download (não use \"Imprimir → PDF\", quebra a assinatura).",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF.",
    ],
    observacao: "Certidão Negativa da Justiça Militar da União (STM) — cobre crimes militares federais em todo o Brasil. Validade de 90 dias. Nome da mãe precisa bater exatamente com o RG, senão o sistema recusa.",
  },
  certidao_criminal_tjmsp: {
    titulo: "Tribunal de Justiça Militar — TJMSP",
    passos: [
      "Clique em \"Acessar site de emissão\" logo abaixo — abre o portal direto de certidão criminal do TJMSP (https://certidaocriminal.tjmsp.jus.br/).",
      "No menu superior, clique em \"Serviços\" e depois em \"Certidões\".",
      "Escolha \"Certidão Negativa Criminal\" (também aparece como \"Nada Consta\").",
      "Em \"Tipo de pessoa\", marque \"Física\".",
      "Preencha NOME COMPLETO em MAIÚSCULAS (igualzinho ao RG), CPF, RG, nome da mãe e data de nascimento (DD/MM/AAAA). Só tem CIN? Escreva DECLARA NÃO POSSUIR RG no campo RG.",
      "Informe o e-mail para receber o link do PDF, marque \"Não sou robô\" e clique em \"Emitir\".",
      "O TJMSP envia por e-mail o link da certidão assinada digitalmente em poucos minutos (às vezes cai no spam).",
      "Baixe o PDF pelo link recebido — NÃO use \"Imprimir → Salvar como PDF\", quebra a assinatura ICP-Brasil.",
      "Confira no PDF: seu nome, CPF, a frase \"NADA CONSTA\" e o código de autenticidade no rodapé.",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF exatamente como recebido.",
    ],
    observacao: "Emitido pelo Tribunal de Justiça Militar do Estado de São Paulo (TJMSP) — cobre crimes militares estaduais em SP. Validade de 90 dias. Só é exigida para clientes residentes em SP.",
  },
  certidao_estadual_distribuicao_acoes_criminais: {
    titulo: "TJSP — Ações Criminais",
    passos: [
      "Clique em \"Acessar site de emissão\" — abre a página \"Certidões\" do TJSP.",
      "Na seção \"Primeira Instância\", clique em \"Certidões SAJ\".",
      "Na próxima tela, escolha a PRIMEIRA opção: \"Cadastro de Pedido de Certidão\".",
      "Em \"Modelo\", selecione \"CERTIDÃO DE DISTRIBUIÇÃO DE AÇÕES CRIMINAIS\" (é o modelo específico de DISTRIBUIÇÃO — não escolha Execução Criminal aqui).",
      "Em \"Pessoa\", marque \"Física\".",
      "Preencha NOME COMPLETO em MAIÚSCULAS (igual ao RG), CPF e RG. Só tem CIN? escreva DECLARA NÃO POSSUIR RG no campo RG.",
      "Marque o \"Gênero\", preencha nome da mãe, nome do pai (se tiver), data de nascimento (DD/MM/AAAA) e Naturalidade (via lupa).",
      "Informe o e-mail para receber o link do PDF.",
      "Marque a confirmação e clique em \"Enviar\". O TJSP envia o link do PDF assinado por e-mail em alguns minutos.",
      "Baixe o PDF pelo link do e-mail — não use \"Imprimir → PDF\", quebra a assinatura digital.",
      "Volte aqui e clique em \"Entregar documento\".",
    ],
    observacao: "Validade de 30 dias a partir da emissão (o próprio documento não declara prazo — regra Quero Armas). É a certidão de DISTRIBUIÇÃO — no e-SAJ o campo que diferencia é o \"Modelo\": aqui use \"Certidão de Distribuição de Ações Criminais\". Não existe campo \"Foro\" nesse fluxo — o modelo já cobre todos os foros do estado. Se enviar o modelo de Execução, a IA reprova.",
  },
  certidao_estadual_execucoes_criminais: {
    titulo: "TJSP — Execuções Criminais",
    passos: [
      "Clique em \"Acessar site de emissão\" — abre a página \"Certidões\" do TJSP.",
      "Na seção \"Primeira Instância\", clique em \"Certidões SAJ\".",
      "Na próxima tela, escolha a PRIMEIRA opção: \"Cadastro de Pedido de Certidão\".",
      "Em \"Modelo\", selecione \"CERTIDÃO DE EXECUÇÃO CRIMINAL\" (é uma opção separada — não escolha Ações Criminais aqui).",
      "Em \"Pessoa\", marque \"Física\".",
      "Preencha NOME COMPLETO em MAIÚSCULAS (igual ao RG), CPF e RG. Só tem CIN? escreva DECLARA NÃO POSSUIR RG no campo RG.",
      "Marque o \"Gênero\", preencha nome da mãe, nome do pai (se tiver), data de nascimento (DD/MM/AAAA) e Naturalidade (via lupa).",
      "Informe o e-mail e marque a confirmação.",
      "Clique em \"Enviar\". O TJSP envia o link do PDF assinado por e-mail em alguns minutos.",
      "Baixe pelo link do e-mail — nunca via \"Imprimir → PDF\", quebra a assinatura.",
      "Volte aqui e clique em \"Entregar documento\".",
    ],
    observacao: "Validade de 30 dias a partir da emissão (o próprio documento não declara prazo — regra Quero Armas). Diferente da certidão de Distribuição — o que muda no e-SAJ é o campo \"Modelo\": aqui use \"Certidão de Execução Criminal\". Não existe campo \"Foro\" nesse fluxo. Se enviar o modelo errado, a IA reprova.",
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
    titulo: "Tribunal Regional Federal — TRF 3ª Região",
    passos: [
      "Abra o portal do TRF pelo link acima (em SP e MS é o TRF3).",
      "Em \"Tipo de certidão\" selecione \"Criminal (engloba ações criminais em geral, inclusive execuções)\".",
      "Em \"Tipo de documento\" selecione \"CPF\" e informe o número em \"Documento\".",
      "Deixe \"Nome social\" em branco, salvo se for o seu caso.",
      "Em \"Abrangência\" selecione \"Regional\" — é a que a Polícia Federal exige.",
      "Marque \"Confirme que é humano\" e envie o formulário.",
      "A certidão abre em PDF — baixe pelo ícone de download e salve o arquivo original.",
      "Confira que aparece seu nome, CPF, a abrangência Regional e o resultado \"NADA CONSTA\".",
      "Volte aqui, clique em \"Entregar documento\" e envie o PDF sem alterações.",
    ],
    observacao: "Validade de 90 dias. Envie o PDF original baixado do site — reimpressão escaneada quebra a assinatura digital e é reprovada.",
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
    titulo: "TJSP — Ações Criminais",
    passos: [
      "Clique em \"Acessar site de emissão\" — abre a página \"Certidões\" do TJSP.",
      "Na seção \"Primeira Instância\", clique em \"Certidões SAJ\".",
      "Na próxima tela, escolha a PRIMEIRA opção: \"Cadastro de Pedido de Certidão\".",
      "Em \"Modelo\", selecione \"CERTIDÃO DE DISTRIBUIÇÃO DE AÇÕES CRIMINAIS\" (é o modelo específico de DISTRIBUIÇÃO — não escolha Execução Criminal aqui).",
      "Em \"Pessoa\", marque \"Física\".",
      "Preencha NOME COMPLETO em MAIÚSCULAS (igual ao RG), CPF e RG. Só tem CIN? escreva DECLARA NÃO POSSUIR RG no campo RG.",
      "Marque o \"Gênero\", preencha nome da mãe, nome do pai (se tiver), data de nascimento (DD/MM/AAAA) e Naturalidade (via lupa).",
      "Informe o e-mail para receber o link do PDF.",
      "Marque a confirmação e clique em \"Enviar\". O TJSP envia o link do PDF assinado por e-mail em alguns minutos.",
      "Baixe o PDF pelo link do e-mail — não use \"Imprimir → PDF\", quebra a assinatura digital.",
      "Volte aqui e clique em \"Entregar documento\".",
    ],
    observacao: "Validade de 30 dias a partir da emissão (o próprio documento não declara prazo — regra Quero Armas). É a certidão de DISTRIBUIÇÃO — no e-SAJ o campo que diferencia é o \"Modelo\": aqui use \"Certidão de Distribuição de Ações Criminais\". Não existe campo \"Foro\" nesse fluxo — o modelo já cobre todos os foros do estado. Se enviar o modelo de Execução, a IA reprova.",
  },
  certidao_tjsp_execucoes_criminais: {
    titulo: "TJSP — Execuções Criminais",
    passos: [
      "Clique em \"Acessar site de emissão\" — abre a página \"Certidões\" do TJSP.",
      "Na seção \"Primeira Instância\", clique em \"Certidões SAJ\".",
      "Na próxima tela, escolha a PRIMEIRA opção: \"Cadastro de Pedido de Certidão\".",
      "Em \"Modelo\", selecione \"CERTIDÃO DE EXECUÇÃO CRIMINAL\" (é uma opção separada — não escolha Ações Criminais aqui).",
      "Em \"Pessoa\", marque \"Física\".",
      "Preencha NOME COMPLETO em MAIÚSCULAS (igual ao RG), CPF e RG. Só tem CIN? escreva DECLARA NÃO POSSUIR RG no campo RG.",
      "Marque o \"Gênero\", preencha nome da mãe, nome do pai (se tiver), data de nascimento (DD/MM/AAAA) e Naturalidade (via lupa).",
      "Informe o e-mail e marque a confirmação.",
      "Clique em \"Enviar\". O TJSP envia o link do PDF assinado por e-mail em alguns minutos.",
      "Baixe pelo link do e-mail — nunca via \"Imprimir → PDF\", quebra a assinatura.",
      "Volte aqui e clique em \"Entregar documento\".",
    ],
    observacao: "Validade de 30 dias a partir da emissão (o próprio documento não declara prazo — regra Quero Armas). Diferente da certidão de Distribuição — o que muda no e-SAJ é o campo \"Modelo\": aqui use \"Certidão de Execução Criminal\". Não existe campo \"Foro\" nesse fluxo. Se enviar o modelo errado, a IA reprova.",
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
    siteUrl: "https://gov.br",
    passos: [
      "Entre no gov.br pelo site ou aplicativo com o seu CPF e senha e conclua a verificação em duas etapas, se pedirem.",
      "Depois de entrar, procure a área de \"Atalhos\" e abra \"Carteira de Documentos\".",
      "Na Carteira de Documentos, abra a CIN (Carteira de Identidade Nacional) ou a CNH digital que estiver disponível na sua conta.",
      "Dentro do documento, toque em \"Baixar\", \"Exportar PDF\" ou \"Compartilhar\" e escolha salvar em PDF.",
      "Envie aqui somente o PDF baixado pelo gov.br, com QR Code de verificação. Não envie foto, print da tela nem digitalização do documento físico.",
    ],
    observacao:
      "Aceita-se SOMENTE o PDF com QR Code emitido pela Carteira de Documentos do gov.br. Foto, print ou digitalização do documento físico são recusados automaticamente pelo sistema.",
  },
  rg_com_cpf: {
    titulo: "Documento oficial de identidade com CPF",
    siteUrl: "https://gov.br",
    passos: [
      "Entre no gov.br pelo site ou aplicativo com o seu CPF e senha.",
      "Abra \"Atalhos\" e toque em \"Carteira de Documentos\".",
      "Selecione a CIN (Carteira de Identidade Nacional) ou a CNH digital disponível na sua conta.",
      "Use \"Baixar\", \"Exportar PDF\" ou \"Compartilhar\" e salve o arquivo em PDF.",
      "Envie esse PDF aqui, sem editar, cortar, fotografar ou converter em imagem.",
    ],
    observacao:
      "Somente o PDF com QR Code da Carteira de Documentos do gov.br é aceito. Foto ou print do documento físico é recusado.",
  },
  cnh: {
    titulo: "CNH válida",
    passos: [
      "Acesse o gov.br com CPF e senha e abra a \"Carteira de Documentos\" (ou o aplicativo Carteira Digital de Trânsito).",
      "Abra a CNH digital e toque em \"Baixar\" / \"Exportar PDF\".",
      "Confira que a CNH está dentro do prazo de validade antes de enviar.",
      "Envie o PDF exportado, que já vem com o QR Code de verificação.",
    ],
    observacao:
      "Somente o PDF com QR Code oficial é aceito. Foto da CNH física, print ou digitalização são recusados.",
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
      "Envie uma conta de CONSUMO DO IMÓVEL em seu nome: energia elétrica, água/esgoto, gás encanado, internet fixa ou telefone fixo.",
      "A conta precisa mostrar o endereço completo do imóvel (rua, número, bairro, cidade, UF e CEP) e a data de emissão.",
      "A emissão deve ser recente — o sistema aceita contas emitidas há até 30 dias.",
      "A Polícia Federal NÃO aceita conta de celular, fatura de cartão de crédito, extrato ou fatura de banco, boleto de financiamento e afins: essas cobranças são da pessoa, e não do consumo do imóvel.",
    ],
    observacao:
      "A Polícia Federal precisa confirmar onde você tem residência ou domicílio fixo, porque é nesse endereço que a arma ficará guardada após a aprovação do pedido. Por isso só valem documentos que comprovem consumo naquele imóvel — contas pessoais e móveis (celular, cartão, banco) acompanham a pessoa, não o endereço, e por isso são recusadas.",
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
    observacao: "Validade de 30 dias a partir da emissão (o próprio documento não declara prazo — regra Quero Armas). Não imprima e escaneie — envie o PDF original, senão a assinatura digital quebra e a IA reprova.",
  },
  antecedentes_federal: {
    titulo: "Tribunal Regional Federal — TRF 3ª Região",
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
    observacao: "Validade de 30 dias a partir da emissão (o próprio documento não declara prazo — regra Quero Armas). Envie o PDF original — não imprima e escaneie.",
  },
  antecedentes_estadual_distribuicao: {
    titulo: "TJSP — Ações Criminais",
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
    titulo: "TJSP — Execuções Criminais",
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
    observacao: "Validade de 30 dias a partir da emissão (o próprio documento não declara prazo — regra Quero Armas). O TSE às vezes fica fora do ar à noite — se der erro, tente pela manhã.",
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
    titulo: "Comprovante de Inscrição e de Situação Cadastral do CNPJ",
    passos: [
      "É o \"Comprovante de Inscrição e de Situação Cadastral\" do seu CNPJ (MEI, autônomo com CNPJ ou empresa). Ele prova que a sua atividade está ATIVA na Receita Federal.",
      "Use o botão de emissão abaixo (ou o link oficial acima, do site da Receita Federal) — é o único endereço válido para emitir o comprovante.",
      "Na tela \"Emissão de Comprovante de Inscrição e de Situação Cadastral\", digite o CNPJ só com números, marque \"Não sou um robô\" e clique em \"Consultar\".",
      "Confirme os dados exibidos e clique em \"Emitir Comprovante de Inscrição e de Situação Cadastral\" — o comprovante abre em uma nova página com o brasão da República e o código de controle no rodapé.",
      "Nessa página use \"Imprimir\" → destino \"Salvar como PDF\" (não use print de tela nem foto). Salve todas as páginas do comprovante.",
      "Confira antes de enviar: CNPJ, razão social/nome empresarial, situação cadastral \"ATIVA\", CNAE principal, endereço, data de emissão e o código de controle do comprovante.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF.",
    ],
    observacao: "Emissão dos últimos 30 dias. Situação \"BAIXADA\", \"SUSPENSA\" ou \"INAPTA\" é reprovada — regularize antes de enviar. Se o site der erro, tente de novo em alguns minutos.",
  },
  renda_ccmei: {
    titulo: "CCMEI — Certificado do MEI",
    passos: [
      "O CCMEI é o certificado que comprova que você é Microempreendedor Individual. É ele que sustenta a sua ocupação lícita perante a Polícia Federal — sem ele, o CNPJ sozinho não fecha o grupo.",
      "Abra o Portal do Empreendedor: gov.br/empresas-e-negocios/pt-br/empreendedor (ou use o botão de emissão abaixo).",
      "Clique em \"Já sou MEI\" → \"Emitir Certificado CCMEI\".",
      "Faça login com a sua conta Gov.br (a mesma da Receita/INSS) e clique em \"Emitir Certificado\".",
      "O CCMEI abre em PDF em nova aba — baixe pelo ícone de download (não use print de tela).",
      "Confira: seu nome, CPF, CNPJ, data de abertura, atividade principal e o QR Code de autenticidade no rodapé.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF.",
    ],
    observacao: "O CCMEI NÃO TEM PRAZO DE VALIDADE — pode ser de qualquer data de emissão. A atualidade da sua ocupação lícita é conferida pela emissão do Cartão CNPJ e do QSA (esses sim, no máximo 30 dias). Se você NÃO é MEI (autônomo sem CNPJ ou empresário com contrato social), avise a equipe pelo WhatsApp: trocamos esta exigência pelo documento correto da sua condição. Não envie print nem foto da tela — só o PDF baixado do portal.",
  },
  renda_ctps_digital: {
    titulo: "CTPS Digital — Carteira de Trabalho",
    passos: [
      "Abra o app \"Carteira de Trabalho Digital\" ou o site gov.br/trabalho-e-emprego e entre com a sua conta Gov.br.",
      "Toque em \"Contratos de Trabalho\" para conferir se o vínculo atual está registrado.",
      "Volte à tela inicial e toque em \"Baixar PDF\" (ou \"Compartilhar\" → \"Salvar como PDF\") para gerar o extrato completo.",
      "Confira que aparecem seu nome, CPF, o empregador e a data de admissão do contrato em aberto.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF.",
    ],
    observacao: "Precisa ser o PDF oficial gerado pelo app/site — prints das telas são reprovados. Se o contrato atual não aparece, cobre o RH: o registro é obrigação do empregador.",
  },
  renda_carteira_funcional: {
    titulo: "Carteira funcional do órgão",
    passos: [
      "Separe a sua carteira funcional emitida pelo órgão em que você é servidor.",
      "Se existe versão digital no app oficial do órgão, exporte em PDF direto por lá (\"Compartilhar\" / \"Exportar\").",
      "Se só tem a física, fotografe frente e verso com boa luz, sem cortes e sem reflexo.",
      "Confira que estão legíveis: nome completo, matrícula, cargo, órgão e validade.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o arquivo.",
    ],
    observacao: "A funcional comprova o vínculo; o contracheque comprova a remuneração. Quando os dois forem pedidos, envie ambos — um não substitui o outro.",
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
    titulo: "Contrato Social ou Requerimento de Empresário",
    passos: [
      "Você pode enviar QUALQUER UM dos dois: o Contrato Social CONSOLIDADO (sociedades LTDA/SA) OU o Requerimento de Empresário (empresário individual / EIRELI). Os dois têm o mesmo valor para o processo.",
      "Caminho mais rápido: peça ao seu contador — ele baixa direto no sistema da Junta Comercial em poucos minutos e te manda o PDF por e-mail.",
      "Se preferir emitir você mesmo em SP, acesse o portal da JUCESP: https://www.jucesponline.sp.gov.br — clique em \"Solicitar Documento\", faça login com Gov.br e informe o NIRE ou o CNPJ da empresa.",
      "Em outros estados, use o portal da respectiva Junta Comercial (JUCERJA/RJ, JUCEMG/MG, JUCESC/SC, JUCEPAR/PR etc.). A lista oficial de todas as Juntas está no botão abaixo (Portal Redesim / Gov.br).",
      "No portal, escolha \"Certidão Simplificada + Contrato/Estatuto Consolidado\" (para LTDA/SA) OU \"Requerimento de Empresário\" (para empresário individual/EIRELI). Pague a taxa quando houver e baixe o PDF.",
      "Confira que aparecem no documento: razão social, CNPJ, sócios (ou titular), capital social e a última alteração registrada. Depois volte aqui e clique em \"Entregar documento\".",
      "Se a empresa é MEI, NÃO envie contrato social — MEI não tem. Volte e use a opção \"CCMEI\" no lugar.",
    ],
    observacao: "Contrato Social e Requerimento de Empresário NÃO TÊM PRAZO DE VALIDADE — a atualidade da ocupação lícita é conferida pela emissão do Cartão CNPJ e do QSA (no máximo 30 dias). O que importa aqui é a versão CONSOLIDADA mais recente registrada na Junta Comercial: contratos sem as últimas alterações são reprovados. Requerimento de Empresário para EIRELI/individual é 100% aceito no lugar do contrato — em dúvida, peça ao contador.",
  },
  renda_nf_recente: {
    titulo: "Nota fiscal emitida a um cliente",
    passos: [
      "Serve para mostrar que a sua atividade não existe só no papel: houve serviço ou venda de verdade, com nota emitida para um cliente.",
      "Acesse o emissor da sua prefeitura (NFS-e, serviços) ou da SEFAZ do seu estado (NF-e, produtos), com o login do seu CNPJ.",
      "Abra as notas emitidas e escolha qualquer uma, de qualquer período e para qualquer cliente — nota antiga também é aceita.",
      "Baixe o PDF da NFS-e ou o DANFE da NF-e — os dois formatos são aceitos.",
      "Confira que aparecem: seu CNPJ como emitente, o cliente (tomador), o valor, a descrição do serviço/produto e a data de emissão.",
      "Volte aqui e clique em \"Entregar documento\" para enviar o PDF. Se quiser reforçar, pode juntar mais notas num único PDF (ilovepdf.com → \"Juntar PDF\").",
      "Ficou em dúvida sobre qual nota enviar ou não tem acesso ao emissor? Entre em contato com o seu contador e solicite uma nota fiscal emitida pela empresa em qualquer período — ele envia o PDF por e-mail. Aviso ao contador: nota fiscal, CCMEI, contrato social e requerimento de empresário não têm prazo de validade; apenas o Cartão CNPJ e o QSA precisam ter no máximo 30 dias de emissão.",
    ],
    observacao: "Uma nota basta e ela NÃO vence: pode ser de qualquer período, desde que esteja legível e não cancelada. Em caso de dúvida, peça ao seu contador uma nota fiscal emitida pela empresa em qualquer período.",
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
  // Mesmo fluxo, código do Hub.
  comprovante_efetiva_necessidade: {
    titulo: "Efetiva necessidade",
    passos: [
      "Esta é a parte que mais reprova pedido de arma na Polícia Federal. E quase nunca é por falta de documento: é por justificativa vaga. \"Quero para defesa pessoal\" não sustenta um pedido — e é o que a maioria escreve.",
      "Você não vai escrever nada sozinho, nem baixar modelo. São perguntas, aqui mesmo, e nós redigimos a declaração com as suas respostas.",
      "Começamos pelo que você já tem: boletim de ocorrência, inquérito, ação criminal. Documento em nome de outra pessoa também vale — se ameaçaram sua esposa, seu filho ou um funcionário seu, a necessidade é sua também.",
      "Depois vêm os detalhes que constroem o caso: se você já foi ameaçado ou abordado, se alguém da família foi, o que você faz, se transporta dinheiro ou mercadoria, o horário em que costuma chegar em casa, a região onde mora ou trabalha.",
      "Quanto mais concreto, melhor. Data, lugar, o que aconteceu, quem estava com você. A Polícia Federal avalia risco REAL, não sensação de risco — e é o detalhe que separa os dois.",
      "No fim você lê a declaração pronta, aprova, e só então ela vai para o processo. Nada é enviado sem a sua confirmação.",
    ],
    observacao: "Prova vale mais que texto. Um boletim de ocorrência sustenta o pedido muito melhor do que qualquer justificativa bem escrita — por isso começamos por eles. Mas se você não tem nenhum, o relato ainda sustenta, desde que seja específico. Vago é o que reprova.",
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

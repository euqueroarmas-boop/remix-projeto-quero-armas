// ============================================================================
// GERADOR DE DOCUMENTO SINTÉTICO PARA TESTE DO FLUXO DOCUMENTAL
// ----------------------------------------------------------------------------
// Produz arquivos com CAMADA DE TEXTO NATIVA, que é o que o sistema realmente
// lê para classificar e conferir o envio do cliente. Serve para exercitar o
// fluxo inteiro (upload → leitura → trava → carimbo) sem precisar do documento
// de ninguém e sem pedir login a cliente nenhum.
//
// Os dados são fictícios e cada página sai carimbada como amostra de teste.
// Não é, e não deve ser usado como, documento oficial.
//
// ── DOIS LIMITES QUE A EDGE FUNCTION IMPÕE (qa-processo-doc-upload) ──────────
// O upload confere o tamanho REAL do arquivo no bucket, não o que o navegador
// declara. Abaixo do mínimo o documento é recusado antes de qualquer leitura:
//   PDF   → mínimo  8KB  (MIN_PDF_BYTES)
//   IMAGEM→ mínimo 40KB  (MIN_IMG_BYTES)
//   ambos → máximo 20MB  (MAX_BYTES)
// Por isso as amostras saem acolchoadas até passar do mínimo. Um PDF "de
// verdade" gerado por órgão público nunca tem 1KB; um PDF sintético cru tem —
// e seria recusado por tamanho, não pela regra que você quer testar.
//
// ── USO ─────────────────────────────────────────────────────────────────────
//   node scripts/gerar-doc-teste.mjs
//        lista tudo que dá para gerar
//   node scripts/gerar-doc-teste.mjs autorizacao-compra
//        gera o DOSSIÊ INTEIRO do serviço 50 — Autorização de Compra Atirador,
//        separado em pastas por etapa do checklist
//   node scripts/gerar-doc-teste.mjs --grupo ocupacao
//        gera só um grupo (as ramificações de ocupação lícita, por exemplo)
//   node scripts/gerar-doc-teste.mjs ctps
//        gera um documento avulso
//   node scripts/gerar-doc-teste.mjs ctps --sem-texto
//        versão "escaneada", sem camada de texto — é o caminho em que a IA
//        assume a leitura, e que hoje não tem teste automatizado nenhum
// ============================================================================

import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "tmp", "doc-teste");

const CARIMBO = "AMOSTRA SINTETICA PARA TESTE DE SISTEMA - DADOS FICTICIOS";

/** Mínimos que qa-processo-doc-upload cobra do arquivo real no bucket. */
const MIN_PDF_BYTES = 8 * 1024;
const MIN_IMG_BYTES = 40 * 1024;

// O mesmo titular fictício em todos os documentos. Precisa ser o mesmo: boa
// parte da conferência compara o nome/CPF do documento com o cadastro, e nome
// divergente derruba o envio por "titular divergente" — que é uma trava
// legítima, mas não é a que você quer testar quando testa outra coisa.
const T = {
  nome: "FULANO DE TAL DA SILVA",
  cpf: "000.000.000-00",
  rg: "00.000.000-0",
  nasc: "01/01/1980",
  mae: "MARIA DE TAL DA SILVA",
  cr: "000000000",
  endereco: "RUA DE TESTE, 100, APTO 1",
  bairro: "JARDIM FICTICIO",
  cidade: "SAO PAULO",
  uf: "SP",
  cep: "00000-000",
};

// ============================================================================
// OS GRUPOS = as etapas do checklist da Autorização de Compra
// ----------------------------------------------------------------------------
// A numeração 01–12 abaixo é a mesma que a equipe usou nos três dossiês que a
// Polícia Federal DEFERIU (Eduardo Rizek, Rivelino Pereira e Édson Campos) e
// que virou o checklist do serviço 50 — Autorização de Compra Atirador (CAC).
// ============================================================================
export const GRUPOS = {
  identidade: "Identidade e foto (itens 06 do dossiê)",
  certidoes: "As OITO certidões de idoneidade (itens 04, 10, 11, 12)",
  laudos: "Laudos — capacidade técnica e psicológico (itens 01, 07)",
  cac: "Vida de CAC — filiação, competição, acervo, habitualidade (itens 02, 03)",
  declaracoes: "Declarações e imóvel de terceiro (itens 05, 08)",
  residencia: "Comprovante de residência (item 08)",
  ocupacao: "Ocupação lícita — as ramificações (item 09)",
  taxa: "GRU e comprovante de pagamento",
  final: "Saída do processo — a AC deferida e o pedido da loja",
};

// Exportado para que a suíte de testes confira as amostras contra as regras
// reais de conferência — sem gerar PDF nenhum. Assim, se alguém mexer na trava
// de escopo, as iscas aqui embaixo cobram o comportamento junto.
export const MODELOS = {
  // ── IDENTIDADE ────────────────────────────────────────────────────────────
  rg_com_cpf: {
    grupo: "identidade",
    titulo: "RG com CPF",
    slot: "rg_com_cpf",
    linhas: [
      "REPUBLICA FEDERATIVA DO BRASIL",
      "SECRETARIA DE SEGURANCA PUBLICA DO ESTADO DE SAO PAULO",
      "INSTITUTO DE IDENTIFICACAO RICARDO GUMBLETON DAUNT",
      "CARTEIRA DE IDENTIDADE",
      "",
      `Nome: ${T.nome}`,
      `Registro Geral: ${T.rg}`,
      `CPF: ${T.cpf}`,
      `Data de nascimento: ${T.nasc}`,
      `Filiacao: ${T.mae}`,
      "Naturalidade: SAO PAULO - SP",
      "Data de expedicao: 10/03/2019",
    ],
  },

  foto_3x4: {
    grupo: "identidade",
    titulo: "Foto 3x4 (unico tipo que aceita imagem)",
    slot: "foto_3x4",
    formato: "png",
  },

  credencial_gov_br: {
    grupo: "identidade",
    titulo: "Credencial gov.br",
    slot: "credencial_gov_br",
    linhas: [
      "GOV.BR",
      "COMPROVANTE DE NIVEL DA CONTA",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "Nivel da conta: OURO",
      "Data da consulta: 01/08/2026",
    ],
  },

  // ── AS OITO CERTIDÕES ─────────────────────────────────────────────────────
  // O dossiê deferido trouxe OITO. Não sete, não quatro. Cada uma vem de um
  // órgão diferente e o texto do cabeçalho é o que identifica qual é qual —
  // por isso os títulos vão escritos por extenso, como saem do emissor.
  antecedentes_federal_trf3_regional: {
    grupo: "certidoes",
    titulo: "Certidao Justica Federal - TRF3 (regional)",
    slot: "antecedentes_federal_trf3_regional",
    linhas: [
      "PODER JUDICIARIO",
      "TRIBUNAL REGIONAL FEDERAL DA 3a REGIAO",
      "CERTIDAO DE DISTRIBUICAO CRIMINAL",
      "ABRANGENCIA: SECAO JUDICIARIA DE SAO PAULO E MATO GROSSO DO SUL",
      "",
      "CERTIFICO que, consultados os registros de distribuicao de feitos",
      "CRIMINAIS, NADA CONSTA em nome de:",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "",
      "Data de emissao: 01/08/2026",
      "Validade: 90 dias",
      "Codigo de validacao: TESTE-TRF3-0000-0000",
    ],
  },

  antecedentes_federal_sjsp_jef: {
    grupo: "certidoes",
    titulo: "Certidao Justica Federal - SJSP / JEF (local)",
    slot: "antecedentes_federal_sjsp_jef",
    linhas: [
      "PODER JUDICIARIO",
      "JUSTICA FEDERAL DE PRIMEIRO GRAU EM SAO PAULO",
      "SECAO JUDICIARIA DE SAO PAULO",
      "CERTIDAO DE DISTRIBUICAO CRIMINAL - 1o GRAU E JUIZADOS ESPECIAIS FEDERAIS",
      "",
      "CERTIFICO que NADA CONSTA em nome de:",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "",
      "Data de emissao: 01/08/2026",
      "Validade: 90 dias",
      "Codigo de validacao: TESTE-SJSP-0000-0000",
    ],
  },

  antecedentes_estadual_distribuicao: {
    grupo: "certidoes",
    titulo: "Certidao estadual de distribuicoes CRIMINAIS (TJSP)",
    slot: "antecedentes_estadual_distribuicao",
    linhas: [
      "PODER JUDICIARIO",
      "TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO",
      "CERTIDAO ESTADUAL DE DISTRIBUICAO DE ACOES CRIMINAIS",
      "",
      "CERTIFICO que, revendo os registros de distribuicao de feitos CRIMINAIS",
      "deste Estado, verifiquei NADA CONSTAR em nome de:",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "",
      "Data de emissao: 01/08/2026",
      "Validade: 90 dias",
      "Codigo de autenticacao: TESTE-TJSP-0000-0000",
    ],
  },

  antecedentes_estadual_execucoes: {
    grupo: "certidoes",
    titulo: "Certidao estadual de EXECUCOES CRIMINAIS (TJSP)",
    slot: "antecedentes_estadual_execucoes",
    linhas: [
      "PODER JUDICIARIO",
      "TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO",
      "CERTIDAO DE EXECUCOES CRIMINAIS",
      "",
      "CERTIFICO que, revendo os registros de EXECUCOES CRIMINAIS deste",
      "Estado, verifiquei NADA CONSTAR em nome de:",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "",
      "Data de emissao: 01/08/2026",
      "Validade: 90 dias",
      "Codigo de autenticacao: TESTE-EXEC-0000-0000",
    ],
  },

  antecedentes_criminais: {
    grupo: "certidoes",
    titulo: "Certidao de antecedentes criminais (Policia Federal)",
    slot: "antecedentes_criminais",
    linhas: [
      "MINISTERIO DA JUSTICA E SEGURANCA PUBLICA",
      "POLICIA FEDERAL",
      "CERTIDAO DE ANTECEDENTES CRIMINAIS",
      "",
      "CERTIFICO que, consultados os registros do Sistema Nacional de",
      "Informacoes Criminais, NADA CONSTA em nome de:",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      `Filiacao: ${T.mae}`,
      "",
      "Data de emissao: 01/08/2026",
      "Validade: 90 dias",
    ],
  },

  antecedentes_militar: {
    grupo: "certidoes",
    titulo: "Certidao Justica Militar da UNIAO (STM)",
    slot: "antecedentes_militar",
    linhas: [
      "PODER JUDICIARIO",
      "JUSTICA MILITAR DA UNIAO",
      "SUPERIOR TRIBUNAL MILITAR",
      "CERTIDAO NEGATIVA CRIMINAL",
      "",
      "CERTIFICO que NADA CONSTA nos registros da Justica Militar da Uniao",
      "em nome de:",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "",
      "Data de emissao: 01/08/2026",
      "Validade: 90 dias",
    ],
  },

  antecedentes_militar_estadual: {
    grupo: "certidoes",
    titulo: "Certidao Justica Militar ESTADUAL (TJM/SP)",
    slot: "antecedentes_militar_estadual",
    linhas: [
      "PODER JUDICIARIO",
      "TRIBUNAL DE JUSTICA MILITAR DO ESTADO DE SAO PAULO",
      "CERTIDAO NEGATIVA DE DISTRIBUICAO CRIMINAL",
      "",
      "CERTIFICO que NADA CONSTA nos registros deste Tribunal de Justica",
      "Militar em nome de:",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "",
      "Data de emissao: 01/08/2026",
      "Validade: 90 dias",
    ],
  },

  antecedentes_eleitoral: {
    grupo: "certidoes",
    titulo: "Certidao de crimes eleitorais (TSE)",
    slot: "antecedentes_eleitoral",
    linhas: [
      "PODER JUDICIARIO",
      "JUSTICA ELEITORAL",
      "TRIBUNAL SUPERIOR ELEITORAL",
      "CERTIDAO DE CRIMES ELEITORAIS",
      "",
      "CERTIFICO que NADA CONSTA quanto a crimes eleitorais em nome de:",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "",
      "Data de emissao: 01/08/2026",
      "Validade: 90 dias",
    ],
  },

  // A cível NÃO faz parte do dossiê. Ela existe aqui de propósito: é o
  // documento que a trava de escopo TEM de barrar no slot de certidão — e
  // TEM de ignorar em qualquer slot que não seja certidão (foi isso que
  // reprovou a Carteira de Trabalho do Igor em 22/08/2026).
  certidao_civel_isca: {
    grupo: "certidoes",
    titulo: "Certidao CIVEL — isca: deve ser BARRADA no slot de certidao",
    slot: "antecedentes_estadual_distribuicao",
    linhas: [
      "PODER JUDICIARIO",
      "TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO",
      "CERTIDAO ESTADUAL DE DISTRIBUICOES CIVEIS",
      "",
      "CERTIFICO que, revendo os registros de distribuicao de feitos CIVEIS",
      "deste Estado, verifiquei NADA CONSTAR em nome de:",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "",
      "Data de emissao: 01/08/2026",
    ],
  },

  // A combinada também é isca, do outro lado: cabeçalho com cível E criminal
  // no mesmo PDF (padrão TRF3). Desde f096b4b ela CUMPRE a exigência criminal.
  certidao_combinada_isca: {
    grupo: "certidoes",
    titulo: "Certidao COMBINADA civel+criminal+eleitoral — deve PASSAR",
    slot: "antecedentes_federal_trf3_regional",
    linhas: [
      "PODER JUDICIARIO",
      "TRIBUNAL REGIONAL FEDERAL DA 3a REGIAO",
      "CERTIDAO DE DISTRIBUICAO CIVEL, CRIMINAL E ELEITORAL",
      "",
      "CERTIFICO que, consultados os registros de distribuicao CIVEL,",
      "CRIMINAL e ELEITORAL, NADA CONSTA em nome de:",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "",
      "Data de emissao: 01/08/2026",
    ],
  },

  // ── LAUDOS ────────────────────────────────────────────────────────────────
  // Atenção ao laudo: a extração cobra `data_avaliacao`, não só a emissão.
  laudo_capacidade_tecnica: {
    grupo: "laudos",
    titulo: "Laudo de capacidade tecnica",
    slot: "laudo_capacidade_tecnica",
    linhas: [
      "LAUDO DE APTIDAO TECNICA PARA O MANUSEIO DE ARMA DE FOGO",
      "INSTRUTOR DE ARMAMENTO E TIRO CREDENCIADO PELA POLICIA FEDERAL",
      "",
      `Nome do avaliado: ${T.nome}`,
      `CPF: ${T.cpf}`,
      `Documento de identidade: ${T.rg}`,
      "",
      "Data da avaliacao: 15/07/2026",
      "Local da avaliacao: CLUBE DE TIRO FICTICIO DE TESTE",
      "",
      "RESULTADO: APTO ao manuseio de arma de fogo.",
      "",
      "Instrutor: JOAO INSTRUTOR DE TESTE",
      "Credencial PF no: IT-000000",
      "Data de emissao: 15/07/2026",
      "Validade: 1 ano a contar da avaliacao",
    ],
  },

  laudo_psicologico: {
    grupo: "laudos",
    titulo: "Laudo psicologico",
    slot: "laudo_psicologico",
    linhas: [
      "LAUDO DE AVALIACAO PSICOLOGICA PARA AQUISICAO E MANUSEIO DE ARMA DE FOGO",
      "PSICOLOGO CREDENCIADO PELA POLICIA FEDERAL",
      "",
      `Nome do avaliado: ${T.nome}`,
      `CPF: ${T.cpf}`,
      `Documento de identidade: ${T.rg}`,
      "",
      "Data da avaliacao: 18/07/2026",
      "",
      "CONCLUSAO: APTO",
      "",
      "Psicologa: ANA PSICOLOGA DE TESTE",
      "CRP: 06/000000",
      "Credencial PF no: PS-000000",
      "Data de emissao: 18/07/2026",
      "Validade: 1 ano a contar da avaliacao",
    ],
  },

  // ── VIDA DE CAC ───────────────────────────────────────────────────────────
  comprovante_filiacao_entidade_tiro: {
    grupo: "cac",
    titulo: "Filiacao a entidade de tiro (anuidade vencida derruba o pedido)",
    slot: "comprovante_filiacao_entidade_tiro",
    linhas: [
      "CLUBE DE TIRO FICTICIO DE TESTE",
      "CNPJ: 00.000.000/0001-00",
      "Registro no Exercito: CR 00000",
      "DECLARACAO DE FILIACAO",
      "",
      `Declaramos que ${T.nome}, CPF ${T.cpf},`,
      "e associado desta entidade de tiro desportivo.",
      "",
      "Matricula: 0000",
      "Data de filiacao: 10/01/2024",
      "Anuidade quitada ate: 31/12/2026",
      "Situacao: ATIVO E ADIMPLENTE",
      "",
      "Data de emissao: 01/08/2026",
    ],
  },

  comprovante_competicao: {
    grupo: "cac",
    titulo: "Treinamentos e competicoes",
    slot: "comprovante_competicao",
    linhas: [
      "CLUBE DE TIRO FICTICIO DE TESTE",
      "DECLARACAO DE PARTICIPACAO EM TREINAMENTOS E COMPETICOES",
      "",
      `Declaramos que ${T.nome}, CPF ${T.cpf},`,
      "participou das seguintes atividades nos ultimos 12 meses:",
      "",
      "12/09/2025  Treinamento de tiro - pistola",
      "14/11/2025  Competicao interna - nivel 1",
      "20/01/2026  Treinamento de tiro - carabina",
      "15/03/2026  Competicao regional - nivel 2",
      "22/05/2026  Treinamento de tiro - pistola",
      "10/07/2026  Competicao interna - nivel 1",
      "",
      "Total de habitualidades no periodo: 06",
      "Data de emissao: 01/08/2026",
    ],
  },

  dsa_declaracao_seguranca_acervo: {
    grupo: "cac",
    titulo: "DSA — Declaracao de Seguranca do Acervo",
    slot: "dsa_declaracao_seguranca_acervo",
    linhas: [
      "DECLARACAO DE SEGURANCA DO ACERVO - DSA",
      "",
      `Eu, ${T.nome}, portador do CPF ${T.cpf},`,
      `residente em ${T.endereco}, ${T.bairro}, ${T.cidade}-${T.uf},`,
      "DECLARO para os devidos fins que o local de guarda do meu acervo",
      "atende aos requisitos de seguranca previstos na legislacao,",
      "dispondo de cofre e sistema de tranca compativeis com a guarda de",
      "armas de fogo e municoes, com acesso restrito ao titular.",
      "",
      "Declaro ainda estar ciente da responsabilidade civil, penal e",
      "administrativa pela guarda do acervo.",
      "",
      `${T.cidade}-${T.uf}, 01 de agosto de 2026.`,
      `${T.nome}`,
    ],
  },

  declaracao_compromisso_habitualidade: {
    grupo: "cac",
    titulo: "ANEXO C — compromisso de habitualidade (por ESPECIE, nao por calibre)",
    slot: "declaracao_compromisso_habitualidade",
    linhas: [
      "ANEXO C",
      "DECLARACAO DE COMPROMISSO DE HABITUALIDADE",
      "IN DG/PF no 311",
      "",
      `Eu, ${T.nome}, CPF ${T.cpf},`,
      `titular do Certificado de Registro no ${T.cr},`,
      "DECLARO o compromisso de comprovar a habitualidade no uso da",
      "ESPECIE DE ARMA a ser adquirida, na forma e na periodicidade",
      "exigidas pela legislacao em vigor.",
      "",
      "Especie declarada: PISTOLA",
      "",
      `${T.cidade}-${T.uf}, 01 de agosto de 2026.`,
      `${T.nome}`,
    ],
  },

  // ── DECLARAÇÕES E IMÓVEL DE TERCEIRO ──────────────────────────────────────
  declaracao_sem_inquerito_processo_criminal: {
    grupo: "declaracoes",
    titulo: "Declaracao de que nao responde inquerito/processo criminal",
    slot: "declaracao_sem_inquerito_processo_criminal",
    linhas: [
      "DECLARACAO DE INEXISTENCIA DE INQUERITO OU PROCESSO CRIMINAL",
      "",
      `Eu, ${T.nome}, portador do CPF ${T.cpf},`,
      "DECLARO, sob as penas da lei, que NAO respondo a inquerito",
      "policial nem a processo criminal em qualquer juizo ou instancia.",
      "",
      "Declaro estar ciente de que a falsidade desta declaracao configura",
      "crime previsto no art. 299 do Codigo Penal.",
      "",
      `${T.cidade}-${T.uf}, 01 de agosto de 2026.`,
      `${T.nome}`,
    ],
  },

  declaracao_homonimia: {
    grupo: "declaracoes",
    titulo: "Declaracao de homonimia (condicional — nao trava quem nao precisa)",
    slot: "declaracao_homonimia",
    linhas: [
      "DECLARACAO DE HOMONIMIA",
      "",
      `Eu, ${T.nome}, CPF ${T.cpf},`,
      `nascido em ${T.nasc}, filho de ${T.mae},`,
      "DECLARO que o apontamento constante da certidao emitida em nome",
      "semelhante ao meu NAO se refere a minha pessoa, tratando-se de",
      "caso de homonimia.",
      "",
      `${T.cidade}-${T.uf}, 01 de agosto de 2026.`,
      `${T.nome}`,
    ],
  },

  declaracao_responsavel_imovel: {
    grupo: "declaracoes",
    titulo: "Declaracao do responsavel pelo imovel (residencia de terceiro)",
    slot: "declaracao_responsavel_imovel",
    linhas: [
      "DECLARACAO DE RESIDENCIA EM IMOVEL DE TERCEIRO",
      "",
      "Eu, JOSE PROPRIETARIO DE TESTE, CPF 111.111.111-11,",
      `proprietario do imovel situado em ${T.endereco},`,
      `${T.bairro}, ${T.cidade}-${T.uf}, CEP ${T.cep},`,
      `DECLARO que ${T.nome}, CPF ${T.cpf},`,
      "reside no referido imovel.",
      "",
      `${T.cidade}-${T.uf}, 01 de agosto de 2026.`,
      "JOSE PROPRIETARIO DE TESTE",
    ],
  },

  documento_identificacao_terceiro: {
    grupo: "declaracoes",
    titulo: "Identidade do terceiro dono do imovel",
    slot: "documento_identificacao_terceiro",
    linhas: [
      "REPUBLICA FEDERATIVA DO BRASIL",
      "SECRETARIA DE SEGURANCA PUBLICA DO ESTADO DE SAO PAULO",
      "CARTEIRA DE IDENTIDADE",
      "",
      "Nome: JOSE PROPRIETARIO DE TESTE",
      "Registro Geral: 11.111.111-1",
      "CPF: 111.111.111-11",
      "Data de nascimento: 05/05/1965",
      "Filiacao: ANTONIA PROPRIETARIA DE TESTE",
      "Data de expedicao: 02/02/2015",
    ],
  },

  // ── RESIDÊNCIA ────────────────────────────────────────────────────────────
  comprovante_residencia: {
    grupo: "residencia",
    titulo: "Comprovante de residencia (conta de energia)",
    slot: "comprovante_residencia",
    linhas: [
      "CONCESSIONARIA FICTICIA DE ENERGIA S.A.",
      "CONTA DE ENERGIA ELETRICA",
      "",
      `Cliente: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "Numero da instalacao: 0000000000",
      "",
      `Endereco: ${T.endereco}`,
      `Bairro: ${T.bairro}`,
      `Cidade: ${T.cidade} - ${T.uf}`,
      `CEP: ${T.cep}`,
      "",
      "Mes de referencia: 07/2026",
      "Vencimento: 10/08/2026",
      "Valor total: R$ 180,00",
    ],
  },

  // ── OCUPAÇÃO LÍCITA — o item que mais se ramifica ─────────────────────────
  // O checklist entrega `renda_definir_condicao` como placeholder; a condição
  // profissional declarada é que decide QUAIS destes documentos aparecem.
  // Uma amostra por ramo, para testar cada trilha isoladamente.
  ctps: {
    grupo: "ocupacao",
    titulo: "ASSALARIADO — Carteira de Trabalho Digital",
    slot: "ctps",
    linhas: [
      "REPUBLICA FEDERATIVA DO BRASIL",
      "MINISTERIO DO TRABALHO E EMPREGO",
      "CARTEIRA DE TRABALHO DIGITAL",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      `Data de nascimento: ${T.nasc}`,
      `Nome da mae: ${T.mae}`,
      "Numero da CTPS: 0000000  Serie: 0000-SP",
      "",
      "CONTRATOS DE TRABALHO",
      "Empregador: EMPRESA FICTICIA DE TESTE LTDA",
      "CNPJ: 00.000.000/0001-00",
      "Cargo: ANALISTA ADMINISTRATIVO",
      "Admissao: 03/02/2020",
      "Situacao: CONTRATO EM VIGOR",
      "Remuneracao: R$ 4.500,00",
    ],
  },

  renda_holerite_mes_atual: {
    grupo: "ocupacao",
    titulo: "ASSALARIADO — holerite da iniciativa privada",
    slot: "renda_holerite_mes_atual",
    linhas: [
      "EMPRESA FICTICIA DE TESTE LTDA",
      "CNPJ: 00.000.000/0001-00",
      "DEMONSTRATIVO DE PAGAMENTO DE SALARIO",
      "",
      `Funcionario: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "Cargo: ANALISTA ADMINISTRATIVO",
      "Competencia: 07/2026",
      "",
      "VENCIMENTOS",
      "Salario base ....................  4.500,00",
      "DESCONTOS",
      "INSS ...........................     495,00",
      "IRRF ...........................     180,00",
      "",
      "TOTAL LIQUIDO ..................  3.825,00",
    ],
  },

  // Mesma EXIGÊNCIA do de cima desde 9092d3f. Quem separa privado de servidor
  // é a condição profissional do processo, não o palpite do leitor.
  renda_holerite_funcionario_publico: {
    grupo: "ocupacao",
    titulo: "SERVIDOR PUBLICO — holerite (mesma exigencia do privado)",
    slot: "renda_holerite_funcionario_publico",
    linhas: [
      "PREFEITURA MUNICIPAL FICTICIA DE TESTE",
      "CNPJ: 00.000.000/0001-00",
      "DEMONSTRATIVO DE PAGAMENTO - SERVIDOR PUBLICO MUNICIPAL",
      "",
      `Servidor: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "Matricula: 00000-0",
      "Cargo: AGENTE ADMINISTRATIVO",
      "Vinculo: ESTATUTARIO",
      "Competencia: 07/2026",
      "",
      "VENCIMENTOS",
      "Vencimento base ................  5.200,00",
      "DESCONTOS",
      "Previdencia propria ............     572,00",
      "",
      "TOTAL LIQUIDO ..................  4.628,00",
    ],
  },

  renda_carteira_funcional: {
    grupo: "ocupacao",
    titulo: "SERVIDOR/INSTITUICAO — carteira funcional",
    slot: "renda_carteira_funcional",
    linhas: [
      "PREFEITURA MUNICIPAL FICTICIA DE TESTE",
      "CARTEIRA FUNCIONAL",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "Matricula: 00000-0",
      "Cargo: AGENTE ADMINISTRATIVO",
      "Lotacao: SECRETARIA DE ADMINISTRACAO",
      "Admissao: 03/02/2020",
      "Validade: 31/12/2027",
    ],
  },

  renda_contrato_social: {
    grupo: "ocupacao",
    titulo: "EMPRESARIO — contrato social",
    slot: "renda_contrato_social",
    linhas: [
      "CONTRATO SOCIAL",
      "EMPRESA FICTICIA DE TESTE LTDA",
      "CNPJ: 00.000.000/0001-00",
      "NIRE: 35000000000",
      "",
      "CLAUSULA PRIMEIRA - DO CAPITAL SOCIAL",
      "O capital social e de R$ 100.000,00 dividido em 100.000 quotas.",
      "",
      "CLAUSULA SEGUNDA - DOS SOCIOS",
      `${T.nome}, CPF ${T.cpf},`,
      "detentor de 60.000 quotas, na qualidade de SOCIO ADMINISTRADOR.",
      "",
      "MARIA SOCIA DE TESTE, CPF 222.222.222-22,",
      "detentora de 40.000 quotas.",
      "",
      "Registrado na JUCESP sob no 000.000/26-0 em 10/01/2026.",
    ],
  },

  renda_cartao_cnpj: {
    grupo: "ocupacao",
    titulo: "EMPRESARIO — cartao CNPJ",
    slot: "renda_cartao_cnpj",
    linhas: [
      "REPUBLICA FEDERATIVA DO BRASIL",
      "MINISTERIO DA FAZENDA",
      "SECRETARIA ESPECIAL DA RECEITA FEDERAL DO BRASIL",
      "COMPROVANTE DE INSCRICAO E DE SITUACAO CADASTRAL",
      "",
      "NUMERO DE INSCRICAO: 00.000.000/0001-00  MATRIZ",
      "NOME EMPRESARIAL: EMPRESA FICTICIA DE TESTE LTDA",
      "DATA DE ABERTURA: 10/01/2026",
      "",
      "ATIVIDADE ECONOMICA PRINCIPAL",
      "62.01-5-01 - Desenvolvimento de programas de computador sob encomenda",
      "",
      "SITUACAO CADASTRAL: ATIVA",
      "DATA DA SITUACAO CADASTRAL: 10/01/2026",
      "",
      "Emitido em: 01/08/2026",
    ],
  },

  renda_qsa: {
    grupo: "ocupacao",
    titulo: "EMPRESARIO — QSA (quadro de socios)",
    slot: "renda_qsa",
    linhas: [
      "SECRETARIA ESPECIAL DA RECEITA FEDERAL DO BRASIL",
      "QUADRO DE SOCIOS E ADMINISTRADORES - QSA",
      "",
      "CNPJ: 00.000.000/0001-00",
      "NOME EMPRESARIAL: EMPRESA FICTICIA DE TESTE LTDA",
      "",
      `Nome do socio: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "Qualificacao: 49 - Socio-Administrador",
      "Data de entrada: 10/01/2026",
      "",
      "Nome do socio: MARIA SOCIA DE TESTE",
      "CPF: 222.222.222-22",
      "Qualificacao: 22 - Socio",
      "",
      "Emitido em: 01/08/2026",
    ],
  },

  renda_ccmei: {
    grupo: "ocupacao",
    titulo: "AUTONOMO/MEI — CCMEI (nao tem vencimento)",
    slot: "renda_ccmei",
    linhas: [
      "CERTIFICADO DA CONDICAO DE MICROEMPREENDEDOR INDIVIDUAL",
      "CCMEI",
      "",
      "Identificacao: 00.000.000/0001-00",
      `Nome empresarial: ${T.nome} 00000000000`,
      `Nome do empresario: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "",
      "Data de inicio das atividades: 15/03/2023",
      "Situacao cadastral vigente: ATIVA",
      "",
      "Ocupacao principal: PROGRAMADOR DE SISTEMAS, INDEPENDENTE",
      "",
      "Este certificado comprova as inscricoes, alvara e licencas.",
      "Emitido em: 01/08/2026",
    ],
  },

  renda_extrato_inss: {
    grupo: "ocupacao",
    titulo: "APOSENTADO — extrato do INSS",
    slot: "renda_extrato_inss",
    linhas: [
      "INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS",
      "MEU INSS",
      "EXTRATO DE PAGAMENTO DE BENEFICIO",
      "",
      `Nome: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "Numero do beneficio: 000.000.000-0",
      "Especie: 41 - Aposentadoria por idade",
      "Situacao: ATIVO",
      "",
      "Competencia: 07/2026",
      "Valor do beneficio: R$ 3.200,00",
      "",
      "Emitido em: 01/08/2026",
    ],
  },

  renda_comprovante_beneficio: {
    grupo: "ocupacao",
    titulo: "APOSENTADO — comprovante de beneficio",
    slot: "renda_comprovante_beneficio",
    linhas: [
      "INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS",
      "COMPROVANTE DE RENDIMENTOS - BENEFICIO PREVIDENCIARIO",
      "",
      `Beneficiario: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "Numero do beneficio: 000.000.000-0",
      "Especie: 41 - Aposentadoria por idade",
      "",
      "Ano-calendario: 2026",
      "Rendimento tributavel: R$ 38.400,00",
      "",
      "Emitido em: 01/08/2026",
    ],
  },

  // ── GRU ───────────────────────────────────────────────────────────────────
  gru: {
    grupo: "taxa",
    titulo: "GRU — guia emitida",
    slot: "gru",
    linhas: [
      "MINISTERIO DA FAZENDA",
      "SECRETARIA DO TESOURO NACIONAL",
      "GUIA DE RECOLHIMENTO DA UNIAO - GRU SIMPLES",
      "",
      "Unidade favorecida: POLICIA FEDERAL",
      "Codigo de recolhimento: 20005-4",
      "Numero de referencia: 0000000000",
      "",
      `Nome do contribuinte: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "",
      "Competencia: 08/2026",
      "Vencimento: 31/08/2026",
      "Valor principal: R$ 88,50",
      "Valor total: R$ 88,50",
      "",
      "Nosso numero: 00000000000000000",
    ],
  },

  gru_comprovante: {
    grupo: "taxa",
    titulo: "GRU — comprovante de PAGAMENTO",
    slot: "gru_comprovante",
    linhas: [
      "BANCO FICTICIO DE TESTE S.A.",
      "COMPROVANTE DE PAGAMENTO",
      "",
      "Tipo: GUIA DE RECOLHIMENTO DA UNIAO - GRU",
      "Codigo de recolhimento: 20005-4",
      "Numero de referencia: 0000000000",
      "",
      `Pagador: ${T.nome}`,
      `CPF: ${T.cpf}`,
      "",
      "Data do pagamento: 05/08/2026",
      "Valor pago: R$ 88,50",
      "Autenticacao: TESTE0000000000000000",
    ],
  },

  // ── SAÍDA DO PROCESSO ─────────────────────────────────────────────────────
  // Vale 180 dias — nos três dossiês deferidos foram 6 meses exatos.
  autorizacao_compra: {
    grupo: "final",
    titulo: "A AUTORIZACAO DE COMPRA deferida (validade 180 dias)",
    slot: "autorizacao_compra",
    linhas: [
      "AUTORIZACAO PARA AQUISICAO DE PCE NO COMERCIO NACIONAL",
      "MINISTERIO DA JUSTICA E SEGURANCA PUBLICA",
      "POLICIA FEDERAL",
      "",
      "Deferimento:",
      "Data de Emissao:  01/08/2026",
      "Data de Validade: 28/01/2027",
      "Documento assinado pelo chefe SFPC/SR/PF/SP em 01/08/2026 10:00:00",
      "Autenticidade no SisGCorp: 00000000000000000000000000000000",
      "",
      "Autorizacao No: 00000000000000",
      "",
      "1. IDENTIFICACAO DO ADQUIRENTE",
      `Nome/Razao Social: ${T.nome}`,
      `CR: ${T.cr}`,
      `CPF/CNPJ: ${T.cpf}`,
      `Endereco: ${T.endereco}`,
      `Cidade e UF: ${T.cidade} - ${T.uf}`,
      "",
      "2. DO ARMAMENTO AUTORIZADO",
      "Especie: PISTOLA   Calibre: 9mm   Quantidade: 01",
    ],
  },

  documento_complementar_caso: {
    grupo: "final",
    titulo: "Contrato/pedido da loja (so para quem respondeu SIM na pergunta)",
    slot: "documento_complementar_caso",
    linhas: [
      "LOJA FICTICIA DE ARMAS E MUNICOES LTDA",
      "CNPJ: 00.000.000/0001-00",
      "Registro no Exercito: 000000",
      "PEDIDO DE VENDA / CONTRATO DE COMPRA E VENDA",
      "",
      `Comprador: ${T.nome}`,
      `CPF: ${T.cpf}`,
      `CR: ${T.cr}`,
      "",
      "ARMAMENTO",
      "Especie: PISTOLA",
      "Marca/Modelo: FABRICANTE FICTICIO / MODELO TESTE",
      "Calibre: 9mm",
      "Numero de serie: TESTE000000",
      "Quantidade: 01",
      "",
      "Valor: R$ 5.900,00",
      "Data do pedido: 01/08/2026",
    ],
  },
};

// ============================================================================
// PDF
// ============================================================================
async function gerarPdf(chave, modelo, semTexto) {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595, 842]); // A4
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 790;
  for (const [i, linha] of modelo.linhas.entries()) {
    if (linha) {
      if (semTexto) {
        // "PDF escaneado": o conteúdo vira desenho, não texto. O pdf.js não
        // acha camada de texto e o sistema cai no caminho da IA — que é o
        // outro trecho do fluxo, e hoje não tem teste automatizado nenhum.
        desenharComoTracos(pagina, linha, y, fonte);
      } else {
        pagina.drawText(linha, {
          x: 56,
          y,
          size: i < 3 ? 12 : 10,
          font: i < 3 ? fonteBold : fonte,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
    }
    y -= 20;
    if (y < 70) break;
  }

  pagina.drawText(CARIMBO, {
    x: 56,
    y: 40,
    size: 8,
    font: fonteBold,
    color: rgb(0.75, 0.1, 0.1),
  });

  // Acolchoamento até passar de MIN_PDF_BYTES. Vai nos METADADOS, não na
  // página: metadado não entra em getTextContent(), então o parser continua
  // lendo exatamente o texto do documento, sem sujeira.
  //
  // O enchimento precisa ser INCOMPRESSÍVEL. O PDF sai comprimido (Flate +
  // object streams), então texto repetido encolhe para quase nada e o arquivo
  // continua abaixo do mínimo — foi o que aconteceu na primeira tentativa.
  // Por isso o enchimento é pseudoaleatório, com semente fixa para o arquivo
  // sair idêntico a cada execução.
  const ALVO = MIN_PDF_BYTES + 512;
  let bytes = await pdf.save();
  if (bytes.length < ALVO) {
    pdf.setTitle(`Amostra sintetica de teste — ${modelo.titulo}`);
    pdf.setProducer("gerar-doc-teste.mjs");

    const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let semente = 7;
    const proximo = () => {
      semente = (semente * 1103515245 + 12345) & 0x7fffffff;
      return ALFABETO[(semente >>> 16) % ALFABETO.length];
    };

    let enchimento = "";
    for (let tentativa = 0; tentativa < 12 && bytes.length < ALVO; tentativa++) {
      const faltando = ALVO - bytes.length;
      let novo = "";
      for (let i = 0; i < faltando + 256; i++) novo += proximo();
      enchimento += novo;
      pdf.setSubject(
        "Amostra sintetica de teste. O bloco abaixo existe apenas para o " +
          "arquivo ultrapassar o tamanho minimo exigido no upload. " +
          enchimento,
      );
      bytes = await pdf.save();
    }
  }
  return bytes;
}

// Rasterizar de verdade exigiria um renderizador. Para o efeito que interessa
// — PDF sem camada de texto extraível — basta desenhar as letras como traços.
function desenharComoTracos(pagina, linha, y, fonte) {
  let x = 56;
  for (const caractere of linha) {
    const largura = fonte.widthOfTextAtSize(caractere, 10);
    if (caractere !== " ") {
      pagina.drawRectangle({
        x,
        y: y + 1,
        width: Math.max(largura - 1, 1),
        height: 7,
        color: rgb(0.15, 0.15, 0.15),
      });
    }
    x += largura;
  }
}

// ============================================================================
// PNG — só a foto 3x4 aceita imagem, e ela precisa passar de 40KB
// ============================================================================
function crc32(buf) {
  let c;
  const tabela = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = tabela[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([len, corpo, crc]);
}

/**
 * Retrato-placeholder 3x4. A IA não extrai texto de retrato — o próprio código
 * do Hub anota que foto sempre cai em "outro documento" —, então o que importa
 * aqui é ser uma imagem válida, com proporção de 3x4 e acima de 40KB. O grão
 * leve garante o tamanho sem inflar com dados falsos de documento.
 */
function gerarFoto3x4() {
  const L = 480;
  const A = 640;
  const linhas = [];
  // Semente fixa: mesma foto toda vez, para o teste ser repetível.
  let semente = 42;
  const rnd = () => {
    semente = (semente * 1103515245 + 12345) & 0x7fffffff;
    return (semente >>> 16) % 24;
  };

  for (let y = 0; y < A; y++) {
    const linha = Buffer.alloc(1 + L * 3);
    linha[0] = 0; // filtro "none"
    for (let x = 0; x < L; x++) {
      const dx = x - L / 2;
      const dyCabeca = y - A * 0.36;
      const naCabeca = (dx * dx) / (110 * 110) + (dyCabeca * dyCabeca) / (145 * 145) <= 1;
      const dyOmbro = y - A * 1.06;
      const noOmbro = (dx * dx) / (250 * 250) + (dyOmbro * dyOmbro) / (330 * 330) <= 1;

      let r;
      let g;
      let b;
      if (naCabeca) {
        r = 214; g = 178; b = 152; // tom de pele neutro
      } else if (noOmbro) {
        r = 62; g = 74; b = 96; // roupa
      } else {
        r = 236; g = 238; b = 242; // fundo claro, como pede foto 3x4
      }
      const grao = rnd();
      const i = 1 + x * 3;
      linha[i] = Math.max(0, Math.min(255, r + grao - 12));
      linha[i + 1] = Math.max(0, Math.min(255, g + grao - 12));
      linha[i + 2] = Math.max(0, Math.min(255, b + grao - 12));
    }
    linhas.push(linha);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(L, 0);
  ihdr.writeUInt32BE(A, 4);
  ihdr[8] = 8; // profundidade
  ihdr[9] = 2; // truecolor RGB
  const idat = deflateSync(Buffer.concat(linhas), { level: 6 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ============================================================================
// CLI
// ============================================================================
async function gerar(chave, semTexto, subpasta) {
  const modelo = MODELOS[chave];
  const pasta = subpasta ? join(SAIDA, subpasta) : SAIDA;
  await mkdir(pasta, { recursive: true });

  if (modelo.formato === "png") {
    const bytes = gerarFoto3x4();
    const destino = join(pasta, `${chave}.png`);
    await writeFile(destino, bytes);
    return { destino, bytes: bytes.length, minimo: MIN_IMG_BYTES };
  }

  const bytes = await gerarPdf(chave, modelo, semTexto);
  const destino = join(pasta, `${chave}${semTexto ? "-escaneado" : ""}.pdf`);
  await writeFile(destino, bytes);
  return { destino, bytes: bytes.length, minimo: MIN_PDF_BYTES };
}

// Só roda o CLI quando o arquivo é executado direto. Importado pela suíte de
// testes, este bloco fica quieto — senão o teste geraria PDF e apagaria pasta.
const executadoDireto =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

async function cli() {
const args = process.argv.slice(2);
const semTexto = args.includes("--sem-texto");
const iGrupo = args.indexOf("--grupo");
const grupoPedido = iGrupo >= 0 ? args[iGrupo + 1] : null;
// O valor de --grupo não é alvo. Sem --grupo, iGrupo é -1 e nenhum índice
// pode ser excluído — senão o primeiro argumento some.
const alvo = args.filter((a, i) => !a.startsWith("--") && (iGrupo < 0 || i !== iGrupo + 1))[0];

if (!alvo && !grupoPedido) {
  console.log("\nDOSSIE COMPLETO");
  console.log("  autorizacao-compra    servico 50 - Autorizacao de Compra Atirador (CAC)");
  console.log("                        gera os " + Object.keys(MODELOS).length + " documentos, em pastas por etapa\n");
  console.log("GRUPOS (--grupo <nome>)");
  for (const [g, desc] of Object.entries(GRUPOS)) {
    const qtd = Object.values(MODELOS).filter((m) => m.grupo === g).length;
    console.log(`  ${g.padEnd(14)} ${String(qtd).padStart(2)} doc  ${desc}`);
  }
  console.log("\nAVULSOS");
  for (const [chave, m] of Object.entries(MODELOS)) {
    console.log(`  ${chave.padEnd(38)} ${m.titulo}`);
  }
  console.log("\nOpcao: --sem-texto  gera a versao 'escaneada' (caminho da IA)\n");
  process.exit(0);
}

let chaves;
let porGrupo = false;
if (alvo === "autorizacao-compra") {
  chaves = Object.keys(MODELOS);
  porGrupo = true;
  await rm(SAIDA, { recursive: true, force: true });
} else if (grupoPedido) {
  if (!GRUPOS[grupoPedido]) {
    console.error(`Grupo desconhecido: ${grupoPedido}. Ha: ${Object.keys(GRUPOS).join(", ")}`);
    process.exit(1);
  }
  chaves = Object.keys(MODELOS).filter((k) => MODELOS[k].grupo === grupoPedido);
  porGrupo = true;
} else {
  if (!MODELOS[alvo]) {
    console.error(`Modelo desconhecido: ${alvo}`);
    process.exit(1);
  }
  chaves = [alvo];
}

const ordemGrupos = Object.keys(GRUPOS);
chaves.sort((a, b) => {
  const d = ordemGrupos.indexOf(MODELOS[a].grupo) - ordemGrupos.indexOf(MODELOS[b].grupo);
  return d !== 0 ? d : a.localeCompare(b);
});

let grupoAtual = null;
let total = 0;
for (const chave of chaves) {
  const m = MODELOS[chave];
  if (porGrupo && m.grupo !== grupoAtual) {
    grupoAtual = m.grupo;
    console.log(`\n── ${GRUPOS[grupoAtual]}`);
  }
  const nGrupo = ordemGrupos.indexOf(m.grupo) + 1;
  const sub = porGrupo ? `${String(nGrupo).padStart(2, "0")}-${m.grupo}` : null;
  const { destino, bytes, minimo } = await gerar(chave, semTexto, sub);
  const ok = bytes >= minimo ? "ok" : "ABAIXO DO MINIMO";
  console.log(
    `   ${destino.replace(RAIZ + "/", "")}  ${(bytes / 1024).toFixed(1)}KB  ${ok}  [slot: ${m.slot}]`,
  );
  total += 1;
}
console.log(`\n${total} arquivo(s) em tmp/doc-teste/\n`);
}

if (executadoDireto) await cli();

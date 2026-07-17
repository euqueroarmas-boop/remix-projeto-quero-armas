// Edge Function: qa-classificar-documento-arma
// Classifica automaticamente um documento enviado no Arsenal e o compara
// com o tipo escolhido manualmente pelo cliente.
//
// Tipos suportados:
//   CRAF · GT · GTE · GUIA_TRANSITO · NOTA_FISCAL · EXAME_LAUDO · DESCONHECIDO
//
// Entrada (POST JSON):
//   { imageDataUrl: string, tipoSelecionado: string }
//   ou
//   { storage_bucket: string, storage_path: string, tipoSelecionado: string }
//
// Saída:
//   {
//     tipoDetectado, confianca (0..1), camposExtraidos, justificativa,
//     divergenciaComSelecaoManual, recomendacao: "aceitar"|"confirmar"|"revisao_obrigatoria",
//     revisao_obrigatoria: boolean
//   }
//
// Diretrizes:
//  - service_role no servidor; aceita sessão autenticada ou fluxo público via anon key.
//  - Não escreve em tabelas (decisão de salvar fica com o caller).
//  - Modelo: google/gemini-3-flash-preview.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TIPOS = [
  "CR","CRAF","SINARM","GT","GTE","GUIA_TRANSITO","AUTORIZACAO_COMPRA","NOTA_FISCAL_ARMA",
  "RG_COM_CPF","CIN","CNH","CPF",
  "COMPROVANTE_RESIDENCIA","DECLARACAO_RESPONSAVEL_IMOVEL",
  "CTPS","HOLERITE","CARTAO_CNPJ","CONTRATO_SOCIAL","NOTA_FISCAL_AUTONOMO","COMPROVANTE_BENEFICIO","EXTRATO_INSS",
  "ANTECEDENTES_CRIMINAIS","ANTECEDENTES_FEDERAL","ANTECEDENTES_ESTADUAL","ANTECEDENTES_MILITAR","ANTECEDENTES_ELEITORAL",
  "DECLARACAO_NAO_INQUERITO","DECLARACAO_GUARDA_RESPONSAVEL","DECLARACAO_CORRELATA","DECLARACAO_GUARDA_ACERVO",
  "LAUDO_PSICOLOGICO","LAUDO_CAPACIDADE_TECNICA",
  "COMPROVANTE_EFETIVA_NECESSIDADE","DOCUMENTO_COMPLEMENTAR",
  "COMPROVANTE_HABITUALIDADE","COMPROVANTE_CLUBE","COMPROVANTE_COMPETICAO",
  "PROTOCOLO_PROCESSO","OFICIO","DESPACHO","EXIGENCIA","INDEFERIMENTO",
  "PROCURACAO","RECURSO_ADMINISTRATIVO","MANDADO_SEGURANCA",
  "DESCONHECIDO",
] as const;
type Tipo = typeof TIPOS[number];

const tool = {
  type: "function",
  function: {
    name: "classificar_documento_arma",
    description: "Classifica qualquer documento enviado por um cliente no Hub Documental brasileiro (armas, identificação civil, renda, antecedentes, declarações, laudos, CAC, processos administrativos e jurídicos).",
    parameters: {
      type: "object",
      properties: {
        tipoDetectado: {
          type: "string",
          enum: TIPOS as unknown as string[],
          description:
            "Tipo identificado. " +
            "CR=Certificado de Registro CAC (Exército). CRAF=Certificado de Registro de Arma de Fogo. SINARM=Registro/Posse/Porte PF. GT=Guia de Tráfego. GTE=Guia de Tráfego Especial. GUIA_TRANSITO=Guia de Trânsito SINARM/PF. AUTORIZACAO_COMPRA=Autorização de Compra arma/munição. NOTA_FISCAL_ARMA=NF-e de arma/munição. " +
            "RG_COM_CPF=RG com CPF ou documento de identidade estadual com CPF. CIN=Carteira de Identidade Nacional. CNH=Carteira Nacional de Habilitação. CPF=Cadastro de Pessoa Física (Receita Federal). " +
            "COMPROVANTE_RESIDENCIA=conta de luz/água/gás/telefone/bancária com endereço. DECLARACAO_RESPONSAVEL_IMOVEL=declaração assinada pelo responsável pelo imóvel. " +
            "CTPS=Carteira de Trabalho (física ou digital). HOLERITE=contracheque/holerite/demonstrativo de pagamento. CARTAO_CNPJ=cartão CNPJ da Receita Federal. CONTRATO_SOCIAL=contrato ou estatuto social de empresa. NOTA_FISCAL_AUTONOMO=NF de autônomo/MEI. COMPROVANTE_BENEFICIO=comprovante INSS, previdência, benefício social. EXTRATO_INSS=extrato de contribuições INSS. " +
            "ANTECEDENTES_CRIMINAIS=certidão de antecedentes criminais (PC estadual). ANTECEDENTES_FEDERAL=certidão antecedentes PF/STF/STJ/TRF. ANTECEDENTES_ESTADUAL=certidão criminal de tribunal estadual (TJ). ANTECEDENTES_MILITAR=certidão de antecedentes militares. ANTECEDENTES_ELEITORAL=certidão de crimes eleitorais. " +
            "DECLARACAO_NAO_INQUERITO=declaração de não responder a inquérito ou processo criminal. DECLARACAO_GUARDA_RESPONSAVEL=declaração de guarda responsável de arma. DECLARACAO_CORRELATA=outra declaração pessoal do titular. DECLARACAO_GUARDA_ACERVO=declaração de guarda de acervo CAC (1 ou 2 endereços). " +
            "LAUDO_PSICOLOGICO=laudo psicológico de aptidão. LAUDO_CAPACIDADE_TECNICA=atestado de capacidade técnica. " +
            "COMPROVANTE_EFETIVA_NECESSIDADE=documento de comprovação de efetiva necessidade (segurança, ameaça etc.). DOCUMENTO_COMPLEMENTAR=documento complementar avulso do caso concreto. " +
            "COMPROVANTE_HABITUALIDADE=comprovante de habitualidade de clube/entidade CAC. COMPROVANTE_CLUBE=comprovante de filiação/atividade em clube de tiro. COMPROVANTE_COMPETICAO=comprovante de participação em competição esportiva. " +
            "PROTOCOLO_PROCESSO=protocolo ou número de processo administrativo. OFICIO=ofício administrativo. DESPACHO=despacho ou movimentação processual. EXIGENCIA=exigência administrativa formal. INDEFERIMENTO=decisão de indeferimento. " +
            "PROCURACAO=procuração outorgada pelo titular. RECURSO_ADMINISTRATIVO=recurso administrativo. MANDADO_SEGURANCA=mandado de segurança ou outra peça jurídica. " +
            "DESCONHECIDO=documento ilegível, baixa confiança ou sem enquadramento.",
        },
        confianca: {
          type: "number",
          description: "Confiança 0.0 a 1.0 do tipo detectado.",
        },
        justificativa: {
          type: "string",
          description: "Texto curto explicando os indícios encontrados (cabeçalho, órgão, campos, expressões).",
        },
        camposExtraidos: {
          type: "object",
          description: "Campos extraídos relevantes ao tipo detectado. Preencha APENAS os campos que existem no documento. Deixe vazio se não houver.",
          properties: {
            numero_documento: { type: "string", description: "Número principal do documento (RG, CNH, CIN, CR, CRAF, protocolo etc.)" },
            orgao_emissor: { type: "string", description: "Órgão/entidade que emitiu o documento" },
            uf_emissor_rg: { type: "string", description: "UF do órgão emissor do RG/CIN/CNH, em 2 letras, quando o documento trouxer UF explícita, órgão com /UF ou -UF, cabeçalho do estado emissor ou estado por extenso." },
            data_emissao: { type: "string", description: "Data de emissão DD/MM/AAAA" },
            data_validade: { type: "string", description: "Data de validade DD/MM/AAAA" },
            nome_completo: { type: "string", description: "Nome completo do titular do documento" },
            cpf: { type: "string", description: "CPF do titular (somente dígitos ou com pontuação original)" },
            data_nascimento: { type: "string", description: "Data de nascimento DD/MM/AAAA" },
            filiacao_mae: { type: "string", description: "Nome da mãe" },
            filiacao_pai: { type: "string", description: "Nome do pai" },
            naturalidade: { type: "string", description: "Cidade/estado de nascimento" },
            nacionalidade: { type: "string", description: "Nacionalidade" },
            sexo: { type: "string", description: "Sexo (M/F) se constar no documento" },
            categoria_cnh: { type: "string", description: "Categoria(s) da CNH (ex.: AB, B, ACC)" },
            numero_registro_cnh: { type: "string", description: "Número de registro da CNH (diferente do número do documento)" },
            primeira_habilitacao: { type: "string", description: "Data da primeira habilitação DD/MM/AAAA" },
            endereco_completo: { type: "string", description: "Endereço completo conforme consta no documento" },
            cep: { type: "string", description: "CEP" },
            numero_ctps: { type: "string", description: "Número da Carteira de Trabalho" },
            serie_ctps: { type: "string", description: "Série da Carteira de Trabalho" },
            empregador_nome: { type: "string", description: "Nome do empregador (holerite)" },
            empregador_cnpj: { type: "string", description: "CNPJ do empregador (holerite)" },
            competencia: { type: "string", description: "Mês/ano de competência do holerite (MM/AAAA)" },
            salario_bruto: { type: "string", description: "Salário bruto conforme holerite" },
            salario_liquido: { type: "string", description: "Salário líquido conforme holerite" },
            cnpj: { type: "string", description: "CNPJ da empresa (cartão CNPJ ou contrato social)" },
            razao_social: { type: "string", description: "Razão social da empresa" },
            situacao_cadastral: { type: "string", description: "Situação cadastral (ativa, inapta etc.)" },
            numero_beneficio: { type: "string", description: "Número do benefício INSS" },
            resultado_certidao: { type: "string", enum: ["nada_consta", "consta_apontamento"], description: "Resultado da certidão: use EXATAMENTE 'nada_consta' quando não há registros, ou 'consta_apontamento' quando há qualquer apontamento criminal/eleitoral/pendência." },
            nome_declarante: { type: "string", description: "Nome de quem assina a declaração" },
            cpf_declarante: { type: "string", description: "CPF de quem assina a declaração" },
            nome_profissional: { type: "string", description: "Nome do psicólogo/instrutor que assina o laudo" },
            registro_profissional: { type: "string", description: "CRP, CRM ou registro do profissional" },
            resultado_laudo: { type: "string", description: "Resultado do laudo: 'apto', 'inapto' ou texto equivalente" },
            arma_marca: { type: "string" },
            arma_modelo: { type: "string", description: "Modelo comercial somente se estiver escrito explicitamente no documento. NÃO preencher com TIPO/espécie. Se não houver modelo explícito, deixar vazio." },
            arma_especie: { type: "string", description: "Tipo/espécie da arma (ex.: PISTOLA, REVÓLVER, CARABINA)" },
            arma_calibre: { type: "string" },
            arma_numero_serie: { type: "string" },
            sigma_ou_sinarm: { type: "string" },
            numero_cad_sinarm: { type: "string", description: "OBRIGATÓRIO quando contiver 'Nº Cad. SINARM'. Copie o valor EXATO preservando barra e hífen (ex.: 2022/905178870-50)." },
            numero_registro_sigma: { type: "string", description: "Número de registro SIGMA apenas quando o documento for do Exército/SIGMA/CAC com indicação explícita." },
            sistema_registro: { type: "string", enum: ["SINARM", "SIGMA", "REVISAR"], description: "SINARM se houver 'Nº Cad. SINARM' ou PF/SINARM. SIGMA se Exército/SIGMA/CAC explícito. REVISAR caso contrário." },
            origem: { type: "string" },
            destino: { type: "string" },
            emitente: { type: "string" },
            nf_chave_acesso: { type: "string", description: "44 dígitos da NF-e" },
            nf_produto: { type: "string" },
            nf_calibre: { type: "string" },
            nf_quantidade: { type: "string" },
            nf_lote: { type: "string" },
            nf_valor: { type: "string" },
            nf_destinatario_documento: { type: "string", description: "CPF/CNPJ do destinatário" },
            data_filiacao: { type: "string", description: "Para COMPROVANTE_CLUBE: data de início/renovação da filiação anual (ex.: 'datado de DD/MM/AAAA'). DD/MM/AAAA. A filiação anual vence 1 ano após esta data. Diferente da data de emissão da declaração." },
          },
          additionalProperties: false,
        },
      },
      required: ["tipoDetectado", "confianca", "justificativa"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = [
  "Você é especialista em classificação de documentos brasileiros para processos administrativos de armas de fogo (SINARM, SIGMA, CAC, Polícia Federal, Exército) e documentos pessoais/civis do requerente.",
  "Sua tarefa é identificar o TIPO do documento enviado e extrair fielmente os campos principais.",
  "",
  "=== DOCUMENTOS DE ARMAS / ACERVO ===",
  "• CR: 'Certificado de Registro' de CAC. Cabeçalho típico: 'Ministério da Defesa — Exército Brasileiro — Certificado de Registro' (CR antigo) OU 'Polícia Federal — Certificado de Registro' (CR pós Decreto 11.615/2023). Possui número de CR, RM/SFPC de vinculação, validade longa (até 10 anos) e categorias CAC marcadas (Caça, Colecionamento, Tiro Desportivo). NÃO traz tabela com dados de arma específica (marca/modelo/série) — isso é CRAF, não CR.",
  "  IMPORTANTE: CRs emitidos pelo Exército Brasileiro antes do Decreto 11.615/2023 (transferência da competência para a Polícia Federal) PERMANECEM VÁLIDOS e devem ser classificados como CR com confiança alta (>=0.9). NUNCA classifique um Certificado de Registro do Exército como DESCONHECIDO/OUTRO só por causa do órgão emissor.",
  "  Extrair: nome_completo (Proprietário/Titular), cpf, data_nascimento, numero_documento (nº do CR), orgao_emissor (ex.: 'Cmdo 2ª RM', 'SFPC/2', 'Polícia Federal'), data_emissao, data_validade, filiacao_mae, filiacao_pai, naturalidade, sexo, observacoes (categorias CAC marcadas, ex.: 'Caça; Colecionamento; Tiro Desportivo').",
  "• CRAF: 'Certificado de Registro de Arma de Fogo', número do CRAF, dados da arma (marca/modelo/série/calibre), SIGMA ou SINARM, validade.",
  "• SINARM: registro/posse/porte da Polícia Federal, número SINARM, dados da arma civil.",
  "• GT: 'Guia de Tráfego' (retirada da loja / transporte inicial), origem=loja/vendedor, destino=residência/clube, validade curta.",
  "• GTE: 'Guia de Tráfego Especial', Exército, acervo CAC/SIGMA, lista de armas, clubes/locais autorizados, validade prolongada.",
  "• GUIA_TRANSITO: 'Guia de Trânsito' SINARM/Polícia Federal — autorização de transporte/movimentação, origem/destino, validade.",
  "• AUTORIZACAO_COMPRA: 'Autorização de Compra' (AC) de arma ou munição, emitida pelo Exército ou PF, com prazo para execução.",
  "• NOTA_FISCAL_ARMA: NF-e/DANFE cujo produto seja arma de fogo ou munição; chave de acesso de 44 dígitos.",
  "",
  "=== IDENTIFICAÇÃO CIVIL ===",
  "• RG_COM_CPF: carteira de identidade estadual (RG) com CPF impresso; órgãos SSP, DETRAN, IIRGD.",
  "  Extrair: nome_completo, cpf, data_nascimento, numero_documento (nº RG), orgao_emissor, uf_emissor_rg, data_emissao, filiacao_mae, filiacao_pai, naturalidade, nacionalidade, sexo.",
  "• CIN: Carteira de Identidade Nacional — cabeçalho 'CARTEIRA DE IDENTIDADE NACIONAL'; QR-Code; número de 9 dígitos; emitida a partir de 2023.",
  "  Extrair: nome_completo, cpf, data_nascimento, numero_documento (nº CIN 9 dígitos), orgao_emissor, uf_emissor_rg, data_emissao, data_validade, filiacao_mae, filiacao_pai, naturalidade, nacionalidade, sexo.",
  "• CNH: Carteira Nacional de Habilitação; categorias (A, B, AB…); DETRAN/SENATRAN.",
  "  Extrair: nome_completo, cpf, data_nascimento, numero_documento (nº CNH), numero_registro_cnh, categoria_cnh, orgao_emissor, uf_emissor_rg, data_emissao, data_validade, primeira_habilitacao, filiacao_mae, filiacao_pai, naturalidade, sexo.",
  "  Regra determinística para uf_emissor_rg: use a UF explícita em orgao_emissor (ex.: IIRGD -SP, SSP/SP, DETRAN/PR), no cabeçalho do estado emissor, no campo UF da CNH ou no estado por extenso do órgão; não use endereço/naturalidade como chute.",
  "• CPF: documento Receita Federal com CPF; pode ser cartão físico, impresso ou extrato online.",
  "  Extrair: nome_completo, cpf (número), orgao_emissor ('Receita Federal'), data_emissao, situacao_cadastral.",
  "",
  "=== RESIDÊNCIA / ENDEREÇO ===",
  "• COMPROVANTE_RESIDENCIA: conta de concessionária (luz, água, gás, telefone) ou extrato bancário com endereço.",
  "  Extrair: nome_completo, cpf (se constar), endereco_completo, cep, orgao_emissor (ex.: CPFL, Sabesp, Claro), data_emissao.",
  "  OBRIGATÓRIO: extraia o CÓDIGO DE INSTALAÇÃO / UC / matrícula da conta (campo 'Código de Instalação', 'Número UC', 'UC', 'Instalação', 'Nº de Instalação', 'Matrícula') no campo codigo_instalacao (somente dígitos, sem traços ou pontos). Este é o identificador fixo do imóvel na concessionária.",
  "  numero_documento: coloque o MESMO valor que codigo_instalacao (código de instalação/UC — NÃO o CPF, NÃO o número da fatura, NÃO o mês/ano).",
  "• DECLARACAO_RESPONSAVEL_IMOVEL: declaração assinada pelo responsável do imóvel.",
  "  Extrair: nome_declarante, cpf_declarante, endereco_completo, data_emissao.",
  "",
  "=== RENDA / OCUPAÇÃO ===",
  "• CTPS: Carteira de Trabalho e Previdência Social.",
  "  Extrair: nome_completo, cpf, data_nascimento, numero_ctps, serie_ctps, data_emissao, orgao_emissor.",
  "• HOLERITE: contracheque/demonstrativo de pagamento.",
  "  Extrair: nome_completo, cpf, empregador_nome, empregador_cnpj, competencia (MM/AAAA), salario_bruto, salario_liquido.",
  "• CARTAO_CNPJ: comprovante de inscrição CNPJ — Receita Federal.",
  "  Extrair: razao_social, cnpj, situacao_cadastral, data_emissao, orgao_emissor ('Receita Federal').",
  "• CONTRATO_SOCIAL: contrato ou estatuto social.",
  "  Extrair: razao_social, cnpj, nome_completo (sócio principal), data_emissao.",
  "• NOTA_FISCAL_AUTONOMO: NF de prestação de serviço emitida por autônomo/MEI.",
  "  Extrair: nome_completo, cpf, cnpj, data_emissao, nf_valor.",
  "• COMPROVANTE_BENEFICIO: comprovante de benefício INSS.",
  "  Extrair: nome_completo, cpf, numero_beneficio, orgao_emissor ('INSS'), data_emissao, salario_liquido (valor do benefício).",
  "• EXTRATO_INSS: extrato de contribuições ou Carta de Concessão Meu INSS.",
  "  Extrair: nome_completo, cpf, numero_beneficio, data_emissao.",
  "",
  "=== ANTECEDENTES / REGULARIDADE ===",
  "REGRA GERAL PARA CERTIDÕES E TODOS OS DOCUMENTOS COM DADOS PESSOAIS:",
  "Extraia TODOS os dados pessoais visíveis: nome_completo, cpf, data_nascimento, filiacao_mae, filiacao_pai, naturalidade, sexo.",
  "Esses dados serão confrontados com documentos de identidade e cadastro do cliente para detectar qualquer divergência.",
  "Para resultado_certidao use OBRIGATORIAMENTE 'nada_consta' ou 'consta_apontamento' — nenhum outro valor é aceito.",
  "• ANTECEDENTES_CRIMINAIS: certidão de antecedentes criminais Polícia Civil estadual.",
  "  Extrair: nome_completo, cpf, data_nascimento, filiacao_mae, filiacao_pai, naturalidade, sexo, orgao_emissor (ex.: 'Secretaria de Segurança Pública de SP'), data_emissao, data_validade, resultado_certidao.",
  "• ANTECEDENTES_FEDERAL: certidão criminal PF, STF, STJ ou TRF.",
  "  Extrair: nome_completo, cpf, data_nascimento, filiacao_mae, filiacao_pai, naturalidade, sexo, orgao_emissor, data_emissao, data_validade, resultado_certidao.",
  "• ANTECEDENTES_ESTADUAL: certidão criminal de Tribunal de Justiça estadual.",
  "  Extrair: nome_completo, cpf, data_nascimento, filiacao_mae, filiacao_pai, naturalidade, sexo, orgao_emissor (ex.: 'TJ-SP'), data_emissao, data_validade, resultado_certidao.",
  "• ANTECEDENTES_MILITAR: certidão de tribunal militar (TJM, STM). Validade: 3 meses após a data de emissão.",
  "  Extrair: nome_completo, cpf, data_nascimento, filiacao_mae, filiacao_pai, naturalidade, sexo, orgao_emissor, data_emissao, data_validade, resultado_certidao.",
  "• ANTECEDENTES_ELEITORAL: certidão de crimes eleitorais TSE ou TRE. NÃO classifique como quitação eleitoral quando o cabeçalho indicar crimes eleitorais.",
  "  Extrair: nome_completo, cpf, data_nascimento, filiacao_mae, filiacao_pai, naturalidade, sexo, numero_documento (número do título de eleitor — campo 'Número do Título' ou 'Título de Eleitor n.'), orgao_emissor (ex.: 'TSE'), data_emissao, data_validade, resultado_certidao.",
  "  ATENÇÃO: se a certidão não trazer data_validade explícita, não invente — deixe vazio; o sistema calcula automaticamente.",
  "",
  "=== DECLARAÇÕES PESSOAIS ===",
  "• DECLARACAO_NAO_INQUERITO: declaração de não responder a inquérito/processo criminal.",
  "  Extrair: nome_declarante, cpf_declarante, data_emissao.",
  "• DECLARACAO_GUARDA_RESPONSAVEL: declaração de responsabilidade pela guarda de arma.",
  "  Extrair: nome_declarante, cpf_declarante, data_emissao.",
  "• DECLARACAO_CORRELATA: outra declaração pessoal.",
  "  Extrair: nome_declarante, cpf_declarante, data_emissao.",
  "• DECLARACAO_GUARDA_ACERVO: declaração de local de guarda do acervo CAC (1 ou 2 endereços).",
  "  Extrair: nome_declarante, cpf_declarante, endereco_completo, data_emissao.",
  "",
  "=== LAUDOS E EXAMES ===",
  "• LAUDO_PSICOLOGICO: laudo de aptidão psicológica assinado por psicólogo CRP.",
  "  Extrair: nome_completo (avaliado), cpf (avaliado), nome_profissional, registro_profissional (CRP), resultado_laudo (apto/inapto), data_emissao, data_validade.",
  "• LAUDO_CAPACIDADE_TECNICA: atestado de capacidade técnica assinado por instrutor credenciado.",
  "  Extrair: nome_completo (avaliado), cpf (avaliado), nome_profissional, registro_profissional, resultado_laudo, data_emissao, data_validade.",
  "",
  "=== EFETIVA NECESSIDADE ===",
  "• COMPROVANTE_EFETIVA_NECESSIDADE: BO, decisão judicial de ameaça, declaração de risco.",
  "  Extrair: nome_completo, cpf, orgao_emissor, numero_documento (nº do BO ou processo), data_emissao.",
  "• DOCUMENTO_COMPLEMENTAR: documento avulso complementar.",
  "  Extrair: nome_completo, cpf, orgao_emissor, data_emissao.",
  "",
  "=== CAC / HABITUALIDADE ===",
  "• COMPROVANTE_HABITUALIDADE: comprovante de habitualidade de clube/entidade CAC.",
  "  Extrair: nome_completo, cpf, orgao_emissor (nome do clube/entidade), data_emissao, data_validade.",
  "• COMPROVANTE_CLUBE: comprovante de filiação ativa a clube de tiro.",
  "  Extrair: nome_completo, cpf, orgao_emissor (nome do clube), data_emissao (data de emissão/assinatura da declaração), data_validade (se houver data explícita de validade da declaração; senão deixe vazio — o sistema calcula 90 dias da emissão), data_filiacao (data de início/renovação da filiação anual, ex.: 'datado de DD/MM/AAAA' no corpo do texto — diferente da data de emissão da declaração).",
  "• COMPROVANTE_COMPETICAO: diploma ou resultado de competição esportiva de tiro.",
  "  Extrair: nome_completo, cpf, orgao_emissor (federação/clube), data_emissao.",
  "",
  "=== DOCUMENTOS PROCESSUAIS ===",
  "• PROTOCOLO_PROCESSO: protocolo de processo administrativo.",
  "  Extrair: numero_documento (nº protocolo/processo), orgao_emissor, nome_completo (requerente), data_emissao.",
  "• OFICIO: ofício administrativo emitido por órgão público.",
  "  Extrair: numero_documento (nº do ofício), orgao_emissor, data_emissao.",
  "• DESPACHO: despacho ou movimentação processual.",
  "  Extrair: numero_documento (nº processo), orgao_emissor, data_emissao.",
  "• EXIGENCIA: notificação de exigência administrativa.",
  "  Extrair: numero_documento (nº processo/protocolo), orgao_emissor, data_emissao, data_validade (prazo para cumprimento).",
  "• INDEFERIMENTO: decisão de indeferimento.",
  "  Extrair: numero_documento (nº processo), orgao_emissor, data_emissao.",
  "",
  "=== DOCUMENTOS JURÍDICOS ===",
  "• PROCURACAO: instrumento de procuração.",
  "  Extrair: nome_completo (outorgante), cpf (outorgante), nome_declarante (outorgado), data_emissao.",
  "• RECURSO_ADMINISTRATIVO: petição de recurso administrativo.",
  "  Extrair: nome_completo (requerente), cpf (requerente), numero_documento (nº processo), data_emissao.",
  "• MANDADO_SEGURANCA: peça jurídica de mandado de segurança ou habeas corpus.",
  "  Extrair: nome_completo (impetrante/paciente), cpf, numero_documento (nº processo), orgao_emissor, data_emissao.",
  "",
  "• DESCONHECIDO: quando não houver evidências fortes — use confianca < 0.5.",
  "REGRA DE OURO — EXTRAÇÃO FIEL:",
  "• Extraia EXATAMENTE como está escrito no documento. NÃO troque letras por números nem números por letras.",
  "• NÃO transforme 'O' em '0', 'I' em '1', 'S' em '5', 'B' em '8' sem ter certeza visual absoluta.",
  "• NÃO invente, NÃO complete por dedução, NÃO normalize números de série/SIGMA/SINARM/CPF/CNPJ/calibre/validade.",
  "• CAMPO MODELO: só preencha arma_modelo quando o modelo comercial estiver escrito explicitamente no documento. Nunca deduza por nº de série, marca, calibre, catálogo ou parser. TIPO/espécie ('PISTOLA', 'REVÓLVER', 'CARABINA', etc.) NÃO é modelo; nesses casos deixe arma_modelo vazio e use arma_especie se aplicável.",
  "• Se um caractere estiver ilegível, deixe o campo INTEIRO vazio (não substitua por '?', '_' ou aproximação).",
  "• Datas em DD/MM/AAAA exatamente como aparecem (se faltar dia, mês ou ano, deixe vazio).",
  "• Em caso de dúvida, prefira deixar vazio a inventar.",
  "REGRA SINARM × SIGMA (CRÍTICA):",
  "• PROCURE ATIVAMENTE o rótulo 'Nº Cad. SINARM' (também aceito: 'Nº Cadastro SINARM', 'No. Cad. SINARM', 'Nº CAD SINARM', 'Cadastro SINARM nº'). Esse rótulo é o IDENTIFICADOR PRINCIPAL de um CRAF SINARM e quase sempre aparece próximo do cabeçalho 'Departamento de Polícia Federal / SINARM'.",
  "• Se encontrar esse rótulo, é OBRIGATÓRIO preencher numero_cad_sinarm com o valor EXATO (formato típico AAAA/NNNNNNNNN-DD, ex.: 2022/905178870-50, preservando barra e hífen) e marcar sistema_registro = 'SINARM'. NUNCA copie esse valor para numero_registro_sigma nem para numero_documento.",
  "• 'Nº do Registro' é um campo DIFERENTE e GENÉRICO (existe em CRAFs SINARM e SIGMA). Seu valor (ex.: 906786939) vai SEMPRE em numero_documento — NUNCA em numero_cad_sinarm e NUNCA em numero_registro_sigma sem evidência explícita.",
  "• 'Nº da Arma' / 'Nº de Série' vai em arma_numero_serie (ex.: KWD4861871). NUNCA em numero_cad_sinarm.",
  "• Só preencha numero_registro_sigma quando o documento mencionar EXPLICITAMENTE Exército/SIGMA/CAC. Caso contrário deixe vazio.",
  "• Se houver 'Nº Cad. SINARM' OU menção a 'SINARM'/'Polícia Federal' no cabeçalho/órgão emissor → sistema_registro = 'SINARM'.",
  "• Se houver menção explícita a Exército/SIGMA/CAC e NÃO houver 'Nº Cad. SINARM' → sistema_registro = 'SIGMA'.",
  "• Caso contrário → sistema_registro = 'REVISAR'.",
  "EXEMPLO CONCRETO de CRAF SINARM:",
  "  Documento mostra: 'Departamento de Polícia Federal — SINARM', 'Nº Cad. SINARM: 2022/905178870-50', 'Nº do Registro: 906786939', 'Nº da Arma: KWD4861871', 'Calibre: 12', 'Validade: 01/07/2030'.",
  "  Resposta correta: tipoDetectado='CRAF', sistema_registro='SINARM', numero_cad_sinarm='2022/905178870-50', numero_documento='906786939', numero_registro_sigma='', arma_numero_serie='KWD4861871', arma_calibre='12', data_validade='01/07/2030'.",
  "REGRA CRAF SIGMA (CRÍTICA — TABELA INFERIOR):",
  "• Identificadores de CRAF SIGMA: 'Ministério da Defesa', 'Exército Brasileiro', 'Certificado de Registro de Arma de Fogo', 'SFPC', 'SisFPC', 'Nº SIGMA' e/ou 'SFPC de vinculação'. Nesses casos sistema_registro = 'SIGMA' e numero_cad_sinarm DEVE ficar vazio.",
  "• A parte inferior do CRAF SIGMA é uma TABELA. Os cabeçalhos típicos são, em duas linhas: ['REGISTRO','TIPO','MARCA'] e ['CALIBRE','Nº SÉRIE','Nº SIGMA'], seguidos por 'DATA DE EXPEDIÇÃO'. É OBRIGATÓRIO mapear cada célula da tabela ao campo correspondente, alinhando por coluna (mesma posição horizontal do cabeçalho), não por ordem de leitura linear.",
  "• Mapeamento OBRIGATÓRIO da tabela CRAF SIGMA:",
  "  - Coluna REGISTRO → numero_documento (ex.: 'ADT ELET SISFPC NR 219 DE 19/09/2022, CMDO 12ª BDA INF L (AMV)'). Copie o texto INTEIRO da célula, incluindo vírgulas e siglas.",
  "  - Coluna TIPO → arma_especie (ex.: 'PISTOLA'). NUNCA preencher arma_modelo com TIPO. Se não houver coluna/campo MODELO explícito, deixe arma_modelo vazio.",
  "  - Coluna MARCA → arma_marca (ex.: 'FORJAS TAURUS').",
  "  - Coluna CALIBRE → arma_calibre (ex.: '22 Long Rifle', '.40', '9mm'). Preserve grafia original.",
  "  - Coluna Nº SÉRIE → arma_numero_serie (ex.: '1PT397656'). Letras maiúsculas e dígitos exatos.",
  "  - Coluna Nº SIGMA → numero_registro_sigma (ex.: '2093581'). NUNCA copie esse valor para numero_documento nem para numero_cad_sinarm.",
  "  - DATA DE EXPEDIÇÃO → data_emissao (DD/MM/AAAA).",
  "• Validade: procure o rótulo 'Validade' no cabeçalho do CRAF SIGMA (ex.: 'Validade: 19/09/2032') e preencha data_validade.",
  "• Proprietário/CPF/SFPC: 'SFPC de vinculação' (ex.: 'Cmdo 2ª RM') vai em orgao_emissor. Não invente modelos de arma — se a tabela só trouxer TIPO (ex.: 'PISTOLA') e não houver coluna MODELO, deixe arma_modelo vazio.",
  "EXEMPLO CONCRETO de CRAF SIGMA:",
  "  Documento mostra: 'Ministério da Defesa — Exército Brasileiro — Certificado de Registro de Arma de Fogo', 'Validade: 19/09/2032', 'Proprietário: Willian Rodrigues da Silva', 'CPF: 37799538899', 'SFPC de vinculação: Cmdo 2ª RM', tabela com 'REGISTRO=ADT ELET SISFPC NR 219 DE 19/09/2022, CMDO 12ª BDA INF L (AMV)', 'TIPO=PISTOLA', 'MARCA=FORJAS TAURUS', 'CALIBRE=22 Long Rifle', 'Nº SÉRIE=1PT397656', 'Nº SIGMA=2093581', 'DATA DE EXPEDIÇÃO=19/09/2022'.",
  "  Resposta correta: tipoDetectado='CRAF', sistema_registro='SIGMA', numero_cad_sinarm='', numero_registro_sigma='2093581', numero_documento='ADT ELET SISFPC NR 219 DE 19/09/2022, CMDO 12ª BDA INF L (AMV)', arma_especie='PISTOLA', arma_marca='FORJAS TAURUS', arma_modelo='', arma_calibre='22 Long Rifle', arma_numero_serie='1PT397656', data_emissao='19/09/2022', data_validade='19/09/2032', orgao_emissor='Cmdo 2ª RM'.",
  "Responda EXCLUSIVAMENTE chamando a função classificar_documento_arma.",
].join("\n");

async function fetchFewShotBlock(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from("qa_exemplos_ia")
      .select("tipo_documento, justificativa, campos_extraidos, confianca")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data || data.length === 0) return "";

    // Deduplica por tipo, mantendo o mais recente de cada
    const seen = new Set<string>();
    const deduped = (data as Array<Record<string, unknown>>).filter((e) => {
      const tipo = String(e.tipo_documento || "");
      if (seen.has(tipo)) return false;
      seen.add(tipo);
      return true;
    }).slice(0, 8);

    const linhas = deduped.map((e) => {
      const camposExtraidos = e.campos_extraidos && typeof e.campos_extraidos === "object"
        ? e.campos_extraidos as Record<string, unknown>
        : {};
      const campos = Object.entries(camposExtraidos)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      return `• [${String(e.tipo_documento || "")}] ${String(e.justificativa || "")}${campos ? `\n  Campos extraídos: ${campos}` : ""}`;
    });

    return [
      "",
      "=== EXEMPLOS REAIS VALIDADOS PELA EQUIPE (use como referência de classificação) ===",
      ...linhas,
    ].join("\n");
  } catch {
    return "";
  }
}

function normalizeTipoSelecionado(t: string | undefined | null): Tipo | null {
  if (!t) return null;
  const x = String(t).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (x === "CR") return "CR";
  if (x === "CRAF") return "CRAF";
  if (x === "SINARM" || x.includes("POSSE") || x.includes("PORTE")) return "SINARM";
  if (x === "GT" || x === "GUIA_DE_TRAFEGO" || x === "GUIA_TRAFEGO") return "GT";
  if (x === "GTE" || x === "GUIA_DE_TRAFEGO_ESPECIAL" || x === "GUIA_TRAFEGO_ESPECIAL") return "GTE";
  if (x.includes("TRANSITO") || x.includes("TRÂNSITO") || x === "GUIA_TRANSITO") return "GUIA_TRANSITO";
  if (x.includes("AUTORIZ") || x === "AC") return "AUTORIZACAO_COMPRA";
  if ((x.includes("NOTA") || x === "NF" || x === "NFE" || x === "DANFE") && x.includes("ARMA")) return "NOTA_FISCAL_ARMA";
  if (x === "RG_COM_CPF" || x === "RG") return "RG_COM_CPF";
  if (x === "CIN") return "CIN";
  if (x === "CNH") return "CNH";
  if (x === "CPF") return "CPF";
  if (x === "COMPROVANTE_RESIDENCIA" || x.includes("RESIDENCIA") || x.includes("ENDERECO")) return "COMPROVANTE_RESIDENCIA";
  if (x.includes("RESPONSAVEL_IMOVEL") || x.includes("IMOVEL")) return "DECLARACAO_RESPONSAVEL_IMOVEL";
  if (x === "CTPS" || x.includes("CARTEIRA_DE_TRABALHO")) return "CTPS";
  if (x === "HOLERITE" || x.includes("HOLERITE") || x.includes("CONTRACHEQUE")) return "HOLERITE";
  if (x === "CARTAO_CNPJ" || x.includes("CNPJ")) return "CARTAO_CNPJ";
  if (x.includes("CONTRATO_SOCIAL")) return "CONTRATO_SOCIAL";
  if (x.includes("BENEFICIO") || x.includes("BENEFÍCIO")) return "COMPROVANTE_BENEFICIO";
  if (x.includes("INSS")) return "EXTRATO_INSS";
  if (x === "ANTECEDENTES_CRIMINAIS" || (x.includes("ANTECEDENTE") && !x.includes("FED") && !x.includes("MIL") && !x.includes("ELEIT") && !x.includes("EST"))) return "ANTECEDENTES_CRIMINAIS";
  if (x.includes("ANTECEDENTE") && x.includes("FED")) return "ANTECEDENTES_FEDERAL";
  if (x.includes("ANTECEDENTE") && x.includes("EST")) return "ANTECEDENTES_ESTADUAL";
  if (x.includes("ANTECEDENTE") && x.includes("MIL")) return "ANTECEDENTES_MILITAR";
  if (x.includes("ANTECEDENTE") && x.includes("ELEIT")) return "ANTECEDENTES_ELEITORAL";
  if (x.includes("NAO_INQUERITO") || x.includes("NÃO_INQUERITO")) return "DECLARACAO_NAO_INQUERITO";
  if (x.includes("GUARDA_RESPONSAVEL")) return "DECLARACAO_GUARDA_RESPONSAVEL";
  if (x.includes("GUARDA_ACERVO")) return "DECLARACAO_GUARDA_ACERVO";
  if (x.includes("DECLARACAO") || x.includes("DECLARAÇÃO")) return "DECLARACAO_CORRELATA";
  if (x.includes("PSICOL")) return "LAUDO_PSICOLOGICO";
  if (x.includes("CAPACIDADE") || x.includes("TECNICA") || x.includes("TÉCNICA")) return "LAUDO_CAPACIDADE_TECNICA";
  if (x.includes("LAUDO") || x.includes("EXAME")) return "LAUDO_PSICOLOGICO";
  if (x.includes("EFETIVA") || x.includes("NECESSIDADE")) return "COMPROVANTE_EFETIVA_NECESSIDADE";
  if (x.includes("COMPLEMENTAR")) return "DOCUMENTO_COMPLEMENTAR";
  if (x.includes("HABITUALIDADE")) return "COMPROVANTE_HABITUALIDADE";
  if (x.includes("CLUBE")) return "COMPROVANTE_CLUBE";
  if (x.includes("COMPETICAO") || x.includes("COMPETIÇÃO")) return "COMPROVANTE_COMPETICAO";
  if (x.includes("PROTOCOLO")) return "PROTOCOLO_PROCESSO";
  if (x === "OFICIO" || x === "OFÍCIO") return "OFICIO";
  if (x.includes("DESPACHO")) return "DESPACHO";
  if (x.includes("EXIGENCIA") || x.includes("EXIGÊNCIA")) return "EXIGENCIA";
  if (x.includes("INDEFERIMENTO")) return "INDEFERIMENTO";
  if (x.includes("PROCURACAO") || x.includes("PROCURAÇÃO")) return "PROCURACAO";
  if (x.includes("RECURSO")) return "RECURSO_ADMINISTRATIVO";
  if (x.includes("MANDADO") || x.includes("HABEAS")) return "MANDADO_SEGURANCA";
  return null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payloadPart] = token.split(".");
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const apiKeyHeader = req.headers.get("apikey") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const payload = decodeJwtPayload(token);
    const hasUserSession = typeof payload?.sub === "string" && payload.sub.length > 0;
    const isAnonFlow = payload?.role === "anon" && !!apiKeyHeader && apiKeyHeader === token;
    if (!hasUserSession && !isAnonFlow) {
      console.error("[qa-classificar] auth failed: invalid caller");
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const [body, fewShotBlock] = await Promise.all([
      req.json().catch(() => ({})),
      fetchFewShotBlock(supabase),
    ]);
    let imageDataUrl: string | undefined = body?.imageDataUrl;
    const tipoSelecionado: string | undefined = body?.tipoSelecionado;
    const storage_bucket: string | undefined = body?.storage_bucket;
    const storage_path: string | undefined = body?.storage_path;

    if (!imageDataUrl && storage_path) {
      const bucket = storage_bucket || "qa-documentos";
      const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(storage_path);
      if (dlErr || !blob) return json({ error: "Arquivo não localizado no storage" }, 404);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const b64 = btoa(bin);
      const mime = blob.type || "application/pdf";
      imageDataUrl = `data:${mime};base64,${b64}`;
    }

    if (!imageDataUrl) {
      return json({ error: "imageDataUrl ou storage_path obrigatório" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const aiResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + fewShotBlock },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Classifique o documento abaixo e devolva o tipo + confiança + campos extraídos. " +
                  (tipoSelecionado
                    ? `O cliente selecionou manualmente o tipo "${tipoSelecionado}". Avalie de forma INDEPENDENTE.`
                    : "Sem sugestão manual."),
              },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "classificar_documento_arma" } },
      }),
    });

    if (aiResp.status === 429) return json({ error: "Rate limit. Tente novamente em instantes." }, 429);
    if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("[classificar] gateway:", aiResp.status, t);
      return json({ error: "Falha na IA" }, 500);
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return json({ error: "IA não devolveu classificação" }, 500);
    }
    let parsed: any = {};
    try { parsed = JSON.parse(call.function.arguments); } catch (e) {
      return json({ error: "Resposta da IA inválida" }, 500);
    }

    const tipoDetectado = (TIPOS as readonly string[]).includes(parsed.tipoDetectado)
      ? (parsed.tipoDetectado as Tipo)
      : "DESCONHECIDO";
    const confianca = typeof parsed.confianca === "number"
      ? Math.max(0, Math.min(1, parsed.confianca))
      : 0;
    const camposExtraidos = parsed.camposExtraidos && typeof parsed.camposExtraidos === "object"
      ? parsed.camposExtraidos
      : {};
    const justificativa = String(parsed.justificativa || "").slice(0, 500);

    const tipoNorm = normalizeTipoSelecionado(tipoSelecionado);
    const divergencia = !!tipoNorm && tipoDetectado !== "DESCONHECIDO" && tipoNorm !== tipoDetectado;

    let recomendacao: "aceitar" | "confirmar" | "revisao_obrigatoria";
    if (tipoDetectado === "DESCONHECIDO" || confianca < 0.5) {
      recomendacao = "revisao_obrigatoria";
    } else if (confianca >= 0.8 && !divergencia) {
      recomendacao = "aceitar";
    } else {
      recomendacao = "confirmar";
    }

    return json({
      tipoDetectado,
      confianca,
      camposExtraidos,
      justificativa,
      divergenciaComSelecaoManual: divergencia,
      tipoSelecionadoNormalizado: tipoNorm,
      recomendacao,
      revisao_obrigatoria: recomendacao === "revisao_obrigatoria",
    });
  } catch (err) {
    console.error("[qa-classificar-documento-arma]", err);
    return json({ error: (err as any)?.message || "Erro interno" }, 500);
  }
});

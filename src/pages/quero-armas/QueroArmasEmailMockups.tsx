import React, { useState } from "react";

const LOGO_DATA_URI = "data:image/png;base64,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";

const EMAIL_GROUPS = [
  {
    "name": "Arsenal Inteligente",
    "title": "Arsenal Inteligente · Mockups de E-mails",
    "kicker": "// MOCKUPS · E-MAILS TRANSACIONAIS",
    "lead": "Fluxos exclusivos para clientes que contrataram apenas monitoramento, controle de documentos, validade e alertas do acervo. Não há promessa de protocolo, recurso, regularização ou condução administrativa sem contratação de serviço.",
    "guardrailTitle": "Escopo deste arquivo",
    "guardrailParagraphs": [
      "Usar somente para o produto Arsenal Inteligente. O cliente cadastra documentos e a Quero Armas monitora prazos, valida arquivos e emite alertas. Quando a ação virar renovação, protocolo ou regularização, o texto direciona para contratação do serviço correspondente."
    ],
    "tokens": [
      "{{nome_cliente}}",
      "{{nome_documento}}",
      "{{tipo_documento}}",
      "{{data_vencimento}}",
      "{{dias_restantes}}",
      "{{fabricante_armamento}}",
      "{{modelo_armamento}}",
      "{{numero_serie}}",
      "{{sistema_origem}}",
      "{{link_hub}}"
    ],
    "mockups": [
      {
        "label": "01 · Boas-vindas ao Arsenal Inteligente",
        "colorName": "Branco",
        "statusColor": "#FFFFFF",
        "statusFg": "#000000",
        "headerCode": "// ARSENAL INTELIGENTE",
        "state": "Acesso ativado",
        "title": "Seu Arsenal Inteligente está ativo",
        "copy": "Olá, {{nome_cliente}}. Seu painel de controle foi ativado. A partir de agora, os documentos cadastrados no Arsenal Inteligente ficarão organizados por validade, tipo, sistema de origem e, quando houver vínculo, pelo armamento {{fabricante_armamento}} {{modelo_armamento}}. Você envia o documento; nós registramos, monitoramos e avisamos quando algo realmente depender de você.",
        "meta": [
          {
            "label": "Plano",
            "value": "Controle de prazos e documentos"
          },
          {
            "label": "Escopo",
            "value": "Monitoramento do acervo"
          },
          {
            "label": "Ação inicial",
            "value": "Cadastrar documentos"
          }
        ],
        "ctaText": "Acessar Arsenal Inteligente →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "02 · Documento cadastrado no acervo",
        "colorName": "Verde grama",
        "statusColor": "#28C840",
        "statusFg": "#021006",
        "headerCode": "// ARSENAL INTELIGENTE",
        "state": "Documento cadastrado",
        "title": "{{nome_documento}} entrou no seu radar",
        "copy": "Olá, {{nome_cliente}}. {{nome_documento}} foi cadastrado no Arsenal Inteligente e passou a compor seu acervo monitorado. Quando aplicável, o documento ficará vinculado ao armamento {{fabricante_armamento}} {{modelo_armamento}}, nº de série {{numero_serie}}, e ao sistema {{sistema_origem}}.",
        "meta": [
          {
            "label": "Documento",
            "value": "{{nome_documento}}"
          },
          {
            "label": "Tipo",
            "value": "{{tipo_documento}}"
          },
          {
            "label": "Sistema",
            "value": "{{sistema_origem}}"
          },
          {
            "label": "Status",
            "value": "Cadastrado e monitorado"
          }
        ],
        "ctaText": "Ver documento no Arsenal →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "03 · Documento recebido para conferência",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// ARSENAL INTELIGENTE",
        "state": "Recebido para conferência",
        "title": "Recebemos {{nome_documento}}",
        "copy": "Olá, {{nome_cliente}}. {{nome_documento}} foi recebido no Arsenal Inteligente. Faremos a conferência de legibilidade, validade e dados principais antes de posicionar o documento no radar. Se houver algo que dependa de você, enviaremos uma orientação objetiva pelo Hub.",
        "meta": [
          {
            "label": "Documento",
            "value": "{{nome_documento}}"
          },
          {
            "label": "Recebido em",
            "value": "{{data_recebimento}}"
          },
          {
            "label": "Status",
            "value": "Conferência será iniciada"
          }
        ],
        "ctaText": "Acompanhar conferência →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "04 · Documento validado e monitorado",
        "colorName": "Verde grama",
        "statusColor": "#28C840",
        "statusFg": "#021006",
        "headerCode": "// ARSENAL INTELIGENTE",
        "state": "Validado",
        "title": "{{nome_documento}} foi validado",
        "copy": "Olá, {{nome_cliente}}. {{nome_documento}} foi conferido, validado e registrado no radar do Arsenal Inteligente. A partir daqui, você não precisa controlar este prazo manualmente: avisaremos com antecedência quando houver janela preventiva, vencimento ou atualização necessária.",
        "meta": [
          {
            "label": "Documento",
            "value": "{{nome_documento}}"
          },
          {
            "label": "Validade",
            "value": "{{data_vencimento}}"
          },
          {
            "label": "Status",
            "value": "Validado e monitorado"
          }
        ],
        "ctaText": "Ver no Arsenal →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "05 · Pendência no arquivo enviado",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// ARSENAL INTELIGENTE",
        "state": "Ação necessária",
        "title": "Precisamos corrigir {{nome_documento}}",
        "copy": "Olá, {{nome_cliente}}. Durante a conferência de {{nome_documento}}, identificamos uma pendência no arquivo enviado: {{motivo_pendencia}}. O controle do prazo continua no Arsenal Inteligente, mas precisamos que você reenvie o documento corrigido para concluir o cadastro.",
        "meta": [
          {
            "label": "Documento",
            "value": "{{nome_documento}}"
          },
          {
            "label": "Pendência",
            "value": "{{motivo_pendencia}}"
          },
          {
            "label": "Status",
            "value": "Aguardando reenvio"
          }
        ],
        "ctaText": "Reenviar documento →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "06 · Documento próximo do vencimento",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// ARSENAL INTELIGENTE",
        "state": "Janela preventiva",
        "title": "{{nome_documento}} vence em {{dias_restantes}} dias",
        "copy": "Olá, {{nome_cliente}}. {{nome_documento}} entrou na janela preventiva de vencimento. O Arsenal Inteligente colocou este prazo em destaque para que você não seja surpreendido. Caso deseje que a Quero Armas assuma a renovação ou regularização, solicite o serviço pelo Hub.",
        "meta": [
          {
            "label": "Documento",
            "value": "{{nome_documento}}"
          },
          {
            "label": "Vencimento",
            "value": "{{data_vencimento}}"
          },
          {
            "label": "Restam",
            "value": "{{dias_restantes}} dias"
          }
        ],
        "ctaText": "Ver prazo no Arsenal →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "07 · Documento vencido",
        "colorName": "Vermelho sangue",
        "statusColor": "#B00020",
        "statusFg": "#FFFFFF",
        "headerCode": "// ARSENAL INTELIGENTE",
        "state": "Vencido",
        "title": "{{nome_documento}} consta como vencido",
        "copy": "Olá, {{nome_cliente}}. {{nome_documento}} consta como vencido no Arsenal Inteligente desde {{data_vencimento}}. Este aviso é de monitoramento: para renovar, regularizar ou abrir um procedimento, será necessário solicitar o serviço correspondente à Quero Armas pelo Hub.",
        "meta": [
          {
            "label": "Documento",
            "value": "{{nome_documento}}"
          },
          {
            "label": "Venceu em",
            "value": "{{data_vencimento}}"
          },
          {
            "label": "Status",
            "value": "Vencido"
          }
        ],
        "ctaText": "Ver documento vencido →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "08 · Acervo sem pendências imediatas",
        "colorName": "Verde grama",
        "statusColor": "#28C840",
        "statusFg": "#021006",
        "headerCode": "// ARSENAL INTELIGENTE",
        "state": "Radar regular",
        "title": "Seu acervo está sem alertas críticos",
        "copy": "Olá, {{nome_cliente}}. No momento, os documentos cadastrados no Arsenal Inteligente não apresentam vencimento crítico ou pendência imediata. Continuaremos monitorando o acervo e avisaremos quando surgir qualquer ação que dependa de você.",
        "meta": [
          {
            "label": "Período analisado",
            "value": "{{periodo_resumo}}"
          },
          {
            "label": "Status",
            "value": "Sem pendências críticas"
          },
          {
            "label": "Próximo alerta",
            "value": "Automático"
          }
        ],
        "ctaText": "Acessar painel →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "09 · Novo prazo registrado",
        "colorName": "Verde grama",
        "statusColor": "#28C840",
        "statusFg": "#021006",
        "headerCode": "// ARSENAL INTELIGENTE",
        "state": "Prazo registrado",
        "title": "Novo vencimento de {{nome_documento}} cadastrado",
        "copy": "Olá, {{nome_cliente}}. Registramos a nova validade de {{nome_documento}} no Arsenal Inteligente. O documento ficará monitorado até {{data_vencimento}}, com alertas preventivos antes da data crítica.",
        "meta": [
          {
            "label": "Documento",
            "value": "{{nome_documento}}"
          },
          {
            "label": "Nova validade",
            "value": "{{data_vencimento}}"
          },
          {
            "label": "Status",
            "value": "Prazo monitorado"
          }
        ],
        "ctaText": "Ver prazo cadastrado →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "10 · Atualização de dados do acervo",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// ARSENAL INTELIGENTE",
        "state": "Atualização recomendada",
        "title": "Atualize os dados de {{nome_documento}}",
        "copy": "Olá, {{nome_cliente}}. Detectamos que {{nome_documento}} pode precisar de atualização cadastral no Arsenal Inteligente. Confirme os dados do documento, do sistema {{sistema_origem}} e, quando aplicável, do armamento {{fabricante_armamento}} {{modelo_armamento}} para manter o monitoramento preciso.",
        "meta": [
          {
            "label": "Documento",
            "value": "{{nome_documento}}"
          },
          {
            "label": "Sistema",
            "value": "{{sistema_origem}}"
          },
          {
            "label": "Status",
            "value": "Aguardando confirmação"
          }
        ],
        "ctaText": "Atualizar dados →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "11 · Resumo periódico do acervo",
        "colorName": "Branco",
        "statusColor": "#FFFFFF",
        "statusFg": "#000000",
        "headerCode": "// ARSENAL INTELIGENTE",
        "state": "Resumo do radar",
        "title": "Resumo do seu acervo monitorado",
        "copy": "Olá, {{nome_cliente}}. Este é o resumo do período {{periodo_resumo}}. O Arsenal Inteligente consolidou seus documentos, prazos ativos, vencimentos futuros e pendências de arquivo em um único painel para facilitar sua tomada de decisão.",
        "meta": [
          {
            "label": "Período",
            "value": "{{periodo_resumo}}"
          },
          {
            "label": "Documentos monitorados",
            "value": "{{total_documentos}}"
          },
          {
            "label": "Alertas ativos",
            "value": "{{total_alertas}}"
          }
        ],
        "ctaText": "Ver resumo completo →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "12 · Arquivo ilegível ou incompatível",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// ARSENAL INTELIGENTE",
        "state": "Leitura não concluída",
        "title": "Não foi possível validar {{nome_documento}}",
        "copy": "Olá, {{nome_cliente}}. O arquivo enviado para {{nome_documento}} não pôde ser validado porque está ilegível, incompleto ou em formato incompatível. Reenvie uma versão nítida para que o Arsenal Inteligente consiga registrar os dados e iniciar o monitoramento corretamente.",
        "meta": [
          {
            "label": "Documento",
            "value": "{{nome_documento}}"
          },
          {
            "label": "Motivo",
            "value": "{{motivo_pendencia}}"
          },
          {
            "label": "Status",
            "value": "Aguardando novo arquivo"
          }
        ],
        "ctaText": "Enviar novo arquivo →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      }
    ]
  },
  {
    "name": "Quero Armas · Serviços Contratados",
    "title": "Quero Armas · Serviços Contratados · Mockups de E-mails",
    "kicker": "// MOCKUPS · E-MAILS TRANSACIONAIS",
    "lead": "Fluxos exclusivos para clientes que compraram um serviço da Quero Armas. Aqui existem etapas operacionais, triagem, protocolo, exigência, órgão externo, deferimento, indeferimento, recurso, CR, CRAF, GTE e regularização.",
    "guardrailTitle": "Escopo deste arquivo",
    "guardrailParagraphs": [
      "Usar somente para serviços contratados. O texto pode falar em etapa, protocolo, exigência, órgão responsável e condução operacional. O nome do fluxo vem sempre de {{nome_processo}}, tratado como fonte única do título operacional para evitar duplicidade ou conflito textual."
    ],
    "tokens": [
      "{{nome_cliente}}",
      "{{nome_processo}}",
      "{{orgao_responsavel}}",
      "{{numero_protocolo}}",
      "{{fabricante_armamento}}",
      "{{modelo_armamento}}",
      "{{numero_serie}}",
      "{{item_pendente}}",
      "{{data_vencimento}}",
      "{{link_hub}}"
    ],
    "mockups": [
      {
        "label": "01 · Serviço contratado ativado",
        "colorName": "Branco",
        "statusColor": "#FFFFFF",
        "statusFg": "#000000",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Serviço ativado",
        "title": "{{nome_processo}} foi ativado",
        "copy": "Olá, {{nome_cliente}}. {{nome_processo}} foi ativado na Quero Armas e entrou no nosso fluxo operacional. A partir daqui, nossa equipe organizará a documentação, acompanhará as etapas internas e avisará quando alguma ação depender de você. Se houver armamento vinculado, a referência será {{fabricante_armamento}} {{modelo_armamento}}.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Status",
            "value": "Ativado"
          },
          {
            "label": "Equipe",
            "value": "Quero Armas"
          }
        ],
        "ctaText": "Acompanhar serviço →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "02 · Triagem documental iniciada",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Triagem iniciada",
        "title": "{{nome_processo}} entrou em triagem",
        "copy": "Olá, {{nome_cliente}}. {{nome_processo}} entrou em triagem documental. Analisaremos os arquivos necessários, a consistência dos dados e os requisitos aplicáveis antes da próxima etapa. Caso falte algum item, você receberá uma orientação objetiva pelo Hub.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Etapa",
            "value": "Triagem documental"
          },
          {
            "label": "Ação do cliente",
            "value": "Aguardar orientação"
          }
        ],
        "ctaText": "Ver triagem no Hub →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "03 · Documentos pendentes para avanço",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Pendência documental",
        "title": "{{nome_processo}} precisa de atualização",
        "copy": "Olá, {{nome_cliente}}. Para avançarmos com {{nome_processo}}, precisamos que você envie ou atualize o item indicado no Hub: {{item_pendente}}. A Quero Armas mantém o controle do fluxo, mas esta etapa depende do seu envio.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Pendência",
            "value": "{{item_pendente}}"
          },
          {
            "label": "Status",
            "value": "Aguardando cliente"
          }
        ],
        "ctaText": "Enviar documento pendente →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "04 · Protocolo realizado",
        "colorName": "Verde grama",
        "statusColor": "#28C840",
        "statusFg": "#021006",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Protocolado",
        "title": "{{nome_processo}} foi protocolado",
        "copy": "Olá, {{nome_cliente}}. {{nome_processo}} foi protocolado junto ao órgão responsável {{orgao_responsavel}}. Nossa equipe manterá o acompanhamento do andamento e avisará se houver exigência, taxa, despacho, deferimento ou qualquer etapa que dependa de você.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Órgão",
            "value": "{{orgao_responsavel}}"
          },
          {
            "label": "Protocolo",
            "value": "{{numero_protocolo}}"
          }
        ],
        "ctaText": "Ver protocolo →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "05 · Análise externa no órgão competente",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Em análise externa",
        "title": "{{nome_processo}} está em análise",
        "copy": "Olá, {{nome_cliente}}. {{nome_processo}} está em análise pelo órgão responsável {{orgao_responsavel}}. Neste momento, não há ação sua pendente. A Quero Armas acompanhará o andamento e avisará caso surja exigência, pagamento, despacho ou nova etapa.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Órgão",
            "value": "{{orgao_responsavel}}"
          },
          {
            "label": "Status",
            "value": "Em análise externa"
          }
        ],
        "ctaText": "Acompanhar andamento →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "06 · Exigência aberta",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Exigência identificada",
        "title": "{{nome_processo}} recebeu exigência",
        "copy": "Olá, {{nome_cliente}}. {{nome_processo}} recebeu uma exigência do órgão responsável {{orgao_responsavel}}. A Quero Armas já identificou a próxima ação e indicou no Hub o que precisa ser enviado, corrigido ou confirmado. Se houver armamento vinculado, confira também a referência {{fabricante_armamento}} {{modelo_armamento}}.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Origem",
            "value": "{{orgao_responsavel}}"
          },
          {
            "label": "Exigência",
            "value": "{{descricao_exigencia}}"
          }
        ],
        "ctaText": "Responder exigência →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "07 · GRU ou taxa pendente",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Pagamento necessário",
        "title": "{{nome_processo}} possui taxa pendente",
        "copy": "Olá, {{nome_cliente}}. Há uma taxa ou GRU vinculada a {{nome_processo}}. Esta ação depende do pagamento pelo cliente. Após pagar, envie o comprovante pelo Hub para que a Quero Armas possa avançar com segurança.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Taxa",
            "value": "{{nome_taxa}}"
          },
          {
            "label": "Status",
            "value": "Aguardando comprovante"
          }
        ],
        "ctaText": "Enviar comprovante →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "08 · Autorização de compra emitida",
        "colorName": "Verde grama",
        "statusColor": "#28C840",
        "statusFg": "#021006",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Autorização emitida",
        "title": "{{nome_processo}} liberou a próxima etapa",
        "copy": "Olá, {{nome_cliente}}. A autorização vinculada a {{nome_processo}} foi emitida para o armamento {{fabricante_armamento}} {{modelo_armamento}}. Agora a compra deve respeitar a validade do documento. Após a compra, envie a nota fiscal pelo Hub para prepararmos a etapa seguinte.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Fabricante",
            "value": "{{fabricante_armamento}}"
          },
          {
            "label": "Modelo",
            "value": "{{modelo_armamento}}"
          },
          {
            "label": "Validade",
            "value": "{{data_vencimento}}"
          }
        ],
        "ctaText": "Ver autorização →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "09 · Autorização de compra vencendo",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Janela crítica",
        "title": "{{nome_processo}} entrou em janela de vencimento",
        "copy": "Olá, {{nome_cliente}}. A autorização vinculada a {{nome_processo}} para o armamento {{fabricante_armamento}} {{modelo_armamento}} está próxima do vencimento. A utilização da autorização depende da compra e do envio da documentação correspondente dentro da validade.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Armamento",
            "value": "{{fabricante_armamento}} {{modelo_armamento}}"
          },
          {
            "label": "Restam",
            "value": "{{dias_restantes}} dias"
          }
        ],
        "ctaText": "Ver prazo da autorização →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "10 · Autorização de compra vencida",
        "colorName": "Vermelho sangue",
        "statusColor": "#B00020",
        "statusFg": "#FFFFFF",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Vencida",
        "title": "{{nome_processo}} possui autorização vencida",
        "copy": "Olá, {{nome_cliente}}. A autorização vinculada a {{nome_processo}} para o armamento {{fabricante_armamento}} {{modelo_armamento}} consta como vencida. A Quero Armas avaliará o cenário e indicará pelo Hub o caminho adequado para regularização ou novo procedimento, conforme o caso.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Armamento",
            "value": "{{fabricante_armamento}} {{modelo_armamento}}"
          },
          {
            "label": "Status",
            "value": "Vencida"
          }
        ],
        "ctaText": "Ver orientação →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "11 · Nota fiscal recebida",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Nota recebida",
        "title": "Nota fiscal recebida para {{nome_processo}}",
        "copy": "Olá, {{nome_cliente}}. Recebemos a nota fiscal vinculada a {{nome_processo}}. A Equipe Quero Armas fará a conferência dos dados de compra e do armamento {{fabricante_armamento}} {{modelo_armamento}} para preparar a próxima etapa.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Fabricante",
            "value": "{{fabricante_armamento}}"
          },
          {
            "label": "Modelo",
            "value": "{{modelo_armamento}}"
          },
          {
            "label": "Status",
            "value": "Recebida para conferência"
          }
        ],
        "ctaText": "Acessar nota fiscal →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "12 · Registro em preparação",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Preparação técnica",
        "title": "{{nome_processo}} está em preparação",
        "copy": "Olá, {{nome_cliente}}. {{nome_processo}} entrou na etapa de preparação técnica. A Quero Armas está conferindo a documentação, os dados do armamento {{fabricante_armamento}} {{modelo_armamento}} e as informações necessárias para avançar com o registro.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Armamento",
            "value": "{{fabricante_armamento}} {{modelo_armamento}}"
          },
          {
            "label": "Etapa",
            "value": "Preparação do registro"
          }
        ],
        "ctaText": "Acompanhar preparação →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "13 · CRAF emitido",
        "colorName": "Verde grama",
        "statusColor": "#28C840",
        "statusFg": "#021006",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Documento emitido",
        "title": "{{nome_processo}} foi concluído com documento emitido",
        "copy": "Olá, {{nome_cliente}}. O documento vinculado a {{nome_processo}} foi emitido para o armamento {{fabricante_armamento}} {{modelo_armamento}} e já está disponível no Hub. A validade será registrada para acompanhamento e futuras comunicações.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Documento",
            "value": "CRAF — Registro de Arma de Fogo"
          },
          {
            "label": "Armamento",
            "value": "{{fabricante_armamento}} {{modelo_armamento}}"
          }
        ],
        "ctaText": "Baixar documento →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "14 · GTE solicitada",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Solicitada",
        "title": "{{nome_processo}} está aguardando emissão",
        "copy": "Olá, {{nome_cliente}}. A solicitação vinculada a {{nome_processo}} foi enviada para emissão da GTE. Se houver armamento vinculado, a referência será {{fabricante_armamento}} {{modelo_armamento}}. Avisaremos quando o documento estiver disponível ou se alguma correção for exigida.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Documento",
            "value": "GTE — Guia de Tráfego Especial"
          },
          {
            "label": "Status",
            "value": "Aguardando emissão"
          }
        ],
        "ctaText": "Acompanhar GTE →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "15 · GTE emitida",
        "colorName": "Verde grama",
        "statusColor": "#28C840",
        "statusFg": "#021006",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Emitida",
        "title": "{{nome_processo}} teve documento emitido",
        "copy": "Olá, {{nome_cliente}}. A GTE vinculada a {{nome_processo}} foi emitida e está disponível no Hub. Antes de qualquer deslocamento, confira os dados, datas, origem, destino, finalidade e armamento {{fabricante_armamento}} {{modelo_armamento}}.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Armamento",
            "value": "{{fabricante_armamento}} {{modelo_armamento}}"
          },
          {
            "label": "Atenção",
            "value": "Conferir dados e validade"
          }
        ],
        "ctaText": "Acessar GTE →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "16 · GTE vencida",
        "colorName": "Vermelho sangue",
        "statusColor": "#B00020",
        "statusFg": "#FFFFFF",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Vencida",
        "title": "{{nome_processo}} possui GTE vencida",
        "copy": "Olá, {{nome_cliente}}. A GTE vinculada a {{nome_processo}} consta como vencida. Não utilize este documento para deslocamento. A Quero Armas poderá orientar nova emissão conforme finalidade, documentação e necessidade operacional.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Status",
            "value": "Vencida"
          },
          {
            "label": "Ação",
            "value": "Não utilizar documento vencido"
          }
        ],
        "ctaText": "Solicitar orientação →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "17 · CR em renovação",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Renovação preventiva",
        "title": "{{nome_processo}} entrou em renovação preventiva",
        "copy": "Olá, {{nome_cliente}}. {{nome_processo}} entrou na janela preventiva de renovação. A Quero Armas já colocou esse prazo em acompanhamento e indicará os documentos necessários para manter o cadastro em conformidade.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Documento",
            "value": "CR — Certificado de Registro"
          },
          {
            "label": "Status",
            "value": "Renovação preventiva"
          }
        ],
        "ctaText": "Iniciar atualização →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "18 · CR vencido",
        "colorName": "Vermelho sangue",
        "statusColor": "#B00020",
        "statusFg": "#FFFFFF",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Prioridade",
        "title": "{{nome_processo}} consta como vencido",
        "copy": "Olá, {{nome_cliente}}. {{nome_processo}} consta como vencido no Hub. Este cenário exige prioridade. A Quero Armas indicará a rota de regularização pelo Hub e informará quais documentos ou providências dependem de você.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Documento",
            "value": "CR — Certificado de Registro"
          },
          {
            "label": "Status",
            "value": "Vencido"
          }
        ],
        "ctaText": "Regularizar CR →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "19 · Exames ou habitualidade pendentes",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Ação do cliente",
        "title": "{{nome_processo}} precisa de comprovação",
        "copy": "Olá, {{nome_cliente}}. Para avançarmos com {{nome_processo}}, precisamos da atualização indicada no Hub: {{item_pendente}}. Pode ser avaliação psicológica, capacidade técnica, habitualidade, filiação ou outro requisito do serviço contratado.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Pendência",
            "value": "{{item_pendente}}"
          },
          {
            "label": "Status",
            "value": "Aguardando envio"
          }
        ],
        "ctaText": "Enviar comprovação →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "20 · Processo deferido",
        "colorName": "Verde grama",
        "statusColor": "#28C840",
        "statusFg": "#021006",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Deferido",
        "title": "{{nome_processo}} foi deferido",
        "copy": "Olá, {{nome_cliente}}. {{nome_processo}} recebeu resultado favorável. A próxima etapa foi registrada no Hub e será conduzida conforme o serviço contratado. Se houver armamento vinculado, a referência será {{fabricante_armamento}} {{modelo_armamento}}.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Status",
            "value": "Deferido"
          },
          {
            "label": "Próxima etapa",
            "value": "Disponível no Hub"
          }
        ],
        "ctaText": "Ver próxima etapa →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "21 · Processo indeferido",
        "colorName": "Vermelho sangue",
        "statusColor": "#B00020",
        "statusFg": "#FFFFFF",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Análise técnica",
        "title": "{{nome_processo}} recebeu decisão desfavorável",
        "copy": "Olá, {{nome_cliente}}. {{nome_processo}} recebeu decisão desfavorável e entrou em análise técnica pela Quero Armas. Avaliaremos o fundamento, os documentos disponíveis e a viabilidade de recurso administrativo. Caso algo dependa de você, enviaremos a orientação pelo Hub.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Status",
            "value": "Indeferido em análise"
          },
          {
            "label": "Próxima ação",
            "value": "Avaliação de recurso"
          }
        ],
        "ctaText": "Acompanhar análise →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "22 · Recurso em análise",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Recurso técnico",
        "title": "{{nome_processo}} entrou em análise de recurso",
        "copy": "Olá, {{nome_cliente}}. A possibilidade de recurso em {{nome_processo}} está sendo analisada pela Quero Armas. Nossa equipe revisará fundamentos, documentos e pontos de correção antes de orientar o próximo movimento.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Etapa",
            "value": "Análise de recurso"
          },
          {
            "label": "Ação do cliente",
            "value": "Aguardar orientação"
          }
        ],
        "ctaText": "Ver análise de recurso →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "23 · Validação SSP, militar ou institucional",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Validação externa",
        "title": "{{nome_processo}} está em validação institucional",
        "copy": "Olá, {{nome_cliente}}. {{nome_processo}} está em etapa de validação junto a {{orgao_responsavel}}. A Quero Armas acompanhará o fluxo e avisará quando houver retorno, exigência, necessidade de documento atualizado ou liberação da próxima fase.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Órgão",
            "value": "{{orgao_responsavel}}"
          },
          {
            "label": "Status",
            "value": "Validação externa"
          }
        ],
        "ctaText": "Acompanhar validação →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "24 · Revisão normativa monitorada",
        "colorName": "Amarelo macOS",
        "statusColor": "#FFBD2E",
        "statusFg": "#171100",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Regra em acompanhamento",
        "title": "{{nome_processo}} pode exigir ajuste operacional",
        "copy": "Olá, {{nome_cliente}}. Uma alteração normativa ou operacional pode impactar {{nome_processo}}. A Quero Armas está acompanhando o cenário e avisará se houver necessidade de atualização, regularização ou novo envio de documento no Hub.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Tema",
            "value": "{{tema_normativo}}"
          },
          {
            "label": "Status",
            "value": "Em acompanhamento"
          }
        ],
        "ctaText": "Ver aviso no Hub →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      },
      {
        "label": "25 · Processo concluído",
        "colorName": "Verde grama",
        "statusColor": "#28C840",
        "statusFg": "#021006",
        "headerCode": "// SERVIÇOS CONTRATADOS",
        "state": "Concluído",
        "title": "{{nome_processo}} foi concluído",
        "copy": "Olá, {{nome_cliente}}. {{nome_processo}} foi concluído e os documentos correspondentes foram organizados no Hub. Se houver armamento vinculado, a referência arquivada será {{fabricante_armamento}} {{modelo_armamento}}. O histórico ficará disponível para consulta e futuras etapas.",
        "meta": [
          {
            "label": "Serviço",
            "value": "{{nome_processo}}"
          },
          {
            "label": "Status",
            "value": "Concluído"
          },
          {
            "label": "Histórico",
            "value": "Arquivado no Hub"
          }
        ],
        "ctaText": "Acessar documentos →",
        "ctaHref": "{{link_hub}}",
        "footerPrefix": "Quero Armas · Hub de Documentos"
      }
    ]
  }
] as const;

type EmailGroup = (typeof EMAIL_GROUPS)[number];
type EmailTemplate = EmailGroup["mockups"][number];

const styles = ":root{\n  --qa-bg:#000000;\n  --qa-line:#1D1D1F;\n  --qa-line-soft:#111113;\n  --qa-text:#F5F5F7;\n  --qa-muted:#A1A1AA;\n  --qa-dim:#66666E;\n}\n.qa-email-page *{box-sizing:border-box}\n.qa-email-page{min-height:100vh;margin:0;background:#000;color:var(--qa-text);font-family:-apple-system,BlinkMacSystemFont,\"SF Pro Display\",\"SF Pro Text\",\"Helvetica Neue\",Arial,sans-serif;}\n.qa-page{max-width:980px;margin:0 auto;padding:34px 18px 72px;background:#000;}\n.qa-switcher{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 28px;}\n.qa-switcher button{appearance:none;border:1px solid var(--qa-line);background:#050505;color:#E8E8ED;border-radius:999px;padding:10px 14px;font-size:12px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;}\n.qa-switcher button.is-active{background:#fff;color:#000;border-color:#fff;}\n.qa-kicker{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--qa-dim);margin:0 0 10px;font-weight:700;}\n.qa-h1{font-size:34px;letter-spacing:-.035em;line-height:1.05;margin:0 0 12px;font-weight:760;color:#fff;}\n.qa-lead{max-width:760px;color:var(--qa-muted);font-size:15px;line-height:1.7;margin:0 0 26px;}\n.qa-guardrail{border:1px solid var(--qa-line);border-radius:18px;padding:18px 20px;margin:0 0 28px;background:#000;}\n.qa-guardrail h3{font-size:13px;text-transform:uppercase;letter-spacing:.14em;color:#fff;margin:0 0 12px;}\n.qa-guardrail p{font-size:13px;line-height:1.65;color:var(--qa-muted);margin:0 0 10px;}\n.qa-token-list{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}\n.qa-token{font-size:12px;color:#E8E8ED;background:#09090A;border:1px solid var(--qa-line);border-radius:999px;padding:7px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",monospace;}\n.qa-section-title{margin:38px 0 12px;font-size:12px;text-transform:uppercase;letter-spacing:.18em;color:#fff;font-weight:800;}\n.qa-mock-label{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 auto 8px;max-width:640px;color:var(--qa-dim);font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;}\n.qa-status-dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:8px;vertical-align:middle;background:var(--status)}\n.qa-email{width:100%;max-width:640px;margin:0 auto 34px;background:#000;border:1px solid var(--qa-line);border-radius:18px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.015),0 20px 60px rgba(0,0,0,.55);}\n.qa-email-top{height:4px;background:var(--status)}\n.qa-email-header{padding:24px 34px 18px;border-bottom:1px solid var(--qa-line-soft);display:flex;align-items:center;justify-content:space-between;gap:18px;}\n.qa-brand{display:flex;align-items:center;gap:14px;min-width:0;}\n.qa-brand-logo{display:block;width:132px;max-width:132px;height:auto;border:0;outline:none;flex:0 0 auto;filter:brightness(0) invert(1);}\n.qa-header-code{font-size:10px;color:var(--qa-dim);letter-spacing:.18em;text-transform:uppercase;text-align:right;font-weight:800;}\n.qa-email-body{padding:28px 34px 34px;}\n.qa-state{font-size:12px;color:var(--status);text-transform:uppercase;letter-spacing:.16em;font-weight:900;margin:0 0 16px;}\n.qa-title{font-size:24px;line-height:1.18;letter-spacing:-.03em;font-weight:760;color:#fff;margin:0 0 13px;}\n.qa-copy{font-size:14.5px;line-height:1.72;color:#B8B8C0;margin:0 0 24px;}\n.qa-meta{width:100%;border-collapse:collapse;margin:0 0 26px;font-size:13px;}\n.qa-meta td{padding:10px 0;border-bottom:1px solid var(--qa-line-soft);vertical-align:top;}\n.qa-meta tr:last-child td{border-bottom:0}.qa-meta td:first-child{color:#74747E;text-transform:uppercase;letter-spacing:.10em;font-size:11px;font-weight:800;padding-right:18px;white-space:nowrap;}.qa-meta td:last-child{color:#F2F2F4;text-align:right;font-weight:650;}\n.qa-cta{display:inline-block;background:var(--status);color:var(--status-fg);text-decoration:none;padding:13px 22px;border-radius:9px;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;}\n.qa-email-footer{border-top:1px solid var(--qa-line-soft);padding:18px 34px 24px;color:#5F5F68;font-size:11px;line-height:1.6;}\n.qa-email-footer a{color:var(--status);text-decoration:none;font-weight:800;}\n@media (max-width:680px){.qa-brand-logo{width:118px;max-width:118px}.qa-page{padding:24px 12px 50px}.qa-email-header,.qa-email-body,.qa-email-footer{padding-left:22px;padding-right:22px}.qa-mock-label{padding:0 4px}.qa-header-code{display:none}.qa-meta td:first-child{white-space:normal}.qa-meta td:last-child{text-align:left}.qa-meta td{display:block;border-bottom:0;padding:7px 0}.qa-meta tr{display:block;border-bottom:1px solid var(--qa-line-soft);padding:6px 0}.qa-meta tr:last-child{border-bottom:0}}";

function EmailMockup({ template }: { template: EmailTemplate }) {
  const cssVars = {
    "--status": template.statusColor,
    "--status-fg": template.statusFg,
  } as React.CSSProperties;

  return (
    <>
      <div className="qa-mock-label">
        <span><span className="qa-status-dot" style={cssVars} />{template.label}</span>
        <span>{template.colorName}</span>
      </div>

      <table className="qa-email" role="presentation" cellPadding={0} cellSpacing={0} style={cssVars}>
        <tbody>
          <tr><td className="qa-email-top" /></tr>
          <tr>
            <td className="qa-email-header">
              <div className="qa-brand">
                <img className="qa-brand-logo" src={LOGO_DATA_URI} width={132} alt="Quero Armas" />
              </div>
              <div className="qa-header-code">{template.headerCode}</div>
            </td>
          </tr>
          <tr>
            <td className="qa-email-body">
              <div className="qa-state">{template.state}</div>
              <h2 className="qa-title">{template.title}</h2>
              <p className="qa-copy">{template.copy}</p>
              <table className="qa-meta" role="presentation" cellPadding={0} cellSpacing={0}>
                <tbody>
                  {template.meta.map((row) => (
                    <tr key={`${row.label}-${row.value}`}>
                      <td>{row.label}</td>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <a className="qa-cta" href={template.ctaHref}>{template.ctaText}</a>
            </td>
          </tr>
          <tr>
            <td className="qa-email-footer">
              {template.footerPrefix}<br />
              Você recebe este aviso porque existe uma atualização vinculada ao seu painel. <a href="{{link_gerenciar_avisos}}">Gerenciar avisos</a>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function EmailGroupView({ group }: { group: EmailGroup }) {
  return (
    <main className="qa-page">
      <p className="qa-kicker">{group.kicker}</p>
      <h1 className="qa-h1">{group.title}</h1>
      <p className="qa-lead">{group.lead}</p>

      <section className="qa-guardrail">
        <h3>{group.guardrailTitle}</h3>
        {group.guardrailParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <div className="qa-token-list">
          {group.tokens.map((token) => <span className="qa-token" key={token}>{token}</span>)}
        </div>
      </section>

      <p className="qa-section-title">Mockups separados</p>
      {group.mockups.map((template) => <EmailMockup key={template.label} template={template} />)}
    </main>
  );
}

export default function QueroArmasEmailMockups() {
  const [activeGroup, setActiveGroup] = useState<EmailGroup["name"]>(EMAIL_GROUPS[0].name);
  const group = EMAIL_GROUPS.find((item) => item.name === activeGroup) ?? EMAIL_GROUPS[0];

  return (
    <div className="qa-email-page">
      <style>{styles}</style>
      <main className="qa-page" style={{ paddingBottom: 0 }}>
        <div className="qa-switcher">
          {EMAIL_GROUPS.map((item) => (
            <button
              key={item.name}
              type="button"
              className={item.name === activeGroup ? "is-active" : ""}
              onClick={() => setActiveGroup(item.name)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </main>
      <EmailGroupView group={group} />
    </div>
  );
}

export { EMAIL_GROUPS };

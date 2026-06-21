-- Reescrita completa do corpo_html do template canônico
-- (CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS), com base no documento de
-- referência "Contrato Quero Armas Adesão Obrigação de Meio.docx"
-- fornecido pelo usuário.
--
-- Mudanças principais:
--  1) QUALIFICAÇÃO DO CONTRATANTE: agora usa {{cliente_nome}},
--     {{cliente_cpf_cnpj}}, {{cliente_endereco}} e {{cliente_email}}
--     (mesma correção da migration 20260621010000, reaplicada aqui pois
--     este UPDATE substitui o corpo_html inteiro).
--  2) Cláusulas inteiras que existiam apenas no documento de referência
--     e nunca chegaram ao sistema:
--       - Outorga de Procuração e Acesso a Portais Oficiais (Cláusula 4)
--       - Idoneidade Moral da Contratante (Cláusula 7)
--       - Responsabilidade por Exames, Taxas e Despesas (Cláusula 8)
--       - Aquisição do Armamento (Cláusula 9)
--       - Recurso Administrativo e Medidas Judiciais (Cláusula 13)
--       - Uso de Imagem e Documentos para Divulgação (Cláusula 15)
--       - Grupo de WhatsApp (incorporado à Cláusula 16, Comunicação)
--       - "CLÁUSULA DESTACADA" (art. 54 §4º CDC) nos pontos que limitam
--         direito do consumidor
--  3) Anexo I: mantidos os 18 serviços REAIS do catálogo atual (slugs
--     confirmados em produção) — NÃO foi usado o Anexo I do documento de
--     referência, que lista serviços/slugs de uma versão antiga do
--     catálogo (ex.: "posse-arma-fogo", "primeira-via-craf") incompatíveis
--     com os slugs reais hoje. Tabela de retenção por etapa em caso de
--     rescisão por culpa do cliente foi adicionada apenas aos 3 serviços
--     em que o documento de referência fornece valores correspondentes
--     (concessao-cr; posse-de-arma-de-fogo e aquisicao-registro-posse-de-arma-de-fogo,
--     usando os valores do serviço de posse do documento de referência).
--     Os demais 15 serviços NÃO têm tabela de retenção específica —
--     aplica-se a regra geral da Cláusula 11.2 (sem reembolso em caso de
--     culpa do cliente). Definir tabelas específicas para esses serviços
--     é decisão de negócio pendente, fora do escopo desta migration.
--
-- Incrementa versao para que contratos já emitidos sejam detectados como
-- desatualizados e reprocessados automaticamente (ver fix em
-- qa-generate-contract / commit "reprocessar contrato existentes").
UPDATE public.qa_contract_templates
   SET versao = versao + 1,
       corpo_html = $corpo$<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
<h2>DE ASSESSORIA TÉCNICA E DESPACHO ADMINISTRATIVO</h2>
<h2>QUALIFICAÇÃO DAS PARTES</h2>
<h2>CONTRATADA:</h2>
<p>SENHOR DAS ARMAS COMERCIO DE ARMAS E MUNICOES LTDA, sociedade empresária limitada, inscrita no CNPJ sob o nº 34.316.002/0001-06, nome fantasia QUERO ARMAS | DESPACHANTE E TREINAMENTOS, com sede na Rua José Benedito Duarte, nº 140, Bairro Parque Itamarati, Município de Jacareí, Estado de São Paulo, CEP 12.307-200, telefone comercial (11) 97848-1919, endereço eletrônico eu@queroarmas.com.br, sítio eletrônico https://www.euqueroarmas.com.br, neste ato representada por seu sócio-administrador, na forma de seu contrato social, doravante denominada simplesmente CONTRATADA.</p>
<h2>CONTRATANTE:</h2>
<p>{{cliente_nome}}, portador(a) do CPF/CNPJ nº {{cliente_cpf_cnpj}}, residente e domiciliado(a) em {{cliente_endereco}}, endereço eletrônico {{cliente_email}}, pessoa física ou jurídica identificada e qualificada conforme dados informados no momento da contratação por meio do sítio eletrônico https://www.euqueroarmas.com.br, cujos elementos integram este instrumento e são parte indissociável do aceite eletrônico registrado pela plataforma, doravante denominada simplesmente CONTRATANTE.</p>
<p>As partes acima qualificadas resolvem celebrar o presente CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORIA TÉCNICA E DESPACHO ADMINISTRATIVO, regido pelas seguintes cláusulas e condições, em conformidade com o disposto na Lei nº 10.406/2002 (Código Civil), Lei nº 13.105/2015 (Código de Processo Civil), Lei nº 10.826/2003 (Estatuto do Desarmamento), Decreto nº 11.615/2023, Decreto nº 12.345/2024, Instruções Normativas DG/PF nº 201 e 311, Portarias COLOG nº 166, 167 e 260, Ofício Circular nº 08/DELEARM, Lei nº 8.078/1990 (Código de Defesa do Consumidor), Lei nº 13.709/2018 (Lei Geral de Proteção de Dados), Medida Provisória nº 2.200-2/2001 e Lei nº 14.063/2020.</p>
<h2>CLÁUSULA PRIMEIRA --- DO OBJETO</h2>
<p>1.1. O presente contrato tem por objeto a prestação, pela CONTRATADA, de serviços de assessoria técnica, despacho administrativo, intermediação documental e treinamento, conforme o serviço específico contratado pela CONTRATANTE no sítio eletrônico https://www.euqueroarmas.com.br, integrante do catálogo de serviços da CONTRATADA, cujo escopo, prazo estimado, valor e entregáveis encontram-se descritos no respectivo Anexo I deste instrumento, conforme o slug do serviço escolhido.</p>
<p>1.2. Os serviços prestados pela CONTRATADA têm natureza técnica e administrativa, NÃO se confundindo com atividades privativas de advogado, nos termos da Lei nº 8.906/1994, art. 1º. A CONTRATADA atua como despachante e assessora técnica, sem postular em juízo, sem oferecer consulta jurídica e sem elaborar peças processuais.</p>
<p>1.3. Quando o serviço contratado depender de atividade privativa de advogado --- em especial, mas não exclusivamente, impetração de Mandado de Segurança, ajuizamento de ação judicial ou recurso administrativo que dependa de tese jurídica --- a CONTRATADA conectará a CONTRATANTE a advogado parceiro habilitado perante a Ordem dos Advogados do Brasil, que firmará com a CONTRATANTE contrato em apartado para a prestação do serviço jurídico. A relação entre CONTRATANTE e advogado parceiro é autônoma e independente deste contrato, restando à CONTRATADA, nesses casos, exclusivamente as atividades de intermediação, preparação documental e despacho.</p>
<p>1.4. A descrição de cada serviço, prazo estimado, entregáveis e valor encontra-se no Anexo I correspondente ao slug do serviço efetivamente contratado pela CONTRATANTE, indicado no momento do aceite eletrônico.</p>
<h2>CLÁUSULA SEGUNDA --- DA FORMA DE CONTRATAÇÃO E DO ACEITE ELETRÔNICO</h2>
<p>2.1. A contratação dos serviços ocorre integralmente pelo sítio eletrônico https://www.euqueroarmas.com.br, mediante preenchimento dos dados cadastrais da CONTRATANTE, escolha do serviço, envio dos documentos solicitados em checklist e aceite eletrônico ao final do fluxo de checkout.</p>
<p>2.2. O aceite eletrônico, registrado pela plataforma com data, hora, endereço IP, dispositivo e identificação do usuário, perfectibiliza o negócio jurídico nos termos da Medida Provisória nº 2.200-2/2001, da Lei nº 14.063/2020 e dos arts. 104, 107 e 421 a 423 do Código Civil, dispensando assinatura manuscrita ou digital com certificado ICP-Brasil para a celebração deste contrato.</p>
<p>2.3. No momento do aceite eletrônico, a CONTRATANTE deverá marcar, de forma expressa e obrigatória, o seguinte checkbox, sem o qual o pagamento não será processado: “Li e aceito integralmente o Contrato de Prestação de Serviços e seus Anexos. Declaro estar ciente de que o serviço contratado constitui obrigação de meio, não de resultado, e que a decisão final sobre deferimento, aprovação, concessão ou qualquer resultado depende exclusivamente do órgão público competente, não podendo ser garantida pela CONTRATADA.”</p>
<p>2.4. Para os atos perante órgãos públicos que exijam fé pública digital --- em especial a outorga de procuração específica, peticionamento, requerimentos e protocolos perante PF/SINARM, Exército/SIGMA, gov.br e sistemas correlatos --- a CONTRATANTE compromete-se a firmar assinatura com certificado digital ICP-Brasil, padrão A1 ou A3, na forma e prazo solicitados pela CONTRATADA, como condição para o início efetivo da execução dos serviços que dependam de tais atos.</p>
<p>2.5. A recusa, omissão ou demora injustificada da CONTRATANTE em firmar a assinatura ICP-Brasil prevista no item 2.4, após regular notificação pela CONTRATADA, caracteriza descumprimento da obrigação de cooperação, autorizando a resolução do contrato com base nos arts. 422 e 476 do Código Civil, sem direito a reembolso dos valores já pagos.</p>
<p>2.6. Após a confirmação do aceite eletrônico e do pagamento, a CONTRATADA enviará à CONTRATANTE, pelo endereço eletrônico e/ou WhatsApp cadastrado, comprovante de contratação contendo: identificação do serviço contratado, valor pago, escopo do serviço conforme Anexo I, versão do contrato aceito, data, hora e IP do aceite eletrônico.</p>
<h2>CLÁUSULA TERCEIRA --- DO PAGAMENTO E DO INÍCIO DA EXECUÇÃO</h2>
<p>3.1. O valor dos serviços é o constante do catálogo da CONTRATADA no momento da contratação, conforme apresentado no sítio eletrônico e registrado no Anexo I correspondente ao serviço escolhido.</p>
<p>3.2. O pagamento é realizado integralmente no momento do checkout, por meio do gateway de pagamentos contratado pela CONTRATADA (Asaas Sistema de Pagamentos S.A. --- CNPJ 19.540.550/0001-21), nas modalidades Pix, cartão de crédito (à vista ou parcelado, conforme oferecido na plataforma) ou boleto bancário.</p>
<p>3.3. A execução dos serviços tem início somente após a confirmação efetiva do pagamento pela instituição financeira ou pelo gateway, configurando-se exceção de contrato não cumprido (art. 476 do Código Civil) o início da prestação antes da confirmação. A CONTRATADA não está obrigada a iniciar qualquer ato antes da quitação integral.</p>
<p>3.4. Confirmado o pagamento, a CONTRATADA dará início à fase de coleta e conferência documental, na qual a CONTRATANTE deverá apresentar, por meio da plataforma, todos os documentos solicitados no checklist específico do serviço contratado.</p>
<p>3.5. O prazo de conclusão dos serviços, estimado entre 7 (sete) e 25 (vinte e cinco) dias úteis --- salvo quando o Anexo I do serviço específico estabelecer prazo diverso ---, conta-se a partir do recebimento, pela CONTRATADA, da totalidade dos documentos válidos e legíveis exigidos pelo checklist do serviço, observadas eventuais exigências adicionais do órgão público competente que escapem ao controle da CONTRATADA, hipótese em que o prazo será suspenso até o saneamento da exigência.</p>
<p>3.6. Eventuais taxas, emolumentos, custas, GRUs, recolhimentos e despesas administrativas devidas a órgãos públicos NÃO estão incluídas no preço dos serviços e correrão por conta exclusiva da CONTRATANTE, salvo expressa disposição em contrário no Anexo I do serviço.</p>
<p>3.7. A CONTRATADA poderá, em caráter excepcional e a seu exclusivo critério, adiantar o pagamento de taxas ou emolumentos em nome da CONTRATANTE, mediante apresentação de comprovante de despesa. Neste caso, o valor adiantado deverá ser reembolsado integralmente pela CONTRATANTE à CONTRATADA no prazo de 5 (cinco) dias úteis a partir da apresentação do comprovante, sob pena de suspensão dos serviços até a quitação.</p>
<p>3.8. Em caso de inadimplência da CONTRATANTE --- seja por estorno, contestação indevida, chargeback ou qualquer outro motivo que resulte em não recebimento efetivo dos valores pela CONTRATADA --- todos os serviços em curso serão imediatamente suspensos, ficando a CONTRATANTE responsável pelo pagamento integral do valor contratado, acrescido de correção monetária pelo IPCA, juros de mora de 1% (um por cento) ao mês e honorários advocatícios em caso de cobrança judicial.</p>
<h2>CLÁUSULA QUARTA --- DA OUTORGA DE PROCURAÇÃO E ACESSO A PORTAIS OFICIAIS</h2>
<p>4.1. Para a execução dos serviços contratados, a CONTRATANTE deverá outorgar à CONTRATADA, ou ao preposto por ela indicado, procuração particular com poderes específicos para representá-la perante os órgãos públicos competentes, incluindo, mas não se limitando, à Polícia Federal, ao Comando do Exército (SFPC), às Delegacias de Polícia e aos sistemas oficiais (SINARM, SIGMA, gov.br e correlatos).</p>
<p>4.2. A procuração de que trata o item 4.1 será disponibilizada pela CONTRATADA em modelo próprio, devendo ser assinada pela CONTRATANTE com certificado digital ICP-Brasil (padrão A1 ou A3) ou, quando exigido pelo órgão, com reconhecimento de firma em cartório.</p>
<p>4.3. A representação abrangerá, sem prejuízo de outras ações necessárias ao despacho, a obtenção de documentos e informações junto a sistemas e portais oficiais, tais como: Rede SIM, Carteira de Trabalho Digital, INSS, Receita Federal, gov.br e demais sistemas públicos relevantes para o andamento do serviço contratado.</p>
<p>4.4. Quando o serviço exigir acesso ao portal gov.br da CONTRATANTE, esta poderá, de forma voluntária e mediante termo específico, autorizar o uso temporário de suas credenciais de acesso pela CONTRATADA, exclusivamente para fins de consulta, download e envio de documentos indispensáveis ao despacho. A CONTRATADA se compromete a utilizar as credenciais única e exclusivamente para os fins deste contrato, em estrita observância à LGPD e ao Marco Civil da Internet.</p>
<p>4.5. A CONTRATANTE compromete-se a alterar a senha de acesso à sua conta gov.br imediatamente após a conclusão dos serviços ou após a revogação da autorização de acesso, o que ocorrer primeiro. A CONTRATADA não se responsabiliza por quaisquer danos ou prejuízos decorrentes da negligência da CONTRATANTE em relação à alteração da senha após a finalização dos serviços.</p>
<p>4.6. A outorga de procuração e/ou a autorização de acesso ao portal gov.br são condições para o início efetivo do despacho, quando exigidas pela natureza do serviço contratado. A recusa ou demora injustificada da CONTRATANTE em providenciá-las equipara-se ao descumprimento previsto no item 2.5.</p>
<h2>CLÁUSULA QUINTA --- DAS OBRIGAÇÕES DA CONTRATADA</h2>
<p>5.1. A CONTRATADA se obriga a:</p>
<ul>
  <li>Executar os serviços contratados com diligência, técnica e zelo profissional, observando as normas aplicáveis e os melhores procedimentos do mercado de despachantes;</li>
  <li>Conferir a documentação enviada pela CONTRATANTE e, quando necessário, solicitar complementação por meio da plataforma ou dos canais oficiais;</li>
  <li>Manter sigilo sobre todas as informações e documentos recebidos da CONTRATANTE, observada a Lei Geral de Proteção de Dados (Lei nº 13.709/2018);</li>
  <li>Comunicar à CONTRATANTE, por meio da plataforma, grupo de WhatsApp ou canais oficiais, o andamento do serviço, exigências do órgão público competente e a conclusão de cada etapa;</li>
  <li>Emitir nota fiscal eletrônica de prestação de serviços, conforme legislação tributária aplicável;</li>
  <li>Quando o serviço depender de atividade privativa de advogado, encaminhar a CONTRATANTE a advogado parceiro habilitado perante a OAB, nos termos da Cláusula 1.3;</li>
  <li>Quando o serviço contratado incluir recurso administrativo, elaborá-lo e protocolá-lo perante o órgão competente, nos limites e condições estabelecidos no Anexo I do serviço.</li>
</ul>
<h2>CLÁUSULA SEXTA --- DAS OBRIGAÇÕES DA CONTRATANTE</h2>
<p>6.1. A CONTRATANTE se obriga a:</p>
<ul>
  <li>Fornecer dados verdadeiros, atualizados e completos no momento do cadastro e durante a execução do contrato;</li>
  <li>Enviar, por meio da plataforma, todos os documentos exigidos pelo checklist do serviço, em formato legível, atualizado e dentro do prazo de validade legal;</li>
  <li>Outorgar a procuração necessária e/ou autorizar o acesso ao portal gov.br nos termos da Cláusula Quarta, quando exigido pelo serviço contratado;</li>
  <li>Firmar assinatura digital com certificado ICP-Brasil, padrão A1 ou A3, sempre que exigido para os atos previstos neste contrato;</li>
  <li>Pagar pontualmente o valor dos serviços, conforme Cláusula Terceira;</li>
  <li>Arcar com taxas, emolumentos, custas, GRUs e demais despesas devidas a órgãos públicos, quando aplicáveis;</li>
  <li>Realizar, às suas expensas, os exames psicológicos e a prova de capacidade técnica e de tiro, conforme exigido pela legislação vigente para o serviço contratado, comparecendo nos locais e datas determinados pelas autoridades competentes ou por instituições credenciadas;</li>
  <li>Fornecer, de forma completa e tempestiva, todas as provas documentais que comprovem a efetiva necessidade para a obtenção da posse ou do porte de arma de fogo, quando aplicável ao serviço contratado;</li>
  <li>Cooperar de boa-fé com a CONTRATADA, respondendo a solicitações de complementação documental e diligências dentro de prazo razoável;</li>
  <li>Comunicar imediatamente à CONTRATADA qualquer alteração relevante em sua situação cadastral, financeira, documental ou criminal que possa impactar a execução do serviço;</li>
  <li>Manter-se no grupo de WhatsApp oficial da CONTRATADA, quando houver, conforme Cláusula Décima Sexta, como canal prioritário de comunicação e acompanhamento.</li>
</ul>
<p>6.2. A CONTRATANTE declara, sob as penas da lei, que preenche todos os requisitos legais para a contratação do serviço escolhido, em especial os requisitos do Estatuto do Desarmamento (Lei nº 10.826/2003), Decreto nº 11.615/2023, Decreto nº 12.345/2024, Instruções Normativas DG/PF nº 201 e 311, Portarias COLOG nº 166, 167 e 260, Ofício Circular nº 08/DELEARM e demais regulamentos vigentes, e que as informações prestadas são verdadeiras.</p>
<p>6.3. A omissão, falsidade ou inexatidão de informações pela CONTRATANTE, assim como a apresentação de documentos falsos ou adulterados, eximem integralmente a CONTRATADA de responsabilidade, configurando justa causa para rescisão imediata do contrato, sem direito a reembolso, sem prejuízo das responsabilidades civis e criminais cabíveis.</p>
<h2>CLÁUSULA SÉTIMA --- DA IDONEIDADE MORAL DA CONTRATANTE</h2>
<p>7.1. A manutenção da idoneidade moral da CONTRATANTE é condição sine qua non para a obtenção e manutenção da posse e/ou porte de arma de fogo, conforme o Estatuto do Desarmamento (Lei nº 10.826/2003) e seus regulamentos.</p>
<p>7.2. A CONTRATADA não possui qualquer ingerência ou controle sobre os atos e condutas da CONTRATANTE que possam comprometer sua idoneidade moral, seja durante a vigência deste contrato ou em qualquer momento posterior.</p>
<p>7.3. A CONTRATADA não se responsabiliza pela perda da idoneidade moral da CONTRATANTE durante o processo de aquisição, renovação ou transferência de posse ou porte de arma de fogo, ou após a concessão da respectiva autorização. A perda de idoneidade moral por qualquer motivo --- incluindo, mas não se limitando, à prática de atos criminosos, envolvimento em inquéritos policiais, ações penais ou qualquer conduta que demonstre falta de probidade --- poderá acarretar a inviabilização do serviço ou a revogação da autorização pelas autoridades competentes, sem que isso gere qualquer direito à restituição de valores pagos à CONTRATADA.</p>
<p>7.4. A CONTRATANTE será a única e exclusiva responsável por quaisquer consequências decorrentes da perda de sua idoneidade moral, isentando a CONTRATADA de qualquer responsabilidade por perdas e danos, materiais ou morais, que possam advir.</p>
<h2>CLÁUSULA OITAVA --- DA RESPONSABILIDADE POR EXAMES, TAXAS E DESPESAS</h2>
<p>8.1. Quando exigidos pela legislação vigente para o serviço contratado, a CONTRATANTE é a única responsável pela realização e aprovação nos exames psicológicos e na prova de capacidade técnica e de tiro, arcando com todos os custos e despesas decorrentes, incluindo taxas de exames e transporte.</p>
<p>8.2. A CONTRATANTE é responsável pelo pagamento de todas as taxas e emolumentos exigidos pelos órgãos competentes durante o processo, incluindo, mas não se limitando, a GRUs, taxas de emissão de documentos, taxas de análise de processos e quaisquer outras taxas administrativas.</p>
<p>8.3. A CONTRATADA não se responsabiliza por quaisquer atrasos, indeferimentos ou outras consequências negativas decorrentes da não realização dos exames, da reprovação nos exames ou do não pagamento das taxas e emolumentos por parte da CONTRATANTE.</p>
<p>8.4. Quando aplicável ao serviço contratado, a apresentação dos resultados dos exames psicológicos e da prova de capacidade técnica é condição essencial para o prosseguimento do despacho perante os órgãos competentes. A ausência ou não apresentação dos referidos resultados implicará na impossibilidade de dar andamento ao processo, sem que isso gere qualquer direito à restituição de valores pagos.</p>
<h2>CLÁUSULA NONA --- DA AQUISIÇÃO DO ARMAMENTO</h2>
<p>9.1. Quando o serviço contratado envolver aquisição de arma de fogo, esta é de inteira responsabilidade da CONTRATANTE, incluindo a escolha do modelo, marca, calibre e demais especificações técnicas.</p>
<p>9.2. A CONTRATADA poderá, a seu critério e sem qualquer obrigação, indicar parceiros comerciais (lojas especializadas ou fornecedores de armas de fogo) para auxiliar a CONTRATANTE no processo de compra. A indicação de parceiros não implica em qualquer responsabilidade da CONTRATADA sobre a qualidade, procedência, legalidade ou qualquer outro aspecto do armamento adquirido.</p>
<p>9.3. A negociação, o preço, as condições de pagamento e a entrega do armamento serão tratados diretamente entre a CONTRATANTE e o fornecedor, sendo a CONTRATADA totalmente alheia a essa relação comercial.</p>
<p>9.4. Em casos excepcionais e mediante prévia e expressa concordância da CONTRATANTE, a CONTRATADA poderá intermediar o pagamento do armamento entre a CONTRATANTE e o fornecedor, após o recebimento integral do valor pela CONTRATANTE. A intermediação não implica em qualquer responsabilidade da CONTRATADA sobre a entrega ou conformidade do armamento, atuando a CONTRATADA apenas como intermediária financeira. A CONTRATADA poderá cobrar taxa pela intermediação, a ser previamente informada.</p>
<h2>CLÁUSULA DÉCIMA --- DO DIREITO DE ARREPENDIMENTO</h2>
<p>10.1. Por se tratar de contratação celebrada à distância, por meio eletrônico, fica assegurado à CONTRATANTE, quando consumidora pessoa física, o direito de arrependimento previsto no art. 49 do Código de Defesa do Consumidor, no prazo de 7 (sete) dias corridos contados da celebração do contrato ou do recebimento do serviço, o que for posterior.</p>
<p>10.2. O exercício do direito de arrependimento deverá ser comunicado à CONTRATADA pelo endereço eletrônico eu@queroarmas.com.br, com identificação do contrato e justificativa expressa, sendo o reembolso processado no prazo de 7 (sete) dias úteis a partir da comunicação válida.</p>
<p>10.3. CLÁUSULA DESTACADA: Caso a CONTRATANTE, no momento do checkout, marque expressamente a opção de início imediato dos serviços --- o que constitui autorização inequívoca para que a CONTRATADA dê início aos atos preparatórios e de despacho antes do esgotamento do prazo de arrependimento ---, o reembolso, em caso de arrependimento, será calculado proporcionalmente aos serviços já efetivamente executados pela CONTRATADA até a data da comunicação do arrependimento, conforme demonstrativo enviado à CONTRATANTE, em consonância com a jurisprudência do Superior Tribunal de Justiça.</p>
<p>10.4. Não se aplica o direito de arrependimento à CONTRATANTE pessoa jurídica ou à CONTRATANTE pessoa física que contrate o serviço fora de relação de consumo (art. 2º do CDC), hipótese em que a obrigação se torna irrevogável a partir do aceite eletrônico, ressalvadas as hipóteses de rescisão por culpa previstas nas cláusulas seguintes.</p>
<h2>CLÁUSULA DÉCIMA PRIMEIRA --- DA RESCISÃO</h2>
<p>11.1. O contrato poderá ser rescindido nas seguintes hipóteses:</p>
<ul>
  <li>Por mútuo acordo entre as partes, mediante distrato escrito;</li>
  <li>Por descumprimento das obrigações por qualquer das partes, mediante notificação com prazo de 10 (dez) dias úteis para sanar a inadimplência;</li>
  <li>Por recusa, omissão ou demora injustificada da CONTRATANTE em outorgar procuração, firmar assinatura ICP-Brasil ou apresentar documentos essenciais à execução, nos termos das Cláusulas 2.5, 4.6 e 6.1;</li>
  <li>Por apresentação, pela CONTRATANTE, de informações ou documentos falsos, adulterados ou inexatos, conforme Cláusula 6.3;</li>
  <li>Por perda superveniente da idoneidade moral da CONTRATANTE que inviabilize a execução do serviço, conforme Cláusula Sétima;</li>
  <li>Por superveniência de evento de caso fortuito ou força maior que torne a prestação inviável (art. 393 do Código Civil).</li>
</ul>
<p>11.2. CLÁUSULA DESTACADA: Na hipótese de rescisão por culpa ou iniciativa da CONTRATANTE, os valores retidos pela CONTRATADA serão calculados conforme a tabela de retenção por etapa constante do Anexo I do serviço contratado, quando houver. Na ausência de tabela de retenção específica no Anexo I do serviço, não haverá direito a reembolso dos valores já pagos, ressalvados os casos em que houver expressa previsão legal em sentido diverso.</p>
<p>11.3. Na hipótese de rescisão por culpa da CONTRATADA, esta restituirá à CONTRATANTE os valores pagos proporcionalmente aos serviços não executados, no prazo de 15 (quinze) dias úteis.</p>
<h2>CLÁUSULA DÉCIMA SEGUNDA --- DA RESPONSABILIDADE E DOS LIMITES --- OBRIGAÇÃO DE MEIO</h2>
<p>12.1. A CONTRATADA atua mediante OBRIGAÇÃO DE MEIO, E NÃO DE RESULTADO. A CONTRATADA se compromete a atuar com técnica, diligência, organização, orientação e execução dos procedimentos contratados, mas NÃO GARANTE deferimento, aprovação, êxito, prazo de órgão externo ou resultado final. A decisão final de cada órgão (Polícia Federal, Comando do Exército, gov.br ou outro) é discricionária da Administração Pública e não pode ser garantida pela CONTRATADA.</p>
<p>12.2. A CONTRATADA não se responsabiliza por:</p>
<ul>
  <li>Indeferimento, suspensão ou cancelamento de pedidos pelo órgão público competente, salvo quando decorrer de ato exclusivamente imputável à CONTRATADA;</li>
  <li>Atrasos, lentidão ou indisponibilidade de sistemas externos (gov.br, SIGMA, SINARM, instituições financeiras, etc.);</li>
  <li>Atos de terceiros, caso fortuito ou força maior;</li>
  <li>Veracidade dos documentos apresentados pela CONTRATANTE, cuja integralidade e autenticidade são de exclusiva responsabilidade desta;</li>
  <li>Consequências decorrentes de informações falsas, omissas ou inexatas prestadas pela CONTRATANTE;</li>
  <li>Não realização, reprovação ou resultado insatisfatório nos exames psicológicos ou de capacidade técnica da CONTRATANTE;</li>
  <li>Perda de idoneidade moral da CONTRATANTE, por qualquer motivo;</li>
  <li>Insuficiência ou inadequação das provas de efetiva necessidade apresentadas pela CONTRATANTE, quando aplicável.</li>
</ul>
<p>12.3. CLÁUSULA DESTACADA: A responsabilidade da CONTRATADA, em qualquer hipótese, fica limitada ao valor efetivamente recebido pela prestação do serviço específico em discussão, salvo nos casos de dolo ou culpa grave devidamente comprovados.</p>
<p>12.4. Os valores pagos pela CONTRATANTE referem-se aos serviços de assessoria técnica, despacho e acompanhamento, independentemente do resultado do processo perante os órgãos públicos.</p>
<h2>CLÁUSULA DÉCIMA TERCEIRA --- DO RECURSO ADMINISTRATIVO E MEDIDAS JUDICIAIS</h2>
<p>13.1. Quando o Anexo I do serviço contratado incluir recurso administrativo como entregável, a CONTRATADA elaborará e protocolará o recurso perante o órgão competente em caso de indeferimento, sem garantia de êxito.</p>
<p>13.2. Caso o recurso administrativo seja igualmente indeferido, a CONTRATANTE poderá, por sua iniciativa e às suas expensas, optar pela via judicial (Mandado de Segurança ou outra medida cabível), hipótese em que a CONTRATADA conectará a CONTRATANTE a advogado parceiro, nos termos da Cláusula 1.3.</p>
<p>13.3. Todas as custas judiciais, despesas processuais, honorários advocatícios e quaisquer outras despesas decorrentes da ação judicial serão de inteira responsabilidade da CONTRATANTE.</p>
<p>13.4. A CONTRATADA poderá, a seu critério e sem ônus adicional, auxiliar na elaboração de defesa administrativa complementar para subsidiar o advogado na ação judicial, sem que isso implique em garantia de resultado.</p>
<p>13.5. Quando o Anexo I do serviço contratado previr a possibilidade de nova tentativa de requerimento após indeferimento, a CONTRATADA elaborará e protocolará novo pedido com fundamentação atualizada, nos termos e limites definidos no respectivo Anexo I.</p>
<h2>CLÁUSULA DÉCIMA QUARTA --- DA PROTEÇÃO DE DADOS PESSOAIS (LGPD)</h2>
<p>14.1. As partes obrigam-se a observar as disposições da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados --- LGPD).</p>
<p>14.2. A CONTRATADA, na condição de controladora dos dados pessoais da CONTRATANTE, tratará tais dados exclusivamente para as finalidades de:</p>
<ul>
  <li>Execução do contrato, incluindo cadastro, faturamento, comunicação e despacho perante órgãos públicos;</li>
  <li>Cumprimento de obrigações legais e regulatórias;</li>
  <li>Exercício regular de direitos em processos administrativos ou judiciais;</li>
  <li>Auditoria e controle interno de qualidade.</li>
</ul>
<p>14.3. Os dados pessoais serão armazenados por prazo compatível com as finalidades acima e com a legislação aplicável, em ambiente seguro, com acesso restrito a colaboradores autorizados. A CONTRATADA implementará medidas de segurança técnicas e administrativas para proteger os dados contra acessos não autorizados, destruição, perda, alteração ou qualquer forma de tratamento inadequado.</p>
<p>14.4. A CONTRATANTE poderá, a qualquer tempo, exercer os direitos previstos no art. 18 da LGPD (confirmação, acesso, correção, anonimização, portabilidade, eliminação, oposição), mediante solicitação ao endereço eletrônico eu@queroarmas.com.br.</p>
<p>14.5. A CONTRATANTE autoriza expressamente o compartilhamento de seus dados pessoais e documentos com (i) órgãos públicos competentes para a execução do despacho contratado, (ii) o gateway de pagamentos Asaas para o processamento das cobranças, (iii) o advogado parceiro, quando aplicável, na hipótese da Cláusula 1.3, e (iv) operadores e prestadores de serviço da CONTRATADA, em observância à LGPD.</p>
<p>14.6. Em caso de incidente de segurança que possa comprometer os dados da CONTRATANTE, a CONTRATADA compromete-se a notificar a CONTRATANTE e as autoridades competentes, conforme exigido pela legislação.</p>
<h2>CLÁUSULA DÉCIMA QUINTA --- DO USO DE IMAGEM E DOCUMENTOS PARA DIVULGAÇÃO</h2>
<p>15.1. No momento do checkout, a CONTRATANTE poderá, de forma voluntária e facultativa, autorizar a CONTRATADA a utilizar imagens e documentos relacionados ao processo para fins publicitários, incluindo fotos ou vídeos de cursos, resultados de processos (CR, CRAF, Posse, Porte), entrevistas e materiais pertinentes, desde que sem exposição de dados pessoais ou sensíveis.</p>
<p>15.2. A autorização de que trata o item 15.1 é facultativa e não constitui condição para a contratação dos serviços. A CONTRATANTE que não autorizar o uso de imagem receberá os mesmos serviços sem qualquer diferenciação.</p>
<p>15.3. A CONTRATANTE que tiver autorizado o uso de imagem poderá revogar a autorização a qualquer tempo, mediante comunicação ao endereço eletrônico eu@queroarmas.com.br, sendo que a revogação não alcançará materiais já publicados.</p>
<h2>CLÁUSULA DÉCIMA SEXTA --- DA COMUNICAÇÃO E DAS NOTIFICAÇÕES</h2>
<p>16.1. Todas as comunicações entre as partes serão realizadas preferencialmente pela plataforma da CONTRATADA e pelos seguintes canais oficiais: e-mail eu@queroarmas.com.br; telefone/WhatsApp (11) 97848-1919; e, quando houver, grupo de WhatsApp oficial da CONTRATADA específico do serviço contratado.</p>
<p>16.2. Quando a CONTRATANTE for incluída em grupo de WhatsApp oficial da CONTRATADA, este será o canal prioritário para comunicação sobre andamento dos processos, ordem da fila de atendimento, deferimentos, orientações sobre legislação vigente e demais avisos pertinentes, sendo de sua responsabilidade acompanhar com regularidade as publicações ali realizadas, não podendo alegar desconhecimento quanto às informações divulgadas.</p>
<p>16.3. Informações de caráter sigiloso, sensível ou que envolvam dados pessoais serão encaminhadas diretamente à CONTRATANTE por meio reservado, não sendo compartilhadas em grupo de WhatsApp.</p>
<p>16.4. Caso a CONTRATANTE opte por sair voluntariamente de grupo de WhatsApp oficial sem comunicação prévia à CONTRATADA, esta não poderá ser responsabilizada por qualquer ausência de informação ou atraso no acompanhamento.</p>
<p>16.5. Considera-se validamente entregue a comunicação enviada ao endereço eletrônico ou ao número de contato informado pela CONTRATANTE no momento do cadastro, sendo de sua responsabilidade mantê-los atualizados.</p>
<h2>CLÁUSULA DÉCIMA SÉTIMA --- DA PROPRIEDADE INTELECTUAL E DO USO DA PLATAFORMA</h2>
<p>17.1. Todos os direitos relativos à plataforma https://www.euqueroarmas.com.br, incluindo marcas, logotipos, layout, textos, software, fluxos de cadastro e materiais didáticos, pertencem exclusivamente à CONTRATADA ou a seus licenciantes, sendo vedada à CONTRATANTE qualquer forma de reprodução, distribuição ou exploração comercial sem autorização expressa e por escrito.</p>
<p>17.2. O acesso da CONTRATANTE à plataforma é pessoal e intransferível, sendo de sua responsabilidade a guarda das credenciais de acesso.</p>
<h2>CLÁUSULA DÉCIMA OITAVA --- DAS DISPOSIÇÕES GERAIS</h2>
<p>18.1. Este contrato representa a integralidade do acordo entre as partes e prevalece sobre quaisquer entendimentos anteriores, verbais ou escritos, relativos ao seu objeto.</p>
<p>18.2. A eventual tolerância da CONTRATADA quanto ao descumprimento de qualquer cláusula deste contrato pela CONTRATANTE não importará em novação, transação ou renúncia ao direito ou faculdade respectiva.</p>
<p>18.3. A nulidade de qualquer cláusula deste contrato não comprometerá a validade das demais, que permanecerão plenamente eficazes.</p>
<p>18.4. Este contrato obriga as partes, seus herdeiros e sucessores a qualquer título.</p>
<p>18.5. As alterações ao presente contrato dependerão de aceite eletrônico expresso da CONTRATANTE na plataforma, sendo informadas com antecedência mínima de 15 (quinze) dias.</p>
<p>18.6. As cláusulas destacadas neste contrato (identificadas como “CLÁUSULA DESTACADA”) atendem ao disposto no art. 54, § 4º, do Código de Defesa do Consumidor, que determina que as cláusulas que impliquem limitação de direito do consumidor devem ser redigidas com destaque, permitindo sua imediata e fácil compreensão.</p>
<h2>CLÁUSULA DÉCIMA NONA --- DO FORO</h2>
<p>19.1. Fica eleito o foro da Comarca de Jacareí, Estado de São Paulo, com renúncia expressa a qualquer outro, por mais privilegiado que seja, para dirimir quaisquer questões oriundas do presente contrato.</p>
<p>19.2. Tratando-se de relação de consumo (art. 2º e art. 3º da Lei nº 8.078/1990), prevalecerá o foro do domicílio do consumidor, nos termos do art. 101, inciso I, do Código de Defesa do Consumidor.</p>
<h2>ASSINATURA E PERFECTIBILIZAÇÃO</h2>
<p>Este contrato é celebrado mediante aceite eletrônico da CONTRATANTE no fluxo de checkout do sítio https://www.euqueroarmas.com.br, com registro de data, hora, IP, dispositivo e identificação do usuário, na forma da Medida Provisória nº 2.200-2/2001 e Lei nº 14.063/2020.</p>
<p>A CONTRATADA mantém em seus arquivos eletrônicos cópia integral deste contrato, dos anexos aplicáveis e do registro técnico do aceite, podendo emiti-los à CONTRATANTE sempre que solicitado pelos canais oficiais.</p>
<p>Jacareí/SP, na data do aceite eletrônico registrado em plataforma.</p>

<h2>ANEXO I --- DESCRIÇÃO DOS SERVIÇOS CONTRATADOS</h2>
<p>Este Anexo I integra o Contrato de Prestação de Serviços de Assessoria Técnica e Despacho Administrativo. O serviço efetivamente contratado pela CONTRATANTE é o correspondente ao slug indicado no momento do aceite eletrônico, conforme detalhado nas seções abaixo.</p>
<p>Prazo de execução geral: 7 (sete) a 25 (vinte e cinco) dias úteis, contados a partir do recebimento da totalidade dos documentos válidos exigidos pelo checklist do serviço, observadas eventuais exigências adicionais do órgão público competente.</p>
<h3>I.1. OPERADOR DE PISTOLA --- NÍVEL I</h3>
<p><strong>Identificador (slug): operador-de-pistola-nivel-i</strong></p>
<p>Categoria: Curso operacional</p>
<p>Órgão competente: Estande homologado</p>
<p>Valor: R$ 1.887,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Curso prático de tiro com pistola, voltado a operadores e portadores que necessitem de capacitação técnica reconhecida. Inclui aulas teóricas, prática supervisionada em estande e emissão de certificado de conclusão.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.2. VIP OPERADOR DE PISTOLA --- NÍVEL I</h3>
<p><strong>Identificador (slug): vip-operador-de-pistola-nivel-i</strong></p>
<p>Categoria: Curso operacional</p>
<p>Órgão competente: Estande homologado</p>
<p>Valor: R$ 2.487,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Versão exclusiva e individual do curso de operador de pistola, com instrução personalizada, agendamento flexível e atendimento diferenciado.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.3. APOSTILAMENTO / ATUALIZAÇÃO DE ACERVO</h3>
<p><strong>Identificador (slug): apostilamento-atualizacao</strong></p>
<p>Categoria: Exército / SIGMA</p>
<p>Órgão competente: Comando do Exército --- SFPC</p>
<p>Valor: R$ 427,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo para apostilamento de armas no Certificado de Registro (CR) e atualização do acervo perante o Exército Brasileiro, através do sistema SIGMA.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.4. AUTORIZAÇÃO DE COMPRA DE ARMA DE FOGO --- ATIRADOR ESPORTIVO (CAC)</h3>
<p><strong>Identificador (slug): autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac</strong></p>
<p>Categoria: Exército / SIGMA</p>
<p>Órgão competente: Comando do Exército --- SFPC</p>
<p>Valor: R$ 497,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo para obtenção de autorização de compra de arma de fogo na modalidade Atirador Esportivo, com base na habitualidade comprovada.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.5. AUTORIZAÇÃO DE COMPRA DE ARMA DE FOGO --- CAÇADOR (CAC)</h3>
<p><strong>Identificador (slug): autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac</strong></p>
<p>Categoria: Exército / SIGMA</p>
<p>Órgão competente: Comando do Exército --- SFPC</p>
<p>Valor: R$ 997,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo para obtenção de autorização de compra de arma de fogo na modalidade Caçador, para atividade venatória regulamentada.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.6. CONCESSÃO DE CR (CERTIFICADO DE REGISTRO)</h3>
<p><strong>Identificador (slug): concessao-cr</strong></p>
<p>Categoria: Polícia Federal / SINARM-CAC</p>
<p>Órgão competente: Polícia Federal --- SINARM-CAC</p>
<p>Valor: R$ 1.239,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo completo para concessão de Certificado de Registro (CR) na categoria CAC (Caçador, Atirador Esportivo ou Colecionador), perante a Polícia Federal, no âmbito do SINARM-CAC.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>Antes do início da conferência documental: retenção de R$ 200,00 a título de taxa de consultoria e abertura de atendimento;</li>
  <li>Após início da conferência documental e antes do protocolo perante o órgão: retenção de 50% do valor contratado;</li>
  <li>Após protocolo do requerimento perante o órgão competente: sem direito a reembolso (100% do valor retido).</li>
</ul>
<h3>I.7. GUIA DE TRÁFEGO ESPECIAL (CAC)</h3>
<p><strong>Identificador (slug): guia-de-trafego-especial-cac</strong></p>
<p>Categoria: Exército / SIGMA</p>
<p>Órgão competente: Comando do Exército --- SFPC</p>
<p>Valor: R$ 147,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Emissão de Guia de Tráfego Especial (GTE) para transporte regular de armas de fogo do acervo CAC entre o domicílio e clubes, estandes, eventos e demais locais autorizados.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.8. REGISTRO E APOSTILAMENTO DE ARMA DE FOGO (CAC)</h3>
<p><strong>Identificador (slug): registro-e-apostilamento-de-arma-de-fogo-cac</strong></p>
<p>Categoria: Exército / SIGMA</p>
<p>Órgão competente: Comando do Exército --- SFPC</p>
<p>Valor: R$ 247,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo para registro inicial de arma de fogo no acervo CAC, incluindo apostilamento perante o Comando do Exército.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.9. RENOVAÇÃO DE CR</h3>
<p><strong>Identificador (slug): renovacao-cr</strong></p>
<p>Categoria: Exército / SIGMA</p>
<p>Órgão competente: Comando do Exército --- SFPC</p>
<p>Valor: R$ 997,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo de renovação do Certificado de Registro (CR), com manutenção da categoria e do acervo CAC.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.10. MUDANÇA DE SERVIÇO (POSSE → CR)</h3>
<p><strong>Identificador (slug): mudanca-servico</strong></p>
<p>Categoria: Operacional interno</p>
<p>Órgão competente: Interno</p>
<p>Valor: R$ 0,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Procedimento interno para alteração de serviço contratado, sem cobrança adicional, quando o cliente migra de posse civil (PF/SINARM) para CR (Exército/SIGMA) ou vice-versa.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.11. AQUISIÇÃO / POSSE DE ARMA DE FOGO</h3>
<p><strong>Identificador (slug): posse-de-arma-de-fogo</strong></p>
<p>Categoria: Polícia Federal / SINARM</p>
<p>Órgão competente: Polícia Federal --- SINARM</p>
<p>Valor: R$ 2.000,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo completo para aquisição e registro de arma de fogo para fins de posse, perante o Sistema Nacional de Armas (SINARM), administrado pela Polícia Federal.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>Antes do início da conferência documental: retenção de R$ 1.000,00 a título de taxa de consultoria;</li>
  <li>Após início da busca de provas de efetiva necessidade: retenção de R$ 2.000,00;</li>
  <li>Após protocolo do requerimento perante a Polícia Federal: sem direito a reembolso (100% do valor retido).</li>
</ul>
<p><strong>Provas de efetiva necessidade:</strong> a CONTRATANTE é a única responsável pela obtenção e apresentação de provas documentais que comprovem a efetiva necessidade (Boletins de Ocorrência, queixas-crime, documentos que comprovem atividade profissional de risco, entre outros). A CONTRATADA poderá auxiliar na organização e formatação, mas a responsabilidade pela obtenção é exclusivamente da CONTRATANTE.</p>
<h3>I.12. AQUISIÇÃO E REGISTRO PARA POSSE DE ARMA DE FOGO</h3>
<p><strong>Identificador (slug): aquisicao-registro-posse-de-arma-de-fogo</strong></p>
<p>Categoria: Polícia Federal / SINARM</p>
<p>Órgão competente: Polícia Federal --- SINARM</p>
<p>Valor: R$ 2.997,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo expandido cobrindo aquisição, registro e regularização documental completa para posse de arma de fogo, perante SINARM.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>Antes do início da conferência documental: retenção de R$ 1.000,00 a título de taxa de consultoria;</li>
  <li>Após início da busca de provas de efetiva necessidade: retenção de R$ 2.000,00;</li>
  <li>Após protocolo do requerimento perante a Polícia Federal: sem direito a reembolso (100% do valor retido).</li>
</ul>
<p><strong>Provas de efetiva necessidade:</strong> a CONTRATANTE é a única responsável pela obtenção e apresentação de provas documentais que comprovem a efetiva necessidade (Boletins de Ocorrência, queixas-crime, documentos que comprovem atividade profissional de risco, entre outros). A CONTRATADA poderá auxiliar na organização e formatação, mas a responsabilidade pela obtenção é exclusivamente da CONTRATANTE.</p>
<h3>I.13. MANDADO DE SEGURANÇA</h3>
<p><strong>Identificador (slug): mandado-de-seguranca</strong></p>
<p>Categoria: Atendimento jurídico (advogado parceiro)</p>
<p>Órgão competente: Poder Judiciário</p>
<p>Valor: R$ 6.000,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: INTERMEDIAÇÃO. A CONTRATADA não atua como advogada. O serviço consiste em conectar a CONTRATANTE a advogado parceiro habilitado, que firmará contrato em apartado para impetração de mandado de segurança. A taxa cobrada pela CONTRATADA refere-se exclusivamente à intermediação e preparação documental.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.14. PORTE DE ARMA DE FOGO</h3>
<p><strong>Identificador (slug): porte-arma-fogo</strong></p>
<p>Categoria: Polícia Federal / SINARM</p>
<p>Órgão competente: Polícia Federal --- SINARM</p>
<p>Valor: R$ 3.997,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo para obtenção de porte de arma de fogo, mediante comprovação dos requisitos legais (efetiva necessidade e demais exigências do Estatuto do Desarmamento).</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.15. RECURSO ADMINISTRATIVO</h3>
<p><strong>Identificador (slug): recurso-administrativo</strong></p>
<p>Categoria: Despacho administrativo</p>
<p>Órgão competente: Polícia Federal / Exército / órgão competente</p>
<p>Valor: R$ 1.997,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo para interposição de recurso na esfera administrativa, mediante preparação documental e protocolo. Quando o recurso depender de tese jurídica privativa de advogado, a CONTRATADA encaminhará a CONTRATANTE a advogado parceiro, que firmará contrato em apartado.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.16. REGISTRO DE ARMA DE FOGO (DEFESA PESSOAL)</h3>
<p><strong>Identificador (slug): registro-arma-fogo</strong></p>
<p>Categoria: Polícia Federal / SINARM</p>
<p>Órgão competente: Polícia Federal --- SINARM</p>
<p>Valor: R$ 997,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo para registro de arma de fogo na categoria defesa pessoal, perante o SINARM.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.17. RENOVAÇÃO DE PORTE DE ARMA DE FOGO</h3>
<p><strong>Identificador (slug): renovacao-de-porte-de-arma-de-fogo</strong></p>
<p>Categoria: Polícia Federal / SINARM</p>
<p>Órgão competente: Polícia Federal --- SINARM</p>
<p>Valor: R$ 2.997,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo de renovação de porte de arma de fogo, mantendo os requisitos exigidos pela legislação vigente.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h3>I.18. RENOVAÇÃO DE POSSE DE ARMA DE FOGO</h3>
<p><strong>Identificador (slug): renovacao-posse-de-arma-de-fogo</strong></p>
<p>Categoria: Polícia Federal / SINARM</p>
<p>Órgão competente: Polícia Federal --- SINARM</p>
<p>Valor: R$ 2.997,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo de renovação de posse / Certificado de Registro de Arma de Fogo (CRAF), perante o SINARM.</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo dos requerimentos perante o órgão competente, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>
<h2>FIM DO INSTRUMENTO</h2>
<p><em>Documento gerado para aceite eletrônico na plataforma da CONTRATADA. A versão vigente no momento do aceite eletrônico será arquivada com a respectiva impressão técnica do consentimento (data, hora, IP, dispositivo e identificação do usuário) para fins probatórios.</em></p>$corpo$,
       updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true;

-- Reprocessa automaticamente contratos existentes com a nova versão,
-- mesmo mecanismo de 20260620220000 / 20260621010000.
DO $$
DECLARE
  v_function_url text := 'https://ogkltfqvzweeqkfmrzts.supabase.co/functions/v1/qa-generate-contract';
  v_anon_key text := current_setting('app.settings.anon_key', true);
  v_service_key text;
  v_auth_key text;
  v_versao_vigente integer;
  v_row record;
  v_total integer := 0;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;
  v_auth_key := COALESCE(v_service_key, v_anon_key, '');

  SELECT versao INTO v_versao_vigente
    FROM public.qa_contract_templates
   WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
     AND vigente = true
   LIMIT 1;

  IF v_versao_vigente IS NULL THEN
    RAISE NOTICE 'qa_contract_template_reescrita_completa: nenhum template vigente encontrado, abortando reprocessamento.';
    RETURN;
  END IF;

  FOR v_row IN
    SELECT id, venda_id, template_versao
      FROM public.qa_contracts
     WHERE venda_id IS NOT NULL
       AND arquivado_em IS NULL
       AND (
         template_codigo IS DISTINCT FROM 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
         OR template_versao IS DISTINCT FROM v_versao_vigente
         OR conteudo_renderizado IS NULL
         OR btrim(conteudo_renderizado) = ''
       )
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_auth_key,
          'apikey', v_auth_key,
          'x-trigger-source', 'qa_contract_template_reescrita_completa'
        ),
        body := jsonb_build_object('venda_id', v_row.venda_id, 'force', true)
      );
      v_total := v_total + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao enfileirar reprocessamento do contrato % (venda %): %',
        v_row.id, v_row.venda_id, SQLERRM;
    END;
    PERFORM pg_sleep(0.2);
  END LOOP;

  RAISE NOTICE 'qa_contract_template_reescrita_completa: % contrato(s) enfileirado(s) para reprocessamento.', v_total;
END;
$$;

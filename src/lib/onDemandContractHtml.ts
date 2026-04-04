/**
 * WMTi — Contrato de Prestação de Serviços Técnicos Sob Demanda / Por Hora
 * 
 * Template dinâmico com 16 cláusulas, estrutura jurídica padronizada
 * para contratação pontual por horas técnicas.
 * 
 * Strings dinâmicas no padrão: {{WMTI_CAMPO}}
 */

import { valueToWords } from "@/components/orcamento/ContractPreview";

export interface OnDemandContractVars {
  // Identificação do pedido
  WMTI_CONTRATO_ID: string;
  WMTI_PEDIDO_ID: string;

  // Dados do cliente
  WMTI_CLIENTE_RAZAO_SOCIAL: string;
  WMTI_CLIENTE_NOME_FANTASIA: string;
  WMTI_CLIENTE_CNPJ: string;
  WMTI_CLIENTE_RESPONSAVEL: string;
  WMTI_CLIENTE_CPF_RESPONSAVEL: string;
  WMTI_CLIENTE_EMAIL: string;
  WMTI_CLIENTE_WHATSAPP: string;
  WMTI_CLIENTE_TELEFONE_COMERCIAL: string;
  WMTI_CLIENTE_ENDERECO: string;
  WMTI_CLIENTE_CIDADE: string;
  WMTI_CLIENTE_CEP: string;

  // Serviço
  WMTI_SERVICO_NOME: string;
  WMTI_SERVICO_SLUG: string;
  WMTI_SERVICO_CATEGORIA: string;
  WMTI_SERVICO_OBJETO_COMERCIAL: string;
  WMTI_SERVICO_OBJETO_TECNICO: string;
  WMTI_SERVICO_RESUMO_CONTRATUAL: string;

  // Contratação
  WMTI_HORAS_CONTRATADAS: number;
  WMTI_VALOR_HORA: number;
  WMTI_VALOR_TOTAL: number;
  WMTI_ECONOMIA: number;
  WMTI_MODALIDADE: string; // "AVULSO SOB DEMANDA" | "EMERGENCIAL"
  WMTI_IS_EMERGENCY: boolean;

  // Detalhamento de precificação (opcional — Web Dev / calculadora avançada)
  WMTI_VALOR_HORA_BASE?: number;
  WMTI_MULTIPLICADOR_COMPLEXIDADE?: number;
  WMTI_MULTIPLICADOR_PRAZO_URGENCIA?: number;
  WMTI_DESCONTO_PROGRESSIVO_PCT?: number;
  WMTI_VALOR_FINAL_HORA?: number;
  WMTI_FATOR_EXECUCAO_LABEL?: string; // "normal" | "prioritário" | "urgente"

  // Garantia
  WMTI_GARANTIA_HORAS: number;
  WMTI_GARANTIA_PRAZO_DIAS: number;

  // Rastreabilidade
  WMTI_DATA_CONTRATACAO: string;
  WMTI_DATA_ASSINATURA: string;
  WMTI_IP_ASSINATURA: string;
  WMTI_USER_AGENT: string;
  WMTI_HASH_CONTRATUAL: string;
}

const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

/**
 * Gera o HTML completo do contrato sob demanda com 16 cláusulas.
 * Estrutura padronizada: CLÁUSULA → caput → parágrafos → incisos → alíneas.
 */
export function generateOnDemandContractHtml(vars: OnDemandContractVars): string {
  const v = vars;
  const horasPlural = v.WMTI_HORAS_CONTRATADAS > 1;
  const horasLabel = `${v.WMTI_HORAS_CONTRATADAS} (${numberToPortuguese(v.WMTI_HORAS_CONTRATADAS)}) hora${horasPlural ? "s" : ""} técnica${horasPlural ? "s" : ""}`;
  const totalWords = valueToWords(v.WMTI_VALOR_TOTAL);
  const docType = v.WMTI_CLIENTE_CNPJ.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF";

  // Common styles
  const fontStack = `-apple-system, 'San Francisco', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
  const clauseStyle = `font-size: 12pt; font-weight: bold; text-transform: uppercase; margin-top: 32px; margin-bottom: 12px; letter-spacing: 0.3px;`;
  const pStyle = `margin: 8px 0; text-align: justify;`;
  const listStyle = `padding-left: 24px; margin: 4px 0; text-align: justify;`;

  return `
<div style="font-family: ${fontStack}; max-width: 800px; margin: 0 auto; color: #000; line-height: 1.8; font-size: 12pt; text-align: justify;">

  <div style="text-align: center; margin-bottom: 40px;">
    <h1 style="font-size: 15pt; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
      CONTRATO DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS SOB DEMANDA
    </h1>
    ${v.WMTI_CONTRATO_ID ? `<p style="font-size: 9pt; color: #666; margin-top: 8px;">Contrato nº ${v.WMTI_CONTRATO_ID} — Pedido nº ${v.WMTI_PEDIDO_ID}</p>` : ""}
  </div>

  <!-- CLÁUSULA PRIMEIRA -->
  <h2 style="${clauseStyle}">CLÁUSULA PRIMEIRA — IDENTIFICAÇÃO DAS PARTES CONTRATANTES</h2>

  <p style="${pStyle}"><strong>CONTRATANTE:</strong> ${v.WMTI_CLIENTE_RAZAO_SOCIAL}${v.WMTI_CLIENTE_NOME_FANTASIA ? `, nome fantasia ${v.WMTI_CLIENTE_NOME_FANTASIA}` : ""}, com sede em ${v.WMTI_CLIENTE_ENDERECO}, CIDADE DE ${v.WMTI_CLIENTE_CIDADE}, CEP ${v.WMTI_CLIENTE_CEP}, inscrita no ${docType} sob o nº ${v.WMTI_CLIENTE_CNPJ}, neste ato representada por ${v.WMTI_CLIENTE_RESPONSAVEL}${v.WMTI_CLIENTE_CPF_RESPONSAVEL ? `, CPF nº ${v.WMTI_CLIENTE_CPF_RESPONSAVEL}` : ""}, adiante denominada simplesmente CONTRATANTE.${v.WMTI_CLIENTE_EMAIL ? ` E-mail: ${v.WMTI_CLIENTE_EMAIL}.` : ""}${v.WMTI_CLIENTE_WHATSAPP ? ` WhatsApp: ${v.WMTI_CLIENTE_WHATSAPP}.` : ""}${v.WMTI_CLIENTE_TELEFONE_COMERCIAL ? ` Tel. comercial: ${v.WMTI_CLIENTE_TELEFONE_COMERCIAL}.` : ""}</p>

  <p style="${pStyle}"><strong>CONTRATADA:</strong> WMTI TECNOLOGIA DA INFORMAÇÃO LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob nº 13.366.668/0001-07, com sede na Rua José Benedito Duarte, 140, Parque Itamarati, CEP 12.307-200, na Cidade de Jacareí, Estado de São Paulo, adiante denominada simplesmente CONTRATADA.</p>

  <p style="${pStyle}">As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços Técnicos Sob Demanda, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente instrumento.</p>

  <!-- CLÁUSULA SEGUNDA -->
  <h2 style="${clauseStyle}">CLÁUSULA SEGUNDA — DO OBJETO DO CONTRATO</h2>

  <p style="${pStyle}">O presente contrato tem como OBJETO a contratação pontual de ${horasLabel} para a prestação do serviço de <strong>${v.WMTI_SERVICO_NOME}</strong>, modalidade <strong>${v.WMTI_MODALIDADE}</strong>, conforme especificações abaixo:</p>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Serviço</td>
      <td style="border: 1px solid #000; padding: 8px;">${v.WMTI_SERVICO_NOME}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Categoria</td>
      <td style="border: 1px solid #000; padding: 8px;">${v.WMTI_SERVICO_CATEGORIA}</td>
    </tr>
    <tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Modalidade</td>
      <td style="border: 1px solid #000; padding: 8px;">${v.WMTI_MODALIDADE}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Horas Contratadas</td>
      <td style="border: 1px solid #000; padding: 8px;">${horasLabel}</td>
    </tr>
    <tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Valor por Hora Base</td>
      <td style="border: 1px solid #000; padding: 8px;">${formatCurrency(v.WMTI_VALOR_HORA_BASE ?? v.WMTI_VALOR_HORA)}</td>
    </tr>
    ${v.WMTI_DESCONTO_PROGRESSIVO_PCT && v.WMTI_DESCONTO_PROGRESSIVO_PCT > 0 ? `<tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Desconto Progressivo por Volume</td>
      <td style="border: 1px solid #000; padding: 8px; color: green;">-${v.WMTI_DESCONTO_PROGRESSIVO_PCT}%</td>
    </tr>` : ""}
    ${v.WMTI_FATOR_EXECUCAO_LABEL && v.WMTI_FATOR_EXECUCAO_LABEL !== "normal" ? `<tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Fator de Execução</td>
      <td style="border: 1px solid #000; padding: 8px;">${v.WMTI_FATOR_EXECUCAO_LABEL.charAt(0).toUpperCase() + v.WMTI_FATOR_EXECUCAO_LABEL.slice(1)} (×${(v.WMTI_MULTIPLICADOR_PRAZO_URGENCIA ?? 1).toFixed(2)})</td>
    </tr>` : ""}
    ${v.WMTI_MULTIPLICADOR_COMPLEXIDADE && v.WMTI_MULTIPLICADOR_COMPLEXIDADE > 1 ? `<tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Ajuste por Complexidade</td>
      <td style="border: 1px solid #000; padding: 8px;">×${v.WMTI_MULTIPLICADOR_COMPLEXIDADE.toFixed(1)}</td>
    </tr>` : ""}
    <tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Valor Final por Hora</td>
      <td style="border: 1px solid #000; padding: 8px;">${formatCurrency(v.WMTI_VALOR_FINAL_HORA ?? v.WMTI_VALOR_HORA)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Valor Total</td>
      <td style="border: 1px solid #000; padding: 8px;"><strong>${formatCurrency(v.WMTI_VALOR_TOTAL)}</strong> (${totalWords})</td>
    </tr>
    ${v.WMTI_ECONOMIA > 0 ? `<tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Economia Obtida</td>
      <td style="border: 1px solid #000; padding: 8px; color: green;">${formatCurrency(v.WMTI_ECONOMIA)}</td>
    </tr>` : ""}
  </table>

  <p style="${pStyle}"><em>Parágrafo Primeiro:</em> ${v.WMTI_SERVICO_OBJETO_TECNICO}</p>

  <p style="${pStyle}"><em>Parágrafo Segundo:</em> O objeto contratual não se limita exclusivamente à descrição simplificada ou comercial exibida no site da CONTRATADA, podendo abranger atividades correlatas, acessórias, complementares e tecnicamente necessárias à plena execução do serviço contratado, desde que: (I) tenham relação direta e proporcional com o objeto principal descrito neste instrumento; (II) sejam inerentes à natureza técnica do serviço contratado; (III) não descaracterizem o objeto original; e (IV) não importem em expansão ilimitada de escopo sem contratação adicional. Eventuais demandas extraordinárias, projetos, implantações, migrações, aquisições de infraestrutura ou quaisquer serviços não expressamente previstos ou não diretamente correlatos ao objeto principal demandarão contratação complementar específica.</p>

  <!-- CLÁUSULA TERCEIRA -->
  <h2 style="${clauseStyle}">CLÁUSULA TERCEIRA — DA EXECUÇÃO DOS SERVIÇOS</h2>

  <p style="${pStyle}">As horas técnicas contratadas poderão ser utilizadas pelo CONTRATANTE para o serviço descrito na Cláusula Segunda, mediante agendamento prévio com a CONTRATADA.</p>

  <p style="${pStyle}"><em>Parágrafo Primeiro:</em> O atendimento será prestado de forma remota ou presencial, conforme a necessidade técnica e a critério da CONTRATADA, no endereço: ${v.WMTI_CLIENTE_ENDERECO}, ${v.WMTI_CLIENTE_CIDADE}, CEP ${v.WMTI_CLIENTE_CEP}. No caso de atendimentos presenciais, serão realizados prioritariamente nas dependências do CONTRATANTE.</p>

  <p style="${pStyle}"><em>Parágrafo Segundo:</em> As horas contratadas são válidas por 90 (noventa) dias corridos a partir da data de confirmação do pagamento. Horas não utilizadas dentro deste prazo serão consideradas integralmente consumidas, sem direito a reembolso ou crédito.</p>

  ${v.WMTI_IS_EMERGENCY
    ? `<p style="${pStyle}"><em>Parágrafo Terceiro:</em> Por se tratar de atendimento emergencial, a CONTRATADA envidará esforços razoáveis para iniciar o atendimento em até 4 (quatro) horas úteis após a solicitação formal do CONTRATANTE, sujeito à disponibilidade da equipe técnica. O prazo de resposta não constitui obrigação de resultado, mas de esforço compatível com a urgência declarada.</p>`
    : `<p style="${pStyle}"><em>Parágrafo Terceiro:</em> O agendamento do atendimento será realizado com antecedência mínima de 24 (vinte e quatro) horas úteis, sujeito à disponibilidade da equipe técnica da CONTRATADA. Em caso de urgência, a CONTRATADA envidará esforços para antecipar o atendimento, sem que isso constitua obrigação contratual.</p>`
  }

  <p style="${pStyle}"><em>Parágrafo Quarto:</em> A contagem das horas técnicas será iniciada a partir do momento em que o técnico da CONTRATADA iniciar efetivamente a análise ou intervenção no ambiente do CONTRATANTE, seja de forma remota ou presencial, e cessará quando concluída a atividade objeto do chamado ou quando esgotado o saldo de horas contratadas.</p>

  <!-- CLÁUSULA QUARTA -->
  <h2 style="${clauseStyle}">CLÁUSULA QUARTA — DA NATUREZA PONTUAL DA CONTRATAÇÃO</h2>

  <p style="${pStyle}">O presente contrato possui natureza pontual e não recorrente, não gerando obrigação automática de continuidade, renovação ou prestação periódica de serviços. Eventual continuidade da prestação de serviços dependerá de nova e independente contratação entre as partes, que poderá ocorrer sob as mesmas condições ou condições diversas, a critério de ambas as partes.</p>

  <p style="${pStyle}"><em>Parágrafo Único:</em> A celebração de contratos futuros entre as partes não caracteriza vínculo contratual continuado, relação de exclusividade ou dependência econômica entre CONTRATANTE e CONTRATADA.</p>

  <!-- CLÁUSULA QUINTA -->
  <h2 style="${clauseStyle}">CLÁUSULA QUINTA — DA CONTRAPRESTAÇÃO E PAGAMENTO</h2>

  <p style="${pStyle}">Em contraprestação aos serviços objeto deste contrato, o CONTRATANTE deverá efetuar o pagamento integral e antecipado do valor de <strong>${formatCurrency(v.WMTI_VALOR_TOTAL)}</strong> (${totalWords}), correspondente a ${horasLabel} ao valor final de ${formatCurrency(v.WMTI_VALOR_FINAL_HORA ?? v.WMTI_VALOR_HORA)} por hora técnica, por meio de boleto bancário, PIX (QR Code da cobrança) ou cartão de crédito.</p>

  <p style="${pStyle}"><em>Parágrafo Primeiro:</em> O início da prestação dos serviços está condicionado à confirmação do pagamento integral pela CONTRATADA. Não haverá prestação de serviços a crédito ou mediante promessa de pagamento futuro.</p>

  <p style="${pStyle}"><em>Parágrafo Segundo:</em> Todos os tributos e contribuições devidos em decorrência direta ou indireta do presente contrato serão de exclusiva responsabilidade do contribuinte legalmente obrigado, nos termos da legislação tributária vigente.</p>

  <p style="${pStyle}"><em>Parágrafo Terceiro:</em> A CONTRATADA emitirá nota fiscal de serviços correspondente ao valor contratado, nos termos da legislação aplicável.</p>

  <!-- CLÁUSULA SEXTA -->
  <h2 style="${clauseStyle}">CLÁUSULA SEXTA — DA GARANTIA TÉCNICA PÓS-SERVIÇO</h2>

  <p style="${pStyle}">Após a conclusão do atendimento, a CONTRATADA oferece garantia técnica pós-serviço de <strong>${v.WMTI_GARANTIA_HORAS} (${numberToPortuguese(v.WMTI_GARANTIA_HORAS)}) hora${v.WMTI_GARANTIA_HORAS > 1 ? "s" : ""}</strong>, válida por até <strong>${v.WMTI_GARANTIA_PRAZO_DIAS} (${numberToPortuguese(v.WMTI_GARANTIA_PRAZO_DIAS)}) dias corridos</strong> contados da data de conclusão do serviço.</p>

  <p style="${pStyle}"><em>Parágrafo Primeiro:</em> A garantia aplica-se exclusivamente ao mesmo problema e ao mesmo objeto técnico atendido durante a execução do contrato, devendo o CONTRATANTE reportar a recorrência do problema dentro do prazo de garantia.</p>

  <p style="${pStyle}"><em>Parágrafo Segundo:</em> A garantia não cobre:</p>
  <p style="${listStyle}">I — demandas novas ou distintas do objeto originalmente atendido;</p>
  <p style="${listStyle}">II — alterações realizadas por terceiros ou pelo próprio CONTRATANTE no ambiente técnico após a conclusão do serviço;</p>
  <p style="${listStyle}">III — problemas decorrentes de fatores externos como falha de energia, desastres naturais, atos de terceiros ou uso indevido dos equipamentos;</p>
  <p style="${listStyle}">IV — ampliação ou modificação de escopo não prevista no atendimento original.</p>

  <p style="${pStyle}"><em>Parágrafo Terceiro:</em> As horas de garantia serão utilizadas exclusivamente para correção da mesma ocorrência e não poderão ser convertidas em crédito, transferidas para outros serviços ou acumuladas com outros contratos.</p>

  <!-- CLÁUSULA SÉTIMA -->
  <h2 style="${clauseStyle}">CLÁUSULA SÉTIMA — DAS OBRIGAÇÕES DA CONTRATADA</h2>

  <p style="${pStyle}">Sem prejuízo às demais condições estabelecidas no presente contrato, a CONTRATADA obriga-se a:</p>
  <p style="${listStyle}">a) Executar de forma diligente e oportuna os serviços, observando normas e padrões técnicos aplicáveis, garantindo a sua boa qualidade;</p>
  <p style="${listStyle}">b) Cumprir rigorosamente os cronogramas de trabalho acordados;</p>
  <p style="${listStyle}">c) Respeitar os horários de funcionamento do CONTRATANTE;</p>
  <p style="${listStyle}">d) Emitir nota fiscal de serviços correspondente ao valor contratado;</p>
  <p style="${listStyle}">e) Responsabilizar-se pelo depósito de qualquer documento ou informação entregue pelo CONTRATANTE;</p>
  <p style="${listStyle}">f) Prestar todas as informações sobre os serviços em execução, incluindo saldo de horas restantes quando solicitado;</p>
  <p style="${listStyle}">g) Orientar o CONTRATANTE quanto a novas tecnologias e melhores práticas aplicáveis;</p>
  <p style="${listStyle}">h) Manter sua equipe tecnicamente atualizada e capacitada;</p>
  <p style="${listStyle}">i) Manter as informações da empresa CONTRATANTE em sigilo e confidencialidade.</p>

  <!-- CLÁUSULA OITAVA -->
  <h2 style="${clauseStyle}">CLÁUSULA OITAVA — DAS OBRIGAÇÕES DO CONTRATANTE</h2>

  <p style="${pStyle}">Sem prejuízo às demais condições, o CONTRATANTE obriga-se a:</p>
  <p style="${listStyle}">a) Designar profissionais que realizarão a interface técnica e administrativa com a CONTRATADA;</p>
  <p style="${listStyle}">b) Cooperar com a CONTRATADA, tomando decisões que orientem a execução dos serviços;</p>
  <p style="${listStyle}">c) Oferecer infraestrutura adequada — incluindo acesso remoto, rede, energia e espaço físico — aos profissionais da CONTRATADA quando da execução dos serviços presenciais;</p>
  <p style="${listStyle}">d) Colocar à disposição todas as informações, credenciais e acessos necessários ao desenvolvimento dos serviços;</p>
  <p style="${listStyle}">e) Manter nos equipamentos atendidos licenças válidas de softwares;</p>
  <p style="${listStyle}">f) Efetuar o pagamento conforme estabelecido na Cláusula Quinta deste contrato;</p>
  <p style="${listStyle}">g) Comunicar à CONTRATADA, com a maior brevidade possível, qualquer ocorrência relevante que possa impactar a execução dos serviços.</p>

  <!-- CLÁUSULA NONA -->
  <h2 style="${clauseStyle}">CLÁUSULA NONA — DA LIMITAÇÃO DE RESPONSABILIDADE</h2>

  <p style="${pStyle}">A CONTRATADA não se responsabiliza por:</p>
  <p style="${listStyle}">a) Danos causados por problemas pré-existentes no ambiente do CONTRATANTE que não tenham sido previamente informados;</p>
  <p style="${listStyle}">b) Perda de dados decorrente de ausência de backup adequado por parte do CONTRATANTE;</p>
  <p style="${listStyle}">c) Interrupções causadas por falhas de energia elétrica, desastres naturais, atos de terceiros ou eventos de força maior;</p>
  <p style="${listStyle}">d) Incompatibilidade ou defeitos em softwares e hardwares de terceiros não objeto deste contrato;</p>
  <p style="${listStyle}">e) Resultados que dependam de fatores fora do controle técnico da CONTRATADA.</p>

  <p style="${pStyle}"><em>Parágrafo Único:</em> Em qualquer hipótese, a responsabilidade total da CONTRATADA ficará limitada ao valor efetivamente pago pelo CONTRATANTE neste contrato.</p>

  <!-- CLÁUSULA DÉCIMA -->
  <h2 style="${clauseStyle}">CLÁUSULA DÉCIMA — DA CONFIDENCIALIDADE</h2>

  <p style="${pStyle}">A CONTRATADA obriga-se a manter sigilo e confidencialidade sobre todas as informações, dados, documentos e materiais obtidos em razão da execução do presente instrumento, não podendo divulgá-los, reproduzi-los ou utilizá-los para finalidade diversa da contratada, sob pena de responsabilização civil e criminal.</p>

  <p style="${pStyle}"><em>Parágrafo Único:</em> A obrigação de confidencialidade permanecerá vigente mesmo após a conclusão, rescisão ou término do presente contrato, pelo prazo de 5 (cinco) anos.</p>

  <!-- CLÁUSULA DÉCIMA PRIMEIRA -->
  <h2 style="${clauseStyle}">CLÁUSULA DÉCIMA PRIMEIRA — DO CANCELAMENTO E REEMBOLSO</h2>

  <p style="${pStyle}">A CONTRATANTE poderá solicitar o cancelamento da contratação e eventual reembolso no prazo máximo de até 7 (sete) dias corridos, contados a partir da data da contratação, desde que não tenha ocorrido a execução do serviço ou o início de sua utilização.</p>

  <p style="${pStyle}"><em>Parágrafo Primeiro:</em> Após o prazo de 7 (sete) dias, não haverá possibilidade de reembolso, permanecendo os valores pagos integralmente vinculados à contratação realizada.</p>

  <p style="${pStyle}"><em>Parágrafo Segundo:</em> Para serviços contratados na modalidade sob demanda, a CONTRATANTE deverá utilizar os serviços no prazo máximo de até 90 (noventa) dias, contados a partir da confirmação do pagamento. A não utilização do serviço dentro do prazo estabelecido não gera direito a reembolso, crédito ou compensação de qualquer natureza.</p>

  <p style="${pStyle}"><em>Parágrafo Terceiro:</em> Para serviços recorrentes, o cancelamento poderá ser solicitado a qualquer tempo para interromper cobranças futuras, respeitado o prazo mínimo contratual de 6 (seis) meses, não implicando, em nenhuma hipótese, na devolução de valores já pagos referentes a períodos anteriores ou em curso.</p>

  <p style="${pStyle}"><em>Parágrafo Quarto:</em> A contratação dos serviços garante à CONTRATANTE a disponibilidade técnica, operacional e organizacional da CONTRATADA durante o período contratado, não estando o direito de reembolso condicionado à efetiva utilização do serviço após o prazo legal de arrependimento.</p>

  <!-- CLÁUSULA DÉCIMA SEGUNDA -->
  <h2 style="${clauseStyle}">CLÁUSULA DÉCIMA SEGUNDA — DA CONTRATAÇÃO ADICIONAL</h2>

  <p style="${pStyle}">Caso o CONTRATANTE necessite de horas técnicas adicionais além das contratadas neste instrumento, poderá realizar nova contratação, que será formalizada por instrumento próprio, podendo adotar as mesmas condições ou condições diversas, conforme disponibilidade e tabela vigente da CONTRATADA.</p>

  <p style="${pStyle}"><em>Parágrafo Único:</em> As horas adicionais eventualmente contratadas não se confundem com as horas de garantia previstas na Cláusula Sexta e não alteram os prazos de validade do presente contrato.</p>

  <!-- CLÁUSULA DÉCIMA TERCEIRA -->
  <h2 style="${clauseStyle}">CLÁUSULA DÉCIMA TERCEIRA — DAS CONDIÇÕES GERAIS</h2>

  <p style="${pStyle}">As relações existentes entre as partes são unicamente comerciais, de natureza civil, não havendo nenhum vínculo trabalhista, societário ou associativo entre CONTRATANTE e CONTRATADA, seus sócios, prepostos ou empregados.</p>

  <p style="${pStyle}"><em>Parágrafo Primeiro:</em> As partes não poderão ceder ou transferir a terceiros os direitos e obrigações emergentes deste contrato, sem a prévia aprovação por escrito da outra parte.</p>

  <p style="${pStyle}"><em>Parágrafo Segundo:</em> O CONTRATANTE compromete-se a não contratar qualquer tipo de serviço diretamente com funcionário da CONTRATADA enquanto estiver no quadro de empregados e pelo prazo de 24 (vinte e quatro) meses após desligamento.</p>

  <p style="${pStyle}"><em>Parágrafo Terceiro:</em> De acordo com o artigo 476 do Código Civil, fica assegurado ao CONTRATANTE o direito de suspender qualquer pagamento em caso de descumprimento das obrigações por parte da CONTRATADA, mediante notificação formal.</p>

  <p style="${pStyle}"><em>Parágrafo Quarto:</em> Não constituirá novação a abstenção ou tolerância por qualquer das partes no exercício de qualquer direito previsto neste contrato.</p>

  <p style="${pStyle}"><em>Parágrafo Quinto:</em> Na hipótese de divergência entre proposta comercial e o presente contrato, prevalecem os termos deste instrumento.</p>

  <!-- CLÁUSULA DÉCIMA QUARTA -->
  <h2 style="${clauseStyle}">CLÁUSULA DÉCIMA QUARTA — DA PROTEÇÃO DE DADOS (LGPD)</h2>

  <p style="${pStyle}">As partes comprometem-se a tratar os dados pessoais a que tiverem acesso em decorrência deste contrato em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD), adotando medidas técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão.</p>

  <!-- CLÁUSULA DÉCIMA QUINTA -->
  <h2 style="${clauseStyle}">CLÁUSULA DÉCIMA QUINTA — DO ACEITE ELETRÔNICO E TÍTULO EXECUTIVO</h2>

  <p style="${pStyle}">O presente contrato é celebrado de forma eletrônica, sendo a assinatura digital do CONTRATANTE considerada válida e vinculante para todos os efeitos legais, nos termos do artigo 10 da Medida Provisória nº 2.200-2/2001.</p>

  <p style="${pStyle}"><em>Parágrafo Primeiro:</em> O presente instrumento tem força de título executivo extrajudicial nos termos do artigo 784, inciso III, do Código de Processo Civil, e é celebrado em caráter irrevogável e irretratável, obrigando as partes, seus herdeiros e sucessores.</p>

  <p style="${pStyle}"><em>Parágrafo Segundo:</em> O presente Contrato será regido pelas leis da República Federativa do Brasil.</p>

  <!-- CLÁUSULA DÉCIMA SEXTA -->
  <h2 style="${clauseStyle}">CLÁUSULA DÉCIMA SEXTA — DO FORO</h2>

  <p style="${pStyle}">Fica eleito o Foro da Comarca de Jacareí/SP, com exclusão de qualquer outro, por mais privilegiado que seja, para dirimir quaisquer questões oriundas do presente contrato.</p>

  <p style="${pStyle}; margin-top: 32px;">E, por estarem assim justas e contratadas, as partes assinam o presente Contrato eletronicamente, na presença das informações de rastreabilidade abaixo.</p>

  <br/><br/><br/>

  <p style="text-align: center; margin: 0;"><strong>Jacareí/SP,</strong> ${v.WMTI_DATA_CONTRATACAO}</p>

  <br/><br/><br/>

  <div style="text-align: center; width: 60%; margin: 0 auto;">
    <div style="border-top: 1px solid #000; padding-top: 8px;">
      <p style="margin: 0; font-weight: bold; text-transform: uppercase;">${v.WMTI_CLIENTE_RAZAO_SOCIAL}</p>
      <p style="margin: 0; font-size: 10pt;"><strong>${docType}:</strong> ${v.WMTI_CLIENTE_CNPJ}</p>
      <p style="margin: 0; font-size: 10pt;">CONTRATANTE</p>
    </div>
  </div>

  <br/>

  <div style="text-align: center; width: 60%; margin: 0 auto;">
    <div style="border-top: 1px solid #000; padding-top: 8px;">
      <p style="margin: 0; font-weight: bold;">WMTI TECNOLOGIA DA INFORMAÇÃO LTDA</p>
      <p style="margin: 0; font-size: 10pt;"><strong>CNPJ:</strong> 13.366.668/0001-07</p>
      <p style="margin: 0; font-size: 10pt;">CONTRATADA</p>
    </div>
  </div>

  <br/><br/><br/>

  <div data-traceability="true" style="padding-top: 16px; border-top: 1px solid #999;">
    <h2 style="font-size: 10pt; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; color: #333;">DADOS DE RASTREABILIDADE DA ASSINATURA ELETRÔNICA</h2>
    <p style="font-size: 9pt; color: #444; margin: 4px 0;"><strong>IP de origem:</strong> <span data-proof="ip">{{SIGN_IP}}</span></p>
    <p style="font-size: 9pt; color: #444; margin: 4px 0;"><strong>Data da confirmação:</strong> <span data-proof="date">{{SIGN_DATE}}</span></p>
    <p style="font-size: 9pt; color: #444; margin: 4px 0;"><strong>Hora da confirmação:</strong> <span data-proof="time">{{SIGN_TIME}}</span></p>
    <p style="font-size: 9pt; color: #444; margin: 4px 0;"><strong>Dispositivo/Navegador:</strong> <span data-proof="ua">{{SIGN_USER_AGENT}}</span></p>
    <p style="font-size: 8pt; color: #888; margin-top: 12px; font-style: italic;">Este documento foi assinado eletronicamente nos termos do art. 10 da Medida Provisória nº 2.200-2/2001. Os dados acima constituem prova eletrônica da manifestação de vontade do signatário.</p>
  </div>

  ${v.WMTI_CONTRATO_ID ? `
  <hr style="border: none; border-top: 1px solid #ccc; margin: 32px 0 8px 0;"/>
  <p style="font-size: 9pt; color: #888; text-align: center; margin: 0;">Contrato WMTi — Sob Demanda — ID ${v.WMTI_CONTRATO_ID} — Hash: ${v.WMTI_HASH_CONTRATUAL || "pendente"}</p>
  ` : ""}

</div>
`;
}

/* ─── Helper: number to Portuguese ─── */
function numberToPortuguese(n: number): string {
  if (n === 0) return "zero";
  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const parts: string[] = [];
  if (n >= 20) {
    const t = tens[Math.floor(n / 10)];
    const u = n % 10;
    parts.push(u > 0 ? t + " e " + units[u] : t);
  } else if (n > 0) {
    parts.push(units[n]);
  }
  return parts.join(" e ");
}

/**
 * Adaptor: builds OnDemandContractVars from the existing checkout state
 * so ContratarServicoPage can call this without changing its flow.
 */
export function buildOnDemandVarsFromCheckout(opts: {
  customer: { razaoSocial: string; nomeFantasia?: string; cnpjOuCpf: string; responsavel: string; cpfResponsavel?: string; email: string; whatsapp?: string; telefone?: string; endereco: string; cidade: string; cep: string };
  serviceName: string;
  serviceSlug: string;
  isEmergency: boolean;
  hours: number;
  unitPrice: number;
  totalValue: number;
  savings: number;
  contractId?: string;
  quoteId?: string;
  valorHoraBase?: number;
  multiplicadorComplexidade?: number;
  multiplicadorPrazoUrgencia?: number;
  descontoProgressivoPct?: number;
  valorFinalHora?: number;
  fatorExecucaoLabel?: string;
}): OnDemandContractVars {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  return {
    WMTI_CONTRATO_ID: opts.contractId || "",
    WMTI_PEDIDO_ID: opts.quoteId || "",
    WMTI_CLIENTE_RAZAO_SOCIAL: opts.customer.razaoSocial,
    WMTI_CLIENTE_NOME_FANTASIA: opts.customer.nomeFantasia || "",
    WMTI_CLIENTE_CNPJ: opts.customer.cnpjOuCpf,
    WMTI_CLIENTE_RESPONSAVEL: opts.customer.responsavel,
    WMTI_CLIENTE_CPF_RESPONSAVEL: opts.customer.cpfResponsavel || "",
    WMTI_CLIENTE_EMAIL: opts.customer.email,
    WMTI_CLIENTE_WHATSAPP: opts.customer.whatsapp || "",
    WMTI_CLIENTE_TELEFONE_COMERCIAL: opts.customer.telefone || "",
    WMTI_CLIENTE_ENDERECO: opts.customer.endereco,
    WMTI_CLIENTE_CIDADE: opts.customer.cidade,
    WMTI_CLIENTE_CEP: opts.customer.cep,
    WMTI_SERVICO_NOME: opts.serviceName,
    WMTI_SERVICO_SLUG: opts.serviceSlug,
    WMTI_SERVICO_CATEGORIA: opts.isEmergency ? "Suporte Emergencial" : "Serviços Técnicos de TI",
    WMTI_SERVICO_OBJETO_COMERCIAL: `Prestação de serviço técnico especializado de ${opts.serviceName}.`,
    WMTI_SERVICO_OBJETO_TECNICO: `A CONTRATADA prestará serviço técnico especializado de ${opts.serviceName}, compreendendo diagnóstico, análise, intervenção técnica e resolução de problemas no ambiente de infraestrutura de tecnologia da informação do CONTRATANTE, dentro do escopo e da quantidade de horas contratadas, conforme especificações da Cláusula 2.`,
    WMTI_SERVICO_RESUMO_CONTRATUAL: `${opts.hours} hora(s) técnica(s) de ${opts.serviceName} — modalidade ${opts.isEmergency ? "emergencial" : "sob demanda"}.`,
    WMTI_HORAS_CONTRATADAS: opts.hours,
    WMTI_VALOR_HORA: opts.unitPrice,
    WMTI_VALOR_TOTAL: opts.totalValue,
    WMTI_ECONOMIA: opts.savings,
    WMTI_MODALIDADE: opts.isEmergency ? "EMERGENCIAL" : "AVULSO SOB DEMANDA",
    WMTI_IS_EMERGENCY: opts.isEmergency,
    WMTI_VALOR_HORA_BASE: opts.valorHoraBase ?? opts.unitPrice,
    WMTI_MULTIPLICADOR_COMPLEXIDADE: opts.multiplicadorComplexidade,
    WMTI_MULTIPLICADOR_PRAZO_URGENCIA: opts.multiplicadorPrazoUrgencia,
    WMTI_DESCONTO_PROGRESSIVO_PCT: opts.descontoProgressivoPct,
    WMTI_VALOR_FINAL_HORA: opts.valorFinalHora ?? opts.unitPrice,
    WMTI_FATOR_EXECUCAO_LABEL: opts.fatorExecucaoLabel,
    WMTI_GARANTIA_HORAS: opts.hours,
    WMTI_GARANTIA_PRAZO_DIAS: 15,
    WMTI_DATA_CONTRATACAO: today,
    WMTI_DATA_ASSINATURA: "",
    WMTI_IP_ASSINATURA: "",
    WMTI_USER_AGENT: "",
    WMTI_HASH_CONTRATUAL: "",
  };
}

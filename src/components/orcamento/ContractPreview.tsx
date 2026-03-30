import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import type { CustomerData } from "./CustomerDataForm";
import type { Plan } from "./PlanSelector";

interface Props {
  visible: boolean;
  customer: CustomerData | null;
  contractType: "locacao" | "suporte";
  plan: Plan | null;
  computersQty: number;
  monthlyValue: number;
}

const formatDate = (date: Date) =>
  date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

const getDueDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return formatDate(d);
};

const numberToWords = (n: number): string => {
  if (n === 0) return "zero";
  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
    "seiscentos", "setecentos", "oitocentos", "novecentos"];
  const parts: string[] = [];
  if (n >= 1000) { const thousands = Math.floor(n / 1000); parts.push(thousands === 1 ? "mil" : numberToWords(thousands) + " mil"); n = n % 1000; }
  if (n >= 100) { if (n === 100) { parts.push("cem"); n = 0; } else { parts.push(hundreds[Math.floor(n / 100)]); n = n % 100; } }
  if (n >= 20) { const t = tens[Math.floor(n / 10)]; const u = n % 10; parts.push(u > 0 ? t + " e " + units[u] : t); } else if (n > 0) { parts.push(units[n]); }
  return parts.join(" e ");
};

export const valueToWords = (value: number): string => {
  const intPart = Math.floor(value);
  const centPart = Math.round((value - intPart) * 100);
  let result = numberToWords(intPart) + " reais";
  if (centPart > 0) result += " e " + numberToWords(centPart) + (centPart === 1 ? " centavo" : " centavos");
  return result;
};

export const generateContractHtml = (
  customer: CustomerData, contractType: "locacao" | "suporte", plan: Plan | null, computersQty: number, monthlyValue: number
) => {
  const today = formatDate(new Date());
  const dueDate = getDueDate();
  const isRental = contractType === "locacao";
  const unitPrice = plan ? plan.price : 0;
  const valueWords = valueToWords(monthlyValue);
  const equipmentDesc = isRental && plan
    ? `${computersQty} Computador(es) Dell OptiPlex com processador ${plan.cpu}, SSD ${plan.ssd}, ${plan.ram} de memória RAM, placa de rede Gigabit onboard, sem sistema operacional, mouse, teclado e monitor 18.5" Dell.`
    : `${computersQty} computador(es) e infraestrutura de rede.`;
  const contractTitle = isRental ? "CONTRATO DE LOCAÇÃO DE COMPUTADORES E PERIFÉRICOS" : "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TI";

  // Contract HTML is a legal document — kept in Portuguese regardless of UI language
  return `
<div style="font-family: 'Times New Roman', Times, serif; max-width: 800px; margin: 0 auto; color: #000; line-height: 1.8; font-size: 12pt; text-align: justify;">
  <div style="text-align: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid #000;">
    <p style="font-size: 14pt; font-weight: bold; margin: 0;">WMTi Tecnologia da Informação</p>
    <h1 style="font-size: 14pt; font-weight: bold; margin: 16px 0 0 0; text-transform: uppercase;">${contractTitle}</h1>
  </div>
  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">IDENTIFICAÇÃO DAS PARTES CONTRATANTES</h2>
  <p><strong>CONTRATANTE:</strong> Razão Social: ${customer.razaoSocial}${customer.nomeFantasia ? `, Nome fantasia: ${customer.nomeFantasia}` : ""}, com sede em ${customer.endereco}, CIDADE DE ${customer.cidade}, com CEP ${customer.cep}, inscrita no ${customer.cnpjOuCpf.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"} sob o nº ${customer.cnpjOuCpf}, neste ato representada por ${customer.responsavel}, adiante denominado simplesmente ${isRental ? "LOCATÁRIO" : "CONTRATANTE"}.${customer.email ? ` E-mail: ${customer.email}.` : ""}${customer.telefone ? ` Telefone: ${customer.telefone}.` : ""}</p>
  <p><strong>${isRental ? "LOCADOR" : "CONTRATADA"}:</strong> WMTI TECNOLOGIA DA INFORMAÇÃO LTDA, pessoa jurídica privada, inscrita no CNPJ sob nº 13.366.668/0001-07, com sede na RUA JOSÉ BENEDITO DUARTE, 140, PARQUE ITAMARATI, CEP: 12.307-200, na CIDADE DE JACAREÍ no ESTADO DE SÃO PAULO, adiante denominada simplesmente como ${isRental ? "LOCADOR" : "CONTRATADA"}.</p>
  <p>As partes acima identificadas têm, entre si, justo e acertado o presente ${isRental ? "Contrato de Locação de Computadores e equipamentos periféricos" : "Contrato de Prestação de Serviços de TI"}, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente contrato.</p>
  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO OBJETO DO CONTRATO</h2>
  <p><strong>Cláusula Primeira</strong> – O presente contrato tem como OBJETO${isRental ? `, a transferência, pelo LOCADOR ao LOCATÁRIO, dos direitos de uso e gozo dos computadores e equipamentos periféricos descritos a seguir:` : `, a prestação de serviços de suporte técnico mensal e manutenção da infraestrutura de TI do CONTRATANTE, conforme descrito a seguir:`}</p>
  <p>${equipmentDesc}</p>
  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO USO E DOS SERVIÇOS PRESTADOS</h2>
  ${isRental ? `
  <p><strong>Cláusula Segunda</strong> – Os computadores e periféricos, objeto deste contrato, serão utilizados, exclusivamente, pelos funcionários registrados na empresa e pelos gerentes e seus subordinados ligados diretamente ao LOCATÁRIO, não sendo cabível seu uso para fins pessoais e somente nos seguintes locais: no endereço do LOCATÁRIO presente neste contrato.</p>
  <p><strong>Cláusula Terceira</strong> – Além da LOCAÇÃO em si, serão objeto deste contrato os seguintes serviços:</p>
  <p>a) Serviço de suporte corretivo local com analista para a manutenção de hardware e software básico.</p>
  <p>b) Uma Manutenção Preventiva online realizada pela equipe de suporte da WMTi a fim de inibir falhas em hardware e softwares básicos instalados localmente no computador locado.</p>
  <p><strong>Cláusula Quarta</strong> – O LOCADOR prestará serviços ao LOCATÁRIO no endereço: ${customer.endereco}, ${customer.cidade}, CEP ${customer.cep}.</p>
  <p><strong>Cláusula Quinta</strong> – A locação será prestada somente nos endereços mencionados na cláusula anterior, sendo vedada a utilização dos equipamentos em lugares não descritos neste contrato.</p>
  <p><strong>Cláusula Sexta</strong> – A manutenção presencial de Hardware só será desenvolvida caso as checagens remotas, via telefone, e-mail ou da forma mais cômoda ao LOCATÁRIO forem desenvolvidas sem sucesso.</p>
  <p><strong>Cláusula Sétima</strong> – O LOCADOR desenvolverá manutenção remota, somente com referência ao Sistema Operacional utilizado, sempre que houver solicitação do LOCATÁRIO mediante o valor de R$ 150,00 (cento e cinquenta reais) por hora de trabalho, tal valor somente será cobrado quando não houver relação entre o motivo do chamado e o objeto deste contrato. Caso o LOCADOR mantenha firmado um contrato de serviços com o LOCATÁRIO esta cláusula perderá seu valor.</p>
  <p><strong>Cláusula Oitava</strong> – O serviço de manutenção será desenvolvido, preferencialmente, de forma remota. No caso de reparos "in loco", prioritariamente, será realizada nas dependências do LOCATÁRIO.</p>
  <p><strong>Cláusula Nona</strong> – O LOCATÁRIO, neste ato, se obriga a adquirir a licença do Sistema Operacional que melhor lhe couber no prazo de 30 dias.</p>
  ` : `
  <p><strong>Cláusula Segunda</strong> – A CONTRATADA se compromete a prestar os seguintes serviços:</p>
  <p>a) Serviço de suporte corretivo e preventivo, remoto e presencial.</p>
  <p>b) Manutenção preventiva online realizada pela equipe de suporte da WMTi.</p>
  <p>c) Monitoramento da infraestrutura de rede.</p>
  <p>d) Gestão de servidores Windows Server.</p>
  <p>e) Consultoria de infraestrutura.</p>
  <p><strong>Cláusula Terceira</strong> – A CONTRATADA prestará serviços ao CONTRATANTE no endereço: ${customer.endereco}, ${customer.cidade}, CEP ${customer.cep}.</p>
  <p><strong>Cláusula Quarta</strong> – O serviço de manutenção será desenvolvido, preferencialmente, de forma remota. No caso de atendimentos presenciais, serão realizados nas dependências do CONTRATANTE.</p>
  `}
  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DAS OBRIGAÇÕES DO ${isRental ? "LOCADOR" : "CONTRATADA"}</h2>
  <p><strong>Cláusula Décima</strong> – Sem prejuízo às demais condições estabelecidas no presente Contrato, o ${isRental ? "LOCADOR" : "CONTRATADA"} obriga-se a:</p>
  <p>a) Executar de forma diligente e oportuna os serviços, observando normas e padrões técnicos aplicáveis, garantindo a sua boa qualidade;</p>
  <p>b) Cumprir rigorosamente os cronogramas de trabalho acordados;</p>
  <p>c) Respeitar os horários de funcionamento do ${isRental ? "LOCATÁRIO" : "CONTRATANTE"};</p>
  <p>d) Emitir faturas de cobrança e notas fiscais, em conformidade com o presente contrato;</p>
  <p>e) Responsabilizar-se pelo depósito de qualquer documento ou informação entregue;</p>
  <p>f) Prestar todas as informações sobre os serviços em execução;</p>
  <p>g) Orientar quanto a novas tecnologias;</p>
  <p>h) Cumprir rigorosamente os prazos de atendimento;</p>
  <p>i) Manter as informações da empresa confidenciais;</p>
  <p>j) Manter sua equipe tecnicamente atualizada.</p>
  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DAS OBRIGAÇÕES DO ${isRental ? "LOCATÁRIO" : "CONTRATANTE"}</h2>
  <p><strong>Cláusula Décima Primeira</strong> – Sem prejuízo às demais condições, o ${isRental ? "LOCATÁRIO" : "CONTRATANTE"} obriga-se a:</p>
  <p>a) Designar profissionais que realizarão a interface com o ${isRental ? "LOCADOR" : "CONTRATADA"};</p>
  <p>b) Cooperar, tomando decisões que orientem o dia-a-dia da prestação dos serviços;</p>
  <p>c) Oferecer infraestrutura aos empregados do ${isRental ? "LOCADOR" : "CONTRATADA"} quando da execução dos serviços;</p>
  <p>d) Colocar à disposição todas as informações necessárias ao desenvolvimento dos serviços;</p>
  <p>e) Manter nos equipamentos licenças válidas de softwares;</p>
  <p>f) Realizar os pagamentos nos termos aprazados.</p>
  ${isRental ? `
  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DA TROCA DE EQUIPAMENTOS</h2>
  <p><strong>Cláusula Décima Segunda</strong> – Identificado problemas, exclusivamente de hardware, e sendo impossível o reparo, o LOCATÁRIO poderá requisitar a troca da peça durante todo o período de vigência deste pacto.</p>
  <p><em>Parágrafo Único:</em> Caso a troca requisitada for por hardware de tecnologia mais avançada, fica o LOCADOR autorizado a cobrar a diferença de valores.</p>
  <p><strong>Cláusula Décima Terceira</strong> – No caso de falha de qualquer Hardware, o LOCADOR poderá realizar tentativa de reparação ou se obrigará a desenvolver a troca por equivalente, devendo sanar o problema em 14 dias úteis.</p>
  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DOS DANOS</h2>
  <p><strong>Cláusula Décima Sexta</strong> – Fica obrigado o LOCATÁRIO a indenizar o LOCADOR por danos causados aos equipamentos descritos na Cláusula Primeira deste pacto.</p>
  <p><strong>Cláusula Décima Sétima</strong> – O LOCATÁRIO fica ciente que o rompimento de qualquer lacre presente nos equipamentos resulta na perda de garantia de manutenção e rescisão contratual, devendo indenizar os valores despendidos.</p>
  <p><strong>Cláusula Décima Oitava</strong> – Fica o LOCATÁRIO ciente que qualquer dano advindo de problemas relacionados a sobrecarga de energia elétrica é de sua total responsabilidade. Nestes casos, a manutenção somente será realizada com o pagamento da hora trabalhada, no valor de R$ 150,00/hora.</p>
  ` : ""}
  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DA CONTRAPRESTAÇÃO</h2>
  <p><strong>Cláusula Décima Nona</strong> – Em contraprestação ao presente contrato, o ${isRental ? "LOCATÁRIO" : "CONTRATANTE"} deverá pagar ao ${isRental ? "LOCADOR" : "CONTRATADA"} parcelas iguais de <strong>R$ ${monthlyValue.toLocaleString("pt-BR")},00</strong> (${valueWords})${isRental ? `, sendo R$ ${unitPrice},00 por unidade` : ""}, mediante boleto bancário, PIX ou cartão de crédito, vencendo-se a primeira parcela em ${dueDate}.</p>
  <p><strong>Cláusula Vigésima</strong> – Todos os tributos e contribuições devidos em decorrência direta ou indireta do presente contrato serão de exclusiva responsabilidade do ${isRental ? "LOCATÁRIO" : "CONTRATANTE"}.</p>
  <p><strong>Cláusula Vigésima Primeira</strong> – Ocorrendo impontualidade no pagamento, serão cobrados juros de mora de 1% ao mês e correção monetária de acordo com a variação do IPCA, além de multa de 10% sobre o débito atualizado.</p>
  <p><strong>Cláusula Vigésima Segunda</strong> – É facultado ao ${isRental ? "LOCATÁRIO" : "CONTRATANTE"} utilizar-se de meios eletrônicos de depósito e pagamento bancário.</p>
  <p><strong>Cláusula Vigésima Terceira</strong> – Os valores serão reajustados automaticamente e anualmente de acordo com o IPCA.</p>
  ${isRental ? `
  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DA DEVOLUÇÃO</h2>
  <p><strong>Cláusula Vigésima Quarta</strong> – O LOCATÁRIO deverá devolver os computadores e periféricos ao LOCADOR quando forem por este solicitados, nas mesmas condições em que estavam quando os recebeu.</p>
  <p><strong>Cláusula Vigésima Quinta</strong> – O LOCADOR, após a devolução dos equipamentos, não se responsabiliza por arquivos salvos e não excluídos. Os computadores serão formatados e todos os dados não removidos serão excluídos definitivamente.</p>
  <p><strong>Cláusula Vigésima Sexta</strong> – A devolução se dará no prazo de 05 dias após o aviso.</p>
  <p><strong>Cláusula Vigésima Sétima</strong> – O LOCATÁRIO pagará multa de 50% sobre o valor da mensalidade para cada dia de atraso na entrega dos equipamentos.</p>
  ` : ""}
  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO PRAZO CONTRATUAL E RESCISÃO</h2>
  <p><strong>Cláusula Vigésima Oitava</strong> – O presente contrato vigorará pelo prazo mínimo de <strong>36 (trinta e seis) meses</strong>, contados de sua assinatura. Caso não haja manifestação em contrário, com prazo de 30 dias de antecedência, o contrato será renovado automaticamente, por igual período.</p>
  <p><strong>Cláusula Trigésima</strong> – O presente contrato poderá ser rescindido por qualquer das partes, após decorridos 6 meses da assinatura, mediante aviso de 30 dias de antecedência, ficando a parte que der causa obrigada a arcar com MULTA de 20% sobre as mensalidades restantes.</p>
  ${isRental ? `<p><strong>Cláusula Trigésima Primeira</strong> – Ocorrendo a impontualidade em 3 aluguéis por parte do LOCATÁRIO, fica autorizado o LOCADOR retirar todos os equipamentos, mediante aviso com prazo de 5 dias de antecedência.</p>` : ""}
  <p><strong>Cláusula Trigésima Segunda</strong> – O descumprimento das presentes cláusulas ensejará a rescisão deste instrumento.</p>
  <p><strong>Cláusula Trigésima Terceira</strong> – O ${isRental ? "LOCATÁRIO" : "CONTRATANTE"} se obriga a informar, com antecedência de até 30 dias, possíveis alterações do local de prestação de serviço.</p>
  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DAS CONDIÇÕES GERAIS</h2>
  <p><strong>Cláusula Trigésima Quinta</strong> – As relações existentes entre as partes são unicamente comerciais, não havendo nenhum vínculo trabalhista.</p>
  <p><strong>Cláusula Trigésima Sexta</strong> – As partes não poderão ceder ou transferir a terceiros os direitos e obrigações emergentes deste contrato, sem a prévia aprovação por escrito da outra parte.</p>
  <p><strong>Cláusula Trigésima Sétima</strong> – O ${isRental ? "LOCADOR" : "CONTRATADA"} obriga-se a manter sigilo e confidencialidade sobre informações obtidas em razão do presente instrumento.</p>
  <p><strong>Cláusula Trigésima Oitava</strong> – De acordo com o artigo 476 do Código Civil, fica assegurado ao ${isRental ? "LOCATÁRIO" : "CONTRATANTE"} o direito de suspender qualquer pagamento em caso de descumprimento das obrigações.</p>
  <p><strong>Cláusula Quadragésima</strong> – Não constituirá novação, a abstenção ou tolerância por qualquer das partes no exercício de qualquer direito.</p>
  <p><strong>Cláusula Quadragésima Primeira</strong> – Na hipótese de divergência entre a proposta e o presente contrato, prevalecem os termos do presente instrumento.</p>
  <p><strong>Cláusula Quadragésima Segunda</strong> – O ${isRental ? "LOCATÁRIO" : "CONTRATANTE"} compromete-se a não contratar qualquer tipo de serviço diretamente com funcionário do ${isRental ? "LOCADOR" : "CONTRATADA"} enquanto estiver no quadro de empregados e pelo prazo de 24 meses após desligamento.</p>
  <p><strong>Cláusula Quadragésima Terceira</strong> – O presente instrumento tem força de título executivo extrajudicial nos termos do artigo 585 do CPC, e é celebrado em caráter irrevogável e irretratável.</p>
  <p><strong>Cláusula Quadragésima Quarta</strong> – O presente Contrato será regido pelas leis da República Federativa do Brasil.</p>
  <p><strong>Cláusula Quadragésima Quinta</strong> – Este contrato deve ser registrado no Cartório de Registro de Títulos e Documentos.</p>
  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO FORO</h2>
  <p><strong>Cláusula Quadragésima Sexta</strong> – Fica eleito o Foro da Comarca de Jacareí/SP, com exclusão de qualquer outro, por mais privilegiado que seja, para dirimir as questões oriundas do presente contrato.</p>
  <p style="margin-top: 32px;">E, por estarem assim justas e contratadas, as partes assinam o presente Contrato, em duas vias de igual teor, na presença de 2 (duas) testemunhas abaixo assinadas.</p>
  <p style="margin-top: 24px; text-align: center;">Jacareí (SP), ${today}</p>
  <div style="margin-top: 48px; display: flex; justify-content: space-between;">
    <div style="text-align: center; width: 45%;"><div style="border-top: 1px solid #000; padding-top: 8px;"><p style="margin: 0;"><strong>${customer.responsavel}</strong></p><p style="margin: 0; font-size: 10pt;">${customer.cnpjOuCpf.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"}: ${customer.cnpjOuCpf}</p><p style="margin: 0; font-size: 10pt;">${isRental ? "LOCATÁRIO" : "CONTRATANTE"}</p></div></div>
    <div style="text-align: center; width: 45%;"><div style="border-top: 1px solid #000; padding-top: 8px;"><p style="margin: 0;"><strong>Willian Rodrigues da Silva</strong></p><p style="margin: 0; font-size: 10pt;">CPF: 377.995.388-99</p><p style="margin: 0; font-size: 10pt;">${isRental ? "LOCADOR" : "CONTRATADA"} — WMTi</p></div></div>
  </div>
  <div style="margin-top: 48px; display: flex; justify-content: space-between;">
    <div style="text-align: center; width: 45%;"><div style="border-top: 1px solid #000; padding-top: 8px;"><p style="margin: 0; font-size: 10pt;">Testemunha 1</p><p style="margin: 0; font-size: 10pt;">Nome: ___________________</p><p style="margin: 0; font-size: 10pt;">CPF nº: ___________________</p></div></div>
    <div style="text-align: center; width: 45%;"><div style="border-top: 1px solid #000; padding-top: 8px;"><p style="margin: 0; font-size: 10pt;">Testemunha 2</p><p style="margin: 0; font-size: 10pt;">Nome: ___________________</p><p style="margin: 0; font-size: 10pt;">CPF nº: ___________________</p></div></div>
  </div>
  <div data-traceability="true" style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #999;">
    <h2 style="font-size: 10pt; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; color: #333;">Dados de Rastreabilidade da Assinatura Eletrônica</h2>
    <p style="font-size: 9pt; color: #444; margin: 4px 0;">IP de origem: <strong data-proof="ip">{{SIGN_IP}}</strong></p>
    <p style="font-size: 9pt; color: #444; margin: 4px 0;">Data da confirmação: <strong data-proof="date">{{SIGN_DATE}}</strong></p>
    <p style="font-size: 9pt; color: #444; margin: 4px 0;">Hora da confirmação: <strong data-proof="time">{{SIGN_TIME}}</strong></p>
    <p style="font-size: 9pt; color: #444; margin: 4px 0;">Identificação do navegador/dispositivo (User Agent): <strong data-proof="ua">{{SIGN_USER_AGENT}}</strong></p>
    <p style="font-size: 8pt; color: #888; margin-top: 12px; font-style: italic;">Este documento foi assinado eletronicamente nos termos do art. 10 da Medida Provisória nº 2.200-2/2001. Os dados acima constituem prova eletrônica da manifestação de vontade do signatário.</p>
  </div>
</div>
`;
};

const ContractPreview = ({ visible, customer, contractType, plan, computersQty, monthlyValue }: Props) => {
  const { t } = useTranslation();
  if (!visible || !customer) return null;

  const html = generateContractHtml(customer, contractType, plan, computersQty, monthlyValue);

  return (
    <section className="py-16 bg-card">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-heading font-bold">{t("contractPreview.previewTitle")}</h2>
          </div>
          <div className="bg-background border border-border rounded-xl p-8 max-h-[70vh] overflow-y-auto prose prose-sm" dangerouslySetInnerHTML={{ __html: html }} />
        </motion.div>
      </div>
    </section>
  );
};

export default ContractPreview;

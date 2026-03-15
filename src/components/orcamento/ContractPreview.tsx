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

export const generateContractHtml = (
  customer: CustomerData,
  contractType: "locacao" | "suporte",
  plan: Plan | null,
  computersQty: number,
  monthlyValue: number
) => {
  const today = formatDate(new Date());
  const dueDate = getDueDate();
  const isRental = contractType === "locacao";

  const equipmentClause = isRental && plan
    ? `
<p>O presente contrato tem como objeto a locação de <strong>${computersQty}</strong> conjuntos de informática corporativos compostos por:</p>
<ul>
  <li>Computador Dell OptiPlex</li>
  <li>Processador ${plan.cpu}</li>
  <li>Memória RAM ${plan.ram}</li>
  <li>Armazenamento SSD ${plan.ssd}</li>
  <li>Placa de rede Gigabit</li>
  <li>Monitor Dell 18.5"</li>
  <li>Teclado USB ABNT2</li>
  <li>Mouse óptico USB</li>
</ul>
<p>Cada conjunto locado é composto por gabinete, monitor, teclado e mouse formando um único conjunto operacional de informática.</p>
`
    : `
<p>A CONTRATADA se compromete a prestar serviços de suporte técnico mensal para <strong>${computersQty}</strong> computador${computersQty > 1 ? "es" : ""} e infraestrutura de rede da CONTRATANTE, incluindo:</p>
<ul>
  <li>Suporte técnico remoto e presencial</li>
  <li>Manutenção preventiva e corretiva</li>
  <li>Monitoramento da infraestrutura de rede</li>
  <li>Gestão de servidores Windows Server</li>
  <li>Consultoria de infraestrutura</li>
</ul>
`;

  return `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #1a1a2e; line-height: 1.7;">
  <div style="text-align: center; margin-bottom: 32px; border-bottom: 2px solid #e2e8f0; padding-bottom: 24px;">
    <h1 style="font-size: 20px; font-weight: 700; margin: 0;">
      CONTRATO DE ${isRental ? "LOCAÇÃO DE EQUIPAMENTOS E SERVIÇOS DE TI" : "PRESTAÇÃO DE SERVIÇOS DE TI"}
    </h1>
  </div>

  <h2 style="font-size: 15px; font-weight: 600; color: #475569; margin-top: 28px;">PARTES</h2>

  <p><strong>CONTRATANTE:</strong> ${customer.razaoSocial}${customer.nomeFantasia ? ` (${customer.nomeFantasia})` : ""}<br/>
  CNPJ/CPF: ${customer.cnpjOuCpf}<br/>
  Responsável: ${customer.responsavel}<br/>
  Endereço: ${customer.endereco}, ${customer.cidade} — CEP ${customer.cep}<br/>
  E-mail: ${customer.email}${customer.telefone ? `<br/>Telefone: ${customer.telefone}` : ""}</p>

  <p><strong>CONTRATADA:</strong> WM Tecnologia da Informação LTDA<br/>
  CNPJ: 00.000.000/0001-00<br/>
  Endereço: São José dos Campos — SP</p>

  <h2 style="font-size: 15px; font-weight: 600; color: #475569; margin-top: 28px;">CLÁUSULA 1 — OBJETO</h2>
  ${equipmentClause}

  <h2 style="font-size: 15px; font-weight: 600; color: #475569; margin-top: 28px;">CLÁUSULA 2 — VALOR</h2>
  <p>O valor mensal será de <strong>R$ ${monthlyValue.toLocaleString("pt-BR")},00</strong> (${monthlyValue} reais)${isRental ? `, sendo R$ ${plan ? plan.price : 0},00 por unidade` : ""}.</p>

  <h2 style="font-size: 15px; font-weight: 600; color: #475569; margin-top: 28px;">CLÁUSULA 3 — SERVIÇOS INCLUSOS</h2>
  <ul>
    <li>Suporte técnico durante vigência do contrato</li>
    <li>Manutenção preventiva e corretiva</li>
    <li>Monitoramento da infraestrutura de rede</li>
    ${isRental ? "<li>Reposição de equipamentos defeituosos</li><li>Active Directory e controle de usuários</li>" : "<li>Gestão de servidores Windows Server</li><li>Consultoria de infraestrutura</li>"}
  </ul>

  <h2 style="font-size: 15px; font-weight: 600; color: #475569; margin-top: 28px;">CLÁUSULA 4 — VIGÊNCIA</h2>
  <p>O contrato terá vigência mínima de <strong>36 (trinta e seis) meses</strong> a partir da data de assinatura, podendo ser renovado automaticamente por períodos iguais.</p>
  <p style="margin-top: 8px; font-size: 13px; color: #64748b;"><em>A contratação da WMTi possui prazo mínimo contratual de 36 meses.</em></p>

  <h2 style="font-size: 15px; font-weight: 600; color: #475569; margin-top: 28px;">CLÁUSULA 5 — PAGAMENTO</h2>
  <p>O pagamento deverá ser efetuado até o dia 10 de cada mês, via boleto bancário ou cartão de crédito. O primeiro vencimento será em <strong>${dueDate}</strong>.</p>

  <h2 style="font-size: 15px; font-weight: 600; color: #475569; margin-top: 28px;">CLÁUSULA 6 — RESCISÃO</h2>
  <p>Qualquer das partes poderá rescindir o contrato mediante aviso prévio de 30 (trinta) dias.</p>

  <div style="margin-top: 40px; padding-top: 24px; border-top: 2px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 13px;">
    <p>Data do contrato: ${today}</p>
    <p>WM Tecnologia da Informação LTDA — Todos os direitos reservados</p>
  </div>
</div>
`.trim();
};

const ContractPreview = ({ visible, customer, contractType, plan, computersQty, monthlyValue }: Props) => {
  if (!visible || !customer) return null;

  const html = generateContractHtml(customer, contractType, plan, computersQty, monthlyValue);

  return (
    <section id="contract-preview" className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            Contrato
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            Revise o <span className="text-primary">contrato</span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            Leia atentamente o contrato gerado automaticamente com base nos dados do orçamento.
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto">
          <div className="bg-background border border-border rounded-xl p-6 md:p-8 max-h-[600px] overflow-y-auto">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
              <FileText className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">
                Contrato de {contractType === "locacao" ? "Locação de Equipamentos" : "Serviços de TI"}
              </span>
            </div>
            <div
              className="prose prose-sm max-w-none text-foreground/80"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContractPreview;

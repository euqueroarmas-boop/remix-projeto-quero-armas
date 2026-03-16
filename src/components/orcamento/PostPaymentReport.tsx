import { motion } from "framer-motion";
import { Building2, Monitor, CheckCircle, FileText, Calendar, DollarSign } from "lucide-react";
import type { Plan } from "./PlanSelector";
import type { QualificationData } from "./QualificationForm";
import type { RegistrationData } from "./QuickRegistrationForm";

interface Props {
  visible: boolean;
  effectivePath: "locacao" | "suporte" | null;
  plan: Plan;
  qualification: QualificationData | null;
  registration: RegistrationData | null;
  computersQty: number;
  monthlyValue: number;
}

const PostPaymentReport = ({
  visible,
  effectivePath,
  plan,
  qualification,
  registration,
  computersQty,
  monthlyValue,
}: Props) => {
  if (!visible || !effectivePath) return null;

  const isRental = effectivePath === "locacao";
  const companyName = registration?.razaoSocial || qualification?.companyName || "Empresa";
  const nomeFantasia = registration?.nomeFantasia || "";
  const cnpj = registration?.cnpjOuCpf || qualification?.cnpj || "";
  const email = registration?.email || qualification?.contactEmail || "";
  const phone = registration?.telefone || qualification?.contactPhone || "";
  const city = registration?.cidade
    ? `${registration.cidade}/${registration.uf}`
    : qualification?.city
      ? `${qualification.city}${qualification.state ? `/${qualification.state}` : ""}`
      : "";

  return (
    <section className="py-16 bg-card">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
              Contratação <span className="text-primary">confirmada</span>
            </h2>
            <p className="text-muted-foreground text-sm mt-2">
              Confira o resumo completo do seu pedido
            </p>
          </div>

          <div className="bg-background border border-border rounded-2xl overflow-hidden">
            {/* Company data */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold text-foreground">Dados da empresa</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Razão social</span>
                  <span className="font-semibold text-foreground text-right max-w-[60%]">{companyName}</span>
                </div>
                {nomeFantasia && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nome fantasia</span>
                    <span className="font-semibold text-foreground">{nomeFantasia}</span>
                  </div>
                )}
                {cnpj && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CNPJ/CPF</span>
                    <span className="font-semibold text-foreground">{cnpj}</span>
                  </div>
                )}
                {email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">E-mail</span>
                    <span className="font-semibold text-foreground">{email}</span>
                  </div>
                )}
                {phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Telefone</span>
                    <span className="font-semibold text-foreground">{phone}</span>
                  </div>
                )}
                {city && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cidade</span>
                    <span className="font-semibold text-foreground">{city}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Equipment / Service */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3 mb-4">
                <Monitor className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold text-foreground">
                  {isRental ? "Equipamentos contratados" : "Serviço contratado"}
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                {isRental ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Configuração</span>
                      <span className="font-semibold text-foreground">{plan.name} — {plan.cpu}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Memória / Armazenamento</span>
                      <span className="font-semibold text-foreground">{plan.ram} / {plan.ssd}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantidade</span>
                      <span className="font-semibold text-foreground">
                        {computersQty} computador{computersQty > 1 ? "es" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor unitário mensal</span>
                      <span className="font-semibold text-foreground">
                        R$ {plan.price.toLocaleString("pt-BR")},00
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Computadores atendidos</span>
                    <span className="font-semibold text-foreground">{computersQty}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Included services */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold text-foreground">Serviços incluídos</h3>
              </div>
              <div className="space-y-2">
                {[
                  "Suporte técnico remoto e presencial",
                  "Monitoramento de infraestrutura",
                  "Manutenção preventiva mensal",
                  ...(isRental ? ["Substituição imediata de equipamentos"] : []),
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Term */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold text-foreground">Prazo contratual</h3>
              </div>
              <p className="text-sm text-foreground">36 meses (mínimo)</p>
            </div>

            {/* Financial summary */}
            <div className="p-6 bg-primary/5">
              <div className="flex items-center gap-3 mb-4">
                <DollarSign className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold text-foreground">Estimativa mensal da sua infraestrutura</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Valor mensal do contrato</span>
                  <span className="text-2xl font-bold text-primary">
                    R$ {monthlyValue.toLocaleString("pt-BR")},00
                  </span>
                </div>
                {isRental && (
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-muted-foreground">Total estimado em 36 meses</span>
                    <span className="font-semibold text-foreground">
                      R$ {(monthlyValue * 36).toLocaleString("pt-BR")},00
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Documento gerado automaticamente. A equipe WMTi entrará em contato para confirmar os próximos passos.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default PostPaymentReport;

import { motion } from "framer-motion";
import { CreditCard, Clock, CheckCircle } from "lucide-react";

interface Props {
  visible: boolean;
  monthlyValue: number;
  companyName: string;
}

const PaymentPreparation = ({ visible, monthlyValue, companyName }: Props) => {
  if (!visible) return null;

  return (
    <section className="py-16 section-dark">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-lg mx-auto text-center"
        >
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            Pagamento
          </span>
          <h2 className="text-2xl md:text-3xl font-heading font-bold mb-6">
            Preparação do <span className="text-primary">pagamento</span>
          </h2>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{companyName || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valor mensal</span>
              <span className="font-bold text-primary text-lg">
                R${monthlyValue.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Método</span>
              <span className="font-medium">Boleto / PIX / Cartão</span>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Contrato assinado digitalmente</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Aguardando configuração do gateway de pagamento (Asaas)</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CreditCard className="w-4 h-4" />
                <span>Cobrança será ativada após integração</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            O link de pagamento será enviado por e-mail após a aprovação da proposta.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default PaymentPreparation;

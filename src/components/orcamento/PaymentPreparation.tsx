import { motion } from "framer-motion";
import { CreditCard, Clock, CheckCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappLink } from "@/lib/whatsapp";

interface Props {
  visible: boolean;
  monthlyValue: number;
  companyName: string;
}

const PaymentPreparation = ({ visible, monthlyValue, companyName }: Props) => {
  if (!visible) return null;

  const whatsappMessage = encodeURIComponent(
    `Olá! Acabei de assinar o contrato para o plano de infraestrutura de TI. Empresa: ${companyName || "—"}, Valor: R$${monthlyValue.toLocaleString("pt-BR")}/mês. Gostaria de prosseguir com o pagamento.`
  );
  const whatsappLink = `https://wa.me/5516988342704?text=${whatsappMessage}`;

  return (
    <section id="payment-section" className="py-16 section-dark">
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
              <span className="font-medium">Boleto / Cartão de Crédito</span>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Contrato assinado digitalmente</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-primary" />
                <span>Link de pagamento será enviado em breve</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CreditCard className="w-4 h-4" />
                <span>Cobrança recorrente via Boleto ou Cartão de Crédito</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <Button
                asChild
                size="lg"
                className="w-full gap-2 text-base font-semibold"
              >
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-5 h-5" />
                  Solicitar link de pagamento via WhatsApp
                </a>
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Após o contato, enviaremos o link de pagamento por e-mail ou WhatsApp.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default PaymentPreparation;

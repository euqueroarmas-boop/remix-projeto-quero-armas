import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { CreditCard, FileBarChart, Loader2, CheckCircle, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type BillingType = "BOLETO" | "CREDIT_CARD";

interface Props {
  visible: boolean;
  monthlyValue: number;
  onSelectPayment: (billingType: BillingType) => Promise<string | null>;
  completed: boolean;
  invoiceUrl: string | null;
  error?: string | null;
}

const PaymentSelector = ({ visible, monthlyValue, onSelectPayment, completed, invoiceUrl, error }: Props) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<BillingType | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (completed && invoiceUrl) {
      window.open(invoiceUrl, "_blank", "noopener,noreferrer");
    }
  }, [completed, invoiceUrl]);

  if (!visible) return null;

  if (completed && invoiceUrl) {
    return (
      <section id="payment-selection" className="py-16 bg-card">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto bg-background border border-primary/20 rounded-2xl p-8 space-y-4">
            <CheckCircle className="w-12 h-12 text-primary mx-auto" />
            <h3 className="text-xl font-heading font-bold">{t("paymentSelector.successTitle")}</h3>
            <p className="text-muted-foreground text-sm">{t("paymentSelector.successDesc")}</p>
            <Button onClick={() => window.open(invoiceUrl, "_blank", "noopener,noreferrer")} variant="outline" className="w-full h-12">
              <ExternalLink className="w-4 h-4 mr-2" />
              {t("paymentSelector.reopenCheckout")}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try { await onSelectPayment(selected); } finally { setLoading(false); }
  };

  return (
    <section id="payment-selection" className="py-20 section-dark">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            {t("paymentSelector.tag")}
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            {t("paymentSelector.title")} <span className="text-primary">{t("paymentSelector.titleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("paymentSelector.monthlyValue")} <strong className="text-primary">R$ {monthlyValue.toLocaleString("pt-BR")},00</strong>
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto">
          {error && (
            <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-destructive">{t("paymentSelector.errorTitle")}</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <p className="text-xs text-muted-foreground mt-2">{t("paymentSelector.errorRetryHint")}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <button type="button" onClick={() => setSelected("BOLETO")} className={`p-6 rounded-xl border-2 transition-all text-left ${selected === "BOLETO" ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border bg-card hover:border-primary/30"}`}>
              <FileBarChart className={`w-8 h-8 mb-3 ${selected === "BOLETO" ? "text-primary" : "text-muted-foreground"}`} />
              <h3 className="font-heading font-bold text-lg mb-1">{t("paymentSelector.boleto")}</h3>
              <p className="text-sm text-muted-foreground">{t("paymentSelector.boletoDesc")}</p>
            </button>
            <button type="button" onClick={() => setSelected("CREDIT_CARD")} className={`p-6 rounded-xl border-2 transition-all text-left ${selected === "CREDIT_CARD" ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border bg-card hover:border-primary/30"}`}>
              <CreditCard className={`w-8 h-8 mb-3 ${selected === "CREDIT_CARD" ? "text-primary" : "text-muted-foreground"}`} />
              <h3 className="font-heading font-bold text-lg mb-1">{t("paymentSelector.creditCard")}</h3>
              <p className="text-sm text-muted-foreground">{t("paymentSelector.creditCardDesc")}</p>
            </button>
          </div>

          <Button onClick={handleConfirm} disabled={!selected || loading} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CreditCard className="w-5 h-5 mr-2" />}
            {error ? t("paymentSelector.retry") : t("paymentSelector.generate")}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PaymentSelector;

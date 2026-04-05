import { ShieldCheck, CheckCircle2, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { openWhatsApp } from "@/lib/whatsapp";

interface GuaranteeBlockProps {
  serviceName?: string;
}

const GuaranteeBlock = ({ serviceName }: GuaranteeBlockProps) => {
  const { t } = useTranslation();

  const bullets = [
    t("guarantee.bullet1", "Correções incluídas dentro do escopo contratado"),
    t("guarantee.bullet2", "Mais previsibilidade para sua empresa"),
    t("guarantee.bullet3", "Redução de risco técnico e financeiro"),
    t("guarantee.bullet4", "Compromisso real com a entrega"),
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      className="w-full py-10 md:py-14"
      data-section-type="guarantee"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="relative rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-sm p-6 sm:p-10 shadow-lg shadow-primary/5">
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-primary/80 via-primary to-primary/80" />

          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="h-7 w-7 text-primary shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {t("guarantee.title", "Você não corre risco com a WMTi.")}
            </h2>
          </div>

          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-4">
            <p className="text-primary font-bold text-sm sm:text-base leading-relaxed">
              🛡️ {t("guarantee.highlight", "A GARANTIA É A MESMA QUANTIDADE DE HORAS COMPRADAS.")}
            </p>
            <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
              {t("guarantee.highlightDesc", "Comprou 3 horas = 3 horas de garantia. Comprou 5 horas = 5 horas de garantia. Comprou 10 horas = 10 horas de garantia.")}
            </p>
          </div>

          <p className="text-muted-foreground leading-relaxed mb-2">
            {t("guarantee.desc1", "Se algo não sair exatamente como deveria, nós voltamos e corrigimos — sem custo adicional.")}
          </p>
          <p className="text-muted-foreground leading-relaxed mb-6">
            {t("guarantee.desc2", "A quantidade de horas que você contrata também funciona como garantia para ajustes e correções dentro do escopo do serviço. Sem cobrança surpresa. Sem risco para sua operação.")}
          </p>

          <ul className="grid gap-3 sm:grid-cols-2 mb-8">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-foreground/90">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => openWhatsApp({ intent: "specialist" })}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            {t("guarantee.cta", "Fale com a WMTi")}
          </button>
        </div>
      </div>
    </motion.section>
  );
};

export default GuaranteeBlock;

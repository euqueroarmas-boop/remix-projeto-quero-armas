import { ShieldCheck, CheckCircle2, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { openWhatsApp } from "@/lib/whatsapp";

const bullets = [
  "Correções incluídas dentro do escopo contratado",
  "Mais previsibilidade para sua empresa",
  "Redução de risco técnico e financeiro",
  "Compromisso real com a entrega",
];

const GuaranteeBlock = () => (
  <motion.section
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-40px" }}
    transition={{ duration: 0.5 }}
    className="w-full py-10 md:py-14"
  >
    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      <div className="relative rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-sm p-6 sm:p-10 shadow-lg shadow-primary/5">
        {/* accent bar */}
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-primary/80 via-primary to-primary/80" />

        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="h-7 w-7 text-primary shrink-0" />
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Você não corre risco com a WMTi.
          </h2>
        </div>

        <p className="text-muted-foreground leading-relaxed mb-2">
          Se algo não sair exatamente como deveria, nós voltamos e corrigimos — sem custo adicional.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-6">
          A quantidade de horas que você contrata também funciona como garantia para ajustes e correções dentro do escopo do serviço. Sem cobrança surpresa. Sem risco para sua operação.
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
          Fale com a WMTi
        </button>
      </div>
    </div>
  </motion.section>
);

export default GuaranteeBlock;

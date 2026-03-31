import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Clock, CalendarCheck, CheckCircle2, ArrowRight, Zap } from "lucide-react";

export type ContractMode = "sob_demanda" | "recorrente";
export type AllowedModes = "both" | "sob_demanda_only" | "recorrente_only";

interface Props {
  mode: ContractMode | null;
  onSelect: (mode: ContractMode) => void;
  allowedModes?: AllowedModes;
}

const ContractModeSelector = ({ mode, onSelect, allowedModes = "both" }: Props) => {
  const { t } = useTranslation();

  // If only one mode allowed, auto-select and don't render selector
  if (allowedModes === "sob_demanda_only") {
    if (!mode) onSelect("sob_demanda");
    return null;
  }
  if (allowedModes === "recorrente_only") {
    if (!mode) onSelect("recorrente");
    return null;
  }

  const options = [
    {
      id: "sob_demanda" as ContractMode,
      icon: Clock,
      title: t("contractMode.sobDemandaTitle", "Sob demanda / por hora"),
      desc: t("contractMode.sobDemandaDesc", "Serviço pontual com calculadora de horas. Ideal para demandas específicas e urgências."),
      highlights: [
        t("contractMode.sobDemandaH1", "Execução imediata"),
        t("contractMode.sobDemandaH2", "Sem vínculo mensal"),
        t("contractMode.sobDemandaH3", "Garantia de 15 dias incluída"),
      ],
      accent: "text-amber-500",
      accentBg: "bg-amber-500/10 border-amber-500/20",
      accentBgActive: "bg-amber-500/5 border-amber-500 shadow-amber-500/10",
    },
    {
      id: "recorrente" as ContractMode,
      icon: CalendarCheck,
      title: t("contractMode.recorrenteTitle", "Plano recorrente / mensal"),
      desc: t("contractMode.recorrenteDesc", "Contrato mensal com SLA, descontos progressivos e suporte contínuo para sua empresa."),
      highlights: [
        t("contractMode.recorrenteH1", "Descontos de até 12%"),
        t("contractMode.recorrenteH2", "SLA garantido"),
        t("contractMode.recorrenteH3", "Suporte 24h disponível"),
      ],
      accent: "text-primary",
      accentBg: "bg-primary/10 border-primary/20",
      accentBgActive: "bg-primary/5 border-primary shadow-primary/10",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="py-10 md:py-14"
    >
      <div className="container max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-3">
            {t("contractMode.tag", "Modelo de contratação")}
          </p>
          <h2 className="text-xl md:text-3xl font-bold text-foreground mb-2">
            {t("contractMode.title", "Como você prefere contratar?")}
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            {t("contractMode.subtitle", "Escolha o modelo ideal para sua necessidade. Você pode mudar a qualquer momento.")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          {options.map((opt) => {
            const isActive = mode === opt.id;
            return (
              <motion.button
                key={opt.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelect(opt.id)}
                className={`relative text-left rounded-xl border-2 p-5 md:p-6 transition-all duration-300 cursor-pointer flex flex-col h-full ${
                  isActive ? opt.accentBgActive + " shadow-lg" : "border-border bg-card hover:border-muted-foreground/30"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="contract-mode-check"
                    className="absolute top-3 right-3"
                  >
                    <CheckCircle2 className={`w-5 h-5 ${opt.accent}`} />
                  </motion.div>
                )}

                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${isActive ? opt.accentBg : "bg-muted"}`}>
                  <opt.icon className={`w-5 h-5 ${isActive ? opt.accent : "text-muted-foreground"}`} />
                </div>

                <h3 className="text-base md:text-lg font-bold text-foreground mb-2">{opt.title}</h3>
                <p className="text-xs md:text-sm text-muted-foreground mb-4 flex-1">{opt.desc}</p>

                <ul className="space-y-1.5">
                  {opt.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2 text-xs text-foreground/80">
                      <Zap className={`w-3 h-3 shrink-0 ${isActive ? opt.accent : "text-muted-foreground"}`} />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border/50">
                  <span className={`text-xs font-semibold ${isActive ? opt.accent : "text-muted-foreground"}`}>
                    {t("contractMode.select", "Selecionar")}
                  </span>
                  <ArrowRight className={`w-3 h-3 ${isActive ? opt.accent : "text-muted-foreground"}`} />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
};

export default ContractModeSelector;
